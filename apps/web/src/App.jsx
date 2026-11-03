import { useEffect, useMemo, useRef, useState } from 'react'
import { SAMPLE, SAMPLE_RESULT, SAMPLE_SMS, ME, MEMBERS, TRIP, SEED } from './sample.js'

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
const won = (krw) => `${(Math.round(krw / 10) * 10).toLocaleString('ko-KR')}원`
const money = (amount, cur) => (cur === 'KRW' ? `${man1(amount)}만 원` : `${SYM[cur] ?? ''}${amount.toLocaleString('ko-KR')}`)
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
    return [{
      id: `i${i}`, idx: i, src: '일정', day: slot?.day ?? 0, time: slot?.time ?? '',
      name: it.name, category: it.category, amount: it.amount, currency: it.currency === 'OTHER' ? null : it.currency,
      perPerson: true, required: it.required,
      status: seed?.status ?? null,
      payer: seed ? seed.payer : personal ? null : ME,
      people: seed?.people ?? (personal ? [ME] : [...MEMBERS]),
    }]
  })
}

// 내 몫 (원). 했다고 기록된 것만.
function myShare(r, fx) {
  if (r.status !== 'done' || !r.people.includes(ME)) return 0
  const k = toKrw(r.amount, r.currency, fx)
  if (k == null) return 0
  return r.perPerson ? k : k / r.people.length
}

const settleable = (r) => r.status === 'done' && r.payer && r.amount != null && r.currency

// 참여한 사람끼리만 나누고, 통화를 원화로 묶어 사람별 잔액을 낸다
function balances(records, fx) {
  const bal = Object.fromEntries(MEMBERS.map((m) => [m, 0]))
  let naive = 0
  for (const r of records.filter(settleable)) {
    const k = toKrw(r.amount, r.currency, fx)
    if (k == null) continue
    const total = r.perPerson ? k * r.people.length : k
    bal[r.payer] += total
    for (const p of r.people) bal[p] -= total / r.people.length
    naive += r.people.filter((p) => p !== r.payer).length
  }
  return { bal, naive }
}

// 최소 송금: 가장 많이 받을 사람과 가장 많이 보낼 사람을 차례로 맞춘다
function minTransfers(bal) {
  const cred = [], debt = []
  for (const [n, v] of Object.entries(bal)) {
    if (v > 5) cred.push([n, v])
    else if (v < -5) debt.push([n, -v])
  }
  cred.sort((a, b) => b[1] - a[1])
  debt.sort((a, b) => b[1] - a[1])
  const out = []
  let i = 0, j = 0
  while (i < debt.length && j < cred.length) {
    const x = Math.min(debt[i][1], cred[j][1])
    out.push({ from: debt[i][0], to: cred[j][0], krw: x })
    debt[i][1] -= x
    cred[j][1] -= x
    if (debt[i][1] <= 5) i++
    if (cred[j][1] <= 5) j++
  }
  return out
}

const catKey = (c) => (c === '선택관광' ? '선택관광' : c === '가이드·기사 경비' ? '가이드·기사 경비' : /식사/.test(c) ? '식사' : '기타')

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

