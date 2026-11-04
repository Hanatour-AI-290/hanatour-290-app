// 기록 ↔ 예정 항목 연결 후보 (AI 활용 방향 추천 2: 카드 문자 EUR 320 → "열기구 투어" 를 했다로).
// 이름이 얼마나 비슷한지(sims)는 임베딩 모델이 주고, 통화 · 금액 규칙과 후보 결정은 여기서 한다 (R-24).
// 후보만 고르고 연결은 사용자가 "맞아요" 를 눌러야 한다 (R-25 추측 금지).

/** 연결 후보 조건 (절대 점수). 예정 항목이 적을 때(RELATIVE.minItems 미만)와 글자 겹침 정보가 없을 때 쓴다. 근거는 docs/모델선정.md */
export const MATCH_DEFAULTS = { threshold: 0.87, amountBonus: 0.02, margin: 0.01, minSim: 0.86 }

/**
 * 연결 후보 조건 (상대 점수 + 글자 겹침). 이 모델은 관계없는 항목끼리도 유사도가 0.77 안팎이라 점수가 좁게 몰린다.
 * 그래서 같은 상품의 항목 평균보다 얼마나 높은지(sim - 평균)를 보고, 이름이 글자 그대로 들어 있으면(lex) 조금 더한다.
 * eval/match 교차검증: 정답 89%, 잘못 연결 0건 (이전 절대 점수는 83%, 3건). 항목이 4개 이하면 평균이 흔들려 절대 점수가 낫다.
 */
export const RELATIVE = { threshold: 0.06, lexBonus: 0.02, amountBonus: 0, margin: 0.01, minItems: 5 }

const NOISE = [
  /\[[^\]]*\]/g, // [Web발신]
  /\S*카드\([^)]*\)/g, // 하나카드(1*2*)
  /해외승인|국내승인|승인|일시불|누적|체크|결제|취소/g,
  /\b(?:EUR|TRY|USD|KRW|JPY|GBP|TL)\b/gi,
  /[€₺$₩]/g,
  /\d[\d.,]*\s*(?:만\s*원|만원|유로|리라|달러|원|엔)?/g, // 금액과 단위
  /\d{1,2}\/\d{1,2}|\d{1,2}:\d{2}/g, // 날짜 · 시각
]

/**
 * 모델에 넣기 전에 금액 · 통화 · 카드사 문구를 뺀다. 이름 비교에 숫자는 방해만 된다 (금액은 규칙이 따로 본다).
 * @param {string} text
 */
