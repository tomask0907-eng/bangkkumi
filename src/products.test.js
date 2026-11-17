// 실제 상품 자료 모듈 검사: node --test src/products.test.js
// 실제 public/data 파일(다나와 10,107개 + 이케아 26개)을 읽어서 본다.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CATALOG, validateSpec } from './catalog.js';
import {
  PRODUCT_SOURCES, PRODUCT_CATEGORIES, normalizeProducts, loadProducts, searchProducts, productToSpec, productIn, productCategoryOf,
} from './products.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
// 다나와 조사 자료는 공개 저장소에 넣지 않는다. 그 파일이 없으면 이 파일의 검사는 건너뛴다.
const HAS_DATA = existsSync(new URL('../public/data/catalog.json', import.meta.url));
const test = HAS_DATA ? nodeTest : (name) => nodeTest(name, { skip: 'public/data/catalog.json 이 없어서 건너뛰어요' }, () => {});
const RAW = HAS_DATA ? read('catalog.json') : { items: [] }, IKEA = read('ikea.json');
const LIST = normalizeProducts(RAW, IKEA);
const byName = (name) => {
  const p = LIST.find((x) => x.name === name);
  assert.ok(p, `자료에 '${name}' 상품이 있어야 해요`);
  return p;
};
const byId = (id) => LIST.find((x) => x.id === id);
const KEYS = ['id', 'src', 'category', 'type', 'name', 'brand', 'w', 'd', 'h', 'price', 'shops', 'warn', 'note', 'url', 'image', 'floorless'];
const ODD = ['dnw-124376234', 'dnw-20228483']; // 자료의 치수가 뚜렷이 틀린 2개
const META_KEYS = ['id', 'src', 'name', 'brand', 'type', 'w', 'd', 'h', 'price', 'warn', 'note', 'url', 'image'];

test('정리 뒤 개수: 10,107 + 26 = 10,133개, 뺀 상품 0개', () => {
  assert.equal(RAW.items.length, 10107);
  assert.equal(IKEA.items.length, 26);
  assert.equal(LIST.length, 10133);
  assert.deepEqual(LIST.skipped, []); // 치수 범위(w·d 10~400, h 1~300)를 벗어난 상품도, 주소가 틀린 상품도 없다
  assert.equal(LIST.filter((p) => p.src === 'ikea').length, 26);
  const count = {};
  for (const p of LIST) count[p.category] = (count[p.category] || 0) + 1;
  assert.deepEqual(count, { // 다나와 개수 + 이케아 개수
    bed: 1672 + 4, chair: 1122 + 3, sofa: 909 + 2, cabinet: 810, wardrobe: 731 + 4, table: 696, diningtable: 584, desk: 470 + 4, hanger: 434,
    drawer: 414 + 3, shelf: 403, kitchen: 350, bookcase: 304 + 4, vanity: 289, bedside: 252 + 2, tvstand: 247, shoerack: 229, lamp: 135, box: 56,
  });
  assert.equal(new Set(LIST.filter((p) => p.src === 'danawa').map((p) => p.type)).size, 92);
});

test('틀린 상품은 고치지 않고 빼고, 이유를 남긴다', () => {
  const ok = RAW.items[0];
  const list = normalizeProducts({
    items: [
      ok,
      { ...ok, id: 'dnw-1', width: 401 }, { ...ok, id: 'dnw-2', depth: 9.9 }, { ...ok, id: 'dnw-3', height: 300.5 }, { ...ok, id: 'dnw-4', width: '120' },
      { ...ok, id: 'dnw-5', url: 'https://evil.example/info/?pcode=1' }, { ...ok, id: 'dnw-6', url: 'http://prod.danawa.com/info/?pcode=1' },
      { ...ok, id: 'dnw-7', category: 'toy' }, { ...ok, id: 'dnw-8', price: 0 }, { ...ok, id: 'dnw-9', name: '<>' }, { ...ok, id: 'x-10' },
      ok, null, 'x',
    ],
  }, { items: [{ ...IKEA.items[0], url: 'https://prod.danawa.com/info/?pcode=1' }] });
  assert.deepEqual(list.map((p) => p.id), [ok.id]);
  assert.deepEqual(list.skipped.map((s) => s.why), ['치수 범위', '치수 범위', '치수 범위', '치수 범위', '주소', '주소', '분류', '가격', '번호·이름', '번호·이름', '번호 중복', '분류', '분류', '주소']);
  assert.deepEqual(normalizeProducts(null, undefined), []);
  assert.deepEqual(normalizeProducts({ items: 'x' }, { items: {} }), []);
});

