// 결제자가 여러 명일 때 (FR-008). AI 는 말에서 이름과 말한 금액만 읽고, 금액 맞추기는 코드가 한다 (R-24, R-25 추측 금지).

/**
 * AI 가 읽은 결제자 목록 → 명단 안의 결제자와 금액. 금액 단위는 total 과 같다 (소수든 최소 단위든).
 * - 한 명이면 총액을 낸 것으로 본다
 * - 금액을 모르는 사람이 한 명이면 총액에서 나머지를 뺀 금액
 * - 금액을 모르는 사람이 둘 이상이면 추측하지 않고 amount null + 질문
 * @param {{ payers: { name: string, amount: number | null }[], names: string[], total: number }} input
 * @returns {{ payers: { name: string, amount: number | null }[], questions: string[] }}
 */
export function resolvePayers({ payers, names, total }) {
  const questions = []
  const unknown = [...new Set(payers.filter((p) => !names.includes(p.name)).map((p) => p.name))]
  if (unknown.length) questions.push(`결제자 중 명단에 없는 이름(${unknown.join(', ')})이 있어요. 누가 냈나요?`)

  // 명단 안의 이름만, 같은 사람이 두 번 나오면 금액을 합친다
  const byName = new Map()
  for (const p of payers.filter((x) => names.includes(x.name))) {
    const prev = byName.get(p.name)
    byName.set(p.name, prev === undefined ? p.amount : prev === null || p.amount === null ? null : prev + p.amount)
  }
  const out = [...byName].map(([name, amount]) => ({ name, amount }))

  if (out.length === 1) return { payers: [{ name: out[0].name, amount: total }], questions }

  const missing = out.filter((p) => p.amount === null)
  if (missing.length === 1) {
    const known = out.reduce((a, p) => a + (p.amount ?? 0), 0)
    missing[0].amount = total - known
  } else if (missing.length > 1) {
    questions.push(`${missing.map((p) => p.name).join(', ')}이(가) 각각 얼마 냈는지 알려 주세요`)
  }
  return { payers: out, questions }
}
