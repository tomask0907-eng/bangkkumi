// 배치 엔진 결과를 눈으로 확인하는 갤러리. 대표 방 16개를 v2(새 엔진)와 v1(백업)로 나란히 그린다.
// 실행: node scripts/layout-gallery.mjs  →  C:/Users/사용자/dev/_bk-check/layout/gallery.html
// v1 백업은 읽기만 한다. 가구 사양은 여기 안에 직접 적었다(1단계에서는 catalog.js를 import하지 않는다).
import { mkdirSync, writeFileSync } from 'node:fs';
import { recommend, checkLayout, normalizeRoom, body, clearZone, doorZones } from '../src/layout.js';

const OUT_DIR = 'C:/Users/사용자/dev/_bk-check/layout';
const V1 = 'file:///C:/Users/사용자/dev/%EB%B0%A9%EA%BE%B8%EB%AF%B8_v1/src/';

const sp = (key, name, category, w, d, h, clear, flags = '', color = '#b9ab94') => ({
  key, name, category, w, d, h, clear, tall: flags.includes('t'), sideOk: flags.includes('s'), floor: flags.includes('f'), color,
});
const C = { bed: '#d8c7b2', desk: '#b99a78', storage: '#9c8a79', seating: '#a9b5ae', table: '#c9b196', appliance: '#c3c8cc', decor: '#cbbfa8', etc: '#b5ada2' };
const S = {
  bed_single: sp('bed_single', '싱글 침대', 'bed', 100, 200, 45, 0, 's', C.bed),
  bed_ss: sp('bed_ss', '슈퍼싱글 침대', 'bed', 110, 200, 45, 0, 's', C.bed),
  bed_queen: sp('bed_queen', '퀸 침대', 'bed', 150, 200, 45, 0, 's', C.bed),
  desk: sp('desk_120', '책상', 'desk', 120, 60, 73, 60, '', C.desk),
  desk140: sp('desk_140', '책상 1400', 'desk', 140, 70, 73, 60, '', C.desk),
  chair: sp('chair', '의자', 'seating', 55, 55, 90, 20, '', C.seating),
  wardrobe: sp('wardrobe_100', '옷장', 'storage', 100, 60, 195, 50, 't', C.storage),
  bookshelf: sp('bookshelf', '책장', 'storage', 80, 30, 180, 30, 't', C.storage),
  dresser: sp('dresser', '서랍장', 'storage', 80, 45, 85, 45, '', C.storage),
  hanger: sp('hanger', '스탠드 행거', 'storage', 120, 45, 170, 40, 't', C.storage),
  nightstand: sp('nightstand', '협탁', 'storage', 45, 40, 50, 0, '', C.storage),
  tv_stand: sp('tv_stand', 'TV장', 'storage', 120, 40, 45, 30, '', C.storage),
  sofa: sp('sofa_2', '2인 소파', 'seating', 150, 80, 80, 40, '', C.seating),
  table: sp('table_2', '2인 식탁', 'table', 80, 60, 73, 55, '', C.table),
  table_floor: sp('table_floor', '좌식 테이블', 'table', 90, 60, 35, 45, '', C.table),
  fridge: sp('fridge', '냉장고', 'appliance', 60, 65, 170, 60, 't', C.appliance),
  mirror: sp('mirror', '전신거울', 'decor', 50, 40, 160, 60, 't', C.decor),
  plant: sp('plant', '화분', 'decor', 40, 40, 120, 0, '', C.decor),
  rug: sp('rug', '러그', 'decor', 200, 140, 1, 0, 'f', '#e6d9c4'),
  piano: sp('custom:전자피아노', '전자피아노', 'etc', 135, 40, 85, 60, '', C.etc),
};
// v1이 아는 가구 이름 → 위 사양 (v1 결과를 같은 점수 기준으로 재려고)
const V1_KEY = { bed_single: 'bed_single', bed_ss: 'bed_ss', bed_queen: 'bed_queen', desk: 'desk', wardrobe: 'wardrobe', bookshelf: 'bookshelf', dresser: 'dresser', sofa: 'sofa', table: 'table', hanger: 'hanger' };

const door = (wall, offset, size = 90, kind = 'entry') => ({ wall, offset, size, kind });
const win = (wall, offset, size, sill = 90, height = 120) => ({ wall, offset, size, sill, height });
const room = (width, depth, doors, windows) => ({ width, depth, height: 240, doors, windows });

