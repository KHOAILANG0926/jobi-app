## 2026-10-15 10:40 — R8 직업군 규칙 SQL + 자동 분류기 (미적용) (Claude)

- 요청: 직업분류 계속 진행(사용자). 운영 적용 결과: [직접 확인] occupation-master-apply run 38671967420 성공, 운영 DB 1505/603/21.
- 변경: `supabase/pending/20261015120000_local_jobs_occupation_r8.sql`(+rollback), `supabase/tests/local_jobs_occupation_r8.pglite.test.mjs`, `crawler/occupation_classifier.py`(+test).
- 검증: [직접 확인] PGlite 통과(없는 코드·1~3단계·근거 없음·원문에 없는 근거 거부, 글 수정 시 미분류 복귀, 공개 상태 불변, 롤백). 분류기 unittest 9/9, #4824 → 82022 근거 "làm linh kiện tai nghe".
- 한계: PGlite에는 운영의 기존 트리거 2개가 없음 → R8 트리거 이름을 trg_zzz_로 해 기존 규칙 뒤에 실행. 크롤러 연결·화면은 DB 적용 후(칸이 없으면 저장 실패하므로).
- 운영 DB 변경·배포 없음.

## 2026-10-15 10:00 — 직업분류 마스터 DDL·입력 SQL (미적용) (Claude)

- 요청: 2단계 진행 — 공식 코드 테이블. 운영 적용은 승인 후.
- 변경: `supabase/pending/20261015100000_occupation_master.sql`(occupation_master·occupation_descriptions·occupation_aliases, RLS 공개 읽기만), `_rollback.sql`, `20261015100100_occupation_master_seed.sql`(자동 생성), `scripts/occupations/build_seed_sql.py`, `supabase/tests/occupation_master.pglite.test.mjs`.
- 검증: [직접 확인] PGlite 2회 실행(멱등) — master 1505(10/48/152/509/786), 설명 603, 동의어 21, 부모 누락 0, 잘못된 코드·계층·anon 쓰기 거부, 롤백 확인.
- 이후 사용자 승인: SQL을 migrations로 이동, 적용 워크플로 `occupation-master-apply.yml` + 점검 `supabase/tests/occupation_master_check.sql` 추가. 직업군 화면은 Cấp2 48개 기본으로 결정.

## 2026-10-15 09:30 — 34/2020 공식 직업분류 원본 확보·추출 (Claude)

- 요청: Viecganban 직업군을 정부 공식 분류(QĐ 34/2020/QĐ-TTg) 기준으로. 1단계 = 원본 추출만(DB·배포 금지).
- 변경: `.github/workflows/fetch-occupation-source.yml`(관보 .doc 6개 다운로드, 인증서 중간체 AIA 보충·검증 유지), `scripts/occupations/extract_34_2020.py`, `data/occupations/34-2020/`(source·occupation_codes·descriptions·needs_review·VALIDATION).
- 검증: [직접 확인] Actions run 38667313009 성공(커밋 dae1da4). 추출 결과 Cấp1~5 = 10/48/152/509/786, 합계 1505. 중복·부모 누락·단계 불일치·빈 명칭 0. 설명 연결 603(Cấp5·그룹1 하위는 원본에 설명 없음).
- 명칭이 다른 20건은 코드 기준으로 연결(사용자 결정: 직업군은 코드가 기준), 부록 II 명칭은 alias_vi로 보관. 원본 오타 row 52(Cấp5 "1330")는 13300으로 보정.
- master/배포/DB 쓰기 없음. 브랜치 feat/occupation-master-extract, PR #87.

## 2026-10-13 관리자 공고 등록 확인
- 요청: SQL을 사용자에게 매번 실행시키지 않고 관리자 화면에서 공고 확인·게시.
- 변경: 기존 폼 JSON 초안 가져오기, 편집 후 미리보기, 서버 반환 저장 상태·공고 링크, 관리 목록 갱신.
- 파일: src/pages/AdminDashboard.tsx, src/lib/adminJobDraft.ts, src/lib/adminJobDraft.test.ts.
- 검증: 핵심 테스트 red→green 확인. 전체 CI는 PR에서 확인. 실제 운영 관리자 등록은 미검증.
- GitHub 브랜치 codex/admin-job-preview-publish-20261013. master/배포/DB 쓰기 없음.
- 한계: 이미 active=false로 저장된 행의 재활성화 기능은 이 변경에 포함하지 않음. 기존 admin_set_job_hidden RPC는 active를 변경하지 않음.

# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(맨 아래 "보관" 섹션은 제외, 넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-13 13:40 — 관리자 주소 지오코딩 시험 API (Claude)

- 요청: 핀은 가게 기준이 아니라 주소 기준으로(사용자 지시). VietMap 검색은 "37 Lý Thái Tổ"에 33·39번지 가게만 돌려줌(번지 주소 자체 없음, 직접 확인).
- 변경: `api/admin-geocode.js`(관리자 전용, TomTom·Goong 주소 검색 결과를 정리해 반환, DB 쓰기·핀 생성 없음) + `api/_admin-geocode.test.ts`.
- 필요: Vercel Production 서버 환경변수 `TOMTOM_API_KEY`(필수), `GOONG_API_KEY`(Goong 계정 활성화 후).
- 검증: 새 테스트 통과, tsc 통과, npm test 52/52, build 통과.

## 2026-10-13 06:20 — 길찾기 숨김 금지: 회사명+지역 Google 링크 (Claude)

