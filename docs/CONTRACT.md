# 방꾸미 v2 공통 규약 (CONTRACT)

여러 작업자가 동시에 작업한다. **이 문서의 데이터 형식과 파일 담당을 반드시 지킨다.**
자기 담당이 아닌 파일은 고치지 않는다. 규약이 부족하거나 틀렸다고 판단하면 임의로 바꾸지 말고,
가장 가까운 해석으로 구현한 뒤 최종 보고에 "규약과 달라진 점"으로 적는다.

- 프로젝트: `C:/Users/사용자\dev\방꾸미` (Vite + React 19, ESM, Node 26, Windows 11)
- v1 백업(읽기 전용 참고용): `C:/Users/사용자\dev\방꾸미_v1` — 5173 포트에서 실행 중. **고치지 말 것.**
- 마감이 있는 대회 출품작이다. 동작하는 것이 우선이고, 화면의 모든 글은 한국어(쉬운 존댓말 "~해요")다.
- 가격은 항상 "시연용 예상 가격", 통로 60cm는 "참고값"으로 표시한다(법적·안전 기준이라고 쓰지 않는다).
- 사용자의 이름, 파일 이름, 파일 내용 등 개인 정보를 외부 서비스(웹 검색 포함)에 보내지 않는다.

## 1. 좌표와 단위

- 모든 길이는 **cm**. 방 안쪽의 왼쪽 위가 (0, 0), x는 오른쪽, y는 아래쪽(평면도를 위에서 본 방향).
- 3D에서는 평면 (x, y) → three.js (x, 높이, z=y). 높이는 cm.
- 벽 이름: `'top' | 'bottom' | 'left' | 'right'`. 벽 위의 위치 `offset`은
  top/bottom 벽이면 왼쪽에서(x), left/right 벽이면 위에서(y) 잰 시작점.

## 2. Room

```js
room = {
  width, depth,        // cm, 방 안쪽 크기. 150 ~ 1500
  height,              // cm, 천장 높이. 기본 240
  doors: [             // 1개 이상. 첫 번째가 현관문
    { wall, offset, size, kind }   // size: 문 폭(60~150), kind: 'entry' | 'bath' | 'etc'
  ],
  windows: [           // 0개 이상
    { wall, offset, size, sill, height }  // sill: 창대 높이(기본 90), height: 창 높이(기본 120)
  ],
  underlay,            // (선택) DWG에서 가져온 원본 선. { lines: [[x1,y1,x2,y2], ...] } 방 좌표(cm). 화면 표시용
}
```

- 문은 방 안쪽으로 열린다고 본다. 문 여는 공간 = 문 폭 × 문 폭 정사각형(벽에서 방 안쪽으로).
- `normalizeRoom(room)`(layout.js)이 빠진 값·범위를 벗어난 값을 고쳐 준다. 화면과 서버 모두 계산 전에 이것을 거친다.

## 3. FurnitureSpec (가구 사양)과 PlacedItem (배치된 가구)

```js
spec = {
  key,        // 문자열. 카탈로그 키('bed_ss') 또는 'custom:<이름>'
  name,       // 화면 표시 이름 ('슈퍼싱글 침대')
  category,   // 'bed' | 'desk' | 'storage' | 'seating' | 'table' | 'appliance' | 'decor' | 'etc'
  w, d, h,    // cm. w = 벽을 따라가는 폭, d = 벽에서 앞으로 나오는 깊이, h = 높이
  clear,      // cm. 앞쪽에 필요한 사용 공간(의자, 문 열기 등). 0 가능
  tall,       // boolean. true면 창문 앞에 두면 창을 가린다 (보통 h >= 120)
  sideOk,     // boolean. 옆면을 벽에 붙여도 되는지 (침대 등)
  floor,      // boolean. true면 바닥에 까는 것(러그): 다른 가구와 겹쳐도 되고 통로를 막지 않는다
  price,      // 원. 시연용 예상 가격
  color,      // '#rrggbb' 평면도·3D 기본색
  query,      // 쇼핑 검색어 ('슈퍼싱글 침대 프레임')
  source,     // 'catalog' | 'ai' | 'default' — 치수의 출처. 'default'는 "치수를 확인해 주세요" 표시 대상
}

item = { ...spec, uid, x, y, rot }
// uid: 화면에서 유일한 문자열
// (x, y): 회전이 적용된 몸체(위에서 본 사각형)의 왼쪽 위 좌표
// rot: 0 | 90 | 180 | 270
//   0 = 등이 위쪽 벽, 앞이 아래(+y)   → 몸체 크기 w × d
//   90 = 등이 오른쪽 벽, 앞이 왼쪽(-x) → 몸체 크기 d × w
//   180 = 등이 아래쪽 벽, 앞이 위(-y)
//   270 = 등이 왼쪽 벽, 앞이 오른쪽(+x)
```

