# CHATGPT_HANDOFF — CTY KDA 파서 연결 (2026-10-25)

## 1. 현재 상태
- 기준 master bd9674b; CTY KDA 변경 PR #218 및 #219(Draft) 상태. PR #219 브랜치 feat/cty-kda-integration-20261025.
- API: api/parse/cty-kda.js 인증 Bearer CTY_KDA_PARSER_TOKEN, OPENAI_API_KEY와 CTY_KDA_MODEL 필요. AI system prompt → guard → JSON 응답. DB 기록 없음.
- Python: crawler/crawl_topcv.py process_job_url 경로에 CTY_KDA_PARSER_ENABLED=true일 때만 API 호출. HTTPS CTY_KDA_PARSER_URL 및 CTY_KDA_PARSER_TOKEN 필요. Guard violations/호출 실패 시 _pipeline_failed → 기존 공고 덮어쓰기 차단. 기본 비활성.
- API mock contract 테스트 추가. 실제 TEFAL Raw Text → 실제 모델 응답 E2E 미실행. 별도 저장 스키마/공개 정책 매핑 미구현. 최종 CI 미확인. master/Production 미반영.

## 2. 다음 할 일 3개
1. 실제 TEFAL 원문의 비공개 서버 측 접근 경로와 AI provider 인증설정 확인 후 API 실호출 E2E 수행, JSON/Boolean/중복/violations 검증.
2. CTY KDA 정형 결과의 DB 비공개 저장 위치와 무손실 대응을 확정하고 회귀 테스트 추가 (DDL은 승인 전 금지).
3. PR #219 최종 SHA CI/빌드 확인 및 E2E 통과 후에만 사용자 지시 범위 내 병합/배포 검증.

## 3. 필수 규칙
- AGENTS.md, CLAUDE.md, CTY KDA 6대 불변 규칙 준수. thong_tin_khac는 UI ④ 마지막 소영역, 다섯 번째 영역 없음.
- 운영 DB·Auth·RLS·Secrets·공고 원문·위치 승인·STATUS 보호. 공개 자동 변경 및 가짜 공고 금지.
- 회사 PC 로컬 저장 안내/현장 방문 제안 금지. 미실행 E2E/CI/배포 성공을 완료로 보고 금지.
