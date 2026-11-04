// POST /api/estimate  { text } → { title, base_price_krw, items[], fx }   (R-01)
import { Hono } from 'hono'
import { upstream } from '../lib/upstream.js'
import { estimate } from '@h290/ai'
import { rates } from '../lib/fx.js'

const r = new Hono()

// 로컬에 키가 없으면 배포본으로 넘김 (lib/upstream.js)
r.post('/', upstream('/estimate'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = String(body?.text ?? '').trim()
  if (text.length < 10) return c.json({ error: '상품 문구를 조금 더 붙여 넣어 주세요' }, 400)
  if (text.length > 8000) return c.json({ error: '문구가 너무 깁니다 (8,000자 이하)' }, 400)

  const [out, fx] = await Promise.all([estimate(text), rates()])
  if (!out.ok && out.reason === 'refusal') return c.json({ error: '이 문구는 분석할 수 없습니다' }, 422)
  if (!out.ok) return c.json({ error: '분석 결과를 읽지 못했습니다' }, 502)
  return c.json({ ...out.data, fx })
})

export default r
