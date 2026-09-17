# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**커밋 완료(`227c0b1`), master push + Vercel Production 배포 + 실사이트 확인까지 완료**:
급구(Tuyển gấp) 페이지 "Ngành nghề"(업직종) 대분류 필터의 클릭 동작 결함
수정 — 사용자가 실제 화면 캡처로 "대분류를 클릭해서 다른 걸 눌러도 이전
선택이 안 지워진다"고 보고, 코드 확인 후 원인 특정, 알바몬 참고 캡처본으로
정확한 의도 동작(대분류 클릭=탐색 전용, 실제 필터 선택은 오른쪽 목록에서만)
확인 후 수정.

## 변경 내용

### 대분류/소분류 탐색·선택 분리 — [UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)
**원인**: `toggleCategory` 함수가 클릭 한 번에 `setActiveCategoryForSub(c)`
(오른쪽에 어느 대분류의 소분류를 보여줄지, 탐색용)와 `categoryIds` 토글
(실제 필터 선택)을 동시에 실행했다. 코드 주석에는 "이 둘은 별개 상태"라고
설계 의도가 적혀 있었지만 실제 구현은 하나로 묶여 있었음 — 소분류를
구경하려고 다른 대분류를 클릭할 때마다 이전에 클릭했던 대분류가 필터에
계속 쌓이는 버그였다.

**수정**:
- `toggleCategory` → `activateCategory`(탐색 전용, `activeCategoryForSub`만
  변경)와 `toggleCategoryAll`(선택 전용, `categoryIds` 토글)로 분리.
- 왼쪽 대분류 목록 클릭 = `activateCategory`만 호출(선택 상태 `is-selected`
  클래스 제거, 탐색 표시 `is-active`만 유지).
- 오른쪽 소분류 목록 맨 위에 **"Tất cả <대분류명>"** 항목을 새로 추가 —
  클릭 시 `toggleCategoryAll` 호출, 대분류 전체를 필터로 선택하는 기존
  기능(예: "Nhà máy / Công nghiệp" 전체 검색)을 이 항목으로 그대로 유지.
- **부수 효과로 발견·같이 고침**: 소분류가 없는 'Khác' 카테고리는 원래
  오른쪽 패널에 안내 문구만 뜨고 선택 가능한 요소가 전혀 없었는데(대분류
  자체를 왼쪽에서 선택하던 예전 방식에 의존), "Tất cả Khác" 항목이 생기면서
  다시 선택 가능해짐.
- CSS: `.jm-region-col__hint-inline`(그리드 안에서 안내문 한 줄 전체 폭 차지)
  추가, 업직종 패널 폭 640px→760px로 확대(사용자가 알바몬 캡처본 보여주며
  "가로로 넓게 해놔서 보기편해"), 결과 표 헤더를 회색 배경+연한 글씨에서
  흰 배경+굵은 검은 글씨+굵은 하단선으로(알바몬 캡처본 참고).

## 테스트 결과

- `npx tsc --noEmit` / `npm run build` / `npm test`(6개 파일, 59개 테스트)
  전부 통과.
- 로컬 개발 서버(`localhost:5173`)에서 실제 클릭 시나리오 확인: "Nhà máy"
  클릭(탐색만, 선택 안 됨) → "Quán cà phê" 클릭 → JS로 두 버튼의 class 직접
  확인, "Nhà máy"에 `is-selected` 없음/"Quán cà phê"에 `is-active`만 있음
  확인. "Tất cả Quán cà phê" 클릭 → "Ngành nghề (1)"로 정확히 반영, 결과
  즉시 필터링됨 확인. "Khác" 클릭 → "Tất cả Khác" 항목 노출 확인(소분류
  없는 카테고리도 다시 선택 가능).
- **Production(viecganban.vn) 실사이트에서 동일 시나리오 재확인**: master
  push 직후 Vercel GitHub 연동으로 자동 배포된 것을 `vercel ls`로 확인
  (push 33초 후 새 Production 배포 Ready), 실사이트에서 "Nhà máy" →
  "Quán cà phê" 전환 시 JS로 class 재확인, 로컬과 동일한 결과.

## 발견된 문제

- **Vercel CLI 로그인 세션이 이 PC(집)에서 유효하지 않음**(`vercel whoami`/
  `vercel --prod` 모두 "User not found"/토큰 무효 오류) — 단, 이 저장소는
  GitHub↔Vercel 연동이 돼 있어서 `git push`만으로 Production 자동 배포가
  실제로 일어남(CLI 로그인 없이도 확인됨). CLI가 필요한 작업(로그·환경변수
  조회 등)을 이 PC에서 하려면 `vercel login`으로 재인증 필요 — TWO-PC 규칙상
  이건 PC-local 항목이라 별도 조치 불필요, 그냥 필요할 때 재로그인하면 됨.
- (이전 라운드에서 이미 기록된 항목, 계속 유지) PostJob.tsx에 소분류 로직
  없음, `applications_insert`의 tautology 조건, korea_jobs 구조 통합 미결정
  — 전부 그대로 미결정 대기.

## 다음 결정사항

1. 지역/업종 2단 구조를 다른 화면(홈/저장한 공고/맞춤 공고/지도)에도
   확대할지.
2. PostJob.tsx에 소분류 로직 추가 방식(드롭다운 vs 자동 추정).
3. korea_jobs 통합 / 공개 구직자 검색 — 착수 여부.
4. `applications_insert`의 tautology 조건 수정 여부.
5. 결과 표(모집제목/기업명/급여/근무시간/등록일)에 알바몬처럼 리스트/그리드
   보기 전환 토글이나 등록일 범위 필터를 추가할지 — 이번 라운드에서는
   헤더 스타일만 다듬고 이 두 기능은 범위 밖으로 보고 손대지 않음(사용자
   확인 필요).
