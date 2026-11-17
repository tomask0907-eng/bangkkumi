// ① 방: 요약 카드 + 가로·세로·천장 높이 + 문·창문 목록. 값은 App이 normalizeRoom으로 다듬어 돌려준다.
// 모양은 시안(docs/design-v3/a/app.html 의 방 패널) 그대로: .roomcard, .sec, .row3, .open-row
import { NumInput } from './inputs.jsx';
import Ic from '../v3/Ic.jsx';

const WALLS = [['top', '위쪽 벽'], ['bottom', '아래쪽 벽'], ['left', '왼쪽 벽'], ['right', '오른쪽 벽']];
const lenOf = (room, wall) => (wall === 'top' || wall === 'bottom' ? room.width : room.depth);
// 아직 문(창문)이 없는 벽부터 고른다
const freeWall = (list, order) => order.find((w) => !list.some((o) => o.wall === w)) || order[0];
const m1 = (cm) => (cm / 100).toFixed(1);

// 요약 카드의 작은 방 그림: 실제 방 비율, 창문(옅은 파랑), 문(벽을 끊고 열리는 호)
function RoomGlyph({ room }) {
  const W = room.width, D = room.depth;
  const k = Math.min(54 / W, 40 / D);
  const w = W * k, d = D * k, x0 = (60 - w) / 2, y0 = (46 - d) / 2;
  const seg = (o) => {
    const horiz = o.wall === 'top' || o.wall === 'bottom';
    const off = (o.offset || 0) * k, s = o.size * k;
    const x = horiz ? x0 + off : o.wall === 'left' ? x0 : x0 + w;
    const y = horiz ? (o.wall === 'top' ? y0 : y0 + d) : y0 + off;
    return { x, y, s, horiz };
  };
  const f = (n) => Math.round(n * 10) / 10;
  return (
    <svg viewBox="0 0 60 46" aria-hidden="true">
      <rect x={f(x0)} y={f(y0)} width={f(w)} height={f(d)} fill="#fff" strokeWidth="2.4" style={{ stroke: 'var(--accent-strong)' }} />
      {(room.windows || []).map((o, i) => {
        const { x, y, s, horiz } = seg(o);
        return <path key={`w${i}`} d={`M${f(x)} ${f(y)}${horiz ? 'h' : 'v'}${f(s)}`} strokeWidth="2.4" style={{ stroke: 'color-mix(in srgb, var(--accent) 45%, #fff)' }} />;
      })}
      {(room.doors || []).map((o, i) => {
        const { x, y, s, horiz } = seg(o);
        const r = s;
        // 현관(첫 번째 문)만 문짝을 그린다: 경첩(시작점)에서 방 안쪽으로 선을 긋고 문 끝까지 호를 그린다
        const leaf = o.wall === 'bottom' ? `V${f(y - r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}`
          : o.wall === 'top' ? `V${f(y + r)}a${f(r)} ${f(r)} 0 0 0 ${f(r)} ${f(-r)}`
            : o.wall === 'left' ? `H${f(x + r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}`
              : `H${f(x - r)}a${f(r)} ${f(r)} 0 0 0 ${f(r)} ${f(r)}`;
        return (
          <g key={`d${i}`}>
            <path d={`M${f(x)} ${f(y)}${horiz ? 'h' : 'v'}${f(s)}`} stroke="#fff" strokeWidth="2.4" />
            {i === 0 && <path d={`M${f(x)} ${f(y)}${leaf}`} fill="none" strokeWidth="1" style={{ stroke: 'var(--accent-strong)' }} />}
          </g>
        );
      })}
    </svg>
  );
}

