// 방꾸미 v2 배치 엔진. 순수 함수만 있고 외부 import가 없다(브라우저·Node 공용).
// 규칙 번호(H1~H6, S1~S44)와 수치는 docs/interior-knowledge.md를 따른다(구현하며 달라진 점은 그 문서 15절). 모든 길이는 cm, 방 왼쪽 위가 (0, 0).
// 여기 수치는 전부 참고값이다(법적·안전 기준이 아님).

export const AISLE_CM = 60;

const TOUCH = 5; // 이 이하의 틈은 붙은 것으로 본다
const WALL_NEAR = 10; // 등이 벽에 붙었다고 보는 거리
const DEAD_MAX = 50; // 5 초과 50 미만은 쓸 수 없는 죽은 틈
const WIN_NEAR = 60; // 창 벽에서 이 거리 안이면 "창 앞"
const WIN_REACH = 120; // 낮은 가구 너머로 창에 손이 닿는 깊이(규칙집은 100, 슈퍼싱글 폭 110을 넣으려고 넓힘)
const R_LEVELS = [30, 37.5, 45]; // 통로 폭 60 / 75 / 90의 절반
const GRID_SLACK = 2.51; // 5cm 격자에 딱 안 맞는 60cm 통로도 지나가게 하는 여유
const SIDES = ['top', 'right', 'bottom', 'left']; // rot / 90 = 등이 향한 벽 번호
const CATS = ['bed', 'desk', 'storage', 'seating', 'table', 'appliance', 'decor', 'etc'];

const PARTS = [
  { key: 'walk', label: '동선·통로', max: 25 },
  { key: 'use', label: '사용 공간', max: 20 },
  { key: 'light', label: '채광·창문', max: 15 },
  { key: 'rest', label: '침대 자리', max: 12 },
  { key: 'tidy', label: '정돈', max: 12 },
  { key: 'open', label: '개방감·균형', max: 8 },
  { key: 'pair', label: '가구 짝·구역', max: 8 },
];
// 규칙 → [점수 항목 번호, 가중치]. 규칙집 11절
const RULE_DEF = {
  H4: [0, 10], S1: [0, 8], S30: [0, 3], S41: [0, 2],
  S2: [1, 8], S6: [1, 7], S24: [1, 4], S19: [1, 1],
  S26: [2, 9], S12: [2, 8], S27: [2, 5], S28: [2, 4], S13: [2, 2], S29: [2, 3],
  S5: [3, 8], S8: [3, 4], S9: [3, 3], S7: [3, 3], S18: [3, 2],
  S34: [4, 6], S3: [4, 5], S17: [4, 2], S35: [4, 2],
  S37: [5, 4], S31: [5, 4], S16: [5, 3], S36: [5, 2], S42: [5, 2],
  S21: [6, 5], S22: [6, 4], S23: [6, 3], S10: [6, 2], S14: [6, 2], S39: [6, 2], S40: [6, 1], S44: [6, 2],
};
const RULE_IDS = Object.keys(RULE_DEF);
const R = Object.fromEntries(RULE_IDS.map((id, i) => [id, i]));
const NR = RULE_IDS.length;
const R_PART = RULE_IDS.map((id) => RULE_DEF[id][0]);
const R_W = RULE_IDS.map((id) => RULE_DEF[id][1]);
const PART_W = PARTS.map((_, i) => R_W.reduce((s, w, r) => s + (R_PART[r] === i ? w : 0), 0));
// 추천 이유로 먼저 보여 줄 규칙(구체적인 것부터). 여기 없는 규칙은 뒤로 간다
const REASON_ORDER = ['S12', 'S27', 'S5', 'S7', 'S8', 'S9', 'S26', 'S16', 'S31', 'S17', 'S21', 'S22', 'S23', 'S10', 'S44', 'S39', 'S14', 'S24', 'S6', 'S2', 'S19', 'S13', 'S34', 'S42', 'H4'];
const REASON_RANK = RULE_IDS.map((id) => { const i = REASON_ORDER.indexOf(id); return i < 0 ? 99 : i; });

const SUM = new Float64Array(NR), MAX = new Float64Array(NR), CNT = new Uint16Array(NR);

// ───────── 작은 도구 ─────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function fin(v, d) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
}
const ramp = (v, bad, good) => clamp((good - v) / (good - bad), 0, 1); // bad면 1, good이면 0
function tier(v, min, ok, good) { // 최소 미만 1, 최소 0.7, 기본 0.25, 편함 0
  if (v < min) return 1;
  if (v < ok) return 0.7 - (0.45 * (v - min)) / (ok - min);
  if (v < good) return (0.25 * (good - v)) / (good - ok);
  return 0;
}
const plateau = (d, m, M) => (d < m ? 1 - (d / m) ** 2 : d > M ? 1 - (M / d) ** 2 : 0);
const cm = (v) => Math.round(v);

export const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const ovArea = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const cx = (r) => r.x + r.w / 2;
const cy = (r) => r.y + r.h / 2;
// 그 방향 벽까지의 거리. s: 0 위, 1 오른쪽, 2 아래, 3 왼쪽
const wd = (p, s, W, D) => (s === 0 ? p.y : s === 1 ? W - p.x - p.w : s === 2 ? D - p.y - p.h : p.x);

// ───────── 방 ─────────
function fixOpening(o, len, minSize, maxSize, defSize, defWall) {
  const wall = SIDES.includes(o.wall) ? o.wall : defWall;
  const L = len(wall);
  const size = Math.round(clamp(fin(o.size, defSize), Math.min(minSize, L), Math.min(maxSize, L)));
  const offset = Math.round(clamp(fin(o.offset, (L - size) / 2), 0, L - size));
  return { wall, offset, size };
}

// 빠진 값을 채우고 범위를 벗어난 값을 고친다. 구버전 { door, window } 단수 형식도 받는다
export function normalizeRoom(room) {
  const r = room && typeof room === 'object' ? room : {};
  const width = clamp(Math.round(fin(r.width, 300)), 150, 1500);
  const depth = clamp(Math.round(fin(r.depth, 400)), 150, 1500);
  const height = clamp(Math.round(fin(r.height, 240)), 180, 400);
  const len = (wall) => (wall === 'top' || wall === 'bottom' ? width : depth);
  const isObj = (o) => o && typeof o === 'object';
  const rawDoors = (Array.isArray(r.doors) ? r.doors : [r.door]).filter(isObj);
  const doors = rawDoors.map((d, i) => ({
    ...fixOpening(d, len, 60, 150, 90, 'bottom'),
    kind: ['entry', 'bath', 'etc'].includes(d.kind) ? d.kind : i === 0 ? 'entry' : 'etc',
  }));
  if (!doors.length) doors.push({ wall: 'bottom', offset: Math.min(20, width - 90), size: 90, kind: 'entry' });
  const rawWins = (Array.isArray(r.windows) ? r.windows : [r.window]).filter(isObj);
  const windows = rawWins.map((w) => {
    const sill = clamp(fin(w.sill, 90), 0, height - 30);
    return { ...fixOpening(w, len, 30, 1500, 100, 'top'), sill, height: clamp(fin(w.height, 120), 20, height - sill) };
  });
  const out = { width, depth, height, doors, windows };
  if (isObj(r.underlay)) out.underlay = r.underlay;
  return out;
}

function zoneOf(room, d) {
  const { wall, offset: o, size: s } = d;
  if (wall === 'top') return { x: o, y: 0, w: s, h: s };
  if (wall === 'bottom') return { x: o, y: room.depth - s, w: s, h: s };
  if (wall === 'left') return { x: 0, y: o, w: s, h: s };
  return { x: room.width - s, y: o, w: s, h: s };
}

// 문 여는 공간들: 문 폭 × 문 폭 정사각형
export function doorZones(room) {
  const r = normalizeRoom(room);
  return r.doors.map((d) => zoneOf(r, d));
}

// 한 방의 계산에 계속 쓰는 값 묶음
function makeCtx(room0) {
  const room = normalizeRoom(room0);
  const W = room.width, D = room.depth;
  const zones = room.doors.map((d) => zoneOf(room, d));
  const e = room.doors[0], z = zones[0];
  const horiz = e.wall === 'top' || e.wall === 'bottom';
  const m = e.offset + e.size / 2;
  return {
    room, W, D, zones, area: W * D, diag: Math.hypot(W, D),
    entry: { x: horiz ? m : e.wall === 'left' ? 0 : W, y: horiz ? (e.wall === 'top' ? 0 : D) : m },
    entrySide: SIDES.indexOf(e.wall), entrySize: e.size,
    band: horiz ? { x: z.x, y: 0, w: z.w, h: D } : { x: 0, y: z.y, w: W, h: z.h }, // 문 앞 띠
    wins: room.windows.map((w) => ({
      side: SIDES.indexOf(w.wall), a0: w.offset, a1: w.offset + w.size, size: w.size, sill: w.sill, height: w.height, top: w.sill + w.height,
    })),
    doorNames: room.doors.map((d) => (d.kind === 'bath' ? '화장실 문' : d.kind === 'entry' ? '현관문' : '다른 문')),
  };
}

// ───────── 가구 ─────────
const normRot = (r) => (((Math.round(fin(r, 0) / 90) * 90) % 360) + 360) % 360;

// name·key 글자로 역할을 정한다(규칙집 0.4절). spec에 세부 종류가 없기 때문
function roleOf(s) {
  if (s.floor) return 'rug';
  if (s.cat === 'bed') return 'bed';
  if (s.cat === 'desk') return 'desk';
  const n = `${s.name} ${s.key}`.toLowerCase();
  const has = (...ws) => ws.some((w) => n.includes(w));
  if (has('tv', '티비', '텔레비전', '거실장')) return 'tv';
  if (has('냉장고', 'fridge', 'refrigerator')) return 'fridge';
  if (has('협탁', '사이드테이블', '사이드 테이블', 'nightstand')) return 'nightstand';
  if (s.cat === 'storage') {
    if (has('슬라이딩', '미닫이')) return 'sliding';
    if (has('행거', 'hanger')) return 'hanger';
    if (has('옷장', '장롱', '장농', 'wardrobe', 'closet')) return 'wardrobe';
    if (has('서랍', 'dresser', 'drawer')) return 'drawer';
    return 'shelf';
  }
  if (s.cat === 'seating') {
    if (has('소파베드', '소파 베드', 'sofa_bed', 'sofa bed')) return 'sofabed';
    if (has('의자', 'chair', '체어', '스툴') && s.sw <= 70 && !has('안락', '리클라이너', 'recliner', '라운지')) return 'chair';
    return 'sofa';
  }
  if (s.cat === 'table') {
    if (has('화장대', 'vanity')) return 'vanity';
    if (s.sh <= 50 || has('소파', '커피', '좌식', 'coffee')) return 'sofatable';
    return 'table';
  }
  if (s.cat === 'appliance') return 'appliance';
  if (s.cat === 'decor') return 'decor';
  return 'etc';
}
const STORAGE = { wardrobe: 1, sliding: 1, hanger: 1, drawer: 1, shelf: 1 };
const isSeat = (p) => p.role === 'sofa' || p.role === 'sofabed';

// 역할별 앞 사용 공간 [최소, 편함] (규칙집 H5 표)
function clearRange(p) {
  switch (p.role) {
    case 'desk': case 'vanity': return [60, 90];
    case 'wardrobe': return [Math.min(50, p.sw / 2), 90];
    case 'sliding': return [50, 76];
    case 'hanger': case 'shelf': return [40, 76];
    case 'drawer': return [40, 90];
    case 'sofa': return [35, 76];
    case 'sofabed': return [60, p.clear];
    case 'table': return [60, 90];
    case 'fridge': case 'appliance': return [Math.min(50, p.sw), 76];
    default: return [40, 60];
  }
}

