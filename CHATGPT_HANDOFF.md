# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**커밋 완료(`227c0b1`~`c038359`, 회사 PC), master push + Production 배포까지
완료**: 급구 페이지 필터 UX 알바몬 재비교(지역 검색/선택 칩/테두리 색 등).

**이번 라운드(집 PC) — 아직 커밋 안 함**: **대분류/소분류 체계 전면
재설계**(사용자 지시: "그다음 알바몬에서 세부 일자리 가져왔잖아 ... 지금
최대한 넣어야된다"). 기존 7개 카테고리(cafe/restaurant/retail/delivery/
cleaning/factory/office/other)를 폐기하고, 알바몬 실제 사이트
(albamon.com/jobs/urgent 업직종 필터)에서 직접 확인한 **12개 대분류 + 기타
1개 = 13개**로 교체, 그 밑에 **소분류 158개**(라벨은 전부, 분류 규칙은
실제 검증된 만큼만)를 붙였다. 크롤러 재설계 → 기존 DB 273건 전부
재분류(백필) → 프론트 전체 반영까지 끝냈다.

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
실존하는 업종"이라는 사용자 지적으로 전부 포함, 영어 그대로 남겨뒀던
"(valet)"/"(quick service)"/"(narrator model)"/"(QA/Tester)" 4곳은
"베트남어만 보라"는 지적으로 순수 베트남어로 재번역.

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

### C. DB 백필 — 활성 공고 273건 전부 재분류
`reclassify_db.py`(기존 도구 재사용, map_to_new_taxonomy() 호출만 추가)로
dry-run → 상세 crosstab 확인(오래 걸려도 괜찮으니 전부 검토) → 사용자 승인
후 실제 적용. `local_jobs.category`/`subcategory`는 `text` 컬럼이라 DDL
마이그레이션 없이 UPDATE만으로 끝남. 최종 분포: khac 53 / san_xuat_xay_dung
46 / am_thuc_do_uong 46 / van_phong 44 / lai_xe_giao_hang 34 /
cskh_kinh_doanh 24 / thiet_ke 7 / quan_ly_ban_hang 6 / dich_vu 5 /
cntt_ky_thuat 5 / giao_duc_giang_day 3 (합계 273, DB 직접 재조회로 확인).

### D. 프론트엔드 전체 반영
- [types/job.ts](src/types/job.ts) — `JobCategory` 13개로 교체.
- [data/categories.ts](src/data/categories.ts) — LABELS/SHORT/ICONS/SOLID/
  COLORS/ALL_CATEGORIES 전부 13개로 재작성.
- [data/subcategories.ts](src/data/subcategories.ts) — classifier.py의
  `SUBCATEGORY_LABELS`를 Python 스크립트로 그대로 변환해 재생성(158개,
  손으로 옮기다 어긋나는 위험 차단).
- **중대 발견**: [lib/jobCategoryRules.ts](src/lib/jobCategoryRules.ts)(이번에
  삭제)가 `jobRows.ts`의 `rowToJob()`과 `JobCard.tsx`에서 호출되며 **매번
  title/company/description으로 카테고리를 다시 계산해 DB 값을 덮어쓰고
  있었다** — classifier.py를 아무리 잘 고쳐도 이 파일 때문에 화면엔 반영이
  안 될 뻔했음. 옛 7분류 그대로인 구식 정규식이라 타입도 안 맞았음 —
  제거하고 `job.category`(DB 값)를 그대로 신뢰하도록 변경. `JobCard.tsx`의
  중복 `CATEGORY_TAGS`도 제거하고 `data/categories.ts`의 `CATEGORY_SHORT`
  재사용.
- 그 외 컴파일 오류 8개 파일 수정: `categoryVisuals.ts`(카테고리별 이미지),
  `brandCandidates.ts`/`.test.ts`(브랜드 후보 탐지 대상 업종), `mockJobs.ts`
  (샘플 데이터 25건), `RecommendSection.tsx`/`Community.tsx`(카테고리
  선택 UI — 하드코딩 부분집합 대신 `ALL_CATEGORIES` 전체 사용으로 변경),
  `AdminDashboard.tsx`(중복 라벨 정의 제거, `data/categories.ts` 재사용),
  `recommendStorage.test.ts`.