function TabBar({ tab, go, toast }) {
  const tabs = [['home', '홈', 'home'], ['ledger', '가계부', 'book'], ['settle', '정산', 'split'], ['report', '리포트', 'chart'], [null, 'MY', 'user']]
  return (
    <nav className="tabbar">
      {tabs.map(([id, label, icon]) => (
        <button key={label} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => (id ? go(id) : toast('시연 범위 밖이에요'))}>
          <Icon name={icon} sw={tab === id ? 2.2 : 1.9} />
          {label}
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

function Result({ data, picks, setPicks, back, makeLedger }) {
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

function Ledger({ data, picks, records, setRecords, day, setDay, toast, go }) {
  const fx = data.fx
  const trip = isTurkey(data.title)
  const [line, setLine] = useState('')
  const [busy, setBusy] = useState('')
  const [listening, setListening] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [mode, setMode] = useState('photo')
  const [memo, setMemo] = useState('')
  const [sms, setSms] = useState('')
  const recRef = useRef(null)
  const fileRef = useRef(null)

  const days = trip ? Array.from({ length: TRIP.days }, (_, k) => k + 1) : []
  if (records.some((r) => r.day === 0) || !trip) days.push(0)
  const list = records.filter((r) => r.day === day)
  const planned = (r) => r.required || r.src !== '일정' || picks.includes(r.idx)
  const plan = list.filter((r) => r.src === '일정' && planned(r)).reduce((a, r) => a + (toKrw(r.amount, r.currency, fx) ?? 0), 0)
  const spent = list.reduce((a, r) => a + myShare(r, fx), 0)
  const place = trip ? TRIP.places[day] : ''

  const update = (id, patch) => setRecords(records.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  async function addFrom(body, src) {
    setBusy(src === '영수증' ? '영수증 읽는 중' : src === '카드 문자' ? '카드 문자 읽는 중' : '말한 내용 정리하는 중')
    try {
      const out = await post('/api/record', { ...body, members: MEMBERS, me: ME })
      const rec = {
        id: `r${Date.now()}`, src, day, time: '', name: out.name, category: out.category,
        amount: out.amount, currency: out.currency === 'OTHER' ? null : out.currency,
        perPerson: false, required: false, status: 'done',
        payer: out.payer ?? ME, people: out.people.length ? out.people : [ME], evidence: out.evidence,
      }
      setRecords((rs) => [...rs, rec])
      toast(rec.people.length > 1 ? `${rec.people.length}명이 나눌 돈으로 기록했어요` : '내 지출로 기록했어요')
    } catch (e) {
      toast(e.message)
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

  async function sendPhoto(blob) {
    setSheet(false)
    try {
      const image = await shrink(blob)
      addFrom({ image, text: memo.trim() }, '영수증')
      setMemo('')
    } catch {
      toast('사진을 읽지 못했어요')
    }
  }

  function sendSms() {
    const t = sms.trim()
    if (!t) return
    setSheet(false)
    setSms('')
    addFrom({ text: memo.trim() ? `${t}
덧붙인 말: ${memo.trim()}` : t, kind: 'sms' }, '카드 문자')
    setMemo('')
  }

  async function sampleReceipt() {
    const b = await fetch('/img/receipt-sample.jpg').then((r) => r.blob())
    sendPhoto(b)
  }

  return (
    <>
      <div className="scroll pad">
        <div className="ledger-head"><h1>여행 가계부</h1><span>{data.title || '붙여 넣은 상품'}</span></div>
        <div className="days">
          {days.map((d) => (
            <button key={d} className={`day ${d === day ? 'on' : ''} ${trip && d === TRIP.today ? 'now' : ''}`} onClick={() => setDay(d)}>
              <small>{d === 0 ? '날짜' : 'DAY'}</small><b>{d === 0 ? '미정' : d}</b>
            </button>
          ))}
        </div>
        <div className="today">
          <div className="r1">{day === 0 ? '날짜 미정' : `DAY ${day}${place ? ` · ${place}` : ''}`}<span>{plan ? `예상 ${man1(plan)}만 원` : '예상 지출 없음'}</span></div>
          <div className="r2"><span>내가 쓴 돈</span><b>{man1(spent)}<em>만 원</em></b></div>
          <div className="bar" style={{ margin: '10px 0 0' }}><i style={{ width: `${plan ? Math.min(100, (spent / plan) * 100) : spent ? 100 : 0}%`, transition: 'width .4s' }} /></div>
        </div>
        <div className="tip">{trip && day === TRIP.today ? '오늘이에요. 일정이 곧 가계부라, 눌러서 기록하세요.' : '일정이 곧 가계부예요. 눌러서 기록하세요.'}</div>

        <div className="sched">
          {list.length === 0 && <div className="card sitem none">이날은 따로 낼 돈이 없어요 · 식사·이동은 상품가에 포함</div>}
          {list.map((r) => {
            const k = toKrw(r.amount, r.currency, fx)
            const off = r.src === '일정' && !planned(r)
            const dim = off && r.status !== 'done'
            return (
              <div className={`card sitem ${dim ? 'dim' : ''}`} key={r.id}>
                <div className="top">
                  <div className="l">
                    {r.src === '일정' ? <time>{r.time}</time> : <span className={`badge ${r.src === '영수증' ? 'rc' : r.src === '카드 문자' ? 'cd' : 'vc'}`}>{r.src === '카드 문자' ? '카드' : r.src}</span>}
                    <div>
                      <b>{r.name}</b>
                      <small>
                        {r.category}{off ? (r.status === 'done' ? ' · 예산 밖 지출' : ' · 예산에 안 넣음') : ''}
                        {r.status === 'done' && (r.payer ? ` · ${r.payer} 결제 · ${r.people.length}명` : ' · 각자 냄')}
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
                    <button className={r.status === 'done' ? 'on' : ''} onClick={() => update(r.id, { status: 'done' })}>했다</button>
                    <button className={r.status === 'skip' ? 'on' : ''} onClick={() => update(r.id, { status: 'skip' })}>안 했다</button>
                  </div>
                ) : (
                  <div className="evrow">“{r.evidence}”<button aria-label="기록 지우기" onClick={() => setRecords(records.filter((x) => x.id !== r.id))}><Icon name="x" size={14} sw={2.4} /></button></div>
                )}
                {r.status === 'done' && r.amount == null && <AmountInput onSave={(amount, currency) => update(r.id, { amount, currency })} />}
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
          <input value={line} onChange={(e) => setLine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendLine()} placeholder={listening ? '듣고 있어요…' : '"저녁 3200리라, 하린이 냈어"'} />
          {line.trim() && <button className="send" aria-label="기록하기" onClick={sendLine}><Icon name="up" size={18} color="#fff" sw={2.6} /></button>}
        </div>
        <button className="cam" aria-label="영수증 찍기" onClick={() => setSheet(true)}><Icon name="cam" size={22} color="#fff" /></button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendPhoto(f) }} />

      {sheet && (
        <div className="dim-bg" onClick={() => setSheet(false)}>
          <div className="sheet-up" onClick={(e) => e.stopPropagation()}>
            <b>영수증 · 카드 문자로 기록</b>
            <p>금액과 통화를 AI가 읽어요. 같이 쓴 돈이면 한마디 덧붙이세요.</p>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예) 넷이 먹었고 하린이 냄" />
            <div className="seg2" role="tablist">
              <button className={mode === 'photo' ? 'on' : ''} onClick={() => setMode('photo')}>영수증 사진</button>
              <button className={mode === 'sms' ? 'on' : ''} onClick={() => setMode('sms')}>카드 결제 문자</button>
            </div>
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
          </div>
        </div>
      )}
    </>
  )
}

function Settle({ data, records, setRecords, go, toast }) {
  const fx = data.fx
  const list = records.filter(settleable)
  const { bal, naive } = balances(records, fx)
  const tr = minTransfers(bal)
  const [sent, setSent] = useState(false)
  const update = (id, patch) => setRecords(records.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const togglePerson = (r, p) => {
    const has = r.people.includes(p)
    if (has && r.people.length === 1) return
    update(r.id, { people: has ? r.people.filter((x) => x !== p) : [...r.people, p] })
  }

  return (
    <div className="scroll settle">
      <div className="brandbg" />
      <img className="mas" src="/img/mascot.png" alt="" />
      <div className="inner">
        <button className="hd" onClick={() => go('ledger')}><Icon name="back" size={22} color="#fff" sw={2.2} />여행 정산</button>
        <h1>{tr.length ? <>송금 {tr.length}번이면<br />끝나요</> : <>보낼 돈이<br />없어요</>}</h1>
        <div className="sub">{naive > tr.length ? `따로 보내면 ${naive}번 · 원화로 묶어 한 번에 맞췄어요` : '참여한 사람끼리만 나눴어요'}</div>

        <div className="sec" style={{ margin: '28px 0 10px' }}><h2 style={{ fontSize: 15 }}>보낼 돈</h2></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tr.map((t) => (
            <div className="tr" key={t.from + t.to}><div className="who">{t.from}<Icon name="arrow" size={18} color="#6b7684" sw={2.2} />{t.to}</div><b>{won(t.krw)}</b></div>
          ))}
          {tr.length === 0 && <div className="wait">가계부에서 같이 쓴 돈을 기록하면 여기 나와요</div>}
        </div>
        {tr.length > 0 && (
          <>
            <button className="btn ink" style={{ marginTop: 16 }} onClick={() => { setSent(true); toast(`송금 링크 ${tr.length}개를 만들었어요`) }}>
              {sent ? '송금 링크 다시 보내기' : '송금 링크 보내기'}<Icon name="arrow" size={18} sw={2.4} />
            </button>
            <div className="cap" style={{ marginTop: 8, textAlign: 'center' }}>{fx ? `${fx.date} 기준 환율로 원화 환산 · ` : ''}시연용 · 실제 송금은 연결하지 않았어요</div>
          </>
        )}

        <div className="sec" style={{ margin: '28px 0 10px' }}><h2 style={{ fontSize: 15 }}>결제 기록 {list.length}건</h2><span>눌러서 고치기</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((r) => {
            const k = toKrw(r.amount, r.currency, fx)
            const total = r.perPerson ? r.amount * r.people.length : r.amount
            return (
              <div className="card ppl" key={r.id}>
                <div className="r">
                  <div><b>{r.name}</b><small>{r.day ? `DAY ${r.day}` : '날짜 미정'} · {r.src === '일정' ? '일정에서 기록' : `${r.src}로 기록`}</small></div>
                  <div className="amt"><strong>{money(total, r.currency)}</strong>{k != null && r.currency !== 'KRW' && <small>약 {man1(r.perPerson ? k * r.people.length : k)}만 원</small>}</div>
                </div>
                <div className="payrow">
                  <span>결제</span>
                  {MEMBERS.map((m) => <button key={m} className={r.payer === m ? 'on' : ''} onClick={() => update(r.id, { payer: m })}>{m}</button>)}
                </div>
                <div className="pgrid">
                  {MEMBERS.map((x) => {
                    const on = r.people.includes(x)
                    return (
                      <button key={x} className={`person ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => togglePerson(r, x)}>
                        <i>{x[0]}</i><b>{x}</b><small>{on ? (r.perPerson ? money(r.amount, r.currency) : '참여') : '안 함'}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="note-s">일정에서 “했다”를 누르면 같은 일정의 팀원으로, 영수증·카드 문자·음성은 AI가 덧붙인 말에서 찾은 사람으로 먼저 채워요. 틀리면 눌러서 고치세요.</div>
      </div>
    </div>
  )
}

function Report({ data, picks, records, reset }) {
  const fx = data.fx
  const base = data.base_price_krw ?? 0
  const keys = ['상품가', '선택관광', '가이드·기사 경비', '식사', '기타']
  const pred = Object.fromEntries(keys.map((k) => [k, 0]))
  const act = Object.fromEntries(keys.map((k) => [k, 0]))
  pred['상품가'] = base
  act['상품가'] = base
  data.items.forEach((it, i) => {
    if (it.category === '싱글차지') return
    if (!it.required && !picks.includes(i)) return
    pred[catKey(it.category)] += toKrw(it.amount, it.currency, fx) ?? 0
  })
  for (const r of records) act[catKey(r.category)] += myShare(r, fx)
  const P = keys.reduce((a, k) => a + pred[k], 0)
  const A = keys.reduce((a, k) => a + act[k], 0)
  const max = Math.max(...keys.filter((k) => k !== '상품가').flatMap((k) => [pred[k], act[k]]), 1)
  const undone = records.filter((r) => r.src === '일정' && r.status == null && (r.required || picks.includes(r.idx))).length
  const extra = records.filter((r) => r.src !== '일정' && r.status === 'done')

  return (
    <div className="scroll pad report">
      <div className="ledger-head"><h1>예측 vs 실제</h1><span>내 몫 기준</span></div>
      <div className="card vs">
        <div><small>예약 전 예측</small><b>{man(P)}<em>만 원</em></b></div>
        <Icon name="arrow" size={22} color="#b0b8c1" sw={2.2} />
        <div className="act"><small>지금까지 실제</small><b>{man(A)}<em>만 원</em></b></div>
      </div>
      <div className="vsnote">
        {undone > 0 ? `아직 기록 안 한 예정 지출 ${undone}건이 남아 있어요. 여행이 끝나면 최종 비교가 돼요.` : '예정한 지출을 모두 기록했어요.'}
        {extra.length > 0 && ` 예측에 없던 지출 ${extra.length}건(영수증·카드 문자·음성)이 더해졌어요.`}
      </div>

      <div className="sec"><h2>항목별</h2><span><i className="lg p" />예측 <i className="lg a" />실제</span></div>
      <div className="card bars">
        {keys.filter((k) => k !== '상품가').map((k) => (
          <div className="brow" key={k}>
            <div className="bl"><b>{k}</b><small>{man1(pred[k])} → <strong>{man1(act[k])}</strong>만 원</small></div>
            <div className="bt"><i className="p" style={{ width: `${(pred[k] / max) * 100}%` }} /></div>
            <div className="bt"><i className="a" style={{ width: `${(act[k] / max) * 100}%` }} /></div>
          </div>
        ))}
        <div className="cap">상품가 {man(base)}만 원은 양쪽에 같게 들어 있어요.</div>
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

export default function App() {
  const [splash, setSplash] = useState(true)
  const [screen, setScreen] = useState('home')
  const [text, setText] = useState('')
  const [data, setData] = useStored('290-data', null)
  const [picks, setPicks] = useStored('290-picks', [])
  const [records, setRecords] = useStored('290-records', [])
  const [day, setDay] = useStored('290-day', TRIP.today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { const t = setTimeout(() => setSplash(false), 1400); return () => clearTimeout(t) }, [])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 1800); return () => clearTimeout(t) }, [msg])

  function accept(j) {
    setData(j)
    setPicks(j.items.map((it, i) => (!it.required && it.amount != null ? i : -1)).filter((i) => i >= 0))
    setRecords([])
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
  function reset() { setRecords(buildRecords(data)); setDay(isTurkey(data.title) ? TRIP.today : 0); setMsg('여행 3일째 상태로 되돌렸어요') }

  const tab = useMemo(() => (['ledger', 'settle', 'report'].includes(screen) ? screen : 'home'), [screen])
  const showTab = ['home', 'ledger', 'settle', 'report'].includes(screen)
  const ready = data && records.length > 0

  return (
    <div className="phone">
      <div className={`splash ${splash ? '' : 'hide'}`}>
        <img className="bob" src="/img/mascot.png" alt="" width="120" />
        <h1>290</h1><p>가격표 말고, 진짜 총비용</p><small>패키지 여행 가계부</small>
      </div>
      {screen === 'home' && <Home openPaste={openPaste} startDemo={startDemo} />}
      {screen === 'paste' && <Paste text={text} setText={setText} run={() => run()} back={() => setScreen('home')} error={error} />}
      {screen === 'result' && (loading || !data ? <Loading /> : <Result data={data} picks={picks} setPicks={setPicks} back={() => setScreen('paste')} makeLedger={makeLedger} />)}
      {screen === 'ledger' && (ready ? <Ledger data={data} picks={picks} records={records} setRecords={setRecords} day={day} setDay={setDay} toast={setMsg} go={setScreen} /> : <Empty startDemo={startDemo} what="가계부" />)}
      {screen === 'settle' && (ready ? <Settle data={data} records={records} setRecords={setRecords} go={setScreen} toast={setMsg} /> : <Empty startDemo={startDemo} what="정산할 돈" />)}
      {screen === 'report' && (ready ? <Report data={data} picks={picks} records={records} reset={reset} /> : <Empty startDemo={startDemo} what="리포트" />)}
      {showTab && <TabBar tab={tab} go={setScreen} toast={setMsg} />}
      {msg && <div className="toast">{msg}</div>}
    </div>
  )
}
