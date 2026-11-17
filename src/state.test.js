// 화면 상태 도구 시험: 가구 글 해석 합치기, 가격 우선순위, 깨진 저장값 복원
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeParsed, textOf, keepBack, resolvePrice, priceKey, productTitle, shortWon, load, save, blank, adviceIn, webIn } from './state.js';
import { productToSpec } from './products.js';
import { CATALOG, parseFurnitureText } from './catalog.js';

test('mergeParsed: 이미 있던 가구는 고친 값을 지키고, 빠진 가구는 없앤다', () => {
  const a = mergeParsed('슈퍼싱글 침대, 책상 1200, 옷장 2개, 캣휠', []).specs;
  assert.deepEqual(a.map((s) => s.name), ['슈퍼싱글 침대', '책상 1200', '옷장 1000', '옷장 1000 (2)', '캣휠']);
  assert.equal(new Set(a.map((s) => s.uid)).size, 5);
  assert.equal(a[4].source, 'default');
  assert.equal(a[4]._wait, true);
  const edited = a.map((s) => (s.name === '책상 1200' ? { ...s, w: 133, name: '내 책상' } : s));
  const b = mergeParsed('책상 1200, 슈퍼싱글 침대, 책장', edited).specs;
  assert.deepEqual(b.map((s) => s.name), ['내 책상', '슈퍼싱글 침대', '책장']);
  assert.equal(b[0].w, 133);
  assert.equal(b[0].uid, a[1].uid);
});

test('textOf: 목록에서 만든 글을 다시 해석하면 같은 가구가 나온다 (카탈로그 전체)', () => {
  for (const spec of Object.values(CATALOG)) {
    const again = parseFurnitureText(spec.name);
    assert.equal(again.specs[0]?.key, spec.key, spec.name);
  }
  const specs = mergeParsed('옷장 2개, 책장', []).specs;
  assert.equal(textOf(specs), '옷장 1000, 옷장 1000, 책장');
  assert.deepEqual(mergeParsed(textOf(specs), specs).specs.map((s) => s.uid), specs.map((s) => s.uid));
});

test('resolvePrice: 직접 입력 > 웹 검색 시세 > 예상', () => {
  const row = { key: 'desk|책상', est: 90000, query: '책상 1200' };
  const web = { '책상 1200': { typical: 120000, low: 80000, high: 150000, sources: [] } };
  assert.deepEqual(resolvePrice(row, {}, {}), { price: 90000, source: 'est', auto: { price: 90000, source: 'est' }, web: null, webOff: false });
  assert.equal(resolvePrice(row, {}, web).source, 'web');
  assert.equal(resolvePrice(row, {}, web).price, 120000);
  const user = resolvePrice(row, { 'desk|책상': 0 }, web); // 0원도 직접 입력한 값이다
  assert.equal(user.source, 'user');
  assert.equal(user.price, 0);
  assert.deepEqual(user.auto, { price: 120000, source: 'web' }); // 되돌리면 웹 시세로
  assert.equal(priceKey({ key: 'desk_120', name: '책상 1200' }), 'desk_120|책상 1200');
});

test('resolvePrice: 예상과 크게 다른 웹 시세는 합계에 쓰지 않고 참고로만 남긴다', () => {
  const row = { key: 'k', est: 100000, query: 'q' };
  const at = (typical) => resolvePrice(row, {}, { q: { typical, low: typical, high: typical, sources: [] } });
  for (const ok of [40000, 100000, 250000]) assert.deepEqual([at(ok).source, at(ok).price, at(ok).webOff], ['web', ok, false]);
  for (const far of [39000, 251000, 1, 5000000]) {
    const r = at(far);
    assert.deepEqual([r.source, r.price, r.webOff], ['est', 100000, true]);
    assert.equal(r.web.typical, far); // 줄에는 참고로 보여 줄 수 있게 남긴다
  }
  assert.equal(resolvePrice({ ...row, est: 0 }, {}, { q: { typical: 5000, low: 1, high: 2, sources: [] } }).source, 'web'); // 예상이 0원이면 견줄 수 없다
  const typed = resolvePrice(row, { k: 77000 }, { q: { typical: 5000000, low: 1, high: 2, sources: [] } });
  assert.deepEqual([typed.source, typed.price, typed.auto.source], ['user', 77000, 'est']); // 직접 입력이 먼저, 되돌리면 예상으로
});

