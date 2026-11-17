// POST /api/dwg — DWG/DXF 파일(바이트 그대로)을 받아 선분과 방 후보를 돌려준다. (CONTRACT 5.4)
// GET  /api/dwg — { dwg, dxf }: 이 PC에서 열 수 있는 파일 종류
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { send, readBody } from './util.js';
import { findConsole, dwgToDxf } from './dwg/convert.js';
import { readDxf } from './dwg/dxf.js';
import { findRooms, orientDoorArcs } from './dwg/rooms.js';

const LIMIT = 30 * 1024 * 1024;
const MAX_DXF = 200 * 1024 * 1024; // 변환된 DXF가 이보다 크면 읽다가 메모리가 모자랄 수 있다
const MAX_LINES = 20_000;
// $INSUNITS → [이름, cm로 바꾸는 배율]
const UNITS = { 1: ['inch', 2.54], 2: ['inch', 30.48], 4: ['mm', 0.1], 5: ['cm', 1], 6: ['m', 100] };

const fail = (status, msg) => Object.assign(new Error(msg), { status });

// DWG 변환기(AutoCAD)가 있는지. DXF 파일은 변환기가 없어도 읽을 수 있다 (GET /api/dwg 로 구분해서 알려 준다).
export function available() {
  return !!findConsole();
}

// 한 축에서 도면 본체의 범위를 찾는다. 가장 큰 빈틈이 나머지 전체의 2배보다 넓으면
// 점이 적은 쪽(전체의 20% 이하)은 멀리 떨어진 찌꺼기로 보고 버린다. 가구처럼 선이 몰린 곳에 끌려가지 않는다.
function mainRange(sorted) {
  let lo = 0;
  let hi = sorted.length - 1;
  for (let n = 0; n < 20 && hi > lo; n++) {
    let gap = 0;
    let at = lo;
    for (let i = lo; i < hi; i++) { const d = sorted[i + 1] - sorted[i]; if (d > gap) { gap = d; at = i; } }
    if (gap <= (sorted[hi] - sorted[lo] - gap) * 2) break;
    const left = at - lo + 1;
    const right = hi - at;
    if (Math.min(left, right) > (hi - lo + 1) * 0.2) break;
    if (left < right) lo = at + 1; else hi = at;
  }
  return [sorted[lo], sorted[hi]];
}

