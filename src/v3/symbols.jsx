// 평면도용 가구 그림 (SVG) v3 · 시안 A "커머스 클린" (docs/design-v3/a/notes.md 5번 규칙)
// 원점 (0,0)에 폭 w × 깊이 d, 등이 위(y=0), 앞이 아래(y=d)인 상태로 그린다. 길이 단위는 모두 cm.
// 회전·위치는 부르는 쪽이 <g transform={symbolTransform(item)}>로 처리한다.
// 선 색·굵기는 plan.css의 .o(외곽선) .d(안쪽 선) .t(가는 선 + 면)가 정한다. 면 색은 스타일 5색에서 만든 CSS 변수(--pw 등)다.

/* ───────── 색 ───────── */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const HEX = /^#?([0-9a-f]{6})$/i;
const toRgb = (hex) => {
  const h = HEX.exec(hex || '')?.[1] ?? 'ffffff';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const luma = (c) => { const [r, g, b] = toRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// 스타일 5색(벽, 바닥, 메인 가구, 패브릭, 포인트) → 평면도·썸네일이 읽는 CSS 변수.
// 시안의 --c1~--c5는 벽·나무·패브릭·포인트·짙은 색 순서라서 바닥색은 쓰지 않고, 짙은 색은 다섯 색에서 고른다.
// 팔레트가 없거나 깨져 있으면 {}를 돌려준다(바깥 .app이 정한 값을 그대로 쓴다).
const VARS = new WeakMap();
export function paletteVars(palette) {
  if (!Array.isArray(palette) || palette.length < 5 || !palette.every((p) => HEX.test(p?.hex || ''))) return {};
  if (VARS.has(palette)) return VARS.get(palette);
  const [wall, , wood, fabric, point] = palette.map((p) => p.hex);
  const darkest = palette.map((p) => p.hex).sort((a, b) => luma(a) - luma(b))[0];
  const out = { '--c1': wall, '--c2': wood, '--c3': fabric, '--c4': point, '--c5': luma(darkest) < 0.4 ? darkest : mix(darkest, '#141A23', 0.6) };
  const faces = { pf: [wall, 0.45], pw: [wood, 0.66], pw2: [wood, 0.3], pb: [fabric, 0.56], pb2: [fabric, 0.26], pr: [point, 0.58] };
  for (const [k, [c, t]] of Object.entries(faces)) {
    const v = mix('#ffffff', c, t);
    out[`--${k}`] = v;
    if (luma(v) < 0.55) { out[`--on-${k}`] = '#fff'; out[`--on2-${k}`] = 'rgba(255,255,255,.86)'; } // 어두운 면 위 이름표는 흰 글자
  }
  VARS.set(palette, out);
  return out;
}
// 사진·링크로 추가한 가구의 대표 색(spec.tint = '#rrggbb') → 그 가구 한 개에만 씌우는 CSS 변수. 스타일 색 대신 이 색으로 면을 칠한다.
// 섞는 비율은 스타일 색과 같아서(외곽선과 이름표가 읽힌다) 3D(three/model.js 의 tintColors)와도 같은 색이 된다.
// --pt 는 원래 흰색인 몸통(냉장고·세탁기·가전)에 쓴다. tint 가 없거나 '#rrggbb' 가 아니면 null.
const TINT = /^#[0-9a-f]{6}$/i;
const TINT_FACES = { pw: 0.66, pw2: 0.66, pb: 0.56, pb2: 0.26, pr: 0.58, pt: 0.66 };
const TINTS = new Map();
export function tintVars(tint) {
  if (typeof tint !== 'string' || !TINT.test(tint)) return null;
  const key = tint.toLowerCase();
  if (TINTS.has(key)) return TINTS.get(key);
  const out = { '--c2': key, '--c3': key };
  for (const [k, t] of Object.entries(TINT_FACES)) {
    const v = mix('#ffffff', key, t), dark = luma(v) < 0.55;
    out[`--${k}`] = v;
    out[`--on-${k}`] = dark ? '#fff' : 'var(--ink)'; // 바깥 스타일이 정한 글자색을 물려받지 않게 항상 다시 정한다
    out[`--on2-${k}`] = dark ? 'rgba(255,255,255,.86)' : 'var(--ink-2)';
  }
  if (TINTS.size > 200) TINTS.clear();
  TINTS.set(key, out);
  return out;
}
// tint 가 있는 가구의 대표 면 색(작은 배치 그림용)
const tintFace = (spec, kind) => (tintVars(spec?.tint) ? { fill: tintVars(spec.tint)[`--${faceOf(kind) === 'white' ? 'pt' : faceOf(kind)}`] } : null);
const WHITE_BODY = { fill: 'var(--pt, #fff)' }; // 흰 몸통. tint 가 있는 가구만 그 색이 된다
const fill = (v) => ({ fill: `var(--${v})` });
// 글자 폭 어림(글자 크기의 배수): 한글 1, 빈칸 0.3, 그 밖 0.6
const units = (s) => [...s].reduce((a, ch) => a + (ch === ' ' ? 0.3 : ch.charCodeAt(0) > 0x2e80 ? 1 : 0.6), 0);

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
  ['cattower', /cat_?tower|캣타워|캣폴/],
];
const BY_CATEGORY = { bed: 'bed', desk: 'desk', table: 'lowtable', appliance: 'appliance' };
const textOf = (spec) => `${spec.key || ''} ${spec.name || ''}`.toLowerCase();

export function symbolKind(spec) {
  if (spec.floor) return 'rug';
  const text = textOf(spec);
  const hit = RULES.find(([, re]) => re.test(text));
  if (hit) return hit[0];
  if (spec.category === 'storage') return spec.tall ? (spec.d <= 40 ? 'bookshelf' : 'wardrobe') : 'drawer';
  if (spec.category === 'seating') return spec.w >= 100 ? 'sofa' : 'chair';
  return BY_CATEGORY[spec.category] || 'generic';
}
const isRound = (spec) => /round|원형|라운드/.test(textOf(spec));
const isBlob = (spec) => isRound(spec) || /stool|스툴|빈백|bean/.test(textOf(spec));

// 가구의 대표 면 색: 이름표 외곽과 배치안 작은 그림에 쓴다
const FACE = {
  bed: 'pb', sofa: 'pb', chair: 'pb', rug: 'pr', wardrobe: 'pw2', generic: 'pw2', cattower: 'pw2',
  fridge: 'white', washer: 'white', appliance: 'white', mirror: 'white', hanger: 'white',
};
const faceOf = (kind) => FACE[kind] || 'pw';
const faceFill = (kind) => (faceOf(kind) === 'white' ? { fill: '#fff' } : fill(faceOf(kind)));

/* ───────── 공통 조각 ───────── */
// 의자: 가운데 cx, 좌판이 y에서 시작. 등받이는 아래쪽(탁자를 보고 앉는 방향)
function Seat({ cx, y, sw = 36, sd = 34 }) {
  return (
    <>
      <rect className="o" x={cx - sw / 2} y={y} width={sw} height={sd} rx={Math.min(9, sw * 0.25)} style={fill('pb')} />
      <rect className="o" x={cx - sw * 0.42} y={y + sd - 6} width={sw * 0.84} height={7.5} rx={3.7} style={fill('c3')} />
    </>
  );
}
// 앞면(문짝·서랍) 선: 앞에서 t만큼 들어온 선과 칸 나눔
const frontBand = (w, d, n, t = 4.5) => `M0 ${d - t}H${w}` + Array.from({ length: n - 1 }, (_, i) => `M${(w * (i + 1)) / n} ${d - t}V${d}`).join('');
// 봉에 걸린 옷걸이: 번갈아 기운 짧은 선. 가운데(이름표 자리)는 비운다
// 이름표가 놓이는 가운데 빈자리의 반폭(cm). 좁은 가구는 비우지 않는다
const labelGap = (spec, w) => (w >= 80 ? clamp(units(String(spec.name || '')) * 4 + 3, 17, w / 2 - 12) : 0);
function hangers(w, y0, y1, gap) {
  let out = '';
  for (let x = 14, i = 0; x <= w - 9; x += 10.5, i++) {
    if (Math.abs(x - w / 2) < gap) continue;
    const s = i % 2 ? -3 : 3;
    out += `M${x} ${y0}L${x + s} ${y1}`;
  }
  return out;
}
// 모니터·TV: 짙은 판 + 받침
function Screen({ cx, y, tw }) {
  return (
    <>
      <rect x={cx - tw / 2} y={y} width={tw} height={4.5} rx={1.5} style={fill('c5')} />
      <path className="d" d={`M${cx} ${y + 4.5}v4M${cx - 7} ${y + 8.5}h14`} />
    </>
  );
}

/* ───────── 가구별 그림 ───────── */
function Bed({ w, d, spec }) {
  const bare = /mattress|매트리스/.test(textOf(spec)); // 저상 매트리스: 머리판 없음
  const top = bare ? 3.5 : 8;
  const by = clamp(d * 0.31, 40, 70);          // 이불이 시작하는 곳
  const ph = by - top - 20;                     // 베개 깊이
  const two = w > 120;
  const pw = two ? (w - 7 - 22) / 2 : Math.min(64, w - 30);
  const pxs = two ? [3.5 + 8, w - 3.5 - 8 - pw] : [(w - pw) / 2];
  const fold = 17, r = 5;
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2.5} style={fill('pw')} />
      {!bare && <rect className="t" width={w} height={6.5} rx={1} style={fill('c2')} />}
      <rect className="t" x={3.5} y={top} width={w - 7} height={d - top - 3.5} rx={r} fill="#fff" />
      {pxs.map((x) => (
        <g key={x}>
          <rect className="t" x={x} y={top + 6} width={pw} height={ph} rx={Math.min(9, ph * 0.3)} fill="#fff" />
          <path className="d" d={`M${x + pw * 0.14} ${top + 6 + ph * 0.53}q${pw * 0.36} ${-ph * 0.15} ${pw * 0.72} 0`} />
        </g>
      ))}
      <path className="t" d={`M3.5 ${by}H${w - 3.5}V${d - 3.5 - r}a${r} ${r} 0 0 1 ${-r} ${r}H${3.5 + r}a${r} ${r} 0 0 1 ${-r} ${-r}Z`} style={fill('pb')} />
      <path className="t" d={`M3.5 ${by}H${w - 3.5}V${by + fold}H3.5Z`} style={fill('pb2')} />
      <path className="t" d={`M${w - 3.5} ${by + fold}H${w - 3.5 - Math.min(32.5, w * 0.3)}L${w - 3.5} ${by + fold + Math.min(34, w * 0.31)}Z`} fill="#fff" />
    </>
  );
}