test('resolvePrice: 가구 이름이 constructor·toString이어도 객체의 기본 속성을 가격으로 읽지 않는다', () => {
  for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
    const r = resolvePrice({ key: name, est: 50000, query: name }, {}, {});
    assert.deepEqual(r, { price: 50000, source: 'est', auto: { price: 50000, source: 'est' }, web: null, webOff: false }, name);
  }
});

test('shortWon', () => {
  assert.equal(shortWon(320000), '32만원');
  assert.equal(shortWon(59000), '5만 9천원');
  assert.equal(shortWon(9000), '9,000원');
  assert.equal(shortWon(12340000), '1,234만원');
});

test('load: 저장값이 없거나 깨졌으면 기본값, 이상한 값은 걸러 낸다', () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    assert.equal(load().styleKey, 'minimal');
    mem['bangkkumi-v2'] = '{깨진 글';
    assert.deepEqual(load().specs, []);
    mem['bangkkumi-v2'] = JSON.stringify({ v: 1, budget: 5 });
    assert.equal(load().budget, 1_000_000);
    mem['bangkkumi-v2'] = JSON.stringify({
      v: 2, room: { width: 'x', depth: 99999, doors: 'no' }, styleKey: 'nope', budget: 'many', specs: [{ name: '책상', w: 120, d: 60, h: 73, uid: 'a' }, { name: '' }, null],
      layout: { items: [{ name: '책상', w: 120, d: 60, h: 73, uid: 'a', x: 10, y: 20, rot: 45 }], variant: -3 },
      userPrices: { a: 1000, b: -5, c: 'x', d: 9e9 }, webPrices: { q: { typical: 5000, sources: [{ title: 't', url: 'javascript:alert(1)' }] }, bad: { typical: 'x' } }, advice: { data: { summary: 5 } },
    });
    const s = load();
    assert.equal(s.room.width, 300);
    assert.equal(s.room.depth, 1500);
    assert.equal(s.room.doors.length, 1);
    assert.equal(s.styleKey, 'minimal');
    assert.equal(s.budget, 1_000_000);
    assert.equal(s.specs.length, 1);
    assert.deepEqual(s.layout.items, []); // rot 45는 버린다
    assert.equal(s.layout.variant, 0);
    assert.deepEqual(s.userPrices, { a: 1000 });
    assert.deepEqual(Object.keys(s.webPrices), ['q']);
    assert.deepEqual(s.webPrices.q.sources, []);
    assert.equal(s.advice, null);
    // 저장 → 복원 왕복
    const st = { ...blank(), text: '책상', specs: mergeParsed('책상', []).specs, userPrices: { k: 123 } };
    save(st);
    const back = load();
    assert.equal(back.text, '책상');
    assert.equal(back.specs[0].uid, st.specs[0].uid);
    assert.deepEqual(back.userPrices, { k: 123 });
  } finally {
    delete globalThis.localStorage;
  }
});

test('adviceIn, webIn: 서버 응답도 모양을 확인한다', () => {
  assert.equal(adviceIn({ summary: '', reasons: [] }), null);
  assert.deepEqual(adviceIn({ summary: '요약', reasons: ['a', 3, ''], styling: 's' }), { summary: '요약', reasons: ['a'], styling: 's', props: '' });
  assert.deepEqual(webIn(null), {});
  assert.equal(webIn({ q: { typical: 1000, low: 'x', sources: [{ title: '가게', url: 'https://a.example/p' }] } }).q.low, 1000);
});

/* ───────── 실제 상품에서 고른 가구 ───────── */
const PRODUCT = {
  id: 'dnw-1234567', src: 'danawa', category: 'desk', type: '책상', name: '시험가구 원목 책상 1200', brand: '시험가구', w: 120.5, d: 60, h: 72.3, price: 89000,
  shops: 12, warn: '가격 확인 필요', note: '의자 미포함', url: 'https://prod.danawa.com/info/?pcode=1234567', image: 'https://img.danuri.io/a.jpg',
};
// App.jsx의 담기와 같은 모양: productToSpec 결과 + uid + _id('product|…') + _txt
const picked = (uid, product = PRODUCT) => {
  const spec = productToSpec(product);
  return { ...spec, uid, _id: `product|${spec.product.id}`, _txt: spec.name };
};

