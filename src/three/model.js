// 3D 보기와 SketchUp 내보내기가 함께 쓰는 "모양 설계도".
// 방과 가구를 축에 나란한 상자 목록으로 만든다 → three.js와 SketchUp이 같은 목록을 그리므로 두 결과가 항상 같다.
// 외부 import 없음(브라우저·Node 양쪽). 단위 cm, 평면 좌표 (x, y)는 CONTRACT 1절, 높이는 b(아래)~t(위).

export const WALLS = ['top', 'bottom', 'left', 'right'];
export const WALL_T = 10; // 벽 두께
const ROTS = [0, 90, 180, 270];
const CATS = ['bed', 'desk', 'storage', 'seating', 'table', 'appliance', 'decor', 'etc'];
const HEX = /^#[0-9a-f]{6}$/i;

const num = (v, min, max, def) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// ---------- 색 ----------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
// f > 0 이면 밝게, f < 0 이면 어둡게
export const shade = (hex, f) => mix(hex, f > 0 ? '#ffffff' : '#000000', Math.abs(f));

const WHITE = '#f5f2ec', DARK = '#2c2c30', METAL = '#b4b8bd', SCREEN = '#15161a', GLASS = '#bcd9e6';
const DEFAULT_COLORS = { wall: '#f4f1ec', floor: '#d2b48c', main: '#d9c7ab', fabric: '#e6dccb', point: '#3d3d3d' };
const ROLE_KEYS = { '벽': 'wall', '바닥': 'floor', '메인 가구': 'main', '패브릭': 'fabric', '포인트': 'point' };

// 스타일 팔레트 → { wall, floor, main, fabric, point }. 빠지거나 잘못된 색은 기본색으로.
export function colorsOf(style) {
  const out = { ...DEFAULT_COLORS };
  const pal = Array.isArray(style?.palette) ? style.palette : [];
  pal.slice(0, 5).forEach((p, i) => {
    const key = ROLE_KEYS[p?.role] || Object.values(ROLE_KEYS)[i];
    if (key && typeof p?.hex === 'string' && HEX.test(p.hex)) out[key] = p.hex.toLowerCase();
  });
  return out;
}

// ---------- 방 ----------
// layout.js의 normalizeRoom과 같은 범위(CONTRACT 2절). 1단계에서는 layout.js를 import할 수 없어 여기서 직접 한다.
export function normRoom(r) {
  r = r && typeof r === 'object' ? r : {};
  const width = num(r.width, 150, 1500, 300), depth = num(r.depth, 150, 1500, 400), height = num(r.height, 200, 400, 240);
  const len = (wall) => (wall === 'top' || wall === 'bottom' ? width : depth);
  const list = (many, one) => (Array.isArray(many) ? many : one ? [one] : []).filter((o) => o && typeof o === 'object');
  const doors = list(r.doors, r.door).slice(0, 6).map((o) => {
    const wall = WALLS.includes(o.wall) ? o.wall : 'bottom';
    const size = Math.min(num(o.size, 60, 150, 90), len(wall));
    return { wall, size, offset: num(o.offset, 0, len(wall) - size, 0), kind: ['entry', 'bath', 'etc'].includes(o.kind) ? o.kind : 'etc' };
  });
  const windows = list(r.windows, r.window).slice(0, 8).map((o) => {
    const wall = WALLS.includes(o.wall) ? o.wall : 'top';
    const size = num(o.size, 30, len(wall), 120);
    const sill = num(o.sill, 0, height - 60, 90);
    return { wall, size, offset: num(o.offset, 0, len(wall) - size, 0), sill, height: num(o.height, 30, height - sill - 10, Math.min(120, height - sill - 10)) };
  });
  return { width, depth, height, doors, windows };
}

