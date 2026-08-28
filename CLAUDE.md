# Viecganban 자동 작업 규칙

이 파일은 GitHub Actions 등 자동화 환경에서 실행되는 Claude Code를 포함해,
이 저장소에서 작업하는 모든 Claude Code 세션이 지켜야 할 최소 규칙이다.

## 우선 원칙

1. **기존 설계 우선**: 코드를 수정하기 전에 `VIECGANBAN_STRUCTURE_BASELINE.md`를
   먼저 읽고, 거기 기록된 기존 구조/설계 의도를 최대한 유지한다. 이미 있는 구조를
   갈아엎거나 임의로 통합/삭제하지 않는다.
2. **작업 범위 준수**: 지시받은 범위 밖의 리팩터링, 기능 추가, 코드 스타일 변경을
   같이 하지 않는다. 범위를 벗어나는 게 필요해 보이면 먼저 멈추고 알린다.
3. **큰 구조 변경 전 중단**: DB 스키마 변경(DDL), 인증 방식 변경, 기존 테이블
   삭제/통합처럼 되돌리기 어렵거나 영향 범위가 넓은 변경은 실행하지 말고,
   무엇이 왜 필요한지만 정리해서 사람 판단을 기다린다.
4. **테스트 필수**: 코드를 수정했다면 `npx tsc --noEmit`과 `npm run build`가
   통과하는 것을 확인한 뒤에만 완료로 간주한다. 실패한 상태로 커밋하지 않는다.
5. **CHATGPT_HANDOFF.md 갱신 필수**: 실제 코드/설정 변경이 있었던 작업을 마칠
   때마다 `CHATGPT_HANDOFF.md`를 다음 5개 항목으로 최신 상태로 덮어쓴다(과거
   이력을 누적하지 않고 최신 스냅샷만 유지): 현재 작업 / 변경 내용 / 테스트 결과 /
   발견된 문제 / 다음 결정사항.
6. **Secret 출력 금지**: API 키, Secret, 토큰, 비밀번호 등 민감한 값을 커밋,
   커밋 메시지, PR 설명, 로그, 응답 어디에도 실제 값으로 출력하지 않는다.
   필요하면 GitHub Secrets 등 안전한 저장소를 참조만 하고 값은 다루지 않는다.
7. **master 직접 push 금지(자동화 한정)**: 자동 실행 워크플로에서 만든 변경은
   반드시 새 브랜치로 커밋하고 PR을 생성한다. master에 직접 push하지 않는다.

## 필수 작업 상태 규칙

모든 UI/기능 작업은 아래 상태를 명시적으로 구분한다.

1. **IMPLEMENTED**: 코드 구현 완료
2. **VERIFIED**: 테스트, build, 실제 로컬 화면 검증 완료
3. **APPROVED**: 사용자가 결과를 확인하고 승인 완료
4. **DEPLOYED**: commit/push, Production 배포, 실제 운영 URL 반영 확인 완료

- 이미 `IMPLEMENTED` 또는 `VERIFIED`인 동일 작업을 이유 없이 다시 구현하지 않는다.
- 사용자가 승인한 구현은 다시 만들거나 재설계하지 않고 다음 상태로 진행한다.
- 사용자가 “적용해”, “반영해”, “실제 사이트에 넣어”라고 하면 현재 `VERIFIED`
  결과에 대한 배포 요청으로 처리한다.
- commit/push가 안 된 상태와 구현이 안 된 상태를 혼동하지 않는다.
- 운영 사이트에 결과가 안 보이면 재구현보다 commit/push/배포 상태를 먼저 확인한다.
- 기존 완료 상태를 확인하기 전에 동일 작업을 처음부터 다시 시작하지 않는다.
- 새 세션은 `AGENTS.md`, `CLAUDE.md`, `CHATGPT_HANDOFF.md`를 먼저 읽고 상태를 복원한다.
- 화면 캡처가 제공되면 추측보다 실제 화면을 우선하며, 확인되지 않은 상태를 완료로 보고하지 않는다.
- 반복 작업으로 사용자 시간과 토큰을 낭비하지 않는다.

## MANDATORY WORK MODE — 작업 등급별 배포 규칙

모든 작업을 시작하기 전에 아래 세 등급 중 하나로 분류하고, 그 등급의 흐름을 따른다.
(2026-08-27 사용자 지시로 영구 반영)

