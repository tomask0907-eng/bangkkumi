// 실행: node --test src/v3/three/
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, STYLE_PRESETS, defaultSpec } from '../../catalog.js';
import { colorsOf, paletteFive, tintColors, normRoom, roomModel, itemBoxes, kindOf } from './model.js';

const HEX = /^#[0-9a-f]{6}$/;

test('colorsOf: 팔레트(벽·바닥·메인 가구·패브릭·포인트)를 평면도와 같은 대응으로 쓰고, 화면의 --c 값이 먼저다', () => {
  const style = { palette: ['#f3f6f8', '#d8d1c6', '#e3cdae', '#8fb8de', '#f2c6a0'].map((hex) => ({ hex })) };
  const C = colorsOf(style);
  assert.equal(C.wood, '#eddeca'); // 메인 가구 = palette[2]: color-mix(#e3cdae 66%, #fff)
  assert.equal(C.fabric, '#c0d7ed'); // 패브릭 = palette[3]: color-mix(#8fb8de 56%, #fff)
  assert.equal(C.rug, '#f7dec8'); // 포인트 = palette[4]: color-mix(#f2c6a0 58%, #fff)
  assert.equal(C.small, '#45596e'); // 다섯 색 중 가장 어두운 #8fb8de 가 밝아서 짙은 남색과 섞는다
  // 평면도의 paletteVars(symbols.jsx)와 같은 대응: 벽 = [0], 메인 가구 = [2], 패브릭 = [3], 포인트 = [4]. 바닥색 [1] 은 쓰지 않는다
  for (const st of Object.values(STYLE_PRESETS)) {
    const hex = st.palette.map((p) => p.hex.toLowerCase());
    assert.deepEqual(paletteFive(st).slice(0, 4), [hex[0], hex[2], hex[3], hex[4]], st.name);
    assert.match(paletteFive(st)[4], HEX);
  }
  assert.equal(colorsOf(STYLE_PRESETS.minimal, ['', '#000000', 'red']).wood, '#575757'); // 틀린 값('', 'red')은 건너뛴다
  for (const bad of [null, {}, { palette: [{ hex: 'x' }] }]) for (const v of Object.values(colorsOf(bad))) assert.match(v, HEX);
});

test('tint: 사진·링크로 추가한 가구는 그 색으로 칠하고, tint 가 없거나 틀리면 그대로다', () => {
  const C = colorsOf(STYLE_PRESETS.nordic || STYLE_PRESETS.minimal);
  assert.equal(tintColors(C, undefined), C);
  assert.equal(tintColors(C, 'red'), C);
  const T = tintColors(C, '#1F2F4F');
  assert.equal(T.wood, '#6b768b'); // color-mix(#1f2f4f 66%, #fff) — 평면도의 tintVars 와 같은 값
  assert.equal(T.small, C.small);
  for (const key of ['sofa', 'desk', 'wardrobe', 'fridge', 'bed']) {
    const spec = CATALOG[key] || defaultSpec(key);
    const plain = itemBoxes({ ...spec, uid: 'u', x: 0, y: 0, rot: 0 }, C), tinted = itemBoxes({ ...spec, uid: 'u', x: 0, y: 0, rot: 0, tint: '#1f2f4f' }, C);
    assert.equal(plain.length, tinted.length);
    assert.ok(tinted.some((b, i) => b.c !== plain[i].c), `${key}: 색이 바뀌어야 한다`);
    for (const b of tinted) assert.match(b.c, HEX);
    assert.deepEqual(itemBoxes({ ...spec, uid: 'u', x: 0, y: 0, rot: 0, tint: 'javascript:1' }, C), plain);
  }
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
