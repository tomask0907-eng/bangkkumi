// 배치 엔진 테스트. 실행: node --test src/layout.test.js
// 가구·방은 여기 안에 직접 적는다(catalog.js, data.js를 import하지 않는다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AISLE_CM, normalizeRoom, dims, body, clearZone, doorZones, overlaps, checkLayout, recommend, explain, rotateItem,
} from './layout.js';

// ───────── 시험용 가구와 방 ─────────
const sp = (key, name, category, w, d, h, clear, flags = '') => ({
  key, name, category, w, d, h, clear, tall: flags.includes('t'), sideOk: flags.includes('s'), floor: flags.includes('f'), price: 100000, color: '#aaaaaa', query: name, source: 'catalog',
});
const S = {
  bed_single: sp('bed_single', '싱글 침대', 'bed', 100, 200, 45, 0, 's'),
  bed_ss: sp('bed_ss', '슈퍼싱글 침대', 'bed', 110, 200, 45, 0, 's'),
  bed_queen: sp('bed_queen', '퀸 침대', 'bed', 150, 200, 45, 0, 's'),
  desk: sp('desk_120', '책상 1200', 'desk', 120, 60, 73, 60),
  chair: sp('chair', '의자', 'seating', 55, 55, 90, 20),
  wardrobe: sp('wardrobe_100', '옷장 1000', 'storage', 100, 60, 195, 50, 't'),
  bookshelf: sp('bookshelf', '책장', 'storage', 80, 30, 180, 30, 't'),
  dresser: sp('dresser', '서랍장', 'storage', 80, 45, 85, 45),
  hanger: sp('hanger', '스탠드 행거', 'storage', 120, 45, 170, 40, 't'),
  nightstand: sp('nightstand', '협탁', 'storage', 45, 40, 50, 0),
  tv_stand: sp('tv_stand', 'TV장', 'storage', 120, 40, 45, 30),
  sofa: sp('sofa_2', '2인 소파', 'seating', 150, 80, 80, 40),
  table: sp('table_2', '2인 식탁', 'table', 80, 60, 73, 55),
  table_floor: sp('table_floor', '좌식 테이블', 'table', 90, 60, 35, 45),
  fridge: sp('fridge', '냉장고', 'appliance', 60, 65, 170, 60, 't'),
  mirror: sp('mirror', '전신거울', 'decor', 50, 40, 160, 60, 't'),
  plant: sp('plant', '화분', 'decor', 40, 40, 120, 0),
  rug: sp('rug', '러그', 'decor', 200, 140, 1, 0, 'f'),
  piano: sp('custom:전자피아노', '전자피아노', 'etc', 135, 40, 85, 60),
};
const KEYS = Object.keys(S);

const EXAMPLE_ROOM = {
  width: 300, depth: 400, height: 240,
  doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }],
  windows: [{ wall: 'top', offset: 50, size: 100, sill: 90, height: 120 }],
};
const EXAMPLE_SPECS = [S.bed_ss, S.desk, S.wardrobe, S.bookshelf];
const BIG_ROOM = { width: 500, depth: 600, height: 240, doors: [{ wall: 'left', offset: 450, size: 90, kind: 'entry' }], windows: [{ wall: 'right', offset: 150, size: 200, sill: 90, height: 120 }] };
const TEN = [S.bed_queen, S.desk, S.wardrobe, S.wardrobe, S.bookshelf, S.bookshelf, S.dresser, S.sofa, S.table, S.hanger];

// 씨앗이 있는 난수(mulberry32). 같은 씨앗이면 같은 시나리오
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const WALLS = ['top', 'right', 'bottom', 'left'];
function randomScenario(seed) {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const width = int(20, 60) * 10, depth = int(20, 60) * 10;
  const len = (wall) => (wall === 'top' || wall === 'bottom' ? width : depth);
  const opening = (size) => { const wall = WALLS[int(0, 3)]; return { wall, offset: int(0, Math.max(0, (len(wall) - size) / 5)) * 5, size }; };
  const doors = [{ ...opening(int(14, 20) * 5), kind: 'entry' }];
  if (r() < 0.4) doors.push({ ...opening(70), kind: 'bath' });
  const windows = [];
  for (let i = int(0, 2); i > 0; i--) windows.push({ ...opening(int(6, 20) * 10), sill: 90, height: 120 });
  const n = int(1, 12);
  const specs = [];
  if (r() < 0.85) specs.push(S[['bed_single', 'bed_ss', 'bed_queen'][int(0, 2)]]);
  while (specs.length < n) specs.push(S[KEYS[int(3, KEYS.length - 1)]]);
  return { room: { width, depth, height: 240, doors, windows }, specs };
}

// 엔진과 따로 다시 계산하는 기준 검사(강제 조건)
function hardViolations(room0, items) {
  const room = normalizeRoom(room0);
  const out = [];
  const zones = doorZones(room);
  items.forEach((a, i) => {
    const ba = body(a);
    if (ba.x < 0 || ba.y < 0 || ba.x + ba.w > room.width || ba.y + ba.h > room.depth) out.push(`${a.name} 방 밖`);
    if (zones.some((z) => overlaps(ba, z))) out.push(`${a.name} 문 여는 공간`);
    if (a.floor) return;
    items.slice(i + 1).forEach((b) => { if (!b.floor && overlaps(ba, body(b))) out.push(`${a.name}·${b.name} 겹침`); });
  });
  return out;
}
const backGap = (room, it) => {
  const b = body(it);
  return it.rot === 0 ? b.y : it.rot === 90 ? room.width - b.x - b.w : it.rot === 180 ? room.depth - b.y - b.h : b.x;
};
const place = (spec, uid, x, y, rot) => ({ ...spec, uid, x, y, rot });

