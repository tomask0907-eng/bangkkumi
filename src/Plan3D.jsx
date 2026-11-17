// 방과 가구를 3D로 보여준다. three.js는 이 파일(과 src/three/)에서만 쓰므로 React.lazy로 불러온다.
import { useEffect, useRef, useState } from 'react';
import { createViewer } from './three/viewer.js';

const VIEWS = [['bird', '조감'], ['top', '위에서'], ['eye', '눈높이']];

const box = { position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', background: 'linear-gradient(#f6f2ea, #e6dfd3)' };
const bar = { position: 'absolute', top: 10, left: 10, display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'rgba(255,255,255,0.86)', boxShadow: '0 1px 6px rgba(0,0,0,0.12)' };
const btn = (on) => ({
  border: 0, borderRadius: 7, padding: '6px 11px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: on ? '#3d3a36' : 'transparent', color: on ? '#fff' : '#4a4640',
});
const hint = { position: 'absolute', right: 12, bottom: 8, fontSize: 12, color: 'rgba(60,55,50,0.7)', pointerEvents: 'none' };

export default function Plan3D({ room, items, style, selected = null, onSelect }) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const pickRef = useRef(onSelect);
  pickRef.current = onSelect; // 화면을 다시 만들지 않고도 항상 최신 onSelect를 부른다
  const [view, setView] = useState('bird');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let viewer;
    try {
      viewer = createViewer(hostRef.current, (uid) => pickRef.current?.(uid));
    } catch (e) {
      console.error('[Plan3D]', e);
      setFailed(true); // WebGL을 쓸 수 없는 브라우저
      return undefined;
    }
    viewerRef.current = viewer;
    return () => { viewerRef.current = null; viewer.dispose(); };
  }, []);

  useEffect(() => { viewerRef.current?.setScene(room, items, style); }, [room, items, style]);
  useEffect(() => { viewerRef.current?.setSelected(selected); }, [selected, room, items, style]);

  return (
    <div className="plan3d" style={box}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {failed ? (
        <p role="alert" style={{ position: 'absolute', inset: 0, margin: 'auto', height: '3em', textAlign: 'center' }}>
          이 브라우저에서는 3D 보기를 쓸 수 없어요. 평면도로 확인해 주세요.
        </p>
      ) : (
        <>
          <div className="plan3d-views" role="group" aria-label="보는 방향" style={bar}>
            {VIEWS.map(([key, label]) => (
              <button
                key={key} type="button" aria-pressed={view === key} style={btn(view === key)}
                onClick={() => { setView(key); viewerRef.current?.setView(key); }}
              >
                {label}
              </button>
            ))}
          </div>
          <span style={hint}>끌어서 돌리고, 휠로 확대해요</span>
        </>
      )}
    </div>
  );
}
