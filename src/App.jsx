// 방꾸미 화면(v3 "커머스 클린"): 상태는 모두 여기에 두고, 그리는 일은 components/ 와 v3/ 가 맡는다.
// 뼈대: 위 막대 · 왼쪽 아이콘 레일(카테고리 6개) · 패널 하나 · 무대(평면도 / 3D). 저장된 작업이 없으면 시작 화면(v3/Landing)부터 보여 준다
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeRoom, checkLayout, recommend, explain, rotateItem, dims } from './layout.js';
import { STYLE_PRESETS, EXAMPLE, matchStyle, validateSpec, validateStyle, priceOf, cleanName } from './catalog.js';
import { fallbackAdvice } from './advice.js';
import { fetchPrices, cleanQuery, httpsUrl } from './shop.js';
import { josa } from './catalog.js';
import { newUid } from './state.js';
import { productCategoryOf } from './products.js';
import { paletteVars } from './v3/symbols.jsx';
import { blank, load, save, clearSaved, mergeParsed, textOf, isKept, keepBack, priceKey, propKey, resolvePrice, sumRows, postJson, roomOut, itemOut, adviceIn, webIn } from './state.js';
import Plan from './v3/Plan.jsx';
import Landing from './v3/Landing.jsx';
import Rail from './v3/Rail.jsx';
import { Side, Toast } from './v3/Stage.jsx';
import Ic from './v3/Ic.jsx';
import RenderCard from './v3/RenderCard.jsx';
import TopBar from './components/TopBar.jsx';
import RoomForm from './components/RoomForm.jsx';
import StylePicker from './components/StylePicker.jsx';
import FurnitureInput from './components/FurnitureInput.jsx';
import CostTable from './components/CostTable.jsx';
import { ScorePanel, IssuesPanel, PalettePanel } from './components/ScorePanel.jsx';
import AdvicePanel from './components/AdvicePanel.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// three.js와 DWG 모달은 쓸 때만 불러온다
const Plan3D = lazy(() => import('./v3/Plan3D.jsx'));
const DwgImport = lazy(() => import('./DwgImport.jsx'));
const FloorplanImport = lazy(() => import('./FloorplanImport.jsx'));
const ProductPicker = lazy(() => import('./components/ProductPicker.jsx'));

// 렌더링 이미지(three.js)와 사진·링크 가구 도우미는 쓸 때만 불러온다
const loadRender = () => import('./v3/three/render.js');
const loadRefspec = () => import('./refspec.js');

const NONE = [];
// 추천에 영향을 주는 입력만 모은 지문: 이것이 같으면 같은 배치안이 나온다
// 치수를 고쳐서 커진 가구가 벽 밖으로 나가지 않게 방 안으로 밀어 넣는다
function intoRoom(room, it) {
  const { w, h } = dims(it);
  const x = Math.max(0, Math.min(it.x, room.width - w)), y = Math.max(0, Math.min(it.y, room.depth - h));
  return x === it.x && y === it.y ? it : { ...it, x, y };
}
const inputSigOf = (room, specs) => JSON.stringify([room.width, room.depth, room.doors, room.windows, specs.map((s) => [s.uid, s.name, s.w, s.d, s.h])]);

