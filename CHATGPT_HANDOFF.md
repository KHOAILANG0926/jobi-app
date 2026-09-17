# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**커밋 완료 + master push + Vercel Production 배포까지 전부 완료**
(`2fbf38e`→`3ddfaac`→`bd527a0`→`371c084`→`8b63a73`→`6777fd0`→`30e8fcd`→
`d5cdfad`→`1de8e3f`→`316ad40`→`f59ba6f`): 급구 페이지 **대분류/소분류 체계
전면 재설계**(A~E) + **Khu vực(지역) 패널 UX 수정 3라운드**(F: 정렬/칩바/
기본값/검색창/아이콘/폭, G: 옛 Quận/Huyện 중간 단계 복원+3열 구조, H: 패널
기본 열림+검색창 폭 재수정 — 아래 참고). 기존 7개 카테고리(cafe/restaurant/
retail/delivery/cleaning/factory/office/other)를 폐기하고 알바몬 실제
사이트에서 직접 확인한 **12개 대분류+기타=13개**, **소분류 158개**로
교체·전면 반영 완료. 지역 필터는 2025년 베트남 행정개편 이후 실제 2단계
(Tỉnh/Thành phố → Xã/Phường) 체계를 정확히 반영하면서도, 폐지된 Quận/Huyện을
생활권 탐색용 중간 열로 복원해 알바몬과 유사한 3열 UI를 제공한다. **세션이
"나머지는 회사에서 하자"로 여기서 끊김** — 회사 PC 세션은 `git fetch
origin && git status`로 동기화 여부만 확인하면 바로 이어서 작업 가능(전부
push 완료 상태).

## 변경 내용

### A. 대분류 12개+기타 확정 (실제 알바몬 사이트에서 직접 확인)
Ẩm thực · Đồ uống(외식·음료) / Quản lý cửa hàng · Bán hàng(매장관리·판매) /
Dịch vụ(서비스) / Văn phòng(사무직) / Chăm sóc khách hàng · Kinh doanh
(고객상담·리서치·영업) / Sản xuất · Xây dựng · Lao động phổ thông(생산·건설·
노무) / CNTT · Kỹ thuật(IT·기술) / Thiết kế(디자인) / Truyền thông(미디어) /
Lái xe · Giao hàng(운전·배달) / Y tế · Điều dưỡng · Nghiên cứu(병원·간호·
연구) / Giáo dục · Giảng dạy(교육·강사) / Khác(기타).

베트남어 라벨은 전부 이번 세션에서 직접 번역(알바몬은 한국어 전용이라 공식
베트남어 원본 없음) — 노래방/PC방/사우나 등도 "지금 공고가 없을 뿐 베트남에
실존하는 업종"이라는 사용자 지적으로 전부 포함. 구분자는 알바몬 원문이
"·"(가운뎃점)만 쓰고 "/"는 전혀 안 쓴다는 사용자 지적(`bd527a0`)으로, 158개
소분류 전체에서 "/"를 "·"로 통일(순수 약어 "PG/PB"·"CAD/CAM"만 예외). 영어
그대로 남겨뒀던 "(valet)"/"(quick service)"/"(narrator model)"/
"(QA/Tester)" 4곳도 순수 베트남어로 재번역함.

### B. crawler/classifier.py 전면 재설계
기존 검증된 정규식 로직(classify()/classify_subcategory(), 22/17개 테스트)은
**하나도 안 건드리고** 그대로 둔 채, 그 결과를 새 체계로 번역하는 레이어를
추가하는 방식으로 안전하게 확장:
- `LEGACY_CATEGORY_TO_MAJOR`(7→13 결정적 매핑), `LEGACY_SUB_TO_NEW`(기존
  소분류 21개 → 새 소분류, 25개 항목 — 일부는 대분류 자체가 바뀜: 예)
  캐셔/thu_ngan은 어느 업종이든 "Quản lý cửa hàng"으로, "안내데스크·리셉션"
  으로 옮긴 le_tan은 "Văn phòng"이 아니라 "Dịch vụ"로), `map_to_new_taxonomy()`
  함수가 크롤러 DB 쓰기 직전 마지막 단계에서 번역.
