// 라우트 조립. 로컬(server.js)과 Vercel(api/[[...route]].js) 이 같은 앱을 쓴다.
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Anthropic } from '@h290/ai'
import { requestLog } from './lib/log.js'
import estimate from './routes/estimate.js'
import record from './routes/record.js'
import trips from './routes/trips.js'
import records from './routes/records.js'
import receipts from './routes/receipts.js'
import settle from './routes/settle.js'

export const app = new Hono().basePath('/api')

app.use('*', requestLog())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.get('/health', (c) => c.json({ ok: true }))

// 프로토타입에서 옮긴 것 (화면이 바로 씀)
app.route('/estimate', estimate)
app.route('/record', record)

// 뼈대 (TODO)
app.route('/trips', trips)
app.route('/trips/:tripId/records', records)
app.route('/trips/:tripId/receipts', receipts)
app.route('/trips/:tripId/settle', settle)

app.onError((e, c) => {
  console.error(e)
  if (e instanceof Anthropic.RateLimitError) return c.json({ error: '요청이 많습니다. 잠시 후 다시 시도해 주세요' }, 429)
  if (e instanceof Anthropic.APIError) return c.json({ error: `AI 호출 실패 (${e.status})` }, 502)
  return c.json({ error: '서버 오류' }, 500)
})
