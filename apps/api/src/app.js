// 라우트 조립. 로컬(server.js)과 Vercel(api/[[...route]].js) 이 같은 앱을 쓴다.
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Anthropic } from '@h290/ai'
import { requestLog } from './lib/log.js'
import estimate from './routes/estimate.js'
import record from './routes/record.js'
import fx from './routes/fx.js'
import trips from './routes/trips.js'
import records from './routes/records.js'
import receipts from './routes/receipts.js'
import settle from './routes/settle.js'
import budget from './routes/budget.js'
import match from './routes/match.js'

export const app = new Hono().basePath('/api')

app.use('*', requestLog())
app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.get('/health', (c) => c.json({ ok: true }))

// 프로토타입에서 옮긴 것 (화면이 바로 씀)
app.route('/estimate', estimate)
app.route('/record', record)

// 정산 계산 (저장 없이 보낸 데이터로 계산)
app.route('/fx', fx)
app.route('/settle', settle)
app.route('/', budget) // POST /budget, POST /report

// 기록 ↔ 예정 항목 연결 후보 (ML 임베딩 모델, Claude 안 부름)
app.route('/match', match)

// 영수증 분석 (AI 담당 runPipeline 을 부른다)
app.route('/trips/:tripId/receipts', receipts)

// 뼈대 (TODO)
app.route('/trips', trips)
app.route('/trips/:tripId/records', records)

app.onError((e, c) => {
  console.error(e)
  if (e instanceof Anthropic.RateLimitError) return c.json({ error: '요청이 많습니다. 잠시 후 다시 시도해 주세요' }, 429)
  // 작업공간 사용 한도 초과 (2026-11-04 해커톤 키에서 실제로 발생) → 화면은 직접 입력으로 넘긴다
  // .env 에 ANTHROPIC_API_KEY 가 없을 때 (packages/ai/src/client.js) → 화면은 직접 입력으로 넘긴다
  if (/ANTHROPIC_API_KEY/.test(e.message)) return c.json({ error: 'AI 키가 설정되지 않았어요' }, 503)
  if (e instanceof Anthropic.APIError && /usage limits/i.test(e.message)) return c.json({ error: 'AI 사용 한도를 넘었어요' }, 503)
  if (e instanceof Anthropic.APIError) return c.json({ error: `AI 호출 실패 (${e.status})` }, 502)
  return c.json({ error: '서버 오류' }, 500)
})
