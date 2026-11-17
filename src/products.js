// 실제 상품 자료(파트너가 조사한 다나와 10,107개 + 이케아 26개): 정리·검색·가구 사양으로 바꾸기. 규약 10.1절.
// 순수 함수는 브라우저와 Node 양쪽에서 동작한다(loadProducts만 fetch를 쓴다). import는 ./catalog.js만.
// 이 자료는 2026-11-17에 한 번 조사한 값이다. 앱이 다나와·이케아 페이지를 자동으로 읽어 오지 않는다.
import { CATALOG, cleanName, validateSpec } from './catalog.js';

export const PRODUCT_SOURCES = {
  danawa: { label: '다나와 최저가', note: '다나와 최저가 · 2026년 11월 17일 조사 · 배송비 제외 · 가장 싼 옵션 기준 · 실제 가격과 다를 수 있어요' },
  ikea: { label: '이케아 공식가', note: '이케아 공식가 · 2026년 11월 조사 · 실제 가격과 다를 수 있어요' },
};

// 원룸에서 자주 찾는 순서
export const PRODUCT_CATEGORIES = [
  ['bed', '침대'], ['desk', '책상'], ['chair', '의자'], ['wardrobe', '옷장'], ['hanger', '행거'], ['drawer', '서랍장'],
  ['bookcase', '책장'], ['shelf', '선반'], ['cabinet', '수납장'], ['sofa', '소파'], ['table', '테이블'], ['bedside', '협탁'],
  ['vanity', '화장대'], ['tvstand', 'TV 거실장'], ['diningtable', '식탁'], ['kitchen', '주방 수납'], ['shoerack', '신발장'],
  ['lamp', '스탠드 조명'], ['box', '공간박스'],
].map(([key, label]) => ({ key, label }));

const CATS = new Set(PRODUCT_CATEGORIES.map((c) => c.key));
const WARNS = ['', '가격 확인 필요', '치수 확인 필요'];
const PAGE_HOST = { danawa: 'prod.danawa.com', ikea: 'www.ikea.com' };
const IMAGE_HOSTS = ['img.danuri.io', 'img.danawa.com'];
const ID = { danawa: /^dnw-\d{1,20}$/, ikea: /^ikea-[a-z0-9-]{1,50}$/ };
const PRICE_MAX = 50_000_000;
const own = (obj, key) => (typeof key === 'string' && Object.hasOwn(obj, key) ? obj[key] : undefined);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
// 자료의 브랜드 110개에 '<b>침대</b>' 같은 강조 표시가 섞여 있다. 표시만 떼고 나머지는 cleanName에 맡긴다.
const txt = (v, max) => cleanName(typeof v === 'string' ? v.replace(/<\/?[a-z][^<>]*>/gi, '') : v, max);

// https이고 허용한 호스트일 때만 주소를 돌려준다. 아니면 ''
function safeUrl(v, hosts) {
  if (typeof v !== 'string' || v.length > 400) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && hosts.includes(u.hostname) && !u.port && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
}

// 상품 정보 검증. 자료를 읽을 때와 저장값을 되살릴 때 같이 쓴다 → { meta } 또는 { why: 뺀 이유 }
// 치수가 규약 범위를 벗어나면 고쳐 쓰지 않고 뺀다(화면에 "실제 치수"라고 보여 주는 값이라서).
function check(o) {
  if (!o || typeof o !== 'object') return { why: '형식' };
  const src = own(PAGE_HOST, o.src) ? o.src : '';
  const id = src && typeof o.id === 'string' && ID[src].test(o.id) ? o.id : '';
  const name = txt(o.name, 80);
  if (!id || !name) return { why: '번호·이름' };
  const [w, d, h, price] = [num(o.w), num(o.d), num(o.h), Math.round(num(o.price))]; // 먼저 반올림한다(0.4원이 0원으로 통과하지 않게)
  if (!(w >= 10 && w <= 400 && d >= 10 && d <= 400 && h >= 1 && h <= 300)) return { why: '치수 범위' };
  if (!(price > 0 && price <= PRICE_MAX)) return { why: '가격' };
  const url = safeUrl(o.url, [PAGE_HOST[src]]);
  if (!url) return { why: '주소' };
  const img = typeof o.image === 'string' && o.image.startsWith('//') ? `https:${o.image}` : o.image; // 2개는 '//img.danawa.com/…'로 적혀 있다
  return {
    meta: {
      id, src, name, brand: txt(o.brand, 30), type: txt(o.type, 20), w, d, h, price,
      warn: WARNS.includes(o.warn) ? o.warn : '', note: txt(o.note, 60), url, image: safeUrl(img, IMAGE_HOSTS),
    },
  };
}

