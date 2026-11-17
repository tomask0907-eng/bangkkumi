// 가구 카탈로그, 스타일 프리셋, 직접 입력한 글 해석. 순수 함수만 있고 외부 import가 없다(브라우저·서버 공용).
// 모든 치수는 cm, 가격은 원. 가격은 시연용 예상 가격이며 실제 판매가가 아니다.

export const CATEGORIES = ['bed', 'desk', 'storage', 'seating', 'table', 'appliance', 'decor', 'etc'];
const CAT_COLOR = {
  bed: '#c9b8a6', desk: '#a58a6f', storage: '#8c7a6b', seating: '#9fa8a3',
  table: '#b7a089', appliance: '#c3c8cc', decor: '#b9ab94', etc: '#aaa39a',
};
const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

// 사용자·AI가 준 글을 화면과 프롬프트에 넣기 전에 다듬는다: 제어 문자와 꺾쇠를 빼고 길이를 자른다.
export function cleanName(text, max = 30) {
  if (typeof text !== 'string' && typeof text !== 'number') return '';
  const s = String(text).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, max).join('').trim();
}

// ───────── 가구 카탈로그 ─────────
// [key, 이름, 분류, w, d, h, clear, 가격, 검색어, 별칭, 표시(t=tall s=sideOk f=floor), 묶음]
// 별칭은 붙여 쓴 소문자. 'a+b'는 두 낱말이 모두 들어 있어야 맞는 것. 묶음이 같으면 입력한 폭에 가장 가까운 것으로 바뀐다.
// 치수·가격은 국내 쇼핑몰의 보급형 제품을 기준으로 잡았다.
const ROWS = [
  ['bed_single', '싱글 침대', 'bed', 100, 200, 45, 0, 250000, '싱글 침대 프레임 매트리스 세트', '', 's', 'bed'],
  ['bed_ss', '슈퍼싱글 침대', 'bed', 110, 200, 45, 0, 320000, '슈퍼싱글 침대 프레임 매트리스 세트', '침대|베드|bed|슈퍼싱글|supersingle|싱글사이즈|더블사이즈|퀸사이즈|킹사이즈', 's', 'bed'],
  ['bed_double', '더블 침대', 'bed', 140, 200, 45, 0, 390000, '더블 침대 프레임 매트리스 세트', '', 's', 'bed'],
  ['bed_queen', '퀸 침대', 'bed', 150, 200, 45, 0, 450000, '퀸 침대 프레임 매트리스 세트', '', 's', 'bed'],
  ['bed_king', '킹 침대', 'bed', 160, 200, 45, 0, 560000, '킹 침대 프레임 매트리스 세트', '', 's', 'bed'],
  ['bed_mattress', '저상 매트리스', 'bed', 110, 200, 25, 0, 180000, '슈퍼싱글 매트리스', '매트리스|mattress|토퍼|저상+침대|저상+매트리스', 's'],
  ['bed_bunk', '벙커 침대', 'bed', 110, 205, 180, 0, 400000, '벙커 침대 슈퍼싱글', '벙커+침대|벙커|로프트+침대|2층+침대|이층+침대', 'ts'],

  ['desk_100', '책상 1000', 'desk', 100, 60, 73, 60, 70000, '책상 1000', '', '', 'desk'],
  ['desk_120', '책상 1200', 'desk', 120, 60, 73, 60, 90000, '책상 1200', '책상|데스크|desk', '', 'desk'],
  ['desk_140', '책상 1400', 'desk', 140, 70, 73, 60, 120000, '책상 1400', '', '', 'desk'],
  ['desk_160', '책상 1600', 'desk', 160, 80, 73, 60, 160000, '책상 1600', '', '', 'desk'],
  ['desk_computer', '컴퓨터 책상', 'desk', 120, 60, 75, 60, 110000, '컴퓨터 책상 1200', '컴퓨터+책상|컴퓨터+데스크|게이밍+책상|게이밍+데스크|pc+책상|computer+desk|gaming+desk'],
  ['desk_motion', '모션 데스크', 'desk', 120, 70, 75, 60, 250000, '전동 모션 데스크 1200', '모션+데스크|모션+책상|전동+책상|전동+데스크|높이조절+책상|스탠딩+책상|스탠딩+데스크|standing+desk'],
  ['chair', '의자', 'seating', 55, 55, 90, 20, 60000, '책상 의자', '의자|chair|오피스+체어|데스크+체어'],

  ['wardrobe_80', '옷장 800', 'storage', 80, 60, 195, 50, 150000, '옷장 800', '', 't', 'wardrobe'],
  ['wardrobe_100', '옷장 1000', 'storage', 100, 60, 195, 50, 200000, '옷장 1000', '옷장|장롱|장농|wardrobe|closet', 't', 'wardrobe'],
  ['wardrobe_120', '옷장 1200', 'storage', 120, 60, 195, 50, 260000, '옷장 1200', '', 't', 'wardrobe'],
  ['hanger', '스탠드 행거', 'storage', 120, 45, 170, 40, 45000, '스탠드 행거 옷걸이', '행거|옷걸이|hanger|스탠드+행거|이동식+행거', 't'],
  ['dresser', '서랍장', 'storage', 80, 45, 85, 45, 100000, '4단 서랍장', '서랍장|dresser|drawer|drawers|체스트'],
  ['bookshelf', '책장', 'storage', 80, 30, 180, 30, 70000, '5단 책장', '책장|책꽂이|bookshelf|bookcase', 't'],
  ['bookshelf_low', '낮은 책장', 'storage', 80, 30, 90, 30, 45000, '3단 책장', '낮은+책장|3단+책장|2단+책장|로우+책장'],
  ['cabinet', '수납장', 'storage', 80, 40, 90, 40, 80000, '수납장', '수납장|캐비닛|cabinet|장식장'],
  ['shelf', '선반', 'storage', 80, 35, 150, 30, 40000, '철제 선반 4단', '선반|스틸랙|메탈랙|스피드랙|철제+선반|shelf|rack', 't'],
  ['shoe_rack', '신발장', 'storage', 80, 35, 110, 40, 70000, '신발장', '신발장|슈즈랙|신발+정리대|신발+선반|shoe+rack|shoe+cabinet'],
  ['tv_stand', 'TV장', 'storage', 120, 40, 45, 30, 90000, 'TV 거실장 1200', 'tv장|거실장|tv+거실장|tv+다이|tv+선반|tv+수납장|tv+stand'],
  ['microwave_rack', '전자레인지 수납장', 'storage', 60, 40, 160, 50, 80000, '전자레인지 수납장 레인지대', '전자레인지+수납장|전자레인지+선반|전자레인지+장|레인지대|전자레인지|microwave', 't'],
  ['nightstand', '협탁', 'storage', 45, 40, 50, 0, 40000, '침대 협탁', '협탁|사이드+테이블|nightstand|bedside+table'],
  ['vanity', '화장대', 'table', 80, 40, 130, 55, 110000, '화장대 세트', '화장대|메이크업+테이블|vanity|dressing+table', 't'],
  ['mirror', '전신거울', 'decor', 50, 40, 160, 60, 35000, '스탠드 전신거울', '전신거울|전신+거울|스탠드+거울|거울|mirror', 't'],

  ['sofa_2', '2인 소파', 'seating', 150, 80, 80, 40, 300000, '2인 소파', '소파|카우치|sofa|couch|2인+소파'],
  ['sofa_1', '1인 소파', 'seating', 80, 80, 80, 40, 150000, '1인 소파', '1인+소파|싱글+소파|암체어|라운지+체어|1인+체어|안락+의자|armchair'],
  ['sofa_3', '3인 소파', 'seating', 190, 85, 80, 40, 450000, '3인 소파', '3인+소파'],
  ['sofa_bed', '소파베드', 'seating', 180, 85, 80, 60, 250000, '접이식 소파베드', '소파+베드|소파+침대|sofa+bed'],
  ['recliner', '리클라이너', 'seating', 80, 90, 100, 50, 250000, '1인 리클라이너 소파', '리클라이너|recliner|리클라이너+소파|리클라이너+체어|리클라이너+의자'],
  ['beanbag', '빈백', 'seating', 90, 90, 70, 0, 80000, '빈백 소파', '빈백|빈백+소파|빈백+체어|beanbag|bean+bag'],

  ['table_2', '2인 식탁', 'table', 80, 60, 73, 55, 90000, '2인 식탁 세트', '식탁|테이블|table|2인+식탁|2인+테이블|dining+table'],
  ['table_4', '4인 식탁', 'table', 120, 75, 73, 60, 180000, '4인 식탁 세트', '4인+식탁|4인+테이블'],
  ['table_floor', '좌식 테이블', 'table', 90, 60, 35, 45, 40000, '좌식 테이블 접이식', '좌식+테이블|좌식+책상|좌탁|밥상|교자상|티+테이블|커피+테이블|coffee+table|low+table'],

  ['fridge', '냉장고', 'appliance', 60, 65, 170, 60, 450000, '소형 냉장고 2도어', '냉장고|fridge|refrigerator', 't'],
  ['fridge_mini', '미니 냉장고', 'appliance', 48, 50, 85, 50, 130000, '미니 냉장고', '미니+냉장고|소형+냉장고|작은+냉장고|mini+fridge'],
  ['washer', '세탁기', 'appliance', 60, 60, 85, 60, 500000, '드럼 세탁기 9kg', '세탁기|통돌이|드럼+세탁기|washer|washing+machine'],
  ['air_purifier', '공기청정기', 'appliance', 35, 35, 60, 20, 150000, '공기청정기', '공기청정기|공청기|air+purifier'],
  ['tv', '스탠드 TV', 'appliance', 100, 45, 130, 0, 400000, '43인치 스마트 TV 이동식 스탠드', 'tv|스탠드+tv|이동식+tv|television', 't'],

  ['rug', '러그', 'decor', 200, 140, 1, 0, 50000, '러그 140x200', '러그|카펫|카페트|rug|carpet', 'f'],
  ['floor_lamp', '스탠드 조명', 'decor', 30, 30, 150, 0, 40000, '장스탠드 조명', '스탠드+조명|스탠드+등|장스탠드|플로어+스탠드|플로어+램프|무드등|조명|floor+lamp|lamp'],
  ['plant', '화분', 'decor', 40, 40, 120, 0, 35000, '대형 화분 공기정화 식물', '화분|식물|반려식물|몬스테라|plant'],
  ['cat_tower', '캣타워', 'etc', 60, 60, 150, 30, 80000, '캣타워', '캣타워|캣폴|고양이+타워|cat+tower', 't'],
  ['drying_rack', '빨래건조대', 'etc', 120, 55, 100, 30, 25000, '접이식 빨래건조대', '건조대|빨래+건조대|빨랫대|빨래+걸이|drying+rack'],
  ['piano', '피아노', 'etc', 150, 60, 120, 60, 2500000, '업라이트 피아노', '피아노|piano|업라이트+피아노', 't'],
  ['piano_digital', '전자피아노', 'etc', 135, 40, 85, 60, 500000, '전자피아노 88건반', '전자+피아노|디지털+피아노|digital+piano'],
];

