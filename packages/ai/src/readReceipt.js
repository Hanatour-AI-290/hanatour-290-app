// 1단계 "찍고": 영수증 사진 → 줄 단위 항목 (VLM)

/**
 * @param {{ image: string, mediaType: string }} input  base64 이미지
 * @returns {Promise<{ lines: import('zod').infer<typeof import('@h290/shared').ReceiptLine>[], total: number, currency: string }>}
 */
export async function readReceipt(input) {
  // TODO(AI): prompts/readReceipt.md 프롬프트 + 구조화 출력(zod) 으로 줄 단위 추출
  void input
  throw new Error('readReceipt: 아직 구현 안 됨')
}
