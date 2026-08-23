# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=ca592f8f1cf78295abc20521df6c4cc9064efaca` 기준으로 `cursor/filter-debt-jobs-a7d7` 브랜치에서 대출/채권회수/추심 성격의 공고를 crawler와 운영 프론트 노출에서 제외하는 정책을 추가했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build`, `python3 crawler/test_job_quality.py`, `python3 crawler/classifier.py` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- `crawler/job_quality.py`에 `thu hồi công nợ`, `công nợ`, `đòi nợ`, `vay tiền`, `tín dụng`, 소비자금융/collection/loan 계열 키워드 제외 규칙을 추가했다.
- `crawler/crawl_topcv.py`는 기존 payload 품질 검증을 통해 대출/채권회수 공고를 신규 수집 단계에서 스킵한다.
- `crawler/crawl_facebook.py`도 Facebook 게시글 텍스트 단계에서 같은 대출/채권회수 공고를 스킵한다.
- `src/lib/jobQualityFilter.ts`를 추가해 운영 프론트가 Supabase에서 읽은 기존 공고 중 같은 유형을 숨긴다.
- `src/context/JobsContext.tsx`에서 기존 DB 공고 로딩과 기업 신규 등록 draft에 공개 정책 필터를 적용한다.
- `crawler/test_job_quality.py`에 사용자가 제공한 `thu hồi công nợ` 사례 기반 회귀 테스트를 추가했다.

## 테스트 결과

- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `python3 crawler/classifier.py`: 통과, 19/19 정확

## 발견된 문제

- 이 변경은 UI에서 기존 부적합 공고를 숨기고 crawler의 신규 유입을 막지만, 운영 DB의 기존 행을 삭제하거나 `active=false`로 바꾸지는 않는다.
- 운영 DB에서 이미 들어간 부적합 공고를 영구 비활성화하려면 service role 또는 관리자 도구로 별도 정리해야 한다.
- `npm ci` 과정에서 기존 lockfile 기준 npm audit 취약점 경고(1 low, 5 moderate, 3 high, 1 critical)가 표시된 상태는 유지된다. 이번 작업 범위에서는 dependency 변경을 하지 않았다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. 운영 DB의 기존 대출/채권회수 공고를 완전히 숨김 처리할지(`active=false` 등)는 별도 운영 권한으로 결정한다.
3. npm audit 경고 처리는 별도 dependency 정비 작업으로 분리한다.
