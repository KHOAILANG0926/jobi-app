# CHATGPT_HANDOFF — 이 파일만 읽고 이어받기 (1페이지)

갱신: 2026-10-08(토요일 이어받기용). 상세 이력·이전 본문은 `WORK_LOG.md`(맨 아래 "보관" 포함). 이 파일은 누적하지 않고 항상 최신 스냅샷으로 덮어쓴다.

## ▶ 이어받기 (토요일 ChatGPT/Codex) — 끝난 단계 / 남은 단계 / 다음 첫 작업

**끝난 단계 (2026-10-08, 모두 코드 MASTER MERGED + PRODUCTION DEPLOYED, DB 쓰기·공고 공개 없음)**
1. 저장 원칙·VietMap 관리자 서버 API(`api/admin-vietmap.js`)·길찾기 3단계·가짜 공고 제거·`[source:]` 숨김·규칙 기록 — PR #15, Production에서 확인 완료.
2. Supabase keep-alive 워크플로(Secrets 불필요) — PR #17, 실행 성공(HTTP 200).
3. Vercel `VIETMAP_SERVICE_KEY` 설정(사용자) — `/api/admin-vietmap` 비로그인 401 확인.
4. **`/admin` → Vị trí 탭 "Tìm vị trí tự động (chotot)" 버튼** — PR #19, master `a20f08b`, Production 번들에 버튼 포함 확인. 관리자가 누르면 chotot 100건(ID 4685~4784)을 서버 API로 검색 → 자동 승인 기준(회사명 정확 일치 + 주소 구·KCN 안, 법인 등록 주소형 POI 제외)만 승인 좌표 반영, 나머지 핀 없음, 하루 250회·한도 시 멈추고 다음 날 이어서, 결과(검색/자동 승인/핀 없음/미처리/오늘 남은 호출) 화면 표시. 로직 `src/lib/chototAutoLocate.ts`(+테스트), UI `src/components/admin/AdminAutoLocate.tsx`.
   - **버그 수정 1 (PR #21)**: DB에서 4건만 읽혀 "완료"로 표시 → ID 범위 ∪ `source like 'chotot:%'`로 읽고 100건 판정 시에만 완료. 사용자 재실행에서 Đã đọc 100/100 확인.
   - **버그 수정 2 (이번)**: 재실행에서 10/100만 처리·"완료" 표시·서버 호출 132회 소모·화면 호출 0. 수정: 완료 문구는 실행 종료+100건 판정일 때만, 공고당 Search 1 + 정확히 일치하는 후보 1개만 Place 1(상한 2, 지점 여럿이면 Place 0), 호출은 시도 단위로 집계, 연속 5회 실패 시 중단, 실행 상태 유지, 서버 카운터 증가분 병기(차이 나면 경고). **10건에서 멈춘 정확한 이유는 DB·로그 접근이 없어 확정 못 함** — 다음 실행의 서버 증가분·중단 사유 표시로 확인. 100건 전부 처리 시 정확히 200호출 이내(250 한도 안).

**남은 단계**
- (완료) 자동 위치 검색 버튼 실행 — 100건 처리: 자동 승인 0 / 기존 승인 2 / 핀 없음 98.
- (완료) chotot 100건 공개 전환 — 사용자가 `supabase/pending/20261008100000_publish_chotot_jobs.sql`을 SQL Editor에서 실행(2026-10-08). 확인 쿼리 결과: chotot_public 100 / chotot_still_hidden 0 / chotot_total 100 / all_public_jobs 100. **PRODUCTION VERIFIED(2026-10-08)**: sb-4685·4686(Gọi hỏi đường, 지도 없음)·sb-4702(핀+Chỉ đường `destination=lat,lng`)·sb-4687(KCN 글자만, 지도 없음) 모두 200, 회사명·전화·Zalo 표시, `[source:`/경쟁 사이트 문구 없음, 홈·tìm kiếm에 카드 표시.
- KCN 정문 후보(`docs/ops/2026-10-08_kcn_gate_dryrun.md`)를 VietMap 검색으로 보강(출처 있는 것만, DB 쓰기는 승인 후).

**다음에 할 첫 작업**: 공개된 chotot 공고 화면 확인 — 확인 URL 3개(KCN 영역 지도 / 일반 Gọi hỏi đường / 대행사)를 `docs/ops/2026-10-08_chotot_publish_urls.sql`로 고른 뒤(`https://viecganban.vn/viec-lam/sb-<id>`) 지도·길찾기·가짜 공고/`[source:` 없음 확인, 이어서 KCN 정문 좌표 보강. **이 작업에서 DB 쓰기·DDL 적용은 사용자 승인 없이 하지 않는다.** 이미 VERIFIED인 코드는 다시 만들지 않는다.

## 1. 현재 상태

**코드·배포**
- PR #15 **MASTER MERGED**(master `447e380`) → **PRODUCTION DEPLOYED**(Vercel Production, `jobi-7nlzfo3as`, https://viecganban.vn) → **PRODUCTION VERIFIED**(2026-10-08): 홈·tim-kiem·tuyen-gap에 가짜 공고 없음, "Hiện chưa có tin tuyển dụng nào đang mở" 빈 상태 표시, 공개 HTML·sitemap에 `source:` 0건. 검증: tsc·build 통과, `npm test` 40/41(실패 1건은 기존 `api/_zalo-token.test.ts`, 무관).
- 길찾기 3단계 Production 확인: 공개 공고가 0건이라 실제 상세 페이지가 없어, Production 번들에 가짜 DB 응답(브라우저 안 mock, DB 쓰기 0)을 주입해 확인 — 승인 좌표 → "Chỉ đường"(`destination=lat,lng`), 승인 좌표 없음+전화 → "Gọi hỏi đường"(`tel:`), 둘 다 없음 → 버튼 없음. **"Đến cổng KCN"은 정문 좌표가 0개라 화면에서 확인 불가**(단위 테스트로만 검증).
- 이후 master `a20f08b`(PR #18·#19 병합) → Production 배포 success, 관리자 Vị trí 자동 검색 버튼 포함(위 4번). 검증: tsc·build 통과, `npm test` 41/42(실패 1건 동일), 로컬 브라우저 mock으로 버튼 흐름 확인(실제 관리자 로그인 실행은 아직 안 함).
- 내용: DEMO_JOBS 제거+빈 상태, `[source:…]` 제거(SSR·메타·JSON-LD·sitemap), VietMap 관리자 서버 API(`api/admin-vietmap.js`, 하루 250회·키 비노출), 길찾기 3단계(`src/lib/directionsPlan.ts`)·자동 승인, 비공개 저장소 스크립트, keep-alive 워크플로(`src/lib/supabase.ts`의 공개 URL·anon 키를 읽어 Secrets 없이 동작), 규칙 기록(`CLAUDE.md`·`AGENTS.md`·`.cursor/rules/project-rules.mdc`).
- 이 시점 이전 기록(공고 상세 개편 `jobi-8vizwbcra` 등)은 `WORK_LOG.md`.

**DB (shared Supabase Production)**
- **chotot 100건(ID 4685~4784) 공개 완료·Production 확인**(공개 100 / 비공개 0 / 전체 공개 공고 100; `source_url` NULL). 위치 분류(공개 DB 읽기 + 앱 규칙, 2026-10-08): 승인 핀 2(#4702·#4720, Chỉ đường) / KCN 영역 지도 13(정문 좌표 0 → Gọi hỏi đường 병행) / 지도 없이 Gọi hỏi đường만 85. 전화 없음·회사명 없음 0건. `local_jobs` #4682는 비공개 유지.
- `job_location_candidates`: 기존 pending 33건 + 자동 위치 검색 결과(자동 승인 0, 기존 승인 2, 핀 없음 98). 승인 핀은 승인된 2건만.
- `local_jobs_description_backup`(RLS 켬, 1행). `local_jobs`에 `language_requirement`·`business_trip` 컬럼 추가됨(2026-10-07 DDL).
- 비공개 저장 DDL(`research_artifacts`·`vietmap_usage_daily`·관리자 RPC)은 **적용됨**(사용자가 Supabase SQL Editor로 실행, 버튼에서 "Hôm nay còn N/250" 표시 확인). 파일 `supabase/pending/20261008000000_private_research_store.sql`, 기록 `docs/ops/2026-10-08_private_store_ddl_dry_run.md`.
- 이번 작업에서 DB 쓰기·공고 공개는 하지 않았다.

**환경변수**: Vercel Production `VIETMAP_SERVICE_KEY` 설정·Redeploy 완료(사용자, 2026-10-08; `/api/admin-vietmap`은 비로그인 401 확인, 값 출력 금지). keep-alive는 GitHub Secrets가 필요 없다.

## 2. 다음 할 일 3개

1. **공개 후 화면 확인**: chotot 공개 완료. URL 3개(KCN 1·일반 1·대행사 1, 형식 `/viec-lam/sb-<id>`)를 `docs/ops/2026-10-08_chotot_publish_urls.sql`로 고르고 홈·상세·길찾기(0건→N건 화면 영향 포함) 확인. 상세 `docs/ops/2026-10-08_chotot_publish_dryrun.md`.
2. **KCN 정문 좌표 보강**: dry-run 후보(주요 22곳 중 A 0 / B 후보 9곳 / 없음 13)를 VietMap 검색 + 위성으로 확인해 출처 id 있는 것만 후보로 정리(`src/data/industrialParks.ts` `destination` 승격은 승인 후, DB 쓰기 없음). 그 전엔 정문 좌표 0개 → 전화 안내로 동작.
3. **KCN 이름이 공단 표에 없어 지도가 안 나오는 18건**: 근무지에 KCN 글자가 있는 31건 중 18건은 `src/data/industrialParks.ts`에 없는 이름이라 영역 지도 없이 글자+Gọi hỏi đường만 나온다(VSIP/VISIP 7, Yên Phong 2(표에는 "mở rộng"만 있음), Quế Võ 3 2, Nam Sơn Hạp Lĩnh 3, Thuận Thành 2, Đại Đồng 1, "Khu công nghiệp III" 1). 출처(OSM way) 있는 윤곽을 표·`industrialParkOutlines.ts`에 추가하면 지도가 나온다(DB 쓰기 없음, 추정 좌표 금지). 선택: pending 후보 수동 승인으로 핀 늘리기.

## 3. 필수 규칙 (전문은 `CLAUDE.md`·`AGENTS.md`, 항상 먼저 읽기)

- 시작: `git pull`/`git fetch` → `CLAUDE.md`·`AGENTS.md`·이 파일 → `VIECGANBAN_STRUCTURE_BASELINE.md`. 기존 설계 유지, 요청 범위 밖 변경 금지.
- 완료 기준: `npx tsc --noEmit`·`npm test`·`npm run build` 통과. 상태를 IMPLEMENTED → VERIFIED → MASTER PUSHED → PRODUCTION DEPLOYED → PRODUCTION VERIFIED로 구분해 보고. 이미 VERIFIED인 작업을 다시 구현하지 않는다.
- STRICT(중단하고 사람 판단): DDL·Production DB 변경·데이터 삭제/대량 수정·Auth/RLS·결제·secret. DDL은 dry-run을 보여주고 승인 후 적용.
- 자동화(클라우드 에이전트)는 master 직접 push 금지: 새 브랜치 + PR.
- **저장 원칙**: PC에 키·데이터·결과 파일 저장 금지(회사 PC는 사용자 소유 아님, PC `.env` 저장 안내 금지). 비공개 키는 Vercel 환경변수에만(Actions에서 비공개 키가 필요하면 GitHub Secrets; 사이트 번들에 이미 공개된 URL·anon 키는 Secrets 불필요). 수집·검토 데이터·백업은 Supabase 비공개 테이블(RLS)/비공개 Storage. 현장 방문을 해결책으로 제안 금지(1인 운영).
- **위치·길찾기**: 회사명 정확 일치 + 주소(구·KCN) 안이면 자동 승인 핀, 아니면 핀 없음(관리자 Vị trí는 예외용). 길찾기는 승인 좌표 "Chỉ đường" / KCN 정문 좌표 "Đến cổng KCN" / 없으면 "Gọi hỏi đường"(전화). 지도 링크는 좌표(`destination=lat,lng`)만, 이름·주소 검색 금지.
- **가짜 공고 금지**: 예시·DEMO 공고 표시 금지, 공개 0건이면 빈 상태 안내. DB 변경 시 화면 영향(0건 등)까지 확인.
- 경쟁 채용사이트(원본 공고) 링크·`source_url` 공개 노출 금지. `[source:…]` 태그는 공개 화면에 나가지 않게.
- Secret 값은 커밋·로그·PR·응답 어디에도 출력 금지. 보고는 5줄 이내, Git push와 Production 배포는 구분해서 보고.
- 사용량이 약 10% 남으면(사용자 지시) 작업을 멈추고 알린 뒤, 끝난 단계는 커밋·푸시하고 이 파일의 "현재 상태·다음 할 일"을 갱신한다.
