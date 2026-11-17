// 서버 공통 도구: 요청 읽기, 응답 보내기, Claude 호출
import { spawn } from 'node:child_process';
import os from 'node:os';

export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

// 요청 본문을 Buffer로 읽는다. limit(바이트)를 넘으면 413 오류를 던진다.
export function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (d) => {
      size += d.length;
      if (size > limit) {
        reject(Object.assign(new Error('요청이 너무 커요'), { status: 413 }));
        req.destroy();
      } else chunks.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit = 100_000) {
  const buf = await readBody(req, limit);
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON 형식이 아니에요'), { status: 400 });
  }
}

// 글 속에서 첫 JSON 객체를 꺼낸다. 없거나 깨졌으면 null.
export function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// 이 노트북에 로그인된 Claude Code(claude 명령)로 글을 만든다. 키가 브라우저로 나가지 않는다.
// 사용자 입력은 명령 인자가 아니라 stdin으로만 넘긴다 (명령 주입 방지).
// webSearch: true면 웹 검색 도구만 허용한다 (가격 시세 조사용). 그 밖의 도구는 항상 꺼 둔다.
export function askClaude(prompt, { timeoutMs = 60000, model = process.env.ADVICE_MODEL || 'haiku', webSearch = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^[\w.-]+$/.test(model)) return reject(new Error('모델 이름이 올바르지 않아요'));
    const args = [
      '-p', '--output-format', 'json', '--model', model,
      ...(webSearch ? ['--tools', 'WebSearch', '--allowedTools', 'WebSearch'] : ['--tools', '""']), '--no-session-persistence',
      '--system-prompt', '"You are a Korean interior design assistant. Reply with JSON only."',
    ];
    // Windows에서는 claude가 .cmd/.ps1 이라 shell이 필요하다.
    const child = spawn('claude', args, { shell: true, cwd: os.tmpdir(), windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('AI 응답 시간 초과')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const res = JSON.parse(out);
        if (res.is_error) return reject(new Error(res.result || 'AI 오류'));
        resolve(res.result);
      } catch {
        reject(new Error(err.slice(0, 300) || 'AI 응답을 읽지 못했어요'));
      }
    });
    child.stdin.end(prompt, 'utf8');
  });
}
