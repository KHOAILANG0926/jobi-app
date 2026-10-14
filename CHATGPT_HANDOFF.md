# CHATGPT_HANDOFF — 메인 공고 카드
갱신: 2026-10-14

## 1. 현재 상태
- [직접 확인] PR #70 병합, 코드 master ecd7b38. Production dpl_8HhvvvseHveftSXM9EvSWqdadYmd READY, viecganban.vn alias 확인.
- 메인 추천/전체 카드는 ID별 한 번 표시. 급여 미확인 카드는 메인 제외. 실제 이미지·회사명·지역·제목·원문 급여, 시급→일급→월급 우선(환산 없음). 업종 이미지·카드 Zalo 제거, PC hover·모바일 펼치기. 공유 검색·지도·상세 데이터 유지.
- [직접 확인] tsc/build 성공, npm test 54/54 및 PR CI checks/guard 성공. 로컬 Chromium + 운영 읽기 DB에서 KDA 카드1개·실제 이미지 로드·hover·모바일 펼치기/접기·상세 Zalo 확인.
- [직접 확인] 운영 홈/상세 HTTP200, 홈 새 JS 번들, 상세 KDA 제목·이미지·Zalo 확인. 운영 홈 직접 브라우저의 카드 개수·상호작용은 도메인 프록시403 때문에 미검증.
- [직접 확인] #4824 active=true/admin_hidden=false. 모든 공고 DB 쓰기·삭제 없음. CA 영구 신뢰 등록은 자동 승인 검토 거절로 미적용; TLS 검증 유지.

## 2. 다음 할 일 3개
1. 환경 네트워크에 viecganban.vn/www.viecganban.vn 허용 후 운영 브라우저 검증 재개.
2. 운영 홈 #4824 한 번 표시·실제 이미지·급여·PC hover·모바일 펼치기 확인.
3. 운영 검색·지도·상세 회귀 검증 결과만 추가 기록. 같은 기능 재구현 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분, STATUS 검증 장치 수정 금지.
- #4824 포함 공고 데이터 변경·삭제 금지. 표시만 변경.
- 테스트·GitHub 보존·배포·운영 브라우저 검증 구분. Secret 출력 금지.