function Opening({ room, o, label, icon, min, entry, onChange, onRemove, lockTip }) {
  const len = lenOf(room, o.wall);
  return (
    <div className="open-row">
      <span className={`kind${entry ? ' entry' : ''}`} title={label}><Ic name={icon} /></span>
      <select className="select sm" aria-label={`${label}이 있는 벽`} value={o.wall} onChange={(e) => onChange({ ...o, wall: e.target.value })}>
        {WALLS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      <span className="unit"><NumInput className="input sm" aria-label={`${label} 시작 위치(cm)`} value={o.offset} min={0} max={Math.max(0, len - o.size)} step={5} onCommit={(v) => onChange({ ...o, offset: v })} /><i>cm</i></span>
      <span className="unit"><NumInput className="input sm" aria-label={`${label} 폭(cm)`} value={o.size} min={Math.min(min, len)} max={Math.min(min === 60 ? 150 : 1500, len)} step={5} onCommit={(v) => onChange({ ...o, size: v })} /><i>cm</i></span>
      {lockTip
        ? <button className="iconbtn" type="button" aria-label={`${label} 빼기`} title={lockTip} disabled><Ic name="x" className="s" /></button>
        : <button className="iconbtn" type="button" aria-label={`${label} 빼기`} title={`${label} 빼기`} onClick={onRemove}><Ic name="x" className="s" /></button>}
    </div>
  );
}

export default function RoomForm({ room, onChange }) {
  const doors = room.doors || [];
  const windows = room.windows || [];
  const setAt = (key, i, v) => onChange({ [key]: room[key].map((o, k) => (k === i ? v : o)) });
  const removeAt = (key, i) => onChange({ [key]: room[key].filter((_, k) => k !== i) });
  const doorLabel = (d, i) => (i === 0 ? '현관' : d.kind === 'bath' ? '욕실문' : `문 ${i + 1}`);
  const pyeong = (room.width * room.depth) / 10000 / 3.3058;
  const counts = [`천장 ${m1(room.height)}m`, '현관 1개', doors.length > 1 && `문 ${doors.length - 1}개`, windows.length ? `창문 ${windows.length}개` : '창문 없음'].filter(Boolean);
  return (
    <>
      <div className="roomcard">
        <RoomGlyph room={room} />
        <div><b className="num">{m1(room.width)} × {m1(room.depth)}m · 약 {pyeong.toFixed(1)}평</b><span>{counts.join(' · ')}</span></div>
      </div>

      <div className="sec">
        <div className="sec-h"><h3>크기</h3><span className="meta">벽 안쪽 길이 · 150~1500cm</span></div>
        <div className="row3">
          <label className="field"><span>가로</span><span className="unit"><NumInput value={room.width} min={150} max={1500} step={10} onCommit={(v) => onChange({ width: v })} /><i>cm</i></span></label>
          <label className="field"><span>세로</span><span className="unit"><NumInput value={room.depth} min={150} max={1500} step={10} onCommit={(v) => onChange({ depth: v })} /><i>cm</i></span></label>
          <label className="field"><span>천장 높이</span><span className="unit"><NumInput value={room.height} min={180} max={400} step={5} onCommit={(v) => onChange({ height: v })} /><i>cm</i></span></label>
        </div>
      </div>

      <div className="sec">
        <div className="sec-h">
          <h3>문·창문</h3>
          <span className="rowx">
            <button className="btn sm" type="button" disabled={doors.length >= 6} onClick={() => onChange({ doors: [...doors, { wall: freeWall(doors, ['right', 'left', 'top', 'bottom']), size: 80, kind: 'bath' }] })}>
              <Ic name="plus" className="s" />문
            </button>
            <button className="btn sm" type="button" disabled={windows.length >= 8} onClick={() => onChange({ windows: [...windows, { wall: freeWall(windows, ['top', 'right', 'left', 'bottom']), size: 100 }] })}>
              <Ic name="plus" className="s" />창문
            </button>
          </span>
        </div>
        <div className="open-row open-head" aria-hidden="true"><span /><span>벽</span><span>시작</span><span>폭</span><span /></div>
        {doors.map((d, i) => (
          <Opening
            key={`d${i}`} room={room} o={d} label={doorLabel(d, i)} icon="door" min={60} entry={i === 0}
            onChange={(v) => setAt('doors', i, v)} onRemove={() => removeAt('doors', i)} lockTip={i === 0 ? '현관문은 꼭 있어야 해요' : null}
          />
        ))}
        {windows.map((w, i) => (
          <Opening
            key={`w${i}`} room={room} o={w} label={windows.length > 1 ? `창문 ${i + 1}` : '창문'} icon="window" min={30}
            onChange={(v) => setAt('windows', i, v)} onRemove={() => removeAt('windows', i)}
          />
        ))}
        {/* DWG로 가져온 방은 창문이 없다: 채광을 따지려면 직접 넣어야 한다는 것을 알려 준다 */}
        {windows.length === 0 && <p className="hint no-window">창문이 없어요. 채광 점수를 따지려면 위의 [+ 창문]으로 넣어 주세요.</p>}
        <p className="hint open-note">맨 위 문이 현관이에요. 시작은 벽의 왼쪽(또는 위쪽) 끝에서 잰 거리예요.</p>
      </div>
    </>
  );
}
