// Vercel 서버리스 함수: /api/* 전부를 apps/api 의 Hono 앱으로 넘긴다 (로컬 server.js 와 같은 앱). vercel.json 의 rewrites 가 /api/a/b 같은 여러 단계 경로도 여기로 보낸다
import { handle } from 'hono/vercel'
import { app } from '../apps/api/src/app.js'

const h = handle(app)
export const GET = h
export const POST = h
export const PUT = h
export const PATCH = h
export const DELETE = h
export const OPTIONS = h