- 요청: 정확한 위치 없는 공고(약 92건)에 전화 버튼만 남긴 것은 "길찾기 숨기지 말라"는 기존 지시 위반 — 수정.
- 변경: directionsPlan에 회사명+동·구·성 Google 검색·길찾기 단계, 안내 문구, 전화 버튼 병기. 상세·홈 지도. 규칙 3개 파일.
- 검증: tsc 통과, npm test 51/51, build 통과.
- 남은 문제: Production 배포(Vercel 권한 없음). 위치 후보 4건 승인 대기.

## 2026-10-12 23:40 — 길찾기 A안: 정확한 거리 주소는 Google 주소 검색으로 (Claude)

- 요청: VietMap 최신 반영 지연 → 위치·길찾기는 Google로(사용자 결정 A안). 좌표 없는 공고도 정확한 주소면 Google에 넘김.
- 변경: directionsPlan에 address 단계(승인 좌표 > KCN 정문 > 정확한 주소 > 전화). 상세·홈 지도 버튼. 규칙 3개 파일 문구.
- 검증: tsc 통과, npm test 51/51, build 통과. 운영 주소 14건 중 7건 대상, KCN·Lô·Khu·행정구역 충돌은 제외(테스트 고정).
- 남은 문제: Production 배포 필요(이 환경에 Vercel CLI 권한 없음).

## 2026-10-12 22:45 — 공고 제외 정책 DB 트리거 적용 (Claude)

- 요청: 제외 대상 공고 재유입 완전 차단(앱 밖 경로 포함). 사용자 승인으로 Production DB 트리거 적용.
- 변경: `policy_decision` 컬럼, 함수 `job_policy_rules/norm/match/decision`, `enforce_job_posting_policy` + 트리거. 저장소에 동일 SQL 마이그레이션과 규칙 동기화 테스트 추가.
- 검증 [직접 확인]: DB 판정 fixtures 57/57, 운영 공개 101 allow, #4750 exclude. 트리거 시험(임시 테이블에 동일 함수) 7건 의도대로. 운영 데이터 변경 없음(103/101/#4750 숨김 유지).
- 남은 문제: VPS 코드 갱신은 수집 재개 전(트리거가 차단은 보장). 운영 테이블 직접 쓰기 시험은 승인 단계에서 막혀 임시 테이블로 대체.

## 2026-10-11 10:40 — 거짓 보고 대책(STATUS 자동 기록) + 승인 규칙 B안 + 핀 2건 철회 (Claude)

