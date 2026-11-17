# 02. 인체 치수와 여유 공간 (배치 엔진용 조사)

조사일: 2026-11-17 · 단위는 모두 cm · 담당: 배치 엔진(조사)

## 읽는 법

- **강제** = 어기면 가구를 실제로 쓸 수 없는 것(문이 안 열림, 의자를 못 뺌). 엔진에서는 `error` 또는 강한 `warn` 후보.
- **권장** = 어겨도 쓸 수는 있지만 불편한 것. 엔진에서는 `warn` 또는 점수 감점 후보.
- **신뢰도**
  - **높음**: 원문을 직접 열어 수치를 확인한 1차 자료(법령 별표, 기준 문서, 제조사 공식 안내).
  - **중간**: 원문을 직접 열어 확인했지만 2차 자료(책의 수치를 옮겨 적은 교육 자료, 치수 사이트, 전문 매체).
  - **낮음**: 검색 결과 발췌로만 본 수치(블로그·쇼핑몰 글). 원문 전체는 확인하지 못함.
- 여기 수치는 모두 **설계 참고값**이에요. 법적·안전 기준이 아니에요(규약 CONTRACT.md의 "통로 60cm는 참고값"과 같은 입장).
  유일한 법령 출처(편의증진법 시행규칙 별표 1)는 **공공시설·휠체어 사용자용 기준**이라 원룸에 그대로 적용되지 않아요. "넉넉한 쪽 끝값"으로만 써요.

## 한눈에 보는 표

| # | 대상 | 최소 | 권장 | 구분 |
|---|---|---|---|---|
| R1 | 한 사람 통로 | 60 | 76~90 | 강제(60) / 권장 |
| R2 | 문에서 창까지 주 동선 | 75 | 90 | 권장 |
| R3 | 가구와 가구 사이 지나가는 틈 | 60 | 61~90 | 권장 |
| R4 | 두 사람이 엇갈리는 통로 | 110 | 120 | 참고(원룸에는 과함) |
| R5 | 휠체어 통로 / 회전 | 120 / 140×140 | 150×150 | 참고(배리어프리 옵션) |
| R6 | 침대 옆(드나드는 쪽) | 50~60 | 70~90 | 권장 |
| R7 | 침대 발치(지나가야 할 때) | 50~55 | 75~90 | 권장 |
| R8 | 싱글 침대 한쪽 벽 붙이기 | 허용 | — | 허용 규칙 |
| R9 | 침대 옆(휠체어) | 120 | — | 참고(배리어프리 옵션) |
| R10 | 책상 의자 빼는 공간(책상 앞 끝에서) | 60~76 | 90 | 강제(60) / 권장 |
| R11 | 앉은 사람 뒤로 지나가기(책상) | 90 | 105~120 | 권장 |
| R12 | 여닫이 옷장 앞 | 문짝 폭(45~50) + 설 자리 = 76 | 90~105 | 강제(문짝 폭) / 권장 |
| R13 | 슬라이딩 옷장 앞 | 50 | 76 | 권장 |
| R14 | 서랍장 앞 | 서랍 41~51 + 몸 46 ≈ 87~97 | 90~100 | 강제(서랍 깊이) / 권장 |
| R15 | 옷장 앞면 ~ 침대 | 60~70 | 90 | 권장 |
| R16 | 옷장 깊이(가구 자체) | 60 | 60~65 | 치수 검증용 |
| R17 | 소파 ~ 소파 테이블 | 35~40 | 38~46 | 권장(너무 멀어도 감점) |
| R18 | 소파 ~ 테이블 사이가 통로일 때 | 60 | 76 | 권장 |
| R19 | TV 시청 거리 | 화면 대각선(cm) × 1.2 | × 1.2 ~ 1.6 | 권장 |
| R20 | TV 시청 거리 상한 | — | × 2.5 이하 | 권장 |
| R21 | 식탁 의자 빼고 앉기(식탁 끝에서) | 75~80 | 90 | 강제(75) / 권장 |
| R22 | 앉은 사람 뒤 옆걸음 / 걸어가기 | 60 / 110 | 120 | 권장 |
| R23 | 식탁 1인 자리 폭 | 60 | — | 치수 검증용 |
| R24 | 방문 여는 공간(문 폭 × 문 폭) | 완전히 비움 | + 문 앞 60 | 강제 |
| R25 | 문 손잡이 쪽 옆 공간 / 문 앞 깊이(휠체어) | 60 / 120 | — | 참고(배리어프리 옵션) |
| R26 | 문 통과 폭 | 80 | 90 | 입력 검증용 |

