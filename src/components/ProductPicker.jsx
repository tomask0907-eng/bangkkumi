// 실제 상품(다나와·이케아 조사 자료)에서 가구를 고르는 모달. 규약 10.2
// <ProductPicker room initial={{ category, near: { w, d }, title }} onPick={(spec, product) => {}} onClose palette? />
// onPick 이 false 를 돌려주면(15개가 차서 담지 못함) 버튼을 "담았어요"로 바꾸지 않는다.
// palette(선택): 사진이 없는 상품의 가구 그림에 입힐 스타일 5색. 없으면 바깥(.app)의 --c1~--c5 를 쓴다
import { useEffect, useMemo, useRef, useState } from 'react';
import Ic from '../v3/Ic.jsx';
import { FurnitureThumb } from '../v3/symbols.jsx';
import { won } from '../catalog.js';
import { loadProducts, searchProducts, productToSpec, PRODUCT_SOURCES, PRODUCT_CATEGORIES } from '../products.js';
import './ProductPicker.css';

// 상품 사진을 쓰면 안 되게 되면 이 값 하나만 false로 바꾼다(모든 카드가 자리 표시로 바뀐다)
const SHOW_IMAGES = true;
const PAGE = 60;
const SORTS = [['popular', '인기순'], ['price', '가격 낮은 순'], ['price-desc', '가격 높은 순'], ['small', '작은 순']];
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)';

const https = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : '');
const round1 = (n) => Math.round(n * 10) / 10;
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const count = (n) => n.toLocaleString('ko-KR');
// 아이콘 묶음에 돋보기가 없어서 여기서 그린다
const SearchIc = () => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>;

// "지금 가구보다 폭 +10cm"
function nearText(p, near) {
  const parts = [['폭', round1(p.w - near.w)], ['깊이', round1(p.d - near.d)]]
    .filter(([, diff]) => Number.isFinite(diff) && diff !== 0)
    .map(([label, diff]) => `${label} ${signed(diff)}cm`);
  return parts.length ? `지금 가구보다 ${parts.join(', ')}` : '지금 가구와 폭, 깊이가 같아요';
}