// 저장된 product 정보를 다시 검증한다(주소 허용 목록, 길이, 숫자 범위). 틀리면 null
export const productIn = (obj) => check(obj).meta ?? null;

// 바닥을 차지하지 않는 것: 벽에 다는 것, 책상·침대·신발장 위나 안에 두는 것. 기본 검색에서 뺀다.
const FLOORLESS = new Set(['벽 선반', '단스탠드', '벽걸이행거', '베드테이블', '슈즈렉']);
// '단스탠드'로 분류됐지만 높이가 1m를 넘으면 바닥에 세우는 장스탠드다(1개)
const isFloorless = (type, h) => FLOORLESS.has(type) && !(type === '단스탠드' && h >= 100);
// 이케아 공식 자료는 brand가 'IKEA'라서 한글 '이케아'로는 안 나온다 → 검색용 글에 '이케아 공식'을 덧붙인다
const hay = (p) => `${p.name} ${p.brand} ${p.type}${p.src === 'ikea' ? ' 이케아 공식' : ''}`.toLowerCase();
// 자료에 높이가 12cm로 잘못 적힌 것(옷장 1개, 모션데스크 1개)처럼 뚜렷이 틀린 치수. 빼지 않고 '치수 확인 필요'로 알린다
const oddDims = (o) => (o.category === 'wardrobe' && o.height < 100) || (o.type === '모션데스크' && o.height < 60);

// 파트너 자료 → product[]. 형식이 틀린 상품은 뺀다. 뺀 상품은 돌려준 배열의 skipped([{ id, why }])에 남긴다(규약에 없는 덧붙임 값).
export function normalizeProducts(catalogJson, ikeaJson) {
  const out = [], skipped = [], seen = new Set();
  const add = (raw, src) => {
    const o = raw && typeof raw === 'object' ? raw : {};
    const ikea = src === 'ikea';
    let r = !CATS.has(o.category) ? { why: '분류' } : check({
      ...o, src, w: o.width, d: o.depth, h: o.height,
      id: ikea && typeof o.id === 'string' ? `ikea-${o.id}` : o.id,
      type: ikea ? '' : o.type,
      // 이케아: 상세 페이지와 대조한 치수(dimSource 'product')가 아니면 확인이 필요하다고 알린다(인계 문서 7절)
      warn: ikea ? (o.dimSource === 'product' ? '' : '치수 확인 필요') : o.warn || (oddDims(o) ? '치수 확인 필요' : ''),
    });
    if (r.meta && seen.has(r.meta.id)) r = { why: '번호 중복' };
    if (!r.meta) {
      skipped.push({ id: cleanName(o.id, 60), why: r.why });
      return;
    }
    const m = r.meta;
    seen.add(m.id);
    const p = {
      id: m.id, src, category: o.category, type: m.type, name: m.name, brand: m.brand, w: m.w, d: m.d, h: m.h, price: m.price,
      shops: ikea ? 0 : Math.max(0, Math.round(num(o.shops) || 0)), warn: m.warn, note: m.note, url: m.url, image: m.image,
      floorless: isFloorless(m.type, m.h),
    };
    Object.defineProperty(p, '_q', { value: hay(p) }); // 검색용 소문자 글. 복사·저장에는 따라가지 않는다
    out.push(p);
  };
  for (const it of Array.isArray(catalogJson?.items) ? catalogJson.items : []) add(it, 'danawa');
  for (const it of Array.isArray(ikeaJson?.items) ? ikeaJson.items : []) add(it, 'ikea');
  Object.defineProperty(out, 'skipped', { value: skipped });
  return out;
}