// readDxf 결과(도면 단위) → 응답 형식(cm, y는 아래가 +, 왼쪽 위가 0,0)
export function toPlan(raw) {
  let { segs } = raw;
  const count = segs.length / 4;
  if (!count) throw fail(422, '도면에서 선을 찾지 못했어요. 모형 공간에 그린 평면도인지 확인해 주세요.');

  // 1) 멀리 떨어진 찌꺼기 도형을 버린다 (선분 가운데 점이 본체 범위 밖인 것)
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  for (let i = 0; i < count; i++) { xs[i] = (segs[i * 4] + segs[i * 4 + 2]) / 2; ys[i] = (segs[i * 4 + 1] + segs[i * 4 + 3]) / 2; }
  xs.sort(); ys.sort();
  const [xa, xb] = mainRange(xs);
  const [ya, yb] = mainRange(ys);
  const inside = (x, y) => x >= xa && x <= xb && y >= ya && y <= yb;
  const kept = [];
  const walls = []; // 방 찾기에 쓸 선(벽일 수 있는 레이어만)
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (let i = 0; i < segs.length; i += 4) {
    if (!inside((segs[i] + segs[i + 2]) / 2, (segs[i + 1] + segs[i + 3]) / 2)) continue;
    kept.push(segs[i], segs[i + 1], segs[i + 2], segs[i + 3]);
    if (!raw.wallish || raw.wallish[i / 4]) walls.push(kept.length - 4);
    minX = Math.min(minX, segs[i], segs[i + 2]); maxX = Math.max(maxX, segs[i], segs[i + 2]);
    minY = Math.min(minY, segs[i + 1], segs[i + 3]); maxY = Math.max(maxY, segs[i + 1], segs[i + 3]);
  }
  segs = kept;

  // 2) 단위: 도면에 적힌 값($INSUNITS)을 믿되, 없으면 크기로 짐작한다 (주택 도면은 보통 mm)
  const size = Math.max(maxX - minX, maxY - minY);
  let unit = UNITS[raw.insunits];
  // 미터법 도면인데 인치로 적힌 경우는 템플릿 기본값이 남은 것이라 믿지 않는다
  if (unit && unit[0] === 'inch' && raw.measurement === 1) unit = null;
  if (!unit) unit = size >= 2000 ? UNITS[4] : size >= 150 ? (raw.measurement === 0 ? UNITS[1] : UNITS[5]) : UNITS[6];
  const k = unit[1];

  // 3) cm로 바꾸고, y를 뒤집고, 왼쪽 위를 (0,0)으로 옮긴다 (큰 좌표는 화면에서 정밀도가 떨어진다)
  const tx = (x) => (x - minX) * k;
  const ty = (y) => (maxY - y) * k;
  for (let i = 0; i < segs.length; i += 4) {
    segs[i] = tx(segs[i]); segs[i + 1] = ty(segs[i + 1]); segs[i + 2] = tx(segs[i + 2]); segs[i + 3] = ty(segs[i + 3]);
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  const inBounds = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  const texts = raw.texts.filter((t) => inBounds(t.x, t.y)).map((t) => ({ x: tx(t.x), y: ty(t.y), text: t.text }));
  // 문 후보: 반지름 55~115cm, 약 90도인 호
  let doorArcs = [];
  for (const [cx, cy, ax, ay, bx, by, deg] of raw.arcs) {
    if (!inBounds(cx, cy) || deg < 78 || deg > 102) continue;
    const ra = Math.hypot(ax - cx, ay - cy) * k;
    const rb = Math.hypot(bx - cx, by - cy) * k;
    if (ra < 55 || ra > 115 || Math.abs(ra - rb) > ra * 0.05) continue;
    doorArcs.push([tx(cx), ty(cy), tx(ax), ty(ay), tx(bx), ty(by)].map(r1));
  }

  // shortcut: 문 호는 300개까지만 본다(호마다 모든 선을 훑어서 느려지므로). 큰 단지 도면에서 문이 빠지면 색인을 추가.
  doorArcs = orientDoorArcs(doorArcs.slice(0, 300), segs);

  // 레이어를 나누지 않은 도면(벽 후보가 거의 없음)은 모든 선으로 찾는다
  const wallSegs = walls.length * 4 < segs.length * 0.05 ? segs : walls.flatMap((i) => [segs[i], segs[i + 1], segs[i + 2], segs[i + 3]]);
  const rooms = findRooms(wallSegs, texts, doorArcs);

  // 4) 화면용 선: 긴 것부터 최대 2만 개
  let lines = [];
  for (let i = 0; i < segs.length; i += 4) {
    const len = Math.hypot(segs[i + 2] - segs[i], segs[i + 3] - segs[i + 1]);
    if (len >= 0.3) lines.push([len, i]);
  }
  const totalLines = lines.length;
  if (lines.length > MAX_LINES) lines.sort((a, b) => b[0] - a[0]).length = MAX_LINES;
  lines = lines.map(([, i]) => [r1(segs[i]), r1(segs[i + 1]), r1(segs[i + 2]), r1(segs[i + 3])]);

  return {
    unit: unit[0],
    bounds: { x: 0, y: 0, w: r1((maxX - minX) * k), h: r1((maxY - minY) * k) },
    lines,
    rooms,
    // 아래는 규약에 더한 값: 직접 그린 사각형에서도 문을 찾을 수 있게 호를 같이 보낸다
    doorArcs,
    stats: { entities: raw.total, types: raw.counts, segments: totalLines, shown: lines.length, texts: texts.length },
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { dwg: available(), dxf: true });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST로 파일을 보내 주세요' });

  // 파일 이름은 확장자를 보는 데만 쓴다. 경로나 명령에는 절대 넣지 않는다.
  let name = '';
  try { name = decodeURIComponent(String(req.headers['x-filename'] || '')); } catch { /* 깨진 이름은 빈 이름으로 본다 */ }
  const ext = /\.(dwg|dxf)$/i.exec(name)?.[1].toLowerCase();
  if (!ext) throw fail(400, 'DWG 또는 DXF 파일만 열 수 있어요.');
  if (Number(req.headers['content-length']) > LIMIT) throw fail(413, '파일이 너무 커요. 30MB보다 작은 파일을 올려 주세요.');

  let buf;
  try { buf = await readBody(req, LIMIT); } catch (e) {
    throw e.status === 413 ? fail(413, '파일이 너무 커요. 30MB보다 작은 파일을 올려 주세요.') : e;
  }
  if (buf.length < 100) throw fail(400, '파일이 비어 있어요.');

  const started = Date.now();
  let dxf = buf;
  let convertMs = 0;
  if (ext === 'dwg') {
    // DWG는 'AC10xx' 버전 글자로 시작한다
    if (buf.subarray(0, 4).toString('latin1') !== 'AC10') throw fail(400, 'DWG 파일이 아니거나 너무 오래된 형식이에요. AutoCAD에서 다시 저장해 주세요.');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bangkkumi-dwg-'));
    try {
      await fs.writeFile(path.join(dir, 'in.dwg'), buf);
      const out = await dwgToDxf(dir);
      if ((await fs.stat(out)).size > MAX_DXF) throw fail(413, '도면이 너무 커요. 필요한 층만 따로 저장해서 올려 주세요.');
      dxf = await fs.readFile(out);
      convertMs = Date.now() - started;
    } finally {
      // 임시 복사본은 성공하든 실패하든 지운다 (변환기가 파일을 잠시 잡고 있을 수 있어 몇 번 다시 시도)
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
    }
  } else {
    const head = buf.subarray(0, 2000);
    if (head.subarray(0, 18).toString('latin1') === 'AutoCAD Binary DXF') throw fail(400, '이진(Binary) DXF는 열 수 없어요. 글자(ASCII) DXF로 저장해 주세요.');
    if (head.includes(0) || !/SECTION/.test(head.toString('latin1'))) throw fail(400, 'DXF 파일이 아닌 것 같아요.');
  }

  let raw;
  try { raw = readDxf(dxf); } catch (e) {
    console.error('[dwg] DXF 읽기 실패:', e.message);
    throw fail(422, '도면을 읽지 못했어요. 파일이 손상됐을 수 있어요. AutoCAD에서 DXF로 다시 저장해서 올려 주세요.');
  }
  const plan = toPlan(raw);
  plan.stats.convertMs = convertMs;
  plan.stats.totalMs = Date.now() - started;
  send(res, 200, plan);
}
