# 방꾸미 v2 디자인 안내

화면 통합 담당이 `src/theme.css`와 `src/symbols.jsx`를 가져다 쓰는 방법을 적은 문서예요.
완성된 모습은 `docs/mockup.html`에서 볼 수 있어요. 구조와 클래스 이름을 그대로 복사하면 돼요.

```
BK_CACHE=node_modules/.vite-design npx vite --port 5185 --strictPort
→ http://localhost:5185/docs/mockup.html          화면 시안 (아래쪽에 상태 모음)
→ http://localhost:5185/src/symbols-harness.html  가구 그림 전체 (4방향, 팔레트 바꾸기)
```

## 1. 방향

- **따뜻하고 차분한 인테리어 제품 느낌.** 종이 같은 바탕(`--bg`) 위에 흰 카드, 넉넉한 여백, 둥근 모서리(12~16px), 옅은 갈색 그림자.
- **강조색은 깊은 숲 초록 하나**(`--accent-600`). 가장 중요한 버튼, 고른 상태, 점수에만 써요.
  주황·빨강은 "주의·오류" 전용이라 강조색으로 쓰지 않아요(상태색과 헷갈리지 않게).
- **AI가 만든 것은 보라색**(`--ai`, `.badge-ai`, `.btn-ai`)으로만 표시해요.
- 글꼴은 Pretendard Variable. `theme.css`가 `node_modules/pretendard`에서 직접 읽으므로 인터넷이 없어도 돼요.
- 화면의 주인공은 가운데 평면도예요. 양쪽 패널은 조용하게, 평면도는 크게.

## 2. 쓰는 법

```js
// src/main.jsx 에서 한 번만
import './theme.css';
```

`theme.css`는 `body`의 글꼴·바탕색, 제목과 문단의 바깥 여백 0, 얇은 스크롤 막대, 키보드 초점 테두리를 전체에 적용해요.
그 밖에는 모두 클래스로만 동작해요. 클래스 이름에는 접두사가 없고, **상태는 `is-…`**, **종류는 `부품-종류`** 로 붙여요
(예: `.btn.btn-primary.btn-lg`, `.spec.is-open`, `.meter.is-warn`).
켜짐·고름 상태는 가능하면 `aria-pressed="true"`, `aria-selected="true"`로 표시하고, CSS도 그 속성을 봐요.

## 3. 화면 틀과 크기

```
.app                      높이 100dvh, 세로 2칸: 위 막대 + 작업 공간 (페이지 스크롤 없음)
├─ header.topbar          .brand(.brand-mark + .brand-name) · .brand-tag · .topbar-actions
└─ main.workspace         가로 3칸
   ├─ aside.panel         왼쪽 "입력": .panel-head / .panel-body(안에서 스크롤) / .panel-foot(큰 버튼, 항상 보임)
   ├─ section.canvas      가운데: .canvas-head / .canvas-stage(평면도·3D) / .canvas-foot
   └─ aside.panel.panel-plain  오른쪽 "결과": .panel-body 안에 .card를 세로로 쌓음(안에서 스크롤)
```

| 화면 폭 | 위 막대 | 왼쪽 | 오른쪽 | 간격 | 글자 기본 | 입력칸 높이 |
|---|---|---|---|---|---|---|
| 1600px 이상 (1920×1080) | 64px | 400px | 432px | 18px | 14.5px | 38px |
| 1280~1599px (1366×768) | 56px | 332px | 348px | 14px | 13px | 34px |
| 1000~1279px | 56px | 300px | 312px | 12px | 13px | 34px |
| 1000px 미만 | 자동 | 한 줄로 쌓임: 평면도 → 입력 → 결과, 페이지 전체가 스크롤 | | | | |

