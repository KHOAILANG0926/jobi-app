## 2026-10-21 — 데모 위치 조회·반경 검색 수정
- 요청: 20km인데 핀·공고 0건 문제 수정, 대표 위치도 반경에 맞춰 표시.
- 원인 직접 확인: 운영 공개 위치 API 200/두 점, 데모 503. Vercel 메타데이터상 DB 서비스 키는 production 전용. 대표 핀은 기존 반경 필터 우회.
- 변경: preview API는 고정 운영 공개 위치 API만 조회(키 복사 없음), 대표 위치도 반경 필터·목록·건수에 포함. 대표 위치 정밀도 표시는 유지. PC 기준 해시 갱신.
- 검증: 재현 시험 실패 후 통과, npm test 69/69, tsc/build, PC 기준8/8. 실제 PC/휴대폰 반경 100m→20km 검사는 배포·CI에서 진행.
- 운영·DB 변경 없음. Lee 데모 승인 전 병합 금지.
<details><summary>직전 HANDOFF</summary>
# CHATGPT_HANDOFF — 메인 지도 2~5번 데모 (2026-10-21)

## 1. 현재 상태
- 운영 master 52ea695, 1번 핀 맞춤은 #188·#189로 이미 운영 반영. 허용 위치 21.10,106.07 PC/모바일 핀 2개 실제 캡처는 screens-pin-proof-20261021, 운영 촬영 39555695124. 재구현하지 않음.
- 작업 preview/map-cleanup-20261021: 2번 정확도·지도 점 선택 삭제 및 안내 문장 수정. 3번 메인·시설 패널 직선거리 표시 삭제, 내부 계산·반경 원 유지. 4번 PC 목록을 지도 안 visibleEntries와 일치. 5번 demo/pin-panel-b의 빨강 상세/흰색 빨간 테두리 길찾기 2버튼 재사용.
- 데모만, 사용자 확인 전 master 병합·운영 반영 금지. 일반 공고 카드·상세 템플릿 재설계 없음.
- 직접 실행: 기존 화면 밖 공고 제외 시험 실패 → 수정 후 이동·대표 핀·중복·위치 미정 사례 통과. tsc·69/69·build·PC 기준 8/8 통과. 브라우저 위치 선도착·B안·드래그 목록 검사는 PR CI에 추가.
- DesktopHomeMapExplorer.tsx·index.css 기준 해시만 사용자 지시대로 새 값, 날짜·이유 주석 갱신. JobDetail.tsx·LayoutDesktop.tsx 변경 없음.

