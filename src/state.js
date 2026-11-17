// 화면 상태의 기본값, 저장·복원, 가격 계산, 서버 요청 도구 (App.jsx가 쓴다)
import { normalizeRoom } from './layout.js';
import { STYLE_PRESETS, parseFurnitureText, defaultSpec, validateSpec, validateStyle, cleanName } from './catalog.js';
import { cleanQuery, httpsUrl } from './shop.js';
import { productIn } from './products.js';

const KEY = 'bangkkumi-v2';
export const PRICE_MAX = 50_000_000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let seq = 0;
export const newUid = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

export const blank = () => ({
  room: normalizeRoom({ width: 300, depth: 400, height: 240, windows: [{ wall: 'top', offset: 50, size: 100 }] }),
  styleKey: 'minimal',
  budget: 1_000_000, // 원
  text: '', // 가구 입력 칸의 글
  parsedText: '', // 마지막으로 해석한 글 (같은 글을 다시 해석하지 않게)
  withProps: true, // 소품을 합계에 넣을지
  showWalk: true,
  specs: [], // 알아본 가구: spec + uid + _id(글에서 온 정체) + _txt(글에 쓸 이름) + _wait(AI가 찾는 중)
  customStyles: [],
  layout: null, // { items, unplaced, variant, sig }
  userPrices: {}, // 직접 입력한 가격 { 가격 키: 원 }
  webPrices: {}, // 웹 검색 시세 { 검색어: { low, high, typical, sources, checkedAt } }
  advice: null, // { data, sig } AI가 쓴 설명과 그때의 배치
});

/* ───────── 가구 글 해석 ───────── */
// 글을 다시 해석하되, 이미 있던 가구(고친 치수·AI 추정값)는 그대로 둔다
const MAX_SPECS = 15;
// 실제 상품에서 고른 가구: _id가 'product|<상품 번호>'
export const isPicked = (sp) => typeof sp?._id === 'string' && sp._id.startsWith('product|');
// 사진이나 링크로 추가한 가구: _id가 'ref|<uid>'
export const isRef = (sp) => typeof sp?._id === 'string' && sp._id.startsWith('ref|');
// 글에서 오지 않은 가구(실제 상품, 사진·링크로 추가): 글을 다시 해석해도 남고 글 칸에는 들어가지 않는다
export const isKept = (sp) => isPicked(sp) || isRef(sp);
export function mergeParsed(text, prev) {
  const { specs, unknown, truncated } = parseFurnitureText(text);
  // 실제 상품에서 고른 가구는 글에 없어도 남긴다. 합쳐서 15개를 넘으면 글에서 온 가구를 뒤에서부터 줄인다
  const picked = prev.filter(isKept).slice(0, MAX_SPECS);
  const room = MAX_SPECS - picked.length;
  const pool = prev.filter((p) => !isKept(p));
  const take = (id) => {
    const i = pool.findIndex((p) => p._id === id);
    return i < 0 ? null : pool.splice(i, 1)[0];
  };
  return {
    truncated: truncated || specs.length + unknown.length > room,
    specs: [
      ...specs.slice(0, room).map((sp) => {
        const id = `${sp.key}|${sp.name}`;
        return take(id) || { ...sp, uid: newUid(), _id: id, _txt: sp.name.replace(/ \(\d+\)$/, '') };
      }),
      ...unknown.slice(0, Math.max(0, room - specs.length)).map((name) => {
        const id = `?|${name}`;
        return take(id) || { ...defaultSpec(name), uid: newUid(), _id: id, _txt: name, _wait: true };
      }),
      ...picked,
    ],
  };
}
export const textOf = (specs) => specs.filter((s) => !isKept(s)).map((s) => s._txt || s.name).join(', '); // 실제 상품은 글에 넣지 않는다
// 평면도에 놓인 가구의 치수를 바꿀 때 등 쪽 변을 제자리에 둔다(아래·오른쪽 벽에 붙은 가구가 얕아져도 벽에서 떨어지지 않게).
// 등은 rot 0 위, 90 오른쪽, 180 아래, 270 왼쪽. 위·왼쪽은 왼쪽 위 좌표가 그대로라 손댈 것이 없다
export const keepBack = (old, next) => (old.rot === 180 ? { ...next, y: old.y + old.d - next.d } : old.rot === 90 ? { ...next, x: old.x + old.d - next.d } : next);