## 규칙 상세

### A. 통로와 동선

**R1. 사람이 지나다니는 길은 폭 60cm 이상이어야 해요.**
- 수치: 최소 60 / 편한 폭 76~90
- 구분: 60 미만은 강제(통로 끊김), 60~75는 권장 미달
- 근거:
  - 교육 자료가 Neufert·Panero & Zelnik 수치로 정리: 한 줄 통행 약 60, 편한 보행 약 76~90 — https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
  - Houzz: 동선 폭 77~91 — https://www.houzz.com.sg/ideabooks/109239110
  - 검색 발췌: "한 사람 60cm 최소, 90cm 이상적" — https://home.lazada.sg/how-to-choose-wardrobe-dimensions-for-an-hdb-bedroom-without-blocking-walkways-sg/
- 신뢰도: 중간 (60이라는 값은 여러 자료가 일치. 다만 Neufert·Panero 원서는 직접 보지 못함)
- 엔진: `AISLE_CM = 60` 유지. 점수는 60 → 76 → 90 세 단계로 주면 좋아요.

**R2. 문에서 창문까지 가는 주 동선은 75cm 이상이 좋아요.**
- 수치: 최소 75 / 권장 90
- 구분: 권장
- 근거:
  - Lifetime Homes 기준 7(영국 주택 접근성 기준, 필수 항목): 방을 오가거나 창에 가는 데 꼭 필요한 가구 사이 통로 75 — https://cae.org.uk/our-services/housing-services/lifetime-homes/7-circulation-space/
  - Rayon 침실 가이드: 침실 동선 최소 75 — https://www.rayon.design/knowledge-base/housing/bedroom/rules
- 신뢰도: 높음(Lifetime Homes 원문 확인. 단 영국 기준)
- 엔진: 현관문 → 창문, 현관문 → 침대 경로의 가장 좁은 곳을 재서 75 미만이면 감점.

**R3. 가구와 가구 사이로 지나가려면 60cm쯤 띄워요.**
- 수치: 61 (Houzz) / 편하게는 76~90
- 구분: 권장
- 근거: https://www.houzz.com.sg/ideabooks/109239110
- 신뢰도: 중간
- 엔진: 두 가구 사이 틈이 1~59cm면 "애매하게 좁은 틈"으로 경고(아예 붙이거나 60 이상 띄우기).
  틈이 0(붙임)인 것은 문제없어요. 이 "죽은 틈" 판정 자체는 출처에 없는 엔진 쪽 해석이에요.

**R4. 두 사람이 엇갈려 지나가려면 110~120cm가 필요해요.**
- 수치: 110~120
- 구분: 참고(원룸에는 적용하지 않음)
- 근거: https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
- 신뢰도: 중간

**R5. 휠체어를 쓰면 통로 120cm, 회전 공간 140×140 ~ 150×150cm가 필요해요.**
- 수치: 통로 유효폭 120 이상 / 활동 공간 140×140 이상(승강기 앞 등), 150×150 이상(경사로 참 등) / 지름 150 원
- 구분: 참고(배리어프리 옵션을 만들 때만)
- 근거:
  - 「장애인ㆍ노인ㆍ임산부 등의 편의증진 보장에 관한 법률 시행규칙」 별표 1 제7호(복도 유효폭 1.2m), 제9호·제12호(활동 공간) — https://www.law.go.kr/법령/장애인ㆍ노인ㆍ임산부등의편의증진보장에관한법률시행규칙
    (본문은 법제처 법령 조회 도구로 별표 1 전문을 받아 확인. 위 주소는 국가법령정보센터의 해당 법령 주소예요.)
  - Lifetime Homes 기준 7: 거실에 지름 150 원 또는 170×140 타원 — https://cae.org.uk/our-services/housing-services/lifetime-homes/7-circulation-space/
