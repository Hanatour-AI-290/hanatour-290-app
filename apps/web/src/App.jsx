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
import { TRIP5 } from './demo.js'

// 시연 순서 (Figma 화면 번호와 같다). who = 이 화면이 누구 폰인지
const STEPS = [
  { C: Splash, title: '스플래시', who: '지우' },
  { C: Invite, title: '친구 초대하기', who: '지우' },
  { C: PickName, title: '초대받은 사람: 이름 고르기', who: '하린' },
  { C: DailyBudget, title: '여행 전: 하루 생활비 정하기', who: '지우' },
  { C: Capture, title: '찍고 말하기', who: '지우' },
  { C: SplitConfirm, title: '이렇게 나눌까요?', who: '지우' },
  { C: AgreePhone, title: '하린의 폰: 맞아요 누르기', who: '하린' },
  { C: SettleRoom, title: '정산방: 알아서 나눠졌어요', who: '지우' },
  { C: TopUp, title: '서준의 폰: 모자라면 충전', who: '서준' },
  { C: VoiceSolo, title: '혼자 쓴 돈은 말로', who: '지우' },
  { C: Wallet, title: '내 지갑과 오늘 가계부', who: '지우' },
  { C: DayClose, title: '하루 마감: 곧 모자라요', who: '지우' },
  { C: TripReport, title: '여행 끝: 진짜 총비용', who: '지우' },
]
// 10번 하단 탭 → 시연 화면
const TAB_STEP = { trip: 3, room: 7, ledger: 10, my: 12 }

const INIT = { daily: TRIP5.dailyLira, dinner: null, solo: null, topup: null }

// 새로고침해도 시연 상태가 남도록 (저장이 막힌 브라우저에서는 그냥 메모리로)
function useStored(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* 저장 불가 */ } }, [key, v])
  return [v, setV]
}

export default function App() {
  const [step, setStep] = useStored('tb5-step', 0)
  const [state, setAll] = useStored('tb5-state', INIT)
  const [msg, setMsg] = useState('')
  const [back, setBack] = useState(false)
  const i = Math.min(Math.max(step, 0), STEPS.length - 1)
  const { C, title, who } = STEPS[i]

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 1800); return () => clearTimeout(t) }, [msg])

  const go = (n) => { setBack(n < i); setStep(Math.min(Math.max(n, 0), STEPS.length - 1)) }
  const props = {
    next: () => go(i + 1),
    prev: () => go(i - 1),
    go,
    tab: (id) => go(TAB_STEP[id] ?? i),
    toast: setMsg,
    state,
    set: (patch) => setAll((s) => ({ ...s, ...patch })),
    restart: () => { setAll(INIT); go(1) },
  }

  return (
    <>
      <div className="demo" aria-label="시연 화면 이동">
        <button type="button" onClick={props.prev} disabled={i === 0} aria-label="이전 화면">‹</button>
        <span>{i}</span><b>{title}</b><span className="who">{who}의 폰</span>
        <button type="button" onClick={props.next} disabled={i === STEPS.length - 1} aria-label="다음 화면">›</button>
      </div>
      <div className={`phone ${back ? 'go-back' : ''}`}>
        <C key={i} {...props} />
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </>
  )
}
