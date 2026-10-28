# 수집 입구(하나의 입구) 설계 — 2026-10-28 (구현 전)

목적: 크롤링 재개 전에, 공고가 어디서 들어오든 **같은 함수 하나**를 거쳐 같은 순서로 검사되게 한다. 경로별 특례 금지.
근거 표기: [직접 확인] 이번에 저장소 코드에서 확인 / [기존 기록] 문서·이전 보고 / [추정].

## 1. 지금 공고가 들어오는 경로 [직접 확인: 저장소 코드]

| 경로 | 코드 | 상태 | 쓰는 칸(주요) | 공개 차단 장치 통과 |
|---|---|---|---|---|
| TopCV·VietnamWorks 등 크롤러(Python) | `crawler/crawl_topcv.py` `upsert_job_record` → `local_jobs` insert/update, `_replace_job_work_locations` | `crawl.yml` `if: false`로 정지 | 제목·회사·급여·주소·원문·source_url·job_work_locations | DB 트리거 전부 통과(R1~R8·정책·직업분류·수집 소스 멈춤). 위치는 크롤러가 직접 씀 → canonical writer 경유 여부 경로마다 다름 |
| Facebook 크롤러(Python) | `crawler/crawl_facebook.py:1247` `local_jobs` insert | 수동 | 원문·연락처·이미지 | DB 트리거 통과. 위치는 이후 location-hook |
| Node 크롤러(vietnamworks·topcv·timviecnhanh·careerbuilder·vieclam24h) | `scripts/crawl.mjs` | 오래된 경로, `guessCategory` 단어 추정 | category를 단어로 추정 | DB 트리거 통과, 단 category 추정은 직업분류 규칙과 별개 |
| Chợ Tốt 시험 등록 | `scripts/research/bn_apply_chotot_rest.py` 등 | 연구용 | 원문·주소 | DB 트리거 통과 |
| 관리자 등록(앱) | `src/lib/jobPolicyWrite.ts` → RPC `admin_create_job` | 사용 중 | 앱 입력 칸 전부 | DB 트리거 통과(관리자 JWT는 정책 review 공개 허용) |
| 고용주 직접 등록(앱) | `jobPolicyWrite.ts:65` `local_jobs` insert(RLS, origin employer) | 사용 중 | 앱 입력 칸 | DB 트리거 통과 |
| SQL 파일 등록 | `ops-insert-job.yml` → `scripts/ops/jobs/*.sql` | 사용 중(KDA 등) | 파일에 적은 칸 | DB 트리거 통과 |
| migration 등록(Lee 확인 공고) | 예: `20261028034036_register_bomunttl.sql` | 사용 중 | 원문·Lee 확인 기록 | R3 Lee 확인 경로 포함 통과 |
| OCR 대조 | `scripts/ocr/ocr-check.mjs` | 30분마다 | ocr_text·ocr_check·**active(보류/재공개)** | 기계 전용 칸(R7) |
| AI 칸·복리후생 판정 | `scripts/ocr/ai-classify.mjs` | 30분마다 | **shuttle_bus·dormitory·meal_provided·benefit_tags**, detail_line_kinds | 오늘 복수직무 식사 금지만 추가됨 |
| 상세요강 자동 채우기 | `scripts/ocr/detail-fill.mjs` | 30분마다 | description(백업 후) | 원문 글자만 |
| 위치 자동 찾기 | `api/location-hook` → `auto-location-runtime.mjs` | 저장 즉시 | job_work_locations(canonical writer), **active(위치 못 찾음 보류)**, **공고 삭제(원문에 위치 없음)** | 오늘 대략 핀 있으면 보류 안 함 추가 |

DB 공개 장치(모든 경로 공통, [직접 확인] migration 트리거): `trg_enforce_job_posting_policy`(정책 R4), `trg_zz_enforce_job_posting_rules`(R1·R3·R5·R6·R7), `trg_zzz_local_jobs_occupation_r8`, `trg_zzzz_occupation_publication`(직업분류), `trg_crawl_guard_insert`(소스 멈춤), `trg_map_r1_block_unlocated`(위치 보류), `trg_01_canonical_job_identity`, `trg_02_administrative_pin`.

문제점 요약:
1. **입구가 9곳**이고 순서가 제각각이다(위치 → 분류 → 공개를 경로마다 다르게 처리).
2. **뒤에서 고치는 자동 작업 3개(OCR·AI·위치)가 공고 칸과 공개 여부를 직접 바꾼다** → 오늘 sb-4982 사고 두 건(AI가 식사 칸을 켬, 옛 위치 판정이 공고를 숨김)의 구조적 원인.
3. 중복 판정은 크롤러 안(`by_source_url`, `by_key`)에만 있고 관리자·SQL 경로에는 없다.

## 2. 하나의 입구 설계안

```
모든 경로 ──► ingest_job(원문 묶음) ──┬─ ① 원문 보존(job_ingest_raw, 고치지 않음)
                                     ├─ ② 중복 판정(연락처 숫자 + 회사 + 원문 해시 / source_url)
                                     ├─ ③ 직업분류(공식 코드 + 원문 근거, 없으면 미분류 보류)
                                     ├─ ④ 위치(canonical writer, 오늘 순서표: 번지→회사+공단→공단 입구→거리 가운데→동→시)
                                     └─ ⑤ 공개 판정(R1~R13·정책·연락처·출처·직업분류만으로 결정)
```

