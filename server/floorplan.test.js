// node --test server/floorplan.test.js  (네트워크와 AI를 부르지 않는다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { cleanAddress, imageSize, toPlan } from './floorplan.js';
import { normalizeRoom } from '../src/layout.js';

test('cleanAddress: 동·호수와 괄호는 밖으로 나가는 검색어에서 빠진다', () => {
  assert.deepEqual(cleanAddress('서울특별시 송파구 송파대로 345, 101동 1001호 (가락동, 헬리오시티)'),
    { query: '서울특별시 송파구 송파대로 345', name: '헬리오시티' });
  assert.equal(cleanAddress('서울 송파구 송파대로 345 101동 1001호').query, '서울 송파구 송파대로 345');
  assert.equal(cleanAddress('헬리오시티 제101동 12층').query, '헬리오시티');
  // 법정동 이름(가락동)은 주소의 일부라 남기고, 괄호 속이 동 이름뿐이면 단지 이름으로 쓰지 않는다
  assert.deepEqual(cleanAddress('서울시 송파구 가락동 913 (가락동)'), { query: '서울시 송파구 가락동 913', name: '' });
  assert.deepEqual(cleanAddress(null), { query: '', name: '' });
});

test('cleanAddress: 붙여 쓰거나 줄여 쓴 동·호수도 나가지 않고, 건물 번호와 단지 이름의 숫자는 남는다', () => {
  const road = '서울 송파구 송파대로 345';
  for (const unit of ['101동1001호', '101-1001', 'A동 1001호', '가동 101호', '101 동 1001 호', '지하1층 B102호', '제101동 제1001호', '1001']) {
    assert.equal(cleanAddress(`${road} ${unit}`).query, road, unit);
  }
  for (const unit of ['101동1001호', '101-1001', '101동 1001', 'B101호', '1001호']) {
    assert.equal(cleanAddress(`헬리오시티 ${unit}`).query, '헬리오시티', unit);
  }
  assert.deepEqual(cleanAddress(`${road}(101동 1001호)`), { query: road, name: '' });
  assert.equal(cleanAddress(`${road} (가락동, 헬리오시티 101동 1001호)`).name, '헬리오시티');

  assert.equal(cleanAddress('서울 송파구 백제고분로7길 16-12 3층').query, '서울 송파구 백제고분로7길 16-12');
  assert.equal(cleanAddress('서울 송파구 가락동 913-1 헬리오시티 101동').query, '서울 송파구 가락동 913-1 헬리오시티');
  assert.equal(cleanAddress('힐스테이트 2차 101동').query, '힐스테이트 2차');
  assert.equal(cleanAddress('잠실동 19 리센츠').query, '잠실동 19 리센츠');
  // 길·동·단지 이름에 원래 들어가는 숫자는 그대로 나간다
  for (const ok of ['서울 종로구 종로1가 24', '부산 해운대구 마린시티2로 38', '경기 성남시 분당구 성남대로 331번길 8', '서울 송파구 잠실주공5단지', '서울 중구 다동 123', 'e편한세상 2차']) {
    assert.equal(cleanAddress(ok).query, ok);
  }
  assert.equal(cleanAddress('경기 성남시 분당구 판교역로 235번길 12 101동 1001호').query, '경기 성남시 분당구 판교역로 235번길 12');
  assert.equal(cleanAddress('서울 영등포구 63로 45 101동').query, '서울 영등포구 63로 45');
  assert.equal(cleanAddress('서울 종로구 종로 1가 24').query, '서울 종로구 종로 1가 24');
  assert.equal(cleanAddress('경기 용인시 수지구 풍덕천동 산 12-3').query, '경기 용인시 수지구 풍덕천동 산12-3');
  assert.equal(cleanAddress('05698 서울특별시 송파구 송파대로 345').query, '서울특별시 송파구 송파대로 345'); // 맨 앞의 우편번호
  // 이름에 붙여 쓴 동, 글자로 쓴 동, 동 이름 없이 쓴 숫자는 단지 이름만 남긴다
  for (const [input, want] of [['헬리오시티101동 1001호', '헬리오시티'], ['헬리오시티A동 1001호', '헬리오시티'], ['헬리오시티 가동 101호', '헬리오시티'],
    ['은마아파트12동 505호', '은마아파트'], ['타워팰리스 A-1001', '타워팰리스'], ['한솔빌라 나동 201', '한솔빌라'], ['헬리오시티 [101동 1001호]', '헬리오시티'],
    ['헬리오시티 동:101 호:1001', '헬리오시티'], ['개나리 101 905', '개나리'], ['헬리오시티 에이동 101호', '헬리오시티'], ['잠실주공5단지 101 905', '잠실주공5단지']]) {
    assert.equal(cleanAddress(input).query, want, input);
  }
});

