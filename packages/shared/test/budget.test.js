import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Estimate, Expense, dailyBudget, daySummary, findDuplicates, includedItems, report, reportKey } from '../src/index.js'

const ROOM = ['m1', 'm2', 'm3', 'm4']

// 프로토타입 시연 예시(sample.js SAMPLE_RESULT)를 줄인 것
const estimate = Estimate.parse({
  title: '튀르키예 일주 7박 9일',
  base_price_krw: 1240000,
  items: [
    { name: '가이드/기사 경비', category: '가이드·기사 경비', amount: 100000, currency: 'KRW', required: true },
    { name: '카파도키아 열기구 투어', category: '선택관광', amount: 320, currency: 'EUR', required: false },
    { name: '안탈리아 유람선 투어', category: '선택관광', amount: 60, currency: 'EUR', required: false },
    { name: '지프 사파리', category: '선택관광', amount: null, currency: 'OTHER', required: false },
    { name: '싱글차지', category: '싱글차지', amount: 200000, currency: 'KRW', required: true },
  ],
  fx: { date: '2026-10-30', krw: { EUR: 1500 } },
})

const exp = (o) => Expense.parse({ tripId: 't1', createdAt: '2026-11-05T12:00:00+03:00', ...o })

test('예상 비용 항목: 모두 내는 돈 + 고른 것, 싱글차지는 고를 때만', () => {
  assert.deepEqual(includedItems(estimate, [1, 3]), [0, 1, 3])
  assert.deepEqual(includedItems(estimate, [4]), [0, 4])
})

test('분류 → 리포트 항목', () => {
  assert.equal(reportKey('불포함 식사'), '식사')
  assert.equal(reportKey('싱글차지'), '기타')
  assert.equal(reportKey('쇼핑'), '쇼핑')
  assert.equal(reportKey(undefined), '기타')
})

test('하루 예산: (추가 비용 + 생활비 × 일수) ÷ 일수, 금액 모르는 항목은 따로', () => {
  const b = dailyBudget({ estimate, picks: [1, 3], days: 9, livingPerDayKrw: 50000 })
  assert.equal(b.extraKrw, 100000 + 320 * 1500)
  assert.equal(b.perDayKrw, Math.round((580000 + 450000) / 9))
  assert.deepEqual(b.unknownItems, [3])
  assert.equal(b.livingIsExample, true)
})

test('리포트: 상품가 + 내 몫 = 진짜 총비용, 일정에서 기록한 지출은 그 항목으로', () => {
  const expenses = [
    // 열기구: 4명이 각자 320유로, 지우가 한 번에 결제
    exp({ id: 'a', planItem: 1, category: '기타', payers: [{ memberId: 'm1', amount: 128000, method: 'card' }], total: { amount: 128000, currency: 'EUR' }, fx: { rate: 1500, date: '2026-11-05', source: 'Frankfurter' } }),
    // 저녁: 4명 1/N, 600리라
    exp({ id: 'b', category: '식사', payers: [{ memberId: 'm2', amount: 60000, method: 'card' }], total: { amount: 60000, currency: 'TRY' }, fx: { rate: 40, date: '2026-11-05', source: 'Frankfurter' } }),
    // 서준 혼자 쇼핑 (지우 몫 없음)
    exp({ id: 'c', category: '쇼핑', memberIds: ['m4'], payers: [{ memberId: 'm4', amount: 5000, method: 'cash' }], total: { amount: 5000, currency: 'EUR' } }),
  ]
  const r = report({ estimate, picks: [1, 2], memberId: 'm1', memberIds: ROOM, expenses })
  const row = (k) => r.rows.find((x) => x.key === k)
  assert.deepEqual(row('선택관광'), { key: '선택관광', predicted: (320 + 60) * 1500, actual: 320 * 1500 })
  assert.equal(row('식사').actual, 150 * 40)
  assert.equal(r.actualTotal, 1240000 + 480000 + 6000)
  assert.deepEqual(r.unrecordedItems, [0, 2])
  assert.equal(r.extraCount, 1)
  assert.deepEqual(r.missingFx, [])
})

test('하루 끝 요약: 오늘 쓴 내 몫과 이 속도면 모자라는 금액', () => {
  const expenses = [
    exp({ id: 'd1', paidAt: '2026-11-04T20:00:00+03:00', payers: [{ memberId: 'm1', amount: 120000, method: 'card' }], total: { amount: 120000, currency: 'TRY' }, fx: { rate: 40, date: '2026-11-04', source: 'Frankfurter' } }),
    exp({ id: 'd2', paidAt: '2026-11-05T13:00:00+03:00', payers: [{ memberId: 'm2', amount: 120000, method: 'card' }], total: { amount: 120000, currency: 'TRY' }, fx: { rate: 40, date: '2026-11-05', source: 'Frankfurter' } }),
    exp({ id: 'd3', paidAt: '2026-11-06T09:00:00+03:00', payers: [{ memberId: 'm2', amount: 99900, method: 'card' }], total: { amount: 99900, currency: 'TRY' } }),
  ]
  const wallets = [{ memberId: 'm1', balances: [{ amount: 100000, currency: 'TRY', method: 'card' }, { amount: 20000, currency: 'TRY', method: 'cash' }] }]
  const s = daySummary({ memberId: 'm1', memberIds: ROOM, expenses, wallets, date: '2026-11-05', day: 2, days: 9 })
  assert.equal(s.todayKrw, 300 * 40) // 오늘(d2) 내 몫 TRY 300
  assert.equal(s.todayCount, 1)
  // 이틀 동안 TRY 600 → 하루 300, 남은 7일 2,100 필요, 잔액 1,200 → 900 부족
  assert.deepEqual(s.byCurrency, [{ currency: 'TRY', balance: 120000, spent: 60000, perDay: 30000, need: 210000, shortfall: 90000 }])
})

test('중복 결제: 같은 통화 · 금액 1% · 30분 · 가게 이름', () => {
  const base = { payers: [{ memberId: 'm1', amount: 62000, method: 'card' }], total: { amount: 62000, currency: 'TRY' } }
  const old = [
    exp({ id: 'o1', ...base, paidAt: '2026-11-05T14:10:00+03:00', merchant: 'GOREME CAFE' }),
    exp({ id: 'o2', ...base, paidAt: '2026-11-05T14:20:00+03:00', merchant: 'Kebapci Ali' }),
    exp({ id: 'o3', ...base, paidAt: '2026-11-05T17:00:00+03:00' }),
    exp({ id: 'o4', ...base, total: { amount: 62000, currency: 'EUR' }, paidAt: '2026-11-05T14:10:00+03:00' }),
  ]
  const fresh = exp({ id: 'n1', ...base, total: { amount: 62300, currency: 'TRY' }, paidAt: '2026-11-05T14:12:00+03:00', merchant: 'Goreme Cafe' })
  assert.deepEqual(findDuplicates(fresh, old), [{ id: 'o1', amountDiff: 300, minutesApart: 2, sameMerchant: true }])
  const noName = exp({ ...fresh, merchant: undefined })
  assert.deepEqual(findDuplicates(noName, old).map((d) => d.id), ['o1', 'o2'])
})
