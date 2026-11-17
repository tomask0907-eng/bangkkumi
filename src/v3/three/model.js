// 3D 보기(v3 "커머스 클린")의 모양 설계도. 방과 가구를 상자 목록으로 만든다.
// src/three/model.js 에서 갈라 나왔다: 모양 계산은 같고, 색 규칙만 docs/design-v3/a/notes.md 6절로 바꿨다.
// 외부 import 없음(브라우저·Node 양쪽). 단위 cm, 평면 좌표 (x, y), 높이는 b(아래)~t(위).

export const WALLS = ['top', 'bottom', 'left', 'right'];
export const WALL_T = 8; // 벽 두께(평면도와 같다)
export const SLAB = 12; // 바닥 판 두께
const ROTS = [0, 90, 180, 270];
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

// 방은 스타일과 상관없이 같은 색이다(notes.md 6절)
export const SCENE = { floor: '#f5eee3', wall: '#ffffff', cut: '#c9d3df', frame: '#d5dde7', glass: '#cfe2f3' };
const WHITE = '#ffffff', SEAM = '#bac4d0', METAL = '#c9d3df', STEEL = '#7f8c9d', DARK = '#3d4756', SCREEN = '#d6e3f0', LAMP = '#fff3d2';
const GREENS = ['#5ba688', '#3f8c6e', '#6db698'];
const DEFAULT_PALETTE = ['#f3f6f8', '#e3cdae', '#8fb8de', '#f2c6a0', '#3f5f7f']; // 시안의 북유럽

const luma = (hex) => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const isHex = (v) => typeof v === 'string' && HEX.test(v);

// 스타일 팔레트(벽, 바닥, 메인 가구, 패브릭, 포인트) → 시안의 5색 [--c1 벽, --c2 메인 가구, --c3 패브릭, --c4 포인트, --c5 짙은 색].
// 평면도의 paletteVars(src/v3/symbols.jsx)와 같은 대응이다: 바닥색은 쓰지 않고, 짙은 색은 다섯 색 가운데 가장 어두운 색.
export function paletteFive(style) {
  const pal = (Array.isArray(style?.palette) ? style.palette : []).slice(0, 5).map((p) => (isHex(p?.hex) ? p.hex.toLowerCase() : null));
  const valid = pal.filter(Boolean);
  const darkest = valid.length ? [...valid].sort((a, b) => luma(a) - luma(b))[0] : null;
  const dark = darkest && (luma(darkest) < 0.4 ? darkest : mix(darkest, '#141a23', 0.6));
  return [pal[0], pal[2], pal[3], pal[4], dark].map((v, i) => v || DEFAULT_PALETTE[i]);
}

// 스타일 5색 → 가구 역할 색. 평면도와 같은 식이다(tokens.css 의 --pw, --pb, --pb2, --pr).
// css 에 화면의 --c1~--c5 값을 주면 그 값이 먼저다. 없으면 팔레트에서 평면도와 같은 대응으로 만든다(어느 쪽이든 평면도와 같은 색).
export function colorsOf(style, css = []) {
  const five = paletteFive(style);
  const c = five.map((def, i) => (isHex(css[i]) ? css[i].toLowerCase() : def));
  const tint = (hex, k) => mix('#ffffff', hex, k);
  const wood = tint(c[1], 0.66);
  return { wood, wood2: shade(wood, -0.1), fabric: tint(c[2], 0.56), fabric2: tint(c[2], 0.26), rug: tint(c[3], 0.58), small: c[4], c3: c[2], c4: c[3], body: WHITE };
}

// 사진·링크로 추가한 가구(spec.tint = '#rrggbb')는 스타일 색 대신 그 가구의 대표 색으로 칠한다.
// 섞는 비율은 스타일 색과 같다(평면도의 tintVars 와 같은 값). 책·옷·소품 색(small, c3, c4)은 그대로 둔다.
export function tintColors(C, tint) {
  if (!isHex(tint)) return C;
  const t = (k) => mix('#ffffff', tint.toLowerCase(), k), wood = t(0.66);
  return { ...C, wood, wood2: shade(wood, -0.1), fabric: t(0.56), fabric2: t(0.26), rug: t(0.58), body: wood };
}

