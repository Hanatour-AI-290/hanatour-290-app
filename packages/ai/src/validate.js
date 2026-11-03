// 3단계 "확인": AI 결과를 규칙으로 검사한다. AI 를 부르지 않는다.

/**
 * @param {{ lines: { qty: number, unitPrice: number, total: number }[], total: number,
 *           splits?: { lineIndex: number, memberIds: string[] }[], memberIds?: string[] }} r
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validate(r) {
  const errors = []

  // 줄 합계 = 영수증 합계
  const sum = r.lines.reduce((s, l) => s + l.total, 0)
  if (sum !== r.total) errors.push(`줄 합계 ${sum} ≠ 영수증 합계 ${r.total}`)

  // 수량 × 단가 = 줄 금액
  r.lines.forEach((l, i) => {
    if (l.qty * l.unitPrice !== l.total) errors.push(`${i}번 줄: ${l.qty}×${l.unitPrice} ≠ ${l.total}`)
  })

  // 배정된 사람은 모두 여행 멤버
  if (r.splits && r.memberIds) {
    const known = new Set(r.memberIds)
    for (const s of r.splits) {
      for (const id of s.memberIds) if (!known.has(id)) errors.push(`${s.lineIndex}번 줄: 모르는 멤버 ${id}`)
    }
  }

  // TODO(AI): 배정 안 된 줄, 중복 배정 검사

  return { ok: errors.length === 0, errors }
}
