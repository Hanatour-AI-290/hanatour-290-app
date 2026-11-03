import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pairLines, scoreCase, summarize } from '../eval/score.js'

const ids = ['m1', 'm2', 'm3', 'm4']
const expected = {
  total: 356000,
  lines: [{ total: 260000 }, { total: 56000 }, { total: 24000 }, { total: 16000 }],
  splits: [{ lineIndex: 3, memberIds: ['m2', 'm3'] }],
}
const ok = { check: { ok: true }, questions: [] }

test('줄은 금액으로 짝짓고, 같은 금액은 하나씩만 쓴다', () => {
  assert.deepEqual(pairLines([{ total: 5 }, { total: 5 }, { total: 9 }], [{ total: 9 }, { total: 5 }]), [1, null, 0])
})

test('다 맞으면 correct, 줄 순서가 달라도 배정은 짝지은 줄로 비교', () => {
  const got = {
    ...ok,
    receipt: { total: 356000, lines: [{ total: 16000 }, { total: 260000 }, { total: 56000 }, { total: 24000 }] },
    splits: [{ lineIndex: 0, memberIds: ['m3', 'm2'] }],
  }
  const r = scoreCase(expected, got, ids)
  assert.deepEqual({ ...r }, { lineHits: 4, lineTotal: 4, totalOk: true, splitHits: 4, splitTotal: 4, correct: true, flagged: false })
})

test('배정이 틀리고 질문도 없으면 잡아내지 못한 것', () => {
  const got = { ...ok, receipt: { total: 356000, lines: expected.lines }, splits: [] }
  const r = scoreCase(expected, got, ids)
  assert.equal(r.splitHits, 3)
  assert.equal(r.correct, false)
  assert.equal(r.flagged, false)
  const s = summarize([{ ...r, ms: 4000 }])
  assert.equal(s.splitAccuracy, 75)
  assert.equal(s.caught, 0)
  assert.equal(s.avgSeconds, 4)
})
