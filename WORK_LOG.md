## 2026-11-21 — #808 S1~S8 마감: 독립 검토·4대 보고를 병합 조건에서 뺌, 병합 뒤 검사 2개 추가, PR 본문 형식 F12, MAP-1 지도 스타일 대기
- 요청(Lee 11-21): 공고 자동 수집→검증→공개에 필요한 것만 끝내고 #808 닫기. 결정 1 대안 거절 뒤 "최신 상태 요구 안 씀", 결정 2 독립 검토 선택화(11-14 결정 7①·#807 게이트 (3) 변경), 3 MAP-1 원인만, 4 vieclam24h 1건, 5 기록.
- 변경: approval-checks ai-review = neutral「필수 아님, 검토 안 함」·4대 보고 분기 삭제 / decision-approval-gate 4대 보고(highRiskReport 등) 삭제 / bot-pr-automerge 검토 대기·검토관 자동 호출 삭제, 병합 뒤 호출 목록에 ai-reader-calibration·job-ocr-check / merge-gate-ready.jq = approval-gate만 / check-pr-ready READY 줄 뒤 설명 허용·칸 경계 / vietMapStyle 상세·관리자 지도 스타일 대기 5·6초→15·20초(메인은 12초 예비지도 제한 안이라 5·6초 유지 — 검토관 지적 1, 시험으로 묶음) / map-summary-check 실패 증거 저장 / 안 쓰게 된 codexGate·needsSecondReview 삭제(검토관 지적 3) / BLOCKED·MERGED 줄도 같은 기준(지적 2) / CLAUDE.md·RULES_CORE.md·AGENTS.md·claude-auto 주석.
- MAP-1 [직접 확인 11-21]: 운영 대상 지도 검사 재현 — style.json 6번 200(0.24~1.9초) 뒤 2번 응답 없음(5·6초 제한 초과). 같은 주소 12번 중 3번 11~12초·1번 20초+(다른 VietMap 파일·사이트는 1초 안). 같은 순서 20번: 운영(옛 코드) 실패 10, 새 코드 실패 2(상세 35초+ 1·메인 예비지도 전환 1 — 이 환경은 예비지도 주소 막힘).
- 검증: 관련 시험 21개·npm test 124/124·tsc·build 통과(로컬). check-repository-policy는 CI 이벤트 필요(CI에서 확인).
- 남은 것: PR 병합(Lee Approve)·병합 뒤 검사·deploy-verify, Ruleset ai-review 제거(Lee)→ai-review 삭제 PR, vieclam24h 1건, #808 정리.

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

## 2026-11-18 — vieclam24h 공고 1건 공개 등록 선택지(publish_one) — #886 B안 재사용, Lee 승인 필요
- 실측 [직접 확인]: #904 뒤 VPS 시험 수집 44237323822 — 실제 3건 모두 페이지 자료 연락처 "전화 있음·이메일 있음", 공개 판정 ok(DB 없이 계산).
- 변경: crawl_topcv --publish-one(--verify-write-details 파일 1건만, --verify-write 없이 일반 등록, 새 공고만 — upsert_job_record new_only), crawl.yml verify-save 잡에 publish_one 입력(같은 잡·같은 열쇠·같은 저장 단계). 등록 입구 ingest_job의 위치 확인·회사·직업분류·중복·DB 공개 판정 그대로.
- 검증 [직접 확인 로컬]: test_job_error_isolation(PublishOneFromDetails 3개)·test_scheduled_cli·ingest_gateway·cli_safety·job_posting_policy·source_fields·detail_section_parser_dom 통과.
- 남은 문제: Lee 승인 뒤 ① keep_for_save 시험 수집 1건 ② publish_one 저장 ③ 운영 상세 PC·모바일 확인.

