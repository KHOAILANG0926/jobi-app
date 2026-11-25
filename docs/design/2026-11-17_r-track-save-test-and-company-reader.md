# R 트랙: 저장 시험 사전 확인 + Facebook 회사 이름 읽기 방법 변경안 (설계·검토용, 코드 변경 없음)

Lee 2026-11-17 지시: 조사·설계·독립 검토까지만. 코드 수정·병합 없음. 이 PR은 검토용(Draft)이며 병합하지 않는다.
기준: master 4361523.

## 1. 운영 DB 저장 시험 — 기존 저장 경로 확인 결과

대상 경로: `crawl_topcv.py --verify-write --confirm-write --verify-write-urls <URL…>` → `process_urls_verify_write` → `upsert_job_record(verify_write=True)` → `ingest_job`(DB 입구 하나).

| 항목 | 기존 구현(근거) | 판정 |
|---|---|---|
| 시험 데이터 식별 | 새 행만 `active=false`·`admin_hidden=true`·`origin=crawler`로 강제(upsert_job_record 마지막 덮어쓰기), 만든 번호를 manifest(`created_ids`)로 남기고 로그에도 찍음 | 있음. 단 manifest 파일은 VPS 받는 폴더(다음 실행 때 지워짐)에만 → 로그의 번호가 유일한 기록 |
| 중복 방지 | `match_existing_row`(source_url·같은 공고 열쇠)가 기존 행을 찾으면 `VerifyWriteExistingMatchError`로 중단(갱신 경로로 안 감). DB 입구도 같은 내용 해시(전화|회사|원문) 또는 같은 source_url이면 기존 행으로 봄(ingest_private.find_existing) | 있음 |
| 기존 데이터 보호 | 검증 저장은 새 행 INSERT만. 이후 정상 수집이 `admin_hidden=true` 행의 공개 판정을 바꾸지 않음(2026-09-05 4381/4382 사고 뒤 보강). 근무지 보호(test_work_location_protection) | 있음 |
| 공개 차단 | ① 입구가 새 행을 `active=false`로 넣음(ingest_job `p.active`) ② DB 공개 차단 트리거: 연락처 없으면 비공개(로컬 PostgreSQL 5경우 통과) ③ OCR 재공개(`canRepublish`)는 `admin_hidden=false`일 때만 | vieclam24h 3건은 전화 없음 → ②로 공개 불가 |
| **빈틈(발견)** | 입구 INSERT(`admin_hidden=false`) 뒤 별도 UPDATE로 `admin_hidden=true`를 건다. 이 UPDATE가 실패하면 예외로 멈추지만 행은 `admin_hidden=false`로 남음 → 연락처·근무지가 있는 공고라면 30분마다 도는 OCR 재공개가 공개할 수 있음 | 이번 vieclam24h 3건은 ②로 막혀 영향 없음. 연락처 있는 공고로 검증 저장할 때는 위험 — 후속 과제 |
| 실패 시 복구 | 남는 것: local_jobs 숨김 행·job_ingest_raw 원문 기록·근무지 행·Google 결과 저장분. 숨김 행은 화면에 안 나옴. 삭제는 AI 금지 → 숨긴 채 둠. 위치 확인 실패는 `hold=False`라 저장 안 됨(보류함 기록 없음) | 숨김 유지가 복구 |
| S4 열쇠 범위 | 지금 crawl.yml은 열쇠·ops-keys 없음. 검증 저장은 DB 열쇠 + 위치 확인 서버 호출(같은 열쇠)이 필요 | 아래 선택 필요 |

