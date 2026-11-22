## 2026-11-22 — 5342·5437 비공개 원인: 검사 쪽 홍보 판별이 성조를 빼고 읽어 오판 (PR 초안, 미병합)
- 원인 [직접 확인 로컬]: 만드는 쪽 isPromoLine은 두 줄을 11-04 규칙대로 홍보로 뺌. 검사 쪽 promoLike는 성조를 빼고 'xa'를 xã, 'tỏa'를 tòa로 읽어 정보 줄로 보고 '원문 줄 빠짐'으로 잡음.
- 변경: inspectReading.promoLike — 성조를 빼면 흔한 낱말과 같아지는 주소 낱말(tầng·đường·phố·phường·xã·quận·thôn·ngõ·tòa)만 성조 그대로 대조. 만드는 쪽 변경 없음(1차 안 되돌림). r2Inspect.test.ts에 규칙 기준 정답표(두 함수 각각 대조).
- 진단 조회 scripts/ops/jobs/diag-private-7-20261122.sql(읽기 전용, run-sql-plan 통과·로컬 PostgreSQL 16 실행 확인), docs/ops/2026-11-22_dev_db_separation_plan.md(제안).
- 남은 것: 운영 데이터 확인 못 함(5368·5421·5873·5938), 원본 저장소 PR은 이 세션 push 권한 거부.

## 2026-11-21 — #808 S1~S8 마감: 독립 검토·4대 보고를 병합 조건에서 뺌, 병합 뒤 검사 2개 추가, PR 본문 형식 F12, MAP-1 지도 스타일 대기, ai-review 검사 삭제
- 요청(Lee 11-21): 공고 자동 수집→검증→공개에 필요한 것만 끝내고 #808 닫기. 결정 1 대안 거절 뒤 "최신 상태 요구 안 씀", 결정 2 독립 검토 선택화(11-14 결정 7①·#807 게이트 (3) 변경), 3 MAP-1 원인만, 4 vieclam24h 1건, 5 기록.
- 변경: approval-checks ai-review = neutral「필수 아님, 검토 안 함」·4대 보고 분기 삭제 / decision-approval-gate 4대 보고(highRiskReport 등) 삭제 / bot-pr-automerge 검토 대기·검토관 자동 호출 삭제, 병합 뒤 호출 목록에 ai-reader-calibration·job-ocr-check / merge-gate-ready.jq = approval-gate만 / check-pr-ready READY 줄 뒤 설명 허용·칸 경계 / vietMapStyle 상세·관리자 지도 스타일 대기 5·6초→15·20초(메인은 12초 예비지도 제한 안이라 5·6초 유지 — 검토관 지적 1, 시험으로 묶음) / map-summary-check 실패 증거 저장 / 안 쓰게 된 codexGate·needsSecondReview 삭제(검토관 지적 3) / BLOCKED·MERGED 줄도 같은 기준(지적 2) / CLAUDE.md·RULES_CORE.md·AGENTS.md·claude-auto 주석.
- MAP-1 [직접 확인 11-21]: 운영 대상 지도 검사 재현 — style.json 6번 200(0.24~1.9초) 뒤 2번 응답 없음(5·6초 제한 초과). 같은 주소 12번 중 3번 11~12초·1번 20초+(다른 VietMap 파일·사이트는 1초 안). 같은 순서 20번: 운영(옛 코드) 실패 10, 새 코드 실패 2(상세 35초+ 1·메인 예비지도 전환 1 — 이 환경은 예비지도 주소 막힘).
- 검증: 관련 시험 21개·npm test 124/124·tsc·build 통과(로컬). check-repository-policy는 CI 이벤트 필요(CI에서 확인).
- #808 최종 결과(11-21, 닫음): 끝 기준 1 완료 — PR #948 1a83668 봇 병합(run 44883022114)·vercel-deploy 44883059904·deploy-verify 44883165886(MAP-1 통과)·행정 핀 44883204814 성공, 잠금 #943·#945 풀림 조건 충족(이슈는 열린 채) / 끝 기준 2 보류 — vieclam24h 시험 2건(44879128739·44879875442) 본문에 전화번호 없어 공개 0 / Lee가 Ruleset에서 ai-review를 뺀 뒤(08:17Z) ai-review 검사 삭제 PR(approval-checks는 approval-gate만).

