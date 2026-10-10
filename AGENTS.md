# Viecganban 자동 작업 규칙

이 파일은 GitHub Actions 등 자동화 환경에서 실행되는 Codex를 포함해,
이 저장소에서 작업하는 모든 Codex 세션이 지켜야 할 최소 규칙이다.

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
   때마다 `CHATGPT_HANDOFF.md`를 **1페이지 최신 스냅샷**으로 덮어쓴다(누적 금지).
   구성은 세 부분뿐: ① 현재 상태(코드·배포·DB) ② 다음 할 일 3개 ③ 필수 규칙.
   덮어쓰기 전에 지워지는 상세 기록·이전 본문은 `WORK_LOG.md`로 옮긴다(2026-10-08 사용자 지시).
6. **Secret 출력 금지**: API 키, Secret, 토큰, 비밀번호 등 민감한 값을 커밋,
   커밋 메시지, PR 설명, 로그, 응답 어디에도 실제 값으로 출력하지 않는다.
   필요하면 GitHub Secrets 등 안전한 저장소를 참조만 하고 값은 다루지 않는다.
7. **master 직접 push 금지(자동화 한정)**: 자동 실행 워크플로에서 만든 변경은
   반드시 새 브랜치로 커밋하고 PR을 생성한다. master에 직접 push하지 않는다.

## 영구 운영 원칙 — MANDATORY (2026-10-08 사용자 지시, 매번 말하지 않아도 자동 적용)

Claude Code·Cursor·Codex 모두 적용한다(`.cursor/rules/project-rules.mdc`에도 같은 내용).

### 1. 저장 원칙
- PC(회사 PC는 사용자 소유가 아님)에 키·데이터·결과 파일을 저장하지 않는다. PC `.env` 저장을 안내하지 않는다.
- 서비스 키는 Vercel 환경변수에만 둔다(GitHub Actions용은 GitHub Secrets에만).
- 수집·검토 데이터와 백업은 Supabase 비공개 테이블(RLS로 공개 접근 차단) 또는 비공개 Storage 버킷에 둔다.
  CSV·바탕화면·`backups`·`scripts/research/out` 폴더로 내보내지 않는다.
- DDL은 dry-run으로 보여주고 사용자 승인 후에만 적용한다(승인 전 SQL은 `supabase/pending/`).
- 현장 방문(직접 돌아다니며 확인)을 해결책으로 제안하지 않는다. 1인 운영이다.

### 3. 위치·길찾기 기준
- 회사명 정확 일치 + 주소(구·KCN) 안이면 자동 승인 핀. 아니면 핀 없음. 관리자 Vị trí 입력은 예외용이다.
- 길찾기는 3단계: 승인 좌표 "Chỉ đường" / KCN 정문 좌표 "Đến cổng KCN" / 둘 다 없으면 "Gọi hỏi đường"(전화 버튼).
- 지도·길찾기 링크는 좌표(`destination=lat,lng`)만. 이름·주소 검색 링크 금지.

### 5. 가짜 공고·화면 영향 확인
- 예시·가짜 공고(DEMO·샘플·placeholder 공고)를 공개 화면에 표시하지 않는다. 공개 0건이면 빈 상태 안내를 보여준다.
- DB 변경(공개/비공개 전환, 삭제, 정리 포함)을 할 때는 화면에 미치는 영향(0건·빈 목록 등)까지 확인한다.

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

## 작업 종료 게이트 — MANDATORY (2026-10-05 사용자 지시)

근거: VietMap 최종 Preview(`dpl_5vVjSum6NNQYVyFBf9vif4p8kgYE`)가 sandbox 폴더의 미커밋 소스로 CLI 배포됐고,
그 폴더의 remote는 GitHub가 아닌 로컬 폴더였다. 승인 후에도 GitHub에 소스가 없어
Vercel deployment source를 API로 다시 회수해야 했다.

1. 작업 시작 전 canonical branch/worktree(GitHub remote를 가진 것)를 확인하고 고정한다.
2. 승인된 Preview가 있으면 다음 작업 전에 그 소스를 commit하고 GitHub에 push한다.
3. GitHub에 존재하지 않는 변경은 완료로 간주하지 않는다.
4. sandbox/local-only remote에 commit한 것만으로 완료 처리하지 않는다.
5. 현재 환경에서 GitHub push가 불가능하면 즉시 사용자에게 보고한다.
6. push가 불가능한 상태에서 Preview만 남기고 다음 작업으로 넘어가지 않는다.
7. commit/push 후 `git status`가 clean인지 확인한다.
8. CLAUDE.md의 "작업 브랜치·Preview·Git 종료 게이트"와 충돌하면 더 엄격한 규칙을 적용한다.
9. Preview 승인 후 GitHub 보존 전에는 다음 기능 작업을 시작하지 않는다.

## Cursor Cloud specific instructions

- 개발 서버는 `npm run dev` (Vite, 포트 5173). `vite.config.ts`가 이미 `host: true`다.
- 공개 공고 조회는 `src/lib/supabase.ts`만으로 된다. 로컬 `.env`는 필요 없다. 지도 키(`VITE_GEOAPIFY_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_VIETMAP_TILEMAP_KEY`)가 없으면 홈 지도는 fallback이고, 공고 목록·상세·검색은 동작한다.
- `npm test`는 Node.js 24가 필요하다. 이미지 기본 Node 22.14에서는 `api/_zalo-token.test.ts`의 `mock.module`이 실패한다. Node 24.21.0은 `/usr/local/bin`에 두고, 셸 PATH에서 그 경로가 먼저여야 한다.
- 검증 명령: `npx tsc --noEmit`, `npm test`, `npm run build`.
- 이 환경에서 Production DB에 쓰지 않는다. DDL은 `supabase/pending/`에만 두고 사용자 승인 후에 적용한다.
