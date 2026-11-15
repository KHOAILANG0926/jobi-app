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
| 저장소 비밀값 실제 목록·Environment | 워크플로가 쓰는 이름 19개(GITHUB_TOKEN 제외) | [직접 확인] grep. 실제 목록은 403 |

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
| Q5 | 필수 검사 위조 | 필수 검사 이름(checks 등)은 "GitHub Actions" 앱이 보낸 결과면 통과로 본다. 아무 브랜치의 워크플로 잡이 `checks: write`로 PR 커밋에 같은 이름 결과를 붙일 수 있다(현재 쓰기 권한 선언 0개지만, 저장소 기본 토큰 권한이 '쓰기'면 선언 없는 잡도 가능 — `crawl.yml`은 권한 선언 없음 [직접 확인]) | 검사 미실행으로도 초록. `checks: write` 없어도 브랜치 push 워크플로에 `checks`라는 잡 이름만 두면 같은 이름 결과가 붙음 |
| Q7 | **비밀값 있는 잡이 PR 코드를 실행** | `crawl-guard.yml:34` 잡 전체에 `SUPABASE_DB_URL`, `:104-107` 제목에 `[자동수리]`만 있으면 누가 연 PR이든 체크아웃 후 `npm ci && npm test && npm run build`. `claude-auto.yml:180-185` Lee 열쇠(`EDIT_TOKEN`)를 env에 둔 단계가 PR 코드의 `npm test` 실행, `:123` 체크아웃은 쓰기 토큰을 .git에 남김 [직접 확인, 독립 검토가 찾음] | **지금도** PR 코드가 운영 DB 열쇠·Lee 열쇠를 읽을 수 있음. schedule·issue_comment는 master 기준이라 L2 뒤에도 남음 |
| Q8 | **migration 자동 적용** | `migrations-apply.yml`은 master push면 운영 DB에 적용. 승인 목록 검사는 drop·truncate·delete 같은 파괴 문장만 [검토 인용 `bot-pr-automerge.yml:91`] | RLS 끄기·anon 권한·security definer 함수·대량 update가 일반 PR로 운영 DB에 들어감 |
| Q9 | artifact 바꿔치기 | `crawl-facebook-one.yml:121-127` save 모드는 입력받은 아무 `run-id`의 artifact를 받아 운영 DB에 저장 [직접 확인]. `facebook-preview-read`·`korea-fb-survey-read`도 같은 구조 [검토 인용] | 브랜치 워크플로가 만든 가짜 결과가 master 실행으로 등록 |
| Q6 | claude[bot] 경로 | claude-auto의 Claude에 `Bash(gh api:*)`·`git push` 허용 [직접 확인 claude-auto.yml:147]. Claude 앱 토큰 권한이 넓으면 Q1·Q3를 앱 이름으로 할 수 있음 | 앱 권한 [Lee 확인 필요] |

**결론: Ruleset만 켜서는 목표를 못 이룬다.** Q2~Q5가 남아 있으면 AI가 Lee 승인·필수 검사를 만들어 낼 수 있다. 아래 층을 함께 해야 한다(독립 검토 반영: Q7~Q9 추가, L2-1 신설).

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

### L2-1. 비밀값 있는 잡은 PR 코드를 실행하지 않는다 (Q7·Q9)
- `crawl-guard` ⑤: PR 체크아웃·`npm` 실행 부분 삭제. `[자동수리]` PR 검사는 일반 필수 검사(pr-checks)가 맡는다. S3 #814도 같이 고침(#814는 직접 병합만 뺐고 코드 실행은 남아 있음).
- `claude-auto` codex-response: PR 코드를 실행하는 잡에는 Claude 구독 열쇠만(환경 `claude-run`), DB 열쇠·Lee 열쇠 없음, 체크아웃 `persist-credentials: false`. 검증 줄을 쓰는 단계는 PR 코드를 실행하지 않고 pr-checks 결과를 읽는다.
- artifact를 받는 운영 작업 3개: 받기 전에 그 실행의 워크플로 파일·`head_branch=master`·이벤트를 API로 확인, 아니면 중단.
- 공통 규칙: **환경 비밀값을 받는 잡에서 PR·브랜치 코드 체크아웃 금지** — `scripts/ci/`에 워크플로 검사 추가(`environment:` 있는 잡에 다른 ref 체크아웃이 있으면 실패).