function Card({ p, near, catLabel, pickLabel, doneLabel, done, onPick, palette }) {
  const [broken, setBroken] = useState(false);
  const image = SHOW_IMAGES && !broken ? https(p.image) : '';
  const url = https(p.url);
  const source = PRODUCT_SOURCES[p.src];
  // 사진이 없는 상품(이케아 자료)은 평면도와 같은 가구 그림을 보여 준다
  const drawn = useMemo(() => (image ? null : productToSpec(p)), [image, p]);
  return (
    <article className="pp-card">
      {image ? (
        <div className="pp-thumb">
          <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        </div>
      ) : (
        <div className="pp-thumb is-empty" aria-hidden="true">
          {drawn ? <FurnitureThumb spec={drawn} palette={palette} size={64} /> : <Ic name="cube" className="l" />}
          <span>{catLabel || '가구'}</span>
        </div>
      )}
      <div className="pp-info">
        <div className="pp-top">
          <span className="pp-brand">{p.brand}</span>
          {p.warn && <span className="badge check"><Ic name="warn" />{p.warn}</span>}
        </div>
        <h3 className="pp-name" title={p.name}>{p.name}</h3>
        <p className="pp-dims">가로 {p.w} × 깊이 {p.d} × 높이 {p.h} cm</p>
        {near && <p className="pp-near">{nearText(p, near)}</p>}
        <p className="pp-price" title={source?.note}>
          <b>{won(p.price)}</b>
          {source && <span>{source.label}</span>}
        </p>
        {p.note && <p className="pp-note" title={p.note}>{p.note}</p>}
        <div className="pp-actions">
          <button type="button" className={`btn sm ${done ? 'soft' : 'primary'}`} aria-label={`${p.name} ${done ? doneLabel : pickLabel}`} onClick={() => onPick(p)}>
            {done ? <><Ic name="check" className="s" />{doneLabel}</> : pickLabel}
          </button>
          {url && (
            <a className="btn sm" href={url} target="_blank" rel="noopener noreferrer" title="새 창에서 열려요">
              상품 페이지<Ic name="link" className="s" /><span className="pp-sr"> (새 창에서 열려요)</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ProductPicker({ room, initial, onPick, onClose, palette }) {
  const near = initial?.near && Number.isFinite(initial.near.w) && Number.isFinite(initial.near.d) ? initial.near : null;
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [category, setCategory] = useState(initial?.category || '');
  const [type, setType] = useState('');
  const [fitOn, setFitOn] = useState(true);
  const [sort, setSort] = useState(near ? 'near' : 'popular');
  const [limit, setLimit] = useState(PAGE);
  const [doneId, setDoneId] = useState('');
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const bodyRef = useRef(null);
  const doneTimer = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // 모달 기본 동작: 검색 칸에 초점, Esc로 닫기, Tab이 밖으로 나가지 않게, 뒤 화면 스크롤 잠금, 닫히면 초점 되돌리기
  useEffect(() => {
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const els = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      const first = els[0];
      const last = els[els.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      clearTimeout(doneTimer.current);
      before?.focus?.({ preventScroll: true }); // 방금 담은 줄로 내려 둔 가구 목록이 다시 위로 올라가지 않게
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setError('');
    loadProducts().then(
      (items) => { if (alive) setList(items); },
      (e) => { if (alive) setError(e?.message || '상품 목록을 불러오지 못했어요'); },
    );
    return () => { alive = false; };
  }, [attempt]);

  const toTop = () => { setLimit(PAGE); bodyRef.current?.scrollTo(0, 0); };

  // 글자를 치는 동안에는 찾지 않고 150ms 쉬면 찾는다
  useEffect(() => {
    if (q === dq) return undefined;
    const t = setTimeout(() => { setDq(q); toTop(); }, 150);
    return () => clearTimeout(t);
  }, [q, dq]);

  const fit = fitOn && room?.width > 0 && room?.depth > 0 ? { width: room.width, depth: room.depth } : null;
  const result = useMemo(
    () => (list ? searchProducts(list, { q: dq, category: category || undefined, type: type || undefined, fit, near, sort, offset: 0, limit }) : null),
    [list, dq, category, type, fit?.width, fit?.depth, near?.w, near?.d, sort, limit],
  );

  const catLabel = (key) => PRODUCT_CATEGORIES.find((c) => c.key === key)?.label || '';
  const pickCategory = (key) => { setCategory(key); setType(''); toTop(); };
  const pick = (p) => {
    const spec = productToSpec(p);
    if (!spec) return; // 형식이 틀린 상품(목록을 읽을 때 이미 걸러져서 실제로는 생기지 않는다)
    if (onPick?.(spec, p) === false) return; // 15개가 차서 담지 못했으면 버튼을 바꾸지 않는다
    setDoneId(p.id);
    clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setDoneId(''), 1500);
  };
  const pickLabel = near ? '이걸로 바꾸기' : '담기';
  const doneLabel = near ? '바꿨어요' : '담았어요';
  const doneName = doneId && result?.items.find((p) => p.id === doneId)?.name;
  // 검색어를 바꿔 지금 고른 세부 분류가 0개가 돼도 고른 값은 목록에 남긴다
  const types = result ? (type && !result.types.some((t) => t.type === type) ? [{ type, count: 0 }, ...result.types] : result.types) : [];
  // 결과가 없을 때: "방에 들어가는 것만"을 끄면 나오는 상품이 있을 때만 [끄기] 단추를 보여 준다
  const unfit = result?.total === 0 && fit ? searchProducts(list, { q: dq, category: category || undefined, type: type || undefined, limit: 1 }).total : 0;
  const toSearch = () => searchRef.current?.focus(); // 누른 단추가 사라져도 초점이 창 밖으로 빠지지 않게
  // 개수와 설명은 실제로 불러온 자료에서 만든다(공개 사이트에는 이케아 자료만 있다)
  const nDanawa = useMemo(() => (list ? list.filter((p) => p.src === 'danawa').length : 0), [list]);
  const nIkea = list ? list.length - nDanawa : 0;
  const desc = !list ? (error ? '상품 목록을 불러오지 못했어요.' : '상품 목록을 불러오고 있어요…')
    : `실제 상품 ${count(list.length)}개${nDanawa && nIkea ? ` (다나와 ${count(nDanawa)} · 이케아 ${count(nIkea)})` : nIkea ? ' (이케아)' : ' (다나와)'} · 고르면 실제 치수로 방에 놓여요`;
  const priceNote = !list ? '가격은 조사한 날의 값이에요.'
    : nDanawa && nIkea ? '가격은 2026년 11월 17일 다나와 최저가(배송비 제외)와 이케아 공식가예요.'
      : nDanawa ? '가격은 2026년 11월 17일 다나와 최저가(배송비 제외)예요.' : '가격은 2026년 11월에 조사한 이케아 공식가예요.';

  return (
    <div className="pp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-title" ref={dialogRef}>
        <header className="pp-head">
          <div className="pp-title">
            <h2 id="pp-title">{initial?.title || '실제 상품에서 고르기'}</h2>
            <p className="pp-desc">{desc}</p>
          </div>
          <label className="pp-search">
            <span className="pp-sr">상품 검색</span>
            <SearchIc />
            <input ref={searchRef} type="search" className="input" placeholder="책상 1200, 이케아 공식, 원목 침대 SS" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button type="button" className="iconbtn" aria-label="상품 고르기 닫기" onClick={() => onClose?.()}><Ic name="x" /></button>
        </header>

        <div className="pp-controls">
          <div className="pp-chips" role="group" aria-label="분류">
            <button type="button" className="pp-chip" aria-pressed={!category} onClick={() => pickCategory('')}>전체</button>
            {PRODUCT_CATEGORIES.map((c) => (
              <button type="button" key={c.key} className="pp-chip" aria-pressed={category === c.key} onClick={() => pickCategory(c.key)}>{c.label}</button>
            ))}
          </div>
          <div className="pp-row">
            <p className="pp-count" role="status">{result ? <><b>{count(result.total)}</b>개</> : null}</p>
            {room?.width > 0 && room?.depth > 0 && (
              <button type="button" className="switch pp-switch" role="switch" aria-checked={fitOn} title={`방 크기 ${room.width} × ${room.depth}cm`} onClick={() => { setFitOn(!fitOn); toTop(); }}>내 방에 들어가는 것만</button>
            )}
            <span className="pp-sp" />
            {category && types.length > 0 && (
              <select className="select sm pp-select" aria-label="세부 분류" value={type} onChange={(e) => { setType(e.target.value); toTop(); }}>
                <option value="">세부 분류 전체</option>
                {types.map((t) => <option key={t.type} value={t.type}>{t.type} ({count(t.count)})</option>)}
              </select>
            )}
            <select className="select sm pp-select" aria-label="정렬" value={sort} onChange={(e) => { setSort(e.target.value); toTop(); }}>
              {SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              {near && <option value="near">크기가 비슷한 순</option>}
            </select>
          </div>
        </div>

        <div className="pp-body" ref={bodyRef} aria-busy={!list && !error}>
          {error ? (
            <div className="empty-msg pp-state" role="alert">
              <span className="ico"><Ic name="warn" className="l" /></span>
              <b>{error}</b>
              <span>인터넷 연결을 확인하고 다시 시도해 주세요.</span>
              <button type="button" className="btn primary" onClick={() => { setAttempt((n) => n + 1); toSearch(); }}>다시 시도</button>
            </div>
          ) : !result ? (
            <div className="pp-grid" aria-label="상품을 불러오는 중이에요">
              {Array.from({ length: 8 }, (_, i) => (
                <div className="pp-card" key={i} aria-hidden="true">
                  <span className="pp-skel pp-skel-thumb" />
                  <div className="pp-info">
                    <span className="pp-skel" style={{ width: '40%' }} />
                    <span className="pp-skel" />
                    <span className="pp-skel" style={{ width: '70%' }} />
                    <span className="pp-skel" style={{ width: '50%', height: 18 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : result.total === 0 ? (
            <div className="empty-msg pp-state">
              <span className="ico"><SearchIc /></span>
              <b>맞는 상품이 없어요</b>
              <span>검색어를 줄이거나 조건을 풀어 보세요.</span>
              <div className="pp-row">
                {q && <button type="button" className="btn sm" onClick={() => { setQ(''); toSearch(); }}>검색어 지우기</button>}
                {unfit > 0 && <button type="button" className="btn sm" onClick={() => { setFitOn(false); toTop(); toSearch(); }}>"방에 들어가는 것만" 끄기</button>}
                {type && <button type="button" className="btn sm" onClick={() => { setType(''); toTop(); toSearch(); }}>세부 분류 전체로 보기</button>}
                {category && <button type="button" className="btn sm" onClick={() => { pickCategory(''); toSearch(); }}>전체 분류에서 찾기</button>}
              </div>
            </div>
          ) : (
            <>
              <div className="pp-grid">
                {result.items.map((p) => (
                  <Card key={p.id} p={p} near={near} catLabel={catLabel(p.category)} pickLabel={pickLabel} doneLabel={doneLabel} done={doneId === p.id} onPick={pick} palette={palette} />
                ))}
              </div>
              {result.items.length < result.total && (
                <div className="pp-more">
                  <button type="button" className="btn sm" onClick={() => setLimit((n) => n + PAGE)}>더 보기</button>
                  <span className="hint">{count(result.total)}개 가운데 {count(result.items.length)}개를 보고 있어요</span>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="pp-foot">
          <Ic name="info" className="s" />
          <p>{priceNote} 실제 가격과 다를 수 있어요. 치수도 살 때 상품 페이지에서 확인해 주세요.</p>
          <span className="pp-sr" role="status">{doneName ? `${doneName} ${doneLabel}` : ''}</span>
        </footer>
      </div>
    </div>
  );
}
