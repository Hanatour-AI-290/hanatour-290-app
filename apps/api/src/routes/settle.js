// 정산 · 지갑 · 하루 끝 요약 · 중복 결제 (R-05, R-06, R-11~14, R-19, R-20, R-23)
//
// POST /api/settle             { members, expenses }                            → 통화별 정산 + 원화 합계
// POST /api/settle/wallets     { members, wallets, expense | cashTransfer }     → 지갑 차감 결과
// POST /api/settle/wallets/replay { members, wallets, expenses, cashStatus? } → 처음 지갑부터 다시 계산
// POST /api/settle/day         { members, memberId, expenses, wallets, date, day, days } → 하루 끝 요약
// POST /api/settle/duplicates  { expense, expenses, amountRate?, minutes? }      → "같은 결제인가요?" 후보
//
// 서버에 저장하지 않고 보낸 데이터로 계산만 한다. Vercel 함수는 요청마다 메모리가 비워질 수 있고,
// 시연은 한 기기에서 한다 (요구사항정의서 AVL-004). 데이터는 화면이 들고 있다.
import { Hono } from 'hono'
import { z } from 'zod'
import {
  CashTransfer, Expense, Member, Wallet,
  applyCashTransfer, applyExpense, checkExpense, daySummary, findDuplicates, replayWallets, settle,
} from '@h290/shared'
import { parseBody } from '../lib/body.js'

const r = new Hono()

const Members = z.array(Member).min(1).max(12)
const Expenses = z.array(Expense).max(500)
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** 지출마다 checkExpense. 틀린 점이 있으면 422 응답, 없으면 null */
function invalid(c, expenses, memberIds) {
  const errors = expenses.flatMap((e) => checkExpense(e, memberIds))
  return errors.length ? c.json({ error: '지출 기록이 앞뒤가 맞지 않아요', errors }, 422) : null
}

r.post('/', async (c) => {
  const { data, error } = await parseBody(c, z.object({ members: Members, expenses: Expenses }))
  if (error) return error
  const memberIds = data.members.map((m) => m.id)
  return invalid(c, data.expenses, memberIds) ?? c.json(settle({ memberIds, expenses: data.expenses }))
})

r.post('/wallets', async (c) => {
  const { data, error } = await parseBody(c, z.object({
    members: Members,
    wallets: z.array(Wallet),
    expense: Expense.optional(),
    cashTransfer: CashTransfer.optional(),
  }))
  if (error) return error
  const memberIds = data.members.map((m) => m.id)
  const missing = memberIds.filter((id) => !data.wallets.some((w) => w.memberId === id))
  if (missing.length) return c.json({ error: `지갑이 없는 멤버: ${missing.join(', ')}` }, 400)

  if (data.expense) {
    return invalid(c, [data.expense], memberIds) ?? c.json(applyExpense(data.wallets, data.expense, memberIds))
  }
  if (data.cashTransfer) {
    const t = data.cashTransfer
    if (![t.fromId, t.toId].every((id) => memberIds.includes(id))) return c.json({ error: '정산방에 없는 멤버예요' }, 422)
    return c.json(applyCashTransfer(data.wallets, t))
  }
  return c.json({ error: 'expense 나 cashTransfer 중 하나가 필요해요' }, 400)
})

r.post('/wallets/replay', async (c) => {
  const { data, error } = await parseBody(c, z.object({
    members: Members,
    wallets: z.array(Wallet),
    expenses: Expenses,
    cashStatus: z.record(z.string(), z.object({ given: z.boolean().optional(), received: z.boolean().optional() })).default({}),
  }))
  if (error) return error
  const memberIds = data.members.map((m) => m.id)
  const missing = memberIds.filter((id) => !data.wallets.some((w) => w.memberId === id))
  if (missing.length) return c.json({ error: `지갑이 없는 멤버: ${missing.join(', ')}` }, 400)
  return invalid(c, data.expenses, memberIds) ?? c.json(replayWallets({ ...data, memberIds }))
})

r.post('/day', async (c) => {
  const { data, error } = await parseBody(c, z.object({
    members: Members,
    memberId: z.string(),
    expenses: Expenses,
    wallets: z.array(Wallet),
    date: Day,
    day: z.number().int().positive(),
    days: z.number().int().positive(),
  }))
  if (error) return error
  const memberIds = data.members.map((m) => m.id)
  if (!memberIds.includes(data.memberId)) return c.json({ error: '정산방에 없는 멤버예요' }, 422)
  if (data.day > data.days) return c.json({ error: 'day 가 전체 일수보다 커요' }, 400)
  return invalid(c, data.expenses, memberIds) ?? c.json(daySummary({ ...data, memberIds }))
})

r.post('/duplicates', async (c) => {
  const { data, error } = await parseBody(c, z.object({
    expense: Expense,
    expenses: Expenses,
    amountRate: z.number().min(0).max(0.5).optional(),
    minutes: z.number().int().min(0).max(24 * 60).optional(),
  }))
  if (error) return error
  const { expense, expenses, ...opts } = data
  return c.json({ duplicates: findDuplicates(expense, expenses, opts) })
})

export default r
