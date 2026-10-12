# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-10-12 23:39 (VN)**
- 기준 커밋: `66cb9a3` (feat: 정확한 거리 주소는 Google Maps 위치·길찾기로 (A안) (#55))
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38277617874
- 검증 스크립트 지문(SHA-256): `ee61465a031d5604`

## 한눈에 보기

**확인 필요 5건**

- 검증 장치가 최근 바뀜 (aa34f5f)
- 검증 장치가 최근 바뀜 (d54d7dd)
- 검증 장치가 최근 바뀜 (862591c)
- 검증 장치가 최근 바뀜 (8c6f26a)
- 검증 장치가 최근 바뀜 (46cfb0a)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 51/51 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `b0487a2` · 상태 **success** · 2026-10-12 23:34 (VN)
- master 최신 커밋과 ⚠️ 다름 (아직 배포 안 됐거나 다른 브랜치에서 배포됨)
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #55 | 2026-10-12 23:28 (VN) | `66cb9a3` | feat: 정확한 거리 주소는 Google Maps 위치·길찾기로 (A안) |
| #54 | 2026-10-12 23:07 (VN) | `c3407f8` | feat: 선택 공고에 승인 좌표 Google Maps 링크 표시 |
| #53 | 2026-10-12 22:49 (VN) | `b0487a2` | db: 공고 제외 정책 DB 트리거 마이그레이션 기록 (Production 적용분) |
| #48 | 2026-10-12 21:56 (VN) | `45c372c` | feat: 공고 제외·검토 정책과 공통 오프라인 회귀 검사 |
| #51 | 2026-10-12 21:24 (VN) | `91d9197` | docs: 반복 검증·무한 작업 방지 규칙 및 PR 템플릿 |
| #45 | 2026-10-11 12:11 (VN) | `9157ced` | docs: HANDOFF·WORK_LOG 최종 정리 (10/11) |
| #44 | 2026-10-11 12:08 (VN) | `2d52265` | fix(status): 생성기 조회 복구 + 생성기 전체 실행 점검 추가 |
| #43 | 2026-10-11 12:05 (VN) | `74ab37f` | feat(status): VietMap 재확인을 사이트 서버로 (GitHub OIDC, 키 재등록 불필요) |
| #42 | 2026-10-11 11:59 (VN) | `8b434aa` | fix(status): 배포 대기·검증장치 승인 라벨 + 근거 없는 승인 차단 SQL 초안 |
| #41 | 2026-10-11 11:04 (VN) | `95d0dfa` | docs: HANDOFF·WORK_LOG 갱신 (master 보호·Zalo 테스트·#4750) |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **101건** (전체 103건, 숨김·비활성 2건)
- 출처별: 출처 없음 2 · chotot 99

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | VietMap 재확인 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|---|
| #4713 | 2026-10-08 12:23 (VN) | ✅ 번지·도로·회사명 일치 | ✅ 일치 (0 m) | 1a le thai to | 1a le thai to | Pizza Hut Bắc Ninh |
| #4721 | 2026-10-08 14:27 (VN) | ✅ 번지·도로·회사명 일치 | ✅ 일치 (0 m) | 1a le thai to | 1a le thai to | Pizza Hut Bắc Ninh |

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
| 2026-10-11 | 1 | 2026-10-11 07:43 (VN) |
| 2026-10-08 | 201 | 2026-10-08 14:27 (VN) |
- 이번 STATUS 재확인에 쓴 VietMap 호출: 2회 (앱 서버 카운터와 별도)

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

- 2026-10-11 12:07 (VN) `aa34f5f` fix(status): 생성기에서 빠진 VietMap 호출 수·관리자 기록 조회 복구 + 생성기 전체 실행 점검을 PR 검사에 추가
- 2026-10-11 12:04 (VN) `d54d7dd` feat(status): VietMap 재확인을 사이트 서버(api/status-recheck)로 — GitHub OIDC 인증, 키 추가 등록 불필요
- 2026-10-11 11:26 (VN) `862591c` fix(status): GPT 교차 검증 반영 — 배포 대기 조회 오류 내성, VietMap 재확인 추가, DB 트리거 초안 보류
- 2026-10-11 11:21 (VN) `8c6f26a` fix(status): 배포 완료 대기 후 기록, 검증 장치 변경은 '검증장치-승인' 라벨 필수 + 근거 없는 승인 차단 SQL 초안(미적용)
- 2026-10-11 09:50 (VN) `46cfb0a` chore: STATUS 자동 기록(기계 생성)·위조 감시 워크플로, 보고 검증 규정
