// 라우터 시험: 깨진 주소가 와도 서버가 꺼지지 않고 400으로 답한다
import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from './index.js';

function fakeRes() {
  return { statusCode: 0, headers: {}, body: '', headersSent: false, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; this.headersSent = true; } };
}

test('api: 깨진 주소는 400 (예외를 밖으로 던지지 않는다)', async () => {
  for (const url of ['//[', 'http://[', '//']) {
    const res = fakeRes();
    let passed = false;
    await api({ url, method: 'GET' }, res, () => { passed = true; });
    assert.ok(passed || res.statusCode === 400, `${url} → ${res.statusCode}`);
    if (!passed) assert.match(JSON.parse(res.body).error, /주소/);
  }
});

test('api: 모르는 주소는 next로 넘기고, next가 없으면 404', async () => {
  let passed = false;
  await api({ url: '/index.html', method: 'GET' }, fakeRes(), () => { passed = true; });
  assert.ok(passed);
  const res = fakeRes();
  await api({ url: '/api/nope', method: 'GET' }, res);
  assert.equal(res.statusCode, 404);
});
