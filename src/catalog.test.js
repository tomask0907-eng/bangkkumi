import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG, STYLE_PRESETS, EXAMPLE, parseFurnitureText, defaultSpec, validateSpec, validateStyle,
  matchStyle, nearestStyle, priceOf, won, josa, cleanName,
} from './catalog.js';

const parse = (t) => parseFurnitureText(t);
const keys = (t) => parse(t).specs.map((s) => s.key);
const SPEC_FIELDS = ['key', 'name', 'category', 'w', 'd', 'h', 'clear', 'tall', 'sideOk', 'floor', 'price', 'color', 'query', 'source'];
const CTRL = String.fromCharCode(0, 7, 27); // 제어 문자 (파일에 직접 적지 않으려고 코드로 만든다)

test('카탈로그: 35종 이상이고 모든 항목이 규약 범위 안이다', () => {
  const all = Object.values(CATALOG);
  assert.ok(all.length >= 35, `${all.length}종`);
  for (const c of all) {
    const v = validateSpec(c);
    for (const k of SPEC_FIELDS) assert.equal(v[k], c[k], `${c.key}.${k}`);
    assert.ok(c.price > 0 && c.query && /^#[0-9a-f]{6}$/.test(c.color), c.key);
    assert.equal(c.source, 'catalog');
  }
  assert.equal(CATALOG.rug.floor, true);
  assert.ok(CATALOG.wardrobe_100.tall && CATALOG.bed_ss.sideOk);
});

test('카탈로그: 제품 이름을 그대로 적으면 그 제품으로 읽힌다', () => {
  for (const c of Object.values(CATALOG)) {
    const r = parse(c.name);
    assert.deepEqual([r.specs.map((s) => s.key), r.unknown], [[c.key], []], c.name);
    assert.equal(r.specs[0].w, c.w, c.name);
  }
});

test('글 해석: 규약의 예시', () => {
  const r = parse('슈퍼싱글 침대, 책상 1400, 옷장 2개, 전자피아노');
  assert.deepEqual(r.specs.map((s) => s.key), ['bed_ss', 'desk_140', 'wardrobe_100', 'wardrobe_100', 'piano_digital']);
  assert.deepEqual(r.unknown, []);
  assert.equal(r.specs[1].w, 140);
  // 같은 가구 두 개는 서로 다른 객체이고 이름으로 구분된다
  assert.notEqual(r.specs[2], r.specs[3]);
  assert.deepEqual([r.specs[2].name, r.specs[3].name], ['옷장 1000', '옷장 1000 (2)']);
  for (const s of r.specs) assert.deepEqual(Object.keys(s), SPEC_FIELDS);
});

test('글 해석: 구분 기호와 조사', () => {
  assert.deepEqual(keys('침대\n책상; 옷장 / 책장'), ['bed_ss', 'desk_120', 'wardrobe_100', 'bookshelf']);
  assert.deepEqual(keys('침대와 책상과 의자'), ['bed_ss', 'desk_120', 'chair']);
  assert.deepEqual(keys('침대랑 책상이랑 옷장 하고 책장'), ['bed_ss', 'desk_120', 'wardrobe_100', 'bookshelf']);
  assert.deepEqual(keys('침대 책상 1400 옷장 2개'), ['bed_ss', 'desk_140', 'wardrobe_100', 'wardrobe_100']);
});

test('글 해석: 개수', () => {
  assert.equal(keys('의자x2').length, 2);
  assert.equal(keys('의자 × 3').length, 3);
  assert.equal(keys('의자 두 개').length, 2);
  assert.equal(keys('냉장고 1대').length, 1);
  assert.equal(keys('화분 3').length, 3);
  assert.deepEqual(keys('책상 1400 2개'), ['desk_140', 'desk_140']);
});

test('글 해석: 크기 숫자가 카탈로그 폭(과 깊이)을 바꾼다', () => {
  const one = (t) => parse(t).specs[0];
  assert.deepEqual([one('책상 1400').key, one('책상 1400').w], ['desk_140', 140]);
  assert.deepEqual([one('140cm 책상').key, one('140cm 책상').w], ['desk_140', 140]);
  assert.deepEqual([one('책상 1.4m').w, one('1400mm 책상').w], [140, 140]);
  const box = one('1200×600 책상');
  assert.deepEqual([box.key, box.w, box.d], ['desk_120', 120, 60]);
  const odd = one('책상 1300x700');
  assert.deepEqual([odd.name, odd.w, odd.d, odd.source], ['책상 1300', 130, 70, 'catalog']);
  assert.ok(odd.price > CATALOG.desk_120.price && odd.price < CATALOG.desk_140.price);
  assert.equal(one('옷장 800').key, 'wardrobe_80');
  assert.deepEqual([one('러그 200x300').w, one('러그 200x300').d], [200, 300]);
  assert.equal(one('높이 200 책장').h, 200);
  assert.equal(one('책상 9999').w, 400); // 범위를 넘으면 잘라 낸다
});

test('글 해석: 침대 크기 낱말', () => {
  assert.deepEqual(keys('퀸 침대, SS 침대, 싱글침대, 더블 침대, 침대 퀸, 킹사이즈 침대, 슈퍼 싱글'),
    ['bed_queen', 'bed_ss', 'bed_single', 'bed_double', 'bed_queen', 'bed_king', 'bed_ss']);
  const m = parse('퀸 매트리스').specs[0];
  assert.deepEqual([m.key, m.w], ['bed_mattress', 150]);
  assert.deepEqual(keys('매트리스만'), ['bed_mattress']);
});

test('글 해석: 오타, 띄어쓰기, 영어, 꾸밈말', () => {
  assert.deepEqual(keys('쇼파, 메트리스, 티비장, 전자렌지, 헹거'), ['sofa_2', 'bed_mattress', 'tv_stand', 'microwave_rack', 'hanger']);
  assert.deepEqual(keys('desk, Queen Bed, sofa, bookshelf'), ['desk_120', 'bed_queen', 'sofa_2', 'bookshelf']);
  assert.deepEqual(keys('흰색 원목 서랍장, 접이식 좌식 테이블, 1인용 소파, 4인 식탁, 3단 책장, 43인치 TV'),
    ['dresser', 'table_floor', 'sofa_1', 'table_4', 'bookshelf_low', 'tv']);
  assert.deepEqual(keys('컴퓨터 책상, 게이밍 책상 1600, 디지털 피아노, 소파베드'), ['desk_computer', 'desk_computer', 'piano_digital', 'sofa_bed']);
});

test('글 해석: 모르는 가구는 다듬은 이름으로 unknown에', () => {
  const r = parse('안마의자, 스타일러 2개, 드럼세트 150x120, 스탠드 에어컨, 더블 행거');
  assert.deepEqual(r.specs, []);
  assert.deepEqual(r.unknown, ['안마의자', '스타일러', '스타일러', '드럼세트', '스탠드 에어컨', '더블 행거']);
  const dirty = parse(`침대, <b>이상한${CTRL}것</b>`);
  assert.deepEqual(dirty.specs.map((s) => s.key), ['bed_ss']);
  assert.ok(dirty.unknown.length > 0);
  for (const u of dirty.unknown) assert.ok(![...u].some((c) => c === '<' || c === '>' || c.charCodeAt(0) < 32), JSON.stringify(u));
  assert.deepEqual(parse(''), { specs: [], unknown: [], truncated: false });
  assert.deepEqual(parse(null), { specs: [], unknown: [], truncated: false });
  assert.deepEqual(parse(' , ,, 1400, ㅋㅋ'), { specs: [], unknown: [], truncated: false });
});

test('글 해석: 같은 가구를 가리키는 두 낱말은 한 개다(개수·가격이 두 배가 되지 않는다)', () => {
  for (const t of ['통돌이 세탁기', '몬스테라 화분', '행거 옷걸이', '장스탠드 조명', '카우치 소파', '매트리스 토퍼', '스틸랙 선반',
    'tv장 거실장', '스탠드 행거 옷걸이', '전자레인지 수납장 레인지대', '벙커 침대 슈퍼싱글', '전동 모션 데스크 1200']) {
    const r = parse(t);
    assert.deepEqual([r.specs.length, r.unknown], [1, []], t);
  }
  assert.deepEqual(keys('침대, 책상, 통돌이 세탁기'), ['bed_ss', 'desk_120', 'washer']);
  // 같은 낱말을 두 번 적거나 크기가 다르면 두 개다
  assert.deepEqual(keys('책상 1200 책상 1400'), ['desk_120', 'desk_140']);
  assert.deepEqual(keys('의자 의자'), ['chair', 'chair']);
  assert.deepEqual(keys('책상 의자'), ['desk_120', 'chair']);
});

test('글 해석: 침대와 매트리스를 함께 적으면 저상 매트리스가 아니라 침대다', () => {
  assert.deepEqual(keys('침대 매트리스'), ['bed_ss']);
  assert.deepEqual(keys('퀸 침대 매트리스 세트'), ['bed_queen']);
  assert.deepEqual([keys('슈퍼싱글 침대(매트리스 포함)'), parse('슈퍼싱글 침대(매트리스 포함)').unknown], [['bed_ss'], []]);
  for (const c of Object.values(CATALOG).filter((x) => x.group === 'bed')) assert.deepEqual(keys(c.query), [c.key], c.query);
  assert.deepEqual(keys('매트리스, 저상 침대 매트리스, 침대 프레임, 매트리스'), ['bed_mattress', 'bed_mattress', 'bed_ss', 'bed_mattress']);
  assert.deepEqual(keys('소파 침대'), ['sofa_bed']);
});

test('글 해석: 말끝·조사·가격은 가구가 되지 않는다', () => {
  const both = (t) => [keys(t), parse(t).unknown];
  assert.deepEqual(both('침대 큰 거'), [['bed_ss'], []]);
  assert.deepEqual(both('침대 하나, 책상 하나 필요'), [['bed_ss', 'desk_120'], []]);
  assert.deepEqual(both('침대, 책상, 의자 있음'), [['bed_ss', 'desk_120', 'chair'], []]);
  assert.deepEqual(both('침대랑 책상이 필요해요'), [['bed_ss', 'desk_120'], []]);
  assert.deepEqual(both('침대요, 책상도, 의자가 있어요'), [['bed_ss', 'desk_120', 'chair'], []]);
  assert.deepEqual(both('침대 1개씩'), [['bed_ss'], []]);
  assert.deepEqual(both('침대 30만원, 책상 120,000원, 5만원짜리 의자'), [['bed_ss', 'desk_120', 'chair'], []]);
  assert.equal(parse('침대 30만원').specs[0].w, CATALOG.bed_ss.w); // 가격 숫자를 크기로 읽지 않는다
  assert.deepEqual(both('침대, 필요해요, 이거, 큰 거, 1.'), [['bed_ss'], []]); // 말끝·숫자만 있는 글은 버린다
  assert.deepEqual([parse('책상 1,400').specs.map((s) => s.w), parse('침대 30만').specs.map((s) => s.w)], [[140], [CATALOG.bed_ss.w]]);
  assert.equal(parse('120 원목 책상').specs[0].key, 'desk_120'); // '원목'의 '원'은 가격이 아니다
  // 다른 가구 이름이 붙어 있으면 여전히 모르는 가구다
  assert.deepEqual(both('책상의자, 안마의자, 컴퓨터, 이젤, 가습기'), [[], ['책상의자', '안마의자', '컴퓨터', '이젤', '가습기']]);
});

test('글 해석: 한 자리 숫자 + m·미터도 크기다', () => {
  const one = (t) => { const r = parse(t); assert.deepEqual([r.specs.length, r.unknown], [1, []], t); return r.specs[0]; };
  assert.deepEqual([one('책상 2m').w, one('2m 책상').w, one('소파 2미터').w, one('책상 1m').key], [200, 200, 200, 'desk_100']);
  assert.equal(one('옷장 높이 2m').h, 200);
  assert.deepEqual([one('러그 2m x 3m').w, one('러그 2m x 3m').d], [200, 300]);
  assert.deepEqual([one('러그 2x3m').w, one('러그 2x3m').d], [200, 300]);
  // 침대의 2m는 폭이 아니라 길이다
  assert.deepEqual([one('침대 2m').key, one('침대 2m').w, one('침대 2m').d], ['bed_ss', 110, 200]);
  assert.deepEqual([one('침대 2000x1100').w, one('침대 2000x1100').d], [110, 200]);
  assert.equal(one('킹 침대 1800').w, 180);
  assert.equal(keys('화분 3').length, 3); // 단위 없는 한 자리 숫자는 그대로 개수
});

test('글 해석: 번호·글머리표 목록과 이름에 붙여 쓴 개수', () => {
  const both = (t) => [keys(t), parse(t).unknown];
  const three = [['bed_ss', 'desk_120', 'wardrobe_100'], []];
  assert.deepEqual(both('1. 침대\n2. 책상\n3. 옷장'), three);
  assert.deepEqual(both('1) 침대\n2) 책상\n3) 옷장'), three);
  assert.deepEqual(both('* 침대\n* 책상\n* 옷장'), three);
  assert.deepEqual(both('- 침대\n- 책상\n- 옷장'), three);
  assert.deepEqual(both('1.침대 2.책상 3.옷장'), three);
  assert.deepEqual(both('10. 침대'), [['bed_ss'], []]);
  assert.equal(parse('10. 침대').specs[0].w, CATALOG.bed_ss.w);
  assert.equal(parse('1.2m 책상').specs[0].w, 120); // 소수는 번호가 아니다
  assert.deepEqual(both('침대1, 책상1, 의자2'), [['bed_ss', 'desk_120', 'chair', 'chair'], []]);
  assert.deepEqual(both('책상:1400, 의자:2'), [['desk_140', 'chair', 'chair'], []]);
  assert.deepEqual(both('싱글침대1 책상1 의자1'), [['bed_single', 'desk_120', 'chair'], []]);
  assert.deepEqual(both('플스5'), [[], ['플스5']]); // 모르는 이름의 숫자는 개수로 보지 않는다
});

test('글 해석: 모두 합쳐 15개까지', () => {
  const r = parse('의자 20개, 침대');
  assert.equal(r.specs.length + r.unknown.length, 15);
  assert.equal(r.truncated, true);
  const many = parse(Array.from({ length: 30 }, (_, i) => `이상한물건${i}`).join(','));
  assert.equal(many.unknown.length, 15);
});

test('defaultSpec: 임시 사양은 source가 default이고, 아는 낱말이 있으면 그 크기를 빌린다', () => {
  const d = defaultSpec('드럼세트');
  assert.deepEqual([d.key, d.name, d.source, d.category], ['custom:드럼세트', '드럼세트', 'default', 'etc']);
  const c = defaultSpec('안마의자');
  assert.deepEqual([c.category, c.w, c.source, c.key], ['seating', CATALOG.chair.w, 'default', 'custom:안마의자']);
  assert.deepEqual(Object.keys(c), SPEC_FIELDS);
  assert.ok(defaultSpec('<>').name); // 이름을 못 쓰게 돼도 사양은 나온다
});

test('validateSpec: 범위를 맞추고, 규약에 없는 값은 버리고, 못 쓰는 값은 거절한다', () => {
  const v = validateSpec({
    name: '  <b>안마\n의자</b> ', category: 'robot', w: 999, d: 3, h: 500, clear: 999, price: -5, tall: 'yes',
    color: 'red', query: 'x'.repeat(99), source: 'me', key: '__proto__', uid: 'u1', x: 5, evil: '<script>',
  });
  assert.deepEqual(v, {
    key: 'custom:b 안마 의자 /b', name: 'b 안마 의자 /b', category: 'etc', w: 400, d: 10, h: 300, clear: 150,
    tall: true, sideOk: false, floor: false, price: 0, color: '#aaa39a', query: 'x'.repeat(40), source: 'ai',
  });
  assert.equal(validateSpec({ name: '가'.repeat(50), w: 50, d: 50, h: 50 }).name.length, 30);
  assert.equal(validateSpec({ name: `책${CTRL}상`, w: 50, d: 50, h: 50 }).name, '책 상');
  assert.equal(validateSpec({ name: '책상', w: 120, d: 60, h: 73, key: 'desk_120' }).key, 'desk_120');
  assert.equal(validateSpec({ name: '낮은 것', w: 50, d: 50, h: 50 }).tall, false);
  for (const bad of [null, 'x', {}, { name: '', w: 1, d: 1, h: 1 }, { name: 'a', w: '120', d: 60, h: 70 },
    { name: 'a', w: NaN, d: 60, h: 70 }, { name: 'a', w: 0, d: 60, h: 70 }, { name: 'a', w: 50, d: 60 }, { name: '<>', w: 5, d: 5, h: 5 }]) {
    assert.equal(validateSpec(bad), null, JSON.stringify(bad));
  }
});

// WCAG 명도 대비(1~21). 벽·바닥·가구가 서로 구분되는지 본다.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('스타일 프리셋: 10종 이상, 규약 모양, 벽·바닥·가구가 구분되는 5색', () => {
  const all = Object.values(STYLE_PRESETS);
  assert.ok(all.length >= 10, `${all.length}종`);
  for (const s of all) {
    assert.deepEqual(validateStyle(s), s, s.key);
    assert.equal(s.source, 'preset');
    assert.deepEqual(s.palette.map((p) => p.role), ['벽', '바닥', '메인 가구', '패브릭', '포인트']);
    assert.equal(s.props.length, 5);
    for (const p of s.props) assert.ok(p.name && p.query && p.price >= 5000 && p.price <= 300000, `${s.key} ${p.name}`);
    assert.ok(s.mood.endsWith('요.') && s.materials, s.key);
    const [wall, floor, main, , point] = s.palette.map((p) => p.hex);
    assert.equal(new Set(s.palette.map((p) => p.hex)).size, 5, s.key);
    assert.ok(contrast(wall, floor) >= 1.15, `${s.key} 벽/바닥 ${contrast(wall, floor).toFixed(2)}`);
    assert.ok(contrast(floor, main) >= 1.4, `${s.key} 바닥/가구 ${contrast(floor, main).toFixed(2)}`);
    assert.ok(contrast(wall, main) >= 1.6, `${s.key} 벽/가구 ${contrast(wall, main).toFixed(2)}`);
    assert.ok(contrast(wall, point) >= 1.8, `${s.key} 벽/포인트 ${contrast(wall, point).toFixed(2)}`);
  }
});

