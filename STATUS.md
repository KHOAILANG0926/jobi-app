# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-09 10:01 (VN)**
- 기준 커밋: `58bc02d` (DB 검사: migration 파일별 예외 27곳 → 이름 규칙 하나로 (#585))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/42553926388
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

- 마지막 Production 배포: `58bc02d` · 상태 **success** · 2026-11-09 08:59 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #585 | 2026-11-09 08:59 (VN) | `58bc02d` | DB 검사: migration 파일별 예외 27곳 → 이름 규칙 하나로 |
| #589 | 2026-11-09 08:52 (VN) | `e7549fa` | 상세: 예전 Quyền lợi 틀 3건을 새 4칸 틀로 합침(Lee 적용) — 틀 3→2 |
| #588 | 2026-11-09 08:24 (VN) | `1a04ede` | 규칙 문서 간소화 + '덧붙이기 전에 고치기·합치기·지우기' 원칙(PR 양식·Codex 검토) |
| #584 | 2026-11-09 08:21 (VN) | `331e644` | 정리: 아무 데도 안 쓰는 파일 15개·끝난 자동 작업 3개 삭제 |
| #581 | 2026-11-09 08:15 (VN) | `6596a56` | AI 팀: Lee가 '적용'한 데모 PR은 Codex 대기 생략 |
| #583 | 2026-11-09 08:02 (VN) | `e87c598` | AI 팀: 실패만 하던 Codex 지적 자동 대응 잡 중지 (#582) |
| #580 | 2026-11-09 07:27 (VN) | `6b56132` | 공고 작성 화면·상세 템플릿 알바몬 맞춤 (Lee 데모 적용) |
| #578 | 2026-11-09 05:31 (VN) | `450ccef` | fix(template): 모바일 미리보기 새 창 가운데 정렬 (#577) |
| #576 | 2026-11-09 02:34 (VN) | `fa5e275` | docs(handoff): 밤 근무 3회차 — #570·#566·#575 운영 반영 |
| #566 | 2026-11-09 02:21 (VN) | `1d6fd88` | fix(ai-team): Codex 지적 2건 반영 + Codex 봇 리뷰로 Claude 자동 대응 허용 |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **21건** (전체 25건, 숨김·비활성 4건)
- 출처별: 출처 없음 16 · muaban 2 · manual 2 · Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김 1

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
| 2026-11-07 | 1 | 2026-11-07 17:48 (VN) |
| 2026-11-06 | 4 | 2026-11-06 15:12 (VN) |
| 2026-11-04 | 3 | 2026-11-04 12:19 (VN) |
| 2026-11-03 | 1 | 2026-11-03 16:39 (VN) |
| 2026-11-02 | 2 | 2026-11-02 19:32 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 0회 (앱 서버 카운터와 별도)

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-11-09 09:00 (VN) | location_candidate.approve | job 5760 |
| 2026-11-09 09:00 (VN) | location_candidate.add | job 5760 |
| 2026-11-09 08:53 (VN) | location_candidate.approve | job 5757 |
| 2026-11-09 08:53 (VN) | location_candidate.add | job 5757 |
| 2026-11-09 08:25 (VN) | location_candidate.approve | job 5755 |
| 2026-11-09 08:25 (VN) | location_candidate.add | job 5755 |
| 2026-11-09 08:22 (VN) | location_candidate.approve | job 5752 |
| 2026-11-09 08:22 (VN) | location_candidate.add | job 5752 |
| 2026-11-09 08:16 (VN) | location_candidate.approve | job 5748 |
| 2026-11-09 08:16 (VN) | location_candidate.add | job 5748 |

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
