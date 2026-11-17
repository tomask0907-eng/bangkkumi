// 예상 비용: 가격은 "직접 입력 > 웹 검색 시세 > 예상" 순서로 정하고, 어디서 온 가격인지 항상 표시한다
import { won } from '../catalog.js';
import { shopLinks } from '../shop.js';
import { PriceInput } from './inputs.jsx';
import Icon from './Icons.jsx';
import { PRODUCT_SOURCES } from '../products.js';
import { productTitle } from '../state.js';

const BADGE = {
  user: ['badge badge-accent', '직접 입력', '내가 적은 가격이에요'],
  web: ['badge badge-outline', '웹 검색 시세', 'AI가 웹 검색 결과에서 찾은 가격대예요'],
  est: ['badge', '예상', '시연용 예상 가격이에요'],
};
// 평면도에 없는 가구도 합계에는 들어간다. 왜 평면도에 없는지 줄에 표시한다
const OFF = {
  unplaced: ['못 놓음', '놓을 자리를 찾지 못한 가구예요. 합계에는 들어 있어요'],
  new: ['배치 전', '다시 추천받으면 평면도에 놓여요. 합계에는 들어 있어요'],
};
const day = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`; };

function Row({ row, onPrice, onReset }) {
  const from = row.product && PRODUCT_SOURCES[row.product.src]; // 실제 상품이면 가격 출처 문구
  const [cls, text, tip] = row.source === 'product' ? ['badge badge-outline', from.label, from.note] : BADGE[row.source];
  const web = row.web;
  const shown = row.product ? productTitle(row.product) : row.name; // 상품은 브랜드를 넣은 전체 이름
  const off = row.off && <span className={`badge${row.off === 'unplaced' ? ' badge-warn' : ''}`} style={{ marginLeft: row.product ? 0 : 5 }} title={OFF[row.off][1]}>{OFF[row.off][0]}</span>;
  return (
    <div className="cost-row cost-item" data-source={row.source}>
      <span className="cost-name" title={shown}>
        {shown}
        {row.ai && <span className="badge badge-ai" style={{ marginLeft: 5 }}>AI 추정</span>}
        {!row.product && off /* 상품은 이름이 길어 말줄임에 가려지므로 아랫줄에 둔다 */}
      </span>
      <PriceInput value={row.price} isUser={row.source === 'user'} label={`${row.name} 가격(원)`} onCommit={(v) => onPrice(row, v)} onReset={() => onReset(row)} />
      <span className="cost-meta">
        {row.product && off}
        <span className={`${cls} tooltip`} data-tip={tip}>{text}</span>
        {row.product && (
          <a className="btn btn-link" href={row.product.url} target="_blank" rel="noopener noreferrer" title={`${row.product.src === 'ikea' ? '이케아' : '다나와'}의 '${row.product.name}' 상품 페이지 열기`}>상품 페이지<Icon name="ext" /></a>
        )}
        {shopLinks(row.query).map((l) => (
          <a key={l.id} className="btn btn-link" href={l.url} target="_blank" rel="noopener noreferrer" title={`${l.label}에서 '${row.query}' 찾아보기`}>{l.label}<Icon name="ext" /></a>
        ))}
      </span>
      {row.product && (row.product.warn || row.product.note || row.source === 'user') && (
        <span className="cost-meta cost-web">
          {row.product.warn && <span className="badge badge-warn">{row.product.warn}</span>}
          {row.product.note && <span>{row.product.note}</span>}
          {row.source === 'user' && <span>{from.label}는 {won(row.auto.price)}</span>}
        </span>
      )}
      {web && (
        <span className="cost-meta cost-web">
          <span>{row.source === 'web' ? '' : '웹 검색 시세는 '}{row.webOff || web.low >= web.high ? won(web.typical) : `${won(web.low)} ~ ${won(web.high)}`}</span>
          {web.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>출처 {i + 1}</a>)}
          {day(web.checkedAt) && <span>{day(web.checkedAt)} 조사</span>}
          {row.webOff && row.source === 'est' && <span className="cost-off">예상과 차이가 커서 합계에는 넣지 않았어요. 맞는 가격이면 가격 칸에 적어 주세요.</span>}
        </span>
      )}
    </div>
  );
}

export default function CostTable({ rows, propRows, styleName, budget, withProps, onWithProps, onPrice, onReset, priceBusy, priceMsg, onResearch, canResearch }) {
  const sum = (list) => list.reduce((a, r) => a + r.price, 0);
  const total = sum(rows) + (withProps ? sum(propRows) : 0);
  const left = budget - total;
  const pct = budget > 0 ? Math.round((total / budget) * 100) : 100;
  const userCount = [...rows, ...propRows].filter((r) => r.source === 'user').length;
  const offCount = [...rows, ...propRows].filter((r) => r.webOff && r.source === 'est').length; // 찾았지만 합계에 쓰지 않은 웹 시세
  return (
    <section className="card" aria-labelledby="r3">
      <div className="card-head">
        <h3 className="card-title" id="r3">예상 비용</h3>
        <span className="tooltip tip-end" data-tip={canResearch ? 'AI가 웹 검색으로 실제 가격대를 다시 알아봐요' : '가구를 먼저 적어 주세요'}>
          <button className={`btn btn-sm${priceBusy ? ' is-loading' : ''}`} type="button" onClick={onResearch} disabled={!canResearch || priceBusy}>
            {priceBusy ? <span className="spinner" /> : <Icon name="search" />}시세 다시 조사
          </button>
        </span>
      </div>
      <div className="advice-tip cost-tip"><span className="advice-tip-title">실제 가격으로 맞추기</span>오늘의집에서 실제 가격을 확인한 뒤 가격 칸에 적으면 합계가 바로 바뀌어요.</div>
      {priceBusy && <div className="alert price-busy" role="status"><span className="spinner" style={{ marginTop: 3 }} /><span>웹에서 시세를 조사하고 있어요… 20~60초쯤 걸려요. 그동안은 예상 가격으로 보여 드려요.</span></div>}
      {!priceBusy && priceMsg && <p className="note price-msg" role="status">{priceMsg}{offCount > 0 && ` 예상과 차이가 큰 ${offCount}개는 합계에 넣지 않고 참고로만 보여 드려요.`}</p>}

      {/* 합계는 이 묶음 안에서 패널 아래에 붙어 다닌다(.cost-sum sticky): 어느 줄의 가격을 고치든 합계가 같이 보인다 */}
      <div className="cost-body">
        {rows.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>가구를 적으면 가격이 나와요.</p> : (
          <div className="cost">{rows.map((r) => <Row key={r.id} row={r} onPrice={onPrice} onReset={onReset} />)}</div>
        )}
        <div className={`cost cost-group${withProps ? '' : ' is-off'}`}>
          <div className="sub-label" style={{ margin: '8px 0 2px' }}>
            {styleName} 스타일 추천 소품
            <label className="switch"><input type="checkbox" checked={withProps} onChange={(e) => onWithProps(e.target.checked)} /><span className="switch-track" />합계에 넣기</label>
          </div>
          {propRows.map((r) => <Row key={r.id} row={r} onPrice={onPrice} onReset={onReset} />)}
        </div>

        <div className={`cost-sum${left < 0 ? ' is-over' : ''}`} aria-live="polite">
          <div className="cost-sum-row cost-total"><span>합계</span><b>{won(total)}</b></div>
          <div className={`progress${left < 0 ? ' is-error' : pct >= 90 ? ' is-warn' : ''}`} style={{ '--value': Math.min(100, pct) }} role="img" aria-label={left < 0 ? '예산을 넘었어요' : `예산의 ${pct}%를 썼어요`} />
          <div className="cost-sum-row"><span>예산 {won(budget)}</span><span className="cost-left">{left < 0 ? `${won(-left)} 넘었어요` : `${won(left)} 남아요`}</span></div>
        </div>
      </div>
      {left < 0 && <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}><Icon name="alert" /><span><strong>예산을 넘었어요.</strong> 가구를 빼거나 예산을 올리거나, 소품을 합계에서 빼 보세요.</span></div>}
      <p className="note">
        <b>예상</b>은 시연용 예상 가격, <b>웹 검색 시세</b>는 AI가 웹 검색 결과에서 찾은 가격대, <b>직접 입력</b>은 내가 적은 가격이에요{userCount ? ` (지금 ${userCount}개)` : ''}.{rows.some((r) => r.product) && <> <b>다나와 최저가</b>는 2026년 11월 17일에 조사한 값(배송비 제외, 가장 싼 옵션 기준), <b>이케아 공식가</b>는 2026년 11월에 조사한 값이에요.</>} 실제 가격과 다를 수 있어요. 쇼핑몰 버튼은 검색 화면으로 가는 링크예요. 실제 상품의 [상품 페이지]는 그 상품 페이지로 가요.
      </p>
    </section>
  );
}
