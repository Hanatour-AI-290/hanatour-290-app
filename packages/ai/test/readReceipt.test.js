import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Category } from '@h290/shared'
import { ReceiptRead, toReceipt } from '../src/readReceipt.js'

const read = {
  merchant: 'MAĞARA RESTORAN', currency: 'try', total: 3560, paidAt: '2026-11-05T19:42', category: '식사',
  lines: [
    { name: 'TESTİ KEBABI', nameKo: '항아리 케밥', kind: 'item', qty: 4, lineTotal: 2600, source: '4 x TESTİ KEBABI 2.600,00' },
    { name: 'ÇAY', nameKo: '차', kind: 'item', qty: 3, lineTotal: 10, source: '3 x ÇAY 10,00' },
  ],
}

test('AI 가 읽은 소수 금액을 최소 단위 정수로, 통화는 대문자로', () => {
  const r = toReceipt(read)
  assert.equal(r.currency, 'TRY')
  assert.equal(r.total, 356000)
  assert.deepEqual(r.lines[0], { name: 'TESTİ KEBABI', nameKo: '항아리 케밥', kind: 'item', qty: 4, unitPrice: 65000, total: 260000, source: '4 x TESTİ KEBABI 2.600,00' })
})

test('수량으로 나누어떨어지지 않으면 수량 1 로 본다', () => {
  const l = toReceipt(read).lines[1]
  assert.equal(l.qty, 1)
  assert.equal(l.unitPrice * l.qty, l.total)
})

test('지출 분류(FR-018)를 그대로 넘기고, 분류 값은 공용 Category 와 같다', () => {
  assert.equal(toReceipt(read).category, '식사')
  assert.deepEqual(ReceiptRead.shape.category.options, Category.options)
})