치수 허용 범위(검증용): w, d 10~400, h 1~300, clear 0~150, price 0~50,000,000.

## 4. Style

```js
style = {
  key,          // 'minimal' 또는 'custom:<이름>'
  name,         // '미니멀'
  priceRate,    // 0.8 ~ 1.5. 가구 가격에 곱하는 값
  palette: [    // 정확히 5개, 이 순서
    { role: '벽', name, hex }, { role: '바닥', name, hex }, { role: '메인 가구', name, hex },
    { role: '패브릭', name, hex }, { role: '포인트', name, hex },
  ],
  materials,    // 문자열. 마감재 설명
  mood,         // 문자열. 한 줄 분위기 설명
  props: [{ name, price, query }],   // 추천 소품 3~6개
  source,       // 'preset' | 'ai'
}
```

## 5. 모듈과 담당 (파일 소유)

| 담당 | 파일 | 내보내는 것 |
|---|---|---|
| 공통(이미 있음, 고치지 말 것) | `server/util.js`, `server/index.js`, `server/dev-api.js`, `vite.config.js`, `docs/CONTRACT.md` | 아래 6절 |
| **배치 엔진** | `src/layout.js`, `src/layout.test.js`, `docs/interior-knowledge.md`, `docs/research/*` | 아래 5.1 |
| **가구·스타일·AI** | `src/catalog.js`, `src/catalog.test.js`, `src/advice.js`, `src/data.js`(삭제 또는 대체), `server/furniture.js`, `server/style.js`, `server/advice.js`, `server/*.test.js`(자기 것) | 아래 5.2 |
| **3D·SketchUp** | `src/Plan3D.jsx`, `src/three/*`, `server/skp.js`, `server/skp_export.py`, `server/su_api.py` | 아래 5.3 |
| **DWG** | `src/DwgImport.jsx`, `src/dwg/*`, `server/dwg.js`, `server/dwg/*` | 아래 5.4 |
| **쇼핑** | `src/shop.js`, `src/shop.test.js`, `server/shop.js`, `docs/shop-research.md` | 아래 5.5 |
| **디자인** | `src/theme.css`, `src/symbols.jsx`, `docs/DESIGN.md`, `docs/mockup.html` | 아래 5.6 |
| **화면 통합(2단계)** | `src/App.jsx`, `src/App.css`, `src/Plan.jsx`, `src/components/*`, `src/main.jsx`, `index.html`, `README.md`, `package.json`의 scripts | 전체 연결 |

`npm install`은 **DWG 담당과 화면 통합 담당만** 할 수 있다(동시에 설치하면 package.json이 깨진다).
이미 설치된 것: react, react-dom, vite, @vitejs/plugin-react, three, dxf-parser, pretendard.
다른 담당은 새 패키지가 꼭 필요하면 설치하지 말고 보고에 적는다.

### 5.1 `src/layout.js` (순수 함수, 브라우저와 Node 양쪽에서 동작, 외부 import 없음)

