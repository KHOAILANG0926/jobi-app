# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-16 18:44 (VN)**
- 기준 커밋: `9655053` (Merge pull request #861 from KHOAILANG0926/fix/job-rules-test-db)
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/43860112864
- 검증 스크립트 지문(SHA-256): `ddef4c76562027fa`

## 한눈에 보기

**확인 필요 26건**

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
- 검증 장치가 최근 바뀜 (20f3f68)
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

- 마지막 Production 배포: `9655053` · 상태 **success** · 2026-11-16 18:42 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #861 | 2026-11-16 18:42 (VN) | `9655053` | test(#858): 공고 규칙 R1~R7·U2 시험을 운영 DB에서 시험용 DB(PGlite)로 — 운영에 시험 공고 넣기 폐지 |
| #860 | 2026-11-16 18:33 (VN) | `0f5bdad` | ci(#858): migrations-apply와 겹치는 옛 직접 적용 워크플로 occupation-master-apply 폐지 |
| #812 | 2026-11-16 18:25 (VN) | `dd769a0` | S3-5: DB 변경 커밋은 migration 성공 뒤에만 운영 배포 (#808) |
| #859 | 2026-11-16 17:25 (VN) | `ad7f15d` | fix(db): local_jobs 비공개 칸 권한 되돌리기 — 11-15 옛 직접 적용 워크플로 재실행 복구 (STRICT) |
| #850 | 2026-11-16 13:19 (VN) | `8430994` | ci(S4 B단계 3차): ai-review·approval-gate를 검사 전용 GitHub 앱으로 (master 전용 environment 열쇠) |
| #848 | 2026-11-16 10:23 (VN) | `1d57b24` | ci(S4 B단계 2차): approval-checks 교환 권한에 contents:read 추가 (서버 필수 조건) |
| #846 | 2026-11-16 07:57 (VN) | `ef9100a` | ci(S4 B단계): approval-checks만 Claude 앱 토큰에 checks:write 요청 (공통 기본 권한 유지) |
| #833 | 2026-11-16 06:23 (VN) | `d05ccbd` | ci(S4): 병합 통제 보완 — 위험도 판단 불가는 자동 보류, 승인 요청은 검증·독립 검토 뒤 |
| #832 | 2026-11-16 00:03 (VN) | `7fd18c4` | chore(S4): 임시 운영 키 진단 도구 삭제(status-report 정상 확인) |
| #843 | 2026-11-15 23:34 (VN) | `99c13f0` | S4: #842 보안·승인 보호 변경 — 봇 계정 PR |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **23건** (전체 34건, 숨김·비활성 11건)
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

- 최근 7일 호출 기록 없음
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-16 18:43 (VN) | location_candidate.approve | job 6178 |
| 2026-11-16 18:43 (VN) | location_candidate.add | job 6178 |
| 2026-11-16 18:35 (VN) | location_candidate.approve | job 6175 |
| 2026-11-16 18:35 (VN) | location_candidate.add | job 6175 |
| 2026-11-16 18:26 (VN) | location_candidate.approve | job 6171 |
| 2026-11-16 18:26 (VN) | location_candidate.add | job 6171 |
| 2026-11-13 15:17 (VN) | location_candidate.approve | job 6150 |
| 2026-11-13 15:16 (VN) | location_candidate.add | job 6150 |
| 2026-11-13 15:01 (VN) | location_candidate.approve | job 6147 |
| 2026-11-13 15:01 (VN) | location_candidate.add | job 6147 |

## 8. 검증 장치 변경 이력

이 파일을 만드는 스크립트·워크플로가 바뀌면 여기에 나온다. 7일 이내 변경이 있으면 Lee가 직접 확인한다.

- 2026-11-15 19:04 (VN) `20f3f68` S4-3b: status-report도 ops-keys 환경(STATUS 보호 파일 — Lee 결정 대상) (#826)
- 2026-10-13 22:53 (VN) `f3a843f` db: 채용공고 규칙 표 + 자동 차단 장치 (R1~R5) (#60)
- 2026-10-11 12:07 (VN) `aa34f5f` fix(status): 생성기에서 빠진 VietMap 호출 수·관리자 기록 조회 복구 + 생성기 전체 실행 점검을 PR 검사에 추가
- 2026-10-11 12:04 (VN) `d54d7dd` feat(status): VietMap 재확인을 사이트 서버(api/status-recheck)로 — GitHub OIDC 인증, 키 추가 등록 불필요
- 2026-10-11 11:26 (VN) `862591c` fix(status): GPT 교차 검증 반영 — 배포 대기 조회 오류 내성, VietMap 재확인 추가, DB 트리거 초안 보류

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

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **0건** · OCR 불일치 보류: **0건**
