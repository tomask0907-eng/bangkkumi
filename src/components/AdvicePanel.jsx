// AI 추천 설명(리포트 패널): 기본 설명을 먼저 보여 주고, AI 글이 오면 바꾼다.
// 배치와 점수는 코드(배치 엔진)가 계산하고 AI는 설명 글만 쓴다. 이 점이 배지와 아래 안내에 드러나게 한다.
import Ic from '../v3/Ic.jsx';

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
// offline(새 props, 없어도 된다): 서버가 없는 곳(공개 사이트)이면 true. 오류·[다시 받기] 대신 안내 한 줄과 기본 설명만 보여 준다
export default function AdvicePanel({ advice, state: given = 'basic', error, hasItems, onRetry, offline = false }) {
  const state = offline && given !== 'ai' ? 'offline' : given;
  const show = hasItems && advice;
  const reasons = Array.isArray(advice?.reasons) ? advice.reasons : [];
  return (
    <div className="card advice" aria-busy={state === 'busy' || undefined}>
      <div className="card-h" style={{ marginBottom: 8 }}>
        <h3>AI 추천 설명</h3>
        {show && (state === 'ai' ? <span className="badge ai"><Ic name="spark" />AI가 쓴 설명</span>
          : state === 'busy' ? <span className="badge ai"><span className="spin" />AI가 쓰는 중</span>
            : <span className="badge">기본 설명</span>)}
      </div>
      {!show ? <p className="hint">{offline ? '배치를 추천받으면 왜 그렇게 놓았는지 이유와 스타일링 팁을 보여 드려요.' : '배치를 추천받으면 왜 그렇게 놓았는지 AI가 이유와 스타일링 팁을 써 드려요.'}</p> : (
        <>
          {state === 'busy' && <div className="loading-line" role="status"><span className="spin" /><span>AI가 설명을 쓰고 있어요. 20초쯤 걸려요. 그동안은 기본 설명이에요.</span></div>}
          {state === 'error' && (
            <div className="alert" role="alert">
              <Ic name="warn" />
              <div>
                <b>{error || 'AI 설명을 받지 못했어요.'}</b>
                <p>그동안은 배치 규칙으로 만든 기본 설명을 보여 드려요.</p>
                <button className="btn sm" type="button" onClick={onRetry}><Ic name="spark" className="s" />다시 받기</button>
              </div>
            </div>
          )}
          {state === 'stale' && (
            <div className="advice-state" role="status">
              <span className="hint">배치나 스타일이 바뀌었어요. 잠시 뒤 AI 설명을 다시 받아 올게요. 그동안은 기본 설명이에요.</span>
              <button className="btn sm" type="button" onClick={onRetry}><Ic name="spark" className="s" />지금 받기</button>
            </div>
          )}
          {state === 'offline' && (
            <div className="advice-state" role="note">
              <span className="hint">AI 설명은 PC에서 실행할 때만 돼요. 지금은 배치 규칙으로 만든 기본 설명이에요.</span>
            </div>
          )}
          {state === 'basic' && (
            <div className="advice-state">
              <span className="hint">배치 규칙으로 만든 기본 설명이에요.</span>
              <button className="btn sm" type="button" onClick={onRetry}><Ic name="spark" className="s" />AI 설명 받기</button>
            </div>
          )}
          <p className="lead">{advice.summary}</p>
          {reasons.length > 0 && <><h4>이렇게 놓은 이유</h4><ul>{reasons.map((r, i) => <Reason key={i} text={r} />)}</ul></>}
          {advice.styling && <><h4>스타일링 팁</h4><ul><li>{advice.styling}</li></ul></>}
          {advice.props && <><h4>어울리는 소품</h4><ul><li>{advice.props}</li></ul></>}
          {state === 'busy' && <div className="skel" aria-hidden="true" style={{ marginTop: 14 }}><i style={{ width: '92%' }} /><i style={{ width: '78%' }} /><i style={{ width: '56%' }} /></div>}
          <p className="hint advice-foot">배치와 점수는 방꾸미가 규칙으로 계산해요. AI는 그 결과를 글로 풀어 쓰기만 해요.</p>
        </>
      )}
    </div>
  );
}
