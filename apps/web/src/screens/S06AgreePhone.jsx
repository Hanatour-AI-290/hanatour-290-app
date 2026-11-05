import { useEffect, useRef, useState } from 'react'
import { DINNER, IMG, PEOPLE } from '../demo.js'
import { Avatar, CountUp } from '../ui.jsx'
import { lira } from '../format.js'
import { dinnerOf } from '../dinner.js'
import './S06AgreePhone.css'

const ME = '하린'

// 6 하린의 폰: 맞아요 누르기 — 어두운 저녁 사진 위로 확인 시트
export default function AgreePhone({ next, toast, state }) {
  const d = dinnerOf(state)
  const [done, setDone] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  // 내 몫 내역: 내가 들어간 줄마다 줄 금액 ÷ 나눌 사람 수 (디자인: 케밥 450 + 맥주 180 + 생수 60)
  const parts = d.lines.filter((l) => l.people.includes(ME)).map((l) => ({ name: l.name.replace(/^에페스\s*/, ''), v: Math.round(l.amount / l.people.length) }))
  const mine = d === DINNER ? DINNER.shares[ME] : parts.reduce((a, p) => a + p.v, 0)

  const agree = () => {
    if (done) return
    setDone(true)
    toast(`${ME} 확인 완료, ${lira(mine)}리라가 빠졌어요`)
    timer.current = setTimeout(next, 700)
  }

  // Figma 프로토타입: 안 갔어요도 정산방(7)으로
  const decline = () => {
    if (done) return
    setDone(true)
    toast(`${d.payer}에게 안 갔다고 알렸어요`)
    timer.current = setTimeout(next, 700)
  }

  return (
    <section className="scr agr fade">
      <div className="agr-photo"><img className="kenburns" src={IMG('dinner.png')} alt="" /></div>
      <div className="agr-dim" />
      <div className="agr-sheet sheet-up">
        <i className="agr-grab" />
        <div className="agr-from rise" style={{ '--d': '0.2s' }}>
          <Avatar src={PEOPLE[d.payer]?.av ?? PEOPLE.지우.av} size={44} alt={d.payer} />
          <p>{d.payer}가 저녁값을<br />같이 나누자고 해요</p>
        </div>
        <img className="agr-pic rise" style={{ '--d': '0.26s' }} src={IMG('dinner.png')} width="327" height="140" alt="마가라 레스토랑 저녁 사진" />
        <p className="agr-what">{d.name}, 넷이 먹었어요</p>
        <p className="agr-label">내 몫</p>
        <p className="agr-amt"><CountUp to={mine} delay={450} /><span className="agr-unit">리라</span></p>
        <p className="agr-parts">{parts.map((p) => `${p.name} ${lira(p.v)}`).join(' + ')}</p>
        <div className="agr-btns">
          <button type="button" className="agr-no" onClick={decline} disabled={done}>안 갔어요</button>
          <button type="button" className={`agr-yes ${done ? 'on' : ''}`} onClick={agree}>
            {done && <i className="pop" style={{ '--d': '0s' }}><img src={IMG('s05-check.svg')} width="11" height="11" alt="" /></i>}
            맞아요
          </button>
        </div>
        <p className="agr-note">맞아요를 누르면 내 리라 잔액에서 바로 빠져요</p>
      </div>
    </section>
  )
}
