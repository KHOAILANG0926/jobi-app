# S4 — AI 계정 병합 권한 제한 설계 (GitHub 차원 강제)

작성 2026-11-15, Claude. 상태: **설계만**(코드·권한·보호 설정 변경 없음). S3 PR #811·#812·#814·#815는 병합하지 않았다.

목표(Lee 지시): ① 일반 PR 자동 병합 유지 ② 고위험 PR은 대표님 승인을 **GitHub가** 강제 ③ AI가 승인을 우회할 길을 막음. Claude·Codex의 코드 수정·PR 생성은 유지.

근거 표시: **[직접 확인]** 이번에 실행한 조회 결과 / **[문서]** GitHub 공식 문서 / **[추정]** 미확인 / **[Lee 확인 필요]** 이 세션 권한으로 조회가 막힘.

---

## 1. 확인한 사실

| 항목 | 값 | 근거 |
|---|---|---|
| 저장소 | 공개(public), 개인 계정(User) 소유, 포크 아님 | [직접 확인] `gh api repos/KHOAILANG0926/jobi-app` → `visibility=public, owner_type=User, fork=false` |
| 저장소 자동 병합 설정 | 꺼짐 | [직접 확인] `allow_auto_merge=false` |
| Ruleset | 없음 | [직접 확인] `rulesets?includes_parents=true` → `[]` |
| 기존 브랜치 보호 | 필수 검사 checks·guard·app-screen, 관리자 포함 적용, **필수 승인 수 0·코드 소유자 리뷰 미강제** | [기존 기록] S3-scope 3절(이번 세션 조회는 403) |
| CODEOWNERS | `/docs/decisions/`, `/.github/CODEOWNERS`만 Lee | [직접 확인] 파일 내용 |
| 작업 계정 viecganban-bot | push(쓰기)·triage, 관리자 아님 | [직접 확인] `.permissions` → `push:true, admin:false` |
| 작업 계정이 워크플로 파일을 바꿀 수 있나 | **바꿀 수 있다** | [직접 확인] #811(작성자 viecganban-bot, 원본 저장소 브랜치)의 변경 파일이 `.github/workflows/claude-auto.yml` 1개, 커밋 bb17876 작성·커밋 계정 viecganban-bot |
| 요금제 | 개인 Free로 추정 | [Lee 확인 필요] `users/` 경로 403. 아래 기능은 **공개 저장소면 Free에서도 됨**이라 결론은 같음 |
| 협업자 목록·초대 | — | [Lee 확인 필요] 403 |
| Actions 토큰 기본 권한, "Actions가 PR을 만들고 승인" 허용 여부 | — | [Lee 확인 필요] 403 |
| 설치된 GitHub 앱(Claude 앱 등)의 권한, 특히 Workflows 쓰기 | — | [Lee 확인 필요] 401 |
| 저장소 비밀값 실제 목록·Environment | 워크플로가 쓰는 이름 20개 | [직접 확인] grep. 실제 목록은 403 |

GitHub 기능 확인 [문서]:
- Ruleset은 **공개 저장소에서 GitHub Free로 사용 가능**. (docs: Available rules for rulesets)
- PR 필수 규칙 안에 필수 승인 수, **코드 소유자 리뷰 필수**, 새 커밋 시 승인 무효, **마지막 push한 사람 외 승인 필수**를 각각 켤 수 있다. 소유자가 여럿이면 그중 1명 승인으로 충분.
- 필수 상태 검사는 **보내는 쪽을 특정 GitHub 앱으로 지정** 가능. 앱은 저장소에 설치돼 있고 최근 검사 결과를 보낸 적이 있어야 하며, 다른 사람·앱이 같은 이름으로 결과를 보내면 병합이 막힌다.
- 우회 허용(bypass) 대상: 관리자·쓰기 역할·GitHub 앱 등. 개인 저장소엔 팀이 없어 "팀별 필수 리뷰어" 규칙은 못 씀.
- **필수 승인 수 0 + 코드 소유자 리뷰 필수** 조합: 소유 파일을 안 건드리는 PR은 승인 없이, 건드리는 PR은 소유자 승인 필요 — GitHub 문서 본문에 이 조합을 직접 쓴 문장은 없고, 같은 설정을 운영하는 공개 프로젝트 문서(lsst phalanx)가 그렇게 동작한다고 적음 → **[추정, 켠 뒤 시험 PR로 확인]**.
- Environment·환경 비밀값·배포 브랜치 제한·**필수 승인자**는 공개 저장소면 모든 요금제에서 사용 가능. 환경 비밀값은 그 환경을 쓰는 잡만 받고, 승인자가 있으면 승인 전엔 비밀값을 못 받는다.
- 파일 경로 push 차단(push ruleset)은 Team 이상 비공개 저장소 전용 → **이 저장소에선 불가**.

