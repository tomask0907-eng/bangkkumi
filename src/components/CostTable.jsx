// 비용 패널: 합계 카드(예산) → 가구 줄 → 소품 줄 → 가격 출처 안내.
// 가격은 "직접 입력 > 웹 검색 시세(또는 실제 상품 가격) > 예상" 순서로 정하고, 어디서 온 가격인지 항상 표시한다.
// 합계 카드는 패널 위에 붙어 다닌다(.budget sticky): 어느 줄의 가격을 고치든 합계가 같이 보인다.
//
// 새로 받는 props(없어도 동작한다):
//   onBudget(원)   예산 바꾸기. 없으면 예산을 글로만 보여 준다
//   offline        서버가 없는 곳(공개 사이트)이면 true. 웹 시세 조사를 끄고 안내를 한 번만 보여 준다
//   palette        가구 그림에 입힐 스타일 5색(style.palette). 없으면 바깥(.app)의 색을 쓴다
//   rows[].owned   이미 있는 가구(true면 합계에서 빼고 "보유"로 표시)
//   rows[].spec    가구 사양(가구 그림을 고르는 데 쓴다. 없으면 이름으로 고른다)
import { useState } from 'react';
import { won } from '../catalog.js';
import { shopLinks } from '../shop.js';
import { NumInput, PriceInput } from './inputs.jsx';
import Ic from '../v3/Ic.jsx';
import { FurnitureThumb } from '../v3/symbols.jsx';
import { PRODUCT_SOURCES } from '../products.js';
import { productTitle } from '../state.js';

