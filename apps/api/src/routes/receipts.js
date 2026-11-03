import { Hono } from 'hono'

const r = new Hono()

// 찍고 → 말하고 → 확인: 사진 + 말 → 줄 단위 + 배정 + 검증 결과
// TODO(BE+AI): multipart 로 이미지 받기 → @h290/ai runPipeline 호출
r.post('/analyze', (c) => c.json({ error: '아직 구현 안 됨' }, 501))

export default r
