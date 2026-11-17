// 방꾸미 v2 화면: 상태는 모두 여기에 두고, 그리는 일은 components/ 와 Plan.jsx가 맡는다
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeRoom, checkLayout, recommend, explain, rotateItem, dims } from './layout.js';
import { STYLE_PRESETS, EXAMPLE, matchStyle, validateSpec, validateStyle, priceOf, cleanName } from './catalog.js';
import { fallbackAdvice } from './advice.js';
import { fetchPrices, cleanQuery } from './shop.js';
import { josa } from './catalog.js';
import { newUid } from './state.js';
import { productCategoryOf } from './products.js';
import { MiniPlan } from './symbols.jsx';
import { blank, load, save, clearSaved, mergeParsed, textOf, isPicked, keepBack, priceKey, propKey, resolvePrice, shortWon, postJson, roomOut, itemOut, adviceIn, webIn } from './state.js';
import Plan from './Plan.jsx';
import TopBar from './components/TopBar.jsx';
import RoomForm from './components/RoomForm.jsx';
import StylePicker from './components/StylePicker.jsx';
import FurnitureInput from './components/FurnitureInput.jsx';
import CostTable from './components/CostTable.jsx';
import { ScorePanel, IssuesPanel, PalettePanel } from './components/ScorePanel.jsx';
import AdvicePanel from './components/AdvicePanel.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { NumInput } from './components/inputs.jsx';
import Icon from './components/Icons.jsx';

// three.js와 DWG 모달은 쓸 때만 불러온다
const Plan3D = lazy(() => import('./Plan3D.jsx'));
const DwgImport = lazy(() => import('./DwgImport.jsx'));
const ProductPicker = lazy(() => import('./components/ProductPicker.jsx'));

