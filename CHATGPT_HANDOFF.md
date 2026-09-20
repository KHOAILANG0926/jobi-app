# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Home에 "Việc làm nổi bật"(사람인 참고 추천 공고) 섹션 추가 완료
(2026-09-20)**. 사용자가 사람인(saramin.co.kr) "꼭 봐야 할 공고
(플래티넘)" 캐러셀 캡처를 보여주며 카드 디자인(상단 색줄+회사정보+사진
분할)을 참고하고 싶다고 함 — 조사 결과 그 색줄은 유료 광고 등급 구분용
(우리는 그런 상품 없음)이었지만, 사용자가 "순수 디자인만 참고해서
적용"으로 확정(사람인 사진을 그대로 가져다 쓰는 안은 저작권+다른 회사
사진을 우리 회사에 붙이는 거짓 정보 문제로 명시적으로 제외). 설계 논의
(적용 범위/색 기준/사진 출처)를 거쳐 구현까지 완료.
IMPLEMENTED → VERIFIED(로컬+Production 데스크톱/모바일 스크린샷) →
MASTER PUSHED(`d1ef71f`) → PRODUCTION DEPLOYED → PRODUCTION VERIFIED 완료.

## 변경 내용

- **[components/FeaturedJobsSection.tsx](src/components/FeaturedJobsSection.tsx)**
  신규: `image_url`이 있는 공고만 후보로(사진 없으면 카테고리 일반
  이미지로 때우지 않고 아예 후보 제외 — "의미없는 이미지" 지적 반영),
  최신순 상위 8개(`FEATURED_COUNT`)를 가로 스크롤 카드로 표시. 카드
  상단 색줄은 `CATEGORY_COLORS`(업직종별, 기존 `data/categories.ts`
  재사용 — 새로 정의 안 함) 재사용. 클릭 시 `/viec-lam/:id` 상세 페이지로
  이동. `JobCard.tsx`의 `sanitizeSalary()` 재사용.
- **[pages/Home.tsx](src/pages/Home.tsx)**: `.home-top-bg` 섹션과
  "City filtered results" 섹션 사이에 `<FeaturedJobsSection jobs={jobs} />`
  삽입 — Home 전용(급구/저장한 공고/최근 본 공고/맞춤 공고는 각자 이미
  명확한 목적이 있어 중복·부적합하다고 판단, 확대 안 함 — "니 생각 좀
  알고싶어" 질문에 Claude가 이유를 설명하고 사용자가 동의).
- **[index.css](src/index.css)**: `.home-featured*`/`.featured-job-card*`
  신규 클래스 — `.home-brands__row`와 동일한 가로 스크롤 패턴
  (`overflow-x:auto; scrollbar-width:none`) 재사용, 카드 폭 220px 고정,
  사진 높이 120px.

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- 로컬 브라우저로 Home 확인: 카드마다 다른 업직종 색(주황/청록 등) 정상
  렌더, 사진·회사명·제목·급여·지역 정상 표시, 가로 스크롤 정상 작동.
  1440px 데스크톱/375px 모바일 둘 다 레이아웃 확인.
- Production(`viecganban.vn`)에서 동일 화면 스크린샷으로 재확인 —
  로컬과 동일하게 렌더됨.

## 발견된 문제

없음.

## 다음 결정사항

- (2026-09-20, 사람인 카드 디자인 논의에서 파생, 미정) `FEATURED_COUNT`
  =8, 정렬 기준=최신순으로 임의 확정했음 — 실제 반응 보고 개수/정렬
  기준(예: 급구 우선, 무작위) 조정할지 필요시 논의.
- (사용자가 명시적으로 미룸) 헤더 "Đăng ký"/로고 빨강을 포함한 전체
  색 체계 재검토 — 필요시 다음에 요청하기로 함.
- (낮은 우선순위, 아직 요청 안 됨) `index.css`에 예전 단순 버전
  MapView.tsx가 쓰던 `.mapview__*` 죽은 CSS 규칙 22개가 남아있음.
- (별개 논의, 미정) 구글 로그인(OAuth) — Google Cloud Console 외부
  설정이 필요해 보류.
- (별개 논의, 미정) 전화번호(SMS) 인증 — 외부 SMS 서비스 필요해 보류,
  "등록 없이 빠르게 게시"로 사실상 같은 목적 달성.
- (별개 논의, 미정) 기업용 "인재 검색" 기능 부재 — 응답 없이 스킵됨.
- (별개 논의, 미정) korea_jobs 구조를 비엣간반 본체와 나중에 분리할
  가능성 — 관련 기능은 로컬 상태/프론트 레벨에서 해결, 본체 DB 스키마와
  깊게 엮는 선택 지양.
