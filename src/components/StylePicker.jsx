// ② 스타일: 프리셋 카드 + 직접 입력(프리셋 이름이면 바로, 아니면 AI가 만든다)
import { useEffect, useRef, useState } from 'react';
import Icon from './Icons.jsx';

export default function StylePicker({ styles, styleKey, onPick, onMake, busy, error }) {
  const [text, setText] = useState('');
  const gridRef = useRef(null);
  // 고른 카드가 스크롤 밖에 있으면 보이게 한다 (AI가 만든 스타일, 저장값 복원)
  useEffect(() => {
    gridRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [styleKey, styles.length]);
  const submit = async () => {
    if (!text.trim() || busy) return;
    if (await onMake(text)) setText('');
  };
  return (
    <>
      <div className="style-grid" role="group" aria-label="스타일 고르기" ref={gridRef}>
        {styles.map((st) => (
          <button key={st.key} className="style-card" type="button" aria-pressed={st.key === styleKey} onClick={() => onPick(st.key)} title={st.mood}>
            <span className="palette-strip">{st.palette.map((p, i) => <i key={i} style={{ background: p.hex }} />)}</span>
            <span className="style-name">{st.name}</span>
            {st.key.startsWith('custom:') && <span className={`badge ${st.source === 'ai' ? 'badge-ai' : ''}`}>{st.source === 'ai' ? 'AI' : '직접'}</span>}
          </button>
        ))}
      </div>
      <div className="sub-label">직접 입력</div>
      <div className="input-join">
        <input
          className="input" type="text" maxLength={60} placeholder="예: 제주 감성 우드 앤 화이트" aria-label="원하는 스타일을 글로 적기"
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button className={`btn btn-ai${busy ? ' is-loading' : ''}`} type="button" onClick={submit} disabled={!text.trim() && !busy}>
          {busy ? <span className="spinner" /> : <Icon name="sparkle" />}{busy ? '만드는 중…' : 'AI로 만들기'}
        </button>
      </div>
      {busy && (
        <div role="status" style={{ marginTop: 8 }}>
          <div className="progress is-busy" />
          <p className="field-hint" style={{ marginTop: 4 }}>AI가 색과 소품을 고르고 있어요. 10~20초쯤 걸려요. 그동안 다른 입력을 계속해도 돼요.</p>
        </div>
      )}
      {error && !busy && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{error}</p>}
    </>
  );
}
