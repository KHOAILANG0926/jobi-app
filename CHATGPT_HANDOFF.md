# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**공고 항목 설계 + 상세 개편 준비 — 즉시 수정(출처 로고 차단·분류 개선) (2026-10-06).** 상태: IMPLEMENTED / VERIFIED(tsc·tests 32/32·build, crawler 9개 묶음 통과) / Preview `jobi-xg3h9jbxb` / BRANCH PUSHED(`fix/source-logo-and-classifier`) / **master 미반영 · Production 미배포 · Production DB 미적용**.

- 설계 문서: `docs/JOB_FIELDS_AND_DETAIL_DESIGN.md`(항목 현황·DDL 안·와이어프레임·즉시 수정 원인). 사용자 결정(2026-10-06): 알바몬 구조(근무조건/모집조건/근무지역/상세요강 + 하단 고정 지원 바), 탭은 내용을 숨기지 않고 스크롤 이동만, 출처 CDN 로고 전체 차단, 제목 우선 분류, 보고는 5줄.
- **지금까지 코드로 한 것(이 브랜치, 커밋됨)**: ① `src/lib/companyLogo.ts`(+test) — 우리 Supabase Storage 이미지만 로고로 허용, `JobDetail`·`JobCard` 연결(상세=이니셜 폴백, 목록 카드=기존 업종 이미지 폴백 유지) ② `crawler/crawl_topcv.py` — 출처 로고(`image_url`) 저장 중단, **본문 없을 때 출처 URL을 description에 넣던 코드(vieclam24h·VietnamWorks 두 곳) 제거** ③ `crawler/classifier.py` — 제목 우선 판정(`_classify_title`), 카페·청소 규칙에서 회사명 제외, `dich vu nha`·`don dep nha` 단어 경계(+회귀 테스트: #4680·#4582) ④ `CLAUDE.md` — 보고 5줄 규칙(① 한 일 ② 바뀐 것 ③ 위험 ④ 예/아니오 질문 최대 2개, 세부는 문서에).

## 멈춘 시점의 실제 상태 (2026-10-06, DB는 읽기로 확인)

| 항목 | 코드 | Production DB |
|---|---|---|
| 재분류 26건 | classifier 수정 완료 | **미적용** (#4680=dich_vu, #4582=am_thuc_do_uong 그대로) |
| 로고 244건 비우기 | 화면 차단·수집 중단 완료 | **미적용** (`image_url` 244건 모두 cdn1.vieclam24h.vn 그대로) |
| DDL 9개 | — | **미실행** (`local_jobs` 7개 + `job_work_locations` 2개 컬럼 모두 없음, 0/9) |
| `crawl_topcv.py` 출처 URL 차단 | 완료(커밋됨) | 해당 없음(현재 DB에 출처 URL 포함 공고 0건) |
| `src/data/jobSchema.ts` 고정+테스트 | **미작성**(작업 중 중단) | 해당 없음 |

## 사용자 승인 완료 · 실행 대기 (아무것도 실행하지 않음)

1. **재분류 26건**: dry-run 대분류 변경 30건 중 **#4577·#4594·#4598·#4601 제외**(규칙이 틀림 — 주방 제목·food delivery 규칙 없음, 상세 개편 때 규칙 보완). 소분류만 바뀌는 3건 포함 여부는 적용 시 재확인. 전부 비공개 공고. 실행 전후 건수만 보고.
2. **로고 244건 비우기**: `local_jobs.image_url` = null (출처 CDN 244건, 그중 vieclam24h 기본 로고 21건). 공개 공고 0건, 우리 Storage 로고 0건. 실행 전후 건수만 보고.
3. **DDL 9개 실행**(전부 nullable·default 없음·backfill 없음): `local_jobs` — `salary_basis text`(base|total_with_overtime), `salary_note text`, `employment_type text`(full_time|seasonal|part_time), `rotating_shifts smallint`(2|3), `benefit_tags text[]`, `required_documents text`, `contact_zalo text` / `job_work_locations` — `industrial_park text`, `shuttle_route text`. migration 파일도 같은 커밋에 포함해야 함(TWO-PC 규칙).
4. **`src/data/jobSchema.ts`**: 공고 항목·구역·분류를 한 곳에 고정 + 변경 시 실패하는 테스트(상세 개편 시작 전에). 설계 초안(항목 목록·구역 순서)은 설계 문서 §2·§4 기준.
5. 목록 카드 이니셜 변경은 보류(상세 개편 때 함께).

## 다음 결정사항

- **VietMap에 서버용 키 요청**(Search v4·Place v4 허용) 후: 키를 Vercel/크롤러 환경에 `VIETMAP_SERVICE_KEY`로 설정 → `node scripts/generate-location-candidates.ts`(dry-run) 결과 확인 → 별도 승인 후 `--apply`(Production DB 쓰기) → 크롤러 연결 여부 결정. match_meta 컬럼(DDL)은 보류.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- 모니터링: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고). Search/Place 호출이 켜지면 근무지 1곳당 최대 4 transaction.
- Vercel env: `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview (2026-10-05 정리).
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.

## 최근 완료 작업 로그

- 공고 항목 설계 + 즉시 수정(출처 로고 차단·분류 개선) — 2026-10-06 — BRANCH PUSHED(`fix/source-logo-and-classifier`, Preview `jobi-xg3h9jbxb`) / master·Production·DB 미적용(승인 완료, 실행 대기)
- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)
- 지도 제스처 재정비 + 모바일 bottom sheet — 2026-10-06 — MASTER PUSHED(`cccd767`) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`) / PRODUCTION VERIFIED(사용자)
- 지도 위 페이지 스크롤 수정 + VietMap 예비 지도 오전환 수정 — 2026-10-06 — MASTER PUSHED(`6d02be6`) / PRODUCTION DEPLOYED·VERIFIED. (cooperativeGestures 방식은 이후 작업에서 폐기)
- 생활지도 1차+2차(건물·근무지·생활시설 지도, 위성, 클릭 상세 패널) — 2026-10-06 — MASTER PUSHED(`106e8e4`) / PRODUCTION DEPLOYED·VERIFIED
