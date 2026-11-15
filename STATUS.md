# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-11-15 19:05 (VN)**
- 기준 커밋: `20f3f68` (S4-3b: status-report도 ops-keys 환경(STATUS 보호 파일 — Lee 결정 대상) (#826))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/43712008482
- 검증 스크립트 지문(SHA-256): `ddef4c76562027fa`

## 한눈에 보기

**확인 필요 1건**

- 검증 장치가 최근 바뀜 (20f3f68)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 122/122 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `20f3f68` · 상태 **success** · 2026-11-15 19:05 (VN)
- master 최신 커밋과 ✅ 같음
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #826 | 2026-11-15 19:04 (VN) | `20f3f68` | ci(S4-3b): status-report도 ops-keys 환경 — STATUS 보호 파일, Lee 결정 대상 |
| #828 | 2026-11-15 18:33 (VN) | `e454110` | ci(S4-4): STATUS 보호 — status 워크플로만 Lee의 유효한 Approve로 통과 |
| #829 | 2026-11-15 17:41 (VN) | `21d6298` | fix(S4-5): 검토관 준비 스크립트가 실제 저장소에서 멈추던 문제 |
| #824 | 2026-11-15 13:54 (VN) | `e573e9f` | ci(S4-3): 운영 열쇠는 ops-keys 환경(master만) — 브랜치·PR 워크플로 차단 준비 |
| #822 | 2026-11-15 13:25 (VN) | `13d1204` | ci(S4-2): PR 코드와 열쇠 분리 + 악성 PR 시험 |
| #806 | 2026-11-14 17:21 (VN) | `1b99e67` | R4: split secret-free publication gate and trusted AI reader calibration |
| #801 | 2026-11-13 18:38 (VN) | `18901d7` | fix(crawler): Facebook 재처리 마무리 판정 — 이미지 없는 공고 OCR 강제 제거·실제 차단 사유로 보류/실패 구분 (Draft, #728 후속) |
| #797 | 2026-11-13 16:26 (VN) | `c82321a` | feat(db): 고용주·legacy 공고도 공개 전 검사 통과 기록 요구 (Lee 11-13 A4 승인, R2 #728) |
| #798 | 2026-11-13 15:15 (VN) | `402dcdf` | fix(detail): 5157 이름표 붙은 주소 줄 ④에서 제거 (#653 규칙 이행, Lee 11-13 적용, R2 A5 #728) |
| #740 | 2026-11-13 15:00 (VN) | `92ce55c` | fix(detail): 급여 소수점 쉼표 줄바꿈 한 곳으로 (Lee 11-13 적용, #728 A3) |

## 4. 공개 중인 공고 (DB 직접 조회)

- ❌ 조회 실패

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

- 승인된 핀 없음

## 6. VietMap 호출 수 (서버 카운터)

- 최근 7일 호출 기록 없음

## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

- 기록 없음

## 8. 검증 장치 변경 이력

이 파일을 만드는 스크립트·워크플로가 바뀌면 여기에 나온다. 7일 이내 변경이 있으면 Lee가 직접 확인한다.

- 2026-11-15 19:04 (VN) `20f3f68` S4-3b: status-report도 ops-keys 환경(STATUS 보호 파일 — Lee 결정 대상) (#826)
- 2026-10-13 22:53 (VN) `f3a843f` db: 채용공고 규칙 표 + 자동 차단 장치 (R1~R5) (#60)
- 2026-10-11 12:07 (VN) `aa34f5f` fix(status): 생성기에서 빠진 VietMap 호출 수·관리자 기록 조회 복구 + 생성기 전체 실행 점검을 PR 검사에 추가
- 2026-10-11 12:04 (VN) `d54d7dd` feat(status): VietMap 재확인을 사이트 서버(api/status-recheck)로 — GitHub OIDC 인증, 키 추가 등록 불필요
- 2026-10-11 11:26 (VN) `862591c` fix(status): GPT 교차 검증 반영 — 배포 대기 조회 오류 내성, VietMap 재확인 추가, DB 트리거 초안 보류

## 9. 공고 규칙 시험 결과 (DB 규칙 표 직접 조회)

규칙 표의 마지막시험 칸은 Actions의 자동 시험(supabase/tests/job_posting_rules_test.sql)만 채운다. 말로 하는 "완료" 보고는 인정하지 않는다.

- 조회 결과 없음

## ❌ 조회 실패 (이 항목들은 위 표에 빠져 있음)

- 공고: Supabase local_jobs → HTTP 401
- 승인 핀: Supabase job_location_candidates → HTTP 401
- VietMap 호출 수: Supabase vietmap_usage_daily → HTTP 401
- 관리자 기록: Supabase admin_audit_logs → HTTP 401
- 공고 규칙 표: Supabase job_posting_rules → HTTP 401
- OCR 상태 건수: Supabase local_jobs → HTTP 401
