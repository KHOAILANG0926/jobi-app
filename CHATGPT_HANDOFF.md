# CHATGPT_HANDOFF — PR #47·#49 안전 통합 스냅샷

갱신: 2026-10-12. 운영 숫자는 status 브랜치 STATUS.md(조회 생성 시각 2026-10-12 09:40 VN) 우선.

## 1. 현재 상태

- [직접 확인] master 기준 9157ced522d024b2c378958f623beffbdfeb1aba; 통합 로컬 브랜치 codex/integrate-crawler-policy-20261012. PR47 443468b24c554ad5ea44df6c8e4a53e41c925dc8 + PR49 cc14ea45e7889d6155680cdb535e4b4ee5e258d6. 원본 checkout master/d3940fa와 26개 기존 변경 보존, 기존 두 PR Draft 유지.
- [직접 확인] merge-tree/실제 무커밋 병합 충돌은 HANDOFF뿐. crawler 자동 병합. PR47 예약 confirmation·수동 default=false·축약/혼합 인자 차단과 PR49 금융/B2B 정책·공개 쓰기 gate를 함께 유지한다. --confirm-full-crawl 안전장치 유지; 통합은 수집 재개 승인이 아니다.
- [직접 확인] vercel.json은 기존 PR49 브랜치 false와 새 통합 브랜치 false만 유지/추가. 최초 원격 브랜치 생성 전에 이 설정이 포함된 로컬 커밋을 검증한다. 첫 push 후 branch/SHA별 Vercel 배포 0건을 확인하기 전 PR 작성 금지; 예상치 못한 배포면 즉시 중단.
- [직접 확인] 로컬 통합 Python 정책2+쓰기3, 품질21/21, CLI14/14(기존 safety21 포함), JS/Python/SQL35 memory parity·정상4직종 lifecycle, tsc/npm49/49/client·SSR build 통과. [직접 확인] 최초 push SHA 50a7bb501407d0ceddb43db3935ac399afcb4ab9. git show HEAD:vercel.json으로 두 브랜치 false와 부모 PR47/49를 확인한 뒤 원격 생성. Vercel exact branch/SHA 조회 Preview 0 / Production 0 (2026-10-12 14:19:31 UTC); PR 생성 후 재조회도 0. Draft PR #50 https://github.com/KHOAILANG0926/jobi-app/pull/50. 최초 SHA 필수 CI: STATUS 위조 감시: 38262081479 success; Offline crawler CLI regression: 38262081531 success; Offline job policy: 38262081460 success; PR 검사 (병합 전 필수): 38262081499 success. CI 로그: tsc/npm 49/49/build, Python 정책2+쓰기3/품질21, SQL35 및 정상4직종 lifecycle, CLI14 모두 성공. 아래 문서 스냅샷 갱신 커밋의 CI/배포 여부는 최종 PR 설명에서 추가 확인한다. [추정/미확인] 운영 RPC/RLS/trigger/권한, UI E2E, Facebook 전체 suite, VPS SHA/crontab/runtime/import는 미확인.
- [기존 기록] PR49 금융 전담/부수 채권관리 구분, B2B 외근 주업무 제한·내근/매장 허용, 20M 단독 제외 없음. 기존 공개 소급 숨김 방지, 일반 수정/비공개 전환 허용, 내용 수정/재공개 실패 시 차단. 예외 #4394/#4455·과거37건은 master 주석 기록이며 운영 원문 미확인.
- [직접 확인] SQL은 pending/ROLLBACK 초안만이며 격리 메모리 DB 이외 적용 금지. 운영 trigger 없이는 직접 SQL/service-role·동시 수정 우회 미해결. 공개 RPC evaluator·관리자 예외·비공개 검토 저장은 별도 승인 필요.
- [기존 기록] Vercel Git 연동 jobi, Production Branch master, Preview Branch Tracking 모든 미지정 브랜치 활성. 브랜치 false는 master/다른 브랜치를 차단하지 않으며 CLI/API/Deploy Hook을 막지 않는다. 향후 승인된 병합 전 임시 차단 항목 처리는 외부 배포 차단을 실제 확인한 뒤 별도 결정한다.

