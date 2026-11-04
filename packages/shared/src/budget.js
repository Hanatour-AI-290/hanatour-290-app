// 예산 · 리포트 · 하루 끝 요약 계산 (R-03, R-22, R-23). AI 를 부르지 않는다 (R-24).
// 예상 비용은 상품 분석(/estimate) 결과를, 실제 지출은 정산과 같은 규칙(expenseShares)으로 나눈 "내 몫" 을 쓴다.
import { expenseShares, toKrw } from './settle.js'

/** @typedef {import('zod').infer<typeof import('./schemas.js').Estimate>} Estimate */
/** @typedef {import('zod').infer<typeof import('./schemas.js').PlanItem>} PlanItem */
/** @typedef {import('zod').infer<typeof import('./schemas.js').Expense>} Expense */
/** @typedef {import('zod').infer<typeof import('./schemas.js').Wallet>} Wallet */

/** 리포트 항목 순서. 상품가는 예상·실제 양쪽에 같게 들어간다 */
export const REPORT_KEYS = ['상품가', '선택관광', '가이드·기사 경비', '식사', '교통', '쇼핑', '팁', '기타']

/** 상품 분석 분류 · 지출 분류 → 리포트 항목 */
export function reportKey(category) {
  if (category === '불포함 식사') return '식사'
  return REPORT_KEYS.includes(category) && category !== '상품가' ? category : '기타'
}

/**
 * 예상 비용에 넣을 항목: 모두 내는 돈(required) + 사용자가 고른 선택관광(picks).
 * 싱글차지는 고른 경우에만 넣는다 (프로토타입과 같은 기준: 2인 1실로 간다고 본다).
 * @param {Estimate} estimate
 * @param {number[]} picks 고른 항목 번호 (items 순서)
 * @returns {number[]}
 */
export function includedItems(estimate, picks) {
  return estimate.items.flatMap((it, i) =>
    (it.required && it.category !== '싱글차지') || picks.includes(i) ? [i] : [],
  )
}

/**
 * 상품 분석 항목 하나의 1인 금액을 원으로. 금액이나 환율을 모르면 null.
 * @param {PlanItem} item
 * @param {Estimate['fx']} fx
 */
export function planItemKrw(item, fx) {
  if (item.amount == null) return null
  if (item.currency === 'KRW') return Math.round(item.amount)
  const rate = fx?.krw?.[item.currency]
  return rate ? Math.round(item.amount * rate) : null
}

/** 지출이 일어난 날짜 (YYYY-MM-DD, 현지 시각 그대로) */
export const expenseDate = (e) => (e.paidAt ?? e.createdAt).slice(0, 10)

/**
 * 하루 예산 (R-03): (고른 추가 비용 + 하루 생활비 × 일수) ÷ 일수.
 * 하루 생활비는 근거 데이터가 없는 예시 값이므로 화면에 "예시 값" 이라고 표시해야 한다 (livingIsExample).
 * @param {{ estimate: Estimate, picks: number[], days: number, livingPerDayKrw: number }} input
 */
export function dailyBudget({ estimate, picks, days, livingPerDayKrw }) {
  let extraKrw = 0
  const unknownItems = []
  for (const i of includedItems(estimate, picks)) {
    const k = planItemKrw(estimate.items[i], estimate.fx)
    if (k == null) unknownItems.push(i)
    else extraKrw += k
  }
  const livingKrw = livingPerDayKrw * days
  return {
    days,
    extraKrw, // 고른 선택관광 + 모두 내는 경비 (1인, 원)
    livingPerDayKrw,
    livingIsExample: true,
    perDayKrw: Math.round((extraKrw + livingKrw) / days),
    unknownItems, // 금액이나 환율을 몰라 빠진 항목 번호 → 화면에 "금액 미정"
    fxDate: estimate.fx?.date ?? null,
  }
}

/**
 * 한 사람의 지출별 몫을 원으로 (fx 없는 외화 지출은 missingFx 로).
 * @param {Expense[]} expenses
 * @param {string} memberId
 * @param {string[]} memberIds
 */
function mySharesKrw(expenses, memberId, memberIds) {
  const rows = []
  const missingFx = []
  for (const e of expenses) {
    const share = expenseShares(e, memberIds)[memberId] ?? 0
    if (!share) continue
    const krw = toKrw(share, e.total.currency, e.fx)
    if (krw == null) missingFx.push(e.id)
    else rows.push({ expense: e, share, krw })
  }
  return { rows, missingFx }
}