export const CATALOG = Object.fromEntries(ROWS.map(
  ([key, name, category, w, d, h, clear, price, query, aliases, flags = '', group]) => [key, {
    key, name, category, w, d, h, clear,
    tall: flags.includes('t'), sideOk: flags.includes('s'), floor: flags.includes('f'),
    price, color: CAT_COLOR[category], query, source: 'catalog',
    aliases: aliases ? aliases.split('|') : [], ...(group && { group }),
  }],
));

const ALIASES = Object.values(CATALOG).flatMap((c) => c.aliases.map((a) => {
  const parts = a.split('+');
  return { key: c.key, parts, score: parts.join('').length };
}));

// 침대 크기 낱말 → 폭. 긴 낱말을 먼저 본다('슈퍼싱글' 안의 '싱글', 'mattress' 안의 'ss' 때문).
const BED_SIZES = [
  ['슈퍼싱글', 110], ['supersingle', 110], ['싱글', 100], ['single', 100], ['더블', 140], ['double', 140],
  ['퀸', 150], ['queen', 150], ['킹', 160], ['king', 160], ['ss', 110],
];

const TYPOS = [
  [/쇼파|쏘파/g, '소파'], [/수퍼/g, '슈퍼'], [/씽글/g, '싱글'], [/[메매]트[리래]스/g, '매트리스'],
  [/티비|티브이|테레비|텔레비전/g, 'tv'], [/헹거|행어/g, '행거'], [/[캐케]비[넷닛]/g, '캐비닛'],
  [/렌지/g, '레인지'], [/테이불/g, '테이블'], [/침데/g, '침대'], [/카펱/g, '카펫'],
];

