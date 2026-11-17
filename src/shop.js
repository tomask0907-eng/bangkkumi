// 쇼핑 연결: 검색 결과로 가는 링크(항상 동작)와 실시간 가격(서버가 줄 수 있을 때만)
// 오늘의집은 robots.txt와 약관이 자동 수집을 막아서 링크만 만든다 (docs/shop-research.md)

const SHOPS = [
  ['ohouse', '오늘의집', 'https://ohou.se/productions/feed?query='],
  ['naver', '네이버쇼핑', 'https://search.shopping.naver.com/search/all?query='],
  ['coupang', '쿠팡', 'https://www.coupang.com/np/search?q='],
];
const MAX = 50;

// 제어 문자와 짝 없는 서러게이트(encodeURIComponent가 오류를 낸다)를 빼고 공백을 정리한다
function tidy(q) {
  return String(q ?? '')
    .replace(/[\ud800-\udfff]/gu, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 서버와 화면이 같이 쓰는 검색어 검증. 1~50자가 아니면 null
export function cleanQuery(q) {
  const s = tidy(q);
  return s && Array.from(s).length <= MAX ? s : null;
}

// https 주소만 통과시킨다 (javascript: 같은 주소가 링크에 들어가지 않게). 아니면 ''
export function httpsUrl(u) {
  return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
}

export function shopLinks(query) {
  // 링크는 항상 동작해야 하므로 긴 검색어는 거절하지 않고 자른다
  const q = Array.from(tidy(query)).slice(0, MAX).join('').trim();
  if (!q) return [];
  return SHOPS.map(([id, label, base]) => ({ id, label, url: base + encodeURIComponent(q) }));
}

const cache = new Map(); // 검색어 → Promise. 같은 가구를 여러 번 묻지 않는다
let off = false; // 서버가 503(가격 기능 꺼짐)이면 이 화면에서는 다시 묻지 않는다

export function clearShopCache() {
  cache.clear();
  off = false;
}

function safeItems(raw) {
  return (Array.isArray(raw) ? raw : []).flatMap((it) => {
    const url = httpsUrl(it?.url);
    if (!url || typeof it.title !== 'string' || !(it.price > 0)) return [];
    return [{ title: it.title, price: Number(it.price), url, image: httpsUrl(it.image), mall: String(it.mall ?? '') }];
  });
}

async function load(q) {
  try {
    const res = await fetch(`/api/shop?query=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000) });
    if (res.status === 503) off = true;
    if (!res.ok) return null;
    return { items: safeItems((await res.json()).items) };
  } catch {
    return null;
  }
}

// 실시간 가격. 어떤 이유로든 실패하면 null → 화면은 shopLinks만 보여주면 된다
export function fetchShop(query) {
  const q = cleanQuery(query);
  if (!q || off) return Promise.resolve(null);
  if (!cache.has(q)) {
    if (cache.size >= 200) cache.clear();
    const p = load(q);
    cache.set(q, p);
    p.then((v) => { if (!v) cache.delete(q); }); // 실패는 기억하지 않는다
  }
  return cache.get(q);
}

// 웹 검색 시세: 서버의 AI가 검색 엔진 결과로 실제 판매 가격대를 조사한다 (20~60초).
// 결과 { items: [{ query, low, high, typical, sources: [{ title, url }] }], checkedAt } — 못 찾은 가구는 빠진다. 실패하면 null
export async function fetchPrices(queries) {
  const list = [...new Set((Array.isArray(queries) ? queries : []).map(cleanQuery).filter(Boolean))].slice(0, 8);
  if (!list.length) return null;
  try {
    const res = await fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: list }),
      signal: AbortSignal.timeout(100000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.items) ? data : null;
  } catch {
    return null;
  }
}
