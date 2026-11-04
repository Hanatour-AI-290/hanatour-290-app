// 문장 측정 실행 (PER-001 "문장 20개"): sentences.json 의 말·카드 문자를 readRecord 로 돌려 정확도를 출력하고 results/ 에 저장한다.
//   npm run eval:sentences
// 모델은 .env 의 AI_MODEL. 실제 Claude 를 부르므로 ANTHROPIC_API_KEY 가 있어야 한다 (문장마다 1회 호출).
// 말·문자 기록에는 재시도(FR-009)가 없어서 켬/끔 비교는 영수증 측정(npm run eval)에서만 한다.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readRecord, MODEL } from '../src/index.js'
import { scoreSentence, summarizeSentences } from './score.js'

const set = JSON.parse(await readFile(new URL('./sentences.json', import.meta.url), 'utf8'))

if (!process.env.ANTHROPIC_API_KEY) {
  console.log(`문장 ${set.cases.length}개가 있지만 ANTHROPIC_API_KEY 가 없어 실행하지 않아요 (.env 확인)`)
  process.exit(1)
}

const rows = []
for (const c of set.cases) {
  const t0 = performance.now()
  let row
  try {
    const out = await readRecord({ text: c.text, kind: c.kind, members: set.members, me: c.me })
    // 거절·해석 실패는 화면이 직접 입력으로 넘기므로 "비워 둠"과 같게 본다
    const got = out.ok ? out.data : { amount: null, currency: 'OTHER', payer: null, payers: [], people: [], category: null }
    row = { id: c.id, ms: performance.now() - t0, ...scoreSentence(c.expected, got, c.me), got }
  } catch (e) {
    // 호출 실패도 결과에 남긴다 (틀린 것으로 셈)
    row = { id: c.id, ms: performance.now() - t0, error: e.message, amountOk: false, payerOk: false, peopleOk: false, categoryOk: false, correct: false, flagged: true }
  }
  rows.push(row)
  const o = (k) => (row[k] ? 'O' : 'X')
  console.log(`${c.id}  금액 ${o('amountOk')}  결제자 ${o('payerOk')}  사람 ${o('peopleOk')}  분류 ${o('categoryOk')}  ${(row.ms / 1000).toFixed(1)}s${row.error ? `  실패: ${row.error}` : ''}`)
}

const summary = { model: MODEL, date: new Date().toISOString().slice(0, 10), ...summarizeSentences(rows) }
console.log('\n결과', summary)

const out = new URL('./results/', import.meta.url)
await mkdir(out, { recursive: true })
const name = `${summary.date}_${MODEL}_sentences.json`
await writeFile(new URL(name, out), JSON.stringify({ summary, rows }, null, 2))
console.log(`저장: eval/results/${name}`)
