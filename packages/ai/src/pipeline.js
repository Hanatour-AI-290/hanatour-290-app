// 찍고 → 말하고 → 확인 (R-07~R-10). 검사 실패 시 AI 1회 재시도, 그래도 틀리면 사용자에게 질문 (R-09).
import { readReceipt } from './readReceipt.js'
import { assignLines } from './assign.js'
import { validate } from './validate.js'

/**
 * @param {{ image: string, mediaType: string, utterance: string, members: { id: string, name: string }[], me?: string, retry?: boolean }} input
 *   me = 영수증을 올린 사람 이름, retry = false 면 재시도하지 않는다 (정확도 측정에서 켬/끔 비교용, PER-001)
 */
export async function runPipeline({ image, mediaType, utterance, members, me, retry = true }) {
  let receipt = await readReceipt({ image, mediaType })
  let check = validate(receipt)
  let retried = false
  if (!check.ok && retry) {
    // 틀린 점을 알려 주고 한 번만 다시 읽힌다
    receipt = await readReceipt({ image, mediaType, hint: check.errors })
    check = validate(receipt)
    retried = true
  }

  const { payerId, splits, questions } = await assignLines({ lines: receipt.lines, members, utterance, me })
  check = validate({ ...receipt, splits, memberIds: members.map((m) => m.id) })

  // 그래도 남은 오류는 사용자에게 묻는다 (추측해서 고치지 않음)
  for (const e of check.errors) questions.push({ field: 'total', text: `${e}. 영수증을 보고 금액을 확인해 주세요` })

  return { receipt, payerId, splits, questions, check, retried }
}
