// 새 기능 확인용: tint(사진·링크로 추가한 가구의 대표 색)가 평면도·3D·작은 그림에 같은 색으로 나오는지, renderImage 가 만든 그림, RenderCard.
// 실행 중인 앱에서 바로 연다: http://localhost:5174/src/v3/extra-harness.html
// 주소 옵션: ?style=nordic|minimal|industrial…(기본 nordic) · ?big=bird|top|eye(렌더링 그림 한 장만 크게) · ?notint=1(tint 없이)
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './theme.css';
import './plan.css';
import { recommend, checkLayout } from '../layout.js';
import { STYLE_PRESETS, parseFurnitureText } from '../catalog.js';
import Plan from './Plan.jsx';
import Plan3D from './Plan3D.jsx';
import RenderCard from './RenderCard.jsx';
import { MiniPlan, FurnitureThumb, paletteVars } from './symbols.jsx';
import { renderImage, saveImage } from './three/render.js';

const q = new URLSearchParams(location.search);
const ROOM = { width: 450, depth: 340, height: 240, doors: [{ wall: 'bottom', offset: 40, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 130, size: 150, sill: 90, height: 120 }] };
// 가구 이름 → 사진·링크에서 읽은 대표 색(확인용 값)
const TINTS = q.has('notint') ? {} : { '2인 소파': '#c0563b', '옷장 1000': '#5f7f68', '책상 1200': '#2b3a55', 냉장고: '#d9a441', 러그: '#7a5ea8' };
const SPECS = parseFurnitureText('슈퍼싱글 침대, 책상 1200, 옷장, 2인 소파, 러그, 냉장고, 책장').specs.map((s, i) => ({ ...s, uid: `s${i}`, ...(TINTS[s.name] ? { tint: TINTS[s.name], source: 'ai', ref: { kind: 'photo' } } : null) }));
const ITEMS = recommend(ROOM, SPECS, 0).items.map((it) => ({ ...it, ...(TINTS[it.name] ? { tint: TINTS[it.name] } : null) }));
const style = STYLE_PRESETS[q.get('style')] || STYLE_PRESETS.nordic;
const varsOf = () => { const v = paletteVars(style.palette); return { c1: v['--c1'], c2: v['--c2'], c3: v['--c3'], c4: v['--c4'], c5: v['--c5'] }; };

function Big({ view }) {
  const [state, setState] = useState({});
  useEffect(() => {
    const t = performance.now();
    renderImage({ room: ROOM, items: ITEMS, style, view, vars: varsOf() }).then((image) => setState({ image, ms: Math.round(performance.now() - t) }), (e) => setState({ error: e.message }));
  }, [view]);
  return (
    <div style={{ padding: 12 }}>
      <p id="big-status" className="hint" data-done={state.image || state.error ? '1' : undefined}>{state.error ? `오류: ${state.error}` : state.image ? `완성 ${state.ms}ms · ${Math.round(state.image.length / 1024)}KB(data URL)` : '만드는 중'}</p>
      {state.image && <img id="big" src={state.image} alt="" style={{ display: 'block', width: '100%', border: '1px solid var(--line)' }} />}
    </div>
  );
}

function Harness() {
  const stageRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [shots, setShots] = useState({});
  const [card, setCard] = useState({ image: null, busy: false });
  const check = useMemo(() => checkLayout(ROOM, ITEMS), []);

  // 세 방향 그림을 차례로 만든다(vars 를 주는 경우와 안 주는 경우가 같은 색이어야 한다: bird 는 vars 없이)
  useEffect(() => {
    let off = false;
    (async () => {
      for (const view of ['bird', 'top', 'eye']) {
        const t = performance.now();
        try {
          const image = await renderImage({ room: ROOM, items: ITEMS, style, view, width: 1200, height: 750, vars: view === 'bird' ? undefined : varsOf() });
          if (!off) setShots((s) => ({ ...s, [view]: { image, ms: Math.round(performance.now() - t) } }));
        } catch (e) {
          if (!off) setShots((s) => ({ ...s, [view]: { error: e.message } }));
        }
      }
      if (!off) setShots((s) => ({ ...s, done: true }));
    })();
    return () => { off = true; };
  }, []);

  const make = async () => {
    setCard((c) => ({ ...c, busy: true }));
    try {
      const image = await renderImage({ room: ROOM, items: ITEMS, style, view: 'bird', vars: varsOf() });
      setCard({ image, busy: false });
    } catch (e) {
      setCard({ image: null, busy: false, error: e.message });
    }
  };

  return (
    <div style={{ ...paletteVars(style.palette), display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gridTemplateRows: '470px auto', gap: 12, padding: 12, height: '100vh', boxSizing: 'border-box', background: 'var(--bg)' }} id="extra" data-done={shots.done ? '1' : undefined}>
      <main className="stage" ref={stageRef} style={{ position: 'relative', minHeight: 0 }}>
        <div style={{ position: 'absolute', inset: 8 }}>
          <Plan room={ROOM} items={ITEMS} style={style} issues={check.issues} walk={check.walk} showWalk={false} selected={selected} onSelect={setSelected} onMove={() => {}} onRotate={() => {}} onRemove={() => {}} enterKey={0} stageRef={stageRef} />
        </div>
      </main>
      <main className="stage is3d" style={{ position: 'relative', minHeight: 0 }}>
        <div className="stage-top" />
        <div style={{ position: 'absolute', inset: '48px 8px 8px 8px' }}>
          <Plan3D room={ROOM} items={ITEMS} style={style} selected={selected} onSelect={setSelected} />
        </div>
      </main>
      <div style={{ overflow: 'auto', minHeight: 0, gridRow: '1 / 3', gridColumn: 3 }}>
        <RenderCard image={card.image} busy={card.busy} onMake={make} onSave={() => saveImage(card.image)} />
        {card.error && <p className="hint" id="card-error">{card.error}</p>}
        <RenderCard image={null} busy={false} disabled onMake={() => {}} onSave={() => {}} />
        <RenderCard image={shots.bird?.image || null} busy onMake={() => {}} onSave={() => {}} />
        <div className="card">
          <div className="card-h"><h3>작은 그림(tint)</h3></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{SPECS.map((s) => <FurnitureThumb key={s.uid} spec={s} />)}</div>
          <div style={{ width: 120, marginTop: 8 }} className="thumbs"><button type="button" aria-pressed="true"><MiniPlan room={ROOM} items={ITEMS} palette={style.palette} />1안</button></div>
        </div>
      </div>
      <div style={{ gridColumn: '1 / 3', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignContent: 'start', minHeight: 0 }}>
        {['bird', 'top', 'eye'].map((view) => (
          <div key={view} className="card" style={{ margin: 0, padding: 8 }}>
            <p className="hint" data-shot={view}>{view} · {shots[view]?.error ? `오류: ${shots[view].error}` : shots[view] ? `${shots[view].ms}ms` : '만드는 중'}</p>
            {shots[view]?.image && <img src={shots[view].image} alt="" style={{ display: 'block', width: '100%', borderRadius: 8 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// 아이콘 묶음(svg symbol)은 index.html 에 있다. 확인 화면에도 같은 것을 넣는다
fetch('/index.html').then((r) => r.text()).then((html) => {
  const sprite = new DOMParser().parseFromString(html, 'text/html').querySelector('symbol#i-cube')?.closest('svg');
  if (sprite) document.body.prepend(document.importNode(sprite, true));
}).catch(() => {});

createRoot(document.getElementById('root')).render(<StrictMode>{q.get('big') ? <Big view={q.get('big')} /> : <Harness />}</StrictMode>);
