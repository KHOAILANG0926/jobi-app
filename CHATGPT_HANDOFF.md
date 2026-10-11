# CHATGPT_HANDOFF — 이 파일만 읽고 이어받기 (1페이지)

갱신: 2026-10-11 (Claude). 상세 이력은 `WORK_LOG.md`. 이 파일은 누적하지 않고 최신 스냅샷으로 덮어쓴다.

> **숫자·상태의 기준은 이 파일이 아니라 `status` 브랜치의 `STATUS.md`다**(GitHub Actions 자동 생성):
> https://github.com/KHOAILANG0926/jobi-app/blob/status/STATUS.md — 이 파일과 다르면 STATUS.md가 맞다.

## 1. 현재 상태

- **정정(2026-10-11 직접 확인):** 직전 스냅샷의 "npm test 46/46"은 사실이 아니다(master·GitHub Actions 모두 45/46, `api/_zalo-token.test.ts` 실패). "원격 tree = 로컬 커밋 e615566"은 e615566이 GitHub에 없어 근거가 되지 않는다. 10/8 "주소 재실행 신규 승인 0건"도 DB 기록(#4721 승인)과 다르다.
- **재발 방지 장치(PR #37):** STATUS.md 자동 생성, `status` 브랜치 수동 push·검증 장치 변경 PR 감시. AGENTS.md·CLAUDE.md 맨 위 "보고 검증 규정"이 최우선이다.
- **승인 규칙 B안(2026-10-11 사용자 결정):** 자동 핀은 ① 주소 검색에서 번지+도로 일치 ② 회사명 정확 일치 + KCN 윤곽 안, 두 경우뿐. KCN 밖 회사명만 일치 → 핀 없음(`name_only_no_house`).
- **DB:** #4702·#4720 승인 철회(사용자 승인).
- **#4685:** 2026-10-11 07:43(VN) `address-v2` 키로 새로 검색(호출 1회) → VietMap 주소 미발견. 승인 기준 문제가 아니다.
- **master 보호(2026-10-11 설정, 직접 확인):** PR 필수, 필수 검사 `checks`(타입·테스트·빌드)·`guard`, 우회 금지(관리자 포함). master에 직접 push 불가 — 모든 변경은 PR로. 테스트는 46/46(Zalo 테스트 수정, PR #39).
- **#4750:** B2B 영업직 게재 제외 기준으로 숨김 처리·핀 철회(사용자 지시). 공개 승인 핀은 #4713·#4721.
- **미확인:** 동네 지도 84건·KCN 지도 28건 수치(DB상 KCN 지정 31건), Production 화면 직접 확인.

## 2. 다음 할 일 3개

1. 사용자 지시 대기: Goong 계정 활성화 후 상세주소 14건 VietMap·Goong 비교(결과 저장·지도 표시 없이 비교표만). Goong 약관(좌표 저장·타사 지도 표시) 서면 확인 전에는 실사용 금지.
2. 사용자 지시 대기: B2B 영업직 게재 제외 필터(PROJECT_STATUS.md 기준, 크롤러 미반영) 구현 여부.
3. 작업을 시작하면 먼저 STATUS.md와 이 파일을 대조하고, 다른 점만 보고한다.

## 3. 필수 규칙

- 보고 항목마다 [직접 확인](실행한 명령+결과)/[기존 기록]/[추정]. 실행하지 않은 검색·테스트·배포를 했다고 쓰지 않는다.
- STATUS.md·`status` 브랜치·`scripts/status/`·`.github/workflows/status-*.yml`은 사용자 직접 지시 없이 수정 금지.
- 완료 전 `npx tsc --noEmit`, `npm test`, `npm run build`. DDL·Production DB 변경·데이터 삭제·Auth/RLS·Secret은 사용자 승인 없이 실행하지 않는다.
- PC에 키·데이터·결과 파일 저장 금지. 자동화는 master 직접 push 금지.
- 자동 승인 기준을 완화하지 않는다. 완료 보고는 5줄 이내.
