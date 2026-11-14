# S3 구현 범위 확정안 (구현 승인 전 — 문서만)

- 작성: Claude (viecganban-bot), 2026-11-14 / 기준 master `1b99e67`
- Lee 결정 반영(2026-11-14): **결정 6 = ①** 화면·사업 결정·고위험 변경만 Lee가 GitHub 앱에서 직접 승인, AI가 Lee 승인을 대신 기록하는 방식 금지 / **결정 7 = ①** 독립 검토 3회 실패 시 그 PR만 보류, 검토 없는 병합 금지.
- 이 문서는 범위 확정안이다. 코드·보호 설정·열쇠는 바꾸지 않았다. DB 변경 PR은 순서 보장(아래 S3-5) 전까지 병합 금지 유지.

## 1. 저장소 보호 설정 — 실제 확인 결과

| 항목 | 결과 | 근거 |
|---|---|---|
| master 보호 켜짐 | **확인됨** | [직접 확인] `GET /repos/.../branches/master` → `protected: true` |
| 필수 검사 | **확인됨**: `checks`·`guard`·`app-screen` 3개(GitHub Actions 앱 15368) | 같은 응답 `required_status_checks.contexts` |
| 관리자에게도 적용 | **확인됨**: `enforcement_level: everyone` | 같은 응답 |
| 규칙 묶음(ruleset) | **없음 확인** | [직접 확인] `GET /rules/branches/master` → `[]`, `GET /rulesets` → `[]` |
| 저장소 자동 병합 기능 | **꺼짐 확인**: `allow_auto_merge: false` | [직접 확인] `GET /repos/...` |
| 필수 승인 리뷰 수 | **0으로 판단(간접 확인)** — 승인 리뷰 0개인 PR #797·#801·#806이 Lee 계정으로 병합됨. 승인이 필수였다면 `everyone` 적용이라 막혔어야 함 | [직접 확인] 각 PR `reviews` 목록에 APPROVED 없음 |
| 코드 소유자 리뷰 강제 | **강제 안 됨(간접 확인)** — 결정 문서(CODEOWNERS 대상)를 바꾼 #374·#295가 리뷰 0개로 봇 병합됨 | [직접 확인] |
| 보호 설정 전체 원본(push 제한·force push·새 커밋 시 승인 무효·Actions의 PR 승인 허용 등) | **미확인** — 봇 계정은 관리자가 아니라 `GET /branches/master/protection` 403 | 확인 경로: Lee가 GitHub 화면 Settings → Branches에서 보거나 Lee 계정 세션에서 조회 |
| master 직접 push 가능 여부 | **미확인** — 시험은 금지 | 위 원본 확인으로 대신 |

**승인 강제 가능 여부 결론**
- 지금 GitHub는 Lee 승인을 **어떤 PR에도 강제하지 않는다**(승인 수 0, 코드 소유자 미강제). 지금까지 Lee 승인을 강제한 것은 꺼진 병합 봇 안의 판정(`decision-approval-gate.mjs`)뿐이었다.
- GitHub 기본 "승인 필수"를 켜면 **모든 PR**에 Lee 승인이 필요해져 일반 작업 자동 진행(결정 6 ①)이 막힌다 → 쓰지 않는다.
- 대신 S3에서 필수 검사 `merge-gate`가 **해당 PR에만** Lee의 GitHub 승인 리뷰(현재 커밋 기준)를 확인한다. PR 작성자가 이제 봇 계정이라 Lee가 GitHub 앱에서 승인 버튼을 누를 수 있다(예전 Lee 작성 PR은 자기 승인 불가라 `LEE-APPROVE` 댓글로 대신했음).

## 2. S2 설계 정정 1건 (근거 있음)

S2는 "GitHub 기본 자동 병합 하나로"였다. **그대로 하면 병합 뒤 운영 DB 적용·배포가 시작되지 않는다**: GitHub 기본 토큰(GITHUB_TOKEN)으로 일어난 병합은 master push 워크플로를 시작시키지 않는다 — 저장소에 이미 실제 사례 기록이 있다(`bot-pr-automerge.yml:173` "GITHUB_TOKEN 병합으로는 master push 기반 migration 워크플로가 시작되지 않는다", `vercel-deploy.yml:169` "11-04 이후 멈춤") [직접 확인 코드 주석]. 자동 병합을 Actions가 켜면 같은 문제가 생긴다 [추정, 위 기록과 같은 원리].
→ **병합 실행은 지금 봇의 '병합 + migration 성공 확인 + 배포' 부분만 남긴 실행기 하나**로 하고, **판정은 전부 필수 검사 `merge-gate`**로 옮긴다. 실행기는 판정을 하지 않고 "필수 검사가 모두 초록인 PR만 병합"한다(보호 설정이 그 외 병합을 서버에서 거절). 저장소 자동 병합 기능은 켜지 않는다(Lee 조작 1개 줄어듦).

## 3. S3 변경 범위 (PR 단위, 이 순서로)

