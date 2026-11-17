// 집 전체 꾸미기 화면(/home.html): 평면도에서 방을 여러 개 가져와 하나씩 꾸미고, 방마다 든 돈과 집 전체 합계를 본다.
// 메인 화면(App.jsx)은 방 하나만 다루므로 고치지 않고, 방을 바꿀 때 이 화면이 저장값을 갈아 끼운다(src/home.js).
import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './v3/theme.css';
import './home.css';
import { MAX_ROOMS, openHome, writeHome, addRooms, openRoom, removeRoom, costOf } from './home.js';

const FloorplanImport = lazy(() => import('./FloorplanImport.jsx'));
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

function Home() {
  const [home, setHome] = useState(openHome);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  // 브라우저의 뒤로 가기로 돌아오면 화면이 그대로 되살아난다. 그때도 메인에서 바뀐 내용을 다시 받는다
  useEffect(() => {
    const back = (e) => { if (e.persisted) setHome(openHome()); };
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);

  const update = (next, note = '') => {
    const saved = writeHome(next);
    setMsg(saved === true ? note : saved ? '저장 공간이 모자라서 도면 밑그림은 빼고 저장했어요.' : '브라우저 저장 공간이 모자라서 저장하지 못했어요. 방을 줄인 뒤에 다시 해 주세요.');
    setHome(next);
  };
  // 무엇을 하든 그 직전에 메인의 최신 내용을 다시 받는다(openHome). 다른 탭에서 꾸민 내용을 옛 목록으로 덮어쓰지 않게
  const add = (list, made = '가져왔어요') => {
    const base = openHome();
    const next = addRooms(base, list);
    const added = next.rooms.length - base.rooms.length;
    update(next, added < list.length ? `방은 ${MAX_ROOMS}개까지 둘 수 있어서 ${added}개만 ${made}.`
      : next.rooms.length >= MAX_ROOMS ? `방 ${added}개를 ${made}. 방은 ${MAX_ROOMS}개까지 둘 수 있어요. 더 넣으려면 방을 하나 빼 주세요.`
        : `방 ${added}개를 ${made}. [이 방 꾸미기]를 눌러 하나씩 꾸며 보세요.`);
  };
  const go = (id) => {
    openRoom(openHome(), id);
    window.location.href = './#room'; // #room: 메인이 이 표시를 보고 시작 화면을 건너뛸 수 있게 붙인다(메인이 안 봐도 그대로 열린다)
  };
  const remove = (r) => {
    if (!window.confirm(`"${r.name}" 방을 목록에서 뺄까요? 이 방에 꾸며 둔 내용도 함께 지워져요.`)) return;
    update(removeRoom(openHome(), r.id), `"${r.name}" 방을 뺐어요.`);
    document.querySelector('.home-h')?.focus(); // 누른 버튼이 사라지므로 초점을 제목으로 옮긴다
  };

  const full = home.rooms.length >= MAX_ROOMS;
  const costs = home.rooms.map((r) => costOf(r.state));
  const total = costs.reduce((a, c) => a + (c?.total || 0), 0);
  const done = costs.filter((c) => c?.count).length;
  const addButtons = (
    <>
      <button className="btn" type="button" disabled={full} onClick={() => add([{ label: '', room: {} }], '추가했어요')}>빈 방 추가</button>
      <button className="btn primary" type="button" disabled={full} onClick={() => setOpen(true)}>평면도에서 방 가져오기</button>
    </>
  );

  return (
    <div className="home">
      <header className="topbar home-top">
        <a className="brand" href="./" aria-label="방꾸미로 돌아가기">
          {/* 메인 위 막대와 같은 로고 (index.html의 #i-logo와 같은 그림. 이 화면에는 그 그림 모음이 없어서 직접 그린다) */}
          <span className="logo">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M4.5 4.5h15v15h-15z" /><path d="M4.5 11h6.5v4M14.5 19.5v-6h5" />
            </svg>
          </span>방꾸미
        </a>
        <span className="vsep" />
        <div className="project"><b>우리 집 전체</b><span className="num">방 {home.rooms.length}개 · 꾸민 방 {done}개</span></div>
        <span className="sp" />
        {home.rooms.length > 0 && addButtons}
      </header>

      <main className="home-main">
        <div>
          <h1 className="home-h" tabIndex={-1}>우리 집 전체 꾸미기</h1>
          <p className="home-lead">방을 여러 개 가져와서 하나씩 꾸며요. 방마다 드는 돈과 집 전체에 드는 돈을 여기에서 한눈에 볼 수 있어요.</p>
        </div>
        <p className="hint" role="status">{msg}</p>

        {home.rooms.length === 0 ? (
          <section className="card home-empty">
            <b>아직 가져온 방이 없어요</b>
            <p>평면도 그림에서 꾸밀 방을 한꺼번에 골라 가져오거나, 빈 방을 추가해서 크기를 직접 적어 주세요.</p>
            <div className="rowx">{addButtons}</div>
          </section>
        ) : (
          <>
            <section className="card home-sum" aria-labelledby="home-sum-h">
              <div>
                <h2 id="home-sum-h">집 전체 예상 비용</h2>
                <p className="home-total num">{won(total)}</p>
                <p className="hint">방 {home.rooms.length}개 가운데 {done}개를 꾸몄어요. 방마다 방꾸미 비용 화면의 합계와 같은 금액이에요.</p>
              </div>
              {done > 0 && (
                <ul className="home-bars" aria-label="방마다 드는 돈">
                  {home.rooms.map((r, i) => (costs[i]?.count ? (
                    <li key={r.id}>
                      <span>{r.name}</span>
                      <span className="home-bar" aria-hidden="true"><i style={{ width: `${total ? Math.round((costs[i].total / total) * 100) : 0}%` }} /></span>
                      <b className="num">{won(costs[i].total)}</b>
                    </li>
                  ) : null))}
                </ul>
              )}
            </section>

            <ul className="home-rooms" aria-label="방 목록">
              {home.rooms.map((r, i) => {
                const c = costs[i];
                const { width, depth } = r.state.room;
                const k = Math.min(56 / width, 40 / depth); // 작은 방 그림의 배율
                return (
                  <li key={r.id} className={`card home-room${r.id === home.active ? ' is-on' : ''}`}>
                    <div className="home-room-h">
                      <svg viewBox="0 0 64 48" aria-hidden="true"><rect x={(64 - width * k) / 2} y={(48 - depth * k) / 2} width={width * k} height={depth * k} rx="2" /></svg>
                      <div>
                        <b>{r.name}</b>
                        <span className="num">{(width / 100).toFixed(1)} × {(depth / 100).toFixed(1)} m</span>
                      </div>
                      {r.id === home.active && <span className="badge ok">방금 꾸민 방</span>}
                    </div>
                    <p className="home-cost">
                      {c === null ? <span className="hint">금액을 계산하지 못했어요</span>
                        : c.count ? <><b className="num">{won(c.total)}</b><span className="hint num">가구 {c.count}개 {won(c.furniture)}{c.props ? ` · 소품 ${won(c.props)}` : ''}</span></>
                          : <span className="hint">아직 꾸미지 않았어요</span>}
                    </p>
                    <div className="rowx">
                      <button className="btn primary sm" type="button" onClick={() => go(r.id)}>{c?.count ? '이어서 꾸미기' : '이 방 꾸미기'}</button>
                      <button className="btn ghost sm" type="button" onClick={() => remove(r)}>빼기</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>

      {open && (
        <Suspense fallback={null}>
          <FloorplanImport multi onApply={add} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

// 메인의 방 바꾸기에서 왔으면(#open=<방 id>) 목록을 그리지 않고, 그 방을 메인에 올린 뒤 바로 돌려보낸다.
// 메인이 떠나면서 저장한 지금 방을 openHome이 먼저 받아 두므로, 메인에서 방을 바꿔도 꾸민 내용이 남는다
function jump() {
  const want = /^#open=(.+)$/.exec(window.location.hash)?.[1];
  if (!want) return false;
  let id = want;
  try { id = decodeURIComponent(want); } catch { /* 풀 수 없으면 그대로 본다 */ }
  const home = openHome();
  if (!home.rooms.some((r) => r.id === id)) {
    window.history.replaceState(null, '', window.location.pathname); // 없는 방이면 표시를 지우고 목록을 보여 준다
    return false;
  }
  openRoom(home, id);
  window.location.replace('./#room'); // 뒤로 가기에 이 중간 화면이 남지 않게 바꿔 끼운다
  return true;
}

if (!jump()) createRoot(document.getElementById('root')).render(<StrictMode><Home /></StrictMode>);
