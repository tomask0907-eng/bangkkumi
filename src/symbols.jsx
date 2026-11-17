// 평면도용 가구 그림 (SVG). 원점 (0,0)에 폭 w × 깊이 d, 등이 위(y=0), 앞이 아래(y=d)인 상태로 그린다.
// 회전·위치는 부르는 쪽이 <g transform={symbolTransform(item)}>로 처리한다. 길이 단위는 모두 cm.
// 선 굵기는 화면 px 기준(non-scaling-stroke)이라 확대·축소해도 가늘게 유지된다.

/* ───────── 색 계산 ───────── */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toRgb = (hex) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex || '')?.[1] ?? 'b9a48c'; // 색이 깨져 있으면 기본 나무색
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#2a2118', t); // 순수 검정 대신 따뜻한 먹색으로 어둡게
const luma = (c) => { const [r, g, b] = toRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
// 테두리·세부선 색: 밝은 면은 어둡게, 어두운 면은 밝게
const edge = (fill) => (luma(fill) < 0.3 ? lighten(fill, 0.28) : darken(fill, 0.42));
const NS = { vectorEffect: 'non-scaling-stroke' };
const ln = (fill, px = 1) => ({ stroke: edge(fill), strokeWidth: px, ...NS });
const thin = (fill, opacity = 0.55) => ({ fill: 'none', stroke: edge(fill), strokeWidth: 0.8, strokeOpacity: opacity, strokeLinecap: 'round', ...NS });
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); }; // 항상 같은 결과를 내는 난수

// 스타일 팔레트(벽, 바닥, 메인 가구, 패브릭, 포인트)를 가구색에 섞는다 → 스타일을 바꾸면 평면도 색도 바뀐다
function tones(spec, palette) {
  const base = spec.color || '#b9a48c';
  const main = palette?.[2]?.hex, fabric = palette?.[3]?.hex, point = palette?.[4]?.hex;
  return {
    base,
    wood: main ? mix(base, main, 0.45) : base,
    cloth: fabric ? mix(lighten(base, 0.3), fabric, 0.7) : lighten(base, 0.4),
    sofa: fabric ? mix(base, fabric, 0.45) : base,
    point: point || '#c8794a',
  };
}

/* ───────── 어떤 그림을 쓸지 고르기 ───────── */
const RULES = [
  ['rug', /rug|carpet|러그|카펫|카페트|매트$/],
  ['piano', /piano|피아노|신디|건반/],
  ['tv', /\btv|티비|텔레비전|거실장|tv장/],
  ['fridge', /fridge|refrig|냉장고/],
  ['washer', /washer|dryer|laundry|세탁기|건조기/],
  ['vanity', /vanity|화장대/],
  ['mirror', /mirror|거울/],
  ['hanger', /hanger|drying|행거|옷걸이|건조대/],
  ['wardrobe', /wardrobe|closet|옷장|장롱|붙박이/],
  ['bookshelf', /bookshelf|bookcase|shelf|책장|선반|책꽂이/],
  ['drawer', /dresser|drawer|nightstand|bedside|chest|cabinet|서랍|협탁|수납장/],
  ['sofa', /sofa|couch|recliner|armchair|소파|쇼파|리클라이너|암체어/],
  ['bed', /bed|침대|매트리스/],
  ['dining', /dining|식탁/],
  ['lowtable', /coffee|side_?table|low_?table|좌식|티테이블|소파 ?테이블|사이드 ?테이블|커피|탁자|밥상/],
  ['desk', /desk|책상/],
  ['plant', /plant|화분|식물|몬스테라|야자/],
  ['lamp', /lamp|light|조명|램프|무드등|스탠드/],
  ['chair', /chair|stool|의자|스툴|빈백|bean/],
];
const BY_CATEGORY = { bed: 'bed', desk: 'desk', table: 'lowtable', appliance: 'appliance' };

export function symbolKind(spec) {
  if (spec.floor) return 'rug';
  const text = `${spec.key || ''} ${spec.name || ''}`.toLowerCase();
  const hit = RULES.find(([, re]) => re.test(text));
  if (hit) return hit[0];
  if (spec.category === 'storage') return spec.tall ? (spec.d <= 40 ? 'bookshelf' : 'wardrobe') : 'drawer';
  if (spec.category === 'seating') return spec.w >= 100 ? 'sofa' : 'chair';
  return BY_CATEGORY[spec.category] || 'generic';
}
const isRound = (spec) => /round|원형|라운드/.test(`${spec.key || ''} ${spec.name || ''}`.toLowerCase());

/* ───────── 공통 조각 ───────── */
// 의자: 좌판이 y에서 시작(탁자 쪽), 등받이는 아래쪽
function Seat({ cx, y, sw, sd, fill }) {
  return (
    <g>
      <rect x={cx - sw / 2} y={y} width={sw} height={sd} rx={sw * 0.24} fill={fill} {...ln(fill)} />
      <rect x={cx - sw * 0.44} y={y + sd * 0.8} width={sw * 0.88} height={sd * 0.24} rx={sd * 0.12} fill={darken(fill, 0.16)} {...ln(fill)} />
    </g>
  );
}
// 앞면(문짝·서랍) 띠: 칸 나눔선과 손잡이
function FrontBand({ w, d, n, fill, knobs = true }) {
  const bh = clamp(d * 0.08, 2.4, 4.5);
  const cells = Array.from({ length: n }, (_, i) => i);
  return (
    <g>
      <rect y={d - bh} width={w} height={bh} rx={1} fill={darken(fill, 0.1)} {...ln(fill)} />
      {cells.slice(1).map((i) => <line key={i} x1={(w * i) / n} x2={(w * i) / n} y1={d - bh} y2={d} {...thin(fill, 0.9)} />)}
      {knobs && cells.map((i) => <rect key={`k${i}`} x={(w * (i + 0.5)) / n - 3} y={d - 0.6} width={6} height={1.6} rx={0.8} fill={darken(fill, 0.5)} />)}
    </g>
  );
}
const Mug = ({ x, y, r = 4 }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#fbfaf7" {...ln('#e9e4da')} />
    <circle cx={x} cy={y} r={r * 0.62} fill="#7a5a44" />
  </g>
);

