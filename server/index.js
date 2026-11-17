// API 라우터. 각 기능은 server/<이름>.js 파일 하나가 맡는다.
// 모듈 규약: export default async function handler(req, res) / (선택) export function available()
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { send } from './util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const ROUTES = {
  '/api/advice': 'advice.js', // POST 배치 설명 (AI)
  '/api/furniture': 'furniture.js', // POST 가구 직접 입력 → 가구 사양 (AI)
  '/api/style': 'style.js', // POST 스타일 직접 입력 → 팔레트 (AI)
  '/api/dwg': 'dwg.js', // POST DWG/DXF 파일 → 방 정보
  '/api/skp': 'skp.js', // POST 배치 → SketchUp 파일
  '/api/shop': 'shop.js', // GET 쇼핑 정보
  '/api/price': 'price.js', // POST 웹 검색으로 가격 시세 조사 (AI)
};

// 파일이 바뀌면 다시 읽는다 (개발 중 서버 재시작 없이 반영)
async function load(file) {
  const full = path.join(HERE, file);
  if (!fs.existsSync(full)) return null;
  return import(`${pathToFileURL(full).href}?t=${fs.statSync(full).mtimeMs}`);
}

export async function api(req, res, next) {
  // 주소가 깨져 있으면('//[' 등) 여기서 예외가 난다. 받아 주지 않으면 서버 전체가 꺼진다
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return send(res, 400, { error: '주소가 올바르지 않아요' });
  }
  if (url.pathname === '/api/health') {
    const out = {};
    for (const [route, file] of Object.entries(ROUTES)) {
      try {
        const mod = await load(file);
        out[route.slice(5)] = !!mod && (mod.available ? !!(await mod.available()) : true);
      } catch {
        out[route.slice(5)] = false;
      }
    }
    return send(res, 200, out);
  }
  const file = ROUTES[url.pathname];
  if (!file) return next ? next() : send(res, 404, { error: '없는 주소예요' });
  try {
    const mod = await load(file);
    if (!mod) return send(res, 501, { error: '아직 준비되지 않은 기능이에요' });
    await mod.default(req, res);
  } catch (e) {
    console.error(`[${url.pathname}]`, e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : '서버 오류가 났어요' });
  }
}

export const apiPlugin = {
  name: 'bangkkumi-api',
  configureServer(server) { server.middlewares.use(api); },
  configurePreviewServer(server) { server.middlewares.use(api); },
};