// 한 벽의 문·창문 구멍. 왼쪽(위)부터 정렬하고, 서로 겹치는 것은 뒤의 것을 버린다(겹친 구멍은 그릴 수 없다).
export function wallOpenings(room, wall) {
  const doorH = Math.min(205, room.height - 10);
  const ops = [
    ...room.doors.filter((o) => o.wall === wall).map((o) => ({ u0: o.offset, u1: o.offset + o.size, h0: 0, h1: doorH, door: true })),
    ...room.windows.filter((o) => o.wall === wall).map((o) => ({ u0: o.offset, u1: o.offset + o.size, h0: o.sill, h1: o.sill + o.height, door: false })),
  ].sort((a, b) => a.u0 - b.u0 || (b.door ? 1 : 0) - (a.door ? 1 : 0));
  const out = [];
  for (const o of ops) if (!out.length || o.u0 >= out[out.length - 1].u1 + 2) out.push(o);
  return out;
}

// 벽 기준 좌표(u: 벽을 따라, t: 벽 안쪽 면에서 바깥으로 +, 방 안쪽으로 -) → 평면 사각형
function wallRect(room, wall, u0, u1, t0, t1) {
  if (wall === 'top') return { x0: u0, x1: u1, y0: -t1, y1: -t0 };
  if (wall === 'bottom') return { x0: u0, x1: u1, y0: room.depth + t0, y1: room.depth + t1 };
  if (wall === 'left') return { x0: -t1, x1: -t0, y0: u0, y1: u1 };
  return { x0: room.width + t0, x1: room.width + t1, y0: u0, y1: u1 };
}
// 벽 기준 (u, t) → 평면 점
function wallPoint(room, wall, u, t) {
  const r = wallRect(room, wall, u, u, t, t);
  return [r.x0, r.y0];
}

// 방 모양. walls[이름] = { len, ops, boxes, polys }
//   boxes: 상자들. wall:1 은 벽 몸통 조각(SketchUp은 ops로 구멍 뚫린 벽을 직접 만들므로 건너뛴다)
//   polys: 비스듬히 열린 문짝처럼 축에 나란하지 않은 기둥 { pts: [[x,y]…], b, t, c }
export function roomModel(room, C) {
  const H = room.height, T = WALL_T;
  const frame = mix(C.wall, '#ffffff', 0.6); // 창틀: 벽보다 살짝 밝게
  const leaf = mix(C.main, '#ffffff', 0.45);
  const walls = {};
  for (const wall of WALLS) {
    const len = wall === 'top' || wall === 'bottom' ? room.width : room.depth;
    const ext = wall === 'top' || wall === 'bottom' ? T : 0; // 위·아래 벽이 모서리를 채운다
    const ops = wallOpenings(room, wall);
    const boxes = [], polys = [];
    const add = (c, u0, u1, b, t, t0, t1, extra) => {
      if (u1 - u0 > 0.01 && t - b > 0.01) boxes.push({ s: 'box', c, ...wallRect(room, wall, u0, u1, t0, t1), b, t, ...extra });
    };
    let u = -ext;
    for (const o of [...ops, null]) {
      const end = o ? o.u0 : len + ext;
      add(C.wall, u, end, 0, H, 0, T, { wall: 1 });
      add(shade(C.wall, -0.1), Math.max(u, 0), Math.min(end, len), 0, 8, -1.2, 0); // 걸레받이
      if (!o) break;
      add(C.wall, o.u0, o.u1, 0, o.h0, 0, T, { wall: 1 });
      add(C.wall, o.u0, o.u1, o.h1, H, 0, T, { wall: 1 });
      if (o.h0 > 8) add(shade(C.wall, -0.1), o.u0, o.u1, 0, 8, -1.2, 0);
      if (o.door) {
        const fc = shade(leaf, -0.12);
        add(fc, o.u0, o.u0 + 4, 0, o.h1, -1, T + 1);
        add(fc, o.u1 - 4, o.u1, 0, o.h1, -1, T + 1);
        add(fc, o.u0 + 4, o.u1 - 4, o.h1 - 4, o.h1, -1, T + 1);
        // 문짝: 방 안쪽으로 70도 열린 상태. 경첩은 가까운 모서리 쪽에 둔다(문이 옆벽 쪽으로 붙어 열려 방을 덜 가린다)
        const a = (70 * Math.PI) / 180, L = o.u1 - o.u0 - 8, flip = len - o.u1 < o.u0;
        const P = (along, thick) => wallPoint(room, wall, (flip ? o.u1 - 4 : o.u0 + 4) + (flip ? -1 : 1) * (Math.cos(a) * along - Math.sin(a) * thick), -(Math.sin(a) * along + Math.cos(a) * thick));
        polys.push({ pts: [P(0, 0), P(L, 0), P(L, 4), P(0, 4)], b: 1, t: o.h1 - 4, c: leaf });
        polys.push({ pts: [P(L - 12, -3), P(L - 5, -3), P(L - 5, 7), P(L - 12, 7)], b: 96, t: 100, c: METAL }); // 손잡이
      } else {
        const m = (o.u0 + o.u1) / 2;
        add(frame, o.u0, o.u1, o.h0, o.h0 + 4, 2, 8);
        add(frame, o.u0, o.u1, o.h1 - 4, o.h1, 2, 8);
        add(frame, o.u0, o.u0 + 4, o.h0 + 4, o.h1 - 4, 2, 8);
        add(frame, o.u1 - 4, o.u1, o.h0 + 4, o.h1 - 4, 2, 8);
        add(frame, m - 2, m + 2, o.h0 + 4, o.h1 - 4, 2, 8);
        add(GLASS, o.u0 + 4, o.u1 - 4, o.h0 + 4, o.h1 - 4, 4.5, 5.5, { o: 0.3, g: 1 });
        if (o.h0 > 8) add(frame, o.u0 - 3, o.u1 + 3, o.h0 - 3, o.h0, -5, 2); // 창대
      }
      u = o.u1;
    }
    walls[wall] = { len, ops, boxes, polys };
  }
  return { width: room.width, depth: room.depth, height: H, T, walls };
}

