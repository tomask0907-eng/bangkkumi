// 가구 패널 본문(v3 "커머스 클린"): 글로 적기 → 빠른 추가(한 줄 + 더 보기) → [실제 상품에서 고르기][사진·링크로 추가] → 알아본 가구 줄(두 줄)
// 기존 props: text, specs, truncated, priceOfSpec, onText, onParse, onQuick, onEdit, onRemove, onPrice, onPriceReset, onBrowse, onFind
// 새 props(없어도 그려진다):
//   onOwned(uid, owned)  — "이미 있어요" 스위치. 없으면 스위치를 그리지 않는다
//   onAddRef(input)      — 사진·링크로 추가. input 은 { url } 또는 { file }. Promise 를 돌려주고 실패하면 한국어 문구가 든 Error 로 거절된다. 없으면 상자를 그리지 않는다
//   refEnabled           — 서버에 사진·링크 기능이 있을 때 true. true 가 아니면 상자를 끄고 안내만 보여 준다
//   palette              — 고른 스타일의 5색(선택). 없으면 가구 그림이 바깥(.app)의 --c1~--c5 를 쓴다
import { useEffect, useRef, useState } from 'react';
import { NumInput, PriceInput } from './inputs.jsx';
import { productTitle } from '../state.js';
import { won } from '../catalog.js'; // 가격은 천 원 단위로 줄이지 않고 원 단위까지 보여 준다(비용 표와 같은 금액)
import Ic from '../v3/Ic.jsx';
import { FurnitureThumb } from '../v3/symbols.jsx';
import { PRODUCT_SOURCES, productCategoryOf } from '../products.js';

const QUICK_SHOW = 3; // 접혀 있을 때 보이는 칩 수. 나머지는 [더 보기]
const QUICK = ['침대', '책상', '옷장', '책장', '서랍장', '소파', '식탁', 'TV', '냉장고', '러그', '화분', '전신거울'];
const PRICE_TIP = { user: '직접 입력한 가격', web: '웹 검색 시세', est: '시연용 예상 가격' };
const MAX = 15;
const https = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : '');
const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '');

// 가구 그림: 실제 상품이면 상품 사진, 못 불러오면 평면도와 같은 그림
function Thumb({ sp, palette }) {
  const [broken, setBroken] = useState(false);
  const image = !broken && https(sp.product?.image);
  if (image) return <span className="th th-photo" aria-hidden="true"><img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} /></span>;
  return <FurnitureThumb spec={sp} palette={palette} />;
}