// ───────── 기본 도형 ─────────
test('dims·body·clearZone은 회전을 반영한다', () => {
  const it = place(S.desk, 'd', 10, 20, 0);
  assert.deepEqual(dims(it), { w: 120, h: 60 });
  assert.deepEqual(dims({ ...it, rot: 90 }), { w: 60, h: 120 });
  assert.deepEqual(body({ ...it, rot: 270 }), { x: 10, y: 20, w: 60, h: 120 });
  assert.deepEqual(clearZone(it), { x: 10, y: 80, w: 120, h: 60 }); // rot 0: 앞이 아래
  assert.deepEqual(clearZone({ ...it, rot: 90 }), { x: -50, y: 20, w: 60, h: 120 }); // rot 90: 앞이 왼쪽
  assert.deepEqual(clearZone({ ...it, rot: 180 }), { x: 10, y: -40, w: 120, h: 60 });
  assert.deepEqual(clearZone({ ...it, rot: 270 }), { x: 70, y: 20, w: 60, h: 120 });
  assert.equal(clearZone(place(S.bed_ss, 'b', 0, 0, 0)), null);
  assert.equal(AISLE_CM, 60);
});

test('overlaps: 닿는 것은 겹침이 아니다', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 }), true);
});

test('normalizeRoom: 빠진 값 채우기, 범위 보정, 구버전 형식', () => {
  const old = normalizeRoom({ width: 300, depth: 400, door: { wall: 'bottom', offset: 20, size: 90 }, window: { wall: 'top', offset: 50, size: 100 } });
  assert.equal(old.height, 240);
  assert.deepEqual(old.doors, [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }]);
  assert.deepEqual(old.windows, [{ wall: 'top', offset: 50, size: 100, sill: 90, height: 120 }]);
  const fixed = normalizeRoom({ width: 50, depth: 99999, doors: [{ wall: 'left', offset: 99999, size: 500 }, { wall: '??', offset: -5 }], windows: [] });
  assert.equal(fixed.width, 150);
  assert.equal(fixed.depth, 1500);
  assert.equal(fixed.doors[0].size, 150);
  assert.equal(fixed.doors[0].offset, 1350);
  assert.equal(fixed.doors[1].kind, 'etc');
  assert.ok(fixed.doors[1].offset >= 0 && fixed.doors[1].offset + fixed.doors[1].size <= 150);
  for (const bad of [null, undefined, {}, 'x', { width: 'abc', doors: 'no', windows: null }]) {
    const r = normalizeRoom(bad);
    assert.ok(r.width >= 150 && r.depth >= 150 && r.doors.length >= 1 && Array.isArray(r.windows));
  }
  const again = normalizeRoom(old); // 이미 고친 방은 그대로
  assert.deepEqual(again, old);
  const under = normalizeRoom({ ...EXAMPLE_ROOM, underlay: { lines: [[0, 0, 1, 1]] } });
  assert.deepEqual(under.underlay, { lines: [[0, 0, 1, 1]] });
});

test('doorZones: 문마다 문 폭 정사각형', () => {
  const z = doorZones({ width: 300, depth: 400, doors: [{ wall: 'bottom', offset: 20, size: 90 }, { wall: 'right', offset: 100, size: 70 }, { wall: 'top', offset: 0, size: 80 }, { wall: 'left', offset: 10, size: 60 }], windows: [] });
  assert.deepEqual(z, [{ x: 20, y: 310, w: 90, h: 90 }, { x: 230, y: 100, w: 70, h: 70 }, { x: 0, y: 0, w: 80, h: 80 }, { x: 0, y: 10, w: 60, h: 60 }]);
});

// ───────── 추천 ─────────
test('예시 방: 모든 가구를 오류·경고 없이 놓고 점수가 높다', () => {
  const r = recommend(EXAMPLE_ROOM, EXAMPLE_SPECS);
  assert.deepEqual(r.unplaced, []);
  assert.equal(r.items.length, 4);
  const chk = checkLayout(EXAMPLE_ROOM, r.items);
  assert.deepEqual(chk.issues, []);
  assert.ok(r.score.total >= 90, `점수 ${r.score.total}`);
  assert.deepEqual(chk.score, r.score); // 추천이 돌려준 점수 = 화면이 다시 잰 점수
  const bed = r.items.find((i) => i.category === 'bed');
  assert.ok(backGap(EXAMPLE_ROOM, bed) <= 10, '침대 머리는 벽에');
  for (const it of r.items) {
    assert.ok(Array.isArray(r.reasons[it.uid]) && r.reasons[it.uid].length >= 1 && r.reasons[it.uid].length <= 3);
    for (const line of r.reasons[it.uid]) assert.match(line, /요\.$/);
  }
});

test('예시 방: v1의 문제(책상을 창 정면에, 죽은 틈)를 되풀이하지 않는다', () => {
  const r = recommend(EXAMPLE_ROOM, EXAMPLE_SPECS);
  const desk = r.items.find((i) => i.category === 'desk');
  assert.ok(desk.rot === 90 || desk.rot === 270, '창(위쪽 벽)이 책상 옆에 온다');
  // 가구와 벽 사이에 5 초과 50 미만의 틈이 없다(등 쪽)
  for (const it of r.items) assert.ok(backGap(EXAMPLE_ROOM, it) <= 10, `${it.name} 등이 벽에`);
});

