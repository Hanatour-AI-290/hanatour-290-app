import { useEffect, useRef } from 'react'
import { IMG, TRIP5 } from '../demo.js'
import { CountUp, Cta, Screen } from '../ui.jsx'
import './S12TripReport.css'

// 12 여행 끝: 진짜 총비용 (지우의 폰). 모두 디자인 시연 값 (만 원)
// (서버 /report 는 상품 분석 결과가 있어야 하는데 v5 흐름에 그 단계가 없어 부르지 않는다)
const TOTAL = 278
const PLANNED = 290
const PACKAGE = { name: '상품가', amount: 124, color: '#3a1c82' }
const LOCAL = [
  { name: '선택관광', amount: 60, color: '#5e2bb8' },
  { name: '식비', amount: 52, color: '#8a63db' },
  { name: '쇼핑', amount: 24, color: '#b9a2ee' },
  { name: '가이드 경비', amount: 10, color: '#f4b740' },
  { name: '교통', amount: 8, color: '#d9d3e8' },
]
const LOCAL_SUM = 154
const LEFT_FX = '리라 390, 유로 €140'
// 막대 조각 너비 (디자인 px, 사이 2px 빼고 285)
const BAR = [127, 62, 53, 25, 10, 8]

function Row({ p, main }) {
  return (
    <p className={`rep-row ${main ? 'main' : ''}`}>
      <span><i style={{ background: p.color }} />{p.name}</span>
      <b className="num-b">{p.amount}만 원</b>
    </p>
  )
}

export default function TripReport({ toast, restart }) {
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const leave = () => {
    toast('다음 여행자에게 남겼어요')
    clearTimeout(timer.current)
    timer.current = setTimeout(restart, 1000)
  }

  const parts = [PACKAGE, ...LOCAL]

  return (
    <Screen
      className="rep"
      bodyClass="rep-body"
      foot={<Cta onClick={leave}>다음 여행자에게 내 지출 남기기</Cta>}
    >
      <div className="rep-photo">
        <img className="kenburns" src={IMG('s01-capp.jpg')} alt="카파도키아 하늘을 나는 열기구" />
        <i className="rep-shade" />
      </div>

      <h1 className="rep-title rise" style={{ '--d': '0.05s' }}>{TRIP5.title}을<br />이렇게 썼어요</h1>

      <article className="rep-card sheet-up" style={{ '--d': '0.12s' }}>
        <p className="rep-label">진짜 총비용</p>
        <p className="rep-total"><CountUp to={TOTAL} delay={300} ms={1000} /><span>만 원</span></p>
        <p className="rep-badge pop" style={{ '--d': '0.55s' }}>처음 예상 {PLANNED}만 원보다 {PLANNED - TOTAL}만 원 덜 썼어요</p>

        <div className="rep-bar">
          {parts.map((p, i) => (
            <i key={p.name} className="grow-x" style={{ flexGrow: BAR[i], background: p.color, '--d': `${0.3 + i * 0.07}s` }} />
          ))}
        </div>

        <div className="rep-list stagger">
          <Row p={PACKAGE} main />
          <i className="rep-line" />
          <p className="rep-local">현지에서 쓴 돈 {LOCAL_SUM}만 원</p>
          {LOCAL.map((p) => <Row key={p.name} p={p} />)}
        </div>
      </article>

      <p className="rep-left rise" style={{ '--d': '0.4s' }}><span>남은 외화</span><b>{LEFT_FX}</b></p>
    </Screen>
  )
}