export const SCENARIOS = [
  { title: '1. 예시 방 3×4m (침대·책상·옷장·책장)', room: room(300, 400, [door('bottom', 20)], [win('top', 50, 100)]), keys: ['bed_ss', 'desk', 'wardrobe', 'bookshelf'] },
  { title: '2. 3×4m, 창이 넓고 문이 오른쪽', room: room(300, 400, [door('bottom', 190)], [win('top', 75, 150)]), keys: ['bed_ss', 'desk', 'wardrobe', 'dresser'] },
  { title: '3. 5×6m 가구 10개', room: room(500, 600, [door('left', 450)], [win('right', 150, 200)]), keys: ['bed_queen', 'desk', 'wardrobe', 'wardrobe', 'bookshelf', 'bookshelf', 'dresser', 'sofa', 'table', 'hanger'] },
  { title: '4. 세로로 긴 방 2.6×5m', room: room(260, 500, [door('bottom', 150)], [win('top', 55, 150)]), keys: ['bed_ss', 'desk', 'wardrobe', 'sofa', 'table'] },
  { title: '5. 좁은 방 2.4×3m에 큰 가구', room: room(240, 300, [door('bottom', 0)], [win('top', 50, 120)]), keys: ['bed_queen', 'desk', 'wardrobe', 'dresser'] },
  { title: '6. 정사각 3.5×3.5m, 창이 왼쪽', room: room(350, 350, [door('bottom', 230)], [win('left', 100, 150)]), keys: ['bed_ss', 'desk', 'wardrobe', 'dresser', 'hanger'] },
  { title: '7. 문 2개(현관 + 화장실) 3.2×4.5m', room: room(320, 450, [door('bottom', 200), door('left', 330, 70, 'bath')], [win('top', 80, 160)]), keys: ['bed_ss', 'desk', 'wardrobe', 'fridge', 'table'] },
  { title: '8. 소파·TV·좌식 테이블·러그 4×5m', room: room(400, 500, [door('right', 380)], [win('top', 100, 200)]), keys: ['bed_queen', 'sofa', 'tv_stand', 'table_floor', 'rug', 'wardrobe', 'desk'] },
  { title: '9. 가구 12개 4.5×5.5m (의자·협탁·러그·냉장고 포함)', room: room(450, 550, [door('bottom', 40), door('right', 420, 70, 'bath')], [win('top', 120, 180), win('left', 150, 120)]), keys: ['bed_queen', 'nightstand', 'desk', 'chair', 'wardrobe', 'bookshelf', 'dresser', 'sofa', 'tv_stand', 'fridge', 'rug', 'plant'] },
  { title: '10. 창문 없는 방 3×3.5m', room: room(300, 350, [door('left', 240)], []), keys: ['bed_ss', 'desk', 'wardrobe'] },
  { title: '11. 아주 작은 방 1.5×1.5m', room: room(150, 150, [door('bottom', 30, 80)], [win('top', 30, 80)]), keys: ['bed_single', 'desk', 'bookshelf'] },
  { title: '12. 아주 큰 방 8×10m 가구 12개', room: room(800, 1000, [door('bottom', 100, 100)], [win('top', 200, 300), win('right', 300, 250)]), keys: ['bed_queen', 'nightstand', 'desk140', 'chair', 'wardrobe', 'wardrobe', 'bookshelf', 'sofa', 'tv_stand', 'table', 'piano', 'rug'] },
  { title: '13. 창 2개 모서리 방 3.3×4.2m', room: room(330, 420, [door('bottom', 30)], [win('top', 90, 150), win('right', 120, 120)]), keys: ['bed_ss', 'desk', 'wardrobe', 'bookshelf', 'dresser'] },
  { title: '14. 가로로 넓은 방 5×2.8m', room: room(500, 280, [door('left', 180)], [win('top', 300, 160)]), keys: ['bed_ss', 'desk', 'wardrobe', 'hanger', 'sofa'] },
  // 검증에서 지적된 두 경우: TV가 소파를 마주 보는지, 창이 문과 같은 벽일 때 1번 안에 경고가 없는지
  { title: '15. 3×4m에 소파·TV까지 (TV가 소파를 마주 보는지)', room: room(300, 400, [door('bottom', 10)], [win('top', 75, 150)]), keys: ['bed_ss', 'desk', 'wardrobe', 'sofa', 'tv_stand'] },
  { title: '16. 창이 현관문과 같은 벽 2.8×3.8m (1번 안에 경고가 없는지)', room: room(280, 380, [door('bottom', 10)], [win('bottom', 140, 120)]), keys: ['bed_ss', 'desk', 'wardrobe', 'bookshelf'] },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function drawPlan(room0, items, px, walk) {
  const rm = normalizeRoom(room0);
  const k = px / Math.max(rm.width, rm.depth);
  const pad = 14;
  const W = rm.width * k, D = rm.depth * k;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${D + pad * 2}" viewBox="${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2}">`];
  out.push(`<rect x="0" y="0" width="${W}" height="${D}" fill="#fbf8f3" stroke="#3a3530" stroke-width="3"/>`);
  if (walk) for (const p of walk) if (p.x % 20 === 0 && p.y % 20 === 0) out.push(`<circle cx="${p.x * k}" cy="${p.y * k}" r="0.9" fill="#9fc7a2"/>`);
  for (const z of doorZones(rm)) out.push(`<rect x="${z.x * k}" y="${z.y * k}" width="${z.w * k}" height="${z.h * k}" fill="#f4d9a8" opacity="0.55" stroke="#c9963a" stroke-dasharray="3 2"/>`);
  const seg = (o, color, t) => {
    const a = o.offset * k, s = o.size * k;
    if (o.wall === 'top') return `<rect x="${a}" y="${-t / 2}" width="${s}" height="${t}" fill="${color}"/>`;
    if (o.wall === 'bottom') return `<rect x="${a}" y="${D - t / 2}" width="${s}" height="${t}" fill="${color}"/>`;
    if (o.wall === 'left') return `<rect x="${-t / 2}" y="${a}" width="${t}" height="${s}" fill="${color}"/>`;
    return `<rect x="${W - t / 2}" y="${a}" width="${t}" height="${s}" fill="${color}"/>`;
  };
  rm.windows.forEach((w) => out.push(seg(w, '#4aa3df', 7)));
  rm.doors.forEach((d, i) => out.push(seg(d, i === 0 ? '#c9963a' : '#b07cc6', 7)));
  const sorted = [...items].sort((a, b) => (b.floor ? 1 : 0) - (a.floor ? 1 : 0));
  for (const it of sorted) {
    const b = body(it);
    const cz = clearZone(it);
    if (cz && !it.floor) out.push(`<rect x="${cz.x * k}" y="${cz.y * k}" width="${cz.w * k}" height="${cz.h * k}" fill="none" stroke="#b7b0a6" stroke-dasharray="2 3"/>`);
    out.push(`<rect x="${b.x * k}" y="${b.y * k}" width="${b.w * k}" height="${b.h * k}" rx="2" fill="${it.color || '#b9ab94'}" ${it.floor ? 'opacity="0.55"' : ''} stroke="#5b5148" stroke-width="${it.tall ? 2 : 1}"/>`);
    // 등(벽 쪽)을 굵은 선으로, 침대는 베개로 표시
    const t = 4 / k;
    const back = it.rot === 0 ? [b.x, b.y, b.w, t] : it.rot === 180 ? [b.x, b.y + b.h - t, b.w, t] : it.rot === 270 ? [b.x, b.y, t, b.h] : [b.x + b.w - t, b.y, t, b.h];
    if (!it.floor) out.push(`<rect x="${back[0] * k}" y="${back[1] * k}" width="${back[2] * k}" height="${back[3] * k}" fill="#4a4038"/>`);
    if (it.category === 'bed') {
      const p = 26, m = 0.18;
      const r = it.rot === 0 ? [b.x + b.w * m, b.y + 8, b.w * (1 - 2 * m), p] : it.rot === 180 ? [b.x + b.w * m, b.y + b.h - 8 - p, b.w * (1 - 2 * m), p] : it.rot === 270 ? [b.x + 8, b.y + b.h * m, p, b.h * (1 - 2 * m)] : [b.x + b.w - 8 - p, b.y + b.h * m, p, b.h * (1 - 2 * m)];
      out.push(`<rect x="${r[0] * k}" y="${r[1] * k}" width="${r[2] * k}" height="${r[3] * k}" rx="3" fill="#fffaf2" stroke="#8c8177"/>`);
    }
    const fs = Math.max(8, Math.min(12, (Math.min(b.w, b.h) * k) / 2.2));
    out.push(`<text x="${(b.x + b.w / 2) * k}" y="${(b.y + b.h / 2) * k + fs / 3}" font-size="${fs}" text-anchor="middle" fill="#2c2520">${esc(it.name)}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

function scoreLine(score) {
  return `<div class="score"><b>${score.total}점</b> ${score.parts.map((p) => `<span class="${p.score < p.max ? 'lose' : ''}">${esc(p.label)} ${p.score}/${p.max}</span>`).join(' ')}</div>`;
}
function noteList(score) {
  return `<ul class="notes">${score.parts.filter((p) => p.score < p.max).map((p) => `<li><b>${esc(p.label)}</b> ${esc(p.note)}</li>`).join('')}</ul>`;
}
function issueList(issues) {
  if (!issues.length) return '';
  return `<ul class="issues">${issues.map((i) => `<li class="${i.level}">[${i.code}] ${esc(i.msg)}</li>`).join('')}</ul>`;
}

let v1 = null;
try { v1 = { layout: await import(`${V1}layout.js`) }; } catch (e) { console.log('v1을 불러오지 못했어요:', e.message); }

const rows = [];
const summary = [];
for (const sc of SCENARIOS) {
  const specs = sc.keys.map((key) => S[key]);
  const t0 = performance.now();
  const r0 = recommend(sc.room, specs, 0);
  const ms = performance.now() - t0;
  const cells = [];
  for (let v = 0; v < Math.min(r0.variants, 3); v++) {
    const r = recommend(sc.room, specs, v);
    const chk = checkLayout(sc.room, r.items);
    const reasons = v === 0 ? `<ul class="reasons">${r.items.map((it) => `<li><b>${esc(it.name)}</b> ${esc(r.reasons[it.uid].join(' '))}</li>`).join('')}</ul>` : '';
    const un = r.unplaced.length ? `<div class="un">못 놓은 가구: ${esc(r.unplaced.map((u) => u.name).join(', '))}</div>` : '';
    cells.push(`<div class="cell"><h3>v2 배치안 ${v + 1}/${r.variants}${v === 0 ? ` · ${ms.toFixed(0)}ms` : ''}</h3>${drawPlan(sc.room, r.items, v === 0 ? 380 : 270, chk.walk.points)}${scoreLine(r.score)}${un}${issueList(chk.issues)}${noteList(r.score)}${reasons}</div>`);
  }
  let v1Total = null;
  const expressible = v1 && sc.room.doors.length === 1 && sc.room.windows.length === 1 && sc.keys.every((key) => V1_KEY[key]);
  if (expressible) {
    const oldRoom = { width: sc.room.width, depth: sc.room.depth, door: sc.room.doors[0], window: sc.room.windows[0] };
    const t1 = performance.now();
    const r = v1.layout.recommend(oldRoom, sc.keys.map((key) => V1_KEY[key]), 0);
    const ms1 = performance.now() - t1;
    const items = r.items.map((it) => ({ ...S[it.type], uid: it.uid, x: it.x, y: it.y, rot: it.rot }));
    const chk = checkLayout(sc.room, items);
    v1Total = chk.score.total;
    const un = r.unplaced.length ? `<div class="un">못 놓은 가구: ${esc(r.unplaced.map((u) => S[u].name).join(', '))}</div>` : '';
    cells.push(`<div class="cell old"><h3>v1 (이전 엔진) · ${ms1.toFixed(0)}ms · 점수는 v2 기준으로 다시 잼</h3>${drawPlan(sc.room, items, 270, null)}${scoreLine(chk.score)}${un}${issueList(chk.issues)}${noteList(chk.score)}</div>`);
  } else {
    cells.push('<div class="cell old"><h3>v1</h3><p class="na">v1로는 표현할 수 없는 방이에요(문·창 여러 개, 창 없음, 새 가구 종류).</p></div>');
  }
  rows.push(`<section class="row"><h2>${esc(sc.title)}</h2><div class="cells">${cells.join('')}</div></section>`);
  summary.push({ title: sc.title, ms: Math.round(ms), variants: r0.variants, v2: r0.score.total, v1: v1Total, unplaced: r0.unplaced.map((u) => u.name).join(',') });
}

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>방꾸미 배치 엔진 갤러리</title><style>
body{font-family:'Malgun Gothic',sans-serif;margin:16px;background:#efeae2;color:#2c2520}
h1{font-size:20px}h2{font-size:16px;margin:0 0 8px}h3{font-size:12px;margin:0 0 4px;color:#5b5148}
.row{background:#fff;border-radius:10px;padding:12px;margin-bottom:14px;width:1560px}
.cells{display:flex;gap:14px;align-items:flex-start}.cell{flex:0 0 auto;max-width:410px}.cell.old{background:#f3f0ea;border-radius:8px;padding:6px;max-width:300px}
.score{font-size:11px;margin-top:4px}.score span{display:inline-block;margin-right:6px;color:#5d7a5f}.score span.lose{color:#b2542b;font-weight:bold}
ul{margin:4px 0;padding-left:16px;font-size:11px;line-height:1.45}.issues .error{color:#c0271b}.issues .warn{color:#a8690a}.notes{color:#7a4a2a}.reasons{color:#3d4d3e}
.un{font-size:12px;color:#c0271b;font-weight:bold}.na{font-size:12px;color:#8a8178}
</style></head><body><h1>방꾸미 배치 엔진 갤러리 (왼쪽: v2 배치안들, 오른쪽: v1)</h1>
<p style="font-size:12px">굵은 변 = 가구의 등(침대는 베개 쪽이 머리) · 파란 선 = 창 · 주황 = 현관문과 문 여는 공간 · 보라 = 다른 문 · 초록 점 = 60cm 통로로 닿는 곳 · 점선 = 앞 사용 공간</p>
${rows.join('\n')}</body></html>`;
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/gallery.html`, html);
console.table(summary);
console.log(`갤러리: ${OUT_DIR}/gallery.html`);