## 2026-11-21 — 이전 HANDOFF 본문(11-09~11-18 상태 목록) 이동 — HANDOFF를 1페이지로 덮어쓰며 옮김
- 11-18 vieclam24h 전화번호: 상세 공개 버튼 눌러 읽기 PR(로그인 필요하면 멈춤). 실제 화면 확인은 병합 뒤 VPS 시험 수집 1건. 저장·공개·정기 수집 없음.
- 11-17 #872 R: 회사 이름 동의 확정(규칙 + AI 3회, Facebook 원문 회사만) PR — Lee 승인 전 병합·운영 적용 금지. #886(저장 시험 분리)은 Lee 승인 대기, 운영 DB 저장 시험은 별도 승인 전 실행 안 함. #887은 평가 전용(병합 안 함).
- 11-14 공개 여부 쓰기 정리(#728 R4 4단계, #805): OCR 재공개 블록·canRepublish 삭제(OCR은 내리기만, 올리기는 검사표 한 곳), keepExisting 죽은 코드 삭제, 마감 공고를 공개 조회에서 제외(isJobOpen 한 곳, fetchJobsData). DB 변경 없음. 11-18 지금 master 위로 다시 올림, Lee 승인 전 병합 금지.
- 11-16 S4 B단계: Claude 앱 교환은 checks:write 발급 불가(run 43797922253) → 검사 전용 GitHub 앱(viecganban-checks, 기존 ops-keys 환경)으로 바꾸는 Draft PR. 대표님 앱 설정·Approve 뒤 두 검사 생성 확인 → 필수 지정 → 봇 켜기 → 실증 4건.
- 11-14 직업분류 게이트 비밀키 분리(#728 R4, Draft): publication-gate는 키 없는 시험만, AI 판독 교정은 신뢰된 ai-reader-calibration.yml, 판독 입력 변경 PR은 head 커밋 dispatch 성공 필요(ai-reader-guard). 승인 전 적용 금지.
- 11-13 R2 검증·승인 통제(#728): 병합 봇이 needs-lee 라벨·승인된 화면 틀 파일·결정 문서 PR을 현재 head Lee 승인 전엔 병합 안 함(#792, 원격 위반 PR #793·#794 차단 확인). R2 완료 아님 — 승인 필요 항목(#740·5157·고용주 관문·#764·#771·계정 분리)은 #728 장부.
- 11-12 밤 근무(2): #760 뒤 대기열이 sb-5942 HAIDILAO(원문 주소 없음)에서 실패 → 주소 못 읽으면 위치 칸만 그대로 두는 PR.
- 11-12 밤 근무: Facebook 기존 공고 찾기가 상세요강 다시 만든 공고를 놓쳐 "기존 0개"로 보던 것(#633 ZHAN AN) → is_facebook_row 한 곳(원문 주소 포함) PR.
- 11-11 밤 근무: 봇 병합이 gh 자체 판단(mergeStateStatus)으로 검사 통과 PR을 거절하던 것(#686) → 서버 병합 API로 바꿈 PR #710. 15:26~ 러너 ubuntu 저장소 주소 장애로 PR 검사(migration-postgres·app-screen) 실패 중(#711) — 풀리면 실패 작업 다시 실행.
- 11-11 밤 근무: 저녁 8시 보고에 'Google 이번 달 사용/한도' 줄 추가(#560 — 대량 수집 전 남은 몫 확인용) PR. 운영 출력은 다음 20시 실행에서 확인.
- 11-11 밤 근무 [직접 확인]: 주소 읽기 — 이름표 뒤 띄어 쓴 대시 칸(GOERTEK 'Làm việc tại: Nam Sơn / Quế Võ 1 - Bắc Ninh', #633) PR. WINMART+ 'khu vực' 뗌은 #668에 이미 있음.
- 11-11 새벽 [직접 확인]: 화면 대조가 비공개 공고를 한 번도 못 열던 것(화면 로그인이 상세에 안 넘어감) #670으로 고침 → 새 공고 sb-5938(Toàn Thắng)·sb-5942(HAIDILAO) 공개, PC·모바일 확인. sb-5931(KHVATEC)은 예전 실패 기록 재대조(3시간 규칙) 대기.
- 11-11 새벽: PR 「확인한 기록」 검사(#667, #666) — 바뀐 파일의 최근 14일 병합 PR·같은 파일 열린 PR을 검사가 찾아 줄마다 제목 낱말 포함 설명 요구, 회사·주소·급여 읽기 함수 수정은 시험 eq 사례 추가 필수. 한계: 읽었는지·채팅 제안·결정 변경 판정은 기계로 못 막음.
- 11-11 새벽: 회사·주소 읽기 따로 붙였던 단계 합침 + 미리 보기 2차 사례(#668), 미리 보기 로그 전화 가림(#661·#664).
- 11-10 밤 상세 ④ 꾸민 본문 + 업종별 13색(#655, Lee "가자") 운영 반영, deploy-verify 42837555553 통과 [직접 확인]. 최신 틀·10-30 구성 공고만, KDA·여러 직무 공고는 기존.
- 11-10 밤 상세 구성(#653, Lee 적용): 10-30 확정 자리로 원문 줄 나눔(① Phụ cấp·Thưởng, ② Yêu cầu khác, ④ 6칸) + #563 업종 그림 머리 + 급여 칸 정리. KDA·여러 직무 공고는 기존대로. deploy-verify 42827351625 통과 [직접 확인]. #563 이슈는 이 PR로 운영 반영.
- 11-10 밤 화면 대조(#646): #650(운영 화면 ↔ 원문·DB 대조, detail-read에 합침)·#651(공개 후보는 관리자 비공개 상세 대조 통과 뒤 공개) 병합, deploy-verify 42814545437 통과 [직접 확인]. 공개 22건 1회 점검 확정 오류 0 [직접 확인 run 42809331299].
- 11-10 병합: #616~#619·#624·#625·#628·#630~#632·#634·#635·#637·#639~#644 [직접 확인]. sb-5876 운영 확인: 제목 "TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT", 회사 "CÔNG TY TNHH ZHAN AN", Google 버튼 = 핀 좌표 21.1585515,106.0664443. 이전: 11-08 PR #542~#554, 밤 근무 #565·#568·#573·#570·#575·#566 운영 반영.
- 알바몬 따라 하기(Lee 11-08) 운영 반영:
  - 고객센터 /ho-tro(FAQ·공지·'Hỏi đáp 1:1' 작성), 벽보 /lam-poster, 테마 채용관 /chu-de/:slug 8개(src/pages/ServicePages.tsx).
  - 공고 등록 /dang-tin: 급여계산기 링크, 임시저장(브라우저), PC 오른쪽 체크 목록, 미리보기 PC·Mobile(/xem-truoc-tin = JobDetail previewJob, 단추 막힘), 새 입력 칸(초보 가능·친구와 함께·우대조건 7개·기간 Thỏa thuận·식대·수습·접수 방법·담당자 이름 → 기존 칸 preference·salary_note·상세요강 '채용 절차'), 추가 고용형태(employment_type_extra: contract·internship·collaborator).
  - 간편 템플릿 B안: 등록 화면 맨 아래 템플릿(src/components/template/AlbamonTemplate.tsx, 78틀) → local_jobs.description_html → 상세 ④가 그 모양 그대로(템플릿 안 쓴 공고·기존 공고는 글자 그대로). 머리 그림 = AI 팀 그림 담당이 그린 업종별 우리 그림(public/images/template, CATEGORY_IMAGES), 글자 모두 검정 + 제목 자리 왼쪽 흐림(새 템플릿 클래스 amt-visual--fade만, 예전 저장 공고 HTML은 그대로, #570). 같은 SHA 로컬 화면 확인 끝, 운영 주소 눈 확인만 남음(#571). 모바일 미리보기 새 창 치우침 고침(#577).
  - 1:1 문의: public.support_inquiries(넣기 누구나 5칸, 읽기·처리 관리자 RLS) + 관리자 탭 '💬 Hỏi đáp 1:1'. 권한은 #553에서 Supabase 기본 권한 걷음(#552 운영 점검 실패 후속 — 새 표 만들 때 revoke all 필수).
  - 머리 줄·메뉴·바닥(src/components/siteChrome.css, SiteFooter.tsx): 검색 칸, 메뉴 이모지 없음·펼침 4칸(col), 바닥 알바몬 구성. 메인 본문·공고 카드는 그대로(카드 변경 데모는 Lee 거부 — 카드 틀은 글 모형 먼저).
  - 이름: 화면·약관·SEO 전부 "Việc gần Bạn"(주소 viecganban.vn·이메일 그대로). scripts/layout/brand-name-check.mjs가 예전 이름 재유입을 막음.
- 이메일 support@viecganban.vn: ImprovMX 무료 전달 설정됨(support → Lee Gmail). Lee가 Mắt Bão DNS에 MX 2줄(mx1/mx2.improvmx.com, 10/20)·TXT 1줄(v=spf1 include:spf.improvmx.com ~all) 넣기 남음(A·CNAME 건드리지 않기).
- 데모 브랜치(운영 아님): demo/albamon-template, demo/site-chrome, demo/white-bg(바탕 흰색 — Lee "색깔은 그냥 놔둬"로 미적용), demo/template-detail.
- 11-09 아침(Lee "적용"): /dang-tin 흰 바탕·업직종 선택 창·근무기간 7칸·사진 4칸(+동영상 자리)·문구 정리, 고용주 사진이 공고에 연결 안 되던 버그 수정(image_url·images), 상세 템플릿 PC 가운데·빈 회사 이름 숨김. 상세 WORK_LOG. Lee 결정 대기: 동영상 유튜브 링크 저장 칸(DB), 빠른 등록 Tuyển liên tục.
- 11-09 오전 구조 단순화(Lee "덧붙이기 전에 고치기·합치기·지우기", CLAUDE.md 우선 원칙 8): 상세 틀 2개(KDA·4칸)로 합침, 안 쓰는 파일·자동화 정리, DB 검사 이름 규칙, 규칙 문서 축약. Lee 결정 대기: 운영 SQL 실행 작업 제한안, 동영상 저장 칸. CSS 대규모 정리는 보류(관련 기능 고칠 때 확실한 중복만).
- 11-09 밤 근무: 테마 채용관 모르는 주소 → 첫 테마로 바꿔 보냄·지역 칸 34개 성(#623). #594 P1 교대 누락은 #622(needs-lee).
- 그 외 이전 상태(회사 이름 읽기·카드 상호·급여 읽기·소개소 표시 등)는 WORK_LOG.md.

## 2026-11-19 — S7 완료: 필수 아닌 시험 필수화·중복 워크플로 정리·71개 처리 기록 (#808, #920)
- 변경(#920): pr-checks.yml checks에 crawler-cli-tests(offline)·job-policy-tests·reprocess-queue-ci 시험 그대로 옮김, 제거 3개(job-policy-tests·reprocess-queue-ci·r7-source-aware-unit, 참조 0), map-pin-fit-check 손으로만, SAFE_TEST_WORKFLOWS 정리, 라벨 regression.
- 기록: docs/system-redesign/S7-workflow-results.md(71줄). RULES_CORE 자동 생성은 보류(요약본 문장 훼손 위험).
- 검증: PR 실행에서 옮긴 시험 단계 success, 독립 검토 0, 병합 뒤 master 배포·운영 화면 검사 통과. 남은 일: S8.

## 2026-11-18 — 가짜 전화번호 0111111111 공개(#6255) 근본 수정
- 최초 발생 [직접 확인]: vieclam24h 페이지 자료 jobDetailHiddenContact.contact_phone(로그인 전 자리 채움 값) → #904 detailPageDataPhones → 시험 수집 44246281411(#907 전)의 details.json detailPhone → publish_one 44307094201 build_job_record employer_phone → DB → 상세 "Gọi ngay".
- 원인: ① 공통 번호 읽기 extract_phones가 0으로 시작하는 10자리 모두를 번호로 봄(01x 없는 번호도) ② 저장 단계가 detailPhone 출처(phoneProbe)를 보지 않아 #907 뒤에도 옛 결과가 숨긴 번호를 넘김.
- 변경: extract_phones = 베트남 휴대폰 03·05·07·08·09(Facebook·vieclam24h 공통), build_job_record 전화 = screen_phone(revealed·description_text만), 숨긴 자료 번호·이메일 읽기(#904)·진단 줄 지움. #6255 전화 칸 정정 SQL(scripts/ops/jobs/fix-6255-fake-phone.sql, 입구 update_fields만).
- 검증 [직접 확인 로컬]: 회귀 시험 2개 수정 전 실패 → 수정 뒤 통과, 크롤러 시험 11개 통과.

## 2026-11-18 — S6 완료: 운영 배포 실패 시 일반 PR 자동 병합 잠금 + 병합 기록에 병합 조건 검사 대조 (#808, #913)
- 변경(#913): approval-checks.mjs — 열린 '운영 배포 검증 실패' 이슈(github-actions[bot])가 있으면 일반 PR approval-gate를 Lee 승인 필요로. 풀림 = master 최근 성공 deploy-verify 커밋이 실패 커밋 포함·이슈 닫기·복구 PR Lee Approve. deploy-verify.yml(STRICT)은 그대로. merge-provenance.mjs — 검사 전용 앱 ai-review·approval-gate 병합 시점 대조.
- 모의 시험: s6/deploy-fail-mock(빈 커밋 47fc051) deploy-verify run 44313174748 실패 → 이슈 #918 → 일반 PR 5건 잠금 → #918 닫음 → 풀림. 운영 배포 영향 없음.
- VPS 러너 crawler 정상(run 44277027923). 남은 일: S7.
## 2026-11-18 — vieclam24h 새 공고 근무지 줄을 등록 입구와 같은 트랜잭션으로 (#916, #6255 핀 안 생김)
- 원인 [직접 확인 코드]: crawl_topcv가 ingest_job으로 등록한 직후 replace_job_work_locations로 근무지 줄을 다시 씀 → 저장 직후 위치 확인 서버(location-hook)가 찾는 동안 근무지가 바뀜 → map_r1_complete가 snapshot 불일치로 결과를 버리고 failed(20261111150000_map_r1_other_stores.sql). Facebook은 입구 한 번(등록 트랜잭션)이라 이 경쟁이 없음.
- GEOAPIFY 없음은 직접 원인 아님: 크롤러 자체 좌표만 못 구함(unresolved 줄) — 핀은 위치 확인 서버(Google 재사용)가 정함.
- 변경: ingest_gateway.ingest_job(work_location_rows=) — 위치 확인 뒤 입구 payload로(서버가 매장 여러 곳을 정하면 그쪽 먼저). crawl_topcv 새 공고는 등록 뒤 근무지를 따로 다시 쓰지 않음. 기존 공고 다시 수집은 그대로.
- 검증 [직접 확인 로컬]: test_ingest_gateway(El Gaucho 사례)·test_address_pipeline_integration(#4572 사례: 새 공고 근무지 줄 보존 — 입구 payload로)·test_job_error_isolation(근무지 실패 시 반쯤 저장 없음)·scheduled_cli·cli_safety·work_location_protection·refresh_store_rows.

## 2026-11-18 — 위치 "원래 성 안" 검사: 통합 뒤 "(…, X cũ)" 주소의 옛 성 인식 (El Gaucho, #872)
- 실측 [직접 확인]: publish_one 44299906107 not_found → 업체 검색 비교 44300276494: Google "El Gaucho Hikari Bình Dương"(11.05904,106.68454) 찾음, 성 안=아니오. 원인: 주소에 시 이름(Thủ Dầu Một, 시 경계 자료 없음)과 새 성(TP.HCM)·옛 성(Bình Dương cũ)이 같이 있어 성을 못 정함.
- 변경: withinOriginalProvince만 — 시 단계가 모름이면 글에 적힌 원래 성 1곳(여럿이면 "cũ" 표시 1곳)으로 성 경계 검사. 시 대표점·핀 규칙 그대로.
- 검증 [직접 확인 로컬]: npm test 123/123(administrativeArea 사례 5개 추가), tsc.

## 2026-11-18 — vieclam24h 규칙 거부 로그에 이유 표시 (Lee 18:37 "그냥 공개해")
- 실측 [직접 확인]: publish_one 실행 44296448509 — El Gaucho 공고 location_precheck_failed, 로그에 이유가 없어 원인 확인 불가.
- 변경: crawl_topcv 규칙 거부 줄에 이유(회사 이름·판정) — Facebook 수집기와 같은 형식. 판정은 그대로.
- 남은 문제: 이유 확인 → 위치 확인 → publish_one 다시 → 운영 상세 PC·모바일.

## 2026-11-18 — vieclam24h "전화번호 보기" 버튼 못 찾는 원인 확인(PC 내린 뒤·모바일 화면) (Lee 15:33)
- 변경: 시험 수집(DB 없음)에서 버튼을 못 찾으면 ① 아래까지 천천히 내린 뒤 같은 버튼 찾기 다시(늦게 그려지는 칸) ② 모바일 화면(390px, 앞 2건) 같은 확인 ③ 누를 수 있는 연락·지원 요소 글자(숫자 가림, vieclam24h Hotline 제외)·tel 링크 수 기록. 누르는 방식은 기존 reveal_employer_phone 그대로(눌러서 새로 보인 번호만). 숨긴 페이지 자료는 쓰지 않음.
- 검증 [직접 확인 로컬]: test_detail_section_parser_dom 11/11(내린 뒤 그려지는 버튼 클릭 사례 추가)·job_error_isolation·scheduled_cli·ingest_gateway·cli_safety.
- 남은 문제: VPS 시험 수집으로 실제 버튼 글자·위치·로그인 조건 확인.

## 2026-11-18 — vieclam24h 연락처: 공고 본문에 고용주가 적은 번호만 쓴다 (Lee 최종 지시 14:36)
- 근거 [직접 확인]: 화면에서 숨긴 번호(jobDetailHiddenContact)는 담당자 개인 번호·이메일 — 개인정보보호법(91/2025/QH15, 2026-01-01 시행)상 공개(công khai)도 처리이며 목적 밖 공개 허용 근거를 확인 못 함 → 공개 안 함(있음/없음 기록만).
- 변경: 시험 수집(DB 없음) detailPhone = 공고 본문 칸(Mô tả·Yêu cầu·Quyền lợi)에 적힌 번호(description_text)만. 칸을 못 찾아 화면 전체 글로 대신한 경우(sectionsFallback)는 고객센터 번호가 섞여 안 씀. 페이지 자료 번호는 진단 줄만.
- 검증 [직접 확인 로컬]: test_detail_section_parser_dom(본문·없음·화면 전체 3사례)·job_error_isolation·scheduled_cli·ingest_gateway·cli_safety 통과.
- 남은 문제: 본문에 번호가 적힌 실제 공고 1건 찾기 → keep_for_save → publish_one → 운영 상세 PC·모바일 확인.