// 넓은 책상은 기기를 왼쪽에 두고 오른쪽 45%에 이름표를 쓴다.
// 이름이 그 자리에 안 들어가면(좁은 책상, 글자가 상대적으로 큰 넓은 방) 키보드를 빼고 모니터 아래 가운데에 쓴다
function deskSide(spec, w, d, rot, px) {
  if (w < 90) return false;
  if (!px) return true;
  const need = units(String(spec.name || '')) * 13 * px + 5 * px;
  const [sw, sh] = rot % 180 === 0 ? [w * 0.45, d] : [d, w * 0.45];
  return need <= sw || (need <= sh && sw >= 19.5 * px);
}
function Desk({ w, d, clear, spec, px }) {
  const side = deskSide(spec, w, d, +spec.rot || 0, px);
  const cx = side ? w / 3 : w / 2;
  return (
    <>
      {clear >= 30 && <Seat cx={cx} y={d + 6} sw={Math.min(36, w * 0.5)} sd={Math.min(34, clear - 8)} />}
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw')} />
      {d >= 30 && <Screen cx={cx} y={Math.min(7, d * 0.12)} tw={Math.min(40, w * 0.4)} />}
      {side && d >= 45 && (
        <>
          <rect className="t" x={cx - 16} y={d * 0.48} width={32} height={10} rx={2} fill="#fff" />
          <rect className="t" x={cx + 20} y={d * 0.5} width={6} height={9} rx={3} fill="#fff" />
        </>
      )}
    </>
  );
}

function Wardrobe({ w, d, spec }) {
  const n = clamp(Math.round(w / 50), 1, 6), gap = labelGap(spec, w);
  const rod = gap ? `M7 ${d * 0.43}H${w / 2 - gap}M${w / 2 + gap} ${d * 0.43}H${w - 7}` : `M7 ${d * 0.43}H${w - 7}`;
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw2')} />
      <path className="d" d={frontBand(w, d, n) + (d >= 35 ? rod : '')} />
      {d >= 35 && <path className="d" d={hangers(w, d * 0.18, d * 0.68, gap)} />}
    </>
  );
}

function Hanger({ w, d, spec }) {
  const rack = /drying|건조대/.test(textOf(spec)); // 빨래건조대: 나란한 살
  const gap = labelGap(spec, w);
  return (
    <>
      <rect className="o main thin" width={w} height={d} rx={2} fill="#fff" fillOpacity={0.55} strokeDasharray="4 3" />
      <path className="t" fill="none" d={`M4 3V${d - 3}M${w - 4} 3V${d - 3}`} />
      {rack
        ? <path className="d" d={Array.from({ length: 5 }, (_, i) => `M4 ${(d * (i + 1)) / 6}H${w - 4}`).join('')} />
        : <><path className="d" d={hangers(w, d * 0.14, d * 0.86, gap)} /><path className="rod" d={gap ? `M4 ${d / 2}H${w / 2 - gap}M${w / 2 + gap} ${d / 2}H${w - 4}` : `M4 ${d / 2}H${w - 4}`} /></>}
    </>
  );
}

