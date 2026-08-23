# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=66071c8ce483a45ffc3eecff7c857f4c01a1645d` 기준으로 `cursor/job-quality-followups-a7d7` 브랜치에서 후속 1~5단계(카테고리 재분류, salary fallback, 공고 상세 링크 구조, GitHub Actions crawler 환경, npm audit)를 진행했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build`, `npm audit --audit-level=low`, `python3 crawler/test_job_quality.py`, `python3 crawler/classifier.py`, local production preview smoke 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- `crawler/classifier.py`와 신규 `src/lib/jobCategoryRules.ts`에 영업/시장개발, kỹ thuật/bảo trì/cơ điện, tư vấn tuyển sinh 등 규칙을 추가했다.
- 운영 DB 공개 샘플 기준 debt 정책 필터 후 `other`는 기존 221개에서 새 classifier 적용 시 148개로 감소 추정된다.
- `JobsContext.rowToJob`와 `JobCard`가 동일한 프론트 재분류 규칙을 사용한다.
- `crawler/job_quality.py`에 상세 본문 salary 추출 fallback을 추가했고 `crawl_topcv.py`가 목록 salary가 없을 때 사용한다.
- 홈 공고 카드 wrapper를 `NavLink`로 바꿔 `/viec-lam/:id` 상세 링크가 실제 DOM에 존재하도록 했다.
- GitHub Actions crawler workflow는 `crawler/requirements.txt` 기준으로 Python 의존성과 Chromium을 설치하도록 통일했다.
- `vite`, `@vitejs/plugin-react`, `jspdf`, `react-router-dom`을 최신으로 업데이트하고 Vite 8에 맞춰 `manualChunks`를 함수형으로 변경했다.

## 테스트 결과

- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- `npm audit --audit-level=low`: 통과, 0 vulnerabilities
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `python3 crawler/classifier.py`: 통과, 22/22 정확
- local production preview smoke: 홈 로드 및 `/viec-lam/` 상세 링크 1182개 확인

## 발견된 문제

- GitHub Actions crawler가 실제로 신규 수집을 시작하는지는 다음 scheduled run 또는 수동 workflow run 결과로 확인해야 한다. 이번 변경은 Actions 실행 환경 불일치를 줄이는 조치다.
- `other`가 148개 수준으로 남을 수 있으며, 세부 업종(수의/부동산/전문 상담 등)을 더 숨길지 분류할지는 다음 품질 정책 판단 대상이다.
- dependency major update를 포함했으므로 PR Preview와 운영 smoke를 merge 후 다시 확인해야 한다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. merge 후 운영 `viecganban.vn`에서 홈 공고 카드 상세 링크와 주요 카테고리 필터를 다시 smoke 확인한다.
3. 다음 scheduled crawler run에서 수집량이 0개인지 재확인하고, 계속 0개면 crawler selector/anti-bot 대응을 별도 작업으로 진행한다.
