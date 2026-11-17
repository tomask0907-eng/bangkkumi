// GET /api/shop?query= — 네이버 쇼핑 검색 API를 서버가 대신 부른다 (키가 브라우저로 나가지 않게)
// 주의: 네이버 약관 부칙에 따르면 개발자센터의 쇼핑 검색은 2026-07-31에 끝났다 (docs/shop-research.md 5절).
//       그래서 기본 상태는 503이고, 키가 있어도 네이버가 거절하면 502다. 화면은 링크만 보여주면 된다.
// 네이버 검색 API 특약(순위 변경·캐싱 금지) 때문에 결과 순서를 바꾸지 않고 서버에 저장하지도 않는다.
import fs from 'node:fs';
import { send } from './util.js';
import { cleanQuery, httpsUrl } from '../src/shop.js';

const ENV_FILE = new URL('../.env.local', import.meta.url);
const NAMES = ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'];

// 환경 변수가 먼저, 없으면 .env.local. 둘 다 있어야 { id, secret }, 아니면 null
export function readKeys(env = process.env, file = ENV_FILE) {
  let text = '';
  try {
    const buf = fs.readFileSync(file);
    // PowerShell의 > 로 만든 파일은 UTF-16이다
    text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  } catch { /* 파일이 없으면 환경 변수만 본다 */ }
  const [id, secret] = NAMES.map((name) => {
    // 빈 값일 때 다음 줄을 값으로 읽지 않도록 줄 안의 공백만 허용한다
    const m = text.match(new RegExp(`^[ \\t\\ufeff]*${name}[ \\t]*=[ \\t]*["']?([^"'\\s#]*)`, 'm'));
    return (env[name] || m?.[1] || '').trim();
  });
  // 헤더에 넣는 값이라 줄바꿈·공백이 섞이면 쓰지 않는다
  const ok = (v) => /^[\x21-\x7e]{1,200}$/.test(v);
  return ok(id) && ok(secret) ? { id, secret } : null;
}

export function available() {
  return !!readKeys();
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
// 태그(<b> 강조)를 지우고 글자로만 만든다. 화면에서는 반드시 글자로 표시할 것(HTML로 넣지 않는다)
const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ENT[k]).trim().slice(0, 120);

// 네이버 응답 items → 규약 5.5 모양. 순서는 네이버가 준 그대로
export function sanitizeItems(raw) {
  return (Array.isArray(raw) ? raw : []).flatMap((it) => {
    const url = httpsUrl(it?.link);
    const title = plain(it?.title);
    const price = Number(it?.lprice); // 가격 정보가 없으면 0이 온다
    if (!url || !title || !(price > 0)) return [];
    return [{ title, price, url, image: httpsUrl(it.image), mall: plain(it.mallName) || '네이버' }];
  }).slice(0, 5);
}

export async function searchNaver(query, keys, fetchImpl = fetch) {
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=5&sort=sim`;
  const res = await fetchImpl(url, {
    headers: { 'X-Naver-Client-Id': keys.id, 'X-Naver-Client-Secret': keys.secret },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`네이버 응답 ${res.status}`);
  return sanitizeItems((await res.json()).items);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET으로 요청해 주세요' });
  const keys = readKeys();
  if (!keys) return send(res, 503, { error: '실시간 가격은 아직 준비되지 않았어요. 쇼핑몰 링크로 확인해 주세요' });
  const query = cleanQuery(new URL(req.url, 'http://localhost').searchParams.get('query'));
  if (!query) return send(res, 400, { error: '검색어는 1~50자로 적어 주세요' });
  try {
    send(res, 200, { items: await searchNaver(query, keys) });
  } catch (e) {
    console.error('[shop]', e.message); // 키는 기록하지 않는다
    send(res, 502, { error: '가격 정보를 가져오지 못했어요. 쇼핑몰 링크로 확인해 주세요' });
  }
}