test('cleanAddress: 동·호수를 어떻게 적어도 그 숫자와 글자는 나가지 않는다', () => {
  // 동 707, 호 9092, 글자 동 Z·카는 건물 주소와 단지 이름에 없는 값이라, 결과에 보이면 샌 것이다
  const bases = ['서울 송파구 송파대로 345', '헬리오시티', '서울 송파구 가락동 913 헬리오시티', '서울 송파구 송파대로 345 (가락동, 헬리오시티)'];
  const units = ['707동 9092호', '707동9092호', '707-9092', '#707-9092', '707동 9092', '제707동 제9092호', '７０７동 ９０９２호',
    'Z동 9092호', 'Z-9092', 'Z9092', '카동 9092호', '707 동 9092 호', '지하7층 Z9092호', '707동\t9092호', '(707동 9092호', '707동 90층 9092호'];
  for (const base of bases) {
    for (const unit of units) {
      const inputs = [`${base} ${unit}`, `${base}, ${unit}`, `${base}(${unit})`, `${base}\t${unit}`];
      if (/[가-힣]$/.test(base) && /^\d/.test(unit)) inputs.push(`${base}${unit}`); // 이름에 붙여 쓴 것
      for (const input of inputs) {
        const { query, name } = cleanAddress(input);
        assert.doesNotMatch(`${query}|${name}`, /707|9092|90층|Z|카동|지하/, input);
      }
    }
  }
});

test('FLOORPLAN_LOOKUP=off: 빈칸이 붙거나 대문자여도 주소 요청은 403이고 직방을 부르지 않는다', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('테스트에서는 밖으로 나가지 않는다'); };
  process.env.FLOORPLAN_LOOKUP = 'OFF '; // cmd의 `set FLOORPLAN_LOOKUP=off && npm start`처럼 빈칸이 붙은 값
  try {
    const { default: handler } = await import('./floorplan.js?off'); // 값은 불러올 때 한 번 읽는다
    const req = (type, body) => Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST', headers: { 'content-type': type } });
    let sent = null;
    await handler({ method: 'GET', headers: {} }, { setHeader() {}, end: (body) => { sent = JSON.parse(body); } });
    assert.deepEqual(sent, { lookup: false });
    for (const body of [{ address: '서울 송파구 송파대로 345' }, { complex: 1 }, { complex: 1, type: 2 }]) {
      await assert.rejects(handler(req('application/json', JSON.stringify(body)), {}), (e) => e.status === 403);
    }
    await assert.rejects(handler(req('image/png', 'not an image'), {}), (e) => e.status === 400); // 그림 올리기는 열려 있다
    assert.equal(calls, 0);
  } finally {
    delete process.env.FLOORPLAN_LOOKUP;
    globalThis.fetch = realFetch;
  }
});

test('직방이 엉뚱한 답을 주면 기억하지 않고, 맞는 답은 기억해서 다시 부르지 않는다', async () => {
  const realFetch = globalThis.fetch;
  const answers = [{ code: 'TOO_MANY_REQUESTS' }, { items: [{ type: 'apartment', id: 7, name: '시험단지' }] }, { name: '시험단지', room_types: [{ id: 1, room_type_title: { m2: '84A' } }] }];
  let calls = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => answers[Math.min(calls++, answers.length - 1)] });
  process.env.FLOORPLAN_LOOKUP = 'on'; // 주소로 찾기는 기본이 꺼짐이라 켜고 시험한다
  try {
    const { default: handler } = await import('./floorplan.js?memo');
    const ask = async () => {
      let out = null;
      const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ address: '서울 송파구 송파대로 345' }))]), { method: 'POST', headers: { 'content-type': 'application/json' } });
      await handler(req, { setHeader() {}, end: (body) => { out = JSON.parse(body); } });
      return out;
    };
    await assert.rejects(ask(), (e) => e.status === 404); // 엉뚱한 답이라 단지를 못 찾는다
    assert.equal((await ask()).complex.name, '시험단지'); // 기억하지 않았으니 다시 물어서 찾는다
    assert.equal(calls, 3); // 검색 2번 + 평형 목록 1번
    await ask();
    assert.equal(calls, 3); // 맞는 답은 기억해서 다시 부르지 않는다
  } finally {
    delete process.env.FLOORPLAN_LOOKUP;
    globalThis.fetch = realFetch;
  }
});