- 신뢰도: 높음(법령 원문). 단, 공공시설 대상 기준이라 개인 원룸에는 의무가 아니에요.

### B. 침대

**R6. 침대에 드나드는 쪽 옆은 60cm쯤, 넉넉하게는 70~90cm 비워요.**
- 수치: 최소 50~60 / 권장 70~90 (자료별: 50~55, 60, 70~80, 70~90, 75, 76~91)
- 구분: 권장 (50 미만이면 강한 경고)
- 근거:
  - Houzz: 더블 침대 옆·발치 50~55 — https://www.houzz.com.sg/ideabooks/109239110
  - Lifetime Homes 기준 7: 주 침실은 침대 양옆과 발치 75, 그 밖의 침실은 한쪽 옆 75 — https://cae.org.uk/our-services/housing-services/lifetime-homes/7-circulation-space/
  - 교육 자료(Neufert·Panero & Zelnik 인용): 침대 옆 약 70~90 — https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
  - Dimensions.com: 침대 둘레 최소 76.2, 편하게 91.4 — https://www.dimensions.com/element/king-bedroom-layouts
  - 검색 발췌: 최소 60, 알맞게는 70~80 — https://umebluje.pl/gb/blog/how-much-space-should-you-leave-around-a-bed-minimum-clearance-in-the-bedroom.html
- 신뢰도: 중간(범위가 넓음. 좁은 원룸은 60, 여유 있는 방은 75 이상으로 보는 게 무난)
- 엔진: 침대의 긴 변 중 벽에 붙지 않은 쪽에 폭 60의 띠가 비어 있는지 확인.

**R7. 침대 발치로 지나가야 하면 75~90cm, 지나가지 않으면 좁아도 돼요.**
- 수치: 지나갈 때 75(최소) ~ 90(권장) / 지나가지 않을 때는 50~55도 가능, 벽에 붙여도 됨
- 구분: 권장
- 근거:
  - Lifetime Homes 기준 7: 창에 가려고 발치를 지나야 하면 75 — https://cae.org.uk/our-services/housing-services/lifetime-homes/7-circulation-space/
  - 교육 자료(Neufert·Panero & Zelnik 인용): 발치 통로 약 90 — https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
  - Houzz: 50~55 — https://www.houzz.com.sg/ideabooks/109239110
- 신뢰도: 중간
- 엔진: 발치 쪽이 `walk`(통로 격자)에 포함될 때만 검사. 발치가 벽이면 통과.

**R8. 싱글·슈퍼싱글 침대는 한쪽 옆을 벽에 붙여도 돼요.**
- 수치: 벽 쪽 0 허용. 대신 반대쪽은 R6
- 구분: 허용 규칙(`sideOk: true`의 근거)
- 근거: Houzz "싱글 침대는 한쪽을 벽에 붙일 수 있다" — https://www.houzz.com.sg/ideabooks/109239110
  / Lifetime Homes: 주 침실이 아니면 한쪽 옆만 75 — https://cae.org.uk/our-services/housing-services/lifetime-homes/7-circulation-space/
- 신뢰도: 중간
- 참고(낮음, 검색 발췌): 폭 90 싱글 침대는 이불 정리용으로 한쪽에 35~40 — https://www.designingbuildings.co.uk/wiki/Bedroom

**R9. 휠체어를 쓰는 사람의 침대 옆은 120cm가 필요해요.**
- 수치: 120 이상, 침대 높이 40~45
- 구분: 참고(배리어프리 옵션)
- 근거: 편의증진법 시행규칙 별표 1 제19호 나목 (3) — https://www.law.go.kr/법령/장애인ㆍ노인ㆍ임산부등의편의증진보장에관한법률시행규칙
- 신뢰도: 높음(법령 원문). 공공 객실·침실용 기준.

### C. 책상과 의자

