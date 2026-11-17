// 시작 화면 확인용.
// 실행: BK_CACHE=node_modules/.vite-v3landing npx vite --port 5189 --strictPort → /src/v3/landing-harness.html
// 버튼을 누르면 <body data-last="start | example"> 와 data-count 가 바뀌어요(화면에는 아무것도 덧붙이지 않아요).
import { createRoot } from 'react-dom/client';
import Landing from './Landing.jsx';

const mark = (name) => () => {
  document.body.dataset.last = name;
  document.body.dataset.count = String(Number(document.body.dataset.count || 0) + 1);
};
createRoot(document.getElementById('root')).render(<Landing onStart={mark('start')} onExample={mark('example')} />);