// 가구가 아닌 말끝·조사('침대요', '책상도 필요해요', '큰 거'). 아는 가구 뒤에 붙으면 무시하고, 이것만 있는 글은 가구로 치지 않는다.
// 긴 말이 앞에 오도록 적는다(정규식이 앞에서부터 맞춰 보기 때문).
const ENDINGS = [
  '필요해요', '필요해', '필요', '필수', '있어요', '있어', '있음', '포함', '주세요', '이에요', '예요', '입니다', '이요',
  '거', '것', '씩', '요', '도', '은', '는', '이', '가', '을', '를',
];
const RE_TAIL = new RegExp(`(?:${ENDINGS.join('|')})+$`); // 글 끝에 붙은 것만 뗀다('이불', '이젤'의 '이'는 건드리지 않게)

// 가구 종류를 바꾸지 않는 꾸밈말(색, 소재, 크기 느낌, 브랜드 등). 이것만 남으면 아는 가구로 본다.
const FILLER = new RegExp([
  ...ENDINGS,
  '화이트', '흰색', '하얀', '흰', '블랙', '검정', '검은', '그레이', '회색', '베이지', '브라운', '갈색', '아이보리', '크림',
  '네이비', '핑크', '민트', '그린', '블루', '우드', '원목', '오크', '월넛', '철제', '스틸', '메탈', '패브릭', '가죽', '라탄',
  '대리석', '유리', 'mdf', '대형', '중형', '소형', '미니', '큰', '작은', '넓은', '좁은', '긴', '짧은', '높은', '와이드', '슬림',
  '컴팩트', '접이식', '조립식', '이동식', '일반', '기본', '심플', '예쁜', '새', '중고', '세트', '프레임', '가구', '사이즈',
  '짜리', '하나', '용', '형', '만', '수납', '다용도', '원룸', '자취', '사무용', '컴퓨터', '게이밍', '공부', '학생', '거실',
  '침실', '주방', '안방', '베란다', '스마트', 'led', '이케아', 'ikea', '한샘', '일룸', '데스커', '리바트', '무인양품',
  'large', 'small', 'big', 'mini', 'white', 'black', 'wood', 'my', 'the',
].sort((a, b) => b.length - a.length).join('|') + '|\\d(?:인|단|칸|도어|문)', 'g');

