// 화면들이 함께 쓰는 표기 함수. 화면 · ui.jsx 파일은 컴포넌트만 내보내도록 (Fast Refresh) 여기 둔다

/** 숫자 → 천 단위 쉼표 (1,560) */
export const lira = (n) => n.toLocaleString('ko-KR')

/** 상품 분석 분류 → 화면 이름. chip 이면 0-1 칩 표기 (불포함 식사 = 자유식) */
export function labelOf(category, chip = false) {
  if (category === '가이드·기사 경비') return '가이드 경비'
  if (category === '불포함 식사') return chip ? '자유식' : '식비'
  return category || '기타'
}
