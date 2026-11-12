# HANDOFF — 2026-11-11 새벽 (Claude) · 화면 대조 비공개 공고 열기·확인한 기록 검사

## 1. 현재 상태
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

## 2. 다음 할 일 3개
1. 크롤링 1건씩: 위치 못 정함(approximate_only)이 많음(11-11 새벽 9건 중 5건 — KRIK·CON CƯNG·SPX·VINAMILK·WINMART+·TÂN THÀNH, #633 기록). 원인은 11-11 15:20 Google 비교 시험 40건(#560) 결과로 먼저 본다. sb-5931 공개 확인.
2. 이슈 제안에도 「확인한 기록」 검사(#666 남은 것 — Lee 결정 전 구현 안 함). 수집기 '기존 facebook 공고 0개'인데 입구가 기존 sb-5876을 돌려준 것(ZHAN AN) 원인 확인(#633).
3. 한국 일자리: Lee 별도 방. 남은 ai-team: VPS 시스템 파일(#636), Codex 이슈 대화 연결(#638), 봇 커밋에 PR 검사가 안 도는 것(#662 — 지금은 작업자가 빈 커밋으로 다시 돌림).

## 3. 필수 규칙
- 확인하고 말한다(추측·과장 금지), 기존 프로세스 먼저 확인. 보고는 한국어·최종 보고만·짧게. 시키지 않은 것 하지 않기(오늘 카드 임의 변경으로 지적받음).
- 화면 모양 변경은 글 모형 → Lee 확정 → 데모 → 적용. 알바몬을 따라 하되 기본 구성 유지.
- 운영 DB 직접 SQL 금지, DB는 migration+production_check PR. 새 칸을 화면이 읽기 전에 DB PR 먼저 적용(같은 PR에 넣으면 목록이 깨질 수 있음). migrations-apply 실패 시 원문 오류 보고 후 멈춤.
- 비밀값 출력 금지. 완료 = PR → 검사 → 병합 → 배포 → deploy-verify → 화면 확인 → HANDOFF·WORK_LOG.