```js
normalizeRoom(room) → room                 // 빠진 값 채우고 범위 보정. 구버전 {door, window} 단수 형식도 받아서 배열로
dims(item) → { w, h }                      // 회전 적용된 평면 크기
body(item) → { x, y, w, h }
clearZone(item) → rect | null              // 앞쪽 사용 공간
doorZones(room) → rect[]                   // 문 여는 공간들
overlaps(a, b) → boolean                   // 닿는 것은 겹침이 아님
checkLayout(room, items) → {
  issues: [{ uid, other?, level: 'error' | 'warn', code, msg }],   // msg는 한국어 한 문장
  walk: { points: [{x, y}], reachable(item) → boolean },           // 문에서 통로 폭 이상으로 갈 수 있는 격자점
  score: { total, parts: [{ key, label, score, max, note }] },     // total 0~100, 인테리어 원칙별 점수
}
recommend(room, specs, variant = 0) → {
  items: item[], unplaced: spec[],
  score,                                   // checkLayout의 score와 같은 모양
  reasons: { [uid]: string[] },            // 가구별 배치 이유(한국어 문장, 인테리어 원칙 근거)
  variants: number,                        // 서로 다른 배치안이 몇 개 있는지 (variant % variants)
}
explain(room, items) → { [uid]: string[] } // 지금 배치의 사실 설명(사용자가 옮긴 뒤에도 계산 가능)
rotateItem(room, item) → item              // 가운데 기준 90도 회전, 방 안으로 보정
AISLE_CM                                   // 60 (참고값)
```

- 오류(error): 방 밖, 가구끼리 겹침(floor 제외), 문 여는 공간 막음. 경고(warn): 앞 사용 공간 부족, 창문 가림, 통로 끊김 등.
- `recommend`는 같은 입력이면 같은 결과(결정적). 가구 10개, 5m × 6m 방에서 1초 이내.
- spec에 `uid`가 있으면 그대로 쓰고, 없으면 만든다.

### 5.2 `src/catalog.js`, `src/advice.js`, AI 서버

```js
// catalog.js (순수 함수, 외부 import 없음)
CATALOG                       // { [key]: spec } 흔한 원룸 가구 30종 이상 (치수는 국내 시판 제품 기준)
parseFurnitureText(text) → { specs: spec[], unknown: string[] }
  // "슈퍼싱글 침대, 책상 1400, 옷장 2개, 전자피아노" → 카탈로그로 아는 것은 specs로(크기 숫자·개수 반영),
  // 모르는 것은 unknown(이름 문자열)으로. 즉시 실행(네트워크 없음).
defaultSpec(name) → spec      // 모르는 가구의 임시 사양 (source: 'default')
validateSpec(obj) → spec | null   // AI가 준 사양 검증·보정 (3절 범위)
STYLE_PRESETS                 // { [key]: style } 8종 이상 (미니멀, 내추럴, 모던, 빈티지, 북유럽, 재팬디, 미드센추리, 인더스트리얼 ...)
matchStyle(text) → style | null   // 직접 입력한 글이 프리셋과 맞으면 그 스타일
validateStyle(obj) → style | null // AI가 준 스타일 검증 (hex 형식, 5색, 가격 범위)
priceOf(spec, style) → number // 천원 단위 반올림한 예상 가격
won(n) → '120,000원',  josa(word, '을/를') → '책상을'
EXAMPLE                       // { room, styleKey, budget, furnitureText } 시연용 예시 (3m × 4m, 100만원)

// advice.js
buildAdvicePrompt({ room, style, budget, items, issues, score, facts }) → string
parseAdvice(text) → { summary, reasons: string[], styling, props } | null
fallbackAdvice({ room, style, items, issues, score, facts }) → 같은 모양   // AI 없이, facts(explain 결과) 기반
```

서버 (모두 `handler(req, res)` 기본 내보내기, 입력은 서버에서 다시 검증, AI 응답도 검증):

- `POST /api/furniture` `{ names: string[] }`(최대 8개, 각 40자) → `{ specs: spec[] }` — 카탈로그에 없는 가구의 치수·가격을 AI가 추정. source: 'ai'.
- `POST /api/style` `{ text }`(최대 60자) → `{ style }` — source: 'ai'.
- `POST /api/advice` `{ room, style, budget, items }` → `{ summary, reasons, styling, props }`.
  서버가 `checkLayout`, `explain`을 직접 다시 계산해 프롬프트에 넣는다. 사용자 글(가구 이름, 스타일 이름)은
  길이·문자 제한 후 "데이터"로만 넣고, 지시로 해석되지 않게 프롬프트를 짠다.