// ---------- 방 ----------
// layout.js의 normalizeRoom과 같은 범위(CONTRACT 2절)
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
function wallPoint(room, wall, u, t) {
  const r = wallRect(room, wall, u, u, t, t);
  return [r.x0, r.y0];
}

// 방 모양. walls[이름] = { boxes, polys }
//   벽 몸통은 잘린 면 색(윗면과 끝면에 보인다)이고, 방 안쪽 면에만 흰 판을 얇게 덧댄다.
//   polys: 비스듬히 열린 문짝처럼 축에 나란하지 않은 기둥 { pts: [[x,y]…], b, t, c }
export function roomModel(room) {
  const H = room.height, T = WALL_T, S = SCENE;
  const walls = {};
  for (const wall of WALLS) {
    const len = wall === 'top' || wall === 'bottom' ? room.width : room.depth;
    const ext = wall === 'top' || wall === 'bottom' ? T : 0; // 위·아래 벽이 모서리를 채운다
    const boxes = [], polys = [];
    const add = (c, u0, u1, b, t, t0, t1, extra) => {
      if (u1 - u0 > 0.01 && t - b > 0.01) boxes.push({ s: 'box', c, ...wallRect(room, wall, u0, u1, t0, t1), b, t, ...extra });
    };
    const body = (u0, u1, b, t) => {
      add(S.cut, u0, u1, b, t, 0, T);
      add(S.wall, Math.max(u0, 0), Math.min(u1, len), b, t, -0.4, 0, { e: 0.13 }); // 살짝 스스로 밝아야 그늘진 벽도 흰색으로 보인다
    };
    let u = -ext;
    for (const o of [...wallOpenings(room, wall), null]) {
      body(u, o ? o.u0 : len + ext, 0, H);
      if (!o) break;
      body(o.u0, o.u1, 0, o.h0);
      body(o.u0, o.u1, o.h1, H);
      if (o.door) {
        add(S.frame, o.u0, o.u0 + 4, 0, o.h1, -1, T + 1);
        add(S.frame, o.u1 - 4, o.u1, 0, o.h1, -1, T + 1);
        add(S.frame, o.u0 + 4, o.u1 - 4, o.h1 - 4, o.h1, -1, T + 1);
        // 문짝: 방 안쪽으로 70도 열린 상태. 경첩은 가까운 모서리 쪽에 둔다(문이 옆벽 쪽으로 붙어 열려 방을 덜 가린다)
        const a = (70 * Math.PI) / 180, L = o.u1 - o.u0 - 8, flip = len - o.u1 < o.u0;
        const P = (along, thick) => wallPoint(room, wall, (flip ? o.u1 - 4 : o.u0 + 4) + (flip ? -1 : 1) * (Math.cos(a) * along - Math.sin(a) * thick), -(Math.sin(a) * along + Math.cos(a) * thick));
        polys.push({ pts: [P(0, 0), P(L, 0), P(L, 4), P(0, 4)], b: 1, t: o.h1 - 4, c: WHITE });
        polys.push({ pts: [P(L - 12, -2), P(L - 6, -2), P(L - 6, 6), P(L - 12, 6)], b: 96, t: 99, c: STEEL }); // 손잡이
      } else {
        const m = (o.u0 + o.u1) / 2;
        add(S.frame, o.u0, o.u1, o.h0, o.h0 + 3, 1.5, 6.5);
        add(S.frame, o.u0, o.u1, o.h1 - 3, o.h1, 1.5, 6.5);
        add(S.frame, o.u0, o.u0 + 3, o.h0 + 3, o.h1 - 3, 1.5, 6.5);
        add(S.frame, o.u1 - 3, o.u1, o.h0 + 3, o.h1 - 3, 1.5, 6.5);
        add(S.frame, m - 1.5, m + 1.5, o.h0 + 3, o.h1 - 3, 1.5, 6.5);
        add(S.glass, o.u0 + 3, o.u1 - 3, o.h0 + 3, o.h1 - 3, 3.5, 4.5, { o: 0.55, g: 1 });
        if (o.h0 > 8) add(WHITE, o.u0 - 3, o.u1 + 3, o.h0 - 3, o.h0, -5, 1.5); // 창대
      }
      u = o.u1;
    }
    walls[wall] = { boxes, polys };
  }
  return { T, walls };
}

