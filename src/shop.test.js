import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shopLinks, cleanQuery, httpsUrl, fetchShop, clearShopCache } from './shop.js';
import { sanitizeItems, searchNaver, readKeys } from '../server/shop.js';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('shopLinks: 오늘의집이 첫 번째이고 한글을 UTF-8로 인코딩한다', () => {
  const links = shopLinks('슈퍼싱글 침대 프레임');
  assert.deepEqual(links.map((l) => l.id), ['ohouse', 'naver', 'coupang']);
  assert.equal(links[0].label, '오늘의집');
  assert.equal(
    links[0].url,
    'https://ohou.se/productions/feed?query=%EC%8A%88%ED%8D%BC%EC%8B%B1%EA%B8%80%20%EC%B9%A8%EB%8C%80%20%ED%94%84%EB%A0%88%EC%9E%84',
  );
  assert.equal(new URL(links[1].url).searchParams.get('query'), '슈퍼싱글 침대 프레임');
  assert.equal(new URL(links[2].url).searchParams.get('q'), '슈퍼싱글 침대 프레임');
});

test('shopLinks: 특수 문자·제어 문자·긴 검색어·빈 검색어', () => {
  const u = new URL(shopLinks('책상 & 의자 #1 +α?\r\n<b>')[0].url);
  assert.equal(u.searchParams.get('query'), '책상 & 의자 #1 +α? <b>');
  assert.equal([...u.searchParams.keys()].length, 1); // & 가 새 파라미터를 만들지 않는다
  assert.equal(new URL(shopLinks('가'.repeat(80))[0].url).searchParams.get('query'), '가'.repeat(50));
  assert.doesNotThrow(() => shopLinks('😀'.repeat(60) + '\ud83d')); // 짝 없는 서러게이트
  assert.deepEqual(shopLinks('  \n '), []);
  assert.deepEqual(shopLinks(null), []);
});

test('cleanQuery: 1~50자만 통과', () => {
  assert.equal(cleanQuery('  원목\t책상\u0000 1400 '), '원목 책상 1400');
  assert.equal(cleanQuery(''), null);
  assert.equal(cleanQuery(undefined), null);
  assert.equal(cleanQuery('가'.repeat(50)), '가'.repeat(50));
  assert.equal(cleanQuery('가'.repeat(51)), null);
});

test('httpsUrl: https만 통과', () => {
  assert.equal(httpsUrl('https://a.example/x?y=1'), 'https://a.example/x?y=1');
  for (const bad of ['http://a.example', 'javascript:alert(1)', '//a.example', 'https://a.example/"><script>', '', null, 5]) {
    assert.equal(httpsUrl(bad), '');
  }
});

test('fetchShop: 서버 응답을 다시 걸러서 돌려주고, 같은 검색어는 한 번만 묻는다', async (t) => {
  clearShopCache();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return json(200, {
      items: [
        { title: '원목 책상', price: 129000, url: 'https://shop.example/1', image: 'http://img.example/1.jpg', mall: '오늘의집', extra: 'x' },
        { title: '나쁜 링크', price: 1000, url: 'javascript:alert(1)', image: '', mall: 'x' },
        { title: '가격 없음', price: 0, url: 'https://shop.example/3' },
        { price: 5, url: 'https://shop.example/4' },
        null,
      ],
    });
  });
  const a = await fetchShop('원목 책상');
  const b = await fetchShop(' 원목  책상 ');
  assert.deepEqual(a, { items: [{ title: '원목 책상', price: 129000, url: 'https://shop.example/1', image: '', mall: '오늘의집' }] });
  assert.equal(b, a);
  assert.deepEqual(calls, ['/api/shop?query=%EC%9B%90%EB%AA%A9%20%EC%B1%85%EC%83%81']);
});

test('fetchShop: 실패하면 null, 실패는 기억하지 않는다', async (t) => {
  clearShopCache();
  let n = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    n += 1;
    if (n === 1) throw new Error('network');
    if (n === 2) return json(502, { error: 'x' });
    if (n === 3) return { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
    return json(200, { items: 'nope' });
  });
  assert.equal(await fetchShop('러그'), null);
  assert.equal(await fetchShop('러그'), null);
  assert.equal(await fetchShop('러그'), null);
  assert.deepEqual(await fetchShop('러그'), { items: [] });
  assert.equal(n, 4);
  assert.equal(await fetchShop(''), null);
  assert.equal(await fetchShop('가'.repeat(51)), null);
  assert.equal(n, 4); // 잘못된 검색어는 서버에 묻지 않는다
});

test('fetchShop: 서버가 503이면 그 뒤로는 묻지 않는다', async (t) => {
  clearShopCache();
  const fake = t.mock.method(globalThis, 'fetch', async () => json(503, { error: '준비 안 됨' }));
  assert.equal(await fetchShop('스탠드 조명'), null);
  assert.equal(await fetchShop('화분'), null);
  assert.equal(fake.mock.callCount(), 1);
  clearShopCache();
});

