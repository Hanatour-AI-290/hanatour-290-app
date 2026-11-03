// 프론트·백엔드·AI 가 같이 쓰는 데이터 형식. 바꿀 때는 docs/api.md 도 같이 고친다.
import { z } from 'zod'

/** 통화 코드 (ISO 4217, 예: EUR, JPY, KRW) */
export const Currency = z.string().length(3).toUpperCase()

/** 금액은 소수 오차를 피하려고 최소 단위 정수로 저장 (EUR 12.30 → 1230) */
export const Money = z.object({
  amount: z.number().int(),
  currency: Currency,
})

export const Member = z.object({
  id: z.string(),
  name: z.string().min(1),
})

/** 멤버가 앱 안에 환전해 둔 외화 잔액 */
export const Wallet = z.object({
  memberId: z.string(),
  balances: z.array(Money),
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
  qty: z.number().int().positive().default(1),
  unitPrice: z.number().int(),
  total: z.number().int(),
  source: z.string().optional(), // 영수증에서 읽은 원문
})

/** 한 줄을 누구에게 얼마씩 나눌지 */
export const Split = z.object({
  lineIndex: z.number().int().nonnegative(),
  memberIds: z.array(z.string()).min(1),
})

export const Expense = z.object({
  id: z.string(),
  tripId: z.string(),
  payerIds: z.array(z.string()).min(1),
  total: Money,
  lines: z.array(ReceiptLine).default([]),
  splits: z.array(Split).default([]),
  category: z.string().optional(),
  memo: z.string().optional(),
  createdAt: z.string(),
})