let loading = null;
// 브라우저 전용. 한 번만 받아 기억하고, 실패하면 기억을 지워 다시 시도할 수 있게 한다.
// 주소는 페이지 기준 상대 경로다(공개 사이트의 하위 폴더에서도 열리게).
// 두 자료 가운데 하나만 있어도 그것으로 보여 준다(공개 배포본에는 다나와 자료를 넣지 않는다).
export function loadProducts() {
  loading ??= Promise.all(['data/catalog.json', 'data/ikea.json'].map(async (path) => {
    try {
      const res = await fetch(new URL(path, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI));
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  })).then(([catalog, ikea]) => {
    const list = normalizeProducts(catalog, ikea);
    if (!list.length) throw new Error('empty');
    return list;
  }).catch(() => {
    loading = null;
    throw new Error('상품 목록을 불러오지 못했어요');
  });
  return loading;
}

const SORTS = {
  popular: (a, b) => b.shops - a.shops,
  price: (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  small: (a, b) => a.w * a.d - b.w * b.d,
};
const int = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : dflt);

// opts: { q, category, type, fit: { width, depth } | null, near: { w, d } | null, maxPrice, includeFloorless, sort, offset, limit }
// → { total, items, types }. types는 type만 빼고 지금 조건을 모두 적용했을 때 고를 수 있는 세부 분류(많은 순).
export function searchProducts(list, opts) {
  const { q = '', category = '', type = '', fit = null, near = null, maxPrice, includeFloorless = false, sort = 'popular', offset = 0, limit = 60 } = opts || {};
  // 낱말은 글자 그대로 찾는다(정규식으로 쓰지 않는다)
  const words = String(q ?? '').normalize('NFC').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const room = fit && fit.width > 0 && fit.depth > 0 ? [Math.max(fit.width, fit.depth), Math.min(fit.width, fit.depth)] : null;
  const cap = Number.isFinite(maxPrice) ? maxPrice : Infinity;
  const counts = new Map(), hits = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || (category && p.category !== category)) continue;
    if (p.floorless && !includeFloorless) continue;
    if (p.price > cap) continue;
    if (room && (Math.max(p.w, p.d) > room[0] || Math.min(p.w, p.d) > room[1])) continue;
    if (words.length) {
      const text = p._q ?? hay(p);
      if (!words.every((w) => text.includes(w))) continue;
    }
    if (p.type) counts.set(p.type, (counts.get(p.type) || 0) + 1);
    if (!type || p.type === type) hits.push(p);
  }
  const to = near && Number.isFinite(near.w) && Number.isFinite(near.d) ? near : null;
  const dist = (p) => Math.abs(p.w - to.w) + Math.abs(p.d - to.d); // 상품마다 먼저 구해서 뺀다(소수 치수에서 같은 거리가 다르게 나오지 않게)
  const by = sort === 'near' && to ? (a, b) => dist(a) - dist(b) : own(SORTS, sort) || SORTS.popular;
  hits.sort((a, b) => by(a, b) || b.shops - a.shops || (a.id < b.id ? -1 : 1)); // 같으면 판매처 많은 순, 그다음 번호 순(늘 같은 순서)
  const from = int(offset, 0, hits.length, 0);
  return {
    total: hits.length,
    items: hits.slice(from, from + int(limit, 1, Infinity, 60)), // 상한을 두지 않는다: 화면의 [더 보기]가 limit을 계속 키운다
    types: [...counts].map(([t, count]) => ({ type: t, count })).sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1)),
  };
}

