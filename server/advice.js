// POST /api/advice { room, style, budget, items } → { summary, reasons, styling, props, ai }
// 서버가 배치를 다시 검사하고(checkLayout, explain) 그 사실을 AI에게 넘겨 설명을 만든다.
// AI가 안 되거나 늦으면 같은 모양의 기본 설명을 돌려준다(ai: false).
import { STYLE_PRESETS, cleanName, validateSpec, validateStyle } from '../src/catalog.js';
import { buildAdvicePrompt, parseAdvice, fallbackAdvice } from '../src/advice.js';
import { send, readJson, askClaude } from './util.js';

const WALLS = ['top', 'bottom', 'left', 'right'];
// 화면이 room을 그대로 보내면 DWG 밑그림(room.underlay, 선 2만 개 ≈ 0.6~1.6MB)이 딸려 온다. 쓰지는 않지만 그 때문에 요청이 끊기면 안 된다.
const LIMIT = 3_000_000;
const num = (v, lo, hi, def) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);

// 브라우저가 보낸 값은 믿지 않는다. 규약에 있는 숫자·정해진 낱말만 골라 새로 만든다(프롬프트에 임의 글이 못 들어가게).
export function cleanInput(b) {
  const r = b?.room;
  const width = num(r?.width, 150, 1500, null);
  const depth = num(r?.depth, 150, 1500, null);
  const budget = num(b?.budget, 0, 1_000_000_000, null);
  const style = typeof b?.style === 'string'
    ? (Object.hasOwn(STYLE_PRESETS, b.style) ? STYLE_PRESETS[b.style] : null)
    : validateStyle(b?.style);
  if (width === null || depth === null || budget === null || !style) return null;
  if (!Array.isArray(b.items) || b.items.length > 15) return null;

  const list = (arr, one) => (Array.isArray(arr) ? arr : one ? [one] : []) // 구버전 {door, window} 단수 형식도 받는다
    .filter((o) => o && WALLS.includes(o.wall)).slice(0, 8);
  const room = {
    width, depth, height: num(r.height, 200, 400, 240),
    doors: list(r.doors, r.door).map((d) => ({
      wall: d.wall, offset: num(d.offset, 0, 1500, 0), size: num(d.size, 60, 150, 90),
      kind: ['entry', 'bath', 'etc'].includes(d.kind) ? d.kind : 'etc',
    })),
    windows: list(r.windows, r.window).map((w) => ({
      wall: w.wall, offset: num(w.offset, 0, 1500, 0), size: num(w.size, 30, 1500, 100),
      sill: num(w.sill, 0, 250, 90), height: num(w.height, 20, 300, 120),
    })),
  };

  const items = [];
  for (const [i, it] of b.items.entries()) {
    const spec = validateSpec(it);
    const x = num(it?.x, -2000, 4000, null);
    const y = num(it?.y, -2000, 4000, null);
    if (!spec || x === null || y === null || ![0, 90, 180, 270].includes(it.rot)) return null;
    items.push({ ...spec, uid: cleanName(it.uid, 40) || `i${i}`, x, y, rot: it.rot });
  }
  return { room, style, budget, items };
}

// 배치 엔진으로 다시 검사한다. 엔진이 아직 새 규약과 다르거나 오류가 나면 빈 결과로 넘어간다(설명은 계속 만들 수 있게).
async function inspect(input) {
  try {
    // 늦게 불러온다: layout.js가 깨져 있어도 이 파일은 읽힐 수 있어야 한다
    const L = await import('../src/layout.js');
    if (typeof L.normalizeRoom !== 'function' || typeof L.explain !== 'function') throw new Error('layout.js가 아직 새 규약이 아니에요');
    const room = L.normalizeRoom(input.room);
    const { issues, score } = L.checkLayout(room, input.items);
    return { room, issues: Array.isArray(issues) ? issues : [], score, facts: L.explain(room, input.items) || {} };
  } catch (e) {
    console.error('[advice] 배치 검사 건너뜀:', e.message);
    return { room: input.room, issues: null, score: null, facts: {} }; // issues: null = 검사하지 못함
  }
}

// ask·inspect를 바꿔 끼울 수 있게 해서 테스트에서는 AI와 배치 엔진 없이 돌린다
export const makeHandler = (ask = askClaude, check = inspect) => async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST로만 쓸 수 있어요' });
  // readBody는 한도를 넘으면 연결을 끊어서 브라우저가 안내문을 받지 못한다. 길이를 먼저 보고 413으로 답한다.
  if (Number(req.headers?.['content-length']) > LIMIT) return send(res, 413, { error: '보낸 내용이 너무 커요' });
  const input = cleanInput(await readJson(req, LIMIT));
  if (!input) return send(res, 400, { error: '입력값이 올바르지 않아요' });
  const data = { ...input, ...(await check(input)) };
  let advice = null;
  if (data.items.length) {
    try {
      advice = parseAdvice(await ask(buildAdvicePrompt(data), { timeoutMs: 40_000 }));
    } catch (e) {
      console.error('[advice]', e.message);
    }
  }
  send(res, 200, advice ? { ...advice, ai: true } : { ...fallbackAdvice(data), ai: false });
};

export default makeHandler();
