// 배치 패널: 배치 점수(ScorePanel), 배치 검사(IssuesPanel). 리포트 패널의 색상 팔레트(PalettePanel). 끄는 동안에도 바로 바뀐다.
// 시안 순서는 "점수 → 배치 검사 → 점수 자세히 → 통로 안내"다. ScorePanel 과 IssuesPanel 을 같은 부모(패널 본문) 바로 아래에
// 나란히 넣으면 panels-result.css 가 이 순서로 놓는다(부모가 다르면 점수 → 점수 자세히 → 안내 → 배치 검사 순서로 보인다).
import Ic from '../v3/Ic.jsx';

const grade = (t) => (t >= 85 ? '아주 좋아요' : t >= 70 ? '좋아요' : t >= 60 ? '괜찮아요' : t >= 40 ? '손볼 곳이 있어요' : '고쳐야 해요');
const RING = 2 * Math.PI * 32; // 점수 고리 둘레(반지름 32)
// 깎인 정도에 따른 줄 색: 많이 깎이면 빨강, 조금 깎이면 주황 막대
const tone = (ratio) => (ratio >= 1 ? ' full' : ratio < 0.65 ? ' bad' : ratio < 0.85 ? ' lo' : '');

// errors: 오류 개수, unplaced: 못 놓은 가구 수, noWindows: 방에 창문이 없음(채광은 따지지 않은 점수)
export function ScorePanel({ score, errors = 0, unplaced = 0, noWindows = false, variantLabel = '', hasItems }) {
  if (!hasItems || !score) {
    // 못 놓은 가구만 있을 때는 IssuesPanel 이 그 까닭을 알려 준다
    return (
      <div className="empty-msg lay-hero">
        <span className="ico"><Ic name="layout" className="l" /></span>
        <b>아직 배치가 없어요</b>
        <span>방과 가구를 넣고 위의 [배치 추천받기]를 눌러 주세요.<br />동선·채광·사용 공간 같은 인테리어 원칙으로 점수를 매겨 드려요.</span>
      </div>
    );
  }
  const t = Math.round(score.total);
  const bad = errors > 0 || t < 40;
  const part = !bad && unplaced > 0; // 못 놓은 가구가 있으면 점수가 높아도 "아주 좋아요"라고 하지 않는다
  const scored = score.parts.filter((p) => p.max > 0);
  const weak = [...scored].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  // 점수만 보고 "괜찮아요"라고 하지 않게: 오류가 있으면 고치라고, 못 놓은 가구·없는 창문은 점수에서 빠졌다고 알린다
  const desc = errors ? '겹치거나 문을 막는 가구를 옮기면 점수가 올라가요.'
    : unplaced ? `놓인 가구만 본 점수예요. 못 놓은 가구 ${unplaced}개는 빠졌어요.`
      : noWindows ? '창문이 없어서 채광은 따지지 않은 점수예요.'
        : weak?.note || '';
  // 창문이 없으면 엔진이 채광을 따지지 않고 만점으로 둔다
  const skipped = (p) => noWindows && p.key === 'light' && p.score === p.max;
  // 감점된 항목부터(많이 깎인 순서), 만점과 따지지 않은 항목은 뒤로
  const parts = score.parts
    .map((p, i) => ({ ...p, i, lost: Math.max(0, Math.round(p.max - p.score)), off: skipped(p) }))
    .sort((a, b) => b.lost - a.lost || a.off - b.off || a.i - b.i);
  return (
    <>
      <div className={`score-hero lay-hero${bad ? ' bad' : part ? ' warn' : ''}`}>
        <span className="ring" role="img" aria-label={`${variantLabel ? `${variantLabel}, ` : ''}배치 점수 100점 만점에 ${t}점${errors ? `, 오류 ${errors}개` : ''}`}>
          <svg viewBox="0 0 76 76">
            <circle className="ring-track" cx="38" cy="38" r="32" />
            {t > 0 && <circle className="ring-value" cx="38" cy="38" r="32" strokeDasharray={`${((Math.min(100, t) / 100) * RING).toFixed(1)} ${RING.toFixed(1)}`} />}
          </svg>
          <b className={t >= 100 ? 'is-full' : undefined}>{t}</b>
        </span>
        <div>
          <h3>{errors ? '고쳐야 해요' : part ? '일부만 놓았어요' : grade(t)}</h3>
          {desc && <p>{desc}</p>}
        </div>
      </div>

      <div className="sec lay-parts">
        <div className="sec-h" style={{ marginBottom: 2 }}><h3>점수 자세히</h3><span className="meta">감점된 항목부터 · {parts.length}가지</span></div>
        {parts.map((p) => {
          const ratio = p.max ? p.score / p.max : 1;
          // 설명은 점수가 깎인 원칙에만 펼친다(만점인 줄은 마우스를 올리면 보인다): 작은 화면에서도 여러 줄이 같이 보이게
          return (
            <div className={`part${p.off ? ' off' : tone(ratio)}`} key={p.key} title={p.note || undefined}>
              <div className="t">{p.label}<em>{p.off ? '따지지 않음' : p.lost ? `-${p.lost}` : '만점'}</em><span><b>{Math.round(p.score)}</b> / {p.max}</span></div>
              <div className="bar"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
              {p.note && (p.off || p.lost > 0) && <p>{p.note}</p>}
            </div>
          );
        })}
      </div>
      <div className="note lay-note"><Ic name="info" /><span>통로 60cm는 편하게 지나다니기 위한 참고값이에요. 실제로는 가구 문 여는 폭도 함께 확인해 주세요.</span></div>
    </>
  );
}

