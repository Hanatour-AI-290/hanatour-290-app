// 찍고 → 말하고 → 확인 (R-07~R-10). 검사 실패 시 AI 1회 재시도, 그래도 틀리면 사용자에게 질문 (R-09).
import { minorDigits } from '@h290/shared'
import { readReceipt } from './readReceipt.js'
import { assignLines } from './assign.js'
import { validate } from './validate.js'

/** 최소 단위 금액을 사람이 읽는 금액으로 (356000 TRY → "3,560 TRY") */
const fmt = (v, cur) => `${(v / 10 ** minorDigits(cur)).toLocaleString('en-US')} ${cur}`

/**
 * 검사에서 걸린 점을 AI 재시도 힌트와 사용자 질문으로 바꾼다. 금액은 최소 단위가 아니라 영수증에 찍힌 단위로.
 * @param {{ lines: { total: number }[], total: number, currency: string }} receipt
 * @param {string[]} errors validate() 의 errors
 * @returns {{ hints: string[], questions: { field: string, text: string }[] }}
 */
export function explain(receipt, errors) {
  const sum = receipt.lines.reduce((a, l) => a + l.total, 0)
  const hints = []
  const questions = []
  for (const e of errors) {
    if (e.startsWith('줄 합계')) {
      hints.push(`읽은 줄 금액의 합 ${fmt(sum, receipt.currency)} 이 영수증 합계 ${fmt(receipt.total, receipt.currency)} 와 다르다. 빠진 줄이나 잘못 읽은 금액이 있는지 다시 봐 줘`)
      questions.push({ field: 'total', text: `읽은 줄 합계 ${fmt(sum, receipt.currency)} 가 영수증 합계 ${fmt(receipt.total, receipt.currency)} 와 달라요. 빠지거나 잘못 읽은 줄이 있는지 확인해 주세요` })
    } else {
      hints.push(e)
      questions.push({ field: 'lines', text: `검사에서 걸렸어요: ${e}` })
    }
  }
  return { hints, questions }
}

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
    receipt = await readReceipt({ image, mediaType, hint: explain(receipt, check.errors).hints })
    check = validate(receipt)
    retried = true
  }

  const { payerId, splits, questions } = await assignLines({ lines: receipt.lines, members, utterance, me })
  check = validate({ ...receipt, splits, memberIds: members.map((m) => m.id) })

  // 그래도 남은 오류는 사용자에게 묻는다 (추측해서 고치지 않음)
  questions.push(...explain(receipt, check.errors).questions)

  return { receipt, payerId, splits, questions, check, retried }
}