- 위 값은 모두 CSS 변수(`--topbar-h`, `--panel-left`, `--panel-right`, `--gap`, `--fs-*`, `--ctl-h*`)라서 미디어 쿼리에서 변수만 바뀌어요.
- 1000~1199px에서는 배치안 작은 그림(`.variant-rail`)을 숨기고 ‹ › 버튼만 써요. 640px 미만에서는 위 막대 버튼이 아이콘만 남아요.
- 간격은 4px 단위(`--sp-1`=4 … `--sp-8`=32). 카드 안쪽 여백 16px, 카드 사이 `--gap`.

## 4. 변수

| 묶음 | 변수 |
|---|---|
| 바탕·면 | `--bg` `--bg-deep` `--surface`(카드) `--surface-2`(입력칸) `--surface-3`(눌린 면) `--line` `--line-strong` |
| 글자 | `--text` `--text-2` `--text-3`(보조 글자. 흰 면·바탕 모두 대비 4.5:1 이상) `--text-on-accent` |
| 강조 | `--accent-50` … `--accent-900` (버튼은 600, 눌림 700, 옅은 바탕 50·100) |
| 상태 | `--ok` `--warn` `--error` `--ai` + 각각 `-text`(글자용 진한 색), `-bg`(옅은 바탕) |
| 평면도 | `--plan-wall` `--plan-select` `--plan-walk` `--plan-ink` |
| 모서리 | `--r-xs` 6 · `--r-sm` 8 · `--r-md` 12 · `--r-lg` 16 · `--r-xl` 22 · `--r-full` |
| 그림자 | `--shadow-xs` `--shadow-sm`(카드) `--shadow-md`(떠 있는 것) `--shadow-lg`(모달·도구 막대) `--ring`(초점) |
| 글자 크기 | `--fs-xs` `--fs-sm` `--fs-md`(본문) `--fs-lg`(카드 제목) `--fs-xl` `--fs-2xl` `--fs-display`(점수) |
| 층 | `--z-sticky` 10 · `--z-float` 20 · `--z-tooltip` 40 · `--z-modal` 100 · `--z-toast` 120 |
| 움직임 | `--t-fast` 120ms · `--t-base` 200ms · `--t-slow` 420ms · `--ease` |

## 5. 부품 클래스

| 부품 | 클래스 | 메모 |
|---|---|---|
| 버튼 | `.btn` + `.btn-primary` `.btn-dark` `.btn-soft` `.btn-ghost` `.btn-ai` `.btn-danger` | 크기 `.btn-sm` `.btn-lg`, 폭 가득 `.btn-block`, 아이콘만 `.btn-icon`(반드시 `aria-label`), 기다림 `.is-loading` + `<span class="spinner">` |
| 가게 링크 | `a.btn.btn-link` | "오늘의집 ↗" 작은 알약 버튼 |
| 입력 | `.input` `.select` `.textarea`, 작은 것 `.input-sm` `.select-sm` | 틀린 값은 `aria-invalid="true"` |
| 입력 묶음 | `label.field > .field-label + 입력 + .field-hint/.field-error`, 여러 개는 `.field-row` | |
| 단위 붙은 입력 | `.input-group > .input + .input-unit` | "cm", "만원" |
| 입력+버튼 | `.input-join` | 직접 입력 + [AI로 만들기] |
| 슬라이더 | `input.slider` `style="--pct: 25%"` + `.slider-ticks` | 채워진 정도는 `--pct`로 넘겨요 |
| 스위치 | `label.switch > input[type=checkbox] + .switch-track + 글자` | 통로 보기 |
| 카드 | `.card`(+`.card-hero`) `> .card-head(.card-title + 오른쪽 배지) + 내용` | |
| 패널 | `.panel` `> .panel-head/.panel-body/.panel-foot`, 테두리 없는 `.panel-plain` | |
| 단계 머리 | `section.step(.is-done) > .step-head(.step-num + .step-title + .step-meta)` | 작은 제목은 `.sub-label` |
| 배지 | `.badge` + `-accent` `-ok` `-warn` `-error` `-ai` `-outline` | "AI 추정"=`badge-ai`, "치수 확인"=`badge-warn`, "기본 설명"=`badge` |
| 칩 | `.chip`(+`.is-active`), 지우기 `.chip-x` | |
| 탭 | `.tabs[role=tablist] > button.tab[role=tab][aria-selected]` | 2D 평면도 / 3D 보기 |
| 세그먼트 | `.segmented > button[aria-pressed]`(+`.segmented-sm`) | 3D 시점 고르기 등 |
| 막대 | `.meter`(얇음) `.progress`(굵음) `style="--value: 0~100"`, `.is-warn` `.is-error`, 끝없는 진행 `.progress.is-busy` | |
| 뼈대 | `span.skeleton` `style="width: 80%"` | AI 응답 기다릴 때 줄 3~4개 |
| 말풍선 | `.tooltip[data-tip="글"]`(+`.tooltip-down`) | 마우스·키보드 초점 모두에서 뜸 |
| 알림 | `.alert` + `-ok` `-warn` `-error`, 잠깐 뜨는 `.toast` | |
| 빈 화면 | `.empty > .empty-art + .empty-title + p` | |
| 모달 | `.modal-backdrop > .modal > .modal-head/.modal-body/.modal-foot` | 파일 놓는 곳 `.dropzone(.is-over)` |
| 기타 | `.kbd` `.divider` `.note` `.muted` `.num` `.row` `.stack` `.grow` `.sr-only` `.icon` | `.icon`은 16px 선 아이콘(시안 맨 위 `<symbol>` 모음 참고) |

