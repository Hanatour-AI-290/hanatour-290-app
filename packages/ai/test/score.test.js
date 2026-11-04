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

test('검사 오류를 사람이 읽는 금액으로 바꾼다 (재시도 힌트 · 질문)', async () => {
  const { explain } = await import('../src/pipeline.js')
  const receipt = { currency: 'TRY', total: 356000, lines: [{ total: 260000 }, { total: 80000 }] }
  const { hints, questions } = explain(receipt, ['줄 합계 340000 ≠ 영수증 합계 356000'])
  assert.match(hints[0], /3,400 TRY.*3,560 TRY/)
  assert.match(questions[0].text, /3,400 TRY.*3,560 TRY/)
  assert.equal(explain(receipt, []).questions.length, 0)
})

// 문장 20개 측정 (PER-001): 말·카드 문자 → 지출 하나
test('문장 채점: 금액·통화, 결제자, 나눌 사람, 분류를 각각 본다', async () => {
  const { scoreSentence } = await import('../eval/score.js')
  const expected = { amount: 300, currency: 'TRY', people: ['지우'], category: '쇼핑' }
  const got = { amount: 300, currency: 'TRY', payer: null, payers: [], people: [], category: '쇼핑' }
  // 결제자·사람을 비우면 화면이 말한 사람(me)으로 채우므로 맞은 것으로 본다
  assert.deepEqual(scoreSentence(expected, got, '지우'), { amountOk: true, payerOk: true, peopleOk: true, categoryOk: true, correct: true, flagged: false })
  const wrong = scoreSentence(expected, { ...got, amount: 30, category: '기타' }, '지우')
  assert.equal(wrong.amountOk, false)
  assert.equal(wrong.categoryOk, false)
  assert.equal(wrong.correct, false)
})

test('문장 채점: 결제자 여러 명은 이름과 금액이 모두 같아야, 금액을 비우면 잡아낸 것으로', async () => {
  const { scoreSentence } = await import('../eval/score.js')
  const expected = { amount: 3560, currency: 'TRY', payers: [{ name: '지우', amount: 2000 }, { name: '하린', amount: 1560 }], people: ['지우', '하린', '도윤', '서준'], category: '식사' }
  const got = { amount: 3560, currency: 'TRY', payer: '하린', payers: [{ name: '하린', amount: 1560 }, { name: '지우', amount: 2000 }], people: ['서준', '도윤', '하린', '지우'], category: '식사' }
  assert.equal(scoreSentence(expected, got, '지우').correct, true)
  assert.equal(scoreSentence(expected, { ...got, payers: [{ name: '지우', amount: 3560 }] }, '지우').payerOk, false)
  // 금액을 모른다고 비운 경우: 틀렸지만 직접 입력으로 넘어가므로 잡아낸 것
  const blank = scoreSentence(expected, { ...got, amount: null }, '지우')
  assert.equal(blank.correct, false)
  assert.equal(blank.flagged, true)
})

test('문장 채점: 금액이 없는 문장은 비워 두는 게 정답 (추측 금지)', async () => {
  const { scoreSentence, summarizeSentences } = await import('../eval/score.js')
  const expected = { amount: null, currency: 'OTHER', people: ['지우'], category: '교통' }
  assert.equal(scoreSentence(expected, { amount: null, currency: 'OTHER', payer: null, payers: [], people: [], category: '교통' }, '지우').amountOk, true)
  assert.equal(scoreSentence(expected, { amount: 200, currency: 'TRY', payer: null, payers: [], people: [], category: '교통' }, '지우').amountOk, false)
  const s = summarizeSentences([
    { amountOk: true, payerOk: true, peopleOk: true, categoryOk: true, correct: true, flagged: false, ms: 1000 },
    { amountOk: false, payerOk: true, peopleOk: false, categoryOk: true, correct: false, flagged: true, ms: 3000 },
  ])
  assert.deepEqual(s, { cases: 2, amountMatch: 50, payerAccuracy: 100, peopleAccuracy: 50, categoryMatch: 100, caught: 100, avgSeconds: 2 })
})

test('문장 세트(sentences.json): 20개, 정답이 스키마·명단과 맞고 정답을 넣으면 만점', async () => {
  const { readFile } = await import('node:fs/promises')
  const { Category } = await import('@h290/shared')
  const { scoreSentence, summarizeSentences } = await import('../eval/score.js')
  const set = JSON.parse(await readFile(new URL('../eval/sentences.json', import.meta.url), 'utf8'))
  assert.equal(set.cases.length, 20)
  assert.equal(new Set(set.cases.map((c) => c.id)).size, 20)
  for (const c of set.cases) {
    const e = c.expected
    assert.ok(['voice', 'sms'].includes(c.kind), c.id)
    assert.ok(set.members.includes(c.me), c.id)
    assert.ok(Category.options.includes(e.category), c.id)
    assert.ok(e.people.every((n) => set.members.includes(n)), c.id)
    if (e.payers?.length > 1) assert.equal(e.payers.reduce((a, p) => a + p.amount, 0), e.amount, c.id)
  }
  // 정답을 그대로 AI 결과로 넣으면 전부 맞아야 채점이 정답 형식과 맞는 것
  const rows = set.cases.map((c) => {
    const e = c.expected
    const got = { amount: e.amount, currency: e.currency, payer: e.payers?.[0].name ?? null, payers: e.payers ?? [], people: e.people, category: e.category }
    return { ms: 0, ...scoreSentence(e, got, c.me) }
  })
  assert.equal(summarizeSentences(rows).amountMatch, 100)
  assert.ok(rows.every((r) => r.correct))
})