test('priceKey, resolvePrice: 상품은 상품 가격을 쓰고 웹 시세는 무시한다. 직접 입력이 가장 먼저다', () => {
  const sp = picked('p1');
  assert.equal(priceKey(sp), 'product|dnw-1234567'); // 같은 종류(key·name이 같은) 다른 상품과 섞이지 않게
  const row = { key: priceKey(sp), est: sp.product.price, query: sp.query, product: sp.product };
  const web = { [sp.query]: { typical: 100000, low: 90000, high: 110000, sources: [] } }; // 예상의 0.4~2.5배 안이라 일반 가구라면 쓰였을 값
  assert.equal(resolvePrice({ ...row, product: undefined }, {}, web).source, 'web');
  assert.deepEqual(resolvePrice(row, {}, web), { price: 89000, source: 'product', auto: { price: 89000, source: 'product' }, web: null, webOff: false });
  const typed = resolvePrice(row, { 'product|dnw-1234567': 70000 }, web);
  assert.deepEqual([typed.source, typed.price, typed.web], ['user', 70000, null]);
  assert.deepEqual(typed.auto, { price: 89000, source: 'product' }); // 되돌리면 상품 가격으로
  assert.equal(resolvePrice(row, { [`${sp.key}|${sp.name}`]: 1 }, {}).source, 'product'); // 일반 가구의 키로 적은 가격은 따라오지 않는다
  assert.equal(productTitle(sp.product), '시험가구 원목 책상 1200'); // 이름에 브랜드가 있으면 다시 붙이지 않는다
  assert.equal(productTitle({ brand: 'IKEA', name: '타르바 침대' }), 'IKEA 타르바 침대');
});

test('mergeParsed, textOf: 상품은 글과 상관없이 남고(글에서 온 가구 뒤), 글에는 들어가지 않는다', () => {
  const a = [...mergeParsed('침대, 책상', []).specs, picked('p1')];
  assert.equal(textOf(a), textOf(a.slice(0, 2))); // 상품이 있어도 글은 글에서 온 가구 2개뿐
  assert.equal(textOf(a).split(', ').length, 2);
  assert.equal(textOf([picked('p1')]), '');
  const b = mergeParsed('소파, 침대', a);
  assert.deepEqual(b.specs.map((s) => s.uid), [b.specs[0].uid, a[0].uid, 'p1']);
  assert.equal(b.specs[2].product.id, 'dnw-1234567');
  assert.equal(b.truncated, false);
  assert.deepEqual(mergeParsed('', a).specs.map((s) => s.uid), ['p1']); // 글을 모두 지워도 상품은 남는다
  assert.deepEqual(mergeParsed(textOf(b.specs), b.specs).specs.map((s) => s.uid), b.specs.map((s) => s.uid)); // 가구를 뺄 때처럼 글을 다시 만들어도 그대로
});

test('keepBack: 치수가 바뀌어도 등 쪽 변은 제자리(아래 벽 rot 180, 오른쪽 벽 rot 90). 위·왼쪽 벽은 좌표 그대로', () => {
  const at = (rot) => keepBack({ x: 120, y: 340, w: 100, d: 60, rot }, { x: 120, y: 340, w: 90, d: 45, rot });
  assert.deepEqual([at(180).x, at(180).y], [120, 355]); // 방 깊이 400: 340 + 60 = 355 + 45
  assert.deepEqual([at(90).x, at(90).y], [135, 340]);
  assert.deepEqual([at(0).x, at(0).y, at(270).x, at(270).y], [120, 340, 120, 340]);
});

