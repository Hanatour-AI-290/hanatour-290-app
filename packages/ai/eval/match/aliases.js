// 앱과 같은 흐름 재현: 시연 상품 문구(apps/web/src/sample.js SAMPLE)를 실제 estimate() 로 분석해 예정 항목별 별칭(aliases)을 저장한다.
// Claude API 를 한 번 부른다.  npm run eval:match:aliases → eval/match/aliases.json (run.js 가 읽는다)
import { writeFileSync } from 'node:fs'
import { estimate } from '../../src/estimate.js'
import { MODEL } from '../../src/client.js'
import { SAMPLE } from '../../../../apps/web/src/sample.js'

const out = await estimate(SAMPLE)
if (!out.ok) throw new Error(`상품 분석 실패: ${out.reason}`)
const byName = Object.fromEntries(out.data.items.map((it) => [it.name, it.aliases ?? []]))
for (const [name, a] of Object.entries(byName)) console.log(name, '→', a.join(', '))

writeFileSync(new URL('aliases.json', import.meta.url), JSON.stringify({ model: MODEL, date: new Date().toISOString().slice(0, 10), byName }, null, 2) + '\n')
console.log('저장: eval/match/aliases.json')
