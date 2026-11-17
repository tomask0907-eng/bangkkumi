// ② 스타일: 지금 고른 스타일 + 직접 입력(프리셋 이름이면 바로, 아니면 AI가 만든다) + 무드보드 카드
// 모양은 시안(docs/design-v3/a/app.html 의 스타일 패널) 그대로: .now-style, .ai-box, .style-grid > .pcard
// 선택 props: aiOff(true 또는 안내 글. 서버가 없어 AI 만들기를 쓸 수 없을 때 안내 한 줄을 보여 줘요. 프리셋 이름을 적는 것은 그대로 돼요)
import { useEffect, useRef, useState } from 'react';
import Ic from '../v3/Ic.jsx';
import { paletteVars } from '../v3/symbols.jsx';

// 가격대: 스타일의 가격 배율(priceRate)을 쉬운 말로
const levelOf = (rate) => (rate >= 1.2 ? '가격대 높음' : rate <= 0.95 ? '가격대 낮음' : '가격대 보통');

// 무드보드 타일(시안의 #mood): 벽색 바탕, 포인트 아치, 패브릭 동그라미, 나무 타일, 패브릭·짙은 색 조각
function Mood() {
  return (
    <svg className="thumb" viewBox="0 0 160 62" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="160" height="62" style={{ fill: 'var(--c1)' }} />
      <path d="M20 62V38a20 20 0 0 1 40 0v24z" style={{ fill: 'var(--c4)' }} /><circle cx="66" cy="18" r="9" style={{ fill: 'var(--c3)' }} />
      <rect x="92" width="68" height="36" style={{ fill: 'var(--c2)' }} /><path d="M92 12h68M92 24h68M118 0v12M140 12v12M110 24v12" stroke="rgba(0,0,0,.08)" fill="none" />
      <rect x="92" y="36" width="40" height="26" style={{ fill: 'var(--c3)' }} /><rect x="132" y="36" width="28" height="26" style={{ fill: 'var(--c5)' }} />
    </svg>
  );
}

export default function StylePicker({ styles = [], styleKey, onPick, onMake, busy = false, error = '', aiOff = false }) {
  const [text, setText] = useState('');
  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const shown = useRef(`${styleKey}|${styles.length}`);
  // 고른 스타일이 바뀌면(AI가 새로 만든 카드 등) 그 카드가 보이게 한다. 패널을 처음 열 때는 맨 위(지금 스타일)를 그대로 보여 준다
  useEffect(() => {
    const sig = `${styleKey}|${styles.length}`;
    if (shown.current === sig) return;
    shown.current = sig;
    gridRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [styleKey, styles.length]);
  const submit = async () => {
    if (busy) return;
    if (!text.trim()) { inputRef.current?.focus(); return; }
    if (await onMake?.(text)) setText('');
  };
  const offNote = aiOff === true ? 'AI로 만들기는 PC에서 실행할 때만 돼요. 스타일 이름(예: 북유럽)을 적거나 아래 카드에서 골라 주세요.' : typeof aiOff === 'string' ? aiOff : '';
  const now = styles.find((st) => st.key === styleKey) || styles[0];
  const presets = styles.filter((st) => !st.key.startsWith('custom:')).length;
  return (
    <>
      {now && (
        <div className="now-style" style={paletteVars(now.palette)}>
          <span className="sw5" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <div><b>{now.name}</b><span title={now.mood}>{now.materials || now.mood}</span></div>
          <span className="badge ok">적용됨</span>
        </div>
      )}

      <div className="ai-box">
        <h3><Ic name="spark" />원하는 분위기를 글로 적어도 돼요</h3>
        <div className="ai-make">
          <input
            ref={inputRef} className="input" type="text" maxLength={60} placeholder="예: 제주 감성 우드 앤 화이트" aria-label="원하는 스타일을 글로 적기"
            value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <button className="btn primary" type="button" onClick={submit} disabled={busy}>{busy ? '만드는 중…' : 'AI로 만들기'}</button>
        </div>
        {busy && <div className="wait" role="status"><span className="spin" />AI가 색 5가지와 마감재를 고르고 있어요. 10~20초쯤 걸려요. 그동안 다른 입력을 계속해도 돼요.</div>}
        {error && !busy && <p className="ai-err" role="alert"><Ic name="warn" className="s" />{error}</p>}
        {offNote && !busy && !error && <p className="hint ai-off">{offNote}</p>}
      </div>

      <div className="sec" style={{ borderTop: 0 }}>
        <div className="sec-h"><h3>추천 스타일</h3><span className="meta">{presets}가지{styles.length > presets ? ` · 직접 만든 것 ${styles.length - presets}개` : ''}</span></div>
        <div className="style-grid" role="group" aria-label="스타일 고르기" ref={gridRef}>
          {styles.map((st) => {
            const custom = st.key.startsWith('custom:');
            return (
              <button
                key={st.key} className={`pcard${custom ? ' wide' : ''}`} type="button" aria-pressed={st.key === styleKey} onClick={() => onPick(st.key)} title={st.mood}
                style={paletteVars(st.palette)}
              >
                <Mood />
                <span className="body">
                  <b>
                    <span className="nm">{st.name}</span>
                    {custom && (st.source === 'ai'
                      ? <span className="badge ai"><Ic name="spark" />AI 생성</span>
                      : <span className="badge mine">직접 입력</span>)}
                  </b>
                  <small>{st.materials || st.mood}</small>
                  {!custom && <span className="lv">{levelOf(st.priceRate)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
