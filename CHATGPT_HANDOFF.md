# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Facebook 그룹 크롤러(`crawl_facebook.py`)를 지속 가능한 주력 수집 경로로 만들기 위한
증분 수집 + 페이지 상태 판정 재설계 — 2026-09-28 IMPLEMENTED + VERIFIED(단위테스트,
오프라인 DOM 테스트, Bắc Ninh DRY-RUN 1회) + MASTER PUSHED.** VPS 반영(git pull)은 안 함.
메인 크롤러(vieclam24h)는 사용자 판단으로 계속 의도적 보류 중.

## 변경 내용

1. **증분 수집(연속 N개 중단 규칙은 사용자 지시로 미사용)**: 게시물 키 = 퍼머링크
   숫자 ID(`/posts/<id>/`), 없으면 본문 해시. 그룹별 처리한 키 최근 500개를
   `crawler/state/facebook_seen.json`(gitignore, 서버 로컬)에 저장, 이미 본 글은
   처리만 건너뛰고 수집은 **고정 상한**(스크롤 15회 / 그룹당 240초 / 공고 30개 /
   2회 연속 미증가)까지 계속. 이전 실행과 겹친 글 수(overlap)를 기록하고, 이전
   상태가 있는데 겹침 0이면 "누락 가능" 경고. 상태 파일은 **DB 저장 성공 후에만** 갱신.
2. **자리 표시자**: 텍스트·링크 없는 최상위 요소는 "빈 칸"으로 따로 집계(이미 본
   글/끝으로 판단 안 함). 절반 넘게 빈 칸이면 해당 위치로 스크롤 후 2초 대기·재추출 1회.
   댓글(게시물 안 중첩 role=article)은 이제 게시물 후보에서 제외.
3. **정렬/고정 글**: `sorting_setting=CHRONOLOGICAL`은 미검증이라 안 씀(기본 URL만).
   연속-중단 규칙이 없으므로 활동순 재노출·고정 글은 "이미 본 키면 건너뜀"으로 처리.
4. **페이지 상태 판정 교체**: 옛 `is_login_wall()`(한국어 UI에서 오탐 가능) 삭제 →
   `classify_page_signals()`: URL `/checkpoint`·본인확인 문구(피드 없을 때만) =
   checkpoint, URL `/login`·`c_user` 쿠키 소실 = session_expired → **전체 즉시 중단
   (exit 2), 사람 확인 전 재실행 금지**. 로그인 유지 + 피드 없음 = anomaly → 그 그룹만
   건너뜀, 2개 그룹 연속이면 전체 중단. 로딩 실패는 60초 뒤 1회만 재시도. 비정상
   페이지는 `crawler/state/evidence/`에 스크린샷+본문 앞 2000자 저장.
5. **작성 시각**: 시간 링크 문구(ko/vi/en 상대·절대) → `{estimate, precision}` 추정.
   `posted_at` 사용처 확인 결과 사이트 목록 정렬·날짜표시용 date이고 모든 크롤러가
   수집일(TODAY)을 넣음 → **`posted_at`은 수집일 유지**, 추정 작성시각은 DB에 안 넣고
   dry-run 결과/로그에만.
6. **`source_url` 미사용**: 값이 있으면 지원 버튼이 "Xem tin gốc & Ứng tuyển"으로 그
   링크로 보냄(`resolveApplyRoute`) — 페이스북 링크를 넣는 건 제품 결정이라 보류.
7. CLI: `--dry-run`(DB·상태 파일 변경 없음, `state/facebook_dryrun_*.json`만),
   `--group <URL 일부>`. 그룹 사이 60~120초 대기 추가.

## 테스트 결과

- `test_facebook_quality.py` 14/14(신규 7: 게시물 ID/해시, 상대·절대 시각, 판정
  분류(한국어 피드+"log in" 단어 → ok 포함), 상태 병합). `test_cli_safety.py` 21/21.
