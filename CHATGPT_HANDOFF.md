# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=57502d38c427011fdc5785c18b4d506b068b5880` 기준으로 `cursor/facebook-db-zalo-fix-a7d7` 브랜치에서 Facebook crawler 저장 payload의 추가 DB 컬럼 불일치를 수정했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `python3 -m py_compile crawler/crawl_facebook.py`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- Facebook cookie 갱신 후 VPS에서 `crawl_facebook.py`가 실제로 로그인했고 5개 이상 공고를 수집했다.
- 직전 수정으로 `is_local_priority`는 제거됐지만, 저장 단계에서 `zalo` 필드도 `local_jobs` DB 컬럼에 없어 `PGRST204`가 발생했다.
- `crawler/crawl_facebook.py`의 `save_to_supabase`에서 DB insert 전 운영 `local_jobs` 컬럼 allowlist에 포함된 키만 전송하도록 수정했다. 앞으로 임시 필드가 추가돼도 DB insert가 같은 방식으로 깨지지 않는다.
- Facebook 추출 품질도 함께 보강했다. 돈/스팸성 비공고 패턴을 제외하고, `CÔNG TY...`/`... TUYỂN DỤNG` 기반 company 추출을 개선했으며, Facebook 전용 단순 분류 대신 공통 `classifier.classify()`를 사용한다.

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