## 6. 기능별로 어디에 무엇을 쓰는지

**위 막대** — `.brand` + `.brand-tag` + `.topbar-actions`: [예시 불러오기] `.btn.btn-ghost`, [DWG 불러오기] `.btn`, [SketchUp 내보내기] `.btn.btn-dark`.
내보내는 동안은 `.is-loading`, 끝나면 `.toast`.

**왼쪽 입력** (`.step` 네 개)

| 단계 | 구성 |
|---|---|
| ① 방 | `.field-row`에 가로·세로·천장 높이(`.input-group`). 문·창문은 한 줄에 `.opening`(종류 · 벽 `.select-sm` · 시작 · 폭 · 지우기). 첫 문(현관)은 지우기 버튼 `disabled`. 아래에 `.btn.btn-soft.btn-sm` [+ 문 추가] [+ 창문 추가] |
| ② 스타일 | `.style-grid > button.style-card[aria-pressed]`(`.palette-strip` 5색 + `.style-name`). 3칸, 2줄 넘으면 안에서 스크롤. 아래 `.input-join`에 직접 입력 + `.btn.btn-ai` [AI로 만들기]. AI가 만든 스타일도 같은 카드로 맨 앞에 추가하고 `.badge-ai`를 붙여요 |
| ③ 예산 | `.input-group`(만원) + `.slider` + `.slider-ticks` |
| ④ 가구 | `.textarea` + `.field-hint`, 알아본 가구는 `.spec-list > .spec`. 한 줄: `.spec-dot`(가구색) · `.spec-name`(+배지) · `button.spec-dims`("110 × 200 × 45 cm", 누르면 펼침) · `.spec-price` · 빼기 버튼. 펼치면 `.spec.is-open` 안에 `.spec-edit`(폭·깊이·높이·가격 입력). 치수를 모르는 가구(`source: 'default'`)는 `.spec.is-check` + `.badge-warn` "치수 확인", AI가 추정한 가구(`source: 'ai'`)는 `.badge-ai` "AI 추정" |
| 바닥 | `.panel-foot`에 `.btn.btn-primary.btn-lg.btn-block` [배치 추천받기] — 스크롤해도 항상 보여요 |

**가운데 캔버스**

