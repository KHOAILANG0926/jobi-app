# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-01 (회사 PC)

- 요청: 한국 일자리 분리 가능성 전제로 코드·DB 결합 상태 읽기 전용 조사 → 분리 규칙을 CLAUDE.md에 저장
- 변경: CLAUDE.md에 "한국 일자리 모듈 분리 규칙" 섹션 추가
- 조사 요약: korea_* 테이블·뷰는 local_jobs 계열과 FK·DB 함수 결합 없음. korea_jobs 4건, applications/threads/interviews 0건(모두 FK→local_jobs). 저장공고는 localStorage 같은 키에 kr- 접두어. 한국 페이지는 SSR/sitemap/canonical 미포함. KoreaJobDetail이 jobCoords.resolveMapLocations 공유(베트남 위치 규칙이 한국 지도에 적용됨).
- 수정 파일: CLAUDE.md, WORK_LOG.md, CHATGPT_HANDOFF.md
- 검증: 문서만 변경 — typecheck/build 해당 없음
- commit: 이 커밋 / push: master / deploy: 해당 없음
- 남은 문제: 지도 함수 공유 정리(한국 상세 작업 시), 한국 SEO 공백(간판화 시 결정)

## 2026-10-01 (집 PC)

- 요청: ChatGPT가 Claude Code 직접 작업도 추적할 수 있도록 기록 규칙 추가
- 변경: CLAUDE.md에 "ChatGPT 추적용 기록" 섹션 추가, WORK_LOG.md 생성, CHATGPT_HANDOFF.md 스냅샷 갱신(메인 지도 논의 반영)
- 수정 파일: CLAUDE.md, WORK_LOG.md(신규), CHATGPT_HANDOFF.md
- 검증: 문서만 변경 — typecheck/build 해당 없음
- commit: 이 커밋
- push: master
- deploy: 해당 없음(문서)
- 남은 문제: 없음
