// 사진이나 상품 링크로 가구 한 개 만들기(화면 쪽 도우미). 서버 POST /api/ref (server/ref.js)를 부른다.
// fetchRefSpec({ url }) 또는 fetchRefSpec({ file }) → Promise<{ spec, tint, note }>. 실패하면 한국어 문구가 든 Error.
import { validateSpec } from './catalog.js';

const FALLBACK = '사진이나 링크에서 가구를 알아보지 못했어요. 이름과 치수를 직접 적어 주세요.';
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_SIDE = 1280;

// 사진을 긴 변 1280px 이하 JPEG(품질 0.85) data 주소로 줄인다. 투명한 그림은 흰 바탕에 얹는다.
export async function shrinkImage(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('사진 파일(JPG, PNG, WEBP)을 골라 주세요.');
  if (file.size > 25_000_000) throw new Error('사진이 너무 커요. 25MB보다 작은 사진을 골라 주세요.');
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('이 사진은 열 수 없어요. JPG나 PNG 사진으로 다시 올려 주세요.');
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(bmp.width * k));
  cv.height = Math.max(1, Math.round(bmp.height * k));
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close?.();
  return cv.toDataURL('image/jpeg', 0.85);
}

export async function fetchRefSpec(input) {
  const url = typeof input?.url === 'string' ? input.url.trim() : '';
  const body = {};
  if (input?.file) body.image = await shrinkImage(input.file);
  else if (url) body.url = url;
  else throw new Error('상품 링크를 붙여 넣거나 가구 사진을 올려 주세요.');
  if (typeof input?.hint === 'string' && input.hint.trim()) body.hint = input.hint.trim().slice(0, 40);

  let res;
  try {
    res = await fetch('/api/ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(100_000),
    });
  } catch (e) {
    throw new Error(e?.name === 'TimeoutError' ? 'AI가 너무 오래 걸려서 멈췄어요. 잠시 뒤 다시 해 보거나 이름과 치수를 직접 적어 주세요.' : '서버에 연결하지 못했어요. 이 기능은 PC에서 실행할 때만 돼요.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((typeof data?.error === 'string' && data.error) || FALLBACK);
  // 서버 응답도 그대로 믿지 않고 다시 확인한다
  const spec = validateSpec({ ...data?.spec, key: '', source: 'ai' });
  if (!spec) throw new Error(FALLBACK);
  const tint = typeof data?.tint === 'string' && HEX.test(data.tint) ? data.tint.toLowerCase() : null;
  return { spec, tint, note: typeof data?.note === 'string' ? data.note.slice(0, 120) : '' };
}
