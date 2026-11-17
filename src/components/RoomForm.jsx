// ① 방: 가로·세로·천장 높이와 문·창문 목록. 값은 App이 normalizeRoom으로 다듬어 돌려준다.
import { NumInput } from './inputs.jsx';
import Icon from './Icons.jsx';

const WALLS = [['top', '위쪽'], ['bottom', '아래쪽'], ['left', '왼쪽'], ['right', '오른쪽']];
const lenOf = (room, wall) => (wall === 'top' || wall === 'bottom' ? room.width : room.depth);
// 아직 문(창문)이 없는 벽부터 고른다
const freeWall = (list, order) => order.find((w) => !list.some((o) => o.wall === w)) || order[0];

function Opening({ room, o, label, icon, min, onChange, onRemove, lockTip }) {
  const len = lenOf(room, o.wall);
  return (
    <div className="opening">
      <span className="opening-kind"><Icon name={icon} />{label}</span>
      <select className="select select-sm" aria-label={`${label}이 있는 벽`} value={o.wall} onChange={(e) => onChange({ ...o, wall: e.target.value })}>
        {WALLS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      <NumInput className="input input-sm" aria-label={`${label} 시작 위치(cm)`} value={o.offset} min={0} max={Math.max(0, len - o.size)} step={5} onCommit={(v) => onChange({ ...o, offset: v })} />
      <NumInput className="input input-sm" aria-label={`${label} 폭(cm)`} value={o.size} min={Math.min(min, len)} max={Math.min(min === 60 ? 150 : 1500, len)} step={5} onCommit={(v) => onChange({ ...o, size: v })} />
      {lockTip ? (
        <span className="tooltip tip-end" data-tip={lockTip}>
          <button className="btn btn-ghost btn-icon btn-sm" type="button" aria-label={`${label} 지우기`} disabled><Icon name="x" /></button>
        </span>
      ) : (
        <button className="btn btn-ghost btn-icon btn-sm" type="button" aria-label={`${label} 지우기`} onClick={onRemove}><Icon name="x" /></button>
      )}
    </div>
  );
}

export default function RoomForm({ room, onChange }) {
  const { doors, windows } = room;
  const setAt = (key, i, v) => onChange({ [key]: room[key].map((o, k) => (k === i ? v : o)) });
  const removeAt = (key, i) => onChange({ [key]: room[key].filter((_, k) => k !== i) });
  const doorLabel = (d, i) => (i === 0 ? '현관' : d.kind === 'bath' ? '욕실문' : `문 ${i + 1}`);
  return (
    <>
      <div className="field-row">
        <label className="field"><span className="field-label">가로</span><span className="input-group"><NumInput value={room.width} min={150} max={1500} step={10} onCommit={(v) => onChange({ width: v })} /><span className="input-unit">cm</span></span></label>
        <label className="field"><span className="field-label">세로</span><span className="input-group"><NumInput value={room.depth} min={150} max={1500} step={10} onCommit={(v) => onChange({ depth: v })} /><span className="input-unit">cm</span></span></label>
        <label className="field"><span className="field-label">천장 높이</span><span className="input-group"><NumInput value={room.height} min={180} max={400} step={5} onCommit={(v) => onChange({ height: v })} /><span className="input-unit">cm</span></span></label>
      </div>
      <p className="field-hint" style={{ marginTop: 4 }}>가로·세로는 150~1500cm, 벽 안쪽 길이로 적어 주세요.</p>

      <div className="sub-label">문 · 창문</div>
      <div className="opening opening-head" aria-hidden="true"><span>종류</span><span>벽</span><span>시작(cm)</span><span>폭(cm)</span><span /></div>
      {doors.map((d, i) => (
        <Opening
          key={`d${i}`} room={room} o={d} label={doorLabel(d, i)} icon="door" min={60}
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
      {windows.length === 0 && <p className="field-hint no-window">창문이 없어요. 채광 점수를 따지려면 [창문 추가]로 넣어 주세요.</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-soft btn-sm" type="button" disabled={doors.length >= 6} onClick={() => onChange({ doors: [...doors, { wall: freeWall(doors, ['right', 'left', 'top', 'bottom']), size: 80, kind: 'bath' }] })}>
          <Icon name="plus" />문 추가
        </button>
        <button className="btn btn-soft btn-sm" type="button" disabled={windows.length >= 8} onClick={() => onChange({ windows: [...windows, { wall: freeWall(windows, ['top', 'right', 'left', 'bottom']), size: 100 }] })}>
          <Icon name="plus" />창문 추가
        </button>
      </div>
    </>
  );
}
