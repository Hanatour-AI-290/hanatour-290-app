// 시연용 예시 문구: 유튜브 「튀르키예 초저가 vs 프리미엄 패키지 비교」(youtu.be/4JXMBkDFEt4) 자막에 나온 금액만 모아 재구성
export const SAMPLE = `[튀르키예 일주 7박 9일] 상품가 1,240,000원 (11월 출발 기준)

포함 사항: 왕복 항공, 호텔 7박, 일정표상 식사, 전용 차량

불포함 사항
- 가이드/기사 경비: 현지 지불, 약 10만 원

선택관광 (현지에서 신청·결제)
- 카파도키아 열기구 투어: 320유로
- 고고학 시리즈 (성소피아, 돌마바흐체, 예레바탄 지하궁전): 180유로
- 안탈리아 유람선 투어: 60유로
- 카트 투어: 60유로
- 지프 사파리
- 보스포루스 야경 투어`

// 현장 인터넷이 끊겨도 시연이 멈추지 않도록, 위 예시 문구를 배포본으로 실제 분석한 결과(2026-11-02 호출)를 저장해 둔다.
// 화면에는 "저장된 분석 결과"라고 표시한다.
export const SAMPLE_RESULT = {
  title: '튀르키예 일주 7박 9일',
  base_price_krw: 1240000,
  items: [
    { name: '가이드/기사 경비', category: '가이드·기사 경비', amount: 100000, currency: 'KRW', required: true, evidence: '가이드/기사 경비: 현지 지불, 약 10만 원' },
    { name: '카파도키아 열기구 투어', category: '선택관광', amount: 320, currency: 'EUR', required: false, evidence: '카파도키아 열기구 투어: 320유로' },
    { name: '고고학 시리즈 (성소피아, 돌마바흐체, 예레바탄 지하궁전)', category: '선택관광', amount: 180, currency: 'EUR', required: false, evidence: '고고학 시리즈 (성소피아, 돌마바흐체, 예레바탄 지하궁전): 180유로' },
    { name: '안탈리아 유람선 투어', category: '선택관광', amount: 60, currency: 'EUR', required: false, evidence: '안탈리아 유람선 투어: 60유로' },
    { name: '카트 투어', category: '선택관광', amount: 60, currency: 'EUR', required: false, evidence: '카트 투어: 60유로' },
    { name: '지프 사파리', category: '선택관광', amount: null, currency: 'OTHER', required: false, evidence: '지프 사파리' },
    { name: '보스포루스 야경 투어', category: '선택관광', amount: null, currency: 'OTHER', required: false, evidence: '보스포루스 야경 투어' },
  ],
  fx: { date: '2026-10-30', krw: { EUR: 1491.758, JPY: 8.4911, USD: 1335.274 } },
}

// 시연 팀: 2030 친구 4명이 같은 패키지에 함께 간 상황 (가상 인물)
export const ME = '지우'
export const MEMBERS = ['지우', '하린', '도윤', '서준']

// 튀르키예 상품의 예시 일정 (기능 설명용, 실제 상품 일정 아님)
export const TRIP = {
  days: 9,
  today: 3,
  places: { 1: '인천 → 이스탄불', 2: '이스탄불', 3: '카파도키아', 4: '콘야', 5: '안탈리아', 6: '파묵칼레', 7: '에페소', 8: '이스탄불', 9: '귀국' },
  // AI가 뽑은 항목을 이름으로 찾아 어느 날 몇 시에 둘지 정한다
  slots: [
    { match: /가이드|기사/, day: 1, time: '공항' },
    { match: /고고학|성소피아/, day: 2, time: '09:00' },
    { match: /보스포루스/, day: 2, time: '20:00' },
    { match: /열기구/, day: 3, time: '05:30' },
    { match: /지프/, day: 3, time: '16:00' },
    { match: /유람선/, day: 5, time: '10:00' },
    { match: /카트/, day: 5, time: '15:00' },
  ],
}

// 시연은 "여행 3일째"에서 시작한다. 지나간 날의 기록을 미리 채워 둔다.
export const SEED = [
  { match: /가이드|기사/, status: 'done', payer: null, people: ['지우'] },
  { match: /고고학|성소피아/, status: 'done', payer: '도윤', people: ['지우', '하린', '도윤'] },
  { match: /보스포루스/, status: 'skip' },
]

// 시연용 카드 결제 문자 (가상 카드사·가맹점, 카드번호·이름 가림)
export const SAMPLE_SMS = `[Web발신]
예시카드(1234) 해외승인
조*래
TRY 620.00
11/05 14:10
GOREME CAFE`