/**
 * 여행 후 리포트 (R-22): 상품가 + 현지에서 쓴 내 몫 = 진짜 총비용, 항목별 예상 vs 실제.
 * 실제 지출의 항목은 planItem 이 있으면 그 상품 분석 항목의 분류, 없으면 지출 분류(category)를 따른다.
 * @param {{ estimate: Estimate, picks: number[], memberId: string, memberIds: string[], expenses: Expense[] }} input
 */
export function report({ estimate, picks, memberId, memberIds, expenses }) {
  const base = Math.round(estimate.base_price_krw ?? 0)
  const predicted = Object.fromEntries(REPORT_KEYS.map((k) => [k, 0]))
  const actual = Object.fromEntries(REPORT_KEYS.map((k) => [k, 0]))
  predicted['상품가'] = base
  actual['상품가'] = base

  const included = includedItems(estimate, picks)
  const unknownItems = []
  for (const i of included) {
    const item = estimate.items[i]
    const k = planItemKrw(item, estimate.fx)
    if (k == null) unknownItems.push(i)
    else predicted[reportKey(item.category)] += k
  }

  const { rows, missingFx } = mySharesKrw(expenses, memberId, memberIds)
  for (const { expense: e, krw } of rows) {
    const item = e.planItem != null ? estimate.items[e.planItem] : null
    actual[reportKey(item ? item.category : e.category)] += krw
  }

  const linked = new Set(expenses.map((e) => e.planItem).filter((x) => x != null))
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
  return {
    rows: REPORT_KEYS.map((key) => ({ key, predicted: predicted[key], actual: actual[key] })),
    predictedTotal: sum(predicted),
    actualTotal: sum(actual), // 진짜 총비용
    unrecordedItems: included.filter((i) => !linked.has(i)), // 예상에 넣었는데 아직 기록이 없는 항목
    extraCount: rows.filter((r) => r.expense.planItem == null).length, // 예상에 없던 지출 건수
    unknownItems,
    missingFx,
  }
}

/**
 * 하루 끝 요약 (R-23): 그날 쓴 내 몫, 통화별 남은 잔액, 이 속도면 남은 일정에 모자랄지.
 * 예상: (오늘까지 그 통화로 쓴 내 몫 ÷ 지난 일수) × 남은 일수 와 지갑 잔액(카드+현금)을 비교한다.
 * @param {{ memberId: string, memberIds: string[], expenses: Expense[], wallets: Wallet[], date: string, day: number, days: number }} input
 *   date = 오늘 (YYYY-MM-DD), day = 오늘이 여행 며칠째인지 (1부터), days = 전체 일수
 */
export function daySummary({ memberId, memberIds, expenses, wallets, date, day, days }) {
  const upToToday = expenses.filter((e) => expenseDate(e) <= date)
  const today = upToToday.filter((e) => expenseDate(e) === date)

  const { rows, missingFx } = mySharesKrw(today, memberId, memberIds)
  const todayKrw = rows.reduce((a, r) => a + r.krw, 0)

  /** @type {Record<string, number>} 통화별 오늘까지 내 몫 */
  const spent = {}
  for (const e of upToToday) {
    const s = expenseShares(e, memberIds)[memberId] ?? 0
    if (s) spent[e.total.currency] = (spent[e.total.currency] ?? 0) + s
  }

  /** @type {Record<string, number>} 통화별 잔액 (카드 + 현금) */
  const left = {}
  for (const b of wallets.find((w) => w.memberId === memberId)?.balances ?? []) {
    left[b.currency] = (left[b.currency] ?? 0) + b.amount
  }

  const daysLeft = Math.max(0, days - day)
  const currencies = [...new Set([...Object.keys(left), ...Object.keys(spent)])].sort()
  const byCurrency = currencies.map((currency) => {
    const perDay = day > 0 ? Math.round((spent[currency] ?? 0) / day) : 0
    const need = perDay * daysLeft
    const balance = left[currency] ?? 0
    return { currency, balance, spent: spent[currency] ?? 0, perDay, need, shortfall: Math.max(0, need - balance) }
  })

  return { date, day, days, daysLeft, todayKrw, todayCount: rows.length, byCurrency, missingFx }
}
