# CHATGPT_HANDOFF — 업종 자동 분류 준비 (2026-10-22)

## 1. 현재 상태
- 기존 지도 #190·#191과 승인 후 운영까지 절차 #192·#193 반영. 재구현하지 않음.
- feat/occupation-category-20261022: 공식 occupation_code→앱13업종 연결표/SQL 생성기/실제 PostgreSQL 회귀 시험 준비. 자동 지정은 DB에서 관리자·수집·직접등록 공통 강제.
- 두 트리거: 정책 판단 전 업종 지정, R8의 코드 무효화 후 khac 재설정. 원문 근거·공개조건·공식 코드·RLS·secret 변경 없음.
- 공식1505코드·신규/수정/덮어쓰기방지/근거소실/공개차단/메뉴조회·기존 공개조건 회귀 통과. npm test69/69, tsc/build 통과.
- 운영 읽기 dry-run: 4824(82022),4828(8) 현재/예정 모두 san_xuat_xay_dung. 바꿀 기존 분류0건.
- 운영 DB 미적용. 구체 SQL supabase/pending/20261021224712_occupation_category_auto.sql, 생산 점검 SQL도 pending. migrations에 놓지 않아 승인 전 자동 적용되지 않음.

## 2. 다음 할 일 3개
1. PR 필수 검사 확인 후 Lee에게 구체 SQL·dry-run 결과 제시, DDL 적용 승인 받기.
2. 승인 시 pending SQL→migrations, 점검SQL→supabase/tests로 이동→필수검사→병합→기존 자동 DB 적용·생산 점검 확인.
3. 실제 저장 업종과 Việc làm theo ngành 메뉴 확인 후 운영 결과 보고. 승인된 일에 재승인·새 라벨 요구하지 않음.

## 3. 필수 규칙
- AGENTS/CLAUDE 준수. DDL은 dry-run으로 보여주고 승인 후 적용, 승인 전 pending.
- 실제 업무/공식 직업코드를 임의로 변경·세분화하지 않음. 연결표는 정부 업종표가 아닌 기존 앱 메뉴용 규칙.
- STATUS 직접 수정 금지. 기존 공고 틀·공개조건·RLS·secret 보호, PC 저장 안내 금지.
