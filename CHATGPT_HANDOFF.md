# CHATGPT_HANDOFF — 이 파일만 읽고 이어받기 (1페이지)

갱신: 2026-10-11 (Codex, PR #48). 이번 WORK_LOG 갱신은 기존 사용자 지시로 보류. 이전 운영 지침과 미완료 항목을 보존한다. 이 파일은 누적하지 않고 최신 스냅샷으로 덮어쓴다.

> **숫자·상태의 기준은 이 파일이 아니라 `status` 브랜치의 `STATUS.md`다**(GitHub Actions 자동 생성):
> https://github.com/KHOAILANG0926/jobi-app/blob/status/STATUS.md — 이 파일과 다르면 STATUS.md가 맞다.

## 1. 현재 상태

- **[직접 확인] 2026-10-12 인자 수정:** 같은 PR48 브랜치, 안전장치 유지·caller confirmation 정합화. 수집 금지 준수: Actions job `if: false` 중지, daily 무인자 exit2; 재개 승인 후에만 `--confirm-scheduled-run` 전달. 근거 `docs/crawler-cli-fix-2026-10-12.md`. 실제 수집/DB 변경 없음.
- **[직접 확인]/[추정] 운영 로그:** 최신 조회 crawl run33221622201·33128901992는 설치 libasound2/exit100 failure, 크롤링 skipped. 현재 인자 오류로 운영 실패 중이라는 증거 없음, VPS 상태 미확인. CLI 오프라인15개 성공(run38183216848); 최신 checks는 최종 PR 실행 기록 참조.

- **[직접 확인] 현재 작업:** 같은 `codex/job-posting-policy`, Draft PR48 미병합. master `9157ced522d024b2c378958f623beffbdfeb1aba`. 후속 근거: `docs/job-policy-followup-2026-10.md`(운영 조회 미실행·설계·50커밋·crawl 인자 근거).
- **[직접 확인] 변경/테스트:** guest hidden=false 가정을 제거해 비공개 편집 보존·공개 membership 검사. code SHA `082911b790bdbe4fcfbef0bee1b5455574659ce7`, checks38155634979 tsc/npm50/50/build 성공, Python38155634893 정책6/품질21/21 성공. 정상 공고39 합성 사례 유지. 실제 운영/브라우저 검증 아님.
- **[직접 확인]/[추정] 발견된 문제:** 운영 전체 판정은 연결 미확보 및 임시 감사 생성 차단으로 미실행; 건수·ID·제목 미확인. raw RPC/SQL/service-role와 race 우회 남음. 리뷰 보존·관리자 사유 예외는 `supabase/pending/20261011_job_policy_review_exception_design.sql` 주석 설계뿐. crawl.yml/run_daily.sh 인자 불일치는 2026-10-12 수정했으나 실행 중지 유지, VPS 미확인.

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
2. [직접 확인] 다음 결정사항: 승인된 Production 읽기 연결 확보→전체 공개 판정·영향 ID 제출; review 비공개 보존·관리자 사유 예외의 DB 설계 승인→격리 검증. 지금 DB 적용/공고 변경/수집 재개 금지, PR47/48 Draft 유지. 운영 알림은 미구현.
3. 작업을 시작하면 먼저 STATUS.md와 이 파일을 대조하고, 다른 점만 보고한다.

## 3. 필수 규칙

- 보고 항목마다 [직접 확인](실행한 명령+결과)/[기존 기록]/[추정]. 실행하지 않은 검색·테스트·배포를 했다고 쓰지 않는다.
- STATUS.md·`status` 브랜치·`scripts/status/`·`.github/workflows/status-*.yml`은 사용자 직접 지시 없이 수정 금지.
- 완료 전 `npx tsc --noEmit`, `npm test`, `npm run build`. DDL·Production DB 변경·데이터 삭제·Auth/RLS·Secret은 사용자 승인 없이 실행하지 않는다.
- PC에 키·데이터·결과 파일 저장 금지. 자동화는 master 직접 push 금지.
- 자동 승인 기준을 완화하지 않는다. 완료 보고는 5줄 이내.