// 입력(spec 또는 item)을 계산용 모양으로. 빠진 값은 채운다
function norm(it, i) {
  const s = it && typeof it === 'object' ? it : {};
  const p = {
    src: s, idx: i,
    uid: (s.uid != null && String(s.uid)) || `${typeof s.key === 'string' && s.key ? s.key : 'item'}-${i}`, // String([])처럼 빈 글자가 되는 값도 새로 만든다
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '가구',
    key: typeof s.key === 'string' ? s.key : '',
    cat: CATS.includes(s.category) ? s.category : 'etc',
    sw: clamp(fin(s.w, 60), 10, 400), sd: clamp(fin(s.d, 60), 10, 400), sh: clamp(fin(s.h, 80), 1, 300),
    clear: clamp(fin(s.clear, 0), 0, 150),
    floor: s.floor === true,
    rot: normRot(s.rot), x: fin(s.x, 0), y: fin(s.y, 0),
  };
  p.tall = typeof s.tall === 'boolean' ? s.tall : p.sh >= 120;
  p.sideOk = typeof s.sideOk === 'boolean' ? s.sideOk : p.cat === 'bed';
  p.role = roleOf(p);
  if (p.role === 'chair' || p.floor) p.clear = 0; // 의자는 책상 쪽을 보고 놓으므로 앞 공간을 따지지 않는다
  const [mn, good] = clearRange(p);
  p.minC = Math.min(mn, p.clear);
  p.goodC = Math.max(good, p.clear);
  p.big = p.role === 'bed' && p.sw >= 135;
  p.storage = !!STORAGE[p.role];
  p.area = p.sw * p.sd;
  p.w = p.rot % 180 === 0 ? p.sw : p.sd;
  p.h = p.rot % 180 === 0 ? p.sd : p.sw;
  return p;
}
const put = (b, x, y, rot) => ({ ...b, x, y, rot, w: rot % 180 === 0 ? b.sw : b.sd, h: rot % 180 === 0 ? b.sd : b.sw });

// 회전이 적용된 평면 크기
export function dims(item) {
  const w = clamp(fin(item?.w, 60), 10, 400), d = clamp(fin(item?.d, 60), 10, 400);
  return normRot(item?.rot) % 180 === 0 ? { w, h: d } : { w: d, h: w };
}
export function body(item) {
  const { w, h } = dims(item);
  return { x: fin(item?.x, 0), y: fin(item?.y, 0), w, h };
}
function frontRect(b, rot, c) {
  if (rot === 0) return { x: b.x, y: b.y + b.h, w: b.w, h: c };
  if (rot === 90) return { x: b.x - c, y: b.y, w: c, h: b.h };
  if (rot === 180) return { x: b.x, y: b.y - c, w: b.w, h: c };
  return { x: b.x + b.w, y: b.y, w: c, h: b.h };
}
// 앞쪽 사용 공간(의자, 문 열기 등)
export function clearZone(item) {
  const c = clamp(fin(item?.clear, 0), 0, 150);
  if (!c || item?.floor === true) return null;
  return frontRect(body(item), normRot(item.rot), c);
}

// 가구 p를 기준으로 한 자리. u: 폭 방향 시작(왼쪽·위쪽부터), v: 등에서 앞으로 나온 거리
function local(p, u, v, lw, ld) {
  if (p.rot === 0) return { x: p.x + u, y: p.y + v, w: lw, h: ld };
  if (p.rot === 180) return { x: p.x + u, y: p.y + p.h - v - ld, w: lw, h: ld };
  if (p.rot === 270) return { x: p.x + v, y: p.y + u, w: ld, h: lw };
  return { x: p.x + p.w - v - ld, y: p.y + u, w: ld, h: lw };
}

// 앞을 가려도 되는 짝: 책상 앞 의자, 소파 앞 소파 테이블
const exempt = (p, q) =>
  (q.role === 'chair' && (p.role === 'desk' || p.role === 'table' || p.role === 'vanity')) ||
  (q.role === 'sofatable' && isSeat(p));

// 빈 깊이: 그 변(구간 lo~hi)에서 방 안쪽으로 비어 있는 깊이. 벽과 다른 몸체까지, 상한 cap
function freeDepth(ctx, items, p, s, cap, lo, hi) {
  let d = Math.min(cap, wd(p, s, ctx.W, ctx.D));
  if (d <= 0) return 0;
  const horiz = s === 0 || s === 2;
  if (lo === undefined) { lo = horiz ? p.x : p.y; hi = lo + (horiz ? p.w : p.h); }
  for (let i = 0; i < items.length; i++) {
    const q = items[i];
    if (q === p || q.floor || exempt(p, q)) continue;
    let g;
    if (horiz) {
      if (q.x >= hi - 1 || q.x + q.w <= lo + 1) continue;
      if (s === 0) { if (q.y >= p.y) continue; g = p.y - q.y - q.h; } else { if (q.y + q.h <= p.y + p.h) continue; g = q.y - p.y - p.h; }
    } else {
      if (q.y >= hi - 1 || q.y + q.h <= lo + 1) continue;
      if (s === 3) { if (q.x >= p.x) continue; g = p.x - q.x - q.w; } else { if (q.x + q.w <= p.x + p.w) continue; g = q.x - p.x - p.w; }
    }
    if (g < d) d = g < 0 ? 0 : g;
  }
  return d;
}

// 침대 긴 변에서 드나드는 구간(발치 쪽 2/3). 머리 쪽 1/3은 협탁이 있어도 된다
function footSpan(b) {
  if (b.rot === 0) return [b.y + b.h / 3, b.y + b.h];
  if (b.rot === 180) return [b.y, b.y + (b.h * 2) / 3];
  if (b.rot === 270) return [b.x + b.w / 3, b.x + b.w];
  return [b.x, b.x + (b.w * 2) / 3];
}
function bedSides(ctx, items, b) {
  const back = b.rot / 90, sA = (back + 3) % 4, sB = (back + 1) % 4;
  const [lo, hi] = footSpan(b);
  const a = freeDepth(ctx, items, b, sA, 75, lo, hi), c = freeDepth(ctx, items, b, sB, 75, lo, hi);
  return a >= c ? { wide: a, narrow: c, sWide: sA, sA, sB } : { wide: c, narrow: a, sWide: sB, sA, sB };
}

// 틈: 한 축으로 20 이상 마주 볼 때 다른 축으로 떨어진 거리. 마주 보지 않으면 d = -1
const GAP = { d: -1, len: 0, horiz: false };
function gapOf(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (oy >= 20 && ox <= 0) { GAP.d = -ox; GAP.len = oy; GAP.horiz = true; } else if (ox >= 20 && oy <= 0) { GAP.d = -oy; GAP.len = ox; GAP.horiz = false; } else { GAP.d = -1; GAP.len = 0; }
  return GAP;
}

// 창 앞에 걸친 길이(창 벽에서 60 미만일 때만). 0이면 창 앞이 아님
function spanOv(p, win) {
  const lo = win.side % 2 === 0 ? p.x : p.y, hi = lo + (win.side % 2 === 0 ? p.w : p.h);
  return Math.max(0, Math.min(hi, win.a1) - Math.max(lo, win.a0));
}
const winOv = (ctx, p, win) => (wd(p, win.side, ctx.W, ctx.D) < WIN_NEAR ? spanOv(p, win) : 0);

// ───────── 통로 격자 ─────────
let BUF = null;
function buffers(nc) {
  if (!BUF || BUF.lvl.length < nc) BUF = { lvl: new Uint8Array(nc), reach: new Uint8Array(nc), queue: new Int32Array(nc) };
  return BUF;
}
const DEFER = [null, [], [], []];

// 벽과 몸체를 통로 반폭만큼 부풀려 칠한 뒤 현관 문 여는 공간에서 출발한다.
// reach[k]: 0 못 감, 1 = 60cm, 2 = 75cm, 3 = 90cm 폭으로 닿음 (좁은 곳 기준)
function walkGrid(ctx, items, G) {
  const { W, D } = ctx;
  const nx = Math.floor(W / G) + 1, ny = Math.floor(D / G) + 1, nc = nx * ny;
  const { lvl, reach, queue } = buffers(nc);
  lvl.fill(3, 0, nc);
  reach.fill(0, 0, nc);
  const paint = (x0, y0, x1, y1, v) => {
    const i0 = Math.max(0, Math.ceil(x0 / G)), i1 = Math.min(nx - 1, Math.floor(x1 / G));
    const j0 = Math.max(0, Math.ceil(y0 / G)), j1 = Math.min(ny - 1, Math.floor(y1 / G));
    if (i0 > i1) return;
    for (let j = j0; j <= j1; j++) lvl.fill(v, j * nx + i0, j * nx + i1 + 1);
  };
  for (let L = 2; L >= 0; L--) { // 넓게 부풀린 것부터 칠해야 좁은 것이 덮어쓴다
    const e = R_LEVELS[L] - GRID_SLACK;
    paint(-1, -1, e, D + 1, L); paint(W - e, -1, W + 1, D + 1, L); paint(-1, -1, W + 1, e, L); paint(-1, D - e, W + 1, D + 1, L);
    for (let k = 0; k < items.length; k++) {
      const p = items[k];
      if (!p.floor && p.role !== 'chair') paint(p.x - e, p.y - e, p.x + p.w + e, p.y + p.h + e, L); // 의자는 밀어 넣으면 되므로 길을 막지 않는다
    }
  }
  const z = ctx.zones[0];
  let pad = 0;
  const seedBox = () => [
    Math.max(0, Math.ceil((z.x - pad) / G)), Math.min(nx - 1, Math.floor((z.x + z.w + pad) / G)),
    Math.max(0, Math.ceil((z.y - pad) / G)), Math.min(ny - 1, Math.floor((z.y + z.h + pad) / G)),
  ];
  let [i0, i1, j0, j1] = seedBox();
  let any = false;
  for (let j = j0; j <= j1 && !any; j++) for (let i = i0; i <= i1; i++) if (lvl[j * nx + i]) { any = true; break; }
  if (!any) { pad = 30; [i0, i1, j0, j1] = seedBox(); } // 문 바로 앞이 좁으면 조금 넓혀서 출발점을 찾는다
  for (let L = 3; L >= 1; L--) {
    let head = 0, tail = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (!reach[k] && lvl[k] >= L) { reach[k] = L; queue[tail++] = k; } }
    const df = DEFER[L];
    for (let t = 0; t < df.length; t++) { const k = df[t]; if (!reach[k]) { reach[k] = L; queue[tail++] = k; } }
    df.length = 0;
    while (head < tail) {
      const k = queue[head++], i = k % nx;
      for (let dir = 0; dir < 4; dir++) {
        let n;
        if (dir === 0) { if (i + 1 >= nx) continue; n = k + 1; } else if (dir === 1) { if (i === 0) continue; n = k - 1; } else if (dir === 2) { n = k + nx; if (n >= nc) continue; } else { n = k - nx; if (n < 0) continue; }
        if (reach[n]) continue;
        const v = lvl[n];
        if (v >= L) { reach[n] = L; queue[tail++] = n; } else if (v) DEFER[v].push(n);
      }
    }
  }
  return { G, nx, ny, nc, reach };
}

// 사각형 안에서 가장 넓게 닿는 등급(0~3)
function reachMax(g, x0, y0, x1, y1) {
  const G = g.G;
  const i0 = Math.max(0, Math.ceil(x0 / G)), i1 = Math.min(g.nx - 1, Math.floor(x1 / G));
  const j0 = Math.max(0, Math.ceil(y0 / G)), j1 = Math.min(g.ny - 1, Math.floor(y1 / G));
  let m = 0;
  for (let j = j0; j <= j1; j++) {
    const row = j * g.nx;
    for (let i = i0; i <= i1; i++) { const v = g.reach[row + i]; if (v > m) { if (v === 3) return 3; m = v; } }
  }
  return m;
}
const NEAR = AISLE_CM / 2 + 15; // "닿음": 쓰는 쪽에서 이 거리 안에 통로 격자점이 있음
function reachSide(g, p, s, dep, lat) {
  if (s === 0) return reachMax(g, p.x - lat, p.y - dep, p.x + p.w + lat, p.y);
  if (s === 1) return reachMax(g, p.x + p.w, p.y - lat, p.x + p.w + dep, p.y + p.h + lat);
  if (s === 2) return reachMax(g, p.x - lat, p.y + p.h, p.x + p.w + lat, p.y + p.h + dep);
  return reachMax(g, p.x - dep, p.y - lat, p.x, p.y + p.h + lat);
}
// 가구의 쓰는 쪽(앞, 침대는 긴 변)에 통로가 닿는 등급
function itemReach(g, p) {
  const back = p.rot / 90;
  if (p.role === 'bed') return Math.max(reachSide(g, p, (back + 1) % 4, NEAR, 15), reachSide(g, p, (back + 3) % 4, NEAR, 15));
  if (p.clear > 0) return reachSide(g, p, (back + 2) % 4, NEAR, 15);
  return reachMax(g, p.x - NEAR, p.y - NEAR, p.x + p.w + NEAR, p.y + p.h + NEAR);
}

