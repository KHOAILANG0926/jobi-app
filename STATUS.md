# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-10-13 23:22 (VN)**
- 기준 커밋: `c11d612` (crawler: 원문 근거 칸 채우기 + 규칙 거부 건너뛰기 (#63))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38429838948
- 검증 스크립트 지문(SHA-256): `fce259150b1d9603`

## 한눈에 보기

**확인 필요 5건**

- 검증 장치가 최근 바뀜 (f3a843f)
- 검증 장치가 최근 바뀜 (aa34f5f)
- 검증 장치가 최근 바뀜 (d54d7dd)
- 검증 장치가 최근 바뀜 (862591c)
- 검증 장치가 최근 바뀜 (8c6f26a)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 53/53 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `c11d612` · 상태 **success** · 2026-10-13 23:22 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #63 | 2026-10-13 23:21 (VN) | `c11d612` | crawler: 원문 근거 칸 채우기 + 규칙 거부 건너뛰기 |
| #62 | 2026-10-13 23:00 (VN) | `fad0d3d` | fix(db): 규칙 트리거의 없는 칸(industrial_park) 참조 제거 |
| #60 | 2026-10-13 22:53 (VN) | `f3a843f` | db: 채용공고 규칙 표 + 자동 차단 장치 (R1~R5) |
| #61 | 2026-10-13 22:37 (VN) | `a2b486f` | fix(admin): 초안 불러오기·게시 전 확인·저장 공고 링크 |
| #58 | 2026-10-13 13:47 (VN) | `186f566` | feat(api): 관리자 주소 지오코딩 시험 (TomTom·Goong) |
| #56 | 2026-10-13 06:16 (VN) | `91858e4` | fix: 길찾기 숨김 금지 — 회사명+지역 Google 링크 |
| #55 | 2026-10-12 23:28 (VN) | `66cb9a3` | feat: 정확한 거리 주소는 Google Maps 위치·길찾기로 (A안) |
| #54 | 2026-10-12 23:07 (VN) | `c3407f8` | feat: 선택 공고에 승인 좌표 Google Maps 링크 표시 |
| #53 | 2026-10-12 22:49 (VN) | `b0487a2` | db: 공고 제외 정책 DB 트리거 마이그레이션 기록 (Production 적용분) |
| #48 | 2026-10-12 21:56 (VN) | `45c372c` | feat: 공고 제외·검토 정책과 공통 오프라인 회귀 검사 |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **0건** (전체 5건, 숨김·비활성 5건)
- 출처별: —

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

- 승인된 핀 없음

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-10-13 | 5 | 2026-10-13 13:12 (VN) |
| 2026-10-11 | 1 | 2026-10-11 07:43 (VN) |
| 2026-10-08 | 201 | 2026-10-08 14:27 (VN) |

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
| `R1_phone_digits_only` | 없음 | 2026-10-13 23:00 (VN) | ✅ 통과 |
| `R2_decision_columns_code_only` | 없음 | 2026-10-13 23:00 (VN) | ✅ 통과 |
| `R2b_publish_gate_reason_code_only` | 없음 | — | — 시험 없음 |
| `R3_source_evidence_required` | 저장거부 | 2026-10-13 23:00 (VN) | ✅ 통과 |
| `R5_verbatim_names` | 저장거부 | 2026-10-13 23:00 (VN) | ✅ 통과 |
| `R6_age_preserved` | 저장거부 | 2026-10-13 23:00 (VN) | ✅ 통과 |
| `R4_policy_exclusion_trigger` | 저장거부 | — | — 시험 없음 |
| `R7_ocr_crosscheck` | 보류 | 2026-10-13 23:00 (VN) | ✅ 통과 |
| `U1_industrial_park_pin_publish` | 없음 | — | — 시험 없음 |
| `U2_age_min_under_15` | 없음 | 2026-10-13 23:00 (VN) | ✅ 통과 |

- OCR 읽기불가(unreadable, 비공개 유지·사람 확인 대상 아님): **0건** · OCR 불일치 보류: **0건**
