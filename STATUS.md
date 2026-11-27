# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-27 23:53 (VN)**
- 기준 커밋: `efdaeba` (chore(ocr): 대표 이미지 배정 로그에 건너뜀 이유 건수 추가 (#1189))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/46037196839
- 검증 스크립트 지문(SHA-256): `a7387291a9c75cc7`

## 한눈에 보기

**확인 필요 28건**

- 핀 #4824: ❌ 공고 주소에 번지 없음
- 핀 #4824: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #4878: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #4878: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5368: ❌ 공고 주소에 번지 없음
- 핀 #5368: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5438: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #5438: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #4982: ❌ 공고 주소에 번지 없음
- 핀 #4982: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5231: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #5231: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5405: ❌ 공고 주소에 번지 없음
- 핀 #5405: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5505: ❌ 공고 주소에 번지 없음
- 핀 #5505: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5599: ❌ 공고 주소에 번지 없음
- 핀 #5599: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5422: ❌ 공고 주소에 번지 없음
- 핀 #5422: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 검증 장치가 최근 바뀜 (2c4f399)
- 규칙 시험 실패: R1_phone_digits_only
- 규칙 시험 실패: R2_decision_columns_code_only
- 규칙 시험 실패: R3_source_evidence_required
- 규칙 시험 실패: R5_verbatim_names
- 규칙 시험 실패: R6_age_preserved
- 규칙 시험 실패: R7_ocr_crosscheck
- 규칙 시험 실패: U2_age_min_under_15

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 150/150 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `efdaeba` · 상태 **success** · 2026-11-27 23:51 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #1189 | 2026-11-27 23:51 (VN) | `efdaeba` | chore(ocr): 대표 이미지 배정 로그에 건너뜀 이유 건수 추가 |
| #1187 | 2026-11-27 23:48 (VN) | `3efe826` | feat(photo): 추가 이미지 16장 이미지 목록 등록 |
| #1185 | 2026-11-27 23:37 (VN) | `1fad83f` | feat(photo): 대표 이미지 고정 배정 + 카드·앱 화면 연동 (3단계) |
| #1184 | 2026-11-27 23:26 (VN) | `bfa3659` | ops(e2e): 고용주·구직자 실제 로그인 시험 — 대표 가입 없이 일회용 시험 계정 생성·삭제 (#701 D) |
| #1181 | 2026-11-27 23:09 (VN) | `5beba48` | feat(photo): 전달 이미지 ZIP 23장을 이미지 목록(manifest)에 등록 (#1180 연동, Draft) |
| #1180 | 2026-11-27 22:59 (VN) | `852f798` | feat(photo): 직무 중심 대표 이미지 선택 + 이미지 목록 (설계 2단계, Draft) |
| #1182 | 2026-11-27 22:58 (VN) | `2f094fa` | feat(db): 대표 이미지 고정 배정 칸 representative_image_id (대표 Approve 대상) |
| #1183 | 2026-11-27 22:48 (VN) | `3f549fd` | docs: HANDOFF·WORK_LOG — 직무 중심 분류·대표 이미지 1·2단계 |
| #1179 | 2026-11-27 22:39 (VN) | `77acd04` | feat(roles): 복수 직무 공고를 모든 모집 직무로 검색 — category·공식 코드 유지 (설계 1단계, Draft) |
| #1175 | 2026-11-27 17:29 (VN) | `2ce49c0` | fix(home): Theo vị trí 공고가 원문 급여 금액이 있으면 메인 목록에서 빠지지 않게 (#1168 후속) |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **30건** (전체 57건, 숨김·비활성 27건)
- 출처별: 출처 없음 26 · muaban 2 · manual 1 · Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김 1

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | VietMap 재확인 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|---|
| #4824 | 2026-10-26 06:52 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #4878 | 2026-10-30 11:09 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 33 ly thai to | — | — |
| #5368 | 2026-11-03 23:20 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #5438 | 2026-11-06 06:40 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 2 va cn | — | — |
| #4982 | 2026-11-11 20:09 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #5231 | 2026-11-11 20:10 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 27 kinh duong vuong | — | — |
| #5405 | 2026-11-11 20:11 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #5505 | 2026-11-11 20:11 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #5599 | 2026-11-11 20:12 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #5422 | 2026-11-11 20:23 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-11-27 | 1 | 2026-11-27 22:49 (VN) |
| 2026-11-26 | 1 | 2026-11-26 07:19 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-27 23:52 (VN) | location_candidate.approve | job 6827 |
| 2026-11-27 23:52 (VN) | location_candidate.add | job 6827 |
| 2026-11-27 23:50 (VN) | location_candidate.approve | job 6825 |
| 2026-11-27 23:50 (VN) | location_candidate.add | job 6825 |
| 2026-11-27 23:40 (VN) | location_candidate.approve | job 6821 |
| 2026-11-27 23:40 (VN) | location_candidate.add | job 6821 |
| 2026-11-27 23:27 (VN) | location_candidate.approve | job 6818 |
| 2026-11-27 23:27 (VN) | location_candidate.add | job 6818 |
| 2026-11-27 23:11 (VN) | location_candidate.approve | job 6815 |
| 2026-11-27 23:11 (VN) | location_candidate.add | job 6815 |

## 8. 검증 장치 변경 이력

이 파일을 만드는 스크립트·워크플로가 바뀌면 여기에 나온다. 7일 이내 변경이 있으면 Lee가 직접 확인한다.

- 2026-11-26 11:44 (VN) `2c4f399` fix(ci): 기준 커밋 계산을 한 모듈로 합쳐 같은 방식의 검사기 5곳에 적용 — 기준 브랜치가 앞으로 가도 남의 변경이 PR 변경으로 섞이지 않게 (J그룹) (#1082)
- 2026-11-20 17:46 (VN) `804a4ae` ci(S1): 보호 변경 Draft 게시 모드·STRICT 무조건 실패 제거·STATUS 라벨 예외 제거 (#808) (#942)
- 2026-11-15 19:04 (VN) `20f3f68` S4-3b: status-report도 ops-keys 환경(STATUS 보호 파일 — Lee 결정 대상) (#826)
- 2026-10-13 22:53 (VN) `f3a843f` db: 채용공고 규칙 표 + 자동 차단 장치 (R1~R5) (#60)
- 2026-10-11 12:07 (VN) `aa34f5f` fix(status): 생성기에서 빠진 VietMap 호출 수·관리자 기록 조회 복구 + 생성기 전체 실행 점검을 PR 검사에 추가

## 9. 공고 규칙 시험 결과 (DB 규칙 표 직접 조회)

규칙 표의 마지막시험 칸은 Actions의 자동 시험(supabase/tests/job_posting_rules_test.sql)만 채운다. 말로 하는 "완료" 보고는 인정하지 않는다.

| 규칙 | 차단방식 | 마지막시험 | 결과 |
|---|---|---|---|
| `R1_phone_digits_only` | 없음 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `R2_decision_columns_code_only` | 없음 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `R2b_publish_gate_reason_code_only` | 보류 | — | — 시험 없음 |
| `R3_source_evidence_required` | 저장거부 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `R5_verbatim_names` | 저장거부 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `R6_age_preserved` | 저장거부 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `R4_policy_exclusion_trigger` | 저장거부 | — | — 시험 없음 |
| `R7_ocr_crosscheck` | 보류 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `U1_industrial_park_pin_publish` | 없음 | — | — 시험 없음 |
| `U2_age_min_under_15` | 없음 | 2026-11-15 13:54 (VN) | ❌ 실패 |
| `R8_publication_requires_original_evidence` | 보류 | — | — 시험 없음 |
| `L1_single_location_source` | 저장거부 | — | — 시험 없음 |
| `L2_single_location_writer` | 저장거부 | — | — 시험 없음 |
| `L3_derived_location_cache` | 저장거부 | — | — 시험 없음 |
| `L4_data_independent_location_tests` | 없음 | — | — 시험 없음 |
| `R9_application_relevant_only` | 없음 | — | — 시험 없음 |
| `R10_multi_role_conditions` | 없음 | — | — 시험 없음 |
| `R11_original_hours_review` | 보류 | — | — 시험 없음 |
| `R12_location_precision_review` | 없음 | — | — 시험 없음 |
| `R13_role_readability_and_continuations` | 없음 | — | — 시험 없음 |

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **1건** · OCR 불일치 보류: **0건**
