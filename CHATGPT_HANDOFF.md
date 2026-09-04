# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

2026-09-04 사용자 지시("코드·DB 호환성 전수 확인부터, sb-4366~4369는 baseline이지
새 사건 아님") 반영 완료. **4건 데이터 원인 조사(읽기 전용) + 코드·DB 호환성 감사
+ 프론트엔드 가짜 마커 결함 2건 발견·수정 + "+N 지역" 실제 공고 35건 dry-run 진행
중.** 운영 재개(cron)는 여전히 비승인.

## sb-4366~4369 생성 원인 조사 (읽기 전용, 데이터 변경 없음)

- 4366~4368: `created_at` 셋 다 동일(2026-09-02T06:22:49) — 이전 세션에서 이미
  기록된 1회성 재처리 스크립트(`_reprocess_3jobs.py`) 실행 결과와 일치, baseline.
- **4369**: `created_at=2026-09-04T00:51:37Z`(베트남 07:51), `active=true`,
  `publish_gate_reason='ok'`인데 자기 자신의 `job_work_locations` 행은
  `coordinate_accuracy='unresolved', geocode_status='failed'` — 오늘 이 세션의
  어떤 게이트 정책으로도 나올 수 없는 조합(구버전 정책의 흔적으로 추정).
  - VPS cron: 2026-09-02부터 비활성 확인(crontab 주석 처리, `crawl_daily.log`도
    그 이후 갱신 없음) — 무관.
  - GitHub Actions `crawl.yml`("채용공고 자동 크롤링"): `gh workflow list` 결과
    **`disabled_manually`**, 마지막 실행 2026-08-28(실패) 이후 실행 이력 없음 —
    무관.
  - bash_history: 2026-08-23 이후 갱신 없음(파일 mtime 확인) — 그 이후 수동 실행
    여부 확인 불가. `last -F`도 비대화형 SSH 세션은 기록하지 않아 무관.
  - **결론: 생성 원인 확인 못함.** 4건 데이터는 전혀 변경하지 않았음.

## 코드·DB 호환성 감사 결과 (커밋 88b0e72)

1. **[결함] DB CHECK 제약 위반 위험**: `job_work_locations.coordinate_accuracy`
   CHECK 제약(migration 0015, 이미 실행됨)은 `('exact','ward','region',
   'unresolved')`만 허용 — 이전 커밋의 'exact'→'exact_candidate' 개명 이후
   `_work_location_rpc_rows()`가 이 값을 그대로 RPC에 흘려보내고 있었다(다음
   실제 쓰기 때 즉시 제약 위반). `_coordinate_accuracy_for_db()` 추가로 해결 —
   `source_verified=True`만 DB `'exact'`로 승격, 아니면 `'unresolved'`로
   낮추고 좌표도 null. `raw_address`는 항상 보존.
2. **[결함] `location_verified` 컬럼 미사용**: 이미 존재하는 컬럼(migration
   0010)인데 RPC(migration 0015)의 INSERT 목록에서 빠져 항상 기본값 `false`.
   draft migration `0018`(미실행)로 RPC 갱신안 작성, Python 쪽은 이미 값을
   보내도록 수정(현재 RPC는 조용히 무시 — 하위 호환).
3. **[결함] `MapView.tsx` 가짜 마커**: 실제 좌표 없는 공고에도 지역/기본
   중심점을 채워 실제 Leaflet 마커로 표시하고 있었음. `resolveMapLocations()`
   + `source==='exact'` 게이트로 수정 — 검증 안 된 공고는 지도에서 완전히
   제외. 로컬 프리뷰(실제 운영 데이터)로 확인: 수정 후 "0 việc làm"(현재
   진짜 검증된 공고가 없음을 정확히 반영).
4. **[결함] `Home.tsx` "내 주변" 필터 동일 결함**: `guessCoordinatesFromLocation`
   무조건 fallback이 "내 주변" 필터·정렬·거리 배지에 가짜 거리를 쓰고 있었음.
   동일하게 수정 — 검증 안 된 공고는 배지 없이 자연히 제외.
5. **Google Maps 길찾기 쿼리**: 사용자 지시대로 "원문 위치 + 상위 시·도 +
   Vietnam"을 항상 URL 인코딩하도록 수정. 로컬 프리뷰(sb-4369, 실제 데이터)로
   확인: `..., Tây Ninh, Vietnam` 정확히 반영됨.
6. **[확인, 수정 불필요]** active/publish_gate_reason 단일 함수 계산, 기술
   오류 시 기존 데이터 보호, 기업 직접 등록 공고 미변경(Python 레벨 +
   RPC 함수 내부 `v_origin` 체크 이중 보호, migration 0015) — 전부 이미
   올바르게 구현돼 있음을 재확인.
7. **분류 체계 독립 축 확인**: address_accuracy/coordinate_accuracy/
   geocode_status(모두 DB 컬럼, write-only — 프론트는 coordinate_accuracy만
   읽음)/location_verified(컬럼 있으나 미사용→③에서 배선)/`source_verified`
   (100% internal, DB에 아직 저장 안 됨, `location_verified`와 개념적으로
   대응)/`exact_candidate`(100% internal, DB에는 절대 raw로 안 감,
   `_coordinate_accuracy_for_db()`가 항상 매핑) — 이미 독립된 축으로
   분리돼 있고 하나의 ENUM으로 합쳐진 곳 없음을 확인.

## 테스트/빌드 결과

- 크롤러: VPS 격리 환경 `job_quality` 15/15 + `address_pipeline_integration`
  19/19 = **34/34 통과**.
- 프론트: `npx tsc --noEmit` 통과, `npm run build` 통과, 로컬 프리뷰(dev
  server, 실제 운영 Supabase 데이터)로 Home("내 주변" 필터)/MapView(`/ban-do`)
  /JobDetail(`sb-4369`) 육안 확인 완료 — 콘솔 에러 없음(무관한 404/tile 로드
  실패만 존재).
- 커밋 해시 3중 확인(local == GitHub == VPS): `88b0e7284707228d8ac2eb66a1bb8c892063a4f2`.

## 발견된 문제 (아직 미해결/후속 필요)

- `address_accuracy`/`geocode_status`/`address_evidence`는 프론트가 전혀
  읽지 않는 write-only 감사용 필드로 확인(문제는 아니고 사실 기록).
- `local_jobs.origin != 'crawler'`인 기존 행에 대해, `compute_job_updates()`가
  계산하는 **비-게이트 필드**(salary/location/description 등)는 title+company
  텍스트 매칭으로 우연히 크롤러 결과와 충돌할 경우 이론상 덮어써질 수 있는
  좁은 여지가 남아있음(active/publish_gate_reason/crawler_version 자체는
  이미 origin 체크로 완전히 보호됨) — 이번 라운드 범위 밖으로 판단해 손대지
  않음, 후속 검토 후보로만 기록.
- "+N 모집지역 + 일부 상세 근무지" 실제 공고 조사 완료: 기존 dry-run 배치
  전체(185건, 중복 제거)에서 이 패턴에 맞는 실제 공고 24건(요구 20건 초과)을
  찾아 현재 commit(88b0e72) 기준으로 재조사(write-guard dry-run, DB 쓰기 없음).
  결과: 24건 51개 근무지 중 `source_verified=True` 0건 → DB에 `exact`로 승격된
  행 0건(기대치와 일치, 원문 좌표 커버리지 ~6.7% 기준 정상 범위). 내부
  `exact_candidate` 문자열이 DB 페이로드에 그대로 노출되는 사례 0건(leak 없음
  확인). `active=True`인데 `publish_gate_reason != 'ok'`인 모순 0건.
  **신규 발견(수정 안 함, 보고만)**: 공고 중 하나(KCN Hiệp Phước, Nhà Bè)는
  원문 사이트 자체가 "지역별 채용" 섹션에 동일한 물리적 주소를 지역 접미사만
  바꿔 4번 반복 표시함(예: "...Thành phố Hồ Chí Minh, Bình Chánh" /
  "...Quận 7" / "...Cần Giuộc" — 실제 라이브 페이지에서 확인). 크롤러는 이를
  원문 그대로 4개의 서로 다른 근무지 텍스트로 정확히 추출했으나, 각각을
  독립 지오코딩한 결과 좌표가 최대 약 15km까지 벌어짐(전부 'ward' 등급,
  'success' 상태). 즉 'ward' 등급도 이런 반복 주소 패턴에서는 신뢰도가
  낮을 수 있음 — 현재 프론트(`JobsContext.tsx`)는 'ward' 등급까지 지도
  마커로 노출하고 있어(이번 세션 범위 밖, 기존 설계), 사용자 판단 필요.
- 분류 체계의 `work_mode`(이동·순회근무) 축은 현재 별도 필드/컬럼으로 구현돼
  있지 않음(코드 전체에서 관련 필드 검색 결과 없음). 새로 만들려면 DB 컬럼
  추가(migration)가 필요해 이번 라운드 범위 밖으로 판단, 실행하지 않음.

## 다음 결정사항

- 운영 재개(cron 활성화) 여전히 비승인.
- draft migration 0018(location_verified RPC 배선)은 사용자 승인 후에만 실행.
- "+N 지역" 패턴 20건 결과가 나오는 대로 최종 보고.
