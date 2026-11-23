# HANDOFF — 2026-11-22 (Claude) · JOBI 4단계 — 1-B·1-C Draft PR 3개
## 1. 현재 상태
- 코드: master 최신(#959 병합 포함). PR 3개 — #970(1-B 코드·시험: 마감 당일 열림·베트남 날짜, 연락처 8자리, 필수 9개 일치 시험, 정책 판정기 Python·JS·SQL 일치 시험) · #971(1-B DB: 만료 cron 기준 날짜 = 베트남 날짜, migration이라 Lee 공식 Approve) · #972(1-C: Facebook이 DB 규칙 거부 공고의 원문·출처·규칙 코드·사유를 보류함에 rejected로 보존). 세 PR 모두 병합·배포·운영 DB 변경 없음, 작업 기록(WORK_LOG·HANDOFF)은 #970에만 있음.
- 1-A 측정 [직접 확인]: 정책 평가기 3벌은 4,057건 불일치 0. 실제 불일치는 마감·연락처·직업분류/점검기(khac)·review 처리·필수 항목. 이번에 고친 것은 마감·연락처·필수 9개 일치 시험·DB 규칙 거부 보존.
- PR #952(지도 style 사본, 브랜치 `claude/map-style-copy`): 메인·상세·관리자 지도가 우리 쪽 VietMap style 사본(public/vietmap/styles, 열쇠 값 비움)을 먼저 쓰고 실패할 때만 원본, 사본은 vercel-deploy 빌드 직전 갱신. 필수 검사 통과, Lee 공식 Approve(최신 커밋) 대기. 운영 지도는 아직 옛 코드 — VietMap style.json이 멈추면 deploy-verify 지도 실패·배포 잠금이 다시 날 수 있음(#950·#951 잠금은 f02306d deploy-verify 통과로 풀림 조건 충족).
- 남은 결정·운영 확인 보류: 이슈 #973(F4 khac, F5 관리자 review, 작성 화면 12 vs 9, 화면 연락 버튼, Facebook 지난 마감일, rejected vs review). 운영 DB 조회 불가(프록시)라 공개 24건별 판정 분포·운영 확인은 미검증.
- 지도 정상화 2번(2026-11-23, Draft): 자체 위치 기억 검증 — DB 정상, 매장별 확정(대기열·confirm) 결함 수정. 상세 WORK_LOG 맨 위.
## 2. 다음 할 일 3개
1. Lee: #970·#971·#972 검토(#970·#971은 GitHub에서 공식 Approve, #972는 needs-lee). 병합은 승인 뒤 봇이 한다.
2. #973의 결정 6건 확인 후 필요한 것만 별도 PR(1-C 남은 범위: 관리자·고용주 위치 공개 정책 등).
3. Facebook 쿠키 갱신(계정 잠금 해제) 뒤 실제 dryrun→보류함·거부 보존 확인(#940), #971 적용 뒤 production_check 결과 확인.
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 새 검사·규칙·승인 절차·대기열을 덧붙이지 않는다. 필수 9개 목록·상세 구성은 Lee 지시 없이 바꾸지 않는다. 점검기 독립성 시험(R2 #753)을 약화하지 않는다.
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 수집은 승인 없이 켜지 않는다.
