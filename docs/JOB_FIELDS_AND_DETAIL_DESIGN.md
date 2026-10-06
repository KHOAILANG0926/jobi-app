# 공고 항목 설계 + 상세 화면 개편안 (초안 — 사용자 결정 대기, 코드·DB 변경 없음)

작성: 2026-10-06. 조사 기준: master `522643e`, Production DB(local_jobs 282건, 활성 24건 중 공개 0~1건), `JobDetail.tsx` 813줄.
원칙: 알바몬 구조(상단 구조화 항목 + 하단 상세요강)를 따르되, 기존 설계·승인 체계(8d30c0d 등)를 새로 만들지 않고 붙인다. 모르는 값은 **빈 값 유지**(가짜 값·추정 채우기 금지, crawler도 원문이 구조화해 준 값만).

## 1. 현재 상태

`local_jobs` 컬럼 54개 — 기본(title, company, category, subcategory, location, description, posted_at, application_deadline, urgent, active, admin_hidden, origin, source), 급여(salary text, salary_min/max/currency/period/negotiable), 근무(hours, work_period, work_days, job_duration, shift_type, work_start_time/work_end_time, work_schedule, weekend_work, immediate_start), 복리(shuttle_bus, dormitory, meal_provided, labor_contract_pledge, social_insurance_pledge), 모집(num_hires, education, preference, gender_requirement, age_requirement, recruitment_type), 연락(employer_phone), 신뢰(company_verified, company_founded_year, hire_count, last_verified_at, publish_gate_reason), 위치(lat, lng, recruitment_regions), 기타(image_url, images, source_url(비공개), crawler_version, employer_id, guest_manage_token).
근무지는 `job_work_locations`(raw_address, province/district/ward, lat/lng, coordinate_accuracy, location_verified, address_accuracy, geocode_status …) + `job_location_candidates`(승인 좌표).

`JobDetail`이 쓰는 필드: title, company, category(+subcategory 라벨), imageUrl, urgent, postedAt, rawSalary, rawLocation, hours, workPeriod, workDays, numHires, rawEducation, rawPreference, applicationDeadline, description, images, employerPhone(+zalo 링크는 전화번호로 생성), employerId, workLocations(+approvedPoint), recruitmentRegions, hireCount, companyFoundedYear, companyVerified, laborContractPledge, socialInsurancePledge.
**DB에는 있는데 화면 타입·select에 없는 것**: salary_min/max/period/negotiable(237건 채워짐), last_verified_at(281건), shift_type·work_start/end_time·shuttle_bus·dormitory·meal_provided·recruitment_type·work_schedule·weekend_work·immediate_start는 타입엔 있으나 Production 값은 shift_type 16건뿐, 나머지 0건(직접 등록 공고만 채움).

## 2. 항목별 현황 (채움 = 전체 282건 중)

| 구분 | 항목 | 상태 | 비고 |
|---|---|---|---|
| 신뢰 | 연락처 유무 | 파생 가능(없음→컬럼 불필요) | employer_phone 1건뿐 → 거의 전부 "연락처 없음" |
| 신뢰 | 근무지 승인 수준 | 있음 | approvedPoint(entrance/building/site) + location_verified + coordinate_accuracy |
| 신뢰 | 채용 주체(직접/중개/불명) | 컬럼 있음 `recruitment_type` | 채움 0건, 화면 미사용 |
| 신뢰 | 자동 확인일 | 컬럼 있음 `last_verified_at` | 281건, 화면 미노출 |
| 급여 | 형태(시급/일급/월급/협의) | 있음(값은 월급뿐) | salary_period 제약이 hour/day/month/other 허용, 실제 값은 'month'만(237건). 협의 salary_negotiable 36건 → DDL 불필요, crawler 값 매핑만 |
| 급여 | 금액 범위 | 있음 | salary_min/max 237건(화면 미노출, 화면은 salary 문자열) |
| 급여 | 기본급/총수입(잔업 포함) | **없음(추가)** | |
| 급여 | 메모 | **없음(추가)** | 문자열 salary에 섞여 있음 |
| 근무 | 기간 | 있음(빈 값) | job_duration 0건 |
| 근무 | 요일 | 있음 | work_days 26건, work_schedule 0건 |
| 근무 | 시간 | 있음 | hours 47건, work_start/end_time 13건 |
| 근무 | 교대(주간/야간/2교대/3교대) | 부분 | shift_type = day/night/rotating/other(16건). 2교대·3교대 구분 없음 |
| 근무 | 고용형태(정규/thời vụ/파트타임) | 부분 | work_period 문자열 257건("Toàn thời gian cố định/tạm thời", "Bán thời gian…"), 구조화 값 없음 |
| 업직종 | 13개 대분류 + 소분류 | 있음 | subcategory 159건. 생산직 세분화는 `san_xuat_xay_dung` 소분류 14개로 이미 존재(생산·가공·조립 / 포장·검사(QC) / 입출고·창고 / 지게차 / 설비 유지보수 / 건설 현장 …). **QC 단독·단순노무 없음** |
| 복리 | 통근버스·기숙사·식사 | 컬럼 있음 | 3개 모두 0건 |
| 복리 | BHXH 등 태그 | 부분 | social_insurance_pledge(자가서약, 0건). 설명 본문에 BHXH 언급 211건(언급 ≠ 제공 확인) → 상세 화면이 본문 문구로 칩을 만듦. 기타 태그(thưởng·tăng ca…) 컬럼 없음 |
| 모집 | 마감일 | 있음 | 281건 |
| 모집 | 인원·학력·우대 | 있음 | num_hires 257, education 179, preference 257 |
| 모집 | 나이·성별 | 컬럼 있음 | 0건(원문에 구조화 필드 없음) |
| 모집 | 필요 서류 | **없음(추가)** | |
| 근무지 | 주소 | 있음 | job_work_locations 493행 |
| 근무지 | KCN 이름 | **없음(추가)** | 주소 문자열 안에만 있음 |
| 근무지 | 통근버스 노선 | **없음(추가)** | shuttle_bus 불리언만 있음 |
| 연락 | 전화 | 있음 | 1건 |
| 연락 | Zalo | **없음** | 타입에 zalo가 있으나 DB 컬럼 없음 → 항상 비어 있음(Zalo 링크는 전화번호로 생성) |