test('주소로 찾기는 따로 켜지 않으면 꺼져 있다: 주소 요청은 403이고 직방을 부르지 않는다', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('테스트에서는 밖으로 나가지 않는다'); };
  delete process.env.FLOORPLAN_LOOKUP;
  try {
    const { default: handler } = await import('./floorplan.js?default');
    let sent = null;
    await handler({ method: 'GET', headers: {} }, { setHeader() {}, end: (body) => { sent = JSON.parse(body); } });
    assert.deepEqual(sent, { lookup: false });
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ address: '서울 송파구 송파대로 345' }))]), { method: 'POST', headers: { 'content-type': 'application/json' } });
    await assert.rejects(handler(req, {}), (e) => e.status === 403);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('imageSize: PNG와 JPEG의 크기를 읽고, 다른 파일은 null', () => {
  const png = Buffer.alloc(40);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(1600, 16);
  png.writeUInt32BE(1200, 20);
  assert.deepEqual(imageSize(png), { type: 'image/png', w: 1600, h: 1200 });

  // SOI, APP0(길이 16), SOF0(높이 1125, 폭 1500)
  const jpg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14),
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x65, 0x05, 0xdc]), Buffer.alloc(20),
  ]);
  assert.deepEqual(imageSize(jpg), { type: 'image/jpeg', w: 1500, h: 1125 });

  assert.equal(imageSize(Buffer.from('<html>not an image</html>'.repeat(4))), null);
  assert.equal(imageSize(Buffer.alloc(0)), null);
});

const AI = {
  imageWidthCm: 1000,
  rooms: [
    { name: '침실1', kind: 'bedroom', inside: true, box: [0, 0, 400, 300],
      doors: [{ wall: 'right', from: 200, to: 290, kind: 'bath' }, { wall: 'bottom', from: 50, to: 140, kind: 'entry' }],
      windows: [{ wall: 'top', from: 100, to: 300, full: false }, { wall: 'left', from: 50, to: 250, full: true }] },
    { name: '거실', kind: 'living', inside: true, box: [400, 0, 1000, 500], doors: [{ wall: 'left', from: 350, to: 450 }], windows: [] },
    { name: '발코니', kind: 'balcony', inside: false, box: [0, 300, 400, 420], doors: [], windows: [] },
    { name: '<b>이상한 값</b>', box: [1, 2, 'x', 4] },
    { name: '너무 작음', box: [10, 10, 15, 15] },
  ],
};

test('toPlan: 전용면적에 맞춰 축척을 정하고 규약(2절) 형식의 문·창문을 만든다', () => {
  // 1000×1000px 그림. 전용면적에 드는 상자 넓이 = 400×300 + 600×500 = 420,000px² → 42㎡이면 1px = 1cm
  const plan = toPlan(AI, { w: 1000, h: 1000 }, 42);
  assert.equal(plan.scale.basis, 'area');
  assert.equal(plan.scale.cmPerPx, 1);
  assert.deepEqual(plan.bounds, { x: 0, y: 0, w: 1000, h: 1000 });
  assert.deepEqual(plan.rooms.map((r) => r.label), ['거실', '침실1', '발코니']); // 넓은 순, 깨진 값과 너무 작은 것은 빠진다

  const bed = plan.rooms[1];
  assert.deepEqual([bed.x, bed.y, bed.w, bed.h], [0, 0, 400, 300]);
  // 출입문(entry)이 맨 앞으로 온다
  assert.deepEqual(bed.doors, [
    { wall: 'bottom', offset: 50, size: 90, kind: 'entry' },
    { wall: 'right', offset: 200, size: 90, kind: 'bath' },
  ]);
  assert.deepEqual(bed.windows, [
    { wall: 'top', offset: 100, size: 200, sill: 90, height: 120 },
    { wall: 'left', offset: 50, size: 200, sill: 0, height: 210 }, // 바닥까지 내려오는 창
  ]);
  // 거실 문: 폭은 150까지, 벽 밖으로 나가지 않게, 종류가 없으면 첫 문이 출입문
  assert.deepEqual(plan.rooms[0].doors, [{ wall: 'left', offset: 350, size: 100, kind: 'entry' }]);

  // 메인의 normalizeRoom을 거쳐도 문·창문이 그대로다 (형식이 맞다는 뜻)
  for (const r of plan.rooms.slice(0, 2)) {
    const n = normalizeRoom({ width: r.w, depth: r.h, doors: r.doors, windows: r.windows });
    assert.deepEqual(n.doors, r.doors);
    assert.deepEqual(n.windows, r.windows);
  }
});

