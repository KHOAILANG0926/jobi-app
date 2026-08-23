# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=12be7a75b3fce17118343ad879cdda089cf0fa1a` 기준으로 `cursor/azdigi-crawler-schedule-a7d7` 브랜치에서 AZDIGI/Vietnam VPS를 공식 crawler 실행 서버로 쓰기 위한 daily runner와 20:00 Vietnam time crontab 기준을 추가했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `bash -n crawler/run_daily.sh`, `bash -n crawler/deploy.sh`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- `crawler/run_daily.sh`를 추가했다. Vieclam24h crawler는 항상 실행하고, `.env`에 `FB_C_USER`와 `FB_XS`가 있을 때만 Facebook crawler를 이어서 실행한다.
- `crawler/deploy.sh`는 `python3 -m pip install -r requirements.txt`, `python3 -m playwright install --with-deps chromium`, `chmod +x run_daily.sh`를 수행한다.
- `crawler/deploy.sh` crontab은 매일 `13:00 UTC = 20:00 Vietnam time`에 `./run_daily.sh`를 실행하도록 변경했다.
- crawler 로그는 `/var/log` 대신 `$HOME/jobi/crawler/crawl_daily.log`에 남기도록 변경해 일반 VPS 사용자 권한에서도 쓰기 가능하게 했다.
- `crawler/.env.example`에 Facebook crawler용 `FB_C_USER`, `FB_XS`, `FB_DATR`, `FB_FR` 키 이름만 추가했다. 실제 secret 값은 추가하지 않았다.
- `crawler/README.md`를 AZDIGI/Vietnam VPS 20:00 운영 기준, daily runner, Facebook optional 실행 기준으로 갱신했다.

## 테스트 결과

- `bash -n crawler/run_daily.sh`: 통과
- `bash -n crawler/deploy.sh`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- 실제 AZDIGI VPS 접속은 아직 하지 않았다. VPS IP/계정/SSH 접속 방식이 필요하다.
- Supabase service role과 Facebook cookie 값은 repo에 넣지 않는다. VPS의 `crawler/.env`에 직접 입력해야 한다.
- Facebook cookie가 없으면 `run_daily.sh`는 Facebook crawler를 실패시키지 않고 skip한다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. AZDIGI VPS 접속 정보를 확보하면 `curl -sSL https://raw.githubusercontent.com/KHOAILANG0926/jobi-app/master/crawler/deploy.sh | bash` 또는 repo pull 후 `crawler/deploy.sh`를 실행한다.
3. VPS에서 `crawler/.env`를 설정한 뒤 `./run_daily.sh` 수동 실행, `crawl_daily.log`, Supabase row 증가, 운영 사이트 반영을 확인한다.