/* ───────── 가격: 직접 입력 > 웹 검색 시세 > 예상 ───────── */
export const priceKey = (spec) => (spec.product ? `product|${spec.product.id}` : `${spec.key}|${spec.name}`);
export const propKey = (prop) => `prop|${prop.name}`;
// 화면에 보여 줄 상품 전체 이름: 이름에 브랜드가 없을 때만 앞에 붙인다
export const productTitle = (p) => (p.brand && !p.name.includes(p.brand) ? `${p.brand} ${p.name}` : p.name);
// 웹 시세가 예상의 이 배수를 벗어나면 다른 물건을 읽었을 수 있다고 보고 합계에 넣지 않는다 (참고값)
export const WEB_BAND = [0.4, 2.5];
// 객체에 원래 있는 이름('constructor' 등)이 가구 이름·검색어로 들어와도 저장한 값만 읽는다
const own = (obj, key) => (key != null && Object.hasOwn(obj, key) ? obj[key] : undefined);
// row: { key, est, query } → { price, source: 'user' | 'web' | 'est', auto: { price, source }, web, webOff }
// webOff: 웹 시세가 있지만 예상과 차이가 커서 참고로만 보여 주는 경우
export function resolvePrice(row, userPrices, webPrices) {
  if (row.product) {
    // 실제 상품: 조사해 둔 상품 가격을 쓴다(스타일 배수도 곱하지 않는다). 웹 검색 시세는 쓰지 않고, 직접 입력한 가격이 있으면 그것이 먼저다
    const auto = { price: row.product.price, source: 'product' };
    const typed = own(userPrices, row.key);
    return { ...(Number.isFinite(typed) ? { price: typed, source: 'user' } : auto), auto, web: null, webOff: false };
  }
  const web = own(webPrices, cleanQuery(row.query)) || null;
  const webOff = !!web && row.est > 0 && (web.typical < row.est * WEB_BAND[0] || web.typical > row.est * WEB_BAND[1]);
  const auto = web && !webOff ? { price: web.typical, source: 'web' } : { price: row.est, source: 'est' };
  const user = own(userPrices, row.key);
  return { ...(Number.isFinite(user) ? { price: user, source: 'user' } : auto), auto, web, webOff };
}
// 좁은 칸에 쓰는 짧은 금액: 320000 → '32만원', 59000 → '5만 9천원'
export function shortWon(n) {
  const v = Math.round(n / 1000);
  const man = Math.floor(v / 10), chun = v % 10;
  if (!man) return `${Math.round(n).toLocaleString('ko-KR')}원`;
  return `${man.toLocaleString('ko-KR')}만${chun ? ` ${chun}천` : ''}원`;
}

/* ───────── 저장·복원 ───────── */
// 저장된 값은 믿지 않는다: 하나씩 검증하고, 틀리면 기본값을 쓴다
const TINT = /^#[0-9a-f]{6}$/i;
// 사진·링크로 추가한 가구의 출처: 종류는 두 가지뿐이고 주소는 https 만 남긴다
function refIn(o) {
  if (!o || (o.kind !== 'photo' && o.kind !== 'link')) return null;
  const url = httpsUrl(o.url);
  return url ? { kind: o.kind, url } : { kind: o.kind };
}
const EXTRA = (o) => ({
  uid: cleanName(o.uid, 40) || newUid(),
  _id: typeof o._id === 'string' ? o._id.slice(0, 120) : '',
  _txt: cleanName(o._txt, 40) || cleanName(o.name),
  ...(o._wait === true && { _wait: true }),
  ...(o.source === 'user' && { source: 'user' }), // 사용자가 치수를 고친 가구
  ...(o.owned === true && { owned: true }), // 이미 갖고 있는 가구: 합계와 예산 계산에서 뺀다
  ...(typeof o.tint === 'string' && TINT.test(o.tint) && { tint: o.tint.toLowerCase() }), // 사진·링크에서 읽은 대표 색
  ...(refIn(o.ref) && { ref: refIn(o.ref) }),
});
// 합계에 넣을 금액: 이미 갖고 있는 가구(owned)는 0원으로 센다
export const sumRows = (rows) => rows.reduce((a, r) => a + (r.owned ? 0 : r.price), 0);
function specIn(o) {
  const sp = validateSpec(o);
  if (!sp) return null;
  const extra = EXTRA(o);
  const p = productIn(o.product); // 주소 허용 목록·글자 길이·숫자 범위를 다시 확인한다
  // 가구의 폭·깊이가 상품 치수와 다르면(손댄 저장값) 상품으로 보지 않는다. 높이는 보지 않는다(모션데스크는 앉는 높이로 낮춰 놓는다)
  const product = p && Math.round(p.w) === sp.w && Math.round(p.d) === sp.d ? p : null;
  if (product) return { ...sp, ...extra, _id: `product|${product.id}`, product };
  return isPicked(extra) ? { ...sp, ...extra, _id: `${sp.key}|${sp.name}` } : { ...sp, ...extra }; // 상품 정보가 깨졌으면 상품 정보만 떼고 일반 가구로 둔다
}
function itemIn(o) {
  const sp = specIn(o);
  if (!sp || !Number.isFinite(o.x) || !Number.isFinite(o.y) || ![0, 90, 180, 270].includes(o.rot)) return null;
  return { ...sp, x: clamp(o.x, -400, 1900), y: clamp(o.y, -400, 1900), rot: o.rot };
}
export function webIn(o) {
  const out = {};
  for (const [q, v] of Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 200)) {
    if (!v || !Number.isFinite(v.typical) || v.typical < 0 || v.typical > PRICE_MAX) continue;
    out[q] = {
      typical: v.typical,
      low: Number.isFinite(v.low) ? v.low : v.typical,
      high: Number.isFinite(v.high) ? v.high : v.typical,
      sources: (Array.isArray(v.sources) ? v.sources : []).map((s) => ({ title: cleanName(s?.title, 60), url: httpsUrl(s?.url) })).filter((s) => s.url).slice(0, 3),
      checkedAt: typeof v.checkedAt === 'string' ? v.checkedAt.slice(0, 30) : '',
    };
  }
  return out;
}
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
export function adviceIn(o) {
  const a = { summary: str(o?.summary, 400), reasons: (Array.isArray(o?.reasons) ? o.reasons : []).map((r) => str(r, 400)).filter(Boolean).slice(0, 20), styling: str(o?.styling, 500), props: str(o?.props, 400) };
  return a.summary ? a : null;
}

