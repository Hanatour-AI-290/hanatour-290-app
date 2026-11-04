// 평가 채점 (PER-001). AI 를 부르지 않는 순수 함수라 테스트로 확인한다.
// 지표: 줄 금액 일치율, 합계 일치, 배정 정답률, 틀린 결과를 검사·질문으로 잡아낸 비율

/**
 * 정답 줄과 읽은 줄을 금액으로 짝짓는다 (같은 금액이 여러 줄이면 순서대로 하나씩).
 * @param {{ total: number }[]} expected
 * @param {{ total: number }[]} got
 * @returns {(number | null)[]} 정답 줄 i 와 짝인 읽은 줄 번호 (없으면 null)
 */
export function pairLines(expected, got) {
  const used = new Set()
  return expected.map((e) => {
    const j = got.findIndex((g, k) => !used.has(k) && g.total === e.total)
    if (j < 0) return null
    used.add(j)
    return j
  })
}

/** 줄 i 를 나눌 사람 (배정이 없으면 전원) */
const peopleOf = (splits, i, all) => [...(splits.find((s) => s.lineIndex === i)?.memberIds ?? all)].sort().join(',')

/**
 * 케이스 하나 채점.
 * @param {{ total: number, lines: { total: number, kind?: string }[], splits: { lineIndex: number, memberIds: string[] }[] }} expected
 * @param {{ receipt: { total: number, lines: { total: number, kind?: string }[] }, splits: { lineIndex: number, memberIds: string[] }[], check: { ok: boolean }, questions: unknown[] }} got
 * @param {string[]} memberIds
 */
export function scoreCase(expected, got, memberIds) {
  const pair = pairLines(expected.lines, got.receipt.lines)
  const lineHits = pair.filter((j) => j != null).length

  // 배정: 정답의 메뉴 줄마다, 짝지은 읽은 줄의 나눌 사람이 같은지
  let splitTotal = 0
  let splitHits = 0
  expected.lines.forEach((l, i) => {
    if (l.kind === 'tax') return
    splitTotal++
    const j = pair[i]
    if (j != null && peopleOf(expected.splits, i, memberIds) === peopleOf(got.splits, j, memberIds)) splitHits++
  })

  const totalOk = got.receipt.total === expected.total
  const correct = totalOk && lineHits === expected.lines.length && splitHits === splitTotal
  const flagged = !got.check.ok || got.questions.length > 0
  return { lineHits, lineTotal: expected.lines.length, totalOk, splitHits, splitTotal, correct, flagged }
}

/**
 * 케이스 점수 모으기.
 * @param {(ReturnType<typeof scoreCase> & { ms: number })[]} rows
 */
export function summarize(rows) {
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
  const wrong = rows.filter((r) => !r.correct)
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null)
  return {
    cases: rows.length,
    lineMatch: pct(sum('lineHits'), sum('lineTotal')), // 줄 금액 일치율 (%)
    totalMatch: pct(rows.filter((r) => r.totalOk).length, rows.length), // 합계 일치율 (%)
    splitAccuracy: pct(sum('splitHits'), sum('splitTotal')), // 배정 정답률 (%)
    caught: pct(wrong.filter((r) => r.flagged).length, wrong.length), // 틀린 결과 중 검사·질문으로 잡아낸 비율 (%), 틀린 게 없으면 null
    avgSeconds: rows.length ? Math.round(sum('ms') / rows.length / 100) / 10 : null,
  }
}
