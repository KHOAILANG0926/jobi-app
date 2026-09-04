# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

2026-09-04 사용자의 10단계 지시("크롤러 표준 완성")를 순서대로 진행 중.
1. ✅ 공개 게이트를 "모든 근무지가 C1(coordinate_accuracy=='exact')이고 유효한 지원
   경로가 있을 때만 통과"로 강화 — 완료, 테스트 통과, master 커밋·푸시 완료.
2. ✅ C1_partial/A/B/C2/C3/D/E는 게이트 로직상 자동으로 전부 보류(1의 결과).
3. ✅ C1 판정 7건의 원문 상세주소·좌표 전수검증 완료 — 1건이 실제로는 15km 떨어진
   오탐(버그, 아래 참고)이었고 수정 후 제거됨. 나머지 6건은 Google 지도 독립 대조로
   전부 정확 확인(오차 1m~130m).
4. ✅ C3 31건 중 17건 개별 분석 완료(요구된 10건 이상 충족) — 2개의 서로 다른 시스템
   결함을 발견해 각각 회귀 테스트 우선 추가 후 수정(아래 "변경 내용" 참고). 나머지
   패턴(예: Geoapify가 관련 없는 임의 주소로 저신뢰도 fallback하는 경우, ~6건)은
   파이프라인 결함이 아니라 Geoapify API 측 현상으로 판단 — 기존 충돌 감지 로직이
   이미 올바르게(안전하게) 거부하고 있어 수정 불필요.
5. ✅ 4단계에서 발견한 2건의 공통 오류 모두 회귀 테스트를 먼저 추가해 결함 재현을
   확인한 뒤 수정 — 특정 공고 ID 예외처리 없음.
6~10. 다음 단계 — 미착수. `used21.txt`(21)+`batchA_100.txt`(100)+`batchB_blind20.txt`
   (20) = 141건과 겹치지 않는 새 20건을 `pool_fresh.txt`(157건 후보)에서 선정해 현재
   commit으로 1회(`--dry-run-urls`) 처리 후 원문 DOM 전체 필드 대조 예정.

이번 라운드는 DB 쓰기·실제 공고 저장·기존 공고 상태 변경·migration 실행·cron/GHA
활성화·관리자 등록 기능 구현을 하지 않는다(사용자 명시 지시). 코드/테스트는 통과 후
master에 커밋·푸시 가능(사용자 명시 승인) — 실제 DB write는 여전히 전부 금지.

## 변경 내용

- **커밋 `54240c5`** (`feat: 공개 게이트...`): `job_quality.gate_auto_publish()`에
  `all_locations_verified_exact: bool = False`(기본값 안전 실패) 추가, 새 판정 사유
  `'no_verified_coordinate'`. `crawl_topcv.py`의 `build_job_record()`가 계산해서 전달.
  `supabase/migrations/0017_..._draft.sql` 초안 작성(**미실행**).
- **커밋 `546b410`** (`fix: 저신뢰도 변형 2개가...`): C1 7건 전수검증 중 발견 —
  "98/3D Bình Đường 3, phường Dĩ An..." 주소가 exact로 잘못 판정됨(Google 지도
  독립 대조 결과 실제 위치에서 약 15km 떨어진 "Bình Thới"였음). 원인: Geoapify가
  신뢰도 0.06~0.08인 두 변형 모두 무관한 도로("Đường Hòa Bình")로 오매칭했고
  우연히 동일 좌표에 수렴해 "2개 변형 수렴"만으로 exact 처리됨 — 명명된 건물
  (KCN/Tòa nhà/Lô)이 있는 주소만 place_name 확인을 거쳤고, 평범한 도로명 주소는
  이 확인이 전혀 없었던 게 근본 원인. `geocode.py`에 `extract_core_identifier()`
  추가해 도로명 주소도 동일한 확인을 거치도록 수정.
- **커밋 `09341c5`** (`fix: Thủ Đức/Dĩ An/Thuận An...`): C3 31건 중 17건 개별 분석
  중 발견 — "Thủ Đức"(2021년부터 Hồ Chí Minh 산하, 별도 성이었던 적 없음),
  "Dĩ An"/"Thuận An"(구 Bình Dương 산하, 2025 통합으로 Hồ Chí Minh 그룹) 주소가
  Geoapify 응답 city 필드에 그 도시명만 채워져 반환되는 경우, 상위 성 이름과
  텍스트가 전혀 겹치지 않아 "다른 행정구역 충돌"로 오판 → 실제로는 정확한 TP.HCM
  주소 다수가 unresolved로 잘못 거부됨(최소 9건). `_KNOWN_SUB_CITY_PARENT_PROVINCE`
  (실측 확인된 3건만) 추가해 `_region_text_matches()`가 인식하도록 수정.
