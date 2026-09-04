# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

2026-09-04 사용자 지시("Geoapify 단일 공급자의 쿼리 자기수렴만으로는 실제 사업장
정확도를 보장할 수 없다") 반영 완료. **exact_candidate로 강등 + 원문 좌표 검증
성공만 C1로 승격하는 아키텍처로 전환. 운영 재개(cron 활성화)는 계속 비승인 —
2차 독립 지오코딩 공급자는 설계만 완료, 미구현(승인 대기).**

## 원문 좌표 조사 결과 (읽기 전용, 30건)

vieclam24h 상세페이지 30건을 JSON-LD/임베디드 상태(__NEXT_DATA__)/지도 iframe·
링크/data-lat 속성/XHR 응답까지 전부 확인:
- JSON-LD: 30/30 존재하나 geo/GeoCoordinates 필드 없음(0/30).
- 근무지 구조화 데이터(jobDetailHiddenContact.data.places[]): 30/30 존재하나
  province_id/district_id/주소 텍스트만 있고 좌표 필드 자체가 없음.
- **고용주 연락처 좌표**(jobDetailHiddenContact.data.employer_info.{latitude,
  longitude,contact_address}): 스키마는 있으나 30건 중 2건(6.7%)만 값 존재.
  존재하는 2건 모두 Google 지도 독립 대조로 정확함 확인(DOJI ~27m, 식당
  ~17m/~47m). 공고별 근무지 좌표가 아니라 고용주 등록 연락처 주소이므로,
  contact_address와 실제 근무지 텍스트가 일치할 때만 신뢰 가능(실측: 근무지
  2곳인 공고에서 1곳만 일치).
- 지도 iframe/링크/data-lat 속성/XHR 응답: 전부 0/30.

## 코드 변경 (커밋 921283b)

- `geocode.py`: coordinate_accuracy 'exact' → 'exact_candidate'로 개명(전체
  동기화). `source_coordinate_matches_location()` 신규 — 고용주 연락처 주소가
  특정 근무지와 실제로 같은 곳인지 텍스트로 확인.
- `crawl_topcv.py`: `fetch_job_detail()`이 __NEXT_DATA__에서 employer_info
  좌표를 추출. `resolve_work_locations()`에 employer_coordinate 파라미터 추가
  — 일치할 때만 그 근무지에 `source_verified=True` 부여, 좌표를 사이트 자체
  값으로 덮어씀(Geoapify 추정보다 우선).
- `job_quality.py`: `compute_all_locations_verified_exact` →
  `compute_all_locations_c1_verified`로 개명, 판정 기준을
  coordinate_accuracy=='exact'에서 source_verified==True로 강화.
  `gate_auto_publish()` 파라미터도 `all_locations_c1_verified`로 개명.
- VPS 격리 환경 33/33 테스트 통과(job_quality 15 + address_pipeline_integration 18).

## 실측 검증 결과

- **DOJI 공고**(실사례): source_verified=True → active=true, 정확한 사이트
  자체 좌표(21.029196, 105.841676) 사용 — 유일하게 완전 C1로 확정된 사례.
- **OfficeHaus 공고**(고용주 좌표 없음): exact_candidate였지만
  source_verified=False → active=false로 전환(이전 정책이면 발행됐을 케이스 —
  정책이 실제로 강화됐음을 확인).
- **14건 재분류**(100건 조사 C1 11건 + 신규 20건 1건 + 신규 10건 2건):
  DOJI 1건만 완전 C1(active=true), Hàn Thuyên+Hai Bà Trưng 공고는 근무지 1곳만
  source_verified라 전체는 여전히 보류(C1_partial 정책 정상 작동), 나머지
  12건 전부 보류. **잘못된 자동 C1 승격 0건.**
- **완전히 새로운 20건 블라인드 시험**(카테고리 페이지 재크롤로 발견한 신규
  URL, 기존 171건과 전혀 겹치지 않음): **0/20 발행(전부 보류 또는 스킵)** —
  고용주 좌표 존재율(~6.7%)을 감안하면 통계적으로 정상적인 결과. 오탐 0건.
  블랙리스트 필터("Giám Đốc" 직급)도 정상 작동 확인.

## 2차 독립 지오코딩 공급자 — 설계만 완료 (미구현)

Google Geocoding API 도입 설계안을 별도 문서로 전달(비용 통제/캐시 전략/호출
구조 포함). API 키 생성이나 결제 설정은 하지 않았음. 사용자 승인 시에만 구현
착수.

## 발견된 문제

- 완전히 새로운 20건 표본에서는 고용주 좌표를 가진 공고가 0건이었음(6.7%
  기대값에 부합하는 통계적 변동, 이상 아님) — 표본이 더 커지면 일부는 나올 것.
- 로컬 PC에 Python 미설치 — 모든 테스트는 VPS 격리 디렉터리에서 실행.
- 분할 근무시간 파서 수정(이전 라운드)은 여전히 fixture 테스트로만 검증됨 —
  이번 신규 20건에도 분할근무 실사례가 없었음(범위를 넓히지 말라는 지시에
  따라 추가 조사하지 않음).

## 다음 결정사항

- **상태: exact_candidate 강등 + 원문 좌표 검증 정책 IMPLEMENTED → VERIFIED
  (실측 라이브 데이터 포함) → MASTER PUSHED.** Production 배포 대상 아님
  (크롤러는 VPS cron 전용, cron 계속 비활성).
- **운영 재개(cron 활성화) 여전히 비승인** — 이번 정책 하에서는 고용주 좌표가
  있는 극소수 공고만 발행되므로(6.7% 미만), 실질적 커버리지가 매우 낮다는
  점을 사용자가 인지해야 함. 2차 독립 공급자(Google Geocoding API) 도입 여부를
  결정해야 커버리지를 실질적으로 늘릴 수 있음 — 승인 대기.
- 크롤러 cron은 계속 비활성 상태.
- 관리자 대행 등록 설계·추가 UI 개선은 범위 밖으로 유지.