test('강제 조건: 난수 시나리오 80개의 모든 배치안에서 방 안·겹침 없음·문 여는 공간 비움', () => {
  let layouts = 0;
  // 1번 안을 고르는 기준: 점수에서 경고 하나마다 4점을 뺀 값(엔진의 SOFT_COST). 앉는 자리를 못 보는 TV도 하나로 세는데
  // issues에는 안 나오므로 TV 수만큼 여유를 둔다
  const adj = (room, r) => r.score.total - 4 * checkLayout(room, r.items).issues.filter((i) => i.level === 'warn').length;
  for (let seed = 1; seed <= 80; seed++) {
    const { room, specs } = randomScenario(seed);
    const first = recommend(room, specs, 0);
    const tvSlack = 4 * specs.filter((s) => s.key === 'tv_stand').length;
    assert.ok(first.variants >= 1 && first.variants <= 5, `seed ${seed}`);
    for (let v = 0; v < first.variants; v++) {
      const r = recommend(room, specs, v);
      layouts++;
      assert.deepEqual(hardViolations(room, r.items), [], `seed ${seed} v${v}`);
      // 가구가 사라지지 않는다: 놓은 것 + 못 놓은 것 = 입력
      assert.equal(r.items.length + r.unplaced.length, specs.length, `seed ${seed} v${v}`);
      const uids = [...r.items, ...r.unplaced].map((i) => i.uid);
      assert.equal(new Set(uids).size, specs.length, `seed ${seed} uid 중복`);
      const names = (list) => list.map((i) => i.name).sort();
      assert.deepEqual(names([...r.items, ...r.unplaced]), names(specs));
      for (const it of r.items) assert.ok([0, 90, 180, 270].includes(it.rot) && Number.isInteger(it.x) && Number.isInteger(it.y));
      for (const u of r.unplaced) assert.ok(!('x' in u) && !('rot' in u));
      // 점수 모양
      assert.ok(r.score.total >= 0 && r.score.total <= 100);
      assert.ok(r.score.parts.length >= 6 && r.score.parts.length <= 8);
      assert.equal(r.score.parts.reduce((s, p) => s + p.max, 0), 100);
      assert.equal(r.score.parts.reduce((s, p) => s + p.score, 0), r.score.total);
      for (const p of r.score.parts) assert.ok(p.score >= 0 && p.score <= p.max && typeof p.note === 'string' && p.note.length > 0 && p.label && p.key);
      // 추천안에는 오류가 없고, 통로가 끊기거나 최소 사용 공간이 모자란 가구도 없다
      const chk = checkLayout(room, r.items);
      assert.deepEqual(chk.issues.filter((i) => i.level === 'error'), [], `seed ${seed} v${v}`);
      assert.deepEqual(chk.issues.filter((i) => i.code === 'walk'), [], `seed ${seed} v${v} 통로`);
      assert.deepEqual(chk.score, r.score, `seed ${seed} v${v} 점수`);
      for (const it of r.items) assert.ok(r.reasons[it.uid]?.length >= 1, `seed ${seed} 이유`);
      if (v > 0) assert.ok(adj(room, r) <= adj(room, first) + tvSlack, `seed ${seed}: 첫 번째 안이 가장 좋은 안(점수 − 4 × 경고 수)`);
    }
  }
  assert.ok(layouts >= 80);
});

test('결정적: 같은 입력이면 같은 결과', () => {
  for (const seed of [3, 11, 27, 40]) {
    const { room, specs } = randomScenario(seed);
    const a = [0, 1, 2].map((v) => recommend(room, specs, v));
    recommend(EXAMPLE_ROOM, EXAMPLE_SPECS); // 마지막 입력을 기억하는 캐시를 비운다
    const b = [0, 1, 2].map((v) => recommend(structuredClone(room), structuredClone(specs), v));
    assert.deepEqual(b, a, `seed ${seed}`);
  }
});

test('배치안: 서로 다른 구역 나누기이고 variants 개수를 알려준다', () => {
  for (const [room, specs] of [[EXAMPLE_ROOM, EXAMPLE_SPECS], [BIG_ROOM, TEN]]) {
    const r0 = recommend(room, specs, 0);
    assert.ok(r0.variants >= 3, `배치안 ${r0.variants}개`);
    const all = Array.from({ length: r0.variants }, (_, v) => recommend(room, specs, v));
    assert.deepEqual(recommend(room, specs, r0.variants), all[0]); // variant % variants
    assert.deepEqual(recommend(room, specs, -1), all[r0.variants - 1]);
    const center = (it) => { const b = body(it); return [b.x + b.w / 2, b.y + b.h / 2]; };
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        // 10cm 옮긴 정도가 아니라, 넓이 기준 30% 넘는 가구가 80cm 넘게 옮겨졌거나 방향이 바뀌었다
        let moved = 0, total = 0;
        for (const a of all[i].items) {
          const b = all[j].items.find((q) => q.uid === a.uid);
          total += a.w * a.d;
          const [ax, ay] = center(a), [bx, by] = b ? center(b) : [1e9, 1e9];
          if (!b || a.rot !== b.rot || Math.hypot(ax - bx, ay - by) >= 80) moved += a.w * a.d;
        }
        assert.ok(moved / total >= 0.3, `배치안 ${i}와 ${j}가 너무 비슷해요 (${(moved / total).toFixed(2)})`);
      }
    }
  }
});

test('캐시: 가격·색·출처만 바뀐 사양으로 다시 불러도 이번 입력 값이 돌아온다', () => {
  const specs = [S.bed_ss, S.desk, S.wardrobe];
  recommend(EXAMPLE_ROOM, specs, 0);
  const changed = specs.map((s) => ({ ...s, price: s.price * 2, color: '#ffffff', source: 'ai', extra: 'new' }));
  for (const v of [0, 1]) {
    for (const it of recommend(EXAMPLE_ROOM, changed, v).items) assert.deepEqual([it.price, it.color, it.source, it.extra], [200000, '#ffffff', 'ai', 'new'], `variant ${v} ${it.name}`);
  }
  // 못 놓은 가구 쪽도
  const tiny = { width: 150, depth: 150, doors: [{ wall: 'bottom', offset: 0, size: 90 }] };
  const big = { ...S.wardrobe, w: 300, d: 300, price: 1 };
  recommend(tiny, [big]);
  assert.deepEqual(recommend(tiny, [{ ...big, price: 2 }]).unplaced.map((u) => u.price), [2]);
});

test('소파+TV: 방이 받쳐 주면 1번 안에서 TV가 소파를 마주 본다', () => {
  // 검증에서 놓쳤던 방(3×4m, 문 아래 왼쪽): 손으로 놓으면 94점이 나오는데 예전 탐색은 TV를 소파 옆에 두고 88점이었다
  const room = { width: 300, depth: 400, height: 240, doors: [{ wall: 'bottom', offset: 10, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 75, size: 150, sill: 90, height: 120 }] };
  const facing = (r) => {
    const tv = r.items.find((i) => i.key === 'tv_stand'), sofa = r.items.find((i) => i.key === 'sofa_2');
    if (!tv || !sofa || (tv.rot + 180) % 360 !== sofa.rot) return false;
    const t = body(tv), s = body(sofa), horiz = tv.rot % 180 === 0; // horiz: 위아래로 마주 봄 → x 구간이 겹쳐야
    const lap = horiz ? Math.min(t.x + t.w, s.x + s.w) - Math.max(t.x, s.x) : Math.min(t.y + t.h, s.y + s.h) - Math.max(t.y, s.y);
    const ahead = tv.rot === 0 ? s.y >= t.y + t.h : tv.rot === 180 ? s.y + s.h <= t.y : tv.rot === 270 ? s.x >= t.x + t.w : s.x + s.w <= t.x;
    return ahead && lap >= tv.w / 2;
  };
  const r = recommend(room, [S.bed_ss, S.desk, S.wardrobe, S.sofa, S.tv_stand], 0);
  assert.deepEqual(r.unplaced, []);
  assert.ok(facing(r), r.items.map((i) => `${i.key}@${i.x},${i.y},${i.rot}`).join(' '));
  assert.ok(r.score.total >= 92, `점수 ${r.score.total}`);
  assert.deepEqual(checkLayout(room, r.items).issues, []);
  // 가구가 적으면 방 크기·문 위치가 달라도 마주 본다
  for (const [w, d] of [[280, 380], [350, 450], [400, 300]]) {
    for (const door of [{ wall: 'bottom', offset: 10 }, { wall: 'left', offset: d - 100 }]) {
      const rm = { width: w, depth: d, doors: [{ ...door, size: 90 }], windows: [{ wall: 'top', offset: Math.round(w / 2 - 75), size: 150 }] };
      assert.ok(facing(recommend(rm, [S.bed_ss, S.wardrobe, S.sofa, S.tv_stand], 0)), `${w}x${d} ${door.wall}`);
    }
  }
});