/* ───────── 가구별 그림 ───────── */
function Bed({ w, d, t }) {
  const hb = clamp(d * 0.045, 4, 9);   // 헤드보드
  const m = clamp(w * 0.03, 1.5, 4);   // 프레임이 매트리스 밖으로 보이는 폭
  const two = w > 120;                 // 폭 120cm까지는 베개 1개
  const ph = clamp(d * 0.17, 12, 36);
  const py = hb + m + 4;
  const pw = two ? (w - m * 2 - 16) / 2 : Math.min(w - m * 2 - 14, 72);
  const px = two ? [m + 6, m + 10 + pw] : [(w - pw) / 2];
  const by = py + ph + 5;              // 이불 시작
  const fold = clamp(d * 0.09, 8, 20);
  const sheet = lighten(t.cloth, 0.62), blanket = t.cloth;
  const r = 4;
  return (
    <>
      <rect width={w} height={d} rx={3} fill={t.wood} {...ln(t.wood, 1.2)} />
      <rect width={w} height={hb} rx={2} fill={darken(t.wood, 0.2)} {...ln(t.wood)} />
      <rect x={m} y={hb + 1} width={w - 2 * m} height={d - hb - 1 - m} rx={r} fill={sheet} {...ln(sheet)} />
      {px.map((x) => (
        <g key={x}>
          <rect x={x} y={py} width={pw} height={ph} rx={Math.min(7, ph * 0.3)} fill="#fffdf9" {...ln(sheet)} />
          <path d={`M${x + pw * 0.2} ${py + ph * 0.5}h${pw * 0.6}`} {...thin(sheet, 0.3)} />
        </g>
      ))}
      <path d={`M${m} ${by}H${w - m}V${d - m - r}Q${w - m} ${d - m} ${w - m - r} ${d - m}H${m + r}Q${m} ${d - m} ${m} ${d - m - r}Z`} fill={blanket} {...ln(blanket)} />
      <rect x={m} y={by} width={w - 2 * m} height={fold} fill={lighten(blanket, 0.38)} {...ln(blanket)} />
      {/* 이불 한쪽 모서리를 접어 둔 모양 */}
      <path d={`M${w - m} ${by + fold}L${w - m - fold * 1.5} ${by + fold}L${w - m} ${by + fold * 2.5}Z`} fill={sheet} {...ln(blanket)} />
      <path d={`M${w * 0.3} ${by + fold + (d - by) * 0.3}Q${w * 0.5} ${by + fold + (d - by) * 0.36} ${w * 0.62} ${by + fold + (d - by) * 0.3}M${w * 0.2} ${d - m - (d - by) * 0.2}Q${w * 0.45} ${d - m - (d - by) * 0.26} ${w * 0.7} ${d - m - (d - by) * 0.2}`} {...thin(blanket, 0.28)} />
    </>
  );
}

function Desk({ w, d, clear, t }) {
  const top = t.wood;
  const mw = clamp(w * 0.42, 22, 62), my = clamp(d * 0.2, 5, 14);
  const kw = clamp(w * 0.3, 24, 40), kh = clamp(d * 0.19, 8, 13), ky = d * 0.56;
  const room = w >= 70 && d >= 45; // 작은 책상에는 키보드를 그리지 않는다
  return (
    <>
      {clear >= 30 && <Seat cx={w / 2} y={d - 9} sw={Math.min(46, w * 0.55)} sd={Math.min(46, clear + 3)} fill={darken(t.cloth, 0.22)} />}
      <rect width={w} height={d} rx={2.5} fill={top} {...ln(top, 1.2)} />
      <rect x={1.6} y={1.6} width={w - 3.2} height={d - 3.2} rx={1.5} fill="none" stroke={lighten(top, 0.3)} strokeWidth={0.8} strokeOpacity={0.7} {...NS} />
      {d >= 30 && w >= 40 && (
        <>
          <ellipse cx={w / 2} cy={my - 0.5} rx={mw * 0.17} ry={3.4} fill="#4a4b50" />
          <rect x={w / 2 - mw / 2} y={my} width={mw} height={3.4} rx={1.4} fill="#2b2c30" />
          <rect x={w / 2 - mw / 2 + 1} y={my + 2.6} width={mw - 2} height={0.8} fill="#8fb4c9" opacity={0.8} />
        </>
      )}
      {room && (
        <>
          <rect x={w / 2 - kw / 2} y={ky} width={kw} height={kh} rx={1.6} fill="#f6f4ef" {...ln('#e2ddd2')} />
          <path d={`M${w / 2 - kw / 2 + 2} ${ky + kh * 0.36}h${kw - 4}M${w / 2 - kw / 2 + 2} ${ky + kh * 0.66}h${kw - 4}`} {...thin('#e2ddd2', 0.5)} />
          <ellipse cx={w / 2 + kw / 2 + 8} cy={ky + kh / 2} rx={2.8} ry={4.2} fill="#f6f4ef" {...ln('#e2ddd2')} />
        </>
      )}
      {w >= 100 && d >= 45 && <Mug x={w * 0.13} y={d * 0.32} />}
    </>
  );
}

function Wardrobe({ w, d, t }) {
  const n = clamp(Math.round(w / 50), w >= 60 ? 2 : 1, 6);
  const inner = lighten(t.wood, 0.28);
  const ry = d * 0.44, L = d * 0.52;
  const count = Math.max(2, Math.floor((w - 12) / 8));
  return (
    <>
      <rect width={w} height={d} rx={2} fill={t.wood} {...ln(t.wood, 1.2)} />
      <rect x={2.5} y={2.5} width={w - 5} height={d - 7} rx={1} fill={inner} {...ln(inner)} />
      {/* 옷걸이: 봉을 가로지르는 짧은 선 */}
      {d >= 35 && Array.from({ length: count }, (_, i) => {
        const x = 6 + ((w - 12) * (i + 0.5)) / count, dx = (rnd(i) - 0.35) * L * 0.12;
        return <line key={i} x1={x - dx} y1={ry - L / 2} x2={x + dx} y2={ry + L / 2} {...thin(inner, 0.5)} />;
      })}
      <line x1={5} x2={w - 5} y1={ry} y2={ry} stroke={edge(inner)} strokeWidth={1.6} strokeLinecap="round" {...NS} />
      <FrontBand w={w} d={d} n={n} fill={t.wood} />
    </>
  );
}

