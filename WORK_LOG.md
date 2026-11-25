## 2026-11-25 — JOBI 앱 1단계 준비 ①: 목록 조건 필터를 lib로 뽑음(웹 동작 동일)
- 요청(Lee): 최종 V3 시안 기준 구직자 핵심 기능 개발 연속 진행. 앱은 웹 화면 코드를 못 가져오고 복제도 금지 → UrgentJobsPage 안에 있던 목록 필터(`filtered`)·정렬을 `src/lib/jobListFilter.ts`로 옮겨 웹·앱이 한 함수를 공유(Home.tsx→jobSearch.ts로 뽑은 선례와 같은 방식).
- 변경: `src/lib/jobListFilter.ts`(+시험), `src/pages/jobsMenu/UrgentJobsPage.tsx`는 같은 조건을 함수에 넘기도록만 바꿈(조건·결과 동일, 화면 코드 변경 없음).
- 검증 [직접 확인]: tsc·build·npm test 128/128(새 시험 포함).

## 2026-11-25 — #6454 기존 공고 대조 누락: 원본 식별자(source_url)로도 찾기
- 원인 [직접 확인]: 검증 저장(09:48) 직후 상세 정리(job-ocr-check 45589142507, detail-fill '원문에서 다시 만듦', scripts/ocr/detail-fill.mjs:90)가 설명을 새로 쓰며 [source:vieclam24h] 표시를 지움 → vieclam24h 수집기의 기존 공고 목록(설명 표시로만 조회, crawl_topcv.load_existing_lookup_maps)에서 빠짐 → 다음 검증 저장(45630753016)에서 '새 공고'로 처리(DB 입구 중복 판정이 같은 번호 6454를 돌려줘 중복은 없음).
- 변경: 기존 DB 칸 source_url(원본 식별자, 상세 정리가 안 건드림)로도 조회(사이트 주소로 거름 — 다른 사이트와 안 섞임). detail-fill·다른 수집원 코드는 안 바꿈. 시험: 수정 전 실패 재현 → 통과(새 2건), 수집기 시험 전부 통과.
- 남은 것(범위 밖, 보고만): 상세 정리가 다른 수집원 공고 설명의 출처 표시도 지울 수 있음(화면 source 읽기 jobRows.parseDescription).
## 2026-11-25 — JOBI 앱(/app) 0단계 뼈대: app.html·src/app·/app 주소·경계 검사(#1031)
- 요청(Lee): 앱은 src/app + app.html + /app으로만 추가, 기존 웹 화면은 그대로, 데이터·검색·필터·회원·지원은 기존 기능 재사용. 하단 탭 구직자 5개·기업 4개, noindex, lang=vi.
- 변경: app.html(앱 입구, noindex), src/app(main·AppRoot·AppShell·TabBar·ScreenStub·tabs·app.css, 클래스 app-), vite.config.ts(입구 2개+개발·미리보기 /app 규칙), vercel.json(/app·/app/* → app.html, 웹 전체 규칙보다 앞), vite.app.config.mjs(앱 단독 빌드 확인용), .gitignore(dist-app), 경계 검사 src/app/boundary.test.ts(run-tests가 자동 실행, run-tests.mjs 수정 없음).
- 검증 [직접 확인]: tsc·npm run build·npm test 127/127, 앱 단독 빌드(웹 코드 없음), Playwright /app 23/23, master와 웹 5경로×2폭 렌더 10/10 동일, 경계 위반 7종 실패 확인.
- 남은 것: 후속 과제 #1031(공유 청크 jspdf 미리받기, 기업 탭 홈/기업홈 확정 등). 병합·deploy-verify 확인 뒤 1단계.

## 2026-11-25 — vieclam24h 시험 10건 위치 실패 원인 + 보류함 보관 + TP.HCM 인식
- 검증 저장 45588882480(보관 10건 재사용): 1건 숨김 저장(#6454), 9건 location_precheck_failed: not_found. 비교 검색(business-search-compare, 1건씩 9번) 결과 [직접 확인]:
  - TP.HCM 인식 결함 2건(Tiêu Điểm Mới 45617007308·A Mà Kitchen 45617149028): Google이 같은 회사·같은 번지를 찾았는데 원래 성 판정이 "TP.HCM"을 몰라 '성 밖' → 성 이름표(originalProvinceBoundaries)에 hcm 추가.
  - 표기 차이 1건(Concentrix 45589255744): Google·Goong 등록 이름 "…SERVICE" vs 공고 "…Services", Google은 후보 여럿 → 판정 기준은 안 바꿈, 공통 수정안만 보고.
  - 법인 이름 ≠ 가게 이름 5건(Thiên Lý·Sol Group 2·Ly Thái Bakery·Indigo)·검색 결과 없음 1건(PHT): 기존 규칙상 '못 찾음'이 맞음.
- 원문 유실: vieclam24h 입구가 hold=False라 못 찾은 공고가 보류함에 안 남음(#916 뒤 근무지 줄을 입구에 같이 넘겨 그 이유가 없어짐) → 보류함 보관(근무지 줄 포함, 지점별 줄 이름). AGENTS.md에 시험 실행 원칙(#1030 누락분).

## 2026-11-25 — vieclam24h 정기 수집 재개(하루 20건) 준비
- 요청(Lee): 시작 필수 조건 3개(원문 보관·중복 방지·DB 공개 판정) 확인 뒤 vieclam24h부터 하루 20건, 연락처 없는 공고는 원문 보관·비공개.
- 조건 확인 [직접 확인 — 코드]: ① 원문 = 등록 값에 source_text(source_fields.build_source_text, 원문 그대로) ② 중복 = match_existing_row(원본 식별자, #1028 꼬리표 제거)+ingest_private.find_existing(원본 식별자·지점·내용 해시)+dedupe_private.verdict ③ 공개 = DB 트리거 trg_zz0_publish_gate(연락처 8자리 미만이면 비공개).
- 변경: crawl.yml 예약 2번(09:23 목록 앞 10건·15:23 다음 10건, VPS 수집 — 열쇠 없음) + 같은 실행 save 잡(GitHub 서버·ops-keys, 사이트 접속 없음) → crawl_topcv --save-details(정기 저장 경로 save_to_supabase 그대로, 공고별 오류 분리). 시험: CLI 22·격리 109·워크플로 구조 21 통과.
- 남은 것: 워크플로 예약·열쇠 단계라 Lee Approve 필요. 실제 첫 정기 실행 결과 확인. 자체 사업장 위치 DB 자동 저장은 별도.

## 2026-11-25 — vieclam24h 다시 수집 대조: 주소 검색 꼬리표 제거 + Facebook 쿠키 갱신 결과
- 사실 [직접 확인]: #6255 저장 주소(11-18 검증 저장 44307094201)에 목록 화면 검색 꼬리표(?open_from·search_id)가 붙어 있고, 수집기는 목록 주소를 그대로 저장·대조(match_existing_row·new_only 걸러내기·형제 지점 찾기 모두 주소 완전 일치). 꼬리표는 볼 때마다 바뀌어 같은 글을 주소로 못 알아봄 → 제목+회사 대조로만 버티고, 여러 지점 글은 형제 지점 찾기가 0건이 돼 기존 지점까지 새 공고로 만들 위험.
- 변경: canonical_source_url 한 곳(경로가 ….html이면 꼬리표·#부분 제거) — 목록·재검색 수집 주소, 기존 공고 대조 열쇠, 형제 지점은 기존 공고에 저장된 원본 식별자로 찾고 같은 식별자로 등록. 시험 108건 통과(새 3건).
- 시험 수집 45551277295(10건, 저장 없음): #6255는 최신 목록에 없음(일주일 전 글) — 실제 다시 수집 실증은 미완료. 10건 모두 본문 전화 없음(#885 로그인 문제 그대로).
- Facebook: Lee 쿠키 갱신 뒤 45548933278 로그인 정상·글 0건(feed_stalled), 다음 실행 45549172450 보안 확인(checkpoint) → Meta '해킹 의심' 화면. 개인 계정 쿠키는 다시 쓰지 않기로(수집 전용 새 계정 대기). 잠금 유지.

## 2026-11-25 — Facebook 세션 만료 원인 확인 + 증거 요약·브라우저 정보 정상화(계정 잠금 해제·재수집은 보류)
- 사실 [직접 확인 — 실행 기록·코드]: 02:07 미리 보기(45530723068) 02:08:22 로그인 정상 → 02:08:38 스크롤 중 페이지 이동 → 02:22(45532479132) session_expired·계정 잠금. 판정(classify_page_signals)은 로그인 주소이거나 c_user 쿠키가 사라졌을 때만 session_expired(오판 아님). 갱신 뒤 1~2일 안에 만료가 반복(11-18·11-25). 한국 조사(korea-fb-research, 매일 VPS·같은 쿠키·같은 잠금·같은 실행 줄)와 공고 수집이 같은 계정을 쓰고, 둘 다 고정 'Windows Chrome 124'(실제는 리눅스 VPS의 Chromium), 언어는 ko-KR/vi-VN으로 다름.
- 추정: 실행 중 Facebook 서버가 세션을 끊음(쿠키 수명 만료 아님). 원인이 로그인 화면인지 보안 확인인지는 증거가 VPS에만 있어 미확정.
- 변경: ① 증거 저장 때 판정 근거 요약을 실행 기록에 남김(page_signal_summary — 쿠키 이름만·주소 호스트+경로만·숫자 묶음 #·본문 없이 보안 확인 낱말만, 사진·본문은 VPS에만) ② 브라우저 정보를 실제 환경으로(browser_user_agent — 리눅스·실행한 Chromium 판, 두 도구가 new_facebook_context 한 곳). 시험 105건 통과.
- 하지 않은 것(규정): 세션 상태 VPS 보존은 「영구 운영 원칙」(키는 GitHub Secrets에만)과 충돌해 하지 않음. 한국 조사 중단 없음. 보안 확인 우회 없음. 기존 playwright-stealth(자동화 표시 감추기)는 그대로 — 대표 결정 필요.

## 2026-11-25 — 지도 작업 종료 기록 + R 트랙 착수(#940 완료)
- 지도 B안 결과 [직접 확인 — Lee 실행 45529918804]: 연결 기록 0, 같은 지점 중복 0, 보류함 지점 전환 2건 정상 처리(기존 공고 갱신), 실제 추가 좌표 유실 0.
- 미완료(기존 자동화에 맡김): #6435 148 Trần Phú 위치 재확인(기존 매시간 재시도 → 확정·공개 검사 통과 때만 공개), W3b 실제 재시도(장애로 상한에 닿은 건의 하루 뒤 재확인) 운영 확인, vieclam24h 실제 다시 수집 실증(R 트랙 실제 수집 때).
- R 트랙: #940 완료 근거 남기고 닫음(sb-6337 수집 45105178271 → 공개 → 운영 PC·모바일 detail-read 45510134760). 다음 = #872 체크리스트 2단계 신규 Facebook 1건 전 과정(미리 보기부터).
- R 2단계 미리 보기(crawl-facebook-one dryrun 45530723068): 로그인 정상·후보 1건 읽은 뒤 스크롤 중 페이지 이동('Execution context was destroyed')으로 실행 전체 실패 → crawl_group이 페이지 이동을 기존 페이지 상태 판정(inspect_page_state)으로 다시 보고, 로그인·확인 요청이면 기존 계정 정지(AccountStop), 아니면 읽은 후보를 지키고 그 그룹만 멈춤(page_navigated, 화면 구조 경고 아님). 시험 102건 통과(새 3건, 수정 전 2건 오류). 다음 = 미리 보기 다시 → 1건 저장.

## 2026-11-25 — W4·W6 실증(Facebook)·#5992 B안 진행·보류함 실제 처리 + 확인 조회 보강
- Facebook 실제 다시 처리 [직접 확인]: #1022 뒤 8건(5992·5247·5633·5931·5993·5994·6043·6306) 모두 처리 전후 핀 같음(pin_problems 0, 45518390246·45523908693). 11-25 쓰기 기록의 확정 잃음 4건은 모두 E2E 시험 공고(45523648935).
- #5992 B안(Lee 2026-11-25): #5992 = 152 지점 유지, #6435 = 148 지점(기존 위치 검색 → 확정·공개 검사 통과 때만 공개). 전환 당시 연결 기록 0(45314812701).
- 보류함 다시 확인(crawl-facebook-one retry_held 45525575413): registered 2 — 같은 원문·같은 지점 공고를 입구가 갱신했는지(새 공고 아닌지)는 DB 조회 필요.
- 변경: 기존 조회 location-w7-recovery-preview에 '같은 원문 공고 상태'(지원·대화·면접·같은 지점 공고 수·지도 처리)와 '보류함 지점 전환'(상태·등록 공고 번호) 추가(읽기 전용).
- vieclam24h 실제 다시 수집: Lee 결정으로 R 트랙 실제 수집 과정에서 확인(시험 수집 45524240202는 새 공고 3건뿐 — 기존 공고 경로 미사용).

## 2026-11-25 — W4·W6 실증·#5992 복구 확인용: 기존 W7 조회에 E2E 구분·같은 원문 지점 공고 묶음 추가(읽기 전용)
- 완료 [직접 확인]: #1022 병합 bd81f3d·deploy-verify 45517977072 성공. #5992 기존 다시 처리(refresh-facebook-existing 45518390246): 처리 전후 핀 같음(pin_problems 없음, verdict success) — 152 Trần Hưng Đạo 확정 핀 유지.
- 확인 못 함: 148 Trần Phú 지점 공고가 기존 지점 등록으로 새로 생겼는지(실행 기록에 성공 출력 없음, 새 공고는 비공개라 공개 화면 404 — detail-read 45518551923). → 기존 조회 location-w7-recovery-preview에 '같은 원문 지점 공고' 묶음(원문 주소는 md5 앞 6자만)과 W4·W6 쓰기 기록의 E2E 구분을 더함(새 파일 없음, 읽기 전용).
- 다음: 병합 뒤 Lee 실행 1회로 #5992 형제 지점·W4·W6 실제 쓰기 기록 확인.