// 창을 여닫으러 설 자리. 창 앞에 낮은 가구만 있으면 그 가구 너머까지 넓힌다(S28)
function winAccess(ctx, items, win) {
  let far = 0, low = true;
  for (const p of items) {
    if (p.floor || winOv(ctx, p, win) <= 0) continue;
    far = Math.max(far, wd(p, win.side, ctx.W, ctx.D) + (win.side % 2 === 0 ? p.h : p.w));
    if (p.sh > win.sill) low = false;
  }
  const dep = far > 0 && low && far <= WIN_REACH ? far + 60 : 60;
  WIN_BOX.over = dep > 60 ? far : 0; // 가구 너머로 손을 뻗어야 하는 깊이
  return winBox(ctx, win, dep);
}
const WIN_BOX = { over: 0 };
function winBox(ctx, win, dep) {
  const s = win.side;
  if (s === 0) return [win.a0, 0, win.a1, dep];
  if (s === 2) return [win.a0, ctx.D - dep, win.a1, ctx.D];
  if (s === 3) return [0, win.a0, dep, win.a1];
  return [ctx.W - dep, win.a0, ctx.W, win.a1];
}

// 몸체가 없는 가장 큰 정사각형의 한 변(cm). S37
let SQ = null;
function freeSquare(ctx, items) {
  const c = ctx.area > 1e6 ? 20 : 10;
  const nx = Math.ceil(ctx.W / c), ny = Math.ceil(ctx.D / c);
  if (!SQ || SQ.length < nx * ny) SQ = new Uint16Array(nx * ny);
  const g = SQ;
  g.fill(1, 0, nx * ny);
  for (const p of items) {
    if (p.floor) continue;
    const i0 = Math.max(0, Math.floor(p.x / c)), i1 = Math.min(nx, Math.ceil((p.x + p.w) / c));
    const j0 = Math.max(0, Math.floor(p.y / c)), j1 = Math.min(ny, Math.ceil((p.y + p.h) / c));
    for (let j = j0; j < j1; j++) g.fill(0, j * nx + i0, j * nx + i1);
  }
  let best = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!g[k]) continue;
      if (i && j) { const a = g[k - 1], b = g[k - nx], d = g[k - nx - 1]; g[k] = (a < b ? (a < d ? a : d) : b < d ? b : d) + 1; }
      if (g[k] > best) best = g[k];
    }
  }
  return Math.min(best * c, ctx.W, ctx.D);
}

