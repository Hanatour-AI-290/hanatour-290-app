// R-01 상품 문구 → 가격표에 없는 비용 항목 추출 (프로토타입 api/estimate.js 에서 옮김)
import { z } from 'zod'
import { parse } from './client.js'

const Item = z.object({
  name: z.string().describe('항목 이름 (예: 카파도키아 열기구)'),
  category: z.enum(['선택관광', '싱글차지', '불포함 식사', '가이드·기사 경비', '팁', '기타']),
  amount: z.number().nullable().describe('문구에 적힌 1인 금액. 금액이 없으면 null'),
  currency: z.enum(['KRW', 'USD', 'EUR', 'JPY', 'TRY', 'OTHER']),
  required: z.boolean().describe('모든 참가자가 반드시 내는 돈이면 true, 고르는 옵션이면 false'),
  evidence: z.string().describe('근거가 된 원문 구절 그대로'),
  aliases: z.array(z.string()).describe('여행자가 같은 지출을 기록할 때 쓸 만한 다른 이름 4~8개 (한국어 · 영어 · 현지어). 카드 문자 · 말 기록을 이 항목과 잇는 데 쓴다'),
})

export const EstimateResult = z.object({
  title: z.string().describe('상품 이름. 없으면 빈 문자열'),
  base_price_krw: z.number().nullable().describe('상품가(원). 문구에 없으면 null'),
  items: z.array(Item),
})

const SYSTEM = `너는 패키지 여행 상품 문구에서 "가격표에 없는 돈"을 찾아내는 도우미다.
- 선택관광, 싱글차지, 불포함 식사, 가이드·기사 경비, 팁처럼 상품가 외에 따로 내는 돈만 항목으로 뽑는다.
- 상품가에 이미 포함된 것은 뽑지 않는다.
- 금액은 문구에 적힌 숫자만 쓴다. 적혀 있지 않으면 amount를 null로 둔다. 추측하지 않는다.
- "만 원"은 원 단위 숫자로 바꾼다 (10만 원 → 100000). 리라는 TRY.
- evidence에는 근거가 된 원문 구절을 그대로 옮긴다.
- aliases에는 그 항목만의 핵심 말로 다른 이름을 만든다 (예: 나이아가라 제트보트 투어 → 제트보트, 나이아가라 보트, jet boat, Whirlpool Jet). 카드 문자에 찍힐 법한 영어·현지어 가게 이름 표현을 섞는다. "투어"·"tour"처럼 어느 항목에나 붙는 말만으로 된 이름, 다른 항목과 헷갈릴 이름은 넣지 않는다. 금액·통화는 넣지 않는다.`

/**
 * @param {string} text 상품 문구
 * @returns {Promise<{ ok: true, data: z.infer<typeof EstimateResult> } | { ok: false, reason: 'refusal' | 'unparsed' }>}
 */
export async function estimate(text) {
  const resp = await parse({
    max_tokens: 16000,
    schema: EstimateResult,
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content: `<상품문구>\n${text}\n</상품문구>` }],
  })
  if (resp.stop_reason === 'refusal') return { ok: false, reason: 'refusal' }
  if (!resp.parsed_output) return { ok: false, reason: 'unparsed' }
  return { ok: true, data: resp.parsed_output }
}
