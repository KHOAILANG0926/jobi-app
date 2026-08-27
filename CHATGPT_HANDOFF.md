# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`fix/home-brand-jobcard-logo-size` 브랜치(master 기준)에서 홈 화면의 브랜드 원형 로고와
공고 카드 로고가 이전보다 작아 보인다는 지적을 받아 원인을 조사하고 수정했다. 컨테이너
크기/60:40 비율/지역 패널은 건드리지 않았다. `feature/job-detail-redesign`(공고 상세페이지
재구성, 별도 브랜치)과는 독립적인 작업이다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 로컬 dev 서버에서
  `getBoundingClientRect`로 변경 전/후 실측 완료(데스크톱 1280px, 모바일 375px).
- `DEPLOYED`: 미완료 — 브랜치 push까지만, Production 배포는 사용자 승인 전.

## 변경 내용

- 원인 조사(`git log -p`로 히스토리 추적): 브랜드 원형 로고는 커밋 `5042a77`에서 60px→120px로
  키웠다가, 바로 다음 커밋 `4095128`("hero-row와 브랜드 카드 높이 동일하게 맞춤 240px")에서
  다시 120px→80px로 줄었다. 이후 60:40/120px 정렬 작업(`6b157f2`, `4336dd7` 등)은 이 80px
  값 자체를 다시 건드린 적이 없다 — 즉 "정렬 작업 중 로고가 작아졌다"가 아니라, 그보다 앞서
  일어난 축소가 이후 계속 남아있던 것.
- `src/index.css`:
  - `.home-brand__logo` 80px→96px(+20%), `.home-brand__logo-img` 52px→62px.
    `.home-brand`의 상하 padding(0.5rem)을 0으로 없애 늘어난 높이를 그대로 상쇄 —
    `.home-brands-section`/`.home-brands-box` 높이(120px)와 실제 콘텐츠 높이(117.8px)를
    변경 전과 완전히 동일하게 유지. `.home-brands-box__row`/`__track`의 버튼 간 gap도
    0.75rem→0.5rem으로 살짝 줄여 한 화면에 보이는 브랜드 개수 감소를 최소화했다(1280px
    기준 실측 약 4.6개 — "5~6개" 요구에는 근접, 완전히 못 미침. 더 넓은 화면에서는 자연히
    더 많이 보임).
  - `.jc__logo`(공고 카드 로고) 44px→56px. `.jc` 패딩(14px 14px 12px→12px 14px 10px),
    `.jc__logo-wrap`/`.jc__meta` margin-bottom(7px→5px), `.jc__footer` margin-top
    (10px→6px)을 줄여 늘어난 만큼을 정확히 상쇄 — 카드 전체 높이(185.775px)와 제목 2줄
    clamp 높이(47.1px)를 변경 전과 완전히 동일하게 유지(제목이 잘리지 않음).
  - `.home-brands-region-grid`(60:40), `.home-region-panel`, 그 하위 지역 관련 CSS는
    전혀 수정하지 않았다.

## 테스트 결과

- `npx tsc --noEmit`: 통과(CSS만 수정, 영향 없음)
- `npm run build`: 통과
- 로컬 dev 서버 실측(`getBoundingClientRect`, 변경 전/후 비교):
  - `.home-brands-section` 높이: 120px → 120px(불변)
  - 브랜드 행 실제 콘텐츠 높이: 117.825px → 117.825px(byte 단위로 완전히 동일)
  - `.home-brand__logo`: 80×80 → 96×96
  - `.home-region-panel` 높이: 120px(불변, 미수정 확인)
  - `.home-brands-region-grid` grid-template-columns: 725.275px 483.525px(60.02:39.98,
    수정 전과 동일 비율)
  - `.jc`(공고 카드) 높이: 185.775px → 185.775px(불변)
  - `.jc__logo`: 44×44 → 56×56
  - `.jc__title` 높이: 47.1px → 47.1px(불변, 2줄 제목 안 잘림)
  - 모바일(375px)에서도 `.home-brands-section`=120px, `.jc`=185.775px 동일하게 확인,
    가로 스크롤 없음.

## 발견된 문제

- 브랜드 로고를 20% 키우면서 gap을 줄여도 1280px 화면 기준 한 번에 보이는 브랜드 수가
  약 4.6개로, 요청한 "5~6개"에 살짝 못 미친다. 로고를 더 키우거나(30% 쪽) 더 많은 개수를
  동시에 보이게 하려면 컨테이너 폭 자체를 넓히거나 gap을 더 줄여야 하는데, 후자는 버튼이
  서로 붙어 보여 지금 이상으로는 절충이 어렵다고 판단해 20%(96px) + gap 소폭 축소 선에서
  멈췄다. 더 크게 원하면 알려달라.
- 이 컴퓨터에 `node`/`npm`이 PATH에 없고 `D:\새 폴더 (2)\node.exe`에만 존재해 검증 시
  `.claude/launch.json`을 그 경로로 임시 변경했다가 검증 후 원복했다(커밋에는 포함 안 됨).

## 다음 결정사항

1. `fix/home-brand-jobcard-logo-size`를 PR로 올리고 Vercel Preview에서 실제 화면 재확인.
2. 브랜드 로고 표시 개수(현재 ~4.6개/1280px)가 부족하다고 판단되면 크기(20→25~30%) 또는
   컨테이너 폭 조정 여부를 사용자와 재협의.
3. 사용자 승인 후 master merge → Production 배포.
