// 결과 패널(배치, 비용, 리포트) 확인용. 뼈대가 연결되기 전에 시안과 같은 틀 안에서 본다.
// 실행: BK_CACHE=node_modules/.vite-v3result npx vite --port 5193 --strictPort → /src/v3/result-harness.html?panel=layout|cost|report
// 주소 옵션: state=empty|error|over|busy|offline|owned|product|unplaced|ai|stale|aierror|pricebusy, style=<프리셋 키>, old(새 props 없이)
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './panels-result.css';
import { normalizeRoom, checkLayout, recommend, explain } from '../layout.js';
import { STYLE_PRESETS, parseFurnitureText, priceOf } from '../catalog.js';
import { fallbackAdvice } from '../advice.js';
import { priceKey, propKey, resolvePrice } from '../state.js';
import { paletteVars } from './symbols.jsx';
import Ic from './Ic.jsx';
import { ScorePanel, IssuesPanel, PalettePanel } from '../components/ScorePanel.jsx';
import CostTable from '../components/CostTable.jsx';
import AdvicePanel from '../components/AdvicePanel.jsx';

const q = new URLSearchParams(window.location.search);
const panel = q.get('panel') || 'layout';
const state = q.get('state') || '';

const html = await (await fetch('/index.html')).text();
const sprite = html.match(/<svg[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<symbol[\s\S]*?<\/svg>/);
if (sprite) document.getElementById('sprite').innerHTML = sprite[0];

const ROOM = normalizeRoom({ width: 400, depth: 300, height: 240, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 110, size: 140 }] });
const TEXT = state === 'unplaced' ? '퀸 침대, 책상 1600, 옷장, 옷장, 책장, 소파, 식탁, 러그, 서랍장, 책장' : '슈퍼싱글 침대, 책상 1200, 옷장, 책장, 러그';
const PRODUCT = { id: '12345678', src: 'danawa', name: '모션데스크 1200 전동 높이조절 책상 화이트', brand: '데스커', type: '책상', w: 120, d: 60, h: 118, price: 28700, warn: '치수 확인', note: '상판 두께 2.5cm', url: 'https://prod.danawa.com/info/?pcode=12345678', image: '' };
const IKEA = { id: '00000001', src: 'ikea', name: 'MALM 말름 침대프레임', brand: '이케아', type: '침대', w: 120, d: 209, h: 100, price: 199000, warn: '', note: '', url: 'https://www.ikea.com/kr/ko/p/malm-00000001/', image: '' };