**R10. 책상 앞에는 의자를 뺄 공간이 60cm 이상, 편하게는 90cm 있어야 해요.**
- 수치: 최소 60~76 / 권장 90 (자료별: 60, 60~70, 76, 91)
- 구분: 60 미만은 강제(앉을 수 없음), 60~89는 권장 미달
- 근거:
  - 사무 가구 안내: 앉은 사람 뒤 최소 36인치(91) — https://www.officefurniture2go.com/answers/desk-space-planning/minimum-clearance-behind-desk-chair.html
  - RoomSketcher(검색 발췌): 책상 뒤 91~107 — https://www.roomsketcher.com/?p=3455
  - 검색 발췌: 의자 뒤 여유 60~70, 의자를 빼고 사람이 지나가려면 70~80 — https://tilnote.io/pages/6af0efab0f59636c15a26707
  - 검색 발췌: 최소 76, 알맞게는 91 — https://desky.ca/blogs/faqs/how-much-space-do-you-need-for-a-home-office-desk
- 신뢰도: 중간(권장 90은 여러 자료가 일치, 최소 60~76은 낮음)
- 엔진: 책상 `clear` 기본값 75 제안(좁은 원룸 현실 반영). `clear` 영역이 60 미만으로 잘리면 강한 경고.

**R11. 앉아 있는 사람 뒤로 다른 사람이 지나가려면 105~120cm가 필요해요.**
- 수치: 최소 90 / 권장 105~120
- 구분: 권장(책상 뒤가 주 동선일 때만)
- 근거: 앉은 채로 동료가 지나가려면 42~48인치 — https://www.officefurniture2go.com/answers/desk-space-planning/minimum-clearance-behind-desk-chair.html
- 신뢰도: 중간(사무실 기준. 혼자 사는 원룸에서는 의자를 밀어 넣으면 되므로 약하게 적용)
- 엔진: 책상의 `clear` 영역이 유일한 통로와 겹치면 "의자를 넣어야 지나갈 수 있어요" 정도의 안내만.

### D. 수납(옷장·서랍장)

**R12. 여닫이 옷장 앞은 문짝 폭만큼은 반드시, 서 있을 자리까지 76~105cm 비워요.**
- 수치: 강제 = 문짝 한 짝의 폭(보통 45~50) / 권장 76~91(Houzz), 90~105(교육 자료), 100(한샘 상품 설명)
- 구분: 문짝 폭 미만은 강제(문이 안 열림), 그 이상은 권장
- 근거:
  - Houzz: 옷장 앞 76~91(여닫이인지 슬라이딩인지에 따라) — https://www.houzz.com.sg/ideabooks/109239110
  - 교육 자료(Neufert·Panero & Zelnik 인용): 옷장 앞(문 열림 또는 서랍 + 사람) 약 90~105 — https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
  - 검색 발췌(한샘몰 슬라이딩 옷장 상품 설명): "여닫이 도어는 최소 100cm" — https://store.hanssem.com (정확한 상품 페이지는 확인하지 못함)
  - IKEA PAX 안내: 여닫이문은 50·100cm 프레임에만 달 수 있음 → 문짝 한 짝 폭이 약 50 — https://www.ikea.com/sg/en/rooms/bedroom/how-to-plan-pax-pub72099180 (검색 발췌)
- 신뢰도: 중간
- 엔진: 옷장(여닫이) `clear` 기본값 80 제안. 폭 w인 옷장의 문짝 폭은 `min(50, w / 문 개수)`로 추정.

**R13. 슬라이딩(미닫이) 옷장 앞은 서 있을 자리 50cm면 쓸 수 있어요.**
- 수치: 최소 50 / 권장 76
- 구분: 권장
- 근거:
  - 검색 발췌(한샘몰 상품 설명): "서 있을 공간 약 50cm만으로도 사용" — https://store.hanssem.com (정확한 상품 페이지는 확인하지 못함)
  - Houzz 76~91 범위의 아래쪽 값 — https://www.houzz.com.sg/ideabooks/109239110
  - IKEA: 슬라이딩 도어는 옷장 앞 바닥 공간을 아낀다(수치 없음) — https://www.ikea.com/sg/en/rooms/bedroom/how-to-plan-pax-pub72099180
- 신뢰도: 낮음(50이라는 값은 제조사 홍보 문구)
- 엔진: 카탈로그에 슬라이딩 옷장이 있으면 `clear` 50~60. 좁은 방에서 여닫이 대신 추천하는 근거로 쓸 수 있어요.