function Bookshelf({ w, d }) {
  const n = clamp(Math.round(w / 27), 1, 12), c = w / n;
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw')} />
      <path className="d" d={Array.from({ length: n }, (_, i) => `${i ? `M${c * i} 0V${d}` : ''}M${c * i} 0L${c * (i + 1)} ${d}`).join('')} />
    </>
  );
}

function Drawer({ w, d }) {
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw')} />
      <path className="d" d={frontBand(w, d, clamp(Math.round(w / 45), 1, 4), 4)} />
    </>
  );
}

function Sofa({ w, d }) {
  const bd = clamp(d * 0.24, 10, 22), aw = clamp(w * 0.1, 8, 18);
  const n = w < 110 ? 1 : w < 185 ? 2 : 3, sw = (w - 2 * aw) / n;
  return (
    <>
      <rect className="o main" width={w} height={d} rx={5} style={fill('pb')} />
      <rect className="t" x={aw} y={bd} width={w - 2 * aw} height={d - bd - 2} rx={3} style={fill('pb2')} />
      <path className="d" d={Array.from({ length: n - 1 }, (_, i) => `M${aw + sw * (i + 1)} ${bd}V${d - 2}`).join('') || 'M0 0'} />
    </>
  );
}

function Chair({ w, d, spec }) {
  if (isBlob(spec)) {
    return (
      <>
        <ellipse className="o main" cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} style={fill('pb')} />
        <ellipse className="d" cx={w / 2} cy={d * 0.52} rx={w * 0.3} ry={d * 0.28} />
      </>
    );
  }
  return (
    <>
      <rect className="o main" y={3} width={w} height={d - 3} rx={Math.min(9, w * 0.2)} style={fill('pb')} />
      <rect className="o" x={w * 0.08} width={w * 0.84} height={7.5} rx={3.7} style={fill('c3')} />
    </>
  );
}

function Dining({ w, d, clear, spec }) {
  const n = clamp(Math.floor((w + 10) / 50), 1, 3);
  return (
    <>
      {clear >= 30 && Array.from({ length: n }, (_, i) => <Seat key={i} cx={(w * (i + 0.5)) / n} y={d + 5} sw={Math.min(36, w / n - 6)} sd={Math.min(34, clear - 8)} />)}
      {isRound(spec)
        ? <ellipse className="o main" cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} style={fill('pw')} />
        : <rect className="o main" width={w} height={d} rx={3} style={fill('pw')} />}
    </>
  );
}

function LowTable({ w, d, spec }) {
  const m = Math.min(w, d), r = Math.min(7, m * 0.14);
  return isRound(spec) ? (
    <>
      <ellipse className="o main" cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} style={fill('pw')} />
      <ellipse className="d" cx={w / 2} cy={d / 2} rx={w / 2 - 3} ry={d / 2 - 3} />
    </>
  ) : (
    <>
      <rect className="o main" width={w} height={d} rx={r} style={fill('pw')} />
      {m >= 20 && <rect className="d" x={3} y={3} width={w - 6} height={d - 6} rx={Math.max(1, r - 2)} />}
    </>
  );
}

function TvStand({ w, d }) {
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw')} />
      <path className="d" d={frontBand(w, d, clamp(Math.round(w / 50), 1, 4), 4)} />
      <Screen cx={w / 2} y={Math.max(3, d * 0.2)} tw={clamp(w * 0.72, 24, w - 8)} />
    </>
  );
}

function Vanity({ w, d, clear }) {
  const r = clamp(Math.min(w * 0.2, clear / 2 - 4), 8, 16);
  return (
    <>
      {clear >= 30 && <circle className="o" cx={w / 2} cy={d + 6 + r} r={r} style={fill('pb')} />}
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw')} />
      <rect className="t glass" x={w * 0.19} y={2} width={w * 0.62} height={3.5} rx={1} />
    </>
  );
}

// 스탠드 거울: 바닥 자리(점선) 안에 거울 판 하나와 받침 두 개
function Mirror({ w, d }) {
  return (
    <>
      <rect className="o main thin" width={w} height={d} rx={2} fill="#fff" fillOpacity={0.55} strokeDasharray="4 3" />
      <path className="t" fill="none" d={`M5 3V${d * 0.55}M${w - 5} 3V${d * 0.55}`} />
      <rect className="o glass" x={2.5} y={d * 0.22} width={w - 5} height={4} rx={1} />
    </>
  );
}

function Fridge({ w, d }) {
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2.5} style={WHITE_BODY} />
      <path className="d" d={frontBand(w, d, w >= 80 ? 2 : 1, 5)} />
      {w >= 30 && d >= 35 && <rect className="d" x={4} y={4} width={w - 8} height={d - 13} rx={2} />}
    </>
  );
}

function Washer({ w, d }) {
  const ch = d * 0.16, r = Math.min(w, d - ch) * 0.36, cy = ch + (d - ch) / 2;
  return (
    <>
      <rect className="o main" width={w} height={d} rx={3} style={WHITE_BODY} />
      <path className="d" d={`M0 ${ch}H${w}`} />
      <circle className="d" cx={w * 0.82} cy={ch / 2} r={Math.min(2.2, ch * 0.3)} />
      <circle className="t" cx={w / 2} cy={cy} r={r} fill="#fff" />
      <circle className="t glass" cx={w / 2} cy={cy} r={r * 0.68} />
    </>
  );
}

function Rug({ w, d, spec }) {
  const b = clamp(Math.min(w, d) * 0.055, 3, 6);
  return isRound(spec) ? (
    <>
      <ellipse className="o main thin" cx={w / 2} cy={d / 2} rx={w / 2} ry={d / 2} style={fill('pr')} />
      <ellipse className="rug-in" cx={w / 2} cy={d / 2} rx={w / 2 - b} ry={d / 2 - b} />
    </>
  ) : (
    <>
      <rect className="o main thin" width={w} height={d} rx={3} style={fill('pr')} />
      <rect className="rug-in" x={b} y={b} width={w - 2 * b} height={d - 2 * b} rx={1.5} />
    </>
  );
}

const LEAF = 'M0 0C-4 -6 -3.5 -14 0 -19C3.5 -14 4 -6 0 0Z'; // 반지름 20cm 기준 길쭉한 잎
function Plant({ w, d }) {
  const r = Math.min(w, d) / 2, s = r / 20;
  return (
    <g transform={`translate(${w / 2} ${d / 2})`}>
      <circle className="o main ghost" r={r} />
      <g className="leaf">
        {[0, 47, 92, 138, 181, 226, 271, 316].map((a, i) => <path key={a} d={LEAF} transform={`rotate(${a}) translate(0 ${i % 2 ? 3.5 * s : 0}) scale(${s})`} />)}
      </g>
      <circle className="t" r={5.5 * s} fill="#fff" />
    </g>
  );
}

