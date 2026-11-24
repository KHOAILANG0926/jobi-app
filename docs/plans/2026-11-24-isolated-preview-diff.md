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
- map=true → 기존 HEAD 격리 핀 검사(location-canonical-browser-fixtures: 지도 열쇠 가짜·DB 응답 가짜 0·1·여러 곳, PC·모바일)를 PR 단계에서. 실제 공고 지도 요약(map-summary-check)은 PR 빌드에 지도 열쇠가 없어 지도가 안 그려지므로(#1000 첫 실행에서 확인) 병합 뒤 deploy-verify 그대로. menu=true → 메뉴 검색 검사. 브랜치 이름 조건은 지움(같은 일을 한 곳으로).
- 최근 병합 PR로 본 효과: #995(병합 봇·CI·규칙 문서) 화면 검사 생략 / #999(migration) 화면+지도 요약 / #991(api/map-locations) 화면+지도 요약.

## 3. 2차: DB 변경 PR의 격리 DB 전후 대조 (구현)
- 어디서: 기존 migration-postgres(폐기용 PostgreSQL, 바뀐 migration마다 setup → 적용 → local → production_check). 새 서버·새 DB 없음.
- 무엇을: 적용 바로 전·후에 `scripts/ci/public-location-snapshot.sql`(읽기만)로 공고 공개 상태·위치 원본 줄(핀 되는 확정 좌표 exact·gate+좌표 / 안 되는 줄 — api/map-locations와 같은 기준)·위치 보류함을 찍고, `public-location-diff.sh`가 차이를 실행 요약에 남긴다.
- 실패 조건 하나: 적용 전 핀이 있던 공고가 적용 뒤에도 공개인데 핀 0개이고 보류함에도 없음(지도 위치 절대 원칙·지점별 독립 공고 전환에서 위치를 조용히 잃음). 나머지 차이는 기록만.
- 실측: #999 전환 migration을 다시 적용하면 운영 결과와 같은 차이(#5992 위치 글자, 1776·1800 줄 → 보류함)가 나옴(로컬 PostgreSQL 16).
- 화면 연결: 같은 잡이 적용 뒤 공개 공고·위치 원본 줄을 JSON으로 내고(`scripts/ci/isolated-db-fixture.sql`), 기존 격리 핀 검사(`location-canonical-browser-fixtures.mjs`, LOCATION_FIXTURE_DIR)를 그 자료로 돌린다: ① 공개 위치 응답 = HEAD `api/map-locations.js` 처리 코드에 원본 줄을 넣은 결과가 원본 확정 좌표와 같음 ② 메인 지도: 점마다 그 자리로 지도를 옮겨 그 공고·근무지 줄의 핀이 나옴(map-summary-check와 같은 방식), 확정 아닌 줄은 핀으로 안 나옴 ③ 상세: 공고마다 원본 확정 좌표 전체 ④ PC 1440·모바일 390. 근거(자료·화면)는 실행 기록에 보관.
- '적용 뒤'는 migration과 그 시험 파일(local·production_check)까지 끝난 상태 — 함수 본문만 바꾸는 migration은 시험 파일이 실제로 쓰기를 해야 차이가 보인다.
- 실측(로컬): #999 → 공개 3건·핀 3개 PC·모바일 통과(상세 위치 글자 '148 Trần Phú, Từ Sơn' = 전환 결과). #1002(같은 매장 확정 위치 유지) → 차이 6줄(시험 공고들의 새 줄, 공고가 비공개라 화면 대상 0건).
- 한계: 시험 DB에는 그 migration의 setup·시험 파일이 만든 자료만 있다. 시험 DB에 없는 화면용 칸(제목·연락처 등)과 0/빈 정확도·revision은 합성 기본값으로 채운다. 운영 DB 함수(expected_points) 대신 원본 줄을 HEAD 처리 코드에 넣는다. 실제 운영 공고 화면은 병합 뒤 deploy-verify.

## 4. 확인하지 못한 기준
- "기존 1~11단계 검증 기준"의 원래 목록은 저장소·기록에서 찾지 못함 → CLAUDE.md 확정 기준(필수 기계 검사·DR3 화면 검사·지도 위치 원칙·지점별 독립 공고)만 근거로 함.
