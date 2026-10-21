# CHATGPT_HANDOFF — 승인 데모 운영 반영 (2026-10-22)

## 1. 현재 상태
- 직접 조회: 지도 #190·#191 이미 병합. 운영 www.viecganban.vn은 Vercel READY 02b1baa(dpl_DUKMyYDLrtSCPPzLnn73LR7L9fyH). 앞선 “데모만” 보고 정정.
- #191 현재 정책: 대략 위치 핀은 반경 밖에도 남기며 목록·건수는 화면 안+반경 안만. 이전 데모의 100m 핀0 정책으로 되돌리지 않음.
- fix/approved-to-production-20261022: Lee 채팅 승인 후 검사→병합→운영 일치→PC/모바일 확인까지 담당자가 이어서 수행하는 규칙 추가. 새 승인/라벨 불필요.
- deploy-verify가 운영 PC/모바일 스크린샷·JSON을 자동 보존하도록 보완. 지도 회귀 검사는 #191 정책과 일치, 실제 배포 타일 대기.
- node 문법·승인 범위·tsc/build 통과. 이 작업 PR/운영 검증 진행. DB·secret·UI 소스 변경 없음.

## 2. 다음 할 일 3개
1. 이 절차 보완 PR 필수 검사→병합→Production READY/실제 운영 화면 확인.
2. 이슈97의 오래된 데모는 승인 여부와 master 포함 여부를 대조해 남은 일만 구분. 오래된 브랜치를 일괄 배포하지 않음.
3. 원래6번 occupation_code→category 자동 연결 미구현. 운영 DDL 필요 시 구체 SQL 승인 전 적용 금지.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 승인된 데모는 운영까지, 재승인 요구 금지. 운영 링크와 실제 증거로만 완료 보고.
- 현재 PR/Vercel 도메인 상태를 조회. 낡은 HANDOFF를 운영 상태로 단정하지 않음. STATUS 직접 수정 금지.
- 기존 공고 틀·운영 DB/Auth/RLS/secret 보호. 키/데이터 PC 저장 안내 금지.
