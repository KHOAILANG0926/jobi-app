# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`integration/job-detail-and-logo-fixes` 브랜치(master 기준)에서 두 작업을 통합했다.

1. 공고 상세페이지(`/viec-lam/:id`) "5초 판단" 재구성 — `feature/job-detail-redesign`
2. 홈 브랜드 로고/공고카드 로고 확대 — `fix/home-brand-jobcard-logo-size`
3. 브랜드 로고 1280px 최소 5개 완전 노출 보정(추가 작업, 통합 브랜치에서 직접 적용)

Home UI의 브랜드/지역 60:40 비율, 지역 패널, row 높이(120px)는 전 과정에서 수정하지 않았다.
사용자가 확인 질문 없이 master 반영 및 Production 배포까지 명시적으로 지시했다.

작업 상태: `IMPLEMENTED` / `VERIFIED` / `APPROVED`(사용자가 끝까지 진행을 지시) /
**`DEPLOYED`: 완료** — `master`에 merge·push(`85e502f`) 후 Vercel이 자동 배포했고
(commit status `success`), `https://viecganban.vn`에서 직접 재검증 완료(아래 참고).

## 변경 내용

### 1) JobDetail 재구성
- 헤더(상단 로고만) → 핵심 4항목 요약 줄 → `THÔNG TIN TUYỂN DỤNG` 통합 그리드 → Mô tả/Yêu
  cầu/Quyền lợi(복지는 원문에 실제 등장한 키워드만 chip) → 지도(조건부) → 회사정보(조건부) →
  리뷰 → sticky 사이드바.
- `Job` 타입에 `rawSalary`/`rawLocation`/`rawEducation`/`rawPreference`/`rawLat`/`rawLng`
  추가 — 기존 `ensureJobFields`의 폴백 주입(빈 값이어도 "Thỏa thuận"/"Không yêu cầu" 등을
  강제 주입하던 로직)과 분리해, 상세페이지는 원본에 값이 실제로 있을 때만 표시하고 없으면
  필드 자체를 숨긴다. 다른 화면(홈 카드 등)의 기존 동작은 그대로.
- 지도는 DB의 실제 `lat`/`lng`(추정 좌표 아님)가 있을 때만 섹션 자체를 렌더링, 기본 접힘 +
  `Xem bản đồ` 클릭 시 펼침. Leaflet 기본 마커 아이콘 깨짐도 자산 직접 import로 수정.
- 리뷰 0개일 때 작성 폼을 `Viết đánh giá` 버튼 뒤로 접음(리뷰 기능 자체는 유지).
- 본문 중앙에 회사 로고를 중복 표시하던 블록 제거(헤더 로고만 유지).

### 2) 홈 브랜드/공고카드 로고 확대
- 원인: 브랜드 원형 로고는 커밋 `5042a77`에서 60px→120px로 키웠다가 바로 다음 커밋
  `4095128`에서 120px→80px로 축소된 뒤, 이후 60:40/120px 정렬 작업들은 이 값을 다시 건드린
  적이 없었다(정렬 작업이 축소한 게 아니라 그 이전 축소가 계속 남아있던 것).
- `.home-brand__logo` 80px→96px(+20%), 이미지 52px→62px. `.home-brand`의 상하 padding을
  없애 늘어난 높이를 정확히 상쇄 — `.home-brands-section`/`.home-brands-box` 높이(120px)와
  실제 콘텐츠 높이(117.8px)를 완전히 동일하게 유지.
- `.jc__logo`(공고 카드) 44px→56px, 카드 padding/여백을 줄여 상쇄 — 카드 높이(185.775px)와
  제목 2줄 clamp 높이(47.1px)를 완전히 동일하게 유지.

### 3) 브랜드 로고 1280px 5개 노출 보정 (이번 통합 작업에서 추가)
- 문제: 96px로 키운 로고가 min-width 108px + gap 8px 조합에서 1280px 기준 약 4.6개만
  완전히 보임(사용자 요구: 최소 5개).
- `.home-brand`의 좌우 padding을 0.375rem(6px)→0으로 제거하고 `min-width`를 108px→96px로
  낮춰 로고(96px) 크기에 정확히 맞춤. gap(0.5rem=8px)은 그대로 유지.
