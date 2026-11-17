// node --test src/three/skp.test.js — /api/skp 입력 검증(파이썬·SketchUp 없이 돌아간다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from '../../server/skp.js';

const item = (more) => ({ uid: 'a', key: 'wardrobe', name: '옷장', category: 'storage', w: 100, d: 60, h: 200, clear: 50, x: 0, y: 0, rot: 0, ...more });
const room = { width: 300, depth: 400, doors: [{ wall: 'bottom', offset: 195, size: 90 }], windows: [{ wall: 'top', offset: 150, size: 120 }] };

test('잘못된 입력은 받지 않는다', () => {
  assert.equal(buildScene(null), null);
  assert.equal(buildScene({ room: { width: '300', depth: 400 }, items: [] }), null);
  assert.equal(buildScene({ room: { width: 300, depth: 99999 }, items: [] }), null);
  assert.equal(buildScene({ room, items: 'x' }), null);
  assert.equal(buildScene({ room, items: [item({ w: 401 })] }), null);
  assert.equal(buildScene({ room, items: [item({ rot: 30 })] }), null);
  assert.equal(buildScene({ room, items: Array.from({ length: 41 }, () => item()) }), null);
});

test('이름은 안전한 글자만 남기고, 같은 이름은 번호를 붙인다', () => {
  const s = buildScene({
    room, items: [item(), item({ uid: 'b', x: 150 }), item({ uid: 'c', name: '<img src=x>"책상"\\..\\' })],
    style: { palette: [{ role: '벽', name: '웜 "화이트"; DROP', hex: '#F4F1EC' }, { role: '바닥', name: 5, hex: 'javascript:1' }] },
  });
  assert.deepEqual(s.items.map((it) => it.name), ['옷장', '옷장 2', 'img srcx책상..']);
  assert.equal(s.colors.wall, '#f4f1ec');
  assert.equal(s.matNames['#f4f1ec'], '벽 웜 화이트 DROP');
  assert.match(s.colors.floor, /^#[0-9a-f]{6}$/); // 잘못된 색은 기본색으로
  assert.ok(!JSON.stringify(s).includes('<') && !JSON.stringify(s).includes('\\\\'));
});

test('조감 카메라는 창문 반대쪽에 서고, 그쪽 두 벽만 숨긴다', () => {
  const s = buildScene({ room, items: [] });
  assert.ok(s.camera.eye[0] > 300 && s.camera.eye[1] > 400 && s.camera.eye[2] > 240);
  assert.deepEqual(s.camera.hide, ['벽 오른쪽', '벽 아래쪽']);
  const flipped = buildScene({ room: { ...room, windows: [{ wall: 'bottom', offset: 0, size: 100 }] }, items: [] });
  assert.ok(flipped.camera.eye[1] < 0);
  assert.deepEqual(flipped.camera.hide, ['벽 오른쪽', '벽 위쪽']);
  assert.deepEqual(s.walls.map((w) => w.name), ['벽 위쪽', '벽 아래쪽', '벽 왼쪽', '벽 오른쪽']);
});
