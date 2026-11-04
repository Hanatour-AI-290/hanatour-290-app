import { useState } from 'react'
import { postJson, toMinor } from '../api.js'
import { DINNER, IMG } from '../demo.js'
import { MEMBER_IDS, ROOM, WALLETS } from '../sample.js'
import { Cta, lira } from '../ui.jsx'
import { dinnerExpense } from './S05SplitConfirm.jsx'
import './S08TopUp.css'

const ME = '서준'
const BALANCE = 400 // 디자인 시연 값: 서준의 리라 잔액
const OPTIONS = [110, 500, 1000]

/** 충전 뒤 지갑으로 저녁값을 반영해 본다 (/api/settle/wallets). 남는 리라를 돌려준다. 실패하면 null */
async function tryApply(n) {
  const id = MEMBER_IDS[ME]
  const wallets = WALLETS.map((w) => (w.memberId !== id ? w : {
    ...w,
    balances: w.balances.map((b) => (b.currency === 'TRY' && b.method === 'card' ? { ...b, amount: toMinor(BALANCE + n, 'TRY') } : b)),
  }))
  const call = postJson('/api/settle/wallets', { members: ROOM, wallets, expense: dinnerExpense(DINNER, 'confirmed') })
  const late = new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))
  try {
    const r = await Promise.race([call, late])
    if (r.shortages?.some((s) => s.memberId === id)) return null
    const card = r.wallets?.find((w) => w.memberId === id)?.balances.find((b) => b.currency === 'TRY' && b.method === 'card')
    return card ? card.amount / 100 : null
  } catch {
    return null
  }
}

// 8 서준의 폰: 모자라면 충전
export default function TopUp({ next, set, toast }) {
  const share = DINNER.shares[ME] // 510
  const short = share - BALANCE // 110
  const [n, setN] = useState(500)
  const [busy, setBusy] = useState(false)
  const left = BALANCE + n - share

  const charge = async () => {
    if (busy) return
    setBusy(true)
    const got = await tryApply(n)
    if (got != null && got !== left) console.info('[8번] 서버 계산 남는 돈', got, '화면', left)
    set({ topup: n })
    toast(`${lira(n)}리라 충전, 지우에게 ${lira(share)}리라 보냈어요`)
    next()
  }

  return (
    <section className="scr top fade">
      <div className="scr-body">
        <img className="top-mascot rise" style={{ '--d': '0.1s' }} src={IMG('mascot.png')} width="92" height="136" alt="" />
        <div className="top-in">
          <h1 className="top-title rise">저녁값 {lira(share)}리라 중<br />{lira(short)}리라가 모자라요</h1>
          <p className="top-sub rise" style={{ '--d': '0.05s' }}>충전하면 지우에게 바로 보내져요</p>

          <div className="top-card sheet-up" style={{ '--d': '0.1s' }}>
            <div className="top-row"><span>내 몫</span><b className="num-b">{lira(share)}리라</b></div>
            <div className="top-row"><span>내 리라 잔액</span><b className="num-b">{lira(BALANCE)}리라</b></div>
            <div className="top-bar">
              <i className="grow-x" style={{ flexGrow: BALANCE, '--d': '0.3s' }} />
              <i className="grow-x short" style={{ flexGrow: short, '--d': '0.75s' }} />
            </div>
            <div className="top-row top-short"><span>모자란 돈</span><b className="num pop" style={{ '--d': '0.55s' }}>{lira(short)}리라</b></div>
          </div>

          <h2 className="top-q rise" style={{ '--d': '0.25s' }}>얼마나 충전할까요?</h2>
          <div className="top-chips stagger" role="radiogroup">
            {OPTIONS.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={n === v} className={`num-b ${n === v ? 'on' : ''}`} onClick={() => setN(v)}>{lira(v)}리라</button>
            ))}
          </div>
          <p className="top-desc rise" style={{ '--d': '0.35s' }}>
            {lira(n)}리라를 넣으면 기다리던 {lira(share)}리라가 한 번에 지우에게 가고, {left > 0 ? `${lira(left)}리라가 남아요.` : '남는 돈은 없어요.'}
          </p>
        </div>
      </div>
      <div className="scr-foot">
        <Cta onClick={charge} disabled={busy}><span className="num-b">{lira(n)}리라 충전하기</span></Cta>
      </div>
    </section>
  )
}