## 2026-11-18 — vieclam24h 연락처: 화면엔 없고 페이지 자료에만 있음 → 시험 수집에서 페이지 자료 번호 읽기 (#872)
- 실측 [직접 확인]: VPS 시험 수집 44220370315·44225381066·44227355977·44229632433(10건) — 화면 고용주 연락처·버튼 0, 페이지 자료 jobDetailHiddenContact.data에 contact_phone(번호 목록)·contact_email(이메일).
- 약관 [직접 확인]: vieclam24h 이용약관·개인정보 처리방침에 자동 수집 금지 조항 없음, 약관 5.1조는 고용주 정보(이메일·전화)를 서비스 제공 위해 다른 이용자에게 보낼 수 있다고 함.
- 변경: fetch_job_detail이 이미 읽던 같은 자료에서 contact_phone·contact_email도 읽음, 화면 번호가 없을 때만 detailPhone(page_data). DB 연결 없는 시험 수집에서만(#896 조건 그대로), 로그는 있음/없음만.
- 남은 문제: 저장·공개는 Lee 승인(개인정보 저장·게시).

## 2026-11-18 — vieclam24h 공개 연락처 버튼 눌러 전화번호 읽기 (Lee 지시, 저장·공개·정기 수집 없음)
- 원인 [직접 확인]: build_job_record의 employer_phone_value = "" 는 2026-08-09 TopCV 첫 크롤러(432a5c8)부터 이어진 빈칸 자리 — 전화 읽기를 만든 적 없고, 막기로 한 결정 기록도 없음.
- Muaban 10-23~24 서버 추출 구현: GitHub에 없음(#202 본문에 ops/muaban-private-pilot.py 이름만, master 이력·브랜치 0건) → 재사용 불가, [기존 기록]만.
- 변경: crawl_facebook.extract_phone → job_quality.extract_phones/extract_phone(한 곳, 동작 같음). crawl_topcv.reveal_employer_phone: 상세 화면 공개 버튼("xem/hiện số…")을 한 번 눌러 새로 나타난 번호만 employer_phone로(사이트 대표번호 등 원래 있던 번호 제외), 로그인 창·로그인 화면이면 멈춤(login_required), 로그에는 결과 종류만(번호 안 남김). VietnamWorks 경로·워크플로는 그대로.
- 검증 [직접 확인 로컬]: test_detail_section_parser_dom에 가짜 화면 5종(번호 보임·로그인 창·버튼 없음·눌러도 없음·광고 칸 번호) 추가 — 9/9. CI 연결(crawler-cli-tests.yml 1줄)은 .github/ 코드 소유자 승인 대상이라 별도 PR. 독립 검토 반영: 버튼 누르기는 DB 연결 없는 실행(시험 수집)에서만, 번호는 버튼 연락처 칸 안에서만. 크롤러 시험 통과(address_pipeline 1건은 master에도 있는 #894).
- 남은 문제: 실제 vieclam24h 화면 확인은 병합 뒤 crawl.yml 시험 수집(VPS, 저장 없음, 1건).

## 2026-11-14 — 공개 여부 쓰기 정리: OCR 재공개 삭제 + 마감 공고 공개 조회 제외 (#728 R4 4단계, Lee 확정 범위)
- 요청: Lee 2026-11-14 4단계 수정 범위 확정 — ① OCR 중복 재공개 정리(불일치 보류는 유지) ② 재공개는 검사표만, DB 트리거 보호 유지 ③ keepExisting 죽은 코드·주석 정리 ④ 마감 공고를 공개 조회에서도 제외(관리자 숨김·크론은 그대로) ⑤ 검사 범위·화면 구성 불변.
- 근거 [직접 확인, 폐기용 PGlite]: OCR의 active=true는 검사 기록이 없거나 옛 내용·미통과면 트리거가 되돌림(kept_hidden_by_trigger), 검사표가 통과시킨 뒤에만 성공 → 실제 공개 판정은 검사표. 내림→OCR ok→검사표 통과로 다시 공개되는 경로도 확인.
- 변경: ocr-check.mjs 재공개 블록·ocr-compare.mjs canRepublish/OCR_REPUBLISH_FROM·그 시험 삭제(OCR은 내리기만, 정적 시험 추가). jobInspect.ts publishDecision의 죽은 keepExisting 삭제(동작 불변: 실패 시 내림). jobDetailView.isJobOpen 한 곳(마감 당일 열림, 베트남 날짜) → fetchJobsData(목록·검색·지도·상세·SSR·sitemap 공통 입구)와 급구·저장·최근 본 화면의 따로 쓰던 비교를 합침.
- 지운 것/합친 것: OCR 재공개 블록·canRepublish(공개 조건 사본), keepExisting, 화면 3곳의 UTC 날짜 마감 비교를 isJobOpen 하나로.
- 보강(GPT 검토 5번): 실제 job-inspect.mjs를 PGlite 소켓 서버에 붙여 돌리는 시험 supabase/tests/ocr_inspect_republish.pglite.test.mjs 추가(OCR 불일치→비공개→검사표 통과→재공개, 관리자 숨김 불변). 기존 occupation-publication-check.yml에 한 줄 연결하고 낡은 단계 이름(OCR republish …)을 현재 동작에 맞게 고침.
- Codex P1 수정: 마감 걸러내기를 JobsContext 한 곳으로(useTodayVn이 베트남 자정에 구독자를 깨워 열어 둔 화면·오래된 SSR 목록도 다시 거름). 급구(지역별)·저장·최근 본 화면의 따로 쓰던 마감 비교 삭제, fetchJobsData·화면이 filterOpenJobs 하나를 씀. 시험: 자정 경계·열어 둔 채 자정·구독 해제·단일 필터 지점.
- Codex P1(4ff6fae) 수정: OCR이 공개 공고를 내린 뒤 검사표가 돌기 전에 OCR이 정상으로 돌아오면 hold가 없어 재공개가 끊김 [직접 확인: 실제 job-inspect.mjs + 트리거로 재현]. 원인: 공개 공고를 내리는 문장에서 DB 트리거가 inspect_hold를 지우고, 검사 기록의 '공개' 항목도 통과 상태라 되살릴 근거가 없음. 수정: ocrCheckUpdateSql(hold)가 공개 중이던 공고에만 ocr_check.ocr_hold를 같은 문장에서 남기고, job-inspect.mjs가 이를 hold로 보며 다시 공개되거나 관리자가 숨기면 지움(OCR은 여전히 올리지 않음). tsconfig.tsbuildinfo는 npm run build가 바꾼 생성 파일이라 PR에서 제외(master 그대로).
- 최종 검증(4단계): 검사표 기록 SQL을 job-inspect-write.mjs 한 곳으로 옮기고 읽을 때의 active·OCR 상태가 지금과 다르면 쓰지 않는 조건 추가 — 검사표가 공고를 읽은 뒤 OCR이 내리면 낡은 판정이 덮어써 재공개하던 동시 실행 틈 [직접 확인: 조건을 빼면 rowCount 1로 재현, 넣으면 0]. 시험에 동시 실행·기존 공개 공고 내용 변경·고용주 신규 공개·소유자 철회 추가.
- Codex P1 2건(4aaa5bc): ① 검사표가 active=true를 요청해도 DB 공개 게이트가 거부하면 결과는 비공개인데 같은 문장에서 ocr_hold를 지워 원인 수정 뒤 되살릴 근거가 사라짐 [직접 확인: 실제 publish-gate 트리거로 재현, 표지 false] → 지우기를 별도 문장(CLEAR_OCR_HOLD_SQL)으로 옮겨 기록 문장이 돌려준 active가 true일 때만 실행. ② refresh-facebook-existing.yml이 OCR 뒤 검사표 없이 finalize를 불러, OCR이 더는 재공개하지 않는 지금 검사표 대기 공고가 unexplained_unpublished 실패로 셈 [직접 확인: crawler 시험 재현] → blocking_reason에 검사표 표지(inspect_hold·ocr_hold) 있는 비공개를 held:awaiting_inspect로 구분(실패 아님, 표지 없으면 여전히 실패, 공개→비공개 재처리·OCR 불일치 판정은 그대로). OCR 뒤 finalize를 부르는 곳은 이 workflow 하나(job-ocr-check는 OCR 뒤 검사표를 돌림).
- Codex 후속(0309565): ① 검사표 대기(blocked + held:awaiting_inspect)를 아무도 다시 보지 않아 검사표가 공개해도 영구 blocked [직접 확인: 상태·필터를 지키는 가짜 대기열로 재현] → 상태 전이 책임을 finalize 한 곳에 둠: run()이 running과 함께 awaiting_inspect 보류 항목을 다음 실행에서 다시 판정(공개되면 success, 진짜 실패 사유면 그 사유, 아직 대기면 기록 그대로; 다른 보류는 끝난 상태로 두고 건드리지 않음). 시험의 가짜 DB 둘을 상태 지키는 하나로 합침. ② 기록·OCR 내림 표지 삭제·거부 보정을 한 트랜잭션으로 묶음(첫 UPDATE 행 잠금이 커밋까지 유지 → 그 사이 OCR·관리자·소유자 쓰기는 대기). 삭제 문장의 'active' 조건은 두 번째 안전장치로 시험.
- Codex P1(c94b10f, finalize 98행): 검사표 대기 항목을 앞 50건만 조회해, 앞쪽이 계속 대기 중이면(갱신 없이 건너뜀) 51번째 이후가 공개돼도 success로 못 감 [직접 확인: limit·range를 실제로 자르는 가짜 DB로 재현]. awaiting_inspect_items()가 페이지 단위로 전부 모은 뒤 처리(처리 중 offset 밀림 방지). 시험: 앞 50건 대기 + 51번째 공개 → success, 앞 50건은 쓰지 않음, 앞쪽 일부 공개·실패도 그 항목만 변경.
- 남은 문제: 운영 마감 크론 등록·실행 상태와 운영 API 응답은 직접 확인 못 함. DB 변경 없음.
- 2026-11-18 다시 올림: master 이력이 바뀌어 #805가 충돌 상태 → 같은 변경을 지금 master 위에 그대로 다시 얹음(내용 변경 없음, 충돌은 occupation-publication-check.yml의 #861 단계 추가 1곳만 — 두 변경 모두 유지).
## 2026-11-17 — 회사 이름 동의 확정: 규칙 + AI 3회 (#872 R, #887 평가 결과, 병합·운영 적용은 Lee 승인 뒤)
- 요청: 기존 companyReader·ai-classify로 동의 기반 확정. 정확히 같음 → 확정 / 포함 관계 → 짧은 이름이 원문에 따로 쓰이고 ok() 통과 때만 / AI 3회 오류 없이 같은 답 / 아니면 기존 보류·재시도.
- 변경: companyReader.agreeCompany(판정 한 곳), scripts/ocr/read-company-ai.mjs(#887 v3 지시문 3회), scripts/ocr/ai-ask.mjs(ai-classify의 AI 부르기를 옮겨 둘이 같이 씀), ingest_gateway.confirm_company(원문에서 읽은 회사 이름만 — Facebook). 못 부름=company_ai_unavailable(held, 그 공고만), 확정 못 함=company_unconfirmed(unfound, 7일 뒤 다시·최대 2번). 짧은 이름으로 확정되면 그 이름으로 위치 다시 확인, 보류함은 원문 회사 표시를 남김(중복 PR #892 대조에서 받은 지적 2건).
- 검증: companyReader.test(정답표 61건 + 동의 13건)·npm test 122/122·tsc·build·read-company-ai.test·test_ingest_gateway 로컬 통과. 3차 평가 AI 답으로 다시 판정: 정답표 중 틀린 이름 확정 0, 보류 6(NETCO·MEDIAMART·JOY THÁI·ILABY·SEN TÀI THU·Jollibee).
- 남은 문제: 실제 AI 호출은 병합 뒤 Facebook 저장 실행에서만(PR 코드에는 열쇠 없음).

## 2026-11-16 — S4 B단계 3차: 검사 결과를 검사 전용 GitHub 앱으로 (#808, Draft·대표 Approve 전 병합 금지)
- 원인 [직접 확인]: #848 병합(1d57b24) 뒤 run 43797922253 — 교환 401 "Workflows can't get 'checks' at 'write' from this token exchange". Claude 앱 경로로는 불가 확정.
- 변경: approval-checks.yml 잡에 environment ops-keys(기존 운영 열쇠 환경, R8) + actions/create-github-app-token@v2(permission-checks: write만), id-token 권한 삭제. approval-checks.mjs는 CHECKS_APP_TOKEN·CHECKS_APP_SLUG로만 올림(없으면 닫힌 실패), 고칠 대상은 이 앱이 만든 검사만.
- 지운 것: #846·#848의 appToken(permissions) 인자·CHECKS_PERMISSIONS·교환 권한 시험(claude-publish.mjs는 d05ccbd와 똑같이 되돌림).
- 남은 문제: 대표님 앱·environment 설정 뒤 실제 실행으로 두 검사 생성 확인 → 필수 지정 → 봇 켜기 → 실증 4건.

## 2026-11-16 — S4 B단계 2차: 교환 권한에 contents:read 추가 (#808, Draft·대표 Approve 전 병합 금지)
- 원인 [직접 확인]: #846 병합(ef9100a) 뒤 run 43783470691 — 교환 401 "Custom permissions must include 'contents' (read or write) for workflow validation". 닫힌 실패 정상(성공 표시 0).
- 변경: CHECKS_PERMISSIONS = { contents: 'read', checks: 'write' } (쓰기는 checks 하나). 공통 appToken() 기본 요청은 그대로.
- 남은 문제: checks:write 허용 여부는 병합 뒤 실행으로만 확인. 거절 시 검사 전용 앱 대표 결정.

## 2026-11-16 — S4 B단계: approval-checks만 Checks 쓰기 권한 요청 (#808, Draft·대표 Approve 전 병합 금지)
- 요청: Lee 11-16 "approval-checks 작업에서만 Checks 쓰기 권한 요청, 공통 appToken 기본 권한·기존 게시 작업 토큰 변경 금지, 거절·실패 시 안전 중단".
- 원인 [직접 확인]: run 43775353050 — check-runs 생성 403 Resource not accessible by integration. appToken()이 교환 요청 본문 없이 보내 기본 권한(contents·pull_requests·issues 쓰기)만 받음(anthropics/claude-code-action src/github/token.ts DEFAULT_PERMISSIONS·exchangeForAppToken 확인). master 커밋에 Claude 앱 check-suite 있음 → 설치본은 checks 권한 보유로 판단.
- 변경: appToken(permissions) 선택 인자 — 없으면 예전과 같음(본문 없음), 있으면 {"permissions":{...}} JSON 본문(같은 형식). 응답에 권한 목록이 있고 요청 권한이 빠지면 예외. approval-checks 기본 토큰 함수만 { checks: 'write' } 요청.
- 수정 파일: scripts/ci/claude-publish.mjs, scripts/ci/approval-checks.mjs, scripts/ci/approval-checks.main.test.mjs
- 검증: approval-checks.main.test·approval-checks.test·claude-publish.test 로컬 통과. Anthropic이 checks:write를 내주는지는 병합 뒤 실제 실행으로만 확인 가능(교환은 master 워크플로만).
- 남은 문제: 교환이 checks를 거절하면 검사 전용 GitHub 앱(Checks RW + Metadata R, master 전용 environment 비밀값)이 필요 — 대표 결정.

## 2026-11-14 — 직업분류 게이트(publication-gate)에서 비밀키 검증 분리 (#728 R4, Draft·승인 전 적용 금지)
- 원인 [직접 확인]: occupation-publication-check.yml이 PR마다 ai-reader.test.mjs(ANTHROPIC_API_KEY 필요)를 돌림 → 포크 PR에는 Secrets가 없어 키 없음으로 실패(로컬 재현 rc=1). 코드 오류가 아니라 키 경로 설계 문제. publication-gate는 필수 검사 이름(required-checks-pass.jq)이라 포크 PR이 병합 못 함.
- 변경: ① publication-gate는 비밀키 없는 회귀 시험만(Secret 참조 0). ② 키가 필요한 AI 판독 교정은 새 ai-reader-calibration.yml(push master·주 1회·workflow_dispatch만, pull_request 트리거 없음, 의존성 설치 없음). ③ scripts/ci/ai-reader-guard.mjs가 판독 입력(ai-reader·시험·ocr-compare·정답 포스터)을 바꾼 PR은 그 head 커밋의 workflow_dispatch 교정 성공 실행이 있어야 통과(같은 이름 PR 실행·다른 커밋·실패는 불인정). 입력이 안 바뀐 PR은 통과하되 master 교정 결과를 이 PR의 검증으로 세지 않음. ④ 가드 스크립트를 두 번째 검토 대상 파일 목록에 추가.
- 지운 것/합친 것: publication-gate의 키 필요 단계 삭제(교정 워크플로로 이동, 같은 시험 파일 재사용). 새 검사기 대신 기존 check-run 조회(gh api)·필수 이름 시험 구조를 따름.
- 보안 영향: PR 코드·의존성에 키 노출 없음(기존에는 같은 저장소 PR이 PR 코드로 키를 받았음 — 이제 사람이 diff를 본 뒤 dispatch할 때만). workflow_dispatch는 쓰기 권한자만 실행. GitHub 환경(Environment) 승인 보호는 설정 변경이라 Lee 결정 사항.
- 후속 수정(#806 게이트 실패): 새 교정 워크플로 파일이 판독 입력 목록에 있어 이 PR 자신이 가드에 걸림(변경 파일 목록으로 재현: rc=1, 기본 브랜치에 없는 워크플로라 dispatch도 불가). 판독 정확도를 바꾸지 않는 워크플로 파일을 입력에서 뺌 — 워크플로 변경은 두 번째 검토 + 가드 시험의 정적 검사(PR 트리거·의존성 설치 금지, 시험 실행 유지)가 막음.
- 보안 보강(#806 자체 점검, Codex 지적 본문은 읽지 못해 대응 여부 미확정): 가드의 우회 경로 6개를 실제 git으로 재현해 막음 — ① 이름 바꾸기로 교정 시험 옛 경로 은닉(git diff --name-only는 새 경로만) → -z --no-renames ② 개행·따옴표 파일명 → -z ③ 간접 입력(ocr-compare→salaryReader→…) → 교정 시험 import 그래프(기준·head 합집합) ④ 교정 워크플로를 무력화한 채 dispatch 성공을 증거로 제시 → 입력 변경과 교정 워크플로 변경을 한 PR에 못 둠 ⑤ PR이 가드 스크립트를 고쳐 통과 → 기준 커밋 사본으로 실행(기준에 없을 때만 PR 사본) ⑥ 약한 Secret 정적 검사(secrets['X']·toJSON(secrets) 놓침) → \bsecrets\b, 파일명으로 워크플로 명령 주입 → 출력 정리. 한계: 워크플로 파일 자체는 PR 코드라 이 구조 안에서는 두 번째 검토(Codex·검토관)가 최종 방어선.
- 교정 단계 비활성화 차단(#806 보강 2): 기준 사본 가드가 head 커밋의 publication-gate·교정 워크플로 내용을 직접 읽어 무결성을 확인 — 교정 시험 실행 제거·if·continue-on-error·실패 삼킴·PR/workflow_run 트리거·의존성 설치·다른 Secret·가드 단계 건너뛰기·PR 사본 가드 실행·Secret 참조를 막음. 무력화한 워크플로로 돈 dispatch 성공은 위조 증거로 불인정(실제 git으로 재현). 한계: 워크플로 파일 자체는 PR 코드라 가드 호출 단계를 통째로 지우는 변경은 이 구조 안에서는 두 번째 검토가 막음.
- 남은 문제: 원본 Actions 결과 미확인(포크에서 읽을 수 없음). 판독 입력을 바꾸는 포크 PR은 원본 브랜치로 옮겨 dispatch가 필요(승인 필요).

## 2026-11-13 — R2 검증·승인 통제: 자동 병합이 needs-lee 라벨·승인된 화면 틀 파일도 Lee 승인 전엔 안 합침 (#728, Lee 승인)
- 요청: Lee 2026-11-13 "자동 병합 승인 통제 강화" — needs-lee 라벨 PR 자동 병합 금지, 기존 승인 기준 변경 자동 감지, 라벨 누락·Claude 답글로 우회 불가, 기존 봇·검사기 수정.
- 변경 [직접 확인]: decision-approval-gate가 결정 문서 외에 승인된 PC 화면 틀(test-desktop-baseline 잠금 파일 8개)·needs-lee 라벨도 현재 head Lee 승인(리뷰·LEE-APPROVE·화면 틀/라벨은 LEE-DEMO-APPLY 첫 줄) 없으면 병합 안 함(#792, 0421c1a). 원격 위반 PR #793(라벨)·#794(잠금 파일)이 Claude 답글이 있어도 봇 run 43376173892에서 '승인 대기 — 병합 안 함'.
- 같은 날 R2 후속: 검사 독립(screenAudit, #787)·SQL 규칙 문구(#788)·#735/#736/#741 대체(#791·#790·#789)·정답 근거 확인(#781)·병합 출처 기록(#769·#770).
- 지운 것/합친 것: 새 승인 장치 없이 기존 문턱 한 곳에 합침(화면 틀 목록도 기존 잠금 파일에서 읽음).
- 남은 문제: 승인 댓글이 사람인지 AI 세션인지는 구분 못 함(계정 분리는 승인 필요). 승인 필요 R2 항목은 #728 장부.

## 2026-11-12 밤 — 다시 처리: 원문에 주소가 없으면 위치 칸은 그대로 (sb-5942 HAIDILAO, #633 후속)
- 원인 [직접 확인 run 43294627112]: #760 뒤 대기열이 sb-5942(HAIDILAO)도 Facebook 공고로 찾음 → 원문에 번지가 없어 주소 읽기가 빈 값 → "Cannot refresh location without a source-backed location"로 그 공고 실패·대기열 실행 빨간색.
- 변경: refresh_facebook_existing — 주소를 못 읽으면 위치 칸만 고칠 칸에서 빼고 기존 위치(관리자 확정)를 둠. 제목·회사는 그대로 다시 처리. 시험 1개(test_refresh_store_rows).
- 지운 것/합친 것: 실패시키던 raise 한 줄을 지우고 고칠 칸 목록(refresh_fields) 한 곳으로.

## 2026-11-12 밤 — Facebook 기존 공고 찾기: 상세요강 다시 만든 공고도 (#633 ZHAN AN)
- 원인 [직접 확인 코드]: 수집기 기존 공고 목록·관리자 다시 처리·규칙 변경 대기열이 상세요강(description)의 "[source:facebook]" 표시로 Facebook 공고를 찾는데, detail-fill이 상세요강을 원문에서 다시 만들며 표시가 사라짐 → "기존 facebook 공고 0개", 중복은 DB 입구만 잡음. refresh_facebook_existing만 11-01에 source_url로 고쳐져 있었음(수평 전개 누락).
- 변경: crawl_facebook.is_facebook_row 한 곳(표시 또는 원문 주소)으로 수집기·다시 처리·대기열이 같이 씀, 관리자 API(admin-reprocess.js)도 같은 기준. 중복 지문은 원문(source_text)으로도 만듦. 시험 1개 추가.
- 지운 것/합친 것: refresh_facebook_existing 안의 판단 줄을 공용 함수로 옮김.

## 2026-11-12 — 다시 처리 전후 지도 핀 비교 + 매장 줄 합치기 실제 공고 시험 (Lee "이런 거는 어떻게 고치냐")
- 원인 [직접 확인]: 11-11~12 KRIK·MediaMart 다시 처리의 같은 매장 핀 2개·핀 빠짐을 운영 지도 자료로 사람이 확인해서야 알았다(처리 결과는 '제목·R7' 확인뿐).
- 변경: crawler/pin_guard.py — 다시 처리 전 핀 기록 → 마무리 단계에서 다시 읽어 비교(핀 수 감소·같은 좌표 2개면 location_regression, ::error:: 표시, 공개 상태는 안 바꿈). 매장 줄 합치기(merge_store_rows)를 순수 함수로 옮겨 실제 공고 주소(5992·5994)로 시험.
- 지운 것/합친 것: refresh_facebook_existing 안의 합치기 코드를 pin_guard.merge_store_rows로 옮김(동작 같음).
## 2026-11-12 — 예전 공고 마무리: 근무시간 원문 먼저·매장 여러 곳 위치 다시 찾기·#4828 삭제 (Lee "마무리하고 앱으로")
- 원인 [직접 확인]: ① sb-5157 근무시간 칸에 원문·포스터 교대 시간이 같이 들어가 같은 교대가 두 번(6줄) — 상세 채우기가 원문과 포스터를 함께 읽음. ② KRIK 5992·MediaMart 5994 다시 처리 뒤 Google로 찾은 매장 핀이 빠짐(상세 "Đang xác minh vị trí") — 처리권(map_r1_claim_job_v2)이 정확한 핀이 하나라도 있으면 그 공고를 끝난 것으로 보고 다른 매장을 안 찾음.
- 변경: ① detail-fill 근무시간은 원문 먼저, 원문에 없을 때만 포스터(급여 읽기와 같은 순서). 예전에 원문+포스터로 채운 기계 값은 새 값으로. ② 처리권은 핀 없는 줄이 남아 있으면 계속 찾음(map_r1_has_exact는 그대로 — 공개 판정 보호), 그런 공개 공고만 한 번 다시 부름. ③ #4828 삭제(기존 삭제 함수, 사용자 기록 있으면 비공개). 화면 검사가 쓰던 #4828을 같은 틀 공개 공고 #5157로 바꿈.
- 지운 것/합친 것: 처리권의 '정확한 핀 하나면 끝' 조건을 '핀 없는 줄 없음'까지 보는 한 줄로 고침(새 함수 없음). #709(3건 비공개 초안)는 Lee 지시로 4828 삭제만 남기고 닫음.

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
## 2026-11-11 밤 — 종류를 모르는 공장 공고: 카드·상세 ④ 같은 기본 그림 (#682)
- 원인 [직접 확인]: 카드는 industry/san_xuat_xay_dung.jpg(봉제 공장 사진), ④는 template/01-co-ban 3장 중 공고 번호로 — 두 곳이 따로 고름.
- 변경: cardPhoto.factoryPhoto 한 곳(만드는 것을 읽으면 그 공장 그림 첫 장, 모르면 01-co-ban 한 장)을 카드·대표 이미지·④가 같이 씀. Lee 11-11 "덧대기" 1안 "모르면 기본 그림".
- 지운 것/합친 것: ④의 따로 고르던 공장 분기(factoryPhotos+CATEGORY_IMAGES[0] 번호 고르기)를 지우고 카드와 같은 함수로.
- 검증 [직접 확인]: tsc·npm test 119/119·build. multi-role-presentation 브라우저 시험 기대값도 같은 그림으로.

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
