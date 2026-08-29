# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

vieclam24h 크롤러 리스팅 파싱 버그 수정(master `433f97b`) 이후 진행한
50건 backfill(오염된 채로 저장된 기존 활성 공고를 재크롤링으로 바로잡기)이
5batch 전부 완료됨. `crawler/backfill_batch.py`(master `618735c`)로 처리.

## 변경 내용

- 50건(id: 4111/4098/4102/4106/4092/4104/4094/4097/4100/3665/4129/4128/
  4127/4124/4122/4121/4120/4119/4118/4117/4116/4115/4114/4113/4112/4110/
  4105/4103/4101/4099/4095/4093/4091/4089/4088/4087/4086/4085/4084/4082/
  4081/4080/4079/4072/4067/4064/4063/4060/4057/4051) 시도 → **44건 실제
  반영, 6건 제외(NOT_FOUND)**.
- 반영된 44건: salary/location/source_url 갱신(달라진 필드만) +
  job_work_locations 신규 insert(총 62건 주소, 1~5건/공고). title/company는
  44건 전부 무변경(EXACT 매칭 기준 — 애초에 안 바뀌는 게 정상).
- 제외 6건: 4094/4097/4100/3665(오늘 고친 배지/location=title 버그로
  DB의 title 자체가 오염돼 재검색이 원본을 못 찾음), 4086/4079(제목에
  "[지역]" 대괄호 접두 또는 그 외 사유로 NOT_FOUND) — 재시도 없이
  이번 backfill에서 완전히 제외됨. **이 6건은 여전히 오염/미보강 상태로
  local_jobs에 남아 있음.**
- Production(viecganban.vn) 실제 화면 확인: 매 batch 1~2건씩 총 7건
  (`sb-4111`, `sb-4106`, `sb-4128`, `sb-4124`, `sb-4116`, `sb-4093`,
  `sb-4063` — 다중 근무지 케이스 포함) 전부 정상(급여/지역/근무지 주소/
  지도 표시 문제 없음).
- 적용은 전부 `supabase db query --linked -f <생성된 SQL>` CLI 경로로
  실행(anon key로는 두 테이블 다 쓰기 권한 없음, 확인됨).

## 테스트 결과

- Batch별 재조회 SQL로 salary/location/source_url/work_locations 4개
  필드 전부 반영 확인(5회, 44건 전량 일치).
- 최종 집계: `local_jobs.active=true` 중 `source_url` 있는 공고 45건
  (이번 44건 + 기존 3981), `job_work_locations` 총 62건(전부
  `geocode_status='pending'`, 이번 단계에서 의도적으로 geocoding 안 함
  — 신규 60건 + 이전 세션에서 이미 geocode된 2건).

## 발견된 문제

1. **재검색 방식의 구조적 한계**: title 자체가 오염된 6건(위 목록)은
   "title+company로 재검색"이라는 이 스크립트의 접근 자체가 원천적으로
   구제 불가. 다른 방법(카테고리 재크롤 중 canonical_job_key 재매칭,
   수동 source_url 지정 등) 필요 — 미결정.
2. **location 요약 필드 표기 이슈**(work_locations 개별 주소는 정상,
   `local_jobs.location` 요약 텍스트만 지저분함):
   - 콤마 뒤 공백 없음: 예 `"TP.HCM,Bình Dương"` (id 4128)
   - 원본 사이트의 "+N개 더" 축약 배지가 그대로 들어감: 예
     `"Hải Phòng,Hà Nội,Bắc Ninh, +2"` (id 4057, 실제 work_locations는
     5건 다 정상 저장됨 — 요약 필드만 손실)
3. **JobDetail.tsx가 jobs fetch 완료를 기다리지 않음**: 느린 네트워크에서
   최초 렌더 시 "Không tìm thấy tin tuyển dụng"이 잠깐 보였다가 데이터
   도착 후 정상 내용으로 바뀌는 순간 관찰됨(재현 가능, 실사용 영향도는
   미확인).
4. **anon key 쓰기 권한 없음**: `local_jobs`/`job_work_locations` 둘 다
   `anon`은 SELECT만 가능(`authenticated`도 `local_jobs`엔 UPDATE 권한
   없음) — `backfill_batch.py`는 SQL만 생성하고 실제 반영은 항상
   `supabase db query --linked -f`로 별도 실행해야 함(스크립트 자체가
   `--apply`에서도 CLI를 직접 실행하지 않음, 아래 5번 때문).
5. **네이티브 Windows Python이 `supabase.exe`를 subprocess로 못 띄움**
   (`WinError 2`, PowerShell에서 직접 실행하면 정상) — 원인 미상,
   `backfill_batch.py`는 SQL 파일 생성까지만 하고 실행은 호출자(CLI)
   책임으로 우회함.
6. **`local_jobs` 활성 공고 수(1031+)가 Supabase REST 기본 페이지 한도
   (1000)에 근접** — `JobsContext.tsx`의 `fetchJobs()`가 range 미지정이라
   상위 1000건만 반환됨을 확인. 지금은 안전하나 계속 늘어나면 오래된
   공고가 조용히 공개 목록에서 누락될 수 있음.

## 다음 결정사항

- **geocoding 미착수**: 이번 44건 + 이전 3981 포함, `job_work_locations`
  60건이 `geocode_status='pending'` 상태로 남아 있음. 이번 backfill과
  분리된 별도 단계로 진행 필요(사용자 지시로 의도적으로 분리해둠).
- 위 "발견된 문제" 1~6번은 전부 이번 50건 backfill 범위 밖 — 사용자가
  "50건 끝난 뒤 정리 목록"으로 모아두라고 지시한 항목들, 아직 착수 안 함.
- 제외된 6건(4094/4097/4100/3665/4086/4079)을 어떻게 구제할지 결정 필요.
