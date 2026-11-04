import { useEffect, useMemo, useRef, useState } from 'react'
import { SAMPLE, SAMPLE_RESULT, SAMPLE_SMS, ME, MEMBERS, TRIP, SEED, MEMBER_IDS, ROOM, NAME_OF, WALLETS, LIVING_PER_DAY_KRW } from './sample.js'
import { confirmFor, dayDate, fromMinor, paidAtOf, payerNames, postForm, postJson, toExpense, toMinor, useFx, usePost } from './api.js'

const PATH = {
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z|M5 17a3 3 0 0 1 3-3h11|M9 8h6',
  split: 'M7 7h12m0 0-3-3m3 3-3 3|M17 17H5m0 0 3-3m-3 3 3 3',
  chart: 'M5 20V10|M12 20V4|M19 20v-7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4.5 20a7.5 7.5 0 0 1 15 0',
  back: 'M15 5l-7 7 7 7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  plane: 'M3 15l18-7-7 13-2-5z',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z|M10 20a2 2 0 0 0 4 0',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  mic: 'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z|M5 11a7 7 0 0 0 14 0|M12 18v3',
  cam: 'M4 8h3l2-3h6l2 3h3v11H4z|M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6 6 18',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z|M4 7l11-3v3|M15.5 13.5h.01',
}

function Icon({ name, size = 24, color = 'currentColor', sw = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATH[name].split('|').map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

/* ---------- 계산 ---------- */

const SYM = { KRW: '', USD: '$', EUR: '€', JPY: '¥', TRY: '₺' }
const man = (krw) => Math.round(krw / 10000).toLocaleString('ko-KR')
const man1 = (krw) => (Math.round(krw / 1000) / 10).toLocaleString('ko-KR')
const money = (amount, cur) => (cur === 'KRW' ? `${man1(amount)}만 원` : `${SYM[cur] ?? `${cur} `}${amount.toLocaleString('ko-KR')}`)
const isTurkey = (title) => /튀르키예|터키/.test(title ?? '')

function toKrw(amount, cur, fx) {
  if (amount == null || !cur) return null
  if (cur === 'KRW') return amount
  const r = fx?.krw?.[cur]
  return r ? amount * r : null
}

// AI가 뽑은 비용 항목 → 여행 중 가계부 줄. 일정표 자리에 미리 채워 둔다.
function buildRecords(data) {
  const trip = isTurkey(data.title)
  return data.items.flatMap((it, i) => {
    if (it.category === '싱글차지') return [] // 2인 1실로 간다고 보고 뺀다
    const slot = trip ? TRIP.slots.find((s) => s.match.test(it.name)) : null
    const seed = trip ? SEED.find((s) => s.match.test(it.name)) : null
    const personal = it.required // 필수 경비는 각자 낸다
    const payer = seed ? seed.payer : personal ? null : ME
    const people = seed?.people ?? (personal ? [ME] : [...MEMBERS])
    return [{
      id: `i${i}`, idx: i, src: '일정', day: slot?.day ?? 0, time: slot?.time ?? '',
      name: it.name, category: it.category, amount: it.amount, currency: it.currency === 'OTHER' ? null : it.currency,
      perPerson: true, required: it.required, aliases: it.aliases ?? [],
      status: seed?.status ?? null,
      payer, people, method: 'card',
      // 지난 일정(SEED)은 이미 다 같이 확인한 상태로 시작한다 (R-11)
      confirm: seed?.status === 'done' && payer ? Object.fromEntries(people.filter((p) => p !== payer).map((p) => [p, 'confirmed'])) : {},
    }]
  })
}

// 나누기 · 환산 · 차감 계산은 서버(packages/shared)로 옮겼다 (R-24). 화면은 api.js 로 결과만 받는다.

// 사진을 1400px JPEG로 줄여 data URL로
async function shrink(blob) {
  const img = await createImageBitmap(blob)
  const s = Math.min(1, 1400 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * s)
  c.height = Math.round(img.height * s)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || '요청에 실패했어요')
  return j
}

// 새로고침해도 시연 상태가 남도록 (저장이 막힌 브라우저에서는 그냥 메모리로)
function useStored(key, init) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* 저장 불가 */ } }, [key, v])
  return [v, setV]
}

/* ---------- 화면 ---------- */

function TabBar({ tab, go, dots }) {
  const tabs = [['home', '홈', 'home'], ['ledger', '가계부', 'book'], ['settle', '정산', 'split'], ['wallet', '지갑', 'wallet'], ['report', '리포트', 'chart']]
  return (
    <nav className="tabbar">
      {tabs.map(([id, label, icon]) => (
        <button key={label} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => go(id)}>
          <Icon name={icon} sw={tab === id ? 2.2 : 1.9} />
          {label}
          {dots?.[id] && <i className="dot" aria-label="확인할 것 있음" />}
        </button>
      ))}
    </nav>
  )
}

function Home({ openPaste, startDemo }) {
  const hidden = [['싱글차지', 33], ['선택관광', 32], ['불포함 식사', 20], ['매너팁 · 가이드팁', 20]]
  return (
    <div className="scroll pad">
      <div className="hello">
        <div><small>안녕하세요,</small><b>지우님</b></div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Icon name="bell" />
          <div className="avatar">지</div>
        </div>
      </div>
      <div className="trip"><Icon name="plane" size={16} sw={1.9} />다음 여행 · 튀르키예 일주 7박 9일 · 친구 4명</div>

      <div className="searchrow">
        <button className="search" onClick={() => openPaste('')}>
          <Icon name="link" size={18} color="#6b7684" />상품 문구를 붙여 넣어 보세요
        </button>
        <img src="/img/mascot.png" alt="" />
      </div>

      <section className="hero">
        <div className="q">찜한 튀르키예 패키지<span>의 진짜 총비용은?</span></div>
        <div className="bar"><i style={{ width: `${(124 / 290) * 100}%` }} /></div>
        <div className="row">
          <div><small>가격표 124만 원</small><small><b>+ 숨은 돈 166만 원</b></small></div>
          <div className="big">290<em>만 원</em></div>
        </div>
        <div className="src">유튜브 「튀르키예 초저가 vs 프리미엄 패키지 비교」 영상 속 금액</div>
      </section>

      <div className="sec"><h2>지금 2030이 보는 패키지</h2><span>더보기</span></div>
      <div className="cards">
        <button className="pcard" onClick={() => openPaste(SAMPLE, true)}>
          <div className="thumb"><img src="/img/cappadocia.jpg" alt="카파도키아 열기구" /><span className="tag">+166만</span></div>
          <b>튀르키예 일주 7박</b><small className="hot">눌러서 진짜 총비용 계산</small>
        </button>
        <button className="pcard" onClick={() => openPaste('')}>
          <div className="thumb"><img src="/img/kotakinabalu.jpg" alt="코타키나발루 해변" /></div>
          <b>코타키나발루 밍글링</b><small>88~07년생 · 쇼핑 0회</small>
        </button>
        <button className="pcard" onClick={() => openPaste('')}>
          <div className="thumb"><img src="/img/mongolia.jpg" alt="몽골 초원" /></div>
          <b>몽골 2030 패키지</b><small>진짜 총비용 계산하기</small>
        </button>
      </div>

      <div className="sec"><h2>2030 후기에서 많이 나온 숨은 돈</h2></div>
      <div className="card hidden-list">
        {hidden.map(([n, v]) => (
          <div className="hrow" key={n}><span>{n}</span><div className="track"><i style={{ width: `${(v / 33) * 100}%`, opacity: v > 25 ? 1 : 0.55 }} /></div><b>{v}</b></div>
        ))}
        <div className="cap">밍글링 투어 블로그 후기 274건 중 언급한 글 수 (2026.10.24 수집)</div>
      </div>
      <button className="btn ink" style={{ marginTop: 20 }} onClick={startDemo}>여행 중 가계부 미리 보기</button>
    </div>
  )
}

