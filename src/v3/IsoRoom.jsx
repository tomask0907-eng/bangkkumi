// 시작 화면의 입체 방 그림.
// 방(흰 벽, 옅은 바닥, 창문, 커튼)은 A안 docs/design-v3/a/gen-iso.mjs, 가구는 B안 docs/design-v3/b/iso.js 방식(가는 외곽선)이에요.
// 좌표: 방 400×300cm. x는 오른쪽 아래, y는 왼쪽 아래, z는 위. 보이는 면은 윗면, y가 큰 면(밝음), x가 큰 면(어두움).
// 선과 파란 면은 theme의 --plan-line, --accent 변수를 읽어요(그래서 <img>가 아니라 인라인 SVG예요).
const C = 0.866;
const P = ([x, y, z = 0]) => `${((x - y) * C).toFixed(1)},${((x + y) * 0.5 - z).toFixed(1)}`;
const LINE = 'var(--plan-line)';
const SOFT = 'rgba(40,52,70,.2)'; // 방(벽, 바닥)의 옅은 선: A안 그대로
const WHITE = '#FFFFFF', WOOD = '#E3CFB1', LINEN = '#ECE7DF', DARK = 'var(--plan-wall)';
const BLUE = 'color-mix(in srgb, var(--accent) 82%, #fff)';
const shade = (c, k) => (k ? `color-mix(in srgb, ${c}, #2A3646 ${k}%)` : c);