test('모든 상품이 규약 10절 형식이다', () => {
  const cats = new Set(PRODUCT_CATEGORIES.map((c) => c.key));
  const ids = new Set();
  const raw = new Map(RAW.items.map((r) => [r.id, r]));
  for (const p of LIST) {
    assert.deepEqual(Object.keys(p), KEYS, p.id);
    assert.ok(!ids.has(p.id), `번호가 겹쳐요: ${p.id}`);
    ids.add(p.id);
    assert.match(p.id, p.src === 'danawa' ? /^dnw-\d+$/ : /^ikea-[a-z0-9-]+$/);
    assert.ok(cats.has(p.category), p.id);
    for (const f of ['type', 'name', 'brand', 'note']) assert.ok(typeof p[f] === 'string' && !/[<>\p{Cc}]/u.test(p[f]), `${p.id} ${f}`);
    assert.ok(p.name.length > 0 && [...p.name].length <= 80 && [...p.brand].length <= 30, p.id);
    assert.ok(p.w >= 10 && p.w <= 400 && p.d >= 10 && p.d <= 400 && p.h >= 1 && p.h <= 300, p.id);
    assert.ok(Number.isInteger(p.price) && p.price > 0 && p.price <= 50_000_000, p.id);
    assert.ok(Number.isInteger(p.shops) && p.shops >= 0, p.id);
    assert.ok(['', '가격 확인 필요', '치수 확인 필요'].includes(p.warn), p.id);
    assert.ok(p.url.startsWith(p.src === 'danawa' ? 'https://prod.danawa.com/' : 'https://www.ikea.com/'), p.id);
    assert.ok(p.image === '' || p.image.startsWith('https://img.danuri.io/') || p.image.startsWith('https://img.danawa.com/'), p.id);
    assert.equal(typeof p.floorless, 'boolean');
    if (p.src === 'danawa') { // 치수·가격·판매처 수·주소는 자료에 적힌 값 그대로
      const r = raw.get(p.id);
      assert.deepEqual([p.w, p.d, p.h, p.price, p.shops, p.url, p.note], [r.width, r.depth, r.height, r.price, r.shops, r.url, r.note], p.id);
      if (!ODD.includes(p.id)) assert.equal(p.warn, r.warn, p.id);
    }
  }
  assert.equal(LIST.filter((p) => p.warn === '가격 확인 필요').length, 209);
  assert.equal(LIST.filter((p) => p.src === 'danawa' && p.warn === '치수 확인 필요').length, 83 + 2);
  // 자료에 높이가 12cm로 적힌 옷장과 모션데스크: 빼지 않고 '치수 확인 필요'로 알린다
  for (const id of ODD) assert.deepEqual([raw.get(id).height, raw.get(id).warn, byId(id).warn], [12, '', '치수 확인 필요'], id);
  assert.equal(LIST.filter((p) => p.src === 'danawa' && !p.image).length, 0);
  assert.equal(LIST.filter((p) => p.image.startsWith('https://img.danawa.com/')).length, 2); // '//img.danawa.com/…'로 적힌 2개
  // 브랜드의 '<b>침대</b>' 표시는 표시만 뗀다
  assert.equal(RAW.items.filter((r) => /[<>]/.test(r.brand)).length, 110);
  assert.equal(byName('메리노가구 저상형 깔판 XS').brand, '메리노침대');
  assert.equal(byId('dnw-14963018').name, '모던탑21 프렌즈 4단 유리 장식장 600'); // 이름 안의 탭 문자
});

test('이케아: 번호 앞에 ikea-, 판매처 0, 사진 없음, 대조하지 않은 치수는 "치수 확인 필요"', () => {
  const ikea = LIST.filter((p) => p.src === 'ikea');
  assert.ok(ikea.every((p) => p.id.startsWith('ikea-') && p.type === '' && p.shops === 0 && p.image === ''));
  assert.equal(ikea.filter((p) => p.warn === '치수 확인 필요').length, IKEA.items.filter((r) => r.dimSource === 'list').length);
  assert.equal(ikea.filter((p) => p.warn).length, 12);
  assert.equal(byId('ikea-wardrobe-kleppstad-79').warn, '치수 확인 필요');
  assert.equal(byId('ikea-desk-micke-73').warn, '');
  assert.equal(byId('ikea-bed-tarva-120').note, '갈빗살·매트리스 별도, 높이는 머리판 기준');
});

test('바닥을 차지하지 않는 상품(floorless) 215개', () => {
  const n = (type) => LIST.filter((p) => p.floorless && p.type === type).length;
  assert.deepEqual([n('벽 선반'), n('단스탠드'), n('베드테이블'), n('벽걸이행거'), n('슈즈렉')], [130, 65, 18, 1, 1]);
  assert.equal(LIST.filter((p) => p.floorless).length, 215);
  assert.equal(byName('서웅씨엔씨 스피아노 버블 장스탠드').floorless, false); // 단스탠드로 분류됐지만 높이 160cm
  assert.equal(LIST.filter((p) => p.type === '천장고정행거' && p.floorless).length, 0); // 바닥에 기둥이 선다
});

