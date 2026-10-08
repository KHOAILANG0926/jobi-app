# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**저장 원칙·VietMap 서버 이전·길찾기 3단계·가짜 공고 제거·`[source:]` 숨김·Supabase keep-alive·규칙 기록 (2026-10-08).** branch `cursor/policy-vietmap-fake-jobs-c794`(master 기반). 상태: IMPLEMENTED / VERIFIED(tsc·`npm test` 40/41·build, 로컬) / **BRANCH PUSHED + PR — master 미반영, Production 미배포, Production 화면(3·5·6번) 미확인**. DB 쓰기·공고 공개 없음.

- 1·8 저장 원칙·규칙: PC에 키·데이터·결과 저장 금지, 키는 Vercel 환경변수만, 수집·백업은 Supabase 비공개 테이블/Storage. CLAUDE.md·AGENTS.md·`.cursor/rules/project-rules.mdc`(alwaysApply)에 1·3·5번 원칙 기록. `scripts/research/out`·`backups` 출력은 비공개 저장소(`scripts/research/lib/privateStore.mjs`)로 교체, 백업/이전 스크립트 신규.
- 2 VietMap 검색 서버 이전: `api/admin-vietmap.js`(관리자 전용, 하루 250회 상한·fail closed·키 비노출). 키 `VIETMAP_SERVICE_KEY`는 Vercel 환경변수에 사용자가 넣어야 함. 로컬 스크립트의 .env 키 읽기 제거(관리자 세션 JWT + 서버 API).
- 3 길찾기: `src/lib/directionsPlan.ts` — ① 승인 좌표 "Chỉ đường" ② KCN 정문 좌표 "Đến cổng KCN" ③ "Gọi hỏi đường"(`tel:`). 좌표 링크만. 자동 승인 `evaluateAutoApproval`(회사명 정확 일치 + 구·KCN 안, 1건) — `generate-location-candidates.ts --auto-approve`.
- 4 KCN 정문 dry-run(`docs/ops/2026-10-08_kcn_gate_dryrun.md`): 주요 KCN 22곳 중 A 0 / B 후보 9곳(노드 40) / 없음 13. 위성·VietMap POI 미수행 → 정문 좌표는 아직 하나도 채우지 않음.
- 5 DEMO_JOBS 제거, 공개 0건이면 `NoPublicJobs` 안내. 6 `[source:…]`를 SSR·메타·JSON-LD·sitemap·목록에서 제거(`src/lib/sourceTag.ts`).
- 7 `.github/workflows/supabase-keepalive.yml`: 매일 1회 anon 키로 `local_jobs?select=id&limit=1`, 실패 시 워크플로 실패.

## 변경 내용

위 항목의 코드·문서·워크플로. DDL은 `supabase/pending/20261008000000_private_research_store.sql`(미적용, dry-run: `docs/ops/2026-10-08_private_store_ddl_dry_run.md`).

## 테스트 결과

`npx tsc --noEmit` 통과, `npm test` 40/41(실패 1건은 기존 `api/_zalo-token.test.ts` — Node 22.14에서 `mock.module`이 `createClient` export를 못 찾음, 이번 변경과 무관), `npm run build` 통과. 로컬 빈 공개 DB 기준 빈 상태 화면 확인. 신규 테스트: sourceTag·fetchJobsData·admin-vietmap·directionsPlan·locationCandidateMatch(자동 승인).

## 발견된 문제

- 현재 Production은 공개 공고 0건이라 DEMO_JOBS(가짜 공고)가 보이고 있었음 → 이번 브랜치 배포 전까지 그대로.
- 이 환경에는 서비스·관리자 자격증명이 없어 DDL 적용·Vercel/GitHub Secret 설정·VietMap 호출을 하지 못함.
- 기존 zalo 테스트 실패(위).

## 다음 결정사항

- 사용자: ① `supabase/pending` DDL dry-run 검토 후 승인(승인 시 적용) ② Vercel 환경변수 `VIETMAP_SERVICE_KEY` 설정 ③ GitHub Secrets `SUPABASE_URL`·`SUPABASE_ANON_KEY` 설정(keep-alive용) ④ PR 승인 → master 반영 → Production 배포 후 3·5·6번 화면 확인.
- 키·DDL 준비 후 KCN B 후보를 VietMap POI + 위성으로 확인해 정문 좌표 승격 여부 결정. chotot 100건(비공개)·pending 후보 33건 상태는 변동 없음(공개 전환은 별도 승인).

## 이어받기 안내 (완료 단계 / 남은 단계 / 다음에 할 첫 작업)

- 완료 단계(코드·문서 IMPLEMENTED+VERIFIED, BRANCH PUSHED, PR #15): 1 저장 원칙 / 2 VietMap 서버 API / 3 길찾기 3단계·자동 승인 / 4 KCN 정문 OSM dry-run(위성·VietMap 미수행) / 5 가짜 공고 제거 / 6 source 태그 숨김 / 7 Supabase keep-alive / 8 규칙 기록.
- 남은 단계: 사용자 DDL 승인 후 적용, `VIETMAP_SERVICE_KEY`·GitHub Secrets 설정, PR #15 승인 → master → Production 배포 → Production에서 3·5·6번 화면 확인, KCN B 후보 VietMap POI+위성 확인.
- 다음에 할 첫 작업: 사용자가 PR #15 승인을 알리면 master 반영·배포 후 Production 3·5·6번 화면 확인. 그 전에는 코드 재구현 금지(이미 VERIFIED).
- 사용량 관리 규칙(사용자 지시): 계정 사용량이 약 10% 남으면 작업을 멈추고 사용자에게 알린 뒤, 끝난 단계는 커밋·푸시하고 이 섹션을 갱신한다.

## 최근 완료 작업 로그

- 저장 원칙·VietMap 서버 이전·길찾기 3단계·가짜 공고/source 태그 제거 — 2026-10-08 — BRANCH PUSHED(`cursor/policy-vietmap-fake-jobs-c794`, PR) / master·Production·DB 미적용
- 공고 상세 화면 개편(알바몬 구조) — 2026-10-07 — MASTER PUSHED(`264d7d7`) / PRODUCTION DEPLOYED(`jobi-8vizwbcra`) / PRODUCTION VERIFIED(#4682)
- 공고 항목 설계 + 즉시 수정 실행(jobSchema·DDL 9·로고 244·재분류 26) + SSR 번들 장애 복구 — 2026-10-07 — MASTER PUSHED(`cd0eeeb`) / PRODUCTION DEPLOYED·VERIFIED
- 공고 항목 설계 + 즉시 수정(출처 로고 차단·분류 개선) — 2026-10-06 — BRANCH PUSHED(`fix/source-logo-and-classifier`, Preview `jobi-xg3h9jbxb`) / master·Production·DB 미적용(승인 완료, 실행 대기)
- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)
