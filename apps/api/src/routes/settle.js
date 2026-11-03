import { Hono } from 'hono'

const r = new Hono()

// 통화별 정산 결과
// TODO(BE): @h290/shared sharesByCurrency 로 계산
r.get('/', (c) => c.json({ error: '아직 구현 안 됨' }, 501))

export default r