// 비교용 글: 소문자, 한글·영문·숫자만 붙여 쓰고 흔한 오타를 고친다
function compact(text) {
  const s = String(text).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  return TYPOS.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

// 글 안에 들어 있는 별칭 중 가장 긴 것. 길이가 같으면 낱말 수가 많은 쪽('벙커+침대' > '슈퍼싱글': 크기 낱말이 이기면 침대가 하나 더 생긴다),
// 그것도 같으면 뒤쪽 낱말(우리말은 뒤가 중심 낱말)을 고른다.
function findBest(n) {
  let best = null;
  for (const a of ALIASES) {
    let end = 0;
    const ok = a.parts.every((p) => {
      const i = n.indexOf(p);
      end = Math.max(end, i + p.length);
      return i >= 0;
    });
    const tie = best && a.score === best.score && (a.parts.length - best.parts.length || end - best.end);
    if (ok && (!best || a.score > best.score || tie > 0)) best = { ...a, end };
  }
  return best;
}

// 가구 하나의 이름(붙여 쓴 글) → 카탈로그 항목. 꾸밈말 말고 모르는 글이 남으면 known: false
function matchCatalog(n) {
  // '침대 매트리스', '침대(매트리스 포함)'은 침대다. 더 긴 낱말인 '매트리스'가 이겨서 저상 매트리스가 되지 않게 뺀다.
  if (/침대|베드|bed/.test(n) && !/저상|토퍼|소파/.test(n)) n = n.replace(/매트리스|mattress/, '');
  const best = findBest(n);
  if (!best) return null;
  const cat = CATALOG[best.key];
  // 같은 가구를 가리키는 다른 낱말도 함께 지운다('통돌이 세탁기'). 남겨 두면 낱말마다 한 개씩으로 세어 개수와 가격이 두 배가 된다.
  // 낱말끼리 겹칠 수 있어서('장스탠드'와 '스탠드+조명') 글자 자리로 표시한다. 처음 나온 자리만 지워서 '책상 책상'은 두 개로 남는다.
  const used = new Set();
  for (const a of ALIASES) {
    if (a.key !== best.key || !a.parts.every((p) => n.includes(p))) continue;
    for (const p of a.parts) for (let k = 0, at = n.indexOf(p); k < p.length; k++) used.add(at + k);
  }
  let rest = [...n].filter((_, i) => !used.has(i)).join('');
  let sizeW;
  if (cat.category === 'bed') {
    const hit = BED_SIZES.find(([word]) => n.includes(word));
    if (hit) {
      sizeW = hit[1];
      rest = rest.replace(hit[0], '');
    }
    // '매트리스 침대', '벙커 베드'의 남은 '침대'. 일반 침대는 위에서 이미 지웠으니 또 지우면 '침대 침대'가 한 개가 된다.
    if (cat.key !== 'bed_ss') rest = rest.replace(/침대|베드|bed/, '');
  }
  rest = rest.replace(FILLER, '');
  // 이름에 붙여 쓴 한 자리 숫자는 개수다('침대1', '의자:2')
  const count = /^[1-9]$/.test(rest) ? Number(rest) : 0;
  return { cat, sizeW, known: rest === '' || count > 0, count };
}

const UNIT = '(mm|cm|m|센치|센티|미터)?(?![a-wyz])'; // 단위 뒤에 다른 영문자가 붙으면 단위가 아니다 (x는 곱하기 표시라 허용)
// 한 자리 숫자는 뒤에 m·미터가 올 때만 크기로 본다('책상 2m', '러그 2x3m'). 그냥 한 자리 숫자는 개수일 수 있다.
const NUM = '(\\d{2,4}(?:\\.\\d+)?|\\d\\.\\d+|\\d(?=\\s*(?:x\\s*\\d(?:\\.\\d+)?\\s*)?(?:m(?![a-wyz])|미터)))';
const RE_NOISE = /\d+(?:\.\d+)?\s*(?:인치|inch|kg|리터|평)/gi;
const RE_BOX = new RegExp(`${NUM}\\s*${UNIT}\\s*x\\s*${NUM}\\s*${UNIT}(?:\\s*x\\s*${NUM}\\s*${UNIT})?`, 'i');
const RE_LABEL = new RegExp(`(높이|깊이|세로|폭|가로|너비|길이)\\s*${NUM}\\s*${UNIT}`, 'gi');
const RE_COUNT = /(?<![\d.])(\d{1,2})\s*(?:개|대|점|ea|pcs|세트|쌍)|(?<![a-z])x\s*(\d{1,2})(?![\d.])|(한|두|세|네|다섯)\s*(?:개|대)|\s(\d)\s*$/i;
const RE_SIZE = new RegExp(`(?<![\\d.])${NUM}\\s*${UNIT}(?![\\d인단칸층도문])`, 'gi');
const KO_NUM = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5 };
const LABEL = { 높이: 'h', 깊이: 'd', 세로: 'd', 폭: 'w', 가로: 'w', 너비: 'w', 길이: 'w' };

// 숫자를 cm로. 단위가 없으면 크기로 짐작한다: 10 미만은 m, 400 초과는 mm (가구 폭은 400cm를 넘지 않으니까)
function toCm(v, unit, ref = v) {
  const n = Number(v);
  const u = unit ? unit.toLowerCase() : ref < 10 ? 'm' : ref > 400 ? 'mm' : 'cm';
  return Math.round(u === 'mm' ? n / 10 : u === 'm' || u === '미터' ? n * 100 : n);
}

// 가구 한 개를 적은 글에서 크기·개수를 떼어 내고 이름만 남긴다
function readOne(raw) {
  const hint = {};
  let count = 1;
  let s = raw.normalize('NFKC').replace(/[×✕*]/g, 'x').replace(RE_NOISE, ' ');
  s = s.replace(RE_BOX, (_, a, ua, b, ub, c, uc) => {
    const ref = ua || ub || uc ? undefined : Math.max(a, b);
    const u = ua || ub || uc;
    hint.w = toCm(a, ua || u, ref);
    hint.d = toCm(b, ub || u, ref);
    if (c) hint.h = toCm(c, uc || u, ref);
    return ' ';
  });
  s = s.replace(RE_LABEL, (_, label, v, u) => {
    hint[LABEL[label]] = toCm(v, u);
    return ' ';
  });
  s = s.replace(RE_COUNT, (_, a, b, ko, c) => {
    count = clamp(Number(a || b || c) || KO_NUM[ko] || 1, 1, 15);
    return ' ';
  });
  s = s.replace(RE_SIZE, (_, v, u) => {
    hint.w ??= toCm(v, u);
    return ' ';
  });
  const name = cleanName(s.replace(/[^\p{L}\p{N}\s&.-]/gu, ' ').replace(/^[\s.&-]+|[\s.&-]+$/g, ''));
  return { name, n: compact(name), hint, count };
}

// 읽어 낸 이름·크기 → 사양. 카탈로그로 확실히 알 수 없으면 null
function toSpec(one) {
  const m = one.n && matchCatalog(one.n);
  if (!m || !m.known) return null;
  if (m.count && one.count === 1) one.count = m.count; // 붙여 쓴 개수는 이름을 알아본 뒤에야 알 수 있어서 여기서 채운다
  let { cat } = m;
  let { hint } = one;
  // 침대에서 190 이상인 숫자는 폭이 아니라 길이다('침대 2m', '침대 2000x1100'). 폭으로 읽으면 킹보다 큰 침대가 된다.
  if (cat.category === 'bed' && hint.w >= 190 && !(hint.d >= hint.w)) {
    const { w: len, d: wid, ...others } = hint;
    hint = { ...others, d: len, ...(wid && { w: wid }) };
  }
  const w = (hint.w ?? m.sizeW) && clamp(hint.w ?? m.sizeW, 10, 400);
  if (w && cat.group) {
    // 같은 묶음(책상·옷장·침대)에서는 입력한 폭에 가장 가까운 제품으로 바꾼다
    cat = Object.values(CATALOG).filter((c) => c.group === cat.group)
      .reduce((a, b) => (Math.abs(b.w - w) < Math.abs(a.w - w) ? b : a));
  }
  const spec = { ...cat, ...hint };
  if (w && w !== cat.w) {
    spec.w = w;
    const mm = [String(cat.w * 10), String(w * 10)]; // '책상 1200' → '책상 1300'
    spec.name = cat.name.replace(...mm);
    spec.query = cat.query.replace(...mm);
    spec.price = Math.round((cat.price * clamp(w / cat.w, 0.5, 2)) / 1000) * 1000;
  }
  return validateSpec(spec);
}