### L4. Ruleset (master)
```
대상: 기본 브랜치(master) / 적용: Active / 우회 허용: 없음(관리자 포함)
- PR 필수: 필수 승인 0, 코드 소유자 리뷰 필수, 새 커밋 시 승인 무효, 마지막 push한 사람 외 승인 필수
- 필수 상태 검사: checks·guard·app-screen(보내는 쪽 GitHub Actions), merge-gate(보내는 쪽 jobi-merge-gate 앱)
- 삭제 차단, 강제 push 차단
```
- 기존 브랜치 보호는 Ruleset 작동 확인 뒤 정리(둘 다 있으면 둘 다 적용됨 [문서]).
- Lee 본인도 우회 없음. 급할 때는 Lee가 Ruleset을 잠시 끄는 것(관리자 조작, 기록 남음).
- Lee가 직접 push한 고위험 PR은 Lee 혼자로는 승인 못 함(마지막 push한 사람 외 승인 + 소유자 Lee 1명). Lee는 커밋하지 않는 운영이라 해당 없음 [추정] — 필요하면 그때만 Ruleset 잠시 끄기.
- 평가 모드(Evaluate)는 Enterprise 전용으로 알려져 있음 [추정] → 바로 Active, 대신 L5 시험으로 확인.

### L5. CODEOWNERS = 고위험 경로 (대표님 승인 강제)
CODEOWNERS는 **기준 브랜치(master) 파일**이 적용되므로 PR이 자기 소유자 줄을 지워도 그 PR엔 효과 없음 [문서: About code owners].