- **신규 대분류 5개(cntt_ky_thuat/thiet_ke/giao_duc_giang_day/
  y_te_dieu_duong/truyen_thong)**: 옛 7분류에 대응이 없어 classify()가
  새 major id를 직접 반환하도록 새 정규식 3세트(`_CNTT_KY_THUAT`/
  `_THIET_KE`/`_GIAO_DUC_GIANG_DAY`) 추가 — **DB의 category='other' 66건
  실제 제목을 전부 눈으로 보고** 진짜 신호가 있는 것만 만듦(IT Helpdesk,
  Giáo Viên Tin Học, Kiến Trúc Sư Thiết Kế Nội Thất, 3D Rigger 등 실제
  사례로 검증). 나머지 2개(`_Y_TE_DIEU_DUONG`/`_TRUYEN_THONG`)는 이 66건
  표본에 실제 신호가 0건이었지만, "매번 반복하지 말고 지금 최대한 넣어라"는
  사용자 지시로 **베트남어 확실한 직군 용어 기반으로 미리 만듦(⚠️ 우리 DB
  실제 공고로 검증된 게 아니라고 코드 주석에 명시** — 나중에 실제 공고
  들어오면 재검증 필요).
- **실사례 오분류 버그 2개 발견·수정**(DB 실 레코드로 확인):
  1. id=4381 "Nhân Viên Kinh Doanh Tôn Thép"가 restaurant로 오분류 —
     "lẩu"(전골)/"lâu"(오래, "hợp tác lâu dài")/"lau"(닦다)가 diacritics
     제거 후 전부 "lau"로 접힘(기존 phở/phổ 버그와 동일 원인). `_LAU_DISH_RE`
     로 phở 처리와 같은 방식 적용(실제 전골 메뉴 문맥일 때만 인정).
  2. id=4430 "Nhân Viên R&D"가 retail로 오분류 — 설명문의 "BP sale"(부서명
     언급)이 `\bsales?\b` 단독 매칭에 걸림. `_RETAIL`에서 단독 sale(s) 제거
     (더 구체적인 "sales executive"/"nhan vien ban hang" 등은 유지).
- 소분류 158개 전체를 `SUBCATEGORY_LABELS`(대분류별)에 등록. 셀프 테스트
  67개(22+17+16+12) 전부 통과.
- **크롤러가 앞으로 자동으로 새 체계를 쓰는지 실제 검증 완료** —
  `crawl_topcv.py`(2곳)/`crawl_facebook.py`(1곳) 전부 `map_to_new_taxonomy()`
  호출 확인 + 가상 신규 공고 3건("Pha Chế Cà Phê"/"Tài Xế Giao Hàng"/
  "Giáo Viên Tiếng Anh")으로 전체 파이프라인 시뮬레이션해서 새 대분류/
  소분류가 정확히 나오는 것 확인함. **앞으로 크롤링되는 신규 공고는 수동
  작업 없이 자동으로 새 체계로 DB에 저장됨.**

### C. DB 백필 — 활성 공고 273건 전부 재분류
`reclassify_db.py`(기존 도구 재사용, map_to_new_taxonomy() 호출만 추가)로
dry-run → 상세 crosstab 확인 → 사용자 승인 후 실제 적용. `local_jobs.category`/
`subcategory`는 `text` 컬럼이라 DDL 마이그레이션 없이 UPDATE만으로 끝남.
최종 분포: khac 53 / san_xuat_xay_dung 46 / am_thuc_do_uong 46 / van_phong
44 / lai_xe_giao_hang 34 / cskh_kinh_doanh 24 / thiet_ke 7 / quan_ly_ban_hang
6 / dich_vu 5 / cntt_ky_thuat 5 / giao_duc_giang_day 3 (합계 273, DB 직접
재조회로 확인).

