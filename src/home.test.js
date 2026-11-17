// node --test src/home.test.js  (브라우저 없이 돈다: 저장소는 가짜를 쓴다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, load, save, clearSaved, mergeParsed, priceKey } from './state.js';
import { MAX_ROOMS, openHome, readHome, writeHome, addRooms, openRoom, removeRoom, costOf } from './home.js';

// limit: 글자 수가 이보다 길면 저장을 거절한다(저장 공간이 모자란 브라우저 흉내)
function fakeStorage(limit = Infinity) {
  const mem = {};
  globalThis.localStorage = {
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { if (String(v).length > limit) throw new Error('quota'); mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
  return mem;
}
// 메인에서 가구를 적어 둔 상태
const furnished = (text) => ({ ...blank(), text, parsedText: text, specs: mergeParsed(text, []).specs });
const LIVING = { label: '거실', room: { width: 402, depth: 494, doors: [{ wall: 'top', offset: 125, size: 90, kind: 'entry' }], windows: [{ wall: 'bottom', offset: 24, size: 332, sill: 0, height: 210 }] } };
const BED = { label: '안방', room: { width: 350, depth: 420 } };

test('openHome: 메인에서 꾸미던 방을 잃지 않게 목록의 방으로 간직한다', () => {
  fakeStorage();
  assert.deepEqual(openHome(), { rooms: [], active: null }); // 손댄 것이 없으면 빈 목록
  save(furnished('침대, 책상'));
  const home = openHome();
  assert.equal(home.rooms.length, 1);
  assert.equal(home.active, home.rooms[0].id);
  assert.ok(home.rooms[0].state.specs.length > 0);
  assert.deepEqual(home.rooms[0].state.userPrices, {}); // 간직한 내용에는 방 표시를 남기지 않는다
  assert.deepEqual(openHome(), home); // 다시 들어와도 방이 또 생기지 않는다
});

test('방을 바꿔 가며 꾸며도 방마다 내용이 따로 남는다', async () => {
  fakeStorage();
  save(furnished('침대'));
  let home = addRooms(openHome(), [LIVING, BED]);
  assert.deepEqual(home.rooms.map((r) => r.name), ['지금 꾸미던 방', '거실', '안방']);
  const [first, living] = home.rooms;
  assert.equal(living.state.room.width, 402);
  assert.deepEqual(living.state.room.windows.map((w) => [w.sill, w.height]), [[0, 210]]); // 바닥까지 트인 창이 그대로 들어간다
  assert.equal(living.state.specs.length, 0);

  home = openRoom(home, living.id); // 거실을 메인에 올린다
  assert.equal(load().room.width, 402);
  assert.equal(load().specs.length, 0);
  // 메인 화면이 보여 줄 방 목록과 지금 방. 목록을 한 번만 읽기 때문에, 메인이 새로 뜬 것처럼 따로 불러온다
  const { homeRooms } = await import('./home.js?main');
  assert.deepEqual(homeRooms(load()), { rooms: home.rooms.map(({ id, name }) => ({ id, name })), current: living.id });
  assert.equal(homeRooms(blank()).current, null); // 집 전체 꾸미기에서 올린 방이 아니면 지금 방이 없다
  const sofa = furnished('소파, 책상').specs;
  save({ ...load(), specs: sofa }); // 메인에서 거실을 꾸민다
  home = openHome(); // 돌아오면 거실에 받아 둔다
  assert.equal(home.active, living.id);
  assert.equal(home.rooms[1].state.specs.length, sofa.length);
  assert.equal(home.rooms[1].state.room.width, 402);
  assert.deepEqual(home.rooms[0].state.specs, first.state.specs); // 먼저 꾸민 방은 그대로다
  assert.equal(home.rooms[2].state.specs.length, 0);

  home = openRoom(home, first.id); // 처음 방으로 돌아가면 그 방의 가구가 다시 올라온다
  assert.deepEqual(load().specs, first.state.specs);
  assert.deepEqual(openRoom(home, '없는 방'), home);
});

test('메인이 다른 방을 저장해도(뒤로 가기로 되살아난 옛 화면, 다른 탭) 방끼리 섞이지 않는다', () => {
  fakeStorage();
  let home = addRooms(openHome(), [LIVING, BED]);
  writeHome(home);
  const [living, bed] = home.rooms;
  openRoom(home, living.id);
  const old = load(); // 거실을 열어 둔 메인 화면이 기억하는 내용
  openRoom(openHome(), bed.id); // 안방으로 바꿔서 꾸민다
  const bedSpecs = furnished('침대').specs;
  save({ ...load(), specs: bedSpecs });
  assert.equal(openHome().active, bed.id);

  const sofa = furnished('소파').specs;
  save({ ...old, specs: sofa }); // 되살아난 거실 화면이 떠나면서 저장한다
  home = openHome();
  assert.equal(home.active, living.id); // 거실 것으로 알아본다
  assert.deepEqual(home.rooms.map((r) => [r.name, r.state.room.width, r.state.specs.length]), [['거실', 402, sofa.length], ['안방', 350, bedSpecs.length]]);

  // 표시가 없는 내용([예시 불러오기]는 가격 칸을 비워서 표시도 지운다)은 어느 방에도 덮어쓰지 않고 새 방이 된다
  save({ ...furnished('책상, 옷장'), userPrices: {} });
  home = openHome();
  assert.deepEqual(home.rooms.map((r) => r.name), ['거실', '안방', '지금 꾸미던 방']);
  assert.equal(home.active, home.rooms[2].id);
  assert.equal(home.rooms[0].state.specs.length, sofa.length);
  assert.equal(openHome().rooms.length, 3); // 다시 들어와도 또 생기지 않는다

  // 메인에서 [처음부터]를 눌러 비워도 간직한 방은 그대로다
  clearSaved();
  home = openHome();
  assert.equal(home.active, null);
  assert.deepEqual(home.rooms.map((r) => r.state.specs.length), [sofa.length, bedSpecs.length, 2]);
});

test('costOf: 메인의 비용 합계와 같은 방식으로 방마다 센다', () => {
  fakeStorage();
  assert.deepEqual(costOf(blank()), { count: 0, furniture: 0, props: 0, total: 0 }); // 가구가 없는 방은 소품도 세지 않는다
  const st = furnished('침대, 책상');
  const c = costOf(st);
  assert.equal(c.count, st.specs.length);
  assert.ok(c.furniture > 0);
  assert.equal(c.total, c.furniture + c.props);
  assert.equal(costOf({ ...st, withProps: false }).total, c.furniture); // 소품을 빼면 가구 값만
  const firstOnly = costOf({ ...st, specs: [st.specs[0]], withProps: false }).total;
  // 직접 적은 가격이 먼저다
  assert.equal(costOf({ ...st, userPrices: { [priceKey(st.specs[0])]: 1000 } }).furniture, c.furniture - firstOnly + 1000);
  // 이미 갖고 있는 가구는 0원으로 센다
  assert.equal(costOf({ ...st, specs: st.specs.map((s, i) => (i ? s : { ...s, owned: true })) }).furniture, c.furniture - firstOnly);
  assert.equal(costOf({ ...st, userPrices: { 'home|r1': 0 } }).total, c.total); // 방 표시는 금액을 바꾸지 않는다
  assert.equal(costOf({ specs: [{}] }), null); // 깨진 값이면 금액 없이
});

test('방을 빼면 다시 생기지 않고, 깨진 저장값은 버리고, 방은 정해진 수까지만 더한다', () => {
  const mem = fakeStorage();
  save(furnished('침대'));
  let home = openHome();
  home = removeRoom(home, home.active); // 메인에 올라가 있는 방을 뺀다
  writeHome(home);
  assert.deepEqual(home, { rooms: [], active: null });
  assert.deepEqual(openHome(), { rooms: [], active: null }); // 메인의 저장값도 비워서 다시 생기지 않는다

  mem['bangkkumi-home'] = JSON.stringify({ rooms: [{ id: 'a' }, { id: 'b', name: 7, state: { v: 1, specs: [] } }, { id: 'b', state: { specs: [] } }, null], active: 'zzz' });
  const read = readHome();
  assert.deepEqual(read.rooms.map((r) => [r.id, r.name]), [['b', '7']]);
  assert.equal(read.active, null);
  assert.ok(read.rooms[0].state.room.width > 0); // 방 모양은 기본값으로 채운다
  assert.equal('v' in read.rooms[0].state, false); // 손댄 v는 뗀다(남으면 메인이 그 방을 빈 방으로 읽는다)
  mem['bangkkumi-home'] = '{깨진 값';
  assert.equal(readHome(), null);

  const many = addRooms({ rooms: [], active: null }, Array.from({ length: MAX_ROOMS + 5 }, () => ({ label: '', room: {} })));
  assert.equal(many.rooms.length, MAX_ROOMS);
  assert.equal(new Set(many.rooms.map((r) => r.name)).size, MAX_ROOMS); // 이름이 겹치지 않는다
  // 방이 꽉 차 있어도 메인에서 꾸미던 방은 받아 둔다
  writeHome(many);
  clearSaved();
  save(furnished('소파'));
  assert.equal(openHome().rooms.length, MAX_ROOMS + 1);
});

test('writeHome: 저장 공간이 모자라면 도면 밑그림부터 빼고, 뺐다고 알려 준다', () => {
  const big = 'x'.repeat(4000);
  const room = (id) => ({ id, name: id, state: { ...blank(), room: { ...blank().room, underlay: big } } });
  const home = { rooms: [room('a'), room('b')], active: 'a' };
  const stored = (mem) => JSON.parse(mem['bangkkumi-home']).rooms.map((r) => !!r.state.room.underlay);

  let mem = fakeStorage();
  assert.equal(writeHome(home), true);
  assert.deepEqual(stored(mem), [true, true]);
  mem = fakeStorage(7000); // 메인에 올라가 있는 방(a)의 밑그림만 빼면 들어간다
  assert.equal(writeHome(home), 'trimmed');
  assert.deepEqual(stored(mem), [false, true]);
  mem = fakeStorage(3500);
  assert.equal(writeHome(home), 'trimmed');
  assert.deepEqual(stored(mem), [false, false]);
  fakeStorage(10);
  assert.equal(writeHome(home), false);
  delete globalThis.localStorage;
});