test('productToSpec: 모든 상품이 validateSpec을 다시 통과해도 같은 값이고, 치수는 반올림 차이 안이다', () => {
  for (const p of LIST) {
    const { product, ...spec } = productToSpec(p);
    assert.deepEqual(validateSpec(spec), spec, p.id);
    assert.ok(Object.hasOwn(CATALOG, spec.key), `${p.id} ${spec.key}`);
    const h = p.type === '모션데스크' ? Math.min(p.h, 75) : p.h; // 모션데스크의 자료 높이는 끝까지 올렸을 때 값이라 앉아 쓰는 높이로 놓는다
    assert.ok(Math.abs(spec.w - p.w) <= 0.5 && Math.abs(spec.d - p.d) <= 0.5 && Math.abs(spec.h - h) <= 0.5, p.id);
    assert.ok(spec.name && [...spec.name].length <= 30 && [...spec.query].length <= 40, p.id);
    assert.equal(spec.price, p.price);
    assert.equal(spec.source, 'catalog');
    assert.equal(spec.tall, spec.h >= 120, p.id);
    const base = CATALOG[spec.key];
    assert.deepEqual([spec.category, spec.clear, spec.sideOk, spec.floor], [base.category, base.clear, base.sideOk, base.floor], p.id);
    assert.deepEqual(Object.keys(product), META_KEYS, p.id);
    for (const k of META_KEYS) assert.equal(product[k], p[k], `${p.id} ${k}`); // w d h는 반올림 전 값
    assert.deepEqual(productIn(JSON.parse(JSON.stringify(product))), product, p.id); // 저장했다가 되살려도 같다
  }
  assert.equal(productToSpec(null), null);
  assert.equal(productToSpec({ ...LIST[0], w: 500 }), null);
  assert.equal(productToSpec({ ...LIST[0], type: '없는 분류', category: 'nope' }), null);
  assert.equal(productToSpec({ ...LIST[0], type: '없는 분류' }).key, productToSpec({ ...LIST[0], type: '침대' }).key); // 표에 없는 type은 분류의 기본 규칙
});

