# CHATGPT_HANDOFF — 이 파일만 읽고 이어받기 (1페이지)

갱신: 2026-10-08. 상세 이력·이전 본문은 `WORK_LOG.md`(맨 아래 "보관" 포함). 이 파일은 누적하지 않고 항상 최신 스냅샷으로 덮어쓴다.

## 1. 현재 상태

**코드**
- 작업 브랜치 `cursor/policy-vietmap-fake-jobs-c794` → [PR #15](https://github.com/KHOAILANG0926/jobi-app/pull/15) (base `master`). IMPLEMENTED + VERIFIED(tsc 통과, build 통과, `npm test` 40/41 — 실패 1건은 기존 `api/_zalo-token.test.ts`, Node 22.14 `mock.module` 문제로 무관). **master 미반영 / Production 미배포.**
- PR #15 내용: DEMO_JOBS 제거+공개 0건 안내(`NoPublicJobs`), `[source:…]` 태그 SSR·메타·JSON-LD·sitemap 제거(`src/lib/sourceTag.ts`), VietMap 검색 관리자 서버 API(`api/admin-vietmap.js`, 하루 250회·키 비노출), 길찾기 3단계(`src/lib/directionsPlan.ts`)·자동 승인(`evaluateAutoApproval`), 연구 데이터·백업 비공개 저장소 스크립트(`scripts/research/lib/privateStore.mjs`), `.github/workflows/supabase-keepalive.yml`, 규칙 기록(`CLAUDE.md`·`AGENTS.md`·`.cursor/rules/project-rules.mdc`).

**배포(Production https://viecganban.vn)**
- 마지막으로 기록된 코드 배포: 공고 상세 개편(`jobi-8vizwbcra`, master `264d7d7`). 그 뒤 master에는 문서·dry-run 스크립트 커밋만 있음(`d3940fa`). PR #15 코드는 아직 아님.
- **지금 Production은 공개 공고 0건이라 가짜 DEMO_JOBS가 보이는 상태**(PR #15 배포 전까지 유지).

**DB (shared Supabase Production)**
- 공개 공고 0건. `local_jobs`는 #4682(비공개 전환) + Chợ Tốt 100건(ID 4685~4784, 전부 `admin_hidden=true`, `source_url` NULL, `job_work_locations` 100행·좌표 없음).
- `job_location_candidates`에 pending 33건(관리자 /admin → locations 탭). 승인 전이라 핀 없음.
- `local_jobs_description_backup`(RLS 켬, 1행). `local_jobs`에 `language_requirement`·`business_trip` 컬럼 추가됨(2026-10-07 DDL).
- **미적용 DDL**: `supabase/pending/20261008000000_private_research_store.sql`(`research_artifacts`·`vietmap_usage_daily`·관리자 RPC). dry-run 문서 `docs/ops/2026-10-08_private_store_ddl_dry_run.md`. 사용자 승인 전까지 적용 금지.
- 이번 작업에서 DB 쓰기·공고 공개는 하지 않았다.

**PC-local/미설정**: Vercel `VIETMAP_SERVICE_KEY`, GitHub Secrets `SUPABASE_URL`·`SUPABASE_ANON_KEY`는 사용자가 아직 설정 안 함(값은 어디에도 출력 금지).

## 2. 다음 할 일 3개

1. **(사용자 승인 대기) PR #15 → master 반영 → Vercel Production 배포 → Production에서 3·5·6번 화면 확인**: 3 길찾기 3단계 표시, 5 가짜 공고 대신 빈 상태 안내, 6 공개 HTML·메타·JSON-LD에 `[source:` 없음.
2. **(사용자 승인 대기) `supabase/pending` DDL 검토·승인 후 적용 + Vercel `VIETMAP_SERVICE_KEY`·GitHub Secrets 설정**. 그 뒤 keep-alive 워크플로를 `workflow_dispatch`로 1회 실행해 통과 확인.
3. **KCN 정문 좌표**: `docs/ops/2026-10-08_kcn_gate_dryrun.md`(주요 22곳 중 A 0 / B 후보 9곳 / 없음 13) 후보를 VietMap POI + 위성으로 확인해 출처 id 있는 것만 `src/data/industrialParks.ts` `destination`에 승격(DB 쓰기 없음). 그 전엔 정문 좌표 0개 → 전화 안내("Gọi hỏi đường")로 동작.

## 3. 필수 규칙 (전문은 `CLAUDE.md`·`AGENTS.md`, 항상 먼저 읽기)

- 시작: `git pull`/`git fetch` → `CLAUDE.md`·`AGENTS.md`·이 파일 → `VIECGANBAN_STRUCTURE_BASELINE.md`. 기존 설계 유지, 요청 범위 밖 변경 금지.
- 완료 기준: `npx tsc --noEmit`·`npm test`·`npm run build` 통과. 상태를 IMPLEMENTED → VERIFIED → MASTER PUSHED → PRODUCTION DEPLOYED → PRODUCTION VERIFIED로 구분해 보고. 이미 VERIFIED인 작업을 다시 구현하지 않는다.
- STRICT(중단하고 사람 판단): DDL·Production DB 변경·데이터 삭제/대량 수정·Auth/RLS·결제·secret. DDL은 dry-run을 보여주고 승인 후 적용.
- 자동화(클라우드 에이전트)는 master 직접 push 금지: 새 브랜치 + PR.
- **저장 원칙**: PC에 키·데이터·결과 파일 저장 금지(회사 PC는 사용자 소유 아님, PC `.env` 저장 안내 금지). 키는 Vercel 환경변수에만(Actions용은 GitHub Secrets). 수집·검토 데이터·백업은 Supabase 비공개 테이블(RLS)/비공개 Storage. 현장 방문을 해결책으로 제안 금지(1인 운영).
- **위치·길찾기**: 회사명 정확 일치 + 주소(구·KCN) 안이면 자동 승인 핀, 아니면 핀 없음(관리자 Vị trí는 예외용). 길찾기는 승인 좌표 "Chỉ đường" / KCN 정문 좌표 "Đến cổng KCN" / 없으면 "Gọi hỏi đường"(전화). 지도 링크는 좌표(`destination=lat,lng`)만, 이름·주소 검색 금지.
- **가짜 공고 금지**: 예시·DEMO 공고 표시 금지, 공개 0건이면 빈 상태 안내. DB 변경 시 화면 영향(0건 등)까지 확인.
- 경쟁 채용사이트(원본 공고) 링크·`source_url` 공개 노출 금지. `[source:…]` 태그는 공개 화면에 나가지 않게.
- Secret 값은 커밋·로그·PR·응답 어디에도 출력 금지. 보고는 5줄 이내, Git push와 Production 배포는 구분해서 보고.
- 사용량이 약 10% 남으면(사용자 지시) 작업을 멈추고 알린 뒤, 끝난 단계는 커밋·푸시하고 이 파일의 "현재 상태·다음 할 일"을 갱신한다.
