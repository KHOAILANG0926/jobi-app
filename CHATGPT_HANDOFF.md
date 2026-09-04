# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

2026-09-04 사용자 지시(반복주소 수정 — "1차 크롤러 표준 마감") 반영 완료.
**반복주소(모집지역 접미사) geocode 전 병합 + 검증 없는 ward 등급 마커/거리
제외 + recruitment_regions 도입.** 커밋 [cdfa08c](https://github.com/KHOAILANG0926/jobi-app/commit/cdfa08c15c567c9caaff4e6490485d94507767df),
master push 완료, VPS `/root/jobi`도 동일 커밋으로 동기화 완료. 운영 재개
(cron/GHA)는 여전히 비승인 — DB 쓰기 없음, migration 미실행.

## 완료 항목

1. **반복주소 병합**: `crawl_topcv.py`에 `_group_candidates_by_core_location()`
   추가 — geocode 이전에 같은 시설명(KCN/CCN/Khu Công Nghiệp/Cụm Công
   Nghiệp/Tòa nhà/Lô) 또는 comma-segment 접두사가 같은 후보를 1개 근무구역
   으로 묶는다. 대표 텍스트는 그룹 내 최단 원문(접미사 없음) — 지역 접미사가
   섞인 긴 텍스트로 geocode하면 그 접미사 쪽으로 결과가 편향되는 게 실사례
   (KCN Hiệp Phước 공고)로 확인된 원인이었다.
2. **recruitment_regions**: 그룹에 속한 서로 다른 모집지역 라벨을 좌표 복제
   없이 배열로 보존(`job_work_locations.recruitment_regions`, draft only).
   `JobDetail.tsx`에 "Tuyển tại: ..." 표시 추가(2개 이상일 때만).
3. **ward 등급 검증 게이트 실질화**: `location_verified===true`가 아닌
   'ward' 등급은 내부 지도 마커·길찾기·거리 계산에서 제외(`region`/
   `unresolved`와 동일 취급) — `JobsContext.tsx`/`JobDetail.tsx` 수정.
   **부수 발견**: `job_work_locations` select 쿼리에 애초에
   `coordinate_accuracy`/`location_verified`가 빠져 있어서, 기존 ward 게이트
   코드 자체가 한 번도 실제로 동작한 적이 없었다(항상 "컬럼 없음" 안전
   기본값 분기만 탐) — 이번에 select에 포함시켜 실제로 동작하게 고침.
4. **길찾기(#6)**: 기존 구현(원문 위치+상위 시·도+Vietnam) 그대로 유지,
   변경 없음 — 좌표 신뢰 여부와 무관하게 항상 제공됨.
5. **테스트**: `test_address_pipeline_integration.py`에 5건 추가(KCN 시설명
   병합/일반주소 접미사 병합/다른 장소 오병합 방지/end-to-end 병합+
   recruitment_regions/RPC payload 전달) — 크롤러 전체 39/39 통과
   (job_quality 15 + address_pipeline_integration 24). 프론트 `tsc --noEmit`
   +`npm run build` 통과.
6. **실측 회귀(10건, write-guard dry-run, DB 쓰기 없음)**: VPS 격리 환경
   (`/root/jobi_test`, 종료 후 삭제)에서 KCN Hiệp Phước 포함 대표 10건 재조사.
   KCN Hiệp Phước: 4행 -> **1행**(좌표 10.7227835,106.703405 고정),
   `recruitment_regions=['TP.HCM','Long An']` 확인. 10건 전체: DB CHECK 위반
   leak 0건, 잘못된 `unresolved`+좌표 조합 0건, `active=true`인데
   `publish_gate_reason!='ok'`인 모순 0건, `exact`(C1) 승격 0건(예상과 일치).
7. **프론트 라이브 확인**: 로컬 dev preview로 sb-4369(JobDetail, "Tìm địa chỉ
   trên Google Maps" 검색 링크만 — unresolved라 정상), `/ban-do`(MapView,
   "0 việc làm" — exact 등급 공고가 아직 없어 정상), Home 정상 로드 확인.
   콘솔 에러는 무관한 tile/이미지 404뿐. **recruitment_regions 표시 UI /
   locationVerified=true인 ward 항목의 "exact와 동일 취급" 분기는 실제 DB에
   해당 데이터가 아직 없어(쓰기 자체를 안 했으므로) 육안 확인은 못함** —
   코드 로직 검토 + 유닛 테스트로만 검증됨, migration 승인 후 실제 저장되면
   육안 확인 필요.

## 코드·DB 호환성 표 (최종)

| 항목 | 코드(internal) | DB 실제 상태 | 매핑/조치 |
|---|---|---|---|
| coordinate_accuracy | `exact_candidate`/`ward`/`region`/`unresolved` | CHECK: `exact`/`ward`/`region`/`unresolved`(0015, 실행됨) | `_coordinate_accuracy_for_db()`가 `exact_candidate`→(`source_verified`면 `exact`, 아니면 `unresolved`+좌표null)로 항상 매핑. ward/region/unresolved는 그대로 통과. |
| location_verified | `source_verified`(bool) | 컬럼 존재(0010), RPC(0015)가 INSERT 목록에서 누락 → 항상 false | 0018 draft가 RPC에 배선(미실행). Python payload는 이미 값 전송(하위호환, 현재 RPC는 무시). |
| recruitment_regions | 그룹별 모집지역 라벨 배열 | 컬럼 없음 | 0018 draft에 신규 컬럼+RPC 배선 추가(미실행). Python payload는 이미 값 전송(하위호환). |
| 프론트 select | — | `job_work_locations` select에 `coordinate_accuracy`/`location_verified` 누락(발견) | 이번에 select에 추가 — ward 게이트가 처음으로 실제 작동 시작. |

## 운영 전 필요한 단계 (실행 안 함, 사용자 승인 대기)

1. draft migration 0018 검토 후 승인 → 운영 DB 실행(recruitment_regions
   컬럼 추가 + RPC 배선, additive만).
2. 검증용 소규모 저장(3~5건): `--process-url --confirm-write`로 이미
   원문 대조까지 끝난 공고 3~5건만 실제로 저장 → `job_work_locations`에
   `location_verified`/`recruitment_regions`가 실제로 채워지는지, DB CHECK
   위반 없이 insert되는지 확인. 이번 라운드에서는 실행하지 않음.
3. 2번이 확인되면 cron/GHA 재개 여부는 별도 승인 필요(계속 비승인 상태).

## 발견됐으나 이번 라운드 범위 밖(수정 안 함, 기록만)

- `local_jobs.origin != 'crawler'`인 기존 행의 비-게이트 필드
  (salary/location/description) title+company 텍스트 매칭 우연 충돌 가능성
  — 이전 라운드에서 이미 기록, 여전히 범위 밖.
- 분류 체계의 `work_mode`(이동·순회근무) 축 — 별도 필드/컬럼 없음, 이번
  라운드에도 추가하지 않음(migration 필요, "1차 표준 마감" 지시에 따라
  신규 설계 확장 중단).

## 다음 결정사항

- 운영 재개(cron/GHA) 계속 비승인.
- draft migration 0018 승인 여부 대기.
- 승인 시 위 "운영 전 필요한 단계" 1→2→3 순서로 진행.
