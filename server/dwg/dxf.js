// DXF 글 → 모형 공간의 선분·문 후보 호·글자 (도면 단위 그대로). 블록(INSERT)은 풀어서 넣는다.
import pkg from 'dxf-parser';

const DxfParser = pkg.DxfParser || pkg.default || pkg;

const MAX_SEGS = 400_000; // 블록이 겹겹이 든 도면에서 메모리가 터지지 않게
const MAX_INSERTS = 50_000;
const MAX_DEPTH = 8;
const CODEPAGES = { ANSI_949: 'euc-kr', ANSI_932: 'shift_jis', ANSI_936: 'gbk', ANSI_950: 'big5', ANSI_1252: 'windows-1252' };

// 옛 DXF(2004 이하)는 UTF-8이 아니라 도면 코드페이지(한글은 949)로 저장돼 있다.
export function decodeDxf(buf) {
  const head = buf.subarray(0, 4000).toString('latin1');
  const ver = /\$ACADVER\s+1\s+AC(\d+)/.exec(head)?.[1];
  const cp = /\$DWGCODEPAGE\s+3\s+(\w+)/.exec(head)?.[1];
  let enc = 'utf-8';
  if (ver && Number(ver) < 1021) enc = CODEPAGES[(cp || '').toUpperCase()] || 'euc-kr';
  let text;
  try { text = new TextDecoder(enc).decode(buf); } catch { text = buf.toString('utf8'); }
  return text.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// 2D 변환 행렬 [a,b,c,d,e,f]: x' = a·x + c·y + e, y' = b·x + d·y + f
const ID = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const MIRROR = [-1, 0, 0, 1, 0, 0]; // 돌출 방향이 -z인 도형은 x가 뒤집혀 있다
// 벽이 아닌 것이 확실한 레이어(중심선·가구·해치·기호·도곽·치수). 미리보기에는 그리되 방 찾기에서는 뺀다.
const NOT_WALL = /^(cen|fur|hat|sym|sheet|tile|dim|defpoints|text|elec)|title|center|grid|furn|가구|해치|치수|중심|문자|도곽/i;

// MTEXT 서식 코드(\P, \fArial; 등)를 걷어내고 글자만 남긴다
function cleanText(s) {
  return String(s || '')
    .replace(/\\P/gi, ' ')
    .replace(/\\[A-Za-z][^;\\{}]*;/g, '')
    .replace(/\\[A-Za-z~]/g, '')
    .replace(/%%[A-Za-z]/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readDxf(buf) {
  const text = decodeDxf(buf);
  const dxf = new DxfParser().parseSync(text);
  if (!dxf || !Array.isArray(dxf.entities)) throw new Error('DXF에 도형이 없어요');

  const blocks = dxf.blocks || {};
  const layers = dxf.tables?.layer?.layers || {};
  const hidden = (name) => { const l = layers[name]; return !!l && (l.visible === false || l.frozen === true); };

  const segs = []; // x1,y1,x2,y2 가 줄줄이
  const wallish = []; // 선분마다 1(벽일 수 있음) 또는 0
  let nw = false; // 지금 그리는 도형이 벽이 아닌 레이어에 있는지
  const arcs = []; // 문일 수도 있는 호: [cx,cy, ax,ay, bx,by, 각도(도)]
  const texts = []; // { x, y, h, text }
  const counts = {};
  let inserts = 0;

  const seg = (m, x1, y1, x2, y2) => {
    if (segs.length >= MAX_SEGS * 4) return;
    const p = apply(m, x1, y1);
    const q = apply(m, x2, y2);
    if (Number.isFinite(p[0] + p[1] + q[0] + q[1])) { segs.push(p[0], p[1], q[0], q[1]); wallish.push(nw ? 0 : 1); }
  };
  // 호를 짧은 선분으로 바꿔 넣는다. sweep(라디안)은 부호가 있다.
  const arc = (m, cx, cy, r, a0, sweep) => {
    if (!(r > 0) || !Number.isFinite(a0 + sweep)) return;
    const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
    let px = cx + r * Math.cos(a0);
    let py = cy + r * Math.sin(a0);
    const sx = px;
    const sy = py;
    for (let i = 1; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      seg(m, px, py, x, y);
      px = x; py = y;
    }
    const deg = Math.abs(sweep) * 180 / Math.PI;
    if (deg > 60 && deg < 120 && arcs.length < 20_000) arcs.push([...apply(m, cx, cy), ...apply(m, sx, sy), ...apply(m, px, py), deg]);
  };
  const poly = (m, e) => {
    const vs = (e.vertices || []).filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y));
    const n = vs.length;
    for (let i = 0; i < (e.shape ? n : n - 1); i++) {
      const a = vs[i];
      const b = vs[(i + 1) % n];
      const g = a.bulge;
      if (g && Math.abs(g) > 1e-6) {
        // 볼록값(bulge) = tan(호 각도 / 4)
        const k = (1 - g * g) / (4 * g);
        const cx = (a.x + b.x) / 2 - (b.y - a.y) * k;
        const cy = (a.y + b.y) / 2 + (b.x - a.x) * k;
        arc(m, cx, cy, Math.hypot(a.x - cx, a.y - cy), Math.atan2(a.y - cy, a.x - cx), 4 * Math.atan(g));
      } else seg(m, a.x, a.y, b.x, b.y);
    }
  };

  // parent: 이 블록을 넣은 INSERT의 레이어. 블록 안의 '0' 레이어 도형은 넣은 쪽 레이어를 따른다.
  const walk = (entities, m, depth, parent, parentNw) => {
    for (const e of entities || []) {
      if (!e || (depth === 0 && e.inPaperSpace)) continue;
      const layer = depth > 0 && (e.layer === '0' || !e.layer) ? parent : e.layer;
      if (hidden(layer)) continue;
      nw = parentNw || NOT_WALL.test(layer || '');
      if (depth === 0) counts[e.type] = (counts[e.type] || 0) + 1;
      switch (e.type) {
        case 'LINE': {
          const [a, b] = e.vertices || [];
          if (a && b) seg(m, a.x, a.y, b.x, b.y);
          break;
        }
        case 'LWPOLYLINE':
          poly(e.extrusionDirectionZ < 0 ? mul(m, MIRROR) : m, e);
          break;
        case 'POLYLINE':
          if (!e.is3dPolygonMesh && !e.isPolyfaceMesh) poly(e.extrusionDirection?.z < 0 ? mul(m, MIRROR) : m, e);
          break;
        case 'ARC': {
          if (!e.center) break;
          let sweep = e.endAngle - e.startAngle;
          while (sweep <= 0) sweep += Math.PI * 2;
          arc(e.extrusionDirectionZ < 0 ? mul(m, MIRROR) : m, e.center.x, e.center.y, e.radius, e.startAngle, sweep);
          break;
        }
        case 'CIRCLE':
          // shortcut: 원·타원·글자의 -z 돌출(뒤집힘)은 무시한다. 뒤집힌 도면에서 위치가 어긋나면 그때 처리.
          if (e.center) arc(m, e.center.x, e.center.y, e.radius, 0, Math.PI * 2);
          break;
        case 'ELLIPSE': {
          const c = e.center;
          const maj = e.majorAxisEndPoint;
          if (!c || !maj) break;
          const ratio = e.axisRatio || 1;
          const a0 = e.startAngle || 0;
          let sw = (e.endAngle ?? Math.PI * 2) - a0;
          while (sw <= 0) sw += Math.PI * 2;
          const pt = (t) => [c.x + maj.x * Math.cos(t) - maj.y * ratio * Math.sin(t), c.y + maj.y * Math.cos(t) + maj.x * ratio * Math.sin(t)];
          const n = Math.max(4, Math.ceil(sw / (Math.PI / 10)));
          let p = pt(a0);
          for (let i = 1; i <= n; i++) {
            const q = pt(a0 + (sw * i) / n);
            seg(m, p[0], p[1], q[0], q[1]);
            p = q;
          }
          break;
        }
        case 'INSERT': {
          const b = blocks[e.name];
          if (!b || !b.entities || depth >= MAX_DEPTH || !e.position || ++inserts > MAX_INSERTS) break;
          const r = ((e.rotation || 0) * Math.PI) / 180;
          const sx = e.xScale ?? 1;
          const sy = e.yScale ?? 1;
          const cos = Math.cos(r);
          const sin = Math.sin(r);
          const base = b.position || { x: 0, y: 0 };
          // 옮기기 · 돌리기 · 늘이기 · (블록 기준점을 원점으로)
          let t = [cos * sx, sin * sx, -sin * sy, cos * sy, e.position.x, e.position.y];
          t = mul(t, [1, 0, 0, 1, -base.x, -base.y]);
          if (e.extrusionDirection?.z < 0) t = mul(MIRROR, t);
          // shortcut: 배열 삽입(MINSERT, 행·열 반복)은 첫 칸만 그린다. 그런 도면이 나오면 반복을 추가.
          walk(b.entities, mul(m, t), depth + 1, layer, nw);
          break;
        }
        case 'TEXT':
        case 'MTEXT': {
          const p = e.type === 'TEXT' ? ((e.halign || e.valign) && e.endPoint ? e.endPoint : e.startPoint) : e.position;
          const s = cleanText(e.text);
          if (!p || !s || texts.length >= 5000) break;
          const [x, y] = apply(m, p.x, p.y);
          const h = (e.textHeight || e.height || 0) * Math.hypot(m[0], m[1]);
          // 왼쪽 정렬 글자는 대략 글자 폭의 절반만큼 옮겨 가운데를 잡는다
          const shift = e.type === 'TEXT' && !(e.halign || e.valign) ? s.length * h * 0.4 : 0;
          if (Number.isFinite(x + y)) texts.push({ x: x + shift * Math.cos(((e.rotation || 0) * Math.PI) / 180), y, h, text: s.slice(0, 40) });
          break;
        }
        default: // DIMENSION, HATCH, SOLID, POINT, SPLINE 등은 방 모양을 찾는 데 쓰지 않는다
      }
    }
  };
  walk(dxf.entities, ID, 0, '0', false);

  const h = dxf.header || {};
  return { insunits: h.$INSUNITS || 0, measurement: h.$MEASUREMENT, segs, wallish, arcs, texts, counts, total: dxf.entities.length };
}
