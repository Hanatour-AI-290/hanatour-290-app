// Vercel 서버리스 함수: /api/* 전부를 apps/api 의 Hono 앱으로 넘긴다 (로컬 server.js 와 같은 앱)
import { handle } from '@hono/node-server/vercel'
import { app } from '../apps/api/src/app.js'

export const config = { api: { bodyParser: false } }

export default handle(app)
