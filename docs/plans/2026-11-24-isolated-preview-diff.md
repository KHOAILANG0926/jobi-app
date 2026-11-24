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
- 한계: 시험 DB에는 그 migration의 setup 파일이 만든 자료만 있다(setup 없는 migration은 찍을 것이 없음). 핀 → 화면은 1차의 격리 핀 검사, 실제 운영 공고 화면은 병합 뒤 deploy-verify.

## 4. 확인하지 못한 기준
- "기존 1~11단계 검증 기준"의 원래 목록은 저장소·기록에서 찾지 못함 → CLAUDE.md 확정 기준(필수 기계 검사·DR3 화면 검사·지도 위치 원칙·지점별 독립 공고)만 근거로 함.
