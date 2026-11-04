// 기록 ↔ 예정 항목 연결 정확도 (ML 임베딩 모델). --rerank 를 주지 않으면 Claude API 를 부르지 않는다.
//   npm run eval:match                         기본: 입력은 Claude 가 만든 이름(names.json · holdout-names.json, 앱과 같은 흐름)
//   npm run eval:match -- --input raw          카드 문자 · 말 원문 그대로 (Claude 없이)
//   npm run eval:match -- --model Xenova/LaBSE 다른 모델 비교
//   npm run eval:match -- --dump               개발 세트 케이스별 유사도 상위 3개 ($ = 금액 일치)
//   npm run eval:match -- --cv                 상품 하나씩 빼고 값을 정하는 교차검증 (처음 보는 상품에서의 추정)
//   npm run eval:match -- --rerank             앱처럼 규칙이 못 정한 애매한 기록만 Claude 가 고르게 한다 (API 비용 발생, .env 의 키 필요)
//
// 세트:
//   cases.json   개발 세트 22개 (튀르키예). 방식마다 문턱값 · 금액 가산점 · 2등과 차이를 여기서만 격자 탐색해 정한다
//   holdout.json 확인 세트 20개 (튀르키예). 위에서 정한 값으로 재기만 한다
//   test/*.json  시험 세트 (다른 상품 4개). 재기만 한다. 상품 문구 · 항목 · 기록 이름은 prepare.js 가 앱과 같은 코드로 만든 것
// 방식: ① 글자 포함 규칙(기준선) ② 임베딩만 ③ 임베딩 + 금액 ④ ③ + 흔한 말 빼기 + 별칭(aliases.json)
//       ⑤ ④ + 상대 점수(항목 평균과의 차이) + 글자 겹침 = 지금 앱 (+ --rerank 면 애매한 것만 Claude)
// 별칭은 앱과 같이 실제 estimate() 가 시연 상품 문구에서 만든 것 (aliases.js 로 다시 만들 수 있음)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { cleanText, matchPlanItems, amountMatches, lexicalHits, rerankOptions, MATCH_DEFAULTS, RELATIVE } from '@h290/shared'
import { planSimilarities } from '../../src/planMatch.js'
import { EMBED_MODEL } from '../../src/embed.js'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, d) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : d)
const model = opt('model', EMBED_MODEL)
const input = opt('input', 'claude')

const here = new URL('.', import.meta.url)
const load = (f) => JSON.parse(readFileSync(new URL(f, here), 'utf8'))
const aliases = load('aliases.json').byName
// 앱처럼 모르는 통화(CHF 등, Claude 출력의 OTHER)는 null 로 둔다
const KNOWN = ['KRW', 'USD', 'EUR', 'JPY', 'TRY']
const cur = (c) => (KNOWN.includes(c) ? c : null)
/** 세트 이름 → { items, cases, names }. 상품마다 예정 항목이 다르므로 세트(상품) 단위로 잰다 */
const sets = {
  dev: { ...load('cases.json'), names: load('names.json').names },
  holdout: { ...load('holdout.json'), names: load('holdout-names.json').names },
}
for (const s of Object.values(sets)) s.items = s.items.map((it) => ({ ...it, aliases: aliases[it.name] ?? [] }))
for (const f of readdirSync(new URL('test/', here)).filter((x) => x.endsWith('.json')).sort()) sets[`test/${f.slice(0, -5)}`] = load(`test/${f}`)
for (const s of Object.values(sets)) s.items = s.items.map((it) => ({ ...it, currency: cur(it.currency) }))
/** 보고할 묶음: 개발 · 확인 · 시험(새 상품 전부) */
const GROUPS = { dev: ['dev'], holdout: ['holdout'], test: Object.keys(sets).filter((k) => k.startsWith('test/')) }
const nameOf = (set, c) => { const n = set.names?.[c.id]; return typeof n === 'string' ? n : n?.name ?? '' }
const textOf = (set, c) => (input === 'claude' ? nameOf(set, c) : cleanText(c.text))
const recordOf = (c) => ({ amount: c.amount, currency: cur(c.currency), people: c.people })