test('matchStyle: 같은 뜻의 말은 프리셋으로, 다른 말이 섞이면 null', () => {
  const k = (t) => matchStyle(t)?.key ?? null;
  assert.deepEqual(['미니멀', '노르딕', '스칸디 스타일', '젠', 'Japandi', '우드톤', '화이트&우드', '화이트 앤 우드', '미드센추리 모던',
    '다크 모던', '북유럽풍 인테리어', '미니멀한 느낌', '호텔식', '러블리 파스텔', '인더스트리얼', '빈티지', '내추럴', '모던'].map(k),
  ['minimal', 'nordic', 'nordic', 'japandi', 'japandi', 'natural', 'whitewood', 'whitewood', 'midcentury',
    'dark', 'nordic', 'minimal', 'hotel', 'pastel', 'industrial', 'vintage', 'natural', 'modern']);
  assert.deepEqual(['제주 감성 우드 앤 화이트', '힙한 성수동 카페', '', null, '모던 미니멀'].map(k), [null, null, null, null, null]);
});

test('nearestStyle: 항상 프리셋 하나를 준다', () => {
  assert.equal(nearestStyle('제주 감성 우드 앤 화이트').key, 'whitewood');
  assert.equal(nearestStyle('미드센추리 모던 느낌으로').key, 'midcentury');
  assert.equal(nearestStyle('아무 말').key, 'minimal');
});