## 2. 지금 AI가 대표님 승인 없이 할 수 있는 것 (새로 확인한 우회 경로)

S2의 P1~P13에 더해, 이번 확인으로 아래가 실제 가능한 상태다. **시험(실행)은 하지 않았다** — 코드·권한을 근거로 한 판단이다.

| # | 경로 | 왜 가능한가 | 결과 |
|---|---|---|---|
| Q1 | 작업 계정이 PR을 바로 병합 | 쓰기 권한 + 필수 승인 0 + `merge-gate` 같은 판정이 보호 목록에 없음 | 검토·Lee 승인 판정을 건너뜀 |
| Q2 | **브랜치에서 `workflow_dispatch` 실행** | 수동 실행 워크플로는 고른 브랜치의 워크플로 파일·코드로 돈다. 작업 계정은 워크플로 파일도 바꿀 수 있다(1절). 예: `ops-run-sql.yml`의 `if: github.ref == master && actor == Lee` 검사도 브랜치 사본에서 지울 수 있다 | 운영 DB 비밀값(`SUPABASE_DB_URL`을 쓰는 워크플로 23개)으로 **임의 SQL** — CLAUDE.md "운영 DB 직접 접근 금지"를 GitHub가 못 막음 |
| Q3 | 브랜치 push 워크플로 | 새 워크플로 파일을 브랜치에 넣으면 그 브랜치 push로 돈다(S2 P9). 저장소 비밀값이 모두 그 잡에 열려 있음 | 비밀값 전부 노출 가능 |
| Q4 | **Lee 열쇠로 Lee 승인 위조** | `CODEX_TRIGGER_TOKEN`(Lee 계정, PR 쓰기)·`GH_SECRETS_TOKEN`(Lee 계정, 비밀값 쓰기)이 저장소 비밀값 → Q2·Q3로 읽을 수 있다. PR 쓰기 권한이면 Lee 이름으로 **Approve 리뷰** 가능 | 코드 소유자 리뷰를 켜도 무력화. 비밀값 쓰기 열쇠는 보안 설정 자체를 바꿀 수 있음 |
| Q5 | 필수 검사 위조 | 필수 검사 이름(checks 등)은 "GitHub Actions" 앱이 보낸 결과면 통과로 본다. 아무 브랜치의 워크플로 잡이 `checks: write`로 PR 커밋에 같은 이름 결과를 붙일 수 있다(현재 쓰기 권한 선언 0개지만, 저장소 기본 토큰 권한이 '쓰기'면 선언 없는 잡도 가능 — `crawl.yml`은 권한 선언 없음 [직접 확인]) | 검사 미실행으로도 초록 |
| Q6 | claude[bot] 경로 | claude-auto의 Claude에 `Bash(gh api:*)`·`git push` 허용 [직접 확인 claude-auto.yml:147]. Claude 앱 토큰 권한이 넓으면 Q1·Q3를 앱 이름으로 할 수 있음 | 앱 권한 [Lee 확인 필요] |

**결론: Ruleset만 켜서는 목표를 못 이룬다.** Q2~Q5가 남아 있으면 AI가 Lee 승인·필수 검사를 만들어 낼 수 있다. 아래 5층을 함께 해야 한다.

## 3. 설계 — 5층

