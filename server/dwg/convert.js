// DWG → DXF 변환: AutoCAD Core Console(accoreconsole)을 임시 폴더의 복사본에 대해 실행한다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Program Files/Autodesk';
let cached; // 한 번 찾은 경로는 다시 찾지 않는다

// 설치된 accoreconsole.exe 경로. 없으면 null.
export function findConsole() {
  if (cached !== undefined) return cached;
  const list = [process.env.BK_ACCORECONSOLE, `${ROOT}/AutoCAD 2027/accoreconsole.exe`];
  try {
    // 다른 연도 버전이 깔린 PC도 쓸 수 있게 최신 버전부터 찾아본다
    for (const d of fs.readdirSync(ROOT).filter((n) => /^AutoCAD 20\d\d$/.test(n)).sort().reverse()) {
      list.push(`${ROOT}/${d}/accoreconsole.exe`);
    }
  } catch { /* Autodesk 폴더가 없으면 그냥 넘어간다 */ }
  cached = list.find((p) => p && fs.existsSync(p)) || null;
  return cached;
}

// dir 안의 in.dwg를 out.dxf로 바꾼다. dir은 매번 새로 만든 임시 폴더여야 한다
// (같은 이름의 DXF가 있으면 덮어쓰기 질문에서 멈추기 때문).
export function dwgToDxf(dir, { timeoutMs = 90_000 } = {}) {
  const exe = findConsole();
  if (!exe) return Promise.reject(Object.assign(new Error('이 PC에서 DWG 변환기(AutoCAD)를 찾지 못했어요. DXF 파일로 저장해서 올려 주세요.'), { status: 501 }));
  const scr = path.join(dir, 'export.scr');
  // 스크립트 내용은 고정이다. 사용자 입력(파일 이름 등)은 여기에 들어가지 않는다.
  fs.writeFileSync(scr, [
    '(setvar "FILEDIA" 0)',
    '(setvar "CMDECHO" 0)',
    '(command "_.DXFOUT" (strcat (getvar "DWGPREFIX") "out.dxf") "16")',
    '_QUIT',
    'Y',
    '',
  ].join('\r\n'));
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ['/i', path.join(dir, 'in.dwg'), '/s', scr], { cwd: dir, windowsHide: true, stdio: 'ignore' });
    const fail = (msg, status = 422) => reject(Object.assign(new Error(msg), { status }));
    const timer = setTimeout(() => {
      child.kill();
      fail('도면 변환이 너무 오래 걸려서 멈췄어요. 도면을 나눠서 저장하거나 DXF로 저장해서 올려 주세요.', 504);
    }, timeoutMs);
    child.on('error', () => { clearTimeout(timer); fail('DWG 변환기를 실행하지 못했어요.', 500); });
    child.on('close', () => {
      clearTimeout(timer);
      const out = path.join(dir, 'out.dxf');
      if (fs.existsSync(out) && fs.statSync(out).size > 0) resolve(out);
      else fail('DWG 파일을 변환하지 못했어요. 파일이 손상됐거나 지원하지 않는 형식일 수 있어요.');
    });
  });
}
