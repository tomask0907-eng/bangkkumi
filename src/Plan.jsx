// 2D 평면도: 방(RoomShell) 위에 DWG 밑그림, 러그, 통로 점, 가구 순서로 그리고 끌어서 옮길 수 있게 한다
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dims } from './layout.js';
import { FurnitureSymbol, FurnitureLabel, symbolTransform, PlanDefs, RoomShell, WalkOverlay, ClearZone, planViewBox } from './symbols.jsx';
import Toolbar from './components/Toolbar.jsx';

const SNAP = 5; // cm
const clamp = (v, lo, hi) => Math.min(Math.max(hi, lo), Math.max(lo, v));
const snap = (v) => Math.round(v / SNAP) * SNAP;
const ARROWS = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] };

export default function Plan({ room, items, style, issues, walk, showWalk, selected, onSelect, onMove, onRotate, onRemove, enterKey, stageRef }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const live = useRef({});
  live.current = { room, items, selected, onMove, onRotate, onRemove, onSelect }; // 창에 건 키보드 처리기가 항상 최신 값을 보게
  const [box, setBox] = useState({ w: 640, h: 520 });
  const [dragging, setDragging] = useState(false);
  const [entering, setEntering] = useState(true);

  // 처음 그리기 전에 한 번 재고(글자 크기가 튀지 않게), 그 뒤로는 크기가 바뀔 때마다 다시 잰다
  useLayoutEffect(() => {
    const el = svgRef.current;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 새 배치가 나오면 가구가 차례로 나타난다. 끝나면 클래스를 떼야 고를 때(순서가 바뀔 때) 다시 깜빡이지 않는다
  useEffect(() => {
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 1100);
    return () => clearTimeout(t);
  }, [enterKey]);

  // px = 화면 1px이 몇 cm인지: 도면이 무대에 꼭 맞게 들어가는 배율 (글자가 12px 안팎이 된다). 큰 화면에서는 글자를 한 단계 키운다
  const k = box.h >= 760 ? 1.2 : 1;
  const px = k * Math.max(0.2, (room.width + 20) / Math.max(120, box.w - 48 * k), (room.depth + 20) / Math.max(120, box.h - 68 * k));

  const levels = useMemo(() => {
    const m = {};
    for (const i of issues) {
      if (i.uid != null && m[i.uid] !== 'error') m[i.uid] = i.level;
      if (i.other != null && i.level === 'error') m[i.other] = 'error'; // 겹친 상대도 같이 빨갛게
    }
    return m;
  }, [issues]);

  const underlay = useMemo(() => {
    const lines = Array.isArray(room.underlay?.lines) ? room.underlay.lines : [];
    return lines.filter((l) => Array.isArray(l) && l.length >= 4 && l.every(Number.isFinite)).map((l) => `M${l[0]} ${l[1]}L${l[2]} ${l[3]}`).join('');
  }, [room.underlay]);

  // 통로 점은 10cm 간격으로만 그린다 (5cm 격자를 다 그리면 면처럼 뭉쳐 보인다)
  const walkDots = useMemo(() => (showWalk && items.length ? walk.points.filter((p) => p.x % 10 === 0 && p.y % 10 === 0) : []), [walk, showWalk, items.length]);

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

  const sel = items.find((i) => i.uid === selected);
  const draw = (it, i) => {
    const on = it.uid === selected, level = levels[it.uid];
    return (
      <g
        key={it.uid} data-uid={it.uid} tabIndex={0} role="button" aria-pressed={on}
        aria-label={`${it.name}${level === 'error' ? ', 오류 있음' : level === 'warn' ? ', 주의' : ''}. 방향키로 옮기고 R로 돌려요`}
        className={`plan-item${it.floor ? ' is-floor' : ''}${on ? ' is-selected' : ''}${entering ? ' is-enter' : ''}`}
        style={entering ? { animationDelay: `${i * 40}ms` } : undefined}
        onPointerDown={(e) => startDrag(e, it)} onFocus={() => { if (!on) onSelect(it.uid); }}
      >
        <g transform={symbolTransform(it)}>
          {(on || level) && <ClearZone spec={it} level={level} />}
          <FurnitureSymbol spec={it} palette={style.palette} selected={on} level={level} />
          <FurnitureLabel spec={it} rot={it.rot} px={px} level={level} />
        </g>
      </g>
    );
  };
  // 러그는 맨 아래, 고른 가구는 맨 위 (끌어서 다른 가구 위로 가도 보이게)
  const rugs = items.filter((i) => i.floor);
  const rest = items.filter((i) => !i.floor).sort((a, b) => (a.uid === selected) - (b.uid === selected));

  return (
    <>
      <svg
        ref={svgRef} className="plan" viewBox={planViewBox(room, px)} role="group" aria-label={`평면도. 방 ${room.width}cm × ${room.depth}cm, 가구 ${items.length}개`}
        onPointerDown={() => onSelect(null)} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      >
        <PlanDefs room={room} palette={style.palette} />
        <RoomShell room={room} palette={style.palette} px={px} />
        {underlay && <path className="plan-underlay" d={underlay} clipPath="url(#bk-room)" fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        {rugs.map(draw)}
        {showWalk && items.length > 0 && <WalkOverlay points={walkDots} />}
        {rest.map((it, i) => draw(it, i + rugs.length))}
      </svg>
      {sel && !dragging && (
        <Toolbar
          item={sel} stageRef={stageRef}
          onNudge={(dx, dy) => move(sel.uid, sel.x + dx, sel.y + dy)} onRotate={() => onRotate(sel.uid)} onRemove={() => onRemove(sel.uid)}
        />
      )}
    </>
  );
}
