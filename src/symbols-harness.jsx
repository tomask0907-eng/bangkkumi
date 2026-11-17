// 가구 그림 확인용 화면: 모든 종류를 4방향으로, 작은 것·큰 것, 상태별로 그려 본다.
// 실행: BK_CACHE=node_modules/.vite-design npx vite --port 5185 --strictPort → /src/symbols-harness.html
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import { FurnitureSymbol, FurnitureLabel, symbolTransform, symbolKind, PlanDefs, RoomShell, WalkOverlay, ClearZone, MiniPlan, planViewBox } from './symbols.jsx';

const PALETTES = {
  내추럴: ['#f3ecdf', '#c8a77e', '#b08a5e', '#ddd0b8', '#7d8b5a'],
  모던: ['#e2e3e4', '#8d8f91', '#4a3b30', '#a7a9ab', '#c7a250'],
  빈티지: ['#efe4cf', '#8a5a3c', '#7a4a2a', '#c9a227', '#7b2d2d'],
  없음: null,
};
const toPalette = (list) => list && list.map((hex, i) => ({ role: ['벽', '바닥', '메인 가구', '패브릭', '포인트'][i], name: '', hex }));

const S = (key, name, category, w, d, clear, color, extra = {}) => ({ key, name, category, w, d, h: 80, clear, color, ...extra });
const SPECS = [
  S('bed_single', '싱글 침대', 'bed', 100, 200, 0, '#c9b8a6'),
  S('bed_queen', '퀸 침대', 'bed', 150, 200, 0, '#c9b8a6'),
  S('desk', '책상', 'desk', 120, 60, 60, '#a58a6f'),
  S('wardrobe', '옷장', 'storage', 100, 60, 50, '#8c7a6b', { tall: true }),
  S('hanger', '스탠드 행거', 'storage', 120, 45, 40, '#9c9c9c', { tall: true }),
  S('bookshelf', '책장', 'storage', 80, 30, 40, '#b09a82', { tall: true }),
  S('dresser', '서랍장', 'storage', 80, 45, 40, '#a89580'),
  S('sofa_2', '2인 소파', 'seating', 150, 80, 40, '#9fa8a3'),
  S('sofa_3', '3인 소파', 'seating', 200, 90, 40, '#9fa8a3'),
  S('armchair', '1인 소파', 'seating', 80, 80, 30, '#9fa8a3'),
  S('chair', '의자', 'seating', 45, 50, 0, '#9fa8a3'),
  S('beanbag', '빈백', 'seating', 70, 70, 0, '#b9a48c'),
  S('dining_2', '2인 식탁', 'table', 80, 70, 50, '#b7a089'),
  S('dining_4', '4인 식탁', 'table', 120, 75, 50, '#b7a089'),
  S('low_table', '좌식 테이블', 'table', 90, 55, 0, '#b7a089'),
  S('side_table_round', '원형 사이드 테이블', 'table', 45, 45, 0, '#b7a089'),
  S('tv_stand', 'TV 거실장', 'storage', 150, 40, 0, '#8c7a6b'),
  S('vanity', '화장대', 'desk', 80, 40, 50, '#c9b8a6'),
  S('mirror', '전신거울', 'decor', 50, 35, 0, '#b09a82'),
  S('fridge', '냉장고', 'appliance', 60, 65, 60, '#e4e6e8', { tall: true }),
  S('fridge_wide', '양문형 냉장고', 'appliance', 90, 75, 60, '#d5d8db', { tall: true }),
  S('washer', '세탁기', 'appliance', 60, 60, 50, '#eceef0'),
  S('rug', '러그', 'decor', 140, 200, 0, '#d8cbb6', { floor: true }),
  S('rug_round', '원형 러그', 'decor', 120, 120, 0, '#d8cbb6', { floor: true }),
  S('plant', '몬스테라 화분', 'decor', 45, 45, 0, '#6b9a63'),
  S('lamp', '플로어 스탠드', 'decor', 35, 35, 0, '#d9c7ab'),
  S('piano', '전자피아노', 'etc', 130, 35, 50, '#2b2b2e'),
  S('microwave', '전자레인지', 'appliance', 50, 40, 0, '#d5d8db'),
  S('custom:캣타워', '캣타워', 'etc', 60, 60, 0, '#c7b39a', { source: 'default' }),
  S('custom:미니 스툴', '미니 스툴 30', 'seating', 30, 30, 0, '#b9a48c'),
];
const ROTS = [0, 90, 180, 270];
const PX = 0.8;