function Hanger({ w, d, t }) {
  const metal = t.base, cy = d / 2;
  const count = Math.max(2, Math.floor((w - 16) / 11));
  const cloths = [t.cloth, t.point, lighten(t.point, 0.45), darken(t.cloth, 0.25), '#f1ede4'];
  return (
    <>
      <rect width={w} height={d} rx={4} fill={metal} fillOpacity={0.12} stroke={edge(metal)} strokeWidth={0.8} strokeDasharray="3 3" strokeOpacity={0.6} {...NS} />
      {Array.from({ length: count }, (_, i) => {
        const x = 8 + ((w - 16) * (i + 0.5)) / count, len = d * (0.72 + rnd(i) * 0.2), fill = cloths[i % cloths.length];
        return <rect key={i} x={x - 2.6} y={cy - len / 2} width={5.2} height={len} rx={2.4} fill={fill} {...ln(fill)} transform={`rotate(${(rnd(i + 9) - 0.5) * 10} ${x} ${cy})`} />;
      })}
      <line x1={3} x2={w - 3} y1={cy} y2={cy} stroke={darken(metal, 0.45)} strokeWidth={2} strokeLinecap="round" {...NS} />
      {[2.5, w - 2.5].map((x) => <rect key={x} x={x - 2} y={1} width={4} height={d - 2} rx={2} fill={darken(metal, 0.3)} {...ln(metal)} />)}
    </>
  );
}

function Bookshelf({ w, d, t }) {
  const n = Math.max(1, Math.round(w / 38));
  const inner = lighten(t.wood, 0.3);
  const colors = [t.cloth, t.point, lighten(t.wood, 0.5), darken(t.cloth, 0.3), '#efeae0', lighten(t.point, 0.4)];
  const books = [];
  if (d >= 18 && w >= 30) {
    for (let c = 0, k = 0; c < n; c++) {
      const x0 = 2.5 + ((w - 5) * c) / n + 1, x1 = 2.5 + ((w - 5) * (c + 1)) / n - 1;
      for (let x = x0; x < x1 - 2.5; k++) {
        const bw = Math.min(2.6 + rnd(k) * 3, x1 - x);
        if (rnd(k + 50) > 0.16) { // 가끔 빈자리를 두어 자연스럽게
          const bd = (d - 5.5) * (0.68 + rnd(k + 20) * 0.3), fill = colors[Math.floor(rnd(k + 7) * colors.length)];
          books.push(<rect key={k} x={x} y={3} width={bw - 0.5} height={bd} rx={0.5} fill={fill} {...ln(fill, 0.7)} />);
        }
        x += bw;
      }
    }
  }
  return (
    <>
      <rect width={w} height={d} rx={2} fill={t.wood} {...ln(t.wood, 1.2)} />
      <rect x={2.5} y={2.5} width={w - 5} height={d - 4} fill={inner} {...ln(inner)} />
      {books}
      {Array.from({ length: n - 1 }, (_, i) => <rect key={i} x={2.5 + ((w - 5) * (i + 1)) / n - 0.9} y={2.5} width={1.8} height={d - 4} fill={t.wood} {...ln(t.wood, 0.7)} />)}
    </>
  );
}

function Drawer({ w, d, t }) {
  const n = clamp(Math.round(w / 45), 1, 4);
  return (
    <>
      <rect width={w} height={d} rx={2.5} fill={t.wood} {...ln(t.wood, 1.2)} />
      <rect x={2} y={2} width={w - 4} height={d - 6} rx={1.5} fill="none" stroke={lighten(t.wood, 0.3)} strokeWidth={0.8} strokeOpacity={0.7} {...NS} />
      {w >= 60 && d >= 35 && (
        <>
          <rect x={w * 0.12} y={d * 0.2} width={Math.min(20, w * 0.26)} height={Math.min(12, d * 0.3)} rx={2} fill={lighten(t.cloth, 0.3)} {...ln(t.cloth)} />
          <circle cx={w * 0.78} cy={d * 0.36} r={Math.min(4.5, d * 0.12)} fill={t.point} {...ln(t.point)} />
        </>
      )}
      <FrontBand w={w} d={d} n={n} fill={t.wood} />
    </>
  );
}

function Sofa({ w, d, t }) {
  const f = t.sofa;
  const bd = clamp(d * 0.24, 8, 22), aw = clamp(w * 0.1, 6, 18);
  const n = w < 110 ? 1 : w < 190 ? 2 : 3;
  const sx = aw + 1, sw = (w - 2 * aw - 2) / n;
  const seats = Array.from({ length: n }, (_, i) => i);
  return (
    <>
      <rect width={w} height={d} rx={6} fill={darken(f, 0.14)} {...ln(f, 1.2)} />
      {seats.map((i) => <rect key={i} x={sx + sw * i + 0.6} y={bd + 0.5} width={sw - 1.2} height={d - bd - 2.5} rx={4} fill={lighten(f, 0.16)} {...ln(f)} />)}
      <rect width={w} height={bd} rx={5} fill={darken(f, 0.06)} {...ln(f)} />
      {seats.map((i) => <rect key={`b${i}`} x={sx + sw * i + 2} y={bd * 0.42} width={sw - 4} height={bd * 0.78} rx={Math.min(4, bd * 0.3)} fill={lighten(f, 0.08)} {...ln(f)} />)}
      {[0, w - aw].map((x) => <rect key={x} x={x} y={bd * 0.45} width={aw} height={d - bd * 0.45} rx={Math.min(5, aw * 0.45)} fill={darken(f, 0.02)} {...ln(f)} />)}
      {w >= 120 && <rect x={aw + 4} y={bd + 3} width={15} height={15} rx={3.5} fill={t.point} {...ln(t.point)} transform={`rotate(-14 ${aw + 11} ${bd + 10})`} />}
    </>
  );
}

function Chair({ w, d, t, spec }) {
  const f = t.sofa;
  if (isRound(spec) || /stool|스툴|빈백|bean/.test(`${spec.key} ${spec.name}`.toLowerCase())) {
    return (
      <>
        <ellipse cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} fill={f} {...ln(f, 1.2)} />
        <ellipse cx={w / 2} cy={d * 0.52} rx={w * 0.32} ry={d * 0.3} fill={lighten(f, 0.14)} {...thin(f, 0.4)} />
      </>
    );
  }
  const bd = clamp(d * 0.2, 4, 12);
  return (
    <>
      <rect y={bd * 0.5} width={w} height={d - bd * 0.5} rx={Math.min(8, w * 0.2)} fill={lighten(f, 0.1)} {...ln(f, 1.2)} />
      <rect width={w} height={bd} rx={bd * 0.45} fill={darken(f, 0.12)} {...ln(f)} />
    </>
  );
}