const NONE = [];
const BUDGET_MIN = 30, BUDGET_MAX = 500; // 슬라이더 범위(만원)
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
  const [tab, setTab] = useState('2d');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false); // 배치를 찾는 중
  const [enterKey, setEnterKey] = useState(0);
  const [gen, setGen] = useState(0); // 새로 추천받을 때마다 +1 → AI 설명과 웹 시세를 한 번씩 부른다
  const [truncated, setTruncated] = useState(false);
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState(null);
  const [dwgOpen, setDwgOpen] = useState(false);
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
  // 왼쪽 패널은 안에서 스크롤된다(④ 가구는 처음에 안 보인다): 지금 봐야 할 단계를 보이는 곳으로 올려 준다
  const showStep = (id, focusId) => requestAnimationFrame(() => {
    document.getElementById(id)?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  });

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
    id: sp.uid, key: priceKey(sp), name: sp.name, query: sp.query, ai: sp.source === 'ai', product: sp.product,
    off: !s.layout || placedUids.has(sp.uid) ? '' : unplacedUids.has(sp.uid) ? 'unplaced' : 'new',
    ...priceOfSpec(sp),
  }));
  const propRows = style.props.map((p) => ({ id: propKey(p), key: propKey(p), name: p.name, query: p.query, ...resolvePrice({ key: propKey(p), est: p.price, query: p.query }, s.userPrices, s.webPrices) }));
  const specTotal = rows.reduce((a, r) => a + r.price, 0);

  // 서버 응답을 기다린 뒤에도 최신 값을 보려고
  const live = useRef({});
  live.current = { s, room, style, items, rows, propRows, adviceSig };

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
        ...(isPicked(p.specs.find((sp) => sp.uid === uid)) ? {} : { text, parsedText: text }), // 실제 상품은 글에 없던 것이라 빼도 글을 다시 쓰지 않는다
        layout: p.layout && { ...p.layout, items: p.layout.items.filter((i) => i.uid !== uid), unplaced: p.layout.unplaced.filter((i) => i.uid !== uid) },
      };
    });
    if (selected === uid) setSelected(null);
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
    if (!names.length) return;
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
  }, [s.specs, set, notify]);

  /* ───────── 배치 ───────── */
  const doRecommend = () => {
    const specs = parse();
    if (!specs.length) { notify('먼저 ④ 가구 칸에 가구를 적어 주세요.', 'error'); showStep('s4', 'furniture-text'); return; }
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
        if (r.unplaced.length) notify(`가구 ${r.unplaced.length}개는 놓을 자리를 찾지 못했어요. 오른쪽 배치 검사를 확인해 주세요.`, 'error');
        else notify(`배치안 ${r.variants}개를 찾았어요. 가구를 끌어서 직접 고칠 수도 있어요.`);
      } catch {
        notify('배치를 계산하지 못했어요. 가구 크기와 방 크기를 확인해 주세요.', 'error');
      }
      setBusy(false);
    }, 350);
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
    if (!list.length) return;
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
    const has = (q) => Object.hasOwn(cur.webPrices, q);
    const all = [...new Set([...r.filter((x) => !x.product), ...(cur.withProps ? pr : [])].map((x) => cleanQuery(x.query)).filter(Boolean))]; // 실제 상품은 조사해 둔 가격이 있어서 뺀다
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
  useEffect(() => {
    if (!gen) return;
    requestAdvice();
    researchPrices(false);
  }, [gen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  /* ───────── 위쪽 막대 ───────── */
  const loadExample = () => {
    const { specs } = mergeParsed(EXAMPLE.furnitureText, []);
    // 예시는 늘 같은 모습으로 시작한다: 직접 입력한 가격도 비운다 (연습한 값이 시연에 남지 않게)
    set({ room: normalizeRoom(EXAMPLE.room), styleKey: EXAMPLE.styleKey, budget: EXAMPLE.budget, text: EXAMPLE.furnitureText, parsedText: EXAMPLE.furnitureText, specs, layout: null, advice: null, userPrices: {} });
    setSelected(null);
    setTruncated(false);
    setTab('2d');
    notify('예시를 불러왔어요. 배치 추천받기를 눌러 보세요.');
    showStep('s4'); // 어떤 가구가 들어갔는지 보이게
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
  };
  const applyDwg = ({ width, depth, doors, windows, underlay }) => {
    set((p) => ({ room: normalizeRoom({ ...p.room, width, depth, doors, windows, underlay }), layout: null, advice: null }));
    setSelected(null);
    setTab('2d');
    notify(windows?.length ? '도면에서 방을 가져왔어요. 배치 추천받기를 눌러 보세요.'
      : '도면에서 방을 가져왔어요. 창문은 도면에서 찾지 못해요. ① 방에서 [창문 추가]로 넣은 뒤 배치 추천받기를 눌러 주세요.');
    showStep('s1'); // 가져온 방 크기·문과 [창문 추가]가 보이게
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
  const offline = health?.offline === true;
  const skpTip = offline ? '서버에 연결되지 않아 지금은 쓸 수 없어요' : health?.skp === false ? '이 PC에 SketchUp이나 python이 없어서 내보낼 수 없어요' : !hasItems ? '먼저 배치를 추천받아 주세요' : '';
  const dwgTip = offline ? '서버에 연결되지 않아 지금은 쓸 수 없어요' : health?.dwg === false ? '이 PC에는 DWG 변환기가 없어서 DXF 파일만 열 수 있어요' : '';

  /* ───────── 그리기 ───────── */
  const budgetMan = Math.round(s.budget / 10000);
  const rail = !busy && layouts && layouts.length > 1;
  const selItem = items.find((i) => i.uid === selected);
  const toastEl = toast && <div key={toast.id} className={`toast${toast.kind === 'error' ? ' is-error' : ''}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.kind === 'error' && <Icon name="alert" />}<span>{toast.msg}</span></div>;
  return (
    <div className="app">
      {/* 알림은 위쪽 막대의 소개 글 자리에 띄운다 (평면도나 그 아래 안내 줄을 가리지 않게) */}
      <TopBar
        onExample={loadExample} onDwg={() => setDwgOpen(true)} dwgTip={dwgTip} dwgOff={offline} onSkp={exportSkp} skpTip={skpTip} skpBusy={skpBusy}
        note={!picker && toastEl}
      />

      <main className="workspace">
        {/* 왼쪽: 입력 */}
        <aside className="panel" aria-label="입력">
          <div className="panel-head">
            <h2 className="panel-title">입력</h2>
            <span className="card-sub">네 가지만 알려 주세요</span>
            <button className="btn btn-ghost btn-sm reset-btn" type="button" onClick={resetAll}>처음부터</button>
          </div>
          <div className="panel-body">
            <section className="step is-done" aria-labelledby="s1">
              <div className="step-head"><span className="step-num">1</span><h3 className="step-title" id="s1">방</h3><span className="step-meta">{(room.width / 100).toFixed(1)} × {(room.depth / 100).toFixed(1)}m · 약 {((room.width * room.depth) / 33058).toFixed(1)}평</span></div>
              <RoomForm room={room} onChange={setRoom} />
              {room.underlay && (
                <p className="field-hint underlay-note">
                  DWG 도면의 선을 평면도 아래에 옅게 깔았어요.
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRoom({ underlay: null })}>밑그림 지우기</button>
                </p>
              )}
            </section>

            <section className="step is-done" aria-labelledby="s2">
              <div className="step-head"><span className="step-num">2</span><h3 className="step-title" id="s2">스타일</h3><span className="step-meta">{style.name}</span></div>
              <StylePicker styles={styles} styleKey={style.key} onPick={(key) => set({ styleKey: key })} onMake={makeStyle} busy={styleBusy} error={styleErr} />
            </section>

            <section className="step is-done" aria-labelledby="s3">
              <div className="step-head"><span className="step-num">3</span><h3 className="step-title" id="s3">예산</h3><span className="step-meta">가구와 소품을 합친 금액</span></div>
              <div className="field-row">
                <span className="input-group" style={{ flex: '0 0 108px' }}>
                  <NumInput value={budgetMan} min={0} max={10000} step={10} aria-label="예산(만원)" onCommit={(v) => set({ budget: v * 10000 })} />
                  <span className="input-unit">만원</span>
                </span>
                <div className="grow">
                  <input
                    className="slider" type="range" min={BUDGET_MIN} max={BUDGET_MAX} step={10} aria-label="예산 슬라이더"
                    value={Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, budgetMan))} onChange={(e) => set({ budget: Number(e.target.value) * 10000 })}
                    style={{ '--pct': `${Math.min(100, Math.max(0, ((budgetMan - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100))}%` }}
                  />
                  <div className="slider-ticks" aria-hidden="true"><span>30</span><span>150</span><span>300</span><span>500만원</span></div>
                </div>
              </div>
            </section>

            <section className={`step${s.specs.length ? ' is-done' : ''}`} aria-labelledby="s4">
              <div className="step-head"><span className="step-num">4</span><h3 className="step-title" id="s4">가구</h3><span className="step-meta">{s.specs.length ? `${s.specs.length}개 · ${shortWon(specTotal)}` : '아직 없어요'}</span></div>
              <FurnitureInput
                text={s.text} specs={s.specs} truncated={truncated} priceOfSpec={priceOfSpec}
                onText={(text) => set({ text })} onParse={() => parse()} onQuick={quickAdd} onEdit={editSpec} onRemove={removeSpec}
                onPrice={(sp, v) => setPrice(priceKey(sp), v)} onPriceReset={(sp) => resetPrice(priceKey(sp))}
                onBrowse={() => { setToast(null); setPicker({}); }}
                onFind={(sp) => { setToast(null); setPicker({ replaceUid: sp.uid, initial: { category: productCategoryOf(sp), near: { w: sp.w, d: sp.d }, title: `${josa(`'${sp.name}'`, '과/와')} 비슷한 실제 상품` } }); }}
              />
            </section>
          </div>
          <div className="panel-foot">
            {s.layout && !inSync && <p className="foot-hint" role="status">입력이 바뀌었어요. 다시 추천받으면 새 배치가 나와요.</p>}
            <button className={`btn btn-primary btn-lg btn-block${busy ? ' is-loading' : ''}`} type="button" onClick={doRecommend} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="sparkle" />}{busy ? '배치를 찾는 중…' : s.layout ? '배치 다시 추천받기' : '배치 추천받기'}
            </button>
          </div>
        </aside>

        {/* 가운데: 평면도 */}
        <section className="canvas" aria-label="평면도">
          <div className="canvas-head">
            <div className="tabs" role="tablist" aria-label="보기 방식">
              <button className="tab" role="tab" type="button" aria-selected={tab === '2d'} onClick={() => setTab('2d')}><Icon name="plan" />2D 평면도</button>
              <button className="tab" role="tab" type="button" aria-selected={tab === '3d'} onClick={() => setTab('3d')}><Icon name="cube" />3D 보기</button>
            </div>
            <div className="grow">
              {layouts && (
                <div className="variant" role="group" aria-label="배치안 바꾸기">
                  <button className="btn btn-ghost btn-icon btn-sm" type="button" aria-label="이전 배치안" disabled={layouts.length < 2} onClick={() => pickVariant(variant - 1)}><Icon name="chev-l" /></button>
                  <span className="variant-label" aria-live="polite">배치안 <b>{variant + 1}</b> / {layouts.length}</span>
                  <button className="btn btn-ghost btn-icon btn-sm" type="button" aria-label="다음 배치안" disabled={layouts.length < 2} onClick={() => pickVariant(variant + 1)}><Icon name="chev-r" /></button>
                </div>
              )}
            </div>
            <label className="switch"><input type="checkbox" checked={s.showWalk} onChange={(e) => set({ showWalk: e.target.checked })} /><span className="switch-track" />통로 보기</label>
          </div>

          <div className={`canvas-stage${rail ? ' has-rail' : ''}`} ref={stageRef}>
            {busy ? (
              <div className="empty" style={{ width: 280 }} role="status">
                <span className="spinner big-spinner" />
                <p className="empty-title">배치를 찾고 있어요</p>
                <div className="progress is-busy" style={{ width: '100%' }} />
                <p>벽, 창문, 통로를 따져 보는 중이에요.</p>
              </div>
            ) : tab === '2d' ? (
              <Plan
                room={room} items={items} style={style} issues={check.issues} walk={check.walk} showWalk={s.showWalk}
                selected={selected} onSelect={setSelected} onMove={moveItem} onRotate={rotate} onRemove={removeSpec} enterKey={enterKey} stageRef={stageRef}
              />
            ) : (
              <div className="stage-fill">
                <ErrorBoundary fallback={<div className="empty stage-fill"><p className="empty-title">3D 보기를 열지 못했어요</p><p>2D 평면도로 확인해 주세요. 배치와 비용은 그대로예요.</p></div>}>
                  <Suspense fallback={<div className="empty stage-fill" role="status"><span className="spinner big-spinner" /><p className="empty-title">3D 화면을 준비하고 있어요</p><p>처음 한 번만 조금 걸려요.</p></div>}>
                    <Plan3D room={room} items={items} style={style} selected={selected} onSelect={setSelected} />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {!busy && tab === '2d' && !hasItems && (
              <div className="stage-hint">
                {unplaced.length > 0 ? (
                  <span><b>가구를 놓을 자리가 없어요</b><span>방을 키우거나 가구를 줄인 뒤 다시 추천받아 보세요.</span></span>
                ) : (
                  <span><b>아직 놓은 가구가 없어요</b><span>{s.specs.length ? '왼쪽 아래 배치 추천받기를 눌러 보세요.' : '왼쪽 ④ 가구에 가구를 적고 배치 추천받기를 눌러 보세요.'}</span></span>
                )}
                {!s.specs.length && (
                  <span className="row">
                    <button className="btn btn-soft btn-sm" type="button" onClick={() => showStep('s4', 'furniture-text')}><Icon name="plus" />가구 적기</button>
                    <button className="btn btn-soft btn-sm" type="button" onClick={loadExample}><Icon name="book" />예시로 바로 해 보기</button>
                  </span>
                )}
              </div>
            )}
            {rail && (
              <div className="variant-rail" role="group" aria-label="배치안 고르기">
                {layouts.map((l, v) => (
                  <button key={v} className="variant-thumb" type="button" aria-pressed={v === variant} aria-label={`배치안 ${v + 1}, ${l.score.total}점`} onClick={() => pickVariant(v)}>
                    <MiniPlan room={room} items={l.items} palette={style.palette} />
                    <span>{v + 1}안 · {l.score.total}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="canvas-foot">
            {tab === '2d'
              ? <span>가구를 끌어서 옮기고 <span className="kbd">R</span> 로 돌려요. 방향키 <span className="kbd">←</span><span className="kbd">→</span> 로 5cm씩 움직여요.</span>
              : <span>3D에서는 끌어서 돌려 보고, 가구를 옮길 때는 2D 평면도로 돌아가 주세요.</span>}
            <span className="grow" />
            <span className="legend"><i className="legend-dot" />60cm 통로로 갈 수 있는 곳 (참고값)</span>
          </div>
        </section>

        {/* 오른쪽: 결과 */}
        <aside className="panel panel-plain" aria-label="결과">
          <div className="panel-body">
            <ScorePanel
              score={check.score} errors={check.issues.filter((i) => i.level === 'error').length} unplaced={unplaced.length} noWindows={!room.windows.length}
              hasItems={hasItems} variantLabel={layouts ? `배치안 ${variant + 1}` : ''}
            />
            <IssuesPanel issues={check.issues} unplaced={unplaced} hasItems={hasItems} onSelect={(uid) => { setSelected(uid); setTab('2d'); }} />
            <CostTable
              rows={rows} propRows={propRows} styleName={style.name} budget={s.budget} withProps={s.withProps} onWithProps={(v) => set({ withProps: v })}
              onPrice={(row, v) => setPrice(row.key, v)} onReset={(row) => resetPrice(row.key)}
              priceBusy={priceBusy} priceMsg={priceMsg} onResearch={() => researchPrices(true)} canResearch={rows.length > 0 && !offline}
            />
            <PalettePanel style={style} />
            <AdvicePanel advice={adviceFresh && !adviceBusy ? s.advice.data : localAdvice} state={adviceState} error={adviceErr} hasItems={hasItems} onRetry={requestAdvice} />
          </div>
        </aside>
      </main>

      {dwgOpen && (
        <ErrorBoundary fallback={null} onError={() => { setDwgOpen(false); notify('DWG 불러오기 화면을 열지 못했어요. 방 크기를 직접 적어 주세요.', 'error'); }}>
          <Suspense fallback={null}>
            <DwgImport onApply={applyDwg} onClose={() => setDwgOpen(false)} />
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
      {/* 상품 고르기 창이 열려 있으면 위쪽 막대가 가려지므로 알림을 창 위(화면 아래)에 띄운다. 창을 열 때는 앞서 뜬 알림을 지운다(창의 안내 글을 가리지 않게) */}
      {picker && toastEl}
      {selItem && <span className="sr-only" aria-live="polite">{selItem.name} 고름</span>}
    </div>
  );
}