### L1. Lee 열쇠를 저장소에서 없앤다 (Q4)
- `CODEX_TRIGGER_TOKEN` 삭제·폐기. 현재 claude-auto는 없으면 경고만 하고 넘어감 [직접 확인 claude-auto.yml:202, 189는 GITHUB_TOKEN으로 대체] → **#811 병합 전에 지워도 동작은 유지**.
- `GH_SECRETS_TOKEN` 삭제·폐기(안드로이드 키 1회 생성용). 다시 필요하면 Lee가 그때 넣고 쓰고 지운다.
- 원칙: **Lee 계정 열쇠는 저장소에 두지 않는다.** Lee 승인 = Lee 본인이 GitHub 앱에서 누른 Approve만.

### L2. 비밀값을 master 전용 Environment로 (Q2·Q3)
- Environment `production`: 배포 브랜치 = `master`만. 운영 DB·서비스 키·외부 API·Facebook·Anthropic·Claude 구독 열쇠를 전부 여기로. 저장소 기본 비밀값은 비운다.
- Environment `ops-lee`: master만 + **필수 승인자 Lee**. `ops-run-sql`·`ops-insert-job`·`ops-publish-jobs`·`admin-location-confirm` 등 사람 승인이 규칙인 수동 운영 작업. GitHub가 실행 직전에 Lee 승인을 요구 → 브랜치 실행·AI 실행 모두 막힘.
- 효과: 브랜치에서 돈 워크플로(파일을 바꿨든 아니든)는 비밀값을 받지 못한다. `schedule`·`issues`·`issue_comment`·`workflow_run`은 master 기준이라 그대로 동작 [문서: 배포 브랜치 규칙은 실행의 GITHUB_REF와 대조].
- 바꿔야 하는 곳: 비밀값을 쓰는 워크플로 38개(파일 기준, [직접 확인] grep)의 해당 잡에 `environment:` 한 줄. 그중 예외 3가지는 구조를 고친다:
  - `claude-auto`의 `pull_request_review` 이벤트는 ref가 PR 쪽이라 master 전용 환경을 못 씀 → 그 이벤트는 비밀값 없는 잡이 master에 `workflow_dispatch`를 부르는 방식으로(이미 `codex-followup`이 같은 방식).
  - `vercel-deploy`의 `demo/**` push: 데모 브랜치 코드로 **빌드만**(비밀값 없음) → 결과물을 master 정의 잡(환경 `preview`, master만)이 받아 `vercel deploy --prebuilt`로 올림. 데모 코드는 열쇠 있는 잡에서 실행되지 않음.
  - `admin-operations`·`p0-foundation`(옛 `codex/*` 브랜치 push로 DB 열쇠 사용): 8월 이후 실행 없음 [기존 기록 S2 P7] → 제거.
- 순서(끊김 방지): Lee가 환경을 만들고 비밀값을 **복사**(저장소 쪽 유지) → AI PR로 `environment:` 추가·병합 → master 실행 확인 → Lee가 저장소 쪽 사본 삭제.
- 주의 [문서]: 워크플로가 없는 환경 이름을 쓰면 보호 없는 환경이 새로 생긴다 → 반드시 Lee가 먼저 만든다. `merge-gate`가 "새 환경 이름 사용" PR을 고위험으로 본다.

### L3. 위조 못 하는 병합 판정 `merge-gate` (Q1·Q5)
- 전용 GitHub 앱 **jobi-merge-gate**(Lee 계정으로 생성, 무료): 권한 = Checks 쓰기·Pull requests 읽기·Contents 읽기만. 개인 키는 Environment `merge-gate`(master만)에만.
- master 기준 워크플로(`pull_request_target`·`pull_request_review`의 디스패치·`issue_comment`·`workflow_run`)가 기존 판정(`codex-review-gate.mjs`·`decision-approval-gate.mjs`, **기준 커밋 사본**)을 돌리고, 앱 열쇠로 PR head 커밋에 `merge-gate` 결과를 붙인다. PR 코드는 실행하지 않는다(S2 3절 그대로).
- 추가 확인: `checks`·`guard`·`app-screen` 결과가 **그 PR 커밋의 `pull_request` 이벤트, 정해진 워크플로 파일**(`pr-checks.yml` 등)에서 나온 것인지 API로 대조. 다른 워크플로가 붙인 같은 이름 결과는 무효 → Q5 차단.
- Ruleset 필수 검사 `merge-gate`의 보내는 쪽 = jobi-merge-gate 앱으로 지정 → 브랜치 워크플로는 앱 열쇠가 없어(L2) 위조 불가.
- 그러면 작업 계정이 병합 버튼을 직접 눌러도 `merge-gate`가 초록일 때만 됨 = 자동 병합과 같은 결과. **"AI 임의 병합 차단"은 병합 권한을 뺏는 대신 '판정 통과 없이 병합 불가'로 이룬다.** (병합 권한 자체를 특정 앱에만 주는 'Restrict updates + 앱 우회'는 그 앱이 **모든 규칙을 우회**하게 돼 더 약하다 → 쓰지 않음.)
- 병합 실행: 저장소 자동 병합 켜기 + `merge-gate`가 통과 시 자동 병합 요청. 커스텀 병합 봇·crawl-guard 직접 병합 제거(S3 P2·P3 그대로).

