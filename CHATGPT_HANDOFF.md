# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=835d6a894da50cb65dd762310d0f8a41ee1cc8f3` 기준으로 `cursor/facebook-crawler-recovery-a7d7` 브랜치에서 Facebook crawler의 article 0개 문제를 줄이기 위한 fallback/selector 개선을 진행했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `python3 -m py_compile crawler/crawl_facebook.py`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- `crawler/crawl_facebook.py`에 desktop group feed가 article 0개일 때 `m.facebook.com` mobile group URL로 재시도하는 fallback을 추가했다.
- Facebook post 후보 selector를 `[role="article"]` 단독에서 `div[aria-posinset]`, `div[data-ft]`, `[data-ad-preview="message"]` 기반으로 확장했다.
- post text 추출은 가장 긴 `[dir=auto]` 하나가 아니라 후보 node들의 고유 텍스트를 합쳐서 사용하도록 보강했다.
- `See more` / `Xem thêm` / `더 보기` 버튼 확장 로직을 공통화했다.
- article 후보 수와 mobile fallback 사용 여부를 로그로 남겨 VPS에서 실제 실패 원인 확인이 쉬워졌다.

## 테스트 결과

- `python3 -m py_compile crawler/crawl_facebook.py`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- 실제 Facebook 수집 성공 여부는 VPS의 유효한 Facebook cookie와 실제 로그인 세션으로만 검증 가능하다. 현재 Cloud 환경에는 Facebook cookie가 없어 live Facebook 검증은 하지 못했다.
- 사용자가 제공한 기존 정보에 따르면 VPS의 Facebook crawler는 로그인 확인 후 article 0개였고 cron에도 등록되지 않았다. 직전 PR #6은 cron 경로를 추가했고, 이번 변경은 article 0개 상황을 줄이는 crawler 내부 보강이다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. merge 후 AZDIGI VPS에서 `cd /root/jobi && git pull origin master && cd crawler && ./run_daily.sh`를 실행해 Facebook 수집량과 `crawl_daily.log`를 확인한다.
3. Facebook이 계속 0개면 cookie 만료/계정 checkpoint/그룹 접근 권한 문제를 우선 확인한다.
