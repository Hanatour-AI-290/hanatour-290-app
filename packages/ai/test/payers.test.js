import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePayers } from '../src/payers.js'

const names = ['지우', '하린', '도윤', '서준']

test('결제자를 말하지 않으면 빈 목록 (화면이 올린 사람으로 채운다)', () => {
  assert.deepEqual(resolvePayers({ payers: [], names, total: 3560 }), { payers: [], questions: [] })
})

test('결제자가 한 명이면 총액을 낸 것으로', () => {
  assert.deepEqual(resolvePayers({ payers: [{ name: '하린', amount: null }], names, total: 3560 }).payers, [{ name: '하린', amount: 3560 }])
})

test('여러 명이 금액을 말하면 그대로', () => {
  const r = resolvePayers({ payers: [{ name: '지우', amount: 2000 }, { name: '하린', amount: 1560 }], names, total: 3560 })
  assert.deepEqual(r, { payers: [{ name: '지우', amount: 2000 }, { name: '하린', amount: 1560 }], questions: [] })
})

test('한 명만 금액이 없으면 나머지 금액을 그 사람이 낸 것으로 (뺄셈)', () => {
  const r = resolvePayers({ payers: [{ name: '지우', amount: 2000 }, { name: '하린', amount: null }], names, total: 3560 })
  assert.deepEqual(r.payers, [{ name: '지우', amount: 2000 }, { name: '하린', amount: 1560 }])
})

test('금액을 모르는 사람이 둘 이상이면 추측하지 않고 질문', () => {
  const r = resolvePayers({ payers: [{ name: '지우', amount: null }, { name: '하린', amount: null }], names, total: 3560 })
  assert.deepEqual(r.payers, [{ name: '지우', amount: null }, { name: '하린', amount: null }])
  assert.match(r.questions[0], /지우.*하린.*얼마/)
})

test('명단에 없는 이름은 빼고 질문, 같은 사람이 두 번이면 합친다', () => {
  const r = resolvePayers({ payers: [{ name: '민수', amount: 1000 }, { name: '지우', amount: 1000 }, { name: '지우', amount: 2560 }], names, total: 3560 })
  assert.deepEqual(r.payers, [{ name: '지우', amount: 3560 }])
  assert.match(r.questions[0], /민수/)
})