- AI 호출은 `askClaude`(server/util.js)만 쓴다. 한 번에 10~20초 걸리므로 화면은 항상 즉시 쓸 수 있는 대체값을 먼저 보여준다.

### 5.3 3D 보기와 SketchUp 내보내기

```jsx
// src/Plan3D.jsx — default export. React.lazy로 불러온다 (three는 여기서만 import).
<Plan3D room={room} items={items} style={style} selected={uid|null} onSelect={(uid|null) => {}} />
```

- 방(바닥, 벽, 문, 창문)과 가구를 3D로 보여준다. 마우스로 돌리기·확대, 시점 버튼(조감 / 위에서 / 1인칭 눈높이).
- 가구는 category별로 알아볼 수 있는 모양(침대: 프레임+매트리스+베개, 책상: 상판+다리+의자, 옷장: 몸통+문선 …), 스타일 팔레트 색 반영.
- 부모가 준 크기를 채운다(width/height 100%). items가 바뀌면 다시 그린다. 언마운트 때 WebGL 자원을 정리한다.

`POST /api/skp` `{ room, items, style, open }` → 성공 시 `.skp` 파일 본문(`Content-Type: application/octet-stream`,
`Content-Disposition: attachment; filename="bangkkumi.skp"`). `open: true`면 저장한 파일을 이 PC의 SketchUp으로도 연다.
`server/skp_export.py`가 `server/su_api.py`(SketchUp 2023 SDK ctypes 래퍼, mm 단위 입력)를 써서 실제 SKP를 만든다.
`available()`은 SketchUpAPI.dll과 python이 있을 때만 true. 내보낸 파일은 `exports/` 폴더에 둔다.

### 5.4 DWG 불러오기

`POST /api/dwg` — 본문은 파일 바이트 그대로(`Content-Type: application/octet-stream`), 헤더 `X-Filename`(encodeURIComponent).
`.dwg`는 AutoCAD Core Console로 DXF로 바꾼 뒤(`server/dwg/`), `.dxf`는 바로 읽는다. 최대 30MB. 응답:

```js
{
  unit: 'mm' | 'cm' | 'm' | 'inch',   // 도면 단위 추정
  bounds: { x, y, w, h },             // cm로 바꾼 전체 범위 (y는 아래쪽이 +가 되도록 뒤집어서)
  lines: [[x1, y1, x2, y2], ...],     // 화면 표시용 선분 (cm, 최대 2만 개로 줄임)
  rooms: [                            // 방 후보 (넓이 큰 순, 최대 12개)
    { x, y, w, h, doors: [...], windows: [...], label }   // doors/windows는 2절 형식(방 기준 좌표). label은 방 이름 문자(있으면)
  ],
}
```

```jsx
// src/DwgImport.jsx — default export. 모달.
<DwgImport onApply={({ width, depth, doors, windows, underlay }) => {}} onClose={() => {}} />
```

파일 선택(또는 끌어다 놓기) → 도면 미리보기 → 방 후보를 누르거나 직접 사각형을 끌어서 방 범위 지정 → [이 방으로 설정].
방은 직사각형만 지원한다(비정형 방은 감싸는 사각형). 원본 파일은 절대 고치지 않고 임시 폴더의 복사본만 다룬다.

### 5.5 쇼핑 (`src/shop.js`)

```js
shopLinks(query) → [{ id: 'ohouse', label: '오늘의집', url }, ...]   // 검색 결과로 가는 링크 (항상 동작)
fetchShop(query) → Promise<{ items: [{ title, price, url, image, mall }] } | null>  // 실시간 가격(가능할 때만). 실패 시 null
```

### 5.6 디자인 (`src/theme.css`, `src/symbols.jsx`)

