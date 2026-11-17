// 시작 화면. 시안: docs/design-v3/a/landing.html (가구 그림만 B안 방식, IsoRoom.jsx)
import './landing.css';
import IsoRoom from './IsoRoom.jsx';

// 아이콘은 시안의 <symbol>을 그대로 옮겼어요. id를 쓰지 않아 앱의 다른 아이콘과 겹치지 않아요.
const Ic = ({ className = 'ic', children }) => <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
const Check = () => <Ic><path d="M5 12.5l4.5 4.5L19 7.5" /></Ic>;

export default function Landing({ onStart, onExample }) {
  return (
    <div className="landing">
      <header className="lnav">
        <span className="brand">
          <span className="logo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 4.5h15v15h-15z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M4.5 11h6.5v4M14.5 19.5v-6h5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          방꾸미
        </span>
        <nav className="links" aria-label="안내"><a href="#feats">기능</a></nav>
        <span className="sp" />
        <button type="button" className="btn ghost" onClick={onExample}>예시로 보기</button>
        <button type="button" className="btn primary" onClick={onStart}>시작하기</button>
      </header>

      <main className="hero">
        <div>
          <span className="eyebrow">
            <Ic className="ic s"><path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L4 10.5l5.1-1.9z" /><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></Ic>
            AI 원룸 인테리어 플래너
          </span>
          <h1>가구 사기 전에,<br /><em>내 방에 먼저</em><br />놓아 봐요</h1>
          <p className="pitch">방 크기와 갖고 싶은 가구만 적어 주세요.<br />겹치지 않고 통로가 남는 배치를 찾아서<br />점수와 예상 비용까지 한 번에 보여 드려요.</p>
          <div className="cta">
            <button type="button" className="btn primary lg" onClick={onStart}>시작하기<Ic><path d="M5 12h14M13 6l6 6-6 6" /></Ic></button>
            <button type="button" className="btn lg" onClick={onExample}>예시로 보기</button>
          </div>
          <div className="proof">
            <span><Check />설치 없이 브라우저에서</span>
            <span><Check />배치안은 최대 5개</span>
            <span><Check />SketchUp으로 내보내기</span>
          </div>
        </div>

        <div className="hero-art">
          <IsoRoom />
          <div className="fcard score">
            <span className="ring">
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="18" fill="none" style={{ stroke: 'var(--accent-tint-2)' }} strokeWidth="5" />
                <circle cx="22" cy="22" r="18" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="5" strokeLinecap="round" strokeDasharray="104 113.1" />
              </svg>
              <b>92</b>
            </span>
            <span>배치 점수<strong>아주 좋아요</strong></span>
          </div>
          <div className="fcard price">
            <span className="th">
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <rect x="4" y="10" width="4.5" height="21" rx="1.2" fill="#EDDFCA" /><rect x="8.5" y="24" width="27.5" height="5" rx="1" fill="#EDDFCA" />
                <rect x="8.5" y="19" width="27.5" height="5.5" rx="2" fill="#fff" /><rect x="9.5" y="15.2" width="9" height="5" rx="2.2" fill="#fff" />
                <path d="M19.5 19H34a2 2 0 0 1 2 2v3.5H17.5V21a2 2 0 0 1 2-2z" style={{ fill: 'color-mix(in srgb, var(--accent) 32%, #fff)' }} /><path d="M10.5 29v3M34 29v3" />
              </svg>
            </span>
            <span>슈퍼싱글 침대 · 웹 검색 시세<strong className="num">289,000원</strong></span>
          </div>
          <div className="fcard total">
            <span className="top">예상 합계 <span className="left">15.9만원 남아요</span></span>
            <strong className="num">841,000원 <span className="of">/ 예산 100만원</span></strong>
            <span className="bar"><i style={{ width: '84%' }} /></span>
          </div>
        </div>
      </main>

      <section className="feats" id="feats" aria-label="주요 기능">
        <article className="feat">
          <span className="ico"><Ic><rect x="3.5" y="3.5" width="7" height="9" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" /></Ic></span>
          <div><h2>겹치지 않는 배치 추천</h2><p>벽·문·창문과 통로를 살펴 배치안을 최대 5개 만들고, 7가지 기준으로 100점 만점 점수를 매겨요.</p></div>
        </article>
        <article className="feat">
          <span className="ico"><Ic><circle cx="12" cy="12" r="8.5" /><path d="M7.5 9l2 6.5L12 9l2.5 6.5 2-6.5M7 12h10" /></Ic></span>
          <div><h2>실제 상품에서 고르기</h2><p>실제로 파는 가구를 골라 실제 치수로 놓고, 가격을 더해 예산에 맞는지 바로 보여 드려요.</p></div>
        </article>
        <article className="feat">
          <span className="ico"><Ic><path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z" /><path d="M4.5 7.7L12 12l7.5-4.3M12 12v8.5" /></Ic></span>
          <div><h2>3D로 보고 SketchUp으로</h2><p>같은 배치를 입체로 돌려 보고, AI 추천 설명을 읽고, SketchUp 파일(.skp)로 내보내요.</p></div>
        </article>
      </section>
    </div>
  );
}
