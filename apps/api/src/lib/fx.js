// 환율. 실패하면 null → 화면은 외화 그대로 보여 준다.

// 상품 분석(estimate)용 최신 환율 4개 통화 (프로토타입 api/_shared.js rates() 에서 옮김)
export async function rates() {
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=KRW&to=USD,EUR,JPY,TRY')
    if (!r.ok) return null
    const j = await r.json()
    const krw = {}
    for (const [cur, v] of Object.entries(j.rates)) krw[cur] = 1 / v
    return { date: j.date, krw }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- 결제일 환율 (R-20)
// 1) Frankfurter v2: 과거 날짜 조회 무료, MNT·VND 등 170개 통화. 응답 [{ date, base, quote, rate }]
//    결제일이 아직 없는 날(미래)이면 [] → 최신 값으로 다시 묻는다
// 2) 그래도 없으면 ExchangeRate-API 무료 주소: 최신 값만 있고, 화면에 출처 표시가 필요하다

const cache = new Map()

/** 실패(시간 초과 · 네트워크 · JSON 아님)는 null. 한 곳이 죽어도 다음 출처로 넘어가야 해서 여기서 받는다 */
async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function frankfurter(currency, date) {
  const q = `base=${currency}&quotes=KRW${date ? `&date=${date}` : ''}`
  const j = await getJson(`https://api.frankfurter.dev/v2/rates?${q}`)
  const row = Array.isArray(j) ? j[0] : null
  return row?.rate ? { rate: row.rate, date: row.date, source: 'Frankfurter' } : null
}

async function exchangeRateApi(currency) {
  const j = await getJson(`https://open.er-api.com/v6/latest/${currency}`)
  const rate = j?.result === 'success' ? j.rates?.KRW : null
  if (!rate) return null
  const date = new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10)
  return { rate, date, source: 'ExchangeRate-API', attribution: 'Rates By Exchange Rate API' }
}

/**
 * 외화 1 단위가 몇 원인지. date 는 결제일(YYYY-MM-DD), 비우면 최신.
 * 돌려준 date 가 요청한 날과 다를 수 있다 (미래 날짜, ExchangeRate-API 보완) → 화면에 그대로 표시
 * @returns {Promise<{ rate: number, date: string, source: string, attribution?: string } | null>}
 */
export async function rateOn(currency, date) {
  if (currency === 'KRW') return { rate: 1, date: date ?? new Date().toISOString().slice(0, 10), source: 'KRW' }
  const key = `${currency}|${date ?? ''}`
  if (cache.has(key)) return cache.get(key)
  // 출처마다 실패가 null 로 오므로 앞이 죽어도 다음으로 넘어간다 (Frankfurter 장애 때 예비가 안 쓰이던 문제)
  const fresh = date ? await frankfurter(currency, date) : null
  // 날짜 조회가 실패했으면 같은 서버의 최신 조회도 실패할 가능성이 높아 예비부터 묻는다
  const out = fresh || (date ? (await exchangeRateApi(currency)) || (await frankfurter(currency)) : (await frankfurter(currency)) || (await exchangeRateApi(currency)))
  // 지난 날짜 환율은 바뀌지 않으니 저장해 둔다. 예비(최신 값)로 대신 채운 건 저장하지 않는다 (복구되면 결제일 값을 다시 받게)
  if (out && date && out === fresh) cache.set(key, out)
  return out
}
