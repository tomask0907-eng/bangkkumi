// 주소나 평면도 그림에서 방을 불러오는 모달. DwgImport와 같은 방식으로 쓴다.
// 주소 입력 → 평형 고르기 → AI가 평면도 읽기 → 방 고르기 → [이 방으로 설정]
// 또는 평면도 그림 올리기(끌어다 놓기, 붙여넣기) → AI가 읽기 → 방 고르기
import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultDoor, sizeText, ROOM_MIN, ROOM_MAX } from './dwg/geom.js';
import './dwg/dwg.css';
import './floorplan.css';

const API = '/api/floorplan';
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';
const READ_MS = 170_000; // AI가 그림을 읽는 데 30초~1분쯤 걸린다
const MAX_SIDE = 1600; // 올리는 그림은 이 크기로 줄여서 보낸다
const WALL_NAME = { top: '위쪽', bottom: '아래쪽', left: '왼쪽', right: '오른쪽' };

async function call(init, timeoutMs, signal) {
  let res;
  try {
    res = await fetch(API, { ...init, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) });
  } catch (e) {
    if (signal.aborted) throw new Error(''); // 사용자가 그만둔 경우
    throw new Error(e?.name === 'TimeoutError' ? '응답이 너무 오래 걸려요. 잠시 뒤에 다시 해 보세요.' : '서버에 연결하지 못했어요.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error((typeof body?.error === 'string' && body.error) || '요청을 처리하지 못했어요.');
  return body;
}

// 어떤 그림이든 브라우저에서 JPG로 바꾸고 줄여서 보낸다 (큰 사진도 5MB 안쪽이 된다)
async function toJpeg(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('그림 파일을 열지 못했어요. JPG나 PNG 그림을 올려 주세요.'); }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 투명한 PNG는 흰 바탕으로
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => { canvas.toBlob(resolve, 'image/jpeg', 0.9); });
  if (!blob) throw new Error('그림 파일을 열지 못했어요. 다른 그림으로 해 보세요.');
  return blob;
}

// 방 크기를 고치면 문·창문 위치도 같은 비율로 옮긴다 (범위 보정은 normalizeRoom이 한다)
const refit = (list, room, w, h) => list.map((o) => {
  const horiz = o.wall === 'top' || o.wall === 'bottom';
  const f = horiz ? w / room.w : h / room.h;
  return { ...o, offset: Math.round(o.offset * f) };
});