S4 선택지(둘 다 새 시스템 없음):
- A. crawl.yml에 저장 단계 추가: `environment: ops-keys`(master만, R8), 열쇠는 그 단계에만, VPS 실행기. 고칠 곳 작음. 대신 #881에서 VPS 미리 보기에서 뺀 DB 열쇠가 그 단계 동안 VPS에 다시 올라감.
- B. Facebook과 같은 구조: VPS는 수집·파싱만(열쇠 없음) → 결과 파일 → GitHub 서버 저장 단계(열쇠만, 사이트 접속 없음). 열쇠가 VPS에 안 감. 대신 `crawl_topcv.py`에 "파일에서 저장" 입력이 없어 추가 코드 필요(Facebook `--save-from`과 같은 모양).
- 권고: B(#881 결정 "미리 보기에는 DB 열쇠 없음"과 같은 방향). 단 B는 코드 변경이라 별도 승인·PR.

## 2. Facebook 회사 이름 읽기 — 방법 변경안

### 반복 근거
- #661(7건)·#663(3건)·#668(2건): 미리 보기 원문에서 잘못 읽은 글마다 낱말 목록·자르기 규칙을 고침.
- 2026-11-17 미리 보기 실제 글 20건(run 44026994453)을 서버와 같은 함수(readLocationOnly)로 다시 읽음: 15건 읽음, 약 7건 오독 —
  "cửa hàng sạch đẹp - hiện đại"(③ 가게 낱말 뒤 설명), "cửa hàng mở giờ khác nhau"(③), "SIÊU THỊ (Quầy hàng trái cây)"(⓪ 첫 줄),
  "LƯƠNG TUẦN KHVATECH"(⓪/⑥ 급여 말 섞임), "ITL TIÊN SƠN - LÚA THỨ 2 HÀNG TUẦN"(⑥), "ALO ALO! CƠ HỘI VIỆC LÀM HẤP DẪN"(⑥), "[HAPAS"(⑥ 대괄호).
- 원인: 위치(첫 줄·가게 낱말 뒤·대시 앞뒤)로 후보를 고르고 "이름이 아닌 말" 목록으로 거르는 방식이라, 새 글 모양마다 목록이 모자람. 규칙 8: 같은 종류 3번째 → 예외 추가 금지, 방법 변경.

### 제안: 기존 AI 판정(+가드) 구조를 회사 이름에 재사용
기존 구조 = `scripts/ocr/ai-classify.mjs`(Haiku) + `src/lib/aiClassifyGuard.ts`(AI 답의 근거가 원문에 글자 그대로 없으면 버림, 목록 밖 값 버림).
1. AI에게 글 본문만 주고 `{"company": 원문에 적힌 그대로 또는 null, "line": 그 이름이 있는 원문 줄}`만 받는다. 지시: 원문에 없는 이름·브랜드 지식·조각 합치기 금지, 애매하면 null.
2. 가드(같은 파일 방식): ① company가 원문에 글자 그대로(NFC·공백 정리만) 있어야 함 ② line이 원문 줄과 같고 company를 포함 ③ 기존 `ok()`·`hasNameWord` 등 지금 규칙(60자·!/? 문장·구인 낱말만)을 그대로 통과. 하나라도 어기면 버림 → 이름 없음.
3. 이름 없음이면 지금처럼 수집 안 함(no_company). AI를 못 부르면(열쇠·한도·오류) 규칙 읽기로 되돌아가지 않고 보류함(location-hold의 '지금 확인 못 함'과 같은 재시도).
4. 실행 위치: Facebook 저장 단계(GitHub 서버, 이미 `ANTHROPIC_API_KEY`를 받음 — 새 열쇠 없음). VPS 미리 보기는 지금처럼 규칙 읽기 결과를 "미검증"으로만 표시.
5. 지울 것: 채택 뒤 Facebook 글 전용으로만 쓰이는 ⓪·③·⑥ 단계의 덧댄 목록은 다른 경로(서버 precheckCompany, 포스터)가 쓰는지 확인 후 정리(별도 PR).

### AI가 이름을 지어내는 문제 방지
- 지어낸 이름: 가드 ①로 100% 차단(원문에 없는 글자는 통과 불가) — 기존 복리후생 가드와 같은 방식.
- 원문 속 다른 이름을 고름(예: "cạnh nhà hàng ABC", 고객사 이름): 가드로 못 막음 → (a) 지시문 (b) 뒤 단계 위치 확인이 Google "같은 이름 1곳·원래 성 안"을 요구 — 틀린 이름이면 대개 못 찾음 → 등록 안 됨(보수적 실패) (c) 채택 전 평가로 비율 측정.
- 평가(채택 조건, 코드·실행은 승인 뒤): `companyReader.test.ts` 기존 사례 전부 + 2026-11-17 실제 글 20건. 조건 = 지어낸 이름 0건, 기존 사례 정답률 규칙 읽기 이상, 7건 오독이 바른 이름 또는 null.

### 비용·부담
- Haiku 글 1건당 1회(Facebook 저장 대상만). 새 서비스·새 열쇠 없음.
- 확인 못 한 것[추정]: 실제 AI 정답률(아직 안 돌림), 규칙 단계 정리 범위.