function Dining({ w, d, clear, t, spec }) {
  const n = clamp(Math.floor((w + 10) / 50), 1, 3);
  const sw = Math.min(40, w / n - 6);
  const top = t.wood;
  return (
    <>
      {clear >= 30 && Array.from({ length: n }, (_, i) => <Seat key={i} cx={(w * (i + 0.5)) / n} y={d - 10} sw={sw} sd={Math.min(40, clear + 4)} fill={darken(t.cloth, 0.18)} />)}
      {isRound(spec)
        ? <ellipse cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} fill={top} {...ln(top, 1.2)} />
        : <rect width={w} height={d} rx={3.5} fill={top} {...ln(top, 1.2)} />}
      <path d={`M${w * 0.12} ${d * 0.3}H${w * 0.88}M${w * 0.18} ${d * 0.72}H${w * 0.82}`} {...thin(top, 0.22)} />
      {Math.min(w, d) >= 50 && (
        <>
          <circle cx={w / 2} cy={d / 2} r={Math.min(8, d * 0.13)} fill={lighten(t.cloth, 0.4)} {...ln(t.cloth)} />
          <circle cx={w / 2} cy={d / 2} r={Math.min(4.5, d * 0.075)} fill={t.point} />
        </>
      )}
    </>
  );
}

function LowTable({ w, d, t, spec }) {
  const top = t.wood, m = Math.min(w, d);
  return (
    <>
      {isRound(spec)
        ? <><ellipse cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} fill={top} {...ln(top, 1.2)} /><ellipse cx={w / 2} cy={d / 2} rx={w / 2 - 2.5} ry={d / 2 - 2.5} {...thin(lighten(top, 0.5), 0.6)} /></>
        : <><rect width={w} height={d} rx={Math.min(7, m * 0.14)} fill={top} {...ln(top, 1.2)} /><rect x={2} y={2} width={w - 4} height={d - 4} rx={Math.min(5.5, m * 0.1)} {...thin(lighten(top, 0.5), 0.6)} /></>}
      {m >= 40 && w >= 55 && (
        <>
          <rect x={w * 0.5} y={d * 0.26} width={Math.min(22, w * 0.3)} height={Math.min(15, d * 0.4)} rx={1} fill={lighten(t.cloth, 0.2)} {...ln(t.cloth)} transform={`rotate(8 ${w * 0.6} ${d * 0.45})`} />
          <Mug x={w * 0.26} y={d * 0.55} r={3.6} />
        </>
      )}
    </>
  );
}

function TvStand({ w, d, t }) {
  const tw = clamp(w * 0.8, 24, w - 4), ty = d * 0.3;
  return (
    <>
      <rect width={w} height={d} rx={2.5} fill={t.wood} {...ln(t.wood, 1.2)} />
      <FrontBand w={w} d={d} n={clamp(Math.round(w / 50), 1, 4)} fill={t.wood} knobs={false} />
      <rect x={w / 2 - tw * 0.16} y={ty - 3} width={tw * 0.32} height={clamp(d * 0.3, 6, 14)} rx={2} fill="#4a4b50" />
      <rect x={(w - tw) / 2} y={ty} width={tw} height={clamp(d * 0.1, 3, 5)} rx={1.4} fill="#232427" />
      <rect x={(w - tw) / 2 + 1} y={ty + clamp(d * 0.1, 3, 5) - 0.9} width={tw - 2} height={0.9} fill="#8fb4c9" opacity={0.85} />
    </>
  );
}

function Vanity({ w, d, clear, t }) {
  const top = t.wood, mw = w * 0.62, r = clamp(Math.min(w * 0.24, clear / 2 - 2), 8, 17);
  return (
    <>
      {clear >= 30 && <circle cx={w / 2} cy={d + r - 7} r={r} fill={t.cloth} {...ln(t.cloth)} />}
      <rect width={w} height={d} rx={2.5} fill={top} {...ln(top, 1.2)} />
      <rect x={(w - mw) / 2} y={1.5} width={mw} height={clamp(d * 0.1, 2.5, 4)} rx={1.2} fill="#d5e6ee" {...ln('#b5ccd6')} />
      {d >= 30 && [[0.74, 0.5, 3.4], [0.84, 0.36, 2.4], [0.86, 0.62, 2]].map(([x, y, cr], i) => <circle key={i} cx={w * x} cy={d * y} r={cr} fill={i ? '#f6f1e9' : t.point} {...ln(t.cloth, 0.7)} />)}
    </>
  );
}

function Mirror({ w, d, t }) {
  const f = clamp(Math.min(w, d) * 0.12, 1.2, 3);
  return (
    <>
      <rect width={w} height={d} rx={Math.min(3, d * 0.3)} fill={t.wood} {...ln(t.wood, 1.2)} />
      <rect x={f} y={f} width={w - 2 * f} height={d - 2 * f} rx={1} fill="#dcebf1" {...ln('#b5ccd6', 0.8)} />
      {d >= 14 && <path d={`M${w * 0.24} ${d * 0.72}L${w * 0.44} ${d * 0.28}M${w * 0.38} ${d * 0.72}L${w * 0.52} ${d * 0.42}`} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeOpacity={0.9} {...NS} />}
    </>
  );
}

function Fridge({ w, d, t }) {
  const f = t.base, wide = w >= 80, dh = clamp(d * 0.09, 3, 5.5);
  const handles = wide ? [w / 2 - w * 0.2, w / 2 + 2] : [w * 0.12];
  return (
    <>
      <rect width={w} height={d} rx={3} fill={f} {...ln(f, 1.2)} />
      <rect x={3.5} y={clamp(d * 0.2, 5, 12)} width={w - 7} height={d - dh - clamp(d * 0.2, 5, 12) - 3} rx={2.5} fill={lighten(f, 0.35)} {...thin(f, 0.5)} />
      {[3, 5.5, 8].filter((y) => y < d * 0.18).map((y) => <line key={y} x1={w * 0.25} x2={w * 0.75} y1={y} y2={y} {...thin(f, 0.45)} />)}
      <rect y={d - dh} width={w} height={dh} rx={2} fill={lighten(f, 0.2)} {...ln(f)} />
      {wide && <line x1={w / 2} x2={w / 2} y1={d - dh} y2={d} {...thin(f, 0.9)} />}
      {handles.map((x) => <rect key={x} x={x} y={d - 0.4} width={w * 0.18} height={1.8} rx={0.9} fill={darken(f, 0.5)} />)}
    </>
  );
}