```jsx
// src/symbols.jsx — 평면도용 가구 그림 (SVG). 원점 (0,0)에 폭 w × 깊이 d, 등이 위(y=0), 앞이 아래(y=d)인 상태로 그린다.
// 회전은 부르는 쪽이 <g transform>으로 처리한다.
<FurnitureSymbol spec={spec} palette={style.palette} />
```

`src/theme.css`는 색·글꼴·간격·그림자 등 CSS 변수와 기본 부품 클래스(버튼, 카드, 입력칸, 칩, 탭, 배지)를 정의한다.
`docs/DESIGN.md`에 화면 구성과 사용법을 적는다.

## 6. 서버 공통 (`server/util.js`)

```js
send(res, code, obj)                       // JSON 응답
readBody(req, limit) → Promise<Buffer>     // limit 초과 시 status 413 오류
readJson(req, limit) → Promise<object>     // 깨진 JSON이면 status 400 오류
extractJson(text) → object | null
askClaude(prompt, { timeoutMs, model }) → Promise<string>   // 로컬 claude 명령. 사용자 입력은 stdin으로만
```

- 라우터(`server/index.js`)가 `server/<파일>.js`를 주소별로 불러온다. 파일이 바뀌면 자동으로 다시 읽는다(그 파일이 import하는 다른 파일은 서버를 다시 켜야 반영).
- API만 따로 시험: `node server/dev-api.js <포트>`. 담당별 포트 — 가구·스타일·AI 5181, 3D·SketchUp 5182, DWG 5183, 쇼핑 5184, 화면 통합(vite) 5174.
  **5173은 v1 백업이 쓰고 있으니 건드리지 않는다.** 시험이 끝나면 자기가 띄운 서버는 끈다.
- 외부 프로그램을 실행할 때 사용자 입력을 명령줄 인자로 넘기지 않는다(파일·stdin 사용). 경로는 서버가 만든 임시 경로만 쓴다.
- Git Bash에서 `/i` 같은 옵션은 경로로 바뀌므로, Windows 프로그램 실행은 Node `spawn`(shell 없이) 또는 PowerShell로 한다.

## 7. 이 PC에서 확인된 도구

- AutoCAD 2027 Core Console: `C:/Program Files/Autodesk/AutoCAD 2027/accoreconsole.exe`
  — `accoreconsole.exe /i <복사본.dwg> /s <스크립트.scr>` (PowerShell/Node spawn에서 2초 만에 DXF 변환 확인됨).
  스크립트 예: `(setvar "FILEDIA" 0)` `(command "_.DXFOUT" (strcat (getvar "DWGPREFIX") "out.dxf") "16")` `_QUIT`.
  같은 이름의 DXF가 이미 있으면 덮어쓰기 질문으로 멈추므로 매번 새 임시 폴더에서 실행한다.
- Python 3.12: `python` (PATH에 있음). `server/su_api.py`로 SKP 저장이 되는 것을 확인함.
- SketchUp 2023: `C:/Program Files/SketchUp/SketchUp 2023/SketchUp.exe`, SDK `SketchUpAPI.dll` 같은 폴더.
- 시험용 DWG: 원본은 읽기만 하고, 반드시 복사해서 쓴다.
- 브라우저 확인: `C:/Users/사용자/dev/_bk-check` 에 playwright-core 설치됨. `chromium.launch({ channel: 'msedge', headless: true })`.
  확인용 스크립트·스크린샷은 `C:/Users/사용자/dev/_bk-check/<자기이름>/` 폴더에 둔다(프로젝트 폴더에 넣지 않는다).

## 8. 1단계(병렬 작업) 동안의 주의

- 1단계에서는 여러 담당이 동시에 파일을 바꾼다. **메인 화면(`src/App.jsx`)은 2단계 전까지 깨져 있는 것이 정상**이다.
  자기 모듈은 단독으로 검증한다: Node 테스트(`node --test <파일>`), API 서버(`node server/dev-api.js <포트>`),
  화면 부품은 자기 폴더의 시험용 HTML(예: `src/three/harness.html`)을 vite로 띄워 확인.
