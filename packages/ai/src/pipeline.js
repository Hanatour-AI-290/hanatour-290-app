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
    } else if (e.startsWith('결제자가 낸 금액 합')) {
      const paid = Number(e.match(/합 (-?\d+)/)[1])
      hints.push(`결제자들이 낸 금액의 합 ${fmt(paid, receipt.currency)} 이 영수증 합계 ${fmt(receipt.total, receipt.currency)} 와 다르다. 말에서 누가 얼마 냈는지 다시 봐 줘`)
      questions.push({ field: 'payers', text: `결제자들이 낸 금액 합 ${fmt(paid, receipt.currency)} 가 영수증 합계 ${fmt(receipt.total, receipt.currency)} 와 달라요. 누가 얼마 냈는지 확인해 주세요` })
    } else if (e.startsWith('결제자가 각각')) {
      hints.push('결제자가 여러 명인데 각자 낸 금액을 모른다. 말에 금액이 있으면 다시 읽어 줘')
      questions.push({ field: 'payers', text: '결제자가 각각 얼마 냈는지 알려 주세요' })
    } else {
      hints.push(e)
      questions.push({ field: 'lines', text: `검사에서 걸렸어요: ${e}` })
    }
  }
  return { hints, questions }
}

/** 사진에서 영수증 줄을 하나도 못 읽었을 때 (영수증이 아닌 사진, 너무 흐린 사진). 라우트가 422 로 바꾸고 화면은 직접 입력으로 넘긴다 (AVL-003) */
export class UnreadableReceipt extends Error {
  constructor() {
    super('영수증을 읽지 못했어요')
    this.name = 'UnreadableReceipt'
  }
}

/** 읽은 게 영수증이라고 볼 수 있는지: 메뉴 줄이 하나 이상, 합계가 0보다 큼. 아니면 AI 가 채운 통화·합계는 지어낸 값이라 쓰지 않는다 (R-25) */
export const isReadable = (receipt) => receipt.total > 0 && receipt.lines.some((l) => l.kind !== 'tax')

/**
 * @param {{ image: string, mediaType: string, utterance: string, members: { id: string, name: string }[], me?: string, retry?: boolean }} input
 * @returns {Promise<{ receipt: object, payerId: string | null, payers: { memberId: string, amount: number | null }[], splits: object[], questions: object[], check: { ok: boolean, errors: string[] }, retried: boolean }>}
 *   me = 영수증을 올린 사람 이름, retry = false 면 재시도하지 않는다 (정확도 측정에서 켬/끔 비교용, PER-001)
 */
export async function runPipeline({ image, mediaType, utterance, members, me, retry = true }) {
  let receipt = await readReceipt({ image, mediaType })
  if (!isReadable(receipt)) throw new UnreadableReceipt()
  let check = validate(receipt)
  let retried = false
  if (!check.ok && retry) {
    // 틀린 점을 알려 주고 한 번만 다시 읽힌다
    const again = await readReceipt({ image, mediaType, hint: explain(receipt, check.errors).hints })
    // 다시 읽은 결과가 오히려 비었으면 처음 결과를 쓴다
    if (isReadable(again)) receipt = again
    check = validate(receipt)
    retried = true
  }

  const memberIds = members.map((m) => m.id)
  const readErrors = check.errors
  const assign = (hint) => assignLines({ lines: receipt.lines, members, utterance, me, currency: receipt.currency, total: receipt.total, hint })
  let a = await assign()
  check = validate({ ...receipt, payers: a.payers, splits: a.splits, memberIds })
  // 배정·결제자에서 새로 생긴 오류만 골라 (영수증 읽기 오류는 배정을 다시 해도 안 바뀜) 한 번만 다시 정하게 한다 (FR-009)
  const assignErrors = check.errors.filter((e) => !readErrors.includes(e))
  if (assignErrors.length && retry) {
    a = await assign(explain(receipt, assignErrors).hints)
    check = validate({ ...receipt, payers: a.payers, splits: a.splits, memberIds })
    retried = true
  }

  // 그래도 남은 오류는 사용자에게 묻는다 (추측해서 고치지 않음). 결제자 질문은 배정 단계에서 이미 냈으면 겹치지 않게
  const { payerId, payers, splits } = a
  let { questions } = a
  const server = explain(receipt, check.errors).questions
  // 서버 검사가 결제자 금액을 물으면, AI 가 같은 내용을 줄 번호 없이 따로 물은 질문은 뺀다 (같은 질문이 두 번 뜨던 문제)
  if (server.some((q) => q.field === 'payers')) questions = questions.filter((q) => !(q.lineIndex == null && /냈|결제|금액|합계/.test(q.text)))
  const asked = new Set(questions.map((q) => q.field))
  questions.push(...server.filter((q) => !(q.field === 'payers' && asked.has('payers'))))

  return { receipt, payerId, payers, splits, questions, check, retried }
}
