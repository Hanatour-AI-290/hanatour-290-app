// 찍고 → 말하고 → 확인 (R-07~R-10)
// POST /api/trips/:tripId/receipts/analyze  (multipart) image 파일 · utterance 문자열 · members JSON 문자열 · me(올린 사람 이름, 선택)
//   → { receipt, payerId, payers, splits, questions, check, retried }  AI 결과 초안. 정산에 넣는 건 확인 카드에서 사용자가 한다
import { Hono } from 'hono'
import { z } from 'zod'
import { Member } from '@h290/shared'
import { runPipeline, UnreadableReceipt } from '@h290/ai'

const r = new Hono()

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] // Claude 이미지 입력이 받는 형식
const MAX_BYTES = 3_000_000 // base64 로 늘어나도 4MB 아래 (/record 의 제한과 맞춤)
const Members = z.array(Member).min(1).max(12)

r.post('/analyze', async (c) => {
  const form = await c.req.parseBody().catch(() => null)
  if (!form) return c.json({ error: 'multipart 형식으로 보내 주세요' }, 400)

  const image = form.image
  if (!(image instanceof File)) return c.json({ error: '영수증 사진(image)이 없어요' }, 400)
  if (!TYPES.includes(image.type)) return c.json({ error: '사진 형식을 읽지 못했어요 (jpg · png · webp · gif)' }, 400)
  if (image.size > MAX_BYTES) return c.json({ error: '사진이 너무 커요' }, 413)

  const utterance = String(form.utterance ?? '').trim()
  if (utterance.length > 500) return c.json({ error: '한 줄로 짧게 말해 주세요' }, 400)

  let members
  try {
    members = Members.parse(JSON.parse(String(form.members ?? '')))
  } catch {
    return c.json({ error: 'members 는 [{"id","name"}] 모양 JSON 문자열이어야 해요' }, 400)
  }

  const me = String(form.me ?? members[0].name)
  const data = Buffer.from(await image.arrayBuffer()).toString('base64')
  // AI 호출 오류(한도 초과 등)는 app.js onError 가 429 / 502 로 바꾼다 → 화면은 직접 입력으로 넘긴다 (AVL-003)
  try {
    return c.json(await runPipeline({ image: data, mediaType: image.type, utterance, members, me }))
  } catch (e) {
    // 영수증이 아닌 사진 · 너무 흐린 사진: 지어낸 합계로 기록하지 않고 422 → 화면은 합계만 읽기 → 직접 입력 (AVL-003, R-25)
    if (e instanceof UnreadableReceipt) return c.json({ error: e.message }, 422)
    throw e
  }
})

export default r