function tvDiag(tv, ctx) {
  const m = /(\d{2,3})\s*(인치|형|inch|")/i.exec(`${tv.name} ${typeof tv.src.query === 'string' ? tv.src.query : ''}`);
  const inch = m ? clamp(Number(m[1]), 20, 100) : ctx.area < 200000 ? 43 : 55;
  return inch * 2.54;
}

// ───────── 규칙 평가 ─────────
// G: 통로 격자 간격(0이면 도형 규칙만, 격자 규칙은 지킨 것으로 둔다). F: 사실 문장을 모을 배열. issues: 오류·경고를 모을 배열
function evaluate(ctx, items, G, F, issues) {
  const { W, D, wins, zones } = ctx;
  SUM.fill(0); MAX.fill(0); CNT.fill(0);
  const hit = (r, p) => { SUM[r] += p; if (p > MAX[r]) MAX[r] = p; CNT[r]++; };
  const fact = (uid, r, p, ok, text) => F.push({ uid, r, p, ok, text });
  const n = items.length;
  let errors = 0, soft = 0; // soft: 경고 수 + 앉는 자리를 못 보는 TV. 추천이 이런 안을 뒤로 미루는 데 쓴다

  if (issues) { // H1~H3
    for (let i = 0; i < n; i++) {
      const a = items[i];
      if (a.x < -0.01 || a.y < -0.01 || a.x + a.w > W + 0.01 || a.y + a.h > D + 0.01) { errors++; issues.push({ uid: a.uid, level: 'error', code: 'out', msg: `${a.name} 일부가 방 밖으로 나갔어요.` }); }
      if (a.floor) continue;
      if (zones.some((z) => overlaps(a, z))) { errors++; issues.push({ uid: a.uid, level: 'error', code: 'door', msg: `${a.name} 자리가 문 여는 공간을 막아요.` }); }
      for (let j = i + 1; j < n; j++) {
        const b = items[j];
        if (!b.floor && overlaps(a, b)) { errors++; issues.push({ uid: a.uid, other: b.uid, level: 'error', code: 'overlap', msg: `${a.name} 자리가 ${b.name} 자리와 겹쳐요.` }); }
      }
    }
  }

  const solid = [];
  let bed = null, sofa = null, nStorage = 0;
  for (let i = 0; i < n; i++) {
    const p = items[i];
    if (p.floor) continue;
    solid.push(p);
    if (p.role === 'bed' && (!bed || p.area > bed.area)) bed = p;
    if (isSeat(p) && (!sofa || p.sw > sofa.sw)) sofa = p;
    if (p.storage) nStorage++;
  }
  const ns = solid.length;
  const g = G && ns ? walkGrid(ctx, items, G) : null;
  let unreach = 0;
  const bedInfo = new Map();

  for (let i = 0; i < ns; i++) {
    const p = solid[i];
    const back = p.rot / 90, front = (back + 2) % 4, sA = (back + 3) % 4, sB = (back + 1) % 4;
    const backGap = wd(p, back, W, D);
    const nm = p.name;

    // H4 통로가 닿는지
    if (g) {
      const lv = itemReach(g, p);
      hit(R.H4, lv ? 0 : 1);
      if (!lv) {
        unreach++;
        if (issues) issues.push({ uid: p.uid, level: 'warn', code: 'walk', msg: `현관에서 ${nm}까지 가는 길이 ${AISLE_CM}cm보다 좁아요.` });
      }
      if (F) fact(p.uid, R.H4, lv ? 0 : 1, !!lv, lv ? `현관에서 ${nm}까지 통로가 막힘 없이 이어져요.` : `현관에서 ${nm}까지 가는 길이 ${AISLE_CM}cm보다 좁아요.`);
      if (p.role === 'bed') { // S1 침대까지 가는 길의 폭
        const q = lv === 3 ? 0 : lv === 2 ? 0.3 : lv === 1 ? 0.7 : 1;
        hit(R.S1, q);
        if (F && lv >= 2) fact(p.uid, R.S1, q, true, `현관에서 ${nm}까지 ${lv === 3 ? 90 : 75}cm쯤 되는 폭으로 걸어갈 수 있어요.`);
      }
    } else { hit(R.H4, 0); if (p.role === 'bed') hit(R.S1, 0); }

    if (p.role === 'bed') {
      // S5 머리는 벽에
      const p5 = backGap <= WALL_NEAR ? 0 : 1;
      hit(R.S5, p5);
      if (F) fact(p.uid, R.S5, p5, !p5, p5 ? `${nm} 머리맡이 벽에서 ${cm(backGap)}cm 떨어져 있어요. 벽에 붙이면 안정감이 생겨요.` : `${nm} 머리맡이 벽에 붙어 있어 안정감이 있어요.`);
      // S6 드나드는 옆
      const bs = bedSides(ctx, items, p);
      bedInfo.set(p, bs);
      const p1 = tier(bs.wide, 50, 60, 75);
      hit(R.S6, p.big ? 0.75 * p1 + 0.25 * tier(bs.narrow, 50, 60, 75) : p1);
      if (bs.wide < 50) soft++;
      if (bs.wide < 50 && issues) issues.push({ uid: p.uid, level: 'warn', code: 'clear', msg: `${nm} 옆이 ${cm(bs.wide)}cm뿐이에요. 60cm쯤 비워야 오르내리기 편해요.` });
      if (F) fact(p.uid, R.S6, p1, bs.wide >= 60, bs.wide >= 60 ? `${nm} 옆이 ${bs.wide >= 75 ? '75cm 이상' : `${cm(bs.wide)}cm`} 비어 있어 편하게 오르내릴 수 있어요.` : `${nm} 옆이 ${cm(bs.wide)}cm뿐이에요. 60cm쯤 비워야 오르내리기 편해요.`);
      if (F && p.big && bs.wide >= 50 && bs.narrow < 50) fact(p.uid, R.S6, 0.25, false, `${nm} 한쪽 옆이 막혀 있어요. 둘이 쓰려면 양쪽을 60cm쯤 비우면 편해요.`);
      // S7 작은 침대는 긴 변을 벽에
      if (p.sideOk && (p.sw < 135 || (back % 2 === 0 ? W : D) - p.sw < 170)) {
        const p7 = Math.min(wd(p, sA, W, D), wd(p, sB, W, D)) <= TOUCH ? 0 : 1;
        hit(R.S7, p7);
        if (F) fact(p.uid, R.S7, p7, !p7, p7 ? `${nm} 긴 쪽을 벽에 붙이면 가운데 바닥이 더 넓어져요.` : `${nm} 긴 쪽을 벽에 붙여 방 가운데가 넓어졌어요.`);
      }
      // S8 현관에서 멀리
      const p8 = ramp(Math.hypot(cx(p) - ctx.entry.x, cy(p) - ctx.entry.y) / ctx.diag, 0.25, 0.5);
      hit(R.S8, p8);
      if (F && (p8 === 0 || p8 >= 0.5)) fact(p.uid, R.S8, p8, !p8, p8 ? `${nm} 자리가 현관과 가까워요. 안쪽으로 옮기면 더 아늑해요.` : `${nm} 자리가 현관에서 멀어 아늑해요.`);
      // S9 현관문과 일직선
      const bw = ctx.entrySide % 2 === 0
        ? Math.min(p.x + p.w, ctx.band.x + ctx.band.w) - Math.max(p.x, ctx.band.x)
        : Math.min(p.y + p.h, ctx.band.y + ctx.band.h) - Math.max(p.y, ctx.band.y);
      const p9 = clamp(bw / ctx.entrySize, 0, 1);
      hit(R.S9, p9);
      if (F && (p9 === 0 || p9 >= 0.3)) fact(p.uid, R.S9, p9, !p9, p9 ? `문을 열면 ${nm} 쪽이 바로 정면에 보여요.` : `문을 열어도 ${nm} 쪽이 정면으로 보이지 않아요.`);
      // S27 머리가 창 아래 / S29 옆이 창가
      if (wins.length) {
        let p27 = 0, p29 = 0;
        for (const w of wins) {
          if (w.side === back && backGap <= WALL_NEAR) p27 = Math.max(p27, spanOv(p, w) / Math.min(p.sw, w.size));
          if ((w.side === sA || w.side === sB) && wd(p, w.side, W, D) < 30 && spanOv(p, w) > 0) p29 = 0.5;
        }
        hit(R.S27, p27); hit(R.S29, p29);
        if (F) {
          if (p27 >= 0.5) fact(p.uid, R.S27, p27, false, `${nm} 머리맡이 창 바로 아래예요. 외풍과 아침 빛이 머리에 닿을 수 있어요.`);
          else if (p27 > 0) fact(p.uid, R.S27, p27, false, `${nm} 머리맡 한쪽이 창에 조금 걸쳐 있어요. 커튼을 치면 외풍이 덜해요.`);
          else if (backGap <= WALL_NEAR) fact(p.uid, R.S27, 0, true, `${nm} 머리맡이 창을 피해 있어 외풍과 빛이 덜 닿아요.`);
          if (p29) fact(p.uid, R.S29, p29, false, `${nm} 옆이 창가라 겨울에 찬 기운이 느껴질 수 있어요. 두꺼운 커튼을 같이 쓰면 좋아요.`);
        }
      }
      if (F && ctx.area <= 200000 && p.sw >= 150) fact(p.uid, -1, 0, false, '방에 비해 침대가 커요. 슈퍼싱글로 바꾸면 통로가 넓어져요.'); // S11
      continue;
    }

    // S2 앞 사용 공간 (식탁은 S24, 의자·러그는 clear 0)
    if (p.clear > 0 && p.role !== 'table') {
      const c = freeDepth(ctx, items, p, front, p.goodC);
      const p2 = tier(c, p.minC, p.clear, p.goodC);
      hit(R.S2, p2);
      if (c < p.clear) soft++;
      if (c < p.clear && issues) {
        issues.push({ uid: p.uid, level: 'warn', code: 'clear', msg: c < p.minC ? `${nm} 앞이 ${cm(c)}cm뿐이라 쓰기 어려워요. 적어도 ${cm(p.minC)}cm는 비워 주세요.` : `${nm} 앞 사용 공간이 ${cm(c)}cm예요. ${cm(p.clear)}cm쯤 있으면 편해요.` });
      }
      if (F) fact(p.uid, R.S2, p2, c >= p.clear, c >= p.clear ? `${nm} 앞이 ${c >= p.goodC ? `${cm(p.goodC)}cm 이상` : `${cm(c)}cm`} 비어 있어 편하게 쓸 수 있어요.` : `${nm} 앞 사용 공간이 ${cm(c)}cm예요. ${cm(p.clear)}cm쯤 있으면 편해요.`);
    }

    if (p.role === 'desk') {
      // S12 창이 옆에 오게
      if (wins.length) {
        let p12 = 0, far = Infinity;
        for (const w of wins) {
          const lap = spanOv(p, w) > 0;
          const q = w.side === back ? (lap ? 0.4 : 0.2) : w.side === front ? (lap ? 1 : 0.5) : 0;
          if (q > p12) p12 = q;
          const dx = w.side % 2 === 0 ? Math.max(w.a0 - cx(p), 0, cx(p) - w.a1) : w.side === 3 ? cx(p) : W - cx(p);
          const dy = w.side % 2 === 0 ? (w.side === 0 ? cy(p) : D - cy(p)) : Math.max(w.a0 - cy(p), 0, cy(p) - w.a1);
          far = Math.min(far, Math.hypot(dx, dy) / w.top);
        }
        hit(R.S12, p12);
        if (p12 === 1) soft++;
        if (p12 === 1 && issues) issues.push({ uid: p.uid, level: 'warn', code: 'glare', msg: `${nm} 뒤가 창이라 화면에 빛이 비쳐요. 창이 옆에 오게 돌리면 좋아요.` });
        if (F) {
          fact(p.uid, R.S12, p12, p12 === 0, p12 === 0 ? `${nm} 옆으로 창 빛이 들어와 화면이 눈부시지 않아요.`
            : p12 <= 0.4 ? `${nm} 정면이 창 쪽 벽이라 낮에 눈이 부실 수 있어요. 커튼이나 블라인드를 같이 쓰면 좋아요.`
              : `${nm} 뒤쪽이 창이라 화면에 빛이 비칠 수 있어요. 창이 옆에 오게 돌리면 좋아요.`);
        }
        // S13 창 빛이 닿는 깊이
        const p13 = ramp(far, 2.5, 1.5);
        hit(R.S13, p13);
        if (F && (p13 === 0 || p13 >= 0.5)) fact(p.uid, R.S13, p13, !p13, p13 ? `${nm} 자리가 창에서 멀어 낮에도 조명이 필요할 수 있어요.` : `${nm} 자리는 낮에 창 빛이 잘 닿아요.`);
      }
      // S14 침대와 조금 떨어뜨리기
      if (bed) {
        const gp = gapOf(p, bed);
        const p14 = gp.d >= 0 && gp.d < 30 && gp.len >= 30 ? 1 : 0;
        hit(R.S14, p14);
        const apart = Math.hypot(Math.max(0, bed.x - p.x - p.w, p.x - bed.x - bed.w), Math.max(0, bed.y - p.y - p.h, p.y - bed.y - bed.h));
        // "떨어져 있다"는 말은 사이로 지나다닐 만큼(통로 폭) 떨어졌을 때만 한다. 30~60cm는 그림으로 보면 붙어 보여서 말하지 않는다
        if (F && (p14 || apart >= AISLE_CM)) fact(p.uid, R.S14, p14, !p14, p14 ? `${nm} 자리가 침대 바로 옆이에요. 조금 떼면 쉬는 곳과 일하는 곳이 나뉘어요.` : `${nm} 자리가 침대와 떨어져 있어 일하는 곳과 쉬는 곳이 나뉘어요.`);
      }
      if (F && p.sd < 45) fact(p.uid, -1, 0, false, `${nm} 깊이가 ${cm(p.sd)}cm라 모니터를 쓰기엔 얕을 수 있어요.`); // S15
    }

    if (p.role === 'table') { // S24 식탁은 의자 놓는 쪽을
      const cf = freeDepth(ctx, items, p, front, 90);
      let q = tier(cf, 60, 75, 90), c = cf, where = '앞이';
      // 뒤쪽은 의자를 놓을 만큼(60) 비었을 때만 앉는 쪽으로 본다. 그보다 좁은 틈은 정돈(S3)에서 따진다
      const cb = backGap > WALL_NEAR ? freeDepth(ctx, items, p, back, 90) : 0;
      if (cb >= 60) { q = (q + tier(cb, 60, 75, 90)) / 2; if (cb < cf) { c = cb; where = '뒤쪽이'; } }
      hit(R.S24, q);
      if (c < 60) soft++;
      if (c < 60 && issues) issues.push({ uid: p.uid, level: 'warn', code: 'clear', msg: `${nm} 앞이 ${cm(c)}cm예요. 의자를 빼려면 75cm쯤 필요해요.` });
      if (F) fact(p.uid, R.S24, q, c >= 75, c >= 75 ? `${nm} 앞이 ${cf >= 90 ? '90cm 이상' : `${cm(cf)}cm`} 비어 있어 의자를 빼고 앉기 편해요.` : `${nm} ${where} ${cm(c)}cm예요. 의자를 빼려면 75cm쯤 필요해요.`);
    }

    if (p.role === 'fridge') { // S16을 냉장고에도: 현관(보통 주방) 쪽에 두고 침대에서 멀리
      const p16 = ramp(Math.hypot(cx(p) - ctx.entry.x, cy(p) - ctx.entry.y) / ctx.diag, 0.6, 0.3);
      hit(R.S16, p16);
      if (F && (p16 === 0 || p16 >= 0.5)) fact(p.uid, R.S16, p16, !p16, p16 ? `${nm} 자리가 방 안쪽이에요. 현관 쪽에 두면 소리와 열이 쉬는 자리에서 멀어져요.` : `${nm} 자리를 현관 쪽에 두어 방 안쪽이 조용해요.`);
    }
    if (p.role === 'fridge') { // S19 열이 빠질 틈
      const tight = backGap < 5 || freeDepth(ctx, items, p, sA, 5) < 5 || freeDepth(ctx, items, p, sB, 5) < 5;
      hit(R.S19, tight ? 1 : 0);
      if (F) fact(p.uid, R.S19, tight ? 1 : 0, !tight, tight ? `${nm} 뒤와 옆은 5~10cm 띄워야 열이 잘 빠져요. 설명서도 확인해 주세요.` : `${nm} 뒤와 옆을 조금 띄워 열이 빠질 틈이 있어요.`);
    }

    // S34 등은 벽에 (짝 가구·작은 소품은 빼고)
    const paired = p.role === 'table' || p.role === 'chair' || p.role === 'sofatable' || p.role === 'nightstand' || (p.role === 'decor' && !p.clear);
    const floating = backGap > WALL_NEAR;
    if (!paired) {
      const divider = floating && (p.storage || isSeat(p));
      const okDivider = divider && p.sh <= 150 && ctx.area >= 130000;
      const p34 = !floating ? 0 : okDivider ? 0.3 : 1;
      hit(R.S34, p34);
      if (F) {
        fact(p.uid, R.S34, p34, !floating, !floating ? `${nm} 등을 벽에 붙여 바닥을 넓게 썼어요.`
          : okDivider ? `${nm} 자리를 벽에서 띄워 구역을 나눴어요. 벽에 붙이면 바닥은 더 넓어져요.`
            : `${nm} 자리가 벽에서 ${cm(backGap)}cm 떨어져 떠 있어요. 등을 벽에 붙이면 바닥이 넓어져요.`);
      }
      if (divider) { // S42 가운데 세우는 분리 가구
        hit(R.S42, okDivider ? 0 : 1);
        if (F) fact(p.uid, R.S42, okDivider ? 0 : 1, okDivider, okDivider ? `${nm} 높이가 낮아 답답하지 않게 구역을 나눠요.` : `${nm} 자리가 방을 막아 좁아 보일 수 있어요. 벽 쪽으로 옮겨 보세요.`);
      }
    }
    // S35 떠 있는 가구는 줄 맞추기
    if (floating && p.role !== 'chair' && p.role !== 'decor') {
      let aligned = Math.min(wd(p, sA, W, D), wd(p, sB, W, D)) <= TOUCH;
      for (let j = 0; j < ns && !aligned; j++) {
        const q = solid[j];
        if (q === p) continue;
        aligned = Math.abs(p.x - q.x) <= 5 || Math.abs(p.x + p.w - q.x - q.w) <= 5 || Math.abs(p.y - q.y) <= 5 || Math.abs(p.y + p.h - q.y - q.h) <= 5 ||
          Math.abs(cx(p) - cx(q)) <= 20 || Math.abs(cy(p) - cy(q)) <= 20;
      }
      hit(R.S35, aligned ? 0 : 1);
      if (F && !aligned) fact(p.uid, R.S35, 1, false, `${nm} 자리를 옆 가구와 줄 맞추면 더 정돈돼 보여요.`);
    }

    let p31 = 0; // S31 현관 정면을 키 큰 가구로 막는지. S16의 칭찬 문장과 어긋나지 않게 먼저 계산한다
    if (p.tall) {
      const lap = ctx.entrySide % 2 === 0
        ? Math.min(p.x + p.w, ctx.band.x + ctx.band.w) - Math.max(p.x, ctx.band.x)
        : Math.min(p.y + p.h, ctx.band.y + ctx.band.h) - Math.max(p.y, ctx.band.y);
      p31 = lap > TOUCH ? (wd(p, ctx.entrySide, W, D) <= 150 ? 1 : 0.4) : 0;
    }

    if (p.storage) {
      const sideWall = Math.min(wd(p, sA, W, D), wd(p, sB, W, D)) <= TOUCH;
      let nearStore = false, nearTall = false;
      for (let j = 0; j < ns; j++) {
        const q = solid[j];
        if (q === p || !(q.storage || q.tall)) continue;
        const gp = gapOf(p, q);
        if (gp.d >= 0 && gp.d <= TOUCH) { if (q.storage) nearStore = true; if (q.tall) nearTall = true; }
      }
      if (nStorage >= 2) { // S17 수납은 한데 모으기
        const p17 = nearStore || sideWall ? 0 : 1;
        hit(R.S17, p17);
        if (F && (nearStore || p17 || !floating)) fact(p.uid, R.S17, p17, !p17, nearStore ? `${nm} 자리를 다른 수납 가구 옆에 붙여 한쪽에 모았어요.` : p17 ? `${nm} 자리를 다른 수납 가구 옆으로 붙이면 더 정돈돼 보여요.` : `${nm} 자리를 구석에 붙여 깔끔해요.`);
      }
      if (p.tall) { // S16 키 큰 수납은 구석·현관 쪽
        const a = sideWall || nearTall ? 0 : 1;
        const far = Math.hypot(cx(p) - ctx.entry.x, cy(p) - ctx.entry.y) / ctx.diag;
        const p16 = 0.5 * a + 0.5 * ramp(far, 0.8, 0.5);
        hit(R.S16, p16);
        // 지킨 문장은 평면도에서 그대로 보이는 사실만 말한다(어느 벽인지는 말하지 않는다). 현관 정면을 막은 가구(S31)는 칭찬하지 않는다
        if (F && ((p16 === 0 && !floating && !p31) || p16 >= 0.5)) fact(p.uid, R.S16, p16, !p16, p16 ? `${nm} 같은 키 큰 가구는 구석이나 현관 쪽 벽에 두면 덜 답답해요.` : `${nm} 자리를 ${sideWall ? '구석에' : '다른 키 큰 가구 옆에'} 붙여 방 가운데가 넓어 보여요.`);
      }
      if (p.role === 'hanger' && bed) { // S18 행거는 침대에서 떨어뜨리기
        const gp = gapOf(p, bed);
        const p18 = gp.d >= 0 ? ramp(gp.d, 30, 60) : 0;
        hit(R.S18, p18);
        if (F && p18 >= 0.5) fact(p.uid, R.S18, p18, false, `${nm} 자리가 침대 바로 옆이라 옷 먼지가 침구에 앉을 수 있어요.`);
      }
    }

    if (p.tall) { // S31 현관 정면을 키 큰 가구로 막지 않기 (p31은 위에서 계산)
      hit(R.S31, p31);
      if (F) fact(p.uid, R.S31, p31, !p31, p31 ? `현관 정면에 ${nm} 자리가 있어 들어설 때 답답해 보일 수 있어요.` : `${nm} 자리가 현관 정면을 피해 있어 들어설 때 시야가 트여요.`);
    }

    if (p.role === 'tv' && (sofa || bed)) { // S21 TV와 앉는 자리 / S22 보는 거리
      const seat = sofa || bed;
      const sf = (seat.rot / 90 + 2) % 4;
      const horiz = sf % 2 === 0; // 앉는 자리가 위아래로 바라봄
      const ahead = sf === 2 ? p.y >= seat.y + seat.h - 1 : sf === 0 ? p.y + p.h <= seat.y + 1 : sf === 1 ? p.x >= seat.x + seat.w - 1 : p.x + p.w <= seat.x + 1;
      const lo = Math.max(horiz ? p.x : p.y, horiz ? seat.x : seat.y), hi = Math.min(horiz ? p.x + p.w : p.y + p.h, horiz ? seat.x + seat.w : seat.y + seat.h);
      const facing = front === (sf + 2) % 4 && ahead && hi - lo >= 0.5 * p.sw;
      const zone = { x: Math.min(cx(p), cx(seat)), y: Math.min(cy(p), cy(seat)), w: Math.abs(cx(p) - cx(seat)) || 1, h: Math.abs(cy(p) - cy(seat)) || 1 };
      const blocked = solid.some((q) => q !== p && q !== seat && q.sh > 50 && overlaps(q, zone));
      const p21 = facing && !blocked ? 0 : (front + sf) % 2 === 1 && !blocked ? 0.5 : 1;
      hit(R.S21, p21);
      if (p21) soft++;
      if (F) fact(p.uid, R.S21, p21, !p21, p21 ? `${nm} 화면이 앉는 자리(${seat.name})를 바로 향하지 않아요.` : `${nm} 맞은편에 ${seat.name} 자리가 있어 보기 편해요.`);
      if (p21 === 0) {
        const eye = isSeat(seat) ? (sf === 2 ? seat.y + seat.h : sf === 0 ? seat.y : sf === 1 ? seat.x + seat.w : seat.x) : horiz ? cy(seat) : cx(seat);
        const screen = front === 2 ? p.y + p.h : front === 0 ? p.y : front === 1 ? p.x + p.w : p.x;
        const d = Math.abs(screen - eye), dg = tvDiag(p, ctx);
        const p22 = plateau(d, 1.2 * dg, 1.6 * dg);
        hit(R.S22, p22);
        if (F && (p22 === 0 || p22 >= 0.3)) fact(p.uid, R.S22, p22, !p22, p22 ? `${nm}까지 ${cm(d)}cm예요. ${cm(1.2 * dg)}~${cm(1.6 * dg)}cm쯤이면 보기 편해요.` : `${nm}까지 ${cm(d)}cm라 화면 크기에 알맞은 거리예요.`);
      } else hit(R.S22, 1); // 마주 보지 않으면 거리도 맞지 않은 것으로 본다(비스듬히 두는 쪽이 유리해지지 않게)
    }

    if (p.role === 'sofatable' && sofa) { // S23 소파 테이블은 손 닿는 거리
      const sf = (sofa.rot / 90 + 2) % 4;
      const gp = gapOf(p, sofa);
      const ahead = sf === 2 ? p.y >= sofa.y + sofa.h : sf === 0 ? p.y + p.h <= sofa.y : sf === 1 ? p.x >= sofa.x + sofa.w : p.x + p.w <= sofa.x;
      const d = gp.d;
      const p23 = !ahead || d < 0 || d < 35 ? 1 : plateau(d, 38, 46);
      hit(R.S23, p23);
      if (F) fact(p.uid, R.S23, p23, p23 < 0.2, !ahead || d < 0 ? `${nm} 자리가 소파 앞이 아니에요. 소파 앞 40cm쯤에 두면 손이 잘 닿아요.` : p23 < 0.2 ? `소파에서 ${nm}까지 ${cm(d)}cm라 손이 잘 닿아요.` : `소파와 ${nm} 사이가 ${cm(d)}cm예요. 40cm쯤이 알맞아요.`);
    }

    if (p.role === 'chair') { // S44 의자는 책상·식탁 앞에(규칙집에 없어 더한 규칙)
      let host = null, any = false;
      for (let j = 0; j < ns; j++) {
        const q = solid[j];
        if (q.role !== 'desk' && q.role !== 'vanity' && q.role !== 'table') continue;
        any = true;
        if (ovArea(p, frontRect(q, q.rot, 70)) >= 0.5 * p.area) { host = q; break; }
      }
      if (any) {
        hit(R.S44, host ? 0 : 1);
        if (F) fact(p.uid, R.S44, host ? 0 : 1, !!host, host ? `${nm} 자리가 ${host.name} 바로 앞이라 바로 앉을 수 있어요.` : `${nm} 자리가 책상에서 떨어져 있어요. 책상 앞에 두면 바로 앉을 수 있어요.`);
      }
    }

    if (p.role === 'nightstand' && bed) { // S10 협탁은 침대 머리 옆
      const gp = gapOf(p, bed);
      const beside = gp.d >= 0 && gp.horiz === (bed.rot % 180 === 0);
      let p10 = 1, head = false;
      if (beside) {
        const [lo, hi] = footSpan(bed);
        const c = bed.rot % 180 === 0 ? cy(p) : cx(p);
        head = c < lo || c > hi;
        p10 = Math.max(gp.d <= 30 ? 0 : 1 - (30 / gp.d) ** 2, head ? 0 : 0.5);
      }
      hit(R.S10, p10);
      if (F) fact(p.uid, R.S10, p10, !p10, p10 ? `${nm} 자리가 침대 머리맡에서 멀어요. 머리맡 옆에 붙이면 편해요.` : `${nm} 자리가 침대 머리맡 바로 옆이라 손이 닿아요.`);
    }
  }

  // S3 어중간한 틈
  if (ns) {
    let dead = 0, worst = 0, worstMsg = null, worstUid = null;
    const skip = (q) => q.role === 'chair' || q.role === 'decor';
    const note = (len, uid, msg) => { dead += len; if (len > worst) { worst = len; worstUid = uid; worstMsg = msg; } };
    for (let i = 0; i < ns; i++) {
      const a = solid[i];
      if (skip(a)) continue;
      for (let s = 0; s < 4; s++) {
        const d = wd(a, s, W, D);
        if (d <= TOUCH || d >= DEAD_MAX || (a.role === 'fridge' && d <= 10)) continue;
        // 그 틈에 다른 가구가 끼어 있으면 벽과의 틈이 아니다
        if (freeDepth(ctx, items, a, s, d) < d) continue;
        note(s % 2 === 0 ? a.w : a.h, a.uid, `${a.name} 자리와 벽 사이에 ${cm(d)}cm 틈이 남아요. 붙이거나 50cm 넘게 띄우면 좋아요.`);
      }
      for (let j = i + 1; j < ns; j++) {
        const b = solid[j];
        if (skip(b)) continue;
        if ((a.role === 'sofatable' && isSeat(b)) || (b.role === 'sofatable' && isSeat(a))) continue;
        if ((a.role === 'nightstand' && b.role === 'bed') || (b.role === 'nightstand' && a.role === 'bed')) continue;
        const gp = gapOf(a, b);
        if (gp.d <= TOUCH || gp.d >= DEAD_MAX) continue;
        if ((a.role === 'fridge' || b.role === 'fridge') && gp.d <= 10) continue;
        note(gp.len, a.uid, `${a.name} 자리와 ${b.name} 자리 사이에 ${cm(gp.d)}cm 틈이 남아요. 붙이거나 50cm 넘게 띄우면 좋아요.`);
      }
    }
    const p3 = Math.min(1, dead / 200);
    hit(R.S3, p3);
    if (F) fact(worstUid, R.S3, p3, !dead, dead ? worstMsg : '가구 사이에 버리는 틈이 없어요.');
  }

  // S26 키 큰 가구로 창 가리지 않기 / S28 창에 손이 닿는지 / S1 창까지 가는 길
  if (ns) {
    for (let wi = 0; wi < wins.length; wi++) {
      const w = wins[wi];
      let cover = 0;
      for (let i = 0; i < ns; i++) {
        const p = solid[i];
        const lap = winOv(ctx, p, w);
        if (lap <= 0) continue;
        if (p.sh <= w.sill) { if (F) fact(p.uid, R.S26, 0, true, `${p.name} 높이가 창대보다 낮아 창을 가리지 않아요.`); continue; }
        const q = (lap / w.size) * Math.min(1, (p.sh - w.sill) / w.height);
        cover += q;
        if (p.tall && lap > TOUCH) soft++;
        if (p.tall && lap > TOUCH && issues) issues.push({ uid: p.uid, level: 'warn', code: 'window', msg: `${p.name} 자리가 창문을 ${cm(lap)}cm 가려요. 빛이 덜 들어와요.` });
        if (F) fact(p.uid, R.S26, q, false, `${p.name} 자리가 창문을 ${cm(lap)}cm 가려요. 빛이 덜 들어와요.`);
      }
      hit(R.S26, Math.min(1, cover));
      if (g) {
        const [x0, y0, x1, y1] = winAccess(ctx, items, w);
        const lv = reachMax(g, x0, y0, x1, y1);
        // 깊이 60을 넘는 가구(침대 등) 너머로 손을 뻗어야 하면 조금 감점
        let over = false;
        if (lv && WIN_BOX.over > 60) { const b = winBox(ctx, w, 60); over = reachMax(g, b[0], b[1], b[2], b[3]) === 0; }
        const p28 = !lv ? 1 : over ? 0.3 : 0;
        hit(R.S28, p28);
        hit(R.S1, lv === 3 ? 0 : lv === 2 ? 0.3 : lv === 1 ? 0.7 : 1);
        if (F) {
          fact(null, R.S28, p28, !p28, !lv ? '가구에 막혀 창문을 여닫기 불편해요.' : over ? '창문을 열려면 가구 너머로 손을 뻗어야 해요.' : '창문 앞까지 걸어가 창을 열 수 있어요.');
          const wdt = [0, 60, 75, 90][lv];
          fact(null, R.S1, lv === 3 ? 0 : lv === 2 ? 0.3 : lv === 1 ? 0.7 : 1, lv >= 2, lv >= 2 ? `현관에서 창문까지 ${wdt}cm쯤 되는 폭으로 걸어갈 수 있어요.` : lv ? '현관에서 창문까지 가는 길의 가장 좁은 곳이 60cm쯤이에요. 75cm쯤 되면 편해요.' : '현관에서 창문까지 가는 길이 60cm보다 좁아요.');
        }
      } else { hit(R.S28, 0); hit(R.S1, 0); }
    }
  }

  // H4·S1 다른 문(화장실 등)까지
  if (ns) {
    for (let k = 1; k < zones.length; k++) {
      const z = zones[k];
      if (!g) { hit(R.H4, 0); hit(R.S1, 0); continue; }
      const lv = reachMax(g, z.x, z.y, z.x + z.w, z.y + z.h);
      hit(R.H4, lv ? 0 : 1);
      hit(R.S1, lv === 3 ? 0 : lv === 2 ? 0.3 : lv === 1 ? 0.7 : 1);
      if (!lv) {
        unreach++;
        if (issues) issues.push({ uid: null, level: 'warn', code: 'walk', msg: `현관에서 ${ctx.doorNames[k]}까지 가는 길이 ${AISLE_CM}cm보다 좁아요.` });
      }
      if (F) fact(null, R.H4, lv ? 0 : 1, !!lv, lv ? `현관에서 ${ctx.doorNames[k]}까지 통로가 이어져요.` : `현관에서 ${ctx.doorNames[k]}까지 가는 길이 ${AISLE_CM}cm보다 좁아요.`);
    }
    // S30 문 앞에 설 자리
    let sum30 = 0, worst = null, worstA = 0;
    for (let k = 0; k < zones.length; k++) {
      const z = zones[k], side = SIDES.indexOf(ctx.room.doors[k].wall);
      const land = side === 0 ? { x: z.x, y: z.h, w: z.w, h: 60 } : side === 2 ? { x: z.x, y: z.y - 60, w: z.w, h: 60 } : side === 3 ? { x: z.w, y: z.y, w: 60, h: z.h } : { x: z.x - 60, y: z.y, w: 60, h: z.h };
      let a = 0;
      for (let i = 0; i < ns; i++) { const o = ovArea(solid[i], land); a += o; if (o > worstA) { worstA = o; worst = solid[i]; } }
      sum30 += Math.min(1, a / (land.w * land.h));
    }
    const p30 = sum30 / zones.length;
    hit(R.S30, p30);
    if (F) fact(worst ? worst.uid : null, R.S30, p30, p30 === 0, p30 === 0 ? '문을 열고 들어설 자리가 넉넉해요.' : `문을 열면 바로 앞에 ${worst.name} 자리가 있어 답답해요.`);
  }

  // S36 무거운 가구가 한쪽에 몰리지 않게 / S37 한 덩어리 빈 바닥
  if (ns >= 2) {
    let m = 0, mx = 0, my = 0;
    for (let i = 0; i < ns; i++) { const p = solid[i], wgt = p.area * p.sh; m += wgt; mx += wgt * cx(p); my += wgt * cy(p); }
    const e = Math.max(Math.abs(mx / m - W / 2) / W, Math.abs(my / m - D / 2) / D);
    const p36 = ramp(e, 0.3, 0.1);
    hit(R.S36, p36);
    if (F && (p36 === 0 || p36 >= 0.5)) fact(null, R.S36, p36, !p36, p36 ? '큰 가구가 한쪽에 몰려 있어요.' : '큰 가구가 방 양쪽에 고르게 놓여 있어요.');
  }
  if (ns) {
    if (g) {
      const L = freeSquare(ctx, items);
      const p37 = ramp(L, 90, 150);
      hit(R.S37, p37);
      if (F) fact(null, R.S37, p37, p37 < 0.5, p37 < 0.5 ? `가구 없이 비어 있는 바닥이 가로세로 ${cm(L)}cm쯤 남아요.` : '빈 바닥이 잘게 나뉘어 방이 좁게 느껴질 수 있어요.');
    } else hit(R.S37, 0);
  }

  // 러그: S39 가구에 걸치기 / S40 벽에서 띄우기 / S41 문 여는 공간 피하기
  for (let i = 0; i < n; i++) {
    const r = items[i];
    if (!r.floor) continue;
    let q = 1;
    for (let j = 0; j < ns; j++) {
      const p = solid[j];
      if (!overlaps(r, p)) continue;
      if (q > 0.5) q = 0.5;
      if (p.role === 'bed') {
        const bs = bedInfo.get(p), need = p.big ? 45 : 30;
        for (const s of [bs.sA, bs.sB]) {
          const ext = s === 0 ? p.y - r.y : s === 1 ? r.x + r.w - p.x - p.w : s === 2 ? r.y + r.h - p.y - p.h : p.x - r.x;
          if (ext >= need && wd(p, s, W, D) >= need) q = 0;
        }
      } else if (isSeat(p)) {
        const f = (p.rot / 90 + 2) % 4;
        const edge = f === 2 ? p.y + p.h : f === 0 ? p.y : f === 1 ? p.x + p.w : p.x;
        if (f % 2 === 0 ? edge > r.y && edge < r.y + r.h : edge > r.x && edge < r.x + r.w) q = 0;
      }
    }
    hit(R.S39, q);
    const edgeGap = Math.min(r.x, r.y, W - r.x - r.w, D - r.y - r.h);
    hit(R.S40, ramp(edgeGap, 0, 20));
    const onDoor = zones.some((z) => overlaps(r, z));
    hit(R.S41, onDoor ? 1 : 0);
    if (F) {
      fact(r.uid, R.S39, q, q === 0, q === 0 ? `${r.name} 한쪽이 가구 밑으로 들어가 자리가 잡혀 보여요.` : q < 1 ? `${r.name} 자리를 침대 옆이나 소파 앞으로 30cm 넘게 나오게 깔면 자리가 잡혀 보여요.` : `${r.name} 자리가 가구와 떨어져 있어 떠 보일 수 있어요.`);
      if (edgeGap < 20) fact(r.uid, R.S40, ramp(edgeGap, 0, 20), false, `${r.name} 가장자리를 벽에서 20cm쯤 띄우면 바닥이 보여 더 넓어 보여요.`);
      if (onDoor) fact(r.uid, R.S41, 1, false, `${r.name} 자리가 문 여는 공간에 걸려 문이 걸릴 수 있어요.`);
    }
  }

  // 항목 점수 = max × (1 − Σ(가중치 × p) ÷ Σ(가중치)). 규칙 하나가 항목 전체를 좌우하지 않게 분모는 항목 가중치 합의 절반 이상
  const num = [0, 0, 0, 0, 0, 0, 0], den = [0, 0, 0, 0, 0, 0, 0];
  for (let r = 0; r < NR; r++) {
    if (!CNT[r]) continue;
    const k = R_PART[r];
    num[k] += R_W[r] * (0.5 * (SUM[r] / CNT[r]) + 0.5 * MAX[r]);
    den[k] += R_W[r];
  }
  const parts = [];
  let total = 0;
  for (let k = 0; k < PARTS.length; k++) {
    const v = den[k] ? PARTS[k].max * (1 - num[k] / Math.max(den[k], PART_W[k] / 2)) : PARTS[k].max;
    parts.push(v);
    total += v;
  }
  return { total: total - 15 * errors, parts, den, errors, unreach, soft: soft + unreach, grid: g };
}

// 화면에 보이는 점수 모양으로. note는 그 항목에서 가장 크게 깎인 규칙의 문장(없으면 가장 무거운 지킨 규칙)
function makeScore(res, F, ctx) {
  const worst = PARTS.map(() => null), best = PARTS.map(() => null);
  for (const f of F) {
    if (f.r < 0) continue;
    const k = R_PART[f.r], w = R_W[f.r];
    if (!f.ok && f.p > 0) { if (!worst[k] || w * f.p > worst[k].v) worst[k] = { v: w * f.p, text: f.text }; } else if (f.ok && (!best[k] || w > best[k].v)) best[k] = { v: w, text: f.text };
  }
  // 따질 것이 없는 항목은 만점으로 둔다. 창문 없는 방의 채광 만점은 오해하기 쉬워서 따지지 않았다고 분명히 적는다
  const empty = ['가구를 놓으면 통로를 살펴볼게요.', '앞 공간이 필요한 가구가 없어요.', ctx.wins.length ? '창문이나 해당하는 가구가 없어요.' : '창문이 없어서 채광은 따지지 않았어요.', '침대가 없어요.', '해당하는 가구가 없어요.', '해당하는 가구가 없어요.', '짝을 이루는 가구가 없어요.'];
  const parts = PARTS.map((P, k) => {
    const score = clamp(Math.round(res.parts[k]), 0, P.max);
    const note = !res.den[k] ? empty[k] : score < P.max && worst[k] ? worst[k].text : best[k] ? best[k].text : worst[k] ? worst[k].text : '특별히 걸리는 점이 없어요.';
    return { key: P.key, label: P.label, score, max: P.max, note };
  });
  const total = clamp(parts.reduce((s, p) => s + p.score, 0) - 15 * res.errors, 0, 100);
  return { total, parts };
}

function makeWalk(ctx, g, list) {
  const snap = g ? { G: g.G, nx: g.nx, ny: g.ny, nc: g.nc, reach: g.reach.slice(0, g.nc) } : null;
  const byUid = new Map(list.map((p) => [p.uid, p]));
  let pts = null;
  return {
    get points() { // 필요할 때 한 번만 만든다(끌 때마다 수천 개를 만들지 않게)
      if (!pts) {
        pts = [];
        if (snap) for (let k = 0; k < snap.nc; k++) if (snap.reach[k]) pts.push({ x: (k % snap.nx) * snap.G, y: Math.floor(k / snap.nx) * snap.G });
      }
      return pts;
    },
    reachable(item) {
      if (!snap || !item) return false;
      const p = byUid.get(item.uid != null ? String(item.uid) : '') ?? norm(item, 0);
      return p.floor ? true : itemReach(snap, p) > 0;
    },
  };
}

// 배치 검사와 점수. error: 방 밖·겹침·문 여는 공간 / warn: 사용 공간·창 가림·통로·눈부심
export function checkLayout(room, items) {
  const ctx = makeCtx(room);
  const list = (Array.isArray(items) ? items : []).map(norm);
  const F = [], issues = [];
  const res = evaluate(ctx, list, 5, F, issues);
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  return { issues, walk: makeWalk(ctx, res.grid, list), score: makeScore(res, F, ctx) };
}

const wallName = ['위쪽', '오른쪽', '아래쪽', '왼쪽'];
function factsByUid(ctx, list, F, issues, goodOnly) {
  const out = {};
  for (const p of list) {
    const mine = F.filter((f) => f.uid === p.uid);
    const bad = goodOnly ? [] : mine.filter((f) => !f.ok).sort((a, b) => (R_W[b.r] ?? 0) * b.p - (R_W[a.r] ?? 0) * a.p);
    const good = mine.filter((f) => f.ok).sort((a, b) => REASON_RANK[a.r] - REASON_RANK[b.r]);
    const errs = goodOnly ? [] : issues.filter((i) => i.level === 'error' && (i.uid === p.uid || i.other === p.uid)).map((i) => i.msg);
    const lines = [...errs, ...bad.map((f) => f.text), ...good.map((f) => f.text)];
    const uniq = [...new Set(lines)].slice(0, goodOnly ? 3 : 6);
    if (!uniq.length) { // 걸리는 규칙이 없으면 위치만 사실대로
      const s = [0, 1, 2, 3].reduce((m, k) => (wd(p, k, ctx.W, ctx.D) < wd(p, m, ctx.W, ctx.D) ? k : m), 0);
      uniq.push(wd(p, s, ctx.W, ctx.D) <= 30 ? `${p.name} 자리는 ${wallName[s]} 벽 쪽에 있어요.` : `${p.name} 자리는 벽에서 떨어진 방 안쪽에 있어요.`);
    }
    out[p.uid] = uniq;
  }
  return out;
}

// 지금 배치의 사실 설명. 사용자가 옮긴 뒤에도 같은 규칙으로 다시 계산한다
export function explain(room, items) {
  const ctx = makeCtx(room);
  const list = (Array.isArray(items) ? items : []).map(norm);
  const F = [], issues = [];
  evaluate(ctx, list, 5, F, issues);
  return factsByUid(ctx, list, F, issues, false);
}

// 가운데를 기준으로 90도 돌리고, 방 안으로 밀어 넣는다
export function rotateItem(room, item) {
  const r = normalizeRoom(room);
  const b = body(item);
  const rot = (normRot(item.rot) + 90) % 360;
  const { w, h } = dims({ ...item, rot });
  const snap = (v) => Math.round(v / 5) * 5;
  const x = clamp(snap(b.x + b.w / 2 - w / 2), 0, Math.max(0, r.width - w));
  const y = clamp(snap(b.y + b.h / 2 - h / 2), 0, Math.max(0, r.depth - h));
  return { ...item, rot, x, y };
}

// ───────── 추천: 후보 자리 ─────────
// 놓는 순서: 침대 → 소파(TV와 마주 볼 벽이 필요해서 일찍) → 키 큰 수납 → 책상 → 나머지 수납·가전 → 식탁 → 짝 가구 → 그 밖 → 러그
function stage(p) {
  if (p.floor) return 9;
  if (p.role === 'bed') return 0;
  if (isSeat(p)) return 1;
  if (p.storage && p.tall) return 2;
  if (p.role === 'desk') return 3;
  if (p.storage || p.role === 'fridge' || p.role === 'appliance' || p.role === 'vanity') return 4;
  if (p.role === 'table') return 5;
  if (p.role === 'tv' || p.role === 'sofatable' || p.role === 'nightstand' || p.role === 'chair') return 6;
  return 7;
}

// 주인 가구 uid → 바로 따라 놓을 짝 가구들. 협탁은 침대, TV·소파 테이블은 소파(없으면 TV는 침대), 의자는 책상·화장대·식탁
function pairMap(solid) {
  const by = (f) => solid.filter(f).sort((a, b) => b.area - a.area || a.idx - b.idx);
  const beds = by((p) => p.role === 'bed'), seats = by(isSeat);
  const hosts = [...by((p) => p.role === 'desk'), ...by((p) => p.role === 'vanity'), ...by((p) => p.role === 'table')];
  const map = new Map();
  const add = (host, d) => { if (!host) return; if (!map.has(host.uid)) map.set(host.uid, []); map.get(host.uid).push(d); };
  let nNight = 0, nTv = 0, nTable = 0, nChair = 0;
  for (const p of solid) {
    if (p.role === 'nightstand') add(beds[Math.min(Math.floor(nNight++ / 2), beds.length - 1)], p);
    else if (p.role === 'tv') { if (nTv++ === 0) add(seats[0] || beds[0], p); } else if (p.role === 'sofatable') add(seats[nTable++], p);
    else if (p.role === 'chair') add(hosts[nChair++], p);
  }
  for (const list of map.values()) list.sort((a, b) => (a.role === 'tv' ? 0 : 1) - (b.role === 'tv' ? 0 : 1)); // TV 자리를 먼저 잡는다
  return map;
}

// 벽에 등을 붙이는 자리. 10cm씩 미끄러뜨리지 않고 구석·이웃 가구 옆·문과 창 끝 같은 "붙을 자리"만 만든다(H6)
function wallSlots(ctx, b, placed, sideways, out, step) {
  const { W, D } = ctx;
  const inB = b.role === 'fridge' ? 10 : 0, inS = b.role === 'fridge' ? 5 : 0; // 냉장고는 열이 빠지게 띄운다(S19)
  const bw = sideways ? b.sd : b.sw, bd = sideways ? b.sw : b.sd;
  const along = bw + 2 * inS, deep = bd + inB;
  for (let s = 0; s < 4; s++) {
    const horiz = s % 2 === 0;
    const L = horiz ? W : D;
    if (along > L || deep > (horiz ? D : W)) continue;
    const rot = sideways ? (s * 90 + 90) % 360 : s * 90;
    const ts = [0, L - along, (L - along) / 2];
    if (step) for (let t = step; t < L - along; t += step) ts.push(t);
    // 구석에 다른 가구가 딱 들어갈 만큼 남기는 자리(나중에 놓을 가구가 틈 없이 붙는다)
    for (const v of ctx.widths || []) ts.push(v, L - along - v);
    const add = (r, gap) => {
      if (wd(r, s, W, D) >= deep) return; // 이 벽 띠와 깊이로 겹치는 것만
      const a0 = horiz ? r.x : r.y, a1 = a0 + (horiz ? r.w : r.h);
      ts.push(a1, a0 - along);
      if (gap) ts.push(a1 + gap, a0 - along - gap);
    };
    for (const q of placed) {
      if (q.floor) continue;
      add(q, AISLE_CM);
      if (q.clear > 0) add(frontRect(q, q.rot, q.clear), 0);
    }
    for (const z of ctx.zones) add(z, 0);
    for (const w of ctx.wins) {
      if (w.side !== s) continue;
      ts.push(w.a1, w.a0 - along);
      if (b.sh <= w.sill) ts.push((w.a0 + w.a1 - along) / 2);
    }
    for (let t of ts) {
      t = Math.round(t);
      if (t < 0 || t > L - along) continue;
      const x = horiz ? t + inS : s === 3 ? inB : W - inB - bd;
      const y = s === 0 ? inB : s === 2 ? D - inB - bd : t + inS;
      out.push(put(b, x, y, rot));
    }
  }
}

// 방 안으로 밀어 넣기(가능하면 벽에서 margin만큼 띄움)
function nudge(ctx, r, margin) {
  const mx = r.w + 2 * margin <= ctx.W ? margin : 0, my = r.h + 2 * margin <= ctx.D ? margin : 0;
  return { x: Math.round(clamp(r.x, mx, ctx.W - r.w - mx)), y: Math.round(clamp(r.y, my, ctx.D - r.h - my)), w: r.w, h: r.h };
}

// 짝 가구 기준 자리: 협탁은 침대 머리 옆, 의자는 책상 앞, 소파 테이블은 소파 앞 40, TV는 앉는 자리 맞은편 벽, 러그는 침대 옆·소파 앞
function pairSlots(ctx, b, placed, out) {
  const find = (f) => placed.filter(f).sort((p, q) => q.area - p.area);
  const beds = find((p) => p.role === 'bed'), sofas = find(isSeat);
  const at = (r, rot) => out.push(put(b, Math.round(r.x), Math.round(r.y), rot));
  if (b.floor) {
    for (const [lw, ld] of [[b.sw, b.sd], [b.sd, b.sw]]) {
      // local()의 폭·깊이는 기준 가구의 방향을 따르므로 러그 rot은 놓인 모양을 보고 정한다
      const push = (r) => { const q = nudge(ctx, r, 20); at(q, q.w === b.sw && q.h === b.sd ? 0 : 90); };
      for (const bed of beds) {
        const tuck = Math.min(lw - (bed.big ? 45 : 30) - 10, Math.max(40, bed.sw / 2));
        if (tuck > 0) {
          const v = bed.sd / 3 + ((bed.sd * 2) / 3 - ld) / 2;
          push(local(bed, bed.sw - tuck, v, lw, ld));
          push(local(bed, tuck - lw, v, lw, ld));
        }
        push(local(bed, (bed.sw - lw) / 2, bed.sd - Math.min(ld / 2, 60), lw, ld));
      }
      for (const sf of sofas) push(local(sf, (sf.sw - lw) / 2, sf.sd - 20, lw, ld));
      if (!beds.length && !sofas.length) push({ x: (ctx.W - lw) / 2, y: (ctx.D - ld) / 2, w: lw, h: ld });
    }
    return;
  }
  if (b.role === 'nightstand') for (const bed of beds) { at(local(bed, -b.sw, 0, b.sw, b.sd), bed.rot); at(local(bed, bed.sw, 0, b.sw, b.sd), bed.rot); }
  if (b.role === 'chair') {
    const hosts = find((p) => p.role === 'desk').concat(find((p) => p.role === 'vanity'), find((p) => p.role === 'table'));
    for (const h of hosts) at(local(h, (h.sw - b.sw) / 2, h.sd, b.sw, b.sd), (h.rot + 180) % 360);
  }
  // 소파 테이블: 소파 앞 가운데가 막혀 있을 수 있어 양 끝에 맞춘 자리도 본다
  if (b.role === 'sofatable') for (const sf of sofas) for (const u of [(sf.sw - b.sw) / 2, 0, sf.sw - b.sw]) at(local(sf, u, sf.sd + 40, b.sw, b.sd), sf.rot);
  if (b.role === 'tv') {
    // 맞은편 벽에서 앉는 자리와 TV 폭의 절반 넘게 마주 보는 자리들(S21). 가운데 한 곳만 보면 침대 발치 등에 막혀 짝을 놓친다
    for (const seat of sofas.length ? sofas : beds) {
      const f = (seat.rot / 90 + 2) % 4, rot = f * 90, horiz = f % 2 === 0;
      const w = horiz ? b.sw : b.sd, h = horiz ? b.sd : b.sw;
      if (w > ctx.W || h > ctx.D) continue;
      const L = horiz ? ctx.W : ctx.D, s0 = horiz ? seat.x : seat.y, s1 = s0 + seat.sw;
      const lo = Math.max(0, Math.ceil(s0 - b.sw / 2)), hi = Math.min(L - b.sw, Math.floor(s1 - b.sw / 2));
      const ts = [clamp((s0 + s1 - b.sw) / 2, 0, L - b.sw), lo, hi, s0, s1 - b.sw];
      for (const q of placed) { // 이웃 가구에 딱 붙는 자리(어중간한 틈이 안 생기게)
        if (q.floor || q === seat || wd(q, f, ctx.W, ctx.D) >= b.sd) continue;
        const a0 = horiz ? q.x : q.y, a1 = a0 + (horiz ? q.w : q.h);
        ts.push(a1, a0 - b.sw);
      }
      for (let t = lo + 20; t < hi; t += 20) ts.push(t);
      for (const t of ts) {
        if (t < lo || t > hi) continue;
        at({ x: horiz ? t : f === 3 ? 0 : ctx.W - w, y: horiz ? (f === 0 ? 0 : ctx.D - h) : t }, rot);
      }
    }
  }
}

function slots(ctx, b, placed, step, tv) {
  const out = [];
  pairSlots(ctx, b, placed, out);
  if (b.floor) return out;
  wallSlots(ctx, b, placed, false, out, step);
  if (b.role === 'table') { // 식탁은 짧은 쪽을 벽에 대거나 넓은 방이면 가운데에도
    wallSlots(ctx, b, placed, true, out, step);
    if (ctx.W >= 350 && ctx.D >= 350) out.push(put(b, Math.round((ctx.W - b.sw) / 2), Math.round((ctx.D - b.sd) / 2), 0));
  }
  if (tv && isSeat(b) && ctx.area >= 130000) {
    // 넓은 방: 맞은편 벽이 TV 보기에 너무 멀면 소파를 벽에서 띄워 TV 거리를 맞춘다(낮은 분리 가구, S42)
    const dg = tvDiag(tv, ctx), off = Math.round(tv.sd + 1.4 * dg);
    for (let s = 0; s < 4; s++) { // s: 소파가 바라보는 벽
      const horiz = s % 2 === 0, span = horiz ? ctx.D : ctx.W, L = horiz ? ctx.W : ctx.D;
      if (span - b.sd - tv.sd <= 1.9 * dg || off + b.sd + 90 > span) continue;
      for (const c of [L / 2, L / 4, (3 * L) / 4]) {
        const t = Math.round(c - b.sw / 2);
        if (t < 0 || t + b.sw > L) continue;
        out.push(put(b, horiz ? t : s === 3 ? off : ctx.W - off - b.sd, horiz ? (s === 0 ? off : ctx.D - off - b.sd) : t, ((s + 2) % 4) * 90));
      }
    }
  }
  return out;
}

// 추천에서 강제하는 것: H1 방 안, H2 겹침, H3 문 여는 공간, H5 최소 사용 공간(내 것과 이미 놓인 가구의 것)
function feasible(ctx, all, c) {
  if (c.x < 0 || c.y < 0 || c.x + c.w > ctx.W || c.y + c.h > ctx.D) return false;
  for (const z of ctx.zones) if (overlaps(c, z)) return false; // 러그도 문 여는 공간은 피한다(S41)
  if (c.floor) return true;
  for (const q of all) if (q !== c && !q.floor && overlaps(c, q)) return false;
  for (const q of all) {
    if (q.floor) continue;
    if (q.role === 'bed') { if (bedSides(ctx, all, q).wide < 50) return false; } else if (q.clear > 0 && freeDepth(ctx, all, q, (q.rot / 90 + 2) % 4, q.minC) < q.minC) return false;
  }
  return true;
}

// ───────── 추천: 탐색 ─────────
const SEEDS = 6, BEAM = 3, TOP_K = 7, UNPLACED_COST = 30, MISS_COST = 3, GOOD_COST = 5, ELITE = 2, SOFT_COST = 4, MANY = 14;
// 놓는 순서 묶음(stage 번호 → 차례). 한 가지 순서로만 놓으면 먼저 놓은 가구가 뒤 가구에 꼭 필요한 자리를 차지해
// 더 좋은 배치를 놓칠 때가 있어서, 첫 순서의 결과가 아쉬우면 책상·수납·소파의 차례를 바꿔 다시 놓아 본다
const ORDERS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // 침대 → 소파 → 키 큰 수납 → 책상
  [0, 1, 3, 2, 4, 5, 6, 7, 8, 9], // 침대 → 소파 → 책상 → 키 큰 수납
  [0, 2, 3, 1, 4, 5, 6, 7, 8, 9], // 침대 → 책상 → 소파 → 키 큰 수납
];
const costOf = (total, un) => 100 - total + UNPLACED_COST * un;
// 탐색이 줄 세우는 값: 점수에서 경고 하나마다 SOFT_COST를 뺀다. 점수가 조금 높아도 경고가 붙은 안이 1번 안으로 나오지 않게
let SOFT = SOFT_COST;
const rate = (r) => r.total - SOFT * r.soft;
const slotKey = (c) => (c.x * 4096 + c.y) * 4 + c.rot / 90;

