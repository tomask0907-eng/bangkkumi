// 실행: node --test src/v3/three/
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, STYLE_PRESETS, defaultSpec } from '../../catalog.js';
import { colorsOf, normRoom, roomModel, itemBoxes, kindOf } from './model.js';

const HEX = /^#[0-9a-f]{6}$/;

test('colorsOf: 팔레트 순서대로 평면도와 같은 식으로 섞고, 화면의 --c 값이 먼저다', () => {
  const C = colorsOf({ palette: ['#f3f6f8', '#e3cdae', '#8fb8de', '#f2c6a0', '#3f5f7f'].map((hex) => ({ hex })) });
  assert.equal(C.wood, '#eddeca'); // color-mix(#e3cdae 66%, #fff)
  assert.equal(C.fabric, '#c0d7ed'); // color-mix(#8fb8de 56%, #fff)
  assert.equal(C.rug, '#f7dec8'); // color-mix(#f2c6a0 58%, #fff)
  assert.equal(C.small, '#3f5f7f');
  assert.equal(colorsOf(STYLE_PRESETS.minimal, ['', '#000000', 'red']).wood, '#575757'); // 틀린 값('', 'red')은 건너뛴다
  for (const bad of [null, {}, { palette: [{ hex: 'x' }] }]) for (const v of Object.values(colorsOf(bad))) assert.match(v, HEX);
});

test('모든 카탈로그 가구, 실제 상품, 모르는 가구가 네 방향 모두 쓸 수 있는 상자가 된다', () => {
  const C = colorsOf(STYLE_PRESETS.industrial);
  const specs = [...Object.values(CATALOG), { ...CATALOG.dresser, product: { id: 'dnw-1', w: 60, d: 40, h: 110 }, w: 60, d: 40, h: 110 },
    defaultSpec('안마기'), { name: '이름 모를 것', category: 'etc', w: 10, d: 10, h: 1 }, { name: '', w: 400, d: 400, h: 300 }];
  for (const s of specs) for (const rot of [0, 90, 180, 270]) {
    const boxes = itemBoxes({ ...s, uid: 'u', x: 10, y: 20, rot }, C);
    assert.ok(boxes.length > 0, s.name);
    for (const b of boxes) {
      assert.ok([b.x0, b.x1, b.y0, b.y1, b.b, b.t].every(Number.isFinite) && b.x1 > b.x0 && b.y1 > b.y0 && b.t > b.b && b.b >= 0, `${s.name} ${JSON.stringify(b)}`);
      assert.match(b.c, HEX, s.name);
      assert.ok(b.t <= Math.max(s.h, 45) + 120, `${s.name}: 너무 높다 ${b.t}`); // 책상 위 모니터, TV장 위 TV까지
    }
  }
});

test('kindOf: 열쇠 낱말에 속지 않는다', () => {
  assert.equal(kindOf(CATALOG.sofa_bed), 'sofa'); // 'bed'가 들어 있어도 소파
  assert.equal(kindOf(CATALOG.shoe_rack), 'drawer'); // 'rack'이 들어 있어도 옷걸이가 아니다
  assert.equal(kindOf(CATALOG.nightstand), 'drawer');
  assert.equal(kindOf(CATALOG.floor_lamp), 'lamp');
});

test('roomModel: 문과 창문이 있어도 벽 조각이 겹치지 않고 높이 안에 있다', () => {
  const room = normRoom({ width: 400, depth: 300, doors: [{ wall: 'bottom', offset: 20, size: 90 }], windows: [{ wall: 'top', offset: 110, size: 140 }, { wall: 'left', offset: 0, size: 9999 }] });
  const m = roomModel(room);
  for (const wall of Object.values(m.walls)) for (const b of wall.boxes) assert.ok(b.x1 > b.x0 && b.y1 > b.y0 && b.t > b.b && b.t <= room.height && b.b >= 0);
  assert.equal(m.walls.bottom.polys.length, 2); // 문짝 + 손잡이
});
