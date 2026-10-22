# CHATGPT_HANDOFF — 메인 공고 상단 조건 구성 (2026-10-22)

## 1. 현재 상태
- 기준 master b720bccefeeefee95d1409bd5ea0e3fffcf8c0b9. #198 기간·계약 전체 검색, #200 운영 0건 조건 전환 검사 대기 반영. 운영 검사39721208749 성공(이전 턴 직접 확인).
- Lee 수정 지시: 기간·계약 조건을 별도 페이지가 아닌 메인 공고 나열 상단에 표시. 실제 공고 축적 후 데이터 검증, 지금은 구성만.
- demo/home-job-filters: PC 메인 기존 카드 위·모바일 실제 HomeDiscovery 캐러셀 위 HomeJobFilters(기간7종·계약/보험·조건 요약·해제), 메뉴 /?duration=…#home-job-filters /?pledge=1#home-job-filters. 명시된 데이터만 기존 filterAndSortJobs로 메인 카드에 적용. 모바일 실제 캐러셀/하단 목록에도 같은 조건 적용(지도 원본 jobs는 유지). 지도·카드 틀·DB 변경 없음. 급구 메뉴는 기존 전용 경로 유지.
- tsc/build·npm test71/71·desktop baseline8/8 통과. HomeDesktop/LayoutDesktop 해시·날짜/이유 갱신. CI는 메뉴 경로/배치/선택·해제 구성만 검사; 실제 공고 검색 검증 완료라고 보고 금지.
- 데모 검토 대상, 운영 미반영. 최신 Preview/검사 결과는 이 가지 PR/Actions 조회. #197 지도 완료 재구현 금지.

## 2. 다음 할 일 3개
1. 데모 Preview와 PC·모바일 구성 검사 결과 확인, 실제 데모 링크 전달.
2. Lee가 화면 확인 후 적용하면 동일 소스를 필수검사→병합→Production READY/SHA→운영 화면 확인까지 진행. 재승인 요구 금지.
3. 실제 기간/계약/보험 공고가 쌓이면 조건별 결과 검증. 한국 취업검사·한국 커뮤니티·SNS 미연결은 Lee 유지 결정.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. 구성 확인과 실제 데이터 검증을 구분. 화면 승인 전 데모를 운영에 임의 반영하지 않음.
- 공고 원문·직업코드·공개조건·위치·카드 틀·운영 DB/Auth/RLS/secret 보호. STATUS 직접 수정 금지.
- 실제 운영 DB에 테스트 공고 등록 금지. 회사 PC 저장 안내·현장 방문 제안 금지.
