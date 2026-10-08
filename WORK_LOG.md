# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(맨 아래 "보관" 섹션은 제외, 넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

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

## 2026-10-08 — 저장 원칙·VietMap 서버 이전·길찾기 3단계·가짜 공고/source 태그 제거·keep-alive·규칙 기록 (branch, DB 쓰기 없음)

- 요청: 8단계 일괄(저장 원칙 / VietMap 서버 API / 길찾기 3단계·자동 승인 / KCN 정문 dry-run / DEMO 제거 / source 태그 숨김 / Supabase keep-alive / 규칙 기록).
- 처리: 커밋 46b2195(5·6), 571f1ae(1·2), 73b58b1(3), 6d2b253(4) + 7·8·문서. tsc·build 통과, npm test 40/41(기존 zalo 테스트 실패).
- KCN dry-run: 주요 22곳 A 0 / B 후보 9곳 / 없음 13, 위성·VietMap POI 미수행 — 정문 좌표 미반영.
- 미적용: DDL(`supabase/pending`, 승인 대기), Vercel `VIETMAP_SERVICE_KEY`·GitHub Secrets(사용자 설정), master·Production(PR 후).

## 2026-10-08 — chotot 좌표 후보 VietMap Search/Place 재 dry-run 실행 (DB 쓰기 없음)

