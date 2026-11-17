// 배치 점수(게이지 + 원칙별 막대)와 배치 검사(오류·주의 목록). 끄는 동안에도 바로 바뀐다.
import Icon from './Icons.jsx';

const grade = (t) => (t >= 85 ? '아주 좋아요' : t >= 70 ? '좋아요' : t >= 60 ? '괜찮아요' : t >= 40 ? '손볼 곳이 있어요' : '고쳐 주세요');
const tone = (ratio) => (ratio < 0.4 ? ' is-error' : ratio < 0.6 ? ' is-warn' : '');

// errors: 오류 개수, unplaced: 못 놓은 가구 수, noWindows: 방에 창문이 없음(채광은 따지지 않은 점수)
export function ScorePanel({ score, errors, unplaced = 0, noWindows = false, variantLabel, hasItems }) {
  if (!hasItems) {
    return (
      <section className="card card-hero" aria-labelledby="r1">
        <div className="card-head"><h3 className="card-title" id="r1">배치 점수</h3></div>
        <p className="muted">배치를 추천받으면 동선·채광·사용 공간 같은 인테리어 원칙으로 점수를 매겨 드려요.</p>
      </section>
    );
  }
  const t = Math.round(score.total);
  const weak = [...score.parts].filter((p) => p.max > 0).sort((a, b) => a.score / a.max - b.score / b.max)[0];
  // 점수만 보고 "괜찮아요"라고 하지 않게: 오류가 있으면 고치라고, 못 놓은 가구·없는 창문은 점수에서 빠졌다고 알린다
  const desc = errors ? '겹치거나 문을 막는 가구를 옮기면 점수가 올라가요.'
    : unplaced ? `놓인 가구만 본 점수예요. 못 놓은 가구 ${unplaced}개는 빠졌어요.`
      : noWindows ? '창문이 없어서 채광은 따지지 않은 점수예요.'
        : weak?.note || '';
  return (
    <section className="card card-hero" aria-labelledby="r1">
      <div className="card-head">
        <h3 className="card-title" id="r1">배치 점수</h3>
        {errors ? <span className="badge badge-error">오류 {errors}</span> : t < 40 ? <span className="badge badge-error">고쳐 주세요</span> : variantLabel && <span className="badge badge-accent">{variantLabel}</span>}
      </div>
      <div className="score">
        <div className={`gauge${errors ? ' is-error' : tone(t / 100)}`} role="img" aria-label={`배치 점수 100점 만점에 ${t}점${errors ? `, 오류 ${errors}개` : ''}`}>
          <svg viewBox="0 0 100 100"><circle className="gauge-track" cx="50" cy="50" r="43" pathLength="100" /><circle className="gauge-value" cx="50" cy="50" r="43" pathLength="100" strokeDasharray={`${t} 100`} /></svg>
          <div className="gauge-num"><b className={t >= 100 ? 'is-full' : undefined}>{t}</b><small>100점 만점</small></div>
        </div>
        <div className="score-text">
          <p className="score-grade">{errors ? '고쳐 주세요' : grade(t)}</p>
          <p className="score-desc">{desc}</p>
        </div>
      </div>
      <div className="parts">
        {score.parts.map((p) => {
          const skipped = noWindows && p.key === 'light' && p.score === p.max; // 창문이 없으면 엔진이 채광을 따지지 않고 만점으로 둔다
          // 설명은 점수가 깎인 원칙에만 펼친다(만점인 줄은 마우스를 올리면 보인다): 작은 화면에서도 배치 검사가 같이 보이게
          return (
            <div className="part" key={p.key} title={p.note}>
              <div className="part-top"><span className="part-label">{p.label}</span><span className="part-score"><b>{Math.round(p.score)}</b> / {p.max}</span></div>
              <div className={`meter${skipped ? ' is-off' : tone(p.max ? p.score / p.max : 1)}`} style={{ '--value': p.max ? Math.round((p.score / p.max) * 100) : 0 }} />
              {p.note && (skipped || p.score < p.max) && <p className="part-note">{p.note}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function IssuesPanel({ issues, unplaced, hasItems, onSelect }) {
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const has = (code) => issues.some((i) => i.code === code);
  return (
    <section className="card" aria-labelledby="r2">
      <div className="card-head">
        <h3 className="card-title" id="r2">배치 검사</h3>
        {(hasItems || unplaced.length > 0) && (
          <span className="row" style={{ gap: 4 }}>
            {errors.length > 0 && <span className="badge badge-error">오류 {errors.length}</span>}
            {warns.length > 0 && <span className="badge badge-warn">주의 {warns.length}</span>}
            {unplaced.length > 0 && <span className="badge badge-warn">못 놓음 {unplaced.length}</span>}
            {!issues.length && !unplaced.length && <span className="badge badge-ok">문제 없음</span>}
          </span>
        )}
      </div>
      {unplaced.length > 0 && (
        <div className="alert alert-warn" role="alert" style={{ marginBottom: 8 }}>
          <Icon name="alert" />
          <span><strong>가구 {unplaced.length}개를 놓지 못했어요.</strong> {unplaced.map((u) => u.name).join(', ')} — 겹치지 않으면서 통로가 남는 자리가 없어요. 가구를 줄이거나 크기를 고쳐 보세요.</span>
        </div>
      )}
      {/* 못 놓은 가구가 있으면 "잘 놓였어요"라고 하지 않는다: 놓인 가구에 대해서만 말한다 */}
      {!hasItems ? (!unplaced.length && <p className="muted">배치를 추천받으면 겹침, 문 여는 공간, 통로를 검사해 드려요.</p>) : issues.length === 0 ? (
        <div className="alert alert-ok">
          <Icon name="check" />
          {unplaced.length > 0
            ? <span>놓인 가구끼리는 겹치거나 문을 막지 않고, 현관에서 갈 수 있어요.</span>
            : <span><strong>잘 놓였어요.</strong> 겹치거나 문을 막는 가구가 없고, 현관에서 가구까지 갈 수 있어요.</span>}
        </div>
      ) : (
        <>
          <ul className="issues">
            {issues.map((it, i) => (
              <li key={i}>
                <button className={`issue is-${it.level}`} type="button" onClick={() => it.uid && onSelect(it.uid)}>
                  <span className="issue-icon" aria-hidden="true">{it.level === 'error' ? '×' : '!'}</span><span>{it.msg}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="ok-chips">
            {!has('overlap') && <span className="badge badge-ok"><Icon name="check" />겹치는 가구 없음</span>}
            {!has('door') && <span className="badge badge-ok"><Icon name="check" />문 여는 공간 확보</span>}
            {!has('walk') && <span className="badge badge-ok"><Icon name="check" />통로 이어짐</span>}
          </div>
        </>
      )}
      <p className="note">{issues.length > 0 ? '항목을 누르면 평면도에서 그 가구를 보여 줘요. ' : ''}통로 60cm는 편하게 지나다니기 위한 참고값이에요.</p>
    </section>
  );
}

export function PalettePanel({ style }) {
  return (
    <section className="card" aria-labelledby="r4">
      <div className="card-head">
        <h3 className="card-title" id="r4">색상 팔레트</h3>
        <span className={`badge${style.source === 'ai' ? ' badge-ai' : ''}`}>{style.source === 'ai' ? 'AI · ' : ''}{style.name}</span>
      </div>
      <div className="swatches">
        {style.palette.map((p) => (
          <div className="swatch" key={p.role}>
            <div className="swatch-color" style={{ background: p.hex }} />
            <div className="swatch-role">{p.role}</div>
            <div className="swatch-name">{p.name}</div>
            <div className="swatch-hex">{p.hex}</div>
          </div>
        ))}
      </div>
      <dl className="facts">
        {style.materials && <><dt>마감재</dt><dd>{style.materials}</dd></>}
        {style.mood && <><dt>분위기</dt><dd>{style.mood}</dd></>}
      </dl>
    </section>
  );
}
