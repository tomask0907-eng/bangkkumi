// 선분에서 직사각형 방 후보를 찾는다. 길이는 cm, y는 아래가 +.
// 방법: 긴 가로·세로 선(벽)을 모으고, 벽 근처의 씨앗 점에서 네 방향으로 쏘아 처음 만나는 벽으로 사각형을 만든 뒤,
// 네 변이 실제 선으로 얼마나 덮여 있는지로 걸러 낸다. 후보는 제안일 뿐이라 완벽할 필요는 없다.
import { doorsForRect, ROOM_MIN, ROOM_MAX } from '../../src/dwg/geom.js';

const COL = 100; // 색인 칸 폭
const LEVELS = [40, 120, 240]; // 벽으로 치는 최소 길이. 길수록 가구 선을 건너뛴다

// 같은 줄에 놓인 선분을 이어 붙인다. 입력·출력: [위치, 시작, 끝]
function merge(list) {
  list.sort((a, b) => Math.round(a[0]) - Math.round(b[0]) || a[1] - b[1]);
  const out = [];
  for (const s of list) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - s[0]) <= 1 && s[1] <= last[2] + 2) last[2] = Math.max(last[2], s[2]);
    else out.push([...s]);
  }
  return out.filter((s) => s[2] - s[1] >= LEVELS[0]).sort((a, b) => a[0] - b[0]);
}

function index(list) {
  const map = new Map();
  for (const s of list) {
    for (let c = Math.floor(s[1] / COL); c <= Math.floor(s[2] / COL); c++) {
      const a = map.get(c);
      if (a) a.push(s); else map.set(c, [s]);
    }
  }
  return map;
}

// u 위치를 지나는 선 중에서 v의 양쪽으로 가장 가까운 것의 위치 [앞, 뒤]
function nearest(idx, u, v, minLen) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const s of idx.get(Math.floor(u / COL)) || []) {
    if (s[2] - s[1] < minLen || u < s[1] - 2 || u > s[2] + 2) continue;
    if (s[0] < v - 1) { if (s[0] > lo) lo = s[0]; } else if (s[0] > v + 1 && s[0] < hi) hi = s[0];
  }
  return [lo, hi];
}

// 정렬된 list에서 위치가 pos±4인 선이 [a, b] 구간을 덮는 비율
function coverage(list, pos, a, b) {
  let i = 0;
  let j = list.length;
  while (i < j) { const m = (i + j) >> 1; if (list[m][0] < pos - 4) i = m + 1; else j = m; }
  const parts = [];
  for (; i < list.length && list[i][0] <= pos + 4; i++) {
    const s = Math.max(a, list[i][1]);
    const e = Math.min(b, list[i][2]);
    if (e > s) parts.push([s, e]);
  }
  parts.sort((p, q) => p[0] - q[0]);
  let sum = 0;
  let end = a;
  for (const [s, e] of parts) { if (e > end) { sum += e - Math.max(s, end); end = e; } }
  return sum / (b - a);
}

// 사각형 안쪽을 가로지르는 벽이 있는지: [a,b] 구간의 65% 이상을 덮는 줄이 lo~hi 사이에 있으면 true
function crossed(list, lo, hi, a, b) {
  let i = 0;
  let j = list.length;
  while (i < j) { const m = (i + j) >> 1; if (list[m][0] < lo) i = m + 1; else j = m; }
  for (; i < list.length && list[i][0] <= hi; i++) {
    const s = list[i];
    if (Math.min(b, s[2]) - Math.max(a, s[1]) >= 20 && coverage(list, s[0], a, b) >= 0.65) return true;
  }
  return false;
}