function Paste({ text, setText, run, back, error }) {
  return (
    <>
      <div className="topnav"><button className="back" aria-label="뒤로" onClick={back}><Icon name="back" size={20} sw={2.2} /></button><h1>진짜 총비용 계산</h1></div>
      <div className="scroll pad paste">
        <h2>상품 상세의<br />포함 · 불포함 문구를 붙여 넣어 주세요</h2>
        <p>선택관광, 싱글차지, 경비처럼 가격표에 없는 돈을 AI가 찾아 지금 환율로 더해 드려요.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'예) 불포함 사항: 가이드 경비 $50\n선택관광: 열기구 투어 320유로 ...'} />
        <div className="chiprow">
          <button className="chip" onClick={() => setText(SAMPLE)}>예시 문구 넣기 (튀르키예)</button>
          {text && <button className="chip gray" onClick={() => setText('')}>지우기</button>}
        </div>
        {error && <div className="err">{error}</div>}
      </div>
      <div className="bottom"><button className="btn brand" disabled={text.trim().length < 10} onClick={run}>진짜 총비용 보기<Icon name="arrow" size={18} sw={2.4} /></button></div>
    </>
  )
}

function Loading() {
  return (
    <div className="loading">
      <img className="bob" src="/img/mascot.png" alt="" />
      <b>가격표 뒤를 살펴보는 중</b>
      <p>선택관광 · 싱글차지 · 경비 문구를 찾고<br />오늘 환율을 불러오고 있어요</p>
      <div className="dots"><i /><i /><i /></div>
    </div>
  )
}

function Result({ data, picks, setPicks, back, makeLedger, budget }) {
  const [open, setOpen] = useState(null)
  const fx = data.fx
  const rows = data.items.map((it, i) => ({ ...it, i, krw: toKrw(it.amount, it.currency, fx) }))
  const base = data.base_price_krw ?? 0
  const req = rows.filter((r) => r.required && r.krw != null).reduce((a, r) => a + r.krw, 0)
  const opts = rows.filter((r) => !r.required && r.krw != null)
  const optAll = opts.reduce((a, r) => a + r.krw, 0)
  const optMine = opts.filter((r) => picks.includes(r.i)).reduce((a, r) => a + r.krw, 0)
  const tiers = [['최소', base + req], ['내가 고른 것', base + req + optMine], ['옵션 전부', base + req + optAll]]
  const mine = tiers[1][1]
  const unknown = rows.filter((r) => r.krw == null)
  const trip = isTurkey(data.title)
  const nOpt = rows.filter((r) => r.category === '선택관광').length
  const toggle = (i) => setPicks(picks.includes(i) ? picks.filter((x) => x !== i) : [...picks, i])

  return (
    <>
      <div className="scroll" style={{ background: '#fff' }}>
        <div className={`photo ${trip ? '' : 'plain'}`}>
          {trip && <img src="/img/cappadocia.jpg" alt="카파도키아" />}
          <button className="back" aria-label="뒤로" onClick={back}><Icon name="back" size={20} sw={2.2} /></button>
        </div>
        <div className="sheet">
          <div className="chips">
            {nOpt > 0 && <span className="o">선택관광 {nOpt}</span>}
            <span>{data.saved ? '저장된 분석 결과' : 'AI 분석'}</span>
            {fx && <span>환율 {fx.date}</span>}
          </div>
          <h1>{data.title || '붙여 넣은 상품'}</h1>
          <div className="price">
            <div>
              <small>{data.base_price_krw ? `가격표 ${man(base)}만 원` : '가격표 금액은 문구에 없었어요'}</small>
              <div className="real"><span>진짜</span><b>{man(mine)}</b><em>만 원</em></div>
            </div>
            <div className="pill">+{man1(mine - base)}만 원</div>
          </div>
          <div className="stack">
            <i style={{ flexGrow: Math.max(base, 1), background: 'var(--ink)' }} />
            <i style={{ flexGrow: Math.max(mine - base, 1), background: 'var(--brand)' }} />
          </div>
          <div className="legend"><span>예약할 때 보이는 돈</span><span>가격표에 없는 돈</span></div>

          <div className="tiers">
            {tiers.map(([label, v], k) => (
              <div key={label} className={k === 1 ? 'on' : ''}><small>{label}</small><b>{man(v)}<em>만</em></b></div>
            ))}
          </div>

          <div className="items">
            {rows.filter((r) => r.krw != null).map((r) => {
              const on = r.required || picks.includes(r.i)
              return (
                <div key={r.i} className={`item ${on ? '' : 'off'}`}>
                  <div className="top">
                    {r.required
                      ? <span className="ck lock" title="필수"><Icon name="check" size={14} sw={3} color="#fff" /></span>
                      : <button className={`ck ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${r.name} 할 거예요`} onClick={() => toggle(r.i)}><Icon name="check" size={14} sw={3} color="#fff" /></button>}
                    <button className="nm" onClick={() => setOpen(open === r.i ? null : r.i)}>
                      <b>{r.name}</b><small>{r.category}{r.required ? ' · 필수' : ''}</small>
                    </button>
                    <div className="amt">
                      <strong>{money(r.amount, r.currency)}</strong>
                      {r.currency !== 'KRW' && <small>약 {man1(r.krw)}만 원</small>}
                    </div>
                  </div>
                  {open === r.i && <div className="ev">원문: “{r.evidence}”</div>}
                </div>
              )
            })}
          </div>
          {unknown.length > 0 && (
            <div className="unknown">
              <b>금액이 안 적힌 항목 {unknown.length}개</b> · 현장에서 확인해야 해요<br />
              {unknown.map((u) => u.name).join(', ')}
              {trip && <><br />비교 영상에서는 옵션을 모두 하니 166만 원이 더 들어 290만 원이었어요.</>}
            </div>
          )}
          {budget && (
            <div className="budget">
              <div><small>하루 예산 · {budget.days}일 기준</small><b>{man1(budget.perDayKrw)}<em>만 원</em></b></div>
              <p>고른 선택관광·경비 {man1(budget.extraKrw)}만 원 ÷ {budget.days}일 + 하루 생활비 {man1(budget.livingPerDayKrw)}만 원 <span className="ex">예시 값</span></p>
            </div>
          )}
          <div className="fx">
            동그라미를 눌러 할 옵션만 고르세요. 이름을 누르면 AI가 근거로 삼은 원문 구절이 보여요.<br />
            {fx ? `외화는 ${fx.date} 유럽중앙은행 기준 환율로 계산했어요.` : '환율을 불러오지 못해 외화 항목은 합계에서 빠졌어요.'}
          </div>
        </div>
      </div>
      <div className="ctabar"><button className="btn brand" onClick={makeLedger}>이 예산으로 가계부 만들기</button></div>
    </>
  )
}

// 마지막 글자 받침 유무로 '이/가' 고르기
const iGa = (w) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 ? '이' : '가'
}

function Empty({ startDemo, what }) {
  return (
    <div className="scroll pad empty">
      <img src="/img/mascot.png" alt="" />
      <b>아직 {what}{iGa(what)} 없어요</b>
      <p>상품의 진짜 총비용을 먼저 계산하면<br />그 일정으로 가계부가 채워져요.</p>
      <button className="btn brand" onClick={startDemo}>튀르키예 예시로 시작하기</button>
    </div>
  )
}

function AmountInput({ onSave }) {
  const [v, setV] = useState('')
  const [cur, setCur] = useState('EUR')
  return (
    <div className="amtin">
      <input inputMode="decimal" placeholder="얼마였나요?" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} />
      <select value={cur} onChange={(e) => setCur(e.target.value)} aria-label="통화">
        <option value="EUR">€</option><option value="TRY">₺</option><option value="USD">$</option><option value="KRW">원</option>
      </select>
      <button disabled={!v} onClick={() => onSave(Number(v), cur)}>저장</button>
    </div>
  )
}

const CUR_NAME = { TRY: '리라', EUR: '유로', USD: '달러', JPY: '엔', KRW: '원' }
const curName = (c) => CUR_NAME[c] ?? c
const fmtMinor = (amount, cur) => money(fromMinor(amount, cur), cur)
const CATS = ['식사', '선택관광', '교통', '쇼핑', '팁', '기타']
const nowHHMM = () => new Date().toTimeString().slice(0, 5)
const eul = (w) => (iGa(w) === '이' ? '을' : '를')
const totalOf = (r) => (r.perPerson ? r.amount * r.people.length : r.amount)

