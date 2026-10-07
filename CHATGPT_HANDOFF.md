# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**공고 상세 화면 개편 (알바몬 구조) (2026-10-07).** branch `feat/job-detail-sections`(master `5f596a4` 기반, worktree `C:\Users\HP\Downloads\jobi-wheel-fix`). 상태: IMPLEMENTED / VERIFIED(tsc·tests 35/35·build, 로컬 PC 1280px) / BRANCH PUSHED / **사용자 미승인 · master 미반영 · Production 미배포**. Preview는 SSO 보호.

- 구조: 근무조건→모집조건→근무지역→상세요강→기업정보 5구역을 한 페이지에 모두 노출(탭은 숨기지 않고 스크롤 이동만, 상단 고정, 스크롤 위치로 활성 탭). 구역·항목은 `src/data/jobSchema.ts`·`src/lib/jobDetailView.ts`. 구역 제목은 박스 밖 위에 크게, 박스는 회색 1px 테두리·흰 배경, "라벨 | 값" 2열 표(PC 2칸), 값 없는 행은 숨김. 급여 앞 Lương tháng/ngày/giờ 배지(`salary_period`, 현재 공개 공고엔 값 없음). 경고는 헤더 한 줄. 새 컬럼 9개를 select·타입·화면에 연결.
- 연락: 하단 고정 바(PC·모바일)에 Gọi·Zalo, 연락처가 있으면 별도 지원 버튼·"chưa nhận hồ sơ" 박스·"Xem cách liên hệ" 없음. 내부 지원(기업 계정 공고)이거나 연락처가 없을 때만 지원 영역 표시.
- 기업정보: 회사 정보·같은 회사 다른 공고가 없으면 구역(탭 포함) 숨김. 자리표시자 회사명("Nhà tuyển dụng Facebook")은 같은 회사로 묶지 않음. 리뷰(CompanyReviews)는 구역 밖에서 유지 중 — 유지 여부는 사용자 결정 대기.
- **원문 항목 추출**: `src/lib/jobDescriptionExtract.ts`(+test)·`scripts/extract-job-fields.ts`(dry-run 전용). 원문에 있는 값만, 뽑힌 문장은 상세요강에서 제거(일부만 대체되면 남은 말 유지), 출처 태그 `[source:…]`는 저장 시 유지해야 함. **#4682 dry-run 결과 사용자 확인 대기 — DB 반영 기능은 아직 없음.** 언어(Tiếng Trung HSK)·출장(đi công tác)은 jobSchema에 항목·컬럼이 없어 문장 유지(컬럼 추가는 DDL이라 별도 결정).
- 모바일은 기존 배치 유지(구역 제목·표 스타일만 공통 적용). 실제 폰 확인은 아직 못 함(화면 캡처 불가 환경).

## 변경 내용

`JobDetail.tsx` 재구성, `index.css`(jd2-sec/box/kv/tabs/하단 바), `jobRows.ts`·`JobsContext.tsx`·`fetchJobsData.ts`(select·매핑), `types/job.ts`, 신규 `jobDetailView.ts`·`jobDescriptionExtract.ts`(+tests), `scripts/extract-job-fields.ts`.

## 테스트 결과

tsc 통과, `npm test` 35/35, build 통과. 로컬 PC 1280px: 5구역 순서·고정 탭·활성 탭 전환·하단 Gọi/Zalo·구역 숨김 확인. 모바일 375px은 가로 넘침 없음·하단 바 정상(측정). Preview 200(상세·tim-kiem·sitemap).

## 발견된 문제

- 공개 공고 중 `salary_period` 값이 있는 공고가 없어 배지는 코드·테스트로만 확인.
- 이 환경은 창이 최소화되면 스크롤·rAF 이벤트가 지연돼 모바일 실화면 캡처 불가.

## 다음 결정사항

- **VietMap에 서버용 키 요청**(Search v4·Place v4 허용) 후: 키를 Vercel/크롤러 환경에 `VIETMAP_SERVICE_KEY`로 설정 → `node scripts/generate-location-candidates.ts`(dry-run) 결과 확인 → 별도 승인 후 `--apply`(Production DB 쓰기) → 크롤러 연결 여부 결정. match_meta 컬럼(DDL)은 보류.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- 모니터링: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고). Search/Place 호출이 켜지면 근무지 1곳당 최대 4 transaction.
- Vercel env: `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview (2026-10-05 정리).
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.

## 최근 완료 작업 로그

- 공고 상세 화면 개편(알바몬 구조) — 2026-10-07 — BRANCH PUSHED(`feat/job-detail-sections`) / 사용자 미승인·master·Production 미반영
- 공고 항목 설계 + 즉시 수정 실행(jobSchema·DDL 9·로고 244·재분류 26) + SSR 번들 장애 복구 — 2026-10-07 — MASTER PUSHED(`cd0eeeb`) / PRODUCTION DEPLOYED·VERIFIED
- 공고 항목 설계 + 즉시 수정(출처 로고 차단·분류 개선) — 2026-10-06 — BRANCH PUSHED(`fix/source-logo-and-classifier`, Preview `jobi-xg3h9jbxb`) / master·Production·DB 미적용(승인 완료, 실행 대기)
- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)
- 지도 제스처 재정비 + 모바일 bottom sheet — 2026-10-06 — MASTER PUSHED(`cccd767`) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`) / PRODUCTION VERIFIED(사용자)
