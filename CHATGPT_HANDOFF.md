# CHATGPT_HANDOFF — 이 파일만 읽고 이어받기 (1페이지)

갱신: 2026-10-11 (Codex, PR #48). 이번 WORK_LOG 갱신은 기존 사용자 지시로 보류. 이전 운영 지침과 미완료 항목을 보존한다. 이 파일은 누적하지 않고 최신 스냅샷으로 덮어쓴다.

> **숫자·상태의 기준은 이 파일이 아니라 `status` 브랜치의 `STATUS.md`다**(GitHub Actions 자동 생성):
> https://github.com/KHOAILANG0926/jobi-app/blob/status/STATUS.md — 이 파일과 다르면 STATUS.md가 맞다.

## 1. 현재 상태

- **[직접 확인] 현재 작업:** `codex/job-posting-policy`, Draft PR #48. 시작/재확인 master `9157ced522d024b2c378958f623beffbdfeb1aba`. 신규 공고 정책 앱 검사 구현; DB 강제는 미구현. 구현 근거·전체 수정 목록: `docs/job-posting-policy-implementation-2026-10.md`.
- **[직접 확인] 변경:** Python/TS 공통 JSON 역할 규칙·39개 합성 사례. 금융/채권추심/B2B 외근·대리점 전담 제외, 전문 고수입·인센티브 영업 review, 금액만으로 제외 금지, 정상 매장/마트/생산/QC 허용. crawler의 review/exclude는 skip. 앱 등록·수정·재공개 preflight 및 공개 fetch hidden 조건 연결.
- **[직접 확인] 테스트:** 코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`; Actions 38154323163 tsc 성공·npm test 50/50 파일·build 성공. Actions 38154323195 Python 정책 6개/기존 품질 21/21·문법 검사 성공. 실제 수집·Production 쓰기·브라우저/RLS 통합 검사 없음.
- **[직접 확인]/[추정] 발견된 문제:** raw RPC/REST/SQL/service-role 및 SELECT→UPDATE 경쟁 조건 우회가 남음. DB/Edge/VPS 설치 상태와 영향 ID는 미확인. pending 정책 SQL은 주석 설계/롤백만; 적용 금지. 기존 공개 위반 공고의 편집·재활성 거절 가능, 게스트 active 편집은 hidden 상태 불명으로 보수적 검사.
- **[직접 확인] PR #47:** Draft·미병합, head `443468b24c554ad5ea44df6c8e4a53e41c925dc8`. PR #48도 병합·배포·자동 수집 재개 금지. STATUS·location guard·한국 모듈·PR46 보고서 변경 없음.
- **[기존 기록] 아래 운영 항목은 이전 snapshot에서 보존한 기록이며 이번에 Production 재검증하지 않았다. 숫자·상태는 STATUS 생성 2026-10-11 12:12(VN)를 우선한다(master 검사 47/47, 아래 이전 46/46 문구보다 우선).

- **정정(2026-10-11 직접 확인):** 직전 스냅샷의 "npm test 46/46"은 사실이 아니다(master·GitHub Actions 모두 45/46, `api/_zalo-token.test.ts` 실패). "원격 tree = 로컬 커밋 e615566"은 e615566이 GitHub에 없어 근거가 되지 않는다. 10/8 "주소 재실행 신규 승인 0건"도 DB 기록(#4721 승인)과 다르다.
- **재발 방지 장치(PR #37·#40·#42·#43·#44):** STATUS.md 자동 생성(배포 완료 대기 후 기록). 승인 핀마다 사이트 서버(`api/status-recheck`, GitHub OIDC 인증)가 VietMap에 ref로 재조회해 저장 좌표와 대조(2026-10-11 12:09 #4713·#4721 ✅ 0 m). 검증 장치 변경 PR은 `검증장치-승인` 라벨 필요(#42·#43·#44는 Lee 채팅 승인으로 Claude가 대리 부착, PR 댓글에 기록). AGENTS.md·CLAUDE.md 맨 위 "보고 검증 규정"이 최우선이다.
- **승인 규칙 B안(2026-10-11 사용자 결정):** 자동 핀은 ① 주소 검색에서 번지+도로 일치 ② 회사명 정확 일치 + KCN 윤곽 안, 두 경우뿐. KCN 밖 회사명만 일치 → 핀 없음(`name_only_no_house`).
- **DB:** #4702·#4720 승인 철회(사용자 승인).
- **#4685:** 2026-10-11 07:43(VN) `address-v2` 키로 새로 검색(호출 1회) → VietMap 주소 미발견. 승인 기준 문제가 아니다.
- **master 보호(2026-10-11 설정, 직접 확인):** PR 필수, 필수 검사 `checks`(타입·테스트·빌드)·`guard`, 우회 금지(관리자 포함). master에 직접 push 불가 — 모든 변경은 PR로. 테스트는 46/46(Zalo 테스트 수정, PR #39).
- **#4750:** B2B 영업직 게재 제외 기준으로 숨김 처리·핀 철회(사용자 지시). 공개 승인 핀은 #4713·#4721.
- **보류:** `supabase/pending/20261011120000_location_approval_evidence_guard.sql`(글자 검사라 위조 가능 — GPT 교차 검증 지적). 적용하지 않는다.
- **미확인:** 동네 지도 84건·KCN 지도 28건 수치(DB상 KCN 지정 31건), Production 화면 직접 확인.

## 2. 다음 할 일 3개

1. 사용자 지시 대기: Goong 계정 활성화 후 상세주소 14건 VietMap·Goong 비교(결과 저장·지도 표시 없이 비교표만). Goong 약관(좌표 저장·타사 지도 표시) 서면 확인 전에는 실사용 금지.
2. [직접 확인] 기존 B2B 필터 구현 대기는 PR #48 앱 구현/오프라인 검증으로 진행됨. 다음 결정사항: 이 Draft 검토, review 공개 거절/skip 방식·기존 공개 공고 편집 제한·DB 강제/관리자 예외 승인 여부. [추정] 승인된 Production SELECT로 영향 ID·catalog 확인 후 별도 DB 격리 검증. 운영 알림/재검증 자동화는 미구현.
3. 작업을 시작하면 먼저 STATUS.md와 이 파일을 대조하고, 다른 점만 보고한다.

## 3. 필수 규칙

- 보고 항목마다 [직접 확인](실행한 명령+결과)/[기존 기록]/[추정]. 실행하지 않은 검색·테스트·배포를 했다고 쓰지 않는다.
- STATUS.md·`status` 브랜치·`scripts/status/`·`.github/workflows/status-*.yml`은 사용자 직접 지시 없이 수정 금지.
- 완료 전 `npx tsc --noEmit`, `npm test`, `npm run build`. DDL·Production DB 변경·데이터 삭제·Auth/RLS·Secret은 사용자 승인 없이 실행하지 않는다.
- PC에 키·데이터·결과 파일 저장 금지. 자동화는 master 직접 push 금지.
- 자동 승인 기준을 완화하지 않는다. 완료 보고는 5줄 이내.