- 요청: 서버 키(`VIETMAP_SERVICE_KEY`, 값 출력 금지)로 chotot 100건을 Search/Place 검색해 타일 후보와 비교, 하루 250회 이내, DB 쓰기 금지.
- 호출: 80개 (회사·구) 질의 → Search 81(첫 시험 실패 1 포함) + Place 46 = **127회**(스크립트 집계) + 연결 문제 확인용 수동 시험 약 7회 = 약 134회/일(상한 250, Trial 500의 약 27%). 첫 실행은 일시적 연결 실패(10초 타임아웃)였고, 원인 확인 후 타임아웃 20초·재시도 1회를 넣어 재실행. 키는 출력·저장하지 않음.
- 결과: **자동 승인 후보 5 / 검토 필요 29 / 없음 66**(조회 못 한 건 0). 없음 66 = 이름 유사 POI 없음 57 + 근무 회사 없음(대행사) 9. 타일 dry-run(자동 1/검토 32/없음 67)과 비교: 둘 다 자동 1(#4720) · Search만 자동 4 · 타일만 자동 0 · 둘 다 검토 이상 15 · 새로 검토로 올라옴 14 · 타일 검토가 Search에서는 없음 14(타일의 이름만 비슷한 오탐이 사라진 것으로 보임).
- 자동 5건 위성 확인(VietMap Hybrid, 4곳 — #4713·#4721은 같은 POI): #4720 Pizza Hut Bắc Ninh ✓(전날 확인, 도심 Lê Thái Tổ 인근, 공고 주소와 일치) / #4755 Toll — 핀이 대형 창고·물류 건물 위 ✓ 타당(주소 일치도 partial) / #4696 Môi Trường Ngôi Sao Xanh — 연못·야적장 있는 소규모 시설 부지 가장자리 ✓ 타당(환경 회사) / **#4713·#4721 "Công Ty Tnhh Pizza Việt Nam" — 핀이 붉은 지붕 주택가 한가운데 ✗ 법인 등록 주소 POI로 보임(실제 매장 POI #4720은 약 560 m 떨어진 Lê Thái Tổ)** → 자동 승인 후보로는 부적합, 승인 전 거절 권장.
- 산출물: `scripts/research/out/chotot_vietmap_search_candidates.csv`(바탕화면 `bacninh_handoff/`에도 복사), `vietmap_search_usage.json`·`vietmap_search_cache.json`(gitignore). 스크립트 `bn_vietmap_search_dryrun.mjs`에 타임아웃 20초·1회 재시도 추가.
- DB 쓰기 없음. 이미 `job_location_candidates`에 들어간 33건(타일 기준)과는 별개 — Search 결과를 추가/교체할지는 승인 후.
- 다음(승인 후): Search 자동 4곳(#4720·#4696·#4755 + 참고용 #4713·#4721은 제외 권장)을 기존 pending 후보 옆에 추가하거나 대체, 새로 올라온 검토 14건 후보 추가.

## 2026-10-07 — chotot 좌표 후보 VietMap Search/Place 재 dry-run — 키가 이 PC에 없어 중단, 스크립트 준비

- 요청: `VIETMAP_SERVICE_KEY`(Trial "Key API (search, route…)")로 chotot 100건 Search/Place 검색 dry-run, 하루 250회(한도 500의 절반) 이내, 타일 후보와 비교, DB 쓰기 금지.
- 중단: 이 PC의 `crawler/.env`에 `VIETMAP_SERVICE_KEY` 없음(파일은 2026-09-24 이후 수정 없음, 변수 이름은 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·CRAWLER_BROWSER_CHANNEL뿐), 환경변수·다른 .env도 없음. 키는 PC-local이라 GitHub에 없음 — 다른 PC에 넣으신 것으로 보임. 호출 0회, DB 쓰기 없음.
- 준비: `scripts/research/bn_vietmap_search_dryrun.mjs` — 같은 (회사명, 구·xã) 질의 80건으로 묶어 Search 최대 80 + Place(이름 유사도 ≥0.5 상위 2건) 최대 160 = 최대 240회 예상, 하루 합계 250회 상한(out/vietmap_search_usage.json 날짜별 누적, 응답 캐시로 재호출 없음, 넘으면 중단하고 다음날 이어서). 키는 출력·저장 안 함. 판정은 타일 dry-run과 같은 기준(이름 정확 일치 + 공단 윤곽 안/광고 대략 위치 1.5 km 이내 + 1곳 = 자동, 비슷하거나 위치 불충족 = 검토, 없음) + 주소 행정구역 일치 확인, 기존 타일 상태와 비교 건수·CSV(`out/chotot_vietmap_search_candidates.csv`) 출력. 키 없이 `--dry-plan`과 키 없음 종료만 검증(실제 API 호출 경로는 키가 없어 미검증).
- 다음: 이 PC `crawler/.env`에 `VIETMAP_SERVICE_KEY=…` 한 줄 추가(값은 채팅에 붙이지 않기) → `node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_vietmap_search_dryrun.mjs`.

## 2026-10-07 — 관리자 Vị trí 후보 지도 라벨(길 이름·POI) 안 보임 수정

- 증상: 지도에 길은 그려지지만 길 이름·POI·건물 라벨이 없음. 실제 /admin → Vị trí(로그인된 Chrome)에서 재현, "수정 전" 스크린샷 저장.
- 원인: 관리자 지도는 `applyLifeMapStyle` 없이 VietMap 공식 `tm` 스타일을 그대로 썼다. 공식 스타일은 회사·ATM·상점 POI 레이어가 z18부터(34개 레이어 minzoom 18)이고 글씨도 옅은 회색이라, 관리자 기본 배율 z17에서는 라벨이 0개(z18에서도 흐릿하게 겨우). 요청 문제는 아님(글꼴·스프라이트·스타일 전부 200). 홈·상세 지도는 `applyLifeMapStyle`이 POI를 z13~16으로 당기고 `text-optional`로 라벨을 살려서 보임.
- 수정: `src/components/admin/AdminVietMap.tsx`만 — 공식 style을 받아 `applyLifeMapStyle(…,'street')`로 변환해 지도 생성, Bản đồ↔Vệ tinh 전환도 같은 transformStyle. 스타일 요청 실패 시 빈 지도 대신 "Bản đồ tạm thời không tải được." 안내. `lifeMapStyle.ts`·`JobVietMap`·홈 지도 코드는 변경 없음.
- 검증: tsc·npm test 37/37·build 통과. Production `jobi-fck9ccmdx`(Ready 44s)에서 /admin → Vị trí 실제 화면 전후 비교: 전 — 길만, 라벨·POI 없음(핀 점만) / 후 — 후보 핀 옆에 POI 아이콘+이름("ATM Shinhan Bank Jang Won Tech Vina") 표시, Vệ tinh 전환도 정상(래스터 로드에 10~20초). 지도 요청은 모두 200.
- 한계: 길 이름은 타일에 이름 있는 도로가 적어(범위 내 9개) 이 구역에서는 여전히 안 보임 — 데이터 한계.
- commit/push: master `655166b` → Production.

## 2026-10-07 — 관리자 Vị trí 후보 지도 빈 칸(점만) 원인 확인·수정

- 증상: 후보 33건이 생긴 뒤 관리자 Vị trí 화면 지도가 길·건물 없이 핀(점)만 보임.
- 한도 확인(Chrome, 같은 공개 타일 키): 스타일 tm·hm, 타일 2개 모두 **HTTP 200**(423/429 없음) → 한도 초과 아님. 오늘 VietMap 요청 추정: 좌표 스캔 타일 ≈298 + 위성 확인 래스터 ≈100~150 + 스타일·스프라이트·글꼴·시험 호출 수십 건 + 정상 사이트 트래픽 ≈ 최소 450~600건(콘솔 일 사용량은 조회 권한이 없어 확인 못 함). 계정 한도(Trial 일 500 등)는 문서상 값이 확정돼 있지 않고 지금 응답으로는 제한 신호가 없음.
- 원인: `AdminLocations`가 후보 카드마다 `AdminVietMap`(WebGL 지도)을 **동시에 33개** 생성 → 브라우저 WebGL 컨텍스트 한도(Chrome 약 16개) 초과 → 오래된 지도부터 캔버스 상실, DOM 마커(점)만 남음. (후보가 몇 건일 때는 드러나지 않았음)
- 수정: `src/components/admin/AdminLocations.tsx` — `VisibleOnly`(IntersectionObserver, 화면 ±150px일 때만 지도 생성, 벗어나면 해제)로 카드 지도를 감쌈. 동시에 열린 지도는 화면 안 몇 개로 제한. 한도 초과가 원인이 아니라서 "Bản đồ tạm thời không tải được" 공통 안내와 CLAUDE.md 스캔 한도 규칙은 이번엔 넣지 않음(사용자 지시 3번은 한도 초과가 원인일 때 조건).
- 검증: tsc·npm test 37/37·build 통과. 관리자 로그인이 필요해 이 세션에서 화면으로 확인하지 못함 — 배포 후 사용자 확인 필요.
- commit/push: master → Production 자동 배포.
- 남은 문제: 사용자가 /admin → 📍 Vị trí에서 지도가 보이는지 확인. 안 보이면 콘솔의 "Too many active WebGL contexts" 경고·네트워크 응답 코드를 알려줄 것(그때는 한도 쪽 안내 처리를 진행).

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


