# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-10-19 07:53 (VN)**
- 기준 커밋: `3cc0902` (시험: TomTom 번지 주소 검색(실제 공고 8건) — 서버 출입증으로 주소 시험 API 호출 (#157))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/39182709492
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 1건**

- 검증 장치가 최근 바뀜 (f3a843f)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 63/63 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `3cc0902` · 상태 **success** · 2026-10-19 07:53 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #157 | 2026-10-19 07:52 (VN) | `3cc0902` | 시험: TomTom 번지 주소 검색 (VietMap 실패 8건) |
| #156 | 2026-10-19 07:51 (VN) | `411490a` | 기록 보관 가지 Vercel 배포 중단 (배포 한도 초과 원인) |
| #153 | 2026-10-18 23:02 (VN) | `e8a1310` | 위치: 공고 저장 즉시 Vercel에서 위치 찾기 + GitHub 예약 끄기 |
| #152 | 2026-10-18 22:54 (VN) | `6092911` | 위치: 새 2단계 주소(동, 성) 읽기 + 저장된 동 좌표 재사용 |
| #149 | 2026-10-18 21:25 (VN) | `a8e164d` | HANDOFF 갱신 (10-18 밤) |
| #148 | 2026-10-18 21:21 (VN) | `70cd250` | 근무조건 칸 내용 규칙: 한 항목=한 줄, 최대 3줄, 넘치면 Xem thêm |
| #147 | 2026-10-18 20:34 (VN) | `71c81c6` | HANDOFF 갱신 (10-18 저녁) |
| #146 | 2026-10-18 20:03 (VN) | `d641940` | 상세 PC 머리: 위치가 카드 오른쪽 끝까지, 등록일이 내용 폭을 줄이지 않게 |
| #145 | 2026-10-18 19:52 (VN) | `9b38522` | 상세 PC 머리: 위치 오른쪽 끝·등록일 즐겨찾기 왼쪽·급여는 배지+금액만 |
| #144 | 2026-10-18 18:50 (VN) | `98fc44c` | PC 기준 해시 갱신 (오늘 Lee 지시 변경 반영) |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **2건** (전체 5건, 숨김·비활성 3건)
- 출처별: manual 2

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

- 승인된 핀 없음

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-10-18 | 2 | 2026-10-18 22:12 (VN) |
| 2026-10-16 | 2 | 2026-10-16 11:32 (VN) |
| 2026-10-13 | 5 | 2026-10-13 13:12 (VN) |

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
| `R1_phone_digits_only` | 없음 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `R2_decision_columns_code_only` | 없음 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `R2b_publish_gate_reason_code_only` | 없음 | — | — 시험 없음 |
| `R3_source_evidence_required` | 저장거부 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `R5_verbatim_names` | 저장거부 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `R6_age_preserved` | 저장거부 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `R4_policy_exclusion_trigger` | 저장거부 | — | — 시험 없음 |
| `R7_ocr_crosscheck` | 보류 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `U1_industrial_park_pin_publish` | 없음 | — | — 시험 없음 |
| `U2_age_min_under_15` | 없음 | 2026-10-18 15:23 (VN) | ✅ 통과 |
| `R8_publication_requires_original_evidence` | 보류 | — | — 시험 없음 |

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **0건** · OCR 불일치 보류: **0건**