const BADGE = {
  user: ['mine', '직접 입력', '내가 적은 가격이에요'],
  web: ['web', '웹 검색 시세', 'AI가 웹 검색 결과에서 찾은 가격대예요'],
  est: ['', '예상', '시연용 예상 가격이에요'],
};
// 평면도에 없는 가구도 합계에는 들어간다. 왜 평면도에 없는지 줄에 표시한다
const OFF = {
  unplaced: ['못 놓음', '놓을 자리를 찾지 못한 가구예요. 합계에는 들어 있어요.'],
  new: ['배치 전', '다시 추천받으면 평면도에 놓여요. 합계에는 들어 있어요.'],
};
const day = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`; };
const num = (n) => Math.round(n).toLocaleString('ko-KR');
const eun = (w) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '은' : '는'); // 받침이 있으면 '은'

// 줄 맨 앞의 그림: 실제 상품은 상품 사진(못 받으면 가구 그림), 그 밖에는 가구 그림
function Thumb({ row, palette }) {
  const [broken, setBroken] = useState(false);
  const img = row.product?.image;
  if (img && !broken) {
    return <span className="th photo" aria-hidden="true"><img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /></span>;
  }
  // 가격 줄의 key 는 "<가구 종류>|<이름>" 이라 사양이 없어도 종류를 알 수 있다
  const spec = row.spec || { name: row.name, key: row.product ? '' : String(row.key || '').split('|')[0] };
  return <FurnitureThumb spec={spec} palette={palette} />;
}

function Row({ row, open, onToggle, onPrice, onReset, searching, palette }) {
  const from = row.product && PRODUCT_SOURCES[row.product.src]; // 실제 상품이면 가격 출처 문구
  const [cls, text, tip] = row.source === 'product' ? ['web', from?.label || '실제 상품', from?.note || ''] : BADGE[row.source] || BADGE.est;
  const web = row.web;
  const owned = row.owned === true;
  const shown = row.product ? productTitle(row.product) : row.name; // 상품은 브랜드를 넣은 전체 이름
  const isUser = row.source === 'user';
  const auto = row.auto || { price: row.price, source: row.source };
  const autoName = auto.source === 'product' ? from?.label || '상품 가격' : auto.source === 'web' ? '웹 검색 시세' : '예상 가격';
  const range = web && (row.webOff || web.low >= web.high ? won(web.typical) : `${num(web.low)} ~ ${won(web.high)}`);
  const sources = Array.isArray(web?.sources) ? web.sources : [];
  const links = shopLinks(row.query);
  return (
    <div className={`crow${open ? ' open' : ''}${owned ? ' is-owned' : ''}`} data-source={row.source}>
      <div className="item">
        <Thumb row={row} palette={palette} />
        <div>
          <div className="nm" title={shown}>{shown}</div>
          <div className="sub rowx">
            {owned
              ? <span className="badge own" title="이미 있는 가구라 합계에서 빠져요">보유</span>
              : searching ? <span className="badge ai"><span className="spin" />시세 찾는 중</span>
                : <span className={`badge${cls ? ` ${cls}` : ''}`} title={tip}>{text}</span>}
            {isUser && (
              <button type="button" className="iconbtn undo" aria-label={`${row.name} 가격을 ${autoName} ${won(auto.price)}으로 되돌리기`} title={`${autoName}(${won(auto.price)})으로 되돌리기`} onClick={() => onReset(row)}>
                <Ic name="undo" className="s" />
              </button>
            )}
            {row.ai && !isUser && <span className="badge ai">AI 추정</span>}
            {row.off && OFF[row.off] && <span className={`badge${row.off === 'unplaced' ? ' check' : ''}`} title={OFF[row.off][1]}>{OFF[row.off][0]}</span>}
            {owned && <span className="own-t">합계에서 빠져요</span>}
          </div>
        </div>
        <span className={`cprice${isUser ? ' mine' : ''}`}>
          {/* 되돌리기 버튼은 위의 배지 옆에 따로 둔다(isUser 를 넘기지 않는다). 칸을 비우면 자동 가격으로 돌아간다 */}
          <PriceInput value={row.price} label={`${row.name} 가격(원)`} onCommit={(v) => onPrice(row, v)} onReset={() => onReset(row)} />
        </span>
        <button type="button" className="iconbtn more" aria-label={`${row.name} 시세와 쇼핑 링크`} aria-expanded={open} onClick={onToggle}><Ic name="right" className="s" /></button>
      </div>
      {open && (
        <div className="cdetail">
          {owned && <div>이미 있는 가구라 <b>합계와 예산 계산에서 빠져요.</b> 평면도에는 그대로 놓여요.</div>}
          {row.product && (
            <div>
              <b>{shown}</b>
              <div className="cd-line">
                {tip}
                {row.product.warn && <> <span className="badge check">{row.product.warn}</span></>}
                {row.product.note && <> {row.product.note}</>}
              </div>
            </div>
          )}
          {isUser && <div>{autoName}{eun(autoName)} <b>{won(auto.price)}</b>이었어요. 직접 적은 가격으로 계산해요.</div>}
          {!row.product && !web && !isUser && (
            searching
              ? <div>웹에서 시세를 찾고 있어요. 그동안은 예상 가격 <b>{won(row.price)}</b>으로 계산해요.</div>
              : <div>시연용 예상 가격이에요. 실제 판매 가격은 쇼핑몰에서 확인해 주세요.</div>
          )}
          {web && (
            <div>
              웹에서 찾은 가격은 <b>{range}</b>이에요.
              {(sources.length > 0 || day(web.checkedAt)) && (
                <span className="cd-src">
                  {sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>출처 {i + 1}</a>)}
                  {day(web.checkedAt) && <span>{day(web.checkedAt)} 조사</span>}
                </span>
              )}
              {row.webOff && row.source === 'est' && <div className="cd-off">예상과 차이가 커서 합계에는 넣지 않았어요. 맞는 가격이면 가격 칸에 적어 주세요.</div>}
            </div>
          )}
          {row.off && OFF[row.off] && <div>{OFF[row.off][1]}</div>}
          {(row.product || links.length > 0) && (
            <div className="shops">
              {row.product && (
                <a className="page" href={row.product.url} target="_blank" rel="noopener noreferrer" title={`${row.product.src === 'ikea' ? '이케아' : '다나와'}의 '${row.product.name}' 상품 페이지 열기`}>상품 페이지<Ic name="link" /></a>
              )}
              {links.map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" title={`${l.label}에서 '${row.query}' 찾아보기`}>{l.label}<Ic name="link" /></a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CostTable({
  rows = [], propRows = [], styleName = '', budget = 0, withProps = false, onWithProps, onPrice, onReset, onBudget,
  priceBusy = false, priceMsg = '', onResearch, canResearch = false, offline = false, palette,
}) {
  const [openId, setOpenId] = useState(undefined); // 처음에는 첫 줄을 펼쳐 둔다(쇼핑 링크가 있다는 것이 보이게). 한 번에 한 줄만 펼친다
  const sum = (list) => list.reduce((a, r) => a + (r.owned === true ? 0 : r.price), 0);
  const buy = rows.filter((r) => r.owned !== true);
  const ownedCount = rows.length - buy.length;
  const rowsTotal = sum(rows), propsTotal = sum(propRows);
  const total = rowsTotal + (withProps ? propsTotal : 0);
  const left = budget - total;
  const over = left < 0;
  const pct = budget > 0 ? Math.round((total / budget) * 100) : total > 0 ? 100 : 0;
  const all = [...rows, ...propRows];
  const userCount = all.filter((r) => r.source === 'user').length;
  const offCount = all.filter((r) => r.webOff && r.source === 'est').length; // 찾았지만 합계에 쓰지 않은 웹 시세
  const top = [...buy, ...(withProps ? propRows : [])].sort((a, b) => b.price - a.price)[0]; // 가장 비싼 줄
  const shownOpen = openId === undefined ? rows[0]?.id ?? null : openId;
  const toggle = (id) => setOpenId(shownOpen === id ? null : id);
  // 지금 웹 시세를 찾고 있을 만한 줄: 조사 중이고, 아직 웹 시세가 없는 예상 가격 줄
  const searching = (r, on = true) => on && priceBusy && !offline && r.source === 'est' && !r.web && !r.product && r.owned !== true;
  const has = (src) => rows.some((r) => r.product?.src === src);
  const man = Math.round(budget / 10000);
  const row = (r, on) => (
    <Row key={r.id} row={r} open={shownOpen === r.id} onToggle={() => toggle(r.id)} onPrice={onPrice} onReset={onReset} searching={searching(r, on)} palette={palette} />
  );
  return (
    <div className="cost-panel">
      <div className={`budget${over ? ' is-over' : ''}`} aria-live="polite">
        <div className="top">
          <span>예상 합계</span>
          <span>가구 {buy.length}{withProps && propRows.length > 0 && ` · 소품 ${propRows.length}`}{ownedCount > 0 && ` · 보유 ${ownedCount}개는 빼고`}</span>
        </div>
        <div className="total num">{num(total)}<small>원</small></div>
        <span className={`bar${over ? ' over' : ''}`} role="img" aria-label={over ? '예산을 넘었어요' : `예산의 ${pct}%를 썼어요`}><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
        <div className="bot">
          <b className={`num${over ? ' over' : ''}`}>{over ? `${won(-left)} 넘었어요` : `${won(left)} 남아요`}</b>
          {onBudget
            ? <label>예산 <NumInput className="num" value={man} min={0} max={10000} step={10} aria-label="예산(만원)" onCommit={(v) => onBudget(v * 10000)} /> 만원</label>
            : <span className="num">예산 {won(budget)}</span>}
        </div>
      </div>
      {over && (
        <div className="alert err cost-over" role="alert">
          <Ic name="warn" />
          <div>
            <b>예산을 {won(-left)} 넘었어요</b>
            <p>{top ? `가장 비싼 ${top.name}(${won(top.price)})의 가격을 먼저 확인해 보세요. ` : ''}가구를 빼거나 예산을 올려도 되고, 소품을 합계에서 빼도 돼요.</p>
          </div>
        </div>
      )}

      {/* 웹 시세 조사의 상태: 서버가 없는 곳에서는 안내 한 줄만 보여 준다. [시세 다시 조사] 버튼은 가구 제목 줄에 있다 */}
      {(offline || priceBusy || priceMsg) && (
        <div className="cost-research">
          {offline ? <span className="hint">웹 시세 조사는 PC에서 실행할 때만 돼요. 지금은 예상 가격과 실제 상품 가격으로 보여 드려요.</span>
            : priceBusy ? <span className="loading-line" role="status"><span className="spin" /><span>웹에서 시세를 조사하고 있어요… 20~60초쯤 걸려요. 그동안은 예상 가격으로 보여 드려요.</span></span>
              : <span className="hint" role="status">{priceMsg}{offCount > 0 && ` 예상과 차이가 큰 ${offCount}개는 합계에 넣지 않고 참고로만 보여 드려요.`}</span>}
        </div>
      )}

      <div className="sec cost-sec">
        <div className="sec-h">
          <h3>가구{rows.length > 0 && <span className="meta num">{won(rowsTotal)}</span>}</h3>
          {!offline && (
            <button className="btn sm cost-re" type="button" onClick={onResearch} disabled={!canResearch || priceBusy} title={priceBusy ? '웹에서 시세를 조사하고 있어요' : canResearch ? 'AI가 웹 검색으로 실제 가격대를 다시 알아봐요' : rows.length ? '지금은 조사할 가구가 없거나 조사할 수 없어요' : '가구를 먼저 적어 주세요'}>
              {priceBusy ? <span className="spin" /> : <Ic name="rotate" className="s" />}시세 다시 조사
            </button>
          )}
        </div>
        {rows.length === 0 ? <p className="hint cost-none">가구를 적으면 가격이 나와요.</p> : rows.map((r) => row(r))}
      </div>

      {propRows.length > 0 && (
        <div className={`sec cost-sec cost-props${withProps ? '' : ' is-off'}`}>
          <div className="sec-h">
            <h3 title={`${styleName} 스타일에 어울리는 추천 소품이에요`}>소품<span className="meta num">{withProps ? won(propsTotal) : '합계에서 빠져요'}</span></h3>
            <button type="button" role="switch" className="switch" aria-checked={withProps ? 'true' : 'false'} onClick={() => onWithProps?.(!withProps)}>합계에 넣기</button>
          </div>
          {propRows.map((r) => row(r, withProps))}
        </div>
      )}

      <div className="note cost-note">
        <Ic name="info" />
        <span>
          <b>예상</b>은 시연용 예상 가격, <b>웹 검색 시세</b>는 AI가 웹 검색 결과에서 찾은 가격대, <b>직접 입력</b>은 내가 적은 가격이에요{userCount ? ` (지금 ${userCount}개)` : ''}.
          {has('danawa') && <> <b>다나와 최저가</b>는 2026년 11월 17일에 조사한 값(배송비 제외, 가장 싼 옵션 기준)이에요.</>}
          {has('ikea') && <> <b>이케아 공식가</b>는 2026년 11월에 조사한 값이에요.</>}
          {ownedCount > 0 && <> <b>보유</b>로 표시한 가구는 합계에서 빠져요.</>}
          {' '}실제 가격과 다를 수 있어요. 줄 오른쪽의 화살표를 누르면 쇼핑몰 검색 링크가 나와요{rows.some((r) => r.product) ? '. 실제 상품의 [상품 페이지]는 그 상품 페이지로 가요.' : '.'}
        </span>
      </div>
    </div>
  );
}
