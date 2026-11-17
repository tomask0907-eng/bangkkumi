// 2D 평면도 v3 (시안 A): 방 → DWG 밑그림 → 통로 면 → 러그 → 가구 → 고른 가구의 손잡이·거리·오류 표시 순서로 그린다.
// 고른 가구의 도구 막대(.item-bar)는 stageRef(.stage) 안에 붙여서 시안처럼 캔버스 아래 가운데에 놓는다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dims, body, doorZones } from '../layout.js';
import { FurnitureSymbol, FurnitureLabel, symbolTransform, PlanDefs, RoomShell, WalkOverlay, ClearZone, planViewBox, planScale, paletteVars } from './symbols.jsx';
import './plan.css';

const SNAP = 5; // cm
const clamp = (v, lo, hi) => Math.min(Math.max(hi, lo), Math.max(lo, v));
const snap = (v) => Math.round(v / SNAP) * SNAP;
const ARROWS = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] };
const MOVES = [['←', '왼쪽으로', -SNAP, 0], ['↑', '위로', 0, -SNAP], ['↓', '아래로', 0, SNAP], ['→', '오른쪽으로', SNAP, 0]];
const ERR_TEXT = { overlap: '겹침', door: '문 막음', out: '방 밖' };
const GAP_MAX = 150; // 이보다 먼 벽·가구까지의 거리는 적지 않는다

const Ic = ({ d }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const I_MOVE = 'M12 3.5v17M3.5 12h17M9 6.5l3-3 3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3';
const I_ROTATE = 'M19.5 12a7.5 7.5 0 1 1-2.6-5.7M19.5 4v4.5H15';
const I_TRASH = 'M4.5 7h15M9.5 7V4.500h5V7M6.5 7l1 12.500h9l1-12.500';

function ItemBar({ item, host, onNudge, onRotate, onRemove }) {
  const bar = (
    <div className="item-bar float" role="toolbar" aria-label={`${item.name} 도구`} onPointerDown={(e) => e.stopPropagation()}>
      <span className="who"><i /><b>{item.name}</b><span>{item.w}×{item.d}</span></span>
      <span className="sepv" />
      <span className="mv" role="group" aria-label="5cm씩 옮기기">
        <Ic d={I_MOVE} />옮기기
        <kbd>{MOVES.map(([ch, word, dx, dy]) => <button key={ch} type="button" aria-label={`${word} 5cm 옮기기`} title={`${word} 5cm`} onClick={() => onNudge(dx, dy)}>{ch}</button>)}</kbd>
      </span>
      <button type="button" onClick={onRotate}><Ic d={I_ROTATE} />돌리기<kbd>R</kbd></button>
      <button type="button" className="del" aria-label={`${item.name} 빼기`} onClick={onRemove}><Ic d={I_TRASH} />빼기<kbd>Del</kbd></button>
    </div>
  );
  return host ? createPortal(bar, host) : bar;
}

// 고른 가구에서 네 방향으로 가장 가까운 가구(없으면 벽)까지의 거리
function gapsOf(sel, items, room) {
  const b = body(sel), out = [];
  const others = items.filter((i) => i.uid !== sel.uid && !i.floor).map(body);
  // axis 0: 좌우(x), 1: 위아래(y). dir -1: 왼쪽·위, 1: 오른쪽·아래
  for (const [axis, dir] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
    const [p, s, q, t] = axis ? ['y', 'h', 'x', 'w'] : ['x', 'w', 'y', 'h'];
    const edge = dir < 0 ? b[p] : b[p] + b[s];
    let gap = dir < 0 ? edge : (axis ? room.depth : room.width) - edge;
    let mid = b[q] + b[t] / 2;
    for (const o of others) {
      const lo = Math.max(b[q], o[q]), hi = Math.min(b[q] + b[t], o[q] + o[t]);
      const g = dir < 0 ? edge - (o[p] + o[s]) : o[p] - edge;
      if (hi - lo > 0 && g >= 0 && g < gap) { gap = g; mid = (lo + hi) / 2; }
    }
    if (gap >= 1 && gap <= GAP_MAX) out.push({ axis, a: edge, b: edge + dir * gap, mid, v: Math.round(gap) });
  }
  return out;
}

// 거리 알약: 화면 px로 고정된 18px 높이. 선이 짧으면 옆으로 비켜 놓는다
function Pill({ x, y, text, k, tone = '' }) {
  const len = Math.max(0.01, ([...String(text)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 12 : 7), 0) - 5) * k);
  return (
    <>
      <path className={`gpill ${tone}`} d={`M${x - len / 2} ${y}h${len}`} />
      <text className="gtag" x={x} y={y}>{text}</text>
    </>
  );
}

