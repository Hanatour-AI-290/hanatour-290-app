import { test } from 'node:test'
import assert from 'node:assert/strict'
import { amountMatches, cleanText, matchPlanItems, stripGeneric, lexicalHits, rerankOptions, MATCH_DEFAULTS, RELATIVE } from '../src/index.js'

const items = [
  { idx: 1, amount: 320, currency: 'EUR' }, // 열기구
  { idx: 3, amount: 60, currency: 'EUR' }, // 유람선
  { idx: 4, amount: 60, currency: 'EUR' }, // 카트
  { idx: 5, amount: null, currency: null }, // 지프 (금액 모름)
]

test('cleanText: 카드사 · 승인 · 금액 · 통화를 빼고 가게 이름만 남긴다', () => {
  assert.equal(cleanText('[Web발신] 하나카드(1*2*) 해외승인 EUR 1,280.00 KAPADOKYA BALON TUR'), 'KAPADOKYA BALON TUR')
  assert.equal(cleanText('열기구 1280유로 내가 냈어'), '열기구 내가 냈어')
  assert.equal(cleanText('가이드 경비 10만원 줬어'), '가이드 경비 줬어')
})

test('amountMatches: 1인 금액이나 인원수만큼의 금액이면 맞음 (1% 이내), 통화가 다르면 아님', () => {
  assert.equal(amountMatches({ amount: 320, currency: 'EUR' }, items[0]), true)
  assert.equal(amountMatches({ amount: 1280, currency: 'EUR', people: 4 }, items[0]), true)
  assert.equal(amountMatches({ amount: 1282, currency: 'EUR', people: 4 }, items[0]), true)
  assert.equal(amountMatches({ amount: 1280, currency: 'EUR', people: 3 }, items[0]), false)
  assert.equal(amountMatches({ amount: 320, currency: 'TRY' }, items[0]), false)
  assert.equal(amountMatches({ amount: 320, currency: 'EUR' }, items[3]), false)
})

test('matchPlanItems: 이름이 확실히 가까우면 후보 하나, 금액이 맞으면 가산점', () => {
  const [c] = matchPlanItems({ record: { amount: 1280, currency: 'EUR', people: 4 }, items, sims: [0.95, 0.86, 0.86, 0.85] })
  assert.equal(c.idx, 1)
  assert.equal(c.amountMatch, true)
  assert.equal(c.score, 0.95 + MATCH_DEFAULTS.amountBonus)
})

test('matchPlanItems: 1등과 2등이 비슷하면 묻지 않는다 (같은 60유로인 유람선 · 카트)', () => {
  const out = matchPlanItems({ record: { amount: 60, currency: 'EUR' }, items, sims: [0.84, 0.851, 0.846, 0.84] })
  assert.deepEqual(out, [])
})

test('matchPlanItems: 문턱값보다 낮으면 후보 없음', () => {
  assert.deepEqual(matchPlanItems({ record: {}, items, sims: [0.6, 0.5, 0.5, 0.5] }), [])
})

test('matchPlanItems: 통화를 둘 다 아는데 다르면 뺀다, 금액 모르는 항목은 남긴다', () => {
  const [c] = matchPlanItems({ record: { amount: 1200, currency: 'TRY' }, items, sims: [0.99, 0.8, 0.8, 0.9] })
  assert.equal(c.idx, 5)
  assert.equal(c.amountMatch, false)
})

test('matchPlanItems: 예정 항목이 없으면 빈 배열', () => {
  assert.deepEqual(matchPlanItems({ record: {}, items: [], sims: [] }), [])
})

test('stripGeneric: 어느 항목에나 붙는 말을 빼고, 다 빠지면 원래 문장', () => {
  assert.equal(stripGeneric('카트 투어'), '카트')
  assert.equal(stripGeneric('Antalya boat trip'), 'Antalya boat')
  assert.equal(stripGeneric('투어'), '투어')
})

test('matchPlanItems: 금액이 같아도 이름이 충분히 비슷하지 않으면 후보가 아니다 (minSim)', () => {
  // 편의점 1,800엔 ↔ 운하 크루즈 1,800엔 처럼 금액만 같은 경우
  const out = matchPlanItems({ record: { amount: 60, currency: 'EUR' }, items, sims: [0.7, 0.85, 0.8, 0.8] })
  assert.deepEqual(out, [])
})

// 상대 점수 (예정 항목 5개 이상 + 글자 겹침)
const five = [
  { idx: 0, name: '카파도키아 열기구 투어', aliases: ['hot air balloon'], amount: 250, currency: 'EUR' },
  { idx: 1, name: '지프 사파리', amount: 60, currency: 'EUR' },
  { idx: 2, name: '벨리댄스 쇼', amount: 70, currency: 'EUR' },
  { idx: 3, name: '보스포루스 유람선', amount: 60, currency: 'EUR' },
  { idx: 4, name: '파묵칼레 온천', amount: 80, currency: 'EUR' },
]

test('lexicalHits: 흔한 말을 뺀 이름이 항목 이름 · 별칭 안에 그대로 있으면 1', () => {
  assert.deepEqual(lexicalHits('열기구 투어', five), [1, 0, 0, 0, 0])
  assert.deepEqual(lexicalHits('Hot Air Balloon', five), [1, 0, 0, 0, 0])
  assert.deepEqual(lexicalHits('투어', five), [0, 0, 0, 0, 0]) // 흔한 말만이면 아무것도 아니다 (글자 2자 미만)
})

test('matchPlanItems 상대 점수: 유사도가 0.86 아래여도 다른 항목보다 확실히 높으면 후보 (운영에서 놓치던 열기구)', () => {
  const sims = [0.857, 0.766, 0.776, 0.77, 0.77]
  assert.deepEqual(matchPlanItems({ record: {}, items: five, sims }), []) // 절대 점수로는 놓친다
  const [c] = matchPlanItems({ record: {}, items: five, sims, lex: lexicalHits('열기구 투어', five) })
  assert.equal(c.idx, 0)
})

test('matchPlanItems 상대 점수: 모두 비슷하면 후보 없음, 항목이 적으면 절대 점수', () => {
  assert.deepEqual(matchPlanItems({ record: {}, items: five, sims: [0.8, 0.8, 0.79, 0.8, 0.8], lex: [0, 0, 0, 0, 0] }), [])
  const few = five.slice(0, RELATIVE.minItems - 1)
  const [c] = matchPlanItems({ record: {}, items: few, sims: [0.95, 0.8, 0.8, 0.8], lex: [1, 0, 0, 0] })
  assert.equal(c.score, 0.95) // 절대 점수 그대로 (평균을 빼지 않음)
})

test('rerankOptions: 규칙이 정했거나 비슷한 게 없으면 부르지 않고, 애매하면 평균 이상인 것 최대 3개', () => {
  const lex = [0, 0, 0, 0, 0]
  assert.deepEqual(rerankOptions({ record: {}, items: five, sims: [0.95, 0.77, 0.77, 0.77, 0.77], lex }), []) // 규칙이 정함
  assert.deepEqual(rerankOptions({ record: {}, items: five, sims: [0.83, 0.83, 0.75, 0.76, 0.75], lex }), [0, 1]) // 1·2등 동점
  assert.deepEqual(rerankOptions({ record: {}, items: five.slice(0, 3), sims: [0.83, 0.83, 0.75] }), [0, 1]) // 항목이 적어도 애매하면 부른다
  assert.deepEqual(rerankOptions({ record: {}, items: five.slice(0, 1), sims: [0.76] }), []) // 유사도가 낮으면 부르지 않는다
})
