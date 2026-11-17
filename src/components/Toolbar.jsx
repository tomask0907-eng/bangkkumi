// 고른 가구 바로 아래(자리가 없으면 위)에 뜨는 도구 막대
import { useLayoutEffect, useRef } from 'react';
import Icon from './Icons.jsx';

const MOVES = [['left', '왼쪽으로', -5, 0], ['up', '위로', 0, -5], ['down', '아래로', 0, 5], ['right', '오른쪽으로', 5, 0]];

export default function Toolbar({ item, stageRef, onNudge, onRotate, onRemove }) {
  const ref = useRef(null);
  // 그릴 때마다 고른 가구의 화면 위치를 재서 맞춘다 (시안 맨 아래 스크립트와 같은 계산)
  useLayoutEffect(() => {
    const bar = ref.current, stage = stageRef.current;
    const target = stage?.querySelector('.plan-item.is-selected');
    if (!bar || !target) return;
    const s = stage.getBoundingClientRect(), t = target.getBoundingClientRect();
    const below = t.bottom + 8 + bar.offsetHeight < s.bottom - 4;
    const top = below ? t.bottom - s.top + 8 : Math.max(4, t.top - s.top - bar.offsetHeight - 8);
    const rail = stage.querySelector('.variant-rail')?.getBoundingClientRect(); // 배치안 작은 그림에 가려지지 않게
    const right = (rail && rail.width ? rail.left - s.left : s.width) - 8;
    bar.style.left = `${Math.max(8, Math.min(right - bar.offsetWidth, t.left - s.left + t.width / 2 - bar.offsetWidth / 2))}px`;
    bar.style.top = `${top}px`;
  });
  return (
    <div className="toolbar" role="toolbar" aria-label={`${item.name} 옮기기`} ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <span className="toolbar-name">{item.name}<small>{item.w}×{item.d}</small></span>
      <span className="toolbar-sep" />
      {MOVES.map(([icon, word, dx, dy]) => (
        <button key={icon} type="button" className="tooltip" data-tip={`${word} 5cm`} aria-label={`${word} 옮기기`} onClick={() => onNudge(dx, dy)}><Icon name={icon} /></button>
      ))}
      <span className="toolbar-sep" />
      <button type="button" aria-label="90도 돌리기" onClick={onRotate}><Icon name="rotate" />돌리기</button>
      <button type="button" className="is-danger tooltip" data-tip="이 가구 빼기" aria-label={`${item.name} 빼기`} onClick={onRemove}><Icon name="trash" /></button>
    </div>
  );
}
