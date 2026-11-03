// 라우트 조립. 서버 실행(server.js)과 분리해 테스트·Vercel 배포에서도 그대로 쓴다.
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import trips from './routes/trips.js'
import records from './routes/records.js'
import receipts from './routes/receipts.js'
import settle from './routes/settle.js'

export const app = new Hono().basePath('/api')

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.get('/health', (c) => c.json({ ok: true }))

app.route('/trips', trips)
app.route('/trips/:tripId/records', records)
app.route('/trips/:tripId/receipts', receipts)
app.route('/trips/:tripId/settle', settle)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message }, 500)
})
