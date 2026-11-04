import { useEffect, useState } from 'react'
import Splash from './screens/S00Splash.jsx'
import Invite from './screens/S01Invite.jsx'
import PickName from './screens/S02PickName.jsx'
import DailyBudget from './screens/S03DailyBudget.jsx'
import Capture from './screens/S04Capture.jsx'
import SplitConfirm from './screens/S05SplitConfirm.jsx'
import AgreePhone from './screens/S06AgreePhone.jsx'
import SettleRoom from './screens/S07SettleRoom.jsx'
import TopUp from './screens/S08TopUp.jsx'
import VoiceSolo from './screens/S09VoiceSolo.jsx'
import Wallet from './screens/S10Wallet.jsx'
import DayClose from './screens/S11DayClose.jsx'
import TripReport from './screens/S12TripReport.jsx'
import Product from './screens/S0_1Product.jsx'
import Estimate from './screens/S0_2Estimate.jsx'
import { TRIP5 } from './demo.js'

// 시연 순서. id = Figma 화면 번호, who = 이 화면이 누구 폰인지
// 여행 전 준비(상품 → 총비용 → 생활비)를 마치고 친구를 초대한다
const STEPS = [
  { id: '0', C: Splash, title: '스플래시', who: '지우' },
  { id: '0-1', C: Product, title: '여행 전: 상품 불러오기', who: '지우' },
  { id: '0-2', C: Estimate, title: '여행 전: 진짜 총비용 예상', who: '지우' },
  { id: '3', C: DailyBudget, title: '여행 전: 하루 생활비 정하기', who: '지우' },
  { id: '1', C: Invite, title: '친구 초대하기', who: '지우' },
  { id: '2', C: PickName, title: '초대받은 사람: 이름 고르기', who: '하린' },
  { id: '4', C: Capture, title: '찍고 말하기', who: '지우' },
  { id: '5', C: SplitConfirm, title: '이렇게 나눌까요?', who: '지우' },
  { id: '6', C: AgreePhone, title: '하린의 폰: 맞아요 누르기', who: '하린' },
  { id: '7', C: SettleRoom, title: '정산방: 알아서 나눠졌어요', who: '지우' },
  { id: '8', C: TopUp, title: '서준의 폰: 모자라면 충전', who: '서준' },
  { id: '9', C: VoiceSolo, title: '혼자 쓴 돈은 말로', who: '지우' },
  { id: '10', C: Wallet, title: '내 지갑과 오늘 가계부', who: '지우' },
  { id: '11', C: DayClose, title: '하루 마감: 곧 모자라요', who: '지우' },
  { id: '12', C: TripReport, title: '여행 끝: 진짜 총비용', who: '지우' },
]
const INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]))
// 10번 하단 탭 → 시연 화면
const TAB_STEP = { trip: '0-2', room: '7', ledger: '10', my: '12' }

const INIT = { daily: TRIP5.dailyLira, estimate: null, dinner: null, solo: null, topup: null }

// 새로고침해도 시연 상태가 남도록 (저장이 막힌 브라우저에서는 그냥 메모리로)
function useStored(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* 저장 불가 */ } }, [key, v])
  return [v, setV]
}

// 휴대폰 바로가기: ?step=10 → 그 화면, ?reset → 시연 상태 처음으로. 읽은 뒤 주소에서 지운다
function readLink() {
  try {
    const q = new URLSearchParams(location.search)
    if (!q.has('step') && !q.has('reset')) return null
    const link = { step: q.get('step'), reset: q.has('reset') }
    q.delete('step'); q.delete('reset')
    history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`)
    return link
  } catch { return null }
}
const LINK = readLink()
try {
  if (LINK?.reset) { localStorage.removeItem('tb5-state'); localStorage.removeItem('tb5-pos') }
  if (LINK?.step && LINK.step in INDEX) localStorage.setItem('tb5-pos', JSON.stringify(LINK.step))
} catch { /* 저장 불가 */ }

export default function App() {
  const [pos, setPos] = useStored('tb5-pos', LINK?.step in INDEX ? LINK.step : '0')
  const [state, setAll] = useStored('tb5-state', INIT)
  const [msg, setMsg] = useState('')
  const [back, setBack] = useState(false)
  const i = INDEX[pos] ?? 0
  const { id, C, title, who } = STEPS[i]

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 1800); return () => clearTimeout(t) }, [msg])

  const to = (n) => { const k = Math.min(Math.max(n, 0), STEPS.length - 1); setBack(k < i); setPos(STEPS[k].id) }
  const go = (target) => to(INDEX[String(target)] ?? i)
  const props = {
    next: () => to(i + 1),
    prev: () => to(i - 1),
    go,
    tab: (t) => go(TAB_STEP[t] ?? id),
    toast: setMsg,
    state,
    set: (patch) => setAll((s) => ({ ...s, ...patch })),
    restart: () => { setAll(INIT); go('0-1') },
  }

  return (
    <>
      <div className="demo" aria-label="시연 화면 이동">
        <button type="button" onClick={props.prev} disabled={i === 0} aria-label="이전 화면">‹</button>
        <span>{id}</span><b>{title}</b><span className="who">{who}의 폰</span>
        <button type="button" onClick={props.next} disabled={i === STEPS.length - 1} aria-label="다음 화면">›</button>
      </div>
      <div className={`phone ${back ? 'go-back' : ''}`}>
        <C key={id} {...props} />
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </>
  )
}