const MAX_ITEMS = 15;
// 가구 글에 섞인 가격('30만원', '300,000원대')은 크기도 개수도 아니다. 쉼표가 들어 있어서 나누기 전에 지운다. '원목·원형'은 건드리지 않는다.
const RE_PRICE = /\d[\d,.]*\s*(?:(?:만|천)\s*원?|원(?![목형룸단통]))(?:대|짜리|정도|이하|이내)?/g;
const RE_THOUSANDS = /(\d),(?=\d{3}(?!\d))/g; // '책상 1,400'의 쉼표는 가구를 나누는 쉼표가 아니다
// 붙여 넣은 목록의 번호('1.', '2)')와 줄 앞 글머리표('*', '-'). '1.2m' 같은 소수는 건드리지 않는다.
const RE_NUMBERING = /(?:^|(?<=\s))\d{1,2}[.)](?!\d)\s*(?=\S)/gm;
const RE_BULLET = /^\s*[*•·-]+\s*/gm;
const SPLIT = /[,，、;\n\r/+·]+|\s+(?:and|그리고|및)\s+|(?<=[가-힣a-z0-9])\s*(?:이랑|하고|랑|와|과)\s+/i;

// "슈퍼싱글 침대, 책상 1400, 옷장 2개, 전자피아노" → { specs, unknown }
// 한 번에 15개까지. 넘치면 truncated: true (규약에 없는 덧붙임 값)
export function parseFurnitureText(text) {
  const out = []; // { spec } 또는 { unknown }
  const add = (entry, count) => {
    for (let i = 0; i < count; i++) out.push(entry.spec ? { spec: { ...entry.spec } } : entry);
  };
  const src = String(text ?? '').slice(0, 600)
    .replace(RE_PRICE, ' ').replace(RE_THOUSANDS, '$1').replace(RE_BULLET, '').replace(RE_NUMBERING, '');
  for (const chunk of src.split(SPLIT)) {
    const tokens = (chunk || '').trim().split(/\s+/).filter(Boolean).slice(0, 12);
    // 쉼표 없이 띄어쓰기만으로 나열한 경우("침대 책상 옷장")를 위해, 앞에서부터 아는 가구가 되는 가장 긴 묶음을 찾는다
    for (let i = 0; i < tokens.length;) {
      let j = tokens.length;
      let one;
      let spec = null;
      for (; j > i; j--) {
        one = readOne(tokens.slice(i, j).join(' '));
        spec = toSpec(one);
        if (spec) break;
      }
      if (spec) {
        add({ spec }, one.count);
        i = j;
      } else {
        // shortcut: 모르는 가구는 남은 글 전체를 이름 하나로 보고 크기 숫자는 버린다. 모르는 가구에도 크기를 살리려면 unknown을 객체로 바꿔야 한다.
        one = readOne(tokens.slice(i).join(' '));
        // 숫자와 끝의 말끝을 빼고 두 글자도 안 남으면('거', '필요', '1', '큰 거') 가구 이름이 아니다. 방에 정체 모를 상자가 생기지 않게 버린다.
        const letters = one.n.replace(/\d/g, '').replace(RE_TAIL, '');
        if (one.name && letters.length >= 2) add({ unknown: one.name }, one.count);
        break;
      }
    }
  }
  const kept = out.slice(0, MAX_ITEMS);
  const specs = kept.filter((e) => e.spec).map((e) => e.spec);
  // 같은 가구가 여러 개면 이름에 번호를 붙여 구분한다
  const seen = {};
  for (const s of specs) {
    seen[s.name] = (seen[s.name] || 0) + 1;
    if (seen[s.name] > 1) s.name = `${s.name} (${seen[s.name]})`;
  }
  return { specs, unknown: kept.filter((e) => e.unknown).map((e) => e.unknown), truncated: out.length > MAX_ITEMS };
}

// 모르는 가구의 임시 사양. 이름에 아는 낱말이 들어 있으면(예: '안마의자' → 의자) 그 크기를 빌린다.
export function defaultSpec(name) {
  const nm = cleanName(name) || '가구';
  const hit = findBest(compact(nm));
  const base = hit ? CATALOG[hit.key]
    : { category: 'etc', w: 80, d: 50, h: 80, clear: 40, tall: false, sideOk: false, floor: false, price: 100000 };
  return validateSpec({ ...base, key: `custom:${nm}`, name: nm, color: CAT_COLOR[base.category], query: nm, source: 'default' });
}

// 사양 검증: 규약 3절의 값만 남기고 범위를 맞춘다. 이름이나 치수가 없으면 null.
export function validateSpec(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const name = cleanName(obj.name);
  const [w, d, h] = [num(obj.w), num(obj.d), num(obj.h)];
  if (!name || !(w > 0) || !(d > 0) || !(h > 0)) return null;
  const category = CATEGORIES.includes(obj.category) ? obj.category : 'etc';
  const height = Math.round(clamp(h, 1, 300));
  return {
    key: typeof obj.key === 'string' && Object.hasOwn(CATALOG, obj.key) ? obj.key : `custom:${name}`,
    name,
    category,
    w: Math.round(clamp(w, 10, 400)),
    d: Math.round(clamp(d, 10, 400)),
    h: height,
    clear: Math.round(clamp(num(obj.clear) || 0, 0, 150)),
    tall: typeof obj.tall === 'boolean' ? obj.tall : height >= 120,
    sideOk: obj.sideOk === true,
    floor: obj.floor === true,
    price: Math.round(clamp(num(obj.price) || 0, 0, 50_000_000)),
    color: typeof obj.color === 'string' && HEX.test(obj.color) ? obj.color.toLowerCase() : CAT_COLOR[category],
    query: cleanName(obj.query, 40) || name,
    source: ['catalog', 'ai', 'default'].includes(obj.source) ? obj.source : 'ai',
  };
}

