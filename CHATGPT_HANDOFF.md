# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**좁은 화면에서 알림벨 패널이 화면 밖으로 잘리는 문제 수정(작은 수정)** — 2026-09-27.

- 상태: IMPLEMENTED + VERIFIED(로컬 375/544/1280px 실측, tsc/test/build).
  이 문서와 함께 커밋 예정(커밋 = 자동 push = Production 배포).
- 원인: `.notif-panel`이 CSS상 벨 오른쪽 끝 기준(right:0)으로 열리는데, 좁은 화면에선
  헤더가 줄바꿈돼 벨이 화면 왼쪽(16px)에 있어 360px 패널이 왼쪽 밖으로 나감
  (Production 544px 실측 left -304px).

## 변경 내용

- `src/components/NotificationBell.tsx`: 패널이 열릴 때·창 크기가 바뀔 때 실제 위치를
  재서 화면 양쪽 16px 여백 안으로 가로 위치(`right`)만 보정. 잘리지 않는 넓은 화면은
  CSS 위치 그대로(인라인 보정 없음).
- `src/index.css` `.notif-panel`: 너비 `min(360px, calc(100vw - 1.5rem))` →
  `min(360px, calc(100vw - 32px))`(16px 여백 2개에 맞춤).
- 다른 기능/데이터 변경 없음.

## 테스트 결과

- 로컬(로컬 Supabase 테스트 계정 로그인) 실측, 패널 left/right/width:
  375px → 16 / 359 / 343(오른쪽 여백 16) · 544px → 16 / 376 / 360(열린 채 리사이즈,
  다시 열기 둘 다) · 1280px → 벨 오른쪽 끝과 패널 오른쪽 끝 일치(874), 보정 없음.
  세 폭 모두 가로 스크롤 없음.
- `npx tsc --noEmit`, `npm test` 8/8, `npm run build`(클라이언트+SSR) 통과.

## 발견된 문제

- 근무지 좌표 조사(2026-09-27, 종료): 거리 판정 가능 공고 0건 원인 = ① 크롤러가
  Geoapify 정밀 후보를 원문 검증 없으면 좌표를 버림, ② 남은 좌표는 전부 미검증 ward
  (표본 9건 중 7건이 실제 주소와 300m 초과, 최대 10.7km), ③ 원문 검증 행 2건은 좌표가
  지워진 상태. 구체 주소 18건 시험: 7건 300m 이내 확인(사람이 기준점으로 후보 선택),
  8건 불일치, 3건 판정 불가. 파이프라인 자체 선택이 맞은 건 2/15. **Production 7개 행은
  수정하지 않음(사용자 결정), distance 선택 계속 비활성, location_verified 의미 변경/
  새 컬럼 추가 없음.**
- ⚠ 이 저장소는 post-commit 훅이 `git push` → master 커밋 = Production 배포.

## 후속 작업 (기록)

- **[후속] 정확한 좌표 후보 별도 보관 + 사람 확인 절차**: 크롤러가 버리던 정밀 좌표
  후보(exact_candidate 등)를 검증된 근무지 좌표와 분리해 보관하고, 사람이 독립 지도로
  확인한 것만 검증 좌표로 승격하는 절차를 만든다. **후보 좌표를 검증된 공고 위치로
  자동 공개하지 않는다.** 스키마 변경이 필요하면 STRICT(별도 승인). 참고: 이번 시험
  결과(7건 확인 후보)는 Production에 반영하지 않았음.
- [후속] 위치 데이터가 충분해지면 `DISTANCE_MATCHING_ENABLED` 재검토.
- [후속] 크롤러 신규 공고 입력 중단(09-24 이후) 원인 확인, 기업 계정 화면 운영 확인.

## 다음 결정사항

1. 알림벨 수정 커밋·배포 승인(이 문서 포함 3개 파일).
2. 미커밋 로컬 변경 `crawler/crawl_topcv.py` 처리 여부(이번 커밋 제외).

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-27 — 헤더 Tuyển dụng 버튼 초록 변경** — MASTER PUSHED(`2388a44`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(실사이트 계산색 #10b981).
2. **2026-09-27 — 구직 희망조건 저장·매칭·앱 내 알림 1차** — PRODUCTION DB APPLIED(`job_alerts`) + MASTER PUSHED(`f2f51ac`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자 구직자 세션에서 저장·3분류·수정·중지/재개·알림벨 확인, 테스트 조건 삭제). 거리 조건은 좌표 부족으로 비활성. 기업 화면은 운영 미검증. 도중 post-commit 자동 push 사고(`0c6366e` 약 7분 노출 → `0dff280` revert).
3. **2026-09-26 — Zalo 로그인 계정탈취 긴급수정 + VPS relay HTTPS 전환 + 실사용자 재로그인 E2E까지 완료** — MASTER PUSHED(`c5d7e8f`~`31b76fa`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자가 실제 Zalo 계정으로 재로그인 성공 확인). 도중 발견된 계정 충돌 1건은 DB 직접 조회로 원인 확인 후 사용자 승인 받고 `app_metadata.zalo_id` 1회성 백필로 안전하게 해결.
4. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
5. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
