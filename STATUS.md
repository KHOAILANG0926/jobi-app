# STATUS — 자동 생성 기록

> **이 파일은 GitHub Actions가 DB·GitHub를 직접 조회해 만든다. 사람·AI가 손으로 고치지 않는다.**
> AI(GPT·Cursor·Claude)의 작업 보고가 이 파일과 다르면, 이 파일이 맞다.

- 생성 시각: **2026-10-11 10:48 (VN)**
- 기준 커밋: `db95ad2` (Merge pull request #39 from KHOAILANG0926/fix/zalo-test-mock)
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38109550586
- 검증 스크립트 지문(SHA-256): `5bd7a7ea318eccce`

## 한눈에 보기

**확인 필요 1건**

- 검증 장치가 최근 바뀜 (46cfb0a)

## 1. 코드 검사 (이번 실행에서 직접 돌린 결과)

| 항목 | 결과 |
|---|---|
| 타입 검사 `tsc --noEmit` | ✅ 통과 |
| 테스트 `npm test` | ✅ 46/46 파일 통과 |
| 빌드 `npm run build` | ✅ 통과 |

## 2. 배포 (GitHub에 기록된 Vercel 배포)

- 마지막 Production 배포: `f87a352` · 상태 **success** · 2026-10-11 10:40 (VN)
- master 최신 커밋과 ⚠️ 다름 (아직 배포 안 됐거나 다른 브랜치에서 배포됨)
- 사이트 응답 https://viecganban.vn/ : **200**

## 3. 최근 병합된 PR

| PR | 병합 시각 | 커밋 | 제목 |
|---|---|---|---|
| #39 | 2026-10-11 10:48 (VN) | `db95ad2` | test(zalo): mock.module namedExports — Node 22에서 테스트 미실행 수정 |
| #38 | 2026-10-11 10:39 (VN) | `f87a352` | fix(locate): 승인 규칙 B안 — KCN 밖 회사명 일치만으로는 핀 없음 |
| #37 | 2026-10-11 09:56 (VN) | `f6eed59` | chore: STATUS 자동 기록·위조 감시, 보고 검증 규정 |
| #36 | 2026-10-11 07:17 (VN) | `c8ec35a` | Update handoff after PR 35 deployment |
| #35 | 2026-10-11 07:07 (VN) | `4375492` | Trace address-cache retries and VietMap usage |
| #33 | 2026-10-08 14:31 (VN) | `71c51fd` | docs: HANDOFF에 주소 재실행 결과·호출 집계 불일치·xã 지도 완료 기록 |
| #32 | 2026-10-08 14:10 (VN) | `4d79400` | fix(address): 상호 접두어·Đ./P./TP. 약어 처리, region_only 보정 |
| #31 | 2026-10-08 13:37 (VN) | `b900458` | fix(admin): 개요 "Tổng tin tuyển dụng" "—" 수정 (korea_jobs_public 집계) |
| #30 | 2026-10-08 13:25 (VN) | `b64b2f8` | feat(map): xã/phường 동네 지도 (핀 없음) + 관리자 xã 위치 검색(비공개 캐시) |
| #29 | 2026-10-08 13:09 (VN) | `2df0c25` | docs: chotot 지도 커버리지 Production 집계 기록 |

## 4. 공개 중인 공고 (DB 직접 조회)

- 공개 중: **101건** (전체 103건, 숨김·비활성 2건)
- 출처별: 출처 없음 2 · chotot 99

## 5. 지도에 핀으로 나가는 승인 좌표

판정은 공고 주소와 승인 근거의 번지·도로명·회사명을 문자열로 대조한 결과다.

| 공고 | 승인 시각 | 판정 | 공고 주소 번지 | 근거 번지 | 근거 POI |
|---|---|---|---|---|---|
| #4713 | 2026-10-08 12:23 (VN) | ✅ 번지·도로·회사명 일치 | 1a le thai to | 1a le thai to | Pizza Hut Bắc Ninh |
| #4721 | 2026-10-08 14:27 (VN) | ✅ 번지·도로·회사명 일치 | 1a le thai to | 1a le thai to | Pizza Hut Bắc Ninh |

## 6. VietMap 호출 수 (서버 카운터)

| 날짜 | 호출 | 마지막 갱신 |
|---|---|---|
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

- 2026-10-11 09:50 (VN) `46cfb0a` chore: STATUS 자동 기록(기계 생성)·위조 감시 워크플로, 보고 검증 규정
