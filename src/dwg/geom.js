// DWG 불러오기에서 화면과 서버가 같이 쓰는 계산 (순수 함수, 외부 import 없음). 길이는 모두 cm.

export const ROOM_MIN = 150;
export const ROOM_MAX = 1500;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

// 사각형(rect) 가장자리에 붙은 문을 찾는다. arcs: 문일 수 있는 호 [cx,cy, ax,ay, bx,by, known] (경첩, 호의 두 끝).
// known이 1이면 a가 문틀(열린 틈) 쪽, b가 열린 문짝 끝이라는 뜻이다. 0이거나 없으면 어느 쪽인지 모른다.
// 결과는 CONTRACT 2절의 doors 형식(방 기준 좌표). 벽 두께만큼 떨어진 호도 잡으려고 tol을 둔다.
export function doorsForRect(rect, arcs, tol = 35) {
  const walls = [
    ['top', rect.y, true], ['bottom', rect.y + rect.h, true],
    ['left', rect.x, false], ['right', rect.x + rect.w, false],
  ];
  const found = [];
  for (const [cx, cy, ax, ay, bx, by, known] of arcs || []) {
    const r = Math.hypot(ax - cx, ay - cy);
    const ends = known ? [[ax, ay]] : [[ax, ay], [bx, by]];
    let best = null;
    for (const [wall, pos, horiz] of walls) {
      const cv = horiz ? cy : cx; // 벽에 수직인 좌표
      const cu = horiz ? cx : cy; // 벽을 따라가는 좌표
      const dist = Math.abs(cv - pos);
      if (dist > tol) continue;
      for (const [px, py] of ends) {
        const pv = horiz ? py : px;
        const pu = horiz ? px : py;
        if (Math.abs(pv - cv) > r * 0.25) continue; // 이 끝점은 벽을 따라 놓인 쪽이 아니다
        const len = horiz ? rect.w : rect.h;
        const lo = Math.min(cu, pu) - (horiz ? rect.x : rect.y);
        if (lo < -8 || lo + r > len + 8) continue; // 문이 이 벽 범위를 벗어난다
        if (!best || dist < best.dist) best = { wall, lo, len, dist };
      }
    }
    if (!best) continue;
    const size = clamp(Math.round(r), 60, Math.min(150, Math.floor(best.len)));
    const offset = clamp(Math.round(best.lo), 0, Math.max(0, Math.floor(best.len - size)));
    // 같은 문을 두 번 그린 도면이 많아서, 같은 벽에서 겹치는 문은 하나만 남긴다
    if (found.some((d) => d.wall === best.wall && d.offset < offset + size && offset < d.offset + d.size)) continue;
    found.push({ wall: best.wall, offset, size });
  }
  // 현관문이 어느 것인지는 도면만으로 알 수 없어서 가장 넓은 문을 현관으로 둔다 (화면에서 바꿀 수 있다)
  found.sort((a, b) => b.size - a.size);
  return found.slice(0, 6).map((d, i) => ({ ...d, kind: i === 0 ? 'entry' : 'etc' }));
}

// 문을 못 찾았을 때 넣는 기본 현관문: 아래쪽 벽 왼편
export function defaultDoor(width) {
  const size = Math.min(90, Math.max(60, Math.floor(width - 20)));
  return { wall: 'bottom', offset: Math.max(0, Math.min(30, Math.floor(width - size))), size, kind: 'entry' };
}

// 선분을 사각형 [x0,x1]×[y0,y1]로 자른다 (Liang–Barsky). 밖이면 null.
function clip(l, x0, y0, x1, y1) {
  const dx = l[2] - l[0];
  const dy = l[3] - l[1];
  let t0 = 0;
  let t1 = 1;
  const edges = [[-dx, l[0] - x0], [dx, x1 - l[0]], [-dy, l[1] - y0], [dy, y1 - l[1]]];
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [l[0] + t0 * dx, l[1] + t0 * dy, l[0] + t1 * dx, l[1] + t1 * dy];
}

// 고른 사각형(+여유 margin) 안의 선을 방 좌표로 옮긴다. 너무 많으면 긴 선부터 cap개만.
export function underlayFor(lines, rect, margin = 30, cap = 4000) {
  const out = [];
  for (const l of lines || []) {
    const c = clip(l, rect.x - margin, rect.y - margin, rect.x + rect.w + margin, rect.y + rect.h + margin);
    if (!c) continue;
    const len = Math.hypot(c[2] - c[0], c[3] - c[1]);
    if (len >= 0.5) out.push([len, c]);
  }
  if (out.length > cap) out.sort((a, b) => b[0] - a[0]).length = cap;
  return out.map(([, c]) => [r1(c[0] - rect.x), r1(c[1] - rect.y), r1(c[2] - rect.x), r1(c[3] - rect.y)]);
}

// 직접 사각형을 그릴 때 붙을 점(선 끝점)을 빨리 찾기 위한 격자 색인
const CELL = 50;
export function snapIndex(lines) {
  const map = new Map();
  const add = (x, y) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    const a = map.get(k);
    if (a) a.push(x, y); else map.set(k, [x, y]);
  };
  for (const l of lines || []) { add(l[0], l[1]); add(l[2], l[3]); }
  return map;
}

// (x, y)에서 radius 안의 가장 가까운 끝점. 없으면 원래 점.
export function snapPoint(index, x, y, radius) {
  const rad = Math.min(radius, CELL * 4); // 멀리서 볼 때 검색 범위가 끝없이 커지지 않게
  let best = null;
  let bd = rad * rad;
  for (let i = Math.floor((x - rad) / CELL); i <= Math.floor((x + rad) / CELL); i++) {
    for (let j = Math.floor((y - rad) / CELL); j <= Math.floor((y + rad) / CELL); j++) {
      const a = index.get(`${i},${j}`);
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const d = (a[k] - x) ** 2 + (a[k + 1] - y) ** 2;
        if (d <= bd) { bd = d; best = [a[k], a[k + 1]]; }
      }
    }
  }
  return best ? { x: best[0], y: best[1], snapped: true } : { x, y, snapped: false };
}

// '320 × 410 cm (3.2 × 4.1 m)'
export function sizeText(w, h) {
  const m = (v) => (v / 100).toFixed(2).replace(/0$/, '');
  return `${Math.round(w)} × ${Math.round(h)} cm (${m(w)} × ${m(h)} m)`;
}
