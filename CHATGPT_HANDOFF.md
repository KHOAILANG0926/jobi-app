# ChatGPT ↔ Claude Code 인수인계 문서

이 파일은 **진행상황 전달용**입니다. 전체 구조 기준은 `VIECGANBAN_STRUCTURE_BASELINE.md`를 참고하세요.
작업할 때마다 아래 내용을 최신 상태로 갱신합니다(과거 이력 누적 X, 최신 스냅샷 유지).

---

## 현재 작업
Viecganban 자동 개발 루프 1단계 — GitHub Actions에서 Claude Code를 수동 트리거로 실행해
코드 수정 → 테스트 → CHATGPT_HANDOFF.md 갱신 → PR 생성까지 하도록 자동화 워크플로 준비.
**아직 실행(트리거)하지 않은 상태** — 워크플로 파일만 추가, `ANTHROPIC_API_KEY` secret 미등록.
서비스 코드/DB 기능 자체는 이번 작업에서 손대지 않음.

## 변경 내용
- **`.github/workflows/claude-auto.yml`**(신규): `workflow_dispatch` 트리거, 입력값 `task`(문자열).
  `anthropics/claude-code-action@v1` 사용, `permissions: contents: write, pull-requests: write`만
  부여(저장소 기본값은 read-only라 명시적으로 상향). prompt에서 `CLAUDE.md`/
  `VIECGANBAN_STRUCTURE_BASELINE.md` 우선 확인, `tsc --noEmit`+`npm run build` 통과 필수,
  CHATGPT_HANDOFF.md 갱신, **새 브랜치+PR 생성(master 직접 push 아님)**을 지시.
- **`CLAUDE.md`**(신규): 자동화 세션이 따를 최소 규칙 7개(기존 설계 우선/범위 준수/큰 구조 변경
  전 중단/테스트 필수/핸드오프 갱신 필수/secret 출력 금지/master 직접 push 금지) 명문화.
- 기존 `.github/workflows/crawl.yml`은 이름/시크릿 겹치지 않아 그대로 둠(무수정).

## 테스트 결과
워크플로가 아직 트리거되지 않았으므로 실행 결과 없음. YAML 문법/트리거·권한 설정은
`gh api .../actions/permissions(/workflow)`로 사전 확인한 저장소 설정(기본 토큰 권한 read-only,
Actions `allowed_actions: all`)과 일치하도록 작성함.

## 발견된 문제
없음 — 이번 작업 범위에서 새로 발견된 문제 없음.

## 다음 결정사항
1. `ANTHROPIC_API_KEY` 또는 `CLAUDE_CODE_OAUTH_TOKEN` secret을 등록할지(등록은 사용자가 직접)
2. secret 등록 후 `task` 입력값을 뭘로 줘서 첫 실행을 테스트할지
3. PR 생성 방식이 안정화되면 master 직접 push 방식으로 전환할지 여부
4. `supabase/migrations/0001_applications.sql` 실행 및 `message_threads`/`messages`/`interviews`
   진행은 이번 작업과 무관하게 여전히 보류 중