**R14. 서랍장 앞은 서랍 깊이(41~51cm)에 몸이 설 자리(46cm)를 더해 90cm쯤 비워요.**
- 수치: 서랍이 나오는 길이 41~51 + 사용자 자리 46 = 87~97 / 뒤로 통로까지 두려면 여기에 107~122 추가(넓은 방 기준)
- 구분: 서랍 깊이 미만은 강제(서랍이 안 열림), 90은 권장
- 근거:
  - Dimensions.com: 서랍 영역 41~51, 활동 영역 46, 통행 여유 107~122 — https://www.dimensions.com/element/dresser-chest-bedroom-clearances
  - 검색 발췌: 닫힌 서랍장 앞에서 맞은편까지 90~100 — https://home.lazada.sg/how-to-choose-the-right-chest-of-drawers-size-for-an-hdb-bedroom-without-blocking-walkways-sg/
- 신뢰도: 중간
- 엔진: 서랍장 `clear` 기본값 70~80 제안(원룸 현실값). 강제 한계는 `min(d, 50)`.

**R15. 옷장 앞면과 침대 사이는 60~70cm 이상, 서랍이 있으면 90cm가 좋아요.**
- 수치: 최소 60~70 / 서랍이 있으면 90
- 구분: 권장
- 근거(검색 발췌): https://home.lazada.sg/wardrobes-with-drawers-for-hdb-bedrooms-top-brands-and-sizing-guide-20260807/ ,
  https://home.lazada.com.ph/how-to-measure-and-choose-the-right-wardrobe-size-for-your-bedroom-ph/
- 신뢰도: 낮음(R6·R12와 방향은 같음)
- 엔진: 따로 규칙을 만들 필요 없이 R6의 침대 옆 띠와 R12의 `clear`가 겹쳐도 되는 것으로 처리하면 돼요(같은 빈 공간을 함께 씀).

**R16. 옷장 깊이는 60~65cm가 표준이에요.**
- 수치: 60~65
- 구분: 치수 검증용(카탈로그·AI 추정값 점검)
- 근거: https://www.houzz.com.sg/ideabooks/109239110
- 신뢰도: 중간

### E. 소파·테이블·TV

**R17. 소파와 소파 테이블 사이는 40cm 안팎(38~46cm)이 좋아요.**
- 수치: 최소 35~40 / 권장 38~46 / 넉넉하게 45~50. 너무 멀면(약 50 초과) 손이 닿지 않아요.
- 구분: 권장(가깝거나 먼 쪽 모두 감점)
- 근거:
  - 교육 자료(Panero & Zelnik·업계 관행): 약 38~46, 통로를 겸하면 약 76 — https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
  - 검색 발췌: 14~18인치(36~46) — https://www.livingetc.com/advice/18-inch-seating-rule-living-room ,
    https://idealhome.co.uk/living-room/living-room-decor/how-much-space-between-sofa-and-coffee-table
- 신뢰도: 중간(여러 자료가 같은 범위)
- 엔진: 소파 `clear` 40. 테이블은 소파의 `clear`를 침범해도 되는 예외(짝 가구)로 다루는 게 자연스러워요.

**R18. 소파와 테이블 사이가 지나다니는 길이라면 60~76cm로 넓혀요.**
- 수치: 최소 60 / 권장 76
- 구분: 권장
- 근거: https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances (약 76), R1(60)
- 신뢰도: 중간

**R19. TV는 화면 대각선 길이(cm)의 1.2~1.6배 떨어져서 봐요.**
- 수치: 권장 거리 = 대각선(cm) × 1.2 (시야각 40°, 몰입형) ~ × 1.6 (시야각 30°)
  | 화면 | 대각선 | × 1.2 | × 1.6 |
  |---|---|---|---|
  | 43인치 | 109 | 약 130 | 약 175 |
  | 50인치 | 127 | 약 150 | 약 205 |
  | 55인치 | 140 | 약 170 | 약 225 |
  | 65인치 | 165 | 약 200 | 약 265 |
  | 75인치 | 190 | 약 230 | 약 305 |
