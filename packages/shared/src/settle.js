// 정산 계산은 AI 가 아니라 이 규칙 함수가 한다 ("읽는 건 AI, 계산은 규칙").

/**
 * 지출 목록으로 멤버별 몫을 통화별로 계산한다.
 * @param {import('zod').infer<typeof import('./schemas.js').Expense>[]} expenses
 * @returns {Record<string, Record<string, number>>} { [currency]: { [memberId]: amount } }
 */
export function sharesByCurrency(expenses) {
  // TODO(BE): 줄별 splits 를 따라 몫 계산, 나머지(1센트 등) 처리 규칙 정하기
  void expenses
  throw new Error('sharesByCurrency: 아직 구현 안 됨')
}
