import { DINNER, IMG, TRIP5 } from '../demo.js'
import { CountUp, TabBar, lira } from '../ui.jsx'
import './SHome.css'

// 홈 · 여행 중 첫 화면 (Figma 89:74). 여행 중에는 여기서 각 화면으로 간다
const STACK = ['home-st-j.png', 'home-st-h.png', 'home-st-d.png', 'home-st-s.png']
const CHECKS = [
  { to: '0-2', icon: 'home-pie.svg', title: '진짜 총비용 예상', sub: '상품가 124만 원, 예상 290만 원' },
  { to: '11', icon: 'home-moon.svg', title: '하루 마감', sub: '밤 10시에 오늘 쓴 돈을 정리해요' },
  { to: '12', icon: 'home-flag.svg', title: '여행 끝 리포트', sub: '돌아오는 날 열려요' },
]

export default function Home({ state, go, tab }) {
  // 오늘 쓴 리라 = 저녁 내 몫 + 혼자 쓴 돈(리라일 때만). 10번 가계부와 같은 계산
  const daily = state.daily ?? TRIP5.dailyLira
  const soloLira = !state.solo ? 300 : (state.solo.currency ?? 'TRY') === 'TRY' ? state.solo.amount : 0
  const spent = DINNER.shares.지우 + soloLira
  const left = Math.max(daily - spent, 0)

  return (
    <section className="scr home fade">
      <div className="scr-body">
        <header className="home-head rise">
          <div>
            <p className="home-trip">튀르키예 일주 7박, 지우님</p>
            <h1>DAY {TRIP5.today}, {TRIP5.todayPlace}</h1>
          </div>
          <img className="av" src={IMG('home-av-jiwoo.png')} width="42" height="42" alt="지우" />
        </header>

        <div className="home-today sheet-up" style={{ '--d': '0.05s' }} role="button" tabIndex={0} onClick={() => go('10')} onKeyDown={(e) => e.key === 'Enter' && go('10')}>
          <span className="home-today-top">
            <span>오늘 쓸 수 있는 돈</span>
            <small>{lira(daily)}리라 중 {lira(spent)}리라 씀</small>
          </span>
          <span className="home-left">
            <CountUp to={left} />
            <span>리라 남았어요</span>
          </span>
          <span className="home-bar"><i className="grow-x" style={{ '--d': '0.35s', width: `${Math.min(100, (spent / daily) * 100)}%` }} /></span>
        </div>

        <div className="home-rest stagger">
          <div className="home-actions">
            <button type="button" className="home-act" onClick={() => go('4')}>
              <span className="home-ico brand"><img src={IMG('home-camera.svg')} width="20" height="20" alt="" /></span>
              <span className="home-txt"><b>영수증 찍기</b><small>같이 낸 돈 나누기</small></span>
            </button>
            <button type="button" className="home-act" onClick={() => go('9')}>
              <span className="home-ico soft"><img src={IMG('home-mic.svg')} width="20" height="20" alt="" /></span>
              <span className="home-txt"><b>말로 적기</b><small>혼자 쓴 돈 기록</small></span>
            </button>
          </div>

          <button type="button" className="home-room" onClick={() => go('7')}>
            <span className="home-stack">
              {STACK.map((f) => <img key={f} src={IMG(f)} width="30" height="30" alt="" />)}
            </span>
            <span className="home-txt grow"><b>튀르키예 7박 정산방</b><small>서준: 나 리라 충전하고 바로 보낼게</small></span>
            <span className="home-badge pop" style={{ '--d': '0.5s' }}>2</span>
          </button>

          <h2 className="home-sec">여행 챙기기</h2>

          <ul className="home-list">
            {CHECKS.map((c) => (
              <li key={c.to}>
                <button type="button" onClick={() => go(c.to)}>
                  <span className="home-ico small"><img src={IMG(c.icon)} width="17" height="17" alt="" /></span>
                  <span className="home-txt grow"><b>{c.title}</b><small>{c.sub}</small></span>
                  <img src={IMG('home-chev.svg')} width="16" height="16" alt="" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <TabBar tab="trip" go={tab} />
    </section>
  )
}
