# ChatGPT ↔ Claude Code 인수인계 문서

## ✅ migration 0018 적용 + recruitment_regions 저장 경로 활성화 완료(2026-09-05)

운영 Supabase(`edhuesdnuxlbcfephutq`)에 **migration 0018을 실제로 적용**했고,
그 직후 `local_jobs.recruitment_regions` 저장 코드도 활성화했다. 상세 적용
전후 검증 결과: [MIGRATION_0018_APPLIED.md](MIGRATION_0018_APPLIED.md).

**실측으로 확인된 것**: `local_jobs.recruitment_regions`/`job_work_locations.
matched_recruitment_regions` 컬럼 추가, `replace_job_work_locations()` RPC의
`location_verified`/`matched_recruitment_regions` 배선, 기존 데이터는 행 수
+ MD5 체크섬(기존 컬럼만 대상)으로 완전 불변 확인, RPC 보안장치(origin='crawler'
가드/원자적 delete+insert/jsonb_typeof 안전 처리/service_role 전용 GRANT/
SECURITY DEFINER+search_path=public) 전부 유지, RLS(migration 0019)는 이
migration이 건드리지 않았음을 재확인. 크롤러 테스트 50/50, `tsc`/`build` 통과.
커밋 [3fbde0c](https://github.com/KHOAILANG0926/jobi-app/commit/3fbde0cf6b27a74d95cc6375dfe5bb4733d38756),
master push 완료, VPS `/root/jobi`도 동일 커밋으로 동기화 완료.

**⚠️ 새로 발견된 블로커(비공개 표본 저장 전 반드시 확인 필요)**:
`supabase/migrations/0017_publish_gate_reason_add_no_verified_coordinate_draft.sql`
가 아직 draft·미실행 상태다. 운영 DB의 `local_jobs_publish_gate_reason_check`
CHECK 제약이 지금도 `('ok','no_address_text','no_application_path')`만 허용하고
`'no_verified_coordinate'`는 없는데, 크롤러가 실제로 계산하는 gate_reason
값의 절대다수가 이 값이다(이전 라운드 실측: 기업 좌표 커버리지 ~6.7%). **이
상태로 실제 공고 저장을 시도하면 대부분 CHECK 위반으로 즉시 실패한다.**
migration 0018과는 독립적이라 이번엔 손대지 않았음 — 다음 단계(비공개 표본
3~5건 검증) 전에 0017을 먼저 검토/승인해야 한다.

**아직 안 한 것**: migration 0017 실행, migration 0020(admin_* EXECUTE 축소)
실행, `--verify-write-urls` 표본 저장, 기존 공고 재처리, cron/GHA 활성화 —
전부 별도 승인 대기.

---

## 이전 작업: P1(RLS) 해결 + 기업 접근 경로 정리 완료(2026-09-04)

운영 Supabase의 `local_jobs`/`job_work_locations` anon REST 노출 문제를
**RLS migration 0019로 실제 수정·검증**했고, 그 뒤 **프론트
`EmployerDashboard`/`RequireEmployer`도 실제로 그 정책을 활용하도록 수정**했다.

- RLS 적용+검증 결과: [RLS_MIGRATION_0019_FINAL.md](RLS_MIGRATION_0019_FINAL.md)
  (사전 감사는 [RLS_SECURITY_AUDIT.md](RLS_SECURITY_AUDIT.md))
- 기업 접근 경로 정리 결과: [EMPLOYER_ACCESS_PATH_FIX.md](EMPLOYER_ACCESS_PATH_FIX.md)

**실측으로 확인된 것**: anon은 공개 공고만(active=false 노출 0건 — 적용 전
3건에서 전환), 관리자는 전체 접근, 기업은 타사 비공개 공고를 못 봄, 일반
사용자가 화면 조작해도 seeker 계정으로는 쓰기 조건을 통과 못함(RLS 조건
직접 평가), Home/공고상세 화면 회귀 없음, `tsc`/`build`/신규 유닛테스트
(11건) 전부 통과. 커밋 `88c481a` 기준으로 완료 인정됨(사용자 확인).

**부분 검증으로만 표시된 것(과장하지 않음, 사용자 지시로 별도 재조사 안 함
— 향후 비공개 표본 검증 단계에 포함 예정)**: admin_hidden=true 조합
2가지(실제 행 없음, 함수 로직만), 기업이 본인 비공개 공고를 실제로 보는지
(코드/유닛테스트만, 실제 로그인 화면 미확인), service_role 영향 없음(속성
기반 판단, 실제 요청 안 함), 관리자 화면 회귀(빌드 성공 근거만).

## 다음 결정사항

1. **migration 0017 검토/승인 여부** — publish_gate_reason CHECK에
   `'no_verified_coordinate'` 추가. 이게 없으면 비공개 표본 저장 자체가
   대부분 실패한다. 다음으로 가장 먼저 필요한 결정.
2. 0017 승인·적용되면 → 검증용 소규모 저장(3~5건, `--process-url
   --confirm-write`)으로 `location_verified`/`matched_recruitment_regions`/
   `recruitment_regions`이 실제로 채워지는지, CHECK 위반 없이 insert되는지
   확인 — 이때 위 "부분 검증" 항목들(기업 본인 비공개 공고 실제 화면,
   admin_hidden=true 실제 행, service_role 실제 요청)도 함께 실측.
3. migration 0020(admin_* EXECUTE 축소, 별도 하드닝 항목) 승인 여부 대기.
4. 운영 재개(cron/GHA)는 계속 비승인 — 위 단계들 이후 별도 승인 필요.

## 발견됐으나 범위 밖(수정 안 함, 기록만)

- `MapView.tsx`가 raw OpenStreetMap 타일을, `JobLocationMap.tsx`가 Geoapify
  타일을 쓰는 공급자 불일치 — 통일 여부는 사용자 판단 필요.
- "미확인 지역"(local_jobs.recruitment_regions와 matched_recruitment_regions
  합집합의 차집합)을 실제로 계산해 보여주는 UI — 데이터 모델만 설계, 구현 안 함.
- `local_jobs.origin != 'crawler'`인 기존 행의 비-게이트 필드 우연 충돌 가능성.
- 분류 체계의 `work_mode`(이동·순회근무) 축 — 별도 필드/컬럼 없음, 추가 안 함.
