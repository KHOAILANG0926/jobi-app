# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**Production 장애 복구 완료(2026-10-07).** master `7907b8b` 반영 직후 SSR 함수(`/viec-lam/*`·`sitemap.xml`)가 500 — 원인: 함수 번들에 `react-router/dist/development/dom-export.js`가 빠짐(로그 `Cannot find module`). 같은 소스(`522643e`) redeploy도 동일 → 코드가 아니라 Vercel 함수 파일 추적 문제(16시간 전엔 같은 소스가 정상). 수정: `vercel.json` functions `includeFiles`를 `{dist/**,node_modules/react-router/dist/**}`로 확장(Preview 검증 후). master `cd0eeeb` fast-forward push → 자동 Production 배포 → 공고 상세·tim-kiem·tuyen-gap·sitemap.xml·홈 모두 200, 상세 로고 자리 이니셜(출처 이미지 0). 장애 구간: 약 1시간(7907b8b 배포~복구). 참고: `vercel rollback`은 요금제상 직전 배포까지만 가능.

**공고 항목 설계 + 즉시 수정 실행 (2026-10-07).** branch `fix/source-logo-and-classifier`(worktree `C:\Users\HP\Downloads\jobi-wheel-fix`). 상태: IMPLEMENTED / VERIFIED(tsc·tests 33/33) / MASTER PUSHED(`cd0eeeb`) / PRODUCTION DEPLOYED·VERIFIED(위 복구 포함) / **Production DB 적용 완료(DDL 9개·로고 244건·재분류 26건)**.

## 변경 내용

- `src/data/jobSchema.ts`(+test): 공고 항목 34개·구역 5개 순서·대분류 13개·고정 값 목록·신규 DDL 9개를 한 곳에 고정, 바뀌면 테스트 실패.
- migration `20261007013659_job_fields_structured_columns.sql`: `local_jobs` 7개 + `job_work_locations` 2개 컬럼(nullable, backfill 없음). Production 적용 완료·파일 포함.
- Production DB(실행 전→후): DDL 컬럼 0→9 / `local_jobs.image_url` 비어있지 않음 244→0 / 재분류 26건 갱신(26/26). 제외 #4577·#4594·#4598·#4601은 그대로. 소분류만 바뀌는 3건(#4592→phuc_vu_ban, #4562·#4547→marketing_quang_cao)은 사용자 승인 후 추가 적용(소분류 null 0→3건). 재dry-run 잔여는 제외 4건뿐.
- 이전 커밋(`af83e25`): 출처 로고 화면 차단·수집 중단, 제목 우선 분류, 출처 URL 본문 차단, 설계 문서.

## 테스트 결과

- tsc 통과, `npm test` 33/33. build는 이번 변경(데이터 파일·테스트 추가, 화면 import 없음)이라 재실행하지 않음 — master 반영 전 확인 필요.

## 발견된 문제

- 새 컬럼은 아직 어떤 화면·crawler·등록 폼도 쓰지 않음(상세 개편 때 연결). 규칙 보완 필요: #4577·#4594·#4598·#4601(주방 제목·food delivery 규칙 없음).

## 다음 결정사항

- **VietMap에 서버용 키 요청**(Search v4·Place v4 허용) 후: 키를 Vercel/크롤러 환경에 `VIETMAP_SERVICE_KEY`로 설정 → `node scripts/generate-location-candidates.ts`(dry-run) 결과 확인 → 별도 승인 후 `--apply`(Production DB 쓰기) → 크롤러 연결 여부 결정. match_meta 컬럼(DDL)은 보류.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- 모니터링: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고). Search/Place 호출이 켜지면 근무지 1곳당 최대 4 transaction.
- Vercel env: `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview (2026-10-05 정리).
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.

## 최근 완료 작업 로그

- 공고 항목 설계 + 즉시 수정 실행(jobSchema·DDL 9·로고 244·재분류 26) + SSR 번들 장애 복구 — 2026-10-07 — MASTER PUSHED(`cd0eeeb`) / PRODUCTION DEPLOYED·VERIFIED
- 공고 항목 설계 + 즉시 수정(출처 로고 차단·분류 개선) — 2026-10-06 — BRANCH PUSHED(`fix/source-logo-and-classifier`, Preview `jobi-xg3h9jbxb`) / master·Production·DB 미적용(승인 완료, 실행 대기)
- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)
- 지도 제스처 재정비 + 모바일 bottom sheet — 2026-10-06 — MASTER PUSHED(`cccd767`) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`) / PRODUCTION VERIFIED(사용자)
- 지도 위 페이지 스크롤 수정 + VietMap 예비 지도 오전환 수정 — 2026-10-06 — MASTER PUSHED(`6d02be6`) / PRODUCTION DEPLOYED·VERIFIED. (cooperativeGestures 방식은 이후 작업에서 폐기)