test('toPlan: 전용면적을 모르면 AI가 어림한 그림 가로 길이를 쓰고, 그것도 없으면 기본값', () => {
  const byAi = toPlan(AI, { w: 2000, h: 1000 });
  assert.equal(byAi.scale.basis, 'ai');
  assert.equal(byAi.scale.cmPerPx, 0.5);
  assert.match(byAi.notice, /꼭 확인/);
  assert.equal(toPlan({ ...AI, imageWidthCm: 'abc' }, { w: 1200, h: 900 }).scale.basis, 'default');
});

test('toPlan: 방을 못 찾으면 422', () => {
  for (const bad of [null, {}, { rooms: 'x' }, { rooms: [{ box: [0, 0, 5, 5] }] }]) {
    assert.throws(() => toPlan(bad, { w: 1000, h: 1000 }, 84), (e) => e.status === 422);
  }
});

test('toPlan: 문 폭은 150까지, 벽 밖의 문은 벽 안으로, 같은 벽에서 겹친 문은 하나만', () => {
  const ai = { rooms: [{ name: '방', box: [0, 0, 400, 300], doors: [
    { wall: 'top', from: 50, to: 350, kind: 'entry' }, { wall: 'top', from: 100, to: 190 },
    { wall: 'right', from: 990, to: 900 }, { wall: 'left', from: 10, to: 20 },
  ] }, { name: '좁은 곳', box: [500, 0, 550, 300], doors: [{ wall: 'top', from: 500, to: 550 }] }] };
  const plan = toPlan(ai, { w: 1000, h: 1000 }, 13.5); // 135,000px² = 13.5㎡ → 1px = 1cm
  assert.deepEqual(plan.rooms[0].doors, [
    { wall: 'top', offset: 50, size: 150, kind: 'entry' },
    { wall: 'right', offset: 210, size: 90, kind: 'etc' },
    { wall: 'left', offset: 10, size: 60, kind: 'etc' },
  ]);
  assert.equal(plan.rooms.length, 1); // 폭 50cm인 곳은 빠진다
  assert.throws(() => toPlan({ rooms: [{ box: [0, 0, 500, 500] }] }, { w: 1000, h: 1000 }, 0.2), (e) => e.status === 422);
});

test('toPlan: 발코니와 맞닿은 벽의 창은 바닥까지 트인 창(구획용 창호)이 된다', () => {
  const ai = { rooms: [
    { name: '침실1', kind: 'bedroom', inside: true, box: [0, 0, 400, 300],
      windows: [{ wall: 'bottom', from: 100, to: 350, full: false }, { wall: 'left', from: 50, to: 150, full: false }] },
    { name: '발코니', kind: 'balcony', inside: false, box: [0, 315, 400, 440], windows: [] }, // 벽 두께만큼 떨어져 있다
    { name: '침실2', kind: 'bedroom', inside: true, box: [400, 0, 700, 300], windows: [{ wall: 'bottom', from: 450, to: 650, full: false }] }, // 아래에 발코니가 없다
  ] };
  const plan = toPlan(ai, { w: 1000, h: 1000 }, 21); // 210,000px² = 21㎡ → 1px = 1cm
  const room = (label) => plan.rooms.find((r) => r.label === label);
  assert.deepEqual(room('침실1').windows, [
    { wall: 'bottom', offset: 100, size: 250, sill: 0, height: 210 }, // 발코니 쪽: 바닥까지
    { wall: 'left', offset: 50, size: 100, sill: 90, height: 120 }, // 바깥 벽의 보통 창
  ]);
  assert.deepEqual(room('침실2').windows, [{ wall: 'bottom', offset: 50, size: 200, sill: 90, height: 120 }]);
});

test('toPlan: 겹친 상자는 넓이를 한 번만 센다', () => {
  const two = { rooms: [{ name: 'A', box: [0, 0, 500, 500] }, { name: 'B', box: [0, 0, 500, 500] }] };
  assert.equal(toPlan(two, { w: 1000, h: 1000 }, 25).scale.cmPerPx, 1); // 250,000px² = 25㎡
});