test('productToSpec: 종류별 바탕 키와 평면도 이름', () => {
  const cases = [
    // [상품 이름, 바탕 키, 평면도 이름]
    ['홈잡스 단면 매트리스 일체형 침대 S', 'bed_single', '싱글 침대'],
    ['삼익가구 무브슬립 헤드형 모션베드 SS', 'bed_ss', '모션 베드'],
    ['파로마 아이비 평상형 침대 Q/K', 'bed_king', '킹 침대'], // 크기 표시가 없으면 폭(160)으로
    ['마켓비 CHAMBER 벙커침대 S', 'bed_bunk', '벙커 침대'],
    ['장인가구 로빈 데이베드 슬라이드 2단침대 SS', 'bed_bunk', '2단 침대'],
    ['삼익가구 PE폼 깔판 SS', 'bed_mattress', '매트리스 깔판'],
    ['웨스트프롬 하루 파운데이션 침대 SS', 'bed_mattress', '파운데이션 침대'],
    ['퍼니리빙 높이각도조절 스탠딩 책상', 'desk_motion', '모션 데스크'],
    ['가구느낌 랜테이블 책상', 'desk_computer', '컴퓨터 책상'],
    ['룸앤오피스 접이식 테이블', 'desk_120', '책상'],
    ['위즈바움 소피드매종 헤븐 오픈 수납 패브릭 소파 2인용', 'sofa_2', '2인 소파'],
    ['온누리가구 클로버 UV코팅 원목 평상형 소파베드 3인용', 'sofa_bed', '소파베드'],
    ['베스트리빙 슬림 가죽 리클라이너 1인용', 'recliner', '리클라이너'],
    ['컴엔텔상사 볼 빈백 1인용', 'beanbag', '빈백'],
    ['일루일루 라이트 G-지타이탄 게이밍 의자', 'chair', '게이밍 의자'],
    ['가구느낌 모던 벤치의자 1500', 'sofa_2', '벤치'],
    ['니드 웰빙 좌식의자', 'chair', '바닥 의자'],
    ['이케아 KNARREVIK 사이드테이블 370', 'nightstand', '협탁'],
    ['가구느낌 우사이드테이블', 'nightstand', '사이드 테이블'],
    ['이케아 HELMER 6단 이동식 서랍장 280', 'dresser', '책상 서랍장'],
    ['홈하모니 마롱 2단 서랍장 400', 'dresser', '서랍장'],
    ['트리플 픽스 H1880 1단행거 옷장 400', 'wardrobe_80', '옷장'],
    ['이케아 VUKU 옷장 740', 'wardrobe_80', '비키니 옷장'],
    ['레이디가구 이안 A세트 드레스룸 1200', 'hanger', '시스템 행거'],
    ['가구느낌 로이 1단 행거 800', 'hanger', '스탠드 행거'],
    ['왕자행거 2단 커튼행거 브라운', 'hanger', '천장고정 행거'],
    ['필웰 레트라 2단 책장', 'bookshelf_low', '낮은 책장'],
    ['히트가구 RG221 확장형 5단 책장 600', 'bookshelf', '책장'],
    ['성진산업 성진공간박스', 'bookshelf_low', '공간박스'],
    ['누마 철제 캐비닛', 'cabinet', '사물함'],
    ['가구느낌 너비조절 1단 렌지선반 400', 'microwave_rack', '전자레인지 수납장'],
    ['가구느낌 복 주방 수납장 1000', 'cabinet', '주방 수납장'],
    ['히트가구 F41110 수납 거실장 1200', 'tv_stand', 'TV 거실장'],
    ['히트가구 C746 시즌3 좌식화장대 485', 'vanity', '화장대'],
    ['가구느낌 홈접이식 사각 식탁 1200', 'table_4', '4인 식탁'],
    ['마켓비 IVOLV 460 커피 테이블', 'table_floor', '커피 테이블'],
    ['SMN 접이식 좌식 베드테이블', 'table_floor', '베드 테이블'],
    ['야마다 야마다 현관 신발장', 'shoe_rack', '신발장'],
    ['이케아 BARLAST 플로어스탠드', 'floor_lamp', '장스탠드'],
    ['양지가구 양발이 1단 선반 310', 'shelf', '선반'],
  ];
  for (const [name, key, label] of cases) {
    const spec = productToSpec(byName(name));
    assert.deepEqual([spec.key, spec.name], [key, label], name);
  }
  // 이케아(type 없음)는 분류의 기본 규칙
  const ikea = [['ikea-bed-tarva-120', 'bed_ss', '슈퍼싱글 침대'], ['ikea-bed-fagelfjallet-90', 'bed_single', '싱글 침대'], ['ikea-desk-lagkapten-120', 'desk_120', '책상'],
    ['ikea-chair-markus', 'chair', '의자'], ['ikea-wardrobe-kleppstad-117', 'wardrobe_120', '옷장'], ['ikea-drawer-gursken-3', 'dresser', '서랍장'],
    ['ikea-bookcase-billy-202', 'bookshelf', '책장'], ['ikea-bookcase-baggebo-80', 'bookshelf_low', '낮은 책장'], ['ikea-sofa-klippan-2', 'sofa_2', '2인 소파'],
    ['ikea-bedside-knarrevik', 'nightstand', '협탁']];
  for (const [id, key, label] of ikea) {
    const spec = productToSpec(byId(id));
    assert.deepEqual([spec.key, spec.name], [key, label], id);
  }
  // 치수·가격·검색어는 상품 값, 높이로 tall을 다시 정한다
  const helmer = productToSpec(byName('이케아 HELMER 6단 이동식 서랍장 280'));
  assert.deepEqual([helmer.w, helmer.d, helmer.h, helmer.price, helmer.tall, helmer.clear, helmer.category], [28, 44, 69, 49900, false, 45, 'storage']);
  assert.equal(helmer.query, '이케아 HELMER 6단 이동식 서랍장 280');
  assert.equal(helmer.product.id, 'dnw-851238');
  assert.equal(productToSpec(byName('삼익가구 PE폼 깔판 SS')).h, 2); // 1.8cm → 2
  assert.equal(productToSpec(byName('삼익가구 PE폼 깔판 SS')).product.h, 1.8);
  assert.equal(productToSpec(byName('일루일루 라이트 G-지타이탄 게이밍 의자')).tall, true); // 바탕 '의자'는 tall이 아니지만 높이가 120cm 이상
  assert.equal(productToSpec(byName('장인가구 로빈 데이베드 슬라이드 2단침대 SS')).tall, false); // 바탕 '벙커 침대'는 tall이지만 높이 80cm
  assert.equal(productToSpec(byName('홈잡스 단면 매트리스 일체형 침대 S')).sideOk, true);
  // 모션데스크: 높이 121cm(끝까지 올린 값)여도 75cm 책상으로 놓고 키 큰 가구로 보지 않는다. 조사한 높이는 product.h에 남는다
  const motion = productToSpec(byId('dnw-96424388'));
  assert.deepEqual([motion.key, motion.h, motion.tall, motion.product.h], ['desk_motion', 75, false, 121]);
  assert.equal(LIST.filter((p) => p.type === '모션데스크').length, 113);
  assert.ok(LIST.filter((p) => p.type === '모션데스크').every((p) => { const s = productToSpec(p); return !s.tall && s.h <= 75; }));
  // 소파 이름의 '○인용'
  const sofaNames = new Set(LIST.filter((p) => p.type === '소파').map((p) => productToSpec(p).name));
  assert.deepEqual([...sofaNames].sort(), ['1.5인 소파', '1인 소파', '2.5인 소파', '2인 소파', '3.5인 소파', '3인 소파', '4인 소파', '6인 소파']);
});

