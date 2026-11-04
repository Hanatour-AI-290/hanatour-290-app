import { DINNER, IMG, PEOPLE, TRIP5 } from '../demo.js'
import { lira } from '../ui.jsx'
import { dinnerOf } from './S05SplitConfirm.jsx'
import './S07SettleRoom.css'

const ALL = ['지우', '하린', '도윤', '서준']
// 디자인 시연 상태: 하린·도윤은 냈고, 서준은 리라가 모자라 충전 기다리는 중
const PAID = { 하린: true, 도윤: true, 서준: false }

// 7 정산방: 알아서 나눠졌어요 (지우의 폰)
export default function SettleRoom({ next, prev, go, state }) {
  const d = dinnerOf(state)
  const shares = DINNER.shares // 시연 몫 (5번과 같은 510/690/690/510)
  const others = ALL.filter((n) => n !== d.payer)
  const got = others.filter((n) => PAID[n]).reduce((a, n) => a + shares[n], 0) // 1,380

  return (
    <section className="scr room fade">
      <header className="room-head">
        <button type="button" className="icon-btn room-back" onClick={prev} aria-label="뒤로">
          <img src={IMG('s07-back.svg')} width="24" height="24" alt="" />
        </button>
        <div className="room-title">
          <p>튀르키예 7박 정산방</p>
          <small>{ALL.length}명</small>
        </div>
        <span className="room-stack">
          {ALL.map((n) => <img key={n} src={PEOPLE[n].av} width="30" height="30" alt={n} />)}
        </span>
      </header>

      <div className="scr-body">
        <div className="room-feed stagger">
          <div className="room-center"><span className="room-day">DAY {TRIP5.today}, {TRIP5.todayPlace}</span></div>
          <div className="room-center"><span className="room-sys">하린, 도윤, 서준이 들어왔어요</span></div>

          <div className="room-mine">
            <span className="room-time">오후 9:12</span>
            <article className="room-bill">
              <img className="room-bill-pic" src={IMG('dinner.png')} width="262" height="112" alt="마가라 레스토랑 저녁 사진" />
              <div className="room-bill-in">
                <div className="room-bill-top">
                  <div><p>{d.name}</p><small>넷이 나눴어요</small></div>
                  <p className="num">{lira(d.total)}리라</p>
                </div>
                <img className="room-dash" src={IMG('s07-dash.svg')} width="234" height="1.5" alt="" />
                {others.map((n, i) => (
                  <div key={n} className="room-who">
                    <img className="av" src={PEOPLE[n].av} width="22" height="22" alt="" />
                    <p>{n}</p>
                    <b className="num-b">{lira(shares[n])}</b>
                    {PAID[n]
                      ? <span className="room-st ok pop" style={{ '--d': `${0.5 + i * 0.12}s` }}><img src={IMG('s07-check.svg')} width="13" height="13" alt="" />냈어요</span>
                      : <span className="room-st wait pop" style={{ '--d': `${0.5 + i * 0.12}s` }}><img src={IMG('s07-clock.svg')} width="13" height="13" alt="" />충전 기다리는 중</span>}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="room-center"><span className="room-in"><i />{lira(got)}리라가 내 지갑에 들어왔어요</span></div>

          <div className="room-msg">
            <img className="av" src={PEOPLE.도윤.av} width="32" height="32" alt="" />
            <div><small>도윤</small><p className="room-bubble">잘 먹었어! 내일 아침 커피는 내가 살게</p></div>
          </div>
          <button type="button" className="room-msg" onClick={next} aria-label="서준의 폰으로">
            <img className="av" src={PEOPLE.서준.av} width="32" height="32" alt="" />
            <div><small>서준</small><p className="room-bubble">나 리라 충전하고 바로 보낼게</p></div>
          </button>
        </div>
      </div>

      <footer className="room-compose">
        <button type="button" className="room-cam" onClick={() => go(4)} aria-label="영수증 찍기">
          <img src={IMG('s07-camera.svg')} width="22" height="22" alt="" />
        </button>
        <button type="button" className="room-talk" onClick={() => go(9)}>
          <img src={IMG('s07-mic.svg')} width="20" height="20" alt="" />
          꾹 누르고 말하기
        </button>
      </footer>
    </section>
  )
}