// ───────── 스타일 ─────────
const ROLES = ['벽', '바닥', '메인 가구', '패브릭', '포인트'];

// [key, 이름, 가격 배수, 5색(벽·바닥·메인 가구·패브릭·포인트), 마감재, 분위기, 소품 5개]
const STYLE_ROWS = [
  ['minimal', '미니멀', 1.0,
    [['웜 화이트', '#f5f2ed'], ['라이트 애쉬 마루', '#d8d1c6'], ['화이트 오크', '#c4ad8c'], ['오트밀', '#e7ded0'], ['차콜', '#3a3a3c']],
    '무광 화이트 도장, 밝은 오크, 면·린넨', '물건을 줄이고 여백을 살려서 방이 넓어 보여요.',
    [['린넨 침구 세트', 59000, '린넨 침구 세트 슈퍼싱글'], ['화이트 무드등', 29000, '화이트 무드등'], ['단색 러그', 45000, '단색 러그 아이보리'],
      ['패브릭 수납 바구니 2개', 25000, '패브릭 수납 바구니'], ['블랙 프레임 포스터', 19000, '블랙 프레임 포스터 액자']]],
  ['natural', '내추럴', 1.1,
    [['아이보리', '#f4eee1'], ['내추럴 오크 마루', '#cdae84'], ['원목 우드', '#a17a50'], ['베이지 린넨', '#e1d4bc'], ['올리브 그린', '#5f7045']],
    '원목, 라탄, 린넨, 테라코타 화분', '나무와 식물로 포근하고 편안한 느낌을 줘요.',
    [['라탄 바구니', 32000, '라탄 수납 바구니'], ['몬스테라 화분', 39000, '몬스테라 화분 중형'], ['코튼 침구 세트', 69000, '코튼 침구 세트 베이지'],
      ['우드 장스탠드', 59000, '우드 장스탠드 조명'], ['면 러그', 55000, '면 러그 베이지']]],
  ['modern', '모던', 1.2,
    [['쿨 화이트', '#ecedee'], ['그레이 포슬린 타일', '#a9abae'], ['블랙 월넛', '#43362d'], ['라이트 그레이 울', '#c5c7c9'], ['브라스 골드', '#c2a05a']],
    '블랙 스틸, 월넛 무늬목, 유리, 무광 금속', '무채색과 곧은 선으로 깔끔하고 도시적인 분위기예요.',
    [['블랙 아치 스탠드', 79000, '블랙 아치 장스탠드'], ['그레이 침구 세트', 65000, '그레이 침구 세트'], ['원형 벽거울', 45000, '원형 벽거울 골드'],
      ['추상화 액자', 35000, '추상화 인테리어 액자'], ['그레이 단모 러그', 69000, '그레이 단모 러그']]],
  ['vintage', '빈티지', 1.05,
    [['크림', '#efe4cb'], ['체리 마루', '#a06c4a'], ['티크 우드', '#6a4229'], ['머스타드', '#c9a444'], ['보틀 그린', '#2f5d50']],
    '짙은 원목, 황동 손잡이, 패턴 패브릭, 가죽', '오래 쓴 듯한 나무와 따뜻한 색으로 아늑해요.',
    [['빈티지 패턴 러그', 59000, '빈티지 패턴 러그'], ['황동 테이블 조명', 49000, '황동 테이블 스탠드'], ['체크 침구 세트', 62000, '체크 침구 세트'],
      ['빈티지 액자 3종', 33000, '빈티지 포스터 액자 세트'], ['레트로 블루투스 스피커', 39000, '레트로 블루투스 스피커']]],
  ['nordic', '북유럽', 1.15,
    [['스노우 화이트', '#f6f6f2'], ['화이트 워시 마루', '#e2d6c1'], ['버치 우드', '#bf9f74'], ['미스트 블루', '#9fbcd9'], ['살구 코랄', '#e8a77c']],
    '자작나무·애쉬 원목, 울·면 패브릭, 무광 화이트', '흰 벽과 밝은 나무에 차분한 색을 한두 가지 더해요.',
    [['기하학 패턴 러그', 59000, '북유럽 패턴 러그'], ['버섯 무드등', 35000, '버섯 무드등'], ['니트 블랭킷', 29000, '니트 블랭킷 담요'],
      ['패브릭 포스터', 15000, '북유럽 패브릭 포스터'], ['원목 벽선반', 25000, '원목 벽선반']]],
  ['japandi', '재팬디', 1.2,
    [['샌드 베이지', '#ebe4d6'], ['웜 오크 마루', '#bd9f78'], ['스모크 월넛', '#5a4535'], ['그레이지 린넨', '#cdc4b3'], ['말차 그린', '#7c8b68']],
    '짙은 원목, 종이 조명, 린넨, 도자기', '낮은 가구와 차분한 색으로 고요하게 쉬는 방이에요.',
    [['페이퍼 랜턴 조명', 39000, '페이퍼 랜턴 조명'], ['린넨 침구 세트', 79000, '린넨 침구 세트 그레이지'], ['도자기 화병', 25000, '도자기 화병'],
      ['라탄 방석', 22000, '라탄 방석'], ['우드 블라인드', 45000, '우드 블라인드']]],
  ['midcentury', '미드센추리 모던', 1.25,
    [['웜 화이트', '#f2ecdf'], ['허니 오크 마루', '#c79d68'], ['월넛', '#69422a'], ['틸 그린', '#3f7d78'], ['번트 오렌지', '#cc5a2e']],
    '월넛·티크 무늬목, 크롬, 컬러 유리, 벨벳', '짙은 나무에 선명한 색 하나로 개성 있고 경쾌해요.',
    [['버섯 램프', 49000, '미드센추리 버섯 램프'], ['선버스트 벽시계', 39000, '선버스트 벽시계'], ['컬러 유리 화병', 23000, '컬러 유리 화병'],
      ['바우하우스 포스터', 25000, '바우하우스 포스터 액자'], ['기하학 패턴 쿠션', 19000, '기하학 패턴 쿠션']]],
  ['industrial', '인더스트리얼', 1.1,
    [['콘크리트 그레이', '#d0cdc8'], ['다크 콘크리트', '#86837e'], ['블랙 스틸', '#343231'], ['브라운 가죽', '#8b6748'], ['러스트 오렌지', '#a9512f']],
    '블랙 철제, 거친 고재, 노출 콘크리트, 가죽', '철제와 거친 나무로 작업실 같은 멋을 내요.',
    [['에디슨 전구 조명', 35000, '에디슨 전구 펜던트 조명'], ['철제 벽선반', 29000, '철제 벽선반'], ['가죽 쿠션', 25000, '가죽 쿠션'],
      ['철제 와이어 바구니', 18000, '철제 와이어 바구니'], ['흑백 타이포 포스터', 15000, '흑백 타이포 포스터']]],
  ['whitewood', '화이트&우드', 0.95,
    [['퓨어 화이트', '#fafaf6'], ['메이플 마루', '#e2cfae'], ['내추럴 우드', '#c39c6c'], ['화이트 코튼', '#efece4'], ['리프 그린', '#6c9469']],
    '화이트 도장, 밝은 원목, 코튼', '흰색과 밝은 나무 두 가지만 써서 환하고 깨끗해요.',
    [['화이트 코튼 침구', 49000, '화이트 코튼 침구 세트'], ['우드 탁상 조명', 29000, '우드 탁상 스탠드'], ['화이트 암막 커튼', 35000, '화이트 암막 커튼'],
      ['우드 벽시계', 19000, '우드 벽시계'], ['미니 화분 3종', 15000, '미니 화분 세트']]],
  ['hotel', '호텔식 럭셔리', 1.4,
    [['그레이지', '#e7e1d7'], ['토프 카펫', '#b5a899'], ['다크 월넛', '#49372c'], ['화이트 호텔 침구', '#f7f4ee'], ['샴페인 골드', '#c4a366']],
    '짙은 무늬목, 벨벳, 대리석 무늬, 금속 장식', '흰 침구와 은은한 조명으로 호텔 방처럼 정돈돼요.',
    [['호텔식 침구 세트', 99000, '호텔 침구 세트 화이트'], ['골드 단스탠드', 59000, '골드 단스탠드 조명'], ['벨벳 쿠션 2개', 29000, '벨벳 쿠션'],
      ['암막 커튼', 49000, '호텔식 암막 커튼'], ['디퓨저', 25000, '디퓨저']]],
  ['pastel', '러블리 파스텔', 1.05,
    [['크림 화이트', '#fbf6f0'], ['화이트 워시 마루', '#ebe1d2'], ['버터 우드', '#ccab82'], ['베이비 핑크', '#f2c6cd'], ['라벤더', '#a996d3']],
    '화이트·밝은 원목, 부드러운 면, 폭신한 러그', '부드러운 파스텔 색으로 사랑스럽고 화사해요.',
    [['파스텔 침구 세트', 55000, '파스텔 침구 세트'], ['튤립 무드등', 22000, '튤립 무드등'], ['원형 퍼 러그', 35000, '원형 퍼 러그'],
      ['웨이브 거울', 39000, '웨이브 거울'], ['캔들 워머', 29000, '캔들 워머']]],
  ['dark', '다크 모던', 1.3,
    [['차콜', '#45484d'], ['애쉬 그레이 마루', '#8d857a'], ['매트 블랙', '#232326'], ['스톤 그레이', '#adadaa'], ['코냑', '#c0803f']],
    '무광 블랙, 짙은 무늬목, 가죽, 간접 조명', '어두운 바탕에 조명을 더해 깊이 있고 차분해요.',
    [['간접 조명 LED 바', 25000, 'LED 바 간접 조명'], ['블랙 장스탠드', 69000, '블랙 장스탠드 조명'], ['다크 그레이 침구', 65000, '다크 그레이 침구 세트'],
      ['가죽 쿠션', 25000, '가죽 쿠션 브라운'], ['블랙 프레임 액자', 19000, '블랙 프레임 액자']]],
];

