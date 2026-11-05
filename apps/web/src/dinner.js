// 영수증(4번 분석 결과 또는 시연 영수증 DINNER) → 5·6·7·8번 화면이 쓰는 모양. 화면 파일은 컴포넌트만 내보내도록 여기 둔다
import { toMinor, fromMinor } from './api.js'
import { DINNER, PEOPLE } from './demo.js'
import { lira } from './format.js'

export const ORDER = ['지우', '하린', '도윤', '서준']
// 줄별로 "말한 내용" 근거 (디자인: 맥주 줄에만 붙음)
const VOICE = { 1: '맥주는 하린이랑 도윤' }
const PAID_AT = '2026-11-05T21:00:00+03:00' // DAY 3 저녁 (sample.js: DAY 1 = 11/03)

// 영수증 원문 이름 → 디자인 이름 · 원문 표기 (맞출 수 없으면 원문 그대로)
const KNOWN = [
  [/kebap|kebab|케밥/i, '케밥', 'KEBAP'],
  [/efes|bira|beer|맥주/i, '에페스 맥주', 'EFES'],
  [/^su\b|water|생수|\bsu\b/i, '생수', 'SU'],
]
const NAME_BY_ID = Object.fromEntries(Object.entries(PEOPLE).map(([n, p]) => [p.id, n]))

/** 줄 i 의 "말한 내용" 근거. 분석 결과면 splits.source, 시연 영수증이면 디자인 문구 */
export const voiceOf = (d, i) => d.lines[i]?.voice ?? (d === DINNER ? VOICE[i] : undefined)

/**
 * 4번 분석 API 응답(POST /trips/:tripId/receipts/analyze) → DINNER 표시 모양.
 * { receipt: { lines, total(최소 단위), currency }, splits, payers | payerId } 가 아니면 null
 */
function fromAnalyze(a) {
  const r = a?.receipt
  if (!r || !Array.isArray(r.lines) || !r.lines.length || typeof r.total !== 'number' || !r.currency) return null
  if (!r.lines.every((l) => typeof l.total === 'number' && (l.name || l.nameKo))) return null
  const cur = r.currency
  const splits = Array.isArray(a.splits) ? a.splits : []
  const lines = r.lines.map((l, i) => {
    const text = `${l.name ?? ''} ${l.nameKo ?? ''} ${l.source ?? ''}`
    const hit = KNOWN.find(([re]) => re.test(text))
    const qty = Number.isInteger(l.qty) && l.qty > 0 ? l.qty : 1
    const split = splits.find((s) => s.lineIndex === i)
    const names = (split?.memberIds ?? []).map((id) => NAME_BY_ID[id]).filter(Boolean)
    return {
      name: hit ? hit[1] : (l.nameKo ?? l.name),
      raw: `${hit ? hit[2] : l.name ?? l.nameKo} × ${qty}`,
      qty,
      kind: l.kind === 'tax' ? 'tax' : 'item',
      amount: fromMinor(l.total, cur),
      people: names.length ? names : ORDER, // 배정 없는 줄은 넷이 1/N
      ...(split?.source && !/기본\s*1\/N/.test(split.source) ? { voice: split.source } : {}),
    }
  })
  const payerId = a.payers?.[0]?.memberId ?? a.payerId
  // 결제자 여러 명 (FR-008): [{ name, amount(소수) | null }]. 명단 밖 id 는 뺀다
  const payers = (Array.isArray(a.payers) ? a.payers : [])
    .map((p) => ({ name: NAME_BY_ID[p?.memberId], amount: typeof p?.amount === 'number' ? fromMinor(p.amount, cur) : null }))
    .filter((p) => p.name)
  // 질문 (FR-009): 합이 안 맞음 · 누가 낼지 모름 등. 선택지가 오면 칩으로
  const questions = (Array.isArray(a.questions) ? a.questions : [])
    .filter((q) => typeof q?.text === 'string' && q.text.trim())
    .map((q) => {
      const opts = [q.options, q.choices].find((o) => Array.isArray(o) && o.length >= 2)
      return { text: q.text.trim(), field: q.field, ...(opts ? { options: opts.map((o) => String(o?.label ?? o?.text ?? o)).slice(0, 3) } : {}) }
    })
    // 합이 안 맞는 질문(FR-009)을 먼저, 그다음 결제자, 나머지
    .map((q, i) => ({ q, i, rank: /합|달라/.test(q.text) ? 0 : q.field === 'payers' ? 1 : 2 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ q }) => q)
  const check = a.check && typeof a.check.ok === 'boolean' ? { ok: a.check.ok, errors: Array.isArray(a.check.errors) ? a.check.errors : [] } : null
  return {
    ...DINNER,
    currency: cur,
    total: fromMinor(r.total, cur),
    payer: NAME_BY_ID[payerId] ?? DINNER.payer,
    lines,
    ...(r.merchant ? { merchant: r.merchant } : {}),
    ...(payers.length > 1 ? { payers } : {}),
    ...(questions.length ? { questions } : {}),
    ...(check ? { check } : {}),
  }
}