## 3. 스키마 변경안 (DDL — 실행하지 않음, STRICT)

전부 nullable·default 없음·**backfill 없음**(기존 공고는 그대로 빈 값). crawler/등록 화면이 원문이 준 값만 채움. 순수 additive.

```sql
-- local_jobs
alter table public.local_jobs
  add column salary_basis text check (salary_basis in ('base','total_with_overtime')),   -- 기본급 / 총수입(잔업 포함)
  add column salary_note text,                                                          -- 급여 메모(상여·수당 조건 등)
  add column employment_type text check (employment_type in ('full_time','seasonal','part_time')), -- 정규/thời vụ/파트타임
  add column rotating_shifts smallint check (rotating_shifts in (2,3)),                 -- shift_type='rotating'일 때 2교대/3교대
  add column benefit_tags text[],                                                       -- 원문 복리후생 섹션에서 추출한 태그(thưởng, tăng ca, BHXH 제공 확인 등)
  add column required_documents text,                                                   -- 필요 서류
  add column contact_zalo text;                                                         -- Zalo 번호(없으면 null)

-- job_work_locations (근무지별)
alter table public.job_work_locations
  add column industrial_park text,                                                      -- KCN 이름
  add column shuttle_route text;                                                        -- 통근버스 노선
```
- 시급·일급 급여형태: DDL 불필요(`salary_period` 제약이 이미 hour/day/month/other 허용, 2026-10-06 DB에서 확인).
- 업직종 세분화는 DDL 없음: `subcategory`는 자유 텍스트 → `src/data/subcategories.ts` + `crawler/classifier.py`(SUBCATEGORY_LABELS)에 `qc_kiem_dinh`, `lao_dong_pho_thong` 추가(코드 변경).
- 보류 가능: employment_type은 기존 `work_period` 문자열 값(Toàn thời gian cố định 등)에서 결정적으로 매핑할 수 있으므로, 기존 공고에 한해 별도 승인 후 매핑할지 결정(자동 backfill 안 함).
- 화면에 필요한 기존 컬럼 노출(salary_min/max/period/negotiable, last_verified_at, recruitment_type, shift_type 등)은 select·타입 확장만(DDL 없음).

## 4. 상세 화면 개편안 (알바몬 구조)

