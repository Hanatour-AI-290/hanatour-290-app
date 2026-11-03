// 유럽중앙은행 기준 환율 (frankfurter.app). 실패하면 null → 화면은 외화 그대로 보여 준다.
// 프로토타입 api/_shared.js rates() 에서 옮김.
// TODO(BE): R-20 결제일 기준 환율 + 없는 통화는 ExchangeRate API 로 보완
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