function Lamp({ w, d, id }) {
  const r = Math.min(w, d) / 2, cx = w / 2, cy = d / 2;
  return (
    <>
      <circle cx={cx} cy={cy} r={r * 2.1} fill={`url(#${id}-glow)`} pointerEvents="none" />
      <circle className="o main" cx={cx} cy={cy} r={r} style={fill('pw')} />
      <circle className="t bulb" cx={cx} cy={cy} r={r / 2} />
      <circle className="dot" cx={cx} cy={cy} r={r * 0.12} />
    </>
  );
}

function Piano({ w, d, clear }) {
  const kx = clamp(w * 0.03, 2, 4), ky = d * 0.6, kh = d * 0.34;
  const n = clamp(Math.round((w - 2 * kx) / 4.4), 7, 52), kw = (w - 2 * kx) / n;
  const bw = Math.min(60, w * 0.5);
  const black = Array.from({ length: n - 1 }, (_, i) => ([0, 1, 3, 4, 5].includes(i % 7) ? `M${kx + (i + 1) * kw - kw * 0.28} ${ky}h${kw * 0.56}v${kh * 0.6}h${-kw * 0.56}Z` : '')).join('');
  return (
    <>
      {clear >= 30 && <rect className="o" x={w / 2 - bw / 2} y={d + 8} width={bw} height={Math.min(28, clear - 12)} rx={3} style={fill('pb')} />}
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw')} />
      <rect className="t" x={kx} y={ky} width={w - 2 * kx} height={kh} rx={0.8} fill="#fff" />
      <path className="d" d={Array.from({ length: n - 1 }, (_, i) => `M${kx + (i + 1) * kw} ${ky}v${kh}`).join('')} />
      <path className="dot" d={black} />
    </>
  );
}

function Appliance({ w, d }) {
  const m = Math.min(w, d);
  return (
    <>
      <rect className="o main" width={w} height={d} rx={Math.min(6, m * 0.18)} style={WHITE_BODY} />
      <circle className="d" cx={w / 2} cy={d / 2} r={m * 0.32} />
      <circle className="d" cx={w / 2} cy={d / 2} r={m * 0.14} />
    </>
  );
}

function CatTower({ w, d }) {
  const m = Math.min(w, d);
  return (
    <>
      <rect className="o main" width={w} height={d} rx={2} style={fill('pw2')} />
      <circle className="t" cx={w * 0.36} cy={d * 0.36} r={m * 0.25} style={fill('pb')} />
      <circle className="t" cx={w * 0.66} cy={d * 0.68} r={m * 0.19} style={fill('pw')} />
    </>
  );
}

function Generic({ w, d }) {
  const m = Math.min(w, d), r = Math.min(4, m * 0.12);
  return (
    <>
      <rect className="o main" width={w} height={d} rx={r} style={fill('pw2')} />
      {m >= 20 && <rect className="d" x={3} y={3} width={w - 6} height={d - 6} rx={Math.max(1, r - 1.5)} />}
    </>
  );
}

const DRAW = {
  bed: Bed, desk: Desk, wardrobe: Wardrobe, hanger: Hanger, bookshelf: Bookshelf, drawer: Drawer, sofa: Sofa, chair: Chair,
  dining: Dining, lowtable: LowTable, tv: TvStand, vanity: Vanity, mirror: Mirror, fridge: Fridge, washer: Washer,
  rug: Rug, plant: Plant, lamp: Lamp, piano: Piano, appliance: Appliance, cattower: CatTower, generic: Generic,
};
const sizeOf = (spec) => [Math.max(1, +spec.w || 60), Math.max(1, +spec.d || 60)];

/* ───────── 내보내는 부품 ───────── */
// 가구 한 개. selected: 고른 상태, level: 'warn' | 'error' | undefined. id는 PlanDefs와 같은 값
// px(글자 1px이 몇 cm인지)를 주면 이름표 자리에 맞춰 그림을 조금 바꾼다(책상의 키보드). FurnitureLabel과 같은 값을 준다
export function FurnitureSymbol({ spec, selected = false, level, id = 'bk', px }) {
  const kind = symbolKind(spec);
  const Draw = DRAW[kind];
  const [w, d] = sizeOf(spec);
  // 치수를 모르는 가구(source: 'default')는 점선 외곽선으로 "확인 필요"를 알린다
  const cls = `symbol symbol-${kind}${spec.source === 'default' ? ' is-guess' : ''}${selected ? ' is-selected' : ''}${level === 'error' ? ' is-error' : level === 'warn' ? ' is-warn' : ''}`;
  return (
    <g className={cls} data-kind={kind} style={tintVars(spec.tint) || undefined}>
      <Draw w={w} d={d} clear={+spec.clear || 0} spec={spec} id={id} px={px} />
    </g>
  );
}

// item(x, y, rot)을 <g transform>으로. rot 90 = 등이 오른쪽 벽 (CONTRACT 3절)
export function symbolTransform({ x, y, w, d, rot = 0 }) {
  const [tx, ty] = { 0: [x, y], 90: [x + d, y], 180: [x + w, y + d], 270: [x, y + w] }[rot] ?? [x, y];
  return `translate(${tx} ${ty}) rotate(${rot})`;
}

// 이름표가 들어갈 자리(가구 좌표). 기기·베개 같은 그림을 피한다
function labelBox(kind, w, d, spec, rot, px) {
  if (kind === 'desk') return deskSide(spec, w, d, rot, px) ? { x: w * 0.55, y: 0, w: w * 0.45, h: d } : { x: 0, y: 16, w, h: d - 16 };
  if (kind === 'bed') { const by = clamp(d * 0.31, 40, 70) + 17; return { x: 3.5, y: by, w: w - 7, h: d - by - 3.5 }; }
  if (kind === 'wardrobe') return { x: 0, y: 0, w, h: d - 4.5 };
  if (kind === 'sofa') { const bd = clamp(d * 0.24, 10, 22), aw = clamp(w * 0.1, 8, 18); return { x: aw, y: bd, w: w - 2 * aw, h: d - bd - 2 }; }
  if (kind === 'piano') return { x: 0, y: 0, w, h: d * 0.6 };
  if (kind === 'tv') return { x: 0, y: d * 0.3, w, h: d * 0.7 };
  if (kind === 'mirror') return { x: 0, y: d * 0.36, w, h: d * 0.64 };
  return { x: 0, y: 0, w, h: d };
}

