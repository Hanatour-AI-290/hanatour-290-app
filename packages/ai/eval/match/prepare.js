// 시험 세트(test/*.json) 준비: 앱과 같은 코드로 Claude 가 만든 값을 채워 저장한다. 이미 채운 칸은 다시 부르지 않는다.
//   items 가 비어 있으면  product(상품 문구) → estimate() → items (이름 · 분류 · 금액 · 통화 · 별칭)
//   cases 마다 names 가 없으면  기록 원문 → readRecord() → Claude 가 만든 이름
//   npm run eval:match:prepare            test/ 의 모든 세트
//   npm run eval:match:prepare -- danang  한 세트만
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { estimate } from '../../src/estimate.js'
import { readRecord } from '../../src/record.js'
import { MODEL } from '../../src/client.js'

const dir = new URL('./test/', import.meta.url)
const only = process.argv[2]
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && (!only || f === `${only}.json`))
const members = ['지우', '하린', '도윤', '서준']

for (const f of files) {
  const url = new URL(f, dir)
  const set = JSON.parse(readFileSync(url, 'utf8'))
  if (!set.items) {
    const out = await estimate(set.product)
    if (!out.ok) throw new Error(`${f}: 상품 분석 실패 (${out.reason})`)
    set.items = out.data.items.map((it, idx) => ({ idx, name: it.name, category: it.category, amount: it.amount, currency: it.currency, aliases: it.aliases ?? [] }))
    set.itemsBy = { model: MODEL, date: new Date().toISOString().slice(0, 10) }
    console.log(`${f} 예정 항목`)
    for (const it of set.items) console.log(`  ${it.idx}. ${it.name} · ${it.amount ?? '?'} ${it.currency} · ${it.aliases.join(', ')}`)
  }
  set.names ??= {}
  let n = 0
  for (const c of set.cases) {
    if (set.names[c.id]) continue
    const out = await readRecord({ text: c.text, kind: c.kind === 'sms' ? 'sms' : undefined, members, me: '지우' })
    set.names[c.id] = out.ok ? out.data.name : null
    console.log(`  ${c.id} → ${set.names[c.id]}`)
    n++
  }
  if (n) set.namesBy = { model: MODEL, date: new Date().toISOString().slice(0, 10) }
  writeFileSync(url, JSON.stringify(set, null, 2) + '\n')
}
