# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-07 10:16 (VN)**
- 기준 커밋: `ef249f4` (docs(handoff): 중복 4단계 완료·VPS 결제(다음 2027-02 초) (#506))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/42333110449
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 8건**

- 핀 #4824: ❌ 공고 주소에 번지 없음
- 핀 #4824: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #4878: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #4878: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5368: ❌ 공고 주소에 번지 없음
- 핀 #5368: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #5438: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #5438: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 115/115 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `593e141` · 상태 **success** · 2026-11-07 08:21 (VN)
- master 최신 커밋과 ⚠️ 다름 (아직 배포 안 됐거나 다른 브랜치에서 배포됨)
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #506 | 2026-11-07 08:57 (VN) | `ef249f4` | docs(handoff): 중복 4단계 완료·VPS 결제 |
| #505 | 2026-11-07 08:19 (VN) | `593e141` | feat(dedupe): 중복 판정 4단계 (승인 대기) |
| #504 | 2026-11-07 00:04 (VN) | `f98d9db` | fix(ops): 회사 이름 없는 공고는 전화번호를 회사로 |
| #503 | 2026-11-06 23:49 (VN) | `92f1f50` | feat(ops): 공개 공고 회사·지점 코드 붙이기 (중복 3단계) |
| #502 | 2026-11-06 23:22 (VN) | `87a709e` | fix(identity): 가게 종류 낱말 성조 그대로 찾기 |
| #501 | 2026-11-06 23:12 (VN) | `d7dcf80` | feat(db): 회사 코드표 생성 (중복 2단계, Lee 승인) |
| #500 | 2026-11-06 23:05 (VN) | `64dc498` | feat(identity): 회사·지점 분리, 업종 맞음 규칙 + 회사 코드표 변경안 |
| #499 | 2026-11-06 22:43 (VN) | `d736eda` | feat(ops): 중복 세기 결과에 공고별 비교 값 표시 |
| #498 | 2026-11-06 22:26 (VN) | `03c2ac4` | feat(ops): 중복 기준 계산 + 공개 공고 중복 세기(읽기 전용) |
| #496 | 2026-11-06 20:05 (VN) | `77b6500` | feat(ops): 운영 상세 화면 읽기 도구 (작업자 직접 확인) |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **19건** (전체 22건, 숨김·비활성 3건)
- 출처별: 출처 없음 14 · muaban 2 · manual 2 · Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김 1

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | VietMap 재확인 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|---|
| #4824 | 2026-10-26 06:52 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #4878 | 2026-10-30 11:09 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 33 ly thai to | — | — |
| #5368 | 2026-11-03 23:20 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #5438 | 2026-11-06 06:40 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 2 va cn | — | — |

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-11-06 | 4 | 2026-11-06 15:12 (VN) |
| 2026-11-04 | 3 | 2026-11-04 12:19 (VN) |
| 2026-11-03 | 1 | 2026-11-03 16:39 (VN) |
| 2026-11-02 | 2 | 2026-11-02 19:32 (VN) |
| 2026-11-01 | 4 | 2026-11-01 16:28 (VN) |
| 2026-10-31 | 2 | 2026-10-31 16:18 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-07 08:58 (VN) | location_candidate.approve | job 5583 |
| 2026-11-07 08:58 (VN) | location_candidate.add | job 5583 |
| 2026-11-07 08:20 (VN) | location_candidate.approve | job 5580 |
| 2026-11-07 08:20 (VN) | location_candidate.add | job 5580 |
| 2026-11-06 23:50 (VN) | location_candidate.approve | job 5576 |
| 2026-11-06 23:50 (VN) | location_candidate.add | job 5576 |
| 2026-11-06 23:23 (VN) | location_candidate.approve | job 5572 |
| 2026-11-06 23:23 (VN) | location_candidate.add | job 5572 |
| 2026-11-06 23:14 (VN) | location_candidate.approve | job 5570 |
| 2026-11-06 23:14 (VN) | location_candidate.add | job 5570 |

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
