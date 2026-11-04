// 정산 계산은 AI 가 아니라 이 규칙 함수가 한다 ("읽는 건 AI, 계산은 규칙", R-24).
// 규칙 (요구사항정의서 PER-003)
// - 기본은 1/N, 영수증 줄마다 배정(splits)이 있으면 그 사람들끼리 나눈다
// - 세금 줄(kind: 'tax')과 줄 합계에 안 잡힌 금액은 각자 몫 비율대로 나눈다
// - 통화별로 따로 계산한다 (원화로 묶지 않는다)
// - 최소 단위로 나누고 남는 금액은 낸 사람이 부담한다
// - "안 갔어요"(declined) 를 누른 사람은 빼고 남은 사람끼리 다시 나눈다 (R-11)

/** @typedef {import('zod').infer<typeof import('./schemas.js').Expense>} Expense */
/** @typedef {import('zod').infer<typeof import('./schemas.js').Wallet>} Wallet */
/** @typedef {import('zod').infer<typeof import('./schemas.js').CashTransfer>} CashTransfer */
/** @typedef {Record<string, number>} Amounts memberId → 최소 단위 금액 */

const EPS = 1e-9

/** 통화의 소수 자릿수 (KRW·JPY 0, EUR·TRY 2) */
export function minorDigits(currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
  } catch {
    return 2
  }
}

/** 최소 단위 금액을 원으로. fx.rate = 외화 1 단위가 몇 원인지 */
export function toKrw(amount, currency, fx) {
  if (currency === 'KRW') return amount
  if (!fx?.rate) return null
  return Math.round((amount / 10 ** minorDigits(currency)) * fx.rate)
}

/** 결제자별로 낸 금액 */
export function paidBy(expense) {
  /** @type {Amounts} */
  const out = {}
  for (const p of expense.payers) out[p.memberId] = (out[p.memberId] ?? 0) + p.amount
  return out
}

/** 가장 많이 낸 결제자 (남는 금액을 부담할 사람) */
function mainPayer(expense) {
  return expense.payers.reduce((a, b) => (b.amount > a.amount ? b : a)).memberId
}

/** 이 지출에서 "안 갔어요" 를 누른 사람 */
const declinedOf = (expense) =>
  new Set(expense.confirmations.filter((c) => c.status === 'declined').map((c) => c.memberId))

/** 참여자 확인이 끝났는지: 확인 대기(pending) 가 하나도 없으면 끝 */
export const isConfirmed = (expense) => expense.confirmations.every((c) => c.status !== 'pending')

/**
 * 지출 한 건의 사람별 몫 (지출 통화의 최소 단위 정수). 몫의 합은 항상 total.amount 와 같다.
 * @param {Expense} expense
 * @param {string[]} roomMemberIds 정산방 전원 (expense.memberIds 가 비었을 때 1/N 대상)
 * @returns {Amounts}
 */
export function expenseShares(expense, roomMemberIds) {
  const declined = declinedOf(expense)
  const keep = (ids) => ids.filter((id) => !declined.has(id))
  const people = keep(expense.memberIds.length ? expense.memberIds : roomMemberIds)
  if (!people.length) throw new Error(`${expense.id}: 나눌 사람이 없습니다`)

  // 1) 메뉴 줄마다 배정된 사람끼리 나눈 비율 (소수 그대로)
  /** @type {Record<string, number>} */
  const raw = {}
  let itemSum = 0
  expense.lines.forEach((line, i) => {
    if (line.kind === 'tax') return
    const split = expense.splits.find((s) => s.lineIndex === i)
    let ids = split ? keep(split.memberIds) : people
    if (!ids.length) ids = people // 배정된 사람이 모두 빠지면 남은 사람끼리
    for (const id of ids) raw[id] = (raw[id] ?? 0) + line.total / ids.length
    itemSum += line.total
  })

  // 2) 줄이 없으면 1/N. 있으면 세금·차액까지 몫 비율대로 늘린다
  const total = expense.total.amount
  const weight = itemSum > 0 ? raw : Object.fromEntries(people.map((id) => [id, 1]))
  const wSum = Object.values(weight).reduce((a, b) => a + b, 0)

  // 3) 최소 단위로 내림, 남는 금액은 낸 사람이 부담
  /** @type {Amounts} */
  const shares = {}
  let assigned = 0
  for (const [id, w] of Object.entries(weight)) {
    shares[id] = Math.floor((total * w) / wSum + EPS)
    assigned += shares[id]
  }
  const rest = total - assigned
  if (rest) {
    const payer = mainPayer(expense)
    shares[payer] = (shares[payer] ?? 0) + rest
  }
  return shares
}