function Washer({ w, d, t }) {
  const f = t.base, ch = d * 0.16, r = Math.min(w, d - ch) * 0.37, cy = ch + (d - ch) / 2;
  return (
    <>
      <rect width={w} height={d} rx={3.5} fill={f} {...ln(f, 1.2)} />
      <rect width={w} height={ch} rx={3} fill={darken(f, 0.08)} {...ln(f)} />
      <circle cx={w * 0.8} cy={ch / 2} r={Math.min(3, ch * 0.32)} fill={lighten(f, 0.5)} {...ln(f)} />
      <rect x={w * 0.12} y={ch * 0.34} width={w * 0.3} height={ch * 0.32} rx={1} fill="#39414a" opacity={0.75} />
      <circle cx={w / 2} cy={cy} r={r} fill={lighten(f, 0.45)} {...ln(f, 1.2)} />
      <circle cx={w / 2} cy={cy} r={r * 0.72} fill="#b7c8d2" {...ln('#9fb3bf')} />
      <path d={`M${w / 2 - r * 0.42} ${cy - r * 0.12}A${r * 0.46} ${r * 0.46} 0 0 1 ${w / 2 + r * 0.05} ${cy - r * 0.46}`} fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeOpacity={0.85} {...NS} />
    </>
  );
}

function Rug({ w, d, t, spec }) {
  const f = mix(t.sofa, lighten(t.cloth, 0.2), 0.55), b = clamp(Math.min(w, d) * 0.06, 2.5, 8);
  if (isRound(spec)) {
    return (
      <g opacity={0.86}>
        <ellipse cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} fill={f} {...ln(f, 0.9)} />
        {[0.86, 0.62, 0.34].map((k, i) => <ellipse key={k} cx={w / 2} cy={d / 2} rx={(w / 2) * k} ry={(d / 2) * k} fill={i === 1 ? lighten(f, 0.25) : 'none'} stroke={t.point} strokeOpacity={0.4} strokeWidth={1} {...NS} />)}
      </g>
    );
  }
  const along = w >= d; // 술은 짧은 변에 단다
  const len = along ? d : w, ticks = Math.floor(len / 3.2);
  const fringe = Array.from({ length: ticks }, (_, i) => {
    const p = ((i + 0.5) * len) / ticks;
    return along ? `M0 ${p}h-2.6M${w} ${p}h2.6` : `M${p} 0v-2.6M${p} ${d}v2.6`;
  }).join('');
  const sx = (k) => (along ? `M${b * 2 + k} ${b * 2}V${d - b * 2}M${w - b * 2 - k} ${b * 2}V${d - b * 2}` : `M${b * 2} ${b * 2 + k}H${w - b * 2}M${b * 2} ${d - b * 2 - k}H${w - b * 2}`);
  return (
    <g opacity={0.86}>
      <path d={fringe} stroke={darken(f, 0.2)} strokeWidth={0.8} strokeOpacity={0.7} {...NS} />
      <rect width={w} height={d} rx={2} fill={f} {...ln(f, 0.9)} />
      <rect x={b} y={b} width={w - 2 * b} height={d - 2 * b} rx={1} fill={lighten(f, 0.28)} stroke={t.point} strokeOpacity={0.5} strokeWidth={1.2} {...NS} />
      {Math.min(w, d) >= 50 && <path d={[4, 8, 12].map(sx).join('')} fill="none" stroke={t.point} strokeOpacity={0.35} strokeWidth={1} {...NS} />}
    </g>
  );
}

function Plant({ w, d, t }) {
  const r = Math.min(w, d) / 2, cx = w / 2, cy = d / 2;
  const leaf = (len) => `M0 0C${len * 0.3} ${-len * 0.3} ${len * 0.8} ${-len * 0.24} ${len} 0C${len * 0.8} ${len * 0.24} ${len * 0.3} ${len * 0.3} 0 0Z`;
  const greens = ['#4f7f52', '#6b9a63', '#3f6b45', '#82ad74'];
  const pot = mix(t.point, '#b5714a', 0.6);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r * 0.5} fill={pot} {...ln(pot)} />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} transform={`rotate(${(i * 360) / 7 + 14})`}>
          <path d={leaf(r * (0.9 + rnd(i) * 0.1))} fill={greens[i % 3]} {...ln(greens[2], 0.7)} />
          <path d={`M${r * 0.12} 0H${r * 0.8}`} stroke="#2f5236" strokeOpacity={0.45} strokeWidth={0.7} {...NS} />
        </g>
      ))}
      {Array.from({ length: 5 }, (_, i) => <path key={`s${i}`} d={leaf(r * 0.56)} transform={`rotate(${i * 72 + 50})`} fill={greens[3]} {...ln(greens[0], 0.7)} />)}
    </g>
  );
}

function Lamp({ w, d, t }) {
  const r = Math.min(w, d) / 2, cx = w / 2, cy = d / 2;
  const shade = lighten(t.cloth, 0.55);
  return (
    <>
      <circle cx={cx} cy={cy} r={r * 1.45} fill="#ffd27a" opacity={0.16} />
      <circle cx={cx} cy={cy} r={r * 1.05} fill="#ffd27a" opacity={0.22} />
      <circle cx={cx} cy={cy} r={r * 0.72} fill={shade} {...ln(shade, 1.2)} />
      <circle cx={cx} cy={cy} r={r * 0.26} fill="#fff6dc" {...ln(shade)} />
      <path d={`M${cx - r * 0.72} ${cy}H${cx - r * 0.26}M${cx + r * 0.26} ${cy}H${cx + r * 0.72}M${cx} ${cy - r * 0.72}V${cy - r * 0.26}M${cx} ${cy + r * 0.26}V${cy + r * 0.72}`} {...thin(shade, 0.35)} />
    </>
  );
}

