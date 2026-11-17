// 위쪽 막대: 예시 불러오기 · DWG 불러오기 · SketchUp 내보내기(파일로 받기 / 바로 열기)
import { useState } from 'react';
import Icon from './Icons.jsx';

// 쓸 수 없는 버튼은 왜 안 되는지 말풍선으로 알려 준다
function Tip({ tip, children }) {
  return tip ? <span className="tooltip tooltip-down tip-end" data-tip={tip}>{children}</span> : children;
}

// note: 잠깐 뜨는 알림. 있으면 소개 글 대신 보여 준다
export default function TopBar({ onExample, onDwg, dwgTip, dwgOff, onSkp, skpTip, skpBusy, note }) {
  const [menu, setMenu] = useState(false);
  const off = !!skpTip || skpBusy;
  return (
    <header className="topbar">
      <a className="brand" href="./" aria-label="방꾸미 처음으로" onClick={(e) => e.preventDefault()}>
        <span className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10V4h12v12h-6" /><path d="M4 16l3.6-3" /><path d="M9.8 16a6 6 0 0 0-2.2-4.6" strokeDasharray="1.2 2.2" /><rect x="10.6" y="6.6" width="3" height="3" rx=".6" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="brand-name">방꾸미</span>
      </a>
      {note || <span className="brand-tag">가구를 사기 전에, 내 방에 맞는지 AI와 먼저 놓아 봐요</span>}
      <div className="topbar-actions">
        <button className="btn btn-ghost" type="button" onClick={onExample}><Icon name="book" /><span className="btn-label">예시 불러오기</span></button>
        <Tip tip={dwgTip}>
          <button className="btn" type="button" onClick={onDwg} disabled={dwgOff}><Icon name="upload" /><span className="btn-label">DWG 불러오기</span></button>
        </Tip>
        <Tip tip={skpTip}>
          <span className="split" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMenu(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setMenu(false); }}>
            <button className={`btn btn-dark${skpBusy ? ' is-loading' : ''}`} type="button" disabled={off} onClick={() => onSkp(false)}>
              {skpBusy ? <span className="spinner" /> : <Icon name="cube" />}<span className="btn-label">{skpBusy ? '만드는 중…' : 'SketchUp 내보내기'}</span>
            </button>
            <button className="btn btn-dark btn-icon" type="button" disabled={off} aria-label="내보내기 방법 고르기" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Icon name="chev-d" />
            </button>
            {menu && (
              <span className="menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onSkp(false); }}>
                  <Icon name="download" /><span><b>파일로 내려받기</b><small>bangkkumi.skp 파일을 받아요</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onSkp(true); }}>
                  <Icon name="cube" /><span><b>SketchUp에서 바로 열기</b><small>이 노트북의 SketchUp으로 열어요</small></span>
                </button>
              </span>
            )}
          </span>
        </Tip>
      </div>
    </header>
  );
}