| 확정(검사 약화·권한·운영 DB) | Lee 결정 필요 |
|---|---|
| `/.github/` 전체(워크플로·CODEOWNERS) | `package.json`·`package-lock.json`의 의존성 변경 — 열쇠 있는 master 잡에서 실행됨(공급망 위험). 다만 잦음 (`scripts` 칸 변경은 왼쪽 아래 판정 코드가 항상 고위험으로 봄) |
| `/scripts/ci/`, `/scripts/status/` | `/scripts/ops/` 나머지 — 운영 작업 스크립트 |
| `/scripts/check-*.mjs`, `/scripts/*-gate.mjs`, `/scripts/approved-migrations.mjs`(S3 #815의 `GATE_CODE`와 같은 목록) | 화면 틀(승인된 KDA·상세 구성) 관련 파일 |
| `/AGENTS.md`, `/CLAUDE.md`, `/.claude/RULES_CORE.md`, `/docs/decisions/`(기존) | `vercel.json`, `api/` 인증 부분 |
| `/supabase/migrations/` — **문장 분류기가 생기기 전까지 전부**(Q8: 지금 승인 목록은 파괴 문장만 봄). 분류기 뒤에는 데이터 고치기(허용 문장)만 자동, 권한·RLS·함수·역할·구조 변경은 Lee. CLAUDE.md "DB 구조 변경=STRICT"와 같은 방향 | 분류기 허용 문장 범위 |
| `/scripts/ops/jobs/` — 운영 SQL은 PR 단계에서 내용을 보고 승인(실행 시점 `ops-lee` 승인 화면엔 SQL이 안 보여 판단 불가) | — |

- 경로로 못 가르는 검사 약화: `package.json`의 `scripts` 변경, 시험 파일 삭제·축소, vitest 설정 변경 → `merge-gate`(기준 커밋 사본)가 고위험 = Lee Approve 필요. pr-checks는 PR 쪽 package.json으로 돌아 `"test": "exit 0"`을 못 막기 때문.
- 화면 모양 변경처럼 **경로로 못 가르는 고위험**은 기존 `decision-approval-gate`(Lee Approve 리뷰만 인정, #815)가 `merge-gate` 안에서 계속 판정. 경로로 가를 수 있는 것은 GitHub 코드 소유자 규칙이 맡고, 나머지는 판정 코드가 맡는다.
- #815의 `GATE_CODE` 목록과 CODEOWNERS를 **한 목록에서 생성**(덧대기 금지, 우선 원칙 8): `scripts/ci/`에 생성기 + 불일치 검사.

## 4. 바꾸지 않는 것 (Claude·Codex 기능 유지)
- 작업 계정 쓰기 권한 유지: 브랜치 push·PR 생성·데모 브랜치 push 그대로. (권한을 읽기로 낮추고 포크로만 일하는 안도 검토했으나, codex-response의 PR 수정 push·데모 배포가 깨지고, L2·L3 뒤에는 쓰기 권한으로 할 수 있는 해가 '판정 통과한 PR 병합'뿐이라 이득이 작다.)
- Codex 리뷰·Claude 검토관·codex-response 흐름 그대로(열쇠 위치만 환경으로).

## 5. 남는 위험 (못 막는 것, 숨기지 않음)
1. **Claude 앱·작업 계정 열쇠가 워크플로 파일을 바꿀 수 있음**: GitHub에 비공개 저장소용 경로 차단이 없어 막을 수 없다. 대신 L2(비밀값 없음)·L3(앱 판정)·L5(.github 소유자)로 **바꿔도 해가 없게** 한다.
2. **판정 통과한 일반 PR**은 AI가 병합할 수 있다 — 이건 의도(일반 PR 자동 병합).
3. 일반 경로 파일에 숨긴 위험 코드(예: 화면 코드에 숨긴 데이터 유출)는 GitHub 규칙이 아니라 독립 검토(Codex·Claude 검토관)만 잡는다.
4. 데모 `--prebuilt` 결과물 안의 서버 함수(`api/`)는 Vercel Preview 환경변수를 받고 실행됨 → Preview 환경변수에 운영 서비스 키가 없어야 함 [Lee 확인 필요]. 있으면 데모는 정적 화면만 올림.
5. Vercel 토큰은 계정 전체 권한일 수 있음 [추정] → `preview` 환경 잡이 master 정의로만 돌게 하는 것이 최선. Vercel에 범위 제한 토큰이 있으면 그걸로 [Lee 확인 필요].
6. Lee 승인은 휴대폰 GitHub 앱 Approve 1번이 필요(고위험만). Lee가 없으면 그 PR만 대기.

## 5-1. 독립 검토
- 2026-11-15 별도 Claude 세션(읽기 전용)이 검토: 높음 3, 중간 4, 낮음 2. 9건 모두 원본 줄로 다시 확인해 반영(crawl-guard·claude-auto·crawl-facebook-one 해당 줄 [직접 확인]). 문서 인용 줄 번호·개수는 검토자가 맞다고 확인.
- 검토자 결론: 높음 3건을 넣기 전에는 목표 미달 → 이번 판에 L2-1·L5로 넣음.

## 6. S3 PR에 미치는 영향
- #811·#812·#814·#815는 모두 `.github/` 또는 판정 코드를 바꿈 → L5 이후에는 **각각 Lee Approve가 필요**(의도된 동작).
- 권장 순서: ① L1(Lee 열쇠 삭제 — **지금 바로**: Q7로 PR 코드가 이미 Lee 열쇠를 읽을 수 있는 상태) → ② Lee 화면 확인(7절) → ③ S3 PR들을 Lee Approve로 병합 → ④ L2 → ⑤ L3 → ⑥ L4·L5 켜기 → ⑦ 시험.
- S2의 "S4 = 비밀값 이동"은 이 문서의 L2로 포함. S3의 `merge-gate`(GitHub Actions 결과)는 L3에서 앱 결과로 바꿈 — S3 구현을 버리지 않고 결과를 붙이는 주체만 바뀐다.

## 7. Lee만 할 수 있는 조작 (AI가 대신 안 함)
1. 비밀값 `CODEX_TRIGGER_TOKEN`·`GH_SECRETS_TOKEN` 삭제, GitHub 개인 설정에서 두 열쇠 폐기.
2. 화면 확인 후 알려 주기: Settings → Collaborators(누가 어떤 권한) / Settings → Actions → General의 Workflow permissions(읽기 전용인지)·"Allow GitHub Actions to create and approve pull requests"(꺼져 있어야 함) / Settings → GitHub Apps(Claude 앱 권한에 Workflows 쓰기가 있는지) / Settings → Secrets 목록 / 요금제.
3. Environment `production`·`ops-lee`·`merge-gate`·`preview` 만들기, 비밀값 복사.
4. GitHub 앱 jobi-merge-gate 만들기·설치·개인 키를 환경 `merge-gate`에(AI가 단계 안내문 준비).
5. Ruleset 만들기(AI가 가져오기용 JSON 준비) + 저장소 자동 병합 켜기.
6. 3절 L5 오른쪽 열 결정.
7. Vercel Preview 환경변수에 운영 서비스 키(Supabase service role 등)가 있는지 확인.

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

## 9. 2차 지시(Lee 2026-11-15) 처리 — 구현은 Draft PR #822(병합 안 함), #814에 crawl-guard 수정

### 9-1. package.json 판정 범위 (지시 1)
- package.json 전체가 아니라 `decision-approval-gate.mjs` ⑤ `dependencyRisks`가 고른 변경만 Lee 승인: 새 의존성, 설치 스크립트(직접·lockfile), 패키지 출처 변경(registry 밖·git·file·별칭·태그·overrides·.npmrc·lockfile 주소 이름/버전 불일치), 검증 약화(scripts 중 dev·preview·start 외 변경, 시험 파일 삭제·이름 바꿈, tsconfig·시험 실행기), 루트 밖 manifest, Python requirements의 새 이름·출처 줄·고정 해제.
- 기존 의존성의 일반 버전 업데이트는 자동(필수 검사만). [직접 확인] 실제 lockfile 전체로 오탐 0건.
- 남는 위험: 업데이트가 새로 끌어오는 하위 패키지의 설치 스크립트는 lockfile 표시(`hasInstallScript`)를 PR이 지울 수 있어 확실히 못 잡는다 → 그 설치는 열쇠 없는 곳(pr-checks·상자)에서만 돌고, 병합 뒤 master의 열쇠 있는 잡에서 `npm ci`가 돈다(공급망 위험, 후속: 열쇠 잡은 `npm ci --ignore-scripts` 검토).

### 9-2. PR 코드 ↔ 열쇠 분리 (지시 2·3)
| 경로 | 전 | 후 |
|---|---|---|
| crawl-guard | DB 열쇠 잡이 `[자동수리]` PR을 체크아웃해 npm ci·시험·빌드 / PR 제목 값을 SQL에 그대로 | PR 코드 실행 삭제(필수 검사 결과만 읽음), 열쇠는 쓰는 단계에만, 제목 값 형식·DB 대조(#814) |
| codex-response | 쓰기 토큰·Claude 열쇠·id-token 잡에서 PR의 npm ci·시험·node, PR의 `.claude` hook 실행 | PR 코드는 기준 사본 `sandbox-run.sh` 컨테이너에서만(환경변수·.git·호스트 파일 없음, 설치 외 네트워크 없음), PR 쪽 Claude 설정·링크 치움, Claude 명령은 정확한 모양만 |
| fallback-review | PR 체크아웃 위에서 PR 쪽 hook 적용 가능, `gh pr comment:*` | 같은 차단 + 결과는 초안 파일로만 |
| mobile-screens | 쓰기 토큰 잡에서 브랜치 npm ci·빌드 | 상자에서 빌드, master vite로 결과만 띄움 |
| Facebook 저장·읽기 3개 + location-ladder-compare | 아무 run id의 artifact 수용 | `verify-artifact-run.sh`: 같은 작업 파일·master·허용 방식·성공·master 이력 안 커밋만 |
- 악성 PR 시험(필수 checks 안): 상자 18건(가짜 열쇠를 환경변수·.git 인증 줄·홈 설정에 심고 설치·시험·빌드에서 못 읽고·못 보내고·호스트를 못 고치는지, 상자 밖 대조 시험 포함), 악성 워크플로 흉내 검사 30건(우회 모양 18종 포함), artifact 출처 13건, Claude 설정 치우기 5건. [직접 확인] GitHub 실행에서 상자 18/18(39aa666).
- 정적 검사 `check-secret-isolation.py`: 71개 워크플로 0건(옛 master 원본은 10건 — 고친 경로 전부 검출).

### 9-3. Lee 열쇠 2개 (지시 4) [직접 확인]
| 비밀값 이름 | 실제 사용처 | 폐기 영향 |
|---|---|---|
| `CODEX_TRIGGER_TOKEN` (Lee 계정, PR 쓰기) | `claude-auto.yml` codex-response의 ① PR 설명 검증 줄 수정(없으면 기본 토큰으로 대체, 180·189행) ② Claude가 고친 뒤 Lee 이름으로 `@codex review` 댓글(197·202행, 없으면 경고만) | Codex 자동 재검토 요청만 멈춤 — 기본 검토자는 Claude 검토관(이미 규칙). #811이 두 사용처를 지움 |
| `GH_SECRETS_TOKEN` (Lee 계정, 비밀값 쓰기) | `android-upload-key-init.yml` 1곳(안드로이드 업로드 키 1회 생성) | 실행 기록 0회 [직접 확인] — 지금 영향 없음. 필요하면 그때 넣고 쓰고 지움 |
- 위험 [직접 확인 코드]: 지금 master의 codex-response는 Lee 열쇠를 env에 둔 단계에서 PR 코드(`npm test`)를 실행한다 → 이미 노출됐을 수 있다고 보고 **삭제뿐 아니라 폐기**가 필요.

### 9-4. Vercel Preview (지시 5)
- [직접 확인] Vercel GitHub 연동이 master 밖 브랜치도 빌드한다: `status` 브랜치(STATUS.md만, vercel.json 없음) 커밋마다 vercel[bot] Preview 배포 20건(11-11~). vercel.json의 `deploymentEnabled:false`는 그 파일이 있는 브랜치에만 적용 → AI가 vercel.json을 빼거나 바꾼 브랜치를 올리면 Vercel이 그 코드를 Preview 환경변수로 빌드·실행한다.
- [직접 확인] demo/** 배포 잡은 `vercel pull --environment=preview`로 Preview 환경변수 값을 러너에 받은 뒤 브랜치 코드로 `vercel build`를 돌린다(VERCEL_TOKEN도 env).
- [확인 불가] Preview에 운영 `SUPABASE_SERVICE_ROLE_KEY`가 있는지: 이 세션에서 Vercel 접근 불가(데모 주소는 Vercel 로그인 보호 → 함수 응답으로도 확인 불가). api/ 서버 파일 13개가 이 키를 씀 [직접 확인 grep].
- 차단 계획(키가 Preview에 있든 없든):
  1. Lee: Vercel 프로젝트 → Settings → Git → 저장소 연결 끊기(Disconnect). 배포는 이미 GitHub Actions의 CLI(`--prebuilt`)로만 하므로 운영 배포에는 영향 없음 [추정 — 끊은 뒤 master 배포 1회로 확인].
  2. Lee: Settings → Environment Variables에서 Preview에 체크된 비밀 키(SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, VIETMAP_SERVICE_KEY, GOOGLE_PLACES_API_KEY, ADMIN_* 등) Preview 체크 해제. 데모는 화면용이라 공개 키(VITE_*)만 필요.
  3. AI(PR): demo 배포를 '브랜치 코드는 열쇠 없이 빌드 → master 정의 잡이 결과만 올림'으로 바꾸기(L2와 함께).
- 키 교체 계획(Preview에 있었던 것으로 확인되면 — 노출 '가능'이었으므로 교체 권장):
  1. Supabase 새 secret 키(`sb_secret_…`)를 만든다 — 기존 키는 그대로 동작(동시 사용 가능).
  2. Vercel Production 환경변수와 GitHub 비밀값 `SUPABASE_SERVICE_ROLE_KEY`를 새 키로 바꾸고 운영 배포·운영 검사 확인.
  3. 옛 `service_role`(JWT) 키를 Supabase API Keys 화면에서 끈다. 공개 anon 키도 같은 JWT 비밀로 서명돼 있어, 완전 폐기(JWT 비밀 폐기)까지 하려면 화면의 anon 키를 publishable 키로 바꾸는 작업이 먼저 필요(AI PR + Lee 화면 조작).
  4. `SUPABASE_DB_URL`(DB 비밀번호)도 Preview·브랜치 실행에 열려 있었으므로 DB 비밀번호 교체도 같은 시점에 권장.

### 9-5. 남은 위험 (구분)
- [직접 확인] 비밀값이 아직 저장소 전체 공용(Environment 미사용) → AI가 브랜치에 새 워크플로를 올리면 받을 수 있음. L2(Lee가 Environment 생성) 전까지 PR 코드 분리만으로는 완전하지 않다.
- [추정] claude-task 잡(수동 지시 실행)은 기본 브랜치 위에서 Claude가 쓴 코드를 열쇠 있는 컴퓨터에서 실행한다 — 같은 상자 방식으로 옮길 후속.
- [추정] 상자 이미지 버전 고정(digest) 없음, 설치 단계 네트워크로 러너 내부 주소 접근 가능.
- [추정] claude-code-action이 `persist-credentials:false`·`--setting-sources user`에서 정상 push·답글 하는지는 병합 뒤 실제 지적 1건으로 확인 필요.

## 10. 3차 방법 변경(Lee 2026-11-15 승인 "Claude는 파일만, 토큰은 신뢰된 별도 단계") — 구현 #822

### 10-1. 구조
| Claude 잡(비신뢰 입력을 읽음) | 권한 | 게시 잡(기준 사본만 실행) |
|---|---|---|
| codex-response (PR 코드 + Codex 지적) | contents/issues/PRs **읽기만**, id-token 없음, `github_token`=읽기 전용 토큰 | codex-publish → patch 반영·push·답 댓글·이슈·검증 줄 |
| fallback-review (PR 코드) | 같음 | review-publish → 검토 결과 댓글 |
| issue-mention (누구나 쓰는 이슈 글) | 같음 | mention-publish → 답 댓글 |
| occupation propose (수집한 공고 제목) | contents 읽기만, DB 열쇠는 앞 잡(report)에만 | publish → 새 브랜치·PR(허용 경로 두 파일) |
- 게시 잡은 PR 코드를 실행하지 않는다(PR 사본은 `git apply` 대상 파일). `claude-publish.mjs`가 데이터 검증을 모두 통과한 뒤에만 claude[bot] 앱 토큰을 OIDC로 받고, 끝나면 폐기한다.
- 검증: 비밀값(모양·실제 값·base64/hex/뒤집기), @언급, 표시 줄 위조, 금지 경로(GATE_CODE + Claude 설정 + git 동작 파일), 링크·하위 저장소, 허용 경로, Claude 잡이 상자 검사한 트리와 같은 트리, 커밋 메시지 한 줄. 상자 검사 실패면 커밋하지 않고 알림 댓글.
- 앱 토큰 OIDC 교환은 '워크플로 파일이 master와 같을 때만' 발급된다(claude-code-action과 같은 규칙) → 브랜치·PR에서 바꾼 워크플로로는 토큰을 못 받는다.

### 10-2. Environment(master 전용) 격리 — 적용 전제와 승인 구분
- 이번 구조는 Environment 없이도 'Claude 잡에 쓰기 토큰·DB 키 없음'을 이룬다(권한 선언 + 잡 분리, GitHub이 강제 — token-drill로 실제 확인).
- Environment가 막는 것은 다른 길이다: AI 계정이 **브랜치에 새 워크플로 파일**을 올려 저장소 공용 비밀값(DB 열쇠 등)을 받는 길(§2 Q2·Q3). 이 길은 이번 구현으로 닫히지 않는다.
- Lee 설정 승인 필요(AI가 하지 않음): ① Environment `production`(배포 브랜치 master만) 만들고 비밀값 복사 ② `ops-lee`(승인자 Lee) ③ 저장소 공용 비밀값 삭제. AI 몫: 워크플로 잡에 `environment:` 추가 PR(①② 뒤).