// 가구 b(와 짝 가구 deps)를 놓을 수 있는 자리들을 점수 높은 순으로.
// 도형 규칙으로 먼저 줄 세우고 위쪽 후보만 통로 격자를 계산한다. 짝 가구는 짝 자리가 있을 때만 같이 놓는다
function expand(ctx, G, placed, b, k, base, deps) {
  const seen = new Set();
  const list = [];
  const tv = deps && deps.find((d) => d.role === 'tv');
  const collect = (step) => {
    for (const c of slots(ctx, b, placed, step, tv)) {
      const key = slotKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      let all = placed.concat(c);
      if (!feasible(ctx, all, c)) continue;
      let miss = 0;
      if (deps) {
        for (const d of deps) {
          const opts = [];
          pairSlots(ctx, d, all, opts);
          let best = null, bs = -Infinity;
          for (const dc of opts) {
            const a2 = all.concat(dc);
            if (!feasible(ctx, a2, dc)) continue;
            const v = rate(evaluate(ctx, a2, 0));
            if (v > bs) { bs = v; best = a2; }
          }
          if (best) all = best; else miss++;
        }
      }
      list.push({ all, s: rate(evaluate(ctx, all, 0)) - MISS_COST * miss, miss });
    }
  };
  collect(0);
  if (!list.length && !b.floor) collect(20); // 붙을 자리가 없으면 벽을 따라 20cm씩 찾아본다
  list.sort((p, q) => q.s - p.s);
  if (b.floor) return list.slice(0, k).map((o) => ({ items: o.all, total: o.s, rank: o.s }));
  const out = [];
  for (let i = 0; i < list.length && out.length < k && i < k * 3; i++) {
    const r = evaluate(ctx, list[i].all, G);
    if (r.unreach > base) continue; // H4: 현관에서 닿지 않는 가구·문이 생기는 자리는 버린다
    out.push({ items: list[i].all, total: rate(r), rank: rate(r) - MISS_COST * list[i].miss });
  }
  return out.sort((p, q) => q.rank - p.rank);
}