// 가구 이름표: 이름 13px 굵게 + 치수 12px. 알약 배경 대신 가구 색 외곽(paint-order: stroke).
// FurnitureSymbol과 같은 <g> 안에 넣으면 회전해도 글자는 항상 바로 선다.
// 가로로 안 들어가면 세로로, 그래도 안 되면 말줄임표, 두 글자도 못 쓰면 그리지 않는다(조명·화분은 그림만).
// px: 글자 1px이 몇 cm인지 (planScale의 u)
// slot: 러그 이름을 쓸 자리({ dx: 가운데에서 옆으로 옮길 거리, w: 폭, top: 위쪽에 쓸지 }, 화면 방향 cm). null이면 쓰지 않는다
export function FurnitureLabel({ spec, rot = 0, px = 0.63, text, slot }) {
  const kind = symbolKind(spec);
  if (kind === 'lamp' || kind === 'plant') return null;
  const [w, d] = sizeOf(spec);
  const name = String(text ?? spec.name ?? '');
  const fs = 13 * px, fs2 = 12 * px, pad = 5 * px;
  const face = faceOf(kind);
  const fv = face === 'white' ? 'pt' : face; // 흰 몸통은 tint 가 있을 때만 색이 있다(--pt)
  const style = { ...tintVars(spec.tint), '--h': face === 'white' ? 'var(--pt, #fff)' : `var(--${face})`, '--lf': `var(--on-${fv}, var(--ink))`, '--lf2': `var(--on2-${fv}, var(--ink-2))` };
  const at = (b) => `translate(${b.x + b.w / 2} ${b.y + b.h / 2}) rotate(${-rot})`;
  const screen = (b) => (rot % 180 === 0 ? [b.w, b.h] : [b.h, b.w]); // 화면에서 본 가로·세로
  const size = `${w}×${d}`, full = { x: 0, y: 0, w, h: d };
  if (kind === 'rug') { // 러그는 아래쪽에 작게 한 줄(가구가 올라와도 덜 가린다). 둥근 러그는 가운데
    const [sw, sh] = screen(full), round = isRound(spec);
    const sl = slot === undefined || round ? { dx: 0, w: sw, top: false } : slot;
    const line = sl && [`${name} ${size}`, name].find((t) => units(t) * fs2 <= sl.w - pad);
    if (!line || sh < fs2 * 3) return null;
    return <g transform={at(full)} pointerEvents="none" className="plan-label" style={style}><text className="lbl-s" x={sl.dx} y={round ? fs2 * 0.35 : sl.top ? fs2 * 1.9 - sh / 2 : sh / 2 - fs2 * 1.25}>{line}</text></g>;
  }
  const fit = (b) => {
    const [sw, sh] = screen(b), need = units(name) * fs;
    if (need <= sw - pad) return { b, len: sw, thick: sh, vertical: false, label: name };
    if (need <= sh - pad && sw >= fs * 1.5) return { b, len: sh, thick: sw, vertical: true, label: name };
    const vertical = sh > sw && sw >= fs * 1.5, avail = (vertical ? sh : sw) - pad, chars = [...name];
    while (chars.length > 2 && (units(chars.join('')) + 1) * fs > avail) chars.pop();
    return (units(chars.join('')) + 1) * fs > avail ? null : { b, len: vertical ? sh : sw, thick: vertical ? sw : sh, vertical, label: chars.join('').trim() + '…' };
  };
  // 그림을 피한 자리에 이름이 다 안 들어가면 가구 전체를 자리로 쓴다
  let f = fit(labelBox(kind, w, d, spec, rot, px));
  if (!f || f.label !== name) { const g = fit(full); if (g && (!f || g.label === name)) f = g; }
  if (!f || f.thick < fs * 1.5) return null;
  const two = f.label === name && kind !== 'washer' && kind !== 'cattower' && f.thick >= fs * 4.3 && units(size) * fs2 <= f.len - pad;
  return (
    <g transform={at(f.b) + (f.vertical ? ' rotate(-90)' : '')} pointerEvents="none" className="plan-label" style={style}>
      <text className="lbl" y={two ? -0.12 * fs : 0.35 * fs}>{f.label}</text>
      {two && <text className="lbl-s" y={1.3 * fs}>{size}</text>}
    </g>
  );
}

/* ───────── 방(바닥·벽·문·창·치수선) ───────── */
export const WALL_CM = 8;
const U_MIN = 7.6 / 13; // 글자는 화면 13px, 큰 화면에서는 7.6cm 아래로 줄지 않는다(시안 .lbl 규칙)
const openings = (room) => [...(room.doors || []), ...(room.windows || [])];
// 도면 둘레 여백(cm): 벽 두께 + 치수선·축척 자리(글자 px 기준). 시안 400×300 → 왼쪽 38, 위 40, 오른쪽 14, 아래 28
function margins(room, u) {
  const right = openings(room).some((o) => o.wall === 'right'); // 오른쪽 벽에 문·창 이름을 쓸 자리
  return { l: WALL_CM + 48 * u, t: WALL_CM + 51 * u, r: WALL_CM + (right ? 26 : 10) * u, b: WALL_CM + (scalePlace(room, u) === 'below' ? 48 : 32) * u };
}
const doorName = (o, i) => (o.kind === 'bath' ? '욕실문' : o.kind === 'entry' || (!o.kind && i === 0) ? '현관' : '문');
const openingTags = (room) => [...(room.windows || []).map((o) => [o, `창문 ${o.size}`]), ...(room.doors || []).map((o, i) => [o, `${doorName(o, i)} ${o.size}`])];
// 축척 자리: 오른쪽 아래. 아래 벽의 문·창 이름과 부딪히면 왼쪽 아래, 거기도 부딪히면 한 줄 아래
function scalePlace(room, u) {
  const W = room.width, need = 100 + 90 * u;
  const hit = (a0, a1) => openingTags(room).some(([o, t]) => o.wall === 'bottom' && o.offset + o.size / 2 + units(t) * 6 * u + 6 * u > a0 && o.offset + o.size / 2 - units(t) * 6 * u - 6 * u < a1);
  return !hit(W - need, W) ? 'right' : !hit(0, need) ? 'left' : 'below';
}
export function planViewBox(room, px = 0.63) {
  const m = margins(room, px);
  return `${-m.l} ${-m.t} ${room.width + m.l + m.r} ${room.depth + m.t + m.b}`;
}
// 가로 bw × 세로 bh px 자리에 도면이 꼭 맞는 배율. k: 화면 1px이 몇 cm인지(--k), u: 글자 1px이 몇 cm인지
export function planScale(room, bw, bh) {
  const m = margins(room, 1), T2 = WALL_CM * 2;
  const hx = m.l + m.r - T2, hy = m.t + m.b - T2; // 여백 가운데 px로 정해진 몫
  let k = Math.max((room.width + T2) / Math.max(80, bw - hx), (room.depth + T2) / Math.max(80, bh - hy));
  if (k < U_MIN) k = Math.max((room.width + T2 + hx * U_MIN) / Math.max(80, bw), (room.depth + T2 + hy * U_MIN) / Math.max(80, bh));
  return { k, u: Math.max(k, U_MIN) };
}

