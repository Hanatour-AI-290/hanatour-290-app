// JSON 요청 본문을 zod 스키마로 검사한다. 틀리면 400 + 어느 칸이 틀렸는지(issues).
/**
 * @template T
 * @param {import('hono').Context} c
 * @param {import('zod').ZodType<T>} schema
 * @returns {Promise<{ data: T, error?: undefined } | { data?: undefined, error: Response }>}
 */
export async function parseBody(c, schema) {
  const body = await c.req.json().catch(() => null)
  const out = schema.safeParse(body)
  if (!out.success) {
    const issues = out.error.issues.map((i) => `${i.path.join('.') || '(본문)'}: ${i.message}`)
    return { error: c.json({ error: '보낸 데이터 형식이 맞지 않아요', issues }, 400) }
  }
  return { data: out.data }
}
