import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CashTransfer, Category, Expense, Money, ReceiptLine, WalletBalance } from '../src/index.js'

test('Money 는 정수 금액만 받는다', () => {
  assert.ok(Money.safeParse({ amount: 1230, currency: 'eur' }).success)
  assert.ok(!Money.safeParse({ amount: 12.3, currency: 'EUR' }).success)
})

test('Expense 기본값이 채워진다', () => {
  const e = Expense.parse({
    id: 'e1', tripId: 't1', payers: [{ memberId: 'm1', amount: 1000, method: 'card' }],
    total: { amount: 1000, currency: 'EUR' }, createdAt: '2026-11-04T00:00:00Z',
  })
  assert.deepEqual(e.lines, [])
  assert.deepEqual(e.splits, [])
  assert.deepEqual(e.confirmations, [])
})

test('Expense 는 결제자가 한 명 이상 있어야 한다', () => {
  const r = Expense.safeParse({
    id: 'e1', tripId: 't1', payers: [],
    total: { amount: 1000, currency: 'EUR' }, createdAt: '2026-11-04T00:00:00Z',
  })
  assert.ok(!r.success)
})

test('영수증 줄은 기본이 item 이고 tax 줄을 받는다', () => {
  assert.equal(ReceiptLine.parse({ name: 'Beer', unitPrice: 500, total: 500 }).kind, 'item')
  assert.equal(ReceiptLine.parse({ name: 'VAT', kind: 'tax', unitPrice: 80, total: 80 }).kind, 'tax')
})

test('잔액과 분류는 정해진 값만 받는다', () => {
  assert.ok(WalletBalance.safeParse({ amount: 120000, currency: 'TRY', method: 'cash' }).success)
  assert.ok(!WalletBalance.safeParse({ amount: 120000, currency: 'TRY', method: 'coupon' }).success)
  assert.ok(Category.safeParse('식사').success)
  assert.ok(!Category.safeParse('meal').success)
})

test('현금 정산은 처음에 준 것도 받은 것도 아니다', () => {
  const t = CashTransfer.parse({
    id: 'c1', tripId: 't1', fromId: 'm2', toId: 'm1',
    money: { amount: 60000, currency: 'TRY' }, createdAt: '2026-11-04T00:00:00Z',
  })
  assert.equal(t.given, false)
  assert.equal(t.received, false)
})