- vite를 띄울 때는 반드시 자기 포트와 자기 캐시 폴더를 쓴다(PowerShell 예):
  `$env:BK_CACHE='node_modules/.vite-<이름>'; npx vite --port <포트> --strictPort`
  (Git Bash 예: `BK_CACHE=node_modules/.vite-<이름> npx vite --port <포트> --strictPort`)
  포트 — 3D 5182, DWG 5183, 쇼핑 5184, 디자인 5185, 배치 엔진 5186, 가구·스타일·AI는 dev-api 5181.
- `src/layout.js`는 1단계 동안 다시 쓰이는 중이다. **배치 엔진 담당 외에는 1단계에서 `src/layout.js`를 import하지 않는다**
  (회전 크기 계산 같은 간단한 것은 자기 파일 안에서 직접 한다). 예외: `server/advice.js`는 핸들러 안에서
  `await import('../src/layout.js')`로 늦게 불러오고, 단위 테스트는 손으로 만든 facts로 한다.
- `src/data.js`, `src/App.jsx`, `src/Plan.jsx`, `src/App.css`는 1단계에서 아무도 고치거나 지우지 않는다(2단계가 정리).
- 전체 `npm test`, `npx vite build`는 다른 담당의 작업 중 파일 때문에 실패할 수 있다. 자기 파일만 지정해서 테스트한다.

## 9. 추가: 웹 검색 시세 (`/api/price`)

- `POST /api/price` `{ queries: string[] }`(최대 8개) → `{ items: [{ query, low, high, typical, sources: [{ title, url }] }], checkedAt }`.
  서버의 AI가 웹 검색 결과로 실제 판매 가격대를 조사한다(20~60초). 가격을 못 찾은 가구는 items에서 빠진다. 실패 시 502.
- 화면에서는 `src/shop.js`의 `fetchPrices(queries)`를 쓴다(실패하면 null). 배치 추천 뒤 백그라운드로 한 번 호출하고,
  결과가 오면 그 가구의 가격을 "웹 검색 시세"(typical, 범위 low~high, 출처 링크)로 바꿔 보여준다. 못 찾은 가구는 "시연용 예상 가격" 그대로.
- 오늘의집 페이지를 직접 읽는 것이 아니다(자동 수집 금지). 화면 문구도 "웹 검색 시세"라고 쓴다.

## 10. 추가: 실제 상품 자료 (파트너가 준 다나와·이케아 조사 자료)

원본(읽기 전용): `C:/Users/사용자/dev/_bk-check/partner-files/` — `catalog.json`(다나와 10,107개, 3.9MB), `furniture.json`(이케아 26개),
`인계문서.md`(반드시 읽을 것), `shop.js`·`samples.js`·`tests.html`(네이버 검색용, 키가 없어 쓰지 않는다).
**`catalog.json`은 3.9MB다. Read나 cat으로 통째로 열지 말고, 스크립트로 통계·표본만 뽑아 본다.**

프로젝트 안 위치: `public/data/catalog.json`, `public/data/ikea.json`(원본 그대로 복사, 고치지 않는다) → 브라우저에서 `/data/catalog.json`.

### 10.1 `src/products.js` (import는 `./catalog.js`만. 브라우저와 Node 양쪽에서 동작)

