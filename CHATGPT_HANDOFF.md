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

1. **2026-09-29 — 지원 버튼 외부 이동 제거 + 연락처 없는 크롤링 공고 124건 비공개(긴급 운영 조치)** — PRODUCTION DB 데이터 변경(admin_hidden) + MASTER PUSHED + PRODUCTION DEPLOYED. 기록 `docs/ops/2026-09-29_hide_crawled_no_contact.md`.
2. **2026-09-28 — Facebook 주력 수집원 기초 작업(세션 만료로 FB 중단)** — 스냅샷은 인계 브랜치 `handoff/fb-agency-wage-20260929`(a513bd4)가 최신: 새 쿠키 dry-run 성공, 9/30 15:40(VN) 세션 유지 확인 예정, 판정 보완 미병합.
3. **2026-09-29 — 근무지 좌표 후보 보관·관리자 승인 기능** — PRODUCTION DB APPLIED(job_location_candidates, 적용 후 카탈로그 10/10·anon API 9/9) + MASTER PUSHED + PRODUCTION DEPLOYED. 승인 위치만 핀·거리(직선거리 'đường chim bay' 표시), 길찾기는 출입구 승인만, 비공개 공고 승인 좌표 비공개, 재수집·회사/주소 변경 대응. **실제 근무지·출입구 정확성 검증: 자료 대기, 미검증** — 승인된 위치 0건(ALS 4453 좌표는 구글 약관상 사용 불가, OSM 접근 불가). 필요 자료(사용자에게 요청함): 실제 사업장·출입구 좌표(GPS 또는 OSM)·근거. 관리자 탭(/admin → 📍 Vị trí) 화면은 관리자 로그인 필요로 미확인. 지도 정밀화 전체 완료 아님.
4. **2026-09-29 — 잘못된 위치 안내 차단(지도 정밀화 전체 아님)** — MASTER PUSHED + PRODUCTION DEPLOYED. 정확 위치·핀·길찾기·내 주변 거리는 job_work_locations.location_verified+좌표만 사용(local_jobs.lat/lng는 근거로 안 씀), 외부 지도 링크는 사이트와 같은 점(미확인=지역 화면만, 길찾기 없음), 내 주변은 확인 좌표 0건이면 준비 중 안내+지역 검색, 재수집 시 manual 근무지 보존. DB: 4682 lat/lng→null(공단 텍스트 유지). **후속(미착수): 좌표 후보 보관·관리자 위치 승인 기능** — 현재 활성 공고 중 확인된 좌표 0건이라 길찾기·거리 검색은 사실상 비활성.
5. **2026-09-29 — 메인 추천 공고 카드 폭을 하단 목록과 동일(4/2/1칸)+좌우 화살표** — MASTER PUSHED(`d996587`) + PRODUCTION VERIFIED(1700px: 카드 330px=하단 330px, 잘림 없음). FB 작업 스냅샷(본문)은 그대로 유효.
