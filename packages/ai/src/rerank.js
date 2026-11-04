// 임베딩 규칙이 후보를 못 정한 애매한 기록만 Claude 가 2~3개 중에서 고른다 (재순위). POST /api/match/plan 이 쓴다.
// 규칙이 이미 하나로 정했거나 비슷한 항목이 없으면 부르지 않는다. 고른 것도 후보일 뿐, 연결은 사용자가 "맞아요" 를 눌러야 한다 (R-25).
import { z } from 'zod'
import { parse } from './client.js'

export const RerankResult = z.object({
  choice: z.number().int().nullable().describe('같은 지출인 예정 항목 번호. 확실하지 않거나 어느 것도 아니면 null'),
  reason: z.string().describe('판단 근거 한 줄'),
})

const SYSTEM = `너는 패키지 여행 가계부의 도우미다. 여행 중 남긴 지출 기록 하나가 일정에 있던 예정 항목(선택관광 · 경비) 중 어느 것을 실제로 한 것인지 고른다.
- 기록 이름 · 금액과 항목 이름 · 다른 이름 · 금액을 비교한다. 카드 문자의 가게 이름은 영어 · 현지어일 수 있다.
- 지명만 같거나 금액만 같은 것은 같은 지출이 아니다 (예: 같은 동네 편의점과 크루즈).
- 확실하지 않으면 null 을 고른다. 잘못 잇는 것이 못 잇는 것보다 나쁘다.`

const money = (amount, currency) => (amount == null ? '금액 모름' : `${amount} ${currency ?? ''}`.trim())

/**
 * @param {{ record: { text: string, amount?: number | null, currency?: string | null, people?: number },
 *           options: { idx: number, name: string, aliases?: string[], amount?: number | null, currency?: string | null }[] }} input
 * @returns {Promise<number | null>} 고른 항목의 idx (options 안에 있는 것만), 없으면 null
 */
export async function rerankPlanItems({ record, options }) {
  if (!options.length) return null
  const list = options.map((o, i) => `${i + 1}. ${o.name}${o.aliases?.length ? ` (다른 이름: ${o.aliases.join(', ')})` : ''} · 1인 ${money(o.amount, o.currency)}`).join('\n')
  const resp = await parse({
    max_tokens: 1000,
    schema: RerankResult,
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `<기록>${record.text} · ${money(record.amount, record.currency)}${record.people > 1 ? ` · ${record.people}명` : ''}</기록>\n<예정항목>\n${list}\n</예정항목>` }],
  })
  const n = resp.parsed_output?.choice
  if (resp.stop_reason === 'refusal' || n == null) return null
  return options[n - 1]?.idx ?? null // 목록 밖 번호는 버린다
}