- [기존 기록] **정정(2026-10-11 직접 확인):** 직전 스냅샷의 "npm test 46/46"은 사실이 아니다(master·GitHub Actions 모두 45/46, `api/_zalo-token.test.ts` 실패). "원격 tree = 로컬 커밋 e615566"은 e615566이 GitHub에 없어 근거가 되지 않는다. 10/8 "주소 재실행 신규 승인 0건"도 DB 기록(#4721 승인)과 다르다.
- [기존 기록] **재발 방지 장치(PR #37·#40·#42·#43·#44):** STATUS.md 자동 생성(배포 완료 대기 후 기록). 승인 핀마다 사이트 서버(`api/status-recheck`, GitHub OIDC 인증)가 VietMap에 ref로 재조회해 저장 좌표와 대조(2026-10-11 12:09 #4713·#4721 ✅ 0 m). 검증 장치 변경 PR은 `검증장치-승인` 라벨 필요(#42·#43·#44는 Lee 채팅 승인으로 Claude가 대리 부착, PR 댓글에 기록). AGENTS.md·CLAUDE.md 맨 위 "보고 검증 규정"이 최우선이다.
- [기존 기록] **승인 규칙 B안(2026-10-11 사용자 결정):** 자동 핀은 ① 주소 검색에서 번지+도로 일치 ② 회사명 정확 일치 + KCN 윤곽 안, 두 경우뿐. KCN 밖 회사명만 일치 → 핀 없음(`name_only_no_house`).
- [기존 기록] **DB:** #4702·#4720 승인 철회(사용자 승인).
- [기존 기록] **#4685:** 2026-10-11 07:43(VN) `address-v2` 키로 새로 검색(호출 1회) → VietMap 주소 미발견. 승인 기준 문제가 아니다.
- [기존 기록] **master 보호(2026-10-11 설정, 직접 확인):** PR 필수, 필수 검사 `checks`(타입·테스트·빌드)·`guard`, 우회 금지(관리자 포함). master에 직접 push 불가 — 모든 변경은 PR로. 테스트는 46/46(Zalo 테스트 수정, PR #39).
- [기존 기록] **#4750:** B2B 영업직 게재 제외 기준으로 숨김 처리·핀 철회(사용자 지시). 공개 승인 핀은 #4713·#4721.
- [기존 기록] **보류:** `supabase/pending/20261011120000_location_approval_evidence_guard.sql`(글자 검사라 위조 가능 — GPT 교차 검증 지적). 적용하지 않는다.
- [기존 기록] **미확인:** 동네 지도 84건·KCN 지도 28건 수치(DB상 KCN 지정 31건), Production 화면 직접 확인.

## 2. 다음 할 일 3개

1. 통합 격리 검사·첫 차단 커밋 push·Vercel 배포0 확인·Draft PR #50·필수 CI 성공까지 확인. 문서 스냅샷 갱신 후 최종 SHA의 CI/배포0를 PR 설명에서 재확인. 두 원본 PR 병합/종료·배포·실제 수집 금지.
2. 승인된 읽기 연결에서 운영 권한/RPC/RLS/trigger·VPS 실행/로그·필요 원문·UI를 검증. DB 강제·검토 저장·수집 재개·임시 배포 차단 해제는 각각 별도 승인. 기존 B2B 필터 구현 대기는 PR49 앱 구현 단계로 진행됐으나 운영 적용은 미승인.
3. Goong 계정 활성화 후 상세주소14건 VietMap/Goong 비교는 사용자 지시 대기(결과 저장·지도 표시 없이 비교표만). 좌표 저장/타사 지도 표시 약관 서면 확인 전 실사용 금지. 새 작업은 STATUS와 이 파일의 차이부터 보고한다.

## 3. 필수 운영 규칙

- 모든 보고에 [직접 확인](실행/조회+결과)/[기존 기록]/[추정]. 실행하지 않은 검색·테스트·배포·DB 조회를 했다고 쓰지 않는다. 보고 5줄 이내.
- STATUS.md/status/scripts/status/status-*.yml·기존 보호 장치·location approval guard 수정/적용 금지. 자동 좌표 승인 B안 완화 금지.
- tsc/noEmit·npm test·build 및 통합 Python/SQL/CLI 검증. DDL·Production 쓰기·데이터 삭제·Auth/RLS·기존 공고 변경·유료 API·배포·병합·실제 수집은 사용자 별도 승인 없이 실행 금지.
- PC에 키·토큰·운영 데이터·백업·결과 파일 저장 금지, gh auth login·env pull 금지. 코드/합성 fixture만 격리 작업 디렉터리에서 처리. 공개 WORK_LOG에 비공개 자료 복사 금지; 기존 WORK_LOG 갱신 보류 유지.
- 원본 checkout/미커밋 파일·원본 PR47/49 보존. master 직접 push 금지. 새 통합 브랜치 최초 원격 SHA에 두 branch false가 없으면 push 금지.

