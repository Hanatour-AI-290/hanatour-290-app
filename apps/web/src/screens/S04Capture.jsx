import { useEffect, useRef, useState } from 'react'
import { postForm } from '../api.js'
import { DINNER, IMG } from '../demo.js'
import { ROOM } from '../sample.js'
import { Back } from '../ui.jsx'
import './S04Capture.css'

// 4 찍고 말하기 (지우의 폰). 영수증 사진 + 말 한 줄 → 줄 단위 나누기 (POST /trips/:tripId/receipts/analyze)
const RECEIPT = IMG('s04-receipt.jpg')
const WAVE = [6, 12, 18, 10, 22, 14, 8, 16, 24, 12, 6, 14, 20, 10, 6] // 디자인 파형 높이 (px), 뒤에 흐린 막대 3개
const TIMEOUT = 25000 // 운영 서버에서 분석이 20초 가까이 걸린다 (11/4 측정 18.7초)

/** 큰 사진은 긴 변 1400px JPEG 로 줄인다 (API 한도 3MB) */
async function shrink(blob) {
  const img = await createImageBitmap(blob)
  const s = Math.min(1, 1400 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * s)
  c.height = Math.round(img.height * s)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('사진 변환 실패'))), 'image/jpeg', 0.85))
}

export default function Capture({ next, prev, toast, set }) {
  const [photo, setPhoto] = useState(null) // 다시 찍은 사진 { file, url }
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  function retake(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto({ file, url: URL.createObjectURL(file) })
  }

  async function analyze() {
    if (busy) return
    setBusy(true)
    let dinner = null
    let timer
    try {
      const image = photo ? await shrink(photo.file).catch(() => photo.file) : await (await fetch(RECEIPT)).blob()
      const form = new FormData()
      form.set('image', image, 'receipt.jpg')
      form.set('utterance', DINNER.voice)
      form.set('members', JSON.stringify(ROOM))
      form.set('me', '지우')
      const timeout = new Promise((_, no) => { timer = setTimeout(() => no(new Error('시간 초과')), TIMEOUT) })
      dinner = await Promise.race([postForm('/api/trips/t1/receipts/analyze', form), timeout])
    } catch {
      dinner = null // 501 · 503 · 시간 초과 → 다음 화면은 디자인 예시 값(DINNER)으로
    } finally {
      clearTimeout(timer)
    }
    if (!alive.current) return
    set({ dinner })
    next()
  }

  // 말 문구는 쉼표 뒤에서 줄을 나눈다 (디자인과 같게)
  const [l1, l2] = DINNER.voice.split(/(?<=,)\s+/)

  return (
    <section className="scr cap fade">
      <div className="cap-top">
        <img key={photo?.url ?? 'demo'} className="cap-photo kenburns" src={photo?.url ?? RECEIPT} alt="마가라 레스토랑 영수증" />
        <div className="cap-shade" />
        <header className="cap-bar">
          <Back onClick={prev} icon="s04-x.svg" label="닫기" />
          <h1>같이 낸 돈 올리기</h1>
        </header>
      </div>

      <div className="cap-sheet sheet-up" style={{ '--d': '0.12s' }}>
        <i className="cap-grip" />
        <div className="cap-done">
          <span className="cap-badge pop" style={{ '--d': '0.45s' }}>
            <img src={IMG('s04-check.svg')} width="13" height="13" alt="" />
          </span>
          <p>영수증 찍었어요</p>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>다시 찍기</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={retake} />
        </div>

        <h2 className="cap-ask">누가 뭘 먹었는지<br />말해 주세요</h2>

        <div className="cap-said rise" style={{ '--d': '0.3s' }}>
          <p>"{l1}{l2 ? <><br />{l2}</> : null}"</p>
          <div className="cap-wave">
            <span className="wave">
              {WAVE.map((h, i) => <i key={i} style={{ '--i': i, height: h }} />)}
            </span>
            <i className="dim" /><i className="dim" /><i className="dim" />
          </div>
        </div>

        <div className="cap-ctrl">
          <button type="button" className="cap-even" disabled={busy} onClick={() => { toast('넷이 똑같이 600리라씩 나눌게요'); next() }}>똑같이 나누기</button>
          <span className="cap-ring pulse">
            <button type="button" className="cap-mic" aria-label="말하기" onClick={() => toast('듣고 있어요')} disabled={busy}>
              <img src={IMG('s04-mic.svg')} width="28" height="28" alt="" />
            </button>
          </span>
          <button type="button" className="cap-send" onClick={analyze} disabled={busy} aria-busy={busy}>
            {busy ? '나누는 중…' : '다 말했어요'}
          </button>
        </div>
      </div>
    </section>
  )
}