```
┌ 헤더: [회사 로고/이니셜] 회사명 · 제목 · [D-3] [Tuyển gấp]
│ 급여(크게, 강조색)  ← salary_min~max 또는 salary 문자열 + 기본급/총수입 배지 + 메모
│ 태그: [Xe đưa đón] [Ký túc xá] [Bao ăn] [BHXH] [Làm ngay] (값이 true/확인된 것만)
│ ⚠ 한 줄: "Việc Gần Bạn không thu phí. Cẩn thận nếu bị yêu cầu đặt cọc/OTP/chuyển tiền."
├ 탭(sticky): [Điều kiện làm việc] [Mô tả công việc] [Thông tin công ty]  ← 클릭 시 해당 구역으로 스크롤, 스크롤하면 현재 구역 강조
├ ① 근무조건: 급여 · 기간 · 요일 · 시간 · 교대 · 고용형태 · 주말근무
├ ② 모집조건: 마감일(D-day) · 인원 · 학력 · 나이·성별 · 우대사항 · 필요 서류
├ ③ 근무지역: 주소 · KCN · 통근버스 노선 · 지도(승인 좌표만) · "위치 확인됨/미확인" 한 줄
├ ④ 상세요강: 설명(Mô tả / Yêu cầu / Quyền lợi 카드)
├ ⑤ 기업정보(탭 3): 같은 회사 다른 공고 · 근무지 목록 · 확인 상태 (아래 5번)
└ 하단 고정 바: [Gọi] [Zalo] [Ứng tuyển/Xem cách liên hệ]
```
- **탭은 내용을 숨기지 않는다**: 한 페이지에 ①~⑤를 이어서 보여주고(현재의 `hidden` 탭 패널 제거 — SSR/크롤러에도 전부 노출됨), 탭 클릭은 `scrollIntoView`, 스크롤 위치로 활성 탭 갱신(IntersectionObserver), 탭 바는 sticky.
- **연락처 없을 때**(지금 거의 전부): Gọi/Zalo 버튼은 렌더링하지 않고 하단 바에는 "Chưa có thông tin liên hệ"(비활성) 한 줄 + 상세요강 안의 연락 안내(원문 내 연락 정보가 있으면 텍스트로만, **원본 사이트 링크 금지**).
- **근무지 미승인일 때**: 지도 대신 주소 텍스트 + "Vị trí chưa được xác minh" 한 줄. 길찾기는 entrance 승인만(기존 규칙 유지). 승인되면 지도 핀.
- **기업정보 구역(회사 단위)**: `companyKeyFromName`(이미 `reviewsStorage.ts`에 있음)으로 같은 회사 공고를 묶어 ① 다른 공고 목록 ② 근무지 목록(주소·확인 상태: 승인/미확인) ③ 확인 상태 요약(공고 N건 중 근무지 승인 M건, 마지막 확인일)을 표시. 현재 "이 기업이 등록한 공고 수"는 employer_id가 있는 직접 등록 공고만 집계 → 수집 공고는 회사명 기준 집계로 확장(회사명이 같아도 지점이 다를 수 있으므로 근무지·지점은 따로 보여 주고 회사를 확정하지 않음).
- 경고 문구: 현재 4줄 박스 → 헤더 아래 1줄.

## 5. 즉시 수정 대상 2건 — 원인 확인 (수정 안 함)

1. **회사 로고 자리에 수집 출처(vieclam24h) 로고가 나옴**: `image_url` 244건이 전부 `cdn1.vieclam24h.vn`(출처 CDN)이고, 그 중 **21개 회사(공고 21건)가 vieclam24h 기본 이미지 `vieclam24h_logo_customer_default.jpg`**(회사가 로고를 올리지 않았을 때 사이트가 넣는 자기 로고). `crawler/crawl_topcv.py:1227`이 목록 카드의 logoUrl을 걸러내지 않고 저장하고, `JobDetail.tsx:372`가 `job.imageUrl`을 그대로 `<img>`로 그린다(목록 카드는 facebook만 제외). → 출처 사이트 홍보 금지 원칙 위반. 수정 방향: crawler에서 기본 이미지(`…customer_default…`)는 저장하지 않고, 화면에서도 출처 CDN 기본 이미지는 이니셜 폴백. (참고: 나머지 223건은 실제 회사 로고이나 출처 CDN 핫링크 — 별도 결정 필요.) 기존 21건은 Production DB 수정이므로 별도 승인.
2. **회계 공고가 "Dịch vụ"로 분류됨**: `crawler/classifier.py` `classify()`가 제목+**회사명**+설명 앞 300자를 합쳐 배달→청소→카페→식당 규칙을 사무 규칙보다 먼저 검사한다. 실제 사례: #4680 "Kế Toán Tổng Hợp" — 회사명 "…Phát Triển **Dịch Vụ Nhất** Long"이 청소 규칙 `dich vu nha`(단어 경계 없음)에 걸려 `cleaning`→`dich_vu`. 같은 원인으로 "Kế Toán Kho"(회사 "Americano **Coffee**")가 `cafe`→`am_thuc_do_uong`. 제목만으로는 모두 `office`(van_phong)로 정확히 분류됨. 수정 방향: 제목에 명확한 직무 신호(kế toán 등)가 있으면 회사명으로 우선순위를 뒤집지 않기 + `dich vu nha`에 단어 경계. 기존 잘못 분류된 공고 재분류는 Production DB 수정이므로 별도 승인.

## 6. 결정 필요

1. DDL 범위(3번: local_jobs 7개 + job_work_locations 2개 컬럼) 승인 여부.
2. 화면 노출: salary_min/max·last_verified_at 등 기존 컬럼을 이번에 화면에 연결할지.
3. 출처 CDN 로고: 기본 이미지만 막을지, 회사 로고 핫링크 전체를 막고 이니셜/직접 업로드로 갈지.
4. 기업정보의 "같은 회사" 판정을 회사명 정규화로 시작할지.
5. 즉시 수정 2건을 상세 개편과 분리해 먼저 처리할지.