### FAST 작업

사용자가 현재 대화에서 수정 내용을 명확히 승인/지시한 단순 UI/CSS/텍스트/배치 작업.

흐름: 구현 → 최소 검증(`tsc`/`build` 등) → commit → master 반영 → master push →
Vercel Production 배포 → 실제 사이트 대표 화면 1회 확인 → 완료.

- 중간에 "승인 대기", "Production 배포해도 될까요?"를 다시 묻지 않는다.
- 사용자의 구체적인 구현 지시 자체를 해당 FAST 작업의 승인으로 본다.

### NORMAL 작업

일반적인 기능 수정. 사용자가 "수정해", "적용해", "바로 해"처럼 명확하게 지시한 경우에는
구현/검증 후 별도의 중복 승인을 요구하지 않고 master/Production까지 진행한다.

- 단, 예상하지 못한 범위 확대나 중요한 제품 결정이 새로 필요해지면 멈추고 질문한다.

### STRICT 작업

다음은 기존처럼 별도 승인/안전 절차를 유지한다 — FAST/NORMAL 흐름을 적용하지 않는다:

- Production DB migration
- 데이터 삭제/대량 수정
- Auth/RLS/권한
- 보안/secret
- 결제
- 사용자 데이터에 영향을 주는 작업
- destructive operation
- 되돌리기 어려운 변경
- 예상하지 못한 대규모 구조 변경

### 공통 원칙

- Git branch push와 Production 배포 상태는 항상 구분해서 보고한다.
- 하지만 안전을 이유로 모든 사소한 UI 작업을 branch에서 멈추는 방식은 쓰지 않는다 —
  FAST/NORMAL 작업은 위 흐름대로 Production까지 끝맺는다.

## TWO-PC WORKFLOW — MANDATORY

사용자는 이 프로젝트를 두 PC에서 번갈아 작업한다.
(2026-08-28 사용자 지시로 영구 반영. 특정 작업이 아니라 Viecganban 프로젝트의
모든 향후 작업에 적용되며, 위 MANDATORY WORK MODE와 충돌하지 않고 함께 적용된다 —
WORK MODE는 "언제 다음 단계로 진행하는가"를, 이 섹션은 "다음 단계가 두 PC 모두에서
동일하게 이어지려면 무엇이 GitHub/Production에 실제로 반영돼 있어야 하는가"를 규정한다.)

- 회사 PC
- 집 PC

따라서 한 PC에만 존재하는 변경은 절대 "완료"로 간주하지 않는다.

### 영구 변경 원칙

1. 모든 코드 변경
   → GitHub master까지 push

2. 모든 Production DB 변경
   → shared Supabase Production에 migration으로 적용
   → migration 파일도 GitHub master에 반드시 포함

3. 서비스 변경
   → Vercel Production 배포 및 실제 반영 확인

4. 작업 시작 전
   → git status 확인
   → git fetch origin
   → local과 origin/master 상태 비교

5. local이 clean하고 fast-forward 가능한 경우
   → origin/master 기준으로 안전하게 동기화

6. uncommitted/local-only 작업이 있으면
   → 절대 reset/overwrite하지 말고 먼저 보호

7. 회사 PC에서 작업했더라도
   집 PC가 이후 origin/master를 pull하면
   동일한 코드/migration 상태를 이어받을 수 있어야 한다.

8. 집 PC에서 작업한 경우도 동일하다.

9. PC-local 항목:
   - access token
   - local .env
   - CLI login/session
   - machine-specific path

   은 GitHub에 올리지 않는다.

10. PC-local credential이 필요한 작업과
    프로젝트의 영구 상태를 명확히 구분한다.

11. 한 PC에서만 작동하는 설정/변경이라면
    Production 작업 완료로 보고하지 않는다.

12. 작업 완료 기준:

    IMPLEMENTED
    → VERIFIED
    → MASTER PUSHED
    → PRODUCTION DEPLOYED
    → PRODUCTION VERIFIED

    를 구분해서 보고한다.

13. 회사/집 PC 간 전달해야 할 현재 작업 상태가 있으면
    CHATGPT_HANDOFF.md를 최신 snapshot으로 갱신하고
    GitHub master에 포함한다.

중요:
이 규칙은 특정 작업에만 적용되는 것이 아니라
Viecganban 프로젝트의 모든 향후 작업에 적용한다.