function Piano({ w, d, clear, t }) {
  const f = t.base, kx = clamp(w * 0.03, 2, 4), ky = d * 0.58, kh = d * 0.36;
  const n = clamp(Math.round((w - 2 * kx) / 4.4), 7, 52), kw = (w - 2 * kx) / n;
  const bw = Math.min(60, w * 0.5);
  return (
    <>
      {clear >= 30 && <rect x={w / 2 - bw / 2} y={d + 8} width={bw} height={Math.min(28, clear - 10)} rx={4} fill={darken(t.cloth, 0.3)} {...ln(t.cloth)} />}
      <rect width={w} height={d} rx={2.5} fill={f} {...ln(f, 1.2)} />
      <path d={`M${w * 0.32} ${d * 0.24}H${w * 0.68}`} stroke={edge(f)} strokeWidth={1.4} strokeLinecap="round" strokeOpacity={0.7} {...NS} />
      <rect x={kx} y={ky} width={w - 2 * kx} height={kh} rx={0.8} fill="#f8f6f1" {...ln('#d8d3c8', 0.8)} />
      <path d={Array.from({ length: n - 1 }, (_, i) => `M${kx + (i + 1) * kw} ${ky}v${kh}`).join('')} stroke="#bdb7ab" strokeWidth={0.6} {...NS} />
      {Array.from({ length: n - 1 }, (_, i) => [0, 1, 3, 4, 5].includes(i % 7) && <rect key={i} x={kx + (i + 1) * kw - kw * 0.3} y={ky} width={kw * 0.6} height={kh * 0.6} fill="#25221f" />)}
    </>
  );
}

function Appliance({ w, d, t }) {
  const f = t.base;
  return (
    <>
      <rect width={w} height={d} rx={Math.min(4, Math.min(w, d) * 0.12)} fill={f} {...ln(f, 1.2)} />
      <rect x={w * 0.1} y={d * 0.14} width={w * 0.8} height={d * 0.56} rx={2} fill={lighten(f, 0.3)} {...thin(f, 0.5)} />
      {[0.36, 0.46, 0.56].map((k) => <line key={k} x1={w * 0.22} x2={w * 0.78} y1={d * k} y2={d * k} {...thin(f, 0.4)} />)}
      <circle cx={w * 0.84} cy={d * 0.86} r={Math.min(1.8, d * 0.05)} fill={t.point} />
    </>
  );
}

function Generic({ w, d, t }) {
  const f = t.base, r = Math.min(5, Math.min(w, d) * 0.14);
  return (
    <>
      <rect width={w} height={d} rx={r} fill={f} {...ln(f, 1.2)} />
      <rect x={2.2} y={2.2} width={w - 4.4} height={d - 4.4} rx={r * 0.7} fill={lighten(f, 0.14)} stroke={lighten(f, 0.4)} strokeWidth={0.8} {...NS} />
    </>
  );
}

const DRAW = {
  bed: Bed, desk: Desk, wardrobe: Wardrobe, hanger: Hanger, bookshelf: Bookshelf, drawer: Drawer, sofa: Sofa, chair: Chair,
  dining: Dining, lowtable: LowTable, tv: TvStand, vanity: Vanity, mirror: Mirror, fridge: Fridge, washer: Washer,
  rug: Rug, plant: Plant, lamp: Lamp, piano: Piano, appliance: Appliance, generic: Generic,
};

/* ───────── 내보내는 부품 ───────── */
// 가구 한 개. selected: 고른 상태, level: 'warn' | 'error' | undefined
export function FurnitureSymbol({ spec, palette, selected = false, level }) {
  const kind = symbolKind(spec);
  const Draw = DRAW[kind];
  const w = Math.max(1, +spec.w || 60), d = Math.max(1, +spec.d || 60);
  const color = level === 'error' ? 'var(--error, #c93a2b)' : level === 'warn' ? 'var(--warn, #c27a00)' : null;
  const sel = 'var(--plan-select, #1f6650)';
  return (
    <g className={`symbol symbol-${kind}`} data-kind={kind}>
      <Draw w={w} d={d} clear={+spec.clear || 0} t={tones(spec, palette)} spec={spec} />
      {/* 치수를 모르는 가구(source: 'default')는 점선 테두리로 "확인 필요"를 알린다 */}
      {spec.source === 'default' && <rect x={-1.5} y={-1.5} width={w + 3} height={d + 3} rx={4} fill="none" style={{ stroke: 'var(--warn, #c27a00)' }} strokeWidth={1.2} strokeDasharray="2 3" strokeLinecap="round" {...NS} />}
      {color && <rect x={-1} y={-1} width={w + 2} height={d + 2} rx={4} style={{ fill: color, stroke: color }} fillOpacity={level === 'error' ? 0.26 : 0.14} strokeWidth={level === 'error' ? 2 : 1.6} strokeDasharray={level === 'warn' ? '6 3' : undefined} {...NS} />}
      {selected && (
        <>
          <rect x={-3} y={-3} width={w + 6} height={d + 6} rx={6} fill="none" style={{ stroke: sel }} strokeOpacity={0.22} strokeWidth={7} {...NS} />
          <rect className="symbol-outline" x={-3} y={-3} width={w + 6} height={d + 6} rx={6} fill="none" style={{ stroke: sel }} strokeWidth={2} {...NS} />
          {/* 앞쪽이 어디인지 알려 주는 작은 화살표 */}
          <path d={`M${w / 2 - 4.5} ${d + 6}L${w / 2} ${d + 10.5}L${w / 2 + 4.5} ${d + 6}Z`} style={{ fill: sel }} />
        </>
      )}
    </g>
  );
}

// item(x, y, rot)을 <g transform>으로. rot 90 = 등이 오른쪽 벽 (CONTRACT 3절)
export function symbolTransform({ x, y, w, d, rot = 0 }) {
  const [tx, ty] = { 0: [x, y], 90: [x + d, y], 180: [x + w, y + d], 270: [x, y + w] }[rot] ?? [x, y];
  return `translate(${tx} ${ty}) rotate(${rot})`;
}

