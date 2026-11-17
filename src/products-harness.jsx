// 상품 고르기 모달 확인용 화면.
// 실행: BK_CACHE=node_modules/.vite-products npx vite --port 5187 --strictPort → /src/products-harness.html
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import { won } from './catalog.js';
import ProductPicker from './components/ProductPicker.jsx';

// 방은 300 × 400. 다른 크기로 보려면 주소 끝에 ?room=200x250
const [rw, rd] = (new URLSearchParams(location.search).get('room') || '').split('x').map(Number);
const ROOM = { width: rw > 0 ? rw : 300, depth: rd > 0 ? rd : 400, height: 240, doors: [], windows: [] };
const REPLACE = { category: 'desk', near: { w: 120, d: 60 }, title: '책상 1200과 비슷한 실제 상품' };

function Harness() {
  const [open, setOpen] = useState(null); // null | 'pick' | 'replace'
  const [picked, setPicked] = useState([]);
  const onPick = (spec, product) => {
    setPicked((list) => [...list, { spec, product, mode: open }]);
    if (open === 'replace') setOpen(null); // 바꾸기 모드에서는 부르는 쪽이 닫는다
  };
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sp-6)' }}>
      <h1 className="card-title">상품 고르기 확인 (방 {ROOM.width} × {ROOM.depth}cm)</h1>
      <div className="row" style={{ margin: 'var(--sp-4) 0' }}>
        <button type="button" className="btn btn-primary" onClick={() => setOpen('pick')}>상품 고르기 열기</button>
        <button type="button" className="btn" onClick={() => setOpen('replace')}>바꾸기 모드로 열기</button>
        <button type="button" className="btn btn-ghost" onClick={() => setPicked([])}>목록 비우기</button>
      </div>
      <section className="card">
        <h2 className="card-title">담은 가구 {picked.length}개</h2>
        <ol id="picked">
          {picked.map(({ spec, product, mode }, i) => (
            <li key={i}>
              <b>{spec.name}</b> ({spec.key}, {spec.category}, {spec.source}) {spec.w} × {spec.d} × {spec.h}cm · {won(spec.price)} · {mode === 'replace' ? '바꾸기' : '담기'}
              <div className="muted">{product.id} · {product.name} · 검색어 "{spec.query}" · 원래 치수 {spec.product?.w} × {spec.product?.d} × {spec.product?.h}</div>
            </li>
          ))}
        </ol>
      </section>
      {open && <ProductPicker room={ROOM} initial={open === 'replace' ? REPLACE : undefined} onPick={onPick} onClose={() => setOpen(null)} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
