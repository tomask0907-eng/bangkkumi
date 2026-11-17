// DXF 읽기 → 방 후보 찾기까지 손으로 만든 작은 도면으로 확인한다. 실행: node --test server/dwg/dwg.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readDxf } from './dxf.js';
import { orientDoorArcs } from './rooms.js';
import handler, { toPlan } from '../dwg.js';
import { doorsForRect, underlayFor, snapIndex, snapPoint, defaultDoor } from '../../src/dwg/geom.js';

const g = (...pairs) => pairs.join('\n');
const line = (x1, y1, x2, y2, layer = 'WAL') => g(0, 'LINE', 8, layer, 10, x1, 20, y1, 30, 0, 11, x2, 21, y2, 31, 0);

// 4m × 3m 방(mm 단위). 아래 벽(y=0)에 90cm 문, 위 벽·왼쪽 벽은 블록(길이 1000짜리 선)을 늘리고 돌려서 넣는다.
function sample({ insunits = 4, extra = '' } = {}) {
  return g(
    0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1032', 9, '$INSUNITS', 70, insunits, 0, 'ENDSEC',
    0, 'SECTION', 2, 'BLOCKS',
    0, 'BLOCK', 8, '0', 2, 'B1', 70, 0, 10, 0, 20, 0, 30, 0, 3, 'B1', line(0, 0, 1000, 0, '0'), 0, 'ENDBLK', 8, '0',
    0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES',
    line(0, 0, 1000, 0), line(1900, 0, 4000, 0), // 아래 벽 (문 자리는 비움)
    line(4000, 0, 4000, 3000), // 오른쪽 벽
    g(0, 'INSERT', 8, 'WAL', 2, 'B1', 10, 0, 20, 3000, 30, 0, 41, 4, 42, 4, 43, 4), // 위 벽
    g(0, 'INSERT', 8, 'WAL', 2, 'B1', 10, 0, 20, 0, 30, 0, 41, 3, 42, 3, 43, 3, 50, 90), // 왼쪽 벽
    g(0, 'LWPOLYLINE', 8, 'WAL', 90, 4, 70, 1, 10, -200, 20, -200, 10, 4200, 20, -200, 10, 4200, 20, 3200, 10, -200, 20, 3200), // 바깥 벽선
    g(0, 'ARC', 8, 'WID', 10, 1000, 20, 0, 30, 0, 40, 900, 50, 0, 51, 90), // 문 여는 호
    g(0, 'TEXT', 8, 'TXT', 10, 1800, 20, 1500, 30, 0, 40, 200, 1, '침실'),
    line(500, 500, 2500, 500, 'FUR'), // 가구 선은 벽으로 치지 않는다
    ...(extra ? [extra] : []),
    0, 'ENDSEC', 0, 'EOF', '',
  );
}

test('DXF를 읽어 cm로 바꾸고 방·문·이름을 찾는다', () => {
  const plan = toPlan(readDxf(Buffer.from(sample())));
  assert.equal(plan.unit, 'mm');
  assert.deepEqual(plan.bounds, { x: 0, y: 0, w: 440, h: 340 });
  assert.ok(plan.lines.length >= 10 && plan.lines.length <= 20000);
  const room = plan.rooms.find((r) => Math.abs(r.w - 400) < 1 && Math.abs(r.h - 300) < 1);
  assert.ok(room, `4m×3m 방을 찾아야 한다: ${JSON.stringify(plan.rooms)}`);
  assert.equal(room.label, '침실');
  assert.deepEqual(room.doors, [{ wall: 'bottom', offset: 100, size: 90, kind: 'entry' }]);
  assert.deepEqual(room.windows, []);
});

test('단위가 없으면 크기로 짐작하고, 멀리 떨어진 도형은 버린다', () => {
  const far = line(9e7, 9e7, 9e7 + 500, 9e7);
  const plan = toPlan(readDxf(Buffer.from(sample({ insunits: 0, extra: far }))));
  assert.equal(plan.unit, 'mm');
  assert.equal(plan.bounds.w, 440);
});

