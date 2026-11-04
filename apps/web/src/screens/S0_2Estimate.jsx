import { useState } from 'react'
import { IMG, TRIP5 } from '../demo.js'
import { SAMPLE_RESULT } from '../sample.js'
import { CountUp, Cta } from '../ui.jsx'
import './S0_2Estimate.css'

// 0-2 여행 전: 진짜 총비용 예상 (지우의 폰)
// 시연 문구(또는 결과 없음)면 디자인 값 그대로, 직접 붙여 넣은 문구를 분석했으면 /api/estimate 결과로 그린다

// 디자인 시연 값 (만 원)
const D_BASE = 124
const D_LOCAL = [
  { name: '선택관광', amount: 60 },
  { name: '식비', amount: 60 },
  { name: '쇼핑', amount: 30 },
  { name: '가이드 경비', amount: 10 },
  { name: '교통', amount: 6 },
]
// 디자인 막대 조각 너비 (px, 사이 2px 빼고 285)
const D_BAR = [122, 59, 59, 29, 10, 6]
const BASE_COLOR = '#3a1c82'
const COLORS = ['#5e2bb8', '#8a63db', '#b9a2ee', '#f4b740', '#d9d3e8', '#c9b8f2', '#e6dcfb']

/** 상품 분석 분류 → 화면 이름. chip 이면 0-1 칩 표기 (불포함 식사 = 자유식) */
export function labelOf(category, chip = false) {
  if (category === '가이드·기사 경비') return '가이드 경비'
  if (category === '불포함 식사') return chip ? '자유식' : '식비'
  return category || '기타'
}

const SYM = { EUR: '€', USD: '$', JPY: '¥', TRY: '₺', GBP: '£' }
const man = (krw) => Math.round(krw / 10000)
const man1 = (krw) => (Math.round(krw / 1000) / 10).toLocaleString('ko-KR')
const money = (amount, cur) => {
  if (amount == null) return '금액 없음'
  if (cur === 'KRW') return `${man1(amount)}만 원`
  return `${SYM[cur] ?? `${cur} `}${amount.toLocaleString('ko-KR')}`
}
function toKrw(amount, cur, fx) {
  if (amount == null || !cur) return null
  if (cur === 'KRW') return amount
  const r = fx?.krw?.[cur]
  return r ? amount * r : null
}

/** 직접 붙여 넣은 결과 → 화면 값 (만 원). PR #8: 금액 없음 · 환율 없음 항목은 합계에서 빼고 따로 알린다 */
function fromApi(est) {
  const rows = (est.items ?? []).map((it) => ({ ...it, krw: toKrw(it.amount, it.currency, est.fx) }))
  const groups = new Map()
  for (const r of rows.filter((x) => x.krw != null)) {
    const k = labelOf(r.category)
    groups.set(k, (groups.get(k) ?? 0) + r.krw)
  }
  const local = [...groups].map(([name, krw]) => ({ name, krw })).sort((a, b) => b.krw - a.krw)
  const baseKrw = est.base_price_krw ?? null
  const localKrw = local.reduce((a, g) => a + g.krw, 0)
  const missing = rows.filter((r) => r.krw == null).map((r) => (r.amount == null ? r.name : `${r.name} ${money(r.amount, r.currency)}`))
  return {
    title: est.title || '붙여 넣은 상품',
    base: baseKrw,
    total: man((baseKrw ?? 0) + localKrw),
    extra: man1(localKrw),
    local: local.map((g, i) => ({ name: g.name, label: `${man1(g.krw)}만 원`, color: COLORS[i % COLORS.length], grow: g.krw })),
    baseGrow: baseKrw ?? 0,
    missing,
    sample: false,
  }
}

const DESIGN = {
  title: TRIP5.title,
  base: D_BASE * 10000,
  total: D_BASE + D_LOCAL.reduce((a, p) => a + p.amount, 0),
  extra: String(D_LOCAL.reduce((a, p) => a + p.amount, 0)),
  local: D_LOCAL.map((p, i) => ({ name: p.name, label: `${p.amount}만 원`, color: COLORS[i], grow: D_BAR[i + 1] })),
  baseGrow: D_BAR[0],
  missing: [],
  sample: true,
}

