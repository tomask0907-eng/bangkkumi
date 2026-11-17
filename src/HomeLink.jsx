// 메인(App.jsx)에 꽂는 조각 두 개. install-home.mjs가 App.jsx에 넣는다. 내용을 고칠 때는 App.jsx가 아니라 이 파일만 고치면 된다.
// - RoomSwitch: 위 막대의 제목 자리. 지금 꾸미는 방의 이름이 보이고, 누르면 다른 방이나 집 전체 화면으로 간다
// - HomeLink(기본): 방 패널 맨 아래의 "집 전체 꾸미기" 묶음. 다른 방으로 가는 버튼도 여기에 있다
import Ic from './v3/Ic.jsx';
import './home-link.css';
import { homeRooms } from './home.js';

// 방을 바꿀 때는 늘 home.html을 거친다: 메인이 떠나면서 저장한 지금 방을 먼저 받아 둔 다음에 고른 방을 올려야 한다
// (메인에서 바로 저장값을 바꾸면, 떠나면서 하는 저장이 그것을 다시 덮어쓴다). #open=<방 id>가 붙으면 home.html이 목록 없이 바로 돌려보낸다
const HOME = './home.html';
const openRoom = (id) => window.location.assign(`${HOME}#open=${encodeURIComponent(id)}`);

export function RoomSwitch({ state, fallback }) {
  const { rooms, current } = homeRooms(state);
  if (!rooms.length) return fallback; // 집 전체 꾸미기를 쓰지 않을 때는 원래 제목 그대로
  return (
    <select
      className="home-switch" aria-label="꾸밀 방 바꾸기" title="다른 방으로 바꾸거나 집 전체 화면으로 가요" value={current ?? '*'}
      onChange={(e) => (e.target.value === '*home' ? window.location.assign(HOME) : openRoom(e.target.value))}
    >
      {!current && <option value="*" disabled>{fallback}</option>}
      {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      <option value="*home">집 전체 보기 (방 목록 · 비용)</option>
    </select>
  );
}

export default function HomeLink({ state }) {
  const { rooms, current } = homeRooms(state);
  const name = rooms.find((r) => r.id === current)?.name;
  const others = rooms.filter((r) => r.id !== current);
  return (
    <div className="sec">
      <div className="sec-h"><h3>집 전체 꾸미기</h3><span className="meta">방 여러 개 · 방별 비용</span></div>
      <div className="drop">
        <Ic name="open" /><b>{name ? `지금 꾸미는 방: ${name}` : '방을 여러 개 꾸며요'}</b>
        <button className="btn sm" type="button" onClick={() => window.location.assign(HOME)}>집 전체 보기</button>
      </div>
      {others.length > 0 && (
        <div className="home-others" role="group" aria-label="다른 방 꾸미기">
          {others.map((r) => <button key={r.id} className="btn sm soft" type="button" onClick={() => openRoom(r.id)}>{r.name} 꾸미기</button>)}
        </div>
      )}
      <p className="hint">{others.length
        ? '위 막대의 방 이름을 눌러도 다른 방으로 바꿀 수 있어요. 방마다 드는 돈과 집 전체 합계는 [집 전체 보기]에 있어요.'
        : '방을 여러 개 가져와 하나씩 꾸미고, 방마다 드는 돈과 집 전체 합계를 볼 수 있어요.'}</p>
    </div>
  );
}