/**
 * 합계 줄 검사 표시. 시연 값이거나 검사가 통과하면 null (디자인 문구 "영수증 합계와 같아요")
 * @returns {null | { text: string }}
 */
export function mismatchOf(d) {
  if (d === DINNER) return null
  const cur = d.currency ?? 'TRY'
  const unit = cur === 'TRY' ? '리라' : ` ${cur}`
  const minor = (v) => toMinor(v, cur)
  const total = minor(d.total)
  const paid = d.payers?.every((p) => p.amount != null) ? d.payers.reduce((s, p) => s + minor(p.amount), 0) : null
  const lineSum = d.lines.reduce((s, l) => s + minor(l.amount), 0)
  // 결제자 금액 합이 다르면 그것, 아니면 줄 합 (화면이 계산한 차이 · 검사 결과 둘 다 본다)
  const diff = paid != null && paid !== total ? paid - total : lineSum !== total ? lineSum - total : 0
  if (diff) return { text: `합계가 ${lira(Math.abs(fromMinor(diff, cur)))}${unit} 달라요` }
  if (d.check && !d.check.ok) return { text: d.check.errors.some((e) => /결제자/.test(e)) ? '낸 금액을 확인해 주세요' : '합계를 다시 확인해 주세요' }
  return null
}

/** 4번 결과(분석 API 응답 또는 DINNER 모양)가 쓸 만하면 그것, 아니면 시연 영수증 DINNER */
export function dinnerOf(state) {
  const d = state?.dinner
  if (!d) return DINNER
  if (d.receipt) return fromAnalyze(d) ?? DINNER
  const ok = Array.isArray(d.lines) && d.lines.length && d.lines.every((l) => typeof l.amount === 'number' && Array.isArray(l.people))
  return ok ? { ...DINNER, ...d } : DINNER
}

/**
 * 영수증 → API Expense (docs/api.md). 금액은 최소 단위(×100), 줄마다 나눌 사람(splits).
 * @param {typeof DINNER} d
 * @param {'pending' | 'confirmed'} status 결제자 말고 나눌 사람들의 확인 상태
 */
export function dinnerExpense(d, status = 'pending') {
  const cur = d.currency ?? 'TRY'
  const idsOf = (names) => names.map((n) => PEOPLE[n]?.id).filter(Boolean)
  const total = toMinor(d.total, cur)
  let lines = d.lines.map((l) => {
    const qty = l.qty ?? (Number(/×\s*(\d+)/.exec(l.raw ?? '')?.[1]) || 1)
    const t = toMinor(l.amount, cur)
    const unit = Number.isInteger(t / qty) ? t / qty : t // 나누어떨어지지 않으면 1개짜리 줄로 (서버 검사: 수량 × 단가 = 줄 금액)
    return { name: (l.raw ?? l.name).replace(/\s*×.*$/, ''), nameKo: l.name, kind: l.kind ?? 'item', qty: unit === t ? 1 : qty, unitPrice: unit, total: t }
  })
  // 줄 합이 총액과 다르면 차액을 몫 비율대로 나누는 줄로 (서버 검사: 줄 합 = 총액)
  const diff = total - lines.reduce((a, l) => a + l.total, 0)
  if (diff) lines = [...lines, { name: '읽지 못한 차액', kind: 'tax', qty: 1, unitPrice: diff, total: diff }]
  const all = idsOf(ORDER)
  const payer = PEOPLE[d.payer]?.id ?? all[0]
  // 결제자 여러 명: 모두 금액을 알고 합이 총액과 같을 때만 (아니면 한 명이 다 낸 것으로 — 서버 검사 통과)
  const many = (d.payers ?? []).map((p) => ({ memberId: PEOPLE[p.name]?.id, amount: p.amount == null ? null : toMinor(p.amount, cur), method: 'card' }))
  const manyOk = many.length > 1 && many.every((p) => p.memberId && p.amount != null) && many.reduce((s, p) => s + p.amount, 0) === total
  const payerIds = manyOk ? many.map((p) => p.memberId) : [payer]
  return {
    id: 'dinner-day3',
    tripId: 't1',
    category: '식사',
    merchant: d.merchant,
    payers: manyOk ? many : [{ memberId: payer, amount: total, method: 'card' }],
    total: { amount: total, currency: cur },
    lines,
    // 세금 줄은 배정하지 않는다 (몫 비율대로)
    splits: d.lines
      .map((l, i) => ({ lineIndex: i, kind: l.kind, memberIds: idsOf(l.people), source: voiceOf(d, i) }))
      .filter((s) => s.kind !== 'tax' && s.memberIds.length)
      .map(({ lineIndex, memberIds, source }) => ({ lineIndex, memberIds, ...(source ? { source } : {}) })),
    memberIds: all,
    confirmations: all.filter((id) => !payerIds.includes(id)).map((memberId) => ({ memberId, status })),
    paidAt: PAID_AT,
    createdAt: PAID_AT,
  }
}