const sameLayout = (a, b) => a.length === b.length && a.every((p) => b.some((q) => q.uid === p.uid && q.x === p.x && q.y === p.y && q.rot === p.rot));

// 다듬기: 하나씩(짝 가구는 주인과 함께) 다시 놓기, 두 가구 자리 맞바꾸기, 못 놓은 가구 다시 넣기. 점수가 오를 때만 받아들인다
function refine(ctx, G, st, base, pairs) {
  let cur = st;
  const better = (total, un) => costOf(total, un) < costOf(cur.total, cur.un.length) - 1e-9;
  const isDep = (p) => stage(p) === 6;
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (const u of [...cur.un]) {
      const ex = expand(ctx, G, cur.items, u, 4, base);
      if (ex.length && better(ex[0].total, cur.un.length - 1)) { cur = { items: ex[0].items, un: cur.un.filter((q) => q !== u), total: ex[0].total }; changed = true; }
    }
    const uids = cur.items.filter((p) => !p.floor).map((p) => p.uid);
    for (const uid of uids) {
      const me = cur.items.find((q) => q.uid === uid);
      const mine = (pairs.get(uid) || []).map((d) => cur.items.find((q) => q.uid === d.uid)).filter(Boolean);
      const rest = cur.items.filter((q) => q !== me && !mine.includes(q));
      const ex = expand(ctx, G, rest, me, 4, base, mine.length ? mine : undefined);
      if (!ex.length) continue;
      let cand = ex[0], ok = true;
      for (const d of mine) { // 짝 자리를 못 잡은 짝 가구는 벽 자리라도 찾는다
        if (cand.items.some((q) => q.uid === d.uid)) continue;
        const e2 = expand(ctx, G, cand.items, d, 3, base);
        if (!e2.length) { ok = false; break; }
        cand = e2[0];
      }
      if (ok && better(cand.total, cur.un.length)) { cur = { items: cand.items, un: cur.un, total: cand.total }; changed = true; }
    }
    const solidNow = cur.items.filter((p) => !p.floor && !isDep(p) && !pairs.has(p.uid)); // 짝이 얽힌 가구는 맞바꾸지 않는다
    for (let a = 0; a < solidNow.length; a++) {
      for (let b = a + 1; b < solidNow.length; b++) {
        const A = cur.items.find((q) => q.uid === solidNow[a].uid), B = cur.items.find((q) => q.uid === solidNow[b].uid);
        const rest = cur.items.filter((q) => q !== A && q !== B);
        const near = (list, t) => list.reduce((m, c) => (!m || Math.hypot(cx(c) - cx(t), cy(c) - cy(t)) < Math.hypot(cx(m) - cx(t), cy(m) - cy(t)) ? c : m), null);
        const a2 = near(slots(ctx, A, rest, 0).filter((c) => feasible(ctx, rest.concat(c), c)), B);
        if (!a2) continue;
        const withA = rest.concat(a2);
        const b2 = near(slots(ctx, B, withA, 0).filter((c) => feasible(ctx, withA.concat(c), c)), A);
        if (!b2) continue;
        const items = withA.concat(b2);
        const r = evaluate(ctx, items, G);
        if (r.unreach <= base && better(rate(r), cur.un.length)) { cur = { items, un: cur.un, total: rate(r) }; changed = true; }
      }
    }
    if (!changed) break;
  }
  return cur;
}

