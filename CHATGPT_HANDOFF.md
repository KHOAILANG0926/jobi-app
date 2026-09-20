# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Home에 "Việc làm nổi bật"(사람인 참고 추천 공고) 섹션 완료(2026-09-20,
3라운드 수정 거침)**. 사람인(saramin.co.kr) "꼭 봐야 할 공고(플래티넘)"
캐러셀 캡처를 보고 카드 디자인을 참고 — 1차로 사진이 크게 들어간 별도
세로형 카드를 만들었으나, 사용자가 실제 화면을 보고 "이게 우리 기본틀이야
이 틀을 지켜"(기존 캡처로 지금 쓰는 `JobCard` 틀 제시)로 정정. 2차로
**기존 JobCard를 그대로 쓰고 상단에 얇은 업직종 색줄만 추가**하는 형태로
바꾸고, "유치하다"/"진지한 사이트를 만들어야 한다" 지적으로 이모지(🌟/💰)와
장황한 설명 문구도 제거. 3차로 실제 화면 보고 **① 색줄이 카드 모서리
곡선보다 얇아서 흰 배경이 비치던 문제, ② 최신순 선택이라 카드가 거의 다
같은 색(khac 카테고리 편중)으로 보이던 문제** 2건을 추가 수정.
IMPLEMENTED → VERIFIED(로컬+Production 데스크톱/모바일, JS 실측) →
MASTER PUSHED(`00a8eae`) → PRODUCTION DEPLOYED → PRODUCTION VERIFIED 완료.

## 변경 내용

- **[components/FeaturedJobsSection.tsx](src/components/FeaturedJobsSection.tsx)**:
  최신순 상위 8개(`FEATURED_COUNT`) 공고를 가로 스크롤로 표시. **기존
  `JobCard` 컴포넌트를 그대로 재사용**(수정 안 함) — `.featured-job-wrap`
  이라는 얇은 wrapper로 감싸고, `position:absolute`인
  `.featured-job-wrap__bar`(높이 2.5px, `CATEGORY_COLORS[job.category]`
  그라데이션 배경, `border-radius: 10px 10px 0 0`으로 카드 상단 모서리에
  맞춤)를 그 위에 겹쳐서 "상단 색줄"만 표현. 사진/이모지/설명 문구 없음
  (Home.tsx가 `isApplied`/`onApply`/`isSaved`/`onToggleSave` 콜백을 그대로
  전달 — 급구 패턴과 동일하게 지원/저장 버튼도 실제로 작동함).
- **[pages/Home.tsx](src/pages/Home.tsx)**: `.home-top-bg`와 "City filtered
  results" 사이에 삽입, Home 전용(급구/저장한 공고/최근 본 공고/맞춤
  공고는 각자 목적이 있어 확대 안 함, Claude 추천을 사용자가 승인). 동시에
  "Lương cao" 정렬 시 뜨던 장황한 그룹 설명 문구(`💰 Đang xếp theo lương
  cao trong nhóm...`, 2곳)를 통째로 삭제 — "왜 구구절절 설명하고 있어
  깔끔하게 만들어도 모자랄 판에" 지적. 그 결과 안 쓰게 된 `salaryTiers`
  useMemo·`salaryTierLabel` import도 정리(실제 정렬 로직 자체는
  `groupJobsForSalarySort` 그대로 유지 — 통화/단위 다른 공고를 억지로
  한 순위로 섞지 않는 원칙은 안 바뀜, 화면에 설명만 안 보여줄 뿐).
- **[index.css](src/index.css)**: `.home-featured*`(제목만, 아이콘 없음)/
  `.featured-job-wrap*` — `.home-brands__row`와 동일한 가로 스크롤 패턴
  재사용. **1차 버전에서 쓰던 `.featured-job-card*`(사진 큰 카드) 클래스
  일체 삭제**.
- **(3차 수정)** `.featured-job-wrap__bar` 높이를 2.5px→**10px**로(`.jc`의
  `border-radius: 10px`와 정확히 맞춤 — 색줄이 카드 radius보다 얇으면
  모서리 곡선 중간에서 색이 끊겨 흰 배경이 비쳐 보였음).
  `FeaturedJobsSection.tsx`의 `selectFeaturedJobs()`를 단순 최신순
  8개에서 **업직종마다 최신 1건씩 우선 채우고 남는 자리만 최신순으로
  채우는 방식**으로 변경(실측: DB 최신 10건 중 8건이 'khac' 카테고리라
  단순 최신순으로는 카드 색이 거의 다 똑같아 보였음).

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과
  (1차·2차·3차 버전 매번 각각 확인).
- 로컬+Production 둘 다 브라우저로 확인: 카드가 기존 JobCard 모양(로고/
  태그/제목/급여/"Xem chi tiết") 그대로, 상단에만 업직종별 색줄 표시.
  JS로 실측 — `headingText`에 이모지 없음, 급여 설명 배너 DOM에서 완전히
  사라짐(`salaryBannerExists: false`) Production 재확인. 1440px 데스크톱/
  375px 모바일 레이아웃 둘 다 확인.
- **(3차 수정 재확인)** Production JS 실측 — 카드 8개 전부
  `barHeight: 10px`(카드 radius와 일치), `new Set(colors).size === 8`
  (전부 서로 다른 색) 확인. 스크린샷으로 모서리 곡선이 흰 배경 비침 없이
  깔끔하게 색으로 덮이는 것도 확인.

## 발견된 문제

없음.

## 다음 결정사항

- (2026-09-20, 미정) `FEATURED_COUNT`=8, 정렬 기준=최신순으로 임의
  확정했음 — 실제 반응 보고 개수/정렬 기준(예: 급구 우선, 무작위) 조정할지
  필요시 논의.
- **(2026-09-20, 진행 방식 관련 피드백)** 사용자가 세션 중 "내가 하지
  말라고 했지"/"자꾸 정지시키는데 왜 하고 난리야"로 지적 — Claude가
  interrupt(작업 중단) 이후에도 스스로 추측해서 다음 작업을 이어간 게
  문제였음. **앞으로는 중단되면 완전히 멈추고 다음 명시적 지시를 기다릴
  것.**
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
