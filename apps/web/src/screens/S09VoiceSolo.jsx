import { useEffect, useRef, useState } from 'react'
import { getJson, postJson } from '../api.js'
import { IMG } from '../demo.js'
import { ME, MEMBERS, SAMPLE_SMS } from '../sample.js'
import { lira } from '../ui.jsx'
import './S09VoiceSolo.css'

// 9 혼자 쓴 돈은 말로 (지우의 폰). 말 한 줄 · 카드 문자 → AI 가 읽은 지출 하나 → 가계부에 적기 (FR-015·016, AVL-003)
const SAID = '기념품 300리라 현금'
// 디자인 값 (API 가 실패하거나 응답 전이면 이 값 그대로 보인다)
const DESIGN = { name: '기념품', amount: 300, currency: 'TRY', method: '현금', category: '쇼핑', krw: '약 1만 원', people: [] }
const UNIT = { TRY: '리라', EUR: '유로', KRW: '원', USD: '달러', JPY: '엔' }
const unitOf = (cur) => UNIT[cur] ?? ` ${cur}`
const PAID_DATE = '2026-11-05' // DAY 3 (sample.js: DAY 1 = 11/03). 미래 날짜면 서버가 최신 환율을 준다

/**
 * /record 응답 → 화면 값. 금액을 못 읽으면 amount null (직접 입력, AVL-003).
 * 결제수단은 응답에 없어서 카드 문자면 카드, 말이면 문구에서 읽는다 (예전 가계부와 같은 규칙: 말이 없으면 카드)
 */
function fromRecord(r, input) {
  const sms = input.kind === 'sms'
  // 앱이 모르는 통화(스위스 프랑 등, OTHER)면 리라로 바꿔 적지 않고 금액을 직접 적게 한다 (지갑은 리라 기준)
  const known = r?.currency && r.currency !== 'OTHER'
  const amount = known && typeof r?.amount === 'number' && r.amount > 0 ? r.amount : null
  const currency = known ? r.currency : 'TRY'
  const people = Array.isArray(r?.people) ? r.people.filter((p) => MEMBERS.includes(p)) : []
  return {
    name: r?.name || (sms ? '카드 결제' : '기타'),
    amount,
    currency,
    method: sms ? '카드' : /현금/.test(input.text) ? '현금' : '카드',
    category: r?.category || '기타',
    krw: '',
    people,
  }
}

/** 원화 어림 (GET /fx). 원화면 없음, 실패하거나 출처 표기가 필요한 환율이면 비워 둔다 */
async function krwOf(amount, cur) {
  if (amount == null || cur === 'KRW') return ''
  const fx = await getJson(`/api/fx?currency=${cur}&date=${PAID_DATE}`)
  if (!fx?.rate || fx.attribution) return ''
  return `약 ${(Math.round((amount * fx.rate) / 100) * 100).toLocaleString('ko-KR')}원`
}

const whoOf = (people) => (people.length > 1 ? `${people.join(', ')} ${people.length}명` : '나 혼자')

