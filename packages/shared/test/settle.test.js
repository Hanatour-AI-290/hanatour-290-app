import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  Expense, applyCashTransfer, applyExpense, checkExpense, expenseShares, minTransfers, settle, toKrw,
} from '../src/index.js'

const ROOM = ['m1', 'm2', 'm3', 'm4'] // 지우, 하린, 도윤, 서준
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
const exp = (o) => Expense.parse({ id: 'e1', tripId: 't1', createdAt: '2026-11-05T19:00:00+03:00', ...o })

test('기본은 정산방 전원 1/N', () => {
  const e = exp({ payers: [{ memberId: 'm1', amount: 60000, method: 'card' }], total: { amount: 60000, currency: 'TRY' } })
  assert.deepEqual(expenseShares(e, ROOM), { m1: 15000, m2: 15000, m3: 15000, m4: 15000 })
})

test('나누어떨어지지 않으면 남는 금액은 낸 사람이 부담', () => {
  const e = exp({ payers: [{ memberId: 'm2', amount: 1000, method: 'card' }], total: { amount: 1000, currency: 'EUR' }, memberIds: ['m1', 'm2', 'm3'] })
  const s = expenseShares(e, ROOM)
  assert.deepEqual(s, { m1: 333, m2: 334, m3: 333 })
  assert.equal(sum(s), 1000)
})

test('줄별 배정 + 세금은 몫 비율대로 ("맥주는 하린이랑 도윤, 서준은 술 빼고")', () => {
  const e = exp({
    payers: [{ memberId: 'm1', amount: 1200, method: 'card' }],
    total: { amount: 1200, currency: 'EUR' },
    lines: [
      { name: 'Kebap', qty: 4, unitPrice: 200, total: 800 },
      { name: 'Efes Bira', qty: 2, unitPrice: 150, total: 300 },
      { name: 'KDV', kind: 'tax', unitPrice: 100, total: 100 },
    ],
    splits: [{ lineIndex: 1, memberIds: ['m2', 'm3'] }],
  })
  const s = expenseShares(e, ROOM)
  // 메뉴 몫: m1 200, m2 350, m3 350, m4 200 (합 1100) → 세금 100 을 같은 비율로
  assert.equal(sum(s), 1200)
  assert.equal(s.m2, s.m3)
  assert.equal(s.m4, Math.floor((1200 * 200) / 1100))
  assert.ok(s.m2 > s.m4)
})

test('"안 갔어요" 를 누르면 그 사람을 빼고 다시 나눈다', () => {
  const e = exp({
    payers: [{ memberId: 'm1', amount: 60000, method: 'card' }],
    total: { amount: 60000, currency: 'TRY' },
    confirmations: [{ memberId: 'm4', status: 'declined' }, { memberId: 'm2', status: 'confirmed' }],
  })
  assert.deepEqual(expenseShares(e, ROOM), { m1: 20000, m2: 20000, m3: 20000 })
})

test('결제자가 여러 명이어도 통화별 차액과 보낼 돈이 맞다', () => {
  const e = exp({
    payers: [{ memberId: 'm1', amount: 44000, method: 'cash' }, { memberId: 'm3', amount: 56000, method: 'card' }],
    total: { amount: 100000, currency: 'TRY' },
  })
  const r = settle({ memberIds: ROOM, expenses: [e] })
  const t = r.byCurrency.TRY
  assert.deepEqual(t.net, { m1: 19000, m2: -25000, m3: 31000, m4: -25000 })
  assert.equal(sum(t.net), 0)
  const got = Object.fromEntries(ROOM.map((id) => [id, 0]))
  for (const x of t.transfers) {
    got[x.fromId] -= x.amount
    got[x.toId] += x.amount
  }
  assert.deepEqual(got, { m1: 19000, m2: -25000, m3: 31000, m4: -25000 })
})

test('통화를 섞지 않고 따로 계산하고, 원화 합계는 결제일 환율로', () => {
  const a = exp({ id: 'a', payers: [{ memberId: 'm1', amount: 40000, method: 'card' }], total: { amount: 40000, currency: 'TRY' }, fx: { rate: 26.771, date: '2026-10-30', source: 'Frankfurter' } })
  const b = exp({ id: 'b', payers: [{ memberId: 'm2', amount: 4000, method: 'card' }], total: { amount: 4000, currency: 'EUR' } })
  const r = settle({ memberIds: ROOM, expenses: [a, b] })
  assert.deepEqual(Object.keys(r.byCurrency).sort(), ['EUR', 'TRY'])
  assert.equal(r.byCurrency.TRY.net.m1, 30000)
  assert.equal(r.byCurrency.EUR.net.m2, 3000)
  assert.equal(r.krw.m3.share, toKrw(10000, 'TRY', a.fx)) // TRY 100.00 → 2,677원
  assert.equal(r.krw.m3.share, 2677)
  assert.deepEqual(r.missingFx, ['b'])
})

test('확인 대기 중인 지출은 pendingIds 에 남는다', () => {
  const e = exp({ payers: [{ memberId: 'm1', amount: 400, method: 'card' }], total: { amount: 400, currency: 'EUR' }, confirmations: [{ memberId: 'm2' }] })
  assert.deepEqual(settle({ memberIds: ROOM, expenses: [e] }).pendingIds, ['e1'])
})

