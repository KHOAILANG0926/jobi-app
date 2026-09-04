# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

2026-09-04 사용자의 10단계 지시("크롤러 표준 완성")를 순서대로 진행 중.
1. ✅ 공개 게이트를 "모든 근무지가 C1(coordinate_accuracy=='exact')이고 유효한 지원
   경로가 있을 때만 통과"로 강화 — 완료, 테스트 통과, master 커밋·푸시 완료.
2. ✅ C1_partial/A/B/C2/C3/D/E는 게이트 로직상 자동으로 전부 보류(1의 결과).
3. ⏳ C1 판정 7건의 원문 상세주소·좌표 전수검증 — 진행 전, 대상 목록 재확인 중.
4. ⏳ C3 31건 중 최소 10건 개별 분석(동명 지역 충돌 vs 파서·지오코딩 오류 분리) — 미착수.
5~10. 미착수(4번 결과에 따라 순서대로 진행 예정).

이번 라운드는 DB 쓰기·실제 공고 저장·기존 공고 상태 변경·migration 실행·cron/GHA
활성화·관리자 등록 기능 구현을 하지 않는다(사용자 명시 지시). 코드/테스트는 통과 후
master에 커밋·푸시 가능(사용자 명시 승인) — 실제 DB write는 여전히 전부 금지.

## 변경 내용

- `crawler/job_quality.py`의 `gate_auto_publish()`: 새 파라미터
  `all_locations_verified_exact: bool = False`(기본값 False = 안전 실패) 추가,
  새 판정 사유 `'no_verified_coordinate'`를 `has_address_text` 다음, `has_application_path_`
  이전 순서로 검사하도록 삽입.
- `crawler/crawl_topcv.py`의 `build_job_record()`: `resolved_locations`가 1개 이상이고
  전부 `coordinate_accuracy=='exact'`인지 계산해 `gate_auto_publish()`에 명시적으로 전달.
- `crawler/test_job_quality.py`: `gate_auto_publish` 관련 기존 호출부 전부 3번째 인자
  명시, 새 회귀 어서션 2개 추가(좌표 미검증 시 보류, 인자 생략 시 기본값 False로 보류).
- `supabase/migrations/0017_publish_gate_reason_add_no_verified_coordinate_draft.sql`:
  `local_jobs.publish_gate_reason` CHECK 제약에 `'no_verified_coordinate'` 추가하는
  초안 — **미실행**. 실제 크롤 저장 경로가 이 새 사유를 컬럼에 쓰려면 먼저 실행 필요
  (지금은 dry-run만 하므로 당장은 불필요).
- 커밋: `54240c5` (`feat: 공개 게이트를 모든 근무지 좌표 exact 검증 + 지원경로 필수로 강화`).

## 테스트 결과

- VPS 격리 테스트 디렉터리(`/root/jobi_test`, 작업 후 삭제)에서 실행, 26/26 통과:
  - `test_job_quality.py`: 13/13 (신규 게이트 회귀 포함).
  - `test_address_pipeline_integration.py`: 13/13 (`test_write_guard_blocks_unconfirmed_writes`
    포함 — dry-run 쓰기 차단 여전히 정상).
- `crawl_topcv.py`/`job_quality.py` 구문 검사(`ast.parse`) 통과.
- 커밋 해시 3중 확인: local(`54240c5`) == GitHub `refs/heads/master` == VPS
  `origin/master` — 일치 확인 후 VPS `/root/jobi` 워킹 카피도 fast-forward pull 완료.
- 100건 조사 pool(`batchA_100.txt`, 고정된 100개 URL)을 현재 commit(`54240c5`)으로
  `--dry-run-urls` 재실행 중(DB 쓰기 없음) — 3단계(C1 7건 검증)·4단계(C3 31건 중 10건
  분석)에 쓸 확정 데이터 확보 목적. 완료되면 `classify2.py`로 재분류해 C1/C3 목록 확정.

## 발견된 문제

- 이전 세션에서 100건 조사·블라인드 20건 시험을 이미 완료했고(주소 exact-tier
  21→25/153, unresolved 90→84, job-level C3 36→31/100, geocode.py의 sparse-metadata
  오탐 버그 수정 커밋 `035f54e` 반영 후 수치), 사용자에게 "C1 판정 7건", "C3 31건" 수치를
  보고했으나, 그 판정에 쓰인 원본 dry-run JSON 결과 파일이 로컬 scratchpad에
  `classify_A_before_full.json`(C1=14, C3=41 — 이는 `035f54e` 수정 **이전** 스냅숏으로
  확인됨, 파일명의 "before"가 이를 가리킴)만 남아있고 수정 **이후** 확정본은 별도 파일로
  보존되지 않았음. VPS `/root/*.json`에도 남아있지 않음. → 재현 가능한 파이프라인(고정
  URL pool + 결정론적 geocode_cache)이므로 동일 100건을 현재 commit으로 재실행해 확정
  데이터를 다시 만드는 중(위 "테스트 결과" 참고) — 값이 사용자가 인용한 7/31과 다르게
  나오면 그 차이를 사용자에게 명시적으로 보고할 것.
- 로컬 PC에는 Python이 설치돼 있지 않음(Windows Store stub만 존재) — 모든 크롤러 테스트는
  VPS 격리 디렉터리에서 실행해야 함.

## 다음 결정사항

- 상태: 1~2단계 **IMPLEMENTED → VERIFIED → MASTER PUSHED**. Production 배포 대상이 아님
  (크롤러는 VPS에서 cron으로만 실행되며 cron은 계속 비활성 — 이 변경은 다음 크롤 실행부터
  적용될 코드일 뿐, 별도 "배포" 단계 없음).
- 100건 재실행 결과가 나오는 대로 3단계(C1 7건 전수검증)·4단계(C3 10건 이상 개별 분석)를
  이어서 진행하고, 5단계(공통 오류 발견 시 회귀 테스트 우선 추가) 여부를 판단.
- 그 다음 6~8단계: `used21.txt`(21건) + `batchA_100.txt`(100건) + `batchB_blind20.txt`
  (20건) = 141건과 겹치지 않는 새 20건을 `pool_fresh.txt`(157건 후보)에서 선정해 현재
  commit으로 1회 처리 후 원문 DOM 전체 필드 대조.
- 크롤러 cron은 계속 비활성 상태 — 재활성화는 이번 10단계 작업 완료 후 별도 사용자
  판단 필요.
- 관리자 대행 등록 설계·추가 UI 개선은 사용자가 이번 라운드 범위 밖으로 명시 — 백로그로만
  기록, 착수하지 않음.
