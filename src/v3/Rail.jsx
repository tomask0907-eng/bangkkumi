// 왼쪽 아이콘 레일: 카테고리 6개. 한 번에 하나만 열린다. 위·아래 화살표 키로 옮겨 다닌다
import Ic from './Ic.jsx';

export const CATS = [
  ['room', '방', 'room'],
  ['style', '스타일', 'style'],
  ['furniture', '가구', 'sofa'],
  ['layout', '배치', 'layout'],
  ['cost', '비용', 'cost'],
  ['report', '리포트', 'report'],
];

// badges: { layout: { text, bad, label }, cost: { … } }
export default function Rail({ cat, onCat, badges = {} }) {
  const onKeyDown = (e) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.stopPropagation(); // 평면도의 방향키 처리(window)까지 가지 않게: 카테고리를 넘길 때 고른 가구가 같이 움직이면 안 된다
    const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
    const next = tabs[tabs.indexOf(document.activeElement) + step];
    if (!next) return;
    e.preventDefault();
    next.focus();
    onCat(next.dataset.cat);
  };
  return (
    <nav className="rail" role="tablist" aria-orientation="vertical" aria-label="작업 카테고리" onKeyDown={onKeyDown}>
      {CATS.map(([key, label, icon]) => {
        const b = badges[key];
        return (
          <button key={key} type="button" role="tab" id={`t-${key}`} data-cat={key} aria-controls={`p-${key}`} aria-selected={cat === key} tabIndex={cat === key ? 0 : -1} onClick={() => onCat(key)}>
            <Ic name={icon} className="l" />{label}
            {b && <span className={`dot${b.bad ? ' bad' : ''}`} aria-label={b.label}>{b.text}</span>}
          </button>
        );
      })}
    </nav>
  );
}
