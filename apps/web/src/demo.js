// 트립버짓 v5 시연 값. Figma 디자인 화면 속 숫자 그대로 (디자인 메모: "화면 속 금액과 환율은 모두 시연 예시 값")
// 사람 이름 · id 는 sample.js 와 같게 둔다 (API 는 id 로 계산)
import { MEMBER_IDS } from './sample.js'

export const IMG = (name) => `/v5/${name}`

export const PEOPLE = {
  지우: { id: MEMBER_IDS.지우, av: IMG('av-jiwoo.png') },
  하린: { id: MEMBER_IDS.하린, av: IMG('av-harin.png') },
  도윤: { id: MEMBER_IDS.도윤, av: IMG('av-doyun.png') },
  서준: { id: MEMBER_IDS.서준, av: IMG('av-seojun.png') },
}

export const TRIP5 = {
  title: '튀르키예 일주 7박',
  room: 'TRK-290',
  today: 3,
  todayPlace: '카파도키아',
  dailyLira: 1000, // 3번 화면에서 정하는 하루 생활비 (리라)
}

// 4·5번: 마가라 레스토랑 저녁 영수증 (지우 카드로 2,400리라)
export const DINNER = {
  merchant: '마가라 레스토랑',
  name: '마가라 레스토랑 저녁',
  payer: '지우',
  total: 2400,
  currency: 'TRY',
  voice: '맥주는 하린이랑 도윤, 서준은 술 빼고',
  lines: [
    { name: '케밥', raw: 'KEBAP × 4', amount: 1800, people: ['지우', '하린', '도윤', '서준'] },
    { name: '에페스 맥주', raw: 'EFES × 2', amount: 360, people: ['하린', '도윤'] },
    { name: '생수', raw: 'SU × 4', amount: 240, people: ['지우', '하린', '도윤', '서준'] },
  ],
  shares: { 지우: 510, 하린: 690, 도윤: 690, 서준: 510 },
}

// 10번: 지우 지갑
export const MY_WALLET = { TRY: 3980, EUR: 200, receivable: 510 }
