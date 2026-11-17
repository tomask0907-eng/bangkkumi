// 집 전체 꾸미기(home.html)의 저장과 계산. 방마다 방꾸미 저장값을 따로 간직하고, 지금 꾸미는 방 하나만 메인(bangkkumi-v2)에 올린다.
// 메인은 화면을 떠날 때 지금 방을 저장한다. 그래서 방을 바꾸는 일은 이 화면에서만 한다(들어올 때 받아 두고, 나갈 때 올린다).
import { normalizeRoom } from './layout.js';
import { STYLE_PRESETS, priceOf } from './catalog.js';
import { blank, load, save, clearSaved, priceKey, propKey, resolvePrice, sumRows } from './state.js';

const KEY = 'bangkkumi-home';
export const MAX_ROOMS = 12; // 사용자가 더할 수 있는 방 수
const KEEP = 40; // 저장값에서 읽는 방 수의 끝. 메인에서 꾸미던 방을 받아 둘 때는 MAX_ROOMS를 넘을 수 있다(잃는 것보다 낫다)
let seq = 0;
const newId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

// 방 표시: 메인에 올릴 때 저장값의 userPrices에 'home|<방 id>': 0 을 심는다. 메인의 load·save를 지나도 남는 자리이고,
// 가구·소품의 가격 키와 겹치지 않아서 메인의 계산에는 쓰이지 않는다. 메인이 무엇을 저장했든 이 표시로 어느 방 것인지 안다
// (뒤로 가기로 되살아난 옛 화면이나 다른 탭이 저장해도 방끼리 섞이지 않는다).
const MARK = 'home|';
const prices = (st) => (st.userPrices && typeof st.userPrices === 'object' ? st.userPrices : {});
const markOf = (st) => Object.keys(prices(st)).find((k) => k.startsWith(MARK))?.slice(MARK.length) ?? null;
const unmarked = (st) => ({ ...st, userPrices: Object.fromEntries(Object.entries(prices(st)).filter(([k]) => !k.startsWith(MARK))) });
const marked = (st, id) => ({ ...st, userPrices: { ...unmarked(st).userPrices, [MARK + id]: 0 } });
const same = (a, b) => JSON.stringify(unmarked(a)) === JSON.stringify(unmarked(b));

// 메인 화면에 보여 줄 방 목록과 지금 방(HomeLink.jsx가 쓴다). 지금 방은 메인이 들고 있는 상태의 방 표시로 찾는다.
// 목록은 메인 화면이 떠 있는 동안 바뀌지 않아서(방을 더하고 빼는 일은 home.html에서만 한다) 한 번만 읽는다. 그릴 때마다 읽으면 느리다
let listed = null;
export function homeRooms(st) {
  listed ??= (readHome()?.rooms ?? []).map(({ id, name }) => ({ id, name }));
  const id = markOf(st);
  return { rooms: listed, current: listed.some((r) => r.id === id) ? id : null };
}

// 방 하나에 드는 돈. 메인의 비용 패널과 같은 계산이다(App.jsx의 rows, propRows, total).
// 가구가 없는 방은 아직 꾸미지 않은 방으로 보고 0원으로 센다(메인은 이때도 소품 값을 보여 준다).
export function costOf(st) {
  try {
    if (!st.specs.length) return { count: 0, furniture: 0, props: 0, total: 0 };
    const style = [...st.customStyles, ...Object.values(STYLE_PRESETS)].find((x) => x.key === st.styleKey) || STYLE_PRESETS.minimal;
    const rows = st.specs.map((sp) => ({
      owned: sp.owned === true,
      ...resolvePrice({ key: priceKey(sp), est: sp.product ? sp.product.price : priceOf(sp, style), query: sp.query, product: sp.product }, st.userPrices, st.webPrices),
    }));
    const furniture = sumRows(rows);
    const props = st.withProps ? style.props.reduce((a, p) => a + resolvePrice({ key: propKey(p), est: p.price, query: p.query }, st.userPrices, st.webPrices).price, 0) : 0;
    const total = furniture + props;
    return Number.isFinite(total) ? { count: st.specs.length, furniture, props, total } : null;
  } catch {
    return null; // 손댄 저장값이라 계산하지 못하면 금액 없이 보여 준다
  }
}