// ───────── 상품 → 가구 사양 ─────────
// 배치 엔진(layout.js roleOf)과 가구 그림(symbols.jsx symbolKind, three/model.js kindOf)은 name·key 글자와 category로 종류를 알아본다.
// 그래서 세부 분류(type)마다 [평면도에 쓸 짧은 이름, 바탕 CATALOG 키]를 정한다. 둘 다 상품을 받아 고르는 함수일 수 있다.
// 이름을 고를 때 조심한 것(그림 규칙이 앞에서부터 맞춰 보기 때문):
//   '소파 테이블'은 소파 그림이 된다 → '커피 테이블'. '식탁 의자'는 식탁 그림이 된다 → '의자'. '좌식 의자'는 좌식 탁자 그림이 된다 → '바닥 의자'.
//   '돌소파'는 침대 크기(폭 90 × 길이 210)라서 침대로 다룬다 → '돌 데이베드'.
const nearestW = (...keys) => (p) => keys.reduce((a, b) => (Math.abs(CATALOG[b].w - p.w) < Math.abs(CATALOG[a].w - p.w) ? b : a));
const deskKey = nearestW('desk_100', 'desk_120', 'desk_140', 'desk_160');
const wardrobeKey = nearestW('wardrobe_80', 'wardrobe_100', 'wardrobe_120');

