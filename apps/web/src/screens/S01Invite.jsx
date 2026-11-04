import { IMG, PEOPLE, TRIP5 } from '../demo.js'
import { Avatar, Back } from '../ui.jsx'
import './S01Invite.css'

// 1 친구 초대하기 (지우의 폰). 서준만 아직 안 들어옴
const MEMBERS = [
  { name: '지우', sub: '나, 방장' },
  { name: '하린', sub: '들어왔어요' },
  { name: '도윤', sub: '들어왔어요' },
  { name: '서준', sub: '초대 보냈어요', waiting: true },
]

export default function Invite({ next, prev, toast }) {
  const joined = MEMBERS.filter((m) => !m.waiting).length

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.origin)
    } catch { /* 복사가 막힌 브라우저여도 시연은 이어간다 */ }
    toast('초대 링크를 복사했어요')
  }

  return (
    <section className="scr inv fade">
      <div className="scr-body">
        <header className="inv-hero">
          <img className="inv-photo kenburns" src={IMG('s01-capp.jpg')} alt="" />
          <div className="inv-shade" />
          <div className="inv-back"><Back onClick={prev} icon="s01-back.svg" /></div>
          <div className="inv-title rise" style={{ '--d': '0.08s' }}>
            <p>{TRIP5.title}</p>
            <h1>같이 갈 사람을<br />불러 주세요</h1>
          </div>
        </header>

        <article className="inv-card sheet-up" style={{ '--d': '0.14s' }}>
          <div className="inv-code">
            <img src={IMG('s01-qr.svg')} width="112" height="112" alt="정산방 QR 코드" />
            <div className="inv-code-txt">
              <small>방 코드</small>
              <b>{TRIP5.room}</b>
              <p>옆에 있으면 QR을<br />찍게 해 주세요</p>
            </div>
          </div>
          <button type="button" className="inv-kakao" onClick={next}>
            <img src={IMG('s01-chat.svg')} width="18" height="18" alt="" />
            카카오톡으로 초대하기
          </button>
          <button type="button" className="inv-link" onClick={copyLink}>
            <img src={IMG('s01-link.svg')} width="16" height="16" alt="" />
            초대 링크 복사
          </button>
        </article>

        <div className="inv-members">
          <div className="inv-members-head rise" style={{ '--d': '0.24s' }}>
            <h2>함께 가는 사람</h2>
            <span className="num-b">{MEMBERS.length}명 중 {joined}명</span>
          </div>
          <ul className="stagger">
            {MEMBERS.map((m) => (
              <li key={m.name} className={m.waiting ? 'wait' : ''}>
                <Avatar src={PEOPLE[m.name].av} size={40} alt="" />
                <div className="inv-who"><p>{m.name}</p><small>{m.sub}</small></div>
                {m.waiting && (
                  <button type="button" className="inv-resend" onClick={() => toast(`${m.name}에게 다시 보냈어요`)}>다시 보내기</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
