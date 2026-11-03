// 화면의 기록(record) → API 데이터(Expense) 변환과 계산 API 호출.
// 나누기 · 환산 · 차감은 화면에서 하지 않고 서버(packages/shared)가 한다 (R-24). 화면은 결과만 그린다.
import { useEffect, useState } from 'react'
import { ME, MEMBER_IDS, TRIP_START, TRIP_TZ } from './sample.js'

/* ---------- 금액 단위 ---------- */

/** 통화의 소수 자릿수 (KRW 0, EUR·TRY 2) */
export function digits(cur) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits
  } catch {
    return 2
  }
}
/** 화면 금액(소수) → API 금액(최소 단위 정수). TRY 620 → 62000 */
export const toMinor = (v, cur) => Math.round(v * 10 ** digits(cur))
/** API 금액 → 화면 금액. 62000 TRY → 620 */
export const fromMinor = (v, cur) => v / 10 ** digits(cur)

/* ---------- 날짜 ---------- */

/** 여행 DAY n 의 날짜 (YYYY-MM-DD). DAY 1 = TRIP_START */
export function dayDate(day) {
  const d = new Date(`${TRIP_START}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Math.max(1, day) - 1)
  return d.toISOString().slice(0, 10)
}

/** 기록의 결제 시각. 일정 시각(09:00)이 없으면 정오로 둔다 */
export function paidAtOf(r, today) {
  const time = /^\d{2}:\d{2}$/.test(r.time ?? '') ? r.time : '12:00'
  return `${dayDate(r.day || today)}T${time}:00${TRIP_TZ}`
}

/* ---------- 기록 → Expense ---------- */

const EXPENSE_CATEGORIES = ['식사', '선택관광', '교통', '쇼핑', '팁', '기타']
/** 상품 분석 분류(가이드·기사 경비 등)는 지출 분류 6개 중 하나로. 리포트는 planItem 으로 원래 분류를 찾는다 */
const categoryOf = (c) => (c === '불포함 식사' ? '식사' : EXPENSE_CATEGORIES.includes(c) ? c : '기타')

/**
 * 화면 기록 하나를 API 의 Expense 로 바꾼다. 정산에 넣을 수 없는 기록(안 함 · 금액 미정)은 null.
 * @param {object} r 화면 기록 (sample.js buildRecords · 가계부 입력)
 * @param {(cur: string, date: string) => { rate: number, date: string, source: string } | null} fxOf 결제일 환율
 * @param {number} today 오늘이 여행 며칠째인지 (날짜 미정 기록에 씀)
 */
export function toExpense(r, fxOf, today) {
  if (r.status !== 'done' || r.amount == null || !r.currency) return null
  const cur = r.currency
  const ids = r.people.map((n) => MEMBER_IDS[n]).filter(Boolean)
  if (!ids.length) return null

  const unit = toMinor(r.amount, cur)
  const total = r.perPerson ? unit * ids.length : unit
  const method = r.method ?? 'card'
  // 결제자가 없는 일정 항목("각자 냄")은 각자 자기 몫을 낸 것으로 본다
  const payers = !r.payer && r.perPerson
    ? ids.map((id) => ({ memberId: id, amount: unit, method }))
    : [{ memberId: MEMBER_IDS[r.payer ?? ME], amount: total, method }]

  const paidAt = paidAtOf(r, today)
  const fx = cur === 'KRW' ? undefined : fxOf(cur, paidAt.slice(0, 10)) ?? undefined
  return {
    id: r.id,
    tripId: 't1',
    payers,
    total: { amount: total, currency: cur },
    lines: r.lines ?? [],
    splits: r.splits ?? [],
    memberIds: ids,
    confirmations: Object.entries(r.confirm ?? {})
      .filter(([n]) => MEMBER_IDS[n])
      .map(([n, status]) => ({ memberId: MEMBER_IDS[n], status })),
    category: categoryOf(r.category),
    ...(r.merchant ? { merchant: r.merchant } : {}),
    ...(r.src === '일정' ? { planItem: r.idx } : {}),
    paidAt,
    ...(fx ? { fx } : {}),
    createdAt: paidAt,
  }
}

/** 같이 쓴 돈으로 기록하면, 결제자 말고 나눌 사람에게 "맞아요 / 안 갔어요" 확인을 건다 (R-11) */
export function confirmFor(people, payer) {
  return Object.fromEntries(people.filter((p) => p !== payer).map((p) => [p, 'pending']))
}

/* ---------- API 호출 ---------- */

async function request(url, init) {
  const r = await fetch(url, init)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(j.error || '요청에 실패했어요')
    e.status = r.status
    e.detail = j.errors ?? j.issues
    throw e
  }
  return j
}

export const postJson = (url, body) =>
  request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const getJson = (url) => request(url)
export const postForm = (url, form) => request(url, { method: 'POST', body: form })

/**
 * body 가 바뀔 때마다 POST 해서 결과를 들고 있는다. 앞 요청이 늦게 와도 마지막 결과만 쓴다.
 * body 가 null 이면 부르지 않는다.
 * @returns {{ data: any, error: Error | null }}
 */
export function usePost(url, body) {
  const key = body == null ? null : JSON.stringify(body)
  const [state, setState] = useState({ key: null, data: null, error: null })
  useEffect(() => {
    if (key == null) return
    const stop = new AbortController() // 다음 요청이 나가면 이 결과는 버린다
    postJson(url, JSON.parse(key))
      .then((data) => !stop.signal.aborted && setState({ key, data, error: null }))
      .catch((error) => !stop.signal.aborted && setState({ key, data: null, error }))
    return () => stop.abort()
  }, [url, key])
  // 새 요청 결과가 오기 전에는 직전 결과를 그대로 보여 준다 (화면 깜빡임 방지)
  return { data: state.data, error: state.error }
}

/**
 * 결제일 환율 (R-20). 필요한 (통화, 날짜) 마다 /api/fx 를 한 번씩 불러 저장해 둔다.
 * 못 불러오면 상품 분석 때 받은 최신 환율을 쓰고, 출처에 그렇게 적는다.
 * @param {{ currency: string, date: string }[]} needs
 * @param {{ date: string, krw: Record<string, number> } | null} fallback /estimate 의 fx
 * @param {[Record<string, any>, Function]} store useStored 상태
 */
export function useFx(needs, fallback, [map, setMap]) {
  const missing = needs.filter((n) => n.currency !== 'KRW' && !map[`${n.currency}|${n.date}`])
  const key = [...new Set(missing.map((n) => `${n.currency}|${n.date}`))].sort().join(',')
  useEffect(() => {
    if (!key) return
    const stop = new AbortController()
    Promise.all(key.split(',').map(async (k) => {
      const [currency, date] = k.split('|')
      try {
        const fx = await getJson(`/api/fx?currency=${currency}&date=${date}`)
        return [k, { rate: fx.rate, date: fx.date, source: fx.source, ...(fx.attribution ? { attribution: fx.attribution } : {}) }]
      } catch {
        return [k, null]
      }
    })).then((rows) => {
      if (stop.signal.aborted) return
      const got = Object.fromEntries(rows.filter(([, v]) => v))
      if (Object.keys(got).length) setMap((m) => ({ ...m, ...got }))
    })
    return () => stop.abort()
  }, [key, setMap])

  return (currency, date) => {
    const hit = map[`${currency}|${date}`]
    if (hit) return { rate: hit.rate, date: hit.date, source: hit.source }
    const rate = fallback?.krw?.[currency]
    return rate ? { rate, date: fallback.date, source: '유럽중앙은행 최신(상품 분석 때)' } : null
  }
}
