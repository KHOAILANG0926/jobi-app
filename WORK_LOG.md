## 2026-11-06 15:50 — Google 먼저·위치 프로세스·박닌 3건 공개 처리·크롤링 소스 점검 (Claude)
- 요청: Lee "바로 구글로", "프로세스 정립 진행해", "나머지 항목 등록해", "2번(Chợ Tốt) 먼저", "박닌 1건 진행 크롤링".
- 변경: #480 범위 금액 단위, #482 비교 검색 extra 1건만, #483 #5506·#5507 화면 글 정리·보류 공고 재대조(v3), #484 필수 누락 경고만 공개, #485 목록 제목 줄 예외·#5507 원문 정리, #486 #5506 원문 정리, #481 상세 빈 칸 상자 빠짐·연락 버튼 별도, #488 Google 먼저, #489 위치 확인 프로세스·비교 검색 차단, #487·#490 Chợ Tốt 읽기 시험.
- 검증 [직접 확인]: deploy-verify 42173749730(#481)·42184464122(#488) 성공. 이슈 #237 검사표: #5505·#5507 공개, #5506 빈 이름표로 보류. Chợ Tốt 시험 run 42187019576. Facebook dryrun 42185487440 session_expired.
- 남은 문제: Google 429(한도 숫자 미확인), Facebook 쿠키, Chợ Tốt 계정 정지·번호 로그인 필요, Muaban 미시험, #5506 보류, Haidilao 출처.

## 2026-11-06 — 수집 첫 단계 = 위치 확인, 크롤러 자동 차단 (Claude)
- 요청: Lee "크롤링 할 때 제일 먼저 위치를 찾을 수 있는지 먼저… 제일 규칙으로", "자동으로 막는 기능도 넣고, 지도 구현한 것도 프로세스에도 적용".
- 변경: PR #474 최우선 규칙 문서. PR #475 crawler/ingest_gateway.py 새 공고 등록 전 위치 확인(못 찾음·확인 불가 → 등록 안 함, location_precheck_failed), api/location-hook.js precheck 모드(서버 키 인증, 공고·위치 쓰지 않음), api/_lib/auto-location-runtime.mjs precheckLocation(지도와 같은 resolver·같은 저장 결과), src/lib/locationPrecheck.ts 판정.
- 검증 [직접 확인]: locationPrecheck·location-hook·auto-location-runtime·companyPlaceSearch·autoLocationResolver 시험, crawler test_ingest_gateway·test_scheduled_cli·test_source_fields 통과.
- 남은 문제: 관리자·고용주·Lee 제공 등록 경로에는 차단 없음. 첫 실제 크롤링 결과 미확인.

## 2026-11-06 — 위치 "구글을 따라" + #5438 확정 (Claude)
- 요청: Lee "구글을 따라", "일단 바꾸고 앱에 적용 후 프로세스 변경", "허락받지말고 계속해".
- 변경: PR #471(8b6be39) Google 검색어=상세 Google 버튼과 같게(회사, 주소 전체), 같은 이름 1곳이면 Google 장소 좌표(area), 업체 검색 비교 로그에 Google이 집은 곳 표시. PR #472(1e019d0) 원래 성 경계(Natural Earth 단순화) 경계선 2km 오차 허용.
- 원인 [직접 확인]: 이전 검색어(주소 뒤 2토막)·경계 단순화로 Google이 찾은 NEW TEAMROBOTICS VIETNAM(21.22944,106.00377)을 "성 밖" 탈락(run 42127983264).
- #5438: admin-location-confirm run 42131119321 성공(21.229440,106.003770). deploy-verify 42130784784 성공(#472 SHA). 공개 경계 검사 42131233126: #5438 원본·상세 문제 없음, 메인 핀 읽기는 전 공고 16/16 실패(10-28부터 실패 중인 검사 도구 문제, 별도).
- 남은 문제: 이 Claude 환경은 viecganban.vn·Supabase 직접 접속 403 → PC·모바일 화면 직접 확인 못 함. "Google도 모르는 공고 수집 안 함" 자동 차단 미구현.

## (이전 HANDOFF 2026-11-05 사진 처리 판정 스냅샷 보관)

## 1. 현재 상태
- 사용자 최신 지시: "일단 프로세서 수정해". 이번 작업은 사진 처리/완료 보고 경로 수정. Regal Edu 개별 사진 선택·교체·DB 데이터 보정은 하지 않음.
- 기준 master c35e555 (#468 운영 반영 완료, 단위112/112 및 운영 deploy-verify41980985224 성공은 이전 작업 직접 확인 기록).
- 원인: logo_check=found_unstored도 검사 통과했고, 등록 입구가 검색 기록을 제거한 뒤 사진 상태 없이 SQL만 출력. 코드·등록 성공을 실제 업체 사진 완료로 잘못 보고할 수 있었음.
- 수정: found_unstored 항상 미완료 경고. 등록 SQL 생성은 유지하면서 다음 사진 단계를 출력. source-only 미완료 목록을 CI artifact로 보관(운영 검증 아님).
- 사진 완료 주장에는 공식 출처/선택 이미지/회사·지점 확인 근거/저장 주소/등록 결과 공고번호/운영 URL 필요. 실제 검증기가 원본·저장 해시, 실제 공고ID·제목·회사·최종URL, 대표 이미지 URL·디코딩을1366/390px에서 확인하고 원본/상세 캡처+JSON 남김. 실제 검사 성공만 complete=true.
- 공고 JSON PR은 사진 처리 미완료/완료 명시. 미완료는 등록을 막지 않음. 완료는 필수 checks와 app-screen이 실제 검증. 본문만 완료로 변경해도 edited 이벤트로 재검증. 같은 회사 다른 공고로 대체 검증 금지.
- 강제 범위: 수동 ingest-sql 및 공고 JSON PR 완료 주장. 자동 검색·저장 또는 모든 DB/API 경로에 동기 차단을 구현했다고 주장하지 않음. 지점 의미 판별은 원본 화면·확인 근거의 사람 대조가 필요.
- [직접 확인] found_unstored 통과·같은 회사 다른 공고 통과 재현 실패→수정. 핵심/PR/등록 출력 시험 통과. 격리 실제 Chromium에서 원본·저장·실제 DOM·이미지 디코딩·기본사진 거부·다른공고 거부·POST 차단·1366/390px 통과. 전체 단위112/112·타입·빌드·baseline8/8 통과. 독립 검토 Important2건 보완 후 추가 Critical/Important 없음.
- GitHub 연결 도구 커밋·PR·필수 검사·기존 봇 병합 진행 예정. 로컬 push 금지 준수. 앱 화면/CSS/공고 사진/DB 변경 없음.

## 2. 다음 할 일 3개
1. 최종 소스를 GitHub 연결 도구로 fix/photo-process-completion에 커밋·PR, 필수 검사와 기존 봇 병합 확인.
2. 완료 보고는 프로세스 판정 수정 범위로 한정. Regal 실제 사진은 미완료로 남았으며 바꿨다고 하지 않음.
3. 후속 사진 작업은 재처리 목록의 단계부터 실제 원본/지점 확인→저장→연결→운영 증거로 진행. 별도 지시 없는 범위 확장 금지.

## 3. 필수 규칙
- 운영 DB SQL 직접 접근·번호 지정 데이터 덮어쓰기 금지. 승인 틀·하단 사진·STATUS 보호.
- 로컬 push 금지, GitHub 연결 도구 사용. 강제 병합/필수 검사/승인 우회 금지.
- 확인 범위와 미완료를 분명히 구분, 한국어 최종5줄 이내. Secret 출력 금지.

## 2026-11-05 — 사진 처리 미완료/완료 판정 강제 (Codex)
- 요청: "일단 프로세서 수정해". 개별 Regal 사진 교체가 아니라 잘못된 완료 판정 경로 수정. found_unstored가 통과하던 원인 재현 후 항상 미완료 경고로 수정.
- 수동 ingest-sql은 등록을 막지 않고 사진 미완료 단계 출력. 사진 완료 검증기는 공식 원본·저장 해시, 실제 공고ID/제목/회사/최종URL, 대표 이미지 URL/실제 디코딩을 PC1366/mobile390에서 검사하고 원본/운영 화면 캡처+JSON 생성. 메타데이터만으로 complete=true 불가.
- 공고 JSON PR의 사진 상태를 강제하고, 완료 주장은 필수 app-screen에서 실제 재검증. 본문 edited에도 검사 재실행. 미완료 상태를 명시하면 등록은 허용. 원본 재처리 목록 CIartifact는 운영 검증으로 오인하지 않게 표시.
- [직접 확인] 순수 상태/부정/PR/실제 등록 SQL 출력 시험 통과. Chromium 격리 원본/저장/실제 DOM/디코딩/기본사진 거부/같은 회사 다른 공고 거부/POST 차단/PC·모바일 통과. 전체112/112·tsc·build·baseline8/8 통과. 독립 리뷰2건 보완 후 중요 문제 없음.
- 범위: ingest-sql·공고 JSON PR·CLAUDE/core 규칙. 자동 웹 검색/사진 저장/전체 DB/API 동기 강제 아님. 개별 공고 사진/DB/레이아웃 변경 없음. GitHub 커밋/PR/검사/봇 병합 진행 예정.

## 2026-11-05 — 공고 처리 미리보기 운영 적용 지시 및 기존 공개 보호 (Codex)
- 사용자 후속 지시: "내가 확인하게 앱에 반영을 해줘". 기존 미리보기 운영 적용 진행, 추가 재승인 요구 없음.
- 최초 PR#468/9d2a3cb의 GitHub 필수 검사 전부 통과, Preview READY와 실제 #5438 SSR 요약 나이·경력·중국어·CV 확인.
- 적용 영향 확인: job-inspect가 필수9개 누락을 기존 공개 공고에도 소급 적용해 내릴 수 있어, 병합 전 draft 유지하고 보완. 기존 공개는 새 필수항목 누락 경고만, 신규·보류 및 숨김→공개는 반드시 통과해야 함. 전환 모드 기존 inspect JSON에 보관, DB스키마/번호 지정 보정 없음. 다른 공개 규칙은 그대로.
- [직접 확인] 기존 공개 유지 시험 실패→수정 후 통과. 전체112/112·타입·빌드·baseline8/8 통과. 독립 검토 지적 수정: 기존 공개 유지 시에도 필수값 부족하면 재공개 증거(publishable)는 false로 기록. 수정 커밋 후 최종 CI·기존 봇 병합·운영 READY/도메인SHA·deploy-verify 순서 진행.

## 2026-11-05 — 위치·상세 처리 결함 수정 미리보기 (Codex)
- 요청: #5438 지도와 상세 작성 프로세스 원인 조사 후 "수정하고 보여줘, 본 다음 운영 적용 결정". 운영 반영·병합·DB 수정 없음.
- 변경: 기존 age_min/max·원문 나이/경력/언어/CV를 최신 틀의 공통 Job 매핑에서 요약 표시. 공개/SSR/기업/등록 응답 경로의 기존 나이 열 읽기 연결. 구조화 값 우선, 불명확·없는 값 추정 없음, 기존 틀/하단 원문·사진 유지.
- 위치: 산업단지 Google 주소 검색 생략 제거, Google 좌표 대신 얻은 주소를 VietMap/Goong 기존 주소 판정으로 검증. 원래 canonical 대상 유지, 복원 주소는 result/evidence 보관(이미 게시된 공고의 주소/좌표는 관리자 확정 대상). 제공자 실패 원인 보관, 전체 실행에서 실제 호출 VietMap2/Goong3/Google1 상한. 실제 #5438 위치 수정 없음.
- 강제 검사: job-inspect worker에 필수 9개 명시값 전달, 누락이면 기존 publishDecision이 공개 보류. 운영 worker 실행하지 않음. 미리보기는 읽기 전용 화면, 자동 작업/DB 변경 경로 실행 없음.
- [직접 확인] 재현 시험 실패 후 구현, 단위112/112·tsc·build·PC/모바일 요약 연결/원문 보존/넘침 없음·desktop baseline8/8 통과. 최신 호출 상한 수정 후 최종 재검사도 통과. 독립 리뷰 신규 Critical/Important 없음, 지적된 호출 상한도 시험 후 수정.
- 상태: demo/job-process-preview 브랜치 생성. GitHub 연결 도구로 커밋/draft PR·Preview 준비, 사용자 검토 전 병합/운영 반영 금지.

## 2026-11-05 — WebGL2 미지원 PC 흰 화면 수정 (Codex)
- 요청/근거: Lee 운영 PC 흰 화면 및 콘솔 GPUInitializationError: WebGL2 is required … DesktopGeoapifyMapCanvas. 별도 허락 요청 없이 원인 확인·수정·검사·기존 봇 병합·운영 반영.
- 원인 [직접 확인]: 운영 HTML/초기 JS·지도 JS/CSS 모두200. 실제 실행 파일로 기본 화면 로딩 확인, 최종 사용자 콘솔로 GPU 초기화 예외 확인. WebGL context를 null로 만든 격리 브라우저에서 같은 오류3개가 React 밖으로 전파돼 페이지가 사라짐 재현.
- 변경: PC Geoapify 초기화 예외 catch, 모바일의 기존 catch도 공용 RasterMapCanvas로 전환. Leaflet+기존 Geoapify raster tile endpoint, WebGL 불필요. 기존 canonical 좌표·정확도·핀 묶음/클릭·반경·지도 범위/카메라·급여 필터 연결 유지. 모든 타일이 실패해도 핀·사이트 유지하고 기존 안내 표시. 정상 GPU 경로·CSS·DB·좌표 수정 없음.
- 검증 [직접 확인]: tsc·build·단위109/109·desktop baseline8/8. WebGL 없는 PC1366/모바일390×타일 성공/전체 실패4경우에서 사이트·핀출처·정확도·공고 선택·급여 필터 통과. 모바일 테스트는 실제 필터창/상세창 닫기 동작으로 조작. 독립 리뷰 Important/Critical 없음. 최종 PR CI 대기.
- 상태: fix/map-webgl-unavailable 브랜치 생성, 커밋·PR·운영은 진행 예정. 기존 상세 사진 확대는 PR #466 운영5c83dbb, deploy-verify41945676187 통과 상태 유지.
- 이전 HANDOFF 보존:
```markdown
# HANDOFF — 2026-11-05 상세 상단 사진 확대 운영 반영 완료
