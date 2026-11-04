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

// 줄별 배정 검사. splits 에 없는 줄은 기본 1/N 이라 오류가 아니다 (R-24)
const withTax = [
  { name: 'Kebap', qty: 2, unitPrice: 500, total: 1000 },
  { name: 'Çay', qty: 1, unitPrice: 1200, total: 1200 },
  { name: 'KDV', kind: 'tax', qty: 1, unitPrice: 200, total: 200 },
]
const ok = (splits) => validate({ lines: withTax, total: 2400, memberIds: ['a', 'b'], splits })

test('배정이 없는 줄은 1/N 이라 통과', () => {
  assert.deepEqual(ok([{ lineIndex: 1, memberIds: ['a'] }]), { ok: true, errors: [] })
})

test('없는 줄 번호에 배정하면 실패', () => {
  const r = ok([{ lineIndex: 5, memberIds: ['a'] }])
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /5번 줄이 없/)
})

test('세금 줄에 배정하면 실패', () => {
  const r = ok([{ lineIndex: 2, memberIds: ['a'] }])
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /KDV.*세금/)
})

test('같은 줄을 두 번 배정하면 실패 (정산은 첫 배정만 쓰므로)', () => {
  const r = ok([{ lineIndex: 0, memberIds: ['a'] }, { lineIndex: 0, memberIds: ['b'] }])
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /Kebap.*두 번/)
})

test('배정된 사람이 없으면 실패', () => {
  const r = ok([{ lineIndex: 1, memberIds: [] }])
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /Çay.*낼 사람이 없/)
})

test('결제자가 낸 금액 합이 총액과 다르면 실패 (FR-009)', () => {
  const r = validate({ lines, total: 2200, payers: [{ memberId: 'a', amount: 1000 }, { memberId: 'b', amount: 1000 }] })
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /결제자.*2000.*2200/)
})

test('결제자 금액 합이 맞으면 통과, 금액을 모르는 결제자가 있으면 실패', () => {
  assert.equal(validate({ lines, total: 2200, payers: [{ memberId: 'a', amount: 1200 }, { memberId: 'b', amount: 1000 }] }).ok, true)
  const r = validate({ lines, total: 2200, payers: [{ memberId: 'a', amount: null }, { memberId: 'b', amount: null }] })
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /얼마/)
})
