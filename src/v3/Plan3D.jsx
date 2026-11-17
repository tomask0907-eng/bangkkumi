// 방과 가구를 3D로 보여준다(v3 "커머스 클린"). three.js는 이 파일(과 src/v3/three/)에서만 쓰므로 React.lazy로 불러온다.
// 감싸는 요소는 높이가 정해져 있어야 한다(시안의 .view). 배경은 그리지 않아서 뒤의 캔버스 바탕이 그대로 보인다.
// 보는 방향 버튼(.seg.float)은 viewsHost 로 준 요소 안에 그린다. 안 주면 가까운 .stage 의 .stage-top 을 찾고, 그것도 없으면 왼쪽 위에 둔다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createViewer } from './three/viewer.js';

const VIEWS = [['bird', '조감'], ['top', '위에서'], ['eye', '눈높이']];

export default function Plan3D({ room, items, style, selected = null, onSelect, viewsHost, onView }) {
  const boxRef = useRef(null);
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const pickRef = useRef(onSelect);
  pickRef.current = onSelect; // 화면을 다시 만들지 않고도 항상 최신 onSelect를 부른다
  const [view, setView] = useState('bird');
  const [failed, setFailed] = useState(false);
  const [slot, setSlot] = useState(null);

  // 첫 그림이 나오기 전에 버튼 자리를 정한다(버튼이 옮겨 다니는 것이 보이지 않게)
  useLayoutEffect(() => {
    setSlot(viewsHost ?? boxRef.current.closest('.stage')?.querySelector('.stage-top') ?? null);
  }, [viewsHost]);

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

  const views = (
    <div className="seg float plan3d-views" role="group" aria-label="보는 방향" style={slot ? undefined : { position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
      {VIEWS.map(([key, label]) => (
        <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); viewerRef.current?.setView(key); onView?.(key); }}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="plan3d" ref={boxRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {failed ? (
        <p role="alert" style={{ position: 'absolute', inset: 0, margin: 'auto', height: '3em', textAlign: 'center', color: 'var(--ink-2)' }}>
          이 브라우저에서는 3D 보기를 쓸 수 없어요. 평면도로 확인해 주세요.
        </p>
      ) : (
        <>
          {slot ? createPortal(views, slot) : views}
          <span className="hint" style={{ position: 'absolute', left: 2, bottom: 0, color: 'var(--ink-2)', pointerEvents: 'none' }}>끌어서 돌리고, 휠로 확대해요</span>
        </>
      )}
    </div>
  );
}
