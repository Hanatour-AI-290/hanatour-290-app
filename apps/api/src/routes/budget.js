// 예산 · 리포트 (R-03, R-22). 상품 분석(/estimate) 결과와 지출 목록으로 계산만 한다.
//
// POST /api/budget  { estimate, picks, days, livingPerDayKrw }                → 하루 예산
// POST /api/report  { estimate, picks, members, memberId, expenses }          → 예상 vs 실제
import { Hono } from 'hono'
import { z } from 'zod'
import { Estimate, Expense, Member, checkExpense, dailyBudget, report } from '@h290/shared'
import { parseBody } from '../lib/body.js'

const r = new Hono()

const Picks = z.array(z.number().int().nonnegative()).default([])

r.post('/budget', async (c) => {
  const { data, error } = await parseBody(c, z.object({
    estimate: Estimate,
    picks: Picks,
    days: z.number().int().min(1).max(60),
    livingPerDayKrw: z.number().int().min(0), // 하루 생활비 예시 값 (근거 데이터 없음, 화면에 "예시 값" 표시)
  }))
  if (error) return error
  return c.json(dailyBudget(data))
})

r.post('/report', async (c) => {
  const { data, error } = await parseBody(c, z.object({
    estimate: Estimate,
    picks: Picks,
    members: z.array(Member).min(1).max(12),
    memberId: z.string(),
    expenses: z.array(Expense).max(500),
  }))
  if (error) return error
  const memberIds = data.members.map((m) => m.id)
  if (!memberIds.includes(data.memberId)) return c.json({ error: '정산방에 없는 멤버예요' }, 422)
  const errors = data.expenses.flatMap((e) => checkExpense(e, memberIds))
  if (data.expenses.some((e) => e.planItem != null && !data.estimate.items[e.planItem])) {
    errors.push('planItem 이 상품 분석 항목 범위를 벗어났어요')
  }
  if (errors.length) return c.json({ error: '지출 기록이 앞뒤가 맞지 않아요', errors }, 422)
  return c.json(report({ ...data, memberIds }))
})

export default r
