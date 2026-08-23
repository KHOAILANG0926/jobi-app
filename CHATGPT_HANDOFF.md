# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=18ca4b3df38ca462e1975522eb63cba144446fdb` 기준으로 `cursor/facebook-db-payload-fix-a7d7` 브랜치에서 Facebook crawler 저장 payload 오류를 수정했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `python3 -m py_compile crawler/crawl_facebook.py`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- Facebook cookie 갱신 후 VPS에서 `crawl_facebook.py`가 실제로 로그인했고 8개 공고를 수집했다.
- 저장 단계에서 내부 정렬용 `is_local_priority` 필드가 `local_jobs` DB 컬럼에 없어 `PGRST204`가 발생했다.
- `crawler/crawl_facebook.py`의 `save_to_supabase`에서 DB insert 전 `is_local_priority`를 제거하도록 수정했다.

## 테스트 결과

- `python3 -m py_compile crawler/crawl_facebook.py`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- Facebook cookie는 VPS `.env`에 갱신 완료됐고 로그인/수집은 성공했다.
- 이 브랜치 merge 후 VPS에서 최신 master를 pull하고 `timeout 20m python3 -u crawl_facebook.py`를 다시 실행해 Supabase insert 성공 여부를 확인해야 한다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. merge 후 VPS에서 `cd /root/jobi && git pull origin master && cd crawler && timeout 20m python3 -u crawl_facebook.py`를 실행한다.
3. Supabase insert 성공, `facebook_jobs.json`, 운영 사이트 반영을 확인한다.
