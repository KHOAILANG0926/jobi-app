# 크롤러 작업 현황 (Work Status)

이 문서는 실제로 실행되고 검증된 크롤 작업 이력을 날짜·대상 ID 범위별로
기록한다. 기준 자체는 [`CRAWLER_BASELINE.md`](CRAWLER_BASELINE.md), 오류
수정 근거는 [`CRAWLER_FIX_HISTORY.md`](CRAWLER_FIX_HISTORY.md) 참고.

## 현재 지시 사항 (가장 중요 — 다음 작업자는 먼저 확인할 것)

**추가 크롤링 중단. 재개 지시 전 실행 금지.** (사용자 지시, 2026-09-08)
`--confirm-full-crawl`을 쓰는 어떤 명령도(vieclam24h/VietnamWorks 모두)
사용자의 명시적 재개 지시 없이 실행하지 않는다.

---

## 1. Vieclam24h 실행 이력

같은 소스(`[source:vieclam24h]`)에 대해 서로 다른 시점에 서로 다른 방식으로
누적됐다 — **건수를 합산해서 보고할 때 반드시 아래 3단계를 구분해서 인용
한다** (합산한 숫자만 보면 어느 배치가 언제 무엇을 했는지 알 수 없다).

| 단계 | 날짜 | job_id 범위 | 신규 | 비고 |
|---|---|---|---|---|
| 1. 초기 검증 | 2026-09-08 (커밋 [`8df0f46`](https://github.com/KHOAILANG0926/jobi-app/commit/8df0f46) 이후, [`fd9df33`](https://github.com/KHOAILANG0926/jobi-app/commit/fd9df33) 이전 — 이 작업 자체는 코드 변경이 없어 전용 커밋 없음) | 4602~4604 | 3건 | "20개만 크롤링해 검증" 지시 — 반복 실행 시 동일 후보만 재방문하는 문제(`CRAWLER_FIX_HISTORY.md` §7)로 실제 신규는 3건만 확보됨 |
| 2. `--sample-offset` 도입 | 2026-09-08 07:11 (커밋 `fd9df33`) | 4605~4612 | 8건 | offset 0(신규 0/업데이트 10) + offset 10(신규 8/업데이트 2) 두 배치 |
| 3. 추가 수집(12건 목표 → 13건 실수집) | 2026-09-08 (커밋 `fd9df33` 이후, [`8b432e8`](https://github.com/KHOAILANG0926/jobi-app/commit/8b432e8) 이전) | 4613~4625 | 13건 | offset 20(신규 1)+30(신규 7)+40(신규 5), 배치 단위(10건씩)라 목표 12건을 1건 초과 |

**혼동 금지**: 사용자가 "신규 공고는 이미 21건 확보했다"고 언급한 수치는
**2단계 + 3단계의 합(8+13=21, job_id 4605~4625)만을 가리킨다** — 1단계의
3건(4602~4604)은 별도 이력이며 21건에 포함되지 않는다. 전체 세 단계를 합친
vieclam24h 신규 총량은 **24건**(4602~4625, 연속된 ID 범위)이다.

### 1-1. pending 좌표 후속 처리 (2026-09-08)

- job_id 4613~4625의 `job_work_locations` 중 `pending` 11건을
  `regeocode_work_locations.py --apply`로 재지오코딩 — 최종 `success` 5건
  / `manual` 1건 / `failed` 5건으로 확정, `pending` 0건.
- 좌표-지역 일치: `success` 5건 전부 DB 검사로 지리적 타당성 확인
  (예: Tân Bình→TP.HCM, Văn Giang→Hưng Yên, Mỹ Tho→Tiền Giang, Nghĩa
  Đàn→Nghệ An, Tân An→Long An).

### 1-2. 기존 공고 17건 필드 변경 감사 (2026-09-08, DB 조회로만 확인 — 브라우저 검증 아님)

3단계 배치(offset 20/30/40)가 업데이트한 기존 공고 17건(`job_id` 4400,
4402, 4407~4415, 4417, 4419, 4420, 4422, 4423, 4427)을 `last_verified_at`
타임스탬프로 특정해 감사:

- 코드 구조상 `compute_job_updates()`가 건드릴 수 있는 필드는
  `UPDATE_TRACKED_FIELDS`(salary/application_deadline/description/
  location/source_url/preference/education/work_period/num_hires/hours/
  work_days/recruitment_regions)로 고정돼 있어 `title`/`company`/`id`는
  구조적으로 변경 불가.
- 17건 전부 필수 필드(title/company/source_url/posted_at) 정상, 16건은
  `active=true`/`gate=ok` 유지, 1건(`job_id=4420`)만 `active=false`/
  `gate=no_address_text`로 전환 — 해당 행은 `job_work_locations` 0행이라
  "주소 텍스트 없음" 정상 판정에 의한 정당한 강등으로 판단됨(데이터 손상
  아님, 복구 조치 없음).

### 1-3. 21건(4605~4625) 운영 사이트 표시 검증 (2026-09-08)

- **DB 검사**: 21건 전수 — 필수 필드 누락 0건, `job_work_locations` 누락
  0건, `source_url` 중복 0건(전체 vieclam24h 237건 기준).
- **브라우저 확인(전수, 텍스트 수준)**: 21건 모두
  `https://viecganban.vn/viec-lam/sb-{id}` 접근 성공, 화면 표시된
  제목·회사·근무지 텍스트가 DB 값과 일치함을 `get_page_text`로 확인.
- **브라우저 확인(대표 5건, 지도)**: `success` 2건(4613/4619), `region_only`
  1건(4607), `manual` 1건(4616), `failed` 1건(4609)을 선정해, **Leaflet
  타일 URL의 z/x/y 좌표를 z/x/y→lat/lng 공식으로 역산**해 지도 중심이 DB
  좌표와 실제로 일치하는지 확인했다. **이 방식은 지도 타일의 중심 좌표
  정합성만 확인한 것이며, 실제 화면 스크린샷을 육안으로 본 것이 아니다**
  — 해당 세션에서 브라우저 미리보기 창이 계속 백그라운드(hidden) 상태여서
  스크린샷 렌더링이 되지 않았고, 이를 문서에도 명시적으로 남겼다. 건물
  단위 정확도를 육안으로 확인한 것은 아니다.
- **콘솔 오류**: 4605/4609/4616 등 여러 페이지에서 동일하게 재현되는 404
  에러 2건 확인 — 회사 로고 이미지를 직접 fetch로 200 확인해 배제했고,
  Google 광고 관련 리소스로 추정(사이트 전역 현상, 이번 작업이 원인이
  아님). 공고별 개별 콘솔 오류는 발견되지 않음.

---

## 2. VietnamWorks 실행 이력

| 항목 | 값 |
|---|---|
| 실행일 | 2026-09-08 (커밋 [`0458bf3`](https://github.com/KHOAILANG0926/jobi-app/commit/0458bf3)) |
| job_id 범위 | 4627~4646 (20건) |
| 참고 | `job_id=4626`은 캐너리 실행 중 타이밍 버그(`CRAWLER_FIX_HISTORY.md` §8)로 근무지 없이 저장됐다가 버그 수정 후 삭제 — 그래서 실제 20건은 4626을 건너뛴 4627부터 시작한다(연속 ID 아님, 데이터 누락 아님) |
| `job_work_locations` 총 행수 | 26행 |
| 최종 상태 분포 | `success` 11 / `manual` 2 / `failed` 13 / `pending` 0 |

### 2-1. 검증 방법 구분

- **자동 테스트(오프라인)**: `test_cli_safety.py` 21/21, `test_job_quality.py`
  18/18, `test_vietnamworks_extraction.py`(신규) 8/8, `test_address_
  pipeline_integration.py` 54/54, `test_regeocode_work_locations.py`
  11/11, `test_geocode.py` 6/6 — 순수 함수/CLI 인자 검증만, 실제 브라우저
  네트워크 경로는 포함하지 않음.
- **DB 검사**: 20건 전수 — 필수 필드 누락 0건, `source_url` 중복 0건,
  `job_work_locations` 누락 0건(모든 job_id에 최소 1행). `success` 11행
  전부 좌표-지역 일치를 DB 조회로 확인(예: Gia Lâm→Hà Nội, Hòn Tre→Khánh
  Hòa, Cần Giờ→Hồ Chí Minh, Cà Mau→Cà Mau).
- **브라우저 확인(대표 3건)**: `job_id` 4627(단일 주소)/4636(다중 근무지
  3곳 완전 일치)/4643(제목-필드 불일치, "Bạc Liêu" 임의 추가 없음)을
  `get_page_text`로 확인 — 이번 세션은 브라우저 미리보기 창이 정상
  렌더링돼 실제 페이지 텍스트를 직접 읽었다(1-3과 달리 타일 좌표 역산은
  하지 않았음 — 필요하지 않았음). **다만 이 확인도 화면 텍스트 대조이지,
  지도 마커의 정확한 화면 위치를 스크린샷으로 육안 확인한 것은 아니다.**
  콘솔 확인 결과 1-3과 동일한 site-wide 404 2건 외 추가 오류 없음.

### 2-2. 실측 발견·수정 버그

VietnamWorks 상세페이지 단계적 렌더링으로 인한 근무지 누락 —
[`CRAWLER_FIX_HISTORY.md` #8](CRAWLER_FIX_HISTORY.md#fix8) 참고.

---

## 3. 미확인 항목 (다음 작업자가 필요 시 확인)

- **Facebook 크롤러 로그인/쿠키 상태**: 이번 2일간 작업(vieclam24h/
  VietnamWorks)에서 Facebook 크롤러 경로는 전혀 건드리거나 확인하지
  않았다. `crawler/README.md`에 쿠키 갱신 절차는 있으나 현재 유효
  여부는 미확인.
- **`job_id=4643`의 "Bạc Liêu" 별도 근거가 실제로 검토됐는지**: 코드
  동작 자체(로그 출력만, DB 미저장)는 확인됐다(`CRAWLER_BASELINE.md` §2/§9).
  이 로그 라인이 실제로 사람에 의해 열람·판단됐는지는 별도 확인 대상이며
  이 문서 작성 시점까지 그 기록은 없다.
- **정기 수집 일정(cron/GitHub Actions)의 현재 활성 여부**: `crawler/
  README.md`에 crontab 설정 절차는 있으나, 이 2일간 작업 중 VPS의 실제
  crontab 가동 여부를 조회·확인한 기록은 없다 — **미확인으로 남긴다**
  (이번 문서화 작업 범위에서 새로 조회하지 않음).
- **`§1-2`(기존 5건 근무지 0행 복구, `CRAWLER_FIX_HISTORY.md` #2의 남은
  한계 항목)**: `job_id` 4390/4474/4478/4512/4572가 실제로 복구됐는지는
  이 문서 작성에 쓰인 자료만으로는 확인되지 않는다.
- **`JobDetail.tsx` 캡션 문구와 거리검색 실제 포함 여부의 불일치**
  (`CRAWLER_BASELINE.md` §7 "주의" 문단): 조사만 됐고 수정 필요 여부·
  일정은 미정.