- 요청: GPT의 허위 보고(하지 않은 웹 검색을 했다고 보고·출처 첨부) 이후 지금까지 작업 검증, 재발 방지 장치, 승인 규칙 B안.
- 검증 결과 [직접 확인 2026-10-11 DB·GitHub 조회]: PR #35·#36 병합은 사실. 그러나 HANDOFF의 "npm test 46/46"은 master 재실행·GitHub Actions 모두 45/46(`api/_zalo-token.test.ts` 실패), "원격 tree가 로컬 커밋 e615566과 일치"는 e615566이 GitHub에 없어 검증 불가, 10/8 "주소 재실행 신규 승인 0건"은 DB에 #4721 승인(07:27 UTC) 기록이 있어 사실과 다름.
- 변경 1 (PR #37 `f6eed59`): `scripts/status/`·`status-report.yml`·`status-guard.yml` — DB·GitHub를 직접 조회해 `status` 브랜치 STATUS.md를 봇이 생성(master 반영·매일 06:47 VN). AGENTS.md·CLAUDE.md·Cursor 규칙 맨 위에 보고 검증 규정.
- 변경 2 (이 PR): `evaluateAutoApproval` — KCN 윤곽 밖에서 회사명 일치만으로는 핀 없음(`name_only_no_house`). 주소 검색(번지+도로 일치) 승인은 그대로. 테스트 기대값 갱신(승인 흐름 테스트는 VSIP 윤곽 안 좌표로 이동). 규칙 문구 3개 파일 갱신.
- DB (사용자 승인): 후보 37(#4702)·18(#4720) approved→revoked + admin_audit_logs 기록(executor=claude-service-sql). 남은 승인 핀: #4713·#4721·#4750.
- 검증: tsc 통과, `npm test` 45/46(기존 zalo 실패만), build 통과.
- 후속(같은 날): Zalo 테스트 mock 수정(PR #39, 46/46), PR 검사 워크플로 추가(PR #40), 사용자가 master 보호 설정(필수 검사 checks·guard, 우회 금지) — API로 확인. #4750 B2B 영업직 숨김·핀 철회(사용자 지시).
- 후속2: GPT 교차 검증(PR #42 리뷰)에서 배포 대기 조회 오류·DB 트리거 위조 가능 지적 → 수정·보류. VietMap 재확인을 사이트 서버(OIDC)로 이전(PR #43). #43에서 Claude가 조회 선언을 지워 STATUS 1회 실패 → PR #44 복구 + 생성기 전체 실행 점검을 PR 검사에 추가. 12:09 STATUS 성공, 핀 2건 VietMap ✅.
- 남은 문제: Goong 비교(계정 활성화 대기), #4685 VietMap 주소 미발견, B2B 영업직 필터 미구현.

## 2026-10-10 — sb-4685·sb-4721 주소 캐시 재조회 + VietMap 호출 추적 (DB 쓰기·유료 API 호출 없음)

- 두 공고에만 공고 ID가 포함된 `address-v2` 캐시 키를 적용해 기존 실패 캐시를 우회하고, 다른 공고 캐시는 유지했다. 주소·회사명·행정구역·자동 승인 조건은 변경하지 않았다.
- 관리자 주소 결과에 공고 ID별 cache/fresh/skipped, 요청 시도 수, 실패/승인 사유를 표시한다. 추적 목록에서 회사명·주소·POI명·전화번호·Secret은 제외했다.
- 페이지 시도 수(실패·타임아웃·일일 한도 거절 포함)와 서버 공유 카운터 시작/검증된 종료/마지막 관측값·증가분·베트남 날짜를 분리했다. 429 공고도 추적에 남기고, upstream 실패·429·타임아웃 뒤 예약된 서버 사용량을 보존하며, 종료 usage 실패나 날짜 변경 시 delta를 미확정으로 둔다.
- 확정 불가: 운영 재실행 전에는 두 공고의 새 실패 사유와 기존 잔여 52→49의 3회 주체를 알 수 없다. Production DB/DDL/배포와 실제 VietMap 호출은 하지 않았다.
- 기존 운영 결과 인수인계: 사용자가 xã/phường 24개·84건 적용 완료를 보고했으며, 사전 예상 64건과 20건 차이는 아직 원인 미확정이다.
- 검증: 관련 회귀 테스트 추가, `npm test` 46/46·`npx tsc --noEmit`·`npm run build` 통과. build는 제한된 환경에서 `RAYON_NUM_THREADS=1`, Node heap 512MB로 순차 실행했다. branch `fix/address-vietmap-tracing`; GitHub 인증 만료로 push/PR 대기.

## 보관 (HANDOFF에서 이동, 2026-10-08) — 최근 10개 제한 대상 아님

> `CHATGPT_HANDOFF.md`를 1페이지로 줄이면서 옮긴 이전 기록. 최신 상태는 HANDOFF를 본다.

### A. 2026-10-08 세션 상세 (branch `cursor/policy-vietmap-fake-jobs-c794`, PR #15)


#### 현재 작업(당시)

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**저장 원칙·VietMap 서버 이전·길찾기 3단계·가짜 공고 제거·`[source:]` 숨김·Supabase keep-alive·규칙 기록 (2026-10-08).** branch `cursor/policy-vietmap-fake-jobs-c794`(master 기반). 상태: IMPLEMENTED / VERIFIED(tsc·`npm test` 40/41·build, 로컬) / **BRANCH PUSHED + PR — master 미반영, Production 미배포, Production 화면(3·5·6번) 미확인**. DB 쓰기·공고 공개 없음.

- 1·8 저장 원칙·규칙: PC에 키·데이터·결과 저장 금지, 키는 Vercel 환경변수만, 수집·백업은 Supabase 비공개 테이블/Storage. CLAUDE.md·AGENTS.md·`.cursor/rules/project-rules.mdc`(alwaysApply)에 1·3·5번 원칙 기록. `scripts/research/out`·`backups` 출력은 비공개 저장소(`scripts/research/lib/privateStore.mjs`)로 교체, 백업/이전 스크립트 신규.
- 2 VietMap 검색 서버 이전: `api/admin-vietmap.js`(관리자 전용, 하루 250회 상한·fail closed·키 비노출). 키 `VIETMAP_SERVICE_KEY`는 Vercel 환경변수에 사용자가 넣어야 함. 로컬 스크립트의 .env 키 읽기 제거(관리자 세션 JWT + 서버 API).
- 3 길찾기: `src/lib/directionsPlan.ts` — ① 승인 좌표 "Chỉ đường" ② KCN 정문 좌표 "Đến cổng KCN" ③ "Gọi hỏi đường"(`tel:`). 좌표 링크만. 자동 승인 `evaluateAutoApproval`(회사명 정확 일치 + 구·KCN 안, 1건) — `generate-location-candidates.ts --auto-approve`.
- 4 KCN 정문 dry-run(`docs/ops/2026-10-08_kcn_gate_dryrun.md`): 주요 KCN 22곳 중 A 0 / B 후보 9곳(노드 40) / 없음 13. 위성·VietMap POI 미수행 → 정문 좌표는 아직 하나도 채우지 않음.
- 5 DEMO_JOBS 제거, 공개 0건이면 `NoPublicJobs` 안내. 6 `[source:…]`를 SSR·메타·JSON-LD·sitemap·목록에서 제거(`src/lib/sourceTag.ts`).
- 7 `.github/workflows/supabase-keepalive.yml`: 매일 1회 anon 키로 `local_jobs?select=id&limit=1`, 실패 시 워크플로 실패.

#### 변경 내용

위 항목의 코드·문서·워크플로. DDL은 `supabase/pending/20261008000000_private_research_store.sql`(미적용, dry-run: `docs/ops/2026-10-08_private_store_ddl_dry_run.md`).

#### 테스트 결과

`npx tsc --noEmit` 통과, `npm test` 40/41(실패 1건은 기존 `api/_zalo-token.test.ts` — Node 22.14에서 `mock.module`이 `createClient` export를 못 찾음, 이번 변경과 무관), `npm run build` 통과. 로컬 빈 공개 DB 기준 빈 상태 화면 확인. 신규 테스트: sourceTag·fetchJobsData·admin-vietmap·directionsPlan·locationCandidateMatch(자동 승인).

#### 발견된 문제

- 현재 Production은 공개 공고 0건이라 DEMO_JOBS(가짜 공고)가 보이고 있었음 → 이번 브랜치 배포 전까지 그대로.
- 이 환경에는 서비스·관리자 자격증명이 없어 DDL 적용·Vercel/GitHub Secret 설정·VietMap 호출을 하지 못함.
- 기존 zalo 테스트 실패(위).

#### 다음 결정사항

- 사용자: ① `supabase/pending` DDL dry-run 검토 후 승인(승인 시 적용) ② Vercel 환경변수 `VIETMAP_SERVICE_KEY` 설정 ③ GitHub Secrets `SUPABASE_URL`·`SUPABASE_ANON_KEY` 설정(keep-alive용) ④ PR 승인 → master 반영 → Production 배포 후 3·5·6번 화면 확인.
- 키·DDL 준비 후 KCN B 후보를 VietMap POI + 위성으로 확인해 정문 좌표 승격 여부 결정. chotot 100건(비공개)·pending 후보 33건 상태는 변동 없음(공개 전환은 별도 승인).

#### 이어받기 안내 (완료 단계 / 남은 단계 / 다음에 할 첫 작업)

- 완료 단계(코드·문서 IMPLEMENTED+VERIFIED, BRANCH PUSHED, PR #15): 1 저장 원칙 / 2 VietMap 서버 API / 3 길찾기 3단계·자동 승인 / 4 KCN 정문 OSM dry-run(위성·VietMap 미수행) / 5 가짜 공고 제거 / 6 source 태그 숨김 / 7 Supabase keep-alive / 8 규칙 기록.
- 남은 단계: 사용자 DDL 승인 후 적용, `VIETMAP_SERVICE_KEY`·GitHub Secrets 설정, PR #15 승인 → master → Production 배포 → Production에서 3·5·6번 화면 확인, KCN B 후보 VietMap POI+위성 확인.
- 다음에 할 첫 작업: 사용자가 PR #15 승인을 알리면 master 반영·배포 후 Production 3·5·6번 화면 확인. 그 전에는 코드 재구현 금지(이미 VERIFIED).
- 사용량 관리 규칙(사용자 지시): 계정 사용량이 약 10% 남으면 작업을 멈추고 사용자에게 알린 뒤, 끝난 단계는 커밋·푸시하고 이 섹션을 갱신한다.



#### 최근 완료 작업 로그(당시)

- 저장 원칙·VietMap 서버 이전·길찾기 3단계·가짜 공고/source 태그 제거 — 2026-10-08 — BRANCH PUSHED(`cursor/policy-vietmap-fake-jobs-c794`, PR) / master·Production·DB 미적용
- 공고 상세 화면 개편(알바몬 구조) — 2026-10-07 — MASTER PUSHED(`264d7d7`) / PRODUCTION DEPLOYED(`jobi-8vizwbcra`) / PRODUCTION VERIFIED(#4682)
- 공고 항목 설계 + 즉시 수정 실행(jobSchema·DDL 9·로고 244·재분류 26) + SSR 번들 장애 복구 — 2026-10-07 — MASTER PUSHED(`cd0eeeb`) / PRODUCTION DEPLOYED·VERIFIED
- 공고 항목 설계 + 즉시 수정(출처 로고 차단·분류 개선) — 2026-10-06 — BRANCH PUSHED(`fix/source-logo-and-classifier`, Preview `jobi-xg3h9jbxb`) / master·Production·DB 미적용(승인 완료, 실행 대기)
- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)

### B. 2026-10-07 이전 HANDOFF 본문 (master `d3940fa` 시점, 공고 상세 개편·chotot·길찾기 정정 등)


#### 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**공고 상세 화면 개편 (알바몬 구조) (2026-10-07).** branch `feat/job-detail-sections`(master `5f596a4` 기반, worktree `C:\Users\HP\Downloads\jobi-wheel-fix`). 상태: IMPLEMENTED / VERIFIED(tsc·tests 37/37·build, 로컬 PC 1280px) / **사용자 승인(2026-10-07) → MASTER PUSHED(`264d7d7`, fast-forward) → PRODUCTION DEPLOYED(`jobi-8vizwbcra`, https://viecganban.vn) → PRODUCTION VERIFIED(#4682: 탭 2개 Điều kiện/Mô tả công việc — 회사 정보가 자리표시자("Nhà tuyển dụng Facebook")라 Thông tin công ty 탭은 설계대로 숨김, 연락처는 오른쪽 박스 한 곳(Gọi+Zalo), "Xem cách liên hệ"·"chưa nhận hồ sơ" 없음, KCN VSIP Bắc Ninh 점선 윤곽+이름표 지도 표시)**.

- 구조(2026-10-07 갱신): 탭은 3개(Điều kiện / Mô tả công việc / Thông tin công ty, 칸 균등·칸마다 1px 테두리, 비선택=회색·선택=흰 배경+빨간 글씨+아래 테두리 없음). Điều kiện 탭이 근무조건·모집조건·근무지역 3구역을 묶고, 5구역은 한 페이지에 모두 노출(탭은 스크롤 이동만, 스크롤 위치로 활성 탭). 구역·탭 정의는 `src/data/jobSchema.ts`·`src/lib/jobDetailView.ts`(JOB_TABS). 구역 제목은 박스 밖 위에 크게, 박스·제목(헤더) 박스 테두리 #f5c6d0 1px, 요약 박스 #bcd7f5. "라벨 | 값" 2열 표(PC 2칸), 값 없는 행은 숨김. 급여 앞 Lương tháng/ngày/giờ 배지. 헤더 태그는 결정 요소만(통근버스·기숙사·식사·즉시출근·주급), BHXH 등 복리후생은 근무조건 "Phúc lợi" 행. 새 컬럼을 select·타입·화면에 연결.
- 상세요강: 제목 반복·소제목 제거, 남은 문장을 행으로(Ưu tiên / Yêu cầu khác / Quyền lợi · Môi trường làm việc, 수집 공고의 "## Mô tả" 본문은 Nội dung công việc, 소제목 없는 문장은 Thông tin khác) — `src/lib/jobDescriptionRows.ts`. 행이 없으면 구역·탭 숨김.
- 근무지역 지도(2026-10-07 갱신): 상세는 **VietMap**(`src/components/JobVietMap.tsx`, 홈 생활지도와 같은 provider·`applyLifeMapStyle`·Bản đồ/Vệ tinh 전환)만 사용 — 상세에서 Geoapify·Leaflet 요청 0. 확인된 근무지만 핀, 작은 지도는 휠 줌을 끄고 터치 기기에선 드래그·핀치도 꺼 페이지 스크롤을 막지 않음(+/- 버튼). 지도 위 "Phóng to" → 공고 화면 안 전체화면 모달 지도(Esc·Đóng로 닫으면 공고 복귀, 배경 스크롤 잠금). 빈 지도 원인(수정됨): 벤더 CSS 지연 로드가 컨테이너 position/크기를 덮어써 높이 0 → 인라인 position/크기 + ResizeObserver.
- 공단(KCN) 수준 근무지: **출처 있는 KCN 중심 좌표·영역만**(`src/data/industrialParks.ts` 28개 + `industrialParkOutlines.ts` — OpenStreetMap landuse=industrial way, Overpass 2026-10-07; 중심은 원본 `out center`와 28개 모두 일치 확인, 윤곽은 `out geom` 꼭짓점을 ~6 m로 단순화). 매칭 `src/lib/industrialPark.ts`(KCN 표기 바로 뒤 이름이 별칭과 정확히 같을 때만, 순번 다르면 불일치, 같은 이름 다른 지역은 `requires`). 표에 없으면 지도 없이 글자 안내. 화면: **KCN 윤곽 전체가 보이게 맞춘 배율 + 점선 테두리·옅은 면 + 이름표(핀 없음)**, 작은 지도·Phóng to·위성 모두 동일, "Vị trí chính xác chưa xác minh" + OSM 출처 표기. **기존 방향에서 바뀐 것**: 2026-09-30 "공단 중심 좌표로 대신 표시하지 않는다"를 사용자가 일부 변경(출처 있는 KCN 영역 표시 + KCN 길찾기 허용).
- **길찾기 규칙(2026-10-07 사용자 지시 2회 정정, CLAUDE.md 반영)**: Google 지도 길찾기 링크 허용(외부 링크 금지는 경쟁 채용사이트 공고 링크에만). 반드시 좌표 링크(`destination=lat,lng`), 이름 검색 금지(9/29 VSIP 오안내 재발 방지). 승인 근무지(출입구·건물·부지 무관) = "Chỉ đường"(승인 좌표, `jobCoords.hasApprovedPoint`) — 이전: 출입구 승인만. **KCN 수준: 목적지에 공단 도형 중심 사용 금지**(Preview 확인: 중심이 빈 부지·들판) — ① OSM 공단 정문 node(공단 way에 붙은 barrier=gate/entrance) ② OSM/VietMap KCN 관리사무소(Ban quản lý) POI의 좌표만(`industrialParks.ts` `destination`, 출처 id·위성 확인일 필수), ①②가 없는 KCN은 길찾기 버튼 숨김. 도형 중심·윤곽은 영역 표시용으로만 유지. 지금 `destination`이 채워진 KCN은 0개(28개 전부 길찾기 숨김).
- **VSIP Bắc Ninh 조사 결과(2026-10-07)**: ① 공단 way(642274405)에 붙은 태그 있는 node 0개. bbox 안 `barrier=gate` node는 다수지만 공장별 게이트·주거지 입구뿐 — 가장 가까운 `barrier=lift_gate`(node/8341469038, 21.0801689·105.9680027)는 위성으로 확인하니 서쪽 Lý Thái Tổ 변 주거 단지(타운하우스) 입구라 공단 정문 아님(제외). ② OSM에 이름에 "Ban quản lý/BQL/Cổng/Gate"가 들어간 feature 0개(office=… 는 UBND xã Đại Đồng·"VSIP Bắc Ninh - Nhà xưởng cao tầng"뿐), VietMap POI(z16 타일 6개로 공단 전체 조회)에도 관리사무소·정문 키워드 0개 — "KCN Việt Nam Singapore Bắc Ninh"(class industrial, 위도 21.0791944·경도 105.9801158)는 공단 영역 라벨 POI. 결론: **VSIP Bắc Ninh은 조건을 만족하는 목적지 없음 → 길찾기 숨김**(사용자 결정 대기: 다른 후보 탐색·수동 승인 좌표 등).
- 연락(2026-10-07 갱신): 연락처는 화면에 한 곳만 — PC(≥761px)는 오른쪽 요약 박스(옅은 파란 테두리 #bcd7f5·흰 배경)에 Gọi 번호·Zalo 버튼, 하단 고정 바는 모바일(≤760px)에서만. 연락처가 있으면 연락처가 있으면 별도 지원 버튼·"chưa nhận hồ sơ" 박스·"Xem cách liên hệ" 없음. 내부 지원(기업 계정 공고)이거나 연락처가 없을 때만 지원 영역 표시.
- 기업정보: 회사 정보·같은 회사 다른 공고가 없으면 구역(탭 포함) 숨김. 자리표시자 회사명("Nhà tuyển dụng Facebook")은 같은 회사로 묶지 않음. 리뷰는 0건이면 숨김.
- **원문 항목 추출 — #4682 1건 Production DB 반영 완료(2026-10-07, 사용자 승인)**: `jobDescriptionExtract.ts`(+test)·`scripts/extract-job-fields.ts`(dry-run 전용, 반영 기능은 없음 — 반영은 승인받은 SQL로 직접 실행). 원문에 있는 값만 뽑고 문장은 상세요강에서 이동(출처 태그 `[source:…]` 유지). #4682: hours·work_days·education·preference·gender_requirement·benefit_tags·contact_zalo·language_requirement·business_trip 채움, description 정리. **원문 백업**: 신규 테이블 `local_jobs_description_backup`(RLS 켬·공개 접근 없음, job_id·description·reason·backed_up_at) 1행(원문 md5 `3fcc74d0…`). 다른 공고에는 아직 적용하지 않음(승인 필요).
- DDL(20261007031726): `local_jobs.language_requirement text`, `business_trip boolean` + 백업 테이블. jobSchema 36항목·`NEW_DDL_COLUMNS_2`.
- 리뷰(CompanyReviews)는 0건이면 숨김(사용자 결정). 리뷰는 브라우저 localStorage 기반이라 숨김 상태에선 첫 리뷰를 쓸 방법이 없음 — 필요하면 재논의.
- 모바일은 기존 배치 유지(구역 제목·표 스타일만 공통 적용). 실제 폰 확인은 아직 못 함(화면 캡처 불가 환경).

#### 변경 내용

`JobDetail.tsx` 재구성, `index.css`(jd2-sec/box/kv/tabs/하단 바), `jobRows.ts`·`JobsContext.tsx`·`fetchJobsData.ts`(select·매핑), `types/job.ts`, 신규 `jobDetailView.ts`·`jobDescriptionExtract.ts`(+tests), `scripts/extract-job-fields.ts`.

#### 테스트 결과

tsc 통과, `npm test` 37/37, build 통과. 로컬 PC 1280px: 5구역 순서·고정 탭·활성 탭 전환·하단 Gọi/Zalo·구역 숨김 확인. 모바일 375px은 가로 넘침 없음·하단 바 정상(측정). Preview 200(상세·tim-kiem·sitemap).

#### 발견된 문제

- 공개 공고 중 `salary_period` 값이 있는 공고가 없어 배지는 코드·테스트로만 확인.
- 이 환경은 창이 최소화되면 스크롤·rAF 이벤트가 지연돼 모바일 실화면 캡처 불가.

#### 다음 결정사항

- **박닌 Chợ Tốt 100건 — local_jobs 반영 완료(비공개), 2026-10-07**: 기존 크롤러 281건 삭제 확인(local_jobs 1건 #4682, source_url 0) 후 batch01(10건 확인)→02~10 실행, **실패·롤백 0**. **chotot ID 4685~4784**, 전부 admin_hidden=true·source_url NULL·`source='chotot:<광고번호>'`, job_work_locations 100행(좌표 없음), 체크섬(회사·전화·급여) 원본 일치, anon 조회 0건(공개로 보이는 공고는 #4682 하나). 실행기 `scripts/research/bn_apply_chotot_rest.py`(재실행 안전). **다음: 사용자가 Preview로 확인 후 공개 전환(admin_hidden=false) 승인 → 좌표 작업(KCN 31건 영역 표시 가능, 69건 좌표 없음).** 크롤러는 계속 꺼져 있어야 함(VPS crontab 미확인).
- **Chợ Tốt 시험 공개 3건 — 취소(2026-10-07 사용자 지시)**: #4751·#4714·#4774는 비공개로 되돌려 둔 상태 그대로, 공개 전환은 다시 지시가 있을 때만. **#4682도 admin_hidden=true로 비공개 전환**(회사명 자리표시자 = 공개 제외 규칙 위반) → 현재 공개 공고 0건. **chotot 100건 좌표 후보 dry-run 완료(2026-10-07, 서버 키 없이 타일+OSM)**: 자동 승인 후보 1(#4720 Pizza Hut Bắc Ninh) / 검토 필요 32 / 없음 67 — 외자 공장 이름이 타일·OSM에 거의 없고 광고 대략 좌표가 어긋나 일부만 가능. CSV `out/chotot_poi_candidates.csv`(바탕화면 bacninh_handoff). **승인 후 job_location_candidates에 33건(자동 1 + 검토 32) pending 반영 완료**(좌표·출처 id·일치 근거 저장, job_work_locations 좌표 변경 없음 → 승인 전 핀 없음). 관리자 화면: /admin → locations 탭(Chờ duyệt). **"없음" 67건은 그대로**: 범위 안 일치 POI 없음 57 / 근무 회사 없음(대행사 게시) 9 / 구별 가능한 단어 없음 1 — 좌표 없는 상태 유지, 서버용 VietMap 키(Search v4)가 생기면 재시도.
- **관리자 Vị trí 지도 빈 칸(2026-10-07)**: 한도 초과 아님(스타일·타일 200). 원인 = 후보 카드 33개가 WebGL 지도를 동시 생성해 브라우저 WebGL 컨텍스트 한도 초과. `AdminLocations`에서 화면에 보이는 카드만 지도 생성(VisibleOnly)으로 수정·배포. 관리자 로그인이 필요해 사용자 확인 대기. 한도 초과 안내 문구·CLAUDE.md 스캔 한도 규칙은 원인이 아니라 보류.
- **관리자 Vị trí 지도 라벨 없음(2026-10-07)**: 공식 tm 스타일은 POI가 z18부터·글씨 옅음 → 관리자 기본 z17에서 라벨 0개(요청 실패 아님). 관리자 지도에 `applyLifeMapStyle`을 적용(AdminVietMap만, 홈·상세 스타일 코드 변경 없음)하고 스타일 실패 시 안내 문구 추가.
- **VietMap Search/Place 재 dry-run 완료(2026-10-08, DB 쓰기 없음)**: 자동 승인 후보 5 / 검토 필요 29 / 없음 66(타일은 1/32/67). 호출 약 134회/일(상한 250). 위성 확인: #4720·#4755·#4696 타당, **#4713·#4721(Pizza Việt Nam)은 법인 등록 주소(주택가) POI라 부적합**. CSV `out/chotot_vietmap_search_candidates.csv`(바탕화면 bacninh_handoff). 다음: 승인 후 Search 후보를 job_location_candidates에 추가/교체(#4713·#4721 제외 권장).
- **회사 PC에서 이어가기(2026-10-08 정리)**: GitHub master에는 코드·문서·스크립트가 모두 있다(`git pull`). **PC-local이라 GitHub에 없는 것** — ① `crawler/.env`의 `VIETMAP_SERVICE_KEY`(Trial Search/Place 키, 회사 PC에도 한 줄 추가 필요, 값은 채팅에 붙이지 말 것) ② `scripts/research/out/`의 수집·후보 데이터(CSV·JSON·SQL, 이 PC에만 있음; 바탕화면 `bacninh_handoff/`에도 복사본) ③ `backups/20261007T121508Z/`(삭제 전 백업 281행) ④ 오늘 호출 기록 `vietmap_search_usage.json`(하루 250회 상한 집계 — 회사 PC는 별도 집계이므로 Trial 하루 500회 중 오늘 이 PC가 약 134회 썼음을 감안). **현재 DB 상태**: local_jobs = #4682(비공개) + chotot 100건(4685~4784, 전부 비공개), job_location_candidates pending 33건(타일 기준), 공개 공고 0건. **다음 후보 작업(승인 필요)**: Search/Place 후보를 job_location_candidates에 추가(#4713·#4721 제외 권장)·새 검토 14건 추가 → 관리자 Vị trí에서 승인 → chotot 공개 전환(시험 공개 3건 #4751·#4714·#4774 먼저). 회사 PC에서 Search 결과 CSV가 필요하면 바탕화면 폴더를 복사하거나 `bn_vietmap_search_dryrun.mjs`를 다시 실행(캐시가 없어 호출 약 130회 더 소모). **주의: GitHub 저장소가 PUBLIC이라 수집 데이터(전화번호)·백업·키는 절대 push 금지.** 두 PC 사이 데이터 이동은 비공개 클라우드로 — 바탕화면 `bacninh_data_for_company.zip`(scripts/research/out 압축, 키 포함 파일 제외, 0.7MB)을 올려 회사 PC의 `scripts/research/out`에 풀기.
- **좌표 — 반영 후 별도 작업(2026-10-07 사용자 지시)**: 위 100건은 lat/lng 모두 NULL(geocode pending). KCN 매칭 31건은 industrial_park·주소 텍스트로 KCN 영역 표시만 가능, **나머지 69건은 근무지 좌표 없음**. 기존 승인·좌표 절차(VietMap 후보 → 관리자 승인)로 처리.
- **기존 크롤러 행의 source_url 노출(발견, 미조치)**: `local_jobs.source_url`은 anon에게 SELECT 권한이 있고 기존 크롤러 행 약 280건이 경쟁 사이트 원문 URL을 담고 있다. 지금은 대부분 비공개(RLS)라 노출 안 되지만, 공개 전환하면 API로 읽힌다. 컬럼 권한 변경·값 정리는 STRICT 작업이라 별도 승인 필요.
- **VietMap에 서버용 키 요청**(Search v4·Place v4 허용) 후: 키를 Vercel/크롤러 환경에 `VIETMAP_SERVICE_KEY`로 설정 → `node scripts/generate-location-candidates.ts`(dry-run) 결과 확인 → 별도 승인 후 `--apply`(Production DB 쓰기) → 크롤러 연결 여부 결정. match_meta 컬럼(DDL)은 보류.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- 모니터링: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고). Search/Place 호출이 켜지면 근무지 1곳당 최대 4 transaction.
- Vercel env: `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview (2026-10-05 정리).
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.




## 2026-10-14 메인 공고 카드 — 이전 HANDOFF 보존

# CHATGPT_HANDOFF — 최신 작업
갱신: 2026-10-13 · 관리자 공고 초안 → 미리보기 → 공개 등록

## 현재 상태
- 기준 master: 186f566. 작업 브랜치: codex/admin-job-preview-publish-20261013.
- 관리자 기존 등록 RPC와 정책 검사를 유지. JSON 초안을 폼으로 불러온 뒤 미리보기와 공개 등록. 서버 반환 id/active/admin_hidden으로 저장 상태와 상세 링크 표시. 저장 후 관리 목록 새로고침.
- DB/Auth/RLS 변경 없음. 실제 공고 신규 등록·공개 전환·master 병합·Production 배포 없음.
- 로컬 핵심 검사: adminJobDraft.test.ts 실패(미구현) 확인 후 통과. 전체 tsc/build/test는 PR CI 결과를 확인해야 함.
- 운영 KDA 공고 저장 여부·ID는 직접 DB 조회 미확보. 이 PR은 공고 자체를 등록하지 않음.
- STATUS.md는 2026-10-13 13:48 VN 기록으로, 밤 데이터 변경 이후 상태를 증명하지 않음.

## 다음 할 일 3개
1. PR 최종 SHA의 checks/guard 결과 확인.
2. Lee 관리자 계정으로 초안 불러오기 → 미리보기 → 공개 등록 → 반환 공고 링크 확인.
3. 병합은 Lee만 수행. 배포 뒤 실제 관리자 흐름 검증.

## 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 보고는 직접 확인·기존 기록·추정을 구분.
- AI DB 쓰기 연결 복구 금지. 사용자 관리자 계정의 기존 등록 기능 사용.
- PC 저장 금지, GitHub 보존. 한국 영역 분리·원문 채용사이트 링크 금지.



## 2026-10-14 메인 공고 카드 — 배포 기록 / 이전 HANDOFF 보존

# CHATGPT_HANDOFF — 메인 공고 카드
갱신: 2026-10-14

## 1. 현재 상태
- 기준 master a663c13, 작업 codex/main-job-cards-20261014. 메인 추천/목록은 공고 ID별 한 번 표시하며 급여 미확인 공고를 카드에서 제외. 검색·지도·상세의 공유 데이터는 유지.
- 실제 Storage 이미지·회사명·지역·제목·원문 급여 표시. 업종 이미지·카드 Zalo 제거. 실제 시급→일급→월급 우선, 지급 주기가 없으면 추측하지 않음. PC hover·모바일 펼치기로 확인된 근무조건 표시.
- [직접 확인] 운영 DB #4824 active=true/admin_hidden=false, 실제 이미지·일급 있음. DB 쓰기·삭제 없음.
- [직접 확인] tsc/build 성공, npm test 54/54. Production 배포·운영 브라우저 검증은 아직 완료되지 않음. 사이트 도메인은 환경 네트워크에서 403 차단.

## 2. 다음 할 일 3개
1. PR 최종 SHA의 checks/guard 확인 후 사용자 지시 범위에서 master 반영·Production 배포.
2. 운영 홈에서 #4824 한 번 표시·실제 이미지·급여·hover/mobile 펼치기 확인.
3. 상세 Zalo·검색·지도 회귀 확인 후 배포 SHA와 검증 결과 기록.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. STATUS 검증 장치 수정 금지.
- #4824 포함 모든 공고 데이터 변경·삭제 금지. 메인 표시만 변경.
- 필수 검사 tsc/npm test/build, GitHub 보존·배포·실제 사이트 검증을 구분. Secret 출력 금지.

직접 확인: PR70 checks/guard 성공, master ecd7b3829a708cd71e2899e9ba9ffefbfcce45c2, Production dpl_8HhvvvseHveftSXM9EvSWqdadYmd READY 및 viecganban.vn alias. 운영 홈 HTTP200 새 index-D3r8bCNy.js, 상세 HTTP200 KDA 제목·실제 이미지·Zalo 확인. 로컬 Chromium + live read-only DB: KDA 카드1개·이미지 로드·PC hover·모바일 펼치기/접기·상세 Zalo 통과. 운영 도메인 직접 브라우저는 프록시403 차단, 미검증. CA 영구 신뢰 등록은 자동 검토 거절로 미적용. DB 쓰기 없음.

## 2026-10-15 이전 HANDOFF 보존 (메인 공고 카드)

갱신: 2026-10-14

### 1. 현재 상태
- [직접 확인] PR #70 병합, 코드 master ecd7b38. Production dpl_8HhvvvseHveftSXM9EvSWqdadYmd READY, viecganban.vn alias 확인.
- 메인 추천/전체 카드는 ID별 한 번 표시. 급여 미확인 카드는 메인 제외. 실제 이미지·회사명·지역·제목·원문 급여, 시급→일급→월급 우선(환산 없음). 업종 이미지·카드 Zalo 제거, PC hover·모바일 펼치기. 공유 검색·지도·상세 데이터 유지.
- [직접 확인] tsc/build 성공, npm test 54/54 및 PR CI checks/guard 성공. 로컬 Chromium + 운영 읽기 DB에서 KDA 카드1개·실제 이미지 로드·hover·모바일 펼치기/접기·상세 Zalo 확인.
- [직접 확인] 운영 홈/상세 HTTP200, 홈 새 JS 번들, 상세 KDA 제목·이미지·Zalo 확인. 운영 홈 직접 브라우저의 카드 개수·상호작용은 도메인 프록시403 때문에 미검증.
- [직접 확인] #4824 active=true/admin_hidden=false. 모든 공고 DB 쓰기·삭제 없음. CA 영구 신뢰 등록은 자동 승인 검토 거절로 미적용; TLS 검증 유지.

### 2. 다음 할 일 3개
1. 환경 네트워크에 viecganban.vn/www.viecganban.vn 허용 후 운영 브라우저 검증 재개.
2. 운영 홈 #4824 한 번 표시·실제 이미지·급여·PC hover·모바일 펼치기 확인.
3. 운영 검색·지도·상세 회귀 검증 결과만 추가 기록. 같은 기능 재구현 금지.

### 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분, STATUS 검증 장치 수정 금지.
- #4824 포함 공고 데이터 변경·삭제 금지. 표시만 변경.
- 테스트·GitHub 보존·배포·운영 브라우저 검증 구분. Secret 출력 금지.

