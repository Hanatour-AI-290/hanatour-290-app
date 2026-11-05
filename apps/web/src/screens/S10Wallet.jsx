import { IMG, MY_WALLET, PEOPLE, TRIP5 } from '../demo.js'
import { Avatar, CountUp, TabBar } from '../ui.jsx'
import { lira } from '../format.js'
import './S10Wallet.css'

const UNIT = { TRY: '리라', EUR: '유로', KRW: '원', USD: '달러', JPY: '엔' }

// 10 내 지갑과 오늘 가계부 (지우의 폰). 오늘 쓴 돈 = 저녁 내 몫 + 혼자 쓴 기념품
export default function Wallet({ state, tab, go, toast }) {
  const daily = state.daily ?? TRIP5.dailyLira
  const solo = state.solo ?? { name: '기념품', amount: 300, method: '현금', category: '쇼핑', krw: '약 1만 원' }
  const rows = [
    { img: IMG('dinner.png'), name: '마가라 레스토랑 저녁', sub: '같이 씀, 내 몫', amount: -510, currency: 'TRY', krw: '약 1.7만 원' },
    { img: IMG('souvenir.png'), name: solo.name, sub: `${solo.method}, ${solo.category}${solo.plan ? ' · 일정에 기록' : ''}`, amount: -solo.amount, currency: solo.currency ?? 'TRY', krw: solo.krw },
  ]
  // 하루 생활비는 리라 기준이라 리라로 쓴 돈만 더한다
  const spent = rows.filter((r) => r.currency === 'TRY').reduce((a, r) => a - r.amount, 0)
  const left = daily - spent

  return (
    <section className="scr wallet fade">
      <div className="scr-body">
        <header className="w-head rise">
          <h1>내 지갑</h1>
          <Avatar src={PEOPLE.지우.av} size={34} alt="지우" />
        </header>

        <div className="w-cards">
          <article className="w-card try sheet-up" style={{ '--d': '0.06s' }}>
            <p className="w-cur">튀르키예 리라</p>
            <p className="w-amt"><CountUp to={MY_WALLET.TRY} /><small>리라</small></p>
            <div className="w-row">
              <button type="button" className="w-charge" onClick={() => go('11')}><img src={IMG('icon-plus.svg')} width="14" height="14" alt="" />충전</button>
              <span className="w-recv">받을 돈 {lira(MY_WALLET.receivable)}</span>
            </div>
          </article>
          <article className="w-card eur sheet-up" style={{ '--d': '0.14s' }}>
            <p className="w-cur">유로</p>
            <p className="w-amt"><b className="num-b">€</b><CountUp to={MY_WALLET.EUR} delay={250} /></p>
            <button type="button" className="w-charge soft" onClick={() => toast('유로 충전은 시연 범위 밖이에요')}><img src={IMG('icon-plus.svg')} width="14" height="14" alt="" />충전</button>
          </article>
        </div>

        <div className="w-today rise" style={{ '--d': '0.2s' }} role="button" tabIndex={0} onClick={() => go('11')} onKeyDown={(e) => e.key === 'Enter' && go('11')}>
          <div className="w-today-head">
            <h2>오늘, DAY {TRIP5.today}</h2>
            <span className="num-b">{lira(daily)}리라 중 <CountUp to={spent} className="" delay={350} />리라</span>
          </div>
          <div className="w-bar"><i className="grow-x" style={{ '--d': '0.35s', width: `${Math.min(100, (spent / daily) * 100)}%` }} /></div>
          <p className="w-left">{left >= 0 ? `오늘 ${lira(left)}리라 더 쓸 수 있어요` : `오늘 ${lira(-left)}리라 더 썼어요`}</p>

          <ul className="w-list stagger">
            {rows.map((r) => (
              <li key={r.name}>
                <img className="w-thumb" src={r.img} width="44" height="44" alt="" />
                <div className="w-txt"><p>{r.name}</p><small>{r.sub}</small></div>
                <div className="w-val"><p className="num">{lira(r.amount)}{UNIT[r.currency] ?? ` ${r.currency}`}</p><small>{r.krw}</small></div>
              </li>
            ))}
            <li>
              <Avatar src={PEOPLE.서준.av} size={44} alt="" />
              <div className="w-txt"><p>서준에게 받을 돈</p><small>충전하면 알아서 들어와요</small></div>
              <div className="w-val"><p className="num plus">+{lira(MY_WALLET.receivable)}리라</p></div>
            </li>
          </ul>
          <p className="w-note">원화는 결제한 날 환율로 고정해서 적어요</p>
        </div>
      </div>
      <TabBar tab="ledger" go={tab} />
    </section>
  )
}
