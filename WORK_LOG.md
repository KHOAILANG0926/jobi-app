## 2026-11-11 — Codex 한도 초과 때 Claude 검토관 (Lee "진행해")
- 원인 [직접 확인]: Codex 주간 한도 0%라 #674에 "usage limits for code reviews"만 옴. 봇은 30분을 그냥 기다린 뒤 위험 파일 PR을 needs-lee로 멈춤(두 번째 눈 없음). 30분은 11-08 근거 없이 정한 값 — 실측 27번 중 25번이 11분 안.
- 변경: codex-review-gate 12분·한도 초과 즉시 → Claude 검토관(claude-auto fallback-review, 읽기 전용, AGENTS.md 기준, 결과 claude[bot] 표시 댓글) → 20분 안 없으면 일반 파일만 진행, 중요 파일은 검토관 재요청(3번, 그래도 없으면 장치 고장 이슈) — Lee 11-11 "Codex는 의견, 최종 판단은 Claude": Lee 확인 넘김(needs-lee) 없앰. 검토관 지적은 codex-response가 처리. 문서: @codex review는 PR당 한 번.
- 검증 [직접 확인]: codex-review-gate 시험(한도·검토관 통과/지적/답/가짜 계정/다른 커밋/시간 초과 추가), tsc·npm test 119/119·build, YAML 읽기. 실제 검토관 실행은 병합 뒤 첫 PR에서 확인.
## 2026-11-11 밤 근무 — 저녁 8시 보고에 Google 이번 달 사용/한도 (#560)
- 원인 [직접 확인]: 한도 장치(external_api_limits·external_api_reserve)는 있으나 이번 달 사용 횟수를 매일 보는 경로가 없어 대량 수집 전 남은 몫을 판단할 수 없었다(#560 11-08 메모).
- 변경: .github/workflows/admin-location-evening-report.yml에 한 줄 — 한도 표 전부(운영·웹사이트·시험 몫)를 베트남 달 사용 횟수와 함께 'api 사용/한도'로(읽기만, 건수만).
- 검증 [직접 확인]: 같은 SQL을 로컬 폐기용 PGlite에서 실행 → 'google_place_website 0/900 · google_text_search 123/4500 · google_text_search_test 0/600'(지난달 줄 제외), YAML 읽기 정상, tsc·npm test 119/119·build. 운영 출력은 다음 20시 실행에서 확인.
## 2026-11-11 밤 근무 — 주소 읽기: GOERTEK 'Làm việc tại: Nam Sơn / Quế Võ 1 - Bắc Ninh' (#633)
- 원인 [직접 확인]: 미리 보기 42843415361 원문 id:1479749020957235. 이름표 뒤 값이 쉼표 없이 띄어 쓴 대시로 성 이름과 나뉘어 ② 이름표 없는 주소 줄(쉼표 2칸 이상)에 안 걸리고, 조각도 없어 주소 ''.
- 변경: src/lib/addressReader.ts ②에서 이름표("…:")를 뗀 값만 띄어 쓴 대시를 쉼표 칸으로 봄(이름표 없는 제목 줄 "… – BẮC NINH"은 그대로). 시험 사례 2개(GOERTEK 읽음·이름표 없는 대시 줄은 안 읽음).
- 검증 [직접 확인]: tsc·npm test 119/119·build 통과. 실제 등록은 다음 Facebook 저장 실행에서 확인.
## 2026-11-10 밤 — PR "확인한 기록" 검사 (#666, Lee "규칙을 확인도 안 할 거면 규칙은 왜 있니")
- 원인 [직접 확인]: #661이 companyReader.ts에 새 단계를 붙일 때 11-07 결정·#616을 안 보고, 같은 파일을 고치던 #663도 몰랐다. 덧대기 감시는 Codex 검토(AGENTS.md 3번)뿐이었고 놓쳤다.
- 변경: scripts/check-pr-ready.mjs가 바뀐 파일마다 최근 14일 병합 PR(파일당 5개)·같은 파일을 고치는 열린 PR(3일 안 갱신)을 GitHub에서 직접 찾아, PR 설명 「확인한 기록」에 번호마다 설명 한 줄이 없으면 실패. PR 양식에 칸 추가.
- 보강: 줄마다 그 PR 제목 낱말이 하나 이상 있어야 함(번호만 베끼기 방지). 회사·주소·급여 읽기 함수를 고치면 그 시험에 eq 사례가 더해져야 함(11-07 결정, check-repository-policy).
- 한계: 읽고 이해했는지는 기계가 확인 못 함. 채팅 제안·결정 변경 여부 판정은 GitHub 검사가 닿지 않음(결정 문서 변경은 기존 decision-approval-gate).
- 검증 [직접 확인]: check-pr-ready.test(#661 재현: 칸 없음·빠짐·번호만 실패, 정상 통과), 실제 #661 파일로 목록 조회(#616·#540·#663 등 9건).
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
