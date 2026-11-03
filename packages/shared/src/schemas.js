// 프론트·백엔드·AI 가 같이 쓰는 데이터 형식. 바꿀 때는 docs/api.md 도 같이 고친다.
// 괄호 안 R-xx 는 노션 요구사항 정의서 번호
import { z } from 'zod'

/** 통화 코드 (ISO 4217, 예: EUR, JPY, KRW) */
export const Currency = z.string().length(3).toUpperCase()

/** 금액은 소수 오차를 피하려고 최소 단위 정수로 저장 (EUR 12.30 → 1230) */
export const Money = z.object({
  amount: z.number().int(),
  currency: Currency,
})

/** 결제 수단 (R-05, R-08) */
export const PaymentMethod = z.enum(['card', 'cash'])

/** 지출 분류 (R-18). packages/ai/src/record.js 가 돌려주는 값과 같다 */
export const Category = z.enum(['식사', '선택관광', '교통', '쇼핑', '팁', '기타'])

export const Member = z.object({
  id: z.string(),
  name: z.string().min(1),
})

/** 잔액 하나 = 통화 + 카드/현금 (R-05) */
export const WalletBalance = Money.extend({
  method: PaymentMethod,
})

/** 멤버가 앱 안에 환전해 둔 외화 잔액 */
export const Wallet = z.object({
  memberId: z.string(),
  balances: z.array(WalletBalance),
})

export const Trip = z.object({
  id: z.string(),
  title: z.string(),
  members: z.array(Member).min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

/** 영수증 한 줄 (AI 가 읽은 결과 + 근거 원문) */
export const ReceiptLine = z.object({
  name: z.string(),
  nameKo: z.string().optional(), // 현지어 메뉴의 한국어 번역 (R-07)
  kind: z.enum(['item', 'tax']).default('item'), // tax 줄은 배정하지 않고 몫 비율대로 나눈다 (R-07, R-24)
  qty: z.number().int().positive().default(1),
  unitPrice: z.number().int(),
  total: z.number().int(),
  source: z.string().optional(), // 영수증에서 읽은 원문
})

/** 한 줄을 누구에게 얼마씩 나눌지 */
export const Split = z.object({
  lineIndex: z.number().int().nonnegative(),
  memberIds: z.array(z.string()).min(1),
  source: z.string().optional(), // 배정 근거가 된 말 원문, 예: "서준은 술 빼고" (R-10)
})

/** AI 가 모르는 칸을 사용자에게 묻는 질문 (R-09, R-10) */
export const Question = z.object({
  lineIndex: z.number().int().nonnegative().optional(), // 특정 줄에 대한 질문이면 그 줄 번호
  field: z.string(), // 모르는 칸, 예: "memberIds", "total"
  text: z.string(),
})

/** 결제자 한 명이 낸 몫 - amount 는 Expense.total 과 같은 통화 (R-08) */
export const Payer = z.object({
  memberId: z.string(),
  amount: z.number().int(),
  method: PaymentMethod,
})

/** 지목된 사람의 "맞아요 / 안 갔어요" (R-11) */
export const Confirmation = z.object({
  memberId: z.string(),
  status: z.enum(['pending', 'confirmed', 'declined']).default('pending'),
})

/** 결제일 환율: 외화 1 단위(예: 1 TRY) = rate 원 (R-20) */
export const Fx = z.object({
  rate: z.number().positive(),
  date: z.string(), // 환율 기준일 YYYY-MM-DD
  source: z.string(), // 예: "Frankfurter", "ExchangeRate-API"
})

export const Expense = z.object({
  id: z.string(),
  tripId: z.string(),
  payers: z.array(Payer).min(1),
  total: Money,
  lines: z.array(ReceiptLine).default([]),
  splits: z.array(Split).default([]),
  memberIds: z.array(z.string()).default([]), // 나눌 사람. 비면 정산방 전원. 배정(splits)이 없는 줄은 이 사람들끼리 1/N (R-06)
  confirmations: z.array(Confirmation).default([]),
  category: Category.optional(),
  merchant: z.string().optional(), // 가게 이름 (영수증·카드 문자에서). 중복 결제 찾을 때 씀 (R-14)
  planItem: z.number().int().nonnegative().optional(), // 상품 분석(/estimate) items 의 몇 번째 항목을 한 기록인지 (R-22 예상 vs 실제)
  memo: z.string().optional(),
  paidAt: z.string().optional(), // 결제 시각 (환율 기준일을 정할 때 씀)
  fx: Fx.optional(),
  createdAt: z.string(),
})

/** 현금으로 주고받은 정산: given(준 사람) + received(받은 사람) 둘 다 true 여야 끝 (R-13) */
export const CashTransfer = z.object({
  id: z.string(),
  tripId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  money: Money,
  given: z.boolean().default(false),
  received: z.boolean().default(false),
  createdAt: z.string(),
})

/** 상품 분석(/estimate) 결과의 비용 항목 하나. amount 는 문구에 적힌 1인 금액 그대로 (최소 단위 아님) (R-01) */
export const PlanItem = z.object({
  name: z.string(),
  category: z.string(), // 선택관광 · 싱글차지 · 불포함 식사 · 가이드·기사 경비 · 팁 · 기타
  amount: z.number().nullable(),
  currency: z.string(), // 모르면 'OTHER'
  required: z.boolean(),
})

/** 상품 분석(/estimate) 응답. fx.krw = 외화 1 단위가 몇 원인지 */
export const Estimate = z.object({
  title: z.string().default(''),
  base_price_krw: z.number().nullable(),
  items: z.array(PlanItem),
  fx: z.object({ date: z.string(), krw: z.record(z.string(), z.number()) }).nullable().default(null),
})
