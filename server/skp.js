// POST /api/skp — 배치를 SketchUp 파일(.skp)로 만들어 돌려준다. open: true면 이 PC의 SketchUp으로도 연다.
// 모양은 3D 보기와 같은 설계도(src/three/model.js)로 만들고, 파일 쓰기는 server/skp_export.py(파이썬 + SketchUp SDK)가 한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { send, readJson } from './util.js';
import { WALLS, WALL_T, normRoom, colorsOf, roomModel, cleanItem, cleanText, itemBoxes } from '../src/three/model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS = path.join(HERE, '..', 'exports');
const SCRIPT = path.join(HERE, 'skp_export.py');
// 실행 파일 경로는 여기 상수로만 정한다(사용자 입력으로 바뀌지 않는다)
const SKETCHUP_DIR = 'C:/Program Files/SketchUp/SketchUp 2023';
const SKETCHUP_EXE = `${SKETCHUP_DIR}/SketchUp.exe`;
const SDK_DLL = `${SKETCHUP_DIR}/SketchUpAPI.dll`;
const TIMEOUT_MS = 30000;
const MAX_ITEMS = 40;
const WALL_NAMES = { top: '벽 위쪽', bottom: '벽 아래쪽', left: '벽 왼쪽', right: '벽 오른쪽' };

let pythonOk;
export function available() {
  if (pythonOk === undefined) pythonOk = spawnSync('python', ['--version'], { windowsHide: true, timeout: 5000 }).status === 0;
  return pythonOk && fs.existsSync(SDK_DLL) && fs.existsSync(SCRIPT);
}

// 브라우저가 보낸 값은 믿지 않는다. 범위를 확인하고, 상자 목록은 서버가 직접 다시 만든다. 잘못된 입력이면 null.
export function buildScene(body) {
  const r = body?.room;
  const inRange = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 150 && v <= 1500;
  if (!r || typeof r !== 'object' || !inRange(r.width) || !inRange(r.depth)) return null;
  if (!Array.isArray(body.items) || body.items.length > MAX_ITEMS) return null;
  const room = normRoom(r);
  const items = body.items.map(cleanItem);
  if (items.some((it) => !it)) return null;

  const C = colorsOf(body.style);
  const matNames = {};
  for (const p of Array.isArray(body.style?.palette) ? body.style.palette.slice(0, 5) : []) {
    const hex = typeof p?.hex === 'string' ? p.hex.toLowerCase() : '';
    if (Object.values(C).includes(hex)) matNames[hex] ??= cleanText(`${cleanText(p.role, 10)} ${cleanText(p.name, 30)}`, 42) || hex;
  }

  const model = roomModel(room, C);
  const seen = {};
  const { width: W, depth: D, height: H } = room;
  // 조감 장면: 3D 보기와 같은 모서리에서 본다. 카메라 쪽 두 벽은 그 장면(탭)에서만 숨긴다.
  // SketchUp은 파일을 열 때 장면의 숨김을 적용하지 않고 벽을 모두 보여주므로, 벽 너머로 방 안이 보이게 3D 보기보다 높은 곳에서 본다.
  const ww = room.windows[0]?.wall, sx = ww === 'right' ? -1 : 1, sy = ww === 'bottom' ? -1 : 1;
  const DIR = [0.55, 0.85, 1.15];
  const dist = (Math.hypot(W, D, H) / 2) * 1.1 / Math.sin((20 * Math.PI) / 180), n = Math.hypot(...DIR);
  const target = [W / 2, D / 2, H * 0.28];
  return {
    room: { width: W, depth: D, height: H }, T: WALL_T, colors: C, matNames,
    walls: WALLS.map((wall) => ({ wall, name: WALL_NAMES[wall], len: model.walls[wall].len, ops: model.walls[wall].ops, boxes: model.walls[wall].boxes, polys: model.walls[wall].polys })),
    items: items.map((it) => {
      const k = (seen[it.name] = (seen[it.name] || 0) + 1); // 같은 이름이 둘이면 "옷장 2"처럼 구분한다(태그 이름은 겹칠 수 없다)
      return { name: k > 1 ? `${it.name} ${k}` : it.name, boxes: itemBoxes(it, C) };
    }),
    camera: {
      eye: [target[0] + (sx * DIR[0] * dist) / n, target[1] + (sy * DIR[1] * dist) / n, target[2] + (DIR[2] * dist) / n], target,
      hide: [WALL_NAMES[sx > 0 ? 'right' : 'left'], WALL_NAMES[sy > 0 ? 'bottom' : 'top']],
    },
  };
}

