// 아이소메트릭 방 그림(iso-room.svg)을 만든다. 랜딩 히어로와 3D 탭 목업에서 같이 쓴다.
// 사용: node gen-iso.mjs iso-room.svg   (방 400×300cm, 평면도와 같은 배치·같은 "북유럽" 색)
import { writeFileSync } from 'node:fs';
const C = 0.866, out = [];
const pt = (x, y, z = 0) => [(x - y) * C, (x + y) * 0.5 - z];
const P = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');
const poly = (pts, fill, extra = '') => out.push(`<polygon points="${pts.map((p) => P(...p)).join(' ')}" fill="${fill}" ${extra}/>`);
const S = 'stroke="rgba(40,52,70,.2)" stroke-width=".7" stroke-linejoin="round"';
const shadow = (x, y, w, d) => poly([[x + 5, y + 5], [x + w + 10, y + 5], [x + w + 10, y + d + 10], [x + 5, y + d + 10]], 'rgba(40,52,70,.10)');
// 보이는 면: 위(top), y=max 면(fy, 밝음), x=max 면(fx, 어두움). 빛은 왼쪽 앞 위에서 와요.
function box(x, y, z, w, d, h, [top, fy, fx], sh) {
  if (sh) shadow(x, y, w, d);
  poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], fy, S);
  poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], fx, S);
  poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top, S);
}
const line = (a, b, stroke, w = 0.8) => out.push(`<path d="M${P(...a)} L${P(...b)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`);
const WOOD = ['#F1E3CE', '#E3CEB0', '#D4BC9A'], WHITE = ['#FFFFFF', '#EFF3F7', '#DFE6EE'],
  BLUE = ['#A3C8EC', '#8AB4DE', '#76A2CF'], DEEP = ['#587796', '#3F5F7F', '#35516D'], PEACH = ['#F8D8BC', '#EFC3A0', '#E4B089'];

out.push(`<ellipse cx="43" cy="378" rx="330" ry="28" fill="rgba(8,45,100,.24)" filter="url(#b)"/>`);
box(-8, -8, -12, 416, 316, 12, ['#F5EEE3', '#E4D9C9', '#D7CAB7']);            // 바닥
box(-8, -8, 0, 8, 316, 240, ['#C9D3DF', '#D5DDE7', '#EDF1F6']);               // 왼쪽 벽 (안쪽 면 = x=0)
box(0, -8, 0, 408, 8, 240, ['#C9D3DF', '#FFFFFF', '#D5DDE7']);                // 뒤 벽 (안쪽 면 = y=0)
poly([[110, 3], [250, 3], [300, 150], [160, 150]], 'rgba(255,255,255,.55)');  // 창가 빛
// 창문 + 커튼 (뒤 벽)
poly([[110, 0, 88], [250, 0, 88], [250, 0, 212], [110, 0, 212]], 'url(#sky)', 'stroke="#BFCBD9" stroke-width="2.6" stroke-linejoin="round"');
line([180, 0, 88], [180, 0, 212], '#BFCBD9', 1.8);
box(104, 0, 84, 152, 6, 4, WHITE);
for (const x0 of [96, 238]) {
  poly([[x0, 1, 58], [x0 + 26, 1, 58], [x0 + 26, 1, 222], [x0, 1, 222]], '#F6F0E6', 'stroke="rgba(120,100,70,.22)" stroke-width=".7"');
  for (const dx of [7, 13, 20]) line([x0 + dx, 1, 60], [x0 + dx, 1, 220], 'rgba(120,100,70,.2)', 0.7);
}
line([90, 1, 224], [270, 1, 224], '#7F8C9D', 1.8);
// 액자 (왼쪽 벽, 앞쪽)
poly([[0, 222, 128], [0, 272, 128], [0, 272, 192], [0, 222, 192]], '#FFFFFF', 'stroke="#3F5F7F" stroke-width="1.6" stroke-linejoin="round"');
poly([[0, 230, 136], [0, 264, 136], [0, 264, 160], [0, 230, 160]], '#F2C6A0');
poly([[0, 242, 150], [0, 264, 150], [0, 264, 184], [0, 242, 184]], '#8FB8DE', 'opacity=".9"');
// 러그
poly([[100, 125], [270, 125], [270, 235], [100, 235]], '#F6D3B4', 'stroke="#E7B48F" stroke-width=".8"');
poly([[107, 132], [263, 132], [263, 228], [107, 228]], 'none', 'stroke="#FFFFFF" stroke-width="1.5" opacity=".8"');
// 옷장 (뒤 왼쪽 구석, 문은 x=60 면)
box(0, 0, 0, 60, 100, 200, WHITE, true);
line([60, 50, 3], [60, 50, 197], '#BAC4D0'); line([60, 45, 92], [60, 45, 114], '#7F8C9D', 1.7); line([60, 55, 92], [60, 55, 114], '#7F8C9D', 1.7);
// 책상 (창문 아래) + 모니터 + 키보드 + 공책
shadow(120, 0, 120, 60);
box(120, 0, 0, 4, 60, 70, WHITE); box(236, 0, 0, 4, 60, 70, WHITE);
box(120, 0, 70, 120, 60, 4, WOOD);
box(154, 9, 74, 8, 8, 9, DEEP); box(138, 12, 83, 40, 3, 27, DEEP);
poly([[140, 15, 85], [176, 15, 85], [176, 15, 108], [140, 15, 108]], '#C6E1FA');
box(142, 30, 74, 32, 10, 1.5, WHITE); box(206, 14, 74, 17, 23, 2.5, PEACH);
// 의자 (얇은 좌판 + 등받이, 상자처럼 보이지 않게)
shadow(142, 64, 36, 36);
for (const [lx, ly] of [[143, 65], [174, 65], [143, 96], [174, 96]]) box(lx, ly, 0, 3, 3, 43, WOOD);
box(142, 64, 43, 36, 36, 5, BLUE);
box(143, 97, 48, 3, 3, 16, WOOD); box(174, 97, 48, 3, 3, 16, WOOD);
box(142, 96, 62, 36, 4, 20, BLUE);
// 협탁 + 무드등
box(252, 7, 0, 26, 26, 44, WOOD, true);
{ const [px, py] = pt(265, 20, 44);
  out.push(`<circle cx="${px}" cy="${py - 16}" r="34" fill="url(#glow)"/>`,
    `<ellipse cx="${px}" cy="${py}" rx="7" ry="3.5" fill="#C9D3DF"/>`, `<path d="M${px} ${py}v-10" stroke="#7F8C9D" stroke-width="1.6"/>`,
    `<path d="M${px - 9} ${py - 9}h18l-3.5-15h-11z" fill="#FFF3D2" stroke="rgba(120,100,70,.3)" stroke-width=".7" stroke-linejoin="round"/>`); }
