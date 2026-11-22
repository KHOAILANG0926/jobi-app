# 개발·시험 DB 권한 분리안 (제안, 2026-11-22 Lee 지시 3번) — 설정은 아직 아무것도 바꾸지 않음

## 목표
Claude가 쓰기·실행 시험을 할 수 있는 DB를 따로 두고, 운영 DB 직접 쓰기와 비밀키 접근은 그대로 막는다. 기존 규칙(CLAUDE.md 「운영 DB 직접 접근 금지」, S4 `ops-keys`·secret-isolation R8)을 완화하지 않는다.

## 현재 상태 [직접 확인]
- 이 세션에서 운영 주소(`edhuesdnuxlbcfephutq.supabase.co`, `www.viecganban.vn`)로 나가는 연결은 에이전트 프록시가 403으로 거절한다(curl 확인). 네트워크 허용 목록이 이미 운영 DB를 막고 있다.
- 세션에 Supabase MCP 서버가 연결돼 있다. 어느 프로젝트를 가리키는지는 **확인하지 못했다** — 운영이면 규칙 위반 경로이므로 대표님이 확인해야 한다(아래 대표 작업 1).
- 운영 열쇠는 환경 `ops-keys`(master 브랜치만)에만 있다. PR 브랜치 워크플로·Claude 작업 잡에는 없다.

## 분리안 (3층)
1. **개발 전용 Supabase 프로젝트 1개(`jobi-dev`)**: 운영과 다른 프로젝트·다른 키. 운영 데이터 복사 금지(연락처·개인정보). 구조는 `supabase/migrations/` 전체를 순서대로 적용, 자료는 `supabase/tests/*.setup.sql` 같은 합성 자료만.
2. **열쇠 위치 분리**: `jobi-dev` 열쇠는 새 GitHub 환경 `dev-db`(브랜치 제한 없음, 운영 열쇠 없음)에만 둔다. 운영은 `ops-keys`(master만) 그대로. 두 환경의 비밀값 이름을 다르게 해(`DEV_SUPABASE_DB_URL` 등) 같은 워크플로가 섞어 쓰지 못하게 한다.
3. **Claude 세션 네트워크·열쇠**: 세션 환경 허용 호스트에 `jobi-dev` 호스트만 추가(운영 호스트는 계속 미허용). 열쇠는 채팅에 붙이지 않고 `request_credential`(호스트 한정)로 저장. Supabase MCP는 `jobi-dev`를 가리킬 때만 남긴다.

## 지켜야 할 선
- 운영 DB 변경은 계속 `supabase/migrations/`+`*_production_check.sql` PR → `migrations-apply.yml`만. `ops-run-sql` 좁은 예외도 그대로(Lee 계정, master).
- `dev-db` 환경 워크플로는 `jobi-dev` 접속 문자열만 받고, 운영 호스트 문자열이 들어가면 실패하는 검사를 둔다(`scripts/ci`의 비밀값 검사에 호스트 이름 대조 추가 — 별도 PR).
- 개발 DB에서 통과한 것이 운영 통과의 근거가 되지 않는다(기존 규칙: 로컬 시험은 운영 확인이 아님).

## 비용·부담
- Supabase 무료 프로젝트 1개 추가(월 0원, 7일 미사용 시 일시중지). 구조 적용은 기존 `check-postgres-migrations.sh`·시험 파일 재사용, 새 시스템 없음.

## 대표님이 할 일 (승인 후)
1. 세션의 Supabase MCP가 가리키는 프로젝트가 운영이면 연결 해제 또는 `jobi-dev`로 교체.
2. Supabase에 `jobi-dev` 프로젝트 생성(운영 복사 없이).
3. GitHub 환경 `dev-db` 생성 + `DEV_SUPABASE_*` 비밀값 등록(운영 값 재사용 금지).
4. Claude 세션 환경 허용 호스트에 `jobi-dev` 추가(`update_environment` 승인 화면에서 승인).