// 닮음: 같은 방향이고 중심이 80cm 안에 있는 가구의 넓이 비율. 큰 가구가 옮겨져야 다른 안으로 느껴진다
function similarity(A, B) {
  let same = 0, tot = 0;
  for (const a of A) {
    if (a.floor) continue;
    tot += a.area;
    const b = B.find((q) => q.uid === a.uid);
    if (b && b.rot === a.rot && Math.hypot(cx(a) - cx(b), cy(a) - cy(b)) < 80) same += a.area;
  }
  return tot ? same / tot : 1;
}

// 서로 다른 배치안 고르기(MMR). 첫 번째가 항상 가장 좋은 안
function pickDiverse(pool, max) {
  const picked = [];
  const rest = [...pool];
  while (rest.length && picked.length < max) {
    let bi = -1, bv = -Infinity;
    for (let i = 0; i < rest.length; i++) {
      const sim = picked.reduce((m, p) => Math.max(m, similarity(rest[i].items, p.items)), 0);
      if (picked.length && sim > 0.7) continue;
      const v = -rest[i].cost - 20 * sim;
      if (v > bv) { bv = v; bi = i; }
    }
    if (bi < 0) break;
    picked.push(rest.splice(bi, 1)[0]);
  }
  return picked;
}

function solve(ctx, bases) {
  const G = ctx.area <= 360000 ? 5 : 10; // 넓은 방은 탐색 중에만 성긴 격자(마지막 검사는 항상 5cm)
  // 가구가 많으면(15개부터) 시간이 길어지므로 맞춤 자리·다른 순서·덤 다듬기 없이 첫 순서 한 번만 돈다
  const many = bases.length > MANY;
  const widths = many ? [] : [...new Set(bases.filter((b) => !b.floor).map((b) => b.sw))];
  ctx.widths = widths;
  const byOrder = (ord) => (a, b) => ord[stage(a)] - ord[stage(b)] || b.area - a.area || a.idx - b.idx;
  const rugs = bases.filter((b) => b.floor).sort(byOrder(ORDERS[0]));
  const pairs = pairMap(bases.filter((b) => !b.floor).sort(byOrder(ORDERS[0])));
  const base = evaluate(ctx, [], G).unreach;
  const mk = (items, un, total) => ({ items, un, total, cost: costOf(total, un.length) });
  const finals = [], tried = new Set();
  try { // 도중에 오류가 나도 SOFT를 되돌린다
  for (const ord of many ? [ORDERS[0]] : [...ORDERS, null, ...ORDERS]) {
    if (!ord) {
      // 두 번째 바퀴: 못 놓은 가구가 남았을 때만. 경고 벌점과 맞춤 자리를 빼면 탐색 길이 달라져 다 놓는 배치를 찾을 때가 있다
      if (!finals.reduce((m, f) => (f.cost < m.cost ? f : m)).un.length) break;
      SOFT = 0; ctx.widths = []; tried.clear();
      continue;
    }
    const solid = bases.filter((b) => !b.floor).sort(byOrder(ord));
    const sig = solid.map((b) => b.idx).join();
    if (tried.has(sig)) continue; // 이 가구들로는 앞 순서와 똑같은 순서
    tried.add(sig);
    if (!solid.length) { finals.push(mk([], [], 100)); break; }
    // 첫 가구(보통 침대)의 자리를 벽·방향이 다른 것으로 여러 개 골라 씨앗으로 삼는다
    let firstIdx = 0, first = [];
    while (firstIdx < solid.length && !(first = expand(ctx, G, [], solid[firstIdx], 40, base, pairs.get(solid[firstIdx].uid))).length) firstIdx++;
    const skipped = solid.slice(0, firstIdx);
    const seeds = [];
    for (const s of first) {
      const c = s.items[0];
      if (seeds.length < SEEDS && seeds.every((t) => t.items[0].rot !== c.rot || Math.hypot(cx(t.items[0]) - cx(c), cy(t.items[0]) - cy(c)) >= 80)) seeds.push(s);
    }
    if (!seeds.length) finals.push(mk([], skipped, 100));
    for (const seed of seeds) {
      let beam = [mk(seed.items, skipped, seed.total)];
      for (let i = firstIdx + 1; i < solid.length; i++) {
        const b = solid[i];
        const next = [];
        for (const st of beam) {
          if (st.items.some((q) => q.uid === b.uid)) { next.push(st); continue; } // 주인과 함께 이미 놓인 짝 가구
          const ex = expand(ctx, G, st.items, b, TOP_K, base, pairs.get(b.uid));
          if (!ex.length) next.push(mk(st.items, [...st.un, b], st.total));
          for (let k = 0; k < ex.length && k < BEAM; k++) next.push(mk(ex[k].items, st.un, ex[k].total));
        }
        next.sort((p, q) => p.cost - q.cost);
        beam = [];
        for (const s of next) { if (beam.length < BEAM && !beam.some((t) => t.un.length === s.un.length && sameLayout(t.items, s.items))) beam.push(s); }
      }
      finals.push(...beam);
    }
    if (finals.some((f) => f.cost <= GOOD_COST)) break; // 이미 좋은 안이 나왔으면 다른 순서는 해 보지 않는다(시간 아끼기)
  }
  } finally { SOFT = SOFT_COST; ctx.widths = widths; }
  finals.sort((p, q) => p.cost - q.cost);
  // 서로 다른 안을 먼저 고른 뒤 그 안들만 다듬는다(다듬기가 가장 비싸다).
  // 점수가 가장 좋은 안들은 먼저 고른 안과 닮았어도 다듬는다(닮았다고 빼면 다듬은 뒤 가장 좋아질 배치를 놓친다)
  const picks = pickDiverse(finals, 5);
  for (let i = 0, extra = 0; i < finals.length && extra < ELITE && !many; i++) {
    if (picks.every((p) => similarity(finals[i].items, p.items) < 1)) { picks.push(finals[i]); extra++; }
  }
  const done = picks.map((st) => {
    let cur = refine(ctx, G, st, base, pairs);
    for (const rug of rugs) {
      const ex = expand(ctx, G, cur.items, rug, 1, base);
      if (ex.length) cur = { items: ex[0].items, un: cur.un, total: cur.total };
      else cur = { items: cur.items, un: [...cur.un, rug], total: cur.total };
    }
    // 마지막 점수는 화면과 같은 5cm 격자로 다시 잰다. 가구 순서는 입력 순서대로
    const items = [...cur.items].sort((a, b) => a.idx - b.idx);
    const F = [], issues = [];
    const res = evaluate(ctx, items, 5, F, issues);
    const score = makeScore(res, F, ctx);
    return { items, un: [...cur.un].sort((a, b) => a.idx - b.idx), F, issues, score, raw: 100 - score.total, cost: costOf(score.total - SOFT_COST * res.soft, cur.un.length) + (100 - res.total) / 1000 };
  });
  done.sort((p, q) => p.cost - q.cost);
  const minUn = done[0].un.length;
  const pool = done.filter((s) => s.un.length === minUn && s.raw <= done[0].raw + 15); // 점수가 15점 넘게 낮은 안은 보여 주지 않는다
  return pickDiverse(pool, 5);
}

