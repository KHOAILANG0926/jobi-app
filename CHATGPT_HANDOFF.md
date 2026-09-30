# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**공고 검증·정리 정책 — 기존 기준 복원 단계(설계·구현 전).** 2026-09-30 회사 PC 세션 종료 시점 스냅샷.
원칙: 기존 확정 규칙과 새 제안을 섞지 않는다. 근거(파일:줄·커밋·DB 조회) 없는 기준은 "새 제안"으로 표시한다.

### 확정된 운영 규칙과 근거 (문서 = 문서에 적힘 / 강제 = 코드·DB가 강제)

| 규칙 | 근거 | 상태 |
|---|---|---|
| 원본 채용사이트 링크·원문 URL 노출 금지 | CLAUDE.md 48행~(df8524c) | 문서 + 강제(공개 select에서 source_url 제거). 단 익명 API로 source_url 직접 조회는 아직 가능(DB 권한 미변경, 사용자 지시로 보류) |
| 공개 조회 = active 이고 admin_hidden 아님 | supabase/migrations/0019_local_jobs_public_select_rls_fix.sql | 강제(RLS) |
| 크롤러는 admin_hidden=true 행의 공개 상태를 되돌리지 않음 | crawler/crawl_topcv.py:2115-2130 | 강제(TopCV). Facebook 크롤러는 신규만 insert(기존 행 미갱신, 코드상) |
| 마감일 지난 공고 매일 active=false | 0011_deactivate_expired_jobs_fn.sql + 20260923060000_deactivate_expired_jobs_cron.sql | 강제. Production cron `deactivate-expired-jobs-daily` 17:00 UTC, 마지막 09-29 성공(조회 확인) |
| 알림 생성 | 20260927090000_job_alerts.sql, cron `job-alert-notifications` 15분 | 강제. 숨김 공고 제외 여부는 미확인 |
| 지도·거리·길찾기는 확인된 근무지만(지역/공단 중심 대체 금지, 미확인은 "Vị trí nơi làm việc chưa được xác minh") | src/lib/jobCoords.ts(verifiedWorkLocationPoint 등), jobCoords.test.ts | 강제(코드·테스트). CLAUDE.md에는 없음 |
| 근무지 승인은 사람 승인(job_location_candidates), area 정밀도는 승인 불가 | 20260929120000_job_location_approvals.sql | 강제(DB) |
| 지원 버튼: employer_id=내부 지원 / 크롤링+전화·Zalo=사이트 안 연락 안내 / 연락처 없음=지원 불가 표시 | src/lib/jobUtils.ts resolveApplyAction, applyAction.test.ts | 강제(코드) |
| 게스트 공고 기본 마감 7일 | 코드상 게스트 등록 기본값(이전 세션 확인) | 강제. 크롤링 공고와 무관 |
| 연락처 없는 크롤링 공고 124건 비공개(삭제 없음) | docs/ops/2026-09-29_hide_crawled_no_contact.md | 1회 수동 조치. 자동 판정·후속 처리 없음 |

### 찾지 못함 (기존 합의로 쓰지 말 것)
- 검증 대기 기간(3일/7일), 기간 경과 후 삭제 규칙: 저장소·CLAUDE.md·handoff·docs에서 찾지 못함.
- 상세 주소 없을 때 공개 가능한 지역 수준: 사용자는 "일전에 정한 게 있다"고 함 → 아직 근거 못 찾음(Claude 이전 대화 기록 확인 필요).
- 중복·허위 의심·급여 오류·원문 삭제 공고 처리 규칙: 없음.
- 2026-09-30 GPT 대화에서 나온 기준(3일=72시간, 주소·연락처 조합별 공개, 72시간 후 본문 삭제+최소 기록)은 **새 제안**이며 확정 아님. GPT 스스로 주소 기준은 철회함.

## 변경 내용

- 이번 단계는 코드·DB 변경 없음. 이 문서만 갱신.
- 직전 완료 작업(8d08fa6까지)은 아래 로그 참고.

