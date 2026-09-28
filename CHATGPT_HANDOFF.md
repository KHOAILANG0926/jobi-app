# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Facebook 크롤러: Bắc Ninh 그룹 전문 구인글 소량 저장 검증 — 2026-09-28 완료.
Production DB 1건 저장(`local_jobs.id=4682`) + 사이트 상세 표시 확인.** FB 정기 실행은
계속 일시중지(서버 `crawler/state/FACEBOOK_PAUSED`, crontab에도 FB 없음).
메인 크롤러(vieclam24h)는 사용자 판단으로 계속 의도적 보류 중(cron 주석 상태 그대로).

## 변경 내용

1. **서버 FB 쿠키 교체**: 이 PC `crawler/.env`의 FB 4항목만 SSH stdin으로 서버 `.env`에
   반영(다른 3줄 보존, 권한 644→600, 값 출력 없음). 이후 이 PC에서는 같은 쿠키로 크롤러
   실행 안 함.
2. **'더 보기' 전문 추출**(`47d319b`, `421b4f3`, `4dcd75a`):
   - 본문 소속 '더 보기'만 클릭(글자 정확히 일치하는 최심 요소 → 가장 가까운 role=button,
     링크·댓글 제외). 잘린 글은 그 게시물만 실제 클릭으로 펼쳐 최대 3초 재확인.
   - 펼치기 실패 글은 저장 안 하고 '본 글'로도 기록 안 함(다음 실행 재시도), 실패 시
     후보 요소 구조를 결과 JSON `truncated_debug`에 기록(값 없음).
   - VPS 진단: '…'로 끝나지만 '더 보기' 요소가 전혀 없는 글 = 작성자 말줄임표 → 화면
     확인 시 `fb_full_text_confirmed`로 전문 인정. 확인 표시 없이 '…'로 끝나면 저장 직전
     검사(`missing_required`)에서 계속 차단.
   - 저장 직전 필수조건: 본문 잘림 / 제목 / 연락처 / 지역 / 구직자 홍보글.
   - 급여 `TRIỆU/THÁNG` 대문자 월 단위 보존(예전엔 `30 TRIỆU/`), 회사명 뒤 `TUYỂN DỤNG…` 제거.
   - `--save-from <dryrun.json> --post-keys id:..,id:.. --max-save 2`: 결과 파일에서 지정
     게시물만 원문 재추출 후 저장(페이스북 재접속 없음).
3. **Production 저장**: 16:11 DRY-RUN 결과에서 2건 지정 → 프로젝트 관리자 1건 저장(ID 4682),
   보조강사 1건은 '본문 잘림·연락처 없음'으로 저장 제외.

## 테스트 결과

- 오프라인: `test_facebook_quality.py` 22/22, `test_cli_safety.py` 21/21, `test_job_quality.py` 20/20.
  DOM 테스트: '더 보기' 3가지 구조(role=button / 버튼 안 span / role 없는 요소) 모두 펼침 성공,
  링크·댓글 '더 보기'는 클릭 안 함, 버튼 없으면 진단만 남기고 실패.
- VPS DRY-RUN(오늘 FB 접속: 14:54 만료쿠키 1, 16:11, 16:39, 16:43 — 16:43은 수정 후 같은 목적 재확인):
  - 16:11(구 추출): 채워진 게시물 8, 구인 2(PM·보조강사), 구직 홍보 1 제외, 비구인 5.
  - 16:39/16:43(새 추출): 채워진 게시물 2~3, 공고 0, 잘림 1(= 작성자 '…', 이후 수정),
    비구인 2. PM 글은 이 두 실행에서 피드에 안 나옴(삭제/노출 변화 여부 미확인).
- 저장: 저장 전 점검 PM '신규/필수조건 문제 없음', 보조강사 '본문 잘림·연락처 없음' → 저장 1.
  같은 명령 재실행 → 'DB 중복', 저장 0. DB `local_jobs` 281→282, facebook 0→1.
- 사이트: `https://viecganban.vn/viec-lam/sb-4682` 200, 제목·급여(30 TRIỆU/THÁNG)·지역(Bắc Ninh)·
  전화(0344849982)·업무설명 전문이 원문과 일치, `[source:facebook]` 표시는 화면에 안 보임.
  (상세 URL은 `sb-<id>` 형식 — `/viec-lam/4682`는 404가 정상)

## 발견된 문제

1. 피드 로딩량이 실행마다 크게 다름(2~8개), 빈 칸이 끝까지 안 채워짐 — 원인 미확정.
2. 저장 공고는 employer_id·source_url 없음 → 지원 버튼은 '직접 연락' 안내(전화/Zalo 표시됨).
3. 수집 상태(`facebook_seen.json`)는 이번 검증 저장 경로에서 갱신 안 함(본문 지문 DB 중복
   방지로 재저장은 막힘 — 재실행 시 'DB 중복' 확인됨).
4. 후속(기록만): `ZALO_RELAY_KEY` 교체(VNC 콘솔 화면 노출), 서버 `crawler/.env.`·`.env.bak.*`·
   `.envecho` 복사본 정리 + ignore 보완, AZDIGI 콘솔 root 로그아웃 확인.

## 다음 결정사항

1. FB 정기 실행 재개 여부(재개 시: `rm state/FACEBOOK_PAUSED` + crontab에 run_daily.sh 또는
   crawl_facebook.py 등록 필요 — 현재 crontab엔 FB 없음).
2. 피드 로딩량(빈 칸) 개선을 추가로 볼지.
3. 위 후속 보안 정리 일정.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-28 — FB 크롤러 전문 추출·잘림 차단 + Bắc Ninh 1건 Production 저장(id 4682)** — MASTER PUSHED(`4dcd75a`), VPS PULLED, PRODUCTION DB 1건, 사이트 상세 확인.
2. **2026-09-28 — VPS 회사PC 키 등록 + FB 정기실행 일시중지 + 최신코드 반영 + Bắc Ninh DRY-RUN(세션 만료로 중단)** — MASTER PUSHED, VPS PULLED(`4fc348f`). DB 변경 없음.
3. **2026-09-28 — Facebook 크롤러 보완(빈 칸 조기종료·구직자 홍보글·DB 중복키)** — MASTER PUSHED(`f64f6ab`). 페이스북 재접속·Production DB 저장·VPS 실행 없음.
4. **2026-09-28 — Facebook 크롤러 증분 수집·페이지 판정 재설계 구현 + dry-run 1회** — MASTER PUSHED(`dccf50e`). 크롤러 전용이라 Vercel 배포 무관, VPS 반영은 서버 git pull 필요(미실행).
5. **2026-09-28 — Facebook 크롤러 진단 + 스크롤 버그 수정, 재설계 방향 합의** — MASTER PUSHED(`26f1fde`, 스크롤 수정만). 날짜필터/그룹확장은 설계 합의만, 미착수.