export default function FloorplanImport({ onApply, onClose }) {
  const [lookup, setLookup] = useState(null); // null 확인 중 | true | false(주소로 찾기 꺼짐) | 'missing'(서버에 연결 안 됨)
  const [busy, setBusy] = useState(null); // null | 'search' | 'read'
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState(''); // 올리는 그림의 전용면적(㎡, 선택)
  const [found, setFound] = useState(null); // { complex, others, types, source }
  const [plan, setPlan] = useState(null); // 서버가 준 plan + img(그림 주소) + title
  const [sel, setSel] = useState(null); // 고른 방 번호
  const [size, setSize] = useState({ w: 0, h: 0 }); // 고른 방의 크기(cm, 고칠 수 있다)
  const [tall, setTall] = useState([]); // 고른 방의 창마다: 바닥까지 트여 있는지 (구획용 창호, 통창)
  const [over, setOver] = useState(false);

  const dialogRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(new AbortController());
  const urlRef = useRef(''); // 올린 그림의 임시 주소 (닫을 때 지운다)

  // ── 모달 기본 동작: 처음 초점, Esc로 닫기, Tab이 모달 밖으로 나가지 않게, 닫히면 초점 되돌리기
  useEffect(() => {
    const before = document.activeElement;
    dialogRef.current?.focus();
    return () => { abortRef.current.abort(); URL.revokeObjectURL(urlRef.current); before?.focus?.(); };
  }, []);
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const list = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === dialogRef.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  };

  // 서버에 이 기능이 있는지, 주소로 찾기가 켜져 있는지
  useEffect(() => {
    fetch(API).then((r) => r.json()).then((c) => setLookup(typeof c?.lookup === 'boolean' ? c.lookup : 'missing')).catch(() => setLookup('missing'));
  }, []);

  const run = useCallback(async (kind, job) => {
    abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    setBusy(kind);
    try {
      await job(ctrl.signal);
    } catch (e) {
      if (e.message) setError(e.message);
    } finally {
      if (abortRef.current === ctrl) setBusy(null); // 나중에 시작한 요청의 "읽는 중" 표시는 지우지 않는다
    }
  }, []);
  const post = (body, ms, signal) => call({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ms, signal);
  const show = (data, img, title) => { setPlan({ ...data, img, title }); setSel(null); };

  const search = (e) => {
    e.preventDefault();
    if (address.trim().length < 2) return setError('주소나 아파트 이름을 입력해 주세요.');
    return run('search', async (signal) => { setFound(await post({ address }, 15000, signal)); });
  };
  // 요청이 도는 동안 또 누르면 받지 않는다 (같은 것을 직방에 두 번 묻지 않게)
  const pickComplex = (id) => !busy && run('search', async (signal) => { setFound(await post({ complex: id }, 15000, signal)); });
  const pickType = (t) => !busy && run('read', async (signal) => {
    const data = await post({ complex: found.complex.id, type: t.id }, READ_MS, signal);
    show(data, data.image, `${found.complex.name} ${t.title}`);
  });
  const upload = (file) => {
    if (!file || busy) return;
    if (!/^image\//.test(file.type)) { setError('그림 파일(JPG, PNG)만 올릴 수 있어요.'); return; }
    run('read', async (signal) => {
      const blob = await toJpeg(file);
      const m2 = Number(area);
      const data = await call({ method: 'POST', headers: { 'Content-Type': 'image/jpeg', ...(m2 >= 10 && m2 <= 1000 && { 'X-Area': String(m2) }) }, body: blob }, READ_MS, signal);
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      show(data, urlRef.current, m2 >= 10 && m2 <= 1000 ? `${file.name} · 전용 ${m2}㎡` : file.name); // 어떤 전용면적으로 계산했는지 보여 준다
    });
  };
  const back = () => { setPlan(null); setSel(null); setError(''); };
  // 화면이 바뀌면서 초점을 가진 버튼이 사라지면 초점을 모달로 되돌린다 (Esc와 Tab이 계속 되게)
  useEffect(() => {
    if (!dialogRef.current.contains(document.activeElement)) dialogRef.current.focus();
  }, [busy, found, plan]);

  // ── 고른 방
  const room = plan && sel != null ? plan.rooms[sel] : null;
  const pick = (i) => {
    if (i === sel) return; // 이미 고른 방을 다시 눌러도 고친 크기는 그대로 둔다
    setSel(i);
    setTall(plan.rooms[i].windows.map((w) => w.sill === 0));
    setSize({ w: Math.round(plan.rooms[i].w), h: Math.round(plan.rooms[i].h) });
  };
  const sizeOk = !!room && [size.w, size.h].every((v) => v >= ROOM_MIN && v <= ROOM_MAX);
  const setSide = (key, value) => {
    const n = Number(value);
    // 칸을 비울 수 있어야 새 숫자를 칠 수 있다 (비어 있는 동안에는 sizeOk가 false라 적용되지 않는다)
    if (value === '' || (Number.isFinite(n) && n > 0)) setSize({ ...size, [key]: value === '' ? '' : Math.min(Math.round(n), 5000) });
  };
  const apply = () => {
    if (!sizeOk) return;
    const doors = refit(room.doors, room, size.w, size.h);
    onApply?.({
      width: size.w,
      depth: size.h,
      doors: doors.length ? doors : [defaultDoor(size.w)],
      // 바닥까지 트인 창은 창대 0cm, 높이 210cm로 넣는다 (메인의 3D에서 그 벽이 트여 보이고, 가구가 그 앞을 막지 않는다)
      windows: refit(room.windows, room, size.w, size.h).map((w, i) => ({ ...w, ...(tall[i] ? { sill: 0, height: 210 } : { sill: 90, height: 120 }) })),
    });
    onClose?.(); // 적용하면 모달은 스스로 닫는다
  };
  const mark = (o) => { // 벽 위의 문·창문을 평면도 좌표의 선으로
    const horiz = o.wall === 'top' || o.wall === 'bottom';
    const x = horiz ? room.x + o.offset : o.wall === 'left' ? room.x : room.x + room.w;
    const y = horiz ? (o.wall === 'top' ? room.y : room.y + room.h) : room.y + o.offset;
    return { x1: x, y1: y, x2: horiz ? x + o.size : x, y2: horiz ? y : y + o.size };
  };
  const font = plan ? Math.max(plan.bounds.w, plan.bounds.h * 1.25) / 62 : 12; // 세로로 긴 그림에서도 글자가 작아지지 않게
  // 방 후보의 작은 그림 배율: 가장 큰 방을 기준으로 서로의 크기 차이가 보이게 한다
  const mini = plan ? Math.min(40 / Math.max(...plan.rooms.map((r) => r.w)), 30 / Math.max(...plan.rooms.map((r) => r.h))) : 1;
  const reading = busy === 'read';

  return (
    <div
      className="dwg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
    >
      <div
        className={`dwg-dialog${plan ? ' has-plan' : ''}${over ? ' is-over' : ''}`} role="dialog" aria-modal="true" aria-labelledby="fp-title"
        ref={dialogRef} tabIndex={-1} onKeyDown={onKeyDown} onPaste={(e) => { const f = e.clipboardData?.files?.[0]; if (f) { e.preventDefault(); upload(f); } }}
      >
        <header className="dwg-head">
          <h2 id="fp-title">{lookup === true ? '주소로 방 불러오기' : '평면도 그림으로 방 불러오기'}</h2>
          {plan && <span className="dwg-file" title={plan.title}>{plan.title}</span>}
          <button type="button" className="dwg-x" onClick={onClose} aria-label="닫기">×</button>
        </header>

        <input
          ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="dwg-hidden" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }}
        />

        {error && <p className="dwg-error" role="alert">{error}</p>}
        {lookup === 'missing' && (
          <p className="dwg-error" role="alert">평면도 그림 읽기는 PC에서 실행할 때만 돼요. 서버를 다시 켠 뒤에 해 보세요.</p>
        )}

        {reading && (
          <div className="dwg-drop">
            <div className="dwg-busy" role="status" aria-live="polite">
              <div className="dwg-spinner" aria-hidden="true" />
              <p>AI가 평면도를 읽고 있어요. 30초에서 1분쯤 걸려요.</p>
              <button type="button" className="dwg-btn" onClick={() => abortRef.current.abort()}>그만두기</button>
            </div>
          </div>
        )}

        {!reading && !plan && !found && (
          <div className={`dwg-drop${over ? ' is-over' : ''}`}>
            {lookup === true && (
              <>
                <p className="dwg-drop-title">아파트 주소나 이름을 입력해 주세요</p>
                <form className="fp-form" onSubmit={search}>
                  <input
                    type="text" autoFocus spellCheck={false} value={address} maxLength={120} onChange={(e) => setAddress(e.target.value)}
                    placeholder="예: 서울시 송파구 송파대로 345" aria-label="아파트 주소 또는 이름" autoComplete="off"
                  />
                  <button type="submit" className="dwg-btn dwg-primary" disabled={busy === 'search'}>{busy === 'search' ? '찾는 중…' : '평면도 찾기'}</button>
                </form>
                <p className="dwg-muted dwg-small">동·호수는 빼고 건물 주소만 직방 검색에 보내요. 아파트만 찾을 수 있어요.</p>
                <p className="fp-or">또는</p>
              </>
            )}
            <p className={lookup === true ? '' : 'dwg-drop-title'}>평면도 그림을 여기에 끌어다 놓거나 붙여 넣으세요</p>
            <div className="fp-form">
              <label className="dwg-field">전용면적 (㎡, 알면 적어 주세요)
                <input type="number" inputMode="decimal" min="10" max="1000" step="0.01" value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 84.95" />
              </label>
              <button type="button" className={`dwg-btn${lookup === true ? '' : ' dwg-primary'}`} onClick={() => fileRef.current.click()}>그림 고르기</button>
            </div>
            <p className="dwg-muted dwg-small">올린 그림은 AI(Claude)가 읽어요. 그림은 저장하지 않아요. 빌라나 주택 평면도도 돼요.</p>
          </div>
        )}

        {!reading && !plan && found && (
          <div className="fp-pick">
            <p>
              <b>{found.complex.name}</b>
              {found.complex.roadAddress && <span className="dwg-muted"> · {found.complex.roadAddress}</span>}
            </p>
            {found.others.length > 0 && (
              <div className="dwg-row" role="group" aria-label="다른 단지">
                <span className="dwg-muted dwg-small">{busy === 'search' ? '찾는 중…' : '찾는 단지가 아니면:'}</span>
                {found.others.map((c) => <button key={c.id} type="button" className="dwg-btn" onClick={() => pickComplex(c.id)}>{c.name}</button>)}
              </div>
            )}
            <p className="dwg-muted dwg-small">우리 집 평형을 골라 주세요. 계약서나 등기부에 적힌 전용면적으로 찾으면 쉬워요. 같은 평형이라도 동·호수에 따라 좌우가 뒤집힌 집이 있어요.</p>
            <ul className="fp-types">
              {found.types.map((t) => (
                <li key={t.id}>
                  <button type="button" className="fp-type" onClick={() => pickType(t)} disabled={!t.image} title={t.image ? '' : '평면도 그림이 없는 평형이에요'}>
                    {t.image && <img src={`${t.image}?w=320`} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                    <b>{t.title}</b>
                    <span>전용 {t.exclusive}㎡ · 방 {t.rooms} · 욕실 {t.baths}</span>
                    <span>{t.households.toLocaleString('ko-KR')}세대{t.image ? '' : ' · 그림 없음'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="dwg-actions">
              <span className="dwg-muted dwg-small fp-src">평면도 출처: {found.source}</span>
              <button type="button" className="dwg-btn" onClick={() => { setFound(null); setError(''); }}>다른 주소 찾기</button>
            </div>
          </div>
        )}

        {!reading && plan && (
          <div className="dwg-body">
            <div className="dwg-stage">
              <svg
                className="dwg-svg fp-svg" viewBox={`0 0 ${plan.bounds.w} ${plan.bounds.h}`} preserveAspectRatio="xMidYMid meet"
                role="img" aria-label="평면도. 색칠된 방을 누르면 그 방이 골라져요."
              >
                <image href={plan.img} x="0" y="0" width={plan.bounds.w} height={plan.bounds.h} preserveAspectRatio="none" />
                {plan.rooms.map((r, i) => (
                  <g key={i} className={`dwg-cand${sel === i ? ' is-picked' : ''}`} onClick={() => pick(i)}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} />
                    {/* 방 이름은 그림에 이미 적혀 있는 경우가 많아 겹친다. 크기만 가운데보다 조금 아래에 적는다(이름은 오른쪽 카드에 있다) */}
                    {sel !== i && (
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + font * 1.6} fontSize={font} textAnchor="middle">{Math.round(r.w)} × {Math.round(r.h)}</text>
                    )}
                  </g>
                ))}
                {room && (
                  <g className="dwg-sel">
                    <rect x={room.x} y={room.y} width={room.w} height={room.h} />
                    {room.doors.map((d, i) => <line key={`d${i}`} {...mark(d)} />)}
                    {room.windows.map((w, i) => <line key={`w${i}`} className={`fp-win${tall[i] ? ' fp-open' : ''}`} {...mark(w)} />)}
                    <text x={room.x + room.w / 2} y={room.y + room.h / 2} fontSize={font * 1.1} textAnchor="middle">{room.label}</text>
                  </g>
                )}
              </svg>
              <p className="dwg-muted dwg-small">색칠된 방을 누르면 그 방이 골라져요. 주황색 선은 문, 하늘색 선은 창문, 굵은 파란색 선은 바닥까지 트인 창이에요.</p>
            </div>

            <aside className="dwg-side">
              <section>
                <h3>1. 방 고르기</h3>
                {/* 새 디자인의 방 후보 목록(.dwg-rooms: 작은 방 그림 + 이름 + 크기). DwgImport와 같은 모양이다 */}
                <div className="dwg-rooms" role="group" aria-label={`방 후보 ${plan.rooms.length}개`}>
                  {plan.rooms.map((r, i) => {
                    const gw = Math.max(r.w * mini, 6);
                    const gh = Math.max(r.h * mini, 6);
                    return (
                      <button key={i} type="button" className={`dwg-room${sel === i ? ' is-on' : ''}`} aria-pressed={sel === i} title={r.label || `방 ${i + 1}`} onClick={() => pick(i)}>
                        <svg viewBox="0 0 48 36" aria-hidden="true"><rect x={(48 - gw) / 2} y={(36 - gh) / 2} width={gw} height={gh} /></svg>
                        <b>{r.label || `방 ${i + 1}`}</b>
                        <span>{(r.w / 100).toFixed(1)}×{(r.h / 100).toFixed(1)}m</span>
                      </button>
                    );
                  })}
                </div>
                <p className="dwg-muted dwg-small">{plan.notice}</p>
              </section>

              <section>
                <h3>2. 크기 확인</h3>
                {room ? (
                  <>
                    <div className="dwg-row">
                      <label className="dwg-field">가로 (cm)
                        <input type="number" inputMode="numeric" min={ROOM_MIN} max={ROOM_MAX} step="1" value={size.w} onChange={(e) => setSide('w', e.target.value)} />
                      </label>
                      <label className="dwg-field">세로 (cm)
                        <input type="number" inputMode="numeric" min={ROOM_MIN} max={ROOM_MAX} step="1" value={size.h} onChange={(e) => setSide('h', e.target.value)} />
                      </label>
                    </div>
                    <p className="dwg-size" aria-live="polite">{sizeText(size.w, size.h)}</p>
                    {!sizeOk && <p className="dwg-error" role="alert">방 크기는 가로·세로 모두 {ROOM_MIN}cm에서 {ROOM_MAX}cm 사이여야 해요.</p>}
                    <p className="dwg-muted dwg-small">
                      {room.doors.length ? `문 ${room.doors.length}개` : '문을 찾지 못해서 아래쪽 벽에 기본 문을 넣어요'}
                      {`, 창문 ${room.windows.length}개를 넣어요. 위치는 나중에 바꿀 수 있어요.`}
                    </p>
                    {room.windows.map((w, i) => (
                      <label key={i} className="fp-check">
                        <input type="checkbox" checked={!!tall[i]} onChange={(e) => setTall(room.windows.map((_, j) => (j === i ? e.target.checked : !!tall[j])))} />
                        {WALL_NAME[w.wall]} 벽 창(폭 {w.size}cm)이 바닥까지 트여 있어요
                      </label>
                    ))}
                  </>
                ) : (
                  <p className="dwg-size" aria-live="polite">아직 고른 방이 없어요.</p>
                )}
              </section>

              <div className="dwg-actions">
                <button type="button" className="dwg-btn" onClick={back}>{found ? '다른 평형 고르기' : '다른 그림 올리기'}</button>
                <button type="button" className="dwg-btn dwg-primary" onClick={apply} disabled={!sizeOk}>이 방으로 설정</button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
