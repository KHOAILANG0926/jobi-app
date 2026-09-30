# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**긴급 운영 조치(2026-09-29): 지원 버튼의 외부 사이트 이동 제거 + 지원 경로 없는 크롤링 공고 비공개.**
Facebook 크롤러 작업 스냅샷은 인계 브랜치 `handoff/fb-agency-wage-20260929`(a513bd4) 참고(master 미병합).

## 변경 내용

1. 코드: `resolveApplyRoute()`에서 external 모드 제거 → 기업 공고만 내부 지원, 나머지는 'unavailable'.
   `useApply.ts`의 `window.open` 제거(홈·검색·추천·급구 공용). `ApplyModal` unavailable 상태와
   `JobDetail` 사이드에 `ApplyUnavailableNotice`(지원 불가 사실 + 등록된 전화·Zalo, 없으면 없다고 표시).
   상세 버튼 라벨 'Xem tin gốc & Ứng tuyển ↗' → 'Xem cách liên hệ'. 내부 지원은 실제 insert 성공 시에만 완료 표시.
2. Production 데이터: 공개 125건 전수 조사 → 실제 연락 방법 있는 공고 1건(4682)만 공개 유지,
   124건 `admin_hidden=true`(삭제 없음). ID·방법·되돌리기: `docs/ops/2026-09-29_hide_crawled_no_contact.md`.
3. 원본 대비 마감일 불일치 91건 목록화(같은 문서).

## 테스트 결과

- `tsc` 통과, `npm test` 8/8, `npm run build` 통과.
- 로컬: 4681(연락처 없음)·4682(전화 있음) 상세에서 지원 버튼 클릭 시 `window.open` 0회, 안내 표시.

## 발견된 문제

1. 크롤링 공고 대부분(124/125)이 원문 링크 외 연락 방법이 없음 → 공개 공고가 1건만 남음.
2. 크롤러 저장 마감일이 원본과 다른 공고 91건 — 수집 로직 점검 필요(미착수).
3. 급구 표의 작은 '↗ Xem tin gốc' 원문 링크는 지원 버튼이 아니라 유지.

## 다음 결정사항

1. 크롤링 공고의 연락처 수집 방식(원문에서 연락처 추출 가능 여부) 또는 공개 기준 재정의.
2. 마감일 불일치 원인 조사·수정 여부.
3. 비공개 124건 되돌리기 여부(같은 ID로 admin_hidden=false).
## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-30 — 급구 표 첫 클릭 무시 버그 수정 + 4682 근무지 확인 시도** — MASTER PUSHED(이 커밋). 급구 페이지 지역 패널(기본 열림)을 mousedown에 닫아 표가 밀리며 제목·지원 버튼 첫 클릭이 사라지던 문제 → click 시점에 닫도록 수정. 검증: 빌드 미리보기(vite preview) + Supabase 응답 가로채기로 가짜 급구 1건(운영 DB 쓰기 없음), 데스크톱 1280·모바일 375 모두 제목 클릭→내부 상세, 'Ứng tuyển'→내부 /dang-nhap(비로그인), 외부 링크·새 창 0. 4682: 원문에 회사명 없음, Zalo 번호·공고 문구 웹 검색으로도 회사·사업장 특정 불가 → '위치 미확인' 유지, DB 변경 없음. 참고: 이 PC 여유 메모리 부족(약 1.6GB)으로 vite dev 서버·빌드가 간헐적으로 OOM.
2. **2026-09-30 — 미확인 위치 지도 미표시 + 원본 사이트 안내 문구 제거 + 설계 문서 정정** — MASTER PUSHED(`b1b09d4`) + PRODUCTION VERIFIED. 공고 상세 지도는 확인된 근무지만(지역·공단 중심 대체 표시·지역 지도 링크 제거, '위치 미확인' 안내), 한국 취업 연락 문구가 원본 페이지를 가리키면 중립 문구로 표시, VIECGANBAN_STRUCTURE_BASELINE.md의 '원문 URL 이동/외부 링크 CTA'를 폐기 동작으로 정정. 원인 조사: 규칙은 df8524c 이전 CLAUDE.md·AGENTS.md·BASELINE 어디에도 없었고, BASELINE은 반대로 외부 링크를 의도된 설계로 기록 → 세션들이 '기존 설계 우선' 원칙대로 링크를 유지. DNS는 2026-09-30 02:09 UTC 기준 복구 확인. source_url DB 권한 변경은 제외(사용자 지시).
3. **2026-09-30 — 원본 채용사이트 연결 전면 제거 + CLAUDE.md 규칙** — MASTER PUSHED(`df8524c`) + PRODUCTION DEPLOYED(01:39 UTC). 급구 표·급구 페이지 '↗ Xem tin gốc', 한국 취업 상세 'Xem tin gốc & Liên hệ' 제거, 공개 조회에서 source_url 미수신(JobsContext·fetchJobsData·jobRows·koreaJobsApi), 타입에서 sourceUrl 제거. CLAUDE.md '원본 채용사이트 연결 금지' 섹션 추가. **남은 것(STRICT, 승인 필요)**: DB 권한상 익명 API로 local_jobs.source_url·korea_jobs_public.source_url 직접 조회는 아직 가능. 공개 화면 확인은 viecganban.vn DNS 장애(Mắt Bão)로 미확인.
4. **2026-09-29 — 지원 버튼 외부 이동 제거 + 연락처 없는 크롤링 공고 124건 비공개(긴급 운영 조치)** — PRODUCTION DB 데이터 변경(admin_hidden) + MASTER PUSHED + PRODUCTION DEPLOYED. 기록 `docs/ops/2026-09-29_hide_crawled_no_contact.md`.
5. **2026-09-28 — Facebook 주력 수집원 기초 작업(세션 만료로 FB 중단)** — 스냅샷은 인계 브랜치 `handoff/fb-agency-wage-20260929`(a513bd4)가 최신: 새 쿠키 dry-run 성공, 9/30 15:40(VN) 세션 유지 확인 예정, 판정 보완 미병합.