test('validateStyle: 5색·hex·소품을 검사하고 규약에 없는 값은 버린다', () => {
  const ok = {
    name: '제주 <감성>', priceRate: 9, key: 'x', extra: 1, source: 'nope',
    palette: ['#FFFFFF', '#eeeeee', '#333333', '#cccccc', '#ff0000'].map((hex, i) => ({ name: `색${i}`, hex, role: 'x' })),
    materials: '돌, 나무', mood: '바람이 느껴져요.',
    props: [{ name: '현무암 화분', price: 12000.4, query: '' }, { name: '', price: 1 }, { name: '라탄 등', price: 1e12 }, { name: '귤 바구니' }, null],
  };
  const v = validateStyle(ok);
  assert.deepEqual(Object.keys(v), ['key', 'name', 'priceRate', 'palette', 'materials', 'mood', 'props', 'source']);
  assert.deepEqual([v.key, v.name, v.priceRate, v.source], ['custom:제주 감성', '제주 감성', 1.5, 'ai']);
  assert.deepEqual(v.palette[0], { role: '벽', name: '색0', hex: '#ffffff' });
  assert.deepEqual(v.props, [{ name: '현무암 화분', price: 12000, query: '현무암 화분' },
    { name: '라탄 등', price: 5000000, query: '라탄 등' }, { name: '귤 바구니', price: 0, query: '귤 바구니' }]);
  assert.equal(validateStyle({ ...ok, palette: ok.palette.slice(0, 4) }), null);
  assert.equal(validateStyle({ ...ok, palette: [...ok.palette, ok.palette[0]] }), null);
  assert.equal(validateStyle({ ...ok, palette: ok.palette.map((p) => ({ ...p, hex: 'red' })) }), null);
  assert.equal(validateStyle({ ...ok, props: ok.props.slice(0, 2) }), null);
  assert.equal(validateStyle({ ...ok, name: '' }), null);
  assert.equal(validateStyle(null), null);
});

