// 기록 ↔ 예정 항목 이름 유사도 (ML 임베딩). POST /api/match/plan 과 eval/match 가 같이 쓴다.
// 1) 어느 항목에나 붙는 말("투어" 등)을 양쪽에서 빼고  2) 항목은 이름 + 별칭(상품 분석 때 Claude 가 만든 aliases) 중 가장 가까운 값을 쓴다.
import { stripGeneric } from '@h290/shared'
import { groupSimilarities } from './embed.js'

/**
 * @param {string} text 기록 이름 (화면은 Claude 가 만든 name)
 * @param {{ name: string, aliases?: string[] }[]} items 예정 항목
 * @param {{ aliases?: boolean, strip?: boolean, model?: string }} [opts] aliases · strip 을 false 로 끄면 비교 실험용 (이름만 / 흔한 말 그대로)
 * @returns {Promise<number[]>} items 순서대로 0~1
 */
export function planSimilarities(text, items, { aliases = true, strip = true, ...opts } = {}) {
  const prep = strip ? stripGeneric : (t) => t
  const groups = items.map((it) => [it.name, ...(aliases ? it.aliases ?? [] : [])].map(prep))
  return groupSimilarities(prep(text), groups, opts)
}
