// 평면도 확인용 화면. 실제 recommend·checkLayout 결과로 그린다.
// 주소 옵션: ?scene=wide|tall|error|empty|big|tiny|table|styles  &style=nordic  &sel=책상  &move=책상:230,40,0;책장:0,150  &walk=0  &underlay=1  &keys=minimal,nordic,dark(styles)  &k=0.8(table)
import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '../../docs/design-v3/a/tokens.css';
import Plan from './Plan.jsx';
import { FurnitureSymbol, FurnitureLabel, FurnitureThumb, MiniPlan, PlanDefs, paletteVars, symbolKind } from './symbols.jsx';
import { CATALOG, STYLE_PRESETS, EXAMPLE, parseFurnitureText, defaultSpec } from '../catalog.js';
import { recommend, checkLayout, normalizeRoom, rotateItem } from '../layout.js';

const q = new URLSearchParams(location.search);
const scene = q.get('scene') || 'wide';
const styleOf = (key) => STYLE_PRESETS[key] || STYLE_PRESETS.nordic;

const WIDE = { width: 400, depth: 300, height: 240, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 110, size: 140 }] };
const SCENES = {
  wide: [WIDE, '슈퍼싱글 침대, 책상 1200, 옷장, 책장, 러그, 스탠드 조명, 화분'],
  tall: [EXAMPLE.room, '슈퍼싱글 침대, 책상 1200, 옷장, 책장, 러그, 스탠드 조명, 화분'],
  error: [WIDE, '슈퍼싱글 침대, 책상 1200, 옷장, 책장, 러그, 스탠드 조명, 화분'],
  empty: [WIDE, ''],
  big: [{ width: 800, depth: 600, height: 250, doors: [{ wall: 'left', offset: 420, size: 90, kind: 'entry' }, { wall: 'right', offset: 60, size: 80, kind: 'bath' }], windows: [{ wall: 'top', offset: 200, size: 300 }, { wall: 'right', offset: 300, size: 160 }] },
    '퀸 침대, 협탁, 옷장 1200, 서랍장, 책상 1400, 책장, 3인 소파, 좌식 테이블, TV장, 4인 식탁, 냉장고, 세탁기, 러그, 화분, 스탠드 조명'],
  tiny: [{ width: 200, depth: 250, height: 230, doors: [{ wall: 'bottom', offset: 100, size: 80, kind: 'entry' }], windows: [{ wall: 'top', offset: 40, size: 90 }] }, '싱글 침대, 협탁, 의자'],
};

function useLayout(roomIn, text) {
  // &underlay=1: DWG 밑그림(room.underlay.lines) 확인용 선 몇 개
  const room = useMemo(() => normalizeRoom(q.get('underlay') ? { ...roomIn, underlay: { lines: [[0, 0, roomIn.width, roomIn.depth], [0, 90, roomIn.width, 90], [150, 0, 150, roomIn.depth], [-50, 200, roomIn.width + 50, 240]] } } : roomIn), [roomIn]);
  const specs = useMemo(() => parseFurnitureText(text).specs.map((s) => (s.key === 'rug' && roomIn === WIDE ? { ...s, w: 170, d: 110 } : s)), [text, roomIn]);
  const variants = useMemo(() => (specs.length ? Array.from({ length: recommend(room, specs, 0).variants }, (_, v) => recommend(room, specs, v)) : []), [room, specs]);
  return { room, variants };
}

