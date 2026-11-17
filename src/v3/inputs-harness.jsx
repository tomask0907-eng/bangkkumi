// 입력 패널(방, 스타일, DWG) 확인용. 뼈대가 연결되기 전에 시안과 같은 틀 안에서 본다.
// 실행: BK_CACHE=node_modules/.vite-v3inputs npx vite --port 5191 --strictPort → /src/v3/inputs-harness.html?panel=room|style|dwg
// 주소 옵션: state=busy|error|custom|nowin|many|big, style=<프리셋 키>, bare(앱 틀 없이 부품만)
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './panels-input.css';
import { normalizeRoom } from '../layout.js';
import { STYLE_PRESETS, EXAMPLE, validateStyle } from '../catalog.js';
import { paletteVars } from './symbols.jsx';
import Ic from './Ic.jsx';
import RoomForm from '../components/RoomForm.jsx';
import StylePicker from '../components/StylePicker.jsx';
import DwgImport from '../DwgImport.jsx';

const q = new URLSearchParams(window.location.search);
const panel = q.get('panel') || 'room';
const state = q.get('state') || '';

// index.html 의 아이콘 묶음을 그대로 가져온다
const html = await (await fetch('/index.html')).text();
const sprite = html.match(/<svg[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*<symbol[\s\S]*?<\/svg>/);
if (sprite) document.getElementById('sprite').innerHTML = sprite[0];

const ROOMS = {
  '': { width: 400, depth: 300, height: 240, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }], windows: [{ wall: 'top', offset: 110, size: 140 }] },
  nowin: { width: 300, depth: 400, height: 240, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }], windows: [] },
  many: { ...EXAMPLE.room, doors: [{ wall: 'bottom', offset: 20, size: 90, kind: 'entry' }, { wall: 'right', offset: 40, size: 80, kind: 'bath' }, { wall: 'left', offset: 200, size: 80, kind: 'bath' }], windows: [{ wall: 'top', offset: 50, size: 100 }, { wall: 'right', offset: 200, size: 120 }, { wall: 'left', offset: 20, size: 60 }] },
  big: { width: 1500, depth: 1200, height: 400, doors: [{ wall: 'bottom', offset: 1350, size: 150, kind: 'entry' }], windows: [{ wall: 'top', offset: 100, size: 1400 }] },
};
const CUSTOM = [
  validateStyle({ name: '제주 감성 우드 앤 화이트', priceRate: 1.1, source: 'ai', materials: '흰 벽, 삼나무, 바다색 패브릭', mood: '바닷가 집처럼 밝고 시원해요.',
    palette: ['#FBF8F1', '#E9DCC6', '#D8B58A', '#9CC5B8', '#F0B58E'].map((hex, i) => ({ name: `색 ${i + 1}`, hex })), props: [{ name: '라탄 바구니', price: 19000 }, { name: '린넨 커튼', price: 39000 }, { name: '조개 모빌', price: 12000 }] }),
  validateStyle({ name: '우주 정거장 느낌', priceRate: 1, source: 'preset', materials: '', mood: '차분하고 단정해요.',
    palette: ['#EFEFEF', '#D0D0D0', '#9AA4B0', '#5B6B7F', '#22303F'].map((hex, i) => ({ name: `색 ${i + 1}`, hex })), props: [{ name: '무드등', price: 19000 }, { name: '포스터', price: 9000 }, { name: '러그', price: 30000 }] }),
];

function Harness() {
  const [room, setRoomRaw] = useState(() => normalizeRoom(ROOMS[state] || ROOMS['']));
  const setRoom = (patch) => setRoomRaw((p) => normalizeRoom({ ...p, ...patch }));
  const [styleKey, setStyleKey] = useState(q.get('style') || 'nordic');
  const [customs, setCustoms] = useState(state === 'custom' ? CUSTOM : []);
  const [busy, setBusy] = useState(state === 'busy');
  const [error, setError] = useState(state === 'error' ? 'AI가 만든 스타일을 읽지 못했어요. 다시 해 보세요. 프리셋 스타일은 그대로 쓸 수 있어요.' : '');
  const [dwg, setDwg] = useState(panel === 'dwg');
  const styles = [...customs, ...Object.values(STYLE_PRESETS)];
  const style = styles.find((s) => s.key === styleKey) || styles[0];
  const onMake = async () => {
    setBusy(true); setError('');
    await new Promise((r) => setTimeout(r, 1500));
    setBusy(false);
    setCustoms(CUSTOM); setStyleKey(CUSTOM[0].key);
    return true;
  };
  const body = panel === 'style'
    ? <StylePicker styles={styles} styleKey={style.key} onPick={setStyleKey} onMake={onMake} busy={busy} error={error} />
    : <RoomForm room={room} onChange={setRoom} />;
  const modal = dwg && <DwgImport onApply={(r) => { setRoom(r); document.body.dataset.applied = JSON.stringify({ w: r.width, d: r.depth, doors: r.doors.length, windows: r.windows.length, lines: r.underlay.lines.length }); }} onClose={() => setDwg(false)} />;
  if (q.has('bare')) return <div style={{ width: 316, padding: 20 }}>{body}{modal}</div>;
  return (
    <div className="app" data-cat={panel} style={paletteVars(style.palette)}>
      <header className="topbar"><span className="brand"><span className="logo"><svg><use href="#i-logo" /></svg></span>방꾸미</span><span className="sp" /><button className="btn" type="button" id="open-dwg" onClick={() => setDwg(true)}><Ic name="upload" />DWG 불러오기</button></header>
      <nav className="rail" />
      <section className="panel on" aria-label={panel}>
        <div className="panel-h"><h2>{panel === 'style' ? '스타일' : '방'}</h2><p>{panel === 'style' ? '고르면 평면도와 3D의 색이 바로 바뀌어요.' : '방 크기와 문·창문 자리를 알려 주세요.'}</p></div>
        <div className="panel-b">{body}</div>
        <div className="panel-f"><button className="btn ghost" type="button">처음부터</button><button className="btn soft" style={{ flex: 1 }} type="button">다음<Ic name="right" className="s" /></button></div>
      </section>
      <main className="stage"><pre id="dump" style={{ margin: 16, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify({ room: { ...room, underlay: room.underlay ? `${room.underlay.lines.length} lines` : undefined }, styleKey: style.key }, null, 1)}</pre></main>
      {modal}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
