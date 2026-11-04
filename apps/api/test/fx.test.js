import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { rateOn } from '../src/lib/fx.js'

// 실제 환율 서버를 부르지 않도록 fetch 를 바꿔 끼운다
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const json = (body) => ({ ok: true, json: async () => body })
const erApi = json({ result: 'success', rates: { KRW: 1500 }, time_last_update_unix: Date.UTC(2026, 10, 4) / 1000 })

test('Frankfurter 가 시간 초과로 죽어도 예비(ExchangeRate-API)로 넘어간다', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('frankfurter')) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    return erApi
  }
  const fx = await rateOn('EUR', '2026-10-01')
  assert.equal(fx.source, 'ExchangeRate-API')
  assert.equal(fx.rate, 1500)
  assert.equal(fx.date, '2026-11-04') // 결제일이 아니라 최신 값이라는 걸 화면에 그대로 보여 준다
  assert.ok(calls.some((u) => u.includes('er-api')))
})

test('예비로 채운 값은 저장하지 않아서, 복구되면 결제일 환율을 다시 받는다', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).includes('frankfurter')) throw new Error('down')
    return erApi
  }
  assert.equal((await rateOn('TRY', '2026-10-02')).source, 'ExchangeRate-API')
  globalThis.fetch = async () => json([{ date: '2026-10-02', base: 'TRY', quote: 'KRW', rate: 40 }])
  const fx = await rateOn('TRY', '2026-10-02')
  assert.deepEqual(fx, { rate: 40, date: '2026-10-02', source: 'Frankfurter' })
})

test('모든 출처가 실패하면 null (화면은 외화 그대로)', async () => {
  globalThis.fetch = async () => { throw new Error('offline') }
  assert.equal(await rateOn('USD', '2026-10-03'), null)
})
