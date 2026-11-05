# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-05 10:46 (VN)**
- 기준 커밋: `5c83dbb` (feat(detail): enlarge the header company photo on click (#466))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/41963488297
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 6건**

- 핀 #4824: ❌ 공고 주소에 번지 없음
- 핀 #4824: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #4878: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #4878: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5368: ❌ 공고 주소에 번지 없음
- 핀 #5368: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 109/109 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `5c83dbb` · 상태 **success** · 2026-11-05 08:02 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #466 | 2026-11-05 08:00 (VN) | `5c83dbb` | feat(detail): 상단 회사 사진 클릭 확대 |
| #465 | 2026-11-05 06:14 (VN) | `8b3a118` | fix(images): 대표 사진에 images[0] 공통 대체 순서 적용 |
| #463 | 2026-11-04 18:33 (VN) | `750ebcf` | docs(handoff): 11-04 저녁 GPT 인수인계 |
| #462 | 2026-11-04 17:30 (VN) | `e196ce2` | fix(detail): 근무조건 한쪽 칸 비면 나눠 채움 |
| #461 | 2026-11-04 15:50 (VN) | `30567bb` | fix(detail): 상세요강 칸 나누기 고침(Lee '다 고치고') |
| #460 | 2026-11-04 15:30 (VN) | `204c018` | docs(handoff): 11-04 오후 기록 |
| #459 | 2026-11-04 15:18 (VN) | `66041cd` | feat(detail): 상세요강에서 필요 없는 줄 거르기(Lee 적용) |
| #458 | 2026-11-04 13:09 (VN) | `ab72573` | ops(jobs): #5437 포스터 옮김 중복 제거 |
| #457 | 2026-11-04 12:44 (VN) | `412735e` | ops(jobs): #5438 근무지 건물 사진 넣기 |
| #456 | 2026-11-04 12:27 (VN) | `e97ee32` | ops(jobs): #5437 신청 링크 줄 붙임 |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **16건** (전체 19건, 숨김·비활성 3건)
- 출처별: muaban 2 · manual 2 · 출처 없음 11 · Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김 1

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | VietMap 재확인 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|---|
| #4824 | 2026-10-26 06:52 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #4878 | 2026-10-30 11:09 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 33 ly thai to | — | — |
| #5368 | 2026-11-03 23:20 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-11-04 | 3 | 2026-11-04 12:19 (VN) |
| 2026-11-03 | 1 | 2026-11-03 16:39 (VN) |
| 2026-11-02 | 2 | 2026-11-02 19:32 (VN) |
| 2026-11-01 | 4 | 2026-11-01 16:28 (VN) |
| 2026-10-31 | 2 | 2026-10-31 16:18 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-05 08:05 (VN) | location_candidate.approve | job 5470 |
| 2026-11-05 08:05 (VN) | location_candidate.add | job 5470 |
| 2026-11-05 06:15 (VN) | location_candidate.approve | job 5467 |
| 2026-11-05 06:15 (VN) | location_candidate.add | job 5467 |
| 2026-11-04 18:34 (VN) | location_candidate.approve | job 5464 |
| 2026-11-04 18:34 (VN) | location_candidate.add | job 5464 |
| 2026-11-04 17:31 (VN) | location_candidate.approve | job 5461 |
| 2026-11-04 17:31 (VN) | location_candidate.add | job 5461 |
| 2026-11-04 15:51 (VN) | location_candidate.approve | job 5458 |
| 2026-11-04 15:51 (VN) | location_candidate.add | job 5458 |

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
| `R2b_publish_gate_reason_code_only` | 보류 | — | — 시험 없음 |
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
| `R9_application_relevant_only` | 없음 | — | — 시험 없음 |
| `R10_multi_role_conditions` | 없음 | — | — 시험 없음 |
| `R11_original_hours_review` | 보류 | — | — 시험 없음 |
| `R12_location_precision_review` | 없음 | — | — 시험 없음 |
| `R13_role_readability_and_continuations` | 없음 | — | — 시험 없음 |

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **0건** · OCR 불일치 보류: **0건**
