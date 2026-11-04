import { useEffect, useState } from 'react'
import { postJson } from '../api.js'
import { IMG } from '../demo.js'
import { ME, MEMBERS } from '../sample.js'
import { lira } from '../ui.jsx'
import './S09VoiceSolo.css'

// 9 혼자 쓴 돈은 말로 (지우의 폰). 말 한 줄 → AI 가 읽은 지출 하나 → 가계부에 적기
const SAID = '기념품 300리라 현금'
// 디자인 값 (API 가 실패하거나 응답 전이면 이 값 그대로 보인다)
const DESIGN = { name: '기념품', amount: 300, method: '현금', category: '쇼핑', krw: '약 1만 원' }

/** /record 응답 → 화면 값. 결제수단은 응답에 없어서 말 문구에서 읽는다 */
function fromRecord(r) {
  const amount = typeof r?.amount === 'number' && r.amount > 0 && (!r.currency || r.currency === 'TRY') ? r.amount : DESIGN.amount
  return {
    name: r?.name || DESIGN.name,
    amount,
    method: /현금/.test(SAID) ? '현금' : /카드/.test(SAID) ? '카드' : DESIGN.method,
    category: r?.category || DESIGN.category,
    krw: DESIGN.krw,
  }
}

export default function VoiceSolo({ next, set, toast }) {
  const [item, setItem] = useState(DESIGN)

  useEffect(() => {
    let live = true
    postJson('/api/record', { text: SAID, members: MEMBERS, me: ME })
      .then((r) => { if (live) setItem(fromRecord(r)) })
      .catch(() => { /* 서버가 꺼져 있어도 디자인 값으로 시연을 이어 간다 */ })
    return () => { live = false }
  }, [])

  const fix = () => toast('고칠 수 있어요')
  const save = () => { set({ solo: { ...item } }); next() }

  const rows = [
    ['얼마', <span className="solo-amt"><b className="num-b">{lira(item.amount)}리라</b><small>{item.krw}</small></span>],
    ['무엇', item.name],
    ['어떻게', item.method],
    ['분류', <span className="solo-chip">{item.category}</span>],
    ['누구', '나 혼자'],
  ]

  return (
    <section className="scr solo fade">
      <div className="solo-photo">
        <img className="kenburns" src={IMG('souvenir.png')} alt="나자르 부적과 도자기가 걸린 바자르" />
        <i className="solo-shade" />
      </div>

      <div className="solo-sheet sheet-up">
        <i className="solo-grip" />
        <p className="solo-said">
          <span className="solo-mic"><img src={IMG('s09-mic.svg')} width="15" height="15" alt="" /></span>
          "{SAID}"
        </p>
        <h1 className="solo-title">이렇게 적을까요?</h1>

        <ul className="solo-list stagger">
          {rows.map(([k, v]) => (
            <li key={k}>
              <button type="button" onClick={fix}>
                <span className="solo-k">{k}</span>
                <span className="solo-v">
                  {v}
                  <img src={IMG('s09-chev.svg')} width="16" height="16" alt="" />
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="solo-foot">
          <button type="button" className="cta line solo-again" onClick={() => toast('다시 말해 주세요')}>다시 말하기</button>
          <button type="button" className="cta" onClick={save}>가계부에 적기</button>
        </div>
      </div>
    </section>
  )
}