// 눈높이 시점이 설 자리와 볼 곳(평면 좌표) → { pos: [x, y], target: [x, y] }
// 현관문 가운데에서, 열린 문짝 끝보다 조금 안쪽에 선다. 문 폭보다 깊이 들어가지 않으므로 항상 문 여는 공간(가구가 없는 곳) 안이다.
export function eyeView(room) {
  const { width: W, depth: D } = room, d = room.doors[0] || { wall: 'bottom', offset: W / 2 - 45, size: 90 };
  const across = d.wall === 'top' || d.wall === 'bottom' ? D : W;
  // shortcut: 방 깊이가 문 폭 × 2 + 70cm보다 얕으면 덜 들어가서 문짝이 조금 보인다. 거슬리면 그때 문짝을 숨기기.
  const pos = wallPoint(room, d.wall, d.offset + d.size / 2, -Math.min(d.size - 6, across / 2 - 40));
  return { pos, target: [W * 0.75 - pos[0] / 2, D * 0.75 - pos[1] / 2] };
}

// ---------- 가구 ----------
// 이름·키의 낱말로 모양 종류를 고른다. 위에 있는 규칙이 먼저다(예: "침대 협탁"은 서랍장, "책상 의자"는 의자, "소파베드"는 소파).
const KINDS = [
  [/러그|카펫|카페트|rug|carpet/, 'rug'],
  [/조명|무드등|램프|lamp/, 'lamp'],
  [/빈백|beanbag/, 'box'],
  [/소파|쇼파|sofa|couch|리클라이너|recliner/, 'sofa'],
  [/의자|체어|스툴|chair|stool/, 'chair'],
  [/협탁|서랍장|수납장|신발|dresser|drawer|chest|nightstand|shoe/, 'drawer'],
  [/식탁|테이블|탁자|table/, 'table'],
  [/침대|매트리스|bed/, 'bed'],
  [/화장대|vanity/, 'vanity'],
  [/책상|데스크|desk/, 'desk'],
  [/책장|책꽂이|선반|bookshel|shelf/, 'bookshelf'],
  [/옷장|장롱|붙박이|wardrobe|closet/, 'wardrobe'],
  [/행거|옷걸이|건조대|hanger|rack/, 'hanger'],
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

// 앞판(문·서랍)을 cols × rows 칸으로 나눈다. 뒤에 깐 얇은 판이 칸 사이 틈(0.8cm)으로 보여서 가는 선이 된다.
// 앞판 두께 2.5cm가 깊이 d 안에 들어간다(몸통은 d - 2.5 까지만 만든다). 바깥 가장자리는 몸통과 딱 맞춘다(어긋나면 가는 줄이 지글거린다).
function fronts(c, seam, w, h, d, cols, rows, y0 = 0) {
  const cw = w / cols, rh = (h - y0) / rows, out = [p(seam, w - 1, h - y0 - 2, 0.5, 0, y0 + 0.5, d / 2 - 2.25)];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x0 = -w / 2 + cw * i + (i ? 0.4 : 0), x1 = -w / 2 + cw * (i + 1) - (i < cols - 1 ? 0.4 : 0);
    out.push(p(c, x1 - x0, rh - 0.8, 2, (x0 + x1) / 2, y0 + rh * j + 0.8, d / 2 - 1));
  }
  return out;
}