## 2. 다음 할 일 3개
1. 2~5번 데모 링크 Lee에게 즉시 전달, PC/모바일 브라우저 확인 → Lee 승인 후 운영.
2. 6번 공식 occupation_code → category 등록 자동 연결. 기존 등록·수집 경로와 공식 코드 매핑 조사 후 구현. 운영 DDL이 필요하면 구체 SQL 확인 전 적용 금지.
3. 결정 문서 승인 방식(#141·#175)은 이 작업 밖. 기존 미해결 DB 공고 규칙 5건도 별개로 유지.

## 3. 필수 규칙
- AGENTS.md·CLAUDE.md 준수. 사용자 화면 변경은 말로 먼저, 데모 링크 즉시, Lee 확인 후 운영.
- 근거 없는 완료 금지. 운영 URL/데모 URL과 실제 확인 구분. 키·데이터 PC 저장 안내 금지.
- STATUS 및 생성기 수정 금지. 운영 DB·Auth/RLS·secret 변경은 별도 승인. 기존 공고 틀 보존.

</details>

## 2026-10-21 — 메인 지도 2~5번 데모
- 요청: 정확도·점 선택·직선거리 표시 삭제, PC 화면 안 공고 목록, 기존 핀 창 B안. 사용자 확인 전 운영 반영 금지.
- 변경: PC/모바일 메인·시설 상세의 직선거리 표시 제거(계산·반경은 유지). mapSearch.visibleEntries로 PC 숫자·목록 일치. demo/pin-panel-b의 버튼 2개 재사용. 지정 해시 2개 갱신.
- 검증: 화면 밖 공고 제외 시험 기존 실패 → 수정 후 통과, 지도 이동·대표 핀·위치 미정·중복 시험 포함. 타입·69/69·build·PC 기준 8/8 통과. 브라우저 위치 선도착·B안·실제 드래그 목록 검사는 PR CI에서 실행 예정.
- 상태: preview/map-cleanup-20261021 데모 전용, master·운영 DB 변경 없음. 6번 업종 자동 연결은 다음 단계.
<details><summary>교체 전 HANDOFF</summary>

# CHATGPT_HANDOFF — 메인 지도 핀 후속 완료 (2026-10-21 12:58 VN)

## 1. 현재 상태
- PR #188 병합, 앱 소스 master `c5688ee`. 위치가 핀보다 먼저 도착하면 핀 첫 도착 때 내 위치+가까운 핀을 다시 맞춤. 취소된 조정은 완료로 기억하지 않음.
- [직접 확인] 운영 배포 success, deploy-verify 통과: https://github.com/KHOAILANG0926/jobi-app/actions/runs/39552348589
- [직접 확인] 운영 https://www.viecganban.vn 에서 위치 권한 허용 + 21.10,106.07, GPS 먼저·핀 나중 순서 검증. 모바일390·PC1366 모두 VietMap 핀 2개가 지도 안에 표시됨. 캡처 PNG 2개 직접 열어 확인.
- 운영 핀 검사 통과·캡처: https://github.com/KHOAILANG0926/jobi-app/actions/runs/39552524255 (artifact 12323659389). 실제 공개 API 좌표 사용, 운영 지도 스타일 사용. PR CI만 지도 키가 없어 빈 배경 스타일 사용.
- [직접 확인] 타입·69/69·빌드·PC 기준 8/8 및 최종 PR 필수 검사 통과. 취소 회귀 기존안 0 !== 1 실패 → 수정 후 통과.
- PC/모바일 JSX·CSS·공고 틀·운영 DB 변경 없음. PC 기준 해시는 지도 effect 변경만 반영. 현재 데이터 2건 검사는 #188 가지/배포에 한정, 수동 실행도 가능.
- STATUS 기준 2026-10-21 12:56 VN: c5688ee 운영 success, 공개 2건. 별개 기존 공고 규칙 시험 실패 5건은 이번 지도 작업에서 수정하지 않음.
- 이전 상세·자동위치·줄 보충·예약 알림 이력 및 교체 전 HANDOFF는 WORK_LOG에 보존. #4828 공개 company는 빈칸이며 제목은 “Tuyển công nhân sản xuất dây truyền dữ liệu, dây mạng”.

## 2. 다음 할 일 3개
1. 핀 선택 창 B안 `demo/pin-panel-b`: Lee 데모 확인 대기. 확인 전 운영 반영 금지.
2. 등록 시 공식 occupation_code로 category 자동 결정(Lee 동의, 미착수).
3. 결정 문서 승인 방식 변경(#141·#175, Lee 1회 GitHub 승인 필요).

## 3. 필수 규칙
- AGENTS.md·CLAUDE.md 준수. 범위 밖 수정·운영 DB 변경 금지. STATUS 생성 장치 수정 금지.
- 공고 기준틀 보존. VietMap 메인, Google 길찾기. 키·데이터 PC 저장 안내 금지.
- 짧게 [직접 확인]/[기존 기록]/[추정] 구분. 코드·PR만으로 완료 금지. 실제 운영 화면과 deploy-verify 근거 필수.

</details>

## 2026-10-21 12:58 VN — 메인 핀 운영 직접 확인
- 요청: 인계 다음 할 일 1번(fix/fit-after-pins), 운영 핀 표시 확인 전 완료 금지.
- 변경: PC/모바일 늦은 핀 재조정, 취소된 타이머 완료 기억 방지. JSX/CSS·운영 데이터 변경 없음.
- 검증: tsc·69/69·build·PC 기준 8/8·최종 PR 검사 6종 통과. 별도 코드 검토 중요 지적(순서 보장·지도 실패 안내 검사) 반영.
- GitHub: PR #188 → c5688eee34e4dd0b56c0903e6c2e34e5f58d19ea, Production success.
- 운영: deploy-verify 39552348589 통과. 실제 위치 허용 21.10,106.07에서 GPS 먼저·핀 나중 증명, VietMap 모바일390/PC1366 핀 2개 경계 안 표시. 39552524255 통과, artifact 12323659389의 캡처 2개 직접 확인.
- 시험 환경 보완: 첫 CI는 키 없는 배경 스타일 불러오기 실패, 두 번째는 #4828 company가 빈칸인데 Mao Yên을 제목에서 찾은 시험 오류. 좌표·공고 데이터는 위조하지 않음. 수정 후 최종 Preview·운영 통과.
- 남은 문제: 지도 핀 화면 밖 문제의 사용자 완료 조건 충족. 다음 작업은 핀 선택 창 B안 데모 승인 대기.
<details><summary>교체 전 진행 중 HANDOFF</summary>

# CHATGPT_HANDOFF — 지도 핀 후속 검사 중 (2026-10-21)

## 1. 현재 상태
- 작업 가지 `fix/fit-after-pins`, PR #188. NORMAL 지도 버그 수정. 운영 미반영·완료 아님.
- 원인: 허용 위치가 핀보다 먼저 오면 내 위치만 확대. 핀 첫 도착 때 다시 맞춤. 취소된 타이머는 완료로 기억하지 않게 보완.
- PC/모바일 지도 effect만 수정. JSX·CSS·공고 틀·운영 데이터 변경 없음.
- 직접 실행: 취소 회귀 기존안 실패(0 !== 1) → 수정 후 통과, 타입·69/69 테스트·빌드·PC 기준 8/8 통과.
- 서버 브라우저 회귀: 허용 위치 21.10,106.07 + 실제 공개 핀 응답 지연, 핀 2개 전체가 지도 안에 드는지 검사·촬영. PR은 preview, 운영은 deploy-verify 성공 뒤 실행.
- 기존 운영 상태 기준: status/STATUS.md 2026-10-21 12:39 VN, master 1969955, 공개 2건. 기존 상세·자동위치·보충·알림 이력은 WORK_LOG에 이전 HANDOFF 원문 보존.

## 2. 다음 할 일 3개
1. PR #188 필수 검사 → 병합 → 운영 deploy-verify 및 지도 핀 회귀 확인. 위치 허용 21.10,106.07에서 KDA·Mao Yên 핀 2개가 보이는 캡처 직접 확인 전 완료 금지.
2. 핀 선택 창 B안 `demo/pin-panel-b`: Lee 데모 확인 대기, 확인 전 운영 반영 금지.
3. 등록 시 occupation_code로 category 자동 결정(미착수). 그 뒤 결정 문서 승인 방식 변경(#141·#175).

## 3. 필수 규칙
- AGENTS.md·CLAUDE.md 준수. 범위 밖 수정·운영 DB 변경 금지. STATUS 생성 장치 수정 금지.
- PC/모바일 공고 틀 보존. VietMap 메인, Google 길찾기. 키·데이터 PC 저장 안내 금지.
- 결과 짧게 [직접 확인]/[기존 기록]/[추정]. 코드·PR만으로 완료 금지. 운영 핀 캡처와 deploy-verify 근거 필수.

</details>

## 2026-10-21 지도 핀 후속 검사 중
- 요청: fix/fit-after-pins 이어서, 운영 핀 2개 직접 확인 전 완료 금지.
- 수정: 늦게 온 핀 재조정 + 취소된 타이머 완료 기억 방지(PC/모바일). JSX/CSS 변경 없음.
- 검증: 기존 수정안 StrictMode 취소 회귀 실패(0 !== 1) → 보완 후 통과. tsc·69/69·build·PC 기준 8/8 통과.
- 원격 PR #188, 운영 미반영. 실제 핀 화면 회귀를 추가해 CI 확인 중.

<details><summary>교체 전 CHATGPT_HANDOFF 원문 (2026-10-21)</summary>

# CHATGPT_HANDOFF — 지도 핀·위치 자동 사용 (10-21 낮, GPT로 넘김)
갱신: 2026-10-21 12:40 Asia/Ho_Chi_Minh

## 1. 현재 상태
- 운영: 공개 공고 2건(#4824 KDA, #4828 Mao Yên). master = #180(6d9de1f), deploy-verify 통과.
- 빠진 줄 자동 보충(#167, Lee 10-20): 원문·포스터(ai-v1)에 있는데 공고 글에 없는 줄을 막지 않고 글자 그대로 칸에 붙임(scripts/ocr/detail-fill.mjs, job-ocr-check.yml에서 OCR 뒤 실행). 규칙에 없는 종류는 07 + ocr_check.detail_fill.unclassified → 매일 08:52 예약 점검이 Lee에게 알림 → Lee가 정하면 src/lib/jobDetailFill.ts KIND_RULES + 결정 문서 + 시험에 추가(규정이 바뀌면 전 공고 자동 재배치). 운영 반영 확인: #4828 15→23줄, #4824 7줄 보충, 두 공고 공개 유지. 두루뭉술한 문구(장점·끝맺음 권유·TUYỂN FULL)는 묻지 않고 07(Lee 10-20, KIND_RULES, #169).
- 위치 못 찾은 공고(#170, #154 대체, Lee 10-20): 찾음(확인 좌표·공단 입구·동 중심·KCN 이름)=공개 / 원문에 위치 정보 없음=바로 삭제(map_r1_delete_no_info) / 주소 있는데 못 찾음=비공개, 자동 삭제 절대 없음, 매일 03:00 재판정, 매일 20:00 예약 점검(trig_01QD9erq4V4WAUqD8ydyTJpw)이 map_r1_unlocated_report로 Lee에게 원인·해결안 보고. 상세요강 새 종류 알림은 매일 08:52(trig_01UPYmvMx2btwzLHUEvcEv9o).
- 공고 상세 상세요강(#163): 원문 줄을 01~07 칸에 글자 그대로 옮김. 빼도 되는 줄은 3가지뿐(원문 소제목·제목 반복·위에 이미 있는 주소/전화). 급여 줄은 남김. 한 줄이라도 빠지면 원문 전체를 07에 그대로(기계 검사). 디자인은 알바몬 참고: 핑크 세로 막대(#e58aa0)·글머리표·칸 사이 여백. 08 사진 칸(포스터·회사 사진 등 썸네일, 누르면 크게, 제목 막대 없음 #165). 정답표 시험 #4824·#4828(src/lib/jobDetailSections.test.ts).
- 결정 0007(공고 상세 구성) PR #164 열림 — Lee는 채팅으로 내용 확인함.
- Google 길찾기(#161): 빨간 핀·Google 원래 색 글자 물결·지도 누르면 Google·스쿠터 모션. 원 테두리 금지.
- 위치: 정확한 근무지는 Google 길찾기(주소 글자 넘김), VietMap은 메인 지도·대략 위치. Google 좌표 가져오기 불가(약관). 저장 즉시 위치 찾기(#153, 키는 Vercel만): #153 이후 실제로는 서버 함수가 시작부터 실패(500)하고 있었음 → #172(src를 빌드 때 dist/api-lib로 묶음)로 고침. [직접 확인] 10-20 00:00 UTC #4828=동 중심 찾음, #4824=KCN 찾음, 둘 다 공개, 응답 200.
- 대기: PR #158(status 가지 배포 중단, 검증장치 라벨 필요). PR #154는 #170으로 대체(닫음).

- 첫 방문 위치 허용 창(#177, Lee 10-20): "Tìm việc gần bạn" / Cho phép · Để sau, 한 번만, 허용 위치는 메인 지도 출발점(src/lib/userLocation.ts, LocationPrompt.tsx). 브라우저 권한 창 글자는 휴대폰 언어를 따름(바꿀 수 없음). PC 기준 해시 갱신(test-desktop-baseline, master에서 이미 #148 이후 어긋나 있었음).
- 도면(PR #141 가지): 10-20 운영 측정값으로 갱신, 공고 #4824·#4828 check 통과(run 39351181722). 결정 문서 0008 PR #175. 둘 다 Lee 승인(CODEOWNERS) 대기.
- 공단 핀(#179·#180): 공단 표에 없는 KCN은 VietMap 공단 이름 검색으로 대략 핀(같은 이름 여럿이면 업종 분류 있는 POI 1곳). [직접 확인] #4824 핀 생김(21.1966,105.9933), 메인 지도 핀 2개. 메뉴 'Theo ngành' 링크를 실제 업종 값으로(옛 값 factory 등 → 0건이었음), 시험 api/_menu-links.test.ts.
- 오토바이 시간 데모(demo/commute-time)·위치 안내 데모(demo/location-guide)는 Lee가 접음(정확한 위치 공고가 늘면 재검토).
- 남은 시험 가지 probe/*(삭제 권한 없음, 병합 금지).

- 10-21 운영 반영(모두 deploy-verify 통과): 메뉴 업종 링크 실제 값으로, 공단 표에 없는 KCN 핀(parkLocate), 휴대폰 메인 지도 첫 화면 핀 전체 보이기, 내 위치+가까운 핀 맞추기(fitPins), 이미 허용한 기기는 접속 시 자동 위치 사용(LocationPrompt), 상세 지도 핀 = 메인 지도 핀(/api/map-locations 공유, JobVietMap 늦게 온 값 반영).
- [직접 확인] 남은 버그: 이미 허용한 기기는 위치가 핀보다 먼저 도착 → 지도가 내 위치에만 확대돼 핀이 화면 밖(Lee 캡처 10-21 12:32, 위치 박닌 시 남쪽). 수정 코드는 가지 fix/fit-after-pins(핀이 처음 생길 때 한 번 더 맞춤), 운영 미반영·미검증.

## 2. 다음 할 일 3개
1. fix/fit-after-pins 검사→병합→운영 확인. 확인 방법: 운영 사이트, 위치 권한 '허용' 상태 + 위치 21.10,106.07(박닌 시 남쪽)로 열어 메인 지도에 핀 2개가 화면 안에 보이는지 촬영. 보이기 전에는 "됐다"고 보고 금지(10-21 Lee 지적).
2. 지도 핀 선택 창 B안(demo/pin-panel-b): 버튼 2개 [Xem chi tiết 빨강][Chỉ đường 흰 바탕·빨간 테두리], 파란 버튼 3개·긴 안내 2줄 제거. Lee 데모 확인 대기 → 확인되면 운영.
3. 업종 자동 분류: 공고 등록 시 공식 직업분류 코드(occupation_code)로 category를 자동으로 정하기(Lee 동의, 미착수). 그 뒤 결정 문서 승인 방식 변경(#141·#175, Lee 1회 GitHub 승인 필요).

## 3. 필수 규칙
- CLAUDE.md "진행 알림·화면 변경 프로세스"(2026-10-19): 화면 모양은 말로 먼저 상의, 데모 링크 즉시, 기다리는 작업은 변화 때마다·10분마다 먼저 알림, 운영 배포 끝나면 링크 즉시 + deploy-verify 결과 따로.
- 디자인은 Lee가 준 참고 화면 컨셉(알바몬)을 따름. 유아적 아이콘·색 제안 금지.
- 보고 짧게·쉬운 말·[직접 확인]/[기존 기록]/[추정]. GitHub 링크로 확인 넘기지 않기. 제안은 끝 단계까지. PC 저장 안내 금지.

</details>

## 2026-10-21 12:40
- 변경: 메뉴 업종 링크, 공단 핀(parkLocate·POI 선택), 휴대폰 지도 첫 화면 맞춤, fitPins, 위치 자동 사용, 상세 지도 핀 공유·JobVietMap 최신 값
- 남은 문제: 위치가 핀보다 먼저 오면 핀이 화면 밖(fix/fit-after-pins 미반영), B안 데모 대기, 업종 자동 분류

## 2026-10-20 22:05
- 변경: #179 공단 표에 없는 KCN 핀(parkLocate)·메뉴 업종 링크 수정, #180 같은 이름 공단 POI 선택 + 재판정 migration 2개
- 검증: 67/67·tsc·build, 운영 DB 적용·deploy-verify 통과, 운영 촬영: 지도 핀 2개, ?cat=san_xuat_xay_dung 공고 2건

## 2026-10-20 20:20
- 변경: #177 첫 방문 위치 허용 창 + PC 기준 해시 갱신. 도면 가지(#141) 재측정·check 통과, 결정 0008 PR #175
- 검증: 65/65·tsc·build, mobile-home 통과, deploy-verify 39428820913 통과, 운영 번들에 창 포함 확인

## 2026-10-20 07:05
- 발견: 운영 /api/location-hook·/api/admin-auto-location 시작부터 500(FUNCTION_INVOCATION_FAILED) — Vercel이 src .ts(확장자 없는 import)를 못 읽음. #153 이후 위치 찾기가 한 번도 안 돌았음
- 변경: #172 vite.api.config.mjs → dist/api-lib/auto-location-runtime.js, 두 함수가 그 파일 사용(includeFiles)
- 검증: GitHub Actions에서 운영 호출 405/401/503(정상 응답), 재판정 응답 200, #4828 area·#4824 located 공개 유지

## 2026-10-20 06:55
- 요청: 두루뭉술 문구는 기타란 / 못 찾은 공고는 삭제 말고 목록 만들어 저녁 8시 알림(Lee 10-20)
- 변경: #169 KIND_RULES 3개, #170 locationLevel(no_info/our_miss)·map_r1_unlocated·delete_no_info·unlocated_report·03:00 재판정 cron, 14일 삭제 제거
- 검증: 65/65 시험·tsc·build, #4828 동 중심·#4824 KCN으로 찾음 로컬 재현, 운영 DB 적용·deploy-verify 통과
- 예약 점검: 20:00 trig_01QD9erq4V4WAUqD8ydyTJpw
- 남은 문제: 결정 문서 0008

## 2026-10-20 06:20
- 요청: 빠진 줄은 공개를 막지 말고 자동으로 채우기 + 규칙에 없는 종류는 Lee와 칸을 정해 새 규정(Lee 10-20)
- 변경: src/lib/jobDetailFill.ts(+test), scripts/ocr/detail-fill.mjs, job-ocr-check.yml 보충 단계, 'MỨC LƯƠNG' 소제목 04 인식
- 검증: 정답표 #4824·#4828, 로컬 DB로 2회 실행 중복 없음·규정 추가 시 07→칸 이동 확인, 64/64 시험·tsc·build
- commit: e6cbbb6 (#167) / deploy-verify 통과 / 운영 DB 보충 확인(#4828 8줄, #4824 7줄)
- 예약 점검 trig_01UPYmvMx2btwzLHUEvcEv9o 매일 08:52
- 남은 문제: 새 종류 13줄 칸 결정 대기

## 2026-10-19 23:45
요청: 상세요강 칸 구성(알바몬 참고)·사진 칸·진행 알림 프로세스.
변경: #163(상세요강 01~07 + 08 사진 칸, 핑크 세로 막대·글머리표, 사진 썸네일 누르면 크게), #164(결정 0007 공고 상세 구성, 열림·Lee 승인 대기), #165(08 사진 칸 제목 막대 제거 + CLAUDE.md "진행 알림·화면 변경 프로세스").
수정 파일: src/lib/jobDetailSections.ts·test, src/pages/JobDetail.tsx, src/index.css, CLAUDE.md, docs/decisions/*/0007.
검증: 정답표 시험(#4824·#4828), PR 필수 검사 통과, #165 Vercel 운영 배포 success(9b926f7). deploy-verify: 통과(run 39287685481).
남은 문제: #4828 상세요강 누락 줄("Không cửa từ…", 회사 소개) + OCR 누락 검사(Lee 답 대기), #154 재작성, 위치 허용, 번지 형식, 도면 재측정.

## 2026-10-19 21:30
요청: 위치 못 찾는 원인·대안 검토, 상세 근무지 문구·Google 길찾기 시각 효과.
변경: #156(기록 가지 배포 중단), #157(TomTom 시험 API 서버 출입증 + 시험 워크플로), #160(동 지역 문구 줄임), #161(핀·글자 물결·지도 누르면 Google·스쿠터). #158 status 가지 배포 중단(라벨 대기). #159 원 테두리 효과는 Lee 반대로 닫음.
검증: deploy-verify #157 39182709533, #160 39262166710 통과. TomTom 시험 run 39182912711. 데모 촬영으로 모바일 줄바꿈·칸 밖 이탈 발견 후 수정.
남은 문제: 위치 허용 요청, #154 재작성, 번지 형식 인식, 도면 재측정.

## 2026-10-19 00:00
요청: #4828 지도 원인 → Lee 결정(새 주소 형식, 저장 즉시 위치 찾기, 키는 Vercel 한 곳, 못 찾은 공고 비공개→삭제), Vercel 배포 한도 원인.
변경: #152(2단계 주소·저장 좌표 재사용, 운영 확인), #153(저장 즉시 위치 찾기 — DB 적용, Vercel 코드 배포 한도로 미반영), #154(결정 0006, Lee 확인 대기), #156(기록 가지 배포 중단, 대기). 시험 PR #151 닫음(GitHub VietMap 키 401).
검증: 각 PR 테스트 64/64·tsc·build. deploy-verify 39142616608 통과(#152), 39143169739 실패(#153, 배포 한도).
남은 문제: 배포 한도 해제 대기, #154 Lee 승인, 주간 규칙 보강 예약, 도면 재측정.

## 2026-10-18 21:45
요청: Lee 결정 — 근무조건 칸 내용이 끊어지면 안 됨, 최대 3줄 / 지도 불일치 원인 파악.
변경: PR #148(src/lib/conditionLines.ts·test, src/components/ConditionLines.tsx, JobDetail.tsx, index.css, scripts/layout/measure.mjs).
검증: tsc·build·단위 시험 통과, PR 검사 전부 통과, 브랜치 빌드 측정(run 39135430474) 꺾임 0, 운영 deploy-verify 통과(run 39135606656). commit 70cd250, master push, 운영 배포.
지도 원인: wardArea.parseWardUnit 2단계 주소 미인식 → MAP-R1 unresolved → 성 중심(HANDOFF 참고). 코드 수정 안 함.
남은 문제: 도면 재측정, #136 임의 변경 Lee 답 대기, 지도 수정 지시 대기.