// 저장된 값은 믿지 않는다: 모양이 맞는 방만 남긴다. 방 안의 저장값은 메인이 열 때 한 번 더 검증한다(state.js의 load).
export function readHome() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || !Array.isArray(raw.rooms)) return null;
    const seen = new Set();
    const rooms = raw.rooms
      .filter((r) => r && typeof r.id === 'string' && r.id.length <= 40 && !seen.has(r.id) && seen.add(r.id) && r.state && typeof r.state === 'object' && Array.isArray(r.state.specs))
      .slice(0, KEEP)
      // v는 뗀다: 메인의 save가 { v: 2, ...state }로 적어서, 손댄 v가 남아 있으면 메인이 그 방을 빈 방으로 읽는다
      .map(({ id, name, state: { v: _v, ...st } }) => ({ id, name: String(name ?? '').slice(0, 20) || '방', state: { ...st, room: normalizeRoom(st.room) } }));
    return { rooms, active: rooms.some((r) => r.id === raw.active) ? raw.active : null };
  } catch {
    return null; // 깨진 값이면 처음부터
  }
}

// 저장한다. 다 저장했으면 true, 저장 공간이 모자라서 도면 밑그림을 빼고 저장했으면 'trimmed', 못 했으면 false.
export function writeHome(home) {
  // 큰 DWG 밑그림부터 뺀다: 먼저 메인에 올라가 있는 방 것만(메인 저장값에 그대로 있다), 그래도 안 되면 모든 방 것
  const strip = (all) => ({ ...home, rooms: home.rooms.map((r) => (all || r.id === home.active ? { ...r, state: { ...r.state, room: { ...r.state.room, underlay: null } } } : r)) });
  for (const [make, result] of [[() => home, true], [() => strip(false), 'trimmed'], [() => strip(true), 'trimmed']]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(make()));
      return result;
    } catch { /* 다음 방법으로 */ }
  }
  return false;
}

// 이 화면에 들어올 때, 그리고 방을 바꾸기 바로 전에 부른다. 메인의 지금 내용을 제 방에 받아 둔다.
export function openHome() {
  const cur = load();
  const home = readHome() || { rooms: [], active: null };
  const id = markOf(cur);
  let next;
  if (home.rooms.some((r) => r.id === id)) {
    // 방 표시가 있다: 그 방의 최신 내용으로 받아 둔다
    next = { rooms: home.rooms.map((r) => (r.id === id ? { ...r, state: unmarked(cur) } : r)), active: id };
  } else if (same(cur, blank())) {
    // 메인이 비어 있다(아직 안 썼거나 [처음부터]를 눌렀다). 간직한 방은 건드리지 않는다
    next = { ...home, active: null };
  } else {
    // 표시가 없는 내용(이 화면을 쓰기 전부터 꾸미던 방, [예시 불러오기])은 어느 방에도 덮어쓰지 않는다. 같은 방이 이미 있으면 그 방, 없으면 새 방으로 간직한다
    const twin = home.rooms.find((r) => same(r.state, cur));
    const nid = twin ? twin.id : newId();
    next = { rooms: twin ? home.rooms : [...home.rooms, { id: nid, name: '지금 꾸미던 방', state: unmarked(cur) }], active: nid };
    save(marked(cur, nid));
  }
  writeHome(next);
  return next;
}

// 평면도에서 고른 방들([{ label, room }])을 목록에 더한다. 방마다 새 저장값(기본 스타일·예산, 가구 없음)으로 시작한다.
export function addRooms(home, list) {
  const rooms = [...home.rooms];
  for (const { label, room } of list) {
    if (rooms.length >= MAX_ROOMS) break;
    const base = blank();
    let n = rooms.length + 1;
    while (rooms.some((r) => r.name === `방 ${n}`)) n++; // 이름 없는 방은 번호가 겹치지 않게
    rooms.push({ id: newId(), name: String(label ?? '').slice(0, 20) || `방 ${n}`, state: { ...base, room: normalizeRoom({ ...base.room, ...room, underlay: null }) } });
  }
  return { ...home, rooms };
}

// 고른 방을 메인에 올린다. 이 다음에 메인(./)으로 가면 그 방이 열린다.
export function openRoom(home, id) {
  const room = home.rooms.find((r) => r.id === id);
  if (!room) return home;
  save(marked(room.state, id));
  const next = { ...home, active: id };
  writeHome(next);
  return next;
}

// 방을 목록에서 뺀다. 지금 메인에 올라가 있는 방이면 메인의 저장값도 비운다(다음에 들어올 때 다시 생기지 않게).
export function removeRoom(home, id) {
  if (home.active === id) clearSaved();
  return { rooms: home.rooms.filter((r) => r.id !== id), active: home.active === id ? null : home.active };
}
