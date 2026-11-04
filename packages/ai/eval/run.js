// 평가 세트 실행 (PER-001): cases/*.json 을 runPipeline 으로 돌려 정확도를 출력하고 results/ 에 저장한다.
//   npm run eval                 재시도 켬
//   npm run eval -- --no-retry   재시도 끔 (켬/끔 비교, PER-001)
// 모델은 .env 의 AI_MODEL. 실제 Claude 를 부르므로 ANTHROPIC_API_KEY 가 있어야 한다 (케이스마다 2~3회 호출).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { runPipeline, MODEL } from '../src/index.js'
import { scoreCase, summarize } from './score.js'

const dir = new URL('./cases/', import.meta.url)
const retry = !process.argv.includes('--no-retry')
const cases = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()

if (cases.length === 0) {
  console.log('평가 케이스가 아직 없어요. eval/cases/README.md 참고')
  process.exit(0)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.log(`케이스 ${cases.length}개가 있지만 ANTHROPIC_API_KEY 가 없어 실행하지 않아요 (.env 확인)`)
  process.exit(1)
}

const MEDIA = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const rows = []
for (const file of cases) {
  const c = JSON.parse(await readFile(new URL(file, dir), 'utf8'))
  const ext = c.image.split('.').pop().toLowerCase()
  const image = (await readFile(new URL(c.image, dir))).toString('base64')
  const memberIds = c.members.map((m) => m.id)
  const t0 = performance.now()
  try {
    const got = await runPipeline({ image, mediaType: MEDIA[ext], utterance: c.utterance, members: c.members, me: c.me, retry })
    const row = { file, ms: performance.now() - t0, ...scoreCase(c.expected, got, memberIds) }
    rows.push(row)
    console.log(`${file}  줄 ${row.lineHits}/${row.lineTotal}  합계 ${row.totalOk ? 'O' : 'X'}  배정 ${row.splitHits}/${row.splitTotal}  ${(row.ms / 1000).toFixed(1)}s`)
  } catch (e) {
    // 호출 실패도 결과에 남긴다 (틀린 것으로 셈)
    console.log(`${file}  실패: ${e.message}`)
    rows.push({
      file, ms: performance.now() - t0, error: e.message,
      lineHits: 0, lineTotal: c.expected.lines.length, totalOk: false,
      splitHits: 0, splitTotal: c.expected.lines.filter((l) => l.kind !== 'tax').length, correct: false, flagged: true,
    })
  }
}

const summary = { model: MODEL, retry, date: new Date().toISOString().slice(0, 10), ...summarize(rows) }
console.log('\n결과', summary)

const out = new URL('./results/', import.meta.url)
await mkdir(out, { recursive: true })
const name = `${summary.date}_${MODEL}_${retry ? 'retry' : 'no-retry'}.json`
await writeFile(new URL(name, out), JSON.stringify({ summary, rows }, null, 2))
console.log(`저장: eval/results/${name}`)
