# 3순위 — 격리 Preview 데이터·화면 차등 검증 (Lee 2026-11-24)

기준: 기존 검사를 최대한 재사용, 중복은 통합, 변경 영향 범위에 필요한 검사만. 새 검사 체계·유료 Preview(Vercel PR 미리보기 — 하루 배포 한도 때문에 만들지 않음, vercel-deploy.yml) 추가 없음.

## 1. 지금 있는 검사(직접 확인 — 워크플로 파일)
| 단계 | 검사 | 대상 |
|---|---|---|
| PR | app-screen-check(필수) — PR 코드를 Actions 안에서 빌드·실행 + 운영 공개 데이터 읽기 전용: 화면 smoke·도면·카드 틀·위치 상세·관리자 이동·격리 응답 검사 등 약 25단계 | 모든 PR(문서만 바꿔도 전부) |
| PR | 지도 요약(map-summary-check)·메뉴 검색(menu-search-check) | **브랜치 이름**(demo/map-summary…, fix/menu-full-search…)일 때만 |
| PR | migration-postgres(필수) — 폐기용 PostgreSQL에 fixture→setup→migration→local→production_check | migration PR |
| 병합 뒤 | deploy-verify — 운영 배포 READY + app-smoke·직업 메뉴·지도 요약·메뉴 검색 | master 커밋마다 |
| 병합 뒤 | administrative-pin-check — 공개 원본 점의 원래 성 안 | deploy-verify 성공 뒤 |

빈틈: ① 문서·CI만 바뀐 PR도 화면 검사 전부(시간 낭비) ② 위치·핀·캐시 영향 PR의 지도 요약 대조가 브랜치 이름에 달려 있어 대부분 병합 뒤에야 돎 ③ DB 변경이 공개 응답·화면에 주는 영향은 병합·운영 적용 뒤에야 확인.

## 2. 1차(이 PR) — 영향 범위로 기존 검사 고르기
- `scripts/ci/change-impact.mjs` 한 곳: 바뀐 파일 → screen / map / menu. 모르는 파일은 화면 검사(닫힌 방향), 목록을 못 받으면 전부.
- app-screen-check가 이 판정기를 **BASE(master) 사본**으로 돌린다 — PR이 판정기를 고쳐 자기 검사를 끄지 못하게. 판정기가 BASE에 없으면(첫 도입) 전부 실행.
- screen=false(문서·크롤러·시험 DB·CI 스크립트·다른 워크플로만) → 화면 검사 단계 생략(필수 검사 app-screen은 통과로 끝남). 병합 뒤 deploy-verify 운영 검사는 그대로.
- map=true → 지도 요약 대조를 PR 단계에서(병합 뒤와 같은 검사, HEAD 화면 + 운영 공개 원본. vite preview에는 /api가 없어 공개 위치 응답은 운영 주소(MAP_API_BASE)로 대조 — PR의 api 코드 자체는 api 단위 시험과 병합 뒤 deploy-verify가 봄). menu=true → 메뉴 검색 검사. 브랜치 이름 조건은 지움(같은 일을 한 곳으로).
- 최근 병합 PR로 본 효과: #995(병합 봇·CI·규칙 문서) 화면 검사 생략 / #999(migration) 화면+지도 요약 / #991(api/map-locations) 화면+지도 요약.

## 3. 다음 단계(설계만, 구현 전 확인 필요)
- DB 변경 PR의 격리 대조: migration-postgres의 폐기용 DB에 migration을 적용한 뒤, 그 결과를 기존 격리 응답 방식(location-canonical-browser-fixtures.mjs·real-jobs-area-check.mjs의 응답 가로채기)으로 HEAD 화면에 넣어 원본(DB 줄) → 공개 응답 → 지도 핀 → 화면을 대조. 새 서버·새 DB 없음.
- Lee 확인 필요: "기존 1~11단계 검증 기준"의 원래 목록(저장소·지난 대화에서 못 찾음). 받으면 각 단계를 위 영향 범위(screen·map·menu·db)에 짝지어 적용한다.