export const STYLE_PRESETS = Object.fromEntries(STYLE_ROWS.map(([key, name, priceRate, colors, materials, mood, props]) => [key, {
  key, name, priceRate,
  palette: colors.map(([cname, hex], i) => ({ role: ROLES[i], name: cname, hex })),
  materials, mood,
  props: props.map(([pname, price, query]) => ({ name: pname, price, query })),
  source: 'preset',
}]));

// 스타일 낱말. names: 이 낱말만 쓰면 그 프리셋으로 본다. hints: 글 안에 있으면 가장 가까운 프리셋을 고를 때만 쓴다.
const STYLE_WORDS = {
  minimal: { names: '미니멀|미니멀리즘|미니멀리스트|minimal|minimalist|minimalism|심플', hints: '깔끔|단순|여백' },
  natural: { names: '내추럴|네추럴|natural|우드톤|자연주의|플랜테리어', hints: '자연|식물|라탄|원목|포근|따뜻|코지|감성|카페' },
  modern: { names: '모던|modern|모던시크|시크', hints: '도시|세련|무채색|그레이' },
  vintage: { names: '빈티지|vintage|레트로|retro|앤틱|앤티크|antique', hints: '클래식|복고|옛날' },
  nordic: { names: '북유럽|노르딕|nordic|스칸디|스칸디나비아|스칸디나비안|scandinavian|scandi', hints: '이케아|ikea' },
  japandi: { names: '재팬디|자팬디|japandi|젠|zen|일본식|와비사비|wabisabi', hints: '일본|무인양품|차분|고요' },
  midcentury: { names: '미드센추리|미드센츄리|미드센추리모던|미드센츄리모던|midcentury|midcenturymodern|mcm', hints: '바우하우스|임스' },
  industrial: { names: '인더스트리얼|industrial|인더스트리얼로프트|로프트|loft', hints: '철제|콘크리트|공장|작업실' },
  whitewood: { names: '화이트우드|화이트앤우드|우드앤화이트|우드화이트|whitewood|whiteandwood', hints: '화이트|우드|흰색|하얀|깨끗' },
  hotel: { names: '호텔식|호텔|럭셔리|호텔식럭셔리|호텔럭셔리|hotel|luxury', hints: '고급|우아|대리석|골드' },
  pastel: { names: '러블리|파스텔|러블리파스텔|lovely|pastel', hints: '핑크|사랑스|귀여운|아기자기|화사|공주' },
  dark: { names: '다크모던|다크|dark|darkmodern|올블랙', hints: '어두운|블랙|검정|검은' },
};
const STYLE_FILLER = /스타일|인테리어|느낌|분위기|감성|컨셉|콘셉트|무드|톤|style|interior/g;