### D. 프론트엔드 전체 반영
- [types/job.ts](src/types/job.ts) — `JobCategory` 13개로 교체.
- [data/categories.ts](src/data/categories.ts) — LABELS/SHORT/ICONS/SOLID/
  COLORS/ALL_CATEGORIES 전부 13개로 재작성.
- [data/subcategories.ts](src/data/subcategories.ts) — classifier.py의
  `SUBCATEGORY_LABELS`를 Python 스크립트로 그대로 변환해 재생성(158개,
  손으로 옮기다 어긋나는 위험 차단 — 라벨 변경할 때마다 이 방식으로 재생성).
- **중대 발견**: `src/lib/jobCategoryRules.ts`(이번에 삭제)가 `jobRows.ts`의
  `rowToJob()`과 `JobCard.tsx`에서 호출되며 **매번 title/company/description
  으로 카테고리를 다시 계산해 DB 값을 덮어쓰고 있었다** — classifier.py를
  아무리 잘 고쳐도 이 파일 때문에 화면엔 반영이 안 될 뻔했음. 제거하고
  `job.category`(DB 값)를 그대로 신뢰하도록 변경. `JobCard.tsx`의 중복
  `CATEGORY_TAGS`도 제거하고 `data/categories.ts`의 `CATEGORY_SHORT` 재사용.
- 그 외 컴파일 오류 8개 파일 수정: `categoryVisuals.ts`, `brandCandidates.ts`/
  `.test.ts`, `mockJobs.ts`, `RecommendSection.tsx`/`Community.tsx`(하드코딩
  부분집합 대신 `ALL_CATEGORIES` 전체 사용), `AdminDashboard.tsx`,
  `recommendStorage.test.ts`.

### E. 배포 후 스타일 수정 3라운드 (사용자가 실사이트 보고 지적)
1. **버튼 폰트 상속 누락** — `.jm-region-row`/`.jm-chip`/
   `.jm-filter-dropdown__reset`/`.jm-active-chip button`/`.jm-clear-filters`/
   `.jm-keyword-tag button` 6곳에 `font-family: inherit` 누락돼 브라우저
   기본 버튼 폰트(Arial 등)로 렌더링되던 것 발견·수정. (사용자가 "필기체
   아니냐"고 물어봐서 조사하다 발견 — 실제로는 필기체가 아니라 이 폰트
   상속 버그였음.)
2. **필터 패널 폭 구조 변경** — 개별 버튼(`.jm-filter-dropdown`) 밑에서
   좁게 펼쳐지던 패널을, **필터 줄 전체**(`.jm-urgent-filters`) 폭에 꽉
   차게 펼쳐지도록 positioning context를 버튼→줄 전체로 이동(사용자가
   실제 알바몬 캡처본 "이런식으로 상단길이하고 마추라고"로 지시). 소분류
   그리드가 5칸 이상으로 표시됨(전엔 2칸).
3. **글씨 크기 축소** — 알바몬 캡처본 대비 너무 크다는 지적으로
   `.jm-region-row`(1.12rem→0.85rem), `.jm-region-col__head`(1.08rem→
   0.8rem), `.jm-filter-dropdown__search`(1.15rem→0.9rem) 축소.

### F. 지역(Khu vực) 패널 UX 6건 추가 수정 (`6777fd0`)
1. **Xã/Phường 정렬 버그** — `vnWards.ts` 생성 시 "Phường "/"Xã " 접두어를
   포함해서 통째로 알파벳 정렬해서, Phường(P)가 Xã(X)보다 항상 먼저 와
   스크롤 전엔 Phường만 보였다(사용자 스크린샷으로 발견). 실측: Hải Phòng
   = Phường 45개 · Xã 67개가 실제론 고르게 있음. 접두어를 뗀 지명 자체
   기준으로 재정렬(crawler에서 vietnam-provinces 패키지로 재생성).