function Cell({ spec, rot, palette, selected, level }) {
  const [w, h] = rot % 180 === 0 ? [spec.w, spec.d] : [spec.d, spec.w];
  const item = { ...spec, x: 0, y: 0, rot };
  const m = (spec.clear || 0) + 14; // 의자·앞 공간까지 보이게 여백
  return (
    <svg className="plan" viewBox={`${-m} ${-m} ${w + m * 2} ${h + m * 2}`} width={(w + m * 2) / PX} height={(h + m * 2) / PX}>
      <rect x={-m} y={-m} width={w + m * 2} height={h + m * 2} fill="#eadcc4" />
      <rect width={w} height={h} fill="none" stroke="#c93a2b" strokeWidth="0.5" strokeDasharray="2 2" />
      <g className={`plan-item ${spec.floor ? 'is-floor' : ''}`}>
        <g transform={symbolTransform(item)}>
          {selected && <ClearZone spec={spec} />}
          <FurnitureSymbol spec={spec} palette={palette} selected={selected} level={level} />
          <FurnitureLabel spec={spec} rot={rot} px={PX} level={level} />
        </g>
      </g>
    </svg>
  );
}

const ROOM = {
  width: 300, depth: 400, height: 240,
  doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }, { wall: 'right', offset: 250, size: 70, kind: 'bath' }],
  windows: [{ wall: 'top', offset: 40, size: 140, sill: 90, height: 120 }, { wall: 'left', offset: 60, size: 80, sill: 90, height: 120 }],
};
const SCENE = [
  { ...SPECS[22], w: 130, d: 190, uid: 'rug', x: 48, y: 100, rot: 0 },
  { ...SPECS[0], w: 110, uid: 'bed', x: 190, y: 0, rot: 0 },
  { ...SPECS[2], uid: 'desk', x: 50, y: 0, rot: 0 },
  { ...SPECS[5], uid: 'book', x: 0, y: 160, rot: 270 },
  { ...SPECS[3], uid: 'ward', x: 200, y: 340, rot: 180 },
];
const levelOf = (uid) => ({ ward: 'warn', book: 'error' })[uid];

function App() {
  const [pName, setPName] = useState('내추럴');
  const palette = toPalette(PALETTES[pName]);
  const walk = [];
  for (let y = 70; y < 330; y += 10) for (let x = 40; x < 190; x += 10) walk.push({ x, y });
  return (
    <div style={{ padding: 20 }}>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>가구 그림 확인</h1>
        <div className="segmented" id="palettes">
          {Object.keys(PALETTES).map((n) => <button key={n} aria-pressed={n === pName} onClick={() => setPName(n)}>{n}</button>)}
        </div>
        <span className="muted">빨간 점선 = 가구 몸체(w×d). 회전 0 / 90 / 180 / 270</span>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', marginBottom: 24, gap: 24 }}>
        <svg className="plan" id="scene" viewBox={planViewBox(ROOM, PX)} width={420}>
          <PlanDefs room={ROOM} palette={palette} />
          <RoomShell room={ROOM} palette={palette} px={PX} />
          <WalkOverlay points={walk} />
          {SCENE.map((it) => (
            <g key={it.uid} className={`plan-item ${it.floor ? 'is-floor' : ''}`}>
              <g transform={symbolTransform(it)}>
                {it.uid === 'desk' && <ClearZone spec={it} />}
                <FurnitureSymbol spec={it} palette={palette} selected={it.uid === 'desk'} level={levelOf(it.uid)} />
                <FurnitureLabel spec={it} rot={it.rot} px={PX} level={levelOf(it.uid)} />
              </g>
            </g>
          ))}
        </svg>
        <div style={{ width: 90 }}><MiniPlan room={ROOM} items={SCENE} palette={palette} /></div>
        <div className="row" id="states" style={{ flexWrap: 'wrap' }}>
          {[['기본', {}], ['선택', { selected: true }], ['주의', { level: 'warn' }], ['오류', { level: 'error' }], ['선택+오류', { selected: true, level: 'error' }]].map(([name, p]) => (
            <figure key={name} style={{ margin: 0 }}><Cell spec={SPECS[2]} rot={0} palette={palette} {...p} /><figcaption className="muted">{name}</figcaption></figure>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 28px', alignItems: 'flex-end' }}>
        {SPECS.map((spec) => (
          <div key={spec.key} data-kind={symbolKind(spec)}>
            <div><b>{spec.name}</b> <span className="muted">{symbolKind(spec)} · {spec.w}×{spec.d}</span></div>
            <div className="row" style={{ alignItems: 'flex-end' }}>{ROTS.map((rot) => <Cell key={rot} spec={spec} rot={rot} palette={palette} />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
