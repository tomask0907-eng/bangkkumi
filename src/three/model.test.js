// node --test src/three/model.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normRoom, colorsOf, roomModel, wallOpenings, cleanItem, kindOf, itemBoxes, rotDims, eyeView } from './model.js';

const C = colorsOf(null);
const bed = (rot, x = 50, y = 60) => ({ uid: 'b', key: 'bed_ss', name: '슈퍼싱글 침대', category: 'bed', w: 110, d: 200, h: 45, clear: 0, x, y, rot });
const bounds = (boxes) => ({
  x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)),
  y0: Math.min(...boxes.map((b) => b.y0)), y1: Math.max(...boxes.map((b) => b.y1)),
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.5, `${a} ≈ ${b}`);

test('회전해도 부품이 몸체 사각형을 꽉 채우고 벗어나지 않는다', () => {
  for (const rot of [0, 90, 180, 270]) {
    const it = bed(rot), { w, h } = rotDims(it), b = bounds(itemBoxes(it, C));
    near(b.x0, it.x); near(b.y0, it.y); near(b.x1, it.x + w); near(b.y1, it.y + h);
  }
});

test('등(침대 머리판)이 CONTRACT 3절의 방향에 있다', () => {
  // 머리판 = 가장 높은 부품. 0: 위(-y), 90: 오른쪽(+x), 180: 아래(+y), 270: 왼쪽(-x)
  const head = (rot) => itemBoxes(bed(rot, 0, 0), C).reduce((a, b) => (b.t > a.t ? b : a));
  near(head(0).y0, 0); assert.ok(head(0).y1 < 10);
  near(head(90).x1, 200); assert.ok(head(90).x0 > 190);
  near(head(180).y1, 200); assert.ok(head(180).y0 > 190);
  near(head(270).x0, 0); assert.ok(head(270).x1 < 10);
});

test('책상 의자는 앞쪽 사용 공간에 놓인다', () => {
  const desk = (rot) => ({ uid: 'd', key: 'desk', name: '책상', category: 'desk', w: 120, d: 60, h: 72, clear: 60, x: 100, y: 100, rot });
  assert.ok(bounds(itemBoxes(desk(0), C)).y1 > 160 + 30); // 앞이 +y
  assert.ok(bounds(itemBoxes(desk(90), C)).x0 < 100 - 30); // 앞이 -x
  assert.ok(bounds(itemBoxes(desk(180), C)).y0 < 100 - 30); // 앞이 -y
  assert.ok(bounds(itemBoxes(desk(270), C)).x1 > 160 + 30); // 앞이 +x
});

test('이름으로 모양을 고른다', () => {
  const k = (name, category = 'etc', more) => kindOf({ name, key: `custom:${name}`, category, w: 60, d: 60, h: 60, ...more });
  assert.deepEqual(
    ['슈퍼싱글 침대', '침대 협탁', '책상', '책상 의자', '옷장', '책장', '2인 소파', '소파 테이블', 'TV 거실장', '스탠드 행거', '장스탠드 조명', '냉장고', '전신거울', '화분', '전자피아노'].map((n) => k(n)),
    ['bed', 'drawer', 'desk', 'chair', 'wardrobe', 'bookshelf', 'sofa', 'table', 'tv', 'hanger', 'lamp', 'fridge', 'mirror', 'plant', 'piano'],
  );
  assert.equal(k('캣타워'), 'box');
  assert.equal(k('신발장', 'storage', { h: 180 }), 'wardrobe');
  assert.equal(k('무언가', 'decor', { floor: true }), 'rug');
});

test('방: 빠진 값 보정, 구버전 형식, 겹친 구멍 버리기', () => {
  const r = normRoom({ width: 300, depth: 400, door: { wall: 'bottom', offset: 999, size: 90 }, window: { wall: 'top', offset: 60, size: 120 } });
  assert.deepEqual(r.doors, [{ wall: 'bottom', size: 90, offset: 210, kind: 'etc' }]);
  assert.deepEqual(r.windows, [{ wall: 'top', size: 120, offset: 60, sill: 90, height: 120 }]);
  assert.equal(normRoom(null).height, 240);
  const two = normRoom({ width: 300, depth: 400, doors: [{ wall: 'top', offset: 0, size: 90 }], windows: [{ wall: 'top', offset: 50, size: 100 }, { wall: 'top', offset: 150, size: 100 }] });
  assert.deepEqual(wallOpenings(two, 'top').map((o) => o.u0), [0, 150]);
});