2. **선택된 필터 칩 바 제거** — `activeFilterChips`/`.jm-active-filters`
   통째로 삭제(사용자가 "3번째 캡처본처럼 내용이력 남게 하지말고" →
   "칩 줄 자체를 완전히 제거"로 확답).
3. **지역 패널 기본값 자동 적용** — 알바몬은 지역 패널을 열면 서울이
   이미 선택돼 동/읍/면까지 보임. `selectedProvince` 초기값을
   `VN_PROVINCES[0]`(Cần Thơ)로 변경 — URL에 `?province=` 없으면 실제
   필터로 자동 적용(단순 미리보기 아님, 사용자가 이 방식으로 확답). **주의**:
   Cần Thơ에는 현재 급구 공고가 0건이라 첫 방문 시 "Tổng 0 việc làm"으로
   보임 — 실제 데이터가 적어서 생기는 정직한 결과지 버그 아님. 물량 많은
   지역으로 기본값을 바꾸고 싶으면 `VN_PROVINCES[0]` 대신 다른 로직 필요.
4. **검색창 스타일** — 세로 padding 절반(0.5rem→0.25rem), border-radius
   알약형(10px, `--radius-sm`)에서 각진 사각형(4px)으로, placeholder
   텍스트("Tìm khu vực...", "Tìm ngành nghề...") 완전 제거(빈 칸).
5. **돋보기 아이콘 수직 정렬 버그** — `top:0;bottom:0.6rem` 조합이
   input의 `margin-bottom`(0.6rem)과 맞물려 계산되는 방식이었는데, 검색창
   padding을 줄이자 실측 8px 어긋남 발생(사용자가 "돋보기 위치 봤냐고"로
   지적). `margin-bottom`을 input이 아니라 `.jm-search-input-wrap`으로
   옮기고 `top:50%;transform:translateY(-50%)`로 교체 — 재측정 오차
   0.01px로 해결.
6. **지역 패널 칼럼 폭 비대칭화** — Tỉnh/Thành phố(왼쪽)는 `--narrow`
   고정폭, Xã/Phường(오른쪽)은 `--wide`(flex:1)로 — 업직종 패널과 동일
   패턴 재사용(사용자가 "1지역 빈공간 너무 많다"고 지적).

