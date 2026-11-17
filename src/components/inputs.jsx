// 숫자 입력칸 두 가지: 범위가 있는 숫자(NumInput)와 원 단위 가격(PriceInput)
// 모양(v3): NumInput 은 <input class="input"> 하나(className 으로 바꿀 수 있다. 단위는 부르는 쪽이 <span class="unit">…<i>cm</i></span> 로 감싼다).
// PriceInput 은 <span class="price-edit [is-user] [sm]"><span class="unit"><input class="input [sm]"><i>원</i></span>[<button class="iconbtn undo">]</span>.
// .price-edit 의 규칙은 src/v3/panels-furniture.css 에 있다(어디서 쓰여도 같은 모양).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PRICE_MAX } from '../state.js';
import Ic from '../v3/Ic.jsx';

// 치는 동안에는 글 그대로 두고, 범위 안의 숫자일 때만 바로 반영한다.
// 칸을 떠날 때 범위 밖 숫자는 가까운 값으로 맞추고, 빈 칸은 원래 값으로 되돌린다.
export function NumInput({ value, min, max, onCommit, className = 'input', ...rest }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const n = draft.trim() === '' ? NaN : Number(draft);
  const ok = Number.isFinite(n) && n >= min && n <= max;
  return (
    <input
      {...rest} className={className} type="number" inputMode="numeric" min={min} max={max} value={draft} aria-invalid={ok ? undefined : 'true'}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = e.target.value.trim() === '' ? NaN : Number(e.target.value);
        if (Number.isFinite(v) && v >= min && v <= max && Math.round(v) !== value) onCommit(Math.round(v));
      }}
      onBlur={() => {
        const v = Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n))) : value;
        setDraft(String(v));
        if (v !== value) onCommit(v);
      }}
    />
  );
}

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// 가격 칸: 치는 동안 천 단위 쉼표, Enter·칸 떠나기로 확정, Esc로 취소, 비우면 자동 가격으로.
// onCommit(원) / onReset() — onReset이 있고 isUser면 되돌리기 버튼(↺)을 보여 준다
export function PriceInput({ value, isUser = false, onCommit, onReset, label, small = false }) {
  const [draft, setDraft] = useState(null); // null이면 고치는 중이 아님
  const ref = useRef(null);
  const caret = useRef(null);
  const dirty = useRef(false);
  const cancel = useRef(false);
  const fresh = useRef(false);
  // 쉼표가 끼어들어도 커서가 같은 숫자 뒤에 있게 한다
  useLayoutEffect(() => {
    if (caret.current != null && document.activeElement === ref.current) ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  const digitsOf = (s) => s.replace(/\D/g, '');
  const over = draft != null && Number(digitsOf(draft)) > PRICE_MAX;
  return (
    <span className={`price-edit${isUser ? ' is-user' : ''}${small ? ' sm' : ''}`}>
      <span className="unit">
        <input
          ref={ref} className={`input${small ? ' sm' : ''}`} type="text" inputMode="numeric" autoComplete="off" aria-label={label}
          value={draft ?? fmt(value)} aria-invalid={over ? 'true' : undefined} title={over ? '5천만원까지만 적을 수 있어요' : undefined}
          onFocus={(e) => {
            dirty.current = false;
            cancel.current = false;
            setDraft(fmt(value));
            // 칸에 들어오면 전체를 골라 바로 새 가격을 칠 수 있게 한다. 마우스로 누르면 브라우저가 고른 것을 풀기 때문에
            // 손을 뗄 때 한 번 더 고른다 (나중에 고르면 그사이 친 첫 글자가 지워진다)
            fresh.current = true;
            e.target.select();
          }}
          onMouseUp={(e) => {
            if (fresh.current) { fresh.current = false; e.target.select(); }
          }}
          onChange={(e) => {
            const el = e.target;
            const before = digitsOf(el.value.slice(0, el.selectionStart)).length;
            const digits = digitsOf(el.value).slice(0, 9);
            const text = digits ? fmt(Number(digits)) : '';
            let pos = 0;
            for (let seen = 0; pos < text.length && seen < before; pos++) if (/\d/.test(text[pos])) seen++;
            caret.current = pos;
            fresh.current = false;
            dirty.current = true;
            setDraft(text);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') { cancel.current = true; e.target.blur(); e.stopPropagation(); }
          }}
          onBlur={() => {
            const digits = digitsOf(draft ?? '');
            setDraft(null);
            if (cancel.current || !dirty.current) return;
            if (!digits) onReset?.();
            else onCommit(Math.min(PRICE_MAX, Number(digits)));
          }}
        />
        <i>원</i>
      </span>
      {onReset && isUser && (
        <button type="button" className="iconbtn undo" title="자동 가격으로 되돌리기" aria-label={`${label} 자동 가격으로 되돌리기`} onClick={onReset}>
          <Ic name="undo" className="s" />
        </button>
      )}
    </span>
  );
}
