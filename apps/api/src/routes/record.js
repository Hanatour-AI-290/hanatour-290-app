// POST /api/record  { text?, image?(data URL), kind?, members[], me } → 지출 항목 하나   (R-15·16·18)
import { Hono } from 'hono'
import { readRecord } from '@h290/ai'

const r = new Hono()

r.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = String(body?.text ?? '').trim()
  const imageUrl = String(body?.image ?? '')
  const members = Array.isArray(body?.members) ? body.members.map(String).slice(0, 12) : []
  const me = String(body?.me ?? members[0] ?? '나')
  if (!text && !imageUrl) return c.json({ error: '사진이나 말할 내용이 없어요' }, 400)
  if (text.length > 500) return c.json({ error: '한 줄로 짧게 말해 주세요' }, 400)

  let image
  if (imageUrl) {
    const m = imageUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
    if (!m) return c.json({ error: '사진 형식을 읽지 못했어요' }, 400)
    if (m[2].length > 4_000_000) return c.json({ error: '사진이 너무 커요' }, 413)
    image = { mediaType: m[1], data: m[2] }
  }

  const out = await readRecord({ text, image, kind: body?.kind, members, me })
  if (!out.ok && out.reason === 'refusal') return c.json({ error: '이 내용은 기록할 수 없어요' }, 422)
  if (!out.ok) return c.json({ error: '기록을 읽지 못했어요' }, 502)
  return c.json(out.data)
})

export default r
