## 2026-11-10 밤 근무 — 회사·주소 읽기 #633 남은 3건 (HAIDILAO·CÔNG TY MÌNH·JMT)
- 회사: "[ HAIDILAO VINCOM BẮC NINH ] TUYỂN DỤNG" → 대괄호 뒤가 비면 대괄호 안이 이름. "CÔNG TY MÌNH Ở KHÚC XUYÊN" → 이름 아님(자기 회사 부르는 말 목록에 'công ty mình/em' 추가, ⑥ 뒤 "ở/tại …" 장소 말 떼기 — ②와 같은 규칙).
- 주소: "CÔNG TY JMT KCN QUẾ VÕ 2" → 'KCN QUẾ VÕ 2'(조각 읽기에 KCN·CCN 이름 추가, 그 줄 안에서만, 뒤 구인 낱말 뗌).
- 검증 [직접 확인]: companyReader·addressReader 시험 사례 5개 추가 통과, tsc·npm test 119/119·build. 실제 수집 등록은 다음 미리 보기 실행에서 확인 [미확인].

## 2026-11-10 밤 — 회사·주소 읽기 #633 Facebook 미리 보기 사례 7건 (Lee "물어보지 말고 진행해")
- 회사: "Quán Nét nhà mình"·"Nhà hàng bên em"·"Hiện có nhu cầu" → 이름 없음, "Genz Coffee mở đợt" → Genz Coffee, "KHVATEC – DO NHA" → KHVATEC(대시 앞 한 낱말 상호), "Cửa hàng Jollibee 393 Trần Hưng Đạo" → Cửa hàng Jollibee. 주소: 가게 이름 뒤 번지+거리 → "393 Trần Hưng Đạo".
- 미리 보기 로그 전화 가림이 10자리 번호·금액에서 빠지던 것 고침(crawl-facebook-one.yml).
- 검증 [직접 확인]: companyReader·addressReader 시험 통과, 미리 보기 원문 20건 다시 읽음, tsc·npm test 119/119·build.