test('벽 조각이 방 바깥쪽에만 있고 구멍 자리는 비어 있다', () => {
  const room = normRoom({ width: 300, depth: 400, doors: [{ wall: 'bottom', offset: 195, size: 90 }], windows: [{ wall: 'top', offset: 150, size: 120 }] });
  const m = roomModel(room, C);
  const solid = (wall) => m.walls[wall].boxes.filter((b) => b.wall);
  for (const b of solid('top')) assert.ok(b.y1 <= 0 && b.y0 >= -10);
  for (const b of solid('bottom')) assert.ok(b.y0 >= 400 && b.y1 <= 410);
  for (const b of solid('left')) assert.ok(b.x1 <= 0);
  for (const b of solid('right')) assert.ok(b.x0 >= 300);
  // 문 구멍(195~285, 높이 0~205)과 겹치는 벽 조각이 없어야 한다
  assert.ok(!solid('bottom').some((b) => b.x0 < 285 && b.x1 > 195 && b.b < 205));
  // 문짝은 방 안쪽(y < 400)으로 열린다
  assert.ok(m.walls.bottom.polys[0].pts.every(([, y]) => y <= 400.01));
  assert.ok(m.walls.bottom.polys[0].pts.some(([, y]) => y < 340));
});

test('눈높이 시점: 열린 문짝과 손잡이가 모두 카메라 뒤에 있다', () => {
  // 문이 벽 가운데·모서리·끝에 있는 경우를 네 벽 모두에서 본다
  for (const [width, depth] of [[300, 400], [620, 620], [1500, 1500]]) {
    for (const wall of ['top', 'bottom', 'left', 'right']) {
      const len = wall === 'top' || wall === 'bottom' ? width : depth;
      for (const [offset, size] of [[0, 90], [(len - 90) / 2, 90], [len - 90, 90], [len / 2 - 20, 60], [len / 3, 120]]) {
        const room = normRoom({ width, depth, doors: [{ wall, offset, size }] });
        const { pos, target } = eyeView(room);
        assert.ok(pos[0] > 0 && pos[0] < width && pos[1] > 0 && pos[1] < depth, '카메라는 방 안');
        assert.ok(target[0] > 0 && target[0] < width && target[1] > 0 && target[1] < depth, '보는 곳도 방 안');
        for (const q of roomModel(room, C).walls[wall].polys) {
          for (const [x, y] of q.pts) {
            const ahead = (x - pos[0]) * (target[0] - pos[0]) + (y - pos[1]) * (target[1] - pos[1]);
            assert.ok(ahead < 0, `${width}×${depth} ${wall} offset ${offset} size ${size}: 문짝이 시야 앞에 있음`);
          }
        }
      }
    }
  }
  // 문이 없어도, 아주 작은 방이어도 방 안쪽을 본다
  assert.deepEqual(eyeView(normRoom({ width: 300, depth: 400 })).pos, [150, 316]);
  const tiny = eyeView(normRoom({ width: 150, depth: 150, doors: [{ wall: 'top', offset: 30, size: 90 }] }));
  assert.ok(tiny.pos[1] < 75 && tiny.target[1] > 75);
});

test('가구 입력 검증', () => {
  assert.equal(cleanItem({ ...bed(0), w: 5000 }), null);
  assert.equal(cleanItem({ ...bed(0), rot: 45 }), null);
  assert.equal(cleanItem({ ...bed(0), x: '0' }), null);
  const ok = cleanItem({ ...bed(0), name: '침대<script>"\\/|*?\n', color: 'red', category: 'x' });
  assert.equal(ok.name, '침대script');
  assert.equal(ok.color, null);
  assert.equal(ok.category, 'etc');
});
