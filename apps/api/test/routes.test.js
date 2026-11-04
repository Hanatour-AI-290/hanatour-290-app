import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

const post = (path, body) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('estimate: 문구가 짧으면 400 (AI 안 부름)', async () => {
  const res = await post('/api/estimate', { text: '짧음' })
  assert.equal(res.status, 400)
})

test('record: 사진도 말도 없으면 400', async () => {
  const res = await post('/api/record', { members: ['지우'] })
  assert.equal(res.status, 400)
})

test('record: 사진 형식이 틀리면 400', async () => {
  const res = await post('/api/record', { image: 'not-a-data-url', members: ['지우'] })
  assert.equal(res.status, 400)
})