## 테스트 결과

- 최신 master `8d08fa6`: tsc·build 통과, applyAction 3/3, 로컬 3유형 브라우저 검증 통과. GitHub 상태: Vercel "Deployment has completed"(PRODUCTION DEPLOYED). 운영 화면 재확인은 이 세션에서 안 함.
- Production cron 2개 존재·성공 확인(읽기 전용 조회, 2026-09-30).

## 발견된 문제

1. 정보 부족·신뢰성 문제(회사·담당자·근무지 미확인 등)는 전부 개별 수동 조치에 의존. 숨김 사유·담당·기한·종료가 시스템에 없음.
2. 124건 숨김 사유는 문서에만 있고 DB에 없음.
3. 크롤러 마감일이 원본과 다른 공고 91건(미착수).
4. 이 PC 메모리 부족(약 1.6GB)으로 vite dev/빌드 간헐 OOM → `vite preview` 사용.

## 다음 결정사항 / 남은 작업 (순서대로, 한 건씩 끝낼 것)

1. **기존 기준 복원 표 완성**(읽기 전용): 주소·좌표·연락처·공개 조건·검증 대기·삭제 기준을 `docs/ops/`에 표로, 항목마다 근거와 "기존 확정/구현됨/미확인". 사용자가 말한 "일전에 정한 주소 공개 기준" 근거 찾기.
2. 충돌·미확인 항목만 사용자에게 확인 → 확정.
3. 확정 후 설계(초안 방향): admin_hidden을 유일한 공개 차단 스위치로 유지, 검증 기록(사유·미확인 항목·담당·시작일·기한·근거·결과)은 별도 테이블, 대기/실패 시 admin_hidden 강제, 재공개는 증거+관리자 승인 RPC만, 실패 공고 재수집·자동 재공개 차단, 기한 처리는 새 cron. **DB 변경이므로 STRICT(승인 필요).**
4. 4682 숨김 여부: 미결정(회사명·담당자 관계·실제 근무지 미확인, 전화·Zalo는 원문과 일치). 현재 공개 상태.
5. 그 밖의 보류: Facebook 수정 브랜치 `handoff/fb-agency-wage-20260929`(a513bd4) master 미병합 / 세션 유지 dry-run 미실시 / 관리자 📍 Vị trí 화면 실제 로그인 검증 미실시 / source_url DB 권한(STRICT).

### 커밋·미커밋 상태
- origin/master = `8d08fa6` (로컬과 동일). 미커밋: `.claude/settings.local.json`, `tsconfig.tsbuildinfo`(PC-local, 커밋 안 함), `.claude/scratch/`(미추적).