// 눈높이 시점이 설 자리와 볼 곳(평면 좌표) → { pos: [x, y], target: [x, y] }
// 현관문 가운데에서, 열린 문짝 끝(벽에서 약 0.94 × 문 폭 - 6cm)보다 조금 안쪽에 선다. 더 얕게 서면 문짝이 화면 3분의 1을 가린다.
// 문 폭보다 깊이 들어가지 않으므로 항상 문 여는 공간(가구가 없는 곳) 안이다. 방 가운데 너머를 봐서 좁은 방에서도 바닥만 내려다보지 않는다.
export function eyeView(room) {
  const { width: W, depth: D } = room, d = room.doors[0] || { wall: 'bottom', offset: W / 2 - 45, size: 90 };
  const across = d.wall === 'top' || d.wall === 'bottom' ? D : W;
  // shortcut: 방 깊이가 문 폭 × 2 + 70cm보다 얕으면 방 가운데를 넘지 않게 덜 들어가서 문짝이 조금 보인다. 거슬리면 그때 문짝을 숨기기.
  const pos = wallPoint(room, d.wall, d.offset + d.size / 2, -Math.min(d.size - 6, across / 2 - 40));
  return { pos, target: [W * 0.75 - pos[0] / 2, D * 0.75 - pos[1] / 2] };
}

// ---------- 가구 ----------
// 사용자 글은 SketchUp의 그룹·태그·재질 이름이 되므로 글자·숫자·기본 기호만 남긴다
export const cleanText = (v, max) => String(typeof v === 'string' || typeof v === 'number' ? v : '').normalize('NFC')
  .replace(/[^\p{L}\p{N} _\-·.,()+:×]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);

// 브라우저가 보낸 가구를 검증한다(CONTRACT 3절 범위). 쓸 수 없으면 null.
export function cleanItem(it, i = 0) {
  if (!it || typeof it !== 'object') return null;
  const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (!inRange(it.w, 10, 400) || !inRange(it.d, 10, 400) || !inRange(it.h, 1, 300)) return null;
  if (!inRange(it.x, -400, 1900) || !inRange(it.y, -400, 1900) || !ROTS.includes(it.rot)) return null;
  const text = cleanText;
  return {
    uid: text(it.uid, 40) || `i${i}`, key: text(it.key, 60), name: text(it.name, 40) || '가구',
    category: CATS.includes(it.category) ? it.category : 'etc',
    w: it.w, d: it.d, h: it.h, clear: num(it.clear, 0, 150, 0), floor: it.floor === true,
    color: typeof it.color === 'string' && HEX.test(it.color) ? it.color.toLowerCase() : null,
    x: it.x, y: it.y, rot: it.rot,
  };
}

