// 렌더링 이미지: 방을 고화질 그림(PNG)으로 만든다. 화면에 떠 있는 3D(Plan3D)와 따로, 보이지 않는 캔버스에 한 번 그리고 자원을 정리한다.
// 장면은 viewer.js 의 코드를 그대로 쓴다(가구 모양·색·빛이 화면의 3D와 같다). 2배로 크게 그린 뒤 줄여서 선이 곱다.
// three 를 쓰므로 필요할 때만 불러온다: const { renderImage } = await import('./v3/three/render.js')
import { createViewer } from './viewer.js';

const HEX = /^#[0-9a-f]{6}$/i;
const VIEWS = ['bird', 'top', 'eye'];
const NO_GL = '이 브라우저에서는 렌더링을 만들 수 없어요';

// vars: 화면의 스타일 5색 { c1..c5 } 또는 { '--c1'..'--c5' } ('#rrggbb'). 없으면 style.palette 에서 평면도와 같은 대응으로 만든다.
export async function renderImage({ room, items, style, view = 'bird', width = 2400, height = 1500, vars } = {}) {
  if (typeof document === 'undefined') throw new Error(NO_GL);
  const W = Math.round(Math.min(4096, Math.max(320, Number(width) || 2400)));
  const H = Math.round(Math.min(4096, Math.max(200, Number(height) || 1500)));
  await new Promise((done) => setTimeout(done, 0)); // "만들고 있어요" 표시가 먼저 그려지게 한 박자 쉰다

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'fixed', left: '-99999px', top: '0', width: `${W}px`, height: `${H}px`, pointerEvents: 'none', visibility: 'hidden', zoom: '1' });
  for (let i = 1; i <= 5; i++) {
    const v = vars?.[`c${i}`] ?? vars?.[`--c${i}`];
    host.style.setProperty(`--c${i}`, typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : 'initial'); // 바깥 값이 섞이지 않게 비운다
  }
  document.body.appendChild(host);

  let viewer = null;
  try {
    try {
      viewer = createViewer(host, () => {}, { width: W, height: H, scale: 2 });
    } catch (e) {
      console.error('[render]', e);
      throw new Error(NO_GL);
    }
    viewer.setScene(room, Array.isArray(items) ? items : [], style);
    viewer.setView(VIEWS.includes(view) ? view : 'bird');
    const shot = viewer.snapshot();
    if (!shot) throw new Error(NO_GL);

    // 흰색에 가까운 바탕(--bg)을 칠하고 그 위에 줄여서 얹는다 → 투명하지 않은 PNG
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d');
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    g.fillStyle = HEX.test(bg) ? bg : '#F2F4F7';
    g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(shot, 0, 0, W, H);
    const url = out.toDataURL('image/png');
    out.width = out.height = 0;
    if (!url.startsWith('data:image/png')) throw new Error(NO_GL);
    return url;
  } finally {
    viewer?.dispose();
    host.remove();
  }
}

// data URL 그림을 파일로 내려받는다(이름 기본값은 bangkkumi-render.png)
export function saveImage(dataUrl, name = 'bangkkumi-render.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
