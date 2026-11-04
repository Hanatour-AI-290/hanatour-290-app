// POST /api/match/plan  기록 하나 → 연결할 만한 예정 항목 (ML 임베딩 모델 + 금액 규칙)
//   { record: { text, amount?, currency?, people? }, items: [{ idx, name, aliases?, amount?, currency? }] }
//   → { candidates: [{ idx, score, sim, amountMatch }], model }
// 후보만 돌려준다. 연결은 화면에서 사용자가 "맞아요" 를 눌러야 한다.
import { Hono } from 'hono'
import { z } from 'zod'
import { matchPlanItems } from '@h290/shared'
import { planSimilarities, EMBED_MODEL } from '@h290/ai'

const r = new Hono()

const Body = z.object({
  record: z.object({
    text: z.string().trim().min(1).max(500),
    amount: z.number().nonnegative().nullable().optional(),
    currency: z.string().max(5).nullable().optional(),
    people: z.number().int().min(1).max(12).optional(),
  }),
  items: z.array(z.object({
    idx: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(200),
    // 상품 분석 때 Claude 가 만든 다른 이름. 모양이 조금 어긋나도 요청을 막지 않고 잘라 쓴다
    aliases: z.array(z.string()).optional().transform((a) => (a ?? []).map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 12)),
    amount: z.number().nonnegative().nullable().optional(),
    currency: z.string().max(5).nullable().optional(),
  })).max(50),
})

r.post('/plan', async (c) => {
  const parsed = Body.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: '기록 문장(record.text)과 예정 항목(items)이 필요해요', issues: parsed.error.issues }, 400)
  const { record, items } = parsed.data
  if (!items.length) return c.json({ candidates: [], model: EMBED_MODEL })

  const norm = items.map((it) => ({ idx: it.idx, amount: it.amount ?? null, currency: it.currency ?? null }))
  try {
    const sims = await planSimilarities(record.text, items)
    return c.json({ candidates: matchPlanItems({ record, items: norm, sims }), model: EMBED_MODEL })
  } catch (e) {
    // 모델을 못 불러와도 기록 흐름은 막지 않는다 (후보 없음으로)
    console.error('embedding failed', e)
    return c.json({ candidates: [], model: null })
  }
})

export default r