| PR | 바꾸는 파일 | 내용 | 보안 영향 | 검증 방법 |
|---|---|---|---|---|
| S3-1 | `.github/workflows/claude-auto.yml` | `CODEX_TRIGGER_TOKEN` 쓰는 두 단계 제거(PR 본문 수정은 기본 토큰으로, `@codex review` 자동 요청은 없앰 — Codex는 선택) | **좋아짐**: AI가 Lee 신원을 쓰는 경로 제거(F11). 잃는 것: Codex 자동 재검토(대신 Claude 검토관 필수) | 병합 뒤 Codex 지적 대응 실행 1건이 열쇠 없이 성공 종료 / Lee가 열쇠 삭제 후 Secrets 목록에 없음(Lee 화면) |
| S3-2 | 새 `.github/workflows/merge-gate.yml`, `scripts/codex-review-gate.mjs`·`scripts/decision-approval-gate.mjs` 수정 | 필수 검사 `merge-gate`: ① Draft면 실패 ② 최신 커밋에 독립 검토 결과(Codex 또는 Claude 검토관) + 지적마다 봇 계정 답 ③ 결과 없으면 Claude 검토관 호출, 3회 실패 → PR에 `needs-lee`·보류(결정 7 ①) ④ 결정 문서·승인된 화면 틀·`needs-lee`·판정 코드/워크플로 변경 PR은 **Lee GitHub 승인 리뷰(현재 커밋)만** 인정 — `LEE-APPROVE`·`LEE-DEMO-APPLY` 댓글 인정 삭제(결정 6 ①) ⑤ 파괴적 migration은 승인 목록. 실행: `pull_request_target`·`pull_request_review`·`issue_comment`, **PR 코드 체크아웃 없음**, 판정 스크립트는 기준 커밋 사본 | **좋아짐**: 수동 병합·모든 경로에 같은 판정(P1·P4·P5). 위험: `pull_request_target`은 비밀값 있는 문맥이라 PR 코드를 실행하면 안 됨 → 체크아웃 금지를 시험으로 고정 | 시험용 Draft PR 5종(일반·Draft·검토 없음·결정 문서·판정 코드를 '항상 통과'로 고친 PR)에서 판정 결과 기록, 병합 시도 없음 / 기존 `*.test.mjs` + 새 사례 |
| S3-3 | `.github/workflows/status-guard.yml` | `검증장치-승인` 라벨 통과 삭제 → 검증 장치 변경은 S3-2 ④(Lee 승인)로 | 좋아짐(P5·G5) | 라벨만 붙인 검증 장치 PR이 `guard`에서 실패 |
| S3-4 | `.github/workflows/crawl-guard.yml` | ⑤ 직접 `gh pr merge` 삭제 → 수리 PR도 실행기가 필수 검사 통과 후 병합 | 좋아짐(P2) | 자동수리 PR에 필수 검사가 도는지 먼저 확인(S2 P2 ①) |
| S3-5 | `.github/workflows/vercel-deploy.yml` | master 커밋이 `supabase/migrations/`를 바꿨으면 그 커밋의 `migrations-apply` 성공을 기다린 뒤 배포(실패·시간 초과 = 배포 보류) — **사람 수동 병합에도 적용** | 좋아짐: 지금 수동 병합 시 순서 미보장 위험 해소 | migration 실패를 흉내 낸 Preview 실행에서 배포가 보류되는지 / 이 PR 병합 전까지 DB 변경 PR 병합 금지 |
| S3-6 | `.github/workflows/bot-pr-automerge.yml`, `codex-wait-timer.yml` | 판정 코드 삭제, '필수 검사 모두 초록 → 병합 → migration 확인 → 배포' 실행기만 남김(이름 유지 또는 변경), 대기 타이머는 `merge-gate` 재평가로 대체 | 판정이 한 곳(`merge-gate`)이라 우회 지점 감소 | 이동 전후 같은 PR 목록에 같은 판정이 나오는지 비교(읽기 전용 실행) |
| S3-7 | `CLAUDE.md`·`.claude/RULES_CORE.md`·`AGENTS.md` | AI 팀 절: 결정 6·7, Lee 열쇠 없음, `LEE-DEMO-APPLY` 폐지, 검토 없는 병합 금지 | — | `rules-core-sync` 통과 |

- S3-2~S3-7은 판정 코드·워크플로 변경이라 **S3-2 ④의 고위험 대상**: 각 PR에 Claude 검토관 + 가능하면 Codex, 그리고 Lee에게 "검사를 약하게 하나요?" 한국어 요약 + Lee GitHub 승인. 단 `merge-gate` 자체가 생기기 전(S3-1·S3-2)은 지금 방식(필수 검사 3개 + 독립 검토 기록 + Lee 승인)으로 한다.

## 4. Lee 조작 (S3 중, 순서 중요)

1. 지금: GitHub 화면에서 master 보호 설정 원본 확인(1절 미확인 항목) — 결과를 #808에 남기면 이 문서 갱신.
2. S3-1 병합 뒤: `CODEX_TRIGGER_TOKEN` 삭제·폐기.
3. S3-2 병합 뒤: 보호 필수 검사에 `merge-gate` 추가. **이것이 S3-6(실행기 재가동)보다 먼저**여야 한다 — 순서가 바뀌면 판정 없는 병합이 생긴다.
4. 각 고위험 PR: GitHub 앱에서 승인 버튼(화면·사업·검사 변경일 때만).

## 5. S3 완료 기준

- 시험 Draft PR 5종 판정 결과가 3절 표대로(실행 기록 링크).
- Lee 열쇠가 Secrets에 없고 자동화가 정상(실행 기록).
- migration 실패 시 배포 보류 실행 기록.
- 보호 필수 목록에 `merge-gate` 포함(Lee 화면 또는 `GET /branches/master` 재조회로 확인).
- 문서만으로 완료라 하지 않는다.
