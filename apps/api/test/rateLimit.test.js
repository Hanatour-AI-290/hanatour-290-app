import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { rateLimit } from '../src/lib/rateLimit.js'
import { app } from '../src/app.js'

const mini = (opts) => {
  const h = new Hono()
  h.use('*', rateLimit(opts))
  h.get('/', (c) => c.text('ok'))
  return h
}
const get = (h, ip) => h.request('/', { headers: ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {} })

test('한도를 넘으면 429 와 Retry-After', async () => {
  let t = 0
  const h = mini({ limit: 2, windowMs: 60_000, now: () => t })
  assert.equal((await get(h, '1.1.1.1')).status, 200)
  assert.equal((await get(h, '1.1.1.1')).status, 200)
  const r = await get(h, '1.1.1.1')
  assert.equal(r.status, 429)
  assert.equal(r.headers.get('retry-after'), '60')
  t = 30_000
  assert.equal((await get(h, '1.1.1.1')).headers.get('retry-after'), '30')
})

test('접속 기기(IP)마다 따로 세고, 창이 지나면 다시 허용', async () => {
  let t = 0
  const h = mini({ limit: 1, windowMs: 60_000, now: () => t })
  assert.equal((await get(h, '1.1.1.1')).status, 200)
  assert.equal((await get(h, '2.2.2.2')).status, 200)
  assert.equal((await get(h, '1.1.1.1')).status, 429)
  t = 60_000
  assert.equal((await get(h, '1.1.1.1')).status, 200)
})

test('앱: AI API 는 분당 30회에서 막힌다 (Claude 를 부르기 전 400 으로 끝나는 요청으로 셈)', async () => {
  const ip = { 'x-forwarded-for': '9.9.9.9', 'Content-Type': 'application/json' }
  const codes = []
  for (let i = 0; i < 31; i++) codes.push((await app.request('/api/record', { method: 'POST', headers: ip, body: '{}' })).status)
  assert.deepEqual([...new Set(codes.slice(0, 30))], [400])
  assert.equal(codes[30], 429)
  // 다른 API 는 아직 쓸 수 있다
  assert.equal((await app.request('/api/health', { headers: ip })).status, 200)
})
