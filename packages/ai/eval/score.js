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

/* ---------- 문장 측정 (PER-001 "문장 20개"): 말·카드 문자 → 지출 하나 (readRecord) ---------- */

const sameSet = (a, b) => [...a].sort().join(',') === [...b].sort().join(',')

/**
 * 문장 하나 채점. 결제자·나눌 사람을 비우면 화면이 말한 사람(me)으로 채우므로 그렇게 보고 비교한다 (App.jsx addFrom 과 같게).
 * @param {{ amount: number | null, currency: string, payers?: { name: string, amount: number }[], people: string[], category: string }} expected
 *   payers 가 없으면 말한 사람이 혼자 낸 것이 정답. amount null = 금액이 없는 문장이라 비워 두는 게 정답
 * @param {{ amount: number | null, currency: string, payer: string | null, payers?: { name: string, amount: number | null }[], people: string[], category: string }} got readRecord 결과
 * @param {string} me 말한 사람
 */
export function scoreSentence(expected, got, me) {
  const amountOk = expected.amount == null
    ? got.amount == null
    : got.amount === expected.amount && got.currency === expected.currency

  const want = expected.payers ?? [{ name: me, amount: expected.amount }]
  const have = got.payers?.length > 1 ? got.payers : [{ name: got.payer ?? me, amount: got.amount }]
  const key = (list) => list.map((p) => `${p.name}:${list.length > 1 ? p.amount : ''}`)
  const payerOk = sameSet(key(want), key(have))

  const peopleOk = sameSet(expected.people, got.people.length ? got.people : [me])
  const categoryOk = got.category === expected.category
  const correct = amountOk && payerOk && peopleOk && categoryOk
  // 금액을 비우면(읽지 못함) 화면이 직접 입력으로 넘기므로 사용자가 알아챈다
  const flagged = got.amount == null
  return { amountOk, payerOk, peopleOk, categoryOk, correct, flagged }
}

/**
 * 문장 점수 모으기.
 * @param {(ReturnType<typeof scoreSentence> & { ms: number })[]} rows
 */
export function summarizeSentences(rows) {
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null)
  const rate = (k) => pct(rows.filter((r) => r[k]).length, rows.length)
  const wrong = rows.filter((r) => !r.correct)
  return {
    cases: rows.length,
    amountMatch: rate('amountOk'), // 금액·통화 일치율 (%)
    payerAccuracy: rate('payerOk'), // 결제자 정답률 (%)
    peopleAccuracy: rate('peopleOk'), // 나눌 사람 정답률 (%)
    categoryMatch: rate('categoryOk'), // 분류 일치율 (%)
    caught: pct(wrong.filter((r) => r.flagged).length, wrong.length), // 틀린 것 중 비워 둬서 직접 입력으로 넘어간 비율 (%)
    avgSeconds: rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length / 100) / 10 : null,
  }
}