### G. 옛 Quận/Huyện(구/현) 중간 단계 복원 + 3열 구조 (`d5cdfad`)
2025년 개편으로 구/현은 행정상 폐지됐지만 생활권/검색 단위로는 계속 쓰인다는
사용자 지적("intermediate 행정 기관은 사라졌지만 ... 생활권 및 지리적 검색
단위로 계속 사용됩니다") — 실제로 구현 가능한지 확인 후 진행:

- **데이터 출처**: 이미 설치돼있던 `vietnam-provinces` 패키지(통계총국
  공식 자료) 안에 `_ward_conversion_2025.OLD_TO_NEW`(옛 동→새 동 변환표)와
  `legacy.District`(옛 구/현 목록)가 이미 들어있음을 확인 — 새로 지어낸
  데이터 아님. 전국 신규 Xã/Phường 3,321개 중 구/현 1곳에 깔끔히 매핑되는
  게 3,019개(90.9%), 2~5곳에 걸쳐 합쳐진 게 297개(8.9%, 이런 동은 관련된
  모든 구/현 밑에 **중복 표시** — 임의로 "대표" 하나를 고르지 않음, 사용자
  확인), 매핑 없는 게 5개(0.15%, 전부 Bạch Long Vĩ/Cồn Cỏ/Hoàng Sa/Lý Sơn/
  Côn Đảo — "Đặc khu"라는 원래부터 구/현 하위가 아닌 독립 행정단위였음,
  local_jobs에 관련 공고 0건 확인함). 이 5곳은 자기 자신을 유일한 원소로
  하는 구/현 슬롯으로 표시(선택 시 중간 단계 없이 바로 그 섬으로 확정).
- **[vnDistricts.ts](src/data/vnDistricts.ts)**: 위 데이터로 생성한
  `VN_DISTRICTS_BY_PROVINCE`(성/시별 구/현 목록)와
  `VN_WARDS_BY_DISTRICT`(성/시→구/현→동 목록) — vnWards.ts/vnProvinces.ts와
  동일 출처·생성 방식.
- **[UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)**: Khu vực
  패널을 Tỉnh/Thành phố · Quận/Huyện · Xã/Phường **3열**로 확장(알바몬
  실사이트 3열 캡처본 기준 — "이런식으로 나오게"). **실제 필터는 여전히
  성/시+동/사에서만 걸린다** — 구/현(`selectedDistrict`) 선택은 오른쪽
  열에 어느 구/현의 동만 보여줄지 결정하는 순수 탐색 상태이고, 필터 값
  자체는 아니다(알바몬도 시/구/군 클릭은 화면만 바꾸고 필터는 동/읍/면
  에서 확정됨). 지역 검색(정규화 텍스트 검색)으로 동을 바로 고르면
  `findDistrictOfWard()`로 해당 구/현을 역산해 3열째도 맞춰준다.
- **칼럼 폭**: "제일 긴 지역기준으로 칸 크기 설정" 지시로 실측(브라우저
  canvas measureText, `.jm-region-row`와 동일 폰트 `700 13.6px`) 기반 산정
  — Tỉnh 칸은 전국 34개 중 최장 "Tuyên Quang"(88.3px)+패딩+스크롤바 기준
  140px, Quận 칸은 전국 693개 중 최장 "Thành phố Phan Rang - Tháp Chàm"
  (233.7px) 기준 280px(카테고리 패널의 `--narrow`/`--wide`와는 별개
  클래스라 서로 영향 없음).
- **검색창 추가 축소**: "검색 사이즈 4/1로 줄여" — 세로 padding을 최초
  원본(0.5rem) 기준 1/4인 0.125rem으로(전 라운드에서 이미 0.25rem으로
  반 줄인 상태였음). 돋보기 아이콘 수직 중앙 정렬은 기존 `top:50%+
  transform` 방식이라 패딩이 더 줄어도 깨지지 않음(재측정: input 중심
  430.93 vs icon 중심 430.92, 오차 0.01px). **→ 이 해석은 틀렸음, 아래 H
  참고** — 사용자 의도는 높이가 아니라 폭 축소였음.

### H. 지역 패널 기본 열림 + 검색창 폭 재수정 (`316ad40`, `f59ba6f`)
1. **패널 기본 열림**: `openPanel` 초기값을 `null`→`'region'`으로. 기본
   지역(Cần Thơ)에 공고가 0건이라 패널이 닫힌 채로 페이지에 들어가면
   빈 결과 화면만 덩그러니 보였다(사용자 지적: "화면이 안비게", "급구
   페이지 들어가면 바로 이렇게 열린창으로 보여달라고 했잖아" — 이전
   세션에서 이미 지시했던 내용인데 그때 도중에 끊겨 구현이 안 돼 있었음).
2. **검색창 폭 재수정(G에서의 오역 정정)**: G에서 "검색 사이즈 4/1로 줄여"를
   세로 padding(높이) 축소로 해석했는데, 실제로는 **가로 폭** 축소
   요청이었음("높이를 축소하라는게 아니고 길이를 축소하라는거야 알바몬
   캡쳐 보내줬잖아" — 알바몬 참고 캡처본은 검색창이 패널 폭 전체가 아니라
   왼쪽 일부만 차지). `.jm-search-input-wrap--khu-vuc` 전용 modifier
   클래스 추가해 `width: 25%`로(측정: 111.66px / 446.6px = 정확히 0.25) —
   Ngành nghề 검색창(`.jm-search-input-wrap` 공유)은 이번 지시 대상이
   아니라 폭 그대로 유지, 스크린샷으로 영향 없음 확인.
   높이(padding 0.125rem)는 사용자가 되돌리라고 하지 않아 그대로 둠.

## 테스트 결과

- **크롤러**: `classifier.py` 자체 실행 — 대분류 22/22, 소분류 17/17, 새
  체계 매핑 16/16, 새 대분류 5개 12/12 = **총 67/67 통과**. `test_job_quality.py`
  19/19 회귀 없음. 신규 공고 시뮬레이션 3건 전부 새 체계로 정확히 분류됨.
- **프론트**: `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test`
  6/6 파일 전부 통과(59개 테스트, 회귀 없음) — E 라운드 수정 후에도 매번
  재확인.
- **DB**: 백필 후 `select category, count(*) from local_jobs group by
  category`로 직접 재조회해 273건 분포 확인.
- **실 브라우저(로컬+Production 둘 다)**: "Ngành nghề" 패널 열어 실제 DB
  백필된 소분류 표시 확인, DB 기반 필터링 확인(`lai_xe_giao_hang` 선택 →
  정확히 1건). 1440px 데스크톱/375px 모바일 둘 다 패널 폭·줄바꿈 확인.
- id=4381/4430 두 버그 수정 후 실제 텍스트로 재확인, "lẩu bò" 진짜 전골
  공고는 여전히 am_thuc_do_uong로 정확히 분류(회귀 없음).
- **G(구/현 3열) 별도 확인**: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과(회귀 없음). 브라우저로 Cần Thơ→Quận Bình
  Thuỷ→Phường An Bình 선택 시 "Khu vực (2)"로 정상 반영(필터 실제 작동),
  Hải Phòng→Đặc khu Bạch Long Vĩ 선택 시 구/현 없이 자기 자신만 동으로
  뜨는 것 확인, 375px 모바일에서 패널이 가로 스크롤(`overflow-x:auto`,
  기존 패턴)로 정상 대응, Production 배포 후 CSS 해시(`index-CfD-nvtI.css`)
  가 로컬 빌드와 정확히 일치함을 확인해 배포 완료 검증.
- **H(패널 기본 열림+검색창 폭) 별도 확인**: `npx tsc --noEmit` 클린,
  `npm run build` 성공, `npm test` 6/6 파일 통과. 브라우저로 페이지 최초
  진입 시 Khu vực 패널이 열린 채로 렌더되는 것 확인, 검색창 폭 111.66px/
  패널 폭 446.6px = 정확히 0.25 실측 확인, Ngành nghề 검색창은 폭 영향
  없음 스크린샷 확인. Production CSS 해시(`index-Cy3QVwuK.css`)가 로컬
  빌드와 일치, 실제 viecganban.vn에서 패널 열림+좁은 검색창 스크린샷으로
  재확인.

## 발견된 문제

- **jobCategoryRules.ts가 DB 분류 결과를 매번 덮어쓰던 문제**(위 D 참고,
  발견·제거) — 앞으로 프론트에서 카테고리를 다시 "추정"하는 코드를 추가하지
  말 것. `job.category`(DB 값)가 유일한 진실 공급원.
- **truyen_thong/y_te_dieu_duong 분류 규칙 미검증**(위 B 참고) — 실제 공고
  들어오면 재검증 필요, **자동으로 규칙이 추가되지 않음**(수동 작업 필요).
- **PostJob.tsx(기업 직접 등록)에 소분류 선택 필드가 여전히 없음** — 대분류
  드롭다운은 새 13개로 자동 반영됐지만(ALL_CATEGORIES 참조), 소분류는
  여전히 미착수. 크롤링 공고와 달리 직접 등록은 정규식 추정이 아니라
  드롭다운으로 100% 정확하게 받을 수 있어 우선순위 있음.
- `categoryVisuals.ts`의 이미지가 5개 신규 대분류(cntt_ky_thuat/thiet_ke/
  truyen_thong/y_te_dieu_duong/giao_duc_giang_day)는 전용 사진 없이 'khac'
  일반 이미지로 폴백 — 기능은 정상(에러 없음), 장식적 완성도만 낮음.
- **이 세션의 로컬 메모리(Claude 기억)는 이 PC(집)에만 있고 다른 PC로
  전달 안 됨** — 예: "작업 전 승인 받기" 지시가 회사 PC 세션에만 저장돼
  있어서 집 PC 세션이 처음엔 몰랐음. 이 문서(`CHATGPT_HANDOFF.md`)가 git로
  동기화되는 유일한 인수인계 수단이므로, 세션 끝날 때마다 반드시 최신화할 것.
- **구/현(Quận/Huyện) 열은 순수 탐색용, 실제 필터 차원이 아님** — DB에
  구/현 필드가 없어서(있는 건 성/시+동/사뿐) 구/현 선택 자체를 저장/URL에
  반영하지 않음. "이 구 전체를 필터로" 같은 클릭 한 번짜리 기능은 아직
  없음(원하면 선택된 구/현의 동 전체를 `selectedWards`에 합집합으로 넣는
  방식으로 나중에 추가 가능).
- 지역 검색창(평탄화 검색)은 여전히 성/시+동/사만 인덱싱함 — 구/현 이름
  자체로는 검색 안 됨(이번 작업 범위 밖, 필요하면 별도 지시 필요).
- (이전부터 있던 항목, 계속 유지) `applications_insert`의 tautology 조건,
  korea_jobs 구조 통합 미결정, 기업 계정 헤더에 구직자 메뉴 링크 없음,
  `.git/hooks/post-commit` 자동 push 훅(이제는 두 PC 동기화에 도움되는
  쪽으로 활용 중 — 굳이 끌 필요 없어 보임).

## 다음 결정사항

1. PostJob.tsx에 소분류 드롭다운 추가(우선순위 있음 — 위 "발견된 문제" 참고).
2. truyen_thong/y_te_dieu_duong 분류 규칙을 언제 실제 데이터로 재검증할지
   (크롤러가 계속 새 공고를 가져오므로 주기적으로 category='khac' 표본을
   다시 확인하는 루틴이 있으면 좋음).
3. 지역/업종 2단 구조를 다른 화면(홈/저장한 공고/맞춤 공고/지도)에도
   확대할지 — 여전히 보류 중.
4. `categoryVisuals.ts`에 신규 5개 대분류 전용 이미지 추가할지.
5. korea_jobs 통합 / 공개 구직자 검색 — 착수 여부.
6. `applications_insert`의 tautology 조건 수정 여부.
7. 기업 계정 헤더에 "Việc làm" 링크 추가할지.
8. 급구 페이지 첫 방문 시 지역 기본값이 `VN_PROVINCES[0]`(Cần Thơ, 현재
   공고 0건)라 "Tổng 0 việc làm"으로 보임 — H에서 패널을 기본으로 열어둬
   빈 화면처럼 보이는 문제는 완화됐지만, Cần Thơ 자체에 공고 0건인 근본
   원인은 그대로임. 실제 공고가 제일 많은 지역(지금은 Hà Nội 계열)으로
   기본값을 바꿀지, 아니면 그대로 둘지 — 여전히 미정.
9. 구/현 "전체 선택" 원클릭 필터(선택한 구/현의 동 전체를 필터에 합치기),
   지역 검색창에 구/현 이름도 인덱싱할지 — 둘 다 사용자가 "왜 안한거지"로
   물어봤지만 "별도 지시하면 진행" 상태로 보류, 아직 미착수.
