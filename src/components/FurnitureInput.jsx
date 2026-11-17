// ④ 가구: 글로 적으면 바로 알아보고, 알아본 가구는 한 줄씩 고칠 수 있다
import { useState } from 'react';
import { NumInput, PriceInput } from './inputs.jsx';
import { shortWon, productTitle } from '../state.js';
import { won } from '../catalog.js'; // 실제 상품 가격은 천 원 단위로 줄이지 않고 원 단위까지 보여 준다(비용 표와 같은 금액)
import Icon from './Icons.jsx';
import { PRODUCT_SOURCES, productCategoryOf } from '../products.js';

const QUICK = ['침대', '책상', '옷장', '책장', '서랍장', '소파', '식탁', 'TV', '냉장고', '러그', '화분', '전신거울'];
const PRICE_TIP = { user: '직접 입력한 가격', web: '웹 검색 시세', est: '시연용 예상 가격' };

export default function FurnitureInput({ text, specs, truncated, priceOfSpec, onText, onParse, onQuick, onEdit, onRemove, onPrice, onPriceReset, onBrowse, onFind }) {
  const [openUid, setOpenUid] = useState(null);
  return (
    <>
      <label className="field">
        <span className="field-label">필요한 가구를 적어 주세요</span>
        <textarea
          id="furniture-text" className="textarea" rows={2} maxLength={600} placeholder="예: 슈퍼싱글 침대, 책상 1400, 옷장 2개, 전자피아노"
          value={text} onChange={(e) => onText(e.target.value)} onBlur={onParse}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onParse(); } }}
        />
        <span className="field-hint">쉼표로 나눠 적으면 바로 알아봐요. 크기(책상 1400)와 개수(옷장 2개)도 쓸 수 있어요.</span>
      </label>
      <div className="quick-row">
        {/* 두 버튼을 나란히 두면 좁은 패널(1366px 화면에서 288px)에 Ctrl Enter 표시가 들어가지 않아서 말풍선으로 옮겼다 */}
        <button className="btn btn-sm" type="button" onClick={onParse} title="글 칸에서 Ctrl + Enter를 눌러도 돼요"><Icon name="search" />가구 인식</button>
        <button className="btn btn-sm btn-soft grow" type="button" onClick={onBrowse} title="다나와·이케아에서 조사한 실제 상품 1만여 개에서 골라요"><Icon name="cube" />실제 상품에서 고르기</button>
      </div>
      <div className="quick-chips" role="group" aria-label="자주 쓰는 가구 바로 넣기">
        {QUICK.map((name) => <button key={name} className="chip" type="button" onClick={() => onQuick(name)}><Icon name="plus" style={{ width: 10, height: 10 }} />{name}</button>)}
      </div>
      {truncated && <p className="field-error" role="alert">가구는 한 번에 15개까지만 알아봐요. 뒤에 적은 가구는 빠졌어요.</p>}

      <div className="sub-label">알아본 가구 <span className="badge">{specs.length}</span>{specs.length > 0 && <span>치수를 누르면 고칠 수 있어요</span>}</div>
      {specs.length === 0 ? (
        <div className="empty spec-empty"><p>아직 알아본 가구가 없어요.<br />위 칸에 가구 이름을 적어 주세요.</p></div>
      ) : (
        <div className="spec-list">
          {specs.map((sp) => {
            const check = sp.source === 'default' && !sp._wait;
            const open = !sp._wait && (openUid === sp.uid || check);
            const p = priceOfSpec(sp);
            const pr = sp.product; // 실제 상품이면 조사한 치수를 그대로 보여 주고 고치지 못하게 한다
            const edit = (patch) => { setOpenUid(sp.uid); onEdit(sp.uid, patch); };
            return (
              <div key={sp.uid} className={`spec${check ? ' is-check' : ''}${open ? ' is-open' : ''}`} aria-busy={sp._wait || undefined}>
                <i className="spec-dot" style={{ background: sp._wait ? 'var(--line-strong)' : sp.color }} />
                <div className="spec-main">
                  <div className="spec-name">
                    <span>{sp.name}</span>
                    {sp._wait && <span className="badge badge-ai"><span className="spinner" style={{ width: 9, height: 9, borderWidth: 1.5 }} />AI가 찾는 중</span>}
                    {!sp._wait && sp.source === 'ai' && <span className="badge badge-ai tooltip" data-tip="AI가 크기와 가격을 어림했어요"><Icon name="sparkle" />AI 추정</span>}
                    {check && <span className="badge badge-warn">치수 확인</span>}
                    {pr && <span className="badge badge-accent" title={PRODUCT_SOURCES[pr.src].note}>실제 상품</span>}
                  </div>
                  {sp._wait ? <span className="skeleton" style={{ width: 110, height: 9, marginTop: 4 }} />
                    : check ? <span className="field-hint">임시 크기예요. 실제 치수로 고쳐 주세요.</span>
                      : pr ? (
                        <>
                          <span className="field-hint spec-product" title={productTitle(pr)}>{productTitle(pr)}</span>
                          <button className="spec-dims" type="button" aria-expanded={open} title="실제 상품 치수라서 고칠 수 없어요. 누르면 가격을 고칠 수 있어요" onClick={() => setOpenUid(open ? null : sp.uid)}>
                            실제 치수 {pr.w} × {pr.d} × {pr.h} cm
                          </button>
                          {/* 주의 배지는 이름 줄에 두면 좁은 패널에서 이름이 가려져서 아랫줄에 둔다 */}
                          {(pr.warn || pr.note) && <span className="field-hint">{pr.warn && <span className="badge badge-warn" style={{ marginRight: 5 }}>{pr.warn}</span>}{pr.note}</span>}
                        </>
                      ) : (
                        // [실제 상품 찾기]는 치수 옆에 둔다(따로 한 줄을 쓰면 1366×768 화면에서 예시 가구 4개가 다 보이지 않는다)
                        <span className="spec-line">
                          <button className="spec-dims" type="button" aria-expanded={open} onClick={() => setOpenUid(open ? null : sp.uid)}>
                            {sp.w} × {sp.d} × {sp.h} cm
                          </button>
                          {productCategoryOf(sp) && <button className="btn btn-link" type="button" onClick={() => onFind(sp)}>실제 상품 찾기</button>}
                        </span>
                      )}
                  {pr && <button className="btn btn-link" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => onFind(sp)}>다른 상품으로 바꾸기</button>}
                </div>
                <span className={`spec-price${sp._wait ? ' muted' : ''}`} title={p.source === 'product' ? PRODUCT_SOURCES[pr.src].note : PRICE_TIP[p.source]}>{sp._wait ? '—' : pr ? won(p.price) : shortWon(p.price)}</span>
                <button className="btn btn-ghost btn-icon btn-sm" type="button" aria-label={`${sp.name} 빼기`} onClick={() => onRemove(sp.uid)}><Icon name="x" /></button>
                {open && (
                  <div className="spec-edit">
                    {!pr && <>
                    <input
                      className="input input-sm spec-rename" type="text" maxLength={30} aria-label={`${sp.name} 이름`} defaultValue={sp.name} key={sp.name}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== sp.name) edit({ name: v }); else e.target.value = sp.name; }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    />
                    <span className="input-group"><NumInput className="input input-sm" value={sp.w} min={10} max={400} aria-label={`${sp.name} 폭(cm)`} onCommit={(v) => edit({ w: v })} /><span className="input-unit">폭</span></span>
                    <span className="input-group"><NumInput className="input input-sm" value={sp.d} min={10} max={400} aria-label={`${sp.name} 깊이(cm)`} onCommit={(v) => edit({ d: v })} /><span className="input-unit">깊이</span></span>
                    <span className="input-group"><NumInput className="input input-sm" value={sp.h} min={1} max={300} aria-label={`${sp.name} 높이(cm)`} onCommit={(v) => edit({ h: v })} /><span className="input-unit">높이</span></span>
                    </>}
                    <PriceInput small value={p.price} isUser={p.source === 'user'} label={`${sp.name} 가격(원)`} onCommit={(v) => onPrice(sp, v)} onReset={() => onPriceReset(sp)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
