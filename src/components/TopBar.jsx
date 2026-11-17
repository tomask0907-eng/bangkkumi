// 위 막대: 로고(누르면 시작 화면) · 프로젝트 요약 · [예시 불러오기] · [배치 추천받기 / 다시 추천받기]
import Ic from '../v3/Ic.jsx';

// title, summary: 지금 작업 요약 / stale: 입력이 바뀌어 배치가 옛것일 때 / busy: 배치를 찾는 중
export default function TopBar({ title, summary, onHome, onExample, onRecommend, busy = false, hasLayout = false, stale = false, offline = false }) {
  return (
    <header className="topbar">
      <a className="brand" href="./" aria-label="방꾸미 처음 화면" onClick={(e) => { e.preventDefault(); onHome?.(); }}>
        <span className="logo"><svg aria-hidden="true"><use href="#i-logo" /></svg></span>방꾸미
      </a>
      <span className="vsep" />
      <div className="project"><b>{title}</b><span className="num">{summary}</span></div>
      <span className="sp" />
      {stale && !busy && <span className="badge check topbar-note" role="status">입력이 바뀌었어요. 다시 추천받으면 새 배치가 나와요.</span>}
      {offline && <span className="badge topbar-note" role="status" title="AI 설명·AI 스타일·웹 시세·사진과 링크로 추가·도면 불러오기·SketchUp 내보내기는 PC에서 실행할 때만 돼요. 나머지는 그대로 쓸 수 있어요.">AI 기능은 PC에서 실행할 때만 돼요</span>}
      <button className="btn" type="button" onClick={onExample}><Ic name="open" />예시 불러오기</button>
      <button className="btn primary" type="button" onClick={onRecommend} disabled={busy}>
        {busy ? <span className="spin" /> : <Ic name="spark" />}{busy ? '배치를 찾는 중…' : hasLayout ? '다시 추천받기' : '배치 추천받기'}
      </button>
    </header>
  );
}
