import { useEffect, useRef, useState } from 'react'
import { IMG } from './demo.js'

/** 위 내용 + 아래 버튼 뼈대. foot 이 없으면 버튼 줄을 그리지 않는다 */
export function Screen({ className = '', body, foot, children, bodyClass = '' }) {
  return (
    <section className={`scr fade ${className}`}>
      <div className={`scr-body ${bodyClass}`}>{body ?? children}</div>
      {foot && <div className="scr-foot">{foot}</div>}
    </section>
  )
}

export function Cta({ children, line, ...p }) {
  return <button type="button" className={`cta ${line ? 'line' : ''}`} {...p}>{children}</button>
}

export function Back({ onClick, icon = 'icon-back.svg', label = '뒤로' }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label}>
      <img src={IMG(icon)} width="26" height="26" alt="" />
    </button>
  )
}

export function Avatar({ src, size = 34, alt = '' }) {
  return <img className="av" src={src} width={size} height={size} alt={alt} />
}

// [id, 이름, 꺼진 아이콘, 켜진 아이콘] — Figma 탭 아이콘은 색이 고정된 SVG 라 켜짐·꺼짐을 따로 둔다
const TABS = [
  ['trip', '여행', 'icon-home.svg', 'icon-home-on.svg'],
  ['room', '정산방', 'icon-chat.svg', 'icon-chat.svg'],
  ['ledger', '가계부', 'icon-wallet-off.svg', 'icon-wallet.svg'],
  ['my', 'MY', 'icon-user.svg', 'icon-user.svg'],
]

export function TabBar({ tab, go }) {
  return (
    <nav className="tabbar">
      {TABS.map(([id, label, off, on]) => (
        <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}>
          <img src={IMG(tab === id ? on : off)} width="22" height="22" alt="" />
          {label}
        </button>
      ))}
    </nav>
  )
}

export const lira = (n) => n.toLocaleString('ko-KR')

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 금액이 0(또는 직전 값)에서 목표까지 부드럽게 올라간다. 값이 바뀌면 이어서 움직인다 */
export function useCountUp(to, { ms = 900, delay = 150 } = {}) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (reduced()) return
    const start = from.current
    const anim = { raf: 0, t0: null }
    const tick = (t) => {
      anim.t0 ??= t
      const p = Math.min(1, Math.max(0, (t - anim.t0 - delay) / ms))
      const e = 1 - (1 - p) ** 3 // 끝에서 천천히
      const cur = Math.round(start + (to - start) * e)
      setV(cur)
      from.current = cur
      if (p < 1) anim.raf = requestAnimationFrame(tick)
    }
    anim.raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(anim.raf)
  }, [to, ms, delay])
  return reduced() ? to : v
}

/** 숫자 올라가기. format 기본은 천 단위 쉼표 */
export function CountUp({ to, ms, delay, format = lira, className = 'num' }) {
  const v = useCountUp(to, { ms, delay })
  return <span className={className}>{format(v)}</span>
}