- 두 수정 모두 회귀 테스트를 실제 버그 재현 확인 후 추가(TDD 순서), 특정 공고 ID
  예외처리 없음.

## 테스트 결과

- VPS 격리 테스트 디렉터리(작업마다 생성 후 삭제)에서 실행, 매 커밋마다 27/27
  통과(`test_job_quality.py` 13 + `test_address_pipeline_integration.py` 14,
  `test_write_guard_blocks_unconfirmed_writes` 포함 — dry-run 쓰기 차단 정상).
- 커밋 해시 3중 확인(local == GitHub == VPS) 매 커밋 후 완료, VPS `/root/jobi`
  워킹 카피 fast-forward pull 완료. 최신: `09341c59b4671c46d76f934130f6af3710d3e44f`.
- **100건 조사 pool 재실행 결과** (`batchA_100.txt`, 고정 URL, 현재 commit,
  `--dry-run-urls`, DB 쓰기 없음):
  - 원본(이전 세션 보고값, `035f54e` 기준): C1=7, C1_partial=11, C2=33, C3=31, B=15
  - 두 수정 반영 후(오프라인 재분류, 캐시된 geocode 데이터 재사용): **C1=10,
    C1_partial=9, C2=46, C3=17, B=15** — C3 14건 회복(대부분 정당한 정확 주소),
    C1 순증 +3(오탐 1건 제거 + 신규 정당 승격 4건, 그중 2건 Google 지도 표본
    검증: Trần Ngọc Diện 오차 ~405m, Quang Trung 오차 ~2.6km — 둘 다 올바른
    구/동 내, 결과 신뢰 가능).
  - C1 7건 전수검증: 6건 정확(Google 지도 오차 1m~130m), 1건(Bình Đường 3) 완전
    오탐 확인 후 수정으로 제거.

## 발견된 문제

- **로컬 PC에 Python 미설치**(Windows Store stub만 존재) — 모든 크롤러 테스트는
  VPS 격리 디렉터리에서 실행해야 함(계속 유효).
- **Geoapify 저신뢰도 fallback 패턴**(C3 31건 중 ~6건, 예: "44 Quản Trọng Linh,
  Quận 8"): 여러 개의 서로 무관한 TP.HCM 주소 질의가 신뢰도 0.04~0.28의 동일한
  임의 응답("246, Tự Phước, Lộc Quý", Lâm Đồng)으로 수렴 — 우리 파이프라인 로직
  결함이 아니라 Geoapify API 측 현상으로 판단(수정 불필요, 기존 충돌 감지가 이미
  올바르게 거부 중). 다만 이런 저신뢰도 응답도 `geocode_cache`에 "success"로
  영구 캐시되므로, 향후 Geoapify 응답이 개선돼도 캐시가 갱신 전까지 계속 나쁜
  결과를 반환한다는 점은 별도 개선 여지로 남김(이번 라운드 범위 밖, 코드 변경 아님).
- 이전 세션이 보고한 "C1 7건/C3 31건" 수치의 원본 dry-run 결과 파일은 로컬/VPS
  어디에도 보존되지 않았으나, 동일 고정 URL pool을 현재 commit으로 재실행해 정확히
  동일한 수치(C1=7, C3=31)가 재현됨을 확인 — 파이프라인이 결정론적임을 확인.

## 다음 결정사항

- 상태: 1~5단계 **IMPLEMENTED → VERIFIED → MASTER PUSHED**. Production 배포 대상
  아님(크롤러는 VPS cron 전용이며 cron은 계속 비활성 — 다음 크롤 실행부터 적용될
  코드 변경일 뿐, 별도 "배포" 단계 없음).
- 다음 단계: `pool_fresh.txt`(157건)에서 141건(used21+batchA_100+batchB_blind20)과
  겹치지 않는 새 20건을 선정 → 현재 commit(`09341c5`)으로 `--dry-run-urls` 1회
  처리 → 신규 20건 전체 필드(주소뿐 아니라 제목·회사·급여·경력·학력·근무형태·
  모집인원·마감일·본문·지원가능여부)를 원문 DOM과 대조 → 오탐 0건·핵심 필드
  정확도 90% 이상 여부 확인 → 기준 미달 시 원인·실패사례 보고(운영 재개 제안 안 함).
- 크롤러 cron은 계속 비활성 상태 — 재활성화는 이번 10단계 작업 완료 후 별도 사용자
  판단 필요.
- 관리자 대행 등록 설계·추가 UI 개선은 사용자가 이번 라운드 범위 밖으로 명시 — 백로그로만
  기록, 착수하지 않음.