## 테스트 결과

- **크롤러**: `classifier.py` 자체 실행 — 대분류 22/22, 소분류 17/17, 새
  체계 매핑 16/16, 새 대분류 5개 12/12 = **총 67/67 통과**. `test_job_quality.py`
  19/19 회귀 없음.
- **프론트**: `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test`
  6/6 파일 전부 통과(59개 테스트, 회귀 없음).
- **DB**: 백필 후 `select category, count(*) from local_jobs group by
  category`로 직접 재조회해 273건 분포 확인(위 C 섹션 표와 정확히 일치).
- **실 브라우저**: 로컬 개발 서버에서 "Ngành nghề" 패널 열어 "Sản xuất ·
  Xây dựng · Lao động phổ thông" 클릭 → 실제 DB 백필된 소분류(Sản xuất/Gia
  công/Lắp ráp, Xuất nhập kho/Quản lý kho 등) 정상 표시 확인 — 크롤러→DB→
  프론트 전체 파이프라인 end-to-end 확인.
- id=4381/4430 두 버그 수정 후 실제 텍스트로 재확인: 각각 정상적으로
  quan_ly_ban_hang/other(khac)로 재분류됨, "lẩu bò" 진짜 전골 공고는 여전히
  am_thuc_do_uong로 정확히 분류됨(회귀 없음).

## 발견된 문제

- **jobCategoryRules.ts가 DB 분류 결과를 매번 덮어쓰던 문제**(위 D 참고,
  이번에 발견·제거) — 앞으로 프론트에서 카테고리를 다시 "추정"하는 코드를
  추가하지 말 것. `job.category`(DB 값)가 유일한 진실 공급원.
- **truyen_thong/y_te_dieu_duong 분류 규칙 미검증**(위 B 참고) — 실제 공고
  들어오면 재검증 필요, 자동으로 규칙이 추가되지 않음(수동 작업).
- **PostJob.tsx(기업 직접 등록)에 소분류 선택 필드가 여전히 없음** — 대분류
  드롭다운은 새 13개로 자동 반영됐지만(ALL_CATEGORIES 참조), 소분류는
  여전히 미착수. 크롤링 공고와 달리 직접 등록은 정규식 추정이 아니라
  드롭다운으로 100% 정확하게 받을 수 있어 우선순위 있음.
- `categoryVisuals.ts`의 이미지가 5개 신규 대분류(cntt_ky_thuat/thiet_ke/
  truyen_thong/y_te_dieu_duong/giao_duc_giang_day)는 전용 사진 없이 'khac'
  일반 이미지로 폴백 — 기능은 정상(에러 없음), 장식적 완성도만 낮음.
- (이전부터 있던 항목, 계속 유지) `applications_insert`의 tautology 조건,
  korea_jobs 구조 통합 미결정, 기업 계정 헤더에 구직자 메뉴 링크 없음.
- `.git/hooks/post-commit` 자동 push 훅 — 이번 라운드는 이 문서 작성 후
  커밋 여부를 사용자에게 먼저 확인할 것(작업 방식 변경 규칙 참고, 위 이전
  라운드 기록 섹션).

## 다음 결정사항

1. 이번 라운드(대분류/소분류 전면 재설계 + DB 백필 + 프론트 반영) 커밋할지.
2. PostJob.tsx에 소분류 드롭다운 추가(우선순위 있음 — 위 "발견된 문제" 참고).
3. truyen_thong/y_te_dieu_duong 분류 규칙을 언제 실제 데이터로 재검증할지
   (크롤러가 계속 새 공고를 가져오므로 주기적으로 category='khac' 표본을
   다시 확인하는 루틴이 있으면 좋음).
4. 지역/업종 2단 구조를 다른 화면(홈/저장한 공고/맞춤 공고/지도)에도
   확대할지 — 여전히 보류 중.
5. `categoryVisuals.ts`에 신규 5개 대분류 전용 이미지 추가할지.
6. korea_jobs 통합 / 공개 구직자 검색 — 착수 여부.
7. `applications_insert`의 tautology 조건 수정 여부.
8. 기업 계정 헤더에 "Việc làm" 링크 추가할지.
