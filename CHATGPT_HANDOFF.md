# CHATGPT_HANDOFF — 수집 입구 설계·지도 순서표·Android 준비 (2026-10-28 저녁)

## 1. 현재 상태 (코드·배포·DB)
- master: #282~#301 병합. 운영 배포 caa5acd 이후 최신(아이콘 ✦ 제거 #297, 승인 장치 #298, 위치 판정 공고 삭제 호출 제거 #300 f6af4d9 — 다른 세션, deploy-verify 통과). 위치 판정 삭제 기록 0건(run 40719658451, 복구 대상 없음).
- 지도: 순서표 = 번지 → 회사+공단 → 공단 입구 → 거리 가운데 → 동 → 시 (결정 0006, #295). 거리 가운데는 같은 이름 거리 1곳 또는 이어진 구간일 때만. 핀 변경은 지도 재개 지시 전까지 하지 않음. #288(회사명+원문 지역)은 Goong 비교까지 보류(Goong 키 Vercel 미등록).
- 결정 문서·CODEOWNERS 변경 PR은 현재 커밋에 Lee 승인이 있어야 봇 병합(#298, 시험 PR #299로 확인).
- Android TWA: 아이콘·manifest·업로드 키 생성·.aab 빌드 워크플로 준비(#296·#297). 업로드 키는 GH_SECRETS_TOKEN 등록 후 생성. Play 계정·테스터 12명·14일은 Lee 몫. docs/plans/2026-10-28-android-twa.md.
- 수집 입구: 설계 docs/plans/2026-10-28-ingest-gateway.md, dry-run SQL supabase/pending/ingest-gateway-20261028/(로컬 PASS, 운영 미적용).

## 2. 다음 할 일 3개
1. Lee "적용" 후 입구 표 3개·ingest_job·위치가 공개를 안 바꾸는 규칙을 migration+production_check로 반영.
2. 관리자·SQL 등록 → AI·OCR·위치 작업 → 크롤러 순서로 입구 전환. 크롤링은 크롤러 전환 뒤에만 재개.
3. Android: GH_SECRETS_TOKEN 등록 → 업로드 키 생성 → .aab 빌드 → Play 비공개 테스트 업로드 → assetlinks.json.

## 3. 필수 규칙
- 운영 DB는 migration+production_check 정상 경로만. 직접 SQL 금지. 위치 결과는 공개 여부를 바꾸지 않음(Lee 10-28 ①). AI는 제안만.
- 같은 원인 2회 실패 시 멈춤. 직접 확인/기존 기록/추정 구분. 상세: WORK_LOG.md.