// 가구 이름표. FurnitureSymbol과 같은 <g> 안에 넣으면 회전해도 글자는 항상 바로 선다.
// 가로로 안 들어가면 세로로, 그래도 안 되면 글자를 줄이고, 마지막에는 말줄임표.
// px: 화면 1px이 몇 cm인지 (도면 배율에 맞춰 글자 크기를 정하려고)
export function FurnitureLabel({ spec, rot = 0, px = 0.75, level, text }) {
  const { w, d } = spec;
  const name = String(text ?? spec.name ?? '');
  const [sw, sh] = rot % 180 === 0 ? [w, d] : [d, w]; // 화면에서 본 가로·세로
  const units = (s) => [...s].reduce((a, ch) => a + (ch === ' ' ? 0.3 : ch.charCodeAt(0) > 0x2e80 ? 1 : 0.58), 0);
  const max = 12 * px, min = 8.5 * px, pad = 5 * px;
  const fitSize = (avail, thick) => Math.min(max, (avail - pad) / (units(name) + 1), thick / 1.6);
  const fh = fitSize(sw, sh), fv = fitSize(sh, sw);
  const vertical = fh < max && fv > fh + 0.01;
  let fs = Math.max(vertical ? fv : fh, min), label = name;
  const avail = (vertical ? sh : sw) - pad;
  if ((units(label) + 1) * fs > avail) {
    const chars = [...label];
    while (chars.length > 1 && (units(chars.join('')) + 1.6) * fs > avail) chars.pop();
    label = chars.join('') + '…';
  }
  const mark = level === 'error' ? '×' : level === 'warn' ? '!' : null;
  const mr = 6.5 * px, half = (units(label) * fs) / 2;
  return (
    <g transform={`translate(${w / 2} ${d / 2}) rotate(${-rot + (vertical ? -90 : 0)})`} pointerEvents="none" className="plan-label">
      <rect x={-half - fs * 0.5} y={-fs * 0.78} width={half * 2 + fs} height={fs * 1.56} rx={fs * 0.78} fill="#fff" fillOpacity={0.92} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={650} style={{ fill: 'var(--plan-ink, #2a2520)', letterSpacing: '-0.02em' }}>{label}</text>
      {mark && (
        <g transform={`translate(${-half - fs * 0.5 - mr * 0.7} 0)`}>
          <circle r={mr} style={{ fill: level === 'error' ? 'var(--error, #c93a2b)' : 'var(--warn, #c27a00)' }} stroke="#fff" strokeWidth={1.5} {...NS} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={mr * 1.5} fontWeight={800} fill="#fff">{mark}</text>
        </g>
      )}
    </g>
  );
}

/* ───────── 방(바닥·벽·문·창) — 평면도 바탕. Plan.jsx에서 그대로 써도 된다 ───────── */
export const WALL_CM = 10;

// 도면 둘레 여백(치수선, 축척 막대 자리)을 넣은 viewBox
export function planViewBox(room, px = 0.75) {
  const a = WALL_CM + 34 * px, b = WALL_CM + 14 * px;
  return `${-a} ${-a} ${room.width + a + b} ${room.depth + a + WALL_CM + 34 * px}`;
}

// 벽 위의 구간(문·창)을 좌표로: p0 시작점, along 벽 방향, inward 방 안쪽 방향
function opening(room, { wall, offset: o }) {
  if (wall === 'top') return { p: [o, 0], along: [1, 0], inward: [0, 1] };
  if (wall === 'bottom') return { p: [o, room.depth], along: [1, 0], inward: [0, -1] };
  if (wall === 'left') return { p: [0, o], along: [0, 1], inward: [1, 0] };
  return { p: [room.width, o], along: [0, 1], inward: [-1, 0] };
}
const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
const pts = (...list) => list.map((p) => p.join(' ')).join(' ');

// <svg> 안에 한 번 넣는다: 나무 바닥 무늬와 창가 빛. id는 한 화면에 도면이 여러 개일 때만 바꾼다.
export function PlanDefs({ room, palette, id = 'bk' }) {
  const floor = mix(palette?.[1]?.hex || '#c8a77e', '#ffffff', 0.32);
  const shades = [0, 0.07, -0.05, 0.035, -0.025, 0.05];
  const P = 12, L = 96; // 마루 한 쪽 폭과 길이(cm)
  const seam = darken(floor, 0.22);
  return (
    <defs>
      {/* 마루는 방의 긴 쪽을 따라 깐다 */}
      <pattern id={`${id}-floor`} width={L * 2} height={P * 6} patternUnits="userSpaceOnUse" patternTransform={room && room.depth > room.width ? 'rotate(90)' : undefined}>
        {shades.map((s, r) => {
          const off = [0, 34, 68, 17, 51, 82][r];
          return [-1, 0, 1].map((k) => (
            <rect key={`${r}${k}`} x={off + k * L} y={r * P} width={L} height={P} fill={s >= 0 ? lighten(floor, s * 2) : darken(floor, -s * 1.6)} stroke={seam} strokeWidth={0.35} strokeOpacity={0.5} />
          ));
        })}
      </pattern>
      {['top', 'bottom', 'left', 'right'].map((wall) => {
        const v = { top: [0, 0, 0, 1], bottom: [0, 1, 0, 0], left: [0, 0, 1, 0], right: [1, 0, 0, 0] }[wall];
        return (
          <linearGradient key={wall} id={`${id}-sun-${wall}`} x1={v[0]} y1={v[1]} x2={v[2]} y2={v[3]}>
            <stop offset="0" stopColor="#fffbea" stopOpacity="0.62" />
            <stop offset="1" stopColor="#fffbea" stopOpacity="0" />
          </linearGradient>
        );
      })}
      <clipPath id={`${id}-room`}><rect width={room?.width ?? 0} height={room?.depth ?? 0} /></clipPath>
    </defs>
  );
}