export default function Plan({ room, items, style, issues = [], walk, showWalk, selected, onSelect, onMove, onRotate, onRemove, enterKey, stageRef }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const live = useRef({});
  live.current = { room, items, selected, onMove, onRotate, onRemove, onSelect }; // 창에 건 키보드 처리기가 항상 최신 값을 보게
  const [box, setBox] = useState({ w: 720, h: 588 });
  const [dragging, setDragging] = useState(false);
  const [entering, setEntering] = useState(true);
  const [host, setHost] = useState(null);

  // 처음 그리기 전에 한 번 재고(글자 크기가 튀지 않게), 그 뒤로는 크기가 바뀔 때마다 다시 잰다
  useLayoutEffect(() => {
    const el = svgRef.current;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 부모의 ref는 자식의 layout effect보다 늦게 붙어서, 그린 뒤에 읽는다
  useEffect(() => { setHost(stageRef?.current ?? null); });
  // 새 배치가 나오면 가구가 차례로 나타난다. 끝나면 클래스를 떼야 고를 때(순서가 바뀔 때) 다시 깜빡이지 않는다
  useEffect(() => {
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(t);
  }, [enterKey]);

  // k = 화면 1px이 몇 cm인지(선·알약), u = 글자 1px이 몇 cm인지(큰 화면에서는 글자가 조금 커진다)
  const { k, u } = planScale(room, box.w, box.h);

  const levels = useMemo(() => {
    const m = {};
    const up = (uid, level, code) => {
      if (uid == null) return;
      const cur = m[uid] ?? (m[uid] = { level, codes: [] });
      if (level === 'error') cur.level = 'error';
      cur.codes.push(code);
    };
    for (const i of issues) {
      up(i.uid, i.level, i.code);
      if (i.level === 'error') up(i.other, 'error', i.code); // 겹친 상대도 같이 빨갛게
    }
    return m;
  }, [issues]);

  // 오류가 난 곳: 겹친 자리·문 여는 자리와 겹친 곳은 빨간 빗금, 방 밖으로 나간 가구는 이름만
  const errors = useMemo(() => {
    const out = [], by = new Map(items.map((i) => [String(i.uid), i]));
    const cut = (a, b) => {
      const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
      return w > 0 && h > 0 ? { x, y, w, h } : null;
    };
    for (const i of issues) {
      const a = i.level === 'error' && by.get(String(i.uid));
      if (!a) continue;
      const ab = body(a), key = `${i.code}-${i.uid}-${i.other ?? ''}`;
      if (i.code === 'overlap' && by.has(String(i.other))) { const r = cut(ab, body(by.get(String(i.other)))); if (r) out.push({ key, ...r, text: ERR_TEXT.overlap }); }
      else if (i.code === 'door') doorZones(room).forEach((z, n) => { const r = cut(ab, z); if (r) out.push({ key: key + n, ...r, text: ERR_TEXT.door }); });
      else if (i.code === 'out') out.push({ key, x: ab.x + ab.w / 2, y: ab.y, w: 0, h: 0, text: ERR_TEXT.out });
    }
    return out;
  }, [issues, items, room]);

  const underlay = useMemo(() => {
    const lines = Array.isArray(room.underlay?.lines) ? room.underlay.lines : [];
    return lines.filter((l) => Array.isArray(l) && l.length >= 4 && l.every(Number.isFinite)).map((l) => `M${l[0]} ${l[1]}L${l[2]} ${l[3]}`).join('');
  }, [room.underlay]);

  const move = (uid, x, y) => {
    const { room: r, items: list, onMove: go } = live.current;
    const it = list.find((i) => i.uid === uid);
    if (!it) return;
    const { w, h } = dims(it);
    const nx = clamp(x, 0, r.width - w), ny = clamp(y, 0, r.depth - h);
    if (nx !== it.x || ny !== it.y) go(uid, nx, ny);
  };

  // 화면 좌표 → 방 좌표(cm)
  const toRoom = (e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svgRef.current.getScreenCTM().inverse());
  const startDrag = (e, it) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = toRoom(e);
    drag.current = { uid: it.uid, dx: p.x - it.x, dy: p.y - it.y };
    svgRef.current.setPointerCapture(e.pointerId); // 빠르게 끌어도 놓치지 않게
    onSelect(it.uid);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toRoom(e);
    if (!dragging) setDragging(true);
    move(d.uid, snap(p.x - d.dx), snap(p.y - d.dy));
  };
  const endDrag = () => { drag.current = null; setDragging(false); };

  // 방향키로 5cm씩, R로 돌리기, Delete로 빼기 (입력칸에 글을 쓰는 중이거나 모달이 떠 있으면 건드리지 않는다)
  useEffect(() => {
    const onKey = (e) => {
      const { items: list, selected: uid, onRotate: rot, onRemove: del, onSelect: pick } = live.current;
      const it = list.find((i) => i.uid === uid);
      const t = e.target;
      if (!it || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[aria-modal="true"]')) return;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (ARROWS[e.key]) { e.preventDefault(); move(uid, it.x + ARROWS[e.key][0], it.y + ARROWS[e.key][1]); } else if (e.code === 'KeyR') { e.preventDefault(); rot(uid); } else if (e.key === 'Delete') { e.preventDefault(); del(uid); } else if (e.key === 'Escape') pick(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 러그 이름은 가구에 가려지지 않은 가장 넓은 자리에 쓴다(아래쪽 먼저, 위쪽이 더 넓으면 위쪽)
  const rugSlot = (it) => {
    const b = body(it), h = 30 * u;
    const free = (y0) => {
      let segs = [[b.x, b.x + b.w]];
      for (const o of items) {
        const ob = !o.floor && body(o);
        if (ob && ob.y < y0 + h && ob.y + ob.h > y0) segs = segs.flatMap(([p, q]) => [[p, Math.min(q, ob.x)], [Math.max(p, ob.x + ob.w), q]]).filter(([p, q]) => q - p > 1);
      }
      return segs.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
    };
    const bot = free(b.y + b.h - h), top = free(b.y);
    const up = !!top && (!bot || top[1] - top[0] > bot[1] - bot[0] + 1);
    const s = up ? top : bot;
    return s ? { dx: (s[0] + s[1]) / 2 - (b.x + b.w / 2), w: s[1] - s[0], top: up } : null;
  };

  const sel = items.find((i) => i.uid === selected);
  const draw = (it, i) => {
    const on = it.uid === selected, lv = levels[it.uid], level = lv?.level;
    const state = level === 'error' ? ' is-error' : on ? ' is-selected' : level === 'warn' ? ' is-warn' : '';
    return (
      <g
        key={it.uid} data-uid={it.uid} tabIndex={0} role="button" aria-pressed={on}
        aria-label={`${it.name}${level === 'error' ? ', 오류 있음' : level === 'warn' ? ', 주의' : ''}. 방향키로 옮기고 R로 돌려요`}
        className={`fx plan-item${it.floor ? ' is-floor' : ''}${on ? ' is-on' : ''}${state}${entering ? ' is-enter' : ''}`}
        style={entering ? { animationDelay: `${i * 40}ms` } : undefined}
        filter={it.floor ? undefined : `url(#bk-${on ? 'lift2' : 'lift'})`}
        onPointerDown={(e) => startDrag(e, it)} onFocus={() => { if (!on) onSelect(it.uid); }}
      >
        <title>{it.name} {it.w}×{it.d}cm</title>
        <g transform={symbolTransform(it)}>
          {level === 'warn' && lv.codes.includes('clear') && <ClearZone spec={it} />}
          <FurnitureSymbol spec={it} px={u} />
          <FurnitureLabel spec={it} rot={it.rot} px={u} slot={it.floor ? rugSlot(it) : undefined} />
        </g>
      </g>
    );
  };
  // 러그는 맨 아래, 고른 가구는 맨 위 (끌어서 다른 가구 위로 가도 보이게)
  const rugs = items.filter((i) => i.floor);
  const rest = items.filter((i) => !i.floor).sort((a, b) => (a.uid === selected) - (b.uid === selected));

  const sb = sel && body(sel);
  const selErr = sel && levels[sel.uid]?.level === 'error';
  const corners = sb ? `M${sb.x} ${sb.y}h.01M${sb.x + sb.w} ${sb.y}h.01M${sb.x} ${sb.y + sb.h}h.01M${sb.x + sb.w} ${sb.y + sb.h}h.01` : '';
  const tick = 5.5 * k, near = 44 * k; // 끝 표시 길이, 알약이 선 위에 못 들어가는 거리

  return (
    <>
      <svg
        ref={svgRef} className="plan" viewBox={planViewBox(room, u)} style={{ '--k': k, ...paletteVars(style?.palette) }}
        role="group" aria-label={`평면도. 방 ${room.width}cm × ${room.depth}cm, 가구 ${items.length}개`}
        onPointerDown={() => onSelect(null)} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      >
        <PlanDefs room={room} />
        <RoomShell room={room} px={u} curtains={items.length > 0} />
        {underlay && <path className="plan-underlay" d={underlay} clipPath="url(#bk-room)" pointerEvents="none" />}
        {showWalk && items.length > 0 && <WalkOverlay points={walk?.points} room={room} />}
        {rugs.map(draw)}
        {rest.map((it, i) => draw(it, i + rugs.length))}

        <g className="plan-marks" pointerEvents="none">
          {/* 주의: 가구 오른쪽 위 구석에 느낌표 */}
          {items.map((it) => {
            if (levels[it.uid]?.level !== 'warn') return null;
            const b = body(it);
            return <g key={it.uid}><path className="gdot" d={`M${b.x + b.w} ${b.y}h.01`} /><text className="gtag on-warn" x={b.x + b.w} y={b.y}>!</text></g>;
          })}
          {/* 고른 가구: 옆 가구·벽까지 거리 + 네 구석 손잡이 */}
          {sel && !selErr && gapsOf(sel, items, room).map((g) => {
            const short = g.v < near, m = (g.a + g.b) / 2;
            const [x, y] = g.axis ? [g.mid + (short ? 22 * k : 0), m] : [m, g.mid - (short ? 15 * k : 0)];
            const line = g.axis ? `M${g.mid} ${g.a}V${g.b}M${g.mid - tick} ${g.b}h${tick * 2}` : `M${g.a} ${g.mid}H${g.b}M${g.b} ${g.mid - tick}v${tick * 2}`;
            return <g key={`${g.axis}${g.a < g.b}`}><path className="guide" d={line} /><Pill x={x} y={y} text={g.v} k={k} /></g>;
          })}
          {errors.map((r) => (
            <g key={r.key}>
              {r.w > 0 && (
                <>
                  <rect className="clash" x={r.x} y={r.y} width={r.w} height={r.h} />
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#bk-xhatch)" opacity={0.4} />
                  <rect className="clash-o" x={r.x} y={r.y} width={r.w} height={r.h} />
                </>
              )}
              <Pill x={r.x + r.w / 2} y={Math.max(14 * k, r.y - 14 * k)} text={r.text} k={k} tone="err" />
            </g>
          ))}
          {sel && <><path className={`hd-o${selErr ? ' err' : ''}`} d={corners} /><path className="hd-i" d={corners} /></>}
        </g>
      </svg>
      {sel && !dragging && (
        <ItemBar
          item={sel} host={host}
          onNudge={(dx, dy) => move(sel.uid, sel.x + dx, sel.y + dy)} onRotate={() => onRotate(sel.uid)} onRemove={() => onRemove(sel.uid)}
        />
      )}
    </>
  );
}
