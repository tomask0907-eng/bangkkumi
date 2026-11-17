// 리포트 패널의 "렌더링 이미지" 카드. 그림을 만드는 일은 부르는 쪽(App)이 한다: src/v3/three/render.js 의 renderImage.
// <RenderCard image={dataUrl 또는 null} busy={bool} disabled={가구가 없을 때 true} onMake={() => {}} onSave={() => {}} />
import Ic from './Ic.jsx';
import './panels-extra.css';

export default function RenderCard({ image = null, busy = false, disabled = false, onMake, onSave }) {
  return (
    <div className="card render-card">
      <div className="card-h">
        <h3>렌더링 이미지</h3>
        {image && !busy ? <span className="badge ok"><Ic name="check" />완성</span> : null}
      </div>
      <div className={`render-shot${image ? ' has' : ''}`} aria-busy={busy || undefined}>
        {image ? <img src={image} alt="방을 입체로 그린 렌더링 이미지" /> : (
          <div className="render-empty">
            <span className="ico"><Ic name="cube" className="l" /></span>
            <b>{disabled ? '가구를 놓으면 만들 수 있어요' : '지금 배치를 그림 한 장으로'}</b>
            <span>{disabled ? '배치 추천을 받은 뒤 눌러 주세요.' : '발표 자료나 메신저에 바로 붙일 수 있어요.'}</span>
          </div>
        )}
        {busy ? <div className="render-busy" role="status"><span className="spin" />렌더링을 만들고 있어요</div> : null}
      </div>
      <div className="render-actions">
        <button className="btn primary sm" type="button" disabled={busy || disabled} onClick={() => onMake?.()}>
          <Ic name="spark" className="s" />{image ? '다시 만들기' : '렌더링 만들기'}
        </button>
        <button className="btn sm" type="button" disabled={busy || !image} onClick={() => onSave?.()}>
          <Ic name="download" className="s" />그림으로 저장
        </button>
      </div>
      <p className="hint render-hint">3D 화면을 고화질 그림(PNG)으로 만들어요. 가구 모양과 색은 어림해서 그린 것이에요.</p>
    </div>
  );
}