export function load() {
  const base = blank();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || raw.v !== 2) return base;
    const customStyles = (Array.isArray(raw.customStyles) ? raw.customStyles : []).map(validateStyle).filter((s) => s && !Object.hasOwn(STYLE_PRESETS, s.key)).slice(0, 6);
    const rawSpecs = Array.isArray(raw.specs) ? raw.specs : [];
    const specs = rawSpecs.map(specIn).filter(Boolean).slice(0, 15);
    // 상품 정보가 떨어져 일반 가구가 된 것이 있으면 글을 목록에서 다시 만든다(글에 없으면 다시 해석할 때 사라진다)
    const demoted = rawSpecs.filter(isPicked).length > specs.filter(isPicked).length;
    const L = raw.layout;
    const items = Array.isArray(L?.items) ? L.items.map(itemIn).filter(Boolean).slice(0, 15) : null;
    const adv = adviceIn(raw.advice?.data);
    return {
      ...base,
      room: normalizeRoom(raw.room),
      styleKey: typeof raw.styleKey === 'string' && (Object.hasOwn(STYLE_PRESETS, raw.styleKey) || customStyles.some((s) => s.key === raw.styleKey)) ? raw.styleKey : base.styleKey,
      budget: Number.isFinite(raw.budget) ? clamp(Math.round(raw.budget), 0, 100_000_000) : base.budget,
      text: demoted ? textOf(specs) : str(raw.text, 600),
      parsedText: demoted ? textOf(specs) : str(raw.parsedText, 600),
      withProps: raw.withProps !== false,
      showWalk: raw.showWalk !== false,
      specs,
      customStyles,
      layout: items ? {
        items,
        unplaced: (Array.isArray(L.unplaced) ? L.unplaced : []).map(specIn).filter(Boolean).slice(0, 15),
        variant: Number.isInteger(L.variant) && L.variant >= 0 ? L.variant : 0,
        sig: str(L.sig, 20000),
      } : null,
      userPrices: Object.fromEntries(Object.entries(raw.userPrices && typeof raw.userPrices === 'object' ? raw.userPrices : {})
        .filter(([, v]) => Number.isFinite(v) && v >= 0 && v <= PRICE_MAX).slice(0, 300)),
      webPrices: webIn(raw.webPrices),
      advice: adv ? { data: adv, sig: str(raw.advice.sig, 20000) } : null,
    };
  } catch {
    return base; // 깨진 저장값이면 처음 상태로
  }
}

export function save(state) {
  const data = JSON.stringify({ v: 2, ...state });
  try {
    localStorage.setItem(KEY, data);
  } catch {
    // 저장 공간이 모자라면(큰 DWG 밑그림) 밑그림만 빼고 다시 저장한다
    try {
      const { underlay, ...room } = state.room;
      localStorage.setItem(KEY, JSON.stringify({ v: 2, ...state, room }));
    } catch { /* 저장을 못 해도 화면은 계속 쓸 수 있다 */ }
  }
}
export const clearSaved = () => { try { localStorage.removeItem(KEY); } catch { /* 무시 */ } };

/* ───────── 서버 요청: 항상 시간 제한과 쉬운 오류 문구 ───────── */
export async function postJson(url, body, timeoutMs) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new Error(e?.name === 'TimeoutError' ? '응답이 너무 오래 걸려요. 잠시 뒤에 다시 해 보세요.' : '서버에 연결하지 못했어요.');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error((typeof j?.error === 'string' && j.error) || '요청을 처리하지 못했어요.');
  }
  return res;
}

// 서버로 보낼 방: DWG 밑그림(수천 줄)은 빼고 보낸다
export const roomOut = ({ width, depth, height, doors, windows }) => ({ width, depth, height, doors, windows });
// 서버로 보낼 가구: 규약에 있는 값만
export const itemOut = ({ uid, key, name, category, w, d, h, clear, tall, sideOk, floor, price, color, query, source, x, y, rot }) =>
  ({ uid, key, name, category, w, d, h, clear, tall, sideOk, floor, price, color, query, source: source === 'user' ? 'catalog' : source, x, y, rot });