- 입구는 DB 함수 `public.ingest_job(payload jsonb)` 하나. 크롤러·관리자·고용주·SQL·Lee 확인 등록 모두 이 함수만 부른다. `local_jobs`에 직접 insert 권한은 회수(전환 후).
- 경로 이름(`channel`)은 기록용일 뿐 처리 순서·기준을 바꾸지 않는다(특례 금지).
- 처리 결과는 `job_ingest_log`에 단계별로 남겨 "왜 비공개인지"를 관리자 화면·저녁 보고에서 한 줄로 보여 준다.

## 3. 오늘 사고 재발 방지(설계 원칙)
1. **AI는 제안만 한다.** AI 판정(복리후생·칸 분류)은 `job_ai_suggestions`에 저장하고 공고 칸을 직접 바꾸지 않는다. 공고 칸 반영은 (a) 원문 글자 규칙이 같은 결론일 때, 또는 (b) Lee 선택일 때만. 복수직무 공고는 공고 전체 칸에 반영 금지(직무별 표시만).
2. **위치는 공개 여부를 바꾸지 않는다.** 위치 결과는 핀과 정확도(`chưa xác minh`)·관리자 확인 대기만 바꾼다. 공개 여부는 ⑤에서만 결정. (현재의 "주소는 있는데 못 찾음 → 비공개"를 없애는 것은 10-20 결정 변경이라 Lee 결정 필요)
3. **OCR 불일치는 그 항목만 표시**하고 공개 판정은 ⑤의 규칙으로만(현행 R7 유지 여부는 Lee 결정 없이 유지).
4. **뒤늦은 자동 작업은 ⑤를 다시 부를 뿐** 직접 `active`를 쓰지 않는다.

## 3-1. Lee 결정 (2026-10-28 채팅)
- ① 예: 원문에 주소가 있는데 위치를 못 찾은 공고도 **공개 유지**. 위치 결과는 핀·정확도(`chưa xác minh`) 표시만 바꾸고 공개 여부는 바꾸지 않는다. 관리자 확인은 **선택 사항**이며 공개·핀은 자동으로 정해진다(Lee 수작업을 전제로 한 대기 금지). 10-20 "못 찾으면 비공개" 결정을 대체한다.
- **위치 찾기의 공고 삭제 폐지**: 지금은 원문에 성 이름뿐이면 `map_r1_delete_no_info`가 공고를 지운다(`api/_lib/auto-location-runtime.mjs` applyLocationVerdict의 `no_info` → `map_r1_delete_no_info`, [직접 확인] 코드). 새 설계에서는 삭제하지 않고 **원문 성/시 중심 핀 + `chưa xác minh`**로 둔다. 원문에 성/시조차 없으면 핀 없이 공개 판정은 ⑤ 규칙대로(위치 때문에 숨기지 않음).
- ② 예: 입구 하나·AI는 제안만으로 구현 시작. 크롤러가 입구로 옮겨진 뒤에만 크롤링 재개.
- DB 구조 적용은 dry-run 결과를 쉬운 말로 보고하고 Lee "적용" 후에만.

## 4. DB 구조 변경(dry-run만, 미적용)
`supabase/pending/ingest-gateway-20261028/01-schema-dryrun.sql` — 표 3개(`job_ingest_raw`, `job_ingest_log`, `job_ai_suggestions`)와 입구 함수 뼈대. **Lee 승인 전 적용 금지.** 적용은 이후 정상 migration + production_check 경로로만.

## 4-1. dry-run 결과 (로컬 폐기용 PostgreSQL, 운영 접근 없음) [직접 확인]
실행: `bash supabase/pending/ingest-gateway-20261028/run-local.sh` — Bomunttl·위치 fixture 위에서 01·02를 BEGIN…ROLLBACK 안에 적용하고 03 시험 실행 → PASS.
- 입구 5단계(원문 보존·중복·직업분류·위치·공개)가 순서대로 기록됨. 기존 트리거(R1 전화 숫자 등)가 그대로 동작.
- 같은 원문이 다른 경로(크롤러→관리자)로 다시 들어와도, 같은 source_url이면 글자가 달라도 같은 공고로 판정(새 공고 안 만듦).
- 판정 칸(admin_hidden·policy_decision)은 입구가 받지 않음. 원문 없으면 거부.
- 입구 함수는 SECURITY INVOKER: 부른 사람 권한 그대로 R3(Lee 확인 기록)·R7(OCR 칸) 보호를 받는다.
- 02 적용 시 "위치 못 찾음"은 목록에만 남고 공개를 바꾸지 않음. fixture에서 위치 때문에만 숨겨진 공고 0건(운영 건수는 적용 시 기록으로 확인).
- 남은 일(구현 단계): 관리자·고용주 경로의 위치는 기존 저장 훅 사용(크롤러만 canonical writer 직접 호출) → 2단계에서 통일.

## 5. 단계(구현 순서 제안)
1. 표 3개 + `ingest_job` 함수(기존 트리거는 그대로 두고 그 위에 얹음) → 로컬 실제 PostgreSQL 시험.
2. 관리자 등록·SQL 등록을 입구로 전환(화면 모양 변경 없음).
3. AI·OCR·위치 작업을 "제안/결과 기록 → ⑤ 재판정"으로 전환.
4. 크롤러를 입구로 전환한 뒤에만 크롤링 재개.
5. `local_jobs` 직접 insert 권한 회수.

관리자 화면: 1~3단계에서는 바꾸지 않는다. "왜 비공개인지 한 줄" 표시를 넣게 되면 글 모형을 먼저 보여 드린다.