// 침대: 프레임 폭은 매트리스보다 4~10cm 넓다. 폭의 경계는 자료의 크기 표시(S·SS·D·Q·K)별 폭 분포에서 잡았다.
const BED = {
  MS: ['미니싱글 침대', 'bed_single'], S: ['싱글 침대', 'bed_single'], SS: ['슈퍼싱글 침대', 'bed_ss'], D: ['더블 침대', 'bed_double'],
  Q: ['퀸 침대', 'bed_queen'], K: ['킹 침대', 'bed_king'], LK: ['라지킹 침대', 'bed_king'],
};
const bedByWidth = (p) => BED[p.w < 108 ? 'S' : p.w < 130 ? 'SS' : p.w < 148 ? 'D' : p.w < 160 ? 'Q' : 'K'];
// 일반 침대는 상품 이름 끝의 크기 표시를 먼저 믿는다('… 수납 침대 Q+협탁2개'). 없으면 폭으로 정한다.
const bedOf = (p) => BED[p.name.match(/(?:^|\s)(SS|MS|LK|S|D|Q|K)(?=$|[\s+(])/)?.[1]] || bedByWidth(p);
const bedKey = (p) => bedByWidth(p)[1];

// 소파: 같은 '2인용'도 폭이 93~204cm로 퍼져 있어서 이름의 '○인용'을 먼저 믿는다. 없으면 폭으로 정한다.
// 자료에는 '1인용'~'6인용'과 '1.5인용'·'2.5인용'·'3.5인용'이 있다.
const seats = (p) => Number(p.name.match(/([1-9](?:\.5)?)인/)?.[1]) || (p.w < 110 ? 1 : p.w < 175 ? 2 : 3);
const sofaKey = (p) => (seats(p) < 1.5 ? 'sofa_1' : seats(p) < 3 ? 'sofa_2' : 'sofa_3');
// 의자 가운데 폭 90cm 이상은 긴 의자(벤치)다. 배치 엔진도 폭 70cm가 넘는 앉는 가구는 소파처럼 벽에 붙인다.
const seatKey = (p) => (p.w < 90 ? 'chair' : p.w < 170 ? 'sofa_2' : 'sofa_3');
const seatName = (p) => (p.w < 90 ? '의자' : '벤치');
const bookKey = (p) => (p.h >= 120 ? 'bookshelf' : 'bookshelf_low');
const bookName = (p) => (p.h >= 120 ? '책장' : '낮은 책장');
// 탁자: 높이 50cm 이하는 좌식(배치 엔진도 50cm 이하를 소파 앞 탁자로 본다)
const tableKey = (p) => (p.h <= 50 ? 'table_floor' : p.w < 100 ? 'table_2' : 'table_4');
const diningName = (p) => (p.w < 100 ? '2인 식탁' : p.w < 160 ? '4인 식탁' : '6인 식탁');

const TYPES = {
  // bed
  '침대': [(p) => bedOf(p)[0], (p) => bedOf(p)[1]],
  '벙커침대': ['벙커 침대', 'bed_bunk'], '2층침대': ['2층 침대', 'bed_bunk'], '2단침대': ['2단 침대', 'bed_bunk'],
  '매트리스깔판': ['매트리스 깔판', 'bed_mattress'], '하단파운데이션': ['파운데이션 침대', 'bed_mattress'],
  '접이식침대': ['접이식 침대', bedKey], '모션베드': ['모션 베드', bedKey], '돌침대': ['돌침대', bedKey], '흙침대': ['흙침대', bedKey],
  '돌소파': ['돌 데이베드', bedKey], '흙소파': ['흙 데이베드', bedKey], '트윈침대': ['트윈 침대', bedKey], '패밀리침대': ['패밀리 침대', bedKey],
  // bedside
  '협탁': ['협탁', 'nightstand'],
  // bookcase, box
  '일반책장': [bookName, bookKey], '선반책장': [bookName, bookKey], '파티션책장': [bookName, bookKey], '책꽂이': [bookName, bookKey],
  '캐비닛': [bookName, bookKey], '슬라이딩책장': ['슬라이딩 책장', bookKey], '회전책장': ['회전 책장', bookKey], '공간박스': ['공간박스', bookKey],
  // cabinet
  '수납장': ['수납장', 'cabinet'], '장식장': ['장식장', 'cabinet'], 'CD(DVD)장': ['CD장', 'cabinet'], '사물함,락커': ['사물함', 'cabinet'],
  // chair
  '게이밍의자': ['게이밍 의자', 'chair'], '컴퓨터,사무용의자': ['사무용 의자', 'chair'], '중역의자': ['중역 의자', 'chair'],
  '식탁의자': [seatName, seatKey], '다용도의자': [seatName, seatKey], '상업용의자': [seatName, seatKey], '벤치의자': ['벤치', seatKey],
  '바(아일랜드)의자': ['바 의자', 'chair'], '스툴형': ['스툴', 'chair'], '소파스툴': ['풋스툴', 'chair'], '자세교정의자': ['자세교정 의자', 'chair'],
  '좌식의자': ['바닥 의자', 'chair'], '안락의자': ['안락의자', 'sofa_1'], '좌식소파': ['좌식 소파', sofaKey], '빈백소파': ['빈백', 'beanbag'],
  // desk
  '모션데스크': ['모션 데스크', 'desk_motion'], '컴퓨터 책상': ['컴퓨터 책상', 'desk_computer'], '책상': ['책상', deskKey], '일자형': ['책상', deskKey],
  '접이식책상': ['접이식 책상', deskKey],
  // diningtable
  '식탁': [diningName, tableKey], '아일랜드식탁': ['아일랜드 식탁', tableKey], '티테이블': ['티테이블', tableKey], '홈바테이블': ['홈바 테이블', tableKey],
  // drawer
  '일반서랍장': ['서랍장', 'dresser'], '플라스틱 서랍장': ['플라스틱 서랍장', 'dresser'], '책상서랍장': ['책상 서랍장', 'dresser'],
  '아일랜드장': ['아일랜드 서랍장', 'dresser'], '콘솔': ['콘솔', 'dresser'],
  // hanger (천장고정행거는 바닥에 기둥이 서므로 바닥을 차지한다)
  '스탠드행거': ['스탠드 행거', 'hanger'], '스탠드옷걸이': ['스탠드 옷걸이', 'hanger'], '폴행거': ['폴 행거', 'hanger'], '사다리행거': ['사다리 행거', 'hanger'],
  '천장고정행거': ['천장고정 행거', 'hanger'], '벽걸이행거': ['벽걸이 행거', 'hanger'],
  // kitchen
  '렌지대': ['전자레인지 수납장', 'microwave_rack'], '주방수납장': ['주방 수납장', 'cabinet'], '틈새수납장': ['틈새 수납장', 'cabinet'],
  // lamp
  '장스탠드': ['장스탠드', 'floor_lamp'], '단스탠드': ['단스탠드', 'floor_lamp'],
  // shelf
  '스탠드 선반': ['선반', 'shelf'], '선반행거': ['수납 행거', 'hanger'], '트롤리': ['트롤리', 'shelf'], '벽 선반': ['벽 선반', 'shelf'],
  // shoerack
  '신발장': ['신발장', 'shoe_rack'], '슈즈렉': ['신발 정리대', 'shoe_rack'],
  // sofa
  '소파': [(p) => `${seats(p)}인 소파`, sofaKey], '소파베드': ['소파베드', 'sofa_bed'], '리클라이너': ['리클라이너', 'recliner'],
  // table
  '소파테이블': ['커피 테이블', 'table_floor'], '리프트업테이블': ['리프트업 커피 테이블', 'table_floor'], '사각형': ['커피 테이블', 'table_floor'],
  '교자상': ['교자상', 'table_floor'], '상': ['좌식 테이블', 'table_floor'], '찻상': ['찻상', 'table_floor'], '접이식테이블': ['접이식 테이블', tableKey],
  '사이드테이블': ['사이드 테이블', 'nightstand'], '베드테이블': ['베드 테이블', 'table_floor'],
  // tvstand
  '기본형': ['TV 거실장', 'tv_stand'], '확장형': ['TV 거실장', 'tv_stand'], '월플렉스형': ['TV 거실장', 'tv_stand'],
  // vanity
  '화장대': ['화장대', 'vanity'],
  // wardrobe
  '옷장': ['옷장', wardrobeKey], '비키니옷장': ['비키니 옷장', wardrobeKey], '시스템행거': ['시스템 행거', 'hanger'],
};
// 표에 없는 type(이케아는 type이 없다)은 분류의 대표 type 규칙을 쓴다
const CATEGORY_TYPE = {
  bed: '침대', desk: '책상', chair: '다용도의자', wardrobe: '옷장', hanger: '스탠드행거', drawer: '일반서랍장', bookcase: '일반책장',
  shelf: '스탠드 선반', cabinet: '수납장', sofa: '소파', table: '소파테이블', bedside: '협탁', vanity: '화장대', tvstand: '기본형',
  diningtable: '식탁', kitchen: '주방수납장', shoerack: '신발장', lamp: '장스탠드', box: '공간박스',
};
const pick = (v, p) => (typeof v === 'function' ? v(p) : v);

// product → 3절 spec(validateSpec을 통과한 값) + product 정보. 상품이 틀렸으면 null
export function productToSpec(product) {
  const meta = productIn(product);
  const rule = meta && (own(TYPES, meta.type) || own(TYPES, own(CATEGORY_TYPE, product.category)));
  if (!rule) return null;
  const base = CATALOG[pick(rule[1], meta)];
  // 모션데스크는 자료의 높이가 끝까지 올렸을 때 값이다(113개 중 103개가 100cm 이상). 방에는 앉아 쓰는 높이(바탕 75cm)로 놓고 키 큰 가구로 보지 않는다.
  // 규약 10.1의 "h = 상품 치수"와 다른 한 곳. 조사한 높이는 product.h에 그대로 남는다.
  const h = meta.type === '모션데스크' ? Math.min(meta.h, base.h) : meta.h;
  const spec = validateSpec({
    ...base, name: pick(rule[0], meta), w: meta.w, d: meta.d, h, tall: Math.round(h) >= 120,
    price: meta.price, query: cleanName(meta.name, 40), source: 'catalog',
  });
  return spec && { ...spec, product: meta };
}

// 앱 가구(spec.key)에 맞는 파트너 분류. 맞는 분류가 없으면 null (거울·가전·러그·화분, 직접 적은 가구 등)
const KEY_CATEGORY = {
  bed: 'bed', desk: 'desk', chair: 'chair', beanbag: 'chair', wardrobe: 'wardrobe', hanger: 'hanger', dresser: 'drawer',
  bookshelf: 'bookcase', bookshelf_low: 'bookcase', cabinet: 'cabinet', shelf: 'shelf', shoe_rack: 'shoerack', tv_stand: 'tvstand',
  microwave_rack: 'kitchen', nightstand: 'bedside', vanity: 'vanity', sofa: 'sofa', recliner: 'sofa',
  table_2: 'diningtable', table_4: 'diningtable', table_floor: 'table', floor_lamp: 'lamp',
};
export function productCategoryOf(spec) {
  const key = typeof spec?.key === 'string' ? spec.key : '';
  return own(KEY_CATEGORY, key) ?? own(KEY_CATEGORY, key.split('_')[0]) ?? null; // 'bed_ss' → 'bed', 'sofa_bed' → 'sofa'
}
