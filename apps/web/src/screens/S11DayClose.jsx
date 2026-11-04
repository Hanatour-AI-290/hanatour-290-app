import { DINNER, IMG, MY_WALLET, TRIP5 } from '../demo.js'
import { CountUp, lira } from '../ui.jsx'
import './S11DayClose.css'

// 11 하루 마감: 곧 모자라요 (지우의 폰, DAY 3 밤 10시)
// 디자인 계산은 '하루 예산' 기준: 남은 5일 × 하루 생활비 − 지금 남은 리라 = 모자라는 돈
// (서버 /settle/day 는 '쓰는 속도' 기준이라 여기서는 부르지 않는다)
const DAYS_LEFT = 5
// 디자인 속 작은 별 (x, y, 크기, 반짝임 지연)
const STARS = [[40, 90, 4, 0], [300, 70, 3, 1.6], [330, 160, 4, 0.8], [180, 60, 3, 2.4]]

export default function DayClose({ state, go, next, toast }) {
  const daily = state.daily ?? TRIP5.dailyLira
  // 오늘 쓴 돈 = 저녁 내 몫 510 + 혼자 쓴 기념품 300 = 810 (10번 가계부와 같은 값)
  // 리라로 쓴 돈만 하루 생활비(리라)와 비교한다
  const soloLira = !state.solo ? 300 : (state.solo.currency ?? 'TRY') === 'TRY' ? state.solo.amount : 0
  const spent = DINNER.shares.지우 + soloLira
  const diff = daily - spent
  const left = MY_WALLET.TRY
  const need = DAYS_LEFT * daily
  const short = need - left

  const topUp = () => {
    toast(short > 0 ? `${lira(short)}리라 충전했어요` : '지금은 충전하지 않아도 돼요')
    next()
  }

  return (
    <section className="scr close fade">
      {STARS.map(([x, y, s, d]) => (
        <i key={`${x}-${y}`} className="close-star" style={{ left: x, top: y, width: s, height: s, '--tw': `${d}s` }} />
      ))}

      <div className="scr-body close-body">
        <p className="close-chip rise">
          <img src={IMG('s11-moon.svg')} width="14" height="14" alt="" />
          DAY {TRIP5.today} 마감, 밤 10시
        </p>

        <h1 className="close-title rise" style={{ '--d': '0.06s' }}>
          오늘은 {lira(spent)}리라<br />썼어요
        </h1>
        <p className="close-diff rise" style={{ '--d': '0.12s' }}>
          {diff >= 0 ? `예산보다 ${lira(diff)}리라 덜 썼어요` : `예산보다 ${lira(-diff)}리라 더 썼어요`}
        </p>

        <div className="close-stats rise" style={{ '--d': '0.18s' }}>
          <div><span>남은 리라</span><b className="num">{lira(left)}</b></div>
          <div><span>받을 돈</span><b className="num">{lira(MY_WALLET.receivable)}</b></div>
          <div><span>유로</span><b className="num">€{lira(MY_WALLET.EUR)}</b></div>
        </div>

        <article className="close-card sheet-up" style={{ '--d': '0.24s' }}>
          <h2 className="close-head">
            <span className="close-alert"><img src={IMG('s11-alert.svg')} width="16" height="16" alt="" /></span>
            {short > 0 ? '리라가 곧 모자라요' : '리라가 넉넉해요'}
          </h2>

          <div className="close-calc">
            <p><span>지금 남은 리라</span><b className="num-b">{lira(left)}</b></p>
            <p><span>남은 {DAYS_LEFT}일 × 하루 {lira(daily)}</span><b className="num-b">{lira(need)}</b></p>
            <i />
            <p className="close-short">
              <span>{short > 0 ? '모자라는 돈' : '남는 돈'}</span>
              <b className={`pop ${short > 0 ? '' : 'ok'}`} style={{ '--d': '0.6s' }}>
                <CountUp to={Math.abs(short)} delay={600} ms={700} />리라
              </b>
            </p>
          </div>

          <div className="close-btns">
            <button type="button" className="cta line close-cut" onClick={() => go('3')}>생활비 줄이기</button>
            <button type="button" className="cta" onClick={topUp}>리라 충전하기</button>
          </div>
        </article>

        <img className="close-mascot rise" style={{ '--d': '0.4s' }} src={IMG('mascot.png')} width="110" height="163" alt="동전을 든 보라 캐리어" />
      </div>
    </section>
  )
}