function Stage({ sceneKey, styleKey }) {
  const [roomIn, text] = SCENES[sceneKey] || SCENES.wide;
  const { room, variants } = useLayout(roomIn, text);
  const style = styleOf(styleKey);
  const stageRef = useRef(null);
  const [v, setV] = useState(0);
  const [showWalk, setShowWalk] = useState(q.get('walk') !== '0');
  const [enterKey, setEnterKey] = useState(0);
  const [items, setItems] = useState(() => {
    let list = variants[0]?.items ?? [];
    const moves = (q.get('move') || (sceneKey === 'error' ? '책상:230,40,0' : '')).split(';').filter(Boolean);
    for (const m of moves) {
      const [name, pos] = m.split(':'), [x, y, rot] = pos.split(',').map(Number);
      list = list.map((i) => (i.name.includes(name) ? { ...i, x, y, rot: Number.isFinite(rot) ? rot : i.rot } : i));
    }
    return list;
  });
  const [selected, setSelected] = useState(() => (q.get('sel') ? items.find((i) => i.name.includes(q.get('sel')))?.uid ?? null : null));
  const check = useMemo(() => checkLayout(room, items), [room, items]);
  const pick = (n) => { setV(n); setItems(variants[n].items); setSelected(null); setEnterKey((k) => k + 1); };
  window.__plan = { items, issues: check.issues, score: check.score.total, selected }; // 확인 스크립트가 읽는다

  return (
    <div className="app" data-cat="layout" style={paletteVars(style.palette)}>
      <header className="topbar"><b>평면도 확인</b><span className="hint">{sceneKey} · {style.name} · {room.width}×{room.depth} · 가구 {items.length}개 · 점수 {check.score.total} · 오류 {check.issues.filter((i) => i.level === 'error').length} · 주의 {check.issues.filter((i) => i.level === 'warn').length}</span></header>
      <nav className="rail" />
      <section className="panel on"><div className="panel-b" id="issues">{check.issues.map((i, n) => <p key={n} className="hint">[{i.level}/{i.code}] {i.msg}</p>)}</div></section>
      <main className="stage" ref={stageRef} aria-label="평면도">
        <div className="stage-top">
          <div className="seg" role="tablist"><button role="tab" aria-selected="true">2D 평면도</button><button role="tab" aria-selected="false">3D 보기</button></div>
          <button className="switch float" role="switch" aria-checked={showWalk} onClick={() => setShowWalk(!showWalk)}>통로 60cm</button>
        </div>
        <div className="view on">
          <Plan
            room={room} items={items} style={style} issues={check.issues} walk={check.walk} showWalk={showWalk}
            selected={selected} onSelect={setSelected} enterKey={enterKey} stageRef={stageRef}
            onMove={(uid, x, y) => setItems((l) => l.map((i) => (i.uid === uid ? { ...i, x, y } : i)))}
            onRotate={(uid) => setItems((l) => l.map((i) => (i.uid === uid ? rotateItem(room, i) : i)))}
            onRemove={(uid) => { setItems((l) => l.filter((i) => i.uid !== uid)); setSelected(null); }}
          />
        </div>
        {variants.length > 0 && (
          <aside className="side">
            <div className="thumbs float" aria-label="배치안 고르기">
              <h3>배치안 <span>{variants.length}개</span></h3>
              {variants.map((l, n) => (
                <button key={n} type="button" aria-pressed={n === v} onClick={() => pick(n)}><MiniPlan room={room} items={l.items} palette={style.palette} />{n + 1}안<b className="num">{l.score.total}</b></button>
              ))}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

// 가구 46종 + 실제 상품 이름 + 모르는 가구: 썸네일과 평면도 기호를 나란히
function Table({ styleKey }) {
  const style = styleOf(styleKey), k = +q.get('k') || 0.63;
  const extra = [
    { ...CATALOG.dresser, key: 'dresser', name: '이케아 말름 4칸 서랍장 화이트', w: 80, d: 48, product: { name: '말름', mall: 'ikea' } },
    { ...CATALOG.sofa_2, name: '한샘 패브릭 2인 소파 아이보리', product: { name: '소파' } },
    defaultSpec('안마의자'), defaultSpec('운동기구'), { ...defaultSpec('수족관'), category: 'etc', w: 90, d: 45 },
    { key: 'custom:원형 러그', name: '원형 러그', category: 'decor', w: 120, d: 120, floor: true, clear: 0 },
    { key: 'custom:원형 식탁', name: '원형 식탁', category: 'table', w: 90, d: 90, clear: 55 },
    { key: 'custom:스툴', name: '스툴', category: 'seating', w: 35, d: 35, clear: 0 },
  ];
  const rows = [...Object.values(CATALOG), ...extra];
  return (
    <div style={{ ...paletteVars(style.palette), padding: 20, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, background: 'var(--surface)' }}>
      {rows.map((s, n) => {
        const pad = 14, vw = s.w + pad * 2, vh = s.d + (s.clear >= 30 ? Math.min(s.clear, 48) : 0) + pad * 2;
        return (
          <div key={n} className="card" style={{ margin: 0, padding: 10, display: 'grid', gap: 6, justifyItems: 'start' }} data-kind={symbolKind(s)}>
            <div className="rowx"><FurnitureThumb spec={s} /><div><b style={{ fontSize: 13 }}>{s.name}</b><div className="hint">{symbolKind(s)} · {s.w}×{s.d}</div></div></div>
            <svg className="plan" viewBox={`${-pad} ${-pad} ${vw} ${vh}`} style={{ '--k': k, width: vw / k, height: vh / k, maxWidth: '100%', background: 'var(--pf)' }}>
              <PlanDefs room={{ width: vw, depth: vh }} />
              <g filter={s.floor ? undefined : 'url(#bk-lift)'}><FurnitureSymbol spec={s} px={k} /><FurnitureLabel spec={s} px={k} /></g>
            </svg>
          </div>
        );
      })}
      <div className="card" style={{ margin: 0, gridColumn: '1 / -1' }}>
        <b>썸네일 크기와 소품</b>
        <div className="rowx" style={{ marginTop: 8 }}>
          {[32, 40, 48, 64].map((size) => <FurnitureThumb key={size} spec={CATALOG.bed_ss} size={size} />)}
          {['린넨 커튼', '화이트 무드등', '미니 화분 3종', '웨이브 거울', '단색 러그', '니트 블랭킷'].map((name) => <FurnitureThumb key={name} spec={{ name }} />)}
          {['industrial', 'minimal', 'pastel', 'dark'].map((key) => <FurnitureThumb key={key} spec={CATALOG.sofa_2} palette={STYLE_PRESETS[key]?.palette} />)}
        </div>
      </div>
    </div>
  );
}

// 스타일 3가지로 같은 배치의 색이 바뀌는 모습
function Styles() {
  const { room, variants } = useLayout(WIDE, SCENES.wide[1]);
  const items = variants[0].items, check = checkLayout(room, items);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 12, height: '100vh' }}>
      {(q.get('keys') || 'minimal,nordic,industrial').split(',').map((key) => (
        <div key={key} style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 0 }}>
          <b>{styleOf(key).name}</b>
          <div style={{ position: 'relative', minHeight: 0 }}>
            <Plan room={room} items={items} style={styleOf(key)} issues={check.issues} walk={check.walk} showWalk selected={null} onSelect={() => {}} onMove={() => {}} onRotate={() => {}} onRemove={() => {}} enterKey={0} />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {scene === 'table' ? <Table styleKey={q.get('style')} /> : scene === 'styles' ? <Styles /> : <Stage sceneKey={scene} styleKey={q.get('style')} />}
  </StrictMode>,
);
