// 요청 수 제한 (BE-7). QR 로 공개한 링크에서 누군가 Claude 를 계속 부르면 API 키 비용이 커지므로 접속 기기(IP)마다 1분 창으로 센다.
// 저장소가 없어 서버 메모리에 센다 → Vercel 함수 인스턴스마다 따로 세는 근사치다. 연속으로 몰아 부르는 것은 막는다.

/**
 * @param {{ limit: number, windowMs?: number, now?: () => number }} opts limit = 창 하나에 허용하는 요청 수
 * @returns {import('hono').MiddlewareHandler}
 */
export function rateLimit({ limit, windowMs = 60_000, now = Date.now }) {
  /** @type {Map<string, { start: number, count: number }>} */
  const hits = new Map()
  return async (c, next) => {
    const t = now()
    // 오래된 창은 가끔 비운다 (메모리가 계속 늘지 않게)
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k)
    const ip = clientIp(c)
    const h = hits.get(ip)
    if (!h || t - h.start >= windowMs) hits.set(ip, { start: t, count: 1 })
    else if (++h.count > limit) {
      c.header('Retry-After', String(Math.ceil((h.start + windowMs - t) / 1000)))
      return c.json({ error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요' }, 429)
    }
    await next()
  }
}

/** Vercel 은 실제 접속 주소를 x-forwarded-for 첫 칸 · x-real-ip 로 넘긴다. 로컬은 한 사람으로 본다 */
function clientIp(c) {
  const fwd = c.req.header('x-forwarded-for')
  return (fwd ? fwd.split(',')[0] : c.req.header('x-real-ip'))?.trim() || 'local'
}
