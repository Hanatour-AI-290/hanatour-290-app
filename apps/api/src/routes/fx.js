// GET /api/fx?currency=TRY&date=2026-11-05 → { currency, rate, date, source, attribution? }   (R-20 결제일 환율)
import { Hono } from 'hono'
import { rateOn } from '../lib/fx.js'

const r = new Hono()

r.get('/', async (c) => {
  const currency = String(c.req.query('currency') ?? '').toUpperCase()
  const date = c.req.query('date')
  if (!/^[A-Z]{3}$/.test(currency)) return c.json({ error: '통화 코드가 필요해요 (예: TRY)' }, 400)
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: '날짜는 YYYY-MM-DD 로 보내 주세요' }, 400)
  const fx = await rateOn(currency, date)
  if (!fx) return c.json({ error: `${currency} 환율을 찾지 못했어요` }, 404)
  return c.json({ currency, ...fx })
})

export default r
