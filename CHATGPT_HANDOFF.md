# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=0cbd5cbb046951aa45d4aa9f46570df74a064aab` 기준으로 `cursor/facebook-auth-detection-a7d7` 브랜치에서 Facebook cookie 만료/로그인벽 감지를 추가했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `python3 -m py_compile crawler/crawl_facebook.py`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- `crawler/crawl_facebook.py`에 `is_login_wall(page)`를 추가해 `Đăng nhập`, `Mở ứng dụng`, `log in` 등 Facebook 로그인벽/앱 유도 shell을 감지한다.
- desktop group과 mobile fallback 모두 로그인벽이면 “Facebook cookie 갱신 필요” 로그를 남기고 0개 수집을 정상 수집처럼 오판하지 않는다.
- `crawler/README.md`에 Facebook cookie 갱신 절차와 수동 확인 명령을 추가했다.
- VPS 진단에서 `m.facebook.com/groups/timvieclamthembacninh`는 title/body가 공개 그룹 shell과 `Đăng nhập/Mở ứng dụng`을 보여줬고, post selector count는 0이었다. 즉 현재 Facebook cookie는 유효 세션이 아니다.

## 테스트 결과

- `python3 -m py_compile crawler/crawl_facebook.py`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- 현재 Facebook 수집 0개의 1차 원인은 selector가 아니라 만료/무효 cookie 또는 Facebook 계정 checkpoint/그룹 접근권한 문제로 확인됐다.
- 새 cookie(`FB_C_USER`, `FB_XS`, 필요 시 `FB_DATR`, `FB_FR`)를 VPS `.env`에 갱신해야 Facebook crawler live 검증이 가능하다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. 사용자가 PC 브라우저에서 Facebook cookie를 새로 복사해 VPS `.env`에 갱신한다.
3. 갱신 후 VPS에서 `FACEBOOK_CRAWLER_TIMEOUT=20m CRAWLER_TARGET_COUNT=80 ./run_daily.sh`를 다시 실행해 Facebook article 후보/수집 개수를 확인한다.
