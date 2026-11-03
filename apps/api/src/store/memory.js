// 해커톤용 메모리 저장소. 서버를 껐다 켜면 사라진다.
// TODO(BE): 필요하면 같은 함수 모양 그대로 DB 로 교체

const db = { trips: new Map(), expenses: new Map() }

export const store = {
  listTrips: () => [...db.trips.values()],
  getTrip: (id) => db.trips.get(id),
  saveTrip: (trip) => (db.trips.set(trip.id, trip), trip),
  listExpenses: (tripId) => [...db.expenses.values()].filter((e) => e.tripId === tripId),
  saveExpense: (e) => (db.expenses.set(e.id, e), e),
}
