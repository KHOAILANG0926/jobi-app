# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(맨 아래 "보관" 섹션은 제외, 넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-08 — 주소 검색 결과 반영 + KCN 윤곽·별칭 추가 + 대행사 칩 (DB 쓰기 없음)

- 사용자 실행 결과(상세주소 버튼): 22건 검색 / 자동 승인 2(#4713·#4750) / 핀 없음 18 / 호출 11 = 서버 11 / 남은 100 → HANDOFF 반영. 승인 핀 총 4건.
- 직전 1~3번 요청은 이 세션 메시지에 없어(받은 메시지는 4번부터) 이번에 요청 문구대로 진행: ① KCN 윤곽·별칭: OSM way 4곳 추가(Quế Võ III·Nam Sơn–Hạp Lĩnh·Thuận Thành 3·Đại Đồng–Hoàn Sơn, `scripts/ops/fetch_osm_outline.mjs`), VSIP/VISIP·Yên Phong "Khu mở rộng" 별칭, `requires`를 같은 공고의 다른 주소 글자에서도 찾도록 확장(지역 불명 "KCN VSIP"는 Bắc Ninh 주소일 때만). 모호한 3건(Yên Phong 단계 불명·Thuận Thành 2/3·"KCN III")은 추정 금지로 제외. ② 옛 xã 경계 지도: OSM에 phường/xã 경계 면 없음, HDX COD는 성 단위까지 → 출처 있는 윤곽 확보 불가, 보류. ③ 대행사 칩 "Qua công ty cung ứng"(공고 상세 헤더, `recruitment_type='agency'`).
- 검증: tsc·build 통과, `npm test` 42/43(기존 zalo 실패), `industrialPark.test.ts`에 새 매칭·모호 케이스 추가.

## 2026-10-08 — 상세주소 공고 VietMap 주소 검색 버튼·"Khu vực rộng" 표시 구현 (실행 전, DB 쓰기·API 호출 없음)

- 요청: 번지·도로·thôn 등 상세주소 공고(약 12건)를 VietMap 주소 검색으로 찾아 주소가 맞으면 승인 좌표로(관리자 버튼과 같은 서버 API·하루 한도 안), 결과 건수 보고. 옛 xã 경계 우선, huyện만 있는 공고는 "Khu vực rộng".
- 결과 건수는 **미보고**: 서버 API는 관리자 로그인이 필요해 이 환경에서 호출 못 함. 대신 관리자 버튼 "Tìm theo địa chỉ chi tiết (chotot)" 구현. 공개 DB 주소 분석: 상세주소 22건 중 번지+도로명 13건이 검색 대상(최대 26호출), 나머지 9건(lô/thôn/KCN 안·도로 번호만·Panasonic 주소 충돌 등)은 호출 없이 핀 없음.
- 판정: 첫 번지 + 도로명 단어 전부가 검색 결과에 있고 공고 주소의 phường/xã·huyện(옛 이름 그대로)이 맞는 1곳만 Place→승인. 결과 여러 곳이면 핀 없음. 질의는 "번지 도로명, 공고에 적힌 phường/xã, huyện, tỉnh".
- 코드: `runAutoLocate`에 `strategy` 추가(기본=회사명 동작 그대로), `addressLocate.ts`(검색 방식)·`addressParse.ts`(주소 분석, 공개 화면에서도 사용), `JobDetail`에 Khu vực rộng 표시, 단위 테스트(`addressLocate.test.ts`).
- 검증: tsc·build 통과, `npm test` 42/43(기존 zalo 실패 1건).

## 2026-10-08 — chotot 공개 후 Production 화면 확인 (DB 쓰기 없음)

- 사용자 확인 쿼리: chotot_public 100 / still_hidden 0 / total 100 / all_public_jobs 100 → HANDOFF 반영.
- Production(브라우저 실행): sb-4687·4685·4686·4702 모두 200, 회사명·전화·Zalo·Gọi 버튼 정상, `[source:`·경쟁 사이트 문구 없음, 홈·tìm kiếm 카드 표시. sb-4702는 지도+Chỉ đường(좌표 링크).
- 문제: sb-4687(KCN YÊN PHONG)은 영역 지도 없음 — 공단 표에 "Yên Phong mở rộng"만 있어 매칭 안 됨(추정 금지 설계). 공개 100건 분류: 승인 핀 2 / KCN 지도 13 / Gọi hỏi đường만 85 → KCN 글자 31건 중 18건 지도 없음(HANDOFF 다음 할 일 3번).
- 참고: 상세 화면에 대행사 표기는 없음(기존 동작, `recruitmentType`은 화면에 안 씀).

## 2026-10-08 — chotot 공개 완료 반영 + 확인 URL SQL 형식 수정 (코드·DB 쓰기 없음)

- 사용자 보고: chotot 100건 공개 완료(SQL Editor 직접 실행). 확인 URL SQL이 `/viec-lam/<id>`로 만들어 404.
- 원인·수정: 앱의 공고 ID는 `sb-<local_jobs.id>`(`src/lib/jobId.ts`) → URL SQL 4곳과 문서 형식을 `/viec-lam/sb-<id>`로 수정, PGlite로 재확인. HANDOFF에 "공개 완료"·다음 할 일 반영.

## 2026-10-08 — chotot 공개 전환 준비: dry-run·공개 SQL·확인 URL (DB 쓰기·공개 없음)

- 요청(사용자 결정: 핀 없이도 공개): 공개 대상/KCN 영역 지도/Gọi hỏi đường만 건수 보고, 건수 가드 있는 공개 SQL, 공개 후 확인 URL.
- 건수는 **미보고**: 관리자 DB 접근이 없고 anon은 비공개 0건. 대신 dry-run SELECT(`docs/ops/2026-10-08_chotot_publish_dryrun.sql`) + 정확한 KCN 분류 스크립트(`scripts/ops/chotot_publish_classify.ts`, 앱의 `findIndustrialPark` 사용).
- 공개 SQL `supabase/pending/20261008100000_publish_chotot_jobs.sql`: chotot 100건 확인·대상 건수=`v_expected` 가드(null이면 중단)·갱신 건수 가드·끝에 공개 건수 확인 쿼리. URL 고르는 쿼리 `…_chotot_publish_urls.sql`, 설명 `…_chotot_publish_dryrun.md`.
- 검증: PGlite로 합성 100행 실행(가드 3종·정상 갱신·확인 쿼리), tsc·build 통과.

## 2026-10-08 — Vị trí 자동 검색 버튼: 10/100 처리인데 "완료" 표시·호출 132회 소모·화면 호출 0 (수정, DB 쓰기 없음)

- 증상(사용자 실행): Đã đọc 100/100, Đã tìm 10/100, chưa xử lý 90, 그런데 "Đã xử lý xong…" 표시. 오늘 남은 호출 247→115(132 소모), 화면 "gọi VietMap lần này: 0".
- 코드상 원인: (1) 진행 중 요약의 초기 `stopped='done'`가 그대로 노출돼 완료 문구가 뜸 → 완료 문구는 실행 종료(phase=finished)+100건 모두 판정일 때만. (2) 화면 호출 수는 성공 응답만 셌는데 서버는 호출 전에 차감(실패·타임아웃도 소모) → 시도 단위로 집계. (3) 기존 로직은 공고당 Search 여러 번+Place 최대 3회까지 가능 → 공고당 Search 1 + 이름이 정확히 일치하는 후보 1개만 Place 1(상한 2). 일치 후보가 없거나 여러 개(지점)면 Place 0. (4) 연속 5회 실패 시 호출 낭비 없이 중단(오류 표시), 조회 실패 공고는 미처리로 셈.
- 화면: 실행 상태는 모듈 단위 저장소(탭 이동·리마운트에도 유지), "이번 실행 호출(화면)"과 "서버 카운터 증가분"을 같이 표시하고 차이가 나면 다른 탭/스크립트가 같은 카운터를 쓴 것이라는 경고.
- 확정 못 한 것: 왜 10건에서 멈췄고 132회가 소모됐는지는 관리자 DB·로그 접근이 없어 증명 불가(가설: 이전 코드의 공고당 다중 호출 + 한도 외 소모). 새 화면의 서버 증가분 표시로 다음 실행에서 확인 가능.
- 검증: tsc·build 통과, `npm test` 41/42(기존 zalo 실패), 단위 테스트(100건=정확히 200호출·남은 50, 연속 실패 중단, 서버 delta 경고, 진행 중 스냅샷 not-done).

## 2026-10-08 — Vị trí 자동 검색 버튼 버그: 100건 중 4건만 처리하고 "완료" 표시 (수정, DB 쓰기 없음)

- 증상(사용자 실행 결과): Đã tìm 4/100, 호출 3, 자동 승인 0, 핀 없음 4, chưa xử lý 0, "Đã xử lý xong tất cả tin".
- 확인: 판정 루프는 100건을 넣으면 100건 모두 처리(단위 테스트). 문제는 (1) 대상 조회가 4건만 돌려줬는데 그 4건을 끝내면 "완료"로 표시, (2) 미처리를 읽어 온 건수 기준으로만 셈. 조회가 4건만 돌려준 이유는 이 환경에서 관리자 DB 접근이 없어 확정 못 함(anon은 범위 내 0건, RLS상 관리자는 전부 읽어야 함).
- 수정: 대상을 ID 범위 + `source like 'chotot:%'` 합집합으로 조회(페이지·ID 분할), "đọc được N/100"·숨김/표시 수·읽히지 않은 ID 목록 표시, `jobsTotal`=100 기준으로 chưa xử lý 계산, 100건이 모두 판정됐을 때만 "xong"(적게 읽히면 "CHƯA xong"). 건수는 공고 단위.
- 검증: tsc·build 통과, `npm test` 41/42(기존 zalo 실패), 단위 테스트(100/100 done, 4/100 incomplete·96 미처리, 한도 중단) + 브라우저 mock(4건 읽힘 → 경고·"CHƯA xong").

## 2026-10-08 — 관리자 Vị trí 탭 "Tìm vị trí tự động (chotot)" 버튼 구현·병합·배포 (코드만, DB 쓰기·DDL·공개 없음)

- 요청: 서버 API로 chotot 100건 검색 → 자동 승인 기준만 승인 좌표 반영, 하루 250회·이어서 실행, 결과 표시. PR #18·#19 병합·배포.
- 처리: `api/admin-vietmap.js`에 `usage` 액션(오늘 사용량 읽기, 호출·카운트 없음), `src/lib/chototAutoLocate.ts`(검색→판정→승인, 캐시, 한도 중단), `AdminAutoLocate.tsx`, `evaluateAutoApproval`에 법인 등록 주소형 제외(`registered_address_like`). 검색 캐시는 `research_artifacts`(kind `autolocate`)에 저장해 다음 날 이어서 실행.
- 검증: tsc·build 통과, `npm test` 41/42(기존 zalo 실패 1건), 로컬 브라우저 mock 흐름(승인 1/핀 없음 3, 호출 수 표시) 확인. master `a20f08b` 병합·Production 배포 success, 번들에 버튼 문구 확인. 실제 관리자 로그인 실행은 하지 않음.
- 남은 일: DDL 적용(Claude), 버튼 실행, KCN 정문 보강, 공개 전환 dry-run.

## 2026-10-08 — VIETMAP_SERVICE_KEY 설정 후 후속 4단계 요청 — 1단계 보고만, 2~4단계 차단

- 요청: DDL 요약 보고 → chotot 100건 재검색·자동 승인 → KCN 정문 보강 → 공개 전환 dry-run.
- 확인: Vercel에 키 설정·Redeploy 후 `/api/admin-vietmap` 비로그인 호출은 401(키 값 노출 없음). VietMap 호출 0회, DB 쓰기 없음.
- 차단: ① DDL 미승인 → 일일 상한 카운터 RPC 없음(API는 fail closed) ② 이 환경에 관리자 로그인 세션·서비스 자격증명 없음(API는 관리자 JWT 필요, 승인 좌표 반영도 관리자 RPC) → 2~4단계는 승인·세션 후 진행.

## 2026-10-08 — PR #15 master 병합·Production 배포·검증 (DB 쓰기 없음)

- 요청: PR #15 병합·배포 후 가짜 공고 제거와 길찾기 3단계를 Production에서 확인.
- 처리: 빠른 전진(fast-forward)으로 master `447e380` 반영(PR MERGED) → Vercel Production 배포 success(`jobi-7nlzfo3as`).
- 확인(https://viecganban.vn): 홈·tim-kiem·tuyen-gap 공고 카드 0·빈 상태 문구·`[source:` 0. 공개 공고가 없어 길찾기는 브라우저 안 mock 응답으로 확인: Chỉ đường / Gọi hỏi đường / 버튼 없음 정상, Đến cổng KCN은 정문 좌표 0개라 미확인. mock은 GET만, 쓰기 요청 0.
- 남은 일: DDL 승인, `VIETMAP_SERVICE_KEY`·GitHub Secrets 설정, KCN 정문 후보 확인.

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