test('mergeParsed: 상품과 합쳐 15개까지. 넘으면 글에서 온 가구를 줄이고 truncated를 켠다', () => {
  const three = [picked('p1'), picked('p2'), picked('p3')];
  const fit = mergeParsed('의자 12개', three);
  assert.deepEqual([fit.specs.length, fit.truncated], [15, false]);
  const over = mergeParsed('의자 12개, 캣휠', three);
  assert.deepEqual([over.specs.length, over.truncated], [15, true]);
  assert.deepEqual(over.specs.slice(12).map((s) => s.uid), ['p1', 'p2', 'p3']);
  assert.ok(!over.specs.some((s) => s._txt === '캣휠'));
  const full = mergeParsed('침대', Array.from({ length: 15 }, (_, i) => picked(`p${i}`)));
  assert.deepEqual([full.specs.length, full.truncated, full.specs.every((s) => s.product)], [15, true, true]);
});

test('load: 담은 상품은 productIn으로 다시 검증해 되살리고, 나쁜 product 정보는 떼어 일반 가구로 둔다', () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  try {
    const good = picked('p1');
    const specs = [...mergeParsed('침대', []).specs, good];
    save({ ...blank(), text: '침대', parsedText: '침대', specs, layout: { items: [{ ...good, x: 10, y: 20, rot: 0 }], unplaced: [], variant: 0, sig: '' }, userPrices: { 'product|dnw-1234567': 5000 } });
    let s = load();
    assert.deepEqual(s.specs[1].product, good.product);
    assert.deepEqual([s.specs[1].uid, s.specs[1]._id, s.specs[1].w, s.specs[1].d, s.specs[1].h], ['p1', 'product|dnw-1234567', 121, 60, 72]);
    assert.deepEqual(s.layout.items[0].product, good.product);
    assert.equal(s.text, '침대');
    assert.equal(resolvePrice({ key: priceKey(s.specs[1]), est: 0, query: '', product: s.specs[1].product }, s.userPrices, {}).price, 5000);

    // 손댄 저장값: 허용하지 않는 주소, 범위 밖 치수, 없는 product, 꺾쇠가 든 이름과 나쁜 사진 주소
    const bad = (uid, product) => ({ ...good, uid, product });
    mem['bangkkumi-v2'] = JSON.stringify({
      v: 2, text: '침대', parsedText: '침대',
      specs: [
        specs[0],
        bad('b1', { ...good.product, url: 'https://evil.example/x' }),
        bad('b2', { ...good.product, w: 9999 }),
        bad('b3', undefined),
        bad('ok', { ...good.product, name: '<img src=x onerror=alert(1)>책상', image: 'javascript:alert(1)', extra: 'x' }),
      ],
      layout: { items: [{ ...bad('b1', { ...good.product, url: 'javascript:alert(1)' }), x: 0, y: 0, rot: 90 }], unplaced: [], variant: 0, sig: '' },
    });
    s = load();
    assert.deepEqual(s.specs.map((x) => [x.uid, !!x.product]), [[specs[0].uid, false], ['b1', false], ['b2', false], ['b3', false], ['ok', true]]);
    for (const x of s.specs.slice(1, 4)) {
      assert.equal(x._id, `${good.key}|${good.name}`); // 더는 상품이 아니다: 글 해석 규칙을 따르는 일반 가구
      assert.equal(priceKey(x), `${good.key}|${good.name}`);
      assert.deepEqual([x.w, x.d, x.h], [121, 60, 72]);
    }
    assert.ok(!/[<>]/.test(s.specs[4].product.name));
    assert.equal(s.specs[4].product.image, '');
    assert.equal('extra' in s.specs[4].product, false);
    assert.deepEqual([s.layout.items[0].uid, 'product' in s.layout.items[0], s.layout.items[0].rot], ['b1', false, 90]);
    // 가구 치수와 상품 치수가 다르면(가구 폭만 고친 저장값) 상품 정보를 뗀다. 높이는 달라도 된다(모션데스크)
    const again = (patch) => { mem['bangkkumi-v2'] = JSON.stringify({ v: 2, specs: [{ ...good, ...patch }] }); return load().specs[0]; };
    assert.deepEqual([!!again({ w: 300 }).product, again({ w: 300 }).w], [false, 300]);
    assert.equal(!!again({ h: 60 }).product, true);
    // 일반 가구가 된 것은 글에도 적혀서, 글을 다시 해석해도 남는다
    assert.equal(s.text, textOf(s.specs));
    assert.equal(s.text, s.parsedText);
    assert.equal(mergeParsed(s.text, s.specs).specs.length, 5);
  } finally {
    delete globalThis.localStorage;
  }
});
