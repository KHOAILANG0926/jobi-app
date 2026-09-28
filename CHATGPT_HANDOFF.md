# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Facebook 그룹 크롤러 보완 3건 — 2026-09-28 IMPLEMENTED + VERIFIED(오프라인 테스트만)
+ MASTER PUSHED.** 사용자 지시로 페이스북 재접속, Production DB 저장, VPS 실행은 하지 않음.
직전 작업(`dccf50e`, 증분 수집·페이지 판정 재설계)의 DRY-RUN에서 나온 문제 ①② 대응.
메인 크롤러(vieclam24h)는 사용자 판단으로 계속 의도적 보류 중.

## 변경 내용

1. **빈 칸이 남은 채 조기 종료하던 문제**: DRY-RUN에서 빈 칸 3~4개가 남은 채
   "게시물 수 2회 연속 증가 없음"으로 끝나 5개만 읽음. 게시물 수만으로는 로딩 지연과
   목록 끝을 구분할 수 없으므로, 스크롤 뒤 빈 칸이 남아 있으면 증가 없음으로 세지 않음
   (`feed_end_decision()`). 목록 끝 판정은 빈 칸 0개 + 2회 연속 증가 없음일 때만. 그 외엔
   기존 스크롤 15회 / 그룹당 240초 상한이 종료. `loading_delay_steps` 통계 추가.
   → 그룹당 실행이 길어질 수 있어 `run_daily.sh` Facebook 기본 제한 45m → 60m.
2. **구직자 홍보글 필터**: `is_self_promotion()` — 1인칭 + "nhận lau/dọn/giúp việc…",
   "chuyên nhận …", "em/mình (đang/cần) tìm việc", "ủng hộ em", "giới thiệu giúp em"이
   있고 **구인 신호(tuyển/lương/thu nhập/ứng viên/hồ sơ/phỏng vấn/triệu/Nk/giờ/Ntr/
   bên mình cần/cần N bạn)가 전혀 없을 때만** 스킵. 원인이던 "EM NHẬN LAU NHÀ…"는
   "ai đang cần người lau dọn"의 `cần người`로 구인 키워드에 걸렸었음.
   추가로 `is_ambiguous_job()`의 `category == "other"` 비교가 09-24 분류 체계 변경
   이후 한 번도 성립하지 않던 문제(새 id는 `khac`)를 `("other","khac")`로 수정.
3. **DB 재저장 방지와 원문 링크 노출 분리**: `source_url`은 계속 비움(지원 버튼
   이동처라 노출 결정 별도). DB 중복은 ① 기존 title+company, ② 새로 추가한 **본문
   지문**(`[source:facebook]` 뒤 본문을 ascii_key 정규화 후 앞 300자 SHA1)으로 막음 →
   제목·회사 추출이 바뀌어도, 상태 파일이 없어져도 같은 글은 다시 저장 안 됨.
   기존 행 조회는 PostgREST 1000행 제한에 안 잘리도록 페이지 단위로 변경.

## 테스트 결과

- `test_facebook_quality.py` 18/18(신규 4: 실제 구직자 글 + 구직 글 2개 거부, 1인칭
  구인글 포함 정상 구인글 6개 통과, 빈 칸 남은 경우 종료 안 함, 본문 지문 중복 방지).
  `test_cli_safety.py` 21/21, `test_job_quality.py` 20/20. `tsc`/`build` 통과.
- **Production 읽기 전용 확인**: `local_jobs` 281행 중 페이스북 수집 행 **0건**("facebook"
  단어가 들어간 5건은 vieclam24h 본문의 "Facebook, Zalo" 언급). 그래서 운영 기존 키로는
  검증할 대상이 없었음 → 대신 DRY-RUN에서 실제 수집한 글(`id:1434860868779384`)로
  "저장됨 → 상태 파일 소실 → 재수집" 재현: 신규 판정 0, 제목 추출이 달라져도 0.

## 발견된 문제

1. Production에 페이스북 공고가 0건 — VPS cron(매일 20:00 VN)이 `run_daily.sh`를 돌리는데
   페이스북 행이 없으니, 서버 `.env`에 FB 쿠키가 없거나 기존 크롤러가 실패 중인 것으로
   추정(서버 미확인). **서버에서 다음에 `git pull`하면 쿠키가 있을 경우 이 새 코드가
   cron으로 DB 저장까지 실행됨** — pull 전에 결정 필요.
2. 빈 칸이 끝까지 안 채워지는 원인 자체(페이스북 쪽 지연인지, 스크롤 방식 문제인지)는
   추가 접속 없이 확정 불가.

## 다음 결정사항

1. VPS 1회 시험 여부와 방식(아래 참고 — 사용자 승인 후):
   - 실행 장소: VPS `/root/jobi/crawler`에서 `git pull` 직후, cron이 아닌 수동으로
     `python3 -u crawl_facebook.py --dry-run --group timvieclamthembacninh` 1회.
   - 쿠키: 이 PC `crawler/.env`의 FB 값을 서버 `.env`로 옮기고(값은 채팅/커밋에 노출 금지)
     이 PC에서는 더 이상 크롤러 실행 안 함. 서버 `.env`에 이미 다른 값이 있으면 먼저 확인.
   - 중단 조건: checkpoint/session_expired → 즉시 중단(exit 2)·재실행 금지, 사람이 브라우저로
     계정 확인. anomaly(피드 없음) → 증거 확인 전 재실행 안 함. cron 자동 실행은 이 시험 결과
     확인 전까지 서버 `.env`에서 FB 쿠키를 빼두거나 cron 시각 전에 시험을 끝냄.
2. 페이스북 원문 링크(`source_url`) 노출 여부.
3. 대상 그룹 목록 재점검·확장.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-28 — Facebook 크롤러 보완(빈 칸 조기종료·구직자 홍보글·DB 중복키)** — MASTER PUSHED(이 커밋). 페이스북 재접속·Production DB 저장·VPS 실행 없음.
2. **2026-09-28 — Facebook 크롤러 증분 수집·페이지 판정 재설계 구현 + dry-run 1회** — MASTER PUSHED(`dccf50e`). 크롤러 전용이라 Vercel 배포 무관, VPS 반영은 서버 git pull 필요(미실행).
3. **2026-09-28 — Facebook 크롤러 진단 + 스크롤 버그 수정, 재설계 방향 합의** — MASTER PUSHED(`26f1fde`, 스크롤 수정만). 날짜필터/그룹확장은 설계 합의만, 미착수.
4. **2026-09-27 — 알림벨 패널 잘림 수정** — MASTER PUSHED(`be1165a`) + PRODUCTION DEPLOYED.
5. **2026-09-27 — 헤더 Tuyển dụng 버튼 초록 변경** — MASTER PUSHED(`2388a44`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(실사이트 계산색 #10b981).
