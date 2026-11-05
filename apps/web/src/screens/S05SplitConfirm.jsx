import { useState } from 'react'
import { usePost, fromMinor } from '../api.js'
import { DINNER, IMG, PEOPLE } from '../demo.js'
import { ROOM } from '../sample.js'
import { Back, CountUp, Cta, Screen } from '../ui.jsx'
import { lira } from '../format.js'
import { ORDER, dinnerExpense, dinnerOf, mismatchOf, voiceOf } from '../dinner.js'
import './S05SplitConfirm.css'

// 영수증 아래 설명: 한 명이면 디자인 문구, 여러 명이면 "지우 2,000 · 하린 1,560리라 냈어요"
function paidText(d) {
  const unit = (d.currency ?? 'TRY') === 'TRY' ? '리라' : ` ${d.currency}`
  if (d.payers?.length > 1) {
    const known = d.payers.every((p) => p.amount != null)
    return known
      ? `${d.payers.map((p) => `${p.name} ${lira(p.amount)}`).join(' · ')}${unit} 냈어요`
      : `${d.payers.map((p) => p.name).join(' · ')}${josa(d.payers.at(-1).name)} 나눠 냈어요`
  }
  return `${d.payer}가 카드로 ${lira(d.total)}${unit} 냈어요`
}

// 받침이 있으면 "이", 없으면 "가" (하린이 · 지우가)
const josa = (name) => { const c = name.charCodeAt(name.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '이' : '가' }

const DEFAULT_CHIPS = ['네, 똑같이', '직접 고를래요']

const who = (people) => (people.length === 4 ? '넷이 나눠요' : people.join(', '))

// 5 이렇게 나눌까요? (지우의 폰) — 영수증 줄마다 나눌 사람, 사람별 몫은 서버(/api/settle)가 계산
export default function SplitConfirm({ next, prev, toast, state }) {
  const d = dinnerOf(state)
  const [pick, setPick] = useState(0)
  const ask = d.questions?.[0] // 서버 질문이 있으면 디자인 질문 대신
  const chips = ask?.options ?? DEFAULT_CHIPS
  const bad = mismatchOf(d)
  const { data } = usePost('/api/settle', { members: ROOM, expenses: [dinnerExpense(d)] })

  // 서버 몫 → 이름별 리라. 디자인 값(510/690/690/510)과 다르면 디자인 값을 쓴다
  const server = data?.byCurrency?.[d.currency ?? 'TRY']?.shares
  const fromServer = server && Object.fromEntries(ORDER.map((n) => [n, fromMinor(server[PEOPLE[n].id] ?? 0, 'TRY')]))
  const sameAsDesign = fromServer && ORDER.every((n) => fromServer[n] === DINNER.shares[n])
  const shares = d === DINNER ? DINNER.shares : (fromServer ?? DINNER.shares)
  if (fromServer && d === DINNER && !sameAsDesign) console.info('[5번] 서버 몫이 디자인 값과 달라요', fromServer)

  return (
    <Screen
      className="spl"
      body={
        <div className="spl-body">
          <div className="spl-top">
            <Back onClick={prev} />
            <button type="button" className="spl-edit" onClick={() => toast('줄을 눌러 사람을 바꿀 수 있어요')}>고치기</button>
          </div>
          <h1 className="spl-title rise">이렇게 나눌까요?</h1>
          <div className="spl-head rise" style={{ '--d': '0.06s' }}>
            <img className="spl-receipt" src={IMG('s05-receipt.jpg')} width="40" height="54" alt="영수증 사진" />
            <div>
              <p className="spl-name">{d.name}</p>
              <p className="spl-sub">{paidText(d)}</p>
            </div>
          </div>

          <div className="spl-slip sheet-up" style={{ '--d': '0.1s' }}>
            <div className="spl-paper">
              <ul className="spl-lines stagger">
                {d.lines.map((l, i) => (
                  <li key={`${i}-${l.name}`} className="spl-line">
                    {i > 0 && <img className="spl-dash" src={IMG('s05-dash.svg')} width="299" height="1.5" alt="" />}
                    <div className="spl-line-in">
                      <div className="spl-row">
                        <div className="spl-item">
                          <p>{l.name}</p>
                          {l.raw && <small>{l.raw}</small>}
                        </div>
                        <p className="num">{lira(l.amount)}</p>
                      </div>
                      <div className="spl-who">
                        <span className="spl-stack">
                          {l.people.map((n) => <img key={n} src={PEOPLE[n]?.av} width="26" height="26" alt={n} />)}
                        </span>
                        <span>{who(l.people)}</span>
                      </div>
                      {voiceOf(d, i) && <p className="spl-voice">말한 내용 "{voiceOf(d, i)}"</p>}
                    </div>
                  </li>
                ))}
              </ul>
              <img className="spl-dash" src={IMG('s05-dash.svg')} width="299" height="1.5" alt="" />
              <div className="spl-sum">
                {bad ? (
                  <span className="spl-ok spl-bad"><i className="pop" style={{ '--d': '0.45s' }}><img src={IMG('s11-alert.svg')} width="16" height="16" alt="" /></i>{bad.text}</span>
                ) : (
                  <span className="spl-ok"><i className="pop" style={{ '--d': '0.45s' }}><img src={IMG('s05-check.svg')} width="11" height="11" alt="" /></i>영수증 합계와 같아요</span>
                )}
                <p className="num">{lira(d.total)}{(d.currency ?? 'TRY') === 'TRY' ? '리라' : ` ${d.currency}`}</p>
              </div>
            </div>
            <img className="spl-zig" src={IMG('s05-zigzag.svg')} width="335" height="10" alt="" />
          </div>

          <div className="spl-ask rise" style={{ '--d': '0.3s' }}>
            <p>{ask ? ask.text : '생수 4병은 넷이 똑같이 나눌까요?'}</p>
            {d.questions?.length > 1 && <small className="spl-more">확인할 것 {d.questions.length - 1}개 더 있어요</small>}
            <div className="spl-chips" role="radiogroup">
              {chips.map((c, i) => (
                <button key={c} type="button" role="radio" aria-checked={pick === i} className={pick === i ? 'on' : ''} onClick={() => setPick(i)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      }
      foot={
        <div className="spl-foot">
          <ul className="spl-shares">
            {ORDER.map((n, i) => (
              <li key={n}>
                <img className="av" src={PEOPLE[n].av} width="26" height="26" alt="" />
                <div>
                  <small>{n}</small>
                  <CountUp to={shares[n]} delay={350 + i * 60} />
                </div>
              </li>
            ))}
          </ul>
          <Cta onClick={next}>넷에게 보내기</Cta>
        </div>
      }
    />
  )
}
