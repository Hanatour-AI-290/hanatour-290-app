import { Hono } from 'hono'
import { store } from '../store/memory.js'

const r = new Hono()

r.get('/', (c) => c.json(store.listExpenses(c.req.param('tripId'))))

// TODO(BE): POST / (지출 기록 저장, Expense 스키마로 검증)

export default r
