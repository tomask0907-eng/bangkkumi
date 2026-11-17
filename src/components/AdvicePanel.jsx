// AI 추천 설명: 기본 설명을 먼저 보여 주고, AI 글이 오면 바꾼다
import Icon from './Icons.jsx';

// "책상: 창가에 두어…" → 가구 이름을 굵게
function Reason({ text }) {
  const i = text.indexOf(': ');
  if (i <= 0 || i > 32) return <li>{text}</li>;
  const name = text.slice(0, i);
  let rest = text.slice(i + 2);
  if (rest.startsWith(name)) rest = rest.slice(name.length).trimStart(); // "책상: 책상 옆으로…"처럼 이름이 두 번 나오지 않게
  return <li><b>{name}</b> {rest}</li>;
}

// state: 'ai'(지금 배치에 맞는 AI 글) | 'busy' | 'stale'(배치·스타일이 바뀜, App이 곧 다시 받는다) | 'error' | 'basic'
export default function AdvicePanel({ advice, state, error, hasItems, onRetry }) {
  return (
    <section className="card" aria-labelledby="r5" aria-busy={state === 'busy' || undefined}>
      <div className="card-head">
        <h3 className="card-title" id="r5">AI 추천 설명</h3>
        {hasItems && (state === 'ai' ? <span className="badge badge-ai"><Icon name="sparkle" />AI 생성</span> : <span className="badge">기본 설명</span>)}
      </div>
      {!hasItems || !advice ? <p className="muted">배치를 추천받으면 왜 그렇게 놓았는지 설명해 드려요.</p> : (
        <>
          {state === 'stale' && (
            <div className="alert alert-warn advice-alert" role="status">
              <Icon name="alert" />
              <span className="grow">배치나 스타일이 바뀌었어요. 잠시 뒤 AI 설명을 다시 받아 올게요. 그동안은 기본 설명이에요.</span>
              <button className="btn btn-sm btn-ai" type="button" onClick={onRetry}><Icon name="sparkle" />지금 받기</button>
            </div>
          )}
          {state === 'error' && (
            <div className="alert advice-alert" role="alert">
              <Icon name="alert" />
              <span className="grow">{error || 'AI 설명을 받지 못했어요.'} 기본 설명을 보여 드려요.</span>
              <button className="btn btn-sm btn-ai" type="button" onClick={onRetry}><Icon name="sparkle" />다시 받기</button>
            </div>
          )}
          {state === 'basic' && (
            <div className="alert advice-alert">
              <span className="grow">배치 규칙으로 만든 기본 설명이에요.</span>
              <button className="btn btn-sm btn-ai" type="button" onClick={onRetry}><Icon name="sparkle" />AI 설명 받기</button>
            </div>
          )}
          <p className="advice-summary">{advice.summary}</p>
          <ul className="advice-list">{advice.reasons.map((r, i) => <Reason key={i} text={r} />)}</ul>
          {advice.styling && <div className="advice-tip"><span className="advice-tip-title">스타일링 팁</span>{advice.styling}</div>}
          {advice.props && <div className="advice-tip"><span className="advice-tip-title">소품 팁</span>{advice.props}</div>}
          {state === 'busy' && (
            <>
              <div className="alert" role="status" style={{ marginTop: 12 }}><span className="spinner" style={{ marginTop: 3 }} /><span>AI가 더 자세한 설명을 쓰고 있어요. 20초쯤 걸려요.</span></div>
              <div style={{ marginTop: 14 }} aria-hidden="true">
                <span className="skeleton" style={{ width: '92%' }} /><span className="skeleton" style={{ width: '78%' }} /><span className="skeleton" style={{ width: '85%' }} /><span className="skeleton" style={{ width: '56%' }} />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
