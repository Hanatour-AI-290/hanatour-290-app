import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

const post = (path, body) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const members = [
  { id: 'm1', name: '지우' }, { id: 'm2', name: '하린' }, { id: 'm3', name: '도윤' }, { id: 'm4', name: '서준' },
]
const dinner = {
  id: 'e1', tripId: 't1', createdAt: '2026-11-05T20:00:00+03:00',
  payers: [{ memberId: 'm1', amount: 60000, method: 'card' }],
  total: { amount: 60000, currency: 'TRY' },
  confirmations: [{ memberId: 'm4', status: 'declined' }],
}

test('settle: 통화별 차액과 보낼 돈', async () => {
  const res = await post('/api/settle', { members, expenses: [dinner] })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.deepEqual(j.byCurrency.TRY.net, { m1: 40000, m2: -20000, m3: -20000, m4: 0 })
  assert.equal(j.byCurrency.TRY.transfers.length, 2)
  assert.deepEqual(j.missingFx, ['e1'])
})

test('settle: 형식이 틀리면 400', async () => {
  const res = await post('/api/settle', { members, expenses: [{ ...dinner, total: { amount: 12.5, currency: 'TRY' } }] })
  assert.equal(res.status, 400)
})

test('settle: 결제자 합이 총액과 다르면 422 + 틀린 점', async () => {
  const res = await post('/api/settle', { members, expenses: [{ ...dinner, payers: [{ memberId: 'm1', amount: 100, method: 'card' }] }] })
  assert.equal(res.status, 422)
  assert.equal((await res.json()).errors.length, 1)
})

test('settle/wallets: 확인이 끝난 지출을 지갑에 반영', async () => {
  const wallets = members.map((m) => ({ memberId: m.id, balances: [{ amount: 100000, currency: 'TRY', method: 'card' }] }))
  const res = await post('/api/settle/wallets', { members, wallets, expense: dinner })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.applied, true)
  const card = (id) => j.wallets.find((w) => w.memberId === id).balances.find((b) => b.method === 'card').amount
  assert.equal(card('m1'), 100000 - 60000 + 40000)
  assert.equal(card('m2'), 80000)
  assert.equal(card('m4'), 100000)
})

test('fx: 통화 코드가 없으면 400 (외부 호출 안 함)', async () => {
  assert.equal((await app.request('/api/fx')).status, 400)
  assert.equal((await app.request('/api/fx?currency=TRY&date=11/05')).status, 400)
})