export default function VoiceSolo({ next, set, toast }) {
  const [item, setItem] = useState(DESIGN)
  const [said, setSaid] = useState(SAID) // 위 말 문구 (누르면 고친다). 카드 문자로 적었으면 null
  const [draft, setDraft] = useState(SAID)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(false) // 카드 문자 시트
  const [sms, setSms] = useState('')
  const [typed, setTyped] = useState('') // 금액 직접 입력 (AVL-003)
  const seq = useRef(0)
  const alive = useRef(true)
  const sayRef = useRef(null)
  const amtRef = useRef(null)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  /** /api/record 를 불러 행을 채운다. 나중에 보낸 요청 결과만 쓴다 */
  async function record(input, { quiet = false, onRefund } = {}) {
    const my = ++seq.current
    setBusy(true)
    try {
      const r = await postJson('/api/record', { ...input, members: MEMBERS, me: ME })
      if (!alive.current || my !== seq.current) return
      // 카드 승인 취소 · 환불 문자는 새 지출이 아니다 → 적지 않고 알린다
      if (r?.refund) {
        toast('결제 취소 문자예요 · 지출로 적지 않았어요')
        onRefund?.()
        return
      }
      const got = fromRecord(r, input)
      setItem(got)
      setTyped('')
      if (got.amount == null) {
        toast(r?.currency === 'OTHER' && typeof r?.amount === 'number' ? `${r.amount} (모르는 통화) · 리라로 바꾼 금액을 적어 주세요` : '금액을 못 읽었어요 · 직접 적어 주세요')
        requestAnimationFrame(() => amtRef.current?.focus())
      }
      krwOf(got.amount, got.currency)
        .then((krw) => { if (alive.current && my === seq.current && krw) setItem((x) => ({ ...x, krw })) })
        .catch(() => { /* 원화 어림 없이 */ })
    } catch (e) {
      if (!alive.current || my !== seq.current) return
      // 처음 시연 문구는 디자인 값 그대로. 고친 문구는 추측하지 않고 금액 직접 입력으로 (AVL-003)
      if (!quiet) {
        // 다른 칸도 앞 결과를 남기지 않는다: 이름은 말한 그대로, 분류는 기타
        const words = input.kind === 'sms' ? '카드 결제' : input.text.slice(0, 20)
        setItem({ ...fromRecord(null, input), name: words })
        setTyped('')
        requestAnimationFrame(() => amtRef.current?.focus())
        toast(`${e?.status ? e.message : '서버에 연결하지 못했어요'} · 직접 적어 주세요`)
      }
    } finally {
      if (alive.current && my === seq.current) setBusy(false)
    }
  }

  useEffect(() => {
    // 서버가 꺼져 있어도 디자인 값으로 시연을 이어 간다. 응답이 디자인 문구와 같은 뜻이면 디자인 원화 표기를 둔다
    const my = ++seq.current
    postJson('/api/record', { text: SAID, members: MEMBERS, me: ME })
      .then((r) => {
        if (!alive.current || my !== seq.current) return
        const got = fromRecord(r, { text: SAID })
        if (got.amount === DESIGN.amount && got.currency === DESIGN.currency) setItem({ ...got, krw: DESIGN.krw })
      })
      .catch(() => {})
  }, [])

  // 문구 고치기: 높이 자동
  useEffect(() => {
    const t = sayRef.current
    if (!editing || !t) return
    t.style.height = 'auto'
    t.style.height = `${t.scrollHeight}px`
  }, [editing, draft])

  function startEdit() {
    if (editing) return
    setDraft(said ?? '')
    setEditing(true)
    requestAnimationFrame(() => {
      const t = sayRef.current
      if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length) }
    })
  }

  function endEdit() {
    const v = draft.replace(/\s+/g, ' ').trim().slice(0, 500)
    setEditing(false)
    if (!v || v === said) return
    setSaid(v)
    record({ text: v })
  }

  function sendSms() {
    const t = sms.trim()
    if (!t) return
    setSheet(false)
    const before = said
    setSaid(null)
    // 취소 문자면 기록이 그대로이니 위 문구도 되돌린다
    record({ text: t, kind: 'sms' }, { onRefund: () => setSaid(before) })
  }

  const manual = item.amount == null
  const fix = () => toast('고칠 수 있어요')

  function save() {
    let amount = item.amount
    if (manual) {
      amount = Number(typed.replace(/,/g, ''))
      if (!(amount > 0)) { toast('얼마인지 적어 주세요'); amtRef.current?.focus(); return }
    }
    set({ solo: { name: item.name, amount, currency: item.currency, method: item.method, category: item.category, krw: manual ? '' : item.krw } })
    next()
  }

  const amountRow = manual ? (
    <label className="solo-amt solo-type">
      <input
        ref={amtRef}
        className="num-b"
        inputMode="decimal"
        placeholder="0"
        value={typed}
        aria-label={`금액 (${unitOf(item.currency).trim()})`}
        onChange={(e) => setTyped(e.target.value.replace(/[^\d.,]/g, ''))}
      />
      <b className="num-b">{unitOf(item.currency)}</b>
    </label>
  ) : (
    <span className="solo-amt"><b className="num-b">{lira(item.amount)}{unitOf(item.currency)}</b>{item.krw && <small>{item.krw}</small>}</span>
  )

  const rows = [
    ['얼마', amountRow],
    ['무엇', item.name],
    ['어떻게', item.method],
    ['분류', <span className="solo-chip">{item.category}</span>],
    ['누구', whoOf(item.people)],
  ]

  return (
    <section className="scr solo fade">
      <div className="solo-photo">
        <img className="kenburns" src={IMG('souvenir.png')} alt="나자르 부적과 도자기가 걸린 바자르" />
        <i className="solo-shade" />
      </div>

      <div className="solo-sheet sheet-up">
        <i className="solo-grip" />
        <div className={`solo-said${editing ? ' on' : ''}`}>
          <span className="solo-mic"><img src={IMG('s09-mic.svg')} width="15" height="15" alt="" /></span>
          {editing ? (
            <textarea
              ref={sayRef}
              className="solo-edit"
              rows={1}
              maxLength={500}
              value={draft}
              aria-label="말 고치기"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={endEdit}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur() } }}
            />
          ) : (
            <button type="button" className="solo-line" onClick={startEdit} aria-label={said == null ? '말로 다시 적기' : `말 고치기: ${said}`}>
              {said == null ? '카드 문자에서 읽었어요' : `"${said}"`}
            </button>
          )}
          {!editing && <button type="button" className="solo-sms" onClick={() => setSheet(true)}>카드 문자</button>}
        </div>
        <h1 className="solo-title">이렇게 적을까요?</h1>

        <ul className={`solo-list stagger${busy ? ' busy' : ''}`} aria-busy={busy}>
          {rows.map(([k, v]) => (
            <li key={k}>
              {k === '얼마' && manual ? (
                <div className="solo-row">
                  <span className="solo-k">{k}</span>
                  <span className="solo-v">{v}</span>
                </div>
              ) : (
                <button type="button" onClick={k === '얼마' ? () => { setTyped(String(item.amount)); setItem((x) => ({ ...x, amount: null, krw: '' })) } : fix}>
                  <span className="solo-k">{k}</span>
                  <span className="solo-v">
                    {v}
                    <img src={IMG('s09-chev.svg')} width="16" height="16" alt="" />
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="solo-foot">
          <button type="button" className="cta line solo-again" onClick={startEdit}>다시 말하기</button>
          <button type="button" className="cta" onClick={save} disabled={busy}>가계부에 적기</button>
        </div>
      </div>

      {sheet && (
        <div className="solo-dim" onClick={() => setSheet(false)}>
          <div className="solo-smsheet sheet-up" role="dialog" aria-label="카드 문자로 적기" onClick={(e) => e.stopPropagation()}>
            <i className="solo-grip" />
            <h2>카드 문자로 적기</h2>
            <p>카드사 결제 문자를 길게 눌러 복사한 뒤 붙여 넣으세요. 카드 번호·이름은 적지 않아요</p>
            <textarea value={sms} onChange={(e) => setSms(e.target.value)} placeholder="[Web발신] …" rows={6} maxLength={500} />
            <div className="solo-foot">
              <button type="button" className="cta line solo-again" onClick={() => setSms(SAMPLE_SMS)}>예시 문자 넣기</button>
              <button type="button" className="cta" onClick={sendSms} disabled={!sms.trim()}>문자로 적기</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
