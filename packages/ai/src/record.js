// R-15·16·18 영수증 사진 · 카드 결제 문자 · 말 한 줄 → 지출 항목 하나 (프로토타입 api/record.js 에서 옮김)
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getClient, MODEL } from './client.js'

export const RecordResult = z.object({
  name: z.string().describe('짧은 항목 이름 (예: 저녁 · 동굴 레스토랑, 마사지)'),
  category: z.enum(['식사', '선택관광', '교통', '쇼핑', '팁', '기타']),
  amount: z.number().nullable().describe('결제한 총액. 읽을 수 없으면 null'),
  currency: z.enum(['KRW', 'USD', 'EUR', 'JPY', 'TRY', 'OTHER']),
  payer: z.string().nullable().describe('돈을 낸 사람. 팀원 이름 중 하나. 말에 없으면 null'),
  people: z.array(z.string()).describe('이 돈을 나눌 사람(팀원 이름). 혼자 쓴 돈이면 말한 사람만, 말에 없으면 빈 배열'),
  evidence: z.string().describe('근거: 영수증 합계 줄, 카드 문자의 승인 금액 줄, 말한 문장 중 해당 부분 그대로'),
})

const SYSTEM = (members, me) => `너는 패키지 여행 가계부의 기록 도우미다. 입력(영수증 사진, 카드 결제 문자, 말 한 줄)에서 지출 하나를 뽑는다.
- 팀원: ${members.join(', ')}. 말하는 사람(기록하는 사람)은 ${me}이다. "내가"는 ${me}.
- 영수증이면 합계(TOPLAM, TOTAL, 합계) 금액을 쓴다. 튀르키예 리라(TL, ₺)는 TRY.
- 카드 결제 문자면 승인 금액과 그 통화(EUR, USD, TRY 등 문자에 찍힌 통화)를 쓰고, name은 가맹점을 알아보기 쉬운 한국어로 쓴다. 결제자는 문자를 받은 ${me}이다. 카드 번호·이름 같은 개인정보는 evidence에 옮기지 않는다.
- 금액·사람은 입력에 있는 것만 쓴다. 없으면 null 또는 빈 배열로 둔다. 추측하지 않는다.
- "다 같이", "넷이"처럼 모두를 말하면 people에 팀원 전체를 넣는다.
- "누구 빼고"라고 하면 그 사람을 people에서 뺀다.`

/**
 * @param {{ text?: string, image?: { mediaType: string, data: string }, kind?: 'sms' | 'voice', members: string[], me: string }} input
 * @returns {Promise<{ ok: true, data: z.infer<typeof RecordResult> } | { ok: false, reason: 'refusal' | 'unparsed' }>}
 */
export async function readRecord({ text = '', image, kind, members, me }) {
  const content = []
  if (image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } })
    content.push({ type: 'text', text: text ? `영수증 사진이다. 덧붙인 말: ${text}` : '영수증 사진이다. 합계를 기록해 줘.' })
  } else {
    const tag = kind === 'sms' ? '카드문자' : '말'
    content.push({ type: 'text', text: `<${tag}>${text}</${tag}>` })
  }

  const resp = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(RecordResult) },
    system: SYSTEM(members, me),
    messages: [{ role: 'user', content }],
  })
  if (resp.stop_reason === 'refusal') return { ok: false, reason: 'refusal' }
  const out = resp.parsed_output
  if (!out) return { ok: false, reason: 'unparsed' }

  // 팀원 이름이 아닌 값은 버린다 (추측 방지, R-25)
  out.payer = members.includes(out.payer) ? out.payer : null
  out.people = out.people.filter((p) => members.includes(p))
  return { ok: true, data: out }
}