// "사진·링크로 추가" 상자. 기다림과 오류는 이 상자가 가진다
function RefBox({ onAddRef, enabled, full, hidden, onBusy }) {
  const [url, setUrl] = useState('');
  const [wait, setWait] = useState(''); // '' | 'photo' | 'link'
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const fileRef = useRef(null);
  const off = !enabled || full || !!wait;

  const run = (kind, input) => {
    setError('');
    setNote('');
    setWait(kind);
    onBusy?.(true);
    Promise.resolve().then(() => onAddRef(input)).then(
      (got) => {
        if (kind === 'link') setUrl('');
        if (got?.spec?.name) setNote(`'${got.spec.name}' 줄을 아래 목록에 넣었어요.${typeof got.note === 'string' && got.note ? ` ${got.note}` : ''}`);
      },
      (e) => setError(e?.message || '가구를 만들지 못했어요. 잠시 뒤 다시 해 주세요.'),
    ).finally(() => { setWait(''); onBusy?.(false); });
  };
  const addLink = () => {
    const u = url.trim();
    if (!u) { setError('상품 링크를 붙여 넣어 주세요.'); return; }
    if (!/^https:\/\/\S+\.\S+/.test(u)) { setError('https:// 로 시작하는 상품 주소를 넣어 주세요.'); return; }
    run('link', { url: u });
  };
  const addFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('사진 파일(JPG, PNG 등)만 올릴 수 있어요.'); return; }
    run('photo', { file });
  };

  return (
    <div className="ai-box ref-box" id="fi-ref-box" hidden={hidden} aria-busy={wait ? true : undefined}>
      {!enabled ? (
        <p className="hint">이 기능은 PC에서 실행할 때만 돼요. 지금은 글로 적거나 실제 상품에서 골라 주세요.</p>
      ) : (
        <>
          <div className="ai-make">
            <input
              className="input sm" type="url" inputMode="url" maxLength={500} placeholder="상품 링크 붙여넣기 (https://…)" aria-label="상품 링크"
              value={url} disabled={off} onChange={(e) => { setUrl(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            />
            <button className="btn sm primary" type="button" disabled={off} onClick={addLink}><Ic name="plus" className="s" />추가</button>
          </div>
          <div className="ref-row">
            <button className="btn sm" type="button" disabled={off} onClick={() => fileRef.current?.click()}><Ic name="upload" className="s" />가구 사진 올리기</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; addFile(f); }} />
            <span className="hint">AI가 치수·가격·색을 어림해요</span>
          </div>
          {wait && <div className="wait" role="status"><span className="spin" />{wait === 'photo' ? 'AI가 사진을 보고 있어요…' : 'AI가 링크를 보고 있어요…'} 20~40초쯤 걸려요</div>}
          {!wait && error && <p className="ref-err" role="alert"><Ic name="warn" className="s" />{error}</p>}
          {!wait && !error && note && <p className="hint ref-note" role="status"><Ic name="check" className="s" />{note}</p>}
          {!wait && !error && !note && full && <p className="hint">가구가 {MAX}개라서 더 넣을 수 없어요. 하나를 빼고 다시 해 주세요.</p>}
        </>
      )}
    </div>
  );
}

