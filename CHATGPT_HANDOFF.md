# CHATGPT_HANDOFF — 대략 핀 보류 해제·복수직무 식사 자동 금지 (2026-10-28)

## 1. 현재 상태 (코드·배포·DB)
- master 25d8ff7(#282 복수직무·대략 핀, #283 점검 칸별 오류 표시). Vercel Production 25d8ff7 success(06:45Z). #282 migration 2개 적용 성공, 운영 점검은 bomunttl_production_check 실패(active 운영=false/기대=true, meal_provided 운영=true/기대=null).
- 원인(코드 근거): active=false는 옛 위치 판정(area 대체 전 코드)이 sb-4982를 our_miss → map_r1_mark_unlocated. meal_provided=true는 scripts/ocr/ai-classify.mjs 복리후생 AI가 "Bao ăn 2 bữa"를 공고 전체 칸으로 켬. OCR 보류 경로는 images가 비어 대상 아님.
- 이번 브랜치 fix/area-pin-hold-meal-rule-20261028: migration 20261028080000(canonical 핀 area 이상이면 위치 보류 금지·기존 보류 해제, admin_hidden 등 유지), ai-classify 복수직무 전체 식사 칸 자동 켜기 금지, 규칙 점검 area_pin_hold_meal_production_check.sql(공고 번호 고정 없음, 위반 공고 번호·값 표시).
- 이미 켜진 식사 칸 되돌리기는 데이터 수정이라 Lee 예/아니오 전 미실행 → 그때까지 새 점검·bomunttl 점검은 실패가 예상됨(대상 목록이 오류 문구로 나옴).

## 2. 다음 할 일 3개
1. PR 필수 검사 → 봇 병합 → migrations-apply. 실패 문구의 식사 칸 대상 공고 목록·건수를 Lee에게 보고하고 예/아니오.
2. 예면 해당 공고 meal_provided를 null로 되돌리는 migration(규칙 대상 전체, 번호 고정 금지) → 점검 통과 확인.
3. 점검 통과 후 운영 deploy-verify·administrative-pin-check·sb-4982 박닌 핀·메인 노출 확인. 4878 도시 경계 증빙 부족은 후속 과제.

## 3. 필수 규칙
- 운영 DB는 migration+production_check 정상 경로만. 직접 SQL·재시도·데이터 덮어쓰기 금지. 같은 원인 2회 실패 시 멈춤.
- KDA 틀/CSS 보존, 직무별 식사 표시는 유지(전체 칸만 금지). 직접 확인/기존 기록/추정 구분. 상세: WORK_LOG.md.
