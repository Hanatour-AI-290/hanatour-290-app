import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.js'

const post = (path, body) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const members = [{ id: 'm1', name: '지우' }, { id: 'm2', name: '하린' }]
const estimate = {
  title: '튀르키예', base_price_krw: 1240000,
  items: [
    { name: '가이드 경비', category: '가이드·기사 경비', amount: 100000, currency: 'KRW', required: true },
    { name: '열기구', category: '선택관광', amount: 320, currency: 'EUR', required: false },
  ],
  fx: { date: '2026-10-30', krw: { EUR: 1500 } },
}
const dinner = {
  id: 'e1', tripId: 't1', category: '식사', paidAt: '2026-11-05T20:00:00+03:00', createdAt: '2026-11-05T20:05:00+03:00',
  payers: [{ memberId: 'm1', amount: 60000, method: 'card' }], total: { amount: 60000, currency: 'TRY' },
  fx: { rate: 40, date: '2026-11-05', source: 'Frankfurter' },
}

test('budget: 하루 예산', async () => {
  const res = await post('/api/budget', { estimate, picks: [1], days: 9, livingPerDayKrw: 50000 })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.extraKrw, 580000)
  assert.equal(j.livingIsExample, true)
})

test('budget: 일수가 없으면 400 + 틀린 칸', async () => {
  const res = await post('/api/budget', { estimate, livingPerDayKrw: 50000 })
  assert.equal(res.status, 400)
  assert.match((await res.json()).issues[0], /^days/)
})

test('report: 예상 vs 실제', async () => {
  const res = await post('/api/report', { estimate, picks: [1], members, memberId: 'm1', expenses: [dinner] })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.actualTotal, 1240000 + 300 * 40)
  assert.deepEqual(j.unrecordedItems, [0, 1])
})

test('report: planItem 이 범위 밖이면 422', async () => {
  const res = await post('/api/report', { estimate, members, memberId: 'm1', expenses: [{ ...dinner, planItem: 9 }] })
  assert.equal(res.status, 422)
})

test('settle/day: 하루 끝 요약', async () => {
  const wallets = [{ memberId: 'm1', balances: [{ amount: 100000, currency: 'TRY', method: 'card' }] }]
  const res = await post('/api/settle/day', { members, memberId: 'm1', expenses: [dinner], wallets, date: '2026-11-05', day: 1, days: 3 })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.equal(j.todayKrw, 300 * 40)
  assert.deepEqual(j.byCurrency[0], { currency: 'TRY', balance: 100000, spent: 30000, perDay: 30000, need: 60000, shortfall: 0 })
})

test('settle/duplicates: 비슷한 결제 후보', async () => {
  const again = { ...dinner, id: 'e2', paidAt: '2026-11-05T20:10:00+03:00' }
  const res = await post('/api/settle/duplicates', { expense: again, expenses: [dinner] })
  assert.deepEqual((await res.json()).duplicates, [{ id: 'e1', amountDiff: 0, minutesApart: 10, sameMerchant: null }])
})

test('receipts/analyze: 입력이 틀리면 AI 를 부르기 전에 400', async () => {
  const url = '/api/trips/t1/receipts/analyze'
  const send = (form) => app.request(url, { method: 'POST', body: form })

  const noImage = new FormData()
  noImage.set('members', JSON.stringify(members))
  assert.equal((await send(noImage)).status, 400)

  const pdf = new FormData()
  pdf.set('image', new File([new Uint8Array([1])], 'r.pdf', { type: 'application/pdf' }))
  pdf.set('members', JSON.stringify(members))
  assert.equal((await send(pdf)).status, 400)

  const noMembers = new FormData()
  noMembers.set('image', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'r.jpg', { type: 'image/jpeg' }))
  assert.equal((await send(noMembers)).status, 400)
})
