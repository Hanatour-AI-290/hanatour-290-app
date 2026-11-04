import { useState } from 'react'
import { IMG, TRIP5 } from '../demo.js'
import { Back, CountUp, Screen, Cta, lira } from '../ui.jsx'
import './S03DailyBudget.css'

// 3 여행 전: 하루 생활비 정하기 (지우의 폰). 일정 속 날짜·장소·추가 비용은 디자인 예시 값
const DAYS = [
  { day: 3, place: '카파도키아' },
  { day: 5, place: '안탈리아', extra: '+ 유람선 €60' },
  { day: 7, place: '이스탄불' },
]
const STEPS = [-100, 100, 500]
const MIN = 100

export default function DailyBudget({ next, prev, toast, state, set }) {
  const [daily, setDaily] = useState(state.daily ?? TRIP5.dailyLira)

  return (
    <Screen
      className="bud"
      foot={<Cta onClick={() => { set({ daily }); next() }}>이대로 정하기</Cta>}
      body={
        <div className="bud-body">
          <Back onClick={prev} />
          <div className="bud-q rise" style={{ '--d': '0.04s' }}>
            <h1>현지에서 하루에<br />얼마쯤 쓸 것 같아요?</h1>
            <p>따로 사 먹는 밥, 교통비, 입장료처럼<br />상품가에 없는 돈이에요</p>
          </div>

          <div className="bud-amt rise" style={{ '--d': '0.12s' }}>
            <CountUp to={daily} ms={500} delay={0} />
            <span>리라</span>
          </div>
          <div className="bud-line grow-x" style={{ '--d': '0.2s' }} />

          <div className="bud-chips rise" style={{ '--d': '0.18s' }}>
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                className="num-b"
                disabled={daily + s < MIN}
                onClick={() => setDaily((d) => Math.max(MIN, d + s))}
              >
                {s < 0 ? '-' : '+'} {Math.abs(s)}
              </button>
            ))}
          </div>

          <div className="bud-ref rise" style={{ '--d': '0.24s' }}>
            <img src={IMG('s03-book.svg')} width="18" height="18" alt="" />
            <div className="bud-ref-txt">
              <p>여행 블로그 글 참고 값 [출처 확인 중]</p>
              <small>물가를 보고 직접 고쳐도 돼요</small>
            </div>
            <button type="button" onClick={() => toast('출처를 확인하는 중이에요')}>글 보기</button>
          </div>

          <h2 className="bud-h rise" style={{ '--d': '0.3s' }}>그러면 날마다 이만큼 써요</h2>
          <ul className="bud-days stagger">
            {DAYS.map((d) => (
              <li key={d.day}>
                <span className="bud-day">DAY {d.day}</span>
                <span className="bud-place">{d.place}</span>
                <span className="bud-val">
                  <b className="num-b">{lira(daily)}리라</b>
                  {d.extra && <small>{d.extra}</small>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  )
}