// 문 호의 두 끝 중 어느 쪽이 문틀(열린 틈)인지 가린다 → [.., 틈 쪽, 반대쪽, 1]. 모르면 끝이 0.
// 증거(센 것부터): ① 두께선 — 문짝은 두께가 있어서 호 안쪽으로 1~8cm 떨어진 문 폭 길이의 선이 하나 더 있다
// (문턱 선은 호 바깥쪽에 있다) ② 경첩에서 끝점까지 딱 문 폭만 한 선 = 문짝 ③ 문 폭보다 길게 이어지는 선 = 벽
export function orientDoorArcs(arcs, segs) {
  return arcs.map(([cx, cy, ax, ay, bx, by]) => {
    const r = Math.hypot(ax - cx, ay - cy);
    // (ex,ey) 방향을 살핀다. (ox,oy)는 다른 쪽 끝 — 그쪽이 호의 안쪽이다
    const lined = (ex, ey, ox, oy) => {
      const ux = (ex - cx) / r;
      const uy = (ey - cy) / r;
      const inward = Math.sign(ux * (oy - cy) - uy * (ox - cx));
      let thick = false;
      let leaf = false;
      let wall = false;
      for (let i = 0; i < segs.length; i += 4) {
        const x1 = segs[i] - cx;
        const y1 = segs[i + 1] - cy;
        const d1 = (ux * y1 - uy * x1) * inward; // 호 안쪽으로 떨어진 거리
        if (Math.abs(d1) > 8) continue;
        const x2 = segs[i + 2] - cx;
        const y2 = segs[i + 3] - cy;
        const d2 = (ux * y2 - uy * x2) * inward;
        if (Math.abs(d2) > 8) continue;
        const t1 = x1 * ux + y1 * uy;
        const t2 = x2 * ux + y2 * uy;
        const lo = Math.min(t1, t2);
        const hi = Math.max(t1, t2);
        if (Math.min(r, hi) - Math.max(0, lo) < r * 0.6) continue;
        const doorLong = Math.abs(lo) <= 8 && Math.abs(hi - r) <= 10;
        if (doorLong && d1 >= 1 && d2 >= 1) thick = true;
        else if (Math.abs(d1) > 6 || Math.abs(d2) > 6) continue;
        else if (hi >= r + 10 || lo <= -10) wall = true;
        else if (doorLong) leaf = true;
      }
      return { thick, leaf, wall };
    };
    const a = lined(ax, ay, bx, by);
    const b = lined(bx, by, ax, ay);
    // a 쪽이 틈이 아닌지 (null이면 모름)
    const notA = a.thick !== b.thick ? a.thick : a.leaf !== b.leaf ? a.leaf : a.wall !== b.wall ? a.wall : null;
    if (notA === null) return [cx, cy, ax, ay, bx, by, 0];
    return notA ? [cx, cy, bx, by, ax, ay, 1] : [cx, cy, ax, ay, bx, by, 1];
  });
}

