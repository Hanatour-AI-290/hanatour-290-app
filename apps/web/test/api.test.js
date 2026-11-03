// 화면 기록 → API Expense 변환 (apps/web/src/api.js). 정산 금액이 이 변환에 달려 있어서 따로 확인한다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Expense } from '@h290/shared'
import { confirmFor, dayDate, paidAtOf, toExpense, toMinor } from '../src/api.js'

const fx = { rate: 26.8, date: '2026-11-05', source: 'Frankfurter' }
const fxOf = (cur) => (cur === 'TRY' ? fx : null)
const base = { id: 'r1', src: '직접', day: 3, time: '19:40', name: '저녁', category: '식사', perPerson: false, status: 'done', method: 'card' }

test('날짜: DAY 3 = 2026-11-05, 시각이 없으면 정오', () => {
  assert.equal(dayDate(3), '2026-11-05')
  assert.equal(paidAtOf({ day: 3, time: '공항' }, 3), '2026-11-05T12:00:00+03:00')
  assert.equal(paidAtOf({ day: 0, time: '09:30' }, 3), '2026-11-05T09:30:00+03:00')
})

test('금액은 최소 단위로 (TRY 3,560 → 356000, KRW 100,000 → 100000)', () => {
  assert.equal(toMinor(3560, 'TRY'), 356000)
  assert.equal(toMinor(0.1 + 0.2, 'EUR'), 30)
  assert.equal(toMinor(100000, 'KRW'), 100000)
})

test('같이 쓴 돈: 결제자 1명 · 나눌 사람 · 확인 · 결제일 환율, 스키마 통과', () => {
  const e = toExpense({ ...base, amount: 3560, currency: 'TRY', payer: '지우', people: ['지우', '하린', '서준'], confirm: { 하린: 'confirmed', 서준: 'declined' } }, fxOf, 3)
  assert.deepEqual(e.payers, [{ memberId: 'm1', amount: 356000, method: 'card' }])
  assert.deepEqual(e.memberIds, ['m1', 'm2', 'm4'])
  assert.deepEqual(e.confirmations, [{ memberId: 'm2', status: 'confirmed' }, { memberId: 'm4', status: 'declined' }])
  assert.deepEqual(e.fx, fx)
  assert.equal(e.paidAt, '2026-11-05T19:40:00+03:00')
  assert.ok(Expense.safeParse(e).success)
})

test('일정의 1인 금액 · 각자 냄: 사람마다 자기 몫을 낸 것으로', () => {
  const e = toExpense({ ...base, src: '일정', idx: 0, category: '가이드·기사 경비', amount: 100000, currency: 'KRW', perPerson: true, payer: null, people: ['지우', '하린'] }, fxOf, 3)
  assert.equal(e.total.amount, 200000)
  assert.deepEqual(e.payers.map((p) => p.amount), [100000, 100000])
  assert.equal(e.category, '기타') // 지출 분류 6개 밖 → 기타, 리포트는 planItem 으로 원래 분류를 찾는다
  assert.equal(e.planItem, 0)
  assert.equal(e.fx, undefined)
  assert.ok(Expense.safeParse(e).success)
})

test('정산에 못 넣는 기록은 null (안 함 · 금액 미정 · 확인 전 영수증)', () => {
  assert.equal(toExpense({ ...base, status: 'skip', amount: 10, currency: 'TRY', payer: '지우', people: ['지우'] }, fxOf, 3), null)
  assert.equal(toExpense({ ...base, amount: null, currency: null, payer: '지우', people: ['지우'] }, fxOf, 3), null)
  assert.equal(toExpense({ ...base, status: 'review', amount: 10, currency: 'TRY', payer: '지우', people: ['지우'] }, fxOf, 3), null)
})

test('확인 요청은 결제자를 뺀 사람에게만', () => {
  assert.deepEqual(confirmFor(['지우', '하린', '도윤'], '지우'), { 하린: 'pending', 도윤: 'pending' })
})