// 의자: 가는 다리, 얇은 좌판, 떠 있는 등받이. back = +1이면 등받이가 앞쪽(+z)에 있다(책상을 바라보는 의자).
function chair(C, cx, cz, back, w = 40, d = 40, h = 82) {
  const sh = Math.min(45, h * 0.55), bh = Math.min(20, h - sh - 6), bz = cz + back * (d / 2 - 2);
  return [
    ...legs4(C.wood2, 3, sh - 5, w, d, 2.5).map((q) => ({ ...q, x: q.x + cx, z: q.z + cz })),
    p(C.fabric, w, 5, d, cx, sh - 5, cz, 'soft'),
    ...[-1, 1].map((s) => p(C.wood2, 3, h - sh - bh + 2, 3, cx + s * (w / 2 - 2.5), sh, bz)),
    p(C.fabric, w, bh, 4, cx, h - bh, bz, 'soft'),
  ];
}

const BUILD = {
  bed({ w, d, h }, C) {
    if (h >= 150) { // 벙커 침대: 기둥 넷 + 높은 판 + 매트리스 + 난간
      const top = h - 34;
      return [
        ...legs4(C.wood, 6, h, w, d, 3), p(C.wood, w, 8, d, 0, top - 8), ...[-1, 1].map((s) => p(C.wood, w - 12, 4, 3, 0, h - 6, s * (d / 2 - 1.5))),
        p(WHITE, w - 14, 14, d - 14, 0, top, 0, 'soft'), p(C.fabric, w - 12, 16, d * 0.6, 0, top, d / 2 - 6 - d * 0.3, 'soft'),
      ];
    }
    const bare = h <= 30; // 저상 매트리스: 틀과 머리판 없이
    const top = h > 60 ? 45 : h, fb = bare ? 4 : Math.min(26, top * 0.55), n = w >= 135 ? 2 : 1, pw = Math.min(62, (w - 14) / n - 4);
    return [
      p(C.wood, w, fb, d),
      ...(bare ? [] : [p(C.wood, w, h > 60 ? h : top + 43, 6, 0, 0, -d / 2 + 3)]),
      p(WHITE, w - 6, top - fb, d - 10, 0, fb, 3, 'soft'),
      ...Array.from({ length: n }, (_, i) => p(WHITE, pw, 9, 36, (i - (n - 1) / 2) * (pw + 6), top - 1, -d / 2 + 32, 'soft')),
      p(C.fabric, w - 2, top - fb + 3, d * 0.66, 0, fb, d / 2 - 1 - d * 0.33, 'soft'), // 매트리스보다 조금 더 나와야 앞면이 겹쳐 지글거리지 않는다
      p(C.fabric2, w - 1.6, 2, 20, 0, top + 2.4, d / 2 - 1 - d * 0.66 + 10, 'soft'), // 접어 올린 이불 단
    ];
  },
  desk({ w, d, h: full, clear }, C, it, vanity) {
    const h = vanity ? Math.min(full, 75) : full, mh = Math.max(40, full - h); // 화장대 높이는 거울까지 잰 값이다
    const mx = w >= 90 && !vanity ? -w * 0.16 : 0, mw = Math.min(44, w * 0.36), back = -d / 2;
    const on = vanity
      ? [p(C.wood, w * 0.62, mh, 3, 0, h, back + 2), p(SCREEN, w * 0.62 - 6, mh - 6, 0.6, 0, h + 3, back + 3.8, 'box', { g: 1 })]
      : [
        p(DARK, 8, 9, 8, mx, h, back + 13), p(DARK, mw, 27, 3, mx, h + 9, back + 13.5), p(SCREEN, mw - 3, 24, 0.6, mx, h + 10.5, back + 15.2, 'box', { g: 1 }),
        p(WHITE, Math.min(32, w * 0.3), 1.5, 10, mx, h, Math.min(d / 2 - 7, back + 34)),
        ...(w >= 100 ? [p(C.c4, 17, 2.5, 23, w * 0.27, h, Math.min(d / 2 - 13, back + 26))] : []), // 공책
      ];
    return [
      p(C.wood, w, 4, d, 0, h - 4), ...[-1, 1].map((s) => p(WHITE, 4, h - 4, d, s * (w / 2 - 2))),
      ...on, ...(clear >= 35 ? chair(C, mx, d / 2 + 22, 1) : []),
    ];
  },
  vanity: (it, C) => BUILD.desk(it, C, it, true),
  wardrobe({ w, d, h }, C) {
    const n = Math.max(1, Math.round(w / 50)), dw = w / n, B = C.body || WHITE;
    return [
      p(B, w, h, d - 2.5, 0, 0, -1.25), ...fronts(B, B === WHITE ? SEAM : shade(B, -0.18), w, h, d, n, 1, 3),
      ...Array.from({ length: n }, (_, i) => p(STEEL, 1.2, 22, 1.4, -w / 2 + dw * (i + 0.5) + (n === 1 || i % 2 === 0 ? 1 : -1) * (dw / 2 - 4), h * 0.46, d / 2 + 0.3)), // 손잡이는 짝이 되는 문 쪽에
    ];
  },
  bookshelf({ w, d, h, uid }, C) {
    const rand = rng(uid), n = Math.max(2, Math.round(h / 36)), step = (h - 2.5) / n;
    const colors = [WHITE, C.small, C.c3, WHITE, C.small, C.c4, C.c3];
    const out = [
      p(C.wood, 2.5, h, d, -w / 2 + 1.25), p(C.wood, 2.5, h, d, w / 2 - 1.25), p(shade(C.wood, 0.5), w - 5, h, 1.2, 0, 0, -d / 2 + 0.6),
      ...Array.from({ length: n + 1 }, (_, i) => p(C.wood, w - 5, 2.5, d - 1.2, 0, i * step, 0.6)),
    ];
    for (let i = 0; i < n; i++) { // 칸마다 책을 60~95% 채운다
      const stop = -w / 2 + 3 + (w - 6) * (0.6 + rand() * 0.35), gap = step - 2.5;
      for (let x = -w / 2 + 3; ;) {
        const t = 4 + rand() * 3;
        if (x + t > stop) break;
        out.push(p(colors[Math.floor(rand() * colors.length)], t - 0.5, gap * (0.62 + rand() * 0.28), d * 0.68, x + t / 2, i * step + 2.5, d * 0.08));
        x += t;
      }
    }
    return out;
  },
  drawer({ w, d, h }, C) {
    const rows = Math.max(1, Math.round(h / 26)), rh = (h - 2) / rows;
    return [
      p(C.wood, w, h, d - 2.5, 0, 0, -1.25), ...fronts(C.wood, C.wood2, w, h, d, 1, rows, 2),
      ...Array.from({ length: rows }, (_, i) => p(STEEL, Math.min(14, w * 0.3), 1.2, 1.2, 0, 2 + rh * (i + 0.62), d / 2 + 0.3)),
    ];
  },
  sofa({ w, d, h }, C) {
    const n = w >= 190 ? 3 : w >= 120 ? 2 : 1, arm = Math.min(16, w * 0.12), iw = w - arm * 2, cw = iw / n, back = Math.min(24, d * 0.3);
    return [
      ...legs4(C.wood2, 4, 8, w, d, 6),
      p(shade(C.fabric, -0.08), w, 22, d, 0, 8, 0, 'soft'),
      p(shade(C.fabric, -0.04), w, h - 14, back, 0, 14, -d / 2 + back / 2, 'soft'),
      ...[-1, 1].map((s) => p(shade(C.fabric, -0.04), arm, Math.max(20, h * 0.74 - 12), d, s * (w / 2 - arm / 2), 12, 0, 'soft')),
      ...Array.from({ length: n }, (_, i) => p(C.fabric, cw - 1, 14, d - back - 1, -iw / 2 + cw * (i + 0.5), 29, back / 2 - 0.5, 'soft')),
      p(C.c4, Math.min(34, cw * 0.6), 30, 11, -iw / 2 + Math.min(20, cw * 0.4), 42, -d / 2 + back + 6, 'soft'), // 쿠션
    ];
  },
  table({ w, d, h, clear, name }, C) {
    const round = /원형|라운드|round/i.test(name || '');
    const out = round
      ? [p(C.wood, w, 3.5, d, 0, h - 3.5, 0, 'cyl'), p(C.wood2, 8, h - 3.5, 8, 0, 0, 0, 'cyl'), p(C.wood2, Math.min(w, d) * 0.55, 2, Math.min(w, d) * 0.55, 0, 0, 0, 'cyl')]
      : [p(C.wood, w, 3.5, d, 0, h - 3.5), ...legs4(C.wood2, 4, h - 3.5, w, d, 5)];
    return [...out, ...(h >= 60 && clear >= 35 ? chair(C, 0, d / 2 + 22, 1) : [])];
  },
  tv({ w, d, h }, C) {
    if (d <= 15) return [p(DARK, w, Math.min(h, w * 0.58), d, 0, Math.max(0, 150 - Math.min(h, w * 0.58)), 0, 'box', { g: 1 })]; // 벽걸이
    if (h > 80) { // 세워 두는 TV: 받침 + 기둥 + 화면
      const sh = Math.min(h * 0.5, w * 0.57);
      return [p(DARK, w * 0.6, 3, d * 0.8), p(DARK, 5, h - sh, 5), p(DARK, w, sh, 4, 0, h - sh, 0, 'box', { g: 1 })];
    }
    const n = Math.max(1, Math.round(w / 45)), tw = Math.min(w * 0.86, 125), th = tw * 0.57;
    return [
      p(C.wood, w, h, d - 2.5, 0, 0, -1.25), ...fronts(C.wood, C.wood2, w, h, d, n, 1, 2),
      p(DARK, tw * 0.32, 1.5, Math.min(d * 0.6, 22), 0, h, 0, 'soft'), p(DARK, 6, 6, 3, 0, h, 0),
      p(DARK, tw, th, 3, 0, h + 6, 0, 'box', { g: 1 }),
    ];
  },
  hanger({ w, d, h, uid }, C) {
    const rand = rng(uid), colors = [C.fabric, C.c4, WHITE, C.small, C.c3, C.fabric2];
    const out = [
      ...[-1, 1].flatMap((s) => [p(STEEL, 3, 3, d, s * (w / 2 - 1.5)), p(METAL, 2.5, h, 2.5, s * (w / 2 - 1.5), 0, 0, 'cyl')]),
      p(METAL, w - 3, 2.5, 2.5, 0, h - 2.5), p(C.wood, w - 6, 2, d * 0.75, 0, 14),
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
      p(C.wood, w, h, t, 0, 0, -d / 2 + t / 2), p(SCREEN, w - 6, h - 6, 0.6, 0, 3, -d / 2 + t + 0.3, 'box', { g: 1 }),
      ...(d > 12 ? [p(C.wood, w * 0.8, 2, d)] : []),
    ];
  },
  fridge({ w, d, h }, C) {
    const split = h >= 120 ? 0.62 : 1, hh = Math.min(40, h * 0.25), B = C.body || WHITE; // 큰 냉장고는 위아래 두 문
    return [
      p(B, w, h, d - 2.5, 0, 0, -1.25), ...fronts(B, SEAM, w, h * split, d, 1, 1, 2),
      p(STEEL, 1.6, hh, 1.6, -w / 2 + 6, h * split - 6 - hh, d / 2 + 0.4),
      ...(split < 1 ? [...fronts(B, SEAM, w, h, d, 1, 1, h * split), p(STEEL, 1.6, Math.min(30, h * 0.18), 1.6, -w / 2 + 6, h * split + 5, d / 2 + 0.4)] : []),
    ];
  },
  washer({ w, d, h }, C) {
    const r = Math.min(w, h) * 0.62;
    return [
      p(C.body || WHITE, w, h, d - 3, 0, 0, -1.5, 'soft'), p(SEAM, w - 8, 7, 1, 0, h - 11, d / 2 - 2.5),
      p(METAL, r, r, 2, 0, h * 0.44 - r / 2, d / 2 - 2, 'cylf'), p(DARK, r * 0.74, r * 0.74, 2.6, 0, h * 0.44 - r * 0.37, d / 2 - 1.5, 'cylf', { g: 1 }),
    ];
  },
  lamp({ w, d, h }) {
    const s = Math.min(w, d), sh = Math.min(30, h * 0.42);
    return [
      p(METAL, s * 0.72, 2, s * 0.72, 0, 0, 0, 'cyl'), p(STEEL, 2.4, h - sh, 2.4, 0, 2, 0, 'cyl'),
      p(LAMP, s, sh, s, 0, h - sh, 0, 'shade', { e: 0.5 }),
    ];
  },
  // 흰 화분 + 길쭉한 잎. 잎이 자리 밖으로 8cm 넘게 나가지 않도록 눕는 각도를 줄인다.
  plant({ w, d, h, uid }) {
    const rand = rng(uid), s = Math.min(w, d), ph = Math.min(h * 0.26, 30), n = 7, room = h - ph + 2;
    const out = [p(WHITE, s * 0.6, ph, s * 0.6, 0, 0, 0, 'pot')];
    for (let i = 0; i < n; i++) {
      const L = room * (i ? 0.55 + rand() * 0.35 : 1), lean = i ? Math.asin(Math.min(0.72, (s / 2 + 8) / L)) * (0.6 + rand() * 0.4) : 0;
      out.push(p(GREENS[i % 3], 1.4, L, Math.max(6, s * 0.24), 0, ph - 2, 0, 'leaf', { az: (i / (n - 1)) * Math.PI * 2 + rand(), lean }));
    }
    return out;
  },
  rug({ w, d, h, name }, C) {
    const s = /원형|라운드|round/i.test(name || '') ? 'cyl' : 'box', t = Math.min(h, 1.2);
    return [p(shade(C.rug, -0.07), w, t, d, 0, 0, 0, s), p(WHITE, w - 10, t + 0.25, d - 10, 0, 0, 0, s), p(C.rug, w - 13, t + 0.5, d - 13, 0, 0, 0, s)] // 흰 안 테두리
      .filter((q) => q.w > 2 && q.d > 2);
  },
  piano({ w, d, h }) {
    return [
      ...[-1, 1].map((s) => p(DARK, 4, h - 14, d * 0.7, s * (w / 2 - 8))), p(DARK, w - 20, 4, 3, 0, 18),
      p(DARK, w, 12, d, 0, h - 14, 0, 'soft'), p(WHITE, w - 10, 1.2, d * 0.38, 0, h - 2, d / 2 - d * 0.19 - 2),
      p(DARK, w * 0.42, 18, 1.5, 0, h - 2, -d / 2 + 4),
    ];
  },
  chair: ({ w, d, h }, C) => chair(C, 0, 0, -1, w, d, h),
  appliance({ w, d, h }, C) {
    return [p(C.body || WHITE, w, h, d - 2, 0, 0, -1, 'soft'), p(SEAM, w * 0.7, h * 0.6, 1.5, -w * 0.1, h * 0.2, d / 2 - 1.5)];
  },
  // 모르는 가구: 나무색 상자. 앉는 가구는 패브릭 색. 옛 분류 색(it.color)은 갈색 계열이라 쓰지 않는다.
  box({ w, d, h, category }, C) {
    const base = Math.min(4, h * 0.2), c = category === 'seating' ? C.fabric : C.wood;
    return [p(shade(c, -0.1), Math.max(2, w - 5), base, Math.max(2, d - 5)), p(c, w, h - base, d, 0, base, 0, 'soft')];
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
  return furnitureParts(it, tintColors(C, it.tint)).map(({ c, w, h, d, x, y, z, s, ...extra }) => {
    const px = cx + x * cos - z * sin, py = cy + x * sin + z * cos;
    const turned = it.rot % 180 !== 0 && s !== 'leaf'; // 잎은 제 방향(az)으로 돌려 놓으므로 폭·깊이를 바꾸지 않는다
    const ex = (turned ? d : w) / 2, ey = (turned ? w : d) / 2;
    // cylf(앞뒤로 누운 원통)는 돌리면 축이 바뀐다
    return { s, c, x0: px - ex, x1: px + ex, y0: py - ey, y1: py + ey, b: y, t: y + h, ...(s === 'cylf' ? { ax: turned ? 'x' : 'y' } : null), ...extra };
  });
}
