## 2026-11-22 — JOBI 1-B(Lee 승인): 마감·연락처·필수 항목 기준 불일치 해소 — 코드·시험 Draft PR + DB cron Draft PR (병합·운영 DB 없음)
- 실제 실패 [직접 확인, 1-A 측정]: ① 마감 당일을 크롤러는 만료·Facebook은 기한 버림(→상시 공고로 등록), 화면·알림은 열림, 공개 판정 기본 날짜는 UTC ② 연락처: DB 8자리인데 Facebook·job_quality·화면은 값이 있기만 하면 통과(`0912345`·`abc`·`---`도) ③ 필수 9개 목록이 점검 코드·작성 화면·문서에 따로 있음(점검기는 독립성 규칙상 공유 불가 → 일치 시험으로 고정). 정책 평가기 3벌은 4,057건 불일치 0(F1).
- 변경(코드 PR): policy/job-criteria.json(마감·연락처·필수 9개 단일 원천) · crawler/job_criteria.py · src/lib/jobCriteria.mjs(+d.mts) · crawl_facebook/crawl_topcv/job_quality/finalize_reprocess_queue(베트남 날짜·마감 당일 열림·연락처 8자리) · jobInspect.ts(공개 판정 기본 날짜 = 베트남 — 검사기 독립성 시험(R2 #753) 때문에 공유 모듈을 import하지 않고 직접 계산, 필수 9개 목록은 jobCriteria.test.ts가 JSON과 일치를 고정) · 시험: 마감·연락처 경계, 정상 연락처 표기 회귀, 정책 판정기 Python·JS·SQL 일치 2,057건(job_posting_rules.pglite.test.mjs, 기존 CI 단계).
- 건드리지 않음: 화면 연락 버튼 표시(승인된 틀), 필수 여부·PostJob 12개, Facebook 지난 마감 새 제외, F4 khac·F5 review(기존 결정 미확정 → 코드 변경 없음), F6 원문 롤백·F8 위치 보호(1-C).
- 검증: 수정 전 새 시험 실패 재현(py 4·TS 1) → 수정 후 통과. npm test 125/125·tsc·py 시험·PGlite 일치 시험 통과(로컬). 변이 시험으로 일치 시험이 불일치를 잡는 것 확인. 운영 DB 조회 불가(프록시) → 운영 확인은 별도 보류.
- DB PR(별도 Draft): deactivate_expired_jobs 만료 기준 = 베트남 날짜(함수 한 개 교체, 되돌리기 = 이전 본문 복원 migration).
- 1-C(별도 Draft PR #972, Lee 승인): Facebook이 DB 규칙(job_rule_R*·정책 제외)으로 거부된 공고의 원문·출처·규칙 코드·사유를 기존 보류함에 rejected(종결, 자동 재시도 없음)로 보존 — crawler/ingest_gateway.py 포장(hold=True)만 변경. 보관 실패는 HoldStoreError → JOB_ERRORS → '본 글' 기록 안 됨. hold=False(TopCV·vieclam24h)·관리자·고용주 위치·DB ingest_job·공개 정책 변경 없음. 세 PR의 작업 기록은 이 PR에만 둠(병합 충돌 방지).
- 남은 결정·운영 확인 보류: 이슈 #973.

## 2026-11-22 — 크롤링 정상화 1번 그룹(Lee PR #958 최종 지시): 수집·인식·제외 규칙, 미리 보기 → 선택 저장 연결 (Draft, 2~4번 그룹은 별도 Draft로 분리)
- 실제 원인 [직접 확인]: ① 연락처 미기재가 FINAL(영구 제외, missing_required) ② not_job·office 사전 거름이 정상 구인 글을 영구 제외 — "Quán trả 8 triệu…"처럼 보수 문구가 든 구인 글(not_job), 본문에 kỹ sư·trưởng phòng을 언급한 공장 모집글(office) ③ 파서 예외가 `evaluate_post` 밖으로 나가 글 한 건에 가두지 못함 ④ 선택 저장(`save_selected_from_dryrun`)이 `is_ambiguous_job`만 직접 써서 일반 수집과 판정이 다르고, 미리 보기 아티팩트에는 review 후보가 없어 보류함에 보관 불가, 아티팩트 없음·고른 글 없음이 조용히 성공(종료 0)이었음.
- 변경: crawler/crawl_facebook.py(판정 네 갈래 정상/인식 실패 review/명백한 제외+근거 기록/파서·수집기 오류 parser_error→JOB_ERRORS · 연락처 없음 → review · not_job 약한 근거(보수 문구)는 직무 낱말 없을 때만·모집 인원 문구 구인 인정 · office는 모집 직무 줄(앞 두 줄)의 낱말+직무 낱말 없을 때만 · early_verdict·judge_read 공용(evaluate_post·judge_text) · evaluate_post_isolated · hold_review_posts(보관 성공 뒤에만 '본 글') · dry-run 아티팩트 review_jobs · 선택 저장: 정상=등록 / review=보류함 보관(성공 확인 뒤에만 완료) / 명백한 제외=종결 / 오류·만료·없는 키=미완료(종료 1), 본 글 기록 안 만듦) · crawler/ingest_gateway.py(REVIEW_STATUS 상태 값만) · 결정 문서(CLAUDE.md·RULES_CORE) 한 줄: 연락처 미기재=review 결정 기록(Lee 11-22, check-repository-policy가 정답 파일 변경 근거로 읽는 정식 기록).
- 검증 [직접 확인]: 수정 전(3742c14 기준) 새 시험 20건 실패·오류 → 수정 후 통과. 운영 DB·수집·병합 없음. 실제 GitHub dryrun→save는 아직 실행·검증하지 않음.
- 분리: 보류함 재판정·오류 줄 처리·`--retry-held`·workflow 변경·crawl-guard(2~4번 그룹)는 `claude/crawl-group2-4-preserved` Draft PR에 그대로 보존(유실 없음).

## 2026-11-21 — VietMap 지도 스타일 사본 먼저(메인·상세·관리자), 배포 빌드 때 사본 갱신 (#950, #946 MAP-1)
- 요청(Lee 11-21): style.json 멈춤은 실제 사용자 화면 문제 — 대기 시간을 더 늘리지 않고(같은 종류 두 번째), 약관 확인 뒤 사본을 우리 쪽에서 제공, 사본 없거나 실패할 때만 원본. 갱신은 기존 예약 작업에, 새 워크플로 없음. 검사 기준 그대로, deploy-verify 통과가 완료.
- 약관 [직접 확인]: VietMap 개발 문서 map-api overview "You may implement caching or response filtering as appropriate."(베트남어판 같은 뜻). 금지 조항 못 찾음(사이트 '약관' 링크는 개인정보 정책뿐).
- 변경: vietMapStyle.loadVietMapStyle(사본 4초 1번 → 실패·형식 오류면 원본, 기존 재시도 그대로)·stripStyleKey·withStyleKey 한 곳 — 메인·상세·관리자 처음 지도와 일반↔위성 교체 모두 사용. 사본 public/vietmap/styles/{tm,hm}.json(열쇠 값 비움 — 원본에서 열쇠는 타일 주소에만). scripts/ops/vietmap-style-copy.mjs를 vercel-deploy 빌드 직전에 실행(못 받으면 저장소 사본 그대로). map-summary-check는 사본 요청도 증거에 기록(판정 그대로).
- 검증 [직접 확인]: 운영 deploy-verify 44886908964 실패 2번(상세 sb-5876 지도 실패 / 재실행은 메인 핀 화면 밖 — 여기서 재현하니 메인 style 5·6초 두 번 멈춤 → 예비 지도). 같은 순서 20번: 운영(옛 코드) 실패 7·원본 요청 멈춤 17 → 새 코드(로컬 빌드) 실패 0·사본 20·원본 0. tsc·npm test 124/124·build 통과.
- 남은 것: PR 병합(Lee Approve) → 배포 → deploy-verify 통과로 #950 잠금 풀림 확인. 사본 갱신은 배포할 때만(배포가 없으면 갱신도 없음) — 타일 판 번호가 바뀌어도 옛 판이 계속 제공되는지는 미확인(hm은 2026-01 판 사용 중).

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