export default function FurnitureInput({
  text, specs = [], truncated, priceOfSpec, onText, onParse, onQuick, onEdit, onRemove, onPrice, onPriceReset, onBrowse, onFind,
  onOwned, onAddRef, refEnabled, palette,
}) {
  const [openUid, setOpenUid] = useState(null);
  const [refOpen, setRefOpen] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newUid, setNewUid] = useState(null);
  const listRef = useRef(null);
  const prevLen = useRef(specs.length);
  const full = specs.length >= MAX;

  // 가구가 한 개 늘면(상품 담기, 사진·링크, 빠른 추가) 새 줄이 보이게 목록을 내리고 잠깐 표시한다
  useEffect(() => {
    const grew = specs.length === prevLen.current + 1;
    prevLen.current = specs.length;
    if (!grew) return;
    setNewUid(specs[specs.length - 1]?.uid ?? null);
    listRef.current?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }, [specs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="sec">
        <textarea
          id="furniture-text" className="textarea" rows={2} maxLength={600} aria-label="필요한 가구 적기" title="쉼표로 나눠 적어요. 크기(책상 1400)와 개수(옷장 2개)도 쓸 수 있어요"
          placeholder="예: 슈퍼싱글 침대, 책상 1400, 옷장 2개, 전자피아노"
          value={text} onChange={(e) => onText(e.target.value)} onBlur={onParse}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onParse(); } }}
        />
        <div className={`quick fq${moreOpen ? ' is-all' : ''}`} role="group" aria-label="자주 쓰는 가구 바로 넣기">
          {(moreOpen ? QUICK : QUICK.slice(0, QUICK_SHOW)).map((name) => <button key={name} className="btn sm" type="button" onClick={() => onQuick(name)}><Ic name="plus" className="s" />{name}</button>)}
          <button className="btn sm fq-more" type="button" aria-expanded={moreOpen} title={moreOpen ? '빠른 추가를 접어요' : `자주 쓰는 가구 ${QUICK.length - QUICK_SHOW}개를 더 보여 줘요`} onClick={() => setMoreOpen(!moreOpen)}>{moreOpen ? '접기' : '더 보기'}</button>
          <button className="btn sm soft fq-go" type="button" onClick={onParse} title="글 칸에서 Ctrl + Enter를 눌러도 돼요">가구 알아보기</button>
        </div>
        {truncated && <p className="ref-err" role="alert"><Ic name="warn" className="s" />가구는 한 번에 {MAX}개까지만 알아봐요. 뒤에 적은 가구는 빠졌어요.</p>}

        <div className="fi-add">
          <button className="btn primary fi-pick pick-cta" type="button" onClick={onBrowse} title="파는 상품의 실제 치수와 가격으로 놓아 봐요"><Ic name="cube" className="s" />실제 상품에서 고르기</button>
          {onAddRef && (
            <button className="btn soft ref-toggle" type="button" aria-expanded={refOpen} aria-controls="fi-ref-box" title="상품 링크나 가구 사진으로 가구를 추가해요" onClick={() => setRefOpen(!refOpen)}>
              {refBusy ? <span className="spin" /> : <Ic name="spark" className="s" />}사진·링크로 추가
            </button>
          )}
        </div>
        {onAddRef && <RefBox onAddRef={onAddRef} enabled={refEnabled === true} full={full} hidden={!refOpen} onBusy={setRefBusy} />}
      </div>

      <div className="sec">
        <div className="sec-h"><h3>알아본 가구</h3><span className="meta">{specs.length ? `${specs.length}개 · 가로 × 깊이 × 높이(cm)` : '0개'}</span></div>
        {specs.length === 0 ? (
          <div className="empty-msg">
            <span className="ico"><Ic name="sofa" className="l" /></span>
            <b>아직 알아본 가구가 없어요</b>
            <span>위 칸에 가구 이름을 적거나 실제 상품에서 골라 주세요.</span>
          </div>
        ) : (
          <div className="fi-list" ref={listRef}>
            {specs.map((sp) => {
              const wait = !!sp._wait;
              const check = sp.source === 'default' && !wait;
              const open = !wait && openUid === sp.uid;
              const p = priceOfSpec(sp);
              const pr = sp.product; // 실제 상품이면 조사한 치수를 그대로 보여 주고 고치지 못하게 한다
              const ref = sp.ref && (sp.ref.kind === 'photo' || sp.ref.kind === 'link') ? sp.ref : null;
              const owned = sp.owned === true;
              const tint = hex(sp.tint);
              const canFind = !wait && !pr && !!productCategoryOf(sp);
              const edit = (patch) => onEdit(sp.uid, patch);
              const dim = (key, label, min, max) => (
                <NumInput className="" value={sp[key]} min={min} max={max} disabled={wait} aria-label={`${sp.name} ${label}(cm)`} onCommit={(v) => edit({ [key]: v })} />
              );
              const aiBadge = <span className="badge ai" title="AI가 크기와 가격을 어림했어요. 치수와 가격을 확인해 주세요"><Ic name="spark" />AI 추정</span>;
              return (
                <div key={sp.uid} className={`item fi${check ? ' pending' : ''}${owned ? ' is-owned' : ''}${open ? ' is-open' : ''}${newUid === sp.uid ? ' is-new' : ''}`} aria-busy={wait || undefined}>
                  <Thumb sp={sp} palette={palette} />
                  <div className="fi-main">
                    <div className="nm">
                      <span className="fi-name" title={sp.name}>{sp.name}</span>
                      {wait && <span className="badge ai"><span className="spin" />AI가 찾는 중</span>}
                      {!wait && !pr && !ref && sp.source === 'ai' && aiBadge}
                      {check && <span className="badge check">치수 확인</span>}
                      {pr && <span className="badge ok" title={PRODUCT_SOURCES[pr.src]?.note}>실제 상품</span>}
                      {wait ? <b className="price is-wait">확인 중</b> : (
                        <button
                          className="price" type="button" aria-expanded={open} onClick={() => setOpenUid(open ? null : sp.uid)}
                          title={`${p.source === 'product' ? PRODUCT_SOURCES[pr?.src]?.note || '' : PRICE_TIP[p.source] || ''}${owned ? ' · 이미 있어서 합계에서 빠져요' : ''} · 누르면 ${pr ? '가격을' : '이름과 가격을'} 고칠 수 있어요`}
                        >{won(p.price)}</button>
                      )}
                      {canFind && <button className="iconbtn fi-ib" type="button" aria-label={`${sp.name} 실제 상품 찾기`} title="크기가 비슷한 실제 상품 찾기" onClick={() => onFind(sp)}><Ic name="cube" className="s" /></button>}
                      {!canFind && <span className="iconbtn fi-ib is-gap" aria-hidden="true" />}
                      <button className="iconbtn fi-ib" type="button" aria-label={`${sp.name} 빼기`} title="빼기" onClick={() => onRemove(sp.uid)}><Ic name="x" className="s" /></button>
                    </div>
                    {pr && (
                      <div className="sub fi-prod">
                        <span className="fi-ellip" title={productTitle(pr)}>{productTitle(pr)}</span>
                        <button className="linkbtn" type="button" onClick={() => onFind(sp)}>다른 상품으로 바꾸기</button>
                      </div>
                    )}
                    <div className="fi-l2">
                      {pr
                        ? <div className="dims fi-real" title={`실제 치수 ${pr.w} × ${pr.d} × ${pr.h} cm (가로 × 깊이 × 높이)`}>실제 <b className="num">{pr.w} × {pr.d} × {pr.h}</b> cm</div>
                        : <div className="dims">{dim('w', '가로', 10, 400)}×{dim('d', '깊이', 10, 400)}×{dim('h', '높이', 1, 300)}</div>}
                      {!wait && onOwned && <button className="switch sm" type="button" role="switch" aria-checked={owned} aria-label={`${sp.name} 이미 있어요`} title="이미 갖고 있는 가구는 평면도에는 놓이고 합계에서 빠져요" onClick={() => onOwned(sp.uid, !owned)}>이미 있어요</button>}
                    </div>
                    {pr && (pr.warn || pr.note) && <div className="sub">{pr.warn && <span className="badge check" style={{ marginRight: 6 }}>{pr.warn}</span>}{pr.note}</div>}
                    {wait && <div className="sub rowx"><span className="spin" />임시 크기예요. AI가 치수를 알아보고 있어요.</div>}
                    {check && <div className="sub">임시 크기예요. 실제 치수로 고쳐 주세요.</div>}
                    {ref && !wait && (
                      <div className="sub rowx">
                        {aiBadge}
                        {tint && <i className="fi-tint" style={{ background: tint }} title={`대표 색 ${tint}`} />}
                        {ref.kind === 'photo' ? '사진으로 추가' : '링크로 추가'}
                        {https(ref.url) && <a href={https(ref.url)} target="_blank" rel="noopener noreferrer">링크 열기</a>}
                      </div>
                    )}
                  </div>
                  {open && (
                    <div className="wide fi-edit">
                      {!pr && (
                        <label className="field"><span>이름</span>
                          <input
                            className="input sm" type="text" maxLength={30} aria-label={`${sp.name} 이름`} defaultValue={sp.name} key={sp.name}
                            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== sp.name) edit({ name: v }); else e.target.value = sp.name; }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          />
                        </label>
                      )}
                      <div className="field"><span>가격{owned ? ' (합계에서 빠져요)' : ''}</span>
                        <PriceInput small value={p.price} isUser={p.source === 'user'} label={`${sp.name} 가격(원)`} onCommit={(v) => onPrice(sp, v)} onReset={() => onPriceReset(sp)} />
                      </div>
                      {canFind && <button className="linkbtn fi-find" type="button" onClick={() => onFind(sp)}><Ic name="cube" className="s" />크기가 비슷한 실제 상품 찾기</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {full && <p className="hint fi-full">가구는 {MAX}개까지 넣을 수 있어요.</p>}
      </div>
    </>
  );
}