test('창이 현관문과 같은 벽에 있어도 1번 안에는 경고가 붙지 않는다', () => {
  // 검증에서 "책장 자리가 창문을 10cm 가려요" 경고를 단 99점짜리 1번 안이 나왔던 방들
  const cases = [
    [{ width: 280, depth: 380, doors: [{ wall: 'bottom', offset: 10, size: 90 }], windows: [{ wall: 'bottom', offset: 140, size: 120 }] }, [S.bed_ss, S.desk, S.wardrobe, S.bookshelf]],
    [{ width: 280, depth: 380, doors: [{ wall: 'bottom', offset: 180, size: 90 }], windows: [{ wall: 'bottom', offset: 10, size: 120 }] }, [S.bed_ss, S.desk, S.wardrobe, S.hanger, S.dresser]],
    [{ width: 280, depth: 380, doors: [{ wall: 'left', offset: 280, size: 90 }], windows: [{ wall: 'left', offset: 20, size: 120 }] }, [S.bed_ss, S.desk, S.wardrobe, S.bookshelf]],
  ];
  for (const [room, specs] of cases) {
    const r = recommend(room, specs, 0);
    assert.deepEqual(r.unplaced, []);
    assert.deepEqual(checkLayout(room, r.items).issues.map((i) => i.msg), []);
    assert.ok(r.score.total >= 90, `점수 ${r.score.total}`);
  }
});

test('uid: 있으면 그대로 쓰고 없으면 만든다. 원래 사양 값은 그대로 남는다', () => {
  const r = recommend(EXAMPLE_ROOM, [{ ...S.bed_ss, uid: 'my-bed' }, S.desk, S.desk]);
  assert.ok(r.items.some((i) => i.uid === 'my-bed'));
  assert.equal(new Set(r.items.map((i) => i.uid)).size, 3);
  const bed = r.items.find((i) => i.uid === 'my-bed');
  assert.equal(bed.price, 100000);
  assert.equal(bed.query, '슈퍼싱글 침대');
  assert.equal(bed.source, 'catalog');
});

// ───────── 검사와 점수 ─────────
test('오류: 방 밖, 겹침, 문 여는 공간 (러그는 겹쳐도 됨)', () => {
  const items = [
    place(S.desk, 'a', 0, 0, 0),
    place(S.bookshelf, 'b', 50, 10, 0),
    place(S.wardrobe, 'c', 250, 100, 0),
    place(S.dresser, 'd', 30, 350, 180),
    place(S.rug, 'r', 0, 0, 0),
  ];
  const chk = checkLayout(EXAMPLE_ROOM, items);
  const errs = chk.issues.filter((i) => i.level === 'error');
  assert.deepEqual(errs.map((e) => e.code).sort(), ['door', 'out', 'overlap']);
  const ov = errs.find((e) => e.code === 'overlap');
  assert.equal(ov.uid, 'a');
  assert.equal(ov.other, 'b');
  assert.match(ov.msg, /겹쳐요/);
  assert.match(errs.find((e) => e.code === 'out').msg, /방 밖/);
  assert.match(errs.find((e) => e.code === 'door').msg, /문 여는 공간/);
  assert.ok(!errs.some((e) => e.uid === 'r' || e.other === 'r'), '러그는 오류가 아니다');
  assert.equal(chk.issues[0].level, 'error'); // 오류가 먼저
  for (const i of chk.issues) assert.ok(['error', 'warn'].includes(i.level) && typeof i.code === 'string' && /요\.$/.test(i.msg));
  // 오류 1건마다 15점씩 깎인다
  const sum = chk.score.parts.reduce((s, p) => s + p.score, 0);
  assert.equal(chk.score.total, Math.max(0, sum - 15 * errs.length));
});