/**
 * 받을 사람·보낼 사람을 큰 금액부터 맞춘다 (같은 통화 안에서만).
 * @param {Amounts} net 양수 = 받을 돈, 음수 = 보낼 돈
 * @returns {{ fromId: string, toId: string, amount: number }[]}
 */
export function minTransfers(net) {
  const byAmount = (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)
  const cred = Object.entries(net).filter(([, v]) => v > 0).sort(byAmount)
  const debt = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => [id, -v]).sort(byAmount)
  const out = []
  let i = 0
  let j = 0
  while (i < debt.length && j < cred.length) {
    const x = Math.min(debt[i][1], cred[j][1])
    out.push({ fromId: debt[i][0], toId: cred[j][0], amount: x })
    debt[i][1] -= x
    cred[j][1] -= x
    if (!debt[i][1]) i++
    if (!cred[j][1]) j++
  }
  return out
}

/**
 * 지출 목록으로 멤버별 몫을 통화별로 계산한다.
 * @param {Expense[]} expenses
 * @param {string[]} roomMemberIds
 * @returns {Record<string, Amounts>} { [currency]: { [memberId]: amount } }
 */
export function sharesByCurrency(expenses, roomMemberIds) {
  /** @type {Record<string, Amounts>} */
  const out = {}
  for (const e of expenses) {
    const cur = (out[e.total.currency] ??= {})
    for (const [id, v] of Object.entries(expenseShares(e, roomMemberIds))) cur[id] = (cur[id] ?? 0) + v
  }
  return out
}

/**
 * 정산방 전체 정산: 통화별 몫·낸 돈·차액·보낼 돈, 사람별 원화 합계 (R-06, R-12, R-19, R-20).
 * @param {{ memberIds: string[], expenses: Expense[] }} input
 */
export function settle({ memberIds, expenses }) {
  const zero = () => Object.fromEntries(memberIds.map((id) => [id, 0]))
  /** @type {Record<string, { shares: Amounts, paid: Amounts, net: Amounts, transfers: ReturnType<typeof minTransfers> }>} */
  const byCurrency = {}
  const krw = Object.fromEntries(memberIds.map((id) => [id, { share: 0, paid: 0 }]))
  const missingFx = []

  for (const e of expenses) {
    const c = e.total.currency
    const cur = (byCurrency[c] ??= { shares: zero(), paid: zero(), net: zero(), transfers: [] })
    const shares = expenseShares(e, memberIds)
    const paid = paidBy(e)
    for (const [id, v] of Object.entries(shares)) cur.shares[id] = (cur.shares[id] ?? 0) + v
    for (const [id, v] of Object.entries(paid)) cur.paid[id] = (cur.paid[id] ?? 0) + v

    const fx = c === 'KRW' ? { rate: 1 } : e.fx
    if (!fx) {
      missingFx.push(e.id)
      continue
    }
    for (const [id, v] of Object.entries(shares)) (krw[id] ??= { share: 0, paid: 0 }).share += toKrw(v, c, fx)
    for (const [id, v] of Object.entries(paid)) (krw[id] ??= { share: 0, paid: 0 }).paid += toKrw(v, c, fx)
  }

  for (const cur of Object.values(byCurrency)) {
    for (const id of new Set([...Object.keys(cur.shares), ...Object.keys(cur.paid)])) {
      cur.net[id] = (cur.paid[id] ?? 0) - (cur.shares[id] ?? 0)
    }
    cur.transfers = minTransfers(cur.net)
  }

  return {
    byCurrency,
    krw, // 사람별 원화 합계 (내 몫 = share, 내가 낸 돈 = paid). fx 없는 외화 지출은 빠지고 missingFx 에 남는다
    pendingIds: expenses.filter((e) => !isConfirmed(e)).map((e) => e.id),
    missingFx,
  }
}

/**
 * 지출 데이터가 앞뒤가 맞는지 검사 (R-09 서버 검사 중 계산 부분). AI 를 부르지 않는다.
 * @param {Expense} expense
 * @param {string[]} roomMemberIds
 * @returns {string[]} 틀린 점. 비면 통과
 */