- `.canvas-head`: `.tabs`(2D/3D) · 가운데 `.variant`(‹ 배치안 1 / 4 ›) · `.switch`(통로 보기).
- `.canvas-stage.has-rail`: `<svg class="plan">`(7절) + `.toolbar`(고른 가구 도구 막대) + `.variant-rail`(배치안 작은 그림, `MiniPlan`).
  3D 보기는 `<div class="stage-fill"><Plan3D … /></div>`로 무대를 가득 채워요.
- `.toolbar`: 가구 이름 · ← ↑ ↓ → · 돌리기 · 빼기. **고른 가구(앞 사용 공간 포함) 바로 아래 8px**에 두고, 아래에 자리가 없으면 위에 둬요.
  좌우는 무대 밖으로 나가지 않게 잘라요(시안 맨 아래 스크립트가 같은 계산을 해요).
- `.canvas-foot`: 조작 안내(`.kbd`) + `.legend`("60cm 통로로 갈 수 있는 곳 (참고값)").
- 가구가 없을 때 `.empty`, 배치를 찾는 중 `.spinner` + `.progress.is-busy`.

**오른쪽 결과** (`.card` 다섯 장, 이 순서)

| 카드 | 구성 |
|---|---|
| 배치 점수 | `.card.card-hero`. `.score > .gauge + .score-text(.score-grade, .score-desc)`. 게이지는 `<circle class="gauge-value" pathLength="100" stroke-dasharray="점수 100">`. 원칙별로 `.parts > .part(.part-top + .meter + .part-note)`, 비율 60% 아래면 `.meter.is-warn`, 40% 아래면 `.is-error`. 총점 60 미만이면 `.gauge.is-warn`, 40 미만이면 `.is-error` |
| 배치 검사 | `ul.issues > li > button.issue.is-error / .is-warn`(누르면 그 가구를 고름). 문제 없으면 `.alert.alert-ok`. 끝에 `.note`로 "통로 60cm는 참고값" |
| 예상 비용 | `.cost > .cost-row(.cost-name + a.btn-link + .cost-price)`, 소품은 `.cost.cost-group`, 합계는 `.cost-sum(.is-over) > .cost-total + .progress + 예산/남은 예산`. `.note`로 "시연용 예상 가격" |
| 색상 팔레트 | `.swatches > .swatch(.swatch-color + .swatch-role + .swatch-name + .swatch-hex)` 5개 + `dl.facts`(마감재, 분위기) |
| AI 추천 설명 | 머리에 `.badge-ai` "AI" 또는 `.badge` "기본 설명". `.advice-summary` + `ul.advice-list` + `.advice-tip`. 기다리는 동안 기본 설명을 먼저 보여 주고 아래에 `.alert`(spinner) + `.skeleton` 줄 |

## 7. 평면도 그리기 (`src/symbols.jsx`)

```jsx
import { FurnitureSymbol, FurnitureLabel, symbolTransform, PlanDefs, RoomShell, WalkOverlay, ClearZone, MiniPlan, planViewBox } from './symbols.jsx';

const px = 0.8; // 화면 1px이 몇 cm인지. (방 세로 + 80) ÷ 무대 높이(px) 쯤으로 계산하면 글자가 항상 12px 안팎이 돼요
<svg className="plan" viewBox={planViewBox(room, px)}>
  <PlanDefs room={room} palette={style.palette} />
  <RoomShell room={room} palette={style.palette} px={px} />
  {/* 러그(floor)를 먼저 → 통로 점 → 나머지 가구 */}
  {showWalk && <WalkOverlay points={walk.points} />}
  {items.map((it) => (
    <g key={it.uid} className={`plan-item ${it.floor ? 'is-floor' : ''} ${sel ? 'is-selected' : ''}`} tabIndex={0} role="button" aria-label={…}>
      <g transform={symbolTransform(it)}>
        {(sel || level) && <ClearZone spec={it} level={level} />}
        <FurnitureSymbol spec={it} palette={style.palette} selected={sel} level={level} />
        <FurnitureLabel spec={it} rot={it.rot} px={px} level={level} />
      </g>
    </g>
  ))}
</svg>
```

