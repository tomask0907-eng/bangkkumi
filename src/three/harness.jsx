// 3D 보기만 따로 띄워 보는 시험 화면. 주소 뒤에 ?gallery=1 (모든 가구 모양), ?style=modern 을 붙일 수 있다.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Plan3D from '../Plan3D.jsx';

const pal = (...hex) => ['벽', '바닥', '메인 가구', '패브릭', '포인트'].map((role, i) => ({ role, name: role, hex: hex[i] }));
const STYLES = {
  natural: { key: 'natural', name: '내추럴', palette: pal('#f3ecdf', '#c8a77e', '#b08a5e', '#ddd0b8', '#7d8b5a') },
  modern: { key: 'modern', name: '모던', palette: pal('#e2e3e4', '#8d8f91', '#4a3b30', '#a7a9ab', '#c7a250') },
};
const spec = (uid, name, category, w, d, h, clear, x, y, rot, more) => ({ uid, key: uid, name, category, w, d, h, clear, x, y, rot, color: '#b9a48c', ...more });

// 예시 방(3m × 4m): 문은 아래쪽 벽, 창문은 위쪽 벽
const ROOM = { width: 300, depth: 400, height: 240, doors: [{ wall: 'bottom', offset: 195, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 150, size: 120, sill: 90, height: 120 }] };
const ITEMS = [
  spec('bed', '슈퍼싱글 침대', 'bed', 110, 200, 45, 0, 0, 0, 0),
  spec('desk', '책상', 'desk', 120, 60, 72, 60, 150, 0, 0),
  spec('wardrobe', '옷장', 'storage', 100, 60, 200, 50, 240, 150, 90),
  spec('shelf', '책장', 'storage', 80, 30, 180, 40, 0, 220, 270),
  spec('dresser', '서랍장', 'storage', 80, 45, 80, 40, 20, 355, 180),
  spec('rug', '러그', 'decor', 120, 160, 1, 0, 100, 185, 0, { floor: true }),
  spec('plant', '화분', 'decor', 40, 40, 120, 0, 255, 95, 0),
];

// 모든 모양을 한 번에 보는 큰 방. 위쪽 벽 줄은 rot 0, 아래쪽 벽 줄은 rot 180, 양옆은 270 / 90.
const G_ROOM = { width: 1000, depth: 520, height: 240, doors: [{ wall: 'left', offset: 220, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 300, size: 180, sill: 90, height: 120 }, { wall: 'right', offset: 40, size: 150, sill: 0, height: 210 }] };
const row = (list, y0, rot) => {
  let x = 20;
  return list.map(([name, category, w, d, h, clear, more]) => {
    const it = spec(`${name}-${rot}`, name, category, w, d, h, clear, x, rot === 0 ? y0 : y0 - d, rot, more);
    x += w + 22;
    return it;
  });
};
const G_ITEMS = [
  ...row([['퀸 침대', 'bed', 150, 200, 45, 0], ['책상', 'desk', 120, 60, 72, 60], ['옷장', 'storage', 100, 60, 200, 50], ['책장', 'storage', 80, 30, 180, 40], ['서랍장', 'storage', 80, 45, 80, 40], ['2인 소파', 'seating', 150, 80, 80, 40], ['냉장고', 'appliance', 60, 65, 170, 50], ['세탁기', 'appliance', 60, 60, 85, 50]], 0, 0),
  ...row([['TV 거실장', 'storage', 140, 40, 45, 0], ['스탠드 행거', 'storage', 120, 45, 160, 40], ['전신거울', 'decor', 50, 30, 160, 0], ['장스탠드 조명', 'decor', 35, 35, 150, 0], ['몬스테라 화분', 'decor', 45, 45, 130, 0], ['전자피아노', 'etc', 135, 40, 85, 0], ['화장대', 'desk', 80, 40, 72, 50], ['협탁', 'storage', 45, 40, 50, 0], ['전자레인지', 'appliance', 50, 40, 30, 0], ['캣타워', 'etc', 60, 60, 150, 0]], 520, 180),
  spec('table', '2인 식탁', 'table', 80, 70, 73, 50, 380, 225, 0),
  spec('round', '원형 테이블', 'table', 70, 70, 45, 0, 560, 240, 0),
  spec('rug', '원형 러그', 'decor', 160, 160, 1, 0, 515, 195, 0, { floor: true }),
  spec('chair', '의자', 'seating', 45, 45, 85, 0, 700, 250, 90),
  spec('bed270', '싱글 침대', 'bed', 100, 200, 45, 0, 0, 330, 270),
];

function Harness() {
  const q = new URLSearchParams(location.search);
  const gallery = q.has('gallery');
  const custom = q.get('room') && JSON.parse(q.get('room')); // ?room={"width":600,…} 다른 방 모양으로 시험할 때
  const [selected, setSelected] = useState(null);
  const [shown, setShown] = useState(true); // 껐다 켜서 자원 정리(언마운트)를 시험한다
  const [moved, setMoved] = useState(false); // 가구만 옮겼을 때 다시 그리는지 시험한다
  const items = (gallery ? G_ITEMS : ITEMS).map((it) => (moved && it.uid === 'plant' ? { ...it, x: 130, y: 250 } : it));
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <p id="status" style={{ margin: 0, padding: '6px 12px', fontSize: 13 }}>
        고른 가구: {selected ?? '없음'}{' '}
        <button type="button" onClick={() => setShown(!shown)}>{shown ? '3D 끄기' : '3D 켜기'}</button>{' '}
        <button type="button" onClick={() => setMoved(!moved)}>화분 옮기기</button>
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        {shown && <Plan3D room={custom || (gallery ? G_ROOM : ROOM)} items={items} style={STYLES[q.get('style')] || STYLES.natural} selected={selected} onSelect={setSelected} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
