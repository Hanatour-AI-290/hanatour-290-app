import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Expense, Money } from '../src/index.js'

test('Money 는 정수 금액만 받는다', () => {
  assert.ok(Money.safeParse({ amount: 1230, currency: 'eur' }).success)
  assert.ok(!Money.safeParse({ amount: 12.3, currency: 'EUR' }).success)
})

test('Expense 기본값이 채워진다', () => {
  const e = Expense.parse({
    id: 'e1', tripId: 't1', payerIds: ['m1'],
    total: { amount: 1000, currency: 'EUR' }, createdAt: '2026-11-04T00:00:00Z',
  })
  assert.deepEqual(e.lines, [])
  assert.deepEqual(e.splits, [])
})
