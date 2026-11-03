// 평가 세트 실행: cases/*.json 을 돌려 정확도를 출력한다.
import { readdir } from 'node:fs/promises'

const dir = new URL('./cases/', import.meta.url)
const cases = (await readdir(dir)).filter((f) => f.endsWith('.json'))

if (cases.length === 0) {
  console.log('평가 케이스가 아직 없어요. eval/cases/README.md 참고')
  process.exit(0)
}

// TODO(AI): 케이스마다 runPipeline 실행 → expected 와 비교 → 정확도 집계, results/ 에 저장
console.log(`케이스 ${cases.length}개 - 채점 로직은 아직 구현 안 됨`)
