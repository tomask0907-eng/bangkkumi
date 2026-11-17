// API만 따로 띄우는 개발용 서버: node server/dev-api.js 5181
import http from 'node:http';
import { api } from './index.js';

const port = Number(process.argv[2]) || 5180;
http.createServer((req, res) => api(req, res)).listen(port, '127.0.0.1', () => {
  console.log(`API http://127.0.0.1:${port}`);
});
