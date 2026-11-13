# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-13 10:38 (VN)**
- 기준 커밋: `80fcc2c` (화면 대조: 목록·메인 카드와 출처별 범위 (R2 잔여 검증 #753) (#780))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/43360238286
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 25건**

- 핀 #4824: ❌ 공고 주소에 번지 없음
- 핀 #4824: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
- 핀 #4878: ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인)
- 핀 #4878: VietMap 재확인 ⚠️ 재확인 불가 (근거에 VietMap ref 없음)
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
| 테스트 `npm test` | ✅ 122/122 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `80fcc2c` · 상태 **success** · 2026-11-13 10:06 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #780 | 2026-11-13 10:05 (VN) | `80fcc2c` | 화면 대조: 목록·메인 카드와 출처별 범위 (R2 잔여 검증 #753) |
| #773 | 2026-11-13 08:28 (VN) | `5f581c9` | PR 검사 확장: 변경 범위·덧붙이기·공고 번호 예외 대조 (R3 #728) |
| #772 | 2026-11-13 08:13 (VN) | `ab02c0e` | 화면 수집기: 비동기 지도 핀 기다림과 미검증 구분 (sb-5438, #728) |
| #770 | 2026-11-13 07:39 (VN) | `a9ce3a3` | R3: 병합 회귀 게이트 — 필수 검사가 초록 아닌 병합 감시 (#728) |
| #769 | 2026-11-13 07:28 (VN) | `5749066` | R3: 병합 출처 기록 도구와 #687 우회 원인 확정 (#728) |
| #768 | 2026-11-13 07:13 (VN) | `33814fe` | R2 잔여 검증 3건: 운영 영역·업종 대조, 검색 응답 시험, 감사 비원자성 (#753) |
| #767 | 2026-11-13 05:04 (VN) | `b16ed7f` | 다시 처리: 원문에 주소가 없으면 위치 칸은 그대로 (sb-5942 HAIDILAO, #633 후속) |
| #765 | 2026-11-13 03:28 (VN) | `926ec0c` | R2: 화면 항목 영역 배치 검증 (#753) |
| #763 | 2026-11-13 02:41 (VN) | `180f24b` | 검사기 독립성: jobInspect가 만드는 쪽 모듈 5개 import 제거, 검사기 전용 읽기로 교체 (R2 #753) |
| #762 | 2026-11-13 02:40 (VN) | `4dd25cb` | 업종 독립 검증: 장소 유형이 공장 업무 공고를 가게 업종으로 덮지 못하게 (R2 #753) |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **23건** (전체 33건, 숨김·비활성 10건)
- 출처별: 출처 없음 19 · muaban 2 · manual 1 · Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김 1

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | VietMap 재확인 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|---|
| #4824 | 2026-10-26 06:52 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
| #4878 | 2026-10-30 11:09 (VN) | ⚠️ 근거에 번지 없음 (회사명 일치 규칙으로 승인) | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | 33 ly thai to | — | — |
| #5368 (비공개) | 2026-11-03 23:20 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |
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
| 2026-11-07 | 1 | 2026-11-07 17:48 (VN) |
| 2026-11-06 | 4 | 2026-11-06 15:12 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-13 10:06 (VN) | location_candidate.approve | job 6116 |
| 2026-11-13 10:06 (VN) | location_candidate.add | job 6116 |
| 2026-11-13 08:29 (VN) | location_candidate.approve | job 6114 |
| 2026-11-13 08:29 (VN) | location_candidate.add | job 6114 |
| 2026-11-13 08:14 (VN) | location_candidate.approve | job 6110 |
| 2026-11-13 08:14 (VN) | location_candidate.add | job 6110 |
| 2026-11-13 07:40 (VN) | location_candidate.approve | job 6108 |
| 2026-11-13 07:40 (VN) | location_candidate.add | job 6108 |
| 2026-11-13 07:29 (VN) | location_candidate.approve | job 6105 |
| 2026-11-13 07:29 (VN) | location_candidate.add | job 6105 |

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
| `R1_phone_digits_only` | 없음 | 2026-11-12 07:04 (VN) | ❌ 실패 |
| `R2_decision_columns_code_only` | 없음 | 2026-11-12 07:04 (VN) | ❌ 실패 |
| `R2b_publish_gate_reason_code_only` | 보류 | — | — 시험 없음 |
| `R3_source_evidence_required` | 저장거부 | 2026-11-12 07:04 (VN) | ❌ 실패 |
| `R5_verbatim_names` | 저장거부 | 2026-11-12 07:04 (VN) | ❌ 실패 |
| `R6_age_preserved` | 저장거부 | 2026-11-12 07:04 (VN) | ❌ 실패 |
| `R4_policy_exclusion_trigger` | 저장거부 | — | — 시험 없음 |
| `R7_ocr_crosscheck` | 보류 | 2026-11-12 07:04 (VN) | ❌ 실패 |
| `U1_industrial_park_pin_publish` | 없음 | — | — 시험 없음 |
| `U2_age_min_under_15` | 없음 | 2026-11-12 07:04 (VN) | ❌ 실패 |
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