export function checkExpense(expense, roomMemberIds) {
  const errors = []
  const known = new Set(roomMemberIds)
  const total = expense.total.amount

  const paid = expense.payers.reduce((s, p) => s + p.amount, 0)
  if (paid !== total) errors.push(`${expense.id}: 결제자가 낸 금액 합 ${paid} ≠ 총액 ${total}`)

  if (expense.lines.length) {
    const sum = expense.lines.reduce((s, l) => s + l.total, 0)
    if (sum !== total) errors.push(`${expense.id}: 줄 합계 ${sum} ≠ 총액 ${total}`)
  }

  for (const s of expense.splits) {
    const line = expense.lines[s.lineIndex]
    if (!line) errors.push(`${expense.id}: ${s.lineIndex}번 줄이 없습니다`)
    else if (line.kind === 'tax') errors.push(`${expense.id}: ${s.lineIndex}번 줄은 세금이라 배정하지 않습니다`)
  }

  const ids = [
    ...expense.payers.map((p) => p.memberId),
    ...expense.memberIds,
    ...expense.splits.flatMap((s) => s.memberIds),
    ...expense.confirmations.map((c) => c.memberId),
  ]
  for (const id of new Set(ids)) if (!known.has(id)) errors.push(`${expense.id}: 정산방에 없는 멤버 ${id}`)

  const declined = declinedOf(expense)
  const people = (expense.memberIds.length ? expense.memberIds : roomMemberIds).filter((id) => !declined.has(id))
  if (!people.length) errors.push(`${expense.id}: 나눌 사람이 없습니다`)

  return errors
}

// ---------------------------------------------------------------- 지갑 (R-05, R-12, R-13)

function adjust(wallets, memberId, currency, method, delta) {
  const w = wallets.find((x) => x.memberId === memberId)
  if (!w) throw new Error(`지갑이 없는 멤버 ${memberId}`)
  let b = w.balances.find((x) => x.currency === currency && x.method === method)
  if (!b) w.balances.push((b = { amount: 0, currency, method }))
  b.amount += delta
}

const balanceOf = (wallets, memberId, currency, method) =>
  wallets.find((x) => x.memberId === memberId)?.balances.find((b) => b.currency === currency && b.method === method)
    ?.amount ?? 0

/**
 * 확인이 끝난 지출을 지갑에 반영한다 (앱 안의 기록상 차감, 실제 송금 아님, R-12).
 * - 결제자: 낸 금액만큼 그 결제 수단(카드/현금) 잔액에서 빠진다
 * - 참여자: 자기 몫을 자기 카드 잔액에서 결제자 카드 잔액으로 옮긴다
 * - 카드 잔액이 모자라면 옮기지 않고 shortages 로 돌려준다 → 현금으로 주고받기(CashTransfer, R-13)
 * @param {Wallet[]} wallets 바꾸지 않는다 (새 배열을 돌려줌)
 * @param {Expense} expense
 * @param {string[]} roomMemberIds
 */
export function applyExpense(wallets, expense, roomMemberIds) {
  const next = structuredClone(wallets)
  const c = expense.total.currency
  if (!isConfirmed(expense)) return { applied: false, wallets: next, moves: [], shortages: [] }

  for (const p of expense.payers) adjust(next, p.memberId, c, p.method, -p.amount)

  const shares = expenseShares(expense, roomMemberIds)
  const paid = paidBy(expense)
  /** @type {Amounts} */
  const net = {}
  for (const id of new Set([...Object.keys(shares), ...Object.keys(paid)])) net[id] = (paid[id] ?? 0) - (shares[id] ?? 0)

  const moves = []
  const shortages = []
  for (const t of minTransfers(net)) {
    const have = balanceOf(next, t.fromId, c, 'card')
    if (have < t.amount) {
      shortages.push({ memberId: t.fromId, toId: t.toId, currency: c, need: t.amount, have })
      continue
    }
    adjust(next, t.fromId, c, 'card', -t.amount)
    adjust(next, t.toId, c, 'card', t.amount)
    moves.push({ ...t, currency: c })
  }
  return { applied: true, wallets: next, moves, shortages }
}

/**
 * 현금으로 주고받은 건을 지갑에 반영한다. 준 사람(given)·받은 사람(received) 둘 다 눌러야 반영 (R-13).
 * @param {Wallet[]} wallets
 * @param {CashTransfer} t
 */
