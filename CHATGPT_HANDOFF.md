# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=063cd288be67a389834a4112699e4417b32cf353` 기준으로 `cursor/crawler-job-quality-a7d7` 브랜치에서 crawler/job quality와 Vieclam24h 상세 품질 개선을 진행했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build`, `python3 crawler/test_job_quality.py`, `python3 crawler/classifier.py` 통과
- `DEPLOYED`: 미완료, 브랜치 push 및 draft PR 생성 상태

## 변경 내용

- `crawler/classifier.py`의 office-vs-retail 우선순위를 보정해 `Telesale Part-time`, `Admin Bán Hàng Trực Page`가 office로 분류되도록 했다.
- `classifier.py` 자체 테스트가 실패 케이스를 발견하면 exit code 1로 종료하도록 변경했다.
- `crawler/job_quality.py`를 추가해 category 허용값, source tag, origin/admin_hidden/active, 마감일, salary/location 정규화, accent-insensitive dedupe key를 순수 함수로 검증한다.
- `crawler/test_job_quality.py`를 추가해 분류기, dedupe, salary/location, payload 품질 검증을 네트워크와 Supabase 없이 실행한다.
- `crawler/crawl_topcv.py`에서 상세 본문 fallback, payload 품질 스킵, 안정적인 중복 키, salary/location 정규화를 적용했다.

## 테스트 결과

- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `python3 crawler/classifier.py`: 통과, 19/19 정확

## 발견된 문제

- 현재 환경과 GitHub 원격에는 `jobi-app-patches` patch 파일/브랜치/ref가 없었고, 문서에 남은 `f6918ba2b974999e075bdcc3bed6f49349e301d5` 커밋도 원격에서 fetch할 수 없었다.
- 첫 검증 시 `node_modules`가 없어 `npx`가 잘못된 `tsc` 패키지를 임시 설치하려다 실패했다. `package-lock.json` 기준 `npm ci` 후 동일 검증은 모두 통과했다.
- `npm ci` 과정에서 기존 lockfile 기준 npm audit 취약점 경고(1 low, 5 moderate, 3 high, 1 critical)가 표시됐다. 이번 작업 범위에서는 dependency 변경을 하지 않았다.

## 다음 결정사항

1. 실제 운영 crawler에 반영하려면 draft PR 검토 후 merge/deploy 절차를 진행한다.
2. `jobi-app-patches` 원본 patch가 별도로 존재한다면 현재 브랜치와 diff 비교해 누락된 crawler-only 변경이 있는지 확인한다.
3. npm audit 경고 처리는 별도 dependency 정비 작업으로 분리한다.
