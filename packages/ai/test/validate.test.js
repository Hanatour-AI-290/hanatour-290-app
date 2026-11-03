import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../src/validate.js'

const lines = [
  { qty: 2, unitPrice: 500, total: 1000 },
  { qty: 1, unitPrice: 1200, total: 1200 },
]

test('합계가 맞으면 통과', () => {
  assert.deepEqual(validate({ lines, total: 2200 }), { ok: true, errors: [] })
})

test('합계가 다르면 실패', () => {
  const r = validate({ lines, total: 2300 })
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /합계/)
})

test('모르는 멤버가 배정되면 실패', () => {
  const r = validate({ lines, total: 2200, memberIds: ['a'], splits: [{ lineIndex: 0, memberIds: ['b'] }] })
  assert.equal(r.ok, false)
})