// 벽 위의 구간(문·창)을 좌표로: p 시작점, along 벽 방향, inward 방 안쪽 방향
function opening(room, { wall, offset: o }) {
  if (wall === 'top') return { p: [o, 0], along: [1, 0], inward: [0, 1] };
  if (wall === 'bottom') return { p: [o, room.depth], along: [1, 0], inward: [0, -1] };
  if (wall === 'left') return { p: [0, o], along: [0, 1], inward: [1, 0] };
  return { p: [room.width, o], along: [0, 1], inward: [-1, 0] };
}
const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
const P = (p) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`;
const poly = (...list) => `M${list.map(P).join('L')}Z`;

// <svg> 안에 한 번 넣는다: 그림자, 조명 빛, 겹침 빗금, 방 모양 자르기. id는 한 화면에 도면이 여러 개일 때만 바꾼다.
export function PlanDefs({ room, id = 'bk' }) {
  return (
    <defs>
      <radialGradient id={`${id}-glow`}><stop offset="0" className="glow-stop" stopOpacity=".6" /><stop offset="1" className="glow-stop" stopOpacity="0" /></radialGradient>
      <pattern id={`${id}-xhatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect className="hatch-bar" width="2" height="5" /></pattern>
      <filter id={`${id}-roomsh`} x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="10" className="sh" floodOpacity=".16" /></filter>
      <filter id={`${id}-lift`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.6" className="sh" floodOpacity=".2" /></filter>
      <filter id={`${id}-lift2`} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow className="lift-sel" dx="0" dy="3" stdDeviation="4" floodOpacity=".32" /></filter>
      <clipPath id={`${id}-room`}><rect width={room?.width ?? 0} height={room?.depth ?? 0} /></clipPath>
    </defs>
  );
}

// 바닥, 벽, 창문, 문, 치수선, 축척. 가구보다 먼저 그린다. room은 normalizeRoom을 거친 것.
// px: 글자 1px이 몇 cm인지(planScale의 u). curtains: 창 양끝 커튼 물결선. dims: 치수선·축척
export function RoomShell({ room, px = 0.63, id = 'bk', dims = true, curtains = true }) {
  const { width: W, depth: D } = room, T = WALL_CM, u = px;
  const doors = room.doors || [], windows = room.windows || [];
  const grid = [];
  for (let x = 50; x < W; x += 50) grid.push(`M${x} 0V${D}`);
  for (let y = 50; y < D; y += 50) grid.push(`M0 ${y}H${W}`);
  // 문·창 이름: 벽 바로 바깥, 구간 가운데
  const tag = (o, text) => {
    const m = o.offset + o.size / 2, key = `${o.wall}${o.offset}${text}`;
    if (o.wall === 'top') return <text key={key} className="dim sub" x={m} y={-T - 6.4 * u}>{text}</text>;
    if (o.wall === 'bottom') return <text key={key} className="dim sub" x={m} y={D + T + 22 * u}>{text}</text>;
    const x = o.wall === 'left' ? -T - 6.4 * u : W + T + 17 * u;
    return <text key={key} className="dim sub" transform={`translate(${x} ${m}) rotate(-90)`}>{text}</text>;
  };
  const tags = openingTags(room);
  const place = scalePlace(room, u), scaleLeft = place === 'left';
  const sx = scaleLeft ? 0 : W - 100, sy = D + T + (place === 'below' ? 30.4 : 14.4) * u;
  const dy = -T - 25.5 * u, e0 = -T - 9.6 * u, e1 = -T - 38 * u, tk = 4.8 * u;
  return (
    <g className="plan-room">
      <rect x={-T} y={-T} width={W + 2 * T} height={D + 2 * T} fill="#fff" filter={`url(#${id}-roomsh)`} />
      <rect className="floor" width={W} height={D} />
      <path className="grid" d={grid.join('')} />
      <path className="wall" fillRule="evenodd" d={`M${-T} ${-T}H${W + T}V${D + T}H${-T}ZM0 0V${D}H${W}V0Z`} />

      {windows.map((o, i) => {
        const g = opening(room, o), a = g.p, b = add(g.p, g.along, o.size);
        const line = (k) => `M${P(add(a, g.inward, -T * k))}L${P(add(b, g.inward, -T * k))}`;
        return (
          <g key={`w${i}`} pointerEvents="none">
            <path className="win" d={poly(a, b, add(b, g.inward, -T), add(a, g.inward, -T))} />
            <path className="win-l" d={line(0.34) + line(0.66)} />
          </g>
        );
      })}

      {doors.map((o, i) => {
        const g = opening(room, o), hinge = g.p, closed = add(hinge, g.along, o.size), open = add(hinge, g.inward, o.size);
        const sweep = g.along[0] * g.inward[1] - g.along[1] * g.inward[0] > 0 ? 0 : 1;
        const arc = `A${o.size} ${o.size} 0 0 ${sweep} ${P(closed)}`;
        const out = (p) => add(p, g.inward, -T);
        return (
          <g key={`d${i}`} pointerEvents="none">
            <path className="floor" d={poly(add(hinge, g.inward, 0.5), add(closed, g.inward, 0.5), add(closed, g.inward, -T - 0.5), add(hinge, g.inward, -T - 0.5))} />
            <path className="d" d={`M${P(hinge)}L${P(closed)}M${P(out(hinge))}L${P(out(closed))}`} />
            <path className="swing" d={`M${P(hinge)}L${P(open)}${arc}Z`} />
            <path className="d" d={`M${P(open)}${arc}`} />
            <path className="o" fill="#fff" d={poly(add(hinge, g.along, -1.75), add(hinge, g.along, 1.75), add(open, g.along, 1.75), add(open, g.along, -1.75))} />
          </g>
        );
      })}

      {curtains && windows.map((o, i) => {
        const g = opening(room, o), len = g.along[0] ? W : D;
        const rel = (x, y) => `${g.along[0] * x + g.inward[0] * y} ${g.along[1] * x + g.inward[1] * y}`;
        const wave = (s) => `M${P(add(add(g.p, g.along, clamp(s, 2, len - 30) - o.offset), g.inward, 4))}q${rel(3.5, -3.5)} ${rel(7, 0)}t${rel(7, 0)}t${rel(7, 0)}t${rel(7, 0)}`;
        return <path key={`c${i}`} className="d curtain" d={wave(o.offset - 14) + wave(o.offset + o.size - 14)} pointerEvents="none" />;
      })}

      {dims && (
        <g className="plan-dims" pointerEvents="none">
          <path className="dim-l" d={`M0 ${e1}V${e0}M${W} ${e1}V${e0}M0 ${dy}H${W}M${e1} 0H${e0}M${e1} ${D}H${e0}M${dy} 0V${D}`} />
          <path className="dim-l tick" d={[[0, dy], [W, dy], [dy, 0], [dy, D]].map(([x, y]) => `M${x - tk} ${y + tk}l${tk * 2} ${-tk * 2}`).join('')} />
          <text className="dim" x={W / 2} y={dy - 6.4 * u}>{W}</text>
          <text className="dim" transform={`translate(${dy - 6.4 * u} ${D / 2}) rotate(-90)`}>{D}</text>
          {tags.map(([o, t]) => tag(o, t))}
          <path className="dim-l" d={`M${sx} ${sy}v${6.4 * u}h100v${-6.4 * u}M${sx + 50} ${sy + 3.2 * u}v${3.2 * u}`} />
          <text className="dim sub" x={scaleLeft ? 100 + 9.6 * u : sx - 9.6 * u} y={sy + 11.2 * u} style={{ textAnchor: scaleLeft ? 'start' : 'end' }}>1 m · 단위 cm</text>
        </g>
      )}
    </g>
  );
}