const PASS = [['overlap', '겹침 없음'], ['out', '방 안에 다 들어감'], ['door', '문 여는 공간 확보'], ['window', '창문 안 가림'], ['walk', '통로 이어짐']];

export function IssuesPanel({ issues = [], unplaced = [], hasItems, onSelect }) {
  if (!hasItems && !unplaced.length) return null; // 배치가 없을 때의 안내는 ScorePanel 이 한다
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level !== 'error');
  const has = (code) => issues.some((i) => i.code === code);
  const passed = PASS.filter(([code]) => !has(code)).map(([, label]) => label);
  return (
    <div className="sec lay-issues">
      <div className="sec-h">
        <h3>배치 검사</h3>
        <span className="rowx">
          {errors.length > 0 && <span className="badge bad">오류 {errors.length}{warns.length > 0 && ` · 주의 ${warns.length}`}</span>}
          {!errors.length && warns.length > 0 && <span className="badge check">주의 {warns.length}</span>}
          {unplaced.length > 0 && <span className="badge check">못 놓음 {unplaced.length}</span>}
          {hasItems && !issues.length && !unplaced.length && <span className="badge ok">문제 없음</span>}
        </span>
      </div>
      {unplaced.length > 0 && (
        <div className="alert" role="alert">
          <Ic name="warn" />
          <div>
            <b>가구 {unplaced.length}개를 놓지 못했어요</b>
            <p>{unplaced.map((u) => u.name).join(', ')} — 겹치지 않으면서 통로가 남는 자리가 없어요. 가구를 줄이거나 크기를 고쳐 보세요.</p>
          </div>
        </div>
      )}
      {/* 줄을 누르면 평면도에서 그 가구를 고른다. 오류를 먼저 보여 준다 */}
      {[...errors, ...warns].map((it, i) => (
        <button key={i} type="button" className={`alert issue${it.level === 'error' ? ' err' : ''}`} onClick={() => it.uid && onSelect?.(it.uid)} title={it.uid ? '누르면 평면도에서 이 가구를 보여 줘요' : undefined}>
          <Ic name="warn" />
          <span className="issue-t"><b>{it.msg}</b></span>
          {it.uid && <Ic name="right" className="s" />}
        </button>
      ))}
      {/* 못 놓은 가구가 있으면 "잘 놓였어요"라고 하지 않는다: 놓인 가구에 대해서만 말한다 */}
      {hasItems && !issues.length && (
        <div className="pass"><Ic name="check" />
          {unplaced.length > 0
            ? <span>놓인 가구끼리는 겹치거나 문을 막지 않고, 현관에서 갈 수 있어요.</span>
            : <span><b>잘 놓였어요.</b> 겹치거나 문을 막는 가구가 없고, 현관에서 가구까지 갈 수 있어요.</span>}
        </div>
      )}
      {hasItems && issues.length > 0 && passed.length > 0 && <div className="pass"><Ic name="check" /><span>{passed.join(' · ')}</span></div>}
      {issues.some((i) => i.uid) && <div className="pass info"><Ic name="info" /><span>줄을 누르면 평면도에서 그 가구를 보여 줘요.</span></div>}
    </div>
  );
}

export function PalettePanel({ style }) {
  if (!style) return null;
  return (
    <div className="card">
      <div className="card-h">
        <h3>색상 팔레트</h3>
        <span className={`badge${style.source === 'ai' ? ' ai' : ''}`}>{style.source === 'ai' && <Ic name="spark" />}{style.source === 'ai' ? 'AI 생성 · ' : ''}{style.name}</span>
      </div>
      <div className="palette">
        {(style.palette || []).map((p, i) => (
          <div key={p.role || i} title={`${p.role}: ${p.name} ${String(p.hex).toUpperCase()}`}>
            <i style={{ background: p.hex }} />
            <b>{p.role}</b>
            <span className="pal-name">{p.name}</span>
            <span>{String(p.hex).toUpperCase()}</span>
          </div>
        ))}
      </div>
      {(style.materials || style.mood) && (
        <dl className="kv">
          {style.materials && <><dt>마감재</dt><dd>{style.materials}</dd></>}
          {style.mood && <><dt>분위기</dt><dd>{style.mood}</dd></>}
        </dl>
      )}
    </div>
  );
}
