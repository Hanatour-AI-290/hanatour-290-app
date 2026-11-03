// 찍고 → 말하고 → 확인. 검증 실패 시 AI 1회 재시도, 그래도 틀리면 사용자에게 질문.
import { readReceipt } from './readReceipt.js'
import { assignLines } from './assign.js'
import { validate } from './validate.js'

/**
 * @param {{ image: string, mediaType: string, utterance: string, members: { id: string, name: string }[] }} input
 */
export async function runPipeline(input) {
  // TODO(AI): 재시도 시 errors 를 프롬프트에 넣어 다시 읽기
  const receipt = await readReceipt(input)
  const { splits, questions } = await assignLines({ ...receipt, members: input.members, utterance: input.utterance })
  const check = validate({ ...receipt, splits, memberIds: input.members.map((m) => m.id) })
  return { receipt, splits, questions, check }
}
