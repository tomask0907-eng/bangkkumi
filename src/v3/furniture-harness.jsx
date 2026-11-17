// 가구 패널(FurnitureInput, ProductPicker, inputs) 확인용. 뼈대가 연결되기 전에 시안과 같은 틀 안에서 본다.
// 실행: BK_CACHE=node_modules/.vite-v3furniture npx vite --port 5192 --strictPort → /src/v3/furniture-harness.html
// 주소 옵션: state=empty|mixed|full, picker=1|replace, ref=off|fail, cap(담기가 false 를 돌려준다)
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './panels-furniture.css';
import { STYLE_PRESETS, EXAMPLE } from '../catalog.js';
import { mergeParsed, newUid } from '../state.js';
import { paletteVars } from './symbols.jsx';
import Ic from './Ic.jsx';
import FurnitureInput from '../components/FurnitureInput.jsx';
import ProductPicker from '../components/ProductPicker.jsx';

const q = new URLSearchParams(window.location.search);
const state = q.get('state') || '';

const html = await (await fetch('/index.html')).text();
const sprite = html.match(/<svg[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<symbol[\s\S]*?<\/svg>/);
if (sprite) document.getElementById('sprite').innerHTML = sprite[0];

const style = Array.isArray(STYLE_PRESETS) ? STYLE_PRESETS[0] : Object.values(STYLE_PRESETS)[0];
const TEXT = { '': '슈퍼싱글 침대, 책상 1200, 옷장 1000, 책장, 러그', empty: '', mixed: '슈퍼싱글 침대, 책상 1200', full: '침대, 책상, 옷장, 책장, 서랍장, 소파, 식탁, TV, 냉장고, 러그, 화분, 전신거울, 의자, 협탁, 행거' };
const PRODUCT = { id: 'dnw-1', src: 'danawa', name: '데스커 컴퓨터 책상 DSAD112D 1200x700', brand: '데스커', w: 120, d: 70, h: 72, price: 128700, url: 'https://prod.danawa.com/info/?pcode=1', image: '', warn: '치수 확인 필요', note: '상판 두께 2.2cm' };

function start() {
  let specs = mergeParsed(TEXT[state] ?? TEXT[''], []).specs.map((sp) => ({ ...sp, _wait: false }));
  if (state === 'mixed') {
    specs = [
      ...specs,
      { ...specs[1], uid: newUid(), _id: 'product|dnw-1', name: '책상', w: 120, d: 70, h: 72, price: 128700, product: PRODUCT, source: 'catalog' },
      { ...specs[0], uid: newUid(), _id: 'x', key: 'custom', name: '전자피아노', w: 130, d: 30, h: 80, source: 'default' },
      { ...specs[0], uid: newUid(), _id: 'y', key: 'custom', name: '캣타워', w: 60, d: 60, h: 150, source: 'ai', _wait: true },
      { ...specs[0], uid: newUid(), _id: 'ref|1', key: 'custom', name: '라탄 암체어', w: 70, d: 75, h: 80, price: 189000, source: 'ai', tint: '#C89B6A', ref: { kind: 'photo' } },
      { ...specs[0], uid: newUid(), _id: 'ref|2', key: 'custom', name: '원목 사이드 테이블', w: 45, d: 45, h: 50, price: 59000, source: 'ai', tint: '#8A6B4F', ref: { kind: 'link', url: 'https://example.com/p/1' }, owned: true },
    ];
  }
  return specs;
}

function Harness() {
  const [text, setText] = useState(TEXT[state] ?? TEXT['']);
  const [specs, setSpecs] = useState(start);
  const [user, setUser] = useState({});
  const [picker, setPicker] = useState(q.get('picker') === 'replace' ? { initial: { category: 'desk', near: { w: 120, d: 60 }, title: "'책상'과 비슷한 실제 상품" } } : q.has('picker') ? {} : null);
  const priceOfSpec = (sp) => (user[sp.uid] != null ? { price: user[sp.uid], source: 'user' } : { price: sp.price ?? 0, source: sp.product ? 'product' : 'est' });
  const patch = (uid, p) => setSpecs((list) => list.map((sp) => (sp.uid === uid ? { ...sp, ...p } : sp)));
  const total = specs.filter((sp) => !sp.owned).reduce((a, sp) => a + priceOfSpec(sp).price, 0);
  return (
    <>
      <div className="app" data-cat="furniture" style={paletteVars(style.palette)}>
        <header className="topbar"><span className="brand"><span className="logo"><Ic name="logo" /></span>방꾸미</span></header>
        <nav className="rail"><button type="button" aria-selected="true"><Ic name="sofa" className="l" />가구</button></nav>
        <section className="panel on" aria-label="가구">
          <div className="panel-h"><h2>가구</h2><p>갖고 싶은 가구를 글로 적어 주세요.</p></div>
          <div className="panel-b">
            <FurnitureInput
              text={text} specs={specs} truncated={state === 'full'} priceOfSpec={priceOfSpec}
              onText={setText} onParse={() => setSpecs((prev) => mergeParsed(text, prev).specs)} onQuick={(name) => setText((t) => (t ? `${t}, ${name}` : name))}
              onEdit={patch} onRemove={(uid) => setSpecs((list) => list.filter((sp) => sp.uid !== uid))}
              onPrice={(sp, v) => setUser((u) => ({ ...u, [sp.uid]: v }))} onPriceReset={(sp) => setUser((u) => { const n = { ...u }; delete n[sp.uid]; return n; })}
              onBrowse={() => setPicker({})} onFind={(sp) => setPicker({ initial: { category: 'desk', near: { w: sp.w, d: sp.d }, title: `'${sp.name}'과 비슷한 실제 상품` } })}
              onOwned={(uid, owned) => patch(uid, { owned })}
              refEnabled={q.get('ref') !== 'off'}
              onAddRef={(input) => new Promise((ok, no) => setTimeout(() => {
                if (q.get('ref') === 'fail') { no(new Error('사진에서 가구를 찾지 못했어요. 가구가 잘 보이는 사진으로 다시 해 주세요.')); return; }
                setSpecs((list) => [...list, { ...list[0], uid: newUid(), _id: 'ref|n', name: input.url ? '링크 가구' : '사진 가구', w: 80, d: 40, h: 60, price: 99000, source: 'ai', tint: '#6C8FB5', ref: { kind: input.url ? 'link' : 'photo', url: input.url } }]);
                ok();
              }, 2500))}
            />
          </div>
          <div className="panel-f"><span className="hint" style={{ flex: 1 }}>놓을 가구 {specs.length}개 · <b className="num" style={{ color: 'var(--ink)' }}>{total.toLocaleString('ko-KR')}원</b></span><button className="btn soft" type="button">다음: 배치<Ic name="right" className="s" /></button></div>
        </section>
        <main className="stage" />
      {picker && <ProductPicker room={EXAMPLE.room} initial={picker.initial} onPick={(spec) => { if (q.has('cap')) return false; setSpecs((list) => [...list, { ...spec, uid: newUid() }]); return true; }} onClose={() => setPicker(null)} />}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
