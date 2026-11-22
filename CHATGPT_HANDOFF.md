# HANDOFF — 2026-11-22 (Claude) · VietMap 스타일 사본 PR #952 + 크롤링 정상화 #958 병합 뒤

## 1. 현재 상태
- 코드: master `3a3d31d`(#958 크롤링 정상화 1번 그룹 — 판정 네 갈래·review 보존·선택 저장 연결, 운영 DB 변경 없음). 2~4번 그룹은 별도 Draft(`claude/crawl-group2-4-preserved`). #953(Facebook 잠금 파일 수동 해제 옵션) 병합 `f02306d`.
- PR #952(브랜치 `claude/map-style-copy`, master 합침): 지도(메인·상세·관리자)가 우리 쪽 VietMap style 사본(public/vietmap/styles, 열쇠 값 비움)을 먼저 쓰고 실패할 때만 원본, 사본은 vercel-deploy 빌드 직전 갱신(scripts/ops/vietmap-style-copy.mjs). 검사·보호 장치(workflow) 변경이라 Lee 공식 Approve(최신 커밋) 뒤 봇 병합.
- 배포: deploy-verify 44908805702(f02306d) 통과 → 잠금 #950·#951(7b37362) 풀림 조건 충족(이슈는 열림). 운영 지도는 아직 옛 코드 — VietMap style.json이 멈추면 같은 실패가 다시 날 수 있음.
- 수집: 정기 실행 꺼짐(Lee 11-17 #872), vieclam24h GitHub 서버 403·본문 전화번호 숨김, Facebook 계정 잠금(쿠키 만료) — Lee가 쿠키 교체 뒤 미리 보기(dryrun)를 reset_account_lock=true로 1번. 실제 dryrun→save는 아직 검증 안 함. DB: 변경 없음.

## 2. 다음 할 일 3개
1. PR #952: 필수 검사 → Lee Approve(최신 커밋) → 봇 병합 → vercel-deploy 사본 갱신 줄 확인 → deploy-verify 통과.
2. Facebook: Lee 쿠키(FB_C_USER·FB_XS) 교체 → dryrun(reset_account_lock=true) → 후보 1건 선택 저장(Lee 승인). 2~4번 그룹 Draft 진행 여부는 Lee 결정.
3. 정기 수집 재개는 별도 승인 PR. vieclam24h는 본문에 전화번호 있는 공고만(공개 기준 완화 금지).

## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve. 새 검사·규칙·워크플로·대기열을 덧붙이지 않는다(기존 오류만 최소 수정). 지도 style 대기 시간은 더 늘리지 않는다.
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 전체 수집은 승인 없이 켜지 않는다.
