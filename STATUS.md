# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-10-28 09:37 (VN)**
- 기준 커밋: `3ac783a` (fix: classify FUSHAN source lines and preserve recruitment disclosures (#280))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/40621891314
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 2건**

- 핀 #4824: ❌ 공고 주소에 번지 없음
- 핀 #4824: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 82/82 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `3ac783a` · 상태 **success** · 2026-10-27 17:42 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #280 | 2026-10-27 17:41 (VN) | `3ac783a` | fix: FUSHAN 공고 원문 분류와 중개·업무 미기재 규칙 (Lee 결정 2026-10-27) |
| #279 | 2026-10-27 11:39 (VN) | `1a05b64` | fix: 위치 E2E 공고 등록 권한과 반경 입력 동기화 |
| #277 | 2026-10-27 06:35 (VN) | `70fe1c6` | fix: 위치 원본 단일화와 자동 이관·지도 검증 |
| #276 | 2026-10-27 06:23 (VN) | `2ab3f8f` | ci: 승인된 위치 이관 SQL 한 파일의 해시 검증 경로 |
| #273 | 2026-10-26 13:12 (VN) | `6affdc2` | fix: PC 헤더 버튼 정리와 기업 메뉴 탭 연결 |
| #272 | 2026-10-26 07:35 (VN) | `9ecfbc5` | test: 관리자 새로고침 전 로그인 응답 읽기 (추가 배포 없음) |
| #270 | 2026-10-26 07:24 (VN) | `e60c5a7` | fix: 관리자 URL 탭 기억과 위치 확정 후 스크롤 유지 |
| #269 | 2026-10-26 06:41 (VN) | `6840b46` | fix: 관리자 줄 선택의 R7 위반 OCR 수정 제거 (배포 예외 결정 대기) |
| #268 | 2026-10-26 06:27 (VN) | `436957e` | fix: 관리자 E2E 비공개 시험 데이터의 원문·출처 근거 보완 |
| #267 | 2026-10-26 06:20 (VN) | `122a12b` | fix: 관리자 실제 E2E 의존성·DB 생성 ID·비공개 승인 시험 복구 |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **4건** (전체 7건, 숨김·비활성 3건)
- 출처별: muaban 2 · manual 2

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | VietMap 재확인 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|---|
| #4824 | 2026-10-26 06:52 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-10-25 | 1 | 2026-10-25 12:58 (VN) |
| 2026-10-24 | 2 | 2026-10-24 08:47 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-10-27 17:42 (VN) | location_candidate.approve | job 4979 |
| 2026-10-27 17:42 (VN) | location_candidate.add | job 4979 |
| 2026-10-27 11:42 (VN) | location_candidate.approve | job 4977 |
| 2026-10-27 11:42 (VN) | location_candidate.add | job 4977 |
| 2026-10-27 11:41 (VN) | location_candidate.approve | job 4975 |
| 2026-10-27 11:41 (VN) | location_candidate.add | job 4975 |
| 2026-10-27 06:33 (VN) | location_candidate.approve | job 4970 |
| 2026-10-27 06:33 (VN) | location_candidate.auto_reuse | job 4971 |
| 2026-10-27 06:33 (VN) | location_candidate.add | job 4970 |
| 2026-10-26 13:24 (VN) | location_candidate.auto_reuse | job 4968 |

## 8. 검증 장치 변경 이력

이 파일을 만드는 스크립트·워크플로가 바뀌면 여기에 나온다. 7일 이내 변경이 있으면 Lee가 직접 확인한다.

- 2026-10-13 22:53 (VN) `f3a843f` db: 채용공고 규칙 표 + 자동 차단 장치 (R1~R5) (#60)
- 2026-10-11 12:07 (VN) `aa34f5f` fix(status): 생성기에서 빠진 VietMap 호출 수·관리자 기록 조회 복구 + 생성기 전체 실행 점검을 PR 검사에 추가
- 2026-10-11 12:04 (VN) `d54d7dd` feat(status): VietMap 재확인을 사이트 서버(api/status-recheck)로 — GitHub OIDC 인증, 키 추가 등록 불필요
- 2026-10-11 11:26 (VN) `862591c` fix(status): GPT 교차 검증 반영 — 배포 대기 조회 오류 내성, VietMap 재확인 추가, DB 트리거 초안 보류
- 2026-10-11 11:21 (VN) `8c6f26a` fix(status): 배포 완료 대기 후 기록, 검증 장치 변경은 '검증장치-승인' 라벨 필수 + 근거 없는 승인 차단 SQL 초안(미적용)

## 9. 공고 규칙 시험 결과 (DB 규칙 표 직접 조회)

규칙 표의 마지막시험 칸은 Actions의 자동 시험(supabase/tests/job_posting_rules_test.sql)만 채운다. 말로 하는 "완료" 보고는 인정하지 않는다.

| 규칙 | 차단방식 | 마지막시험 | 결과 |
|---|---|---|---|
| `R1_phone_digits_only` | 없음 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `R2_decision_columns_code_only` | 없음 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `R2b_publish_gate_reason_code_only` | 없음 | — | — 시험 없음 |
| `R3_source_evidence_required` | 저장거부 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `R5_verbatim_names` | 저장거부 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `R6_age_preserved` | 저장거부 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `R4_policy_exclusion_trigger` | 저장거부 | — | — 시험 없음 |
| `R7_ocr_crosscheck` | 보류 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `U1_industrial_park_pin_publish` | 없음 | — | — 시험 없음 |
| `U2_age_min_under_15` | 없음 | 2026-10-25 12:57 (VN) | ✅ 통과 |
| `R8_publication_requires_original_evidence` | 보류 | — | — 시험 없음 |
| `L1_single_location_source` | 저장거부 | — | — 시험 없음 |
| `L2_single_location_writer` | 저장거부 | — | — 시험 없음 |
| `L3_derived_location_cache` | 저장거부 | — | — 시험 없음 |
| `L4_data_independent_location_tests` | 없음 | — | — 시험 없음 |

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **0건** · OCR 불일치 보류: **0건**