```js
product = {
  id,                 // 'dnw-851238' | 'ikea-bed-tarva-120' (유일)
  src,                // 'danawa' | 'ikea'
  category,           // 파트너 분류 19종: bed chair sofa cabinet wardrobe table diningtable desk hanger drawer shelf kitchen bookcase vanity bedside tvstand shoerack lamp box
  type,               // 세부 분류 글자 ('모션데스크', '벙커침대' …). 이케아는 ''
  name, brand,        // 꺾쇠·제어 문자를 뺀 글자 (name 최대 80자, brand 최대 30자)
  w, d, h,            // cm, 자료에 적힌 값 그대로(소수 가능)
  price,              // 원
  shops,              // 판매처 수 (이케아는 0)
  warn,               // '' | '가격 확인 필요' | '치수 확인 필요' — 화면에 그대로 보여 준다
  note,               // '매트리스 미포함' 같은 주의점
  url,                // https://prod.danawa.com/… 또는 https://www.ikea.com/… 만 (다른 주소면 그 상품을 뺀다)
  image,              // https://img.danuri.io/… 만. 아니면 ''
  floorless,          // true면 바닥을 차지하지 않는 것(벽 선반, 단스탠드 등) → 기본 검색에서 뺀다
}

PRODUCT_SOURCES       // { danawa: { label: '다나와 최저가', note: '…' }, ikea: { label: '이케아 공식가', note: '…' } } 가격 표시 문구
PRODUCT_CATEGORIES    // [{ key, label }] 19종, 원룸에서 자주 찾는 순서 (label은 한국어: '침대', '책상' …)
normalizeProducts(catalogJson, ikeaJson) → product[]      // 검증·정리. 형식이 틀린 상품은 뺀다
loadProducts() → Promise<product[]>                       // fetch('/data/catalog.json') + ikea.json, 한 번만 불러 기억. 실패하면 Error('상품 목록을 불러오지 못했어요')
searchProducts(list, opts) → { total, items, types }      // 아래 참고. 순수 함수, 1만 개에서 20ms 안쪽
productToSpec(product) → spec & { product: meta }         // 3절 spec(validateSpec 통과) + product 정보
productIn(obj) → meta | null                              // 저장된 product 정보를 다시 검증(주소 허용 목록, 길이, 숫자 범위)
productCategoryOf(spec) → category | null                 // 앱 가구(spec.key 기준)에 맞는 파트너 분류. 없으면 null
```

- `searchProducts` opts: `{ q, category, type, fit: { width, depth } | null, near: { w, d } | null, maxPrice, includeFloorless = false, sort, offset = 0, limit = 60 }`.
  `q`는 띄어쓰기로 나눈 낱말이 모두 `name + brand + type`에 들어 있는 상품(대소문자 무시). `fit`은 그 방에 들어가는 것만
  (긴 변 ≤ 방의 긴 변, 짧은 변 ≤ 방의 짧은 변). `sort`: `'popular'`(판매처 많은 순, 기본) | `'price'` | `'price-desc'` | `'small'` | `'near'`(near와 폭·깊이 차이가 작은 순).
  `types`는 지금 조건(분류까지)에서 고를 수 있는 세부 분류 `[{ type, count }]`.
- `productToSpec`: 가장 가까운 `CATALOG` 항목을 바탕으로 한다(배치 엔진·그림이 `key`와 `name`으로 가구 종류를 알아보기 때문).
  `key` = 바탕 카탈로그 키, `name` = 짧은 종류 이름(30자 이내, 예: '컴퓨터 책상', '슈퍼싱글 침대'), `w d h` = 상품 치수(반올림),
  `price` = 상품 가격, `query` = 상품 이름(40자), `source: 'catalog'`.
  `product` meta = `{ id, src, name, brand, type, w, d, h, price, warn, note, url, image }` (w d h는 반올림 전 값).
  예외 하나: 모션데스크는 자료의 높이가 "가장 높였을 때"라서 `spec.h = min(상품 높이, 75)`, `tall = false`로 둔다(평면도·3D에서 키 큰 가구가 되지 않게). 조사한 높이는 `product.h`에 그대로 남는다.
  상품이 틀리면 `productToSpec`은 `null`을 돌려준다.
- 가격 문구: 다나와는 "다나와 최저가 · 2026년 11월 17일 조사 · 배송비 제외 · 가장 싼 옵션 기준", 이케아는 "이케아 공식가 · 2026년 11월 조사".
  어느 쪽이든 "실제 가격과 다를 수 있어요"를 함께 쓴다. 스타일 가격 배수(priceRate)는 실제 상품 가격에 곱하지 않는다.
- 앱이 다나와·이케아 페이지를 자동으로 읽어 오지 않는다(이 자료는 한 번 조사한 값). 상품 사진은 주소로만 불러오고, 못 불러오면 가구 그림으로 대신한다.

