# HANDOFF — 2026-11-09 아침 (Claude) · 공고 작성 화면 알바몬 맞춤 반영, 다음 = 상세 AI 배경

## 1. 현재 상태
- master 1d6fd88(#566) — deploy-verify 42514737829 성공 [직접 확인]. 11-08 PR #542~#554, 밤 근무 #565·#568·#573·#570·#575·#566 운영 반영.
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
- 그 외 이전 상태(회사 이름 읽기·카드 상호·급여 읽기·소개소 표시 등)는 WORK_LOG.md.

## 2. 다음 할 일 3개
1. 공고 상세 AI 배경(Lee 지시: 알바몬 공고 페이지 AI 배경을 우리 상세에 넣기). 순서: 브라우저로 알바몬 공고 페이지 AI 배경 실측 → 상세 맨 위(확정 틀)라 글 모형 먼저 Lee 확정 → 그림 방식 결정(미리 만든 AI 배경에서 고르기 vs AI 서비스 연결·키) → 데모 → 적용.
2. 알바몬 템플릿 원본 사진: Lee가 "알바몬 사진 쓰지 않는다" 방침 철회(11-08). 사진별 원출처·사용 조건 확인 → 재사용 허용/권한 있는 것만 받아 적용, 불명확한 것만 목록 보고, 공개 적용 전 권한·대상 보여 주기(브라우저 필요). 에디터 탭은 패키지 설치 허용 필요.
3. AI 팀: 봇 병합은 Codex 리뷰·요약·Claude 답 도착 때 다시 보고(11-09: 예전 지적 답 없으면 30분 통과 안 함, Codex 없는 운영·보안·DB 파일 PR은 needs-lee — #587; 운영 SQL은 입구 고치기+조회만·읽기 전용), Codex 30분 대기는 codex-wait-timer.yml이 다시 부름(#575, 예약 실행은 예비). 남은 ai-team #560(Google 월 사용량 보는 길 — Lee 결정), #571(운영 템플릿 그림 눈 확인). 원래 하던 Muaban·Chợ Tốt 수집·Facebook 1건씩 등록은 Lee 지시 시.

## 3. 필수 규칙
- 확인하고 말한다(추측·과장 금지), 기존 프로세스 먼저 확인. 보고는 한국어·최종 보고만·짧게. 시키지 않은 것 하지 않기(오늘 카드 임의 변경으로 지적받음).
- 화면 모양 변경은 글 모형 → Lee 확정 → 데모 → 적용. 알바몬을 따라 하되 기본 구성 유지.
- 운영 DB 직접 SQL 금지, DB는 migration+production_check PR. 새 칸을 화면이 읽기 전에 DB PR 먼저 적용(같은 PR에 넣으면 목록이 깨질 수 있음). migrations-apply 실패 시 원문 오류 보고 후 멈춤.
- 비밀값 출력 금지. 완료 = PR → 검사 → 병합 → 배포 → deploy-verify → 화면 확인 → HANDOFF·WORK_LOG.
