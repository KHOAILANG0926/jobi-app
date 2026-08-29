# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

vieclam24h 크롤러 리스팅 파싱 버그(title=배지문구, location=title) 수정
(master 커밋 `433f97b`) 이후, 이미 오염된 채로 저장된 기존 활성 공고를
재크롤링으로 바로잡는 50건 backfill 작업 중. 5batch(10건씩) 중 Batch 1
(10건) 완료, Batch 2 대상 선정 완료(미실행).

## 변경 내용

- `crawler/backfill_batch.py`(신규): 지정한 local_jobs id 목록에 대해
  ① title+company로 vieclam24h 재검색 → EXACT/HIGH/AMBIGUOUS/NOT_FOUND
  신뢰도 판정(EXACT/HIGH만 채택) → ② 확정된 공고만 상세페이지를 실제로
  재방문해 title(`<h1>`)/company(`/nha-tuyen-dung/` 링크)/location("Khu
  vực tuyển" 라벨)/salary/deadline/description/work_locations를
  독립적으로 재추출 → ③ `compute_job_updates()`로 기존 행과 diff한 변경
  필드만 UPDATE SQL 생성, work_locations 없으면 INSERT SQL 생성(있으면
  skip) → ④ 실제 DB 반영은 SQL 파일을 생성만 하고, 호출자가
  `supabase db query --linked -f`로 실행(anon key로는 두 테이블 모두
  UPDATE/INSERT 권한이 없음을 grant 조회로 확인함 — 아래 "발견된 문제"
  참고). geocoding(lat/lng)은 이 단계에서 하지 않음(의도적으로 분리).
- `crawler/.gitignore`: 스크립트 실행 시마다 갱신되는 `_batch_apply.sql`
  (생성된 SQL, 배치별로 덮어써짐) 제외 추가.
- Batch 1(10건: 4111/4098/4102/4106/4092/4104/4094/4097/4100/3665) 중
  EXACT 확정 6건(4111/4098/4102/4106/4092/4104)에 대해 실제 UPDATE
  (salary/location/source_url) + job_work_locations INSERT(각 1건)를
  Production DB에 적용 완료.
- NOT_FOUND 4건(4094/4097/4100/3665 — 오늘 고친 배지/location=title
  버그 케이스)은 재검색 자체가 안 돼(DB의 title이 이미 오염된 값이라
  원본을 못 찾음) 이번 backfill 방식으로는 구제 불가 — 재시도하지 않고
  기록만 하고 건너뜀.

## 테스트 결과

- `python3 -m py_compile crawler/backfill_batch.py`: 통과.
- Batch 1 dry-run(10건) → Stage1 재검색 매칭: EXACT 6 / NOT_FOUND 4.
- Batch 1 확정 6건 실제 적용 후 재조회로 salary/location/source_url/
  work_locations 4개 필드 전부 반영 확인(SQL로 직접 재조회, 6건 일치).
- Production(viecganban.vn) 2건(`sb-4111`, `sb-4106`) 실제 화면 확인:
  급여/지역/근무지 주소/지도 정상 표시, 깨짐 없음.
- `crawler/test_job_quality.py`: 기존 6/6 통과(이번 세션 변경분과 무관,
  회귀 없음 재확인 목적).

## 발견된 문제

- `anon` role은 `local_jobs`/`job_work_locations` 둘 다 SELECT만 가능
  (UPDATE/INSERT 권한 없음, `authenticated`도 `local_jobs`엔 UPDATE
  권한이 없음). `backfill_batch.py --apply`의 Python(anon key) 쓰기
  경로는 실제로 막혀 있어 사용하지 않음 — SQL 생성 후
  `supabase db query --linked -f`로 우회, 이번 세션에서 검증 완료.
- (버그 아님, 확인만 됨) `JobDetail.tsx`가 `jobs` 목록 fetch 완료를
  기다리지 않고 즉시 `!job` 체크를 하기 때문에, 느린 네트워크에서
  최초 렌더 시 "Không tìm thấy tin tuyển dụng"이 아주 짧게 보였다가
  데이터 도착 후 정상 내용으로 바뀌는 순간이 있음(이번 검증 중 직접
  관찰). 실사용에 지장 있는 수준인지는 미확인 — 이번 작업 범위 밖이라
  손대지 않음, 필요하면 별도 작업으로.
- `local_jobs` 활성 공고 수(1031)가 Supabase REST 기본 페이지 한도
  (1000)에 근접 — 현재는 순위표 상 아직 안전하지만, 계속 늘어나면
  `JobsContext.tsx`의 `fetchJobs()`가 오래된 공고부터 조용히 누락시킬
  수 있음(range 미지정 시 상위 1000건만 반환됨을 이번 조사로 확인).
  당장 문제는 아니지만 앞으로 계속 늘어날 경우 페이지네이션/range
  처리가 필요해질 수 있음 — 참고용 기록.

## 다음 결정사항

- `crawler/backfill_batch.py`를 master에 커밋할지 결정 필요(아직
  미커밋 — 이번 세션에서 실제로 쓴 도구이므로 커밋 권장).
- Batch 2 대상(10건, source_url 없음+정상 title 위주로 재선정):
  4129/4128/4127/4124/4122/4121/4120/4119/4118/4117 — 사용자 승인
  대기 중, 아직 미실행.
- 4094/4097/4100/3665(재검색 구제 불가 오염 데이터 4건)는 이번 50건
  배치에서 완전히 제외됨 — 향후 이 유형을 고치려면 재검색이 아닌 다른
  방법(예: 카테고리 재크롤 중 canonical_job_key로 재매칭, 혹은 수동
  source_url 지정)이 필요, 별도 결정 필요.
- geocoding(work_locations의 lat/lng 채우기)은 이번 backfill과 분리된
  다음 단계로 남아 있음(아직 미착수).
