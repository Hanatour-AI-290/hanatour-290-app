// 3단계 "확인": AI 결과를 규칙으로 검사한다. AI 를 부르지 않는다.

/**
 * @param {{ lines: { name?: string, nameKo?: string, kind?: string, qty: number, unitPrice: number, total: number }[], total: number,
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

  // 줄별 배정. splits 에 없는 줄은 기본 1/N 이라 "배정 안 된 줄"은 오류가 아니다 (R-24)
  const seen = new Set()
  for (const s of r.splits ?? []) {
    const line = r.lines[s.lineIndex]
    if (!line) {
      errors.push(`${s.lineIndex}번 줄이 없는데 배정됐어요`)
      continue
    }
    const name = line.nameKo || line.name || `${s.lineIndex}번 줄`
    // 세금은 몫 비율대로 나누므로 배정하지 않는다 (shared checkExpense 와 같은 규칙)
    if (line.kind === 'tax') errors.push(`${name}: 세금 줄은 배정하지 않아요`)
    // 정산(expenseShares)은 줄마다 첫 배정만 쓰므로, 두 번째 배정은 말없이 버려진다
    if (seen.has(s.lineIndex)) errors.push(`${name}: 같은 줄이 두 번 배정됐어요`)
    seen.add(s.lineIndex)
    if (!s.memberIds.length) errors.push(`${name}: 낼 사람이 없어요`)
  }

  // 배정된 사람은 모두 여행 멤버
  if (r.splits && r.memberIds) {
    const known = new Set(r.memberIds)
    for (const s of r.splits) {
      for (const id of s.memberIds) if (!known.has(id)) errors.push(`${s.lineIndex}번 줄: 모르는 멤버 ${id}`)
    }
  }

  return { ok: errors.length === 0, errors }
}
