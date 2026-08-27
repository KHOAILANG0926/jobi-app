# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`fix/home-hero-4card-row` 브랜치(master 기준)에서 Home 상단 "Việc làm mới nhất" 영역의
"공고 1개 + 오른쪽 빈 공간" 문제를 고쳤다. 항상 정확히 4개 카드가 데스크톱 한 줄에 채워지고,
실제 긴급 공고가 4개 이상일 때만 `🔥 Tuyển gấp`로 표시한다. `Tất cả kết quả`(전체 목록)/
Header/Hero/검색창/Samsung 광고/로그인 CTA/브랜드·지역/JobDetail/지도 코드는 건드리지
않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 데스크톱(1280px)·모바일(375px)
  각 1회 실제 운영 데이터(긴급 공고 1건)로 확인.
- `DEPLOYED`: 완료 — master merge·push, Vercel 배포 성공, viecganban.vn에서 4카드 한 줄
  배치 재확인.

## 사전 확인 — 실제 긴급 공고 수

작업 전 운영 DB(`local_jobs`, `active=true`)를 직접 쿼리해 `urgent=true`가 **정확히 1건**
임을 확인했다(`sb-3734`, "...tuyển gấp 5nv làm tạp vụ..."). `ensureJobFields`의
`inferredUrgent`(제목/설명에 "tuyển gấp" 텍스트가 있으면 긴급으로 추정)는 `JobsContext.
rowToJob`이 이미 `urgent: (r.urgent as boolean) ?? false`로 null을 `false`로 확정해버려서
`j.urgent ?? inferredUrgent`가 항상 `j.urgent`로 결정되고 실질적으로 죽은 코드였다 — 즉
앱이 보여주는 긴급 공고 수는 DB의 `urgent=true` 개수와 정확히 같다. 1 < 4이므로 이번
작업에서 실제로는 `🔥 Tuyển gấp` 행이 아니라 "최신 일반공고 4개" 경로가 적용된다.

## 변경 내용

`src/pages/Home.tsx`:
- `urgentJobs`/`regularJobs` 계산 바로 아래에 파생값 3개 추가:
  - `heroShowsUrgent = urgentJobs.length >= 4`
  - `heroJobs = heroShowsUrgent ? urgentJobs.slice(0,4) : regularJobs.slice(0,4)`
  - `belowJobs`: `heroShowsUrgent`면 기존과 동일하게 `regularJobs` 그대로. 아니면
    `filtered.filter(j => !heroJobs.some(h => h.id === j.id))` — hero에 쓴 4개만 빼고
    나머지 전부(긴급으로 표시 안 된 1~3건 포함)를 그대로 아래 "Tất cả kết quả"에 남겨서,
    카드가 중복되지도 사라지지도 않게 했다(직접 확인 — 아래 검증 참고).
  - 렌더링부의 기존 `{!urgentOnly && urgentJobs.length > 0 && <JobGrid jobs={urgentJobs}
    title="🔥 Tuyển gấp" />}` 3줄짜리 블록을 `heroJobs`/`heroShowsUrgent`/`belowJobs` 기반
    으로 교체(제목은 `heroShowsUrgent`일 때만 `"🔥 Tuyển gấp"`, 아니면 `undefined`로 숨김).
    `urgentOnly`(사용자가 긴급만 필터링) 분기와 `nearMe` 분기는 전혀 손대지 않았다.
- 새 컴포넌트 `HeroJobCard`/`HeroJobGrid` 추가(기존 `JobGrid`/`JobCard` 바로 아래) — 표준
  `JobCard`(`.jc`)와는 별개의, 이 4카드 행 전용 컴포넌트다. 표준 JobCard를 직접 수정하면
  "Tất cả kết quả" 등 Home의 다른 목록에도 영향이 가서, 대신 `JobCard.tsx`에서 이미 있던
  `CompanyLogo`/`sanitizeSalary` 함수 앞에 `export`만 붙여 재사용했다(두 함수 자체의 동작은
  전혀 바꾸지 않음 — 표준 JobCard의 렌더링/스타일은 무영향).
  - 카드 내용: 큰 로고(72px, `CompanyLogo` 재사용) → 회사명·지역 한 줄 → 제목 2줄 clamp →
    급여. `#해시태그`·`Liên hệ Zalo` 버튼 없음. 카드 전체가 기존과 동일하게
    `<NavLink className="home-card-wrap">`로 감싸져 전체 클릭 가능.
  - 그리드 자체는 기존 `.home-jobs-grid`(모바일 1열 → ≥540px 2열 → ≥900px 4열)를 그대로
    재사용해 "Desktop 한 줄 4개"를 얻었다 — 새 grid CSS를 만들지 않았다.

`src/index.css`: `.hero-jc*` 신규 규칙만 추가(카드 shell, 72px 로고 오버라이드, meta/title/
salary). 기존 `.home-jobs-grid`/`.home-section`/`.home-card-wrap`/`.jc__logo` 등은 미수정.

`src/components/JobCard.tsx`: `CompanyLogo`, `sanitizeSalary` 앞에 `export` 추가(그 외
1글자도 변경 없음).

## 검증

- `npx tsc --noEmit`, `npm run build`: 각 1회 통과.
- **데스크톱(1280px), 실제 운영 데이터**: hero 카드 4개, 전부 같은 `top` 좌표(한 줄에 4개
  나란히) 확인. `🔥 Tuyển gấp` 제목 없음(긴급 1건 < 4라 정상), 카드에 `#`해시태그 없음,
  Zalo 버튼 없음, 로고 72×72px 확인. 가로 overflow 없음(1265 < 1280).
  - hero 4개 job id(`sb-3888`/`3914`/`3913`/`3912`)가 페이지 전체에서 정확히 1번씩만
    등장(중복 없음) 확인.
  - 유일한 긴급 공고(`sb-3734`)가 hero에는 없지만 "Tất cả kết quả" 목록에 그대로 남아있어
    사라지지 않았음을 확인(기존 `#Khẩn cấp` 표시도 그대로).
- **모바일(375px)**: hero 카드 4개(1열로 쌓임), 가로 overflow 없음.
- Production(viecganban.vn) 1회 확인: 4개 카드가 실제로 한 줄에 배치됨을 재확인(아래 참고).

## 발견된 문제

- 없음.

## 다음 결정사항

- 없음. `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`)는 여전히 별도 브랜치로 남아 있고
  master merge 여부는 미결정 상태(이번 작업과 무관).