export function applyCashTransfer(wallets, t) {
  const next = structuredClone(wallets)
  if (!(t.given && t.received)) return { applied: false, wallets: next }
  adjust(next, t.fromId, t.money.currency, 'cash', -t.money.amount)
  adjust(next, t.toId, t.money.currency, 'cash', t.money.amount)
  return { applied: true, wallets: next }
}

// ---------------------------------------------------------------- 중복 결제 경고 (R-14)

/** 가게 이름 비교용: 소문자, 글자·숫자만 */
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/**
 * 새 지출과 비슷한 기존 지출을 찾는다 → 화면은 "같은 결제인가요?" 를 묻는다.
 * 같은 통화이고, 금액 차이가 amountRate 이하이고, 결제 시각 차이가 minutes 이하이면 후보.
 * 가게 이름이 양쪽에 다 있으면 한쪽이 다른 쪽을 포함해야 한다. 한쪽이라도 없으면 금액·시각만 본다.
 * @param {Expense} expense 새로 올라온 지출
 * @param {Expense[]} expenses 이미 있는 지출
 * @param {{ amountRate?: number, minutes?: number }} [opts]
 * @returns {{ id: string, amountDiff: number, minutesApart: number, sameMerchant: boolean | null }[]}
 */
export function findDuplicates(expense, expenses, { amountRate = 0.01, minutes = 30 } = {}) {
  const at = (e) => Date.parse(e.paidAt ?? e.createdAt)
  const t0 = at(expense)
  const out = []
  for (const e of expenses) {
    if (e.id === expense.id || e.total.currency !== expense.total.currency) continue
    const amountDiff = Math.abs(e.total.amount - expense.total.amount)
    if (amountDiff > Math.abs(expense.total.amount) * amountRate) continue
    const minutesApart = Math.round(Math.abs(at(e) - t0) / 60000)
    if (!(minutesApart <= minutes)) continue // 시각을 못 읽으면(NaN) 후보에서 뺀다
    let sameMerchant = null
    if (e.merchant && expense.merchant) {
      const a = norm(e.merchant)
      const b = norm(expense.merchant)
      sameMerchant = a.includes(b) || b.includes(a)
      if (!sameMerchant) continue
    }
    out.push({ id: e.id, amountDiff, minutesApart, sameMerchant })
  }
  return out
}

// ---------------------------------------------------------------- 지갑 다시 계산 (R-05, R-12, R-13)

/**
 * 처음 지갑(환전 직후)에서 시작해 확인이 끝난 지출과 끝난 현금 주고받기를 차례로 반영한다.
 * 지출을 고치면 처음부터 다시 계산하면 되므로, 한 번 반영한 지출을 따로 기억하지 않아도 된다.
 * - 카드 잔액이 모자라 옮기지 못한 몫은 현금 주고받기(CashTransfer) 로 만든다. id = `${지출 id}:${보낼 사람 id}`
 * - cashStatus[id] 의 given(줬어요) · received(받았어요) 가 둘 다 true 인 건만 현금 잔액에 반영한다
 * @param {{ wallets: Wallet[], expenses: Expense[], memberIds: string[], cashStatus?: Record<string, { given?: boolean, received?: boolean }> }} input
 */
export function replayWallets({ wallets, expenses, memberIds, cashStatus = {} }) {
  let current = structuredClone(wallets)
  const applied = []
  const pending = []
  const moves = []
  const cashTransfers = []

  for (const e of expenses) {
    const r = applyExpense(current, e, memberIds)
    if (!r.applied) {
      pending.push(e.id)
      continue
    }
    current = r.wallets
    applied.push(e.id)
    for (const m of r.moves) moves.push({ expenseId: e.id, ...m })
    for (const s of r.shortages) {
      const id = `${e.id}:${s.memberId}`
      const st = cashStatus[id] ?? {}
      cashTransfers.push({
        id, tripId: e.tripId, fromId: s.memberId, toId: s.toId,
        money: { amount: s.need, currency: s.currency },
        given: !!st.given, received: !!st.received,
        createdAt: e.paidAt ?? e.createdAt,
        expenseId: e.id, have: s.have,
      })
    }
  }

  for (const t of cashTransfers) current = applyCashTransfer(current, t).wallets

  return { wallets: current, applied, pending, moves, cashTransfers }
}
