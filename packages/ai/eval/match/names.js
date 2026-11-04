// 앱과 같은 흐름을 재현: 카드 문자 · 말을 Claude(readRecord) 가 먼저 읽어 만든 항목 이름(name)을 저장한다.
// 앱에서 임베딩 모델에 들어가는 건 이 이름이다 (App.jsx addFrom → addRecord). Claude API 를 케이스 수만큼 부른다.
//   npm run eval:match:names   → eval/match/names.json (run.js --input claude 가 읽는다)
import { readFileSync, writeFileSync } from 'node:fs'
import { readRecord } from '../../src/record.js'
import { MODEL } from '../../src/client.js'

const here = new URL('.', import.meta.url)
const [setFile = 'cases.json', outFile = 'names.json'] = process.argv.slice(2) // 확인용 세트: holdout.json holdout-names.json
const { cases } = JSON.parse(readFileSync(new URL(setFile, here), 'utf8'))
const members = ['지우', '하린', '도윤', '서준']

const names = {}
for (const c of cases) {
  const out = await readRecord({ text: c.text, kind: c.kind === 'sms' ? 'sms' : undefined, members, me: '지우' })
  names[c.id] = out.ok ? { name: out.data.name, category: out.data.category } : { name: null, error: out.reason }
  console.log(c.id, '→', names[c.id].name)
}

writeFileSync(new URL(outFile, here), JSON.stringify({ model: MODEL, date: new Date().toISOString().slice(0, 10), names }, null, 2) + '\n')
console.log(`저장: eval/match/${outFile}`)
