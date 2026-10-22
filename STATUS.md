# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-10-22 11:15 (VN)**
- 기준 커밋: `b720bcc` (test: wait for selected menu condition when live results are empty (#200))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/39721208752
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 5건**

- 규칙 시험 실패: R1_phone_digits_only
- 규칙 시험 실패: R2_decision_columns_code_only
- 규칙 시험 실패: R5_verbatim_names
- 규칙 시험 실패: R7_ocr_crosscheck
- 규칙 시험 실패: U2_age_min_under_15

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 71/71 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `b720bcc` · 상태 **success** · 2026-10-22 11:15 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #200 | 2026-10-22 11:13 (VN) | `b720bcc` | 운영 검색 0건 조건 전환 검사 대기 보완 |
| #198 | 2026-10-22 11:08 (VN) | `40b80e4` | 기간·계약/사회보험 메뉴에서 일반 공고도 검색 |
| #197 | 2026-10-22 07:21 (VN) | `9a4c980` | 지도 업종 요약·m 반경 입력·지도 아래 우선 검색 결과 |
| #196 | 2026-10-22 06:11 (VN) | `556f2c0` | 운영 업종 검사: 실제 메뉴 버튼과 열기 방식 사용 |
| #194 | 2026-10-22 06:05 (VN) | `322e1a3` | 공식 직업코드로 업종 자동 지정·메뉴 연결 |
| #193 | 2026-10-22 05:06 (VN) | `7a3627e` | HANDOFF: 지도·승인 후 운영 절차 실제 반영 확인 |
| #192 | 2026-10-22 05:02 (VN) | `36c9a60` | 승인 데모 운영 반영 절차·운영 화면 근거 자동 보존 |
| #191 | 2026-10-21 22:45 (VN) | `02b1baa` | 메인 지도: 반경 밖 대략 위치 핀 사라짐 수정 (#190 회귀) |
| #190 | 2026-10-21 22:01 (VN) | `bb2e7c3` | 데모: 메인 지도 위치 칸·직선거리 정리, 화면 안 공고 목록, 핀 창 B안 |
| #189 | 2026-10-21 13:02 (VN) | `52ea695` | HANDOFF: 메인 지도 핀 2개 운영 확인 기록 |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **2건** (전체 5건, 숨김·비활성 3건)
- 출처별: manual 2

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

- 승인된 핀 없음

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-10-20 | 2 | 2026-10-20 21:50 (VN) |
| 2026-10-18 | 2 | 2026-10-18 22:12 (VN) |
| 2026-10-16 | 2 | 2026-10-16 11:32 (VN) |

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-10-11 10:44 (VN) | job.hide | job 4750 |
| 2026-10-11 10:44 (VN) | location_candidate.revoke | job 4750 |
| 2026-10-11 10:37 (VN) | location_candidate.revoke | job 4720 |
| 2026-10-11 10:37 (VN) | location_candidate.revoke | job 4702 |
| 2026-10-08 14:27 (VN) | location_candidate.approve | job 4721 |
| 2026-10-08 14:27 (VN) | location_candidate.add | job 4721 |
| 2026-10-08 12:23 (VN) | location_candidate.approve | job 4750 |
| 2026-10-08 12:23 (VN) | location_candidate.add | job 4750 |
| 2026-10-08 12:23 (VN) | location_candidate.approve | job 4713 |
| 2026-10-08 12:23 (VN) | location_candidate.add | job 4713 |

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
| `R1_phone_digits_only` | 없음 | 2026-10-20 06:08 (VN) | ❌ 실패 |
| `R2_decision_columns_code_only` | 없음 | 2026-10-20 06:08 (VN) | ❌ 실패 |
| `R2b_publish_gate_reason_code_only` | 없음 | — | — 시험 없음 |
| `R3_source_evidence_required` | 저장거부 | 2026-10-20 06:08 (VN) | ✅ 통과 |
| `R5_verbatim_names` | 저장거부 | 2026-10-20 06:08 (VN) | ❌ 실패 |
| `R6_age_preserved` | 저장거부 | 2026-10-20 06:08 (VN) | ✅ 통과 |
| `R4_policy_exclusion_trigger` | 저장거부 | — | — 시험 없음 |
| `R7_ocr_crosscheck` | 보류 | 2026-10-20 06:08 (VN) | ❌ 실패 |
| `U1_industrial_park_pin_publish` | 없음 | — | — 시험 없음 |
| `U2_age_min_under_15` | 없음 | 2026-10-20 06:08 (VN) | ❌ 실패 |
| `R8_publication_requires_original_evidence` | 보류 | — | — 시험 없음 |

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **0건** · OCR 불일치 보류: **0건**