test('searchProducts: 낱말, 분류, 세부 분류', () => {
  const all = searchProducts(LIST);
  assert.equal(all.total, 10133 - 215); // 바닥을 차지하지 않는 것은 기본으로 뺀다
  assert.equal(all.items.length, 60);
  assert.equal(searchProducts(LIST, { includeFloorless: true }).total, 10133);
  assert.equal(searchProducts(LIST, { includeFloorless: true }).types.length, 92);

  const r = searchProducts(LIST, { q: '  이케아   서랍장 ' });
  assert.ok(r.total > 0);
  assert.ok(searchProducts(LIST, { q: '이케아 서랍장', limit: 500 }).items.every((p) => (p.src === 'ikea' || /이케아/.test(`${p.name} ${p.brand} ${p.type}`)) && /서랍장/.test(`${p.name} ${p.brand} ${p.type}`)));
  // 한글 '이케아'로도 이케아 공식 자료 26개가 나온다(brand는 'IKEA'). '이케아 공식'은 그 26개만
  const ikeaIn = (q) => searchProducts(LIST, { q, limit: 500 }).items.filter((p) => p.src === 'ikea').length;
  assert.deepEqual([ikeaIn('이케아'), ikeaIn('IKEA'), ikeaIn('ikea'), searchProducts(LIST, { q: '이케아 공식' }).total], [26, 26, 26, 26]);
  assert.equal(searchProducts(LIST, { q: '침대' }).total, searchProducts(LIST, { q: '침대' }).total); // 풀어쓴 한글(NFD)
  assert.equal(searchProducts([null, ...LIST.slice(0, 5), undefined]).total, searchProducts(LIST.slice(0, 5)).total); // 빈 칸이 섞여도 멈추지 않는다
  assert.ok(r.total < searchProducts(LIST, { q: '서랍장' }).total);
  assert.equal(searchProducts(LIST, { q: 'helmer' }).total, searchProducts(LIST, { q: 'HELMER' }).total); // 대소문자 무시
  assert.ok(searchProducts(LIST, { q: 'helmer' }).items.some((p) => p.id === 'dnw-851238'));
  assert.ok(searchProducts(LIST, { q: '모션데스크' }).total >= 113); // type 글자로도 찾는다
  assert.ok(searchProducts(LIST, { q: 'billy' }).items.some((p) => p.src === 'ikea'));
  // 특수문자는 글자 그대로 찾는다(정규식 아님)
  assert.equal(searchProducts(LIST, { q: '.*' }).total, 0);
  assert.equal(searchProducts(LIST, { q: '[' }).total, 0);
  assert.equal(searchProducts(LIST, { q: 'cd(dvd)장' }).total, 20);
  assert.equal(searchProducts(LIST, { q: '(' }).total, LIST.filter((p) => !p.floorless && `${p.name}${p.brand}${p.type}`.includes('(')).length);
  assert.equal(searchProducts(LIST, { q: null }).total, all.total);
  assert.equal(searchProducts(LIST, { q: '없는상품이름zzz' }).total, 0);
  assert.deepEqual(searchProducts(LIST, { q: '없는상품이름zzz' }), { total: 0, items: [], types: [] });

  const desk = searchProducts(LIST, { category: 'desk' });
  assert.equal(desk.total, 474);
  assert.ok(desk.items.every((p) => p.category === 'desk'));
  assert.deepEqual(desk.types, [{ type: '컴퓨터 책상', count: 251 }, { type: '모션데스크', count: 113 }, { type: '책상', count: 90 }, { type: '접이식책상', count: 15 }, { type: '일자형', count: 1 }]);
  const motion = searchProducts(LIST, { category: 'desk', type: '모션데스크' });
  assert.equal(motion.total, 113);
  assert.ok(motion.items.every((p) => p.type === '모션데스크'));
  assert.deepEqual(motion.types, desk.types); // 세부 분류를 골라도 다른 세부 분류를 계속 고를 수 있다
  assert.equal(searchProducts(LIST, { category: 'lamp' }).total, 70);
  assert.equal(searchProducts(LIST, { category: 'lamp', includeFloorless: true }).total, 135);
  assert.equal(searchProducts(LIST, { category: 'constructor' }).total, 0);
  assert.deepEqual(searchProducts(null, {}), { total: 0, items: [], types: [] });
});

