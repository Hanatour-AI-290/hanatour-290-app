import { useEffect, useRef, useState } from 'react'
import { postJson } from '../api.js'
import { IMG } from '../demo.js'
import { SAMPLE, SAMPLE_RESULT } from '../sample.js'
import { Back, Cta } from '../ui.jsx'
import { labelOf } from './S0_2Estimate.jsx'
import './S0_1Product.css'

// 0-1 여행 전: 상품 불러오기 (지우의 폰). 상품 문구 → /api/estimate → 0-2 진짜 총비용
// 칩은 디자인 시연 값. 직접 붙여 넣은 문구를 분석한 결과가 있으면 그 결과의 항목 분류로 바꾼다
const CHIPS = ['선택관광', '가이드 경비', '자유식', '쇼핑', '현지 교통']
const WAIT_MS = 40000 // 운영 서버 상품 분석은 길면 수십 초 걸린다

const timeout = (ms) => new Promise((_, no) => setTimeout(() => no(new Error('분석이 너무 오래 걸려요. 다시 해 볼까요?')), ms))

export default function Product({ next, prev, state, set, toast }) {
  const est = state.estimate
  const [text, setText] = useState(est?.text ?? SAMPLE)
  const [draft, setDraft] = useState(text)
  const [sheet, setSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true // StrictMode 는 effect 를 두 번 돌린다
    return () => { alive.current = false }
  }, [])

  const chips = est && !est.sample && est.items?.length
    ? [...new Set(est.items.map((it) => labelOf(it.category, true)))]
    : CHIPS

  async function run() {
    if (busy) return
    const isSample = text.trim() === SAMPLE.trim()
    setBusy(true)
    try {
      const r = await Promise.race([postJson('/api/estimate', { text }), timeout(WAIT_MS)])
      if (!alive.current) return
      set({ estimate: { ...r, text, sample: isSample } })
      next()
    } catch (e) {
      if (!alive.current) return
      // 시연 문구는 인터넷이 끊겨도 저장된 결과로 이어 간다
      if (isSample) {
        set({ estimate: { ...SAMPLE_RESULT, saved: true, sample: true, text } })
        next()
      } else {
        toast(e.message || '분석에 실패했어요')
        setBusy(false)
      }
    }
  }

  function openSheet() { setDraft(text); setSheet(true) }
  function accept() {
    const t = draft.trim()
    if (t.length < 10) { toast('상품 문구를 조금 더 넣어 주세요'); return }
    setText(t)
    setSheet(false)
  }

  return (
    <section className="scr prod fade">
      <div className="scr-body prod-body">
        <div className="prod-top"><Back onClick={prev} /></div>

        <h1 className="prod-title rise" style={{ '--d': '0.04s' }}>어떤 여행을<br />가세요?</h1>
        <p className="prod-desc rise" style={{ '--d': '0.09s' }}>상품 링크를 붙여 넣으면<br />상품가에 없는 돈까지 찾아 드려요</p>

        <div className="prod-link rise" style={{ '--d': '0.15s' }}>
          <span className="prod-link-ic"><img src={IMG('s0-1-link.svg')} width="16" height="16" alt="" /></span>
          <div className="prod-link-txt">
            <p>하나투어 상품 링크를 넣었어요</p>
            <small>hanatour.com/package/…</small>
          </div>
          <button type="button" className="prod-again" onClick={openSheet}>다시 넣기</button>
        </div>

        <article className="prod-card rise" style={{ '--d': '0.22s' }}>
          <div className="prod-photo"><img src={IMG('s01-capp.jpg')} alt="카파도키아 하늘을 나는 열기구" /></div>
          <div className="prod-info">
            <div className="prod-name">
              <p>튀르키예 일주 7박</p>
              <span><b className="num">124</b><small>만 원</small></span>
            </div>
            <p className="prod-cap">상품가</p>
            <i className="prod-line" />
            <p className="prod-found">상품가에 없는 돈, 이만큼 찾았어요</p>
            <ul className="prod-chips stagger">
              {chips.map((c) => (
                <li key={c}><img src={IMG('s0-1-check.svg')} width="11" height="11" alt="" />{c}</li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <div className="scr-foot">
        <Cta onClick={run} disabled={busy} aria-busy={busy}>{busy ? '찾는 중…' : '진짜 총비용 보기'}</Cta>
      </div>

      {sheet && (
        <div className="prod-layer" role="dialog" aria-modal="true" aria-label="상품 문구 넣기">
          <button type="button" className="prod-dim" aria-label="닫기" onClick={() => setSheet(false)} />
          <div className="prod-sheet sheet-up" style={{ '--d': '0s' }}>
            <i className="prod-grip" />
            <h2>상품 링크나 상세 문구를<br />붙여 넣어 주세요</h2>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="상품 상세의 포함·불포함 사항, 선택관광 문구를 그대로 붙여 넣어도 돼요"
              maxLength={8000}
            />
            <button type="button" className="prod-sample" onClick={() => setDraft(SAMPLE)}>예시 상품 문구 넣기</button>
            <Cta onClick={accept}>넣기</Cta>
          </div>
        </div>
      )}
    </section>
  )
}
