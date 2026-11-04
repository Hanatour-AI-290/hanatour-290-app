// 2단계 "말하고": "맥주는 하린이랑 도윤, 서준은 술 빼고" → 줄별 배정 (R-08, R-10)
// AI 는 이름으로 답하고, 이름 → memberId 변환과 명단 밖 이름 거르기는 코드가 한다 (R-25 추측 금지).
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { minorDigits } from '@h290/shared'
import { getClient, MODEL } from './client.js'
import { resolvePayers } from './payers.js'

export const AssignResult = z.object({
  payers: z.array(z.object({
    name: z.string().describe('돈을 낸 사람 이름'),
    amount: z.number().nullable().describe('그 사람이 낸 금액을 영수증 통화 소수로 (예: 2000). 말에 금액이 없으면 null'),
  })).describe('돈을 낸 사람들 (FR-008). 여러 명이 나눠 냈으면 모두. 말에 없으면 빈 배열'),
  splits: z.array(z.object({
    lineIndex: z.number().int().describe('줄 번호 (0부터)'),
    names: z.array(z.string()).describe('그 줄을 나눌 사람 이름들'),
    source: z.string().describe('그렇게 판단한 말의 부분 그대로 (예: 서준은 술 빼고). 말에 근거가 없으면 "기본 1/N"'),
  })).describe('메뉴 줄마다 하나씩. 세금 줄은 넣지 않는다'),
  questions: z.array(z.object({
    lineIndex: z.number().int().nullable(),
    text: z.string().describe('사용자에게 물을 짧은 질문'),
  })).describe('말만으로 누가 낼지 확실하지 않은 줄'),
})

const SYSTEM = (members, me) => `너는 여행 영수증을 동행끼리 나누는 도우미다. 영수증 줄 목록과 말 한마디를 보고 줄마다 나눌 사람을 정한다.
- 동행: ${members.join(', ')}. 말하는 사람(영수증을 올린 사람)은 ${me}이고 "나", "내가"는 ${me}이다.
- 말에서 특정 줄에 대한 언급이 없으면 그 줄은 동행 전원으로 나눈다 (기본 1/N). source 는 "기본 1/N".
- "누구는 술 빼고"처럼 빼라고 하면 해당 줄에서 그 사람을 뺀다. 술은 맥주·와인·라크·Efes·Bira 같은 줄이다.
- 메뉴 이름이 현지어여도 nameKo(한국어)로 어떤 줄인지 판단한다.
- 말에서 가리킨 메뉴(예: "술 빼고"의 술)가 영수증 줄에 없으면 그 말은 어느 줄에도 적용하지 말고, questions 에 "영수증에 술 줄이 없어요. 어떤 줄을 말한 건가요?"처럼 넣는다.
- 동행 명단에 없는 이름은 쓰지 않는다. 어느 줄인지 애매하면 추측하지 말고 questions 에 넣는다.
- 세금 줄(kind=tax)은 splits 에 넣지 않는다. 몫 비율대로 나누는 건 서버가 한다.
- 결제자는 말에 나온 사람만 payers 에 넣는다. "지우가 2000, 나머지는 하린"처럼 금액을 말했으면 그 금액, "반씩"처럼 나누는 방법만 말했으면 그대로 계산한 금액, 금액 말이 없으면 null.`

/**
 * @param {{ lines: { name: string, nameKo?: string, kind?: string, total: number }[], members: { id: string, name: string }[], utterance: string, me?: string,
 *           currency: string, total: number, hint?: string[] }} input  total = 영수증 합계 (최소 단위), hint = 지난번에 틀린 점 (재시도 때)
 * @returns {Promise<{ payerId: string | null, payers: { memberId: string, amount: number | null }[], splits: { lineIndex: number, memberIds: string[], source?: string }[], questions: { lineIndex?: number, field: string, text: string }[] }>}
 *   payerId = 첫 결제자 (없으면 null), payers 금액은 최소 단위
 */
export async function assignLines({ lines, members, utterance, me, currency, total, hint = [] }) {
  const names = members.map((m) => m.name)
  const meName = me ?? names[0]
  const table = lines.map((l, i) => `${i}. ${l.nameKo || l.name} (${l.name}) ${l.kind === 'tax' ? '[세금]' : ''}`).join('\n')

  const resp = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(AssignResult) },
    system: SYSTEM(names, meName),
    messages: [{ role: 'user', content: `<영수증줄>\n${table}\n</영수증줄>\n<말>${utterance || '(말 없음)'}</말>${retryNote(hint)}` }],
  })
  if (resp.stop_reason === 'refusal' || !resp.parsed_output) throw new Error('나눌 사람을 정하지 못했어요')

  const out = resp.parsed_output
  const idOf = Object.fromEntries(members.map((m) => [m.name, m.id]))
  const questions = out.questions.map((q) => ({ ...(q.lineIndex != null ? { lineIndex: q.lineIndex } : {}), field: 'memberIds', text: q.text }))

  const splits = []
  for (const s of out.splits) {
    const line = lines[s.lineIndex]
    if (!line || line.kind === 'tax') continue // 없는 줄 · 세금 줄 배정은 버린다
    const unknown = s.names.filter((n) => !idOf[n])
    const memberIds = [...new Set(s.names.map((n) => idOf[n]).filter(Boolean))]
    if (unknown.length) questions.push({ lineIndex: s.lineIndex, field: 'memberIds', text: `${line.nameKo || line.name}: 명단에 없는 이름(${unknown.join(', ')})이 있어요. 누가 낼까요?` })
    if (memberIds.length) splits.push({ lineIndex: s.lineIndex, memberIds, source: s.source })
  }

  // 결제자: AI 가 읽은 소수 금액 → 최소 단위, 금액 맞추기는 resolvePayers (코드)
  const scale = 10 ** minorDigits(currency)
  const paid = resolvePayers({
    payers: out.payers.map((p) => ({ name: p.name, amount: p.amount == null ? null : Math.round(p.amount * scale) })),
    names,
    total,
  })
  for (const text of paid.questions) questions.push({ field: 'payers', text })
  const payers = paid.payers.map((p) => ({ memberId: idOf[p.name], amount: p.amount }))
  return { payerId: payers[0]?.memberId ?? null, payers, splits, questions }
}

/** 재시도 때 틀린 점을 말 뒤에 붙인다 (FR-009) */
const retryNote = (hint) => (hint.length ? `\n지난번 결과가 틀렸다. 다시 정해 줘.\n틀린 점:\n${hint.map((h) => `- ${h}`).join('\n')}` : '')
