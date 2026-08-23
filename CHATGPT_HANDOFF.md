# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`master=46aa6179c6611a4dc0cb72cd5496f1d95fbcce69` 기준으로 `cursor/facebook-job-quality-cleanup-a7d7` 브랜치에서 Facebook 공고 품질 개선을 진행했다. Foundation/Admin/Auth/RLS/Profile/CV 구조는 변경하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `python3 crawler/test_facebook_quality.py`, `python3 -m py_compile crawler/crawl_facebook.py`, `python3 crawler/test_job_quality.py`, `npx tsc --noEmit`, `npm run build` 통과
- `DEPLOYED`: 미완료, 브랜치 작업/검증 상태

## 변경 내용

- Facebook 비공고/스팸성 돈 글(`rửa tiền`, `công đức`, `tiêu tiền`, `trả ... triệu`)을 job post로 보지 않도록 필터링했다.
- generic 제목(`TUYỂN NHÂN SỰ` 등)에 명확한 직무가 없으면 ambiguous로 보고 저장 전 skip한다.
- 짧은 role hint(`kho` 등)는 단어 경계로만 매칭해 `không` 같은 일반 단어 오탐을 막는다.
- `DISTRICT_PATTERN`의 `p.?`/`q.?` 과매칭을 고쳐 일반 단어의 `p`가 위치로 잡히지 않게 했다.
- Facebook salary range가 `8.5 – 10tr/tháng`처럼 `/tháng` suffix를 보존하도록 보정했다.
- company 추출에서 `Công ty có hỗ trợ...` 같은 복리후생 문장을 회사명으로 오인하지 않게 했다.
- `... TUYỂN DỤNG` heading에서 회사명 후보를 추출하고, 빈 company는 `Nhà tuyển dụng Facebook` fallback으로 채운다.
- Facebook 단순 분류 대신 공통 `classifier.classify()`를 사용한다.
- `crawler/test_facebook_quality.py`를 추가해 위 사례들을 offline 회귀 테스트한다.

## 테스트 결과

- `python3 crawler/test_facebook_quality.py`: 통과, 7/7 tests
- `python3 -m py_compile crawler/crawl_facebook.py`: 통과
- `python3 crawler/test_job_quality.py`: 통과, 3/3 tests
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- Facebook 수집/저장은 살아났지만, 일부 그룹은 여전히 0개 또는 timeout이다. 이 브랜치는 저장된 row 품질 개선에 집중한다.
- 기존에 이미 저장된 저품질 Facebook row는 이 변경으로 자동 정리되지 않는다. 필요하면 별도 DB cleanup이 필요하다.

## 다음 결정사항

1. 이 브랜치를 PR로 올리고 CI/Vercel Preview를 확인한 뒤 merge/deploy한다.
2. merge 후 VPS에서 최신 master를 pull하고 `timeout 20m python3 -u crawl_facebook.py`를 다시 실행해 신규 row 품질을 확인한다.
3. 기존 저품질 Facebook row를 정리할지 결정한다.