/** 영수증 줄 단위 기록에서 실제로 나누는 사람 (배정이 없는 메뉴 줄은 people 전원) */
function involvedOf(lines, splits, people) {
  const out = new Set()
  lines.forEach((l, i) => {
    if (l.kind === 'tax') return
    const s = splits.find((x) => x.lineIndex === i)
    for (const n of s ? s.memberIds.map((id) => NAME_OF[id]) : people) out.add(n)
  })
  return MEMBERS.filter((m) => out.has(m))
}

// 정산방 멤버 전환 (R-04): 한 기기에서 각 멤버의 화면을 보여 준다
function ViewerBar({ viewer, setViewer, dark }) {
  return (
    <div className={`viewer ${dark ? 'dark' : ''}`}>
      <span>지금 누구로 보기</span>
      <div>{MEMBERS.map((m) => <button key={m} className={viewer === m ? 'on' : ''} aria-pressed={viewer === m} onClick={() => setViewer(m)}>{m}</button>)}</div>
    </div>
  )
}

// 결제일 환율 표시 (R-20): "1 TRY = 26.75원 (2026-11-05, Frankfurter)"
function FxLine({ r, ctx }) {
  if (r.status !== 'done' || r.amount == null || !r.currency || r.currency === 'KRW') return null
  const fx = ctx.fxOf(r.currency, paidAtOf(r, TRIP.today).slice(0, 10))
  if (!fx) return <div className="fxl">환율을 불러오지 못해 원화 합계에서 빠졌어요</div>
  return (
    <div className="fxl">
      1 {r.currency} = {fx.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원 ({fx.date}, {fx.source})
      {fx.source === 'ExchangeRate-API' && ' · Rates By Exchange Rate API'}
    </div>
  )
}

// 영수증 줄 단위 확인 카드 (R-07, R-08, R-10): 줄마다 근거 원문, 나눌 사람, 질문, [맞아요] / [고치기]
function LinesCard({ r, update }) {
  const [edit, setEdit] = useState(false)
  const splitOf = (i) => r.splits.find((s) => s.lineIndex === i)
  const namesOf = (i) => splitOf(i)?.memberIds.map((id) => NAME_OF[id]) ?? r.people
  function toggle(i, name) {
    const now = namesOf(i)
    const next = now.includes(name) ? now.filter((n) => n !== name) : [...now, name]
    if (!next.length) return
    const splits = [...r.splits.filter((s) => s.lineIndex !== i), { lineIndex: i, memberIds: next.map((n) => MEMBER_IDS[n]), source: '직접 고침' }]
    update(r.id, { splits, confirm: confirmFor(involvedOf(r.lines, splits, r.people), r.payer) })
  }
  return (
    <div className="lines">
      {r.lines.map((l, i) => {
        const why = splitOf(i)?.source
        return (
          <div className="ln" key={i}>
            <div className="t"><b>{l.nameKo || l.name}</b><span>{fmtMinor(l.total, r.currency)}</span></div>
            <small>영수증: “{l.source || l.name}”</small>
            {l.kind === 'tax'
              ? <small>세금 · 각자 몫 비율대로 나눠요</small>
              : <small>{namesOf(i).join(' · ')} · {why && why !== '기본 1/N' ? `“${why}”에서` : '기본 1/N'}</small>}
            {edit && l.kind !== 'tax' && (
              <div className="who">{MEMBERS.map((m) => <button key={m} className={namesOf(i).includes(m) ? 'on' : ''} onClick={() => toggle(i, m)}>{m}</button>)}</div>
            )}
          </div>
        )
      })}
      {(r.questions ?? []).map((q, k) => <div className="qst" key={k}>확인해 주세요 · {q.text}</div>)}
      {(() => {
        // 줄 합 ≠ 총액이면 확정 전에 알려 준다 (확정하면 차액은 몫 비율대로, api.js toExpense)
        const diff = toMinor(r.amount, r.currency) - r.lines.reduce((a, l) => a + l.total, 0)
        return diff ? <div className="qst">줄 합계가 총액과 {fmtMinor(Math.abs(diff), r.currency)} 달라요 · 이대로 확정하면 차액은 각자 몫 비율대로 나눠요</div> : null
      })()}
      {r.status === 'review' && (
        <div className="yn">
          <button onClick={() => update(r.id, { status: 'done' })}>맞아요</button>
          <button className={edit ? 'on' : ''} onClick={() => setEdit(!edit)}>{edit ? '다 고쳤어요' : '고치기'}</button>
        </div>
      )}
    </div>
  )
}

function Ledger({ data, picks, records, setRecords, day, setDay, toast, go, viewer, setViewer, ctx }) {
  const trip = isTurkey(data.title)
  const [line, setLine] = useState('')
  const [busy, setBusy] = useState('')
  const [listening, setListening] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [mode, setMode] = useState('photo')
  const [memo, setMemo] = useState('')
  const [sms, setSms] = useState('')
  const [manual, setManual] = useState({ name: '', amount: '', currency: 'TRY', method: 'card', category: '식사', shared: true })
  const recRef = useRef(null)
  const fileRef = useRef(null)

  const days = trip ? Array.from({ length: TRIP.days }, (_, k) => k + 1) : []
  if (records.some((r) => r.day === 0) || !trip) days.push(0)
  const list = records.filter((r) => r.day === day)
  const planned = (r) => r.required || r.src !== '일정' || picks.includes(r.idx)
  const place = trip ? TRIP.places[day] : ''

  // 하루 끝 요약 (R-23) · 하루 예산 (R-03, R-21) · 받을 돈 (R-19) - 계산은 모두 서버
  const vid = MEMBER_IDS[viewer]
  const today = day || TRIP.today
  const summary = usePost('/api/settle/day', ctx.walletRes
    ? { members: ROOM, memberId: vid, expenses: ctx.expenses, wallets: ctx.walletRes.wallets, date: dayDate(today), day: Math.min(today, ctx.days), days: ctx.days }
    : null).data
  const spent = summary?.todayKrw ?? 0
  const perDay = ctx.budget?.perDayKrw ?? 0
  const over = perDay > 0 && spent > perDay
  const mine = ctx.settle?.krw?.[vid]
  const toReceive = mine ? mine.paid - mine.share : 0
  const left = (summary?.byCurrency ?? []).filter((c) => c.currency !== 'KRW' && c.balance)
  const short = (summary?.byCurrency ?? []).filter((c) => c.currency !== 'KRW' && c.shortfall > 0)

  const update = (id, patch) => setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  function addRecord(rec) {
    setRecords((rs) => [...rs, rec])
    // 중복 결제 경고 (R-14): 금액 · 시각 · 가게가 비슷한 기존 지출이 있으면 "같은 결제인가요?"
    const e = toExpense(rec, ctx.fxOf, TRIP.today)
    if (!e) return
    const others = records.map((r) => toExpense(r, ctx.fxOf, TRIP.today)).filter(Boolean)
    postJson('/api/settle/duplicates', { expense: e, expenses: others })
      .then(({ duplicates }) => {
        const of = duplicates.length ? records.find((r) => r.id === duplicates[0].id) : null
        if (of) update(rec.id, { dup: { id: of.id, name: of.name } })
      })
      .catch(() => {})
    if (rec.src !== '일정') suggestPlan(rec)
  }

  // 예정 항목 연결 (AI 활용 방향 추천 2): 카드 문자 "괴레메 열기구 투어" → 일정의 "카파도키아 열기구 투어" 였나요?
  // 이름 비교는 서버의 ML 임베딩 모델, 금액 · 통화 규칙도 서버. 화면은 후보를 보여 주고 사용자가 고른다
  function suggestPlan(rec) {
    const open = records.filter((r) => r.src === '일정' && r.status !== 'done' && planned(r))
    if (!open.length || !rec.name) return
    postJson('/api/match/plan', {
      record: { text: rec.name, amount: rec.amount ?? null, currency: rec.currency ?? null, people: Math.max(1, rec.people?.length ?? 1) },
      items: open.map((r) => ({ idx: r.idx, name: r.name, aliases: (r.aliases ?? []).slice(0, 12), amount: r.amount ?? null, currency: r.currency ?? null })),
    })
      .then(({ candidates }) => {
        const c = candidates[0]
        const of = c ? open.find((r) => r.idx === c.idx) : null
        if (of) update(rec.id, { plan: { id: of.id, name: of.name, amountMatch: c.amountMatch } })
      })
      .catch(() => {})
  }

  // [맞아요] 일정 항목을 실제 기록 내용으로 "했다" 처리하고 새 기록은 지운다 → 한 건만 남고 리포트 예상 vs 실제에 연결된다
  function linkPlan(rec) {
    const { id } = rec.plan
    setRecords((rs) => rs.flatMap((r) => {
      if (r.id === rec.id) return []
      if (r.id !== id) return [r]
      return [{
        ...r, status: 'done', amount: rec.amount, currency: rec.currency, perPerson: false,
        payer: rec.payer, payers: rec.payers, people: rec.people, method: rec.method,
        confirm: rec.confirm, lines: rec.lines, splits: rec.splits, questions: rec.questions,
        merchant: rec.merchant, evidence: rec.evidence, linkedFrom: rec.src,
      }]
    }))
    toast(`“${rec.plan.name}” 일정에 기록했어요`)
  }

  function openManual(name = '') {
    setManual((m) => ({ ...m, name }))
    setMode('manual')
    setSheet(true)
  }

  async function addFrom(body, src) {
    setBusy(src === '영수증' ? '영수증 합계 읽는 중' : src === '카드 문자' ? '카드 문자 읽는 중' : '말한 내용 정리하는 중')
    try {
      const out = await post('/api/record', { ...body, members: MEMBERS, me: viewer })
      const payer = out.payer ?? viewer
      const people = out.people.length ? out.people : [viewer]
      addRecord({
        id: `r${Date.now()}`, src, day, time: nowHHMM(), name: out.name, category: out.category,
        amount: out.amount, currency: out.currency === 'OTHER' ? null : out.currency,
        perPerson: false, required: false, status: 'done', payer, people, evidence: out.evidence,
        method: body.kind === 'sms' ? 'card' : /현금/.test(body.text ?? '') ? 'cash' : 'card',
        confirm: confirmFor(people, payer),
      })
      toast(people.length > 1 ? `${people.length}명이 나눌 돈으로 기록했어요` : '내 지출로 기록했어요')
    } catch (e) {
      // AI 가 못 읽으면 추측하지 않고 직접 입력으로 (R-17, AVL-003)
      toast(`${e.message} · 직접 입력해 주세요`)
      openManual()
    } finally {
      setBusy('')
    }
  }

  function listen() {
    if (listening) { recRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast('이 브라우저는 음성 인식이 안 돼요. 글로 써 주세요'); return }
    const r = new SR()
    r.lang = 'ko-KR'
    r.interimResults = true
    r.onresult = (e) => setLine(Array.from(e.results).map((x) => x[0].transcript).join(''))
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recRef.current = r
    r.start()
    setListening(true)
  }

  function sendLine() {
    const t = line.trim()
    if (!t) return
    setLine('')
    addFrom({ text: t }, '음성')
  }

  // 영수증 사진 + 덧붙인 말 → 줄 단위 읽기 · 줄별 배정 (R-07, R-08). 안 되면 합계만 읽기 → 직접 입력
  async function sendPhoto(blob) {
    setSheet(false)
    let image
    try {
      image = await shrink(blob)
    } catch {
      toast('사진을 읽지 못했어요')
      return
    }
    const text = memo.trim()
    setMemo('')
    setBusy('영수증을 줄 단위로 읽는 중')
    try {
      const form = new FormData()
      form.set('image', await (await fetch(image)).blob(), 'receipt.jpg')
      form.set('utterance', text)
      form.set('members', JSON.stringify(ROOM))
      form.set('me', viewer)
      const out = await postForm('/api/trips/t1/receipts/analyze', form)
      const cur = out.receipt.currency
      const payer = NAME_OF[out.payerId] ?? viewer
      const people = involvedOf(out.receipt.lines, out.splits, [...MEMBERS])
      setBusy('')
      addRecord({
        id: `r${Date.now()}`, src: '영수증', day, time: out.receipt.paidAt?.slice(11, 16) || nowHHMM(),
        name: out.receipt.merchant || '영수증', merchant: out.receipt.merchant ?? undefined, category: '식사',
        amount: fromMinor(out.receipt.total, cur), currency: cur, perPerson: false, required: false,
        status: 'review', payer, people, evidence: text || '말 없이 영수증만',
        lines: out.receipt.lines, splits: out.splits, questions: out.questions,
        method: 'card', confirm: confirmFor(people, payer),
      })
      toast('줄마다 누가 낼지 확인해 주세요')
    } catch {
      setBusy('')
      addFrom({ image, text }, '영수증')
    }
  }

  function sendSms() {
    const t = sms.trim()
    if (!t) return
    setSheet(false)
    setSms('')
    addFrom({ text: memo.trim() ? `${t}\n덧붙인 말: ${memo.trim()}` : t, kind: 'sms' }, '카드 문자')
    setMemo('')
  }

  // 직접 입력 (R-17): AI 없이 금액 · 통화 · 항목 · 결제 수단
  function saveManual() {
    const amount = Number(manual.amount)
    if (!manual.name.trim() || !(amount > 0)) return
    const people = manual.shared ? [...MEMBERS] : [viewer]
    setSheet(false)
    addRecord({
      id: `r${Date.now()}`, src: '직접', day, time: nowHHMM(), name: manual.name.trim(), category: manual.category,
      amount, currency: manual.currency, perPerson: false, required: false, status: 'done',
      payer: viewer, people, evidence: '직접 입력', method: manual.method, confirm: confirmFor(people, viewer),
    })
    setManual((m) => ({ ...m, name: '', amount: '' }))
    toast(manual.shared ? '같이 쓴 돈으로 기록했어요 · 확인을 기다려요' : '내 지출로 기록했어요')
  }

  async function sampleReceipt() {
    const b = await fetch('/img/receipt-sample.jpg').then((r) => r.blob())
    sendPhoto(b)
  }

  const badge = (src) => ({ 영수증: 'rc', '카드 문자': 'cd' })[src] ?? 'vc'

  return (
    <>
      <div className="scroll pad">
        <div className="ledger-head"><h1>여행 가계부</h1><span>{data.title || '붙여 넣은 상품'}</span></div>
        <ViewerBar viewer={viewer} setViewer={setViewer} />
        <div className="days">
          {days.map((d) => (
            <button key={d} className={`day ${d === day ? 'on' : ''} ${trip && d === TRIP.today ? 'now' : ''}`} onClick={() => setDay(d)}>
              <small>{d === 0 ? '날짜' : 'DAY'}</small><b>{d === 0 ? '미정' : d}</b>
            </button>
          ))}
        </div>
        <div className="today">
          <div className="r1">{day === 0 ? '날짜 미정' : `DAY ${day}${place ? ` · ${place}` : ''}`}<span>{perDay ? `하루 예산 ${man1(perDay)}만 원` : '하루 예산 없음'}</span></div>
          <div className="r2"><span>{viewer}의 몫</span><b>{man1(spent)}<em>만 원</em></b></div>
          <div className="bar" style={{ margin: '10px 0 0' }}><i style={{ width: `${perDay ? Math.min(100, (spent / perDay) * 100) : 0}%`, transition: 'width .4s' }} /></div>
          {over && <div className="over">하루 예산을 {man1(spent - perDay)}만 원 넘었어요</div>}
          {(left.length > 0 || toReceive > 0) && (
            <div className="r3">
              {left.map((c) => `${curName(c.currency)} ${fmtMinor(c.balance, c.currency)} 남음`).join(' · ')}
              {toReceive > 0 && `${left.length ? ' · ' : ''}받을 돈 약 ${man1(toReceive)}만 원`}
            </div>
          )}
        </div>
        {short.map((c) => (
          <div className="warn" key={c.currency}>이 속도면 남은 {summary.daysLeft}일 동안 {curName(c.currency)} {fmtMinor(c.shortfall, c.currency)} 부족해요</div>
        ))}
        <div className="tip">생활비 하루 {man1(LIVING_PER_DAY_KRW)}만 원은 예시 값이에요 · 원화는 결제일 환율로 계산해요</div>

        <div className="sched">
          {list.length === 0 && <div className="card sitem none">이날은 따로 낼 돈이 없어요 · 식사·이동은 상품가에 포함</div>}
          {list.map((r) => {
            // 원화 표시: 했다고 기록한 건 결제일 환율, 아직 안 한 일정은 상품 분석 때 환율
            const fxr = r.status === 'done' && r.currency && r.currency !== 'KRW' ? ctx.fxOf(r.currency, paidAtOf(r, TRIP.today).slice(0, 10)) : null
            const k = fxr && r.amount != null ? r.amount * fxr.rate : toKrw(r.amount, r.currency, data.fx)
            const off = r.src === '일정' && !planned(r)
            const dim = off && r.status !== 'done'
            const asks = Object.values(r.confirm ?? {})
            const waiting = asks.filter((s) => s === 'pending').length
            const out = asks.filter((s) => s === 'declined').length
            return (
              <div className={`card sitem ${dim ? 'dim' : ''}`} key={r.id}>
                <div className="top">
                  <div className="l">
                    {r.src === '일정' ? <time>{r.time}</time> : <span className={`badge ${badge(r.src)}`}>{r.src === '카드 문자' ? '카드' : r.src}</span>}
                    <div>
                      <b>{r.name}</b>
                      <small>
                        {r.category}{off ? (r.status === 'done' ? ' · 예산 밖 지출' : ' · 예산에 안 넣음') : ''}
                        {r.status === 'done' && (r.payer ? ` · ${payerNames(r).join('·')} 결제 · ${r.people.length}명` : ' · 각자 냄')}
                        {r.status === 'done' && r.method === 'cash' && ' · 현금'}
                        {r.status === 'done' && asks.length > 0 && (waiting ? ` · 확인 대기 ${waiting}명` : ' · 확인 끝')}
                        {r.status === 'done' && out > 0 && ` · ${out}명 빠짐`}
                        {r.status === 'review' && ' · 확인 전'}
                      </small>
                    </div>
                  </div>
                  <div className="amt">
                    {r.amount != null && r.currency ? money(r.amount, r.currency) : <span className="q">금액 미정</span>}
                    {k != null && r.currency !== 'KRW' && <small>약 {man1(k)}만 원</small>}
                  </div>
                </div>
                {r.src === '일정' ? (
                  <div className="yn">
                    <button className={r.status === 'done' ? 'on' : ''} onClick={() => update(r.id, { status: 'done', confirm: r.payer ? confirmFor(r.people, r.payer) : {} })}>했다</button>
                    <button className={r.status === 'skip' ? 'on' : ''} onClick={() => update(r.id, { status: 'skip' })}>안 했다</button>
                  </div>
                ) : (
                  <div className="evrow">“{r.evidence}”<button aria-label="기록 지우기" onClick={() => setRecords(records.filter((x) => x.id !== r.id))}><Icon name="x" size={14} sw={2.4} /></button></div>
                )}
                {r.lines && <LinesCard r={r} update={update} />}
                {r.status === 'done' && r.amount == null && <AmountInput onSave={(amount, currency) => update(r.id, { amount, currency })} />}
                <FxLine r={r} ctx={ctx} />
                {r.dup && (
                  <div className="dup">
                    같은 결제인가요? “{r.dup.name}”과 금액·시각이 비슷해요
                    <div className="yn">
                      <button onClick={() => setRecords(records.filter((x) => x.id !== r.id))}>같은 결제 · 지우기</button>
                      <button onClick={() => update(r.id, { dup: null })}>다른 결제예요</button>
                    </div>
                  </div>
                )}
                {r.plan && !r.dup && (
                  <div className="dup plan">
                    “{r.plan.name}” 예정 지출인가요? 이름이 비슷해요{r.plan.amountMatch ? ' · 금액도 같아요' : ''}
                    <div className="yn">
                      <button onClick={() => linkPlan(r)}>맞아요 · 일정에 기록</button>
                      <button onClick={() => update(r.id, { plan: null })}>아니에요</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {busy && <div className="card sitem busy"><div className="dots"><i /><i /><i /></div>{busy}</div>}
        </div>
        <button className="btn ink" style={{ marginTop: 16 }} onClick={() => go('settle')}>정산 보기<Icon name="arrow" size={18} sw={2.4} /></button>
      </div>

      <div className="voice">
        <div className={`in ${listening ? 'live' : ''}`}>
          <button className="mic" aria-label={listening ? '듣기 멈추기' : '말하기'} onClick={listen}><Icon name="mic" size={20} color={listening ? '#fff' : '#ff5f2e'} sw={2.2} /></button>
          <input value={line} onChange={(e) => setLine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendLine()} placeholder={listening ? '듣고 있어요…' : '"기념품 300리라 현금"'} />
          {line.trim() && <button className="send" aria-label="기록하기" onClick={sendLine}><Icon name="up" size={18} color="#fff" sw={2.6} /></button>}
        </div>
        <button className="cam" aria-label="영수증 찍기 · 직접 입력" onClick={() => { setMode('photo'); setSheet(true) }}><Icon name="cam" size={22} color="#fff" /></button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendPhoto(f) }} />

      {sheet && (
        <div className="dim-bg" onClick={() => setSheet(false)}>
          <div className="sheet-up" onClick={(e) => e.stopPropagation()}>
            <b>지출 기록하기</b>
            <div className="seg2 three" role="tablist">
              <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>영수증</button>
              <button className={mode === 'sms' ? 'on' : ''} onClick={() => setMode('sms')}>카드 문자</button>
              <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>직접 입력</button>
            </div>
            {mode === 'manual' ? (
              <div className="manual">
                <p>AI 없이 바로 기록해요. 같이 쓴 돈이면 나머지 사람에게 확인을 보내요.</p>
                <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="무엇에 썼나요? (예: 저녁 · 동굴 레스토랑)" />
                <div className="mrow">
                  <input inputMode="decimal" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="금액" />
                  <select value={manual.currency} onChange={(e) => setManual({ ...manual, currency: e.target.value })} aria-label="통화">
                    <option value="TRY">₺ 리라</option><option value="EUR">€ 유로</option><option value="USD">$ 달러</option><option value="KRW">원</option>
                  </select>
                </div>
                <div className="mrow">
                  <select value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })} aria-label="분류">
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <select value={manual.method} onChange={(e) => setManual({ ...manual, method: e.target.value })} aria-label="결제 수단">
                    <option value="card">카드</option><option value="cash">현금</option>
                  </select>
                </div>
                <div className="seg2">
                  <button className={manual.shared ? 'on' : ''} onClick={() => setManual({ ...manual, shared: true })}>{MEMBERS.length}명이 같이 씀</button>
                  <button className={!manual.shared ? 'on' : ''} onClick={() => setManual({ ...manual, shared: false })}>나만 씀</button>
                </div>
                <button className="btn brand" disabled={!manual.name.trim() || !(Number(manual.amount) > 0)} onClick={saveManual}>{viewer}{iGa(viewer)} 낸 돈으로 기록</button>
              </div>
            ) : (
              <>
                <p>금액과 통화를 AI가 읽어요. 같이 쓴 돈이면 한마디 덧붙이세요.</p>
                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예) 케밥은 다 같이, 차는 하린이랑 도윤만" />
                {mode === 'photo' ? (
                  <>
                    <button className="btn brand" onClick={() => fileRef.current?.click()}>사진 찍기 · 고르기</button>
                    <button className="btn line" onClick={sampleReceipt}>예시 영수증으로 해보기</button>
                  </>
                ) : (
                  <>
                    <textarea className="smsin" value={sms} onChange={(e) => setSms(e.target.value)} placeholder="카드사 결제 문자를 길게 눌러 복사한 뒤 붙여 넣으세요" />
                    <button className="btn brand" disabled={!sms.trim()} onClick={sendSms}>문자로 기록하기</button>
                    <button className="btn line" onClick={() => setSms(SAMPLE_SMS)}>예시 문자 넣기</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Settle({ records, setRecords, go, toast, viewer, setViewer, ctx }) {
  const s = ctx.settle
  const [editing, setEditing] = useState(null)
  const [payDraft, setPayDraft] = useState(null) // 여러 명이 나눠 낸 금액 입력 중 { id, rows: { 이름: '금액' } }
  const list = records.filter((r) => r.status === 'done' && r.payer && r.amount != null && r.currency)
  const asks = list.filter((r) => r.confirm?.[viewer] === 'pending')
  const update = (id, patch) => setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  // 참여자 확인 (R-11): "안 갔어요" 면 서버가 그 사람을 빼고 다시 나눈다
  function answer(r, status) {
    update(r.id, { confirm: { ...r.confirm, [viewer]: status } })
    toast(status === 'declined' ? `${viewer}${eul(viewer)} 빼고 남은 사람끼리 다시 나눴어요` : '확인했어요')
  }
  const setPayer = (r, p) => update(r.id, { payer: p, payers: undefined, confirm: confirmFor(r.people, p, r.confirm) })

  // 결제자가 여러 명 (R-08): 각자 낸 금액의 합이 총액과 같아야 저장된다
  function openSplitPay(r) {
    const now = r.payers?.length > 1 ? r.payers : [{ name: r.payer, amount: totalOf(r) }]
    setPayDraft({ id: r.id, rows: Object.fromEntries(now.map((p) => [p.name, String(p.amount)])) })
  }
  function saveSplitPay(r) {
    const rows = MEMBERS.filter((m) => Number(payDraft.rows[m]) > 0).map((m) => ({ name: m, amount: Number(payDraft.rows[m]), method: r.method ?? 'card' }))
    const names = rows.map((p) => p.name)
    update(r.id, { payer: names[0], payers: rows.length > 1 ? rows : undefined, confirm: confirmFor(r.people, names, r.confirm) })
    setPayDraft(null)
    toast(rows.length > 1 ? `${names.join('·')} 나눠 낸 걸로 바꿨어요` : `${names[0]}${iGa(names[0])} 낸 걸로 바꿨어요`)
  }
  function togglePerson(r, p) {
    const has = r.people.includes(p)
    if (has && r.people.length === 1) return
    const people = has ? r.people.filter((x) => x !== p) : [...r.people, p]
    const confirm = { ...r.confirm }
    if (has) delete confirm[p]
    else if (!payerNames(r).includes(p)) confirm[p] = 'pending'
    update(r.id, { people, confirm })
  }
  // 금액을 고치면 고친 기록을 남긴다 (R-14)
  // 줄 단위 영수증의 총액을 고치면 줄과 맞지 않으므로 줄 배정은 지우고 나눌 사람끼리 1/N 로 바꾼다. 나눠 낸 금액도 다시 정한다
  function fixAmount(r, amount, currency) {
    const note = r.lines ? ' (줄 배정 지우고 1/N)' : ''
    update(r.id, {
      amount, currency, payers: undefined,
      ...(r.lines ? { lines: undefined, splits: undefined, questions: undefined } : {}),
      edits: [...(r.edits ?? []), { at: new Date().toISOString(), from: money(totalOf(r), r.currency), to: `${money(amount, currency)}${note}` }],
    })
    setEditing(null)
  }
  const stateOf = (r, x) => {
    if (!r.people.includes(x)) return '안 함'
    if (payerNames(r).includes(x)) return '결제'
    return { confirmed: '확인', declined: '안 감', pending: '확인 전' }[r.confirm?.[x]] ?? '참여'
  }

  const groups = s ? Object.entries(s.byCurrency).filter(([, v]) => v.transfers.length) : []
  const n = groups.reduce((a, [, v]) => a + v.transfers.length, 0)

  return (
    <div className="scroll settle">
      <div className="brandbg" />
      <img className="mas" src="/img/mascot.png" alt="" />
      <div className="inner">
        <button className="hd" onClick={() => go('ledger')}><Icon name="back" size={22} color="#fff" sw={2.2} />여행 정산</button>
        <ViewerBar viewer={viewer} setViewer={setViewer} dark />
        <h1>{asks.length ? <>{viewer}님,<br />확인할 결제가 {asks.length}건</> : n ? <>통화별로 {n}건,<br />지갑에서 자동으로</> : <>보낼 돈이<br />없어요</>}</h1>
        <div className="basis">기본 1/N · 환율은 결제일 기준 · 통화별로 따로</div>

        {asks.length > 0 && (
          <>
            <div className="sec" style={{ margin: '24px 0 10px' }}><h2 style={{ fontSize: 15, color: '#fff' }}>나에게 온 확인</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {asks.map((r) => (
                <div className="card ask" key={r.id}>
                  <b>{r.name} · {money(totalOf(r), r.currency)}</b>
                  <p>{r.payer} 결제 · {r.people.join(' · ')} {r.people.length}명이 나눠요</p>
                  <div className="yn">
                    <button className="on" onClick={() => answer(r, 'confirmed')}>맞아요</button>
                    <button onClick={() => answer(r, 'declined')}>안 갔어요</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sec" style={{ margin: '28px 0 10px' }}><h2 style={{ fontSize: 15 }}>통화별 정산</h2></div>
        {ctx.settleErr && <div className="err">{ctx.settleErr.message}{ctx.settleErr.detail ? ` · ${[].concat(ctx.settleErr.detail).join(', ')}` : ''}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map(([cur, v]) => (
            <div key={cur} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="curhd">{curName(cur)} ({cur})</div>
              {v.transfers.map((t) => {
                const fx = ctx.fxOf(cur, dayDate(TRIP.today))
                const krw = fx ? fromMinor(t.amount, cur) * fx.rate : null
                return (
                  <div className="tr" key={`${cur}${t.fromId}${t.toId}`}>
                    <div className="who">{NAME_OF[t.fromId]}<Icon name="arrow" size={18} color="#6b7684" sw={2.2} />{NAME_OF[t.toId]}</div>
                    <div><b>{fmtMinor(t.amount, cur)}</b>{cur !== 'KRW' && krw != null && <small>약 {man1(krw)}만 원</small>}</div>
                  </div>
                )
              })}
            </div>
          ))}
          {n === 0 && !ctx.settleErr && <div className="wait">가계부에서 같이 쓴 돈을 기록하면 여기 나와요</div>}
        </div>
        {s?.pendingIds.length > 0 && <div className="cap" style={{ marginTop: 8 }}>확인을 기다리는 결제 {s.pendingIds.length}건은 모두 확인해야 지갑에 반영돼요</div>}
        <button className="btn ink" style={{ marginTop: 16 }} onClick={() => go('wallet')}>지갑에서 확인하기<Icon name="arrow" size={18} sw={2.4} /></button>
        <div className="cap" style={{ marginTop: 8, textAlign: 'center' }}>앱 안의 기록상 정산이에요 · 실제 송금은 연결하지 않았어요</div>

        <div className="sec" style={{ margin: '28px 0 10px' }}><h2 style={{ fontSize: 15 }}>결제 기록 {list.length}건</h2><span>눌러서 고치기</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((r) => {
            return (
              <div className="card ppl" key={r.id}>
                <div className="r">
                  <div><b>{r.name}</b><small>{r.day ? `DAY ${r.day}` : '날짜 미정'} · {r.src === '일정' ? '일정에서 기록' : `${r.src}로 기록`}{r.method === 'cash' ? ' · 현금' : ''}</small></div>
                  <div className="amt">
                    <strong>{money(totalOf(r), r.currency)}</strong>
                    <button className="fix" onClick={() => setEditing(editing === r.id ? null : r.id)}>금액 고치기</button>
                  </div>
                </div>
                {editing === r.id && <AmountInput onSave={(amount, currency) => fixAmount(r, amount, currency)} />}
                {(r.edits ?? []).map((e) => <div className="fxl" key={e.at}>고친 기록 · {e.from} → {e.to} ({new Date(e.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })})</div>)}
                <div className="payrow">
                  <span>결제</span>
                  {MEMBERS.map((m) => <button key={m} className={payerNames(r).includes(m) ? 'on' : ''} onClick={() => setPayer(r, m)}>{m}</button>)}
                </div>
                {r.payers?.length > 1 && <div className="fxl">{r.payers.map((p) => `${p.name} ${money(p.amount, r.currency)}`).join(' · ')} 나눠 냄</div>}
                <button className="fix" onClick={() => (payDraft?.id === r.id ? setPayDraft(null) : openSplitPay(r))}>{payDraft?.id === r.id ? '닫기' : '여러 명이 나눠 냈어요'}</button>
                {payDraft?.id === r.id && (() => {
                  const sum = MEMBERS.reduce((a, m) => a + toMinor(Number(payDraft.rows[m]) || 0, r.currency), 0)
                  const total = toMinor(totalOf(r), r.currency)
                  return (
                    <div className="splitpay">
                      {MEMBERS.map((m) => (
                        <label key={m}>
                          <span>{m}</span>
                          <input inputMode="decimal" placeholder="0" value={payDraft.rows[m] ?? ''}
                            onChange={(e) => setPayDraft((d) => ({ ...d, rows: { ...d.rows, [m]: e.target.value.replace(/[^\d.]/g, '') } }))} />
                        </label>
                      ))}
                      <div className={`cap ${sum === total ? '' : 'bad'}`}>낸 돈 합계 {fmtMinor(sum, r.currency)} / 총액 {fmtMinor(total, r.currency)}{sum === total ? '' : ' · 합이 같아야 저장돼요'}</div>
                      <button className="btn brand" disabled={sum !== total || sum === 0} onClick={() => saveSplitPay(r)}>저장</button>
                    </div>
                  )
                })()}
                <div className="pgrid">
                  {MEMBERS.map((x) => {
                    const on = r.people.includes(x) && r.confirm?.[x] !== 'declined'
                    return (
                      <button key={x} className={`person ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => togglePerson(r, x)}>
                        <i>{x[0]}</i><b>{x}</b><small>{stateOf(r, x)}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="note-s">영수증·카드 문자·음성은 AI가 덧붙인 말에서 찾은 사람으로 먼저 채워요. 지목된 사람이 “맞아요”를 눌러야 지갑에서 빠져요.</div>
      </div>
    </div>
  )
}

// 내 지갑 (R-05) · 자동 차감 (R-12) · 잔액 부족과 현금 주고받기 (R-13)
function Wallet({ records, viewer, setViewer, ctx, setCash }) {
  const w = ctx.walletRes
  const vid = MEMBER_IDS[viewer]
  const nameOf = (id) => records.find((r) => r.id === id)?.name ?? '결제'
  if (!w) {
    return (
      <div className="scroll pad">
        <ViewerBar viewer={viewer} setViewer={setViewer} />
        {ctx.walletErr ? <div className="err">{ctx.walletErr.message}</div> : <div className="wait" style={{ marginTop: 20 }}>지갑 계산 중</div>}
      </div>
    )
  }

  const mine = w.wallets.find((x) => x.memberId === vid)?.balances ?? []
  const byCur = {}
  for (const b of mine) (byCur[b.currency] ??= { card: 0, cash: 0 })[b.method] += b.amount
  const todo = w.cashTransfers.filter((t) => t.fromId === vid || t.toId === vid)
  const moves = w.moves.filter((m) => m.fromId === vid || m.toId === vid)
  const mark = (id, field) => setCash((c) => ({ ...c, [id]: { ...c[id], [field]: true } }))

  return (
    <div className="scroll pad">
      <div className="ledger-head"><h1>{viewer}의 지갑</h1><span>환전해 둔 돈</span></div>
      <ViewerBar viewer={viewer} setViewer={setViewer} />

      {todo.map((t) => {
        const amt = fmtMinor(t.money.amount, t.money.currency)
        const done = t.given && t.received
        if (done) return <div className="alert done" key={t.id}>{nameOf(t.expenseId)} · {NAME_OF[t.fromId]} → {NAME_OF[t.toId]} 현금 {amt} 주고받음 · 끝</div>
        return t.fromId === vid ? (
          <div className="alert" key={t.id}>
            잔액 부족 · {nameOf(t.expenseId)} 내 몫 {amt}
            <p>카드 {curName(t.money.currency)} 잔액이 {fmtMinor(t.have, t.money.currency)}라 자동으로 못 옮겼어요. {NAME_OF[t.toId]}에게 현금으로 주세요.</p>
            {t.given
              ? <p><b>{NAME_OF[t.toId]}{iGa(NAME_OF[t.toId])} “받았어요”를 누르면 끝나요</b></p>
              : <button className="btn brand" onClick={() => mark(t.id, 'given')}>현금 줬어요</button>}
          </div>
        ) : (
          <div className="alert" key={t.id}>
            {NAME_OF[t.fromId]} 잔액 부족 · {nameOf(t.expenseId)} 몫 {amt}
            <p>{NAME_OF[t.fromId]}의 카드 잔액이 모자라 현금으로 받아야 해요. {t.given ? `${NAME_OF[t.fromId]}${iGa(NAME_OF[t.fromId])} “줬어요”를 눌렀어요.` : ''}</p>
            {t.received
              ? <p><b>{NAME_OF[t.fromId]}{iGa(NAME_OF[t.fromId])} “줬어요”를 누르면 끝나요</b></p>
              : <button className="btn brand" onClick={() => mark(t.id, 'received')}>현금 받았어요</button>}
          </div>
        )
      })}

      {Object.entries(byCur).map(([cur, v]) => {
        const fx = ctx.fxOf(cur, dayDate(TRIP.today))
        const total = v.card + v.cash
        return (
          <div className="card wal" key={cur}>
            <div className="t">
              <div><small>{curName(cur)} ({cur})</small><b>{fmtMinor(total, cur)}</b></div>
              {fx && cur !== 'KRW' && <small>약 {man1(fromMinor(total, cur) * fx.rate)}만 원</small>}
            </div>
            <div className="sp"><span>카드 {fmtMinor(v.card, cur)}</span><span>현금 {fmtMinor(v.cash, cur)}</span></div>
          </div>
        )
      })}

      <div className="sec"><h2>자동으로 옮긴 몫</h2><span>모두 확인한 결제만</span></div>
      <div className="card" style={{ padding: '4px 16px' }}>
        {moves.length === 0 && <div className="mv"><span>아직 없어요</span></div>}
        {moves.map((m, i) => (
          <div className="mv" key={i}>
            <span>{nameOf(m.expenseId)} · {NAME_OF[m.fromId]} → {NAME_OF[m.toId]}</span>
            <b className={m.toId === vid ? 'plus' : ''}>{m.toId === vid ? '+' : '−'}{fmtMinor(m.amount, m.currency)}</b>
          </div>
        ))}
      </div>
      {w.pending.length > 0 && <div className="cap" style={{ marginTop: 8 }}>확인을 기다리는 결제 {w.pending.length}건은 아직 반영 전이에요</div>}
      <div className="cap" style={{ marginTop: 8 }}>앱 안의 기록상 차감이에요 · 실제 송금 아님 · 원화로 낸 돈은 지갑에 넣지 않아요</div>
    </div>
  )
}

// 예상 vs 실제 (R-22): 계산은 서버 /api/report
function Report({ data, picks, reset, viewer, setViewer, ctx }) {
  const { data: rep, error } = usePost('/api/report', { estimate: data, picks, members: ROOM, memberId: MEMBER_IDS[viewer], expenses: ctx.expenses })
  if (!rep) {
    return (
      <div className="scroll pad report">
        <ViewerBar viewer={viewer} setViewer={setViewer} />
        {error ? <div className="err">{error.message}</div> : <div className="wait" style={{ marginTop: 20 }}>리포트 계산 중</div>}
      </div>
    )
  }
  const base = data.base_price_krw ?? 0
  const rows = rep.rows.filter((r) => r.key !== '상품가' && (r.predicted || r.actual))
  const max = Math.max(...rows.flatMap((r) => [r.predicted, r.actual]), 1)
  const undone = rep.unrecordedItems.length

  return (
    <div className="scroll pad report">
      <div className="ledger-head"><h1>예측 vs 실제</h1><span>{viewer} 몫 기준</span></div>
      <ViewerBar viewer={viewer} setViewer={setViewer} />
      <div className="card vs">
        <div><small>예약 전 예측</small><b>{man(rep.predictedTotal)}<em>만 원</em></b></div>
        <Icon name="arrow" size={22} color="#b0b8c1" sw={2.2} />
        <div className="act"><small>지금까지 진짜 총비용</small><b>{man(rep.actualTotal)}<em>만 원</em></b></div>
      </div>
      <div className="vsnote">
        {undone > 0 ? `아직 기록 안 한 예정 지출 ${undone}건이 남아 있어요. 여행이 끝나면 최종 비교가 돼요.` : '예정한 지출을 모두 기록했어요.'}
        {rep.extraCount > 0 && ` 예측에 없던 지출 ${rep.extraCount}건이 더해졌어요.`}
        {rep.missingFx.length > 0 && ` 환율을 몰라 ${rep.missingFx.length}건은 빠졌어요.`}
      </div>

      <div className="sec"><h2>항목별</h2><span><i className="lg p" />예측 <i className="lg a" />실제</span></div>
      <div className="card bars">
        {rows.map((r) => (
          <div className="brow" key={r.key}>
            <div className="bl"><b>{r.key}</b><small>{man1(r.predicted)} → <strong>{man1(r.actual)}</strong>만 원</small></div>
            <div className="bt"><i className="p" style={{ width: `${(r.predicted / max) * 100}%` }} /></div>
            <div className="bt"><i className="a" style={{ width: `${(r.actual / max) * 100}%` }} /></div>
          </div>
        ))}
        <div className="cap">상품가 {man(base)}만 원은 양쪽에 같게 들어 있어요 · 실제는 결제일 환율로 계산한 내 몫이에요</div>
      </div>

      <div className="card share">
        <b>다음 여행자의 예측이 돼요</b>
        <p>실제로 쓴 돈은 이름 없이 모여, 같은 상품을 보는 사람의 “진짜 총비용”을 더 정확하게 만들어요. 하나투어는 선택관광 참여율과 현지 지출을 상품 기획에 쓸 수 있어요.</p>
        <small>구상 단계 · 시연에는 저장하지 않아요</small>
      </div>
      <button className="btn line" style={{ marginTop: 16 }} onClick={reset}>시연 처음 상태로 되돌리기</button>
    </div>
  )
}

const tripDays = (data) => {
  const m = data?.title?.match(/(\d+)\s*박\s*(\d+)\s*일/)
  return m ? Number(m[2]) : isTurkey(data?.title) ? TRIP.days : null
}

export default function App() {
  const [splash, setSplash] = useState(true)
  const [screen, setScreen] = useState('home')
  const [text, setText] = useState('')
  const [data, setData] = useStored('290-data', null)
  const [picks, setPicks] = useStored('290-picks', [])
  const [records, setRecords] = useStored('290-records', [])
  const [day, setDay] = useStored('290-day', TRIP.today)
  const [viewer, setViewer] = useStored('290-viewer', ME)
  const [cash, setCash] = useStored('290-cash', {})
  const fxStore = useStored('290-fx', {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { const t = setTimeout(() => setSplash(false), 1400); return () => clearTimeout(t) }, [])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 1800); return () => clearTimeout(t) }, [msg])

  function accept(j) {
    setData(j)
    setPicks(j.items.map((it, i) => (!it.required && it.amount != null ? i : -1)).filter((i) => i >= 0))
    setRecords([])
    setCash({})
    setDay(isTurkey(j.title) ? TRIP.today : 0)
  }

  async function run(t = text) {
    setError(''); setLoading(true); setScreen('result')
    try {
      accept(await post('/api/estimate', { text: t }))
    } catch (e) {
      // 시연 문구는 인터넷이 끊겨도 저장된 결과로 이어 간다
      if (t.trim() === SAMPLE.trim()) accept({ ...SAMPLE_RESULT, saved: true })
      else { setError(e.message || '분석에 실패했어요'); setScreen('paste') }
    } finally { setLoading(false) }
  }

  function openPaste(t, auto) { setText(t); setError(''); if (auto) run(t); else setScreen('paste') }
  function startDemo() { if (data && records.length) setScreen('ledger'); else openPaste(SAMPLE, true) }
  function makeLedger() { if (!records.length) setRecords(buildRecords(data)); setScreen('ledger') }
  function reset() {
    setRecords(buildRecords(data)); setCash({}); setViewer(ME)
    setDay(isTurkey(data.title) ? TRIP.today : 0); setMsg('여행 3일째 상태로 되돌렸어요')
  }

  const tab = useMemo(() => (['ledger', 'settle', 'wallet', 'report'].includes(screen) ? screen : 'home'), [screen])
  const showTab = ['home', 'ledger', 'settle', 'wallet', 'report'].includes(screen)
  const ready = data && records.length > 0

  // 서버 계산 (R-24): 기록 → Expense → 정산 · 지갑 · 예산
  const needs = records
    .filter((r) => r.status === 'done' && r.currency && r.currency !== 'KRW')
    .map((r) => ({ currency: r.currency, date: paidAtOf(r, TRIP.today).slice(0, 10) }))
  const fxOf = useFx(needs, data?.fx ?? null, fxStore)
  const expenses = ready ? records.map((r) => toExpense(r, fxOf, TRIP.today)).filter(Boolean) : []
  const days = tripDays(data)
  const settleQ = usePost('/api/settle', ready ? { members: ROOM, expenses } : null)
  const walletQ = usePost('/api/settle/wallets/replay', ready
    ? { members: ROOM, wallets: WALLETS, expenses: expenses.filter((e) => e.total.currency !== 'KRW'), cashStatus: cash }
    : null)
  const budgetQ = usePost('/api/budget', data && days ? { estimate: data, picks, days, livingPerDayKrw: LIVING_PER_DAY_KRW } : null)
  const ctx = {
    expenses, fxOf,
    settle: settleQ.data, settleErr: settleQ.error,
    walletRes: walletQ.data, walletErr: walletQ.error,
    budget: budgetQ.data,
    days: days ?? TRIP.days, // 상품 일정 일수 (모르면 예시 일정 9일)
  }

  const vid = MEMBER_IDS[viewer]
  const dots = {
    settle: records.some((r) => r.status === 'done' && r.confirm?.[viewer] === 'pending'),
    wallet: !!walletQ.data?.cashTransfers.some((t) => !(t.given && t.received) && (t.fromId === vid || t.toId === vid)),
  }
  const common = { viewer, setViewer, ctx }

  return (
    <div className="phone">
      <div className={`splash ${splash ? '' : 'hide'}`}>
        <img className="bob" src="/img/mascot.png" alt="" width="120" />
        <h1>290</h1><p>가격표 말고, 진짜 총비용</p><small>패키지 여행 가계부</small>
      </div>
      {screen === 'home' && <Home openPaste={openPaste} startDemo={startDemo} />}
      {screen === 'paste' && <Paste text={text} setText={setText} run={() => run()} back={() => setScreen('home')} error={error} />}
      {screen === 'result' && (loading || !data ? <Loading /> : <Result data={data} picks={picks} setPicks={setPicks} back={() => setScreen('paste')} makeLedger={makeLedger} budget={budgetQ.data} />)}
      {screen === 'ledger' && (ready ? <Ledger data={data} picks={picks} records={records} setRecords={setRecords} day={day} setDay={setDay} toast={setMsg} go={setScreen} {...common} /> : <Empty startDemo={startDemo} what="가계부" />)}
      {screen === 'settle' && (ready ? <Settle records={records} setRecords={setRecords} go={setScreen} toast={setMsg} {...common} /> : <Empty startDemo={startDemo} what="정산할 돈" />)}
      {screen === 'wallet' && (ready ? <Wallet records={records} setCash={setCash} {...common} /> : <Empty startDemo={startDemo} what="지갑" />)}
      {screen === 'report' && (ready ? <Report data={data} picks={picks} reset={reset} {...common} /> : <Empty startDemo={startDemo} what="리포트" />)}
      {showTab && <TabBar tab={tab} go={setScreen} dots={dots} />}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
