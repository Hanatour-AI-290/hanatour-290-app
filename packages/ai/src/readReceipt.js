// 1단계 "찍고": 영수증 사진 → 줄 단위 항목 (R-07). 금액은 AI 가 읽은 소수 그대로 받고, 최소 단위 정수 변환은 코드가 한다.
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { Category, minorDigits } from '@h290/shared'
import { getClient, MODEL } from './client.js'

const Line = z.object({
  name: z.string().describe('영수증에 찍힌 메뉴 이름 그대로 (예: TESTİ KEBABI)'),
  nameKo: z.string().describe('한국어 번역 (예: 항아리 케밥). 원래 한국어면 그대로'),
  kind: z.enum(['item', 'tax']).describe('메뉴·상품이면 item, 세금·봉사료(KDV, VAT, service)면 tax'),
  qty: z.number().int().describe('수량. 안 찍혀 있으면 1'),
  lineTotal: z.number().describe('그 줄의 금액 (수량 × 단가). 영수증에 찍힌 숫자를 소수로 (2.600,00 → 2600)'),
  source: z.string().describe('그 줄의 원문 그대로 (예: 4 x TESTİ KEBABI 2.600,00)'),
})

export const ReceiptRead = z.object({
  merchant: z.string().nullable().describe('가게 이름. 없으면 null'),
  currency: z.string().describe('ISO 통화 코드 (₺·TL → TRY, € → EUR)'),
  total: z.number().describe('최종 합계 (TOPLAM, TOTAL). 소수로'),
  lines: z.array(Line).describe('메뉴 줄과 세금 줄. 소계(ARA TOPLAM)·합계·결제수단 줄은 넣지 않는다'),
  paidAt: z.string().nullable().describe('영수증의 날짜·시각을 YYYY-MM-DDTHH:MM 로. 없으면 null'),
  category: Category.describe('지출 분류 (FR-018). 식당·카페면 식사, 투어·입장권이면 선택관광, 택시·버스면 교통, 가게면 쇼핑'),
})

const SYSTEM = `너는 여행 영수증을 줄 단위로 읽는다.
- 메뉴·상품 줄과 세금 줄만 lines 에 넣는다. 소계, 합계, 결제수단, 인사말 줄은 넣지 않는다.
- 금액은 영수증에 찍힌 숫자만 쓴다. 유럽식 표기(2.600,00)는 2600 으로 읽는다. 추측하지 않는다.
- 세금이 메뉴 가격에 이미 포함됐다고 적혀 있으면(KDV DAHİL 등) 세금 줄을 따로 넣지 않는다.
- nameKo 는 여행자가 알아보기 쉬운 짧은 한국어로 쓴다.
- 카드 번호, 승인 번호, 직원·손님 이름 같은 개인정보는 어떤 칸(source 포함)에도 옮기지 않는다. (보안 요구사항 3)`

/** 소수 금액 → 최소 단위 정수 (TRY 2600 → 260000) */
const toMinor = (v, currency) => Math.round(v * 10 ** minorDigits(currency))

/**
 * @param {{ image: string, mediaType: string, hint?: string[] }} input  base64 이미지, hint = 지난번에 틀린 점 (재시도 때)
 * @returns {Promise<ReturnType<typeof toReceipt>>}
 */
export async function readReceipt({ image, mediaType, hint = [] }) {
  const text = hint.length
    ? `지난번에 읽은 결과가 틀렸다. 다시 읽어 줘.\n틀린 점:\n${hint.map((h) => `- ${h}`).join('\n')}`
    : '이 영수증을 줄 단위로 읽어 줘.'
  const resp = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'low', format: zodOutputFormat(ReceiptRead) },
    system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
      { type: 'text', text },
    ] }],
  })
  if (resp.stop_reason === 'refusal' || !resp.parsed_output) throw new Error('영수증을 읽지 못했어요')
  return toReceipt(resp.parsed_output)
}

/**
 * AI 가 읽은 결과(ReceiptRead) → 서버가 쓰는 모양. 금액은 최소 단위 정수, 단가는 코드가 계산한다.
 * @param {import('zod').infer<typeof ReceiptRead>} r
 */
export function toReceipt(r) {
  const currency = r.currency.toUpperCase()
  return {
    merchant: r.merchant,
    paidAt: r.paidAt,
    category: r.category,
    currency,
    total: toMinor(r.total, currency),
    lines: r.lines.map((l) => {
      const total = toMinor(l.lineTotal, currency)
      const qty = Math.max(1, l.qty)
      // 단가는 코드가 계산한다. 나누어떨어지지 않으면 수량 1 로 본다 (검사 qty × unitPrice = total 이 항상 맞게)
      return total % qty === 0
        ? { name: l.name, nameKo: l.nameKo, kind: l.kind, qty, unitPrice: total / qty, total, source: l.source }
        : { name: l.name, nameKo: l.nameKo, kind: l.kind, qty: 1, unitPrice: total, total, source: l.source }
    }),
  }
}