test('doorsForRect / underlayFor / snapPoint / defaultDoor', () => {
  // 왼쪽 벽 위쪽에 경첩(0,50), 벽을 따라 (0,130)까지
  assert.deepEqual(doorsForRect({ x: 0, y: 0, w: 300, h: 400 }, [[0, 50, 80, 50, 0, 130]]), [{ wall: 'left', offset: 50, size: 80, kind: 'entry' }]);
  assert.deepEqual(doorsForRect({ x: 0, y: 0, w: 300, h: 400 }, [[150, 200, 230, 200, 150, 280]]), []); // 방 한가운데의 호는 문이 아니다
  // 호의 한쪽 끝 방향으로 벽이 길게 이어지면 그쪽은 문틀이 아니다 → 반대쪽이 문틀(a)
  assert.deepEqual(orientDoorArcs([[0, 0, 0, 80, 80, 0]], [0, 0, 0, 300]), [[0, 0, 80, 0, 0, 80, 1]]);
  // 문 폭만 한 선은 열린 문짝이다. 벽 선이 문 자리를 지나가도(문턱) 문짝이 없는 쪽이 문틀
  assert.deepEqual(orientDoorArcs([[0, 0, 0, 80, 80, 0]], [0, 0, 0, 80, -100, 0, 300, 0]), [[0, 0, 80, 0, 0, 80, 1]]);
  assert.equal(orientDoorArcs([[0, 0, 0, 80, 80, 0]], [0, 0, 0, 80, 0, 0, 80, 0])[0][6], 0); // 양쪽 다 문 폭 선이면 모른다
  // 모서리의 문: 문틀 쪽을 알면(known) 그 벽에만 문을 둔다. 문짝이 기대는 벽은 문이 아니다.
  assert.deepEqual(doorsForRect({ x: 0, y: 0, w: 300, h: 400 }, [[0, 0, 0, 80, 80, 0, 1]]), [{ wall: 'left', offset: 0, size: 80, kind: 'entry' }]);
  assert.deepEqual(doorsForRect({ x: 0, y: 0, w: 300, h: 400 }, [[-20, 0, -100, 0, -20, 80, 1]]), []); // 옆방 문의 문짝이 우리 벽 뒤에 기댄 경우
  // 사각형 밖으로 나간 선은 여유 30cm에서 잘리고 방 좌표로 옮겨진다
  assert.deepEqual(underlayFor([[0, 150, 1000, 150], [900, 0, 900, 50]], { x: 100, y: 100, w: 300, h: 200 }), [[-30, 50, 330, 50]]);
  assert.equal(underlayFor(Array.from({ length: 5000 }, (_, i) => [0, i / 100, 10 + i / 1000, i / 100]), { x: 0, y: 0, w: 200, h: 200 }).length, 4000);
  const idx = snapIndex([[100, 100, 200, 100]]);
  assert.deepEqual(snapPoint(idx, 104, 97, 10), { x: 100, y: 100, snapped: true });
  assert.equal(snapPoint(idx, 150, 150, 10).snapped, false);
  const d = defaultDoor(150);
  assert.ok(d.offset + d.size <= 150 && d.kind === 'entry');
});

test('엔드포인트: 형식이 틀린 파일은 한국어 오류로 거절하고, DXF는 읽는다', async () => {
  const server = http.createServer((req, res) => handler(req, res).catch((e) => { res.statusCode = e.status || 500; res.end(JSON.stringify({ error: e.message })); }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/api/dwg`;
  const post = async (name, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(name), 'Content-Type': 'application/octet-stream' }, body });
    return [res.status, await res.json()];
  };
  try {
    assert.equal((await post('메모.txt', Buffer.alloc(500, 65)))[0], 400);
    assert.equal((await post('가짜.dwg', Buffer.alloc(500, 65)))[0], 400); // 확장자만 dwg
    assert.equal((await post('가짜.dxf', Buffer.alloc(500, 0)))[0], 400);
    assert.equal((await post('깨짐.dxf', Buffer.from(sample().slice(0, 400))))[0], 422);
    const [status, plan] = await post('방 도면.dxf', Buffer.from(sample()));
    assert.equal(status, 200);
    assert.equal(plan.rooms.length >= 1, true);
  } finally {
    server.close();
  }
});
