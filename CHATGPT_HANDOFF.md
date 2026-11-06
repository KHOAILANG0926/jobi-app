# HANDOFF — 2026-11-06 오후 (Claude) · 위치 Google 먼저·박닌 공고 3건·크롤링 소스 점검

## 1. 현재 상태
- master ba135dc. 코드 변경 최신 299a172(#488 Google 먼저) deploy-verify 42184464122 성공 [직접 확인].
- 위치: 회사 이름 있으면 Google부터(상세 Google 버튼과 같은 검색어) → VietMap 번지 검증 exact / 아니면 Google 좌표(area). 프로세스 문서 CLAUDE.md 「공고 위치 확인 프로세스」(#489): 키는 크롤러 자동 확인만, Lee 제공·기존 공고는 일반 Google 지도 링크 → admin-location-confirm. business-search-compare는 extra 1건만·동시 실행 차단·전체 비교는 confirm_compare=true.
- 2026-11-06 Google Places 429(한도 초과): 작업자가 비교 검색 14회(회당 16곳)·4개 동시 실행해 소진. 실제 한도 숫자는 콘솔에서만 확인 가능(미확인).
- 공고: #5505 Hojeong·#5507 nhẹ cafe 공개(검사표 기준) [직접 확인: 이슈 #237]. #5506 BĐS Phúc Lộc 공개(검사표 42197649301). 근본 수정: 상세요강 정리에서 "~:" 제목+글머리 목록을 한 덩어리로 같은 칸에(jobDescriptionBuild keepListBlocks), 검사기 원문 순서 예외(#492)는 제거 — 병합 후 #5506 화면·검사표 재확인. Haidilao 미등록 — R3 출처(FB 작성자 이름 또는 캡처) 필요, 원문은 Lee 대화에 있음.
- 검사/등록 변경: 범위 금액 앞 숫자 단위(#480), 원문에 없는 필수 항목은 경고만·새 공고도 공개(#479·#484), 목록 제목 줄 예외(#485), 포스터 옮김은 원문(source_text)에서 빼고 업체 이름 줄만(#485·#486, 규칙 ④①).
- 상세: 빈 칸 상자 빠지고 아래 칸 올라옴·연락 버튼 별도(#481, deploy-verify 42173749730 성공). mobile-home 시험은 11-05부터 실패 중(무관).
- 크롤링: Facebook session_expired(run 42185487440) → Lee 쿠키 갱신(VPS SOCKS) 대기. Chợ Tốt: 웹 403, 공개 gateway 목록·본문 읽힘·번호 가려짐(run 42187019576), Lee 계정 정지(ABB, 이의 메일 발송됨). Muaban 수집기 없음. TopCV/Vieclam24h 꺼짐(8월 지시).

## 2. 다음 할 일 3개
1. Facebook 쿠키 갱신 후 crawl-facebook-one dryrun → 박닌 1건 save(위치 확인 Google 먼저 적용 첫 실전).
2. Muaban 로그인 없이 읽기·번호 노출 시험(chotot_probe 방식, 저장 없음).
3. #5506 검사기 수정 PR 병합 → 검사표에서 빈 이름표 해소·공개 확인 / Haidilao 출처 받아 등록(일반 Google 지도 위치 확인 먼저).

## 3. 필수 규칙
- 시키면 바로 실행(Lee 11-06). 운영 DB 직접 SQL·번호 지정 덮어쓰기 금지, STRICT만 승인.
- Google 키는 크롤러 자동 확인만. 사람 확인은 일반 Google 지도. 비교 검색 1건씩.
- 로그인·비밀번호 입력은 작업자 금지 — Lee가 VPS에서 로그인, 쿠키는 Secrets에만.
- GitHub 연결로 브랜치·PR, 필수 검사·봇 병합 우회 금지. 보고 5줄·앱 화면 기준.
