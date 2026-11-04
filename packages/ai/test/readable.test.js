import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isReadable } from '../src/pipeline.js'

const line = (total, kind = 'item') => ({ name: 'x', kind, qty: 1, unitPrice: total, total })

test('isReadable: 메뉴 줄이 있고 합계가 0보다 크면 영수증', () => {
  assert.equal(isReadable({ total: 356000, lines: [line(356000)] }), true)
})

test('isReadable: 줄이 없거나 합계 0 이면 영수증이 아니다 (영수증 아닌 사진에서 AI 가 TRY 0 을 돌려준 경우)', () => {
  assert.equal(isReadable({ total: 0, lines: [] }), false)
  assert.equal(isReadable({ total: 0, lines: [line(0)] }), false)
  assert.equal(isReadable({ total: 1000, lines: [line(1000, 'tax')] }), false) // 세금 줄만
})