// 침대 (뒤 오른쪽, 머리맡은 뒤 벽)
box(290, 0, 0, 110, 200, 24, WOOD, true);
box(290, 0, 0, 110, 6, 88, WOOD);
box(293, 6, 24, 104, 191, 18, WHITE);
box(312, 14, 42, 66, 36, 9, ['#FFFFFF', '#EDF1F6', '#DEE5ED']);
box(291, 66, 24, 108, 133, 21, BLUE);
box(291, 66, 45, 108, 20, 2, ['#EEF5FC', '#DAE8F6', '#C8DCEF']);
// 책장 (왼쪽 벽): 책은 흰색·짙은 파랑·하늘색 + 살구색 하나만
box(0, 115, 0, 30, 80, 180, ['#F1E3CE', '#E3CEB0', '#FAF3E8'], true);
const books = ['#FFFFFF', '#3F5F7F', '#8FB8DE', '#FFFFFF', '#3F5F7F', '#F2C6A0', '#8FB8DE'];
[0, 36, 72, 108, 144].forEach((z, r) => {
  let y = 119;
  for (let i = 0; y < 176 - (r % 2) * 20 + (r === 2 ? 14 : 0); i++) {
    const w = 6 + ((i * 5 + r * 3) % 3), h = 22 + ((i * 7 + r) % 8);
    poly([[30, y, z + 3], [30, y + w, z + 3], [30, y + w, z + 3 + h], [30, y, z + 3 + h]], books[(i + r * 3) % books.length], 'stroke="rgba(40,52,70,.22)" stroke-width=".5"');
    y += w + 1;
  }
  if (z) line([30, 115, z], [30, 195, z], '#D4BC9A', 1.8);
});
// 화분 (앞 오른쪽 구석): 흰 화분 + 길쭉한 잎
box(362, 262, 0, 22, 22, 24, WHITE, true);
{ const [px, py] = pt(373, 273, 24);
  [[-40, 52, '#5BA688'], [-19, 72, '#3F8C6E'], [3, 84, '#6DB698'], [24, 68, '#3F8C6E'], [44, 50, '#5BA688']].forEach(([a, L, c]) =>
    out.push(`<path d="M0 0C-6 ${-L * 0.3} -5 ${-L * 0.75} 0 ${-L}C5 ${-L * 0.75} 6 ${-L * 0.3} 0 0Z" transform="translate(${px} ${py}) rotate(${a})" fill="${c}"/>`)); }

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-292 -262 670 676" role="img" aria-label="4m × 3m 원룸에 침대·책상·옷장·책장·러그를 놓은 입체 그림">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9D6FF"/><stop offset="1" stop-color="#E6F4FF"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#FFE08A" stop-opacity=".7"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient>
<filter id="b" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="12"/></filter></defs>
${out.join('\n')}
</svg>`;
writeFileSync(process.argv[2], svg);
console.log('wrote', process.argv[2], svg.length);