function build() {
  let o = '';
  const poly = (pts, fill, a = {}) =>
    (o += `<polygon points="${pts.map(P).join(' ')}" style="fill:${fill};stroke:${a.stroke ?? LINE}" stroke-width="${a.sw ?? 0.8}" stroke-linejoin="round"/>`);
  const line = (pts, a = {}) =>
    (o += `<polyline points="${pts.map(P).join(' ')}" fill="none" style="stroke:${a.stroke ?? LINE}" stroke-width="${a.sw ?? 0.6}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const box = (x, y, z, w, d, h, c = WHITE, a = {}) => {
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], a.fy ?? shade(c, a.ky ?? 5), a);
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], a.fx ?? shade(c, a.kx ?? 13), a);
    poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], a.top ?? c, a);
  };
  const thin = { sw: 0.6 };
  const room = { stroke: SOFT, sw: 0.7 };
  const none = { stroke: 'none', sw: 0 };
  const shadow = (x, y, w, d, h) => {
    const k = Math.min(h, 150) * 0.07 + 6;
    poly([[x + 4, y + 4], [x + w + k, y + 4], [x + w + k, y + d + k], [x + 4, y + d + k]], '#2A3646', none);
  };

  // ── 방 (A안) ──
  o += '<ellipse cx="43" cy="378" rx="330" ry="28" fill="rgba(17,39,71,.24)" filter="url(#lrSoft)"/>';
  box(-8, -8, -12, 416, 316, 12, '#F5EEE3', { ...room, fy: '#E4D9C9', fx: '#D7CAB7' });             // 바닥
  box(-8, -8, 0, 8, 316, 240, '#C9D3DF', { ...room, fy: '#D5DDE7', fx: '#EDF1F6' });                // 왼쪽 벽
  box(0, -8, 0, 408, 8, 240, '#C9D3DF', { ...room, fy: '#FFFFFF', fx: '#D5DDE7' });                 // 뒤 벽
  poly([[110, 3], [250, 3], [300, 150], [160, 150]], 'rgba(255,255,255,.55)', none);               // 창가 빛
  poly([[110, 0, 88], [250, 0, 88], [250, 0, 212], [110, 0, 212]], 'url(#lrSky)', { stroke: '#BFCBD9', sw: 2.6 });
  line([[180, 0, 88], [180, 0, 212]], { stroke: '#BFCBD9', sw: 1.8 });
  box(104, 0, 84, 152, 6, 4, WHITE, { ...room, fy: '#EFF3F7', fx: '#DFE6EE' });                     // 창대
  for (const x0 of [96, 238]) {                                                                     // 커튼
    poly([[x0, 1, 58], [x0 + 26, 1, 58], [x0 + 26, 1, 222], [x0, 1, 222]], '#F6F0E6', { stroke: 'rgba(120,100,70,.22)', sw: 0.7 });
    for (const dx of [7, 13, 20]) line([[x0 + dx, 1, 60], [x0 + dx, 1, 220]], { stroke: 'rgba(120,100,70,.2)', sw: 0.7 });
  }
  line([[90, 1, 224], [270, 1, 224]], { stroke: '#7F8C9D', sw: 1.8 });
  // 액자 (왼쪽 벽)
  poly([[0, 222, 128], [0, 272, 128], [0, 272, 192], [0, 222, 192]], WHITE);
  poly([[0, 229, 135], [0, 265, 135], [0, 265, 185], [0, 229, 185]], '#F1F3F6', thin);
  poly([[0, 238, 135], [0, 256, 135], [0, 256, 164], [0, 238, 164]], BLUE, none);
  o += `<circle cx="${P([0, 257, 170]).split(',')[0]}" cy="${P([0, 257, 170]).split(',')[1]}" r="5" fill="none" style="stroke:${LINE}" stroke-width=".7"/>`;

  // ── 가구 (B안 방식) ──
  o += '<g class="furn">';
  box(100, 125, 0, 170, 110, 1.5, BLUE, { sw: 0.6, ky: 18, kx: 26 });                               // 러그
  line([[107, 132, 1.6], [263, 132, 1.6], [263, 228, 1.6], [107, 228, 1.6], [107, 132, 1.6]], { sw: 0.5, stroke: 'rgba(255,255,255,.75)' });
  o += '</g><g filter="url(#lrBlur)" opacity=".13">';
  shadow(0, 0, 60, 100, 200); shadow(122, 2, 116, 56, 30); shadow(142, 64, 36, 36, 30); shadow(290, 0, 110, 200, 40); shadow(0, 115, 30, 80, 120); shadow(362, 262, 22, 22, 24);
  o += '</g><g class="furn">';

  // 옷장 (뒤 왼쪽 구석): 문 선과 손잡이는 x=60 면
  box(0, 0, 0, 60, 100, 200, WHITE, { ky: 4, kx: 9 });
  line([[60, 0, 6], [60, 100, 6]], { sw: 0.5 }); line([[60, 50, 6], [60, 50, 199]]);
  line([[60, 45, 96], [60, 45, 116]], { sw: 1.5 }); line([[60, 55, 96], [60, 55, 116]], { sw: 1.5 });

  // 책상 (창문 아래): 다리 4개 + 상판 + 노트북, 책, 스탠드
  [[122, 2], [234, 2], [122, 54], [234, 54]].forEach(([x, y]) => box(x, y, 0, 4, 4, 68, WOOD, thin));
  box(120, 0, 68, 120, 60, 4, WOOD);
  box(160, 26, 72, 36, 24, 1.5, '#E4E8EE', thin);
  poly([[160, 26, 73.5], [196, 26, 73.5], [196, 21, 97], [160, 21, 97]], DARK, thin);
  box(208, 14, 72, 22, 16, 4, LINEN, thin); box(210, 15, 76, 18, 14, 3, WHITE, thin);
  box(127, 14, 72, 12, 12, 2, WHITE, thin); line([[133, 20, 74], [133, 20, 100]], { sw: 1 });
  poly([[125, 20, 100], [141, 20, 100], [138, 20, 114], [128, 20, 114]], '#FFF6DC');
  // 의자: 가는 다리 + 얇은 좌판 + 등받이
  [[143, 65], [174, 65], [143, 96], [174, 96]].forEach(([x, y]) => box(x, y, 0, 3, 3, 42, WOOD, thin));
  box(142, 64, 42, 36, 36, 4, LINEN);
  box(143, 97, 46, 3, 3, 24, WOOD, thin); box(174, 97, 46, 3, 3, 24, WOOD, thin);
  box(142, 96.5, 68, 36, 4, 14, WOOD);

  // 침대 (뒤 오른쪽, 머리는 뒤 벽): 머리판, 다리, 틀, 매트리스, 베개, 쿠션, 접은 이불, 발치 담요
  box(290, 0, 0, 110, 6, 88, WOOD);
  [[291, 192], [393, 192], [393, 8]].forEach(([x, y]) => box(x, y, 0, 6, 6, 9, WOOD, thin));
  box(290, 6, 9, 110, 194, 13, WOOD);
  box(292, 8, 22, 106, 190, 16, WHITE);
  box(305, 13, 38, 80, 32, 8, WHITE, thin);
  box(304, 47, 38, 34, 9, 26, LINEN, thin); box(348, 47, 38, 34, 9, 26, BLUE, thin);
  box(291, 66, 22, 109.5, 134.5, 19, LINEN);
  line([[291, 80, 41.1], [400.5, 80, 41.1]], { sw: 0.5 }); line([[400.5, 80, 41], [400.5, 80, 22]], { sw: 0.5 });
  box(290.5, 150, 22, 110.5, 36, 19.7, BLUE, thin);

  // 책장 (왼쪽 벽): 칸과 책은 x=30 면
  box(0, 115, 0, 30, 80, 120, WOOD);
  const face = (y0, y1, z0, z1, c, a) => poly([[30, y0, z0], [30, y1, z0], [30, y1, z1], [30, y0, z1]], c, a);
  [[6, 40], [44, 78], [82, 116]].forEach(([a, b]) => face(118, 192, a, b, shade(WOOD, 30), thin));
  const books = (z0, list) => list.forEach(([y, w, h, c]) => face(y, y + w, z0, z0 + h, c, { sw: 0.5 }));
  books(82, [[120, 5, 26, WHITE], [125, 6, 30, BLUE], [131, 4, 24, LINEN], [135, 6, 28, DARK], [141, 5, 25, WHITE]]);
  face(162, 188, 82, 100, LINEN, thin);
  books(44, [[152, 6, 28, LINEN], [158, 5, 24, WHITE], [163, 7, 30, BLUE], [170, 5, 26, DARK], [175, 6, 27, WHITE], [181, 6, 22, LINEN]]);
  face(122, 144, 44, 58, WHITE, thin);
  face(124, 164, 6, 30, LINEN, thin); line([[30, 138, 22], [30, 150, 22]], { sw: 1 });
  // 무드등 (책장 위)
  box(9, 149, 120, 12, 12, 3, WHITE, thin);
  const [lx, ly] = P([15, 155, 134]).split(',');
  o += `<circle cx="${lx}" cy="${ly}" r="30" fill="url(#lrGlow)"/><circle cx="${lx}" cy="${ly}" r="11" fill="#FFF6DC" style="stroke:${LINE}" stroke-width=".7"/>`;

  // 화분 (앞 오른쪽 구석)
  box(362, 262, 0, 22, 22, 24, WHITE, thin);
  const [px, py] = P([373, 273, 24]).split(',');
  [[-40, 52, '#6FAE94'], [-19, 72, '#4F9478'], [3, 84, '#7DB9A0'], [24, 68, '#4F9478'], [44, 50, '#6FAE94']].forEach(([deg, L, c]) =>
    (o += `<path d="M0 0C-6 ${-L * 0.3} -5 ${-L * 0.75} 0 ${-L}C5 ${-L * 0.75} 6 ${-L * 0.3} 0 0Z" transform="translate(${px} ${py}) rotate(${deg})" fill="${c}" style="stroke:${LINE}" stroke-width=".6" stroke-linejoin="round"/>`));
  o += '</g>';

  return '<defs><linearGradient id="lrSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, var(--accent) 34%, #fff)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--accent) 9%, #fff)"/></linearGradient>' +
    '<radialGradient id="lrGlow"><stop offset="0" stop-color="#FFE08A" stop-opacity=".6"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient>' +
    '<filter id="lrSoft" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="12"/></filter>' +
    '<filter id="lrBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>' + o;
}
const HTML = { __html: build() }; // 고정 그림이라 한 번만 만들어요

export default function IsoRoom({ className = 'iso-room', label = '4m × 3m 원룸에 침대, 책상, 옷장, 책장, 러그를 놓은 입체 그림' }) {
  return <svg className={className} viewBox="-292 -262 670 676" role="img" aria-label={label} dangerouslySetInnerHTML={HTML} />;
}