const ROOMISH = /실|방|거실|주방|현관|욕|화장|발코니|베란다|창고|룸|홀|복도|room|bed|living|kitchen|bath/i;
const LABEL_BAD = /^[\d\s.,×xX*@=:+\-/()'"]+$|축척|평면도|scale|^[A-Za-z]\d+$/i;

// segs: [x1,y1,x2,y2,...] (cm), texts: [{x,y,text}], doorArcs: geom.js doorsForRect 형식
export function findRooms(segs, texts = [], doorArcs = [], max = 12) {
  const hs = [];
  const vs = [];
  for (let i = 0; i < segs.length; i += 4) {
    const dx = Math.abs(segs[i + 2] - segs[i]);
    const dy = Math.abs(segs[i + 3] - segs[i + 1]);
    if (dx >= 15 && dy <= Math.max(0.5, dx * 0.002)) hs.push([(segs[i + 1] + segs[i + 3]) / 2, Math.min(segs[i], segs[i + 2]), Math.max(segs[i], segs[i + 2])]);
    else if (dy >= 15 && dx <= Math.max(0.5, dy * 0.002)) vs.push([(segs[i] + segs[i + 2]) / 2, Math.min(segs[i + 1], segs[i + 3]), Math.max(segs[i + 1], segs[i + 3])]);
  }
  const H = merge(hs); // [y, x0, x1]
  const V = merge(vs); // [x, y0, y1]
  const hi = index(H);
  const vi = index(V);

  // 씨앗: 긴 벽의 양옆 40cm 지점들 + 글자 위치(방 이름은 보통 방 안에 있다)
  const seeds = [];
  const longest = (list) => list.filter((s) => s[2] - s[1] >= 100).sort((a, b) => (b[2] - b[1]) - (a[2] - a[1])).slice(0, 3000);
  for (const s of longest(H)) for (const t of [0.25, 0.5, 0.75]) for (const o of [-40, 40]) seeds.push([s[1] + (s[2] - s[1]) * t, s[0] + o]);
  for (const s of longest(V)) for (const t of [0.25, 0.5, 0.75]) for (const o of [-40, 40]) seeds.push([s[0] + o, s[1] + (s[2] - s[1]) * t]);
  for (const t of texts) seeds.push([t.x, t.y]);

  const found = new Map();
  for (const [px, py] of seeds) {
    for (const lv of LEVELS) {
      const [top, bottom] = nearest(hi, px, py, lv);
      const [left, right] = nearest(vi, py, px, lv);
      const w = right - left;
      const h = bottom - top;
      if (!(w >= ROOM_MIN && w <= ROOM_MAX && h >= ROOM_MIN && h <= ROOM_MAX)) continue;
      const key = `${Math.round(left)},${Math.round(top)},${Math.round(w)},${Math.round(h)}`;
      const f = found.get(key);
      if (f) f.hits++; else found.set(key, { x: left, y: top, w, h, hits: 1 });
    }
  }

  const cands = [];
  for (const r of found.values()) {
    const cov = [
      coverage(H, r.y, r.x, r.x + r.w), coverage(H, r.y + r.h, r.x, r.x + r.w),
      coverage(V, r.x, r.y, r.y + r.h), coverage(V, r.x + r.w, r.y, r.y + r.h),
    ];
    const mean = (cov[0] + cov[1] + cov[2] + cov[3]) / 4;
    if (Math.min(...cov) < 0.45 || mean < 0.75) continue;
    // 안쪽을 벽이 가로지르면 방 두 개를 합친 것이다
    if (crossed(H, r.y + 8, r.y + r.h - 8, r.x, r.x + r.w) || crossed(V, r.x + 8, r.x + r.w - 8, r.y, r.y + r.h)) continue;
    const inside = texts.filter((t) => t.x > r.x && t.x < r.x + r.w && t.y > r.y && t.y < r.y + r.h && t.text.length <= 14 && !LABEL_BAD.test(t.text));
    // 방 이름처럼 보이는 글자를 먼저, 그다음 방 가운데에 가까운 글자를 고른다
    const mid = (t) => Math.hypot(t.x - r.x - r.w / 2, t.y - r.y - r.h / 2) + (ROOMISH.test(t.text) ? 0 : 5000);
    inside.sort((a, b) => mid(a) - mid(b));
    const doors = doorsForRect(r, doorArcs);
    // 점수: 변이 잘 막혀 있고, 이름이나 문이 있으면 방일 가능성이 높다
    const score = mean * mean * (1 + (inside.length ? (ROOMISH.test(inside[0].text) ? 0.6 : 0.2) : 0) + (doors.length ? 0.6 : 0)) * Math.sqrt(r.w * r.h) * Math.min(1, 0.6 + r.hits / 10);
    cands.push({ ...r, cov: mean, score, label: inside[0]?.text || '', doors });
  }

  // 많이 겹치는 후보는 점수 높은 것만 남긴다
  cands.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const c of cands) {
    const dup = kept.some((k) => {
      const ix = Math.min(c.x + c.w, k.x + k.w) - Math.max(c.x, k.x);
      const iy = Math.min(c.y + c.h, k.y + k.h) - Math.max(c.y, k.y);
      if (ix <= 0 || iy <= 0) return false;
      return (ix * iy) / (c.w * c.h + k.w * k.h - ix * iy) > 0.5;
    });
    if (!dup) kept.push(c);
    if (kept.length >= max) break;
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  return kept
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .map((c) => ({ x: r1(c.x), y: r1(c.y), w: r1(c.w), h: r1(c.h), doors: c.doors, windows: [], label: c.label }));
}
