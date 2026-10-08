# chotot 100건 공개 전환 — dry-run·공개 SQL·확인 URL (2026-10-08)

사용자 결정: 핀 없이도 공개(위치 3단계: 승인 좌표 Chỉ đường / KCN 영역 지도 / Gọi hỏi đường). 이 작업에서 DB 쓰기·공개 실행은 하지 않았다(사용자가 SQL Editor에서 실행).

## 건수 — 아직 미보고(이유)

관리자 DB 접근이 이 환경에 없고 비로그인(anon)은 비공개 공고를 0건으로 본다. 그래서 건수는 아래 dry-run을 사용자가 한 번 실행해야 나온다. (추정 숫자를 쓰지 않는다.)

## 실행 순서

1. `docs/ops/2026-10-08_chotot_publish_dryrun.sql` 실행(읽기 전용 SELECT 1개) → 1행: `publish_targets`(공개 대상), `targets_with_approved_pin`, `targets_kcn_text_proxy`, `targets_call_only_proxy`, `targets_agency`, 제외 사유별 건수, `rows`(JSON).
   - KCN 건수는 SQL에서는 "근무지에 KCN 글자 있음"(proxy)이다. 정확한 KCN 영역 지도 건수는 앱의 `findIndustrialPark`(공단 표에 있는 곳만)로 계산해야 하므로, `rows` 셀을 대화에 붙여 주면 `scripts/ops/chotot_publish_classify.ts`로 승인 핀 / KCN 영역 지도(정문 버튼 유무) / Gọi hỏi đường만 건수를 정확히 보고한다.
2. `supabase/pending/20261008100000_publish_chotot_jobs.sql`의 `v_expected`를 `publish_targets` 값으로 바꾸고 전체 실행.
   - 가드: chotot 행이 정확히 100건이 아니면 중단, 대상 건수가 `v_expected`와 다르면 중단, 갱신 건수가 다르면 롤백. `v_expected`가 비어 있으면 중단.
   - 공개 기준(dry-run과 동일): ID 4685~4784 · 현재 비공개 · active · 회사명 2자 이상 · 전화 숫자 8자리 이상 · 마감일 없음 또는 오늘(VN) 이후.
   - 끝의 확인 쿼리: `chotot_public / chotot_still_hidden / chotot_total / all_public_jobs`. 공개 전 전체 공개 공고는 0건이어야 하므로 실행 후 `all_public_jobs` = `chotot_public`.
3. 되돌리기: `update public.local_jobs set admin_hidden = true where source like 'chotot:%' and id between 4685 and 4784;`

## 공개 후 확인할 URL 3개(+1)

ID는 DB를 봐야 정해져서, 고르는 쿼리를 따로 두었다: `docs/ops/2026-10-08_chotot_publish_urls.sql`(읽기 전용, 공개 전·후 아무 때나). 형식 `https://viecganban.vn/viec-lam/sb-<id>`.

| 구분 | 고르는 기준 | 화면에서 볼 것 |
|---|---|---|
| KCN 1건 | 승인 핀 없음 + 근무지에 KCN 표기 | 핀 없이 KCN 윤곽 지도 + "Vị trí chính xác chưa xác minh". 정문 좌표가 있는 KCN이면 "Đến cổng KCN", 없으면 "Gọi hỏi đường"(전화) |
| 일반 1건 | 핀·KCN 없음, 직접 모집 | 지도 없음, "Gọi hỏi đường"(tel:)만 |
| 대행사 1건 | `recruitment_type='agency'` | 대행사 표기 + "Gọi hỏi đường". 회사명 자리에 대행사 게시자명이 나오는지 확인 |
| (참고) 승인 핀 1건 | 기존 승인 2건 중 하나 | 핀 + "Chỉ đường"(`destination=lat,lng`) |

공통 확인: 홈·검색에 공고가 보이고 가짜 공고·`[source:` 문구·경쟁 사이트 링크가 없는지, 상세의 지도 링크가 좌표(`destination=lat,lng`)뿐인지.

## 검증

dry-run·공개·URL SQL을 PGlite(Postgres)에서 합성 데이터 100행으로 실행해 문법·건수·가드(null/불일치 중단, 정상 갱신, 확인 쿼리)를 확인했다. 분류 스크립트는 합성 3행으로 확인.