### 10.2 `src/components/ProductPicker.jsx` (+ `ProductPicker.css`) — default export, 모달

```jsx
<ProductPicker
  room={room}                       // "내 방에 들어가는 것만" 걸러 보기에 쓴다
  initial={{ category, near: { w, d }, title }}   // (선택) 처음 열 때의 분류·비슷한 크기 기준·제목
  onPick={(spec, product) => {}}    // [담기]를 누르면 productToSpec 결과를 넘긴다. 모달은 닫지 않는다(여러 개 담기)
  onClose={() => {}}
/>
```

`role="dialog" aria-modal="true"`. 검색 칸, 분류 칩, 세부 분류, "내 방에 들어가는 것만" 스위치, 정렬, 결과 카드(사진·이름·브랜드·치수·가격·주의 배지·담기·상품 페이지 링크), 더 보기, 불러오는 중·오류·결과 없음 상태. 색·간격은 `theme.css` 변수만 쓴다.

## 11. 추가: 평면도 그림에서 방 가져오기 (`/api/floorplan`)

- 화면은 `src/FloorplanImport.jsx`(`{ onApply, onClose }`, DwgImport와 같은 모양), 서버는 `server/floorplan.js`다. 파트너가 만들었고 `App.jsx`의 방 패널("도면에서 가져오기" 아래)에서 연다.
- 응답 plan은 5.4(`/api/dwg`)와 같은 모양에 `scale`, `notice`가 더 붙는다. 그림은 AI가 읽고, 좌표와 크기(cm)는 코드(`toPlan`)가 계산하고 값을 하나씩 검증한다. AI가 준 값을 `toPlan` 없이 화면으로 보내지 않는다.
- 요청: `GET` → `{ lookup }`. `POST` 그림 바이트(`Content-Type: image/jpeg|png`, 5MB까지, 헤더 `X-Area`에 전용면적 ㎡) → plan. 오류는 `{ error }`(한국어)와 400 · 403 · 404 · 413 · 422 · 502.
- **주소로 찾기(직방 조회)는 기본으로 꺼져 있다.** 직방의 공개되지 않은 주소를 부르는 기능이라 9 · 10절의 "자동 수집을 하지 않는다"와 맞지 않는다. `FLOORPLAN_LOOKUP=on`으로 서버를 켰을 때만 동작하고, 꺼져 있으면 JSON 요청(`{ address }`, `{ complex }`)은 모두 403이며 직방을 부르지 않는다(테스트가 지킨다). 켜는 것은 사람이 정한다.
- 올린 그림은 로그인된 `claude` 명령에 stdin으로 넘긴다(명령줄에는 사용자 입력을 넣지 않는다, 6절). 그림은 저장하지 않고, AI가 읽은 방 좌표만 임시 폴더에 기억한다.

## 12. 추가: 집 전체 꾸미기 (`home.html`)

- 메인(`App.jsx`)은 방 하나만 다룬다. `src/home.js`가 방마다 메인의 저장값(`bangkkumi-v2`)을 `bangkkumi-home`에 따로 간직하고, 고른 방 하나만 메인에 올린다. 파트너가 만들었다.
- 방 표시는 저장값의 `userPrices`에 넣는 `'home|<방 id>': 0`이다. 이 키를 지우거나 다른 뜻으로 쓰지 않는다(가격 계산에는 쓰이지 않는다).
- 방 바꾸기는 늘 `home.html`을 거친다(`./home.html#open=<방 id>`). 메인이 떠나면서 저장한 지금 방을 `openHome`이 먼저 받아 둔 뒤에 고른 방을 올린다.
- 방별 금액(`costOf`)은 `App.jsx`의 합계와 같은 식이다. 합계 식을 바꾸면 함께 바꾼다. 가구가 없는 방은 0원으로 센다.
- `FloorplanImport`에 `multi`를 주면 방을 여러 개 체크해 `onApply([{ label, room }, …])`로 넘긴다. `multi`가 없으면 전과 같다.