test('searchProducts: 방에 들어가는 것만(fit), 가격 상한', () => {
  const fit = searchProducts(LIST, { fit: { width: 250, depth: 180 }, limit: 500 });
  assert.ok(fit.total > 0 && fit.total < searchProducts(LIST).total);
  const fits = (p) => Math.max(p.w, p.d) <= 250 && Math.min(p.w, p.d) <= 180;
  assert.equal(fit.total, LIST.filter((p) => !p.floorless && fits(p)).length);
  assert.ok(fit.items.every(fits));
  assert.equal(searchProducts(LIST, { fit: { width: 180, depth: 250 } }).total, fit.total); // 방의 긴 변·짧은 변으로 본다
  assert.equal(searchProducts(LIST, { category: 'bed', fit: { width: 150, depth: 150 } }).total, 0); // 침대 길이는 164cm 이상
  assert.equal(searchProducts(LIST, { fit: null }).total, searchProducts(LIST).total);
  const cheap = searchProducts(LIST, { category: 'bed', maxPrice: 100000, limit: 500 });
  assert.ok(cheap.total > 0 && cheap.items.every((p) => p.price <= 100000));
  assert.equal(cheap.total, LIST.filter((p) => p.category === 'bed' && p.price <= 100000).length);
});

test('searchProducts: 정렬, offset·limit', () => {
  const get = (opts) => searchProducts(LIST, { category: 'desk', limit: 500, ...opts }).items;
  const sorted = (arr, f) => arr.every((p, i) => i === 0 || f(arr[i - 1]) <= f(p));
  assert.ok(sorted(get({}), (p) => -p.shops)); // 기본: 판매처 많은 순
  assert.ok(sorted(get({ sort: 'popular' }), (p) => -p.shops));
  assert.deepEqual(get({ sort: '없는 정렬' }), get({}));
  assert.deepEqual(get({ sort: 'constructor' }), get({}));
  assert.ok(sorted(get({ sort: 'price' }), (p) => p.price));
  assert.ok(sorted(get({ sort: 'price-desc' }), (p) => -p.price));
  assert.ok(sorted(get({ sort: 'small' }), (p) => p.w * p.d));
  const near = get({ sort: 'near', near: { w: 120, d: 60 } });
  assert.ok(sorted(near, (p) => Math.abs(p.w - 120) + Math.abs(p.d - 60)));
  assert.deepEqual([near[0].w, near[0].d], [120, 60]);
  assert.deepEqual(get({ sort: 'near' }), get({})); // 기준이 없으면 기본 정렬
  const nearAll = (list) => searchProducts(list, { sort: 'near', near: { w: 120, d: 60 }, limit: 99999 }).items.map((p) => p.id);
  assert.deepEqual(nearAll([...LIST].reverse()), nearAll(LIST)); // 넣는 순서가 달라도 같은 순서
  assert.equal(get({}).length, 474);
  assert.equal(get({ sort: 'price' }).length, 474);

  const page = (offset, limit) => searchProducts(LIST, { category: 'desk', sort: 'price', offset, limit });
  const whole = get({ sort: 'price' });
  assert.deepEqual(page(0).items, whole.slice(0, 60));
  assert.deepEqual(page(60).items, whole.slice(60, 120));
  assert.deepEqual(page(470, 60).items, whole.slice(470));
  assert.deepEqual(page(5, 3).items, whole.slice(5, 8));
  assert.deepEqual(page(9999).items, []);
  assert.equal(page(9999).total, 474);
  assert.deepEqual(page(-5, 0).items, whole.slice(0, 1)); // 틀린 값은 가까운 값으로
  assert.deepEqual(page('x', NaN).items, whole.slice(0, 60));
  // 목록을 바꾸지 않는다
  const first = LIST[0], last = LIST[LIST.length - 1];
  searchProducts(LIST, { sort: 'price' });
  assert.ok(LIST[0] === first && LIST[LIST.length - 1] === last);
  // 복사한 상품(검색용 글이 없는 것)도 찾는다
  assert.equal(searchProducts(LIST.slice(0, 50).map((p) => ({ ...p })), { q: p0word() }).total, searchProducts(LIST.slice(0, 50), { q: p0word() }).total);
  function p0word() { return LIST[0].name.split(' ')[0]; }
});

test('searchProducts: 1만 개에서 20ms 안쪽', () => {
  const time = (opts) => {
    let best = Infinity;
    for (let i = 0; i < 12; i++) {
      const t = performance.now();
      searchProducts(LIST, opts);
      best = Math.min(best, performance.now() - t);
    }
    return best; // 다른 일로 느려진 때를 빼려고 가장 빠른 값을 본다
  };
  for (const opts of [{}, { q: '원목 침대' }, { includeFloorless: true, sort: 'price' }, { fit: { width: 300, depth: 400 }, sort: 'near', near: { w: 120, d: 60 } }]) {
    const ms = time(opts);
    assert.ok(ms < 20, `${JSON.stringify(opts)}: ${ms.toFixed(1)}ms`);
  }
});

