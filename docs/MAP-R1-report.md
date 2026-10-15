# MAP-R1 검증 기록 — 2026-10-15

## 변경 파일·동작 [직접 확인]

- `src/lib/mapR1.ts`, `HomeMapExplorer`, `HomeMapCanvas`, `map/*Canvas`, `HomeMapTypes`, `PlaceDetailPanel`: 하노이 중심 z8(박닌 포함), 브라우저 카메라 복원/유효성, 기본 무제한, 버튼 GPS/한 번 탭 출발점, 직선거리 반경 해제, 대표 위치 라벨·정확 결과 제외, viewport 내 공고 ID 수, 중첩 ID 집계. 공식 직업 필터 유지.
- `JobVietMap.tsx`: 상세 지도 휠·터치 확대를 기존 메인 제스처에 맞춤. 다중 근무지 핀의 선택 좌표를 거리·생활시설 패널에 전달.
- `autoLocationResolver.ts`, `api/_lib/auto-location-runtime.mjs`, `api/admin-auto-location.js`, `Admin*Locate`, `scripts/auto-location/run.mjs`, `.github/workflows/auto-location.yml`: 기존 주소/회사/동 판정 재사용, 예약 후 검색, 공고별 영속 최대 2회, 검색 캐시, 기존 공유 일일 250회 한도, 10건 배치(관리자 5건), 실행 임대, 실패 후 제한 재시도, 캐시/예산 장애 시 호출 중단. 기존 정확 위치·공개 상태 보존.
- `api/map-locations.js`: 공개 공고의 대표 좌표·출처·확인일만 반환. 원문 증거/내부 상태 제외.
- `supabase/pending/20261015_map_r1_auto_location.sql`: service-role 전용 RLS 처리 테이블/RPC. 기존 테이블 삭제·공개 상태 변경 없음.

## 실행 결과 [직접 확인]

| 검사 | 명령·결과 |
|---|---|
| 전체 npm 테스트 | `npm test`: 60/60 test files passed |
| 타입 | `npx tsc --noEmit`: 종료 0 |
| SPA/SSR 빌드 | `npm run build`: 종료 0 |
| 상세 휠 회귀 | `node scripts/auto-location/verify-browser.mjs scripts/auto-location/detail-wheel-browser.mjs`: 변경 전 page scroll 783→433 실패, 수정 후 page 위치 유지·핀 위치 이동 통과 |
| PC·모바일 | 같은 wrapper에 `scripts/auto-location/map-r1-browser.mjs`: 두 화면 모두 초기/복원/잘못된 저장/GPS 승인·거부/한 번 탭/반경/대표·정확 중첩/화면 수/위성/건물 클릭 통과 |
| SQL | PostgreSQL 17 격리 Docker에서 fixture → pending SQL → assertions 적용. 임대, 2회 상한/3번째 거절, 재실행 중복 없음, 정확/대표, 공개 상태 보존, RLS, 주소 변경 후 대표 숨김 통과 |
| 검토 | 독립 읽기 검토: 다중 근무지 핀 선택 문제 발견·수정, pure 회귀 테스트 통과. 차단 수준 보안 결함 보고 없음 |
| 최신 master | `git fetch origin master`: 1abb6a4, 새 커밋 없음. 기반에 Claude CI 변경 포함 |

브라우저는 실제 VietMap SDK와 가상 공고/스타일 응답으로 실행했다. 유료 타일·운영 DB·실제 사용자 위치를 사용하지 않았다. 실제 공급자 타일/POI 데이터·운영 자격증명 연결 검사는 수행하지 않았다. 기존 스타일·위성·건물 클릭 경로 검증은 가상 렌더링 데이터 기준이다. 직업/상세의 기존 단위 검사는 전체 npm suite에 포함된다.

GPS 오류는 기존 오류 표시로 처리한다. 거부 경로는 브라우저에서 확인했고, 실제 기기 GPS 시간 초과는 별도로 발생시키지 않았다. 모바일 자동 검사는 버튼/탭 및 반응형 패널 기준이며 실물 기기 핀치 동작은 검사하지 않았다.

## 자동 위치·API 호출량 [직접 확인]

운영 배치 실행 0건, 운영 VietMap 검색 0회. 따라서 실제 정확/대표/미확인 공고 수는 조회·보고하지 않았다. 자동화 활성화 후 aggregate 로그(processed/exact/representative/unresolved/apiCalls/failed/deferred)로 확인한다. 가상 테스트에서 공고 2회 예약 후 3회째 거절, API 실패 시 공개 상태 유지, 기존 정확 좌표 우선, 애매한 응답 거절을 검증했다. API 호출 상한은 주소 검색이며 브라우저 지도 타일 과금의 절대 상한을 보장하지 않는다.

## KCN Yên Phong [직접 확인]

`industrialParks.ts`에는 확장 단지만 있고 원래 1단지 입구 없음. Overpass endpoint 접근은 CONNECT 403으로 실패. OSM 객체 ID·1단지 윤곽·검증된 입구 좌표를 확보하지 못했다. 추정 좌표·공단 중심을 입구로 추가하지 않았다. #4824의 핀이 확보됐다고 주장하지 않는다.

## DB·활성화·운영 [직접 확인]

마이그레이션 필요. pending SQL은 운영에 적용하지 않았고 자동 적용 workflow도 없다. 승인 후 기존 스키마/승인 트리거와 함께 검토·적용해야 한다. 그 전 새 관리자 작업은 비활성 안내, 대표 API는 503(기존 정확 핀 사용 가능).

승인 후 필요한 설정: GitHub Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VIETMAP_SERVICE_KEY`; GitHub variable `MAP_R1_ENABLED=true`; 관리자 서버도 동일 비밀 환경 변수와 `MAP_R1_ENABLED=true`. master에서 정기·수동 실행한다. 활성화/Secret 쓰기는 수행하지 않았다.

운영 반영 여부: **미반영**. PR 생성 후에도 병합·운영 배포는 사용자 승인 대상이다.