let CACHE = { key: null, list: null };

// 추천 배치. 같은 입력이면 같은 결과(난수 없음). variant 0이 가장 좋은 안이고, variant % variants번째 안을 돌려준다
export function recommend(room, specs, variant = 0) {
  const ctx = makeCtx(room);
  const input = Array.isArray(specs) ? specs.filter((s) => s && typeof s === 'object') : [];
  const bases = input.map(norm);
  const used = new Set();
  for (const b of bases) { // uid가 겹치면 뒤에 번호를 붙인다
    let u = b.uid, k = 2;
    while (used.has(u)) u = `${b.uid}-${k++}`;
    b.uid = u;
    used.add(u);
  }
  const key = JSON.stringify([ctx.W, ctx.D, ctx.room.doors, ctx.room.windows, bases.map((b) => [b.uid, b.name, b.key, b.cat, b.sw, b.sd, b.sh, b.clear, b.tall, b.sideOk, b.floor, typeof b.src.query === 'string' ? b.src.query : ''])]);
  if (CACHE.key !== key) CACHE = { key, list: solve(ctx, bases) }; // variant만 바꿔 다시 부르는 일이 많다
  const list = CACHE.list;
  const v = list[((Math.trunc(fin(variant, 0)) % list.length) + list.length) % list.length];
  // 캐시에 남은 옛 사양(p.src)이 아니라 이번 입력을 펼친다(가격·색·출처는 키에 없어서 바뀌었을 수 있다)
  const full = (p) => { const src = input[p.idx]; return { ...src, uid: p.uid, name: p.name, category: p.cat, w: p.sw, d: p.sd, h: p.sh, clear: clamp(fin(src.clear, 0), 0, 150), tall: p.tall, sideOk: p.sideOk, floor: p.floor }; };
  return {
    items: v.items.map((p) => ({ ...full(p), x: p.x, y: p.y, rot: p.rot })),
    unplaced: v.un.map((p) => { const { x, y, rot, ...spec } = full(p); return spec; }),
    score: { total: v.score.total, parts: v.score.parts.map((p) => ({ ...p })) },
    reasons: factsByUid(ctx, v.items, v.F, v.issues, true),
    variants: list.length,
  };
}