### L4. Ruleset (master)
```
대상: 기본 브랜치(master) / 적용: Active / 우회 허용: 없음(관리자 포함)
- PR 필수: 필수 승인 0, 코드 소유자 리뷰 필수, 새 커밋 시 승인 무효, 마지막 push한 사람 외 승인 필수
- 필수 상태 검사: checks·guard·app-screen(보내는 쪽 GitHub Actions), merge-gate(보내는 쪽 jobi-merge-gate 앱)
- 삭제 차단, 강제 push 차단
```
- 기존 브랜치 보호는 Ruleset 작동 확인 뒤 정리(둘 다 있으면 둘 다 적용됨 [문서]).
- Lee 본인도 우회 없음. 급할 때는 Lee가 Ruleset을 잠시 끄는 것(관리자 조작, 기록 남음).
- 평가 모드(Evaluate)는 Enterprise 전용으로 알려져 있음 [추정] → 바로 Active, 대신 L5 시험으로 확인.

### L5. CODEOWNERS = 고위험 경로 (대표님 승인 강제)
CODEOWNERS는 **기준 브랜치(master) 파일**이 적용되므로 PR이 자기 소유자 줄을 지워도 그 PR엔 효과 없음 [문서: About code owners].

| 확정(검사 약화·권한) | Lee 결정 필요 |
|---|---|
| `/.github/` 전체(워크플로·CODEOWNERS) | `/supabase/migrations/` — CLAUDE.md는 "DB 구조 변경=Lee 한마디(STRICT)"인데, 데이터 고치기 migration도 같은 폴더라 **모두 Lee 승인**이 됨 |
| `/scripts/ci/`, `/scripts/status/` | `package.json`·`package-lock.json` — 의존성 변경은 열쇠 있는 master 잡에서 실행됨(공급망 위험). 다만 잦음 |
| `/scripts/check-*.mjs`, `/scripts/*-gate.mjs`, `/scripts/approved-migrations.mjs`(S3 #815의 `GATE_CODE`와 같은 목록) | `/scripts/ops/` — 운영 작업 스크립트(L2 `ops-lee` 승인으로 이미 실행 시점에 막힘) |
| `/AGENTS.md`, `/CLAUDE.md`, `/.claude/RULES_CORE.md` | 화면 틀(승인된 KDA·상세 구성) 관련 파일 |
| `/docs/decisions/` (기존) | `vercel.json`, `api/` 인증 부분 |

- 화면 모양 변경처럼 **경로로 못 가르는 고위험**은 기존 `decision-approval-gate`(Lee Approve 리뷰만 인정, #815)가 `merge-gate` 안에서 계속 판정. 경로로 가를 수 있는 것은 GitHub 코드 소유자 규칙이 맡고, 나머지는 판정 코드가 맡는다.
- #815의 `GATE_CODE` 목록과 CODEOWNERS를 **한 목록에서 생성**(덧대기 금지, 우선 원칙 8): `scripts/ci/`에 생성기 + 불일치 검사.

## 4. 바꾸지 않는 것 (Claude·Codex 기능 유지)
- 작업 계정 쓰기 권한 유지: 브랜치 push·PR 생성·데모 브랜치 push 그대로. (권한을 읽기로 낮추고 포크로만 일하는 안도 검토했으나, codex-response의 PR 수정 push·데모 배포가 깨지고, L2·L3 뒤에는 쓰기 권한으로 할 수 있는 해가 '판정 통과한 PR 병합'뿐이라 이득이 작다.)
- Codex 리뷰·Claude 검토관·codex-response 흐름 그대로(열쇠 위치만 환경으로).

## 5. 남는 위험 (못 막는 것, 숨기지 않음)
1. **Claude 앱·작업 계정 열쇠가 워크플로 파일을 바꿀 수 있음**: GitHub에 비공개 저장소용 경로 차단이 없어 막을 수 없다. 대신 L2(비밀값 없음)·L3(앱 판정)·L5(.github 소유자)로 **바꿔도 해가 없게** 한다.
2. **판정 통과한 일반 PR**은 AI가 병합할 수 있다 — 이건 의도(일반 PR 자동 병합).
3. 일반 경로 파일에 숨긴 위험 코드(예: 화면 코드에 숨긴 데이터 유출)는 GitHub 규칙이 아니라 독립 검토(Codex·Claude 검토관)만 잡는다.
4. Vercel 토큰은 계정 전체 권한일 수 있음 [추정] → `preview` 환경 잡이 master 정의로만 돌게 하는 것이 최선. Vercel에 범위 제한 토큰이 있으면 그걸로 [Lee 확인 필요].
5. Lee 승인은 휴대폰 GitHub 앱 Approve 1번이 필요(고위험만). Lee가 없으면 그 PR만 대기.

## 6. S3 PR에 미치는 영향
- #811·#812·#814·#815는 모두 `.github/` 또는 판정 코드를 바꿈 → L5 이후에는 **각각 Lee Approve가 필요**(의도된 동작).
- 권장 순서: ① L1(Lee 열쇠 삭제 — 지금 가능) → ② Lee 화면 확인(7절) → ③ S3 PR들을 Lee Approve로 병합 → ④ L2 → ⑤ L3 → ⑥ L4·L5 켜기 → ⑦ 시험.
- S2의 "S4 = 비밀값 이동"은 이 문서의 L2로 포함. S3의 `merge-gate`(GitHub Actions 결과)는 L3에서 앱 결과로 바꿈 — S3 구현을 버리지 않고 결과를 붙이는 주체만 바뀐다.

## 7. Lee만 할 수 있는 조작 (AI가 대신 안 함)
1. 비밀값 `CODEX_TRIGGER_TOKEN`·`GH_SECRETS_TOKEN` 삭제, GitHub 개인 설정에서 두 열쇠 폐기.
2. 화면 확인 후 알려 주기: Settings → Collaborators(누가 어떤 권한) / Settings → Actions → General의 Workflow permissions(읽기 전용인지)·"Allow GitHub Actions to create and approve pull requests"(꺼져 있어야 함) / Settings → GitHub Apps(Claude 앱 권한에 Workflows 쓰기가 있는지) / Settings → Secrets 목록 / 요금제.
3. Environment `production`·`ops-lee`·`merge-gate`·`preview` 만들기, 비밀값 복사.
4. GitHub 앱 jobi-merge-gate 만들기·설치·개인 키를 환경 `merge-gate`에(AI가 단계 안내문 준비).
5. Ruleset 만들기(AI가 가져오기용 JSON 준비) + 저장소 자동 병합 켜기.
6. 3절 L5 오른쪽 열 결정.

## 8. 완료 확인 시험 (켠 뒤, 실제 실행 증거로)
| 시험 | 기대 |
|---|---|
| 일반 화면 문구 PR | 승인 없이 `merge-gate` 통과 → 자동 병합 |
| `.github/` 바꾸는 PR | Lee Approve 전 병합 불가, Approve 뒤 새 커밋 오면 다시 불가 |
| 작업 계정이 `merge-gate` 실패 PR 병합 시도(API) | GitHub가 거절 |
| 브랜치에서 `ops-run-sql` 수동 실행 | 환경 승인 대기/거절, 비밀값 없음 |
| 브랜치 워크플로가 `merge-gate` 이름 결과를 붙임 | 보내는 쪽이 앱이 아니라 무효 |
| master push(작업 계정) | 거절 |

이 시험들이 끝나기 전에는 S4 완료라고 보고하지 않는다.