function Harness() {
  const style = STYLE_PRESETS[q.get('style') || 'nordic'];
  const [budget, setBudget] = useState(state === 'over' ? 600000 : 1000000);
  const [withProps, setWithProps] = useState(true);
  const [userPrices, setUserPrices] = useState({});
  const [selected, setSelected] = useState('');
  const specs = useMemo(() => parseFurnitureText(TEXT).specs.map((sp, i) => {
    let out = { ...sp, uid: `u${i}` };
    if (state === 'product' && i === 1) out = { ...out, name: PRODUCT.name, product: PRODUCT };
    if (state === 'product' && i === 0) out = { ...out, name: IKEA.name, product: IKEA };
    if (state === 'owned' && i === 2) out = { ...out, owned: true };
    if (i === 3 && state !== 'product') out = { ...out, source: 'ai' };
    return out;
  }), []);
  const layout = useMemo(() => {
    if (state === 'empty') return null;
    const r = recommend(ROOM, specs, 0);
    if (state === 'error' && r.items.length > 1) { const [a, b, ...rest] = r.items; return { ...r, items: [a, { ...b, x: a.x + 10, y: a.y + 10 }, ...rest] }; }
    return r;
  }, [specs]);
  const items = layout?.items ?? [];
  const unplaced = layout?.unplaced ?? [];
  const hasItems = items.length > 0;
  const check = useMemo(() => checkLayout(ROOM, items), [items]);
  const webPrices = state === 'pricebusy' || state === 'offline' ? {} : {
    '슈퍼싱글 침대': { query: '슈퍼싱글 침대', low: 259000, high: 319000, typical: 289000, sources: [{ title: '가', url: 'https://example.com/a' }, { title: '나', url: 'https://example.com/b' }, { title: '다', url: 'https://example.com/c' }], checkedAt: '2026-11-17T05:00:00Z' },
    '책장': { query: '책장', low: 900000, high: 990000, typical: 950000, sources: [{ title: '가', url: 'https://example.com/a' }], checkedAt: '2026-11-17T05:00:00Z' },
  };
  const up = state === 'empty' || !specs[1] ? {} : { [priceKey(specs[1])]: 129000, ...userPrices };
  const placed = new Set(items.map((i) => i.uid)), un = new Set(unplaced.map((u) => u.uid));
  const rows = state === 'empty' ? [] : specs.map((sp) => ({
    id: sp.uid, key: priceKey(sp), name: sp.name, query: sp.query, ai: sp.source === 'ai', product: sp.product, owned: sp.owned === true, spec: q.has('nospec') ? undefined : sp,
    off: !layout || placed.has(sp.uid) ? '' : un.has(sp.uid) ? 'unplaced' : 'new',
    ...resolvePrice({ key: priceKey(sp), est: sp.product ? sp.product.price : priceOf(sp, style), query: sp.query, product: sp.product }, up, webPrices),
  }));
  const propRows = style.props.map((p) => ({ id: propKey(p), key: propKey(p), name: p.name, query: p.query, ...resolvePrice({ key: propKey(p), est: p.price, query: p.query }, up, webPrices) }));
  const localAdvice = hasItems ? fallbackAdvice({ room: ROOM, style, items, issues: check.issues, score: check.score, facts: explain(ROOM, items) }) : null;
  const adviceState = { ai: 'ai', busy: 'busy', stale: 'stale', aierror: 'error' }[state] || 'basic';
  const offline = state === 'offline';
  const bare = q.has('old'); // 옛 구조처럼 새 props 없이
  const body = panel === 'cost' ? (
    <CostTable
      rows={rows} propRows={propRows} styleName={style.name} budget={budget} withProps={withProps} onWithProps={setWithProps}
      onPrice={(row, v) => setUserPrices((p) => ({ ...p, [row.key]: v }))} onReset={(row) => setUserPrices((p) => ({ ...p, [row.key]: undefined }))}
      priceBusy={state === 'pricebusy'} priceMsg={state === 'over' ? '5개 중 2개의 웹 검색 시세를 찾았어요. 못 찾은 것은 예상 가격 그대로예요.' : ''} onResearch={() => {}} canResearch={rows.length > 0 && !offline}
      {...(bare ? {} : { onBudget: setBudget, offline, palette: style.palette })}
    />
  ) : panel === 'report' ? (
    <>
      <PalettePanel style={style} />
      <AdvicePanel advice={localAdvice} state={adviceState} error={state === 'aierror' ? '서버에 연결하지 못했어요.' : ''} hasItems={hasItems} onRetry={() => {}} {...(bare ? {} : { offline })} />
    </>
  ) : (
    <>
      <ScorePanel score={check.score} errors={check.issues.filter((i) => i.level === 'error').length} unplaced={unplaced.length} noWindows={false} hasItems={hasItems} variantLabel="배치안 1" />
      <IssuesPanel issues={check.issues} unplaced={unplaced} hasItems={hasItems} onSelect={setSelected} />
    </>
  );
  const T = { layout: ['배치', '배치안 1의 점수와 검사 결과예요.'], cost: ['비용', '실제 가격을 칸에 적으면 합계가 바로 바뀌어요.'], report: ['리포트', '색상 팔레트와 AI 설명을 보고 내보내요.'] }[panel];
  return (
    <div className="app" data-cat={panel} style={paletteVars(style.palette)}>
      <header className="topbar"><span className="brand"><span className="logo"><svg><use href="#i-logo" /></svg></span>방꾸미</span><span className="sp" /></header>
      <nav className="rail" />
      <section className="panel on" aria-label={panel}>
        <div className="panel-h"><h2>{T[0]}</h2><p>{T[1]}</p></div>
        <div className="panel-b">{body}</div>
        {panel === 'report' && <div className="panel-f"><button className="btn" type="button"><Ic name="download" />파일로 받기</button><button className="btn primary" type="button"><Ic name="open" />SketchUp에서 열기</button></div>}
      </section>
      <main className="stage"><pre id="dump" style={{ margin: 16, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify({ selected, budget, withProps, userPrices }, null, 1)}</pre></main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
