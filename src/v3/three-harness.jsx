// 3D 보기 확인용. 시안의 작업 화면 틀(.app > .stage > .view) 안에 Plan3D 만 넣어 본다.
// 실행: BK_CACHE=node_modules/.vite-v3three npx vite --port 5190 --strictPort → /src/v3/three-harness.html
// 주소 옵션: ?style=minimal|nordic|industrial(기본 nordic) · ?room=34|43(3.0×4.0 / 4.0×3.0, 기본 43) · ?view=bird|top|eye
//           ?sel=가구 uid(예: s1) · ?gallery=1(카탈로그의 모든 가구 + 실제 상품 + 모르는 가구, &rot=180 이면 뒤로 돌려서) · ?vars=design(시안의 북유럽 5색을 --c1~--c5 로) · ?bare=1(틀 없이 Plan3D 만) · ?mock=1(시안 그림과 같은 배치)
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recommend } from '../layout.js';
import { CATALOG, STYLE_PRESETS, parseFurnitureText, defaultSpec } from '../catalog.js';
import { productToSpec } from '../products.js';
import Plan3D from './Plan3D.jsx';

const q = new URLSearchParams(location.search);
const ROOMS = {
  34: { width: 300, depth: 400, height: 240, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 50, size: 100, sill: 90, height: 120 }] },
  43: { width: 400, depth: 300, height: 240, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 110, size: 140, sill: 90, height: 120 }] },
};
const DESIGN_VARS = ['#F3F6F8', '#E3CDAE', '#8FB8DE', '#F2C6A0', '#3F5F7F'];
const VIEW_KEYS = ['bird', 'top', 'eye'];

const gallery = q.has('gallery');
const room = gallery
  ? { width: 1100, depth: 1160, height: 240, doors: [{ wall: 'bottom', offset: 40, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 300, size: 200, sill: 90, height: 120 }] }
  : ROOMS[q.get('room')] || ROOMS[43];

function galleryItems() {
  const product = productToSpec({ id: 'dnw-1', src: 'danawa', name: '확인용 5단 서랍장', brand: '확인', type: '일반서랍장', category: 'drawer', w: 60, d: 40, h: 110, price: 89000, url: 'https://prod.danawa.com/info/?pcode=1' });
  const specs = [...Object.values(CATALOG), product, defaultSpec('안마기'), { name: '이름 모를 것', category: 'etc', w: 70, d: 70, h: 40 }].filter(Boolean);
  let x = 20, y = 20, rowD = 0;
  return specs.map((s, i) => {
    if (x + s.w > room.width - 20) { x = 20; y += rowD + 70; rowD = 0; }
    const it = { ...s, uid: `g${i}`, x, y, rot: q.get('rot') === '180' ? 180 : 0 };
    x += s.w + 30;
    rowD = Math.max(rowD, s.d);
    return it;
  });
}
const specs = parseFurnitureText('슈퍼싱글 침대, 책상 1200, 옷장, 책장, 러그, 협탁, 무드등, 화분').specs.map((s, i) => ({ ...s, uid: `s${i}` }));
const GALLERY = gallery && galleryItems();
// ?mock=1: 시안 그림(iso-room.svg, 평면도 목업)과 같은 자리에 놓는다 → 시안 스크린샷과 나란히 비교할 때
const at = (key, x, y, rot, more) => ({ ...CATALOG[key], uid: key, x, y, rot, ...more });
const MOCK = q.has('mock') && [
  at('wardrobe_100', 0, 0, 270), at('desk_120', 120, 0, 0), at('nightstand', 244, 0, 0, { w: 40 }), at('bed_ss', 290, 0, 0),
  at('bookshelf', 0, 115, 270), at('rug', 100, 125, 0, { w: 170, d: 110 }), at('plant', 352, 252, 0, { h: 100 }),
];

function Harness() {
  const [selected, setSelected] = useState(q.get('sel'));
  const [is3d, setIs3d] = useState(true); // 탭을 여닫아 자원 정리(언마운트)를 확인한다
  const [styleKey, setStyleKey] = useState(STYLE_PRESETS[q.get('style')] ? q.get('style') : 'nordic');
  const [variant, setVariant] = useState(0);
  const style = STYLE_PRESETS[styleKey];
  const items = useMemo(() => GALLERY || MOCK || recommend(room, specs, variant).items, [variant]);
  const vars = q.get('vars') === 'design' ? DESIGN_VARS : style.palette.map((p) => p.hex);

  // ?view= 로 고른 방향 버튼을 눌러 둔다
  useEffect(() => {
    const i = VIEW_KEYS.indexOf(q.get('view'));
    if (is3d && i > 0) document.querySelectorAll('.plan3d-views button')[i]?.click();
  }, [is3d]);

  // ?bare=1: 시안 틀 없이 Plan3D 만(버튼은 왼쪽 위, 색은 style.palette 에서)
  if (q.has('bare')) {
    return <div style={{ width: 640, height: 440, margin: 40 }}><Plan3D room={room} items={items} style={style} selected={selected} onSelect={setSelected} /></div>;
  }

  return (
    <div className="app" data-cat="layout" style={Object.fromEntries(vars.map((hex, i) => [`--c${i + 1}`, hex]))}>
      <div className="topbar">
        <div className="project"><b>3D 확인 · {style.name}</b><span id="status">고른 가구: {selected ?? '없음'} · 가구 {items.length}개 · 배치안 {variant + 1}</span></div>
        <span className="sp" />
        <select className="select sm" id="style" aria-label="스타일" style={{ width: 150 }} value={styleKey} onChange={(e) => setStyleKey(e.target.value)}>
          {Object.values(STYLE_PRESETS).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <button className="btn sm" id="next" type="button" onClick={() => setVariant(variant + 1)}>다른 배치안</button>
      </div>
      <div className="rail" />
      <div className="panel on" />
      <main className={is3d ? 'stage is3d' : 'stage'}>
        <div className="stage-top">
          <div className="seg" role="tablist" aria-label="보기 방식">
            <button role="tab" id="tab-2d" aria-selected={!is3d} onClick={() => setIs3d(false)}>2D 평면도</button>
            <button role="tab" id="tab-3d" aria-selected={is3d} onClick={() => setIs3d(true)}>3D 보기</button>
          </div>
        </div>
        <div className="view on">
          {is3d && <Plan3D room={room} items={items} style={style} selected={selected} onSelect={setSelected} />}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);
