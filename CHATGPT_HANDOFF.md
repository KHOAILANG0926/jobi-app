# HANDOFF — 지역 기준 통일·지역별 일자리 페이지·지도 고르기 데모 (2026-11-03 15:45, Claude)

## 1. 현재 상태
- master(운영) 566a4e6, 운영 배포 5cde3ff(이후는 문서·검사 커밋), deploy-verify 41554557710 통과. 공개 공고 9건(STATUS 11-03 11:04, 전부 Bắc Ninh).
- 데모 demo/region-unify(운영 미반영, Lee 확인 대기): 
  - 지역 판정 하나로: 공고 주소 글자 → 성·동(src/lib/jobArea.ts, jobAreaWards.ts). 메인·검색·추천·지역별 페이지 공통. DB 값(resolved_*) 안 씀 → 새 공고 자동 연결.
  - 행정구역 자료 9월판(vietnam-provinces 2026.9.0, 생성기 scripts/data/gen-vn-admin.py): Bắc Ninh·Quảng Ninh·Đồng Nai = Thành phố. 옛 동→새 동 공식 대응표(vnOldWards.ts, 지역별 페이지만 따로 불러옴). 대응표 전체 10,023개 시험: 정답 후보 포함 100%, 틀린 단일 확정 0.
  - 급구 페이지 → 지역별 일자리 /viec-lam/khu-vuc(옛 주소 넘김), 메인 공고 카드, 알바몬식 필터, 베트남 지도 고르기(섬·Hoàng Sa·Trường Sa 포함, 휠·두 손가락 확대, 확대 시 동 표시), PC 메인 왼쪽 칸 위치·급여만.
  - 수집기 판 2026.9.0 + 같은 시험(test-fixtures/vn-admin-cases.json, vn-admin-sync workflow).
  - 알림 34개 migration 20261103120000_job_alert_regions_34.sql: **미적용(STRICT)**. 로컬 폐기 DB dry-run 통과. master 병합 = 운영 자동 적용.
- 데모 demo/home-photo-cards(모바일 메인·업종 사진·배너 210px): 운영 미반영, 결정 대기.

## 2. 다음 할 일
1. Lee: Bắc Ninh 공고 100개 올린 뒤 다른 지역으로(1,000개 계획 변경, Lee 11-03). 공고 올린 뒤 지역 판정·알림 migration 확인하고 운영 반영 결정.
2. 휴대폰 화면은 나중에 한 번에(Lee 11-03): 배너 210px, 모바일 메인, 지도 터치 확인.
3. 직종 필터 통일(앱 category vs 공식 occupation_code) 결정 대기. 저녁 보고는 GitHub 이슈 #266 댓글뿐(알림 없음, 정시 아님) — 받는 방법 결정 대기.

## 3. 필수 규칙 (이번 지적)
- 시킨 것만, 시키면 묻지 말고 진행. 진행 중이면 먼저 알릴 것("머해?" 나오기 전에).
- 데모 링크 줄 때 운영과 다른 점(다른 데모에만 있는 수정 등)을 먼저 말할 것. 브라우저 확인은 허용 창이 뜨므로 꼭 필요할 때만.
- 검증은 한 지역(Bắc Ninh)만으로 하지 말 것 — 전국 표본·공식 대응표 전체로.
- 확인 안 한 말 금지. [직접 확인]/[기존 기록]/[추정]. 보고는 짧게, 한국어로.
