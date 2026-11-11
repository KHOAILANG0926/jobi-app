## 2026-11-12 — 기준 시각 이전 공고 상세요강 한 번 다시 정리 (Lee "예전 거는 지금 전체 확인해서 다시 수정")
- 원인 [직접 확인]: sb-5157 상세요강 '업무 내용'에 포스터 글자 조각·주소·교대 시간이 섞임. 지금 규칙(원문 있으면 포스터 글자 안 넣음, 11-04)은 코드에 있지만 자동 작업이 기준 시각(11-01 16:15) 이후 공고만 다시 만들어 10-31 공고는 예전 내용 그대로. 화면 대조 검사(28건 0건)는 값 불일치만 봐서 못 잡음.
- 변경: 수동 실행 입력 all_jobs 하나(AUTO_ALL_JOBS)로 상세 채우기·AI 칸·업종이 기준 시각 이전 공고도 다룸(OCR은 다시 읽지 않고 원문으로). 검사표·공개 판정은 넓히지 않음 — 기준 시각 이전 공고는 기존 읽기 전용 검사(#593)가 결과만 알림(공개 상태 안 바꿈, Codex #719). 대상 조건은 auto-cutoff.mjs autoScope 한 곳, KDA(기준 틀)는 jobQuyenLoi.BASELINE_FRAME_JOB_IDS로 제외.
- 지운 것/합친 것: CLASSIFY_ALL_JOBS·BUSINESS_ALL_JOBS 두 개를 AUTO_ALL_JOBS 하나로 합침.

## 2026-11-12 — 기존 공고 다시 처리: 같은 매장 핀 2개 방지 (KRIK 5992·MediaMart 5994)
- 원인 [직접 확인]: 다시 처리 뒤 운영 지도 자료에 같은 좌표 핀 2개(5992 1776·1797, 5994 1778·1799). 기존 줄은 지역을 덧붙여 저장("…, TP. Bắc Ninh, Bắc Ninh")돼 글자 완전 일치 비교가 같은 매장을 못 가림.
- 변경: refresh_facebook_existing — 같은 매장 판정을 addressReader.sameStore와 같은 규칙(낱말 단위 포함)으로, 기존 줄끼리 겹친 것도 앞 것만 남김.
- 지운 것/합친 것: 글자 완전 일치 비교를 sameStore 규칙으로 바꿈(새 규칙 아님).
- 남은 것: MediaMart Mao Dộc·Đông Côi 2곳은 Google 같은 이름 후보 여럿(multiple_no_street)으로 못 찾음 — 절대 원칙대로 안 넣음.
## 2026-11-11 밤 — 봇 병합: gh pr merge 대신 서버 병합 API (#686)
- 원인 [직접 확인]: 봇 거절 문구 'the base branch policy prohibits the merge'는 gh 프로그램 안의 문구(gh 2.89 실행 파일에서 확인) — 서버에 묻기 전에 gh가 읽은 mergeStateStatus로 먼저 거절. #681(03:01~03:13)·#708(13:40) 모두 필수 검사 성공 뒤 거절, #708은 6분 뒤 같은 봇이 병합. 워크플로 파일 때문이라는 추정은 #680(워크플로 수정)을 봇이 병합해 맞지 않음.
- 변경: bot-pr-automerge.yml — PUT pulls/{n}/merge(squash, sha=head로 --match-head-commit과 같음, 제목 "PR 제목 (#번호)"). 거절이면 서버 이유를 경고에 남김. 브랜치 보호는 서버가 그대로 집행.
- 지운 것/합친 것: gh pr merge 호출을 서버 API 호출로 바꿈(새 단계 없음). crawl-guard.yml 자동 수리 병합은 그대로(따로 이슈 없음, 같은 증상 기록 없음).
- 검증 [직접 확인]: 워크플로 YAML 읽기·bash -n, tsc·npm test 119/119·build.

## 2026-11-11 — 기존 Facebook 공고 다시 처리: 찾은 매장 전부 근무지로 (KRIK 5992·MediaMart 5994)
- 원인 [직접 확인]: 다시 처리(refresh_facebook_existing)는 위치 글자 1개만 보내 이미 올라간 매장 여러 곳 공고에 다른 매장이 안 들어감.
- 변경: 새 공고와 같은 위치 확인(PRECHECK)으로 찾은 매장 중 아직 없는 매장만 기존 근무지 줄 뒤에 붙여 보냄(기존 줄은 주소 그대로 앞에 — DB 입구가 빠진 줄을 지우지 않게, Codex #705). 못 찾은 매장은 안 넣음, 확인 실패면 예전 동작. 확정·검증 핀은 DB 쓰기 함수가 지키고 대략 핀은 저장된 결과로 다시 붙음.
- 검증 [직접 확인]: py_compile. 실제 확인은 병합 뒤 5992·5994 다시 처리 실행으로.
## 2026-11-11 — DB 위치 쓰기에서 성·시 중심 짐작 핀 지움 (지도 위치 절대 원칙)
- 원인 [직접 확인]: write_location(위치 쓰기 DB 함수)이 좌표 없는 줄에 원문 성·시 이름으로 중심 핀을 자동으로 찍음(20261028050507·20261029120000) — Lee 절대 원칙 "위치를 모르면 마음대로 찍지 마" 위반.
- 변경: 20261111200000_no_administrative_area_pin — 그 단계만 잘라냄(이미 찍힌 핀·관리자 확정 보호는 그대로). 예전 운영 검사 2개('공개 공고는 핀 필수'·'원문 확인 규칙 필수')를 새 원칙에 맞게 바꿈.
- 지운 것/합친 것: write_location의 성·시 중심 핀 단계, 그 단계를 요구하던 운영 검사 2줄.
- 검증: 시험 DB 검사(no_administrative_area_pin.setup/local), 운영 검사 production_check.

## 2026-11-11 — Google 이름 비교: 'Thanh'(사람 이름)·어학원 앞머리 (기존 공고 5421·5422 다시 찾기)
- 원인 [직접 확인]: 업체 검색 비교 — Google이 'Nhà Hàng Thanh Phệ'·'Regal Edu Vân Dương'을 찾았는데 이름 비교가 'thanh'을 회사 형태 낱말(một thành viên)로 지워 'phe'(3자)만 남거나, 'Anh ngữ' 앞머리를 못 떼 거절(no_core_name).
- 변경: companyPlaceSearch.coreName — 'một thành viên' 묶음만 빼고 따로 쓰인 'Thanh'은 이름으로 지킴(Việt·Nam과 같은 방식), 'thành phố'는 묶음으로 뺌. shopKinds 이름 앞머리에 어학원 낱말.
- 같은 날 기존 짐작 핀 9건 중 5건(4982·5231·5405·5505·5599) 업체 검색 비교 → 관리자 위치 확정 [직접 확인: 운영 지도 자료 exact admin_approved].
- 검증 [직접 확인]: companyPlaceSearch 시험, tsc·npm test 119/119·build.
## 2026-11-11 — 위치 찾기에서 짐작 핀(동·시·공단 중심) 없앰 (Lee 절대 원칙 "위치를 모르면 마음대로 찍지 마")
- 원인 [직접 확인]: 한 매장 공고도 위치를 못 찾으면 동 중심·시 중심·공단 중심·행정구역 중심을 대략 핀(area)으로 찍었음. 공개 공고 28건 중 9건이 그런 핀(공개 지도 API).
- 변경: 위치 찾기의 대략 위치 단계(공단 중심·표에 없는 공단 VietMap 검색·동 중심 저장값·동 VietMap 검색·행정구역 중심)를 지움(Codex #702 — 버릴 결과를 만들려고 지도 호출 금지). 찾지 못하면 좌표 없이 unresolved(기록·한도 초과 보류 유지). 쓰지 않게 된 wardCenter·administrativeCenter 의존도 지움. 화면은 DB 핀만 쓰므로 새 짐작 핀 없음. 대략 핀을 기대하던 시험 기대값을 바꿈.
- 남은 것: 이미 DB에 있는 짐작 핀 9건은 다시 찾기로 정리(#701).
- 검증 [직접 확인]: tsc·npm test 119/119·build.
## 2026-11-11 — 매장 여러 곳 공고: 찾은 매장마다 근무지 줄·핀 + 지도 위치 절대 원칙 (Lee "핀이 한 개만", "모르면 마음대로 찍지 마")
- 원인 [직접 확인]: Facebook 글은 주소 1개만 읽어 근무지 1줄·핀 1개. 위치 찾기·DB 기록(map_r1_complete)도 공고당 핀 1개.
- 변경: addressReader.readAddresses → 위치 확인이 매장마다 첫 매장과 같은 방법(Google 같은 이름 1곳·번지 확인, 월 한도 안)으로 찾음 → 찾은 매장만 stores → 등록 입구가 찾은 매장만 근무지 줄 → DB map_r1_complete가 핀 빈 줄에만 같은 쓰기 함수로 기록(migration, Lee 확인 후). 동·시 중심 대략 핀은 쓰지 않음.
- 규칙: CLAUDE.md·RULES_CORE·AGENTS.md(Codex 검토 0번 P0)에 「지도 위치 절대 원칙」. Google 사용 [직접 확인] 11-10 저녁 보고 151/4,500.
- 검증 [직접 확인]: addressReader(실제 Facebook 20건)·resolver·precheck·gateway 시험, tsc·npm test 119/119·build.
## 2026-11-11 — 검사표 '빈 이름표' 판정을 한 규칙으로 (MediaMart sb-5994)
- 원인 [직접 확인]: 'Yêu cầu chung:' 아래 'Nam/Nữ, từ 18 tuổi trở lên'(목록 아님)을 빈 이름표로 잡아 비공개. 이 판정은 아래 줄 모양 예외가 4번(11-03·04·06·10) 붙어 있었음.
- 변경: jobInspect — 예외 4개를 지우고 "상세요강 글 순서에서 아래에 같은 묶음 글이 없는 짧은 '…:' 줄(글 끝·칸 제목 위·이름표 위)"만 빈 이름표. 화면 칸은 줄을 종류별로 다시 모으므로 글 순서로 봄.
- 잃는 것: 이름표 바로 아래에 상관없는 글이 오는 경우(시험 'Số điện thoại:' + 'Thưởng tháng 13' 같은 줄 순서)는 이제 못 잡음 — 상세 채우기가 다른 칸으로 나누면 칸 제목이 사이에 와서 계속 잡힘.
- 검증 [직접 확인]: jobInspect·jobDescriptionBuild 시험, tsc·npm test·build.
## 2026-11-11 — 급여 읽기: 급여 단어 줄의 'VNĐ' 금액 (Con Cưng sb-5993)
- 원인 [직접 확인]: 검사표 #237 "원문엔 급여가 있는데 급여 칸 비어 있음" — 'THU NHẬP TỪ 8.300.000 - 12.000.000 VNĐ'처럼 지급 단위(/tháng) 없는 동 금액을 읽지 않아 비공개.
- 변경: salaryReader — 급여 단어 줄에서만 화폐 글자(đ·VNĐ) 붙은 동 금액을 지급 단위 없이 읽음(같은 동 금액 읽기 단계 안). 급여 단어 없는 줄은 그대로.
- 검증 [직접 확인]: salaryReader 시험(Con Cưng·상여·보증금 아님), tsc·npm test 119/119·build.
## 2026-11-11 — Facebook 1건 저장을 GitHub 서버에서 (Lee "다른 데서 쓰고 있으면 넌 못하는 거야?")
- 원인 [직접 확인]: 저장(save)도 수집용 컴퓨터(VPS) 한 대에서만 돌아, 한국 Facebook 조사가 그 컴퓨터를 쓰는 동안 저장이 대기(run 42966212211).
- 변경: crawl-facebook-one.yml — Facebook 접속(로그인 IP 고정)은 미리 보기뿐이라 저장만 GitHub 서버에서, VPS 정리 단계는 미리 보기 때만.
- 검증 [직접 확인]: YAML 읽기. 실제 저장은 병합 뒤 KRIK·Con Cưng·MediaMart.
## 2026-11-11 — 모바일 상세 가로 넘침 고침
- 원인 [직접 확인]: 자동 캡처(screens/mobile) — 아이폰·갤럭시 모든 상세에서 등록일 줄(글자 줄바꿈 금지)·하단 연락 바(버튼 최소 폭)가 화면 밖으로, 7칸이 44px보다 좁은 폭에서 움직이는 식사 아이콘이 옆 칸을 덮음.
- 변경: index.css 끝 모바일 묶음(등록일 줄바꿈 허용·하단 버튼 최소 폭 0), benefitIcons.css 440px 이하에서 아이콘을 칸 폭까지만. 배치·순서 그대로.
- 검증 [직접 확인]: tsc·npm test 119/119·build. 데모 촬영으로 넘침 0 확인 예정.
## 2026-11-11 — 카드 사진·상세 ④ 그림을 같은 종류로 (Lee "사진 안 맞는다", "3개 사진이 안 맞는데")
- 원인 [직접 확인]: 카드 로고 자리(cardPhoto)와 상세 ④ 그림(albamonTemplate.detailLook)이 따로 골랐다 — 공장은 ④만 만드는 것으로 고르고 카드는 봉제 공장 사진 하나(과자 회사 Hữu Nghị), 가게는 ④가 업종 그림만(커피 가게에 쌀국수 주방, 매트리스 가게에 마트).
- 변경: 공장 종류 표·고르기를 cardPhoto 한 곳으로 옮기고(factoryPhotos·factoryKindText: 회사·제목 → 원문), 카드·대표 이미지·④가 같은 글·같은 한 장. 가게·식당 종류(photoKind)도 ④가 같이 씀. 공장 그림은 회사 이름·제목만 봄(Lee 11-11 "덧대기" — 본문 낱말 오판 예외가 같은 종류로 3번 반복돼 방법을 바꿈, 봇이 더한 본문 제외 목록 삭제). 가게·식당 종류는 지금까지처럼 원문까지.
- 검증 [직접 확인]: cardPhoto·albamonTemplate 시험(Hữu Nghị 과자 공장 카드=④, 원문 ép nhựa, 머리 낱말 우선), tsc·npm test 119/119·build. 남은 것: 종류를 모르는 공장은 카드 봉제 공장 사진·④ 기본 그림 그대로.
## 2026-11-11 — 화면 캡처: 다른 사이트(알바몬)·데모도 찍게 (Lee "핸드폰 디자인 알바몬과 동일하게")
- 변경: mobile-screens 수동 실행에 base_url·slot·pages·detail_link 입력 — 알바몬 모바일 화면(screens/albamon)·데모 주소를 우리 화면과 같은 방식으로 찍어 나란히 비교. 넘친 링크·글자는 앞 20자까지 기록.
- 검증 [직접 확인]: node --check·YAML 읽기. 실제 촬영은 병합 뒤 수동 실행.
## 2026-11-11 — 모바일 화면 자동 캡처 (Lee "내가 일일이 캡처해서 보내줘?")
- 원인 [직접 확인]: 작업 세션은 공고 데이터 서버·검사 결과 그림 저장소에 접속이 막혀 운영 모바일 화면을 볼 수 없었다(git은 됨).
- 변경: scripts/ops/mobile-screens.mjs + .github/workflows/mobile-screens.yml — 운영 배포 검사 성공 뒤·수동으로 아이폰(390)·갤럭시(360) 크기로 주요 화면·최근 공고 상세를 찍어 'screens' 브랜치 mobile 칸에 올림. 기존 데모 촬영(demo-capture)도 같은 브랜치를 통째로 덮어써서 게시를 scripts/ops/publish-screens.sh 한 곳으로 합치고 칸(demo·mobile)별로만 바꾸게 함(Codex #680). 가로 넘침·11px 미만 글자를 README에 적음. unmerged-work-alert에서 screens 브랜치 제외.
- 검증 [직접 확인]: 로컬에서 스크립트 실행(데이터는 막혀 빈 화면) — 갤럭시에서 한국 메인 버튼·KDA 상세 하단 연락 칸 가로 넘침 검출.
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