export default function App() {
  const [s, setS] = useState(load);
  const set = useCallback((patch) => setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);
  const [landing, setLanding] = useState(() => !s.specs.length && !s.layout); // 시작 화면: 저장된 작업(가구나 배치)이 없을 때만 먼저 보여 준다
  const [cat, setCat] = useState(() => (s.layout ? 'layout' : 'room')); // 지금 열린 카테고리: room | style | furniture | layout | cost | report
  const [tab, setTab] = useState('2d');
  const [view3d, setView3d] = useState('bird'); // 3D에서 지금 보는 방향 (렌더링 저장이 같은 방향으로 그린다)
  const [renderImg, setRenderImg] = useState(null); // 렌더링 이미지(PNG data URL). 화면에만 두고 저장하지 않는다
  const [renderBusy, setRenderBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false); // 배치를 찾는 중
  const [enterKey, setEnterKey] = useState(0);
  const [gen, setGen] = useState(0); // 새로 추천받을 때마다 +1 → AI 설명과 웹 시세를 한 번씩 부른다
  const [truncated, setTruncated] = useState(false);
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState(null);
  const offline = health?.offline === true; // 서버가 없다(공개 사이트): AI·웹 시세·DWG·SketchUp은 끄고 나머지는 그대로 쓴다
  const [dwgOpen, setDwgOpen] = useState(false);
  const [fpOpen, setFpOpen] = useState(false); // 평면도 그림에서 방 가져오기 창
  const [picker, setPicker] = useState(null); // 상품 고르기 창: null | { replaceUid, initial } (replaceUid가 있으면 그 가구를 바꾼다)
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleErr, setStyleErr] = useState('');
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceErr, setAdviceErr] = useState('');
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState('');
  const [skpBusy, setSkpBusy] = useState(false);
  const stageRef = useRef(null);
  const reqs = useRef({ style: 0, advice: 0, epoch: 0 }); // 늦게 온 옛 응답을 버리기 위한 번호 (epoch: "처음부터"를 누른 횟수)
  const exampleGen = useRef(0); // 예시를 불러온 횟수 (그 전에 부탁한 사진·링크 가구의 답을 버린다)
  const asked = useRef(new Set()); // AI에게 치수를 물어본 가구 이름
  const tried = useRef(new Set()); // 웹 시세를 이미 조사해 본 검색어
  const pricing = useRef({ n: 0, asked: 0, found: 0, failed: 0 }); // 진행 중인 시세 조사 (여러 번이 겹칠 수 있다)
  const adviceFailed = useRef(null); // AI 설명을 받지 못한 배치 (같은 배치로 되풀이해 부르지 않게)
  const timers = useRef({});

  const notify = useCallback((msg, kind = 'info') => {
    clearTimeout(timers.current.toast);
    setToast({ msg, kind, id: Date.now() });
    // 긴 알림은 읽을 시간을 더 준다
    timers.current.toast = setTimeout(() => setToast(null), Math.max(kind === 'error' ? 6000 : 4000, msg.length * 110));
  }, []);
  // 가구 카테고리를 열고(focus면) 입력 칸에 커서를 둔다
  const showFurniture = (focus) => {
    setCat('furniture');
    if (focus) requestAnimationFrame(() => (document.getElementById('furniture-text') || document.querySelector('#p-furniture textarea'))?.focus({ preventScroll: true }));
  };

  /* ───────── 계산해서 얻는 값 ───────── */
  const room = s.room;
  const styles = useMemo(() => [...s.customStyles, ...Object.values(STYLE_PRESETS)], [s.customStyles]);
  const style = styles.find((x) => x.key === s.styleKey) || STYLE_PRESETS.minimal;
  const items = s.layout?.items ?? NONE;
  const unplaced = s.layout?.unplaced ?? NONE;
  const hasItems = items.length > 0;
  const check = useMemo(() => checkLayout(room, items), [room, items]);
  const inputSig = useMemo(() => inputSigOf(room, s.specs), [room, s.specs]);
  const inSync = !!s.layout && s.layout.sig === inputSig;
  // 배치안 목록(작은 그림용). 입력이 추천받을 때와 같을 때만 — 같은 입력이면 엔진이 같은 결과를 준다
  const layouts = useMemo(() => {
    if (!inSync || !s.specs.length) return null;
    try {
      const first = recommend(room, s.specs, 0);
      return Array.from({ length: first.variants }, (_, v) => (v ? recommend(room, s.specs, v) : first));
    } catch {
      return null;
    }
  }, [inSync, inputSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const variant = s.layout?.variant ?? 0;

  const adviceSig = useMemo(() => JSON.stringify([style.key, room.width, room.depth, items.map((i) => [i.uid, i.x, i.y, i.rot, i.w, i.d])]), [style.key, room, items]);
  const localAdvice = useMemo(
    () => (hasItems ? fallbackAdvice({ room, style, items, issues: check.issues, score: check.score, facts: explain(room, items) }) : null),
    [hasItems, room, style, items, check],
  );
  const adviceFresh = !!s.advice && s.advice.sig === adviceSig;
  const adviceState = adviceBusy ? 'busy' : adviceFresh ? 'ai' : adviceErr ? 'error' : s.advice ? 'stale' : 'basic';

  // 가격: 직접 입력 > 웹 검색 시세 > 예상
  const priceOfSpec = (sp) => resolvePrice({ key: priceKey(sp), est: sp.product ? sp.product.price : priceOf(sp, style), query: sp.query, product: sp.product }, s.userPrices, s.webPrices);
  // 비용은 적어 둔 가구 전부를 센다(왼쪽 목록과 같은 금액). 평면도에 없는 가구는 줄에 표시한다
  const placedUids = new Set(items.map((i) => i.uid)), unplacedUids = new Set(unplaced.map((u) => u.uid));
  const rows = s.specs.map((sp) => ({
    id: sp.uid, key: priceKey(sp), name: sp.name, query: sp.query, ai: sp.source === 'ai', product: sp.product, owned: sp.owned === true, spec: sp,
    off: !s.layout || placedUids.has(sp.uid) ? '' : unplacedUids.has(sp.uid) ? 'unplaced' : 'new',
    ...priceOfSpec(sp),
  }));
  const propRows = style.props.map((p) => ({ id: propKey(p), key: propKey(p), name: p.name, query: p.query, ...resolvePrice({ key: propKey(p), est: p.price, query: p.query }, s.userPrices, s.webPrices) }));
  const specTotal = sumRows(rows); // 이미 갖고 있는 가구(owned)는 합계에서 뺀다

  // 서버 응답을 기다린 뒤에도 최신 값을 보려고
  const live = useRef({});
  live.current = { s, room, style, items, rows, propRows, adviceSig, offline };

  /* ───────── 저장 ───────── */
  useEffect(() => {
    const t = setTimeout(() => save(s), 300);
    return () => clearTimeout(t);
  }, [s]);
  useEffect(() => {
    const flush = () => save(live.current.s); // 바로 새로 고쳐도 마지막 변경이 남게
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  /* ───────── 서버 기능 확인 ───────── */
  useEffect(() => {
    fetch('/api/health', { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('health'))))
      .then((h) => setHealth(h && typeof h === 'object' ? h : { offline: true }))
      .catch(() => setHealth({ offline: true }));
  }, []);

  /* ───────── 방 · 스타일 · 예산 ───────── */
  const setRoom = (patch) => set((p) => ({ room: normalizeRoom({ ...p.room, ...patch }) }));

  const makeStyle = async (text) => {
    const preset = matchStyle(text);
    if (preset) { set({ styleKey: preset.key }); notify(`'${preset.name}' 스타일을 골랐어요.`); return true; }
    const name = cleanName(text, 30);
    const cached = s.customStyles.find((c) => c.name === name);
    if (cached) { set({ styleKey: cached.key }); return true; }
    if (offline) { setStyleErr('AI로 스타일 만들기는 PC에서 실행할 때만 돼요. 프리셋 스타일은 그대로 쓸 수 있어요.'); return false; }
    const id = ++reqs.current.style;
    setStyleBusy(true);
    setStyleErr('');
    try {
      const j = await (await postJson('/api/style', { text: cleanName(text, 60) }, 60000)).json();
      const st = validateStyle(j?.style);
      if (!st) throw new Error('AI가 만든 스타일을 읽지 못했어요. 다시 해 보세요.');
      if (id !== reqs.current.style) return false;
      if (Object.hasOwn(STYLE_PRESETS, st.key)) set({ styleKey: st.key });
      else set((p) => ({ customStyles: [st, ...p.customStyles.filter((c) => c.key !== st.key)].slice(0, 6), styleKey: st.key }));
      notify(j.ai ? `AI가 '${st.name}' 스타일을 만들었어요.` : `AI가 응답하지 않아 가장 비슷한 프리셋으로 '${st.name}' 스타일을 만들었어요.`);
      return true;
    } catch (e) {
      if (id === reqs.current.style) setStyleErr(`${e.message} 프리셋 스타일은 그대로 쓸 수 있어요.`);
      return false;
    } finally {
      if (id === reqs.current.style) setStyleBusy(false);
    }
  };

  /* ───────── 가구 ───────── */
  // 글을 해석해 목록을 맞춘다. 글에서 빠진 가구는 평면도에서도 뺀다
  const parse = (text = s.text) => {
    if (text === s.parsedText && text === s.text) return s.specs;
    const m = mergeParsed(text, s.specs);
    const keep = new Set(m.specs.map((sp) => sp.uid));
    set((p) => ({
      text, parsedText: text, specs: m.specs,
      layout: p.layout && { ...p.layout, items: p.layout.items.filter((i) => keep.has(i.uid)), unplaced: p.layout.unplaced.filter((i) => keep.has(i.uid)) },
    }));
    setTruncated(m.truncated);
    return m.specs;
  };
  const quickAdd = (name) => parse(s.text.trim() ? `${s.text.trim().replace(/[,\s]+$/, '')}, ${name}` : name);

  // 가구 한 개를 목록과 평면도 양쪽에서 같이 고친다
  const mapSpec = (fn) => set((p) => ({
    specs: p.specs.map(fn),
    layout: p.layout && { ...p.layout, items: p.layout.items.map((i) => intoRoom(p.room, fn(i))), unplaced: p.layout.unplaced.map(fn) },
  }));
  const editSpec = (uid, patch) => mapSpec((sp) => {
    if (sp.uid !== uid) return sp;
    if (sp.product) return sp; // 실제 상품은 조사한 치수 그대로 쓴다(이름·치수를 고치지 않는다)
    if ('name' in patch) return { ...sp, name: cleanName(patch.name) || sp.name };
    const next = { ...sp, ...patch, source: 'user' }; // 치수를 직접 고쳤으니 "치수 확인"·"AI 추정" 표시를 뗀다
    return { ...next, tall: next.h >= 120 };
  });
  const removeSpec = (uid) => {
    set((p) => {
      const specs = p.specs.filter((sp) => sp.uid !== uid);
      const text = textOf(specs);
      return {
        specs,
        ...(isKept(p.specs.find((sp) => sp.uid === uid)) ? {} : { text, parsedText: text }), // 실제 상품과 사진·링크로 추가한 가구는 글에 없던 것이라 빼도 글을 다시 쓰지 않는다
        layout: p.layout && { ...p.layout, items: p.layout.items.filter((i) => i.uid !== uid), unplaced: p.layout.unplaced.filter((i) => i.uid !== uid) },
      };
    });
    if (selected === uid) setSelected(null);
  };

  // 이미 갖고 있는 가구: 평면도에는 놓이지만 합계와 예산 계산에서 빠진다
  const toggleOwned = (uid, owned) => mapSpec((sp) => {
    if (sp.uid !== uid) return sp;
    const { owned: _old, ...rest } = sp;
    return owned ? { ...rest, owned: true } : rest;
  });

  /* ───────── 사진·링크로 가구 추가 ───────── */
  // input: { url } 또는 { file }. AI가 어림한 가구 한 개를 목록 끝에 더한다. 실패하면 한국어 문구가 든 Error로 거절된다
  const addRef = async (input) => {
    if (offline || health?.ref !== true) throw new Error('사진·링크로 추가하기는 PC에서 실행할 때만 돼요.');
    if (live.current.s.specs.length >= 15) throw new Error('가구는 15개까지 넣을 수 있어요. 다른 가구를 빼고 다시 해 주세요.');
    const epoch = reqs.current.epoch, exGen = exampleGen.current;
    const { fetchRefSpec } = await loadRefspec();
    const got = await fetchRefSpec(input);
    const spec = validateSpec(got?.spec);
    if (!spec) throw new Error('AI가 가구 정보를 읽지 못했어요. 다시 해 보세요.');
    if (epoch !== reqs.current.epoch || exGen !== exampleGen.current) return null; // 그사이 "처음부터"를 누르거나 예시를 불러왔다
    if (live.current.s.specs.length >= 15) throw new Error('가구는 15개까지 넣을 수 있어요. 다른 가구를 빼고 다시 해 주세요.');
    const uid = newUid();
    const url = input?.url ? httpsUrl(input.url) : null;
    const added = {
      ...spec, uid, _id: `ref|${uid}`, _txt: spec.name,
      ...(typeof got.tint === 'string' && /^#[0-9a-f]{6}$/i.test(got.tint) && { tint: got.tint.toLowerCase() }),
      ref: { kind: input?.file ? 'photo' : 'link', ...(url && { url }) },
    };
    set((p) => (p.specs.length >= 15 ? {} : { specs: [...p.specs, added] }));
    notify(`${josa(`'${spec.name}'`, '을/를')} 추가했어요. 치수를 확인하고 배치 추천받기를 눌러 보세요.`);
    return { spec: added, tint: added.tint, note: got.note };
  };

  /* ───────── 실제 상품 ───────── */
  const asPicked = (spec) => ({ _id: `product|${spec.product.id}`, _txt: spec.name });
  // [담기]: 목록 끝에 더한다. 평면도에는 다시 추천받을 때 놓인다(그때까지 비용 줄에 '배치 전'으로 표시된다)
  // [이걸로 바꾸기]: 같은 uid를 지켜서 평면도의 그 가구가 제자리에서 실제 치수로 바뀐다
  const pickProduct = (spec) => {
    const cur = live.current.s;
    const uid = picker?.replaceUid;
    if (uid && cur.specs.some((sp) => sp.uid === uid)) {
      const swap = (sp) => {
        if (sp.uid !== uid) return sp;
        const { _wait, ...rest } = sp;
        return { ...rest, ...spec, ...asPicked(spec) };
      };
      set((p) => {
        const specs = p.specs.map(swap);
        const text = textOf(specs); // 바꾼 가구는 글에서 뺀다(남겨 두면 다시 해석할 때 일반 가구가 하나 더 생긴다)
        return {
          specs, text, parsedText: text,
          layout: p.layout && { ...p.layout, items: p.layout.items.map((i) => intoRoom(p.room, i.uid === uid ? keepBack(i, swap(i)) : i)), unplaced: p.layout.unplaced.map(swap) },
        };
      });
      setPicker(null);
      notify(`${josa(`'${spec.name}'`, '을/를')} 실제 상품 치수로 바꿨어요. 겹치는 곳이 있으면 배치를 다시 추천받아 주세요.`);
      return;
    }
    if (cur.specs.length >= 15) { notify('가구는 15개까지 넣을 수 있어요. 다른 가구를 빼고 다시 담아 주세요.', 'error'); return false; } // false: 담지 못했다
    set((p) => (p.specs.length >= 15 ? {} : { specs: [...p.specs, { ...spec, uid: newUid(), ...asPicked(spec) }] }));
    notify(`${josa(`'${spec.name}'`, '을/를')} 담았어요. ${cur.layout ? '배치 다시 추천받기를 누르면 방에 놓여요.' : '배치 추천받기를 눌러 보세요.'}`);
  };

  // 카탈로그에 없는 가구는 AI에게 치수·가격을 묻는다. 답이 올 때까지는 임시 크기로 계속 쓸 수 있다
  useEffect(() => {
    const names = [...new Set(s.specs.filter((sp) => sp._wait && !asked.current.has(sp._txt)).map((sp) => sp._txt))].slice(0, 8);
    if (!names.length || !health) return; // 서버가 있는지 알게 된 뒤에 묻는다
    if (offline) {
      // 서버가 없으면 묻지 않고 임시 크기를 그대로 둔다("치수 확인" 표시가 남는다)
      const drop = (sp) => { if (!sp._wait) return sp; const { _wait, ...keep } = sp; return keep; };
      set((p) => ({ specs: p.specs.map(drop), layout: p.layout && { ...p.layout, items: p.layout.items.map(drop), unplaced: p.layout.unplaced.map(drop) } }));
      return;
    }
    names.forEach((n) => asked.current.add(n));
    (async () => {
      let got = null;
      try {
        const j = await (await postJson('/api/furniture', { names }, 50000)).json();
        if (Array.isArray(j?.specs)) got = j.specs;
      } catch { /* 아래에서 임시 크기를 그대로 둔다 */ }
      const byName = new Map(names.map((n, i) => [n, validateSpec(got?.[i])]));
      names.forEach((n) => asked.current.delete(n));
      const fix = (sp) => {
        if (!sp._wait || !byName.has(sp._txt)) return sp;
        const { _wait, ...keep } = sp;
        const ai = byName.get(sp._txt);
        return ai && sp.source === 'default' ? { ...keep, ...ai, name: sp.name } : keep; // 그사이 사용자가 고친 치수는 그대로
      };
      if (!got) notify('AI가 가구 치수를 찾지 못했어요. "치수 확인" 표시가 있는 가구는 직접 고쳐 주세요.', 'error');
      // 임시 크기로 이미 추천받은 배치라면, AI가 알려 준 크기로 배치를 다시 잡는다 (크기만 바꾸면 가구끼리 겹친다)
      const cur = live.current.s;
      const specs = cur.specs.map(fix);
      const resized = specs.some((sp, i) => sp.w !== cur.specs[i].w || sp.d !== cur.specs[i].d);
      if (resized && cur.layout && cur.layout.sig === inputSigOf(cur.room, cur.specs)) {
        try {
          const r = recommend(cur.room, specs, 0);
          set({ specs, layout: { items: r.items, unplaced: r.unplaced, variant: 0, sig: inputSigOf(cur.room, specs) } });
          setSelected(null);
          setEnterKey((k) => k + 1);
          setGen((g) => g + 1);
          notify('AI가 알려 준 치수로 배치를 다시 잡았어요.');
          return;
        } catch { /* 아래처럼 크기만 바꾼다 */ }
      }
      set((p) => ({ specs: p.specs.map(fix), layout: p.layout && { ...p.layout, items: p.layout.items.map((i) => intoRoom(p.room, fix(i))), unplaced: p.layout.unplaced.map(fix) } }));
    })();
  }, [s.specs, set, notify, health, offline]);

  /* ───────── 배치 ───────── */
  // 방과 가구를 받아 추천을 돌린다(시작 화면의 [예시로 보기]는 예시를 넣자마자 바로 부른다)
  const runRecommend = (room, specs) => {
    setBusy(true);
    setSelected(null);
    // 계산은 금방 끝나지만, "찾는 중" 화면을 한 번 그린 뒤에 시작한다
    setTimeout(() => {
      try {
        const r = recommend(room, specs, 0);
        set({ layout: { items: r.items, unplaced: r.unplaced, variant: 0, sig: inputSigOf(room, specs) } });
        setEnterKey((k) => k + 1);
        setGen((g) => g + 1);
        setTab('2d');
        setCat('layout');
        setRenderImg(null);
        if (r.unplaced.length) notify(`가구 ${r.unplaced.length}개는 놓을 자리를 찾지 못했어요. 배치 검사를 확인해 주세요.`, 'error');
        else notify(`배치안 ${r.variants}개를 찾았어요. 가구를 끌어서 직접 고칠 수도 있어요.`);
      } catch {
        notify('배치를 계산하지 못했어요. 가구 크기와 방 크기를 확인해 주세요.', 'error');
      }
      setBusy(false);
    }, 350);
  };
  const doRecommend = () => {
    const specs = parse();
    if (!specs.length) { notify('먼저 가구를 적어 주세요.', 'error'); showFurniture(true); return; }
    runRecommend(room, specs);
  };

  const pickVariant = (v) => {
    if (!layouts) return;
    const n = layouts.length, k = ((v % n) + n) % n, r = layouts[k];
    set((p) => ({ layout: { ...p.layout, items: r.items, unplaced: r.unplaced, variant: k } }));
    setSelected(null);
    setEnterKey((x) => x + 1);
    // 배치안을 빠르게 넘겨 볼 때 AI를 여러 번 부르지 않게 잠깐 기다렸다가 한 번만 부른다
    clearTimeout(timers.current.advice);
    timers.current.advice = setTimeout(() => requestAdvice(), 1500);
  };

  const mapItems = (fn) => set((p) => (p.layout ? { layout: { ...p.layout, items: p.layout.items.map(fn) } } : {}));
  const moveItem = useCallback((uid, x, y) => mapItems((i) => (i.uid === uid ? { ...i, x, y } : i)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const rotate = useCallback((uid) => set((p) => (p.layout ? { layout: { ...p.layout, items: p.layout.items.map((i) => (i.uid === uid ? rotateItem(p.room, i) : i)) } } : {})), [set]);

  /* ───────── AI 추천 설명 ───────── */
  async function requestAdvice() {
    const { room: r, style: st, items: list, s: cur, adviceSig: sig } = live.current;
    if (!list.length || live.current.offline) return; // 서버가 없으면 기본 설명을 그대로 보여 준다
    clearTimeout(timers.current.advice);
    const id = ++reqs.current.advice;
    setAdviceBusy(true);
    setAdviceErr('');
    try {
      const j = await (await postJson('/api/advice', { room: roomOut(r), style: st, budget: cur.budget, items: list.map(itemOut) }, 60000)).json();
      if (id !== reqs.current.advice) return;
      const data = adviceIn(j);
      if (!data || j.ai !== true) throw new Error('AI가 지금은 응답하지 않아요.');
      adviceFailed.current = null;
      set({ advice: { data, sig } });
    } catch (e) {
      if (id === reqs.current.advice) { adviceFailed.current = sig; setAdviceErr(e.message); }
    } finally {
      if (id === reqs.current.advice) setAdviceBusy(false);
    }
  }
  // 가구를 옮기거나 스타일을 바꾸면 AI 설명도 뒤에서 다시 받는다: AI 설명을 받은 적이 있을 때만, 손을 멈춘 뒤 한 번씩.
  // 받는 중에 또 바뀌면 끝난 뒤 한 번 더 받고, 실패한 배치로는 되풀이하지 않는다([다시 받기]는 남는다)
  useEffect(() => {
    if (!s.advice || adviceFresh || adviceBusy || !hasItems || adviceFailed.current === adviceSig) return undefined;
    const t = setTimeout(requestAdvice, 2500);
    return () => clearTimeout(t);
  }, [s.advice, adviceFresh, adviceBusy, hasItems, adviceSig]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── 가격 ───────── */
  const setPrice = (key, v) => set((p) => ({ userPrices: { ...p.userPrices, [key]: v } }));
  const resetPrice = (key) => set((p) => {
    const { [key]: _drop, ...rest } = p.userPrices;
    return { userPrices: rest };
  });

  // 웹 검색 시세: 한 번에 8개까지. force면 이미 조사한 것도 다시 조사한다.
  // 조사 중에 다시 추천받으면 남은 검색어로 요청이 하나 더 나간다. 결과는 검색어별로 저장하므로 어느 응답이든 모두 합친다
  async function researchPrices(force) {
    const { rows: r, propRows: pr, s: cur } = live.current;
    if (live.current.offline) return; // 서버가 없으면 예상 가격 그대로
    const has = (q) => Object.hasOwn(cur.webPrices, q);
    const all = [...new Set([...r.filter((x) => !x.product && !x.owned), ...(cur.withProps ? pr : [])].map((x) => cleanQuery(x.query)).filter(Boolean))]; // 실제 상품은 조사해 둔 가격이 있고, 이미 있는 가구는 살 것이 아니라서 뺀다
    const fresh = all.filter((q) => !has(q));
    const todo = (force ? [...fresh, ...all.filter(has)] : fresh.filter((q) => !tried.current.has(q))).slice(0, 8);
    if (!todo.length) return;
    todo.forEach((q) => tried.current.add(q));
    const epoch = reqs.current.epoch;
    pricing.current.n++;
    pricing.current.asked += todo.length;
    setPriceBusy(true);
    setPriceMsg('');
    const data = await fetchPrices(todo);
    if (epoch !== reqs.current.epoch) return; // 그사이 "처음부터"를 눌렀다
    const p = pricing.current;
    if (data) {
      const found = webIn(Object.fromEntries(data.items.filter((it) => todo.includes(it?.query)).map((it) => [it.query, { ...it, checkedAt: data.checkedAt || new Date().toISOString() }])));
      p.found += Object.keys(found).length;
      set((prev) => ({ webPrices: { ...prev.webPrices, ...found } }));
    } else {
      p.asked -= todo.length;
      p.failed += todo.length;
      todo.forEach((q) => tried.current.delete(q)); // 실패한 검색어는 다음 추천 때 다시 조사한다
    }
    if (--p.n) return; // 다른 조사가 아직 끝나지 않았다
    const again = ' [시세 다시 조사]로 다시 해 볼 수 있어요.';
    setPriceBusy(false);
    setPriceMsg(!p.asked ? `웹 시세를 조사하지 못했어요. 예상 가격으로 보여 드려요.${again}`
      : `${p.asked}개 중 ${p.found}개의 웹 검색 시세를 찾았어요.${p.failed ? ` 나머지 ${p.failed}개는 조사하지 못했어요.${again}` : p.found < p.asked ? ' 못 찾은 것은 예상 가격 그대로예요.' : ''}`);
    pricing.current = { n: 0, asked: 0, found: 0, failed: 0 };
  }

  // 새 배치를 추천받으면 AI 설명과 웹 시세를 뒤에서 한 번씩 부른다 (실패해도 화면은 그대로 쓸 수 있다)
  // 서버가 있는지 알게 된 뒤에 부른다(서버 없는 공개 사이트에서 헛된 요청과 오류 상자가 잠깐 보이지 않게)
  const healthKnown = health != null;
  useEffect(() => {
    if (!gen || !healthKnown) return;
    requestAdvice();
    researchPrices(false);
  }, [gen, healthKnown]); // eslint-disable-line react-hooks/exhaustive-deps
  // 배치나 스타일이 바뀌면 만들어 둔 렌더링 그림은 옛것이라 지운다(옛 배치 그림이 '완성'으로 남지 않게)
  useEffect(() => { setRenderImg(null); }, [adviceSig]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  /* ───────── 위쪽 막대 ───────── */
  // run: 불러온 예시로 배치 추천까지 한 번에 한다(시작 화면의 [예시로 보기])
  const loadExample = (run = false) => {
    const { specs } = mergeParsed(EXAMPLE.furnitureText, []);
    const exRoom = normalizeRoom(EXAMPLE.room);
    // 예시는 늘 같은 모습으로 시작한다: 직접 입력한 가격도 비운다 (연습한 값이 시연에 남지 않게)
    set({ room: exRoom, styleKey: EXAMPLE.styleKey, budget: EXAMPLE.budget, text: EXAMPLE.furnitureText, parsedText: EXAMPLE.furnitureText, specs, layout: null, advice: null, userPrices: {} });
    setSelected(null);
    setTruncated(false);
    setTab('2d');
    setRenderImg(null);
    setLanding(false);
    exampleGen.current += 1; // 기다리던 사진·링크 가구의 답이 예시 목록에 붙지 않게 버린다
    if (run === true) { setCat('layout'); runRecommend(exRoom, specs); return; }
    notify('예시 원룸을 불러왔어요. 배치 추천받기를 눌러 보세요.');
    showFurniture(false); // 어떤 가구가 들어갔는지 보이게
  };
  const resetAll = () => {
    if (!window.confirm('입력한 내용과 배치, 직접 입력한 가격, 조사해 둔 웹 시세를 모두 지우고 처음부터 시작할까요?')) return;
    clearSaved();
    setS(blank());
    // 진행 중이던 AI 요청의 답이 새 화면에 섞이지 않게 버리고, 웹 시세도 다음 추천 때 새로 조사한다
    reqs.current = { style: reqs.current.style + 1, advice: reqs.current.advice + 1, epoch: reqs.current.epoch + 1 };
    tried.current.clear();
    pricing.current = { n: 0, asked: 0, found: 0, failed: 0 };
    adviceFailed.current = null;
    clearTimeout(timers.current.advice);
    setStyleBusy(false);
    setStyleErr('');
    setAdviceBusy(false);
    setAdviceErr('');
    setPriceBusy(false);
    setPriceMsg('');
    setSelected(null);
    setTruncated(false);
    setTab('2d');
    setRenderImg(null);
    setCat('room');
  };
  const applyDwg = ({ width, depth, doors, windows, underlay }) => {
    set((p) => ({ room: normalizeRoom({ ...p.room, width, depth, doors, windows, underlay }), layout: null, advice: null }));
    setSelected(null);
    setTab('2d');
    notify(windows?.length ? '도면에서 방을 가져왔어요. 배치 추천받기를 눌러 보세요.'
      : '도면에서 방을 가져왔어요. 창문은 도면에서 찾지 못해요. 방 카테고리에서 창문을 넣은 뒤 배치 추천받기를 눌러 주세요.');
    setCat('room'); // 가져온 방 크기·문과 창문 넣기가 보이게
  };
  // 평면도 그림(아파트·빌라)에서 고른 방을 넣는다. 크기는 AI가 어림한 값이라 확인하라고 알린다. 옛 DWG 밑그림은 지운다.
  const applyFloorplan = ({ width, depth, doors, windows }) => {
    set((p) => ({ room: normalizeRoom({ ...p.room, width, depth, doors, windows, underlay: null }), layout: null, advice: null }));
    setSelected(null);
    setTab('2d');
    notify('평면도에서 방을 가져왔어요. 크기와 문·창문을 확인한 뒤 배치 추천받기를 눌러 보세요.');
    setCat('room');
  };
  const exportSkp = async (open) => {
    setSkpBusy(true);
    try {
      const res = await postJson('/api/skp', { room: roomOut(room), items: items.map(itemOut), style, open }, 45000);
      const blob = await res.blob();
      if (!blob.size) throw new Error('빈 파일이 만들어졌어요. 다시 해 보세요.');
      const file = res.headers.get('X-Skp-File');
      if (open) {
        notify(`SketchUp에서 열고 있어요. 알림 창이 뜨면 확인을 눌러 주세요.${file ? ` (exports 폴더의 ${file})` : ''}`);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'bangkkumi.skp';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        notify('SketchUp 파일(bangkkumi.skp)을 내려받았어요.');
      }
    } catch (e) {
      notify(`SketchUp 파일을 만들지 못했어요. ${e.message}`, 'error');
    } finally {
      setSkpBusy(false);
    }
  };
  const skpTip = offline ? '이 기능은 PC에서 실행할 때만 돼요.' : health?.skp === false ? '이 PC에 SketchUp이나 python이 없어서 내보낼 수 없어요.' : !hasItems ? '먼저 배치를 추천받아 주세요.' : '';
  const fpOff = offline || health?.floorplan !== true; // 평면도 그림 읽기는 서버(AI)가 있어야 한다
  const dwgTip = offline ? '도면 불러오기는 PC에서 실행할 때만 돼요.' : health?.dwg === false ? '이 PC에는 DWG 변환기가 없어서 DXF 파일만 열 수 있어요.' : '';

  /* ───────── 렌더링 이미지 ───────── */
  const saveImage = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bangkkumi-render.png';
    a.click();
  };
  // 3D 화면을 고화질 그림으로 만든다. download면 만든 그림을 바로 내려받는다
  const makeRender = async (download, view = 'bird') => {
    if (!hasItems || renderBusy) return;
    setRenderBusy(true);
    try {
      await new Promise((ok) => setTimeout(ok, 60)); // "만들고 있어요" 표시를 먼저 그린다
      const { renderImage } = await loadRender();
      const url = await renderImage({ room, items, style, view, vars: paletteVars(style.palette) });
      setRenderImg(url);
      if (download) { saveImage(url); notify('렌더링 그림(bangkkumi-render.png)을 내려받았어요.'); }
    } catch (e) {
      console.error('[render]', e);
      notify('렌더링 그림을 만들지 못했어요. 3D 보기로 확인해 주세요.', 'error');
    } finally {
      setRenderBusy(false);
    }
  };

  /* ───────── 그리기 ───────── */
  const budgetMan = Math.round(s.budget / 10000);
  const errorCount = check.issues.filter((i) => i.level === 'error').length;
  const warnCount = check.issues.length - errorCount + unplaced.length;
  const total = specTotal + (s.withProps ? propRows.reduce((a, r) => a + r.price, 0) : 0); // 비용 패널의 합계와 같은 금액
  const over = total > s.budget;
  const selItem = items.find((i) => i.uid === selected);
  const m = (cm) => (cm / 100).toFixed(1);
  const isExample = s.specs.length > 0 && s.parsedText === EXAMPLE.furnitureText && room.width === EXAMPLE.room.width && room.depth === EXAMPLE.room.depth;
  const badges = {
    ...(hasItems && errorCount ? { layout: { text: errorCount, bad: true, label: `오류 ${errorCount}건` } }
      : s.layout && warnCount ? { layout: { text: warnCount, label: `주의 ${warnCount}건` } } : {}),
    ...(over && s.specs.length ? { cost: { text: '!', bad: true, label: '예산 초과' } } : {}),
  };
  const go = (key) => () => setCat(key);
  const next = (key, label) => <button className="btn soft" type="button" style={{ flex: 1 }} onClick={go(key)}>다음: {label}<Ic name="right" className="s" /></button>;

  if (landing) {
    return <Landing onStart={() => { setLanding(false); setCat('room'); }} onExample={() => loadExample(true)} />;
  }
  return (
    <div className="app" data-cat={cat} style={paletteVars(style.palette)}>
      <TopBar
        title={!s.specs.length ? '새 프로젝트' : isExample ? '예시 원룸' : '내 방'}
        summary={s.specs.length ? `${m(room.width)} × ${m(room.depth)}m · ${style.name} · 가구 ${s.specs.length}개 · 예산 ${budgetMan.toLocaleString('ko-KR')}만원` : '방 크기와 가구를 알려 주세요'}
        onHome={() => { setView3d('bird'); setLanding(true); }} onExample={() => loadExample(false)} onRecommend={doRecommend}
        busy={busy} hasLayout={!!s.layout} stale={!!s.layout && !inSync} offline={offline}
      />
      <Rail cat={cat} onCat={setCat} badges={badges} />

      {/* ══ 1. 방 ══ */}
      <section className={`panel${cat === 'room' ? ' on' : ''}`} id="p-room" role="tabpanel" aria-label="방">
        <div className="panel-h"><h2>방</h2><p>방 크기와 문·창문 자리를 알려 주세요.</p></div>
        <div className="panel-b">
          <RoomForm room={room} onChange={setRoom} />
          <div className="sec">
            <div className="sec-h"><h3>도면에서 가져오기</h3><span className="meta">DWG · DXF 파일</span></div>
            <div className="drop">
              <Ic name="file" /><b>{room.underlay ? '도면 밑그림을 깔았어요' : '도면 파일을 골라 주세요'}</b>
              <button className="btn sm" type="button" disabled={offline} onClick={() => setDwgOpen(true)}><Ic name="upload" className="s" />DWG 불러오기</button>
            </div>
            {dwgTip && <p className="hint pc-only">{dwgTip}</p>}
            {room.underlay && (
              <div className="rowx underlay-row">
                <span className="hint">밑그림이 필요 없으면 지워도 돼요.</span>
                <button className="btn sm ghost" type="button" onClick={() => setRoom({ underlay: null })}>밑그림 지우기</button>
              </div>
            )}
          </div>
          <div className="sec">
            <div className="sec-h"><h3>평면도 그림에서 가져오기</h3><span className="meta">아파트 · 빌라 · 주택</span></div>
            <div className="drop">
              <Ic name="spark" /><b>그림을 골라 주세요</b>
              <button className="btn sm" type="button" disabled={fpOff} onClick={() => setFpOpen(true)}><Ic name="upload" className="s" />평면도 불러오기</button>
            </div>
            <p className="hint pc-only">{offline ? '평면도 그림 읽기는 PC에서 실행할 때만 돼요.' : '방 후보와 문·창문을 찾아 줘요. 크기는 어림값이라 확인해 주세요.'}</p>
          </div>
        </div>
        <div className="panel-f"><button className="btn ghost" type="button" onClick={resetAll}>처음부터</button>{next('style', '스타일')}</div>
      </section>

      {/* ══ 2. 스타일 ══ */}
      <section className={`panel${cat === 'style' ? ' on' : ''}`} id="p-style" role="tabpanel" aria-label="스타일">
        <div className="panel-h"><h2>스타일</h2><p>고르면 평면도와 3D의 색이 바로 바뀌어요.</p></div>
        <div className="panel-b">
          <StylePicker styles={styles} styleKey={style.key} onPick={(key) => set({ styleKey: key })} onMake={makeStyle} busy={styleBusy} error={styleErr} aiOff={offline} />
        </div>
        <div className="panel-f">{next('furniture', '가구')}</div>
      </section>

      {/* ══ 3. 가구 ══ */}
      <section className={`panel${cat === 'furniture' ? ' on' : ''}`} id="p-furniture" role="tabpanel" aria-label="가구">
        <div className="panel-h"><h2>가구</h2><p>갖고 싶은 가구를 글로 적거나 실제 상품에서 골라 주세요.</p></div>
        <div className="panel-b">
          <FurnitureInput
            text={s.text} specs={s.specs} truncated={truncated} priceOfSpec={priceOfSpec}
            onText={(text) => set({ text })} onParse={() => parse()} onQuick={quickAdd} onEdit={editSpec} onRemove={removeSpec}
            onPrice={(sp, v) => setPrice(priceKey(sp), v)} onPriceReset={(sp) => resetPrice(priceKey(sp))}
            onBrowse={() => { setToast(null); setPicker({}); }}
            onFind={(sp) => { setToast(null); setPicker({ replaceUid: sp.uid, initial: { category: productCategoryOf(sp), near: { w: sp.w, d: sp.d }, title: `${josa(`'${sp.name}'`, '과/와')} 비슷한 실제 상품` } }); }}
            onOwned={toggleOwned} onAddRef={addRef} refEnabled={!offline && health?.ref === true}
            palette={style.palette} offline={offline}
          />
        </div>
        <div className="panel-f">
          <span className="hint" style={{ flex: 1 }}>{s.specs.length ? <>놓을 가구 {s.specs.length}개 · 가구만 <b className="num" style={{ color: 'var(--ink)' }}>{specTotal.toLocaleString('ko-KR')}원</b></> : '아직 가구가 없어요'}</span>
          <button className="btn soft" type="button" onClick={() => (s.specs.length && (!s.layout || !inSync) ? doRecommend() : setCat('layout'))}>다음: 배치<Ic name="right" className="s" /></button>
        </div>
      </section>

      {/* ══ 4. 배치 ══ */}
      <section className={`panel${cat === 'layout' ? ' on' : ''}`} id="p-layout" role="tabpanel" aria-label="배치">
        <div className="panel-h"><h2>배치</h2><p>{s.layout ? <>{layouts ? `배치안 ${variant + 1}` : '지금 배치'}의 점수와 검사 결과예요.</> : '추천받으면 점수와 검사 결과가 여기에 나와요.'}</p></div>
        <div className="panel-b">
          <ScorePanel
            score={check.score} errors={errorCount} unplaced={unplaced.length} noWindows={!room.windows.length}
            hasItems={hasItems} variantLabel={layouts ? `배치안 ${variant + 1}` : ''}
          />
          <IssuesPanel issues={check.issues} unplaced={unplaced} hasItems={hasItems} onSelect={(uid) => { setSelected(uid); setTab('2d'); }} />
        </div>
      </section>

      {/* ══ 5. 비용 ══ */}
      <section className={`panel${cat === 'cost' ? ' on' : ''}`} id="p-cost" role="tabpanel" aria-label="비용">
        <div className="panel-h"><h2>비용</h2><p>실제 가격을 칸에 적으면 합계가 바로 바뀌어요.</p></div>
        <div className="panel-b">
          <CostTable
            rows={rows} propRows={propRows} styleName={style.name} budget={s.budget} withProps={s.withProps} onWithProps={(v) => set({ withProps: v })}
            onPrice={(row, v) => setPrice(row.key, v)} onReset={(row) => resetPrice(row.key)}
            priceBusy={priceBusy} priceMsg={priceMsg} onResearch={() => researchPrices(true)} canResearch={rows.length > 0 && !offline}
            onBudget={(won) => set({ budget: won })} palette={style.palette} offline={offline}
          />
        </div>
      </section>

      {/* ══ 6. 리포트 ══ */}
      <section className={`panel${cat === 'report' ? ' on' : ''}`} id="p-report" role="tabpanel" aria-label="리포트">
        <div className="panel-h"><h2>리포트</h2><p>색상 팔레트와 AI 설명을 보고 내보내요.</p></div>
        <div className="panel-b">
          <PalettePanel style={style} />
          <AdvicePanel advice={adviceFresh && !adviceBusy ? s.advice.data : localAdvice} state={adviceState} error={adviceErr} hasItems={hasItems} onRetry={requestAdvice} offline={offline} />
          <RenderCard image={renderImg} busy={renderBusy} disabled={!hasItems} onMake={() => makeRender(false)} onSave={() => renderImg && saveImage(renderImg)} />
        </div>
        <div className="panel-f skp-foot">
          <div className="hint rowx"><Ic name="cube" className="s" style={{ color: 'var(--warm-text)' }} /><span><b style={{ color: 'var(--ink)' }}>SketchUp 내보내기</b> {skpTip || `방과 가구 ${items.length}개를 .skp로 만들어요.`}</span></div>
          <button className="btn" type="button" disabled={!!skpTip || skpBusy} onClick={() => exportSkp(false)}><Ic name="download" />파일로 받기</button>
          <button className="btn primary" type="button" disabled={!!skpTip || skpBusy} onClick={() => exportSkp(true)}>{skpBusy ? <span className="spin" /> : <Ic name="open" />}SketchUp에서 열기</button>
        </div>
      </section>

      {/* ══ 캔버스 ══ */}
      <main className={`stage${tab === '3d' ? ' is3d' : ''}${s.layout && hasItems && !busy ? '' : ' is-empty'}`} ref={stageRef} aria-label="평면도">
        <div className="stage-top">
          <div className="seg" role="tablist" aria-label="보기 방식">
            <button type="button" role="tab" aria-selected={tab === '2d'} onClick={() => setTab('2d')}><Ic name="room" />2D 평면도</button>
            <button type="button" role="tab" aria-selected={tab === '3d'} onClick={() => { if (tab !== '3d') { setView3d('bird'); setTab('3d'); } }}><Ic name="cube" />3D 보기</button>
          </div>
          {tab === '2d' && hasItems && !busy && (
            <button className="switch float" type="button" role="switch" aria-checked={s.showWalk} title="60cm 폭으로 지나다닐 수 있는 곳을 옅게 칠해요 (참고값)" onClick={() => set({ showWalk: !s.showWalk })}>통로 60cm</button>
          )}
          {/* 3D일 때 보는 방향 버튼(조감 / 위에서 / 눈높이)은 Plan3D가 이 자리에 넣는다 */}
          {tab === '3d' && hasItems && !busy && (
            <button className="btn sm float render-btn" type="button" disabled={renderBusy} onClick={() => makeRender(true, view3d)}>
              {renderBusy ? <span className="spin" /> : <Ic name="download" className="s" />}렌더링 저장
            </button>
          )}
        </div>
        {!picker && <Toast toast={toast} />}

        <div className="view on">
          {busy ? null : tab === '2d' ? (
            <Plan
              room={room} items={items} style={style} issues={check.issues} walk={check.walk} showWalk={s.showWalk}
              selected={selected} onSelect={setSelected} onMove={moveItem} onRotate={rotate} onRemove={removeSpec} enterKey={enterKey} stageRef={stageRef}
            />
          ) : (
            <ErrorBoundary fallback={<div className="empty-card float" role="alert"><b>3D 보기를 열지 못했어요</b><p>2D 평면도로 확인해 주세요. 배치와 비용은 그대로예요.</p></div>}>
              <Suspense fallback={<div className="empty-card float" role="status"><span className="spin big" /><b>3D 화면을 준비하고 있어요</b><p>처음 한 번만 조금 걸려요.</p></div>}>
                <Plan3D room={room} items={items} style={style} selected={selected} onSelect={setSelected} onView={setView3d} />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>

        {busy && (
          <div className="empty-card float" role="status">
            <span className="spin big" />
            <b>배치를 찾고 있어요</b>
            <p>벽, 창문, 통로를 따져 보는 중이에요.</p>
          </div>
        )}
        {!busy && !hasItems && (
          <div className="empty-card float">
            <span className="ico"><Ic name="sofa" className="l" /></span>
            {unplaced.length > 0 ? (
              <><b>가구를 놓을 자리가 없어요</b><p>방을 키우거나 가구를 줄인 뒤<br />다시 추천받아 보세요.</p></>
            ) : s.specs.length ? (
              <><b>가구 {s.specs.length}개를 놓을 준비가 됐어요</b><p>지금 방은 {m(room.width)} × {m(room.depth)}m예요.<br />배치 추천받기를 눌러 보세요.</p></>
            ) : (
              <><b>가구를 넣으면 배치를 찾아 드려요</b><p>지금 방은 {m(room.width)} × {m(room.depth)}m예요.<br />예시를 불러오면 바로 볼 수 있어요.</p></>
            )}
            <div className="rowx">
              {s.specs.length
                ? <button className="btn primary" type="button" onClick={doRecommend}><Ic name="spark" />배치 추천받기</button>
                : <button className="btn primary" type="button" onClick={() => loadExample(false)}>예시 불러오기</button>}
              <button className="btn" type="button" onClick={() => showFurniture(true)}>가구 적기</button>
            </div>
          </div>
        )}
        {renderBusy && <div className="render-wait float" role="status"><span className="spin" />렌더링을 만들고 있어요</div>}

        {!busy && s.layout && hasItems && (
          <Side
            score={check.score} errors={errorCount} total={total} budget={s.budget} style={style} room={room}
            layouts={layouts} variant={variant} onCat={setCat} onVariant={pickVariant}
          />
        )}
      </main>

      {dwgOpen && (
        <ErrorBoundary fallback={null} onError={() => { setDwgOpen(false); notify('DWG 불러오기 화면을 열지 못했어요. 방 크기를 직접 적어 주세요.', 'error'); }}>
          <Suspense fallback={null}>
            <DwgImport onApply={applyDwg} onClose={() => setDwgOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
      {fpOpen && (
        <ErrorBoundary fallback={null} onError={() => { setFpOpen(false); notify('평면도 불러오기 화면을 열지 못했어요. 방 크기를 직접 적어 주세요.', 'error'); }}>
          <Suspense fallback={null}>
            <FloorplanImport onApply={applyFloorplan} onClose={() => setFpOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
      {picker && (
        <ErrorBoundary fallback={null} onError={() => { setPicker(null); notify('상품 고르기 화면을 열지 못했어요. 가구를 글로 적어 주세요.', 'error'); }}>
          <Suspense fallback={null}>
            <ProductPicker room={room} initial={picker.initial} onPick={pickProduct} onClose={() => setPicker(null)} />
          </Suspense>
        </ErrorBoundary>
      )}
      {/* 상품 고르기 창이 열려 있으면 무대가 가려지므로 알림을 창 위(화면 아래)에 띄운다. 창을 열 때는 앞서 뜬 알림을 지운다(창의 안내 글을 가리지 않게) */}
      {picker && <Toast toast={toast} over />}
      {selItem && <span className="sr-only" aria-live="polite">{selItem.name} 고름</span>}
    </div>
  );
}