test('경고: 통로 끊김, 창 가림, 앞 공간 부족, 창을 등진 책상', () => {
  // 2m 폭 방을 퀸 침대가 가로막으면 뒤쪽 책장에 갈 수 없다
  const small = { width: 200, depth: 300, doors: [{ wall: 'bottom', offset: 0, size: 90 }], windows: [{ wall: 'top', offset: 50, size: 100 }] };
  const blocked = checkLayout(small, [place(S.bed_queen, 'bed', 0, 60, 90), place(S.bookshelf, 'shelf', 0, 0, 0)]);
  const walkWarn = blocked.issues.find((i) => i.code === 'walk' && i.uid === 'shelf');
  assert.ok(walkWarn && walkWarn.level === 'warn' && walkWarn.msg.includes('책장'));
  assert.equal(blocked.walk.reachable({ uid: 'shelf' }), false);

  const win = checkLayout(EXAMPLE_ROOM, [place(S.wardrobe, 'w', 50, 0, 0)]);
  assert.ok(win.issues.some((i) => i.code === 'window' && i.uid === 'w' && i.level === 'warn'));
  const low = checkLayout(EXAMPLE_ROOM, [place(S.dresser, 'low', 50, 0, 0)]); // 창대보다 낮으면 경고하지 않는다
  assert.ok(!low.issues.some((i) => i.code === 'window'));

  const tight = checkLayout(EXAMPLE_ROOM, [place(S.desk, 'desk', 0, 0, 0), place(S.dresser, 'x', 0, 90, 0)]);
  assert.ok(tight.issues.some((i) => i.code === 'clear' && i.uid === 'desk'));

  // 식탁을 벽에서 조금 띄웠을 때: 뒤쪽 틈을 "앞"이라고 하지 않고, 앞이 넉넉하면 경고도 없다
  const sq = { width: 400, depth: 400, doors: [{ wall: 'bottom', offset: 20, size: 90 }], windows: [{ wall: 'top', offset: 100, size: 150 }] };
  const tbl = { ...S.table, w: 80, d: 80, clear: 60 };
  for (const gap of [0, 5, 11, 30, 59]) {
    const it = place(tbl, 't', 400 - 80 - gap, 100, 90); // 등이 오른쪽 벽, 앞(왼쪽)은 2.6m 넘게 비어 있음
    assert.deepEqual(checkLayout(sq, [it]).issues, [], `벽과 ${gap}cm`);
    const front = explain(sq, [it]).t.filter((x) => x.includes('앞이') || x.includes('뒤쪽이'));
    assert.deepEqual(front, ['2인 식탁 앞이 90cm 이상 비어 있어 의자를 빼고 앉기 편해요.'], `벽과 ${gap}cm`);
  }
  // 뒤에도 앉을 만큼(60cm 이상) 띄웠는데 75cm보다 좁으면 "뒤쪽"이라고 말한다
  const back65 = explain(sq, [place(tbl, 't', 400 - 80 - 65, 100, 90)]).t;
  assert.ok(back65.includes('2인 식탁 뒤쪽이 65cm예요. 의자를 빼려면 75cm쯤 필요해요.'), back65.join(' / '));
  // 앞이 정말 막혀 있으면 지금처럼 경고한다
  const frontTight = checkLayout(sq, [place(tbl, 't', 320, 100, 90), place(S.dresser, 'x', 235, 100, 90)]);
  assert.ok(frontTight.issues.some((i) => i.code === 'clear' && i.uid === 't' && i.msg.includes('앞이 40cm')), JSON.stringify(frontTight.issues));

  const glare = checkLayout(EXAMPLE_ROOM, [place(S.desk, 'desk', 40, 340, 180)]); // 아래 벽에 등, 창(위쪽)과 폭이 겹침 → 화면이 창을 마주 봄
  assert.ok(glare.issues.some((i) => i.code === 'glare' && i.uid === 'desk'));
});

test('walk: 통로 격자점과 reachable', () => {
  const r = recommend(EXAMPLE_ROOM, EXAMPLE_SPECS);
  const { walk } = checkLayout(EXAMPLE_ROOM, r.items);
  assert.ok(walk.points.length > 100);
  for (const p of walk.points.slice(0, 50)) assert.ok(p.x >= 30 - 3 && p.x <= 270 + 3 && p.y >= 30 - 3 && p.y <= 370 + 3);
  // 통로 점은 가구 몸체에서 27cm 넘게 떨어져 있다(반폭 30에서 격자 여유를 뺀 값)
  for (const p of walk.points) {
    for (const it of r.items) {
      const b = body(it);
      const dx = Math.max(b.x - p.x, 0, p.x - b.x - b.w), dy = Math.max(b.y - p.y, 0, p.y - b.y - b.h);
      assert.ok(Math.max(dx, dy) >= 27, `통로 점 (${p.x}, ${p.y})이 ${it.name}에 너무 가까워요`);
    }
  }
  for (const it of r.items) assert.equal(walk.reachable(it), true);
  assert.equal(checkLayout(EXAMPLE_ROOM, []).walk.points.length, 0); // 가구가 없으면 계산하지 않는다
});

test('점수: 분명히 나쁜 배치는 추천 배치보다 낮다', () => {
  const good = recommend(EXAMPLE_ROOM, EXAMPLE_SPECS);
  const bad = [
    place(S.bed_ss, 'bed', 60, 100, 0), // 머리가 벽에서 떠 있고 현관 정면
    place(S.desk, 'desk', 180, 340, 180), // 창을 등짐
    place(S.wardrobe, 'wardrobe', 50, 0, 0), // 창을 가림
    place(S.bookshelf, 'shelf', 0, 120, 270), // 침대와 30cm 틈
  ];
  const chk = checkLayout(EXAMPLE_ROOM, bad);
  assert.deepEqual(chk.issues.filter((i) => i.level === 'error'), []);
  assert.ok(chk.score.total <= good.score.total - 20, `나쁜 배치 ${chk.score.total}점, 추천 ${good.score.total}점`);
  const part = (score, key) => score.parts.find((p) => p.key === key).score;
  assert.ok(part(chk.score, 'rest') < part(good.score, 'rest'));
  assert.ok(part(chk.score, 'light') < part(good.score, 'light'));
  assert.ok(part(chk.score, 'tidy') < part(good.score, 'tidy'));
});

