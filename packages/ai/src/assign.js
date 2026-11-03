// 2단계 "말하고": "맥주는 하린이랑 도윤, 서준은 술 빼고" → 줄별 배정

/**
 * @param {{ lines: object[], members: { id: string, name: string }[], utterance: string }} input
 * @returns {Promise<{ splits: { lineIndex: number, memberIds: string[] }[], questions: string[] }>}
 */
export async function assignLines(input) {
  // TODO(AI): 이름 → memberId 매칭, 애매하면 questions 에 질문 담기
  void input
  throw new Error('assignLines: 아직 구현 안 됨')
}
