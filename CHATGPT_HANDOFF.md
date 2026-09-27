# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**헤더 "Tuyển dụng" 버튼 색 변경(파랑 → 초록)** — 2026-09-27. FAST 작업.

- 상태: IMPLEMENTED + VERIFIED(로컬 미리보기, tsc/build) + MASTER PUSHED +
  PRODUCTION DEPLOYED(이 문서가 포함된 커밋). Production 화면 확인 결과는 커밋 직후
  세션에서 확인.
- 이유: 헤더에 파란 채움 버튼이 2개(Zalo 로그인 · Tuyển dụng)라 구분이 안 됨.

## 변경 내용

- `src/index.css` `.header-tabs__post-wrap`: background `#2563eb` → `#10b981`,
  hover `#1d4ed8` → `#059669`(프로젝트에서 이미 쓰던 초록 재사용, 새 색 도입 없음).
  주석 갱신. 다른 파일 변경 없음.

## 테스트 결과

- `npx tsc --noEmit` 통과, `npm run build`(클라이언트+SSR) 통과.

## 발견된 문제

- (직전 작업에서 기록, 미해결) 좁은 화면에서 알림벨 패널이 화면 왼쪽 밖으로 나감
  (544px 폭에서 left -304px). 별도 후속 작업.
- ⚠ 이 저장소는 post-commit 훅이 `git push`를 실행 → master 커밋 = Production 배포.

## 다음 결정사항

1. 구직 희망조건 기능 후속: 공고 위치 데이터 보강 후 거리 매칭 활성화
   (`DISTANCE_MATCHING_ENABLED`), 크롤러 신규 공고 입력 중단(09-24 이후) 원인 확인,
   기업 계정 화면 운영 확인.
2. 알림벨 패널 좁은 화면 위치 수정 여부.
3. 미커밋 로컬 변경 `crawler/crawl_topcv.py` 처리 여부(이번 커밋 제외).

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-27 — 구직 희망조건 저장·매칭·앱 내 알림 1차** — PRODUCTION DB APPLIED(`job_alerts`) + MASTER PUSHED(`f2f51ac`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자 구직자 세션에서 저장·3분류·수정·중지/재개·알림벨 확인, 테스트 조건 삭제). 거리 조건은 좌표 부족으로 비활성. 기업 화면은 운영 미검증. 도중 post-commit 자동 push 사고(`0c6366e` 약 7분 노출 → `0dff280` revert).
2. **2026-09-26 — Zalo 로그인 계정탈취 긴급수정 + VPS relay HTTPS 전환 + 실사용자 재로그인 E2E까지 완료** — MASTER PUSHED(`c5d7e8f`~`31b76fa`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자가 실제 Zalo 계정으로 재로그인 성공 확인). 도중 발견된 계정 충돌 1건은 DB 직접 조회로 원인 확인 후 사용자 승인 받고 `app_metadata.zalo_id` 1회성 백필로 안전하게 해결.
3. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
4. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
5. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음(필요하면 커밋/배포 로그로 직접 확인).