test('점수: 가구를 나쁜 쪽으로 끌면 해당 항목이 내려간다', () => {
  const r = recommend(EXAMPLE_ROOM, EXAMPLE_SPECS);
  const base = checkLayout(EXAMPLE_ROOM, r.items).score;
  const part = (score, key) => score.parts.find((p) => p.key === key).score;
  const move = (uid, patch) => r.items.map((i) => (i.uid === uid ? { ...i, ...patch } : i));
  const bed = r.items.find((i) => i.category === 'bed');
  const wardrobe = r.items.find((i) => i.name.includes('옷장'));
  const desk = r.items.find((i) => i.category === 'desk');

  // 침대를 벽에서 30cm 떼면: 머리가 뜨고 죽은 틈이 생긴다
  const offWall = bed.rot === 0 ? { y: bed.y + 30 } : bed.rot === 180 ? { y: bed.y - 30 } : bed.rot === 270 ? { x: bed.x + 30 } : { x: bed.x - 30 };
  const s1 = checkLayout(EXAMPLE_ROOM, move(bed.uid, offWall)).score;
  assert.ok(part(s1, 'rest') < part(base, 'rest'));
  assert.ok(s1.total < base.total);

  // 옷장을 창 앞으로 옮기면 채광 점수가 내려가고 경고가 뜬다
  const c2 = checkLayout(EXAMPLE_ROOM, move(wardrobe.uid, { x: 50, y: 150, rot: 0 }).map((i) => (i.uid === wardrobe.uid ? { ...i, y: 0 } : i.uid === desk.uid ? { ...i, x: 0, y: 250, rot: 270 } : i)));
  if (!c2.issues.some((i) => i.level === 'error')) {
    assert.ok(part(c2.score, 'light') < part(base, 'light'));
    assert.ok(c2.issues.some((i) => i.code === 'window'));
  }

  // 책상을 방 가운데로 끌면 정돈 점수가 내려간다
  const s3 = checkLayout(EXAMPLE_ROOM, move(desk.uid, { x: 90, y: 170, rot: 0 }));
  if (!s3.issues.some((i) => i.level === 'error')) assert.ok(part(s3.score, 'tidy') < part(base, 'tidy'));

  // 조금씩 끌 때 점수가 튀지 않는다: 5cm 옮겨서 20점 넘게 바뀌지 않는다(오류가 없을 때)
  let prev = base.total;
  for (let dx = 5; dx <= 60; dx += 5) {
    const c = checkLayout(EXAMPLE_ROOM, move(desk.uid, desk.rot === 270 ? { x: desk.x + dx } : { y: desk.y + dx }));
    if (c.issues.some((i) => i.level === 'error')) break;
    assert.ok(Math.abs(c.score.total - prev) <= 20, `dx ${dx}: ${prev} → ${c.score.total}`);
    prev = c.score.total;
  }
});

// ───────── 설명 ─────────
test('explain: 사용자가 옮긴 배치를 사실대로 설명한다', () => {
  // 침대 머리가 벽에서 50cm 떨어짐, 책상은 창을 등짐, 옷장은 창 앞
  const items = [
    place(S.bed_ss, 'bed', 190, 50, 0),
    place(S.desk, 'desk', 40, 340, 180),
    place(S.wardrobe, 'wardrobe', 50, 0, 0),
  ];
  const ex = explain(EXAMPLE_ROOM, items);
  assert.deepEqual(Object.keys(ex).sort(), ['bed', 'desk', 'wardrobe']);
  const text = (uid) => ex[uid].join(' ');
  assert.match(text('bed'), /머리맡이 벽에서 50cm 떨어져/);
  assert.doesNotMatch(text('bed'), /머리맡이 벽에 붙어/);
  assert.match(text('desk'), /뒤쪽이 창/);
  assert.doesNotMatch(text('desk'), /옆으로 창 빛/);
  assert.match(text('wardrobe'), /창문을 100cm 가려요/);

  // 같은 가구를 좋은 자리에 두면 반대 문장이 나온다
  const good = [
    place(S.bed_ss, 'bed', 190, 0, 0),
    place(S.desk, 'desk', 0, 150, 270),
    place(S.wardrobe, 'wardrobe', 200, 340, 180),
  ];
  const ex2 = explain(EXAMPLE_ROOM, good);
  assert.match(ex2.bed.join(' '), /머리맡이 벽에 붙어/);
  assert.match(ex2.bed.join(' '), /머리맡이 창을 피해/);
  assert.match(ex2.desk.join(' '), /옆으로 창 빛/);
  assert.doesNotMatch(ex2.wardrobe.join(' '), /가려요/);

  // 오류도 설명에 들어간다
  const ex3 = explain(EXAMPLE_ROOM, [place(S.desk, 'a', 250, 0, 0), place(S.dresser, 'b', 30, 350, 180)]);
  assert.match(ex3.a.join(' '), /방 밖/);
  assert.match(ex3.b.join(' '), /문 여는 공간/);
  assert.deepEqual(explain(EXAMPLE_ROOM, []), {});
});

test('explain·reasons: 추천 배치의 문장을 도형으로 다시 확인해도 참이다', () => {
  // 문장에 들어 있는 주장마다 엔진과 따로 계산한 조건을 건다
  const claims = [
    [/머리맡이 벽에 붙어/, (room, it) => backGap(room, it) <= 10],
    [/머리맡이 벽에서 \d+cm 떨어져/, (room, it) => backGap(room, it) > 10],
    [/등을 벽에 붙여/, (room, it) => backGap(room, it) <= 10],
    [/떨어져 떠 있어요/, (room, it) => backGap(room, it) > 10],
    [/긴 쪽을 벽에 붙여/, (room, it) => { const b = body(it); return it.rot % 180 === 0 ? b.x <= 5 || room.width - b.x - b.w <= 5 : b.y <= 5 || room.depth - b.y - b.h <= 5; }],
    [/옆으로 창 빛이 들어와/, (room, it) => room.windows.length > 0 && room.windows.every((w) => (['top', 'bottom'].includes(w.wall) ? it.rot % 180 !== 0 : it.rot % 180 === 0))],
    [/창대보다 낮아/, (room, it) => room.windows.some((w) => it.h <= w.sill)],
    [/창문을 \d+cm 가려요/, (room, it) => room.windows.some((w) => it.h > w.sill)],
    [/현관에서 멀어 아늑/, (room, it) => {
      const d = room.doors[0], m = d.offset + d.size / 2, b = body(it);
      const ex = d.wall === 'left' ? 0 : d.wall === 'right' ? room.width : m, ey = d.wall === 'top' ? 0 : d.wall === 'bottom' ? room.depth : m;
      return Math.hypot(b.x + b.w / 2 - ex, b.y + b.h / 2 - ey) >= 0.5 * Math.hypot(room.width, room.depth) - 1;
    }],
    [/정면으로 보이지 않아요/, (room, it) => {
      const d = room.doors[0], b = body(it);
      return ['top', 'bottom'].includes(d.wall) ? b.x >= d.offset + d.size || b.x + b.w <= d.offset : b.y >= d.offset + d.size || b.y + b.h <= d.offset;
    }],
    // 키 큰 수납(S16): 등과 옆이 모두 벽에 닿은 구석일 때만 "구석에 붙여"라고 한다
    [/구석에 붙여 방 가운데/, (room, it) => {
      const b = body(it);
      const side = it.rot % 180 === 0 ? Math.min(b.x, room.width - b.x - b.w) : Math.min(b.y, room.depth - b.y - b.h);
      return backGap(room, it) <= 10 && side <= 5;
    }],
    // 책상(S14): 침대와 통로 폭 넘게 떨어졌을 때만 "떨어져 있어"라고 한다
    [/침대와 떨어져 있어/, (room, it, all) => {
      const a = body(it);
      return all.filter((o) => o.category === 'bed').some((o) => {
        const b = body(o);
        return Math.hypot(Math.max(0, b.x - a.x - a.w, a.x - b.x - b.w), Math.max(0, b.y - a.y - a.h, a.y - b.y - b.h)) >= AISLE_CM;
      });
    }],
  ];
  let checked = 0;
  for (let seed = 100; seed < 130; seed++) {
    const { room: raw, specs } = randomScenario(seed);
    const room = normalizeRoom(raw);
    const r = recommend(raw, specs, seed % 3);
    const ex = explain(raw, r.items);
    for (const it of r.items) {
      const lines = [...r.reasons[it.uid], ...ex[it.uid]];
      assert.ok(ex[it.uid].length >= 1 && ex[it.uid].length <= 6);
      for (const line of lines) {
        assert.match(line, /요\.$|요\. \(.*\)$/, line);
        for (const [re, ok] of claims) {
          if (!re.test(line)) continue;
          checked++;
          assert.ok(ok(room, it, r.items), `seed ${seed} ${it.name}: "${line}"`);
        }
      }
      // 추천 이유(reasons)는 지킨 규칙만 말한다: explain의 문장들 안에 그대로 있다
      for (const line of r.reasons[it.uid]) assert.ok(explain(raw, r.items)[it.uid].includes(line) || ex[it.uid].length === 6, `seed ${seed}: "${line}"`);
    }
  }
  assert.ok(checked > 200, `확인한 주장 ${checked}개`);
});