test('sanitizeItems: <b> 제거, 가격은 숫자, https만, 순서 유지, 최대 5개', () => {
  const raw = [
    { title: '<b>원목</b> 책상 1400 &amp; 의자', link: 'https://smartstore.naver.com/a/products/1', image: 'https://shopping-phinf.pstatic.net/1.jpg', lprice: '129000', mallName: '가구나라' },
    { title: 'http 링크', link: 'http://old.example/2', image: '', lprice: '1000', mallName: 'x' },
    { title: '<img src=x onerror=alert(1)>', link: 'https://ok.example/3', lprice: '5000', mallName: 'x' },
    { title: '가격 없음', link: 'https://ok.example/4', lprice: '0', mallName: 'x' },
    { title: '이미지가 http', link: 'https://ok.example/5', image: 'http://img.example/5.jpg', lprice: 39900, mallName: '<b>오늘의집</b>' },
    { title: '몰 이름 없음', link: 'https://ok.example/6', image: 'javascript:alert(1)', lprice: '10', mallName: '' },
    ...Array.from({ length: 6 }, (_, i) => ({ title: `상품 ${i}`, link: `https://ok.example/n${i}`, lprice: '100', mallName: 'm' })),
  ];
  const items = sanitizeItems(raw);
  assert.equal(items.length, 5);
  assert.deepEqual(items[0], {
    title: '원목 책상 1400 & 의자', price: 129000, url: 'https://smartstore.naver.com/a/products/1',
    image: 'https://shopping-phinf.pstatic.net/1.jpg', mall: '가구나라',
  });
  assert.deepEqual(items[1], { title: '이미지가 http', price: 39900, url: 'https://ok.example/5', image: '', mall: '오늘의집' });
  assert.deepEqual(items[2], { title: '몰 이름 없음', price: 10, url: 'https://ok.example/6', image: '', mall: '네이버' });
  assert.ok(items.every((it) => typeof it.price === 'number' && !/[<>]/.test(it.title)));
  assert.deepEqual(sanitizeItems(null), []);
  assert.deepEqual(sanitizeItems({ items: 1 }), []);
});

test('searchNaver: 주소·헤더가 맞고, 네이버가 거절하면 오류', async () => {
  const seen = [];
  const ok = async (url, opt) => {
    seen.push([url, opt]);
    return json(200, { items: [{ title: '<b>책상</b>', link: 'https://ok.example/1', lprice: '50000', mallName: '오늘의집' }] });
  };
  const items = await searchNaver('원목 책상', { id: 'ID', secret: 'SECRET' }, ok);
  assert.deepEqual(items, [{ title: '책상', price: 50000, url: 'https://ok.example/1', image: '', mall: '오늘의집' }]);
  const [url, opt] = seen[0];
  assert.equal(url, 'https://openapi.naver.com/v1/search/shop.json?query=%EC%9B%90%EB%AA%A9%20%EC%B1%85%EC%83%81&display=5&sort=sim');
  assert.equal(opt.headers['X-Naver-Client-Id'], 'ID');
  assert.equal(opt.headers['X-Naver-Client-Secret'], 'SECRET');
  assert.ok(opt.signal instanceof AbortSignal);
  await assert.rejects(searchNaver('책상', { id: 'a', secret: 'b' }, async () => json(401, {})), /401/);
});

test('readKeys: 환경 변수 → .env.local 순서, 둘 다 있어야 한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-shop-'));
  const file = path.join(dir, '.env.local');
  const none = path.join(dir, 'none');
  try {
    assert.equal(readKeys({}, none), null);
    assert.equal(readKeys({ NAVER_CLIENT_ID: 'only-id' }, none), null);
    assert.deepEqual(readKeys({ NAVER_CLIENT_ID: 'a', NAVER_CLIENT_SECRET: 'b' }, none), { id: 'a', secret: 'b' });
    assert.equal(readKeys({ NAVER_CLIENT_ID: 'a\r\nX-Evil: 1', NAVER_CLIENT_SECRET: 'b' }, none), null);

    fs.writeFileSync(file, '﻿# 네이버 키\r\nOTHER=1\r\nNAVER_CLIENT_ID = "file_id"\r\nNAVER_CLIENT_SECRET=file_secret # 메모\r\n');
    assert.deepEqual(readKeys({}, file), { id: 'file_id', secret: 'file_secret' });
    assert.deepEqual(readKeys({ NAVER_CLIENT_ID: 'env_id' }, file), { id: 'env_id', secret: 'file_secret' });

    fs.writeFileSync(file, '﻿NAVER_CLIENT_ID=u16\r\nNAVER_CLIENT_SECRET=s16\r\n', 'utf16le');
    assert.deepEqual(readKeys({}, file), { id: 'u16', secret: 's16' });

    fs.writeFileSync(file, 'NAVER_CLIENT_ID=\nNAVER_CLIENT_SECRET=x\n');
    assert.equal(readKeys({}, file), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
