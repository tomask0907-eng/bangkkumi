// 캔버스(무대) 위에 떠 있는 것들: 오른쪽 기둥의 칩(점수 · 합계 · 스타일)과 배치안 작은 그림, 알림
import Ic from './Ic.jsx';
import { MiniPlan } from './symbols.jsx';

// 칩에 쓰는 짧은 금액: 841000 → '84.1만원'
export const manWon = (n) => `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}만원`;
// 점수를 한마디로 (배치 패널의 점수 카드와 같은 기준)
export const gradeOf = (t) => (t >= 85 ? '아주 좋아요' : t >= 70 ? '좋아요' : t >= 60 ? '괜찮아요' : t >= 40 ? '손볼 곳이 있어요' : '고쳐 주세요');

const R = 16, LEN = 2 * Math.PI * R;
export function ScoreRing({ value, bad = false }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className={`ring${bad ? ' bad' : ''}`}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle className="ring-bg" cx="20" cy="20" r={R} fill="none" strokeWidth="5" />
        <circle className="ring-fg" cx="20" cy="20" r={R} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${((v / 100) * LEN).toFixed(1)} ${LEN.toFixed(1)}`} />
      </svg>
      <b>{v}</b>
    </span>
  );
}

// 알림: 무대 오른쪽 위(시안 위치). over 는 상품 고르기 창 위에 띄울 때
export function Toast({ toast, over = false }) {
  if (!toast) return null;
  const err = toast.kind === 'error';
  return (
    <div key={toast.id} className={`toast on${err ? ' err' : ''}${over ? ' over' : ''}`} role={err ? 'alert' : 'status'}>
      <span className="mk"><Ic name={err ? 'warn' : 'check'} /></span><span>{toast.msg}</span>
    </div>
  );
}

// 오른쪽 기둥. 칩을 누르면 그 카테고리로 간다(열려 있는 카테고리의 칩은 CSS가 숨긴다)
export function Side({ score, errors, total, budget, style, room, layouts, variant, onCat, onVariant }) {
  const t = Math.round(score.total);
  const over = total > budget;
  const pct = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 100;
  return (
    <aside className="side" aria-label="요약과 배치안">
      <button className="chip score float" type="button" onClick={() => onCat('layout')} aria-label={`배치 점수 ${t}점, 자세히 보기`}>
        <ScoreRing value={t} bad={errors > 0} />
        <span><small>배치 점수</small><strong style={errors ? { color: 'var(--err-text)' } : undefined}>{errors ? '고쳐야 해요' : gradeOf(t)}</strong></span>
      </button>
      <button className="chip cost float" type="button" onClick={() => onCat('cost')} aria-label="비용 자세히 보기">
        <small>예상 합계</small>
        <strong className="num">{manWon(total)} <span>/ {manWon(budget)}</span></strong>
        <span className={`bar${over ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></span>
        <small style={{ color: over ? 'var(--err-text)' : 'var(--ok-text)' }}>{over ? `${manWon(total - budget)} 넘었어요` : `${manWon(budget - total)} 남아요`}</small>
      </button>
      <button className="chip style float" type="button" onClick={() => onCat('style')} aria-label="스타일 바꾸기">
        <span><small>스타일</small><strong>{style.name}</strong></span><span className="sw5" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      </button>
      {layouts && layouts.length > 1 && (
        <div className="thumbs float" role="group" aria-label="배치안 고르기">
          <h3>배치안 <span>{layouts.length}개</span></h3>
          {layouts.map((l, v) => (
            <button key={v} type="button" aria-pressed={v === variant} aria-label={`배치안 ${v + 1}, ${Math.round(l.score.total)}점`} onClick={() => onVariant(v)}>
              <MiniPlan room={room} items={l.items} palette={style.palette} />{v + 1}안<b className="num">{Math.round(l.score.total)}</b>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