// 직접 입력한 글이 프리셋 이름(또는 같은 뜻의 말)이면 그 프리셋. 다른 말이 섞여 있으면 null → AI에게 묻는다.
export function matchStyle(text) {
  const n = compact(text);
  const bare = n.replace(STYLE_FILLER, '').replace(/(풍|식|한|의)$/, ''); // '북유럽풍 인테리어', '미니멀한 느낌'
  for (const [key, w] of Object.entries(STYLE_WORDS)) {
    const names = w.names.split('|');
    if (names.includes(n) || names.includes(bare)) return STYLE_PRESETS[key];
  }
  return null;
}

// 글에 가장 가까운 프리셋(AI가 안 될 때 대신 쓴다). 맞는 낱말이 없으면 미니멀.
export function nearestStyle(text) {
  const n = compact(text);
  let best = ['minimal', 0];
  for (const [key, w] of Object.entries(STYLE_WORDS)) {
    const score = `${w.names}|${w.hints}`.split('|').reduce((sum, word) => sum + (n.includes(word) ? word.length : 0), 0);
    if (score > best[1]) best = [key, score];
  }
  return STYLE_PRESETS[best[0]];
}

// 스타일 검증: 규약 4절의 값만 남긴다. 색이 정확히 5개가 아니거나 hex가 틀리면, 소품이 3개 미만이면 null.
export function validateStyle(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const name = cleanName(obj.name);
  if (!name || !Array.isArray(obj.palette) || obj.palette.length !== 5 || !Array.isArray(obj.props)) return null;
  if (!obj.palette.every((p) => p && typeof p.hex === 'string' && HEX.test(p.hex))) return null;
  const props = obj.props
    .map((p) => ({ name: cleanName(p?.name), price: Math.round(clamp(num(p?.price) || 0, 0, 5_000_000)), query: cleanName(p?.query, 40) }))
    .filter((p) => p.name)
    .map((p) => ({ ...p, query: p.query || p.name }))
    .slice(0, 6);
  if (props.length < 3) return null;
  return {
    key: typeof obj.key === 'string' && Object.hasOwn(STYLE_PRESETS, obj.key) ? obj.key : `custom:${name}`,
    name,
    priceRate: Math.round(clamp(num(obj.priceRate) || 1, 0.8, 1.5) * 100) / 100,
    palette: obj.palette.map((p, i) => ({ role: ROLES[i], name: cleanName(p.name, 20) || ROLES[i], hex: p.hex.toLowerCase() })),
    materials: cleanName(obj.materials, 80),
    mood: cleanName(obj.mood, 80),
    props,
    source: obj.source === 'preset' ? 'preset' : 'ai',
  };
}

// ───────── 가격·글 도구 ─────────
// 스타일 배수를 곱해 천원 단위로 반올림한 예상 가격
export const priceOf = (spec, style) => Math.round(((spec?.price || 0) * (style?.priceRate || 1)) / 1000) * 1000;

export const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

// 받침에 맞는 조사: josa('책상', '을/를') → '책상을'. 숫자로 끝나는 이름('책상 1200')도 읽는 소리대로 맞춘다.
export function josa(word, pair) {
  const [withB, withoutB] = pair.split('/');
  const last = String(word).replace(/[^0-9a-zA-Z가-힣]+$/, '').slice(-1);
  const c = last.charCodeAt(0);
  let jong = -1; // 0 = 받침 없음, 8 = ㄹ
  if (c >= 0xac00 && c <= 0xd7a3) jong = (c - 0xac00) % 28;
  else if (/\d/.test(last)) jong = { 0: 21, 1: 8, 3: 16, 6: 1, 7: 8, 8: 8 }[last] ?? 0;
  const has = jong > 0 && !(withB === '으로' && jong === 8); // 'ㄹ' 뒤에는 '으로'가 아니라 '로'
  return word + (has ? withB : withoutB);
}

// 시연용 예시: 가로로 긴 4m × 3m 원룸, 북유럽 스타일, 예산 120만원 (평면도가 무대에 크게 나오는 비율)
export const EXAMPLE = {
  room: {
    width: 400, depth: 300, height: 240,
    doors: [{ wall: 'bottom', offset: 40, size: 90, kind: 'entry' }],
    windows: [{ wall: 'top', offset: 110, size: 140, sill: 90, height: 120 }],
  },
  styleKey: 'nordic',
  budget: 1200000,
  furnitureText: '슈퍼싱글 침대, 책상 1200, 옷장, 책장, 러그',
};
