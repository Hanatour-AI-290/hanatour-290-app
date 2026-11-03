// 요청 로그: → POST /api/record   ← 200 1.82s  {name, amount, ...}
// LOG_LEVEL=debug 면 응답 JSON 전체를 찍는다. 요청 본문(사진·문구)은 찍지 않는다.
const MAX = 240

export function requestLog() {
  return async (c, next) => {
    const t0 = performance.now()
    const path = new URL(c.req.url).pathname
    console.log(`→ ${c.req.method} ${path}`)
    await next()
    const sec = ((performance.now() - t0) / 1000).toFixed(2)
    let body = ''
    if (c.res.headers.get('content-type')?.includes('application/json')) {
      try {
        const json = await c.res.clone().json()
        body = JSON.stringify(json)
        if (process.env.LOG_LEVEL !== 'debug' && body.length > MAX) body = body.slice(0, MAX) + '…'
      } catch { /* 본문 없음 */ }
    }
    console.log(`← ${c.res.status} ${sec}s ${path} ${body}`)
  }
}