test('가격·글 도구', () => {
  assert.equal(priceOf(CATALOG.desk_120, STYLE_PRESETS.hotel), 126000);
  assert.equal(priceOf({ price: 1499 }, { priceRate: 1 }), 1000);
  assert.equal(priceOf(CATALOG.desk_120), 90000);
  assert.equal(won(1234567), '1,234,567원');
  assert.deepEqual([josa('책상', '을/를'), josa('의자', '을/를'), josa('책상 1200', '을/를'), josa('옷장 1000 (2)', '을/를'),
    josa('서랍', '으로/로'), josa('책상', '으로/로'), josa('TV', '이/가')], ['책상을', '의자를', '책상 1200을', '옷장 1000 (2)를', '서랍으로', '책상으로', 'TV가']);
  assert.equal(josa('거울', '으로/로'), '거울로');
  assert.equal(cleanName(`  a${CTRL}<b>\n c  `, 5), 'a b c');
});

test('EXAMPLE: 3m × 4m, 100만원, 가구 4개가 모두 카탈로그로 읽힌다', () => {
  assert.deepEqual([EXAMPLE.room.width, EXAMPLE.room.depth, EXAMPLE.budget, EXAMPLE.styleKey], [300, 400, 1000000, 'minimal']);
  assert.deepEqual(EXAMPLE.room.doors, [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }]);
  assert.deepEqual(EXAMPLE.room.windows[0], { wall: 'top', offset: 50, size: 100, sill: 90, height: 120 });
  assert.ok(STYLE_PRESETS[EXAMPLE.styleKey]);
  const r = parse(EXAMPLE.furnitureText);
  assert.deepEqual([r.specs.map((s) => s.key), r.unknown], [['bed_ss', 'desk_120', 'wardrobe_100', 'bookshelf'], []]);
  const total = r.specs.reduce((sum, s) => sum + priceOf(s, STYLE_PRESETS.minimal), 0);
  assert.ok(total <= EXAMPLE.budget, `합계 ${total}`);
});
