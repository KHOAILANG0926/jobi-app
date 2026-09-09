# ChatGPT ↔ Claude Code 인수인계 문서

## ✅ migration 0017 블로커 해소 확인 + 리포 정합화 완료(2026-09-09)

**발견 경위**: 이전 스냅샷(아래 2026-09-05 절)은 "0017이 draft·미실행 상태라
비공개 표본 저장이 CHECK 위반으로 실패한다"고 기록돼 있었다. 2026-09-09에
운영 Supabase(`edhuesdnuxlbcfephutq`)를 직접 재조회한 결과, 이는 더 이상
사실이 아니었다.

**실측으로 확인된 것**: `local_jobs_publish_gate_reason_check` 제약이 이미
`'no_verified_coordinate'`를 포함한다. `supabase_migrations.schema_migrations`에
version `20260905015705` / name `publish_gate_reason_add_no_verified_coordinate`로
적용 이력이 존재하고, 그 `statements`가 리포의 구 `0017_..._draft.sql` 본문과
완전히 동일함을 직접 조회로 확인했다(제약 재정의 + comment on column, 둘 다
일치). 적용 시각(버전 타임스탬프, UTC): 2026-09-05 01:57:05 — 즉 0017을
"미실행 블로커"로 기록한 커밋(6e12edb, 2026-09-05 00:09 +07)보다 **나중에**
파일·커밋 없이 운영 DB에 직접 적용된 것으로 보인다(TWO-PC 규칙상 migration
파일이 GitHub master에 포함돼야 하는데 누락돼 있었음).

**변경 내용**: DB는 이미 목표 상태이므로 추가 DDL은 실행하지 않았다. 리포만
실제 상태에 맞췄다 —
[supabase/migrations/20260905015705_publish_gate_reason_add_no_verified_coordinate.sql](supabase/migrations/20260905015705_publish_gate_reason_add_no_verified_coordinate.sql)
로 파일명 변경(구 `0017_..._draft.sql`), 상단 주석을 "사후 반영, 실행용 아님"
+ 적용 사실/시각으로 교체, 이 핸드오프 문서의 0017 관련 서술을 해소 완료로 갱신.

**테스트 결과**: 코드 변경 없음(순수 문서/파일명 정리) — `tsc`/`build` 대상
아님. DB 조회로 제약·적용 이력·statements 일치를 직접 검증.

**발견된 문제**: 없음(위 "발견 경위"가 전부) — 단, 향후 세션은 운영 DB에
직접 적용하고 파일 커밋을 빠뜨리는 일이 재발하지 않도록 주의.

**다음 결정사항**: 아래 "다음 결정사항" 절 참고 — 0017 항목은 제거되고
나머지(0020, 비공개 표본 저장, cron/GHA)는 그대로 미승인 대기.

---

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

**~~⚠️ 새로 발견된 블로커~~ → 2026-09-09 해소 확인됨**: 당시엔
`0017_..._draft.sql`이 미실행이라고 기록했으나, 실제로는 이 문서 작성
이후 운영 DB에 직접 적용돼 있었다. 자세한 경위는 문서 최상단
"migration 0017 블로커 해소 확인 + 리포 정합화 완료(2026-09-09)" 절 참고.
파일은 `supabase/migrations/20260905015705_publish_gate_reason_add_no_verified_coordinate.sql`
로 이름이 바뀌었다.

**아직 안 한 것**: migration 0020(admin_* EXECUTE 축소) 실행,
`--verify-write-urls` 표본 저장, 기존 공고 재처리, cron/GHA 활성화 —
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

1. 비공개 표본 검증용 소규모 저장(3~5건, `--process-url --confirm-write`)으로
   `location_verified`/`matched_recruitment_regions`/`recruitment_regions`이
   실제로 채워지는지, CHECK 위반 없이 insert되는지 확인 — publish_gate_reason
   CHECK는 이미 `'no_verified_coordinate'`를 허용하므로 더 이상 블로커 아님.
   이때 위 "부분 검증" 항목들(기업 본인 비공개 공고 실제 화면, admin_hidden=true
   실제 행, service_role 실제 요청)도 함께 실측.
2. migration 0020(admin_* EXECUTE 축소, 별도 하드닝 항목) 승인 여부 대기.
3. 운영 재개(cron/GHA)는 계속 비승인 — 위 단계들 이후 별도 승인 필요.

## 발견됐으나 범위 밖(수정 안 함, 기록만)

- `MapView.tsx`가 raw OpenStreetMap 타일을, `JobLocationMap.tsx`가 Geoapify
  타일을 쓰는 공급자 불일치 — 통일 여부는 사용자 판단 필요.
- "미확인 지역"(local_jobs.recruitment_regions와 matched_recruitment_regions
  합집합의 차집합)을 실제로 계산해 보여주는 UI — 데이터 모델만 설계, 구현 안 함.
- `local_jobs.origin != 'crawler'`인 기존 행의 비-게이트 필드 우연 충돌 가능성.
- 분류 체계의 `work_mode`(이동·순회근무) 축 — 별도 필드/컬럼 없음, 추가 안 함.