// 통로: checkLayout().walk.points(60cm 폭으로 닿는 5cm 격자점)를 옅은 면 하나로.
// 격자점은 벽·가구에서 30cm 떨어진 "몸 가운데" 자리라서, 27cm씩 넓혀 벽·가구 3cm 앞까지 칠한다.
// 같은 줄에서 이어진 점은 한 사각형으로, 위아래로 같은 구간이 이어지면 한 사각형으로 합친다.
const WALK_G = 5, WALK_E = 27;
export function walkPath(points, room) {
  const rows = new Map();
  for (const p of points) { if (!rows.has(p.y)) rows.set(p.y, []); rows.get(p.y).push(p.x); }
  const rects = [];
  let open = new Map(), prevY = null;
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(y).sort((a, b) => a - b), next = new Map();
    for (let i = 0; i < xs.length;) {
      let j = i;
      while (j + 1 < xs.length && xs[j + 1] - xs[j] <= WALK_G) j++;
      const key = `${xs[i]},${xs[j]}`;
      let r = prevY === y - WALK_G ? open.get(key) : null;
      if (!r) rects.push(r = { x0: xs[i], x1: xs[j], y0: y });
      r.y1 = y;
      next.set(key, r);
      i = j + 1;
    }
    open = next; prevY = y;
  }
  const W = room?.width ?? Infinity, D = room?.depth ?? Infinity;
  return rects.map((r) => `M${Math.max(3, r.x0 - WALK_E)} ${Math.max(3, r.y0 - WALK_E)}H${Math.min(W - 3, r.x1 + WALK_E)}V${Math.min(D - 3, r.y1 + WALK_E)}H${Math.max(3, r.x0 - WALK_E)}Z`).join('');
}
export function WalkOverlay({ points, room }) {
  if (!points?.length) return null;
  return <g className="walk-g" opacity={0.07} pointerEvents="none"><path className="walk" d={walkPath(points, room)} /></g>;
}

// 가구 앞 사용 공간. FurnitureSymbol과 같은 <g> 안에 넣는다. 색은 상태(--st)를 따른다.
export function ClearZone({ spec }) {
  if (!spec.clear) return null;
  return <rect className="plan-clear" x={0} y={spec.d} width={spec.w} height={spec.clear} rx={2} pointerEvents="none" />;
}

// 배치안 작은 그림: 흰 방에 가구를 대표 면 색 사각형으로(시안 .thumbs)
export function MiniPlan({ room, items, palette }) {
  const W = room.width, D = room.depth, s = Math.max(W, D) / 40; // 시안 40×30 그림의 1칸
  return (
    <svg className="miniplan" viewBox={`${-s} ${-s} ${W + 2 * s} ${D + 2 * s}`} style={paletteVars(palette)} aria-hidden="true">
      <rect className="mp-room" width={W} height={D} rx={s} strokeWidth={1.6 * s} />
      {[...items].sort((a, b) => !!b.floor - !!a.floor).map((it, i) => {
        const [w, h] = it.rot % 180 === 0 ? [it.w, it.d] : [it.d, it.w];
        return <rect key={it.uid ?? i} className={it.floor ? undefined : 'mp-f'} x={it.x} y={it.y} width={w} height={h} strokeWidth={0.7 * s} style={tintFace(it, symbolKind(it)) || faceFill(symbolKind(it))} />;
      })}
    </svg>
  );
}