test('productIn: 저장값을 믿지 않는다', () => {
  const good = productToSpec(byName('이케아 HELMER 6단 이동식 서랍장 280')).product;
  assert.deepEqual(productIn(good), good);
  assert.deepEqual(productIn({ ...good, extra: 1, floorless: true }), good); // 정해진 값만 남긴다
  const ikea = productToSpec(byId('ikea-bed-tarva-120')).product;
  assert.deepEqual(productIn(ikea), ikea);

  for (const bad of [null, undefined, 'x', 3, []]) assert.equal(productIn(bad), null);
  // 나쁜 주소
  for (const url of [
    'http://prod.danawa.com/info/?pcode=851238', 'https://evil.example/', 'https://prod.danawa.com.evil.example/info', 'https://evil.example/prod.danawa.com',
    'https://user@prod.danawa.com/info', 'https://prod.danawa.com:8443/info', 'javascript:alert(1)', '//prod.danawa.com/info', 'prod.danawa.com/info', '', null, 42,
    'https://www.ikea.com/kr/ko/p/x', // 다나와 상품인데 이케아 주소
    `https://prod.danawa.com/${'a'.repeat(400)}`,
  ]) assert.equal(productIn({ ...good, url }), null, String(url));
  assert.equal(productIn({ ...ikea, url: good.url }), null);
  assert.equal(productIn({ ...good, src: 'naver' }), null);
  assert.equal(productIn({ ...good, src: 'ikea' }), null); // 번호와 출처가 맞지 않는다
  assert.equal(productIn({ ...good, id: 'dnw-<script>' }), null);
  assert.equal(productIn({ ...good, id: 851238 }), null);
  // 나쁜 사진 주소는 사진만 뺀다(가구 그림으로 대신한다)
  for (const image of ['http://img.danuri.io/a.jpg', 'https://evil.example/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', null, 7]) {
    assert.equal(productIn({ ...good, image }).image, '', String(image));
  }
  assert.equal(productIn({ ...good, image: '//img.danawa.com/prod_img/a.jpg' }).image, 'https://img.danawa.com/prod_img/a.jpg');
  assert.equal(productIn({ ...good, image: 'https://img.danuri.io/a.jpg' }).image, 'https://img.danuri.io/a.jpg');
  // 꺾쇠·제어 문자, 길이
  const dirty = productIn({ ...good, name: '<img src=x onerror=alert(1)>서랍장\u0000 <b>280</b>', brand: '이케아<script>', note: 'a\nb', type: '<i>책상서랍장</i>', warn: '<b>' });
  assert.deepEqual([dirty.name, dirty.brand, dirty.note, dirty.type, dirty.warn], ['서랍장 280', '이케아', 'a b', '책상서랍장', '']);
  assert.equal(productIn({ ...good, name: '2 < 3 > 1' }).name, '2 3 1');
  assert.equal([...productIn({ ...good, name: '가'.repeat(200), brand: '나'.repeat(200), note: '다'.repeat(200) }).name].length, 80);
  assert.equal([...productIn({ ...good, brand: '나'.repeat(200) }).brand].length, 30);
  assert.equal(productIn({ ...good, name: '<>' }), null);
  assert.equal(productIn({ ...good, name: 5 }).name, '5');
  // 범위 밖 숫자는 고치지 않고 거절한다
  for (const patch of [{ w: 9 }, { w: 401 }, { d: 0 }, { d: 400.1 }, { h: 0.9 }, { h: 301 }, { w: '28' }, { h: NaN }, { d: Infinity }, { w: null },
    { price: 0 }, { price: -1 }, { price: 50_000_001 }, { price: '49900' }, { price: NaN }]) {
    assert.equal(productIn({ ...good, ...patch }), null, JSON.stringify(patch));
  }
  assert.equal(productIn({ ...good, w: 10, d: 400, h: 1, price: 50_000_000 }).w, 10);
  assert.equal(productIn({ ...good, price: 49900.4 }).price, 49900);
  assert.equal(productIn({ ...good, price: 0.4 }), null); // 반올림하면 0원
});