// 바닥, 벽, 창문, 문, 치수선, 축척 막대. 가구보다 먼저 그린다. room은 normalizeRoom을 거친 것.
export function RoomShell({ room, palette, px = 0.75, id = 'bk', dims = true }) {
  const { width: W, depth: D } = room, T = WALL_CM;
  const floorTone = mix(palette?.[1]?.hex || '#c8a77e', '#ffffff', 0.32);
  const wall = 'var(--plan-wall, #2e2a25)';
  const ink = 'var(--text-3, #6f685d)';
  const fs = 11 * px;
  const span = (o) => { // 벽 두께만큼의 사각형
    const g = opening(room, o), a = add(g.p, g.inward, -T), b = add(g.p, g.along, o.size);
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]) || T, height: Math.abs(b[1] - a[1]) || T, g };
  };
  const dimY = -T - 15 * px, dimX = -T - 15 * px, tk = 3.5 * px;
  return (
    <g className="plan-room">
      <rect className="plan-wall" x={-T} y={-T} width={W + 2 * T} height={D + 2 * T} rx={2} style={{ fill: wall }} />
      <rect width={W} height={D} fill={`url(#${id}-floor)`} />
      {/* 창으로 들어오는 빛 */}
      <g clipPath={`url(#${id}-room)`} pointerEvents="none">
        {(room.windows || []).map((o, i) => {
          const g = opening(room, o), reach = Math.min(150, (g.along[0] ? D : W) * 0.42), skew = reach * 0.22;
          const a = g.p, b = add(g.p, g.along, o.size);
          return <polygon key={i} points={pts(a, b, add(add(b, g.inward, reach), g.along, skew), add(add(a, g.inward, reach), g.along, skew))} fill={`url(#${id}-sun-${o.wall})`} />;
        })}
      </g>
      {/* 벽 안쪽에 지는 옅은 그늘 */}
      <rect x={4} y={4} width={W - 8} height={D - 8} fill="none" stroke="#3a2a14" strokeOpacity={0.05} strokeWidth={8} pointerEvents="none" />
      <rect x={1.5} y={1.5} width={W - 3} height={D - 3} fill="none" stroke="#3a2a14" strokeOpacity={0.08} strokeWidth={3} pointerEvents="none" />

      {(room.windows || []).map((o, i) => {
        const s = span(o), horiz = s.g.along[0] === 1;
        const mid = horiz ? `M${s.x} ${s.y + T / 2}h${s.width}M${s.x} ${s.y + T * 0.28}h${s.width}M${s.x} ${s.y + T * 0.72}h${s.width}` : `M${s.x + T / 2} ${s.y}v${s.height}M${s.x + T * 0.28} ${s.y}v${s.height}M${s.x + T * 0.72} ${s.y}v${s.height}`;
        return (
          <g key={`w${i}`}>
            <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="#eaf4f8" stroke="#7fa8bd" strokeWidth={1} {...NS} />
            <path d={mid} stroke="#7fa8bd" strokeWidth={1} {...NS} />
          </g>
        );
      })}

      {(room.doors || []).map((o, i) => {
        const s = span(o), g = s.g, hinge = g.p;
        const closed = add(hinge, g.along, o.size), open = add(hinge, g.inward, o.size);
        const sweep = g.along[0] * g.inward[1] - g.along[1] * g.inward[0] > 0 ? 1 : 0;
        const c = add(add(hinge, g.along, o.size * 0.5), g.inward, o.size * 0.42);
        return (
          <g key={`d${i}`} pointerEvents="none">
            <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={lighten(floorTone, 0.35)} />
            {/* 문이 열리며 지나가는 자리 */}
            <path d={`M${hinge.join(' ')}L${closed.join(' ')}A${o.size} ${o.size} 0 0 ${sweep} ${open.join(' ')}Z`} fill="#2a2118" fillOpacity={0.06} />
            <path d={`M${closed.join(' ')}A${o.size} ${o.size} 0 0 ${sweep} ${open.join(' ')}`} fill="none" stroke="#2a2118" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3" {...NS} />
            <line x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} stroke="#8a6a4a" strokeWidth={4} strokeLinecap="round" />
            <line x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} stroke="#d9b98f" strokeWidth={2.2} strokeLinecap="round" />
            <text x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="central" fontSize={10 * px} fontWeight={600} fill="#2a2118" fillOpacity={0.5}>{o.kind === 'bath' ? '욕실문' : i === 0 ? '현관' : '문'}</text>
          </g>
        );
      })}

      {dims && (
        <g className="plan-dims" style={{ stroke: ink, fill: ink }} strokeWidth={1} pointerEvents="none">
          <path d={`M0 ${dimY}H${W}M0 ${dimY - tk}v${tk * 2}M${W} ${dimY - tk}v${tk * 2}M${dimX} 0V${D}M${dimX - tk} 0h${tk * 2}M${dimX - tk} ${D}h${tk * 2}`} fill="none" {...NS} />
          <text x={W / 2} y={dimY - 7 * px} textAnchor="middle" fontSize={fs} fontWeight={600} stroke="none">가로 {W}cm</text>
          <text transform={`translate(${dimX - 7 * px} ${D / 2}) rotate(-90)`} textAnchor="middle" fontSize={fs} fontWeight={600} stroke="none">세로 {D}cm</text>
          {/* 축척 막대: 50cm 두 칸 = 1m */}
          <g transform={`translate(0 ${D + T + 14 * px})`}>
            <rect width={50} height={4 * px} stroke="none" />
            <rect x={50} width={50} height={4 * px} fill="#fff" {...NS} />
            <rect width={100} height={4 * px} fill="none" {...NS} />
            <text x={100 + 6 * px} y={2 * px} dominantBaseline="central" fontSize={fs} fontWeight={600} stroke="none">1m</text>
          </g>
        </g>
      )}
    </g>
  );
}

// 걸어 다닐 수 있는 곳: checkLayout().walk.points를 옅은 점으로
export function WalkOverlay({ points, r = 2.2 }) {
  const d = points.map((p) => `M${p.x - r} ${p.y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`).join('');
  return <path className="plan-walk" d={d} style={{ fill: 'var(--plan-walk, #4f977c)' }} fillOpacity={0.3} pointerEvents="none" />;
}

// 가구 앞 사용 공간(고른 가구나 경고가 있는 가구에만 보여 준다). FurnitureSymbol과 같은 <g> 안에 넣는다.
export function ClearZone({ spec, level }) {
  if (!spec.clear) return null;
  const c = level ? 'var(--warn, #c27a00)' : 'var(--plan-select, #1f6650)';
  return <rect className="plan-clear" x={0} y={spec.d} width={spec.w} height={spec.clear} rx={3} style={{ fill: c, stroke: c }} fillOpacity={0.07} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" {...NS} />;
}

// 배치안 작은 그림: 방과 가구를 단색 사각형으로
export function MiniPlan({ room, items, palette }) {
  const floor = mix(palette?.[1]?.hex || '#c8a77e', '#ffffff', 0.45);
  return (
    <svg viewBox={`-8 -8 ${room.width + 16} ${room.depth + 16}`} aria-hidden="true">
      <rect x={-8} y={-8} width={room.width + 16} height={room.depth + 16} rx={10} fill="#2e2a25" />
      <rect width={room.width} height={room.depth} fill={floor} />
      {items.map((it, i) => {
        const [w, h] = it.rot % 180 === 0 ? [it.w, it.d] : [it.d, it.w];
        const f = it.floor ? lighten(tones(it, palette).sofa, 0.3) : tones(it, palette).wood;
        return <rect key={it.uid ?? i} x={it.x} y={it.y} width={w} height={h} rx={5} fill={f} stroke={darken(f, 0.35)} strokeWidth={3} opacity={it.floor ? 0.7 : 1} />;
      })}
    </svg>
  );
}
