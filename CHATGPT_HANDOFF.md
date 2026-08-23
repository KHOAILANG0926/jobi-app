# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=4053234a781b54e1638d94d98d5070974f653988` 기준으로 `cursor/crawler-runner-timeouts-a7d7` 브랜치에서 VPS daily crawler 운영 안정화를 진행했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `bash -n crawler/run_daily.sh`, `python3 -m py_compile crawler/crawl_topcv.py crawler/crawl_facebook.py`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- `crawler/run_daily.sh`가 Facebook crawler를 먼저 실행하고, 이어서 Vieclam24h crawler를 실행하도록 바꿨다. TopCV 장시간 실행 때문에 Facebook 단계가 막히지 않게 하기 위함이다.
- `run_daily.sh`는 `python3 -u`로 실행해 VPS 로그가 즉시 flush되도록 했고, 각 crawler에 `timeout`을 적용한다.
- 기본 timeout은 `FACEBOOK_CRAWLER_TIMEOUT=45m`, `TOPCV_CRAWLER_TIMEOUT=60m`이며 env로 덮어쓸 수 있다.
- `crawler/crawl_topcv.py`의 `TARGET_COUNT`를 `CRAWLER_TARGET_COUNT` env로 조절 가능하게 했다.
- `crawler/requirements.txt`의 Supabase Python SDK를 `supabase==2.31.0`으로 올리고 `websockets>=15,<16`을 추가했다. VPS의 새 `sb_secret...` Supabase Secret key가 최신 SDK에서 정상 client 생성됨을 확인했다.

## 테스트 결과

- `bash -n crawler/run_daily.sh`: 통과
- `python3 -m py_compile crawler/crawl_topcv.py crawler/crawl_facebook.py`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- `python3 -m pip install -r crawler/requirements.txt`: 통과

## 발견된 문제

- VPS에서 기존 `run_daily.sh`를 실행했을 때 Vieclam24h 단계가 20분 이상 출력 없이 지속되어 중단했다. 이 때문에 Facebook이 뒤에서 막히는 구조가 확인됐다.
- VPS의 `.env`에는 새 Supabase Secret key(`sb_secret...`)가 들어 있으며, 구버전 `supabase==2.4.6`에서는 invalid key였지만 `supabase==2.31.0` + `websockets>=15`에서는 `create_client`가 성공했다.
- 이 브랜치 merge 후 VPS에서 `git pull origin master && python3 -m pip install -r requirements.txt && ./run_daily.sh`를 다시 실행해야 한다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. merge 후 AZDIGI VPS에서 최신 master와 requirements를 pull/install하고 `FACEBOOK_CRAWLER_TIMEOUT=20m CRAWLER_TARGET_COUNT=80 ./run_daily.sh`로 수동 smoke를 실행한다.
3. Facebook이 계속 0개면 cookie 만료/계정 checkpoint/그룹 접근 권한 문제를 우선 확인한다.