// 이름·키의 낱말로 모양 종류를 고른다. 위에 있는 규칙이 먼저다(예: "침대 협탁"은 서랍장, "책상 의자"는 의자).
const KINDS = [
  [/러그|카펫|카페트|rug|carpet/, 'rug'],
  [/조명|무드등|램프|lamp/, 'lamp'],
  [/의자|체어|스툴|chair|stool/, 'chair'],
  [/협탁|서랍장|수납장|dresser|drawer|chest|nightstand/, 'drawer'],
  [/식탁|테이블|탁자|table/, 'table'],
  [/침대|매트리스|bed/, 'bed'],
  [/화장대|vanity/, 'vanity'],
  [/책상|데스크|desk/, 'desk'],
  [/책장|책꽂이|선반|bookshel|shelf/, 'bookshelf'],
  [/옷장|장롱|붙박이|wardrobe|closet/, 'wardrobe'],
  [/행거|hanger|rack/, 'hanger'],
  [/소파|쇼파|sofa|couch/, 'sofa'],
  [/tv|티비|텔레비전|거실장/, 'tv'],
  [/냉장고|fridge|refrigerator/, 'fridge'],
  [/세탁기|건조기|washer|dryer/, 'washer'],
  [/거울|mirror/, 'mirror'],
  [/화분|식물|몬스테라|plant/, 'plant'],
  [/피아노|piano/, 'piano'],
  [/스탠드/, 'lamp'],
];
export function kindOf(it) {
  const s = `${it.name || ''} ${it.key || ''}`.toLowerCase();
  if (it.floor) return 'rug';
  for (const [re, kind] of KINDS) if (re.test(s)) return kind;
  switch (it.category) {
    case 'bed': return 'bed';
    case 'desk': return 'desk';
    case 'storage': return it.h >= 120 ? 'wardrobe' : 'drawer';
    case 'seating': return it.w >= 100 ? 'sofa' : 'chair';
    case 'table': return 'table';
    case 'appliance': return it.h >= 120 ? 'fridge' : 'appliance';
    default: return 'box';
  }
}

// 같은 가구는 언제나 같은 모양이 되도록 uid로 씨앗을 만든 난수
function rng(seed) {
  let a = 2166136261;
  for (const ch of String(seed)) a = Math.imul(a ^ ch.codePointAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 부품 하나. 가구 기준 좌표: x는 폭의 가운데가 0, z는 깊이의 가운데가 0(등 = -d/2, 앞 = +d/2), y는 바닥에서 부품 아래까지.
const p = (c, w, h, d, x = 0, y = 0, z = 0, s = 'box', extra) => ({ c, w, h, d, x, y, z, s, ...extra });
const legs4 = (c, t, h, w, d, inset = t) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => p(c, t, h, t, sx * (w / 2 - inset), 0, sz * (d / 2 - inset))));

// 의자. back = +1이면 등받이가 앞쪽(+z)에 있다(책상을 바라보는 의자).
function chair(C, cx, cz, back, w = 44, d = 44, h = 84) {
  const sh = Math.min(45, h * 0.55);
  return [
    ...legs4(DARK, 3, sh - 5, w - 4, d - 4).map((q) => ({ ...q, x: q.x + cx, z: q.z + cz })),
    p(C.fabric, w, 7, d, cx, sh - 6, cz, 'soft'),
    p(shade(C.fabric, -0.06), w - 2, h - sh + 2, 6, cx, sh - 2, cz + back * (d / 2 - 3), 'soft'),
  ];
}