function Row({ color, name, value, main }) {
  return (
    <p className={`est-row ${main ? 'main' : ''}`}>
      <span><i style={{ background: color }} />{name}</span>
      <b className="num-b">{value}</b>
    </p>
  )
}

export default function Estimate({ next, state }) {
  const est = state.estimate
  const v = est && !est.sample ? fromApi(est) : DESIGN
  const [sheet, setSheet] = useState(false)
  // 원문 보기: 분석 결과가 없으면 시연 문구의 저장된 결과
  const src = est ?? { ...SAMPLE_RESULT, saved: true }
  const parts = [{ name: '상품가', color: BASE_COLOR, grow: v.baseGrow }, ...v.local]

  return (
    <section className="scr est fade">
      <div className="scr-body est-body">
        <div className="est-photo">
          <img className="kenburns" src={IMG('s01-capp.jpg')} alt="카파도키아 하늘을 나는 열기구" />
          <i className="est-shade" />
        </div>

        <div className="est-head">
          <h1 className="est-title rise" style={{ '--d': '0.05s' }}>{v.title},<br />진짜로는 이만큼 들어요</h1>
        </div>

        <article className="est-card sheet-up" style={{ '--d': '0.12s' }}>
          <p className="est-label">예상 진짜 총비용</p>
          <p className="est-total"><CountUp to={v.total} delay={300} ms={1000} /><span>만 원</span></p>
          <p className="est-badge pop" style={{ '--d': '0.55s' }}>
            {v.base == null ? `상품가는 문구에 없었어요 · 따로 ${v.extra}만 원` : `상품가보다 ${v.extra}만 원 더 들어요`}
          </p>

          <div className="est-bar">
            {parts.filter((p) => p.grow > 0).map((p, i) => (
              <i key={p.name} className="grow-x" style={{ flexGrow: p.grow, background: p.color, '--d': `${0.3 + i * 0.07}s` }} />
            ))}
          </div>

          <div className="est-list stagger">
            <Row main color={BASE_COLOR} name="상품가" value={v.base == null ? '금액 없음' : `${v.sample ? D_BASE : man1(v.base)}만 원`} />
            <i className="est-line" />
            <p className="est-local">현지에서 쓸 돈 {v.extra}만 원{v.sample ? ' (예시 값)' : ''}</p>
            {v.local.map((p) => <Row key={p.name} color={p.color} name={p.name} value={p.label} />)}
            {v.missing.length > 0 && <p className="est-missing">금액 없음 {v.missing.length}개 · {v.missing.join(', ')}</p>}
          </div>
        </article>

        <div className="est-src rise" style={{ '--d': '0.4s' }}>
          <span>빠진 돈은 상품 문구에서 찾았어요</span>
          <button type="button" onClick={() => setSheet(true)}>원문 보기</button>
        </div>
      </div>

      <div className="scr-foot"><Cta onClick={next}>이대로 하루 생활비 정하기</Cta></div>

      {sheet && (
        <div className="est-layer" role="dialog" aria-modal="true" aria-label="근거 원문">
          <button type="button" className="est-dim" aria-label="닫기" onClick={() => setSheet(false)} />
          <div className="est-sheet sheet-up" style={{ '--d': '0s' }}>
            <i className="est-grip" />
            {src.saved && <p className="est-saved">저장된 분석 결과</p>}
            <h2>상품 문구에서 이렇게 찾았어요</h2>
            <ul className="est-ev stagger">
              {(src.items ?? []).map((it, i) => (
                <li key={i}>
                  <p><span>{it.name}</span><b className={it.amount == null ? 'est-none' : 'num-b'}>{money(it.amount, it.currency)}</b></p>
                  {it.evidence && <q>{it.evidence}</q>}
                </li>
              ))}
            </ul>
            <Cta onClick={() => setSheet(false)}>닫기</Cta>
          </div>
        </div>
      )}
    </section>
  )
}