test('productCategoryOf: 앱 가구에 맞는 파트너 분류', () => {
  const expect = {
    bed_single: 'bed', bed_ss: 'bed', bed_double: 'bed', bed_queen: 'bed', bed_king: 'bed', bed_mattress: 'bed', bed_bunk: 'bed',
    desk_100: 'desk', desk_120: 'desk', desk_140: 'desk', desk_160: 'desk', desk_computer: 'desk', desk_motion: 'desk', chair: 'chair',
    wardrobe_80: 'wardrobe', wardrobe_100: 'wardrobe', wardrobe_120: 'wardrobe', hanger: 'hanger', dresser: 'drawer', bookshelf: 'bookcase',
    bookshelf_low: 'bookcase', cabinet: 'cabinet', shelf: 'shelf', shoe_rack: 'shoerack', tv_stand: 'tvstand', microwave_rack: 'kitchen',
    nightstand: 'bedside', vanity: 'vanity', mirror: null,
    sofa_2: 'sofa', sofa_1: 'sofa', sofa_3: 'sofa', sofa_bed: 'sofa', recliner: 'sofa', beanbag: 'chair',
    table_2: 'diningtable', table_4: 'diningtable', table_floor: 'table',
    fridge: null, fridge_mini: null, washer: null, air_purifier: null, tv: null,
    rug: null, floor_lamp: 'lamp', plant: null, cat_tower: null, drying_rack: null, piano: null, piano_digital: null,
  };
  assert.deepEqual(Object.keys(expect).sort(), Object.keys(CATALOG).sort()); // CATALOG 키를 빠짐없이 본다
  const cats = new Set(PRODUCT_CATEGORIES.map((c) => c.key));
  for (const [key, cat] of Object.entries(expect)) {
    assert.equal(productCategoryOf(CATALOG[key]), cat, key);
    if (cat) assert.ok(cats.has(cat) && searchProducts(LIST, { category: cat }).total > 0, key);
  }
  for (const spec of [null, undefined, {}, { key: 5 }, { key: 'custom:안마의자' }, { key: 'constructor' }, { key: '__proto__' }, { key: 'toString_x' }]) {
    assert.equal(productCategoryOf(spec), null);
  }
  // 상품에서 만든 가구는 자기 분류나 가까운 분류로 돌아간다
  assert.equal(productCategoryOf(productToSpec(byId('ikea-bed-tarva-120'))), 'bed');
});

test('가격 문구와 분류 목록', () => {
  assert.deepEqual(Object.keys(PRODUCT_SOURCES), ['danawa', 'ikea']);
  assert.equal(PRODUCT_SOURCES.danawa.label, '다나와 최저가');
  assert.equal(PRODUCT_SOURCES.ikea.label, '이케아 공식가');
  assert.match(PRODUCT_SOURCES.danawa.note, /^다나와 최저가 · 2026년 11월 17일 조사 · 배송비 제외 · 가장 싼 옵션 기준/);
  assert.match(PRODUCT_SOURCES.ikea.note, /^이케아 공식가 · 2026년 11월 조사/);
  for (const s of Object.values(PRODUCT_SOURCES)) assert.match(s.note, /실제 가격과 다를 수 있어요/);
  assert.equal(PRODUCT_CATEGORIES.length, 19);
  assert.deepEqual(PRODUCT_CATEGORIES.map((c) => c.key).sort(), [...new Set(RAW.items.map((r) => r.category))].sort());
  assert.ok(PRODUCT_CATEGORIES.every((c) => /[가-힣]/.test(c.label)));
  assert.deepEqual(PRODUCT_CATEGORIES.slice(0, 4).map((c) => c.label), ['침대', '책상', '의자', '옷장']);
});

test('loadProducts: 한 번만 받아 기억하고, 실패하면 다시 시도할 수 있다', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0, fail = true;
  globalThis.fetch = async (url) => {
    calls++;
    if (fail) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => (String(url).endsWith('/data/catalog.json') ? { items: RAW.items.slice(0, 30) } : IKEA) };
  };
  try {
    await assert.rejects(loadProducts(), { message: '상품 목록을 불러오지 못했어요' });
    assert.equal(calls, 2);
    fail = false;
    const a = loadProducts(), b = loadProducts(); // 실패한 뒤에는 다시 받는다
    assert.equal(a, b);
    const list = await a;
    assert.equal(list.length, 30 + 26);
    assert.equal(await loadProducts(), list);
    assert.equal(calls, 4); // catalog + ikea를 한 번씩만 더 받았다
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('loadProducts: 자료가 하나만 있어도 그것으로 보여 준다(공개 배포본에는 다나와 자료가 없다)', async () => {
  const { loadProducts: load } = await import(`./products.js?only-ikea=${Date.now()}`); // 기억해 둔 목록이 없는 새 모듈
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url).endsWith('/data/ikea.json') ? { ok: true, json: async () => IKEA } : { ok: false, json: async () => ({}) });
  try {
    const list = await load();
    assert.equal(list.length, 26);
    assert.ok(list.every((p) => p.src === 'ikea'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