export function cleanText(text) {
  let t = String(text ?? '')
  for (const re of NOISE) t = t.replace(re, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

/** 어느 항목에나 붙는 말. 짧은 이름("카트 투어")은 이 말 때문에 무엇과도 비슷하게 나와서 뺀다 */
const GENERIC = /투어|tour|트립|trip|파크|park|상품|체험/gi

/**
 * 임베딩 모델에 넣기 전에 어느 항목에나 붙는 말을 뺀다. 다 빠지면 원래 문장을 쓴다.
 * @param {string} text
 */
export function stripGeneric(text) {
  const t = String(text ?? '').replace(GENERIC, ' ').replace(/\s+/g, ' ').trim()
  return t || String(text ?? '').trim()
}

/**
 * 기록 금액이 예정 항목의 1인 금액이나 인원수만큼의 금액과 같은지 (1% 이내).
 * @param {{ amount?: number | null, currency?: string | null, people?: number }} record 금액은 화면 단위(소수)
 * @param {{ amount: number | null, currency: string | null }} item
 */
export function amountMatches(record, item) {
  if (record.amount == null || item.amount == null || !record.currency || record.currency !== item.currency) return false
  const counts = [...new Set([1, Math.max(1, record.people ?? 1)])]
  return counts.some((n) => Math.abs(record.amount - item.amount * n) <= item.amount * n * 0.01)
}

/**
 * 연결 후보를 점수 순으로.
 * - 통화를 둘 다 아는데 다르면 뺀다
 * - 절대 점수: score = 이름 유사도 + (금액이 맞으면 amountBonus)
 * - 상대 점수: score = 이름 유사도 - 항목 평균 + (글자가 겹치면 lexBonus) + (금액이 맞으면 amountBonus)
 * - threshold 이상이고, 2등과의 차이가 margin 이상일 때만 후보 (애매하면 묻지도 않는다)
 * - 이름 유사도 자체가 minSim 아래면 금액이 맞아도 후보가 아니다 (같은 금액의 다른 가게를 잇지 않게)
 * @param {{ record: { amount?: number | null, currency?: string | null, people?: number },
 *           items: { idx: number, amount: number | null, currency: string | null }[],
 *           sims: number[], lex?: (0 | 1)[], threshold?: number, amountBonus?: number, margin?: number, minSim?: number, lexBonus?: number, minItems?: number }} input
 *   sims = items 순서대로 이름 유사도, lex = lexicalHits() 결과 (주면 상대 점수 RELATIVE, 안 주면 절대 점수 MATCH_DEFAULTS)
 * @returns {{ idx: number, score: number, sim: number, amountMatch: boolean }[]} 조건을 넘은 후보 (0개 또는 1개)
 */
export function matchPlanItems(input) {
  const { scored, threshold, margin, minSim } = scorePlanItems(input)
  const [top, second] = scored
  if (!top || top.score < threshold || top.sim < minSim) return []
  if (second && top.score - second.score < margin) return []
  return [{ ...top, score: round3(top.score), sim: round3(top.sim) }]
}

/** matchPlanItems 와 같은 입력 → 모든 항목의 점수 (높은 순)와 쓴 조건 */
export function scorePlanItems({ record, items, sims, lex, ...opts }) {
  // lex(글자 겹침)를 받았고 항목이 충분하면 상대 점수, 아니면 절대 점수
  const relative = Array.isArray(lex) && items.length >= (opts.minItems ?? RELATIVE.minItems)
  const { threshold, amountBonus, margin, minSim = 0, lexBonus = 0 } = { ...(relative ? { ...RELATIVE, minSim: 0 } : MATCH_DEFAULTS), ...opts }
  const base = relative ? items.reduce((a, _, i) => a + (sims[i] ?? 0), 0) / items.length : 0
  const scored = items
    .map((it, i) => {
      const amountMatch = amountMatches(record, it)
      const sim = sims[i] ?? 0
      return { idx: it.idx, sim, amountMatch, score: sim - base + (amountMatch ? amountBonus : 0) + (relative && lex[i] ? lexBonus : 0) }
    })
    .filter((_, i) => !(record.currency && items[i].currency && record.currency !== items[i].currency))
    .sort((a, b) => b.score - a.score)
  return { scored, relative, threshold, margin, minSim }
}

/** 재순위(Claude) 조건: 규칙이 후보를 못 정했을 때, 상대 점수가 floor 이상(= 항목 평균 이상)인 항목 최대 k개를 보여 주고 고르게 한다.
 *  eval/match 105건: 호출 42건(40%), 정답 93 → 101~102 (Claude 답이 실행마다 1건 정도 다름), 잘못 연결 0. floor 0.01 이면 호출 30건 · 정답 100, 0.02 면 15건 · 98 */
export const RERANK = { floor: 0, k: 3, fewMinSim: 0.8 }

/**
 * 규칙이 하나로 못 정한 애매한 기록이면 Claude 에게 보여 줄 항목 idx 들, 아니면 빈 배열 (부르지 않음).
 * 항목이 적어서(minItems 미만) 절대 점수로 정한 경우에도 같은 상대 점수로 고르되, 평균이 흔들리므로 유사도 fewMinSim 이상만 보여 준다.
 * @param {Parameters<typeof matchPlanItems>[0] & { floor?: number, k?: number, fewMinSim?: number }} input
 * @returns {number[]}
 */
export function rerankOptions({ floor = RERANK.floor, k = RERANK.k, fewMinSim = RERANK.fewMinSim, ...input }) {
  if (matchPlanItems(input).length) return []
  const few = input.items.length < (input.minItems ?? RELATIVE.minItems)
  const { scored } = scorePlanItems({ ...input, lex: input.lex ?? input.items.map(() => 0), minItems: 0 })
  return scored.filter((s) => s.score >= floor && (!few || s.sim >= fewMinSim)).slice(0, k).map((s) => s.idx)
}

const round3 = (x) => Math.round(x * 1000) / 1000

/** 글자 비교용: 흔한 말 · 괄호 · 띄어쓰기를 빼고 소문자로 */
const squash = (t) => stripGeneric(t).toLowerCase().replace(/[\s()[\],/·・-]+/g, '')

/**
 * 기록 이름(흔한 말 뺀 것)이 항목 이름 · 별칭 안에 글자 그대로 있거나 그 반대인지. matchPlanItems 의 lex 로 쓴다.
 * 예) "열기구 투어" ↔ "카파도키아 열기구 투어" → 1
 * @param {string} text 기록 이름
 * @param {{ name: string, aliases?: string[] }[]} items
 * @returns {(0 | 1)[]} items 순서대로
 */
export function lexicalHits(text, items) {
  const a = squash(text)
  return items.map((it) => ([it.name, ...(it.aliases ?? [])].some((n) => {
    const b = squash(n)
    return a.length >= 2 && b.length >= 2 && (b.includes(a) || a.includes(b))
  }) ? 1 : 0))
}