- 구분: 권장
- 근거:
  - 삼성전자 TV 크기 안내: 시야각 40°, 권장 거리 = TV 크기 × 1.2 — https://www.samsung.com/sec/tvs/tv-buying-guide/what-size-tv-should-i-get
  - LG전자 TV 크기 안내: 화면 크기(cm) × 1.2, 43인치 1.3m ~ 75인치 2.3m — https://www.lge.co.kr/story/buying-guide/lg-tv-sizeguide
  - 위키백과: THX 약 40°(대각선 × 약 1.2), 흔히 SMPTE 권고로 인용되는 30°(× 약 1.6. 단 SMPTE의 직접 권고는 확인되지 않는다고 적혀 있음) — https://en.wikipedia.org/wiki/Optimum_HDTV_viewing_distance
- 신뢰도: 높음(제조사 공식 안내 2곳이 일치)
- 엔진: TV(또는 TV장)와 마주 보는 소파·침대 사이의 거리를 재서 범위 밖이면 안내. TV 크기를 모르면 55인치로 가정(거리 170~225). × 1.6 열은 직접 계산한 값이에요.

**R20. TV에서 대각선의 2.5배보다 멀어지면 화면이 작게 느껴져요.**
- 수치: 상한 대각선 × 2.5 (시야각 약 20°)
- 구분: 권장
- 근거: https://en.wikipedia.org/wiki/Optimum_HDTV_viewing_distance
- 신뢰도: 중간(원룸에서는 거의 걸리지 않는 규칙)

### F. 식탁

**R21. 식탁 의자를 빼고 앉으려면 식탁 끝에서 75~90cm가 필요해요.**
- 수치: 최소 75~80 / 권장 90
- 구분: 75 미만은 강제(앉기 어려움), 90은 권장
- 근거:
  - 교육 자료(Panero & Zelnik 인용): 의자를 빼고 앉기 약 75~90 — https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances
  - Houzz: 식탁 끝에서 벽·장애물까지 91 — https://www.houzz.com.sg/ideabooks/109239110
  - Arcedior: 빠듯한 최소 80, 매일 쓰기에 편한 값 90 — https://arcedior.com/blog/chair-clearance-behind-dining-tables
    (이 글은 "의자를 다 뺀 상태의 등받이"에서 잰다고 적어 기준점이 달라요. 엔진은 식탁 끝 기준으로 통일하는 걸 권해요.)
- 신뢰도: 중간
- 엔진: 식탁의 의자 놓는 변마다 `clear` 75. 2인 식탁을 벽에 붙이면 붙인 변은 검사하지 않음.

**R22. 앉은 사람 뒤로 옆걸음으로 지나가려면 60cm, 걸어서 지나가려면 110~120cm가 필요해요.**
- 수치: 옆걸음 60 / 걸어가기 최소 110, 편하게 120
- 구분: 권장(식탁 뒤가 동선일 때만)
- 근거: https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances (Panero & Zelnik 인용: 약 60, 약 110),
  https://arcedior.com/blog/chair-clearance-behind-dining-tables (110 / 120)
- 신뢰도: 중간

**R23. 식탁에서 한 사람 자리는 폭 60cm예요.**
- 수치: 60
- 구분: 치수 검증용("4인 식탁"이면 긴 변이 120 이상인지)
- 근거: https://www.studiomatrx.org/students/space-planning-ergonomics/space-standards-and-clearances (Neufert·Time-Saver 인용)
- 신뢰도: 중간

### G. 문

**R24. 방문이 열리는 자리(문 폭 × 문 폭)는 완전히 비워야 해요.**
- 수치: 문 폭 × 문 폭 정사각형(예: 90 × 90). 문이 90° 열릴 때 쓸고 지나가는 범위를 감싸는 사각형이에요.
- 구분: 강제(규약 CONTRACT.md 2절의 정의와 같음)
- 근거:
  - 기하학적 사실(문짝 길이 = 회전 반지름). 같은 원리의 검색 발췌: "45cm 문짝은 앞에 45cm 호가 필요" — https://home.lazada.sg/wardrobe-dimensions-for-hdb-bedrooms-in-singapore-sizing-a-cabinet-for-clothes-sg/
  - 검색 발췌: "여닫이문은 앞 공간 60cm를 비워야" — https://tilnote.io/pages/6a9c3ae98a847deea170429f
