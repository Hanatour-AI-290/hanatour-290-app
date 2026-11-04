import { useState } from 'react'
import { IMG, PEOPLE, TRIP5 } from '../demo.js'
import { Avatar, Cta } from '../ui.jsx'
import './S02PickName.css'

// 2 초대받은 사람: 이름 고르기 (하린의 폰). 지우는 방장이라 이미 들어와 있다
const NAMES = [
  { name: '지우', joined: true },
  { name: '하린' },
  { name: '도윤' },
  { name: '서준' },
]

/** 받침 따라 '으로/로' (받침 없음 · ㄹ 받침 → 로) */
function ro(name) {
  const c = name.charCodeAt(name.length - 1) - 0xac00
  if (c < 0 || c > 11171) return `${name}로`
  const jong = c % 28
  return jong === 0 || jong === 8 ? `${name}로` : `${name}으로`
}

export default function PickName({ next, toast }) {
  const [pick, setPick] = useState('하린')

  return (
    <section className="scr pick fade">
      <header className="pick-head">
        <div className="rise" style={{ '--d': '0.06s' }}>
          <h1>지우님이<br />정산방에 초대했어요</h1>
          <p>{TRIP5.title}</p>
        </div>
        <img className="pick-mascot" src={IMG('mascot.png')} width="96" height="142" alt="" />
      </header>

      <div className="pick-sheet sheet-up" style={{ '--d': '0.1s' }}>
        <h2>내 이름을 골라 주세요</h2>
        <p className="pick-sub">로그인 없이 바로 들어가요</p>

        <div className="pick-list stagger" role="radiogroup" aria-label="내 이름">
          {NAMES.map(({ name, joined }) => {
            const on = pick === name
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={joined}
                className={`pick-opt ${on ? 'on' : ''} ${joined ? 'joined' : ''}`}
                onClick={() => setPick(name)}
              >
                <Avatar src={PEOPLE[name].av} size={40} alt="" />
                <span className="pick-name">
                  {name}
                  {joined && <small>이미 들어왔어요</small>}
                </span>
                <span className="pick-radio">
                  {on && <img key={name} className="pop" style={{ '--d': '0s' }} src={IMG('s02-check.svg')} width="14" height="14" alt="" />}
                </span>
              </button>
            )
          })}
        </div>

        <button type="button" className="pick-none" onClick={() => toast('지우님에게 명단에 넣어 달라고 말해 주세요')}>명단에 내 이름이 없어요</button>

        <div className="pick-foot">
          <Cta onClick={next}>{ro(pick)} 들어가기</Cta>
        </div>
      </div>
    </section>
  )
}
