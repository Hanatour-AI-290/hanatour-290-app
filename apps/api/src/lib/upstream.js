// 로컬에 ANTHROPIC_API_KEY 가 없을 때, AI 요청을 AI_UPSTREAM(배포본 API)으로 넘긴다.
// 배포본은 Vercel 환경변수의 키로 Claude 를 부른다 → 로컬에 키를 두지 않고도 AI 기능을 시연할 수 있다.
// 배포본에 있는 API(프로토타입의 /estimate · /record)만 넘길 수 있다. 키가 있으면 넘기지 않고 직접 부른다.

/**
 * @param {string} path 배포본 경로 (예: '/record')
 * @returns {import('hono').MiddlewareHandler}
 */
export function upstream(path) {
  return async (c, next) => {
    const base = process.env.AI_UPSTREAM
    if (process.env.ANTHROPIC_API_KEY || !base) return next()
    // 배포본 자신에게 넘기면 끝없이 돌기 때문에 막는다 (Vercel 에 AI_UPSTREAM 을 잘못 넣은 경우)
    if (new URL(base).host === new URL(c.req.url).host) return c.json({ error: 'AI 키가 설정되지 않았어요' }, 503)
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: await c.req.text(),
        signal: AbortSignal.timeout(60_000),
      })
      return c.body(await res.text(), res.status, { 'Content-Type': res.headers.get('content-type') ?? 'application/json' })
    } catch {
      return c.json({ error: 'AI 서버(배포본)에 연결하지 못했어요' }, 502)
    }
  }
}