/** ① 기준선: 예정 항목 이름의 낱말이 기록에 그대로 들어 있고 그런 항목이 하나뿐이면 연결 */
function baseline(set, c) {
  const t = textOf(set, c).toLowerCase()
  const hit = set.items.filter((it) => it.name.split(/[\s(),/·]+/).some((w) => w.length >= 2 && t.includes(w.toLowerCase())))
  return hit.length === 1 ? hit[0].idx : null
}

const METHODS = {
  embedOnly: { label: '② 임베딩만', sim: { aliases: false, strip: false }, amount: false },
  embedAmount: { label: '③ 임베딩 + 금액', sim: { aliases: false, strip: false }, amount: true },
  alias: { label: '④ + 흔한 말 빼기 + 별칭', sim: { aliases: true, strip: true }, amount: true },
  app: { label: '⑤ + 상대 점수 + 글자 겹침 (앱)', sim: { aliases: true, strip: true }, amount: true, lex: true },
}
const APP_SIM = 'alias' // ⑤ 는 ④ 와 같은 유사도를 쓴다 (다시 계산하지 않음)

const t0 = Date.now()
await planSimilarities('warmup', [{ name: 'warmup' }], { model }) // 모델 로드 시간은 따로 잰다
const loadMs = Date.now() - t0

// 세트 × 방식별 유사도
const sims = {}
let ms = 0
let calls = 0
for (const [sk, set] of Object.entries(sets)) {
  sims[sk] = {}
  for (const [mk, m] of Object.entries(METHODS)) {
    if (mk === 'app') { sims[sk][mk] = sims[sk][APP_SIM]; continue }
    sims[sk][mk] = []
    for (const c of set.cases) {
      const s = Date.now()
      sims[sk][mk].push(await planSimilarities(textOf(set, c), set.items, { ...m.sim, model }))
      if (mk === APP_SIM) { ms += Date.now() - s; calls++ }
    }
  }
}

/** 앱(⑤)이 쓰는 matchPlanItems 입력 */
const inputOf = (set, S, i, c) => ({ record: recordOf(c), items: set.items, sims: S[i], lex: lexicalHits(textOf(set, c), set.items) })
const pick = (set, S, m, p) => set.cases.map((c, i) => (m.lex
  ? matchPlanItems({ ...inputOf(set, S, i, c), ...p })
  : matchPlanItems({ record: m.amount ? recordOf(c) : {}, items: set.items, sims: S[i], ...p, amountBonus: m.amount ? p.amountBonus : 0 }))[0]?.idx ?? null)

function score(set, got) {
  const n = set.cases.length
  const right = set.cases.filter((c, i) => got[i] === c.answer).length
  const wrong = set.cases.filter((c, i) => got[i] != null && got[i] !== c.answer).length
  const missed = set.cases.filter((c, i) => got[i] == null && c.answer != null).length
  return { accuracy: Math.round((right / n) * 100), wrongLink: Math.round((wrong / n) * 100), right, wrong, missed, n,
    errors: set.cases.flatMap((c, i) => (got[i] === c.answer ? [] : [`${c.id}:${c.answer}→${got[i]}`])) }
}

// 격자 탐색 (개발 세트만). 목표 = 정답 - 2 × 오연결 (잘못 잇는 게 놓치는 것보다 나쁨). 같으면 문턱값이 높은 쪽(보수적)
const grid = []
for (let t = 0.7; t <= 1.0; t += 0.01) for (const b of [0, 0.02, 0.04, 0.06]) for (const mg of [0.01, 0.02, 0.03, 0.05]) // margin 0 은 빼둔다: 1등·2등이 같으면 묻지 않는다 (R-25 추측 금지)
    grid.push({ threshold: +t.toFixed(2), amountBonus: b, margin: mg, minSim: 0 }) // ②③ 비교 방식은 이름 유사도 바닥 없이
function tune(mk) {
  const m = METHODS[mk]
  let best = null
  for (const p of grid) {
    const s = score(sets.dev, pick(sets.dev, sims.dev[mk], m, p))
    const v = s.right - 2 * s.wrong
    if (!best || v > best.v || (v === best.v && p.threshold > best.p.threshold)) best = { p, v }
  }
  return best.p
}

