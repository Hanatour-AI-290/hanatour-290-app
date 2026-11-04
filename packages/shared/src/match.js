// 기록 ↔ 예정 항목 연결 후보 (AI 활용 방향 추천 2: 카드 문자 EUR 320 → "열기구 투어" 를 했다로).
// 이름이 얼마나 비슷한지(sims)는 임베딩 모델이 주고, 통화 · 금액 규칙과 후보 결정은 여기서 한다 (R-24).
// 후보만 고르고 연결은 사용자가 "맞아요" 를 눌러야 한다 (R-25 추측 금지).

/** 연결 후보 조건. eval/match 의 세트 6개(상품 5개, 105건)로 정한 값. 상품 하나씩 빼고 정한 교차검증은 docs/모델선정.md */
export const MATCH_DEFAULTS = { threshold: 0.87, amountBonus: 0.02, margin: 0.01, minSim: 0.86 }

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
 * - score = 이름 유사도 + (금액이 맞으면 amountBonus)
 * - threshold 이상이고, 2등과의 차이가 margin 이상일 때만 후보 (애매하면 묻지도 않는다)
 * - 이름 유사도 자체가 minSim 아래면 금액이 맞아도 후보가 아니다 (같은 금액의 다른 가게를 잇지 않게)
 * @param {{ record: { amount?: number | null, currency?: string | null, people?: number },
 *           items: { idx: number, amount: number | null, currency: string | null }[],
 *           sims: number[], threshold?: number, amountBonus?: number, margin?: number, minSim?: number }} input sims = items 순서대로 이름 유사도
 * @returns {{ idx: number, score: number, sim: number, amountMatch: boolean }[]} 조건을 넘은 후보 (0개 또는 1개)
 */
export function matchPlanItems({ record, items, sims, ...opts }) {
  const { threshold, amountBonus, margin, minSim = 0 } = { ...MATCH_DEFAULTS, ...opts }
  const scored = items
    .map((it, i) => {
      const amountMatch = amountMatches(record, it)
      const sim = sims[i] ?? 0
      return { idx: it.idx, sim, amountMatch, score: sim + (amountMatch ? amountBonus : 0) }
    })
    .filter((_, i) => !(record.currency && items[i].currency && record.currency !== items[i].currency))
    .sort((a, b) => b.score - a.score)

  const [top, second] = scored
  if (!top || top.score < threshold || top.sim < minSim) return []
  if (second && top.score - second.score < margin) return []
  return [{ ...top, score: round3(top.score), sim: round3(top.sim) }]
}

const round3 = (x) => Math.round(x * 1000) / 1000
