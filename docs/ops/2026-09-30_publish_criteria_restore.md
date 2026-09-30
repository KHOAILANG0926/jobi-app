# 공고 공개 기준 — 기존 기준 복원 표 (2026-09-30, 읽기 전용 조사)

목적: 공개 체크리스트를 새로 정하기 전에 **이미 확정·구현된 기준**을 근거와 함께 복원한다.
표시: **확정** = 사용자 지시 기록(커밋/문서) 있음 · **구현** = 코드/DB가 강제 · **미확인** = 근거 못 찾음.
이 문서의 "후보 항목"은 제안이며 확정 규칙이 아니다.

## 1. 기존 공개 게이트 (핵심 발견)

`crawler/job_quality.py` `gate_auto_publish()` — 커밋 `b4bfc08`(2026-09-05, "최종 제품 정책 반영"), 사용자 지시로 기록됨.

> 공개 가능 = 유효한 원문 공고 AND 유효한 지원 경로 AND 근무지 또는 모집지역 정보가 하나 이상 존재.
> 좌표 검증은 공개 여부를 막지 않는다 — 지도 표시·거리검색·길찾기 자격만 결정한다.
> 성·시만 있는 위치, 구·군·동만 있는 위치도 공개. 위치 정보가 0건일 때만 `no_address_text`.

- 결과 코드: `ok` / `no_address_text` / `no_application_path` (DB `publish_gate_reason`).
- 게이트 실패 공고는 버리지 않고 `active=false`로 저장·재판정.
- **상세 주소 없을 때의 공개 기준은 이것이 기존 확정안으로 보인다**(사용자가 "일전에 정한 것"이라고 한 항목 후보 — 확인 필요).

## 2. 항목별 복원 표

| 항목 | 기존 기준 | 근거 | 상태 |
|---|---|---|---|
| 지원 경로 | 전화·Zalo 있으면 충분. 원문 URL만 있으면 원문 페이지 유효 + 지원 버튼 존재 시 인정 | job_quality.py `has_application_path()` | 확정·구현(09-05) |
| 지원 경로(변경) | 외부 원문 링크는 지원 경로로 인정 안 함, 사이트 안 연락처만 | docs/ops/2026-09-29_hide_crawled_no_contact.md, CLAUDE.md 48행~(df8524c) | 확정(09-29/30). **게이트 코드엔 미반영 — 충돌** |
| 근무 위치 | 근무지 또는 모집지역 1개 이상이면 공개(성·시 수준 포함) | `gate_auto_publish()` b4bfc08 | 확정·구현(TopCV/vieclam24h 경로) |
| 좌표 | 공개와 무관. 지도·거리·길찾기는 확인된 근무지만 | job_quality.py `compute_all_locations_c1_verified()` 주석, src/lib/jobCoords.ts | 확정·구현 |
| 지역 중심 좌표 대체 | 금지 | jobCoords.ts + 테스트, b1b09d4 | 구현. 문서 규칙(CLAUDE.md)은 없음 |
| 마감일 지남 | 수집 시 거부 + 매일 cron으로 active=false | `validate_job_payload()` is_expired, cron `deactivate-expired-jobs-daily` | 확정·구현 |
| 마감일 미기재 | 저장·공개 허용(검사 없음) | `is_expired()` 빈 값 → False | 구현(명시적 결정 기록은 미확인) |
| 회사명 | 2자 미만이면 저장 거부. 실재·게시자 관계 확인은 없음 | `validate_job_payload()` | 구현(형식만) |
| 금융·추심 공고 | 제외 | `classify_money_job_exclusion()` | 구현 |
| 관리자 숨김 | admin_hidden=true는 크롤러가 되돌리지 않음 | crawl_topcv.py:2115-2130 | 구현 |
| 공개 조회 | active AND NOT admin_hidden | migration 0019 RLS | 구현 |
| 검증 대기 기간·기한 후 삭제 | — | 저장소·문서에서 못 찾음 | 미확인 |
| 중복·허위 의심·원문 삭제 | 중복은 canonical_job_key(제목+회사)로 재수집 시 갱신. 허위·원문 삭제 규칙 없음 | job_quality.py `canonical_job_key()` | 중복만 구현 |
| 게스트 공고 마감 | 기본 7일 | 게스트 등록 기본값 | 구현(크롤링과 무관) |

## 3. 발견된 구멍

1. **Facebook 크롤러는 공개 게이트를 거치지 않는다** — `crawler/crawl_facebook.py:1070` `"active": True` 고정, `publish_gate_reason` 없음. 4682가 회사·근무지 확인 없이 공개된 경로.
2. 지원 경로 기준 충돌 — 게이트는 원문 URL을 지원 경로로 인정, 09-29/30 결정은 불인정. 그래서 124건이 게이트 `ok`인데도 수동 숨김이 필요했다.

## 4. Production 현황 (읽기 전용 조회, 2026-09-30)

| origin | active | admin_hidden | gate | 출처 | 건수 |
|---|---|---|---|---|---|
| crawler | false | false | ok | 기타 | 147 |
| crawler | true | true | ok | 기타 | 119 |
| crawler | false | true | ok | 기타 | 10 |
| crawler | false | false | no_address_text | 기타 | 4 |
| crawler | false | true | no_address_text | 기타 | 1 |
| crawler | true | false | (null) | facebook | 1 (4682) |

## 5. 체크리스트 후보 항목 (제안 — 미확정)

기존 게이트 3항목(원문 유효 · 지원 경로 · 위치/모집지역)을 뼈대로 두고, 아래만 결정하면 된다.

1. 지원 경로 정의를 "사이트 안 연락처(전화·Zalo)만"으로 게이트에 반영할지 (09-29/30 결정과 맞추기)
2. 채용 주체(회사·게시자 관계) 확인을 게이트 항목으로 추가할지 — 추가 시 Facebook 공고 대부분 해당
3. 마감일 미기재 공고 처리
4. 게이트를 Facebook 크롤러에도 적용 (구멍 1 해소 — 기존 기준의 적용 누락이므로 새 정책 아님)
5. 게이트 실패 공고의 대기 기한·종료 처리 (기존 기준 없음)