/** 여러 세트 점수를 합친다 */
function merge(list) {
  const t = list.reduce((a, s) => ({ right: a.right + s.right, wrong: a.wrong + s.wrong, missed: a.missed + s.missed, n: a.n + s.n, errors: [...a.errors, ...s.errors] }), { right: 0, wrong: 0, missed: 0, n: 0, errors: [] })
  return { ...t, accuracy: Math.round((t.right / t.n) * 100), wrongLink: Math.round((t.wrong / t.n) * 100) }
}
const groupScores = (perSet) => Object.fromEntries(Object.entries(GROUPS).map(([g, ks]) => [g, merge(ks.map((k) => perSet[k]))]))

const result = { model, input, date: new Date().toISOString().slice(0, 10), appParams: { relative: RELATIVE, absolute: MATCH_DEFAULTS },
  loadSeconds: +(loadMs / 1000).toFixed(1), avgMs: Math.round(ms / calls), methods: {} }
const basePer = Object.fromEntries(Object.entries(sets).map(([k, set]) => [k, score(set, set.cases.map((c) => baseline(set, c)))]))
result.methods.baseline = { label: '① 글자 포함 규칙', ...groupScores(basePer) }
for (const [mk, m] of Object.entries(METHODS)) {
  const p = mk === 'app' ? {} : mk === 'alias' ? MATCH_DEFAULTS : tune(mk) // ⑤ 는 앱 기본값(RELATIVE), ④ 는 이전 앱 값
  const per = Object.fromEntries(Object.entries(sets).map(([k, set]) => [k, score(set, pick(set, sims[k][mk], m, p))]))
  result.methods[mk] = { label: m.label, params: p, ...groupScores(per), perSet: per }
}
const aliasTuned = tune('alias')

if (flag('dump')) {
  for (const [i, c] of sets.dev.cases.entries()) {
    const S = sims.dev.app[i]
    const order = S.map((v, j) => [v, j]).sort((a, b) => b[0] - a[0])
    console.log(c.id, String(c.answer).padStart(4), '|', textOf(sets.dev, c).padEnd(30), '|',
      order.slice(0, 3).map(([v, j]) => `${sets.dev.items[j].idx}${amountMatches(recordOf(c), sets.dev.items[j]) ? '$' : ' '}${v.toFixed(3)}`).join(' '))
  }
}

const cell = (s) => `${String(s.accuracy).padStart(3)}% (${s.right}/${s.n}) 오${s.wrong}`
console.log(`\n방식                            개발 (값 정한 곳)      확인 (튀르키예)       시험 (새 상품 ${GROUPS.test.length}개)`)
for (const r of Object.values(result.methods)) console.log(`${r.label.padEnd(26)}  ${cell(r.dev).padEnd(20)}  ${cell(r.holdout).padEnd(20)}  ${cell(r.test)}`)
console.log('\n앱 방식 상품별 (시험 세트)')
for (const k of GROUPS.test) console.log(`  ${k.slice(5).padEnd(12)} ${cell(result.methods.app.perSet[k])}  틀림: ${result.methods.app.perSet[k].errors.join(' ') || '없음'}`)
console.log(`\n앱 값 상대 점수 ${JSON.stringify(RELATIVE)} · 항목이 적을 때 절대 점수 ${JSON.stringify(MATCH_DEFAULTS)}${JSON.stringify(aliasTuned) === JSON.stringify(MATCH_DEFAULTS) ? '' : ` (④ 개발 세트 최적값 ${JSON.stringify(aliasTuned)})`}`)
console.log(`모델 ${model} · 입력 ${input} · 로드 ${result.loadSeconds}s · 기록 1건 평균 ${result.avgMs}ms`)
console.log(`앱 방식 틀린 것  개발: ${result.methods.app.dev.errors.join(' ') || '없음'}  확인: ${result.methods.app.holdout.errors.join(' ') || '없음'}`)
for (const r of Object.values(result.methods)) delete r.perSet