/* ───────── 가구 썸네일: 정면 그림 40×40 (시안 .th) ───────── */
const THUMB = {
  bed: <><rect x="4" y="10" width="4.5" height="21" rx="1.2" style={fill('pw')} /><rect x="8.5" y="24" width="27.5" height="5" rx="1" style={fill('pw')} /><rect x="8.5" y="19" width="27.5" height="5.5" rx="2" fill="#fff" /><rect x="9.5" y="15.2" width="9" height="5" rx="2.2" fill="#fff" /><path d="M19.5 19H34a2 2 0 0 1 2 2v3.5H17.5V21a2 2 0 0 1 2-2z" style={fill('pb')} /><path d="M10.5 29v3M34 29v3" /></>,
  desk: <><rect x="10" y="6.5" width="13" height="8" rx="1.2" style={fill('pb')} /><path d="M16.5 14.5V17" /><rect x="3" y="17" width="34" height="3.5" rx="1" style={fill('pw')} /><path d="M6 20.5V34M34 20.5V34" /><rect x="23" y="20.5" width="11" height="8" rx="1" fill="#fff" /><path d="M27 24.5h3" /></>,
  wardrobe: <><rect x="8" y="4" width="24" height="30" rx="1.5" style={fill('pw2')} /><path d="M20 4v30M17.5 17v5M22.5 17v5M11 34v2.5M29 34v2.5" /></>,
  bookshelf: <><rect x="9" y="4" width="22" height="32" rx="1.5" style={fill('pw')} /><path d="M9 12h22M9 20h22M9 28h22" /><path className="books" d="M12.5 7v5M15 6.5V12M17.5 7.5V12M23.5 15v5M26 14.5V20M13 23.5V28M15.5 23v5M24 31.5V36M26.500 31V36" /></>,
  rug: <><rect x="5" y="10" width="30" height="20" rx="2" style={fill('pr')} /><rect x="8.5" y="13.5" width="23" height="13" rx="1" stroke="#fff" /><path d="M3 12v16M37 12v16" strokeDasharray="1 2" /></>,
  mirror: <><rect className="glass" x="13" y="4" width="14" height="29" rx="7" /><path d="M17 13l4-4M17 19l6-6M15.5 32.5l-2 3.5M24.5 32.5l2 3.5" /></>,
  lamp: <><path className="bulb" d="M14 8h12l4 12H10z" /><path d="M20 20v12M14 32.5h12" /></>,
  curtain: <><path d="M5 7h30" /><path d="M8 7v26c2-1 3 1 5 0s3 1 4 0V7zM23 7v26c2-1 3 1 5 0s3 1 4 0V7z" style={fill('pb2')} /></>,
  plant: <><path className="leaf" d="M20 25c-1-8-5-13-9-15 0 6 3 12 9 15zM20 25c1-8 5-13 9-15 0 6-3 12-9 15zM20 25c-2-7-1-15 0-20 1 5 2 13 0 20z" /><path d="M14 25h12l-1.5 9.5h-9z" fill="#fff" /></>,
  sofa: <><rect x="7" y="11" width="26" height="14" rx="3" style={fill('pb')} /><rect x="9" y="21" width="22" height="8" rx="1.5" style={fill('pb2')} /><rect x="3.5" y="17" width="6" height="13" rx="2.5" style={fill('pb')} /><rect x="30.5" y="17" width="6" height="13" rx="2.5" style={fill('pb')} /><path d="M20 21v8M8 30v3M32 30v3" /></>,
  chair: <><rect x="12.5" y="5" width="15" height="14" rx="2.5" style={fill('pb')} /><rect x="10.5" y="20" width="19" height="4.5" rx="1.5" style={fill('pb')} /><path d="M20 19v1M13 24.5V35M27 24.5V35" /></>,
  blob: <path d="M7 31c-1-11 5-20 13-20s14 9 13 20c-.2 2-1.500 3-3.500 3h-19c-2 0-3.300-1-3.500-3z" style={fill('pb')} />,
  dining: <><rect x="4" y="14" width="32" height="3.5" rx="1" style={fill('pw')} /><path d="M8 17.5V34M32 17.5V34" /><rect x="15" y="22" width="10" height="3.500" rx="1" style={fill('pb')} /><path d="M16.5 25.500V34M23.5 25.500V34" /></>,
  lowtable: <><rect x="4" y="19" width="32" height="3.5" rx="1" style={fill('pw')} /><path d="M9 22.5v8M31 22.5v8M9 27h22" /></>,
  drawer: <><rect x="7" y="9" width="26" height="23" rx="1.5" style={fill('pw')} /><path d="M7 16.700h26M7 24.300h26M18 12.800h4M18 20.500h4M18 28.200h4M10 32v2.500M30 32v2.500" /></>,
  tv: <><rect x="7" y="7" width="26" height="16" rx="1.5" style={fill('c5')} /><path d="M20 23v4" /><rect x="5" y="27" width="30" height="6" rx="1" style={fill('pw')} /><path d="M20 27v6" /></>,
  fridge: <><rect x="11" y="4" width="18" height="32" rx="2" fill="#fff" /><path d="M11 15h18M14.5 8.500v3.500M14.5 18.500v6" /></>,
  washer: <><rect x="8" y="6" width="24" height="28" rx="2" fill="#fff" /><path d="M8 12.500h24M11.500 9.300h4" /><circle cx="20" cy="23.300" r="7.200" /><circle className="glass" cx="20" cy="23.300" r="4.300" /></>,
  vanity: <><rect className="glass" x="13.500" y="4" width="13" height="14" rx="6.500" /><rect x="5" y="20" width="30" height="3.5" rx="1" style={fill('pw')} /><rect x="22" y="23.500" width="10" height="6" rx="1" fill="#fff" /><path d="M8 23.500V35M32 29.500V35M20 18v2" /></>,
  hanger: <><path d="M6 8h28M9 8v26M31 8v26M5.500 34h7M27.500 34h7" /><rect x="13" y="10.500" width="6" height="15" rx="1.5" style={fill('pb')} /><rect x="21.500" y="10.500" width="6" height="11" rx="1.5" style={fill('pw2')} /></>,
  rack: <><path d="M5 12h30M8 12l5 22M32 12l-5 22M12 12l-4 22M28 12l4 22" /><rect x="14" y="12" width="5" height="10" rx="1" style={fill('pb2')} /><rect x="21" y="12" width="5" height="13" rx="1" fill="#fff" /></>,
  piano: <><rect x="5" y="9" width="30" height="22" rx="1.5" style={fill('pw')} /><rect x="7" y="19.500" width="26" height="4.500" rx=".8" fill="#fff" /><path d="M11.300 19.500v4.500M15.700 19.500v4.500M20 19.500v4.500M24.300 19.500v4.500M28.700 19.500v4.500M8 31v4M32 31v4" /></>,
  appliance: <><rect x="12" y="6" width="16" height="28" rx="3.500" fill="#fff" /><path d="M15.500 11h9M15.500 14.500h9M15.500 18h9" /><circle cx="20" cy="27.500" r="1.800" /></>,
  cattower: <><path d="M20 9v25" /><rect x="10" y="5.500" width="20" height="3.500" rx="1" style={fill('pw')} /><rect x="20" y="20" width="12" height="11" rx="1.500" style={fill('pb')} /><circle cx="26" cy="25.500" r="2.500" fill="#fff" /><rect x="7" y="31" width="26" height="3.500" rx="1" style={fill('pw')} /></>,
  generic: <><rect x="7" y="11" width="26" height="21" rx="2" style={fill('pw2')} /><path d="M7 17.500h26M17.500 14.300h5M10 32v2.500M30 32v2.500" /></>,
};
function thumbKind(spec) {
  const text = textOf(spec);
  if (/curtain|커튼|블라인드/.test(text)) return 'curtain';
  const kind = symbolKind(spec);
  if (kind === 'chair' && isBlob(spec)) return 'blob';
  if (kind === 'hanger' && /drying|건조대/.test(text)) return 'rack';
  return kind;
}
// 가구 목록과 비용 줄의 작은 가구 그림. size(px)를 주면 그 크기로, 안 주면 CSS(.th, .crow .th)가 정한다.
// palette를 주면 그 스타일 색으로, 안 주면 바깥(.app)이 정한 --pw 등을 그대로 쓴다.
export function FurnitureThumb({ spec, palette, size }) {
  const box = size ? { width: size, height: size, borderRadius: size / 4 } : null;
  const side = size ? Math.round((size * 40) / 48) : undefined;
  return (
    <span className="th" style={{ ...box, ...paletteVars(palette), ...tintVars(spec?.tint) }} aria-hidden="true">
      <svg viewBox="0 0 40 40" style={side ? { width: side, height: side } : undefined}>{THUMB[thumbKind(spec || {})] || THUMB.generic}</svg>
    </span>
  );
}