// ───────── 까다로운 입력 ─────────
test('창문이 없는 방', () => {
  const room = { width: 300, depth: 350, doors: [{ wall: 'left', offset: 240, size: 90 }], windows: [] };
  const r = recommend(room, [S.bed_ss, S.desk, S.wardrobe]);
  assert.deepEqual(r.unplaced, []);
  assert.deepEqual(hardViolations(room, r.items), []);
  const light = r.score.parts.find((p) => p.key === 'light');
  assert.equal(light.score, light.max);
  assert.match(light.note, /창문이 없어서 채광은 따지지 않았어요/); // 만점이지만 따지지 않은 것임을 밝힌다
  assert.match(checkLayout(room, r.items).score.parts.find((p) => p.key === 'light').note, /창문이 없어서/);
  assert.ok(!Object.values(explain(room, r.items)).flat().some((l) => l.includes('창')), '없는 창문을 말하지 않는다');
});

test('문이 2개(현관 + 화장실): 두 문 여는 공간을 모두 비우고 화장실까지 길이 이어진다', () => {
  const room = { width: 320, depth: 450, doors: [{ wall: 'bottom', offset: 200, size: 90, kind: 'entry' }, { wall: 'left', offset: 330, size: 70, kind: 'bath' }], windows: [{ wall: 'top', offset: 80, size: 160 }] };
  const first = recommend(room, [S.bed_ss, S.desk, S.wardrobe, S.fridge, S.table]);
  for (let v = 0; v < first.variants; v++) {
    const r = recommend(room, [S.bed_ss, S.desk, S.wardrobe, S.fridge, S.table], v);
    assert.deepEqual(hardViolations(room, r.items), []);
    assert.deepEqual(checkLayout(room, r.items).issues.filter((i) => i.code === 'walk'), []);
  }
  // 화장실 문 앞을 막으면 오류, 가는 길을 막으면 통로 경고(가구가 아니라 문에 대한 것이라 uid는 null)
  const onDoor = checkLayout(room, [place(S.dresser, 'x', 0, 340, 270)]);
  assert.ok(onDoor.issues.some((i) => i.code === 'door' && i.uid === 'x'));
  const wall = checkLayout(room, [place(S.wardrobe, 'a', 100, 350, 90), place(S.wardrobe, 'b', 100, 250, 90), place(S.wardrobe, 'c', 0, 250, 0)]);
  assert.deepEqual(wall.issues.filter((i) => i.level === 'error'), []);
  assert.ok(wall.issues.some((i) => i.code === 'walk' && i.uid === null && i.msg.includes('화장실')));
});

test('아주 작은 방(150×150): 못 놓는 가구는 unplaced로, 놓은 것은 강제 조건을 지킨다', () => {
  const room = { width: 150, depth: 150, doors: [{ wall: 'bottom', offset: 30, size: 80 }], windows: [{ wall: 'top', offset: 30, size: 80 }] };
  const r = recommend(room, [S.bed_single, S.desk, S.bookshelf]);
  assert.ok(r.unplaced.some((u) => u.category === 'bed'), '2m 침대는 1.5m 방에 못 들어간다');
  assert.equal(r.items.length + r.unplaced.length, 3);
  assert.deepEqual(hardViolations(room, r.items), []);
  const none = recommend({ width: 150, depth: 150, doors: [{ wall: 'bottom', offset: 0, size: 150 }], windows: [] }, [S.bed_queen, S.sofa]);
  assert.equal(none.items.length, 0);
  assert.equal(none.unplaced.length, 2);
  assert.equal(none.variants, 1);
});

test('공간이 모자라면 겹쳐 놓지 않고 못 놓은 가구를 알려준다', () => {
  const tiny = { width: 200, depth: 220, doors: [{ wall: 'bottom', offset: 0, size: 90 }], windows: [{ wall: 'top', offset: 50, size: 100 }] };
  const r = recommend(tiny, [S.bed_queen, S.wardrobe, S.sofa, S.desk, S.dresser]);
  assert.ok(r.unplaced.length > 0);
  assert.equal(r.items.length + r.unplaced.length, 5);
  assert.deepEqual(hardViolations(tiny, r.items), []);
});