## 2026-11-10 밤 — 상세 ④ 꾸민 본문 + 업종별 색 13가지 (Lee "처음으로 마음에 드는", "가자", #655)
- 알바몬 쿠팡 공고 참고: 그림 머리 아래 큰 급여·상여 알약(원문 대문자 줄)·형광펜 소제목·아이콘 카드·채용 절차 화살표(원문 단계 낱말, 부정 표현이면 생략)·복리후생 타일·큰 전화 버튼. src/components/DetailRich.tsx, src/lib/detailRich.ts, 색 albamonTemplate DETAIL_PALETTE(13색, 금액 빨강·흰 카드 통일).
- 운영 확인 [직접 확인]: sb-5876 PC·모바일 꾸민 본문·앰버 색·tel 버튼·가로 넘침 없음, KDA sb-4824 그대로. deploy-verify 42837555553 통과.
- 남은 것: 봇 커밋마다 PR 표 SHA 옛 근거·취소된 중복 실행이 봇 병합을 막음 → 매번 수동 정리(#648 우선 처리 필요).

## 2026-11-10 밤 — 상세 10-30 확정 구성 + 업종 그림 머리 + 급여 칸 정리 (Lee "Ok" 적용, #653)
- ① Mức lương 금액 + "chưa/đã gồm tăng ca", Phụ cấp·Thưởng 상여 줄(최대 3줄) / ② Yêu cầu khác / ④ Nội dung công việc·Tăng ca·Môi trường làm việc·Quy trình tuyển dụng·Liên hệ + #563 업종 그림 머리. 번호 붙은 원문 소제목(2. CÔNG VIỆC 등)도 소제목으로. 구현 src/lib/jobQuyenLoi.ts albamonCompose·albamonConditionLines.
- Codex 지적 4건(KDA 그림 제외, 금액 더 있는 급여 내역 보존, 보험 문장 ④ 보존, 'không bao gồm tăng ca') 봇이 반영.
- 운영 확인 [직접 확인]: sb-5876 PC·모바일 ④ 6칸·그림 07-nhua-ep·급여 칸, KDA sb-4824 기존 틀 그대로. deploy-verify 42827351625 통과.
- 남은 것: 봇 커밋마다 PR 표 SHA 옛 근거로 checks 실패 → 옛 실행 수동 삭제(#648).

## 2026-11-10 밤 — 화면 대조 검사(#646): 운영 화면을 원문·DB와 대조, 공개 전 통과 필수 (Lee "이어서")
- #650: 상세 화면 읽기(detail-read)에 대조 추가 — 제목·회사 줄·Google 버튼=핀·상세 핀=지도 목록 핀·전화·Zalo(확정 오류), 아이콘 근거·급여 금액(판정 불명확). 판정 src/lib/screenAudit.ts, 수집 scripts/ops/screen-collect.mjs(미리보기 검사와 공유), 제목 계산 detailTitle 한 곳. Codex 지적 2건(핀 양방향·숨김 공고 관리자 로그인) 반영.
- 공개 공고 전체 1회 점검: 22건 확정 오류 0·불명확 0 [직접 확인 run 42809331299, #646 댓글]. 수집값 5건 운영 화면에서 확인.
- #651: 검사표 '화면 대조' 항목 — 비공개 공개 후보는 job-ocr-check가 관리자 비공개 상세로 대조 → 확정 오류 없으면 같은 실행에서 공개. 확정 오류는 3시간 뒤 다시 대조, 화면 열기 실패는 실행 실패 알림(Codex 지적). 이미 공개 중 공고는 기록 없으면 유지. deploy-verify 42814545437 통과.
- 남은 것: 공개 중 공고 정기 대조(지금은 detail-read 번호 비우고 수동), 봇 커밋 뒤 표 SHA(#648 — 이번에도 옛 실행 실패를 수동 정리).

## 2026-11-10 저녁 — 크롤링 1단계 첫 공개(sb-5876)와 화면 오류 수정 (Lee "1건씩")
- Facebook 1건씩 저장: 5873(원문에 업무·급여 없음 → 비공개 맞음), 5876 ZHAN AN 공개. 위치에서 빠짐: Jollibee·JMT(주소 못 읽음 #633), TOKYOLIFE(성 밖 → 보류함).
- 고침: 급여 'Lương và phụ cấp' 줄(#641, Codex P1 반영), 검사표 묶음 제목(#641), 상세 머리 대시·'công nhân' 회사명 오인(#642 + 미리 보기 회귀), 길찾기 검색어 = 위치 확인 검색어(#643), Google 핀이면 버튼도 같은 좌표(#644), 급여 못 읽은 공고 원문 조회(#640 읽기 전용, 전화 가림), VPS 안 쓰는 브라우저 정리·후속 칸 할 일 번호 강제(#637), 1GB 미만 알림(#639).
- Lee 지적: 검사표를 통과한 화면 오류가 공개됨 → 화면 대조 검사(#646, 계획 #645).

## 2026-11-10 오후 — VPS 안 쓰는 브라우저 자동 정리·후속 칸 할 일 번호 강제 (Lee "지시한 걸 안 한 것")
- 11-07 "바로 지울 수 있는 공간 정리"에서 안 쓰는 브라우저(chromium-1248·headless_shell, 약 680MB)를 남기고 기록도 안 함 → Facebook 수집 정리 단계가 수집기 playwright(1.44 = chromium-1117)가 쓰는 버전만 남기고 다른 chromium 폴더를 지움(쓰는 버전을 못 읽으면 안 지움).
- 재발 방지: check-pr-ready가 PR 「후속 개선 과제」 칸을 요구하고, "없음"이 아닌 줄마다 할 일 번호(#이슈)를 요구(템플릿 안내도). 시스템 파일 정리(관리자 권한)는 #636.
- 검증: check-pr-ready.test 7/7(후속 칸 없음·번호 없음 거부, 번호 있음·없음 통과), playwright 1.44 dry-run 출력 형식 확인(Install location → chromium-1117).

## 2026-11-10 오후 — 위치 확인: 관리자 확정 위치 먼저 (Lee 11-10 2단계 "자체 사업장 위치 DB 미완성 기능 보완")
- 원인 [직접 확인]: 새 공고 위치 확인(precheckLocation)이 관리자 확정 기억표를 보지 않고 Google부터 물음. 기억표는 등록 뒤 자동 재사용(valid_memory_targets)에만 쓰여, 우리가 이미 확정한 회사·주소도 Google 한도·'못 찾음'에 막힐 수 있었음.
- 변경: DB 함수 public.location_memory_point(읽기만, service_role, 등록 뒤 재사용과 같은 조건 — 같은 회사 이름 + 같은 주소 열쇠) → precheck가 맞으면 Google 없이 찾음(confirmed_memory). 조회 실패는 기존 순서. 다른 지점·다른 회사·꺼진 기억은 맞지 않음(시험).
- 같이: 보류함 보관 때 수집 기록 한 줄 + 저녁 보고 상태별 건수(#632), 규칙 2곳에 문제 제기 다섯 가지(#631).
- 검증: tsc · npm test 116/116 · build · 로컬 PostgreSQL setup→migration→local→production_check.

## 2026-11-10 낮 — 알림 지역을 34개 성으로 (점검 #3, Lee "전체 수정")
- 공고 알림 DB 지역 키워드를 공식 34개 성 자료(src/lib/regionKeywords.ts, 화면 판정과 같은 자료)로 다시 만듦(migration 20261110120000, 생성기 scripts/data/gen-alert-region-keywords.mjs — 11-03에 만들어 둔 것). 랑선→Lạng Sơn, 옛 Hòa Bình→Phú Thọ, 옛 Bắc Giang→Bắc Ninh. 알림 설정의 옛 성 id(bacgiang·longan)는 합쳐진 성으로.
- 지운 것: jobRegions.ts 손 목록(match 36개)과 알림 전용 지역 탭 예외(ALERT_REGION_TABS) — 알림 화면도 34개 성 탭.
- 검증: tsc · npm test 116/116 · build · 로컬 PostgreSQL setup→migration→local→production_check.

## 2026-11-10 새벽 — Google 한도: 사업장 중복 검색 줄임·한도 초과 보류·로고 재시도·시험 몫 (Lee 11-09 5개 지시)
- ① Google 결과 다시 쓰기: 검색 글자(회사 이름 + 원문 주소) 완전 일치만(googleCacheKeys, 위치·로고·업종 같은 함수, 열쇠는 #619 전과 같음). 11-10 Lee "나": 비슷한 사업장 자동 병합(번지·공단·구획·동 열쇠)은 위치가 잘못 붙을 위험이 있어 뺌.
- 11-10 오전: 비슷한 사업장 병합 제외(위치 고르는 판정은 master와 같음 — 저장 열쇠만 같음 확인) · '못 찾음' 다시 확인이 한도에 막혀도 다음에 새로 묻기 유지(Codex P2).
- ② 한도 초과(우리 월 한도·Google 429)·확인 서버 오류 = google_quota/precheck_unavailable → 크롤러 입구가 버리지 않고 보류함(research_artifacts location-hold, 지우지 않음)에 넣고 다음 수집 실행 첫머리에 최대 5건 다시 확인(아직 한도면 첫 건에서 멈춤, 14일 지나면 expired 표시). '못 찾음'은 지금처럼 수집 안 함.
- ③ 로고 quota는 영구 결과 아님: 다시 묻고, 정기 검사(job-ocr-check)가 30분마다 6시간 지난 quota 최대 10건 다시 시도(location-hook logo_retry). Google 429도 quota.
- ④ Google 결과 30일 정리: 이번 PR에서 제외(Lee 11-10 — migration·정기 실행·30일 지난 결과 다시 묻기 모두 뺌).
- ②-2 위치 못 찾은 공고(Lee 11-09 "예"): 공고 목록에 넣지 않고 같은 보류함에 비공개 보관(unfound), 7일 뒤 다시 확인 최대 2번, 찾으면 같은 입구로 등록. 수수료 소개소·회사 이름 없음은 보관 안 함. CLAUDE.md 「수집 첫 단계」 줄 갱신.
- ⑤ 시험 몫 google_text_search_test 600/월(migration 20261110090000, 한 줄 추가) — 시험 도구가 Pro·IDs 모두 먼저 예약, Pro는 운영 몫에도. 시험은 베트남 날짜 하루 한 번, 실행당 SearchText 40회.
- 검증: tsc · npm test 116/116 · build · 크롤러 입구 시험(보류·재시도) · 로컬 PostgreSQL에서 migration·운영 점검.
- 11-10 아침(Lee "남은 Codex 3건만"): 같은 공단 다른 구획(Lô) = 다른 사업장 열쇠 · 포스터 판독 실패가 다른 보류 공고 재확인을 막지 않음(다시 볼 때 순서로) · 한도 초과 로고 공고가 그사이 로고·사진을 갖게 되면 has_logo로 기록해 재시도 목록에서 뺌(migration 20261110092000, 기록 함수 결과 값 1개 추가). master 8035ee9와 합침(WORK_LOG 충돌만). 검증: tsc · npm test · build · 크롤러 입구 시험 · 로컬 PostgreSQL 16 migration 시험·운영 점검. 병합·배포 안 함(draft). 이어서 Codex 새 지적 2건(Lee "둘 다 고쳐"): 한도 초과 뒤 공단·동 중심 대략 위치로 가도 한도 기록 유지(→ 보류, 7일 뒤 아님) · 새 공고 없는 수집 실행에서도 보류 공고 다시 확인(retry_held_once, Facebook·TopCV 저장 입구, 선택·검증 저장 제외). 로고 다시 시도(Codex P2, Lee 지시): Google이 장소 번호 없음(404 NOT_FOUND) 확인 → no_place로 끝(같은 번호 다시 안 물음, 공고·위치 그대로), 일시 오류 → quota로 다시 기록해 줄 뒤로·다음 공고 계속, Google 한도(429)·장애(503)만 묶음 멈춤, 등록 14일 지난 공고는 다시 시도 안 함(보류함 한도 초과 기한과 같음). 이어서(Lee "두 건 모두"): 숫자 동·구(Phường 1/2, Quận 3)를 사업장 열쇠에서 구분(P.1·P1은 같은 곳) · 보류함 '못 찾음' 7일 뒤 다시 확인은 저장된 Google 결과를 쓰지 않고 새로 물음(recheck → refreshGoogle).

## 2026-11-09 밤 — 밤 근무: 테마 채용관 잘못된 주소·옛 지역 목록 #623 (Claude, #594 P1·P3)
- 원인 [직접 확인]: ServicePages.tsx ThemeJobsPage가 모르는 slug면 기숙사 테마를 그 주소 그대로 보여 줌, 지역 칸은 JOB_REGIONS(36개, 합쳐진 Bắc Giang·Long An 포함).
- 변경: 모르는 slug → /chu-de/ky-tuc-xa로 replace, 지역 칸 = REGION_MACRO_TABS 34개 성(메인·검색과 같은 목록). 판정 함수는 원래 34개 공통이라 그대로. 화면 틀 그대로.
- 검증 [직접 확인]: tsc · npm test 115/115 · build · 로컬 미리보기 /chu-de/abc → /chu-de/ky-tuc-xa, 지역 34개(Bắc Giang·Long An 없음, Lạng Sơn 있음).
