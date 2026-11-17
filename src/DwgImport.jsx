// DWG/DXF 도면에서 방 크기를 불러오는 모달. (CONTRACT 5.4)
// 파일 올리기 → 도면 미리보기 → 방 후보를 누르거나 직접 사각형을 끌기 → [이 방으로 설정]
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doorsForRect, defaultDoor, underlayFor, snapIndex, snapPoint, sizeText, ROOM_MIN, ROOM_MAX } from './dwg/geom.js';
import './dwg/dwg.css';

const MAX_BYTES = 30 * 1024 * 1024;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';

// 올리는 진행률을 보여 주려고 fetch 대신 XMLHttpRequest를 쓴다
function upload(file, onProgress, xhrRef) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', '/api/dwg');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.upload.onload = () => onProgress(1);
    xhr.onerror = () => reject(new Error('서버에 연결하지 못했어요. 잠시 뒤에 다시 해 보세요.'));
    xhr.onabort = () => reject(new Error(''));
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* 아래에서 처리 */ }
      if (xhr.status === 200 && body && Array.isArray(body.lines)) resolve(body);
      else reject(new Error((body && body.error) || '도면을 읽지 못했어요. 다른 파일로 다시 해 보세요.'));
    };
    xhr.send(file);
  });
}

export default function DwgImport({ onApply, onClose }) {
  const [busy, setBusy] = useState(null); // null | 0~1(올리는 중) | 'convert'(변환 중)
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(null);
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false); // 파일을 끌어서 위에 올려 둔 상태
  const [canDwg, setCanDwg] = useState(true);
  const [sel, setSel] = useState(null); // 고른 사각형 { x, y, w, h, cand } (도면 좌표 cm)
  const [mode, setMode] = useState('pan'); // 'pan' 끌어서 이동 | 'draw' 끌어서 사각형 그리기
  const [view, setView] = useState(null); // 보이는 범위의 왼쪽 위와 폭 { x, y, w } (cm)
  const [box, setBox] = useState(null); // SVG의 화면 크기(px). 재기 전에는 null

  const dialogRef = useRef(null);
  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const xhrRef = useRef(null);
  const dragRef = useRef(null);

  // ── 모달 기본 동작: 처음 초점, Esc로 닫기, Tab이 모달 밖으로 나가지 않게, 닫히면 초점 되돌리기
  useEffect(() => {
    const before = document.activeElement;
    dialogRef.current?.querySelector('.dwg-primary')?.focus();
    return () => { xhrRef.current?.abort(); before?.focus?.(); };
  }, []);
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const list = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  // 이 PC에 DWG 변환기가 없으면 DXF만 된다고 미리 알려 준다
  useEffect(() => {
    fetch('/api/dwg').then((r) => r.json()).then((c) => setCanDwg(c.dwg !== false)).catch(() => {});
  }, []);

  // ── 파일 올리기
  const open = useCallback(async (file) => {
    if (!file) return;
    setError('');
    if (!/\.(dwg|dxf)$/i.test(file.name)) return setError('DWG 또는 DXF 파일만 열 수 있어요.');
    if (file.size > MAX_BYTES) return setError('파일이 너무 커요. 30MB보다 작은 파일을 올려 주세요.');
    if (file.size === 0) return setError('파일이 비어 있어요.');
    setBusy(0);
    try {
      const data = await upload(file, (p) => setBusy(p >= 1 ? 'convert' : p), xhrRef);
      setPlan(data);
      setFileName(file.name);
      setSel(null);
      setView(null);
      setMode('pan');
    } catch (e) {
      if (e.message) setError(e.message);
    } finally {
      setBusy(null);
    }
  }, []);
  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    if (busy === null) open(e.dataTransfer.files?.[0]);
  };

  // ── 미리보기: 화면 크기 재기, 보이는 범위
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [plan]);

  const fit = useCallback((b) => {
    if (!box) return;
    const w = Math.max(b.w, (b.h * box.w) / box.h, 50) * 1.12;
    const h = (w * box.h) / box.w;
    setView({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w });
  }, [box]);
  useEffect(() => { if (plan && !view) fit(plan.bounds); }, [plan, view, fit]);

  const v = view || { x: 0, y: 0, w: 1000 };
  const bw = box?.w || 800;
  const bh = box?.h || 500;
  const k = v.w / bw; // 1px이 몇 cm인지
  const vh = k * bh;
  const toPlanXY = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: v.x + (e.clientX - r.left) * k, y: v.y + (e.clientY - r.top) * k };
  };
  const zoom = useCallback((factor, cx, cy) => {
    setView((cur) => {
      if (!cur) return cur;
      const w = Math.min(Math.max(cur.w * factor, 40), 400000);
      const f = w / cur.w;
      const h = box ? (cur.w * box.h) / box.w : cur.w;
      const px = cx ?? cur.x + cur.w / 2;
      const py = cy ?? cur.y + h / 2;
      return { x: px - (px - cur.x) * f, y: py - (py - cur.y) * f, w };
    });
  }, [box]);

  // 휠 확대는 페이지 스크롤을 막아야 해서 직접 등록한다 (React의 onWheel은 막을 수 없다)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((cur) => {
        if (!cur) return cur;
        const kk = cur.w / r.width;
        const px = cur.x + (e.clientX - r.left) * kk;
        const py = cur.y + (e.clientY - r.top) * kk;
        const w = Math.min(Math.max(cur.w * (e.deltaY < 0 ? 0.8 : 1.25), 40), 400000);
        const f = w / cur.w;
        return { x: px - (px - cur.x) * f, y: py - (py - cur.y) * f, w };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [plan]);

  const path = useMemo(() => (plan ? plan.lines.map((l) => `M${l[0]} ${l[1]}L${l[2]} ${l[3]}`).join('') : ''), [plan]);
  const snaps = useMemo(() => (plan ? snapIndex(plan.lines) : null), [plan]);
  const [snapMark, setSnapMark] = useState(null);

  // ── 끌기: 이동 모드에서는 화면 이동, 그리기 모드에서는 사각형 (선 끝점에 달라붙는다)
  const snap = (e) => { const p = toPlanXY(e); return snapPoint(snaps, p.x, p.y, 10 * k); };
  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (mode === 'draw' && e.button === 0) {
      const p = snap(e);
      dragRef.current = { type: 'draw', x: p.x, y: p.y };
      setSel({ x: p.x, y: p.y, w: 0, h: 0, cand: null, drawing: true });
    } else {
      dragRef.current = { type: 'pan', cx: e.clientX, cy: e.clientY, vx: v.x, vy: v.y, moved: false };
    }
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (mode === 'draw' && d?.type !== 'pan') {
      const p = snap(e);
      setSnapMark(p.snapped ? p : null);
      if (d?.type === 'draw') setSel({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y), cand: null, drawing: true });
    } else if (d?.type === 'pan') {
      const dx = e.clientX - d.cx;
      const dy = e.clientY - d.cy;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) setView((cur) => cur && { ...cur, x: d.vx - dx * k, y: d.vy - dy * k });
    }
  };
  const pick = (i) => {
    const r = plan.rooms[i];
    setSel({ x: r.x, y: r.y, w: r.w, h: r.h, cand: i });
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.type === 'draw') {
      // 너무 작게 그린 것은 실수로 보고 지운다
      setSel((s) => (s && s.w >= 20 && s.h >= 20 ? { ...s, drawing: false } : null));
      setMode('pan');
      setSnapMark(null);
    } else if (d?.type === 'pan' && !d.moved && e.type === 'pointerup' && e.button === 0) {
      // 끌지 않고 누르기만 했으면 그 자리의 방 후보를 고른다 (겹쳐 있으면 가장 작은 것)
      const p = toPlanXY(e);
      let best = -1;
      plan.rooms.forEach((r, i) => {
        if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) return;
        if (best < 0 || r.w * r.h < plan.rooms[best].w * plan.rooms[best].h) best = i;
      });
      if (best >= 0) pick(best);
    }
  };
  // 키보드로도 사각형을 놓고 옮길 수 있게 한다
  const placeCenter = () => {
    const w = Math.min(300, v.w * 0.5);
    const h = Math.min(400, vh * 0.5);
    setSel({ x: v.x + v.w / 2 - w / 2, y: v.y + vh / 2 - h / 2, w: Math.max(w, ROOM_MIN), h: Math.max(h, ROOM_MIN), cand: null });
  };
  const onSvgKey = (e) => {
    const step = e.shiftKey ? 1 : 10;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move && sel) { e.preventDefault(); setSel({ ...sel, x: sel.x + move[0], y: sel.y + move[1], cand: null }); } else if (e.key === '+' || e.key === '=') zoom(0.8); else if (e.key === '-') zoom(1.25);
  };

  // ── 고른 방
  const ready = sel && !sel.drawing;
  const width = ready ? Math.round(sel.w) : 0;
  const depth = ready ? Math.round(sel.h) : 0;
  const sizeOk = ready && width >= ROOM_MIN && width <= ROOM_MAX && depth >= ROOM_MIN && depth <= ROOM_MAX;
  const found = useMemo(() => {
    if (!plan || !ready) return [];
    const rect = { x: sel.x, y: sel.y, w: Math.round(sel.w), h: Math.round(sel.h) };
    const doors = doorsForRect(rect, plan.doorArcs);
    // 서버가 호 정보를 안 준 경우에는 후보에 딸린 문을 쓴다
    return doors.length || sel.cand == null ? doors : plan.rooms[sel.cand].doors || [];
  }, [plan, sel, ready]);
  const setSize = (key, value) => {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) setSel({ ...sel, [key]: Math.min(n, 5000) });
  };
  const apply = () => {
    if (!sizeOk) return;
    const rect = { x: sel.x, y: sel.y, w: width, h: depth };
    const cand = sel.cand != null ? plan.rooms[sel.cand] : null;
    onApply?.({
      width,
      depth,
      doors: found.length ? found : [defaultDoor(width)],
      windows: cand && Math.round(cand.w) === width && Math.round(cand.h) === depth ? cand.windows || [] : [],
      underlay: { lines: underlayFor(plan.lines, rect, 30, 4000) },
    });
    onClose?.(); // 적용하면 모달은 스스로 닫는다
  };

  const doorLine = (d) => {
    const horiz = d.wall === 'top' || d.wall === 'bottom';
    const x = horiz ? sel.x + d.offset : d.wall === 'left' ? sel.x : sel.x + sel.w;
    const y = horiz ? (d.wall === 'top' ? sel.y : sel.y + sel.h) : sel.y + d.offset;
    return { x1: x, y1: y, x2: horiz ? x + d.size : x, y2: horiz ? y : y + d.size };
  };
  const font = 12 * k;
  const uploading = busy !== null;
  // 방 후보 목록의 작은 그림 기준(가장 넓고 가장 긴 후보)
  const candMax = useMemo(() => (plan?.rooms || []).reduce((m, r) => ({ w: Math.max(m.w, r.w), h: Math.max(m.h, r.h) }), { w: 1, h: 1 }), [plan]);

  return (
    <div
      className="dwg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
    >
      <div className={`dwg-dialog${plan ? ' has-plan' : ''}${over ? ' is-over' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dwg-title" ref={dialogRef} onKeyDown={onKeyDown}>
        <header className="dwg-head">
          <h2 id="dwg-title">도면에서 방 불러오기</h2>
          {plan && <span className="dwg-file" title={fileName}>{fileName}</span>}
          <button type="button" className="dwg-x" onClick={onClose} aria-label="닫기">×</button>
        </header>

        <input
          ref={fileRef} type="file" accept=".dwg,.dxf" className="dwg-hidden" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }}
        />

        {error && <p className="dwg-error" role="alert">{error}</p>}

        {!plan && (
          <div className={`dwg-drop${over ? ' is-over' : ''}`}>
            {uploading ? (
              <div className="dwg-busy" role="status" aria-live="polite">
                <div className="dwg-spinner" aria-hidden="true" />
                <p>{busy === 'convert' ? '변환 중… 도면을 읽고 있어요. 보통 몇 초면 끝나요.' : `올리는 중… ${Math.round(busy * 100)}%`}</p>
                <progress max="1" value={busy === 'convert' ? undefined : busy} aria-label="진행 상태" />
              </div>
            ) : (
              <>
                <span className="dwg-drop-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9M4.5 15v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg></span>
                <p className="dwg-drop-title">도면 파일을 여기에 끌어다 놓으세요</p>
                <p className="dwg-muted">
                  {canDwg ? 'AutoCAD 도면(DWG, DXF)을 열 수 있어요. 30MB까지 돼요.' : '이 PC에는 DWG 변환기가 없어서 DXF 파일만 열 수 있어요. 30MB까지 돼요.'}
                </p>
                <button type="button" className="dwg-btn dwg-primary" onClick={() => fileRef.current.click()}>파일 고르기</button>
                <p className="dwg-muted dwg-small">원본 파일은 바뀌지 않아요. 이 PC 안에서만 읽어요.</p>
              </>
            )}
          </div>
        )}

        {plan && (
          <div className="dwg-body">
            <div className="dwg-stage">
              <div className="dwg-tools" role="toolbar" aria-label="도면 보기 도구">
                <button type="button" className={`dwg-btn${mode === 'pan' ? ' is-on' : ''}`} aria-pressed={mode === 'pan'} onClick={() => setMode('pan')}>이동</button>
                <button type="button" className={`dwg-btn${mode === 'draw' ? ' is-on' : ''}`} aria-pressed={mode === 'draw'} onClick={() => setMode('draw')}>직접 그리기</button>
                <span className="dwg-gap" />
                <button type="button" className="dwg-btn" onClick={() => zoom(0.7)} aria-label="확대">＋</button>
                <button type="button" className="dwg-btn" onClick={() => zoom(1.4)} aria-label="축소">－</button>
                <button type="button" className="dwg-btn" onClick={() => fit(plan.bounds)}>전체 보기</button>
              </div>
              <svg
                ref={svgRef} className={`dwg-svg is-${mode}`} viewBox={`${v.x} ${v.y} ${v.w} ${vh}`} preserveAspectRatio="xMidYMid meet"
                tabIndex={0} role="application" aria-label="도면 미리보기. 화살표 키로 고른 사각형을 옮기고, 더하기 빼기 키로 확대 축소해요."
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onSvgKey}
              >
                <path className="dwg-lines" d={path} />
                {plan.rooms.map((r, i) => (
                  <g key={i} className={`dwg-cand${sel?.cand === i ? ' is-picked' : ''}`}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} />
                    {r.w / k > 70 && (
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={font} textAnchor="middle">
                        {r.label && <tspan x={r.x + r.w / 2} dy={-font * 0.3}>{r.label}</tspan>}
                        <tspan x={r.x + r.w / 2} dy={r.label ? font * 1.25 : font * 0.35}>{Math.round(r.w)} × {Math.round(r.h)}</tspan>
                      </text>
                    )}
                  </g>
                ))}
                {sel && (
                  <g className="dwg-sel">
                    <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h} />
                    {ready && found.map((d, i) => <line key={i} {...doorLine(d)} />)}
                    {sel.w / k > 40 && (
                      <text x={sel.x + sel.w / 2} y={sel.y - font * 0.6} fontSize={font * 1.1} textAnchor="middle">
                        {Math.round(sel.w)} × {Math.round(sel.h)} cm
                      </text>
                    )}
                  </g>
                )}
                {snapMark && <circle className="dwg-snap" cx={snapMark.x} cy={snapMark.y} r={5 * k} />}
              </svg>
              <p className="dwg-muted dwg-small">
                {mode === 'draw'
                  ? '방의 한쪽 모서리에서 반대쪽 모서리까지 끌어 주세요. 선 끝에 가까이 가면 달라붙어요.'
                  : '마우스 휠로 확대·축소하고, 끌어서 옮겨요. 색칠된 방을 누르면 그 방이 골라져요.'}
              </p>
            </div>

            <aside className="dwg-side">
              <section>
                <h3>1. 방 고르기</h3>
                {plan.rooms.length ? (
                  <div className="dwg-rooms" role="group" aria-label={`방 후보 ${plan.rooms.length}개`}>
                    {plan.rooms.map((r, i) => {
                      // 작은 그림: 가장 큰 후보를 기준으로 서로의 크기 차이가 보이게 그린다
                      const s = Math.min(40 / candMax.w, 30 / candMax.h);
                      const gw = Math.max(r.w * s, 6);
                      const gh = Math.max(r.h * s, 6);
                      return (
                        <button
                          key={i} type="button" className={`dwg-room${sel?.cand === i ? ' is-on' : ''}`} aria-pressed={sel?.cand === i} title={r.label || `방 ${i + 1}`}
                          onClick={() => { pick(i); fit({ x: r.x - r.w * 0.6, y: r.y - r.h * 0.6, w: r.w * 2.2, h: r.h * 2.2 }); }}
                        >
                          <svg viewBox="0 0 48 36" aria-hidden="true"><rect x={(48 - gw) / 2} y={(36 - gh) / 2} width={gw} height={gh} /></svg>
                          <b>{r.label || `방 ${i + 1}`}</b>
                          <span>{(r.w / 100).toFixed(1)}×{(r.h / 100).toFixed(1)}m</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="dwg-muted">방 후보를 찾지 못했어요. 아래 버튼으로 직접 그려 주세요.</p>
                )}
                <div className="dwg-row">
                  <button type="button" className="dwg-btn" onClick={() => setMode('draw')}>직접 사각형 그리기</button>
                  <button type="button" className="dwg-btn" onClick={placeCenter}>가운데에 놓기</button>
                </div>
                <p className="dwg-muted dwg-small">후보는 추천일 뿐이에요. 맞지 않으면 직접 그려 주세요. 도면 단위는 {{ mm: '밀리미터', cm: '센티미터', m: '미터', inch: '인치' }[plan.unit] || plan.unit}로 읽었어요.</p>
              </section>

              <section>
                <h3>2. 크기 확인</h3>
                {ready ? (
                  <>
                    <div className="dwg-row">
                      <label className="dwg-field">가로 (cm)
                        <input type="number" inputMode="numeric" min={ROOM_MIN} max={ROOM_MAX} step="1" value={width} onChange={(e) => setSize('w', e.target.value)} />
                      </label>
                      <label className="dwg-field">세로 (cm)
                        <input type="number" inputMode="numeric" min={ROOM_MIN} max={ROOM_MAX} step="1" value={depth} onChange={(e) => setSize('h', e.target.value)} />
                      </label>
                    </div>
                    <p className="dwg-size" aria-live="polite">{sizeText(width, depth)}</p>
                    {!sizeOk && <p className="dwg-error" role="alert">방 크기는 가로·세로 모두 {ROOM_MIN}cm에서 {ROOM_MAX}cm 사이여야 해요.</p>}
                    <p className="dwg-muted dwg-small">
                      {found.length
                        ? `문 ${found.length}개를 찾았어요. 위치는 나중에 바꿀 수 있어요.`
                        : '문을 찾지 못해서 아래쪽 벽에 기본 현관문을 넣어요. 나중에 바꿀 수 있어요.'}
                    </p>
                  </>
                ) : (
                  <p className="dwg-size" aria-live="polite">{sel ? sizeText(sel.w, sel.h) : '아직 고른 방이 없어요.'}</p>
                )}
              </section>

              <div className="dwg-actions">
                <button type="button" className="dwg-btn" onClick={() => fileRef.current.click()} disabled={uploading}>
                  {uploading ? (busy === 'convert' ? '변환 중…' : `올리는 중… ${Math.round(busy * 100)}%`) : '다른 파일 열기'}
                </button>
                <button type="button" className="dwg-btn dwg-primary" onClick={apply} disabled={!sizeOk}>이 방으로 설정</button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