test('최소 송금: 받을 돈과 보낼 돈이 정확히 맞는다', () => {
  assert.deepEqual(minTransfers({ a: 300, b: -100, c: -200 }), [
    { fromId: 'c', toId: 'a', amount: 200 },
    { fromId: 'b', toId: 'a', amount: 100 },
  ])
})

test('검사: 결제자 합·줄 합·명단·세금 줄 배정', () => {
  const e = exp({
    payers: [{ memberId: 'm1', amount: 900, method: 'card' }],
    total: { amount: 1000, currency: 'EUR' },
    lines: [{ name: 'A', unitPrice: 900, total: 900 }, { name: 'VAT', kind: 'tax', unitPrice: 50, total: 50 }],
    splits: [{ lineIndex: 1, memberIds: ['m9'] }],
  })
  const errors = checkExpense(e, ROOM)
  assert.equal(errors.length, 4)
  assert.deepEqual(checkExpense(exp({ payers: [{ memberId: 'm1', amount: 10, method: 'cash' }], total: { amount: 10, currency: 'EUR' } }), ROOM), [])
})

const wallets = () => ROOM.map((id) => ({ memberId: id, balances: [{ amount: 100000, currency: 'TRY', method: 'card' }, { amount: 50000, currency: 'TRY', method: 'cash' }] }))
const bal = (ws, id, method) => ws.find((w) => w.memberId === id).balances.find((b) => b.currency === 'TRY' && b.method === method).amount

test('지갑 자동 차감: 결제자는 낸 만큼 빠지고, 참여자 몫이 결제자에게 옮겨진다', () => {
  const e = exp({ payers: [{ memberId: 'm1', amount: 60000, method: 'cash' }], total: { amount: 60000, currency: 'TRY' }, confirmations: [{ memberId: 'm2', status: 'confirmed' }] })
  const before = wallets()
  const r = applyExpense(before, e, ROOM)
  assert.ok(r.applied)
  assert.equal(bal(r.wallets, 'm1', 'cash'), 50000 - 60000)
  assert.equal(bal(r.wallets, 'm1', 'card'), 100000 + 45000)
  assert.equal(bal(r.wallets, 'm2', 'card'), 85000)
  assert.equal(bal(before, 'm2', 'card'), 100000) // 원본은 그대로
})

test('확인 대기 중이면 지갑을 건드리지 않는다', () => {
  const e = exp({ payers: [{ memberId: 'm1', amount: 400, method: 'card' }], total: { amount: 400, currency: 'TRY' }, confirmations: [{ memberId: 'm2' }] })
  const r = applyExpense(wallets(), e, ROOM)
  assert.equal(r.applied, false)
  assert.deepEqual(r.wallets, wallets())
})

test('잔액이 모자라면 옮기지 않고 부족 알림으로 돌려준다', () => {
  const ws = wallets()
  ws[3].balances[0].amount = 1000 // 서준 카드 잔액 TRY 10.00
  const e = exp({ payers: [{ memberId: 'm1', amount: 60000, method: 'card' }], total: { amount: 60000, currency: 'TRY' } })
  const r = applyExpense(ws, e, ROOM)
  assert.deepEqual(r.shortages, [{ memberId: 'm4', toId: 'm1', currency: 'TRY', need: 15000, have: 1000 }])
  assert.equal(bal(r.wallets, 'm4', 'card'), 1000)
  assert.equal(r.moves.length, 2)
})

test('현금 주고받기는 줬어요·받았어요 둘 다 눌러야 반영', () => {
  const t = { id: 'c1', tripId: 't1', fromId: 'm4', toId: 'm1', money: { amount: 15000, currency: 'TRY' }, given: true, received: false, createdAt: '' }
  assert.equal(applyCashTransfer(wallets(), t).applied, false)
  const r = applyCashTransfer(wallets(), { ...t, received: true })
  assert.equal(bal(r.wallets, 'm4', 'cash'), 35000)
  assert.equal(bal(r.wallets, 'm1', 'cash'), 65000)
})

test('지갑 다시 계산: 확인 끝난 지출만, 모자란 몫은 현금 주고받기로', async () => {
  const { replayWallets } = await import('../src/index.js')
  const ws = wallets()
  ws[3].balances[0].amount = 1000 // 서준 카드 TRY 10.00
  const done = exp({ id: 'd', payers: [{ memberId: 'm1', amount: 60000, method: 'card' }], total: { amount: 60000, currency: 'TRY' } })
  const wait = exp({ id: 'w', payers: [{ memberId: 'm2', amount: 400, method: 'card' }], total: { amount: 400, currency: 'TRY' }, confirmations: [{ memberId: 'm3' }] })

  const r1 = replayWallets({ wallets: ws, expenses: [done, wait], memberIds: ROOM })
  assert.deepEqual(r1.applied, ['d'])
  assert.deepEqual(r1.pending, ['w'])
  assert.equal(r1.cashTransfers.length, 1)
  assert.equal(r1.cashTransfers[0].id, 'd:m4')
  assert.equal(bal(r1.wallets, 'm4', 'cash'), 50000) // 아직 안 줌

  const r2 = replayWallets({ wallets: ws, expenses: [done, wait], memberIds: ROOM, cashStatus: { 'd:m4': { given: true, received: true } } })
  assert.equal(bal(r2.wallets, 'm4', 'cash'), 50000 - 15000)
  assert.equal(bal(r2.wallets, 'm1', 'cash'), 50000 + 15000)
  assert.equal(bal(ws, 'm4', 'cash'), 50000) // 원본은 그대로
})