| 내보내는 것 | 하는 일 |
|---|---|
| `FurnitureSymbol({ spec, palette, selected, level })` | 원점에 폭 w × 깊이 d, 등이 위(y=0)·앞이 아래(y=d)로 가구를 그려요. `level`은 `'warn' \| 'error'` |
| `FurnitureLabel({ spec, rot, px, level, text })` | 이름표. 회전해도 글자는 바로 서고, 가로 → 세로 → 작게 → 말줄임 순서로 맞춰요 |
| `symbolTransform(item)` | `x, y, rot`을 `<g transform>` 문자열로 (rot 90 = 등이 오른쪽 벽) |
| `symbolKind(spec)` | 어떤 그림을 쓰는지 (`'bed'`, `'desk'` …). 확인용 |
| `PlanDefs`, `RoomShell({ room, palette, px, dims })` | 나무 바닥 무늬, 벽, 창문과 창가 빛, 문과 여는 자리, 치수선, 1m 축척 막대 |
| `WalkOverlay({ points })` | 걸어 다닐 수 있는 곳을 옅은 초록 점으로 |
| `ClearZone({ spec, level })` | 가구 앞 사용 공간(점선). 가구와 같은 `<g>` 안에 넣어요 |
| `MiniPlan({ room, items, palette })` | 배치안 작은 그림 |
| `planViewBox(room, px)`, `WALL_CM`, `mix(a, b, t)` | 여백 포함 viewBox, 벽 두께(10cm), 색 섞기 |

**어떤 그림이 나오는지** — `spec.floor`면 러그. 아니면 `key`와 `name`에 들어 있는 낱말로 고르고(피아노, TV, 냉장고, 세탁기, 화장대, 거울, 행거·건조대, 옷장, 책장·선반, 서랍장·협탁·수납장, 소파, 침대, 식탁, 좌식·사이드 테이블, 책상, 화분, 조명, 의자·빈백),
낱말이 없으면 `category`로 골라요. 그래도 모르면 둥근 상자예요. 이름에 "원형"이 있으면 탁자·러그가 둥글게 나와요.

**그리는 규칙**

- 색: 가구 몸체는 `spec.color`에 팔레트 "메인 가구" 색을 45% 섞고, 이불·쿠션·러그는 "패브릭", 쿠션·화분·소품은 "포인트" 색을 써요.
  그래서 스타일을 바꾸면 평면도 색도 함께 바뀌어요. 가전은 `spec.color` 그대로예요.
- 선: 모든 선은 화면 기준 굵기(`vector-effect: non-scaling-stroke`). 바깥선 1.2px, 세부선 0.8px, 선 색은 면 색을 따뜻한 먹색으로 42% 어둡게 한 색(어두운 면에서는 밝게).
- 크기: 30cm짜리에서는 세부(키보드, 책, 소품)를 빼고 윤곽만, 200cm에서도 선이 굵어지지 않아요.
- 책상·식탁·화장대·피아노의 의자는 **앞 사용 공간(`clear`) 안**에 그려요(`clear`가 30cm 이상일 때).
- 바닥: 팔레트 "바닥" 색을 흰색과 섞은 나무 마루(폭 12cm), 방의 긴 쪽을 따라 깔아요. 벽은 `--plan-wall` 10cm.
- 그림자: `.plan-item`에 `drop-shadow`(회전하지 않은 바깥 `<g>`에 클래스를 줘야 그림자 방향이 일정해요). 러그는 `.is-floor`로 그림자 없음.

| 상태 | 모습 |
|---|---|
| 기본 | 옅은 그림자 |
| 마우스 올림 | 그림자가 조금 짙어짐 |
| 고름 `selected` | `--plan-select` 2px 테두리 + 옅은 번짐, 앞쪽을 가리키는 작은 화살표, 앞 사용 공간 점선, 도구 막대 |
| 주의 `level="warn"` | `--warn` 점선 테두리 + 옅은 주황 덮개, 이름표 앞 `!` |
| 오류 `level="error"` | `--error` 2px 실선 + 붉은 덮개, 이름표 앞 `×` |
| 치수 모름 `source: 'default'` | `--warn` 가는 점선 테두리 |