// 파이썬을 shell 없이 실행하고, 사용자 데이터는 stdin(JSON)으로만 넘긴다
function runPython(scene) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', ['-X', 'utf8', SCRIPT], { cwd: HERE, windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('시간 초과')); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { if (out.length < 100000) out += d; });
    child.stderr.on('data', (d) => { if (err.length < 4000) err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => {
      clearTimeout(timer);
      let report = null;
      try { report = JSON.parse(out.trim().split('\n').pop()); } catch { /* 아래에서 오류로 처리 */ }
      if (report?.ok) resolve(report);
      else reject(new Error(report?.error || err.slice(0, 500) || '파이썬 출력이 없어요'));
    });
    child.stdin.on('error', () => {}); // 파이썬이 먼저 죽으면 close에서 처리한다
    child.stdin.end(JSON.stringify(scene), 'utf8');
  });
}

let busy = false;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 가능해요' });
  // 다른 웹사이트가 몰래 이 PC에 파일을 만들거나 SketchUp을 띄우지 못하게 한다:
  // JSON 형식 요청만 받고(브라우저가 다른 사이트의 요청을 미리 막는다), 출처가 이 PC가 아니면 거절한다.
  const origin = req.headers.origin;
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '') || (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin))) {
    return send(res, 403, { error: '이 화면에서 보낸 요청만 받을 수 있어요' });
  }
  const body = await readJson(req, 200_000);
  const scene = buildScene(body);
  if (!scene) return send(res, 400, { error: '입력값이 올바르지 않아요' });
  if (!available()) return send(res, 503, { error: '이 PC에서는 SketchUp 내보내기를 쓸 수 없어요' });
  if (busy) return send(res, 429, { error: '지금 다른 파일을 만들고 있어요. 잠시 뒤에 다시 해 주세요' });

  // 저장 경로는 서버가 정한다(시각 + 난수, 영문·숫자만). shortcut: exports/ 는 자동으로 비우지 않는다
  // (사용자가 SketchUp에서 열어 고치고 있을 수 있어서). 파일이 수백 개 쌓이면 직접 정리.
  const t = new Date(), two = (v) => String(v).padStart(2, '0');
  const name = `bangkkumi-${t.getFullYear()}${two(t.getMonth() + 1)}${two(t.getDate())}-${two(t.getHours())}${two(t.getMinutes())}${two(t.getSeconds())}-${crypto.randomBytes(2).toString('hex')}.skp`;
  const file = path.join(EXPORTS, name);

  busy = true;
  try {
    await runPython({ ...scene, out: name });
  } catch (e) {
    console.error('[skp]', e.message);
    return send(res, 500, { error: 'SketchUp 파일을 만들지 못했어요' });
  } finally {
    busy = false;
  }

  if (body.open === true && fs.existsSync(SKETCHUP_EXE)) {
    const app = spawn(SKETCHUP_EXE, [file], { detached: true, stdio: 'ignore' }); // 서버와 따로 살아 있게 떼어 놓는다
    app.on('error', (e) => console.error('[skp] SketchUp 실행 실패', e.message));
    app.unref();
  }

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': 'attachment; filename="bangkkumi.skp"',
    'Content-Length': fs.statSync(file).size,
    'X-Skp-File': name, // exports/ 폴더 안의 실제 파일 이름(화면에서 "어디에 저장됐는지" 알려줄 때)
  });
  fs.createReadStream(file).pipe(res);
}
