import { useEffect } from 'react'
import { IMG } from '../demo.js'
import './S00Splash.css'

export default function Splash({ next }) {
  useEffect(() => { const t = setTimeout(next, 1800); return () => clearTimeout(t) }, [next])
  return (
    <button type="button" className="scr splash fade" onClick={next} aria-label="시작하기">
      <img className="splash-mascot" src={IMG('mascot.png')} width="150" height="222" alt="" />
      <div className="splash-title">
        <h1>트립버짓</h1>
        <p>같이 쓴 돈은 알아서 나눠지는<br />여행 가계부</p>
      </div>
      <small>하나투어 패키지 여행과 함께</small>
    </button>
  )
}