const BUILD = {
  bed({ w, d, h }, C) {
    const head = h >= 60 ? h : 85, n = w >= 135 ? 2 : 1, pw = Math.min(62, (w - 14) / n - 4);
    return [
      ...legs4(DARK, 5, 9, w, d, 7),
      p(C.main, w, 19, d, 0, 9, 0),
      p(C.main, w, head, 6, 0, 0, -d / 2 + 3),
      p(WHITE, w - 6, 20, d - 12, 0, 28, 3, 'soft'),
      ...Array.from({ length: n }, (_, i) => p(shade(C.fabric, 0.55), pw, 11, 36, (i - (n - 1) / 2) * (pw + 6), 47, -d / 2 + 30, 'soft')),
      p(C.fabric, w - 3, 21, d * 0.62, 0, 29.5, d / 2 - 2 - d * 0.31, 'soft'), // 매트리스보다 1cm 더 나와야 앞면이 겹쳐 지글거리지 않는다
      p(mix(C.fabric, C.point, 0.3), w - 2.5, 21.6, 16, 0, 29.5, d / 2 - 3 - d * 0.62 + 8, 'soft'), // 접어 올린 이불 단
    ];
  },
  desk({ w, d, h, clear }, C, it, vanity) {
    const top = [p(C.main, w, 3.5, d, 0, h - 3.5, 0), ...legs4(shade(C.main, -0.35), 4, h - 3.5, w, d, 5), p(shade(C.main, -0.12), w - 14, 22, 1.5, 0, h - 26, -d / 2 + 5)];
    const on = vanity
      ? [p(shade(C.main, -0.12), w * 0.62, 56, 3, 0, h, -d / 2 + 2), p('#d5e2e6', w * 0.62 - 6, 50, 1, 0, h + 3, -d / 2 + 3.8, 'box', { g: 1 })]
      : [
        p(DARK, 22, 1.5, 15, 0, h, -d / 2 + 13, 'soft'), p(DARK, 3, 12, 3, 0, h, -d / 2 + 11),
        p(SCREEN, Math.min(62, w * 0.5), 35, 2, 0, h + 8, -d / 2 + 12.5, 'box', { g: 1 }),
        p(DARK, Math.min(38, w * 0.35), 1.5, 12, 0, h, Math.min(d / 2 - 9, -d / 2 + 36), 'soft'),
      ];
    return [...top, ...on, ...(clear >= 35 ? chair(C, 0, d / 2 + 24, 1) : [])];
  },
  vanity: (it, C) => BUILD.desk(it, C, it, true),
  wardrobe({ w, d, h }, C) {
    const n = Math.max(1, Math.round(w / 50)), dw = w / n;
    return [
      p(shade(C.main, -0.3), w - 2, 6, d - 8, 0, 0, -2),
      p(shade(C.main, -0.18), w, h - 6, d - 4, 0, 6, -2),
      ...Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + dw * (i + 0.5), side = n === 1 ? 1 : i % 2 === 0 ? 1 : -1; // 손잡이는 짝이 되는 문 쪽에
        return [p(C.main, dw - 1, h - 8, 2, x, 7, d / 2 - 3), p(C.point, 1.6, 24, 2, x + side * (dw / 2 - 5), h * 0.45, d / 2 - 1)];
      }).flat(),
    ];
  },
  bookshelf({ w, d, h, uid }, C) {
    const rand = rng(uid), n = Math.max(2, Math.round(h / 36)), step = (h - 2.5) / n;
    const colors = [C.point, C.fabric, shade(C.point, 0.4), mix(C.point, '#c96f4a', 0.6), shade(C.fabric, -0.3), WHITE, '#6f8296'];
    const out = [
      p(C.main, 2.5, h, d, -w / 2 + 1.25), p(C.main, 2.5, h, d, w / 2 - 1.25), p(shade(C.main, -0.15), w - 5, h, 1.2, 0, 0, -d / 2 + 0.6),
      ...Array.from({ length: n + 1 }, (_, i) => p(C.main, w - 5, 2.5, d - 1.2, 0, i * step, 0.6)),
    ];
    for (let i = 0; i < n; i++) { // 칸마다 책을 60~95% 채운다
      const stop = -w / 2 + 3 + (w - 6) * (0.6 + rand() * 0.35), gap = step - 2.5;
      for (let x = -w / 2 + 3; ;) {
        const t = 3 + rand() * 3.5;
        if (x + t > stop) break;
        out.push(p(colors[Math.floor(rand() * colors.length)], t - 0.4, gap * (0.6 + rand() * 0.32), d * 0.68, x + t / 2, i * step + 2.5, d * 0.08));
        x += t;
      }
    }
    return out;
  },
  drawer({ w, d, h }, C) {
    const rows = Math.max(1, Math.round((h - 6) / 24)), rh = (h - 8) / rows;
    return [
      ...legs4(shade(C.main, -0.4), 4, 6, w, d, 5),
      p(shade(C.main, -0.18), w, h - 6, d - 4, 0, 6, -2),
      ...Array.from({ length: rows }, (_, i) => [
        p(C.main, w - 2, rh - 1.2, 2, 0, 7 + i * rh, d / 2 - 3),
        ...(w >= 70 ? [-w / 4, w / 4] : [0]).map((x) => p(C.point, 3.2, 3.2, 2, x, 7 + i * rh + rh / 2 - 2.2, d / 2 - 1, 'sph')),
      ]).flat(),
    ];
  },
  sofa({ w, d, h }, C) {
    const n = w >= 190 ? 3 : w >= 120 ? 2 : 1, arm = Math.min(16, w * 0.12), iw = w - arm * 2, cw = iw / n, back = Math.min(24, d * 0.3);
    return [
      ...legs4(DARK, 4, 8, w, d, 6),
      p(shade(C.fabric, -0.1), w, 22, d, 0, 8, 0, 'soft'),
      p(shade(C.fabric, -0.04), w, h - 14, back, 0, 14, -d / 2 + back / 2, 'soft'),
      ...[-1, 1].map((s) => p(shade(C.fabric, -0.04), arm, Math.max(20, h * 0.74 - 12), d, s * (w / 2 - arm / 2), 12, 0, 'soft')),
      ...Array.from({ length: n }, (_, i) => p(C.fabric, cw - 1, 14, d - back - 1, -iw / 2 + cw * (i + 0.5), 29, back / 2 - 0.5, 'soft')),
      p(C.point, Math.min(34, cw * 0.6), 30, 11, -iw / 2 + Math.min(20, cw * 0.4), 42, -d / 2 + back + 6, 'soft'), // 쿠션
    ];
  },
  table({ w, d, h, clear, name }, C) {
    const round = /원형|라운드|round/i.test(name || '');
    const out = round
      ? [p(C.main, w, 3.5, d, 0, h - 3.5, 0, 'cyl'), p(DARK, 8, h - 3.5, 8, 0, 0, 0, 'cyl'), p(DARK, Math.min(w, d) * 0.55, 2, Math.min(w, d) * 0.55, 0, 0, 0, 'cyl')]
      : [p(C.main, w, 3.5, d, 0, h - 3.5, 0), ...legs4(shade(C.main, -0.3), 5, h - 3.5, w, d, 6)];
    return [...out, ...(h >= 60 && clear >= 35 ? chair(C, 0, d / 2 + 22, 1) : [])];
  },
  tv({ w, d, h }, C) {
    if (d <= 15) return [p(SCREEN, w, Math.min(h, w * 0.58), d, 0, Math.max(0, 150 - Math.min(h, w * 0.58)), 0, 'box', { g: 1 })]; // 벽걸이
    const n = Math.max(1, Math.round(w / 45)), tw = Math.min(w * 0.86, 125), th = tw * 0.57;
    return [
      ...legs4(DARK, 3, 8, w, d, 6),
      p(shade(C.main, -0.18), w, h - 8, d - 2, 0, 8, -1),
      ...Array.from({ length: n }, (_, i) => p(C.main, w / n - 1, h - 11, 1.5, -w / 2 + (w / n) * (i + 0.5), 9.5, d / 2 - 1.25)),
      p(DARK, tw * 0.32, 1.5, Math.min(d * 0.6, 22), 0, h, 0, 'soft'), p(DARK, 6, 6, 3, 0, h, 0),
      p(SCREEN, tw, th, 3, 0, h + 6, 0, 'box', { g: 1 }),
    ];
  },
  hanger({ w, d, h, uid }, C) {
    const rand = rng(uid), colors = [C.fabric, C.point, WHITE, shade(C.point, 0.4), shade(C.fabric, -0.3), '#6f8296'];
    const out = [
      ...[-1, 1].flatMap((s) => [p(DARK, 3, 3, d, s * (w / 2 - 1.5)), p(METAL, 2.5, h, 2.5, s * (w / 2 - 1.5), 0, 0, 'cyl')]),
      p(METAL, w - 3, 2.5, 2.5, 0, h - 2.5, 0), p(C.main, w - 6, 2, d * 0.75, 0, 14, 0),
    ];
    for (let x = -w / 2 + 9; x < w / 2 - 9; x += 8 + rand() * 4) { // 걸린 옷
      const len = Math.min(h - 30, 55 + rand() * 45);
      out.push(p(colors[Math.floor(rand() * colors.length)], 5.5, len, Math.min(44, d * 0.85), x, h - 6 - len, 0, 'soft'));
    }
    return out;
  },
  mirror({ w, d, h }, C) {
    const t = Math.min(d, 4);
    return [
      p(shade(C.main, -0.25), w, h, t, 0, 0, -d / 2 + t / 2), p('#d5e2e6', w - 6, h - 6, 0.6, 0, 3, -d / 2 + t + 0.3, 'box', { g: 1 }),
      ...(d > 12 ? [p(shade(C.main, -0.25), w * 0.8, 2, d)] : []),
    ];
  },
  fridge({ w, d, h }, C) {
    const split = h >= 120 ? 0.62 : 1; // 큰 냉장고는 위아래 두 문
    return [
      p('#c2c6ca', w, h, d - 6, 0, 0, -3),
      p('#eceef0', w - 1, h * split - 2.5, 3, 0, 1.5, d / 2 - 4.5), p(METAL, 2, Math.min(40, h * 0.25), 2.5, -w / 2 + 6, h * split - 6 - Math.min(40, h * 0.25), d / 2 - 1.75),
      ...(split < 1 ? [p('#eceef0', w - 1, h * (1 - split) - 2, 3, 0, h * split + 0.5, d / 2 - 4.5), p(METAL, 2, Math.min(30, h * 0.18), 2.5, -w / 2 + 6, h * split + 5, d / 2 - 1.75)] : []),
    ];
  },
  washer({ w, d, h }) {
    const r = Math.min(w, h) * 0.62;
    return [
      p('#eef0f1', w, h, d - 3, 0, 0, -1.5, 'soft'), p('#3a3d42', w - 8, 7, 1, 0, h - 11, d / 2 - 2.5),
      p(METAL, r, r, 2, 0, h * 0.44 - r / 2, d / 2 - 2, 'cylf'), p('#30353c', r * 0.74, r * 0.74, 2.6, 0, h * 0.44 - r * 0.37, d / 2 - 1.5, 'cylf', { g: 1 }),
    ];
  },
  lamp({ w, d, h }, C) {
    const s = Math.min(w, d), sh = Math.min(30, h * 0.42);
    return [
      p(DARK, s * 0.72, 2, s * 0.72, 0, 0, 0, 'cyl'), p(DARK, 2.4, h - sh, 2.4, 0, 2, 0, 'cyl'),
      p(mix(shade(C.fabric, 0.5), '#ffe2ae', 0.5), s, sh, s, 0, h - sh, 0, 'shade', { e: 1 }),
    ];
  },
  plant({ w, d, h, uid }, C) {
    const rand = rng(uid), s = Math.min(w, d), ph = Math.min(h * 0.3, 36), greens = ['#5f8a4e', '#6f9a58', '#4d7742', '#7ba565'];
    const out = [p(mix('#b5654a', C.point, 0.25), s * 0.62, ph, s * 0.62, 0, 0, 0, 'pot'), p('#6b4a2f', 3, h * 0.4, 3, 0, ph - 1, 0, 'cyl')];
    const fs = s * 0.62, fh = h * 0.34;
    out.push(p(greens[0], fs * 1.15, fh * 1.15, fs * 1.15, 0, h - fh * 1.15, 0, 'sph'));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rand(), r = (s - fs) / 2;
      out.push(p(greens[1 + (i % 3)], fs, fh, fs, Math.cos(a) * r, ph + (h - ph - fh) * (0.25 + rand() * 0.55), Math.sin(a) * r, 'sph'));
    }
    return out;
  },
  rug({ w, d, h, name }, C) {
    const s = /원형|라운드|round/i.test(name || '') ? 'cyl' : 'box', t = Math.min(h, 1.5), c = mix(C.fabric, C.point, 0.3);
    return [p(c, w, t, d, 0, 0, 0, s), p(shade(C.fabric, 0.15), w - 14, t + 0.3, d - 14, 0, 0, 0, s), p(mix(C.fabric, C.point, 0.15), w - 34, t + 0.6, d - 34, 0, 0, 0, s)]
      .filter((q) => q.w > 2 && q.d > 2);
  },
  piano({ w, d, h }) {
    return [
      ...[-1, 1].map((s) => p(DARK, 4, h - 14, d * 0.7, s * (w / 2 - 8), 0, 0)), p(DARK, w - 20, 4, 3, 0, 18, 0),
      p('#1e1e21', w, 12, d, 0, h - 14, 0, 'soft'), p(WHITE, w - 10, 1.2, d * 0.38, 0, h - 2, d / 2 - d * 0.19 - 2),
      p(DARK, w * 0.42, 18, 1.5, 0, h - 2, -d / 2 + 4),
    ];
  },
  chair: ({ w, d, h }, C) => chair(C, 0, 0, -1, w, d, h),
  appliance({ w, d, h }) {
    return [p('#e9ebec', w, h, d - 2, 0, 0, -1, 'soft'), p('#3a3d42', w * 0.7, h * 0.6, 1.5, -w * 0.1, h * 0.2, d / 2 - 1.5, 'box', { g: 1 })];
  },
  box({ w, d, h, color }, C) {
    const base = Math.min(5, h * 0.2), c = color || C.main;
    return [p(shade(c, -0.3), Math.max(2, w - 5), base, Math.max(2, d - 5)), p(c, w, h - base, d, 0, base, 0, 'soft')];
  },
};

