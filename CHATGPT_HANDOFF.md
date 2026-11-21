# HANDOFF — 2026-11-21 (Claude) · VietMap 스타일 사본(#950)

## 1. 현재 상태
- 코드: master `7b37362`(#949 ai-review 검사 삭제 — 병합 조건 검사는 approval-gate 하나). 브랜치 `claude/map-style-copy` PR: 지도(메인·상세·관리자)가 우리 쪽 VietMap style 사본(public/vietmap/styles, 열쇠 값 비움)을 먼저 쓰고 실패할 때만 원본, 사본은 vercel-deploy 빌드 직전 갱신(scripts/ops/vietmap-style-copy.mjs). 검사·보호 장치(workflow) 변경이라 Lee 공식 Approve 뒤 봇 병합.
- 배포: 운영 잠금 #950(7b37362) 열림 — deploy-verify 44886908964 두 번 실패(지도 style.json 멈춤: 상세 sb-5876 실패 / 메인 예비 지도 전환으로 핀 화면 밖). 일반 PR 자동 병합은 멈춤(Lee 승인 PR만 통과). #943·#945는 풀림 조건 충족(이슈만 열림).
- Facebook: 수집 계정 잠금 파일(VPS)이 남아 있음 → 해제 옵션 Draft #941(Lee 계정 작성 — Lee가 스스로 승인 못 함, 봇 PR로 다시 올릴지 Lee 결정 대기). 쿠키(FB_C_USER·FB_XS)는 Lee가 GitHub Secrets에서 교체.
- 운영 위험(#946): 봇 병합 뒤 pr-checks·occupation-publication-check 안 돎, STATUS 하루 1회, master 기본 보호 '관리자 제외'(PROT-1), B3 응답 정지 시 PR당 923초. DB: 이번 작업 변경 없음.

## 2. 다음 할 일 3개
1. 사본 PR: 필수 검사 → Lee Approve(최신 커밋) → 봇 병합 → vercel-deploy 사본 갱신 줄 확인 → deploy-verify 통과로 #950 잠금 풀림 확인.
2. #941: Lee 결정대로(봇 PR로 다시 올림 또는 그대로) → Lee 승인 → 쿠키 교체 → Facebook 시험 수집 1건.
3. vieclam24h publish_one: 본문에 전화번호 있는 공고 1건 원본→검증→DB→PC·모바일 확인(공개 기준 완화 금지).

## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정]으로 보고, 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve.
- 운영 DB·보안·공고 공개·배포 잠금 같은 필수 보호는 실패해도 경고로 낮추지 않는다. 새 검사·규칙·워크플로를 덧붙이지 않는다(기존 기능의 오류만 최소 수정). 지도 style 대기 시간은 더 늘리지 않는다(같은 종류 두 번째).
