# CHATGPT_HANDOFF — 이 파일만 읽고 이어받기 (1페이지)

갱신: 2026-10-11. 상세 이력은 `WORK_LOG.md`. 이 파일은 누적하지 않고 최신 스냅샷으로 덮어쓴다.

## 1. 현재 상태

- 작업: 주소 검색 재조회·VietMap 호출 추적. PR #35가 `master`에 병합됐고 merge commit은 `4375492`; 원본 checkout의 modified 2개·untracked 1개는 그대로다.
- 상태: **IMPLEMENTED / VERIFIED / MASTER MERGED / PRODUCTION VERIFIED**. `npx tsc --noEmit`, `npm test` 46/46, `npm run build`가 통과했고 PR #35 CI가 성공했다. GitHub App Git Data API로 보존한 원격 tree는 로컬 검증 커밋 `e615566`의 tree와 일치한다. Vercel Production 배포 `dpl_2zLF3Z5t96bYedop5AFy2Kf2pCBK`가 READY이며 `https://viecganban.vn/` 응답 200을 확인했다. Production DB·DDL·유료 VietMap 호출은 하지 않았다.
- 주소 캐시: `sb-4685`·`sb-4721`만 `address-v2|job-<id>` 버전 키로 기존 실패 캐시를 우회한다. 다른 공고 캐시는 유지하며, 두 공고가 같은 정규화 주소를 공유해도 공고별 키가 충돌하지 않는다.
- 승인 조건: 주소 파싱·회사명·번지/도로·행정구역·후보 유일성·자동 승인 판정은 변경하지 않았다. 새 조회가 실패해도 임의 승인하지 않는다.
- 관리자 주소 결과: 공고 ID별 `cache/fresh/skipped`, 현재 공고 요청 시도 수, 승인/실패 사유를 표시한다. 회사명·주소·POI명·전화번호·Secret은 추적 목록에 표시하지 않는다.
- 호출 집계: 페이지 시도 수(실패·타임아웃·일일 한도 429 포함)와 서버 공유 카운터 시작/검증된 종료/마지막 관측값·증가분·베트남 날짜를 분리한다. 429 공고도 실패 사유·요청 수를 남기고, upstream 429·기타 실패·타임아웃 뒤에도 예약된 서버 사용량을 안전하게 보존한다. 종료 `usage`가 실패하거나 날짜가 바뀌면 delta를 미확정으로 둔다.
- 코드로 확정: 서버는 upstream 호출 전에 카운터를 예약하고, `usage` 조회는 VietMap 호출이나 카운터 증가를 만들지 않는다. 공유 카운터 증가분에는 다른 탭/실행이 포함될 수 있다.
- 운영 로그 없이는 미확정: 기존 `sb-4685`·`sb-4721`의 새 실패 사유, 화면 0회인데 서버 잔여 52→49였던 3회의 실제 주체. 수정 후 관리자 재실행 결과가 필요하다.
- 이전 운영 결과 보존: 사용자가 xã/phường 버튼 실행 후 24개 행정구역·84건 적용 완료를 보고했다. 기존 예상 64건과 20건 차이의 원인은 아직 미확정이다.

## 2. 다음 할 일 3개

1. 별도 승인된 관리자 재실행에서 `sb-4685`·`sb-4721`의 fresh 사유와 시작/종료 서버 카운터를 수집한다.
2. 재실행 결과로 기존 서버 잔여 52→49의 3회 주체와 두 공고의 실패 원인을 운영 로그 범위에서 확정한다.
3. 후속 변경이 필요하면 최신 `origin/master`와 서비스 권한·GitHub 보존 경로를 먼저 확인한 뒤 최소 범위로 진행한다.

## 3. 필수 규칙

- 시작 시 `CLAUDE.md`·`AGENTS.md`·이 파일·`VIECGANBAN_STRUCTURE_BASELINE.md`와 branch/HEAD/status/origin/master를 확인한다. 기존 checkout의 변경은 건드리지 않는다.
- 완료 전 `npx tsc --noEmit`, `npm test`, `npm run build`. 상태는 IMPLEMENTED → VERIFIED → BRANCH PUSHED/PR → PRODUCTION DEPLOYED → PRODUCTION VERIFIED로 구분한다.
- DDL·Production DB 변경·데이터 삭제/대량 수정·Auth/RLS·결제·Secret·Production 배포는 사람 승인 없이 실행하지 않는다. 자동화는 master 직접 push 금지, 새 branch+PR만 사용한다.
- PC에 키·수집 데이터·결과 파일을 별도 저장하지 않는다. Secret과 개인정보는 로그·커밋·PR·응답에 출력하지 않는다.
- 자동 승인 기준을 완화하지 않는다. 위치는 검증된 좌표만 승인하며, 공유 카운터 차이를 다른 실행의 호출이라고 단정하지 않는다.
- 완료 보고는 5줄 이내로 한다.