### 하지 말 것
- 새 크롤링, Facebook 예약 실행 재개(FACEBOOK_PAUSED 유지), 숨김 공고 재공개, DB 행 삭제, DB 권한 변경을 사용자 지시 없이 하지 않는다.
- 전화 발신·메시지 전송 금지. 만료 쿠키 재사용·새 계정·SSH 터널 금지. secret·쿠키 값 출력 금지.
- Google Maps 유래 좌표 저장 금지. 지역·공단 중심 좌표로 근무지 대체 금지.
- GPT 제안이나 "찾지 못함" 항목을 기존 확정 규칙으로 저장·구현하지 않는다.
- 규칙 저장을 보고할 때는 커밋 ID와 파일 줄을 함께 제시한다.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-30 — 지원 버튼을 실제 지원 방식별로 연결(내부 지원 / 직접 연락 / 연락처 없음)** — MASTER PUSHED(이 커밋). 공용 판정 resolveApplyAction()+JobApplyButton: employer_id 있음=로그인→내부 지원, 없음+전화/Zalo=로그인 없이 내부 상세 연락 안내(/viec-lam/sb-ID#lien-he), 연락처 없음=지원 표시 안 함('Chưa có thông tin liên hệ', 상세 버튼 비활성). 적용: 상세·급구 페이지·추천 표/카드. 이전: 급구 페이지는 직접 연락형도 비로그인이면 /dang-nhap으로 보냈음. 검증: 빌드 미리보기+응답 가로채기 가짜 3유형(운영 DB 쓰기 없음), 데스크톱·모바일 첫 클릭 목적지 정상, 외부 링크·새 창 0, 단위 테스트 3/3. **4682 상태(미확인 유지)**: 전화·Zalo 번호가 원문(페이스북 게시물)의 번호와 일치하는 것만 확인. 게시자가 실제 채용 담당자인지, 회사명·실제 근무지·담당자와 회사 관계는 모두 미확인(원문에 회사명 없음, 웹 검색으로 특정 불가). 연락·숨김·DB 변경 없음.
2. **2026-09-30 — 급구 표 첫 클릭 무시 버그 수정 + 4682 근무지 확인 시도** — MASTER PUSHED(`63ff498`) + PRODUCTION DEPLOYED. 급구 페이지 지역 패널(기본 열림)을 mousedown에 닫아 표가 밀리며 제목·지원 버튼 첫 클릭이 사라지던 문제 → click 시점에 닫도록 수정. 검증: 빌드 미리보기(vite preview) + Supabase 응답 가로채기로 가짜 급구 1건(운영 DB 쓰기 없음), 데스크톱 1280·모바일 375 모두 제목 클릭→내부 상세, 'Ứng tuyển'→내부 /dang-nhap(비로그인), 외부 링크·새 창 0. 4682: 원문에 회사명 없음, Zalo 번호·공고 문구 웹 검색으로도 회사·사업장 특정 불가 → '위치 미확인' 유지, DB 변경 없음. 참고: 이 PC 여유 메모리 부족(약 1.6GB)으로 vite dev 서버·빌드가 간헐적으로 OOM.
3. **2026-09-30 — 미확인 위치 지도 미표시 + 원본 사이트 안내 문구 제거 + 설계 문서 정정** — MASTER PUSHED(`b1b09d4`) + PRODUCTION VERIFIED. 공고 상세 지도는 확인된 근무지만(지역·공단 중심 대체 표시·지역 지도 링크 제거, '위치 미확인' 안내), 한국 취업 연락 문구가 원본 페이지를 가리키면 중립 문구로 표시, VIECGANBAN_STRUCTURE_BASELINE.md의 '원문 URL 이동/외부 링크 CTA'를 폐기 동작으로 정정. 원인 조사: 규칙은 df8524c 이전 CLAUDE.md·AGENTS.md·BASELINE 어디에도 없었고, BASELINE은 반대로 외부 링크를 의도된 설계로 기록 → 세션들이 '기존 설계 우선' 원칙대로 링크를 유지. DNS는 2026-09-30 02:09 UTC 기준 복구 확인. source_url DB 권한 변경은 제외(사용자 지시).
4. **2026-09-30 — 원본 채용사이트 연결 전면 제거 + CLAUDE.md 규칙** — MASTER PUSHED(`df8524c`) + PRODUCTION DEPLOYED(01:39 UTC). 급구 표·급구 페이지 '↗ Xem tin gốc', 한국 취업 상세 'Xem tin gốc & Liên hệ' 제거, 공개 조회에서 source_url 미수신(JobsContext·fetchJobsData·jobRows·koreaJobsApi), 타입에서 sourceUrl 제거. CLAUDE.md '원본 채용사이트 연결 금지' 섹션 추가. **남은 것(STRICT, 승인 필요)**: DB 권한상 익명 API로 local_jobs.source_url·korea_jobs_public.source_url 직접 조회는 아직 가능. 공개 화면 확인은 viecganban.vn DNS 장애(Mắt Bão)로 미확인.
5. **2026-09-29 — 지원 버튼 외부 이동 제거 + 연락처 없는 크롤링 공고 124건 비공개(긴급 운영 조치)** — PRODUCTION DB 데이터 변경(admin_hidden) + MASTER PUSHED + PRODUCTION DEPLOYED. 기록 `docs/ops/2026-09-29_hide_crawled_no_contact.md`.
