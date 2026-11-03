import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

test('GET /api/health → ok', async () => {
  const res = await app.request('/api/health')
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})
