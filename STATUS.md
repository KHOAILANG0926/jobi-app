# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-24 01:45 (VN)**
- 기준 커밋: `1c002cd` (Merge pull request #993 from KHOAILANG0926/fix/990-pins-ocr)
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/45241567432
- 검증 스크립트 지문(SHA-256): `381fdde1e2023cb4`

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
- 검증 장치가 최근 바뀜 (804a4ae)
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
| 테스트 `npm test` | ✅ 125/125 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `1c002cd` · 상태 **success** · 2026-11-24 01:44 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #993 | 2026-11-24 01:44 (VN) | `1c002cd` | fix(#990): 핀 없는 정상 보류 공고를 행정구역 검사 실패로 보지 않음 + OCR 영구 사진 접근 거부 건너뜀 + PR 단계 읽기 전용 위치 검사 (Draft) |
| #992 | 2026-11-24 00:59 (VN) | `5aa71d7` | ci(approval): 승인 자동화 완화 — 일반 워크플로·시험 파일 자동, 경계·고권한·규칙 문서 수동, 조회 실패는 자동 재확인 (Draft) |
| #991 | 2026-11-24 00:16 (VN) | `4c6204c` | fix(#990): 공개 위치 요약 API는 확정 좌표만 — 대략 점이 원본 대조와 어긋나던 운영 검증 실패 수정 (Draft) |
| #989 | 2026-11-23 23:41 (VN) | `3bbf7ec` | feat(jobs): #988 지점별 독립 공고 + 위치 우선순위 Google→VietMap→Goong 구현 + 자율 완주 규정 |
| #987 | 2026-11-23 21:59 (VN) | `e72d1f1` | docs(rules): 지점별 독립 공고 확정 규정 — CLAUDE.md·AGENTS.md·RULES_CORE (문서만) |
| #981 | 2026-11-23 09:34 (VN) | `87ece37` | refactor(crawler): 2단계 구조 정리 1묶음 — TopCV 연락처·오늘 날짜를 공통 기준 한 곳으로 + DB 하드코딩 값 고정 시험 (Draft, #978) |
| #952 | 2026-11-23 08:53 (VN) | `9909248` | fix(#950): 지도 스타일을 우리 쪽 사본에서 먼저 — VietMap style.json 멈춤(메인·상세·관리자) |
| #972 | 2026-11-23 00:20 (VN) | `d5ae60b` | fix(crawler): 1-C Facebook DB 규칙 거부 원문·출처·규칙 코드·사유를 보류함에 rejected로 보존 (Draft) |
| #970 | 2026-11-23 00:15 (VN) | `b0daf6c` | feat(criteria): 1-B 마감·연락처·필수 9개 기준 한 곳 정리 — 코드·시험 (Draft, DB 변경 없음) |
| #971 | 2026-11-23 00:14 (VN) | `1e63441` | fix(db): 공고 만료 처리 기준 날짜를 베트남 날짜로 — deactivate_expired_jobs 함수 한 개 교체 (Draft, 운영 적용 없음) |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **26건** (전체 40건, 숨김·비활성 14건)
- 출처별: 출처 없음 22 · muaban 2 · manual 1 · Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김 1

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
| #6351 (비공개) | 2026-11-24 01:45 (VN) | ❌ 공고 주소에 번지 없음 | ⚠️ 재확인 불가 (근거에 VietMap ref 없음) | — | — | — |

## 6. VietMap 호출 수 (서버 카운터)

- 최근 7일 호출 기록 없음
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-24 01:45 (VN) | location_candidate.approve | job 6351 |
| 2026-11-24 01:45 (VN) | location_candidate.add | job 6351 |
| 2026-11-24 01:00 (VN) | location_candidate.approve | job 6348 |
| 2026-11-24 01:00 (VN) | location_candidate.add | job 6348 |
| 2026-11-24 00:18 (VN) | location_candidate.approve | job 6346 |
| 2026-11-24 00:18 (VN) | location_candidate.add | job 6346 |
| 2026-11-23 23:45 (VN) | location_candidate.approve | job 6342 |
| 2026-11-23 23:45 (VN) | location_candidate.add | job 6342 |
| 2026-11-23 22:00 (VN) | location_candidate.approve | job 6338 |
| 2026-11-23 22:00 (VN) | location_candidate.add | job 6338 |

## 8. 검증 장치 변경 이력

이 파일을 만드는 스크립트·워크플로가 바뀌면 여기에 나온다. 7일 이내 변경이 있으면 Lee가 직접 확인한다.

- 2026-11-20 17:46 (VN) `804a4ae` ci(S1): 보호 변경 Draft 게시 모드·STRICT 무조건 실패 제거·STATUS 라벨 예외 제거 (#808) (#942)
- 2026-11-15 19:04 (VN) `20f3f68` S4-3b: status-report도 ops-keys 환경(STATUS 보호 파일 — Lee 결정 대상) (#826)
- 2026-10-13 22:53 (VN) `f3a843f` db: 채용공고 규칙 표 + 자동 차단 장치 (R1~R5) (#60)
- 2026-10-11 12:07 (VN) `aa34f5f` fix(status): 생성기에서 빠진 VietMap 호출 수·관리자 기록 조회 복구 + 생성기 전체 실행 점검을 PR 검사에 추가
- 2026-10-11 12:04 (VN) `d54d7dd` feat(status): VietMap 재확인을 사이트 서버(api/status-recheck)로 — GitHub OIDC 인증, 키 추가 등록 불필요

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