- 결과: 슬롯 폭 = 96(로고, 좌우 padding 0) + 8(gap) = 104px. 1280px 기준 행 실사용 폭
  529.275px ÷ 104 ≈ 5.09개 → **5개 완전 노출** 요구 충족(아래 실측 참고). 60:40 비율,
  `.home-brands-section`/`.home-region-panel` 높이(120px), 지역 UI는 전혀 손대지 않았다.

## 테스트 결과

- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- 로컬 dev 서버 + 실제 Supabase 데이터로 확인:
  - **Home 1280px**: `.home-brands-section` 높이 120px(불변), `.home-region-panel` 높이
    120px(불변), `.home-brands-region-grid` 컬럼 비율 60:40 유지(불변), 브랜드 로고
    96×96px, **1280px에서 5개 이상 완전 노출 확인**, `.jc`(공고카드) 높이 185.775px(불변),
    `.jc__logo` 56×56px, `.jc__title` 2줄 clamp 유지(47.1px, 안 잘림).
  - **Home 1440px**: 위와 동일 원칙으로 확인(행 폭이 넓어져 1280px보다 더 많이 노출).
  - **Home 375px(모바일)**: 브랜드 섹션(1024px 이하에서 지역 패널만 숨김, 브랜드는 유지)과
    공고카드 모두 가로 스크롤 없음, 높이 불변 확인.
  - **JobDetail `sb-3888`(AQUACO, salary/location만 있고 나머지 전부 null)**: 데스크톱/
    모바일 모두 중앙 대형 로고 없음, 헤더 로고 정상 로드, 학력/경력/근무시간/근무일/모집인원
    필드 전부 숨김, Quyền lợi에 원문에 실제 등장한 항목만 chip 노출, 좌표 없어 지도 섹션
    전체 숨김, 지원/저장 버튼 정상.
  - **JobDetail `sb-3726`(로고 없음)**: 로고 자리에 회사명 이니셜 fallback, 깨진 이미지 없음.
- 운영 `local_jobs`에는 현재 `lat`/`lng`가 채워진 행이 0건이라, 지도 "펼침" 상태의 실제
  렌더링은 코드 리뷰 + Leaflet 자산 200 OK 확인으로 대체(좌표 있는 공고가 생기면 재확인 필요).

## 발견된 문제

- 이 컴퓨터에 `node`/`npm`이 PATH에 없고 `D:\새 폴더 (2)\node.exe`에만 존재해 검증 시
  `.claude/launch.json`을 그 경로로 임시 변경했다가 검증 후 매번 원복했다(커밋 미포함).
- `local_jobs`에 좌표가 있는 행이 0건이라 지도 섹션이 실질적으로 항상 숨김 상태(의도된
  동작, 버그 아님) — 좌표 있는 공고가 생기면 지도 펼침 상태를 실제로 재확인 필요.
- `sb-3726`처럼 크롤러가 location에 개행이 섞인 지저분한 텍스트를 넣는 경우가 있음 — 원본을
  그대로 표시하는 정책상 그대로 노출되며, 이번 작업 범위 밖(크롤러 데이터 정제 이슈)이라
  손대지 않았다.

## Production 배포 및 실사이트 검증 (완료)

- `master` merge commit `85e502f` push → GitHub commit status `Vercel: success`.
- `https://viecganban.vn`에서 직접 확인(1280px):
  - `.home-brands-section`/`.home-region-panel` 높이 120px(불변), 60:40 grid-template-columns
    725.275px:483.525px(불변), 브랜드 로고 96×96px, **1280px에서 5개 완전 노출 확인**.
  - `.jc`(공고카드) 높이 185.775px(불변), `.jc__logo` 56×56px.
  - `/viec-lam/sb-3888`(AQUACO): 이미지가 헤더 로고 1개뿐(중앙 대형 로고 없음), 빈 필드
    전부 숨김, 지도 섹션 없음(좌표 없음), `Ứng tuyển ngay`/저장 버튼 정상 렌더링.
  - 모바일(375px) 홈/상세 모두 `scrollWidth === innerWidth`로 가로 overflow 없음.

## 다음 결정사항

1. 좌표 있는 공고가 생기면 JobDetail 지도 펼침 상태를 실사이트에서 한 번 더 확인.
2. 브랜드 로고를 25~30%까지 더 키우고 싶다면 컨테이너 폭 조정이 필요 — 현재는 20%(96px)
   + 5개 노출 조건을 동시에 만족하는 선에서 고정.