test('아주 큰 방(800×1000)에 가구 12개', () => {
  const room = { width: 800, depth: 1000, doors: [{ wall: 'bottom', offset: 100, size: 100 }], windows: [{ wall: 'top', offset: 200, size: 300 }, { wall: 'right', offset: 300, size: 250 }] };
  const specs = [S.bed_queen, S.nightstand, S.desk, S.chair, S.wardrobe, S.wardrobe, S.bookshelf, S.sofa, S.tv_stand, S.table, S.piano, S.rug];
  const t0 = performance.now();
  const r = recommend(room, specs);
  const ms = performance.now() - t0;
  assert.deepEqual(r.unplaced, []);
  assert.deepEqual(hardViolations(room, r.items), []);
  assert.deepEqual(checkLayout(room, r.items).issues.filter((i) => i.level === 'error'), []);
  assert.ok(ms < 1500, `${ms.toFixed(0)}ms`);
  // 짝 가구가 주인 옆에 놓인다
  const by = (name) => body(r.items.find((i) => i.name === name));
  const near = (a, b, d) => Math.max(Math.max(a.x - b.x - b.w, b.x - a.x - a.w, 0), Math.max(a.y - b.y - b.h, b.y - a.y - a.h, 0)) <= d;
  assert.ok(near(by('협탁'), by('퀸 침대'), 30), '협탁은 침대 옆');
  assert.ok(near(by('의자'), by('책상 1200'), 10), '의자는 책상 앞');
});

test('러그(floor)는 가구와 겹쳐도 되고 문 여는 공간은 피한다. clear가 0인 가구도 놓인다', () => {
  const room = { width: 400, depth: 500, doors: [{ wall: 'right', offset: 380, size: 90 }], windows: [{ wall: 'top', offset: 100, size: 200 }] };
  const r = recommend(room, [S.bed_queen, S.rug, S.plant, S.nightstand, S.sofa]);
  assert.deepEqual(r.unplaced, []);
  const rug = r.items.find((i) => i.floor);
  assert.ok(r.items.some((i) => !i.floor && overlaps(body(rug), body(i))), '러그가 가구 밑에 걸친다');
  assert.ok(!doorZones(room).some((z) => overlaps(body(rug), z)));
  assert.deepEqual(checkLayout(room, r.items).issues.filter((i) => i.level === 'error'), []);
});

test('선택 값이 빠진 사양, 이상한 입력에도 죽지 않는다', () => {
  const sparse = [{ name: '상자', w: 50, d: 50 }, { key: 'custom:x' }, {}, { name: '긴 선반', category: 'storage', w: 180, d: 30, h: 200 }, { name: '숫자가 글자', w: '80', d: '40', h: 'abc', clear: null, category: 'nope' }];
  const r = recommend(EXAMPLE_ROOM, sparse);
  assert.equal(r.items.length + r.unplaced.length, 5);
  assert.deepEqual(hardViolations(EXAMPLE_ROOM, r.items), []);
  for (const it of r.items) {
    assert.ok(typeof it.uid === 'string' && it.uid.length > 0);
    assert.ok(Number.isFinite(it.w) && Number.isFinite(it.d) && Number.isFinite(it.h) && typeof it.name === 'string');
  }
  assert.doesNotThrow(() => checkLayout(EXAMPLE_ROOM, r.items));
  assert.doesNotThrow(() => explain(EXAMPLE_ROOM, r.items));
  // 빈 입력
  const empty = recommend(EXAMPLE_ROOM, []);
  assert.deepEqual([empty.items, empty.unplaced, empty.variants, empty.score.total], [[], [], 1, 100]);
  assert.deepEqual(recommend(EXAMPLE_ROOM, null).items, []);
  assert.doesNotThrow(() => recommend(null, [S.bed_ss, null, 7]));
  assert.equal(checkLayout(EXAMPLE_ROOM, []).score.total, 100);
  assert.doesNotThrow(() => checkLayout(undefined, [{ x: 'a', y: null, rot: 45 }]));
  assert.doesNotThrow(() => checkLayout(EXAMPLE_ROOM, null));
});

test('구버전 방 형식 { door, window }으로도 추천과 검사가 된다', () => {
  const old = { width: 300, depth: 400, door: { wall: 'bottom', offset: 20, size: 90 }, window: { wall: 'top', offset: 50, size: 100 } };
  const a = recommend(old, EXAMPLE_SPECS);
  const b = recommend(EXAMPLE_ROOM, EXAMPLE_SPECS);
  assert.deepEqual(a, b);
  assert.deepEqual(checkLayout(old, a.items).issues, []);
});

test('rotateItem: 90도 돌리고 방 안에 남는다', () => {
  let it = place(S.bed_ss, 'x', 190, 0, 0);
  for (let i = 0; i < 4; i++) {
    const next = rotateItem(EXAMPLE_ROOM, it);
    assert.equal(next.rot, (it.rot + 90) % 360);
    const b = body(next);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 300 && b.y + b.h <= 400);
    assert.equal(next.uid, 'x');
    it = next;
  }
});

// ───────── 속도 ─────────
test('속도: 5×6m 방에 가구 10개 추천은 1초 안, checkLayout은 15ms 안', () => {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const room = { ...BIG_ROOM, depth: 600 - i * 10 }; // 캐시를 피하려고 방을 조금씩 바꾼다
    const t0 = performance.now();
    const r = recommend(room, TEN, 0);
    times.push(performance.now() - t0);
    assert.equal(r.items.length + r.unplaced.length, 10);
  }
  const worst = Math.max(...times);
  assert.ok(worst < 1000, `추천 ${times.map((t) => t.toFixed(0)).join(', ')}ms`);

  const r = recommend(BIG_ROOM, TEN, 0);
  const t1 = performance.now();
  recommend(BIG_ROOM, TEN, 1); // 같은 입력의 다른 배치안은 다시 계산하지 않는다
  assert.ok(performance.now() - t1 < 20);

  const N = 200;
  const t2 = performance.now();
  let pts = 0;
  for (let i = 0; i < N; i++) {
    const moved = r.items.map((it, k) => (k === 0 ? { ...it, x: it.x + (i % 7) * 5 } : it)); // 끌기 흉내
    const chk = checkLayout(BIG_ROOM, moved);
    pts += chk.issues.length;
  }
  const per = (performance.now() - t2) / N;
  assert.ok(per < 15, `checkLayout ${per.toFixed(2)}ms`);
  assert.ok(pts >= 0);
  console.log(`    속도: recommend ${times.map((t) => t.toFixed(0)).join('/')}ms (가장 느린 것 ${worst.toFixed(0)}ms), checkLayout ${per.toFixed(3)}ms`);
});