- 신뢰도: 높음(기하) / 추가 60은 낮음
- 엔진: 지금의 `doorZones` 그대로. 문 여는 공간 바로 앞에 60 통로가 이어지는지는 `walk`가 이미 확인해요.

**R25. 휠체어를 쓰면 문 앞 깊이 120cm, 손잡이 쪽 옆 60cm가 더 필요해요.**
- 수치: 문 앞 유효 거리 120 이상(문이 열리는 공간은 빼고), 자동문이 아니면 문 옆 활동 공간 60 이상
- 구분: 참고(배리어프리 옵션)
- 근거: 편의증진법 시행규칙 별표 1 제6호 가목 (1), (3) — https://www.law.go.kr/법령/장애인ㆍ노인ㆍ임산부등의편의증진보장에관한법률시행규칙
- 신뢰도: 높음(법령 원문). 공공시설 기준.

**R26. 문 통과 폭은 80~90cm가 기준이에요.**
- 수치: 휠체어 통과 유효폭 90 이상(출입문), 승강기 문 80 이상
- 구분: 입력 검증용(문 폭 기본값·안내 문구). 규약의 문 폭 허용 범위는 60~150.
- 근거: 편의증진법 시행규칙 별표 1 제6호 가목 (1), 제9호 나목 (2) — https://www.law.go.kr/법령/장애인ㆍ노인ㆍ임산부등의편의증진보장에관한법률시행규칙
- 신뢰도: 높음(법령 원문)

## 엔진에 넣을 때 제안 (`spec.clear` 기본값)

규약의 `clear` 허용 범위(0~150) 안에서, 원룸 현실을 생각해 "권장"이 아니라 "최소에 가까운 쓸 만한 값"으로 골랐어요.

| category / 가구 | `clear` 제안 | 이보다 좁으면 강한 경고 | 근거 |
|---|---|---|---|
| 책상(의자 포함) | 75 | 60 | R10 |
| 여닫이 옷장 | 80 | 50(문짝 폭) | R12 |
| 슬라이딩 옷장 | 55 | 50 | R13 |
| 서랍장 | 75 | 50(서랍 깊이) | R14 |
| 소파 | 40 | 35 | R17 |
| 식탁(의자 놓는 변) | 75 | 60 | R21, R22 |
| 침대(드나드는 긴 변) | 60 | 50 | R6 |
| TV장 | 0 (대신 시청 거리 R19 검사) | — | R19 |
| 냉장고·세탁기 등 문 달린 가전 | 조사하지 않음(문짝 폭만큼은 강제로 보는 게 안전) | — | R12와 같은 원리 |

점수(권장 충족도) 계산용 단계: 통로 60 / 76 / 90, 침대 옆 50 / 60 / 75, 책상 60 / 75 / 90.

## 확인하지 못한 것 (정직하게)

- **Panero & Zelnik 「Human Dimension & Interior Space」, Neufert 「Architects' Data」 원서는 직접 보지 못했어요.**
  두 책의 수치는 2차 자료(studiomatrx 교육 자료)가 "두 책의 값"이라고 정리한 것을 옮겼고, 쪽수는 확인하지 못했어요.
- **KS 표준, LH 설계 지침에서 가구 여유 공간 수치는 찾지 못했어요.** 한국 1차 자료는 편의증진법 시행규칙 별표 1 하나뿐이고, 이것은 공공시설·휠체어 기준이에요.
- **IKEA 플래닝 가이드에는 옷장 앞 여유 공간 수치가 없었어요**(조립 공간·천장 높이 수치만 있음).
- 한샘 "여닫이 100 / 슬라이딩 50", 책상 "60~70", 문 앞 "60", 옷장–침대 "60~70" 등 **신뢰도 '낮음' 항목은 검색 발췌로만 봤고 원문 전체는 확인하지 못했어요.**
- 서랍장(R14)의 87~97은 Dimensions.com의 두 영역 값을 더한 계산이고, R19 표의 × 1.6 열도 직접 계산한 값이에요.
- 이 문서는 조사 결과일 뿐이고, `src/layout.js`에는 아직 반영하지 않았어요.