// 가구 기준 좌표의 부품 목록
export function furnitureParts(it, C) {
  return (BUILD[kindOf(it)] || BUILD.box)(it, C, it).filter((q) => q.w > 0.05 && q.h > 0.05 && q.d > 0.05);
}

// 회전이 적용된 몸체 크기(CONTRACT 3절)
export const rotDims = (it) => (it.rot % 180 === 0 ? { w: it.w, h: it.d } : { w: it.d, h: it.w });

// 가구 한 개를 방 좌표의 상자 목록으로. 회전 계산은 여기 한 곳에서만 한다.
// rot는 위에서 봤을 때 시계 방향 각도(평면도 SVG의 rotate와 같다): 0이면 앞이 +y, 90이면 앞이 -x.
export function itemBoxes(it, C) {
  const { w: bw, h: bh } = rotDims(it), cx = it.x + bw / 2, cy = it.y + bh / 2;
  const [cos, sin] = [[1, 0], [0, 1], [-1, 0], [0, -1]][ROTS.indexOf(it.rot)] || [1, 0];
  const turned = it.rot % 180 !== 0;
  return furnitureParts(it, C).map(({ c, w, h, d, x, y, z, s, ...extra }) => {
    const px = cx + x * cos - z * sin, py = cy + x * sin + z * cos;
    const ex = (turned ? d : w) / 2, ey = (turned ? w : d) / 2;
    // cylf(앞뒤로 누운 원통)는 돌리면 축이 바뀐다
    return { s, c, x0: px - ex, x1: px + ex, y0: py - ey, y1: py + ey, b: y, t: y + h, ...(s === 'cylf' ? { ax: turned ? 'x' : 'y' } : null), ...extra };
  });
}
