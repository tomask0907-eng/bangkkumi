// DwgImport만 따로 띄워 보는 시험 화면: /src/dwg/harness.html
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DwgImport from '../DwgImport.jsx';

function Harness() {
  const [open, setOpen] = useState(true);
  const [room, setRoom] = useState(null);
  const m = 40; // 밑그림 여유
  return (
    <div>
      <h1>DWG 불러오기 시험</h1>
      <button type="button" id="open" onClick={() => setOpen(true)}>도면 불러오기 열기</button>
      {open && <DwgImport onApply={setRoom} onClose={() => setOpen(false)} />}
      {room && (
        <div id="result">
          <p id="result-size">적용된 방: {room.width} × {room.depth} cm, 문 {room.doors.length}개, 창 {room.windows.length}개, 밑그림 선 {room.underlay.lines.length}개</p>
          <pre id="result-doors">{JSON.stringify(room.doors)}</pre>
          <svg viewBox={`${-m} ${-m} ${room.width + m * 2} ${room.depth + m * 2}`} style={{ width: 520, maxHeight: 520, border: '1px solid #ccc' }}>
            <path d={room.underlay.lines.map((l) => `M${l[0]} ${l[1]}L${l[2]} ${l[3]}`).join('')} stroke="#999" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
            <rect width={room.width} height={room.depth} fill="none" stroke="#2f6fde" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            {room.doors.map((d, i) => {
              const horiz = d.wall === 'top' || d.wall === 'bottom';
              const x = horiz ? d.offset : d.wall === 'left' ? 0 : room.width;
              const y = horiz ? (d.wall === 'top' ? 0 : room.depth) : d.offset;
              return <line key={i} x1={x} y1={y} x2={horiz ? x + d.size : x} y2={horiz ? y : y + d.size} stroke="#1f9d55" strokeWidth="7" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

// 주소 끝에 ?theme 을 붙이면 앱 테마를 입힌 모습으로 본다
if (new URLSearchParams(window.location.search).has('theme')) await import('../v3/theme.css');
createRoot(document.getElementById('root')).render(<Harness />);
