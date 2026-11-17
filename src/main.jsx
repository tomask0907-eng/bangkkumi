import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './App.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { clearSaved } from './state.js';

// 화면 어디에서든 그리다가 오류가 나면 빈 화면 대신 다시 시작하는 방법을 보여 준다.
// 오류가 난 값은 아직 저장되기 전이라, 새로 고치면 마지막으로 저장된 상태로 돌아간다
const crashed = (
  <div className="empty crash" role="alert">
    <p className="empty-title">화면을 그리다가 문제가 생겼어요</p>
    <p>새로 고치면 조금 전 상태로 돌아가요. 그래도 같은 화면이 나오면 저장된 내용을 지우고 처음부터 시작해 주세요.</p>
    <div className="row">
      <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>새로 고침</button>
      <button className="btn" type="button" onClick={() => { clearSaved(); window.location.reload(); }}>저장된 내용 지우고 처음부터</button>
    </div>
  </div>
);

createRoot(document.getElementById('root')).render(<StrictMode><ErrorBoundary fallback={crashed}><App /></ErrorBoundary></StrictMode>);