## 8. 움직임

- 눌림·색 바뀜 120ms, 나타남 200ms, 점수·막대 채워짐 420ms. 모두 `--ease`.
- 새 배치가 나오면 가구에 `.plan-item.is-enter`를 붙이고 `style={{ animationDelay: i * 40 + 'ms' }}`로 차례로 나타나게 해요.
  SVG `transform`과 부딪치지 않게 투명도만 바꿔요.
- 끌어서 옮기는 동안에는 전환을 넣지 않아요(손을 바로 따라와야 해요).
- 기다림은 세 가지뿐: 버튼 안 `.spinner`, 끝없는 `.progress.is-busy`, 글 자리 `.skeleton`.
- `prefers-reduced-motion: reduce`면 모든 전환과 반복 움직임이 꺼져요(theme.css 맨 아래).

## 9. 접근성

- 글자 대비 4.5:1 이상(보조 글자 `--text-3`, 배지, 알림 포함). 상태는 색만으로 알리지 않고 글자·기호(`!`, `×`, "주의 1")를 같이 써요.
- 키보드 초점: 버튼·링크는 초록 2px 테두리, 입력칸은 초록 테두리 + `--ring`. 평면도의 가구는 초점을 받으면 고른 상태로 바꿔 주세요(SVG 안에서는 기본 테두리를 꺼 두었어요).
- 아이콘만 있는 버튼에는 `aria-label`, 게이지·진행 막대에는 `role="img"` + `aria-label`, 바뀌는 글자("배치안 2 / 4")에는 `aria-live="polite"`.

## 10. 하세요 / 하지 마세요

| 하세요 | 하지 마세요 |
|---|---|
| 한 화면에 `.btn-primary`는 하나(배치 추천받기)만 | 초록 버튼을 여러 개 늘어놓기 |
| 색·간격·모서리는 변수로 | 색 값이나 px를 컴포넌트에 직접 쓰기 |
| 가격 옆에 "시연용 예상 가격", 통로 옆에 "참고값" | "법적 기준", "안전 기준" 같은 표현 |
| 글은 쉬운 존댓말 "~해요"로 짧게 | 느낌표를 여러 개 쓰거나 전문 용어 쓰기 |
| 긴 목록은 패널 안에서 스크롤 | 1000px 이상에서 페이지 전체가 스크롤되게 하기 |
| 기다릴 때는 먼저 기본값을 보여 주고 `.skeleton` | 빈 화면에 "로딩 중"만 띄우기 |
| 주의는 주황, 오류는 빨강, AI는 보라 | 강조색 초록을 "문제 없음" 말고 다른 상태 뜻으로 쓰기 |
| 가구 그림은 `FurnitureSymbol`로 | 가구를 단색 사각형으로 그리기(작은 그림 `MiniPlan`만 예외) |

## 11. v1과 달라진 점

- 페이지 전체가 길게 스크롤되던 것을 한 화면 작업 공간으로(패널 안에서만 스크롤, 추천 버튼은 항상 보임).
- 단색 사각형 가구 → 위에서 본 실제 모양(침대·베개, 책상·모니터·의자, 옷장·옷걸이, 책장·책 …), 나무 바닥, 창가 빛, 그림자.
- 글자뿐이던 결과 → 점수 게이지와 원칙별 막대, 예산 진행 막대, 큰 색 조각, 색으로 구분되는 검사 목록.
- 기본 브라우저 입력칸·체크박스 → 통일된 입력칸, 스타일 카드, 슬라이더, 스위치, 배지.
- 갈색 강조색이 주의색(주황)과 비슷하던 문제 → 초록 강조색으로 바꿔 상태색과 분리.
