## 2026-11-11 새벽 — 화면 대조가 비공개 공고를 한 번도 못 연 것 (관리자 로그인이 상세 화면에 안 넘어감)
- 원인 [직접 확인]: detail-read 진단 실행에서 sb-5938 상세 화면 h1 "Không tìm thấy", 로그인 흔적(sb-…-auth-token) 없음. 화면 로그인(#650) 상태가 상세 화면으로 넘어오지 않아, 비공개 공고는 화면 대조를 통과할 수 없었다(공개된 새 공고 0건의 원인).
- 변경: scripts/ops/detail-read.mjs 관리자 로그인을 앱과 같은 Supabase 클라이언트 로그인 → 그 세션을 브라우저 저장소에 넣는 방식으로(admin-location-confirm.mjs와 같은 로그인). 열기 실패 때 화면 h1·주소·로그인 흔적을 함께 남김.
- 검증 [직접 확인]: 브랜치에서 detail-read 실행 — sb-5931·5938·5942 PC·모바일 모두 관리자 미리 보기로 열림, 확정 오류 0·불명확 0.
## 2026-11-11 새벽 — #661에서 따로 붙인 읽기 단계 2개를 기존 단계에 합침 (Lee "덧대기", #666)
- 회사: "상호 한 낱말 – 장소"(KHVATEC)를 따로 보던 단계를 ⓪ 첫 줄 단계 안으로(대시 앞 한 낱말만 보고 같은 조건). 주소: 가게 이름 뒤 번지+거리(Jollibee)를 따로 먼저 돌려주던 단계를 ③ 조각 목록 안으로.
- 같은 PR에 미리 보기 2차 사례: "Gần Tết Cửa Hàng Nhà Mình" → 이름 없음(이름 아닌 말 목록), Circle K 지원 양식 줄 "Gửi thông tin: … Cửa hàng àm việc"·소제목 "CỬA HÀNG LÀM VIỆC:" → 이름표 줄 목록, 주소 조각이 줄바꿈을 넘어 다음 매장 주소까지 붙던 것 → 한 줄 안에서만. Codex 지적(대시 앞이 이름이 아니면 첫 줄 전체) 봇 반영.
- 검증 [직접 확인]: 회사·주소 시험(합친 동작 사례 2개 추가) 통과, 미리 보기 원문 20건 결과 합치기 전과 같음, tsc·npm test 119/119.

## 2026-11-10 밤 — 화면 대조가 비공개 공고의 'Không tìm thấy' 화면을 대조하던 것 (sb-5931 KHVATEC)
- 원인: 관리자 미리 보기를 불러오는 동안 잠깐 뜨는 'Không tìm thấy' h1을 기다림 대상(아무 h1)으로 잡아 '제목 다름' 확정 오류 → 새 공고가 공개될 수 없음.
- 변경: scripts/ops/detail-read.mjs가 공고 제목 머리(h1.jd2-header__title)를 기다리고, 안 뜨면 열기 실패(기록 안 함).
- 검증 [직접 확인]: 운영 sb-5876 PC·모바일 읽기 정상, 로그인 없이 sb-5931은 열기 실패로 처리.
## 2026-11-10 밤 근무 — 회사·주소 읽기 #633 남은 3건 (HAIDILAO·CÔNG TY MÌNH·JMT)
- 회사: "[ HAIDILAO VINCOM BẮC NINH ] TUYỂN DỤNG" → 대괄호 뒤가 비면 대괄호 안이 이름. "CÔNG TY MÌNH Ở KHÚC XUYÊN" → 이름 아님(성조 붙은 'công ty mình'만 — 이름 'Công ty Minh Anh'은 살림, ⑥ 뒤 "ở/tại …" 장소 말 떼기 — ②와 같은 규칙). Codex 지적 2건 반영(Minh 이름·'huyện Cần Giờ' 보존).
- 주소: "CÔNG TY JMT KCN QUẾ VÕ 2" → 'KCN QUẾ VÕ 2'(조각 읽기에 KCN·CCN 이름 추가, 그 줄 안에서만, 뒤 구인 낱말 뗌).
- 검증 [직접 확인]: companyReader·addressReader 시험 사례 5개 추가 통과, tsc·npm test 119/119·build. 실제 수집 등록은 다음 미리 보기 실행에서 확인 [미확인].

## 2026-11-10 밤 — 봇 커밋 뒤 PR 검사가 옛 근거로 막히던 것 (#648, PR #657)
- 변경: claude-auto.yml 봇이 새 HEAD에서 직접 검증한 줄(scripts/ops/pr-bot-proof.mjs)을 PR에 남김, check-pr-ready는 최신 PR 설명·GitHub 커밋 작성자로 판정(pr-checks.yml 연결), check-pr-ready.test.mjs 시험 추가.
- Codex 지적 1건(HANDOFF 23번 줄 미갱신) 반영. 운영 검증(봇 커밋 PR에서 옛 실행 실패가 사라지는지)은 병합 뒤 확인 예정 [미확인].
- 이전 HANDOFF 문구: "봇 커밋 뒤 PR 표 SHA(#648 — 옛 실행 실패가 봇 병합을 막음, 이번에 수동 정리)".

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

