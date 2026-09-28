# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**VPS에서 Facebook 크롤러 Bắc Ninh 1회 DRY-RUN — 2026-09-28. 서버 쿠키 만료(session_expired)로
설계대로 즉시 중단. 쿠키 갱신 대기(사용자 결정).** Production DB 변경 없음.
메인 크롤러(vieclam24h)는 사용자 판단으로 계속 의도적 보류 중(cron 주석 상태 그대로 둠).

## 변경 내용

1. **회사 PC VPS 접속 키**: 이 PC(`LAPTOP-1GF55Q0D`, 사용자 `HP`)에는 기록된
   `C:\Users\Admin\.ssh\jobi_vps`가 없었음(Admin 계정 자체 없음). 새 키
   `C:\Users\HP\.ssh\jobi_vps_hp`(ed25519, passphrase 없음) 생성 → 공개키만 저장소
   `ops/jobi_vps_hp.pub` + 등록 스크립트 `ops/k.sh` → AZDIGI VNC 콘솔에서 `git pull` +
   `sh ops/k.sh`로 root `authorized_keys`에 추가(기존 키 유지) → 키 접속 확인.
   `PROJECT_STATUS.md` 참고정보에 새 키 경로 별도 기록(기존 Admin 경로 줄은 그대로).
2. **FB 정기실행 일시중지**: `run_daily.sh`에 `state/FACEBOOK_PAUSED` 스위치 추가
   (`6d76fa7`), 서버에 파일 생성(14:53 VN). 서버 `run_daily.sh`를 크롤러 미실행 모의
   실행으로 확인: "Skipping Facebook crawler: paused" + crawl_topcv만 실행 대상.
3. **서버 실제 스케줄 확인**: root crontab에는 vieclam24h 직접 호출 1줄만 있고
   2026-09-05부터 `[DISABLED]` 주석 상태 → **현재 활성 정기 실행 없음**. 페이스북은
   09-05 이후 어떤 스케줄에도 없음(마지막 FB 실행 로그 09-02, 그때도 쿠키 인증 실패).
   systemd timer·`/etc/cron.d`에도 크롤러 없음. crontab은 건드리지 않음.
4. **최신 코드 반영**: 서버 `/root/jobi` `d04d646 → 4fc348f` fast-forward. 입력 편의상 pull이
   스위치 생성보다 몇 분 먼저였으나, 활성 스케줄이 없어 실행 위험은 없었음.
5. DRY-RUN 집계 추가(`4eaad63`): 채워진 게시물/빈 칸/스킵 사유별/DB 중복(읽기 전용).

## 테스트 결과

- 서버 DRY-RUN(`python3 -u crawl_facebook.py --dry-run --group timvieclamthembacninh`):
  페이지 상태 `session_expired` → 즉시 전체 중단, exit 2. 게시물 0 / 공고 0 / 중복 0.
  증거: 서버 `crawler/state/evidence/20260928_145438_timvieclamthembacninh_session_expired.*`
  — URL `facebook.com/login/?next=…그룹`, 일반 로그인 페이지(본인확인/checkpoint 아님).
- 상태 파일: 실행 전후 `facebook_seen.json` 없음(생성 안 됨). 생긴 건 dry-run 결과 JSON과
  evidence뿐(`state/`는 gitignore). `FACEBOOK_PAUSED` 유지.
- DB(읽기 전용): 전후 동일 — `local_jobs` 281, facebook 0, max id 4681.

## 발견된 문제

1. **서버 FB 쿠키 만료** — 09-02부터 이미 인증 실패 상태였던 것으로 보임. 이 PC의
   `crawler/.env` 쿠키는 오늘 오전까지 정상 로그인됐음(다른 값일 가능성).
2. **보안**: AZDIGI VNC 콘솔이 09-26부터 root 로그인 상태로 열려 있었고, 콘솔 화면에
   `ZALO_RELAY_KEY` 값이 출력돼 있었음(사용자 캡처로 채팅에 노출). 콘솔 `exit` 안내함.
   중계 키 교체(서버 `/etc/zalo-relay.env` + Vercel `ZALO_RELAY_KEY`) 필요.
3. 서버 작업트리에 `.env` 변형 파일(`crawler/.env.`, `.env.bak.*`, `.envecho`)이 untracked로
   남아 있음 — `.gitignore`는 정확히 `.env`만 막으므로 서버에서 `git add -A` 하면 위험.
4. 서버 pull로 `install_zalo_relay.sh`도 갱신됐으나 `zalo_relay.py`는 변경 없음 →
   실행 중인 중계 서비스 영향 없음(재설치 안 함).

## 다음 결정사항

1. 서버 FB 쿠키 갱신(사용자가 직접): 브라우저에서 해당 계정 쿠키(c_user, xs, datr, fr)를
   서버 `crawler/.env`에 직접 입력. 같은 값을 이 PC와 서버에서 동시에 쓰지 않기.
   갱신 후 같은 DRY-RUN 1회 재실행.
2. `ZALO_RELAY_KEY` 교체 여부/시점.
3. 서버 `.env` 변형 파일 정리 여부.
4. FB 정기 실행 재개는 DRY-RUN 결과 확인 후(`rm state/FACEBOOK_PAUSED` + crontab에
   run_daily.sh 등록 결정 필요 — 현재 crontab엔 FB 없음).

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-28 — VPS 회사PC 키 등록 + FB 정기실행 일시중지 + 최신코드 반영 + Bắc Ninh DRY-RUN(세션 만료로 중단)** — MASTER PUSHED, VPS PULLED(`4fc348f`). DB 변경 없음.
2. **2026-09-28 — Facebook 크롤러 보완(빈 칸 조기종료·구직자 홍보글·DB 중복키)** — MASTER PUSHED(`f64f6ab`). 페이스북 재접속·Production DB 저장·VPS 실행 없음.
3. **2026-09-28 — Facebook 크롤러 증분 수집·페이지 판정 재설계 구현 + dry-run 1회** — MASTER PUSHED(`dccf50e`). 크롤러 전용이라 Vercel 배포 무관, VPS 반영은 서버 git pull 필요(미실행).
4. **2026-09-28 — Facebook 크롤러 진단 + 스크롤 버그 수정, 재설계 방향 합의** — MASTER PUSHED(`26f1fde`, 스크롤 수정만). 날짜필터/그룹확장은 설계 합의만, 미착수.
5. **2026-09-27 — 알림벨 패널 잘림 수정** — MASTER PUSHED(`be1165a`) + PRODUCTION DEPLOYED.
