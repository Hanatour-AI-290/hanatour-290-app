import { Hono } from 'hono'
import { store } from '../store/memory.js'

const r = new Hono()

r.get('/', (c) => c.json(store.listTrips()))

r.get('/:tripId', (c) => {
  const trip = store.getTrip(c.req.param('tripId'))
  return trip ? c.json(trip) : c.json({ error: '여행을 찾을 수 없어요' }, 404)
})

// TODO(BE): POST / (여행 만들기, Trip 스키마로 검증)

export default r