// --cv: 상품(세트) 하나씩 빼고 나머지로 앱 방식 값(상대 점수 문턱값 · 글자 겹침 가산점 · 금액 가산점 · 2등과 차이)을 정해, 뺀 상품에서 잰다.
// 처음 보는 상품에서의 성능 추정. 마지막 줄은 모든 세트로 정한 값 (앱에 넣을 후보)
if (flag('cv')) {
  const m = METHODS.app
  const cvGrid = []
  for (let t = 0; t <= 0.121; t += 0.01) for (const lb of [0, 0.02, 0.04, 0.06]) for (const b of [0, 0.02, 0.04]) for (const mg of [0.01, 0.02, 0.03])
    cvGrid.push({ threshold: +t.toFixed(2), lexBonus: lb, amountBonus: b, margin: mg })
  const keys = Object.keys(sets)
  const fit = (train) => {
    let best = null
    for (const p of cvGrid) {
      let v = 0
      for (const k of train) { const s = score(sets[k], pick(sets[k], sims[k].app, m, p)); v += s.right - 2 * s.wrong }
      if (!best || v > best.v || (v === best.v && p.threshold > best.p.threshold)) best = { p, v }
    }
    return best.p
  }
  const folds = keys.map((k) => {
    const p = fit(keys.filter((x) => x !== k))
    return { k, p, s: score(sets[k], pick(sets[k], sims[k].app, m, p)) }
  })
  console.log('\n교차검증 (상품 하나씩 빼고 정한 값 → 뺀 상품에서)')
  for (const f of folds) console.log(`  ${f.k.padEnd(18)} ${cell(f.s).padEnd(20)} ${JSON.stringify(f.p)}  틀림: ${f.s.errors.join(' ') || '없음'}`)
  const total = merge(folds.map((f) => f.s))
  console.log(`  합계               ${cell(total)}`)
  const all = fit(keys)
  const allScore = merge(keys.map((k) => score(sets[k], pick(sets[k], sims[k].app, m, all))))
  console.log(`모든 세트로 정한 값 ${JSON.stringify(all)} → 전체 ${cell(allScore)} (같은 데이터로 잰 값이라 위 교차검증 합계가 더 정직한 추정)`)
  result.cv = { folds: folds.map((f) => ({ set: f.k, params: f.p, ...f.s })), total, allParams: all, allScore }
}

// --rerank: 앱처럼 규칙(⑤)이 못 정한 기록 중 비슷한 항목이 있는 것만 Claude 가 고른다 (POST /api/match/plan 과 같은 흐름)
if (flag('rerank')) {
  const { rerankPlanItems } = await import('../../src/rerank.js')
  const per = {}
  let called = 0
  let rms = 0
  for (const [k, set] of Object.entries(sets)) {
    const got = pick(set, sims[k].app, METHODS.app, {})
    for (const [i, c] of set.cases.entries()) {
      if (got[i] != null) continue
      const opts = rerankOptions(inputOf(set, sims[k].app, i, c))
      if (!opts.length) continue
      const s = Date.now()
      got[i] = await rerankPlanItems({ record: { text: textOf(set, c), ...recordOf(c) }, options: opts.map((idx) => set.items.find((it) => it.idx === idx)) })
      rms += Date.now() - s
      called++
    }
    per[k] = score(set, got)
  }
  const g = groupScores(per)
  const all = merge(Object.values(per))
  console.log(`\n⑤ + Claude 재순위  개발 ${cell(g.dev)}  확인 ${cell(g.holdout)}  시험 ${cell(g.test)}  → 전체 ${cell(all)}`)
  console.log(`  Claude 호출 ${called}건 (${Math.round((called / all.n) * 100)}%) · 1건 평균 ${called ? Math.round(rms / called) : 0}ms · 틀린 것: ${all.errors.join(' ') || '없음'}`)
  result.rerank = { ...g, all, calls: called, avgMs: called ? Math.round(rms / called) : 0 }
}

const dir = new URL('../results/', here)
mkdirSync(dir, { recursive: true })
const file = `match_${result.date}_${model.replace(/\W+/g, '-')}_${input}.json`
writeFileSync(new URL(file, dir), JSON.stringify(result, null, 2))
console.log(`저장: eval/results/${file}`)