- 오프라인 DOM 테스트: 댓글 제외, 빈 칸 2개 집계, 시간 링크·ID 추출 확인.
- `npx tsc --noEmit`, `npm run build` 통과(프론트 변경 없음).
- **Bắc Ninh DRY-RUN 1회(기본 URL)**: 상태 ok, 6스텝, 게시물 5개 전부 ID 확보·시간
  파싱 성공(6시간/18시간/1일/2일/3일 — 이 샘플에선 최신순으로 나열됨), 빈 칸 최대 4개
  (대기 3회에도 안 채워짐), 종료 사유 no_growth, 공고 1건. DB·상태 파일 변경 없음.

## 발견된 문제

1. **로딩량이 적음**: 6스텝 동안 게시물 5개(3일치)만 채워지고 빈 칸 3~4개는 계속
   비어 있다가 no_growth로 끝남. 이 그룹 기준 하루 1회 실행이면 3일치 범위라 이전
   실행과 겹침은 확보되지만, 더 활발한 그룹에서는 상한 안에 겹침이 안 생길 수 있음 —
   overlap 경고로 감지되게 해둠.
2. 수집된 공고 1건 "EM NHẬN LAU NHÀ Ạ – AI CẦN THÌ ỦNG HỘ EM!"은 **구직자 본인 홍보글**
   (구인 아님)인데 통과함 — `is_job_post()`/`is_ambiguous_job()` 품질 문제, 미수정.
3. 오전 진단 때 맨 위에 있던 "익명의 참여자" 글(ID 1437419115190226)이 오후 dry-run에선
   안 보임(삭제/승인 대기 추정, 미확인).
4. 오전 `sorting_setting=CHRONOLOGICAL` URL 판정 걸림 원인은 여전히 미확정(옛 판정
   로직 오탐 가능성 큼). 이후 기본 URL 접속 2회는 모두 정상, 보안 신호 없음.

## 다음 결정사항

1. VPS에 반영할지(서버 `git pull` + 서버 `.env`에 FB 쿠키 유무 확인). 같은 쿠키를 이
   PC와 VPS 양쪽에서 쓰지 않도록 운영 위치를 한 곳으로 정하기.
2. 빈 칸이 안 채워지는 문제 — 스크롤 방식 조정이 필요한지(추가 접속 필요, 목적·횟수
   정해서 승인 후).
3. 구직자 홍보글 필터(위 2번) 추가 여부.
4. 페이스북 공고에 원문 링크(`source_url`)를 넣어 지원 버튼을 페이스북으로 보낼지.
5. 그 후 대상 그룹 목록 재점검·확장(기존 계획 3번).

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-28 — Facebook 크롤러 증분 수집·페이지 판정 재설계 구현 + dry-run 1회** — MASTER PUSHED(이 커밋). 크롤러 전용이라 Vercel 배포 무관, VPS 반영은 서버 git pull 필요(미실행).
2. **2026-09-28 — Facebook 크롤러 진단 + 스크롤 버그 수정, 재설계 방향 합의** — MASTER PUSHED(`26f1fde`, 스크롤 수정만). 날짜필터/그룹확장은 설계 합의만, 미착수.
3. **2026-09-27 — 알림벨 패널 잘림 수정** — MASTER PUSHED(`be1165a`) + PRODUCTION DEPLOYED.
4. **2026-09-27 — 헤더 Tuyển dụng 버튼 초록 변경** — MASTER PUSHED(`2388a44`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(실사이트 계산색 #10b981).
5. **2026-09-27 — 구직 희망조건 저장·매칭·앱 내 알림 1차** — PRODUCTION DB APPLIED(`job_alerts`) + MASTER PUSHED(`f2f51ac`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자 구직자 세션에서 저장·3분류·수정·중지/재개·알림벨 확인). 거리 조건은 좌표 부족으로 비활성. 도중 post-commit 자동 push 사고(`0c6366e` 약 7분 노출 → `0dff280` revert).
