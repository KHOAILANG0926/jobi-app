# 신규 공고 제외 정책 조사·설계 — 2026-10-11

## 0. 조사 기준·증거 분류·실행 범위

- **[직접 확인] 조사 시작 기준 SHA: `9157ced522d024b2c378958f623beffbdfeb1aba`, GitHub `KHOAILANG0926/jobi-app`의 `master`.** `github_search_branches(query="main")` 결과 `branches: []`; `GET /repos/KHOAILANG0926/jobi-app/branches/main` 결과 `404 Branch not found`; `GET .../branches/master` 결과 위 SHA·`protected: true`. 따라서 존재하지 않는 main의 SHA를 만들어 쓰지 않고 실제 주 브랜치 master를 고정했다. 모든 아래 소스 조회는 이 SHA의 `github_fetch_file` 결과다.
- **[직접 확인]** 먼저 AGENTS.md / CLAUDE.md / PROJECT_STATUS.md / CHATGPT_HANDOFF.md / VIECGANBAN_STRUCTURE_BASELINE.md를 읽고, 별도로 `status:STATUS.md`를 읽었다. STATUS 생성 시각은 **2026-10-11 12:12 VN(UTC+7, Bangkok과 동일)**, 기준은 `9157ced`다(E03). 문서의 과거 테스트 수치를 이번 테스트 결과로 사용하지 않는다.
- **[기존 기록]** STATUS의 #4750 숨김·좌표 철회 기록은 2026-10-11 10:44 VN이다(E04). HANDOFF는 B2B 필터 구현을 다음 결정사항으로 남겼다(E02). 이는 자동 생성/작성 기록을 읽은 것이며, 이번 작업의 Production DB 직접 조회가 아니다.
- **[직접 확인]** 로컬 `exec_command`는 프로세스 생성 단계에서 `helper_unknown_error: setup refresh had errors`로 실패했다. `git status`, remote, HEAD, 로컬 파일 읽기, rg, tsc, npm test, build의 성공 결과는 없다. 첫 Node 대체 접근은 커널 종료, 두 번째 로컬 스킬 파일 읽기는 자동 승인 검토에서 비공개 파일 출력 위험으로 거절되어 중단했다. 해당 거절을 우회하지 않았다.
- **[직접 확인]** 대신 GitHub 연결 도구로 recursive tree를 조회(`truncated:false`)하고 소스 286개를 SHA 고정으로 읽어 메모리에서 정규식 검색했다. 추가로 루트 `register_job.mjs`, `check_dup.mjs`, `public/sw.js`, 운영 문서·테스트·워크플로를 읽었다. `rg`를 실행했다는 주장은 하지 않는다. 말미에 조회 소스 목록과 3~10줄 원문 증거를 싣는다.
- **[추정/미확인]** 운영 pg_trigger/pg_policies/pg_proc/권한·Supabase Edge Function 목록·VPS 배포 SHA/crontab·외부 콘솔 SQL/미추적 스크립트는 조회하지 못했다. 저장소 SQL 존재는 실제 운영 적용 증거가 아니다. 소스 밖 쓰기 경로까지 모두 닫혔다는 결론은 보류한다.
- **[직접 확인]** 이번 산출물은 이 보고서 1개다. 앱 코드·설정·HANDOFF·STATUS·검증 장치·Production DB를 변경하거나 공고 공개/숨김/삭제를 실행하지 않았다. 배포·PR 병합·승인 라벨 부착을 요청하지 않는다. GitHub API로 새 브랜치에 보고서만 보존하며 로컬 worktree clean 여부는 미확인으로 남긴다.

표기 규칙: **[직접 확인]**은 이번 소스/조회 응답으로 확인한 내용, **[기존 기록]**은 재실행하지 않은 문서상의 사건, **[추정]**은 설계 제안·운영 미확인·예상 영향이다. E번호는 말미의 **파일 경로:줄 번호 + 3~10줄 원문**으로 연결된다. 설계에 언급한 신규 파일은 아직 존재하거나 구현된 파일이 아니다.

## 1. 확정된 정책과 사용자 결정 필요

| 분류 | 현재 근거와 적용 범위 | 결정 상태 |
|---|---|---|
| [기존 기록] 금융·대출·여신 영업 및 추심 전담 | PROJECT_STATUS.md:18~20(E01); Python은 대출/금융은 title+company+description, 추심은 title/category의 가까운 어근 조합으로 구분(E05~E07). | 기존 제외 대상 유지. 업무 일부의 매출채권 관리와 추심 전담은 구분. |
| [기존 기록] B2B 외근·대리점 관리 중심 영업 | PROJECT_STATUS.md:20(E01), HANDOFF의 미구현 기록(E02). | 범주 자체 확정. 구체적 문장/역할 증거·혼합 직무 판단 경계는 승인 필요. 단순 sales/kinh doanh/영업 단어 차단 금지. |
| [기존 기록] 월 2,000만 동 이상 인센티브 중심 전문 영업 | PROJECT_STATUS.md:21(E01). 표에는 기본급/인센티브 포함 총액/공고 최대치 중 어떤 값을 비교하는지, 인센티브 “중심”의 정량/문장 기준이 없다. | **사용자 결정 필요.** 금액만으로 자동 제외하지 않는다. |
| [추정] 매장 판매·마트 판매·정상 생산·QC | 허용 요구사항은 이번 사용자 지시. 기존 분류기는 retail/factory 등을 반환할 뿐 공개 적합성을 결정하지 않는다(E18~E19). | 역할·업무 문맥이 생활형이면 허용. 금융 또는 확정 B2B 역할이 함께 있는 혼합 공고는 검토 필요. |

**[직접 확인]** 기존 급여 컬럼은 salary_min/max/currency/period/negotiable이고 기본급·총수입 구분은 이 컬럼 정의에 없다(E77). `salary_max >= 20000000`를 정책으로 바로 쓰는 것은 문서가 정하지 않은 확장이다. `salary_basis/salary_note` 같은 추가 텍스트를 읽더라도 입력 누락·원문 최대치·협의급여를 임의로 기본급/총수입으로 바꾸지 않는다.

**[추정/사용자 결정 필요]** ③은 다음을 먼저 정해야 한다: 비교 대상 금액, 월 VND 명시 여부, 범위의 어느 끝값인지, “최대 30 triệu” 포함 여부, “인센티브 중심”의 증거, 고정 기본급 높은 매장판매/생산직의 허용. 금액 변환(시급/일급→월급)·통화 환산·영업직 전체 차단은 제안하지 않는다.

**[직접 확인]** Python과 TS의 기존 금융 판정도 같지 않다. Python은 title/category에서 `nhac+no`, `field+collection` 등을 확인하지만 TS는 전체 title+company+description에 다른 단일 정규식만 적용한다(E06~E08). Python의 `Nhân viên nhắc nợ` / `Field Collection Specialist` 차단 회귀 fixture가 존재한다(E81). **[추정]** TS에서 이 fixture들이 통과할 가능성은 코드 대조로 확인되는 결함 후보이며, 테스트를 실행해 통과/실패 판정한 것은 아니다. 통합 시 기존 오차단 방지 문맥을 보존하고, 다른 규칙을 합집합으로 무조건 확대하지 않는다.

## 2. 전체 유입·저장·공개 경로 및 적용 여부 (완료 증거 ①②)

아래 “없음”은 **고정 SHA의 해당 경로 전체 본문을 읽은 결과**다. 운영에 같은 코드/SQL이 설치돼 있다는 뜻이 아니다.

| 경로 | 실제 연결/DB 경계 | 정책 적용 및 누락 |
|---|---|---|
| [직접 확인] Vieclam24h 수집·단일 URL·재처리 | `crawler/crawl_topcv.py`의 build → validate_job_payload → upsert_job_record → local_jobs INSERT/UPDATE(E11~E12,E15~E17). CLI는 같은 upsert를 공유. | 금융만 Python 검사. B2B·급여 정책 없음. 공개 게이트는 위치/지원경로만(E09~E10). |
| [직접 확인] VietnamWorks 수집 | 같은 파일의 build_vietnamworks_job_record → validate → 같은 upsert(E13~E14,E15~E17). | 위와 동일. 파일명 topcv를 실제 TopCV 수집 구현으로 오해하지 않는다. |
| [직접 확인] Facebook 수집 | evaluate_post의 money/office 검사 → parse_post(active=true, admin_hidden=false) → missing_required/중복 확인 → 직접 INSERT(E20~E23). | 금융 사전 검사 존재. B2B·③ 공통 검사 없음. save_to_supabase 최종 경계는 필수값만 검사하고 전체 정책을 재검사하지 않는다. 일부 전문직 필터는 3종 정책의 대체가 아니다. |
| [직접 확인] Chợ Tốt 반자동 수집·CSV 후보 선정 | `bn_build_chotot_csv.mjs` 제외 사유 → `bn_prepare_chotot_insert.py` classify/gate/validate → `bn_apply_chotot_rest.py` REST INSERT(E89,E61~E65). | 후보 선정은 연락처·회사·지역·대행사 근거. 준비기의 validate는 금융만. active는 연락경로 gate, 처음 admin_hidden=true. B2B·③ 누락. |
| [직접 확인] Chợ Tốt 공개 전환 | dryrun.sql의 eligible → chotot_publish_classify.ts(지도 유형 집계) → pending 공개 SQL의 admin_hidden=false(E66~E69). | 회사·전화·기한·active만. 직무 정책/급여·인센티브 재검사 없음. 지도 분류기는 정책 분류기가 아니다. pending SQL 실행 여부는 이번 직접 확인 아님. |
| [직접 확인] 관리자 수동 등록·AI 파싱 후 저장 | AdminDashboard.handleSave → admin_create_job → local_jobs INSERT(E24~E26). | title/company 존재와 관리자 권한만. active=true, origin=admin, admin_hidden=false. JobsContext 판정 함수 경유 안 함. |
| [직접 확인] 로그인 기업 등록 | PostJob → addPostedJob → 클라이언트 금융 검사 → local_jobs INSERT(active=true)(E29~E31). | TS 금융만. B2B·③ 없음. RLS는 계정/소유권만(E41). 클라이언트 우회 REST에는 정책 검사 없음. |
| [직접 확인] 이메일 신규 기업 등록 | PostJob signUp 후 같은 addPostedJob(E27,E30~E31). | 로그인 기업과 동일. 이메일 방식이 별도 정책 검사를 갖는 것은 아님. |
| [직접 확인] 비로그인 빠른 등록 | PostJob token → 같은 addPostedJob → anon INSERT(E28,E30~E31,E36). | UI 금융만. guest_insert는 employer_id NULL + 토큰 길이만. 직접 REST 우회 가능성이 있는 쓰기 경로. |
| [직접 확인] 기업 공고 수정 | JobsContext.updateJob → direct UPDATE(title/company/salary/description 등)(E32~E33); EmployerDashboard의 현재 호출은 urgent 변경. | 정책 재검사 없음. UPDATE 권한에 active 포함(E43); 공개 유지 중 내용 변경도 검사해야 한다. UI의 updateJob가 현재 active를 보내지 않는다는 점과 REST 권한을 구분. |
| [직접 확인] 게스트 수정·재활성 | ManageGuestJob → update_guest_job SECURITY DEFINER → 내용/active UPDATE(E34~E38). | 토큰 소유권 검사만. 이미 공개인 내용 수정, p_active=true 재공개 모두 금융 검사도 없음. |
| [직접 확인] 관리자 숨김 해제 | AdminJobs → setJobHidden → admin_set_job_hidden → admin_hidden UPDATE(E39~E40). | require_admin + audit log. 공개 직전 정책 없음. 숨김 결정은 개별 행에만 적용. |
| [직접 확인] 루트 일괄 등록 스크립트 | register_job.mjs service role → JSON 공고를 local_jobs INSERT(E70~E71). | 금융 포함 공통 검사 없음. 호출자 payload의 active/admin_hidden을 검사하지 않는다. |
| [직접 확인] 서비스 롤 재분류 | reclassify_db.py category/subcategory UPDATE, reclassify_node.mjs category PATCH(E72~E73). | 공개 플래그 변경은 없지만, 정책 입력인 category 변경 시 재검증 필요. 임의로 이 도구를 실행/재설계하지 않는다. |
| [직접 확인] 구형 JS 수집 | scripts/crawl.mjs → **jobs** 테이블 INSERT(E74). | local_jobs와 다름. 3종 정책 없음. 현재 local_jobs 공개 파이프라인의 유입이라고 단정하지 않음. 운영 jobs 뷰/트리거/연결은 미확인. |
| [직접 확인] E2E 스크립트·관리자/기반 migration 워크플로 | e2e-admin-operations/e2e-p0-foundation의 INSERT, admin RPC, 정리 DELETE(E94~E95), admin-operations workflow의 migration 실행(E88). | 테스트 공고도 direct writer다. 이 단계에서 실행 금지. 향후 격리 DB에서만 정책 통합 테스트; Production 합성 공고 금지. |
| [직접 확인] 만료/정리 SQL | deactivate_expired_jobs_fn active=false(E75), cleanup_local_jobs_delete.sql DELETE. | 공개 승격 경로 아님. 차단 검사로 숨김/종료/삭제까지 막으면 운영 복구를 방해하므로 설계 대상은 공개 NEW 행. 삭제는 이번 실행 안 함. |
| [직접 확인] 조건·핀·주소/좌표 쓰기 | update_job_conditions는 local_jobs 조건만(E76), set_job_pinned_location은 job_work_locations(E93); replace_job_work_locations·regeocode·POI 후보는 근무지/후보 별도 테이블. | public 플래그를 켜지 않음. 좌표 승인과 공고 게재 정책 승인은 별개. 기존 주소·길찾기 설계를 바꾸지 않는다. |
| [추정/미확인] Supabase 콘솔/외부 SQL/Edge Function/VPS의 다른 스크립트 | Git tree에는 supabase/functions 또는 루트 functions 디렉터리 없음(아래 조사 목록). | 운영 대시보드 목록·DB 카탈로그·VPS 파일을 조회해야 전체 외부 경로 완료 판정 가능. 저장소에 없다는 사실로 “운영 Edge Function 없음”을 결론내리지 않는다. |

**[직접 확인] 실행 진입의 부가 문제:** `.github/workflows/crawl.yml:27`과 `crawler/run_daily.sh:47`은 인자 없이 crawl_topcv.py를 실행(E86~E87); 현재 CLI는 인자 없는 전체 크롤을 중단(`crawl_topcv.py:2645~2652`, E97). **[추정]** 실제 해당 버전을 배포한 환경에서는 자동 수집이 중단될 수 있다. VPS에서 현재 수집 중이라는 문서만으로 현재 실행 상태를 단정하지 않는다. 이번 정책 조사 범위에서 자동화 인자를 고치거나 수집을 재개하지 않는다.

### 2.1 검색·지도·추천·SSR: 공개 상태 공고만 노출하는가

| 노출 경로 | 코드 확인 | 판정 |
|---|---|---|
| [직접 확인] Home/검색/지도 | Home, JobSearchPage, MapView가 useJobs 사용(E51~E53); fetchJobsData는 active=true + 금융 사후 필터(E46~E47). | anon에서 SQL 0019가 적용돼 있으면 hidden도 RLS로 제외(E44~E45). **[추정/운영 미확인]** 실제 정책 설치는 DB 카탈로그 확인 전 보류. |
| [직접 확인] 로그인 소유자/관리자의 공개 목록 | SQL local_job_is_visible가 본인 소유와 관리자 조회를 OR 허용(E44). fetchJobsData에는 admin_hidden=false 조건이 없음(E46). | **[추정]** 해당 SQL 적용 시 로그인 기업/관리자 세션에서 active=true인 숨김 공고가 공개 목록·지도·추천에 섞일 수 있다. 운영 재현은 하지 않음. 공개 목록에 별도 hidden 조건 필요; 관리용 목록은 그대로. |
| [직접 확인] 맞춤/추천 페이지 | MatchedJobsPage → RecommendSection(jobs), SuggestedJobsPage도 useJobs 목록에서 후보를 추림(E56~E58,E96). | 동일 공개 목록을 소비한다. 추천 알고리즘 자체는 active/hidden 검사 없음(E58). BASELINE의 “미사용” 기록은 현재 코드와 다름; 새 추천 기능을 만들 필요 없음. |
| [직접 확인] Home 지도/상세 Preview 경로 | HomeMapExplorer와 JobDetail은 mapAcceptanceJobs도 합침(E54,E90). JobsContext는 DEV 또는 VITE_MAP_ACCEPTANCE=true + query로 fixture를 로드(E55). | 별도 DB 공개 상태가 없는 Preview fixture 예외 존재. **[추정]** Production 빌드에 해당 env가 켜졌는지는 미확인. 이번 코드 수정 금지에 따라 그대로 두고 향후 Production 검증에서 확인. |
| [직접 확인] SSR 상세/검색/급구 | entry-server.loadJobsForSSR → fetchJobsData(supabaseServer), api/ssr가 호출(E48~E49). | 서버는 공개 anon 클라이언트 경로. active + RLS(hidden) + TS 금융필터에 의존. 서버 내부에서 별도 B2B/③ 정책 없음. 숨김 조회 권한 운영 적용 미확인. |
| [직접 확인] sitemap | api/sitemap이 같은 loadJobsForSSR 결과를 사용(E50). | 같은 공개 데이터 경로. 노출 규칙을 별도 복제할 필요 없음. |
| [직접 확인] DB 조건 매칭/공고 알림 | job_alert_job_is_open는 active=true AND admin_hidden=false AND 미만료(E59); notification generator도 이 함수를 거침(E60). | 공개 상태 검사는 있음. TS 금융필터 경유 안 하므로 DB에 공개된 정책 위반은 매칭/알림에 남을 수 있음. DB 게이트가 필요한 추가 이유. |
| [직접 확인] 기업·관리자 관리 목록 | jobRows.fetchEmployerJobs는 employer_id로 별도 조회(E92), AdminOperations.listAdminJobs는 관리용 전체 조회. | 관리 화면에서 비공개를 보는 것은 필요한 동작(E84). 공개 검색 제한과 관리 조회 권한을 혼동하지 않는다. |

### 2.2 서비스 롤·SQL·trigger 조사 범위

**[직접 확인]** 서비스 롤 참조는 환경변수 이름만 확인했으며 키 값은 읽거나 저장하지 않았다. Python 수집기의 키 참조(E101~E102), Chợ Tốt REST 실행기의 변수 참조(E100), 루트 register_job의 변수 참조(E70)를 추적했다. `api/admin-users.js`는 계정 정지/Auth 변경(E103), `api/admin-vietmap.js`는 지도 호출 카운터(E104), `api/ward-area.js`는 private cache 읽기(E105)로 local_jobs 공개 쓰기와 구별했다. `api/zalo-token.js`는 Auth 경로이며 local_jobs writer를 발견하지 않았다(전체 파일 조회·검색, E108). `api/status-recheck.js`와 `scripts/status/generate-status.mjs`도 읽기 전용으로 조사했고 local_jobs 공개 INSERT/UPDATE를 발견하지 않았다(E109~E110). 보호된 파일은 조회만 했고 변경하지 않았다.

**[직접 확인]** migration/pending SQL 전체 본문에서 `create trigger`, `before insert/update`, `local_jobs`, `create policy`를 검색했다. 저장소 trigger의 대상은 auth.users, job_work_locations, korea_job_work_locations, applications, community_likes/comments, job_alert_preferences/home_locations, pending job_location_candidates로 확인됐다. 직무 제외 정책으로 local_jobs 공개를 막는 trigger는 찾지 못했다. 이 부재 주장의 증거 범위는 말미 조회 목록의 SQL 파일 전체이며, 실제 관련 RPC/권한·상태 함수 원문은 E25~E26,E36~E45,E76~E78이다. **[추정]** DB 카탈로그나 대시보드로 만든 별도 trigger는 운영 조회 전 미확인이다.

**[직접 확인]** migration SQL은 순서별로 RLS가 덮어써지는 구조라 0009의 공개 정책만 인용하면 현재 설계를 잘못 설명하게 된다. 0019의 visibility 함수/RLS(E44~E45)와 후속 guest 권한(E36~E38)을 함께 읽었다. 만료 cron 연결도 저장소에 있다(E107); “함수만 있고 scheduler 없음”이라는 옛 문서로 현재 운영 cron 유무를 단정하지 않는다. 실제 설치 여부는 [추정/미확인]이다.

## 3. 확인된 누락 원인 (완료 증거 ③)

1. **[직접 확인] 정책 채택과 실행 검사 사이가 끊겼다.** 기존 문서는 B2B·③를 “크롤러 반영 필요”로 명시(E01,E02). 실제 validate_job_payload의 제외 검사는 money/debt뿐(`crawler/job_quality.py:933~935`, E98); classify는 직종 라벨을 반환할 뿐(E18~E19). 따라서 category=retail/office/quan_ly_ban_hang으로 분류돼도 B2B 제외가 되지 않는다.
2. **[직접 확인] 개별 공고 숨김은 신규 유사 공고 정책이 아니다.** upsert는 기존 행의 admin_hidden=true를 보존(E17)하지만 새 행은 자체 payload로 INSERT(E15~E16). admin_set_job_hidden도 target_job_id 한 행만 갱신(E40). **[기존 기록]** #4750 숨김은 기록에 존재(E04). **[추정]** #4750과 닮은 새로운 source/id는 이를 상속하지 않는다. 실제 원문 재유입 이벤트는 이번에 관측하지 않았다.
3. **[직접 확인] “공개 직전”은 경로마다 다르며, 검사도 누락됐다.** 관리자 INSERT(E25~E26), guest RPC(E37~E38), admin unhide(E40), Chợ Tốt SQL(E66~E67), 루트 service-role INSERT(E70~E71)가 동일한 판정기를 거치지 않는다. 연락처가 있다는 공개 요건만으로 게재 대상 정책까지 충족한 것은 아니다.
4. **[직접 확인] 금융 구현이 중복돼 입력 범위/표현이 불일치한다.** Python title/category 근접 검사(E06~E07)와 TS 전체 텍스트 정규식(E08)이 다르다. 금융 누락·오차단 회귀를 함께 비교해야 한다.
5. **[직접 확인] DB 저장소 소스에서 직무 정책 불변식이 없다.** employer/guest RLS는 소유권·계정 조건(E36,E41~E43), 공개 RLS는 상태/관리 권한(E44~E45), publish_gate_reason CHECK는 사유 enum만(E78). 저장소 SQL 전수 검색에서 local_jobs 대상 직무 정책 trigger는 발견되지 않았다. **[추정/미확인]** 실제 운영에 별도 trigger가 있는지는 카탈로그 조회 전 판단 금지.
6. **[직접 확인] 기존 테스트 통과가 정책 증명은 아니다.** npm test 수집기는 src/api의 .test.ts만 수집(E79), fetchJobsData 테스트는 빈 목록/실패만(E80). Python 정책 tests(E81~E82)를 npm test가 자동 실행하지 않는다. **[기존 기록]** STATUS의 47/47 파일 통과는 기존 실행 기록이며 3종 정책 통합 테스트를 새로 실행한 증거가 아니다.

## 4. 최소 변경 설계와 우회 차단 (완료 증거 ④)

**[추정/설계 제안 — 구현·DDL 승인 전 실행 금지]** 권고안은 DB에 하나의 순수 판정 함수와 공개 쓰기 trigger를 두고, Python/TS/운영 SQL은 같은 함수에 위임하는 방식이다. 기존 카테고리·local_jobs FK·Auth·소유권 RLS·위치 승인·공개 상태 두 boolean을 유지한다. TS와 Python에 동일 정규식을 또 복제하는 안은 E05~E08의 불일치를 재발시키므로 제안하지 않는다.

### 4.1 같은 판정 함수

- **[추정/설계] 신규 제안 파일 `supabase/pending/202610_job_posting_policy_guard.sql`**: `evaluate_local_job_policy(payload jsonb)`가 `decision=allow|exclude|review`, `policy_version`, `reason_codes[]`, `evidence[{field, original_excerpt, rule_id}]`를 반환. 입력은 title/company/description/category/subcategory/salary 및 확인 가능한 salary period/basis/note/business_trip. 증거 없이 allow로 채우거나 client가 보낸 decision을 신뢰하지 않는다.
- **[추정/설계]** 신규 `src/lib/jobPostingPolicy.ts`와 `crawler/job_posting_policy.py`는 해당 RPC 호출/결과 검증만 담당한다. 여기에는 별도 정책 정규식을 두지 않는다. DB 실패·버전 불일치·필수 원문 없음은 “판정 불가”, 공개 금지로 반환한다. 유입 시 사전 RPC 검사 후 DB 저장 시 최종 재평가한다(조회와 저장 사이 정책/내용 변경도 차단).
- **[추정/설계]** 명확한 금융/추심과 승인된 외근·대리점 관리 중심 B2B 증거는 exclude. 판매·출장이라는 낱말 하나, company 업종만, salary_max 숫자만으로 B2B/③를 결론내리지 않는다. 일반적 “매출채권 관리”는 보존(E82). ③와 혼합 직무 경계가 미정이면 review로 남기고 사용자 결정 전 규칙을 활성화하지 않는다.
- **[추정/설계]** 기존 `crawler/job_quality.py:862~904,933~935` 및 `src/lib/jobQualityFilter.ts:39~49`의 중복 판정은 동일 함수 결과를 사용하도록 승인 후 교체한다. Python 오프라인 validate는 품질/스키마 검사와 정책 RPC 결과를 분리하고, 테스트는 DB 함수의 공통 fixture를 사용한다. `classifier.py`는 직종 분류로 유지한다(E18~E19).

### 4.2 공개 상태 변경 직전 검사

- **[추정/설계]** 같은 pending SQL에 `BEFORE INSERT OR UPDATE ON public.local_jobs` trigger 제안. NEW.active IS TRUE AND NEW.admin_hidden IS FALSE일 때 **최종 NEW 전체 내용**으로 위 함수를 호출, allow만 허용하고 exclude/review/함수 오류/미지원 정책 버전은 publication 거부. 모든 INSERT, hidden true→false, active false→true, **이미 공개 중인 내용·급여·분류 수정**이 포함된다. 공개 플래그만 바뀔 때 검사하면 E32~E38 우회를 못 막는다.
- **[추정/설계]** 기본 제안은 DB 예외로 해당 공개 쓰기를 롤백하는 방식이다. 정상 이전 내용은 보존하며 hidden/active를 몰래 켜거나 수동 숨김을 자동 해제하지 않는다(E17). 명확한 제외 신규 수집은 PROJECT_STATUS의 skip 방향 유지(E01). 검토용 저장이 승인되면 별도 명시적 active=false INSERT로만 저장한다. 기존 공개 위반 데이터의 자동 대량 숨김은 이 구현과 분리해 사용자 승인을 받는다.
- **[추정/설계]** “모호하면 skip” 문서와 검토 대기 저장은 다른 제품 선택이다. 크롤러는 원칙적으로 skip, 기업/관리자는 오류 사유 표시; review를 보존하려면 비공개 저장·관리 목록 표시·재검토 흐름을 별도 승인한다. 단순 등록 성공 후 공개 상세로 이동하면 비공개를 못 찾으므로 PostJob의 반환 상태 분기와 JobsContext.setJobs도 함께 고쳐야 한다(E29,E91,E84).
- **[추정/설계]** active=false 또는 admin_hidden=true가 되는 숨김·만료·정리 쓰기는 막지 않는다(E75). 이미 숨긴 공고는 다음 수집으로 풀지 않는다(E17). 단순 urgent 수정도 최종 공개 공고가 위반이면 막힐 수 있음을 관리자에게 사전에 표시한다.

### 4.3 DB 수준 차단 판단·관리자/기업 영향

**[추정/설계 결론] DB trigger가 필요하다.** 서비스 롤 direct INSERT(E70~E71), SECURITY DEFINER 공개/수정 RPC(E25~E26,E37~E40), SQL 일괄 공개(E66~E67), 직접 REST 권한(E36,E41~E43)은 앱 함수만으로 막을 수 없다. RLS의 소유권 강화만으로 관리자/서비스 롤 쓰기까지 동일 정책에 묶을 수 없고, CHECK의 사유 enum(E78)만 추가해서도 내용 정책을 보장할 수 없다.

| 쓰기 주체 | 승인 후 바뀔 동작 | 유지/위험 |
|---|---|---|
| [추정] 관리자 등록·숨김 해제 | 최종 allow일 때만 공개. 금융/B2B 위반을 “관리자니까” 우회하지 못함. 사유·증거 표시 후 수정/재검토. | 기존 require_admin/auth/audit 로그 유지(E40). 관리자 override 추가는 별도 승인 전 금지. |
| [추정] 기업/게스트 등록 | 기존 UI 사전 검사 + DB 최종 검사. 수동 REST·active 재공개도 같은 검사. | 기존 account_roles·employer_id·guest token 소유권 유지(E36,E41~E43). 정상 매장 판매는 통과. |
| [추정] 공개 중 수정 | NEW 내용 재평가. 제외로 바뀌는 내용을 공개 상태로 저장하려 하면 롤백. | 기존 공개 위반도 다음 UPDATE 시 거절될 수 있음. 초기에 읽기 전용 dry-run으로 대상을 설명하고 별도 처리 승인. |
| [추정] 서비스 롤/운영 SQL | 권한이 있어도 정상 trigger를 거치는 INSERT/UPDATE는 정책 위반 공개 거절. | DB owner가 trigger를 disable하거나 session_replication_role 등을 바꾸는 행위까지 절대 차단하는 보장은 없음. 배포권한·운영절차와 카탈로그 재검증 필요. |
| [추정] Chợ Tốt 일괄 공개 | 후보 선정 SQL과 최종 UPDATE 모두 같은 판정 함수. 위반이 섞이면 트랜잭션 중단. | 기존 기대 건수 v_expected(E67)가 변할 수 있다. 새 dry-run 결과·건수 승인 전 실행 금지. |

**[추정/승인 필요]** 이 안은 함수·trigger DDL이므로 AGENTS/CLAUDE의 큰 변경 중단 규칙 적용 대상이다. 이번에는 SQL 파일도 만들거나 실행하지 않고 설계만 제출한다. 운영 catalog 확인 전 migration의 grant/search_path/role context를 확정하지 않는다. trigger의 함수는 사용자 입력 SQL/외부 HTTP를 실행하지 않고, 원문 매칭 증거는 키/토큰/전화 등 불필요한 민감 내용을 배제한다.

### 4.4 실제 수정 대상 (기존 원문 증거에 연결)

| 파일/현재 위치 | 승인 후 최소 변경 |
|---|---|
| [추정] 신규 pending 정책 SQL → 승인 후 migrations로 편입 | 공통 evaluator, 공개 NEW행 trigger; 기존 RLS 재설계 없음. 근거 E25~E26,E36~E45,E66~E78. |
| [추정] 신규 src/lib/jobPostingPolicy.ts / crawler/job_posting_policy.py | 같은 evaluator RPC 위임·오류/버전 처리. 근거 E05~E08,E30. |
| [추정] crawler/job_quality.py:862~904,933~935; crawl_topcv.py:1185,1740,2093,2137 | 금융 검사 통합, 신규/기존 같은 판정, 최종 쓰기 재검사. 기존 admin_hidden 보호 유지(E17). |
| [추정] crawler/crawl_facebook.py:812,1069~1072,1172~1232 | 사전/최종 정책 판정 일치, 전체 본문을 title로 넘기지 않고 역할 필드 구분(E20~E23). |
| [추정] src/context/JobsContext.tsx:77~85,158~170 | 등록·수정 사전 검사, 최종 DB 반환 상태 검증, 비공개 row를 공개 jobs 배열에 넣지 않음(E30~E33,E91). |
| [추정] src/pages/AdminDashboard.tsx:190~223; components/admin/AdminJobs.tsx:34~36; lib/adminOperations.ts:68~75 | 관리자 등록/재공개 판정 사유·증거 표시. 최종 권위는 DB trigger(E24~E26,E39~E40). |
| [추정] src/pages/PostJob.tsx:209~249; ManageGuestJob.tsx:107~118,150~158 | 세 등록 모드·게스트 수정/재공개에 동일 검사. review 비공개 저장 선택 시 성공 안내/이동 분기(E27~E29,E34~E38). |
| [추정] src/lib/fetchJobsData.ts:24~32,78~81; lib/jobQualityFilter.ts:39~49 | 공개 목록에 active AND NOT hidden을 명시, 관리자/소유자 RLS 예외가 공개 화면에 섞이지 않도록 함; 기존 금융 사후필터 중복 정책을 공통 판정으로 대체. 관리 목록 fetchEmployerJobs는 유지(E44~E47,E92). |
| [추정] scripts/research/bn_prepare_chotot_insert.py:120~140; bn_apply_chotot_rest.py:55~72; register_job.mjs:16~28 | 유입 사전 검사 + DB 강제 검사. dry-run 준비기는 네트워크 호출 가능 여부를 명시하고 “오프라인 정책 통과”를 주장하지 않음(E61~E65,E70~E71). |
| [추정] docs/ops/2026-10-08_chotot_publish_dryrun.sql:20; supabase/pending/20261008100000_publish_chotot_jobs.sql:24~50 | eligible에 공통 정책 allow 추가, 공개 직전 재평가, 새 기대 건수 승인. 지도 집계 함수는 정책 판정기를 별도로 만들지 않음(E66~E69). |
| [추정] 신규 scripts/ops/audit-job-policy.mjs / .github/workflows/job-policy-audit.yml | 읽기 전용 운영 감시·위반 ID/reason/version 보고. STATUS/검증 장치 수정 없이 독립 실행. 기존 audit 로그는 관리자 UUID 필수(E83)라 서비스 롤/anon 검토 이벤트를 임의 UUID로 기록하지 않음. |

**[추정/선택 범위]** reclassify_db.py/reclassify_node.mjs는 DB trigger로 공개 위반 차단을 받도록 하되, 사전 검사/명확한 실패 처리의 도구별 변경은 실제 운영 사용 여부 확인 후 결정(E72~E73). `scripts/crawl.mjs`의 jobs 테이블은 local_jobs trigger 범위 밖이므로 운영 뷰/trigger 관계부터 확인(E74). 두 테이블을 통합하거나 korea_jobs를 섞는 안은 제안하지 않는다.

## 5. 허용·차단 테스트 계획 (완료 증거 ⑤)

**[추정/계획 — 전부 미실행]** 새 제안 fixture `tests/fixtures/job-posting-policy.json`에 원문·입력 필드·decision·reason_code·policy_version·출처 경로를 넣고, 공통 SQL 함수의 결과를 기준으로 Python/TS wrapper 및 최종 DB trigger를 함께 검증한다. 실제 개인 연락처/관리 토큰을 fixture에 저장하지 않는다. 모의 RPC 결과만으로 SQL 정책을 검증했다고 보고하지 않는다.

| 케이스 | 입력/검증 | 기대·승인 조건 |
|---|---|---|
| [추정] #4750 유형 B2B | 전문 영업 역할 + 기업 고객 외근/대리점 관리가 **주요 업무로 명시**. 제목에 sales만 있는 매장판매 대조군 포함. | exclude + B2B 증거. **#4750 실제 원문은 미확보**: 권한 있는 읽기 조회 후 비식별 실제 fixture 추가 전 “#4750 회귀 통과” 금지(E04). |
| [추정] 금융·대출·추심 | Tư vấn vay / tín dụng / Nhân Viên Thu Hồi Nợ, Nhân viên nhắc nợ, Field Collection Specialist; 관리직 일반 본문 채권관리 대조. | 금융/추심 exclude, 일반 채권관리 allow. 기존 Python/TS 차이 회귀 포함(E05~E08,E81~E82). |
| [추정] 고소득 전문 영업 | 인센티브 중심 역할 + 월 VND 20,000,000 이상. 19,999,999/20,000,000 경계, 기본급 vs 총수입, “최대”, 범위값, 월 미명시 포함. | ③ 정의 승인 후 exclude 기대값 확정. 그 전 review/결정 보류; 금액 기준 임의 테스트 통과 금지(E01,E77). |
| [추정] 정상 매장·마트 판매 | Nhân viên bán hàng cửa hàng / thu ngân siêu thị, 매장 고정근무. sales/kinh doanh 표현만 포함, 고정급 높은 생활직 대조. | allow. 출장 단어 하나나 높은 급여만으로 제외하지 않음. |
| [추정] 정상 생산·QC | Công nhân sản xuất / Nhân viên QC, 생산라인·품질검사, 금융 단어 없는 일반직. 고급직명 때문에 category가 다른 대조 포함. | allow; category 자체 차단 금지(E18~E19). |
| [추정] 직접 REST 우회 | anon guest insert, employer insert/update(active=true), service-role insert/update, admin_create_job, admin_set_job_hidden(false), update_guest_job(p_active=true). | NEW 공개 위반을 DB trigger가 거절. 실제 role별·권한별 격리 DB로 검사(E25~E26,E36~E43,E70~E71). |
| [추정] 공개 유지 내용 변경 | 처음 정상 공개 후 title/company/description/salary/category를 위반 내용으로 UPDATE. active/hidden은 안 바꿈. | 공개 수정 거절·기존 정상 내용 보존(E32~E38,E72~E73). |
| [추정] 정책 변경 후 재유입 | v1 정상→승인된 v2 제외. 새 source/id, 같은 source 재처리, stale client decision/version, admin_hidden=true 재수집. | v2 최종 함수 기준 공개 금지, stale 결정 거절, 수동 숨김 유지(E15~E17). |
| [추정] 기존/신규 판정 일치 | 같은 원문을 신규 INSERT payload와 기존 공개 row 재평가에 각각 넣음. raw 필드 mapping/description 정리 여부도 비교. | decision/reason/version 일치. DB raw/구조화값이 달라진 원인은 따로 기록; 기존 row 자동 숨김 안 함. |
| [추정] 공개 목록 격리 | anon/seeker/employer-owner/admin 각각 active/hidden 4조합. 관리 목록의 소유 비공개 조회 유지. SSR/search/map/recommend/sitemap/DB alert까지 확인. | 공개 화면에 active=true AND hidden=false만. owner/admin 예외가 관리 화면에만 적용(E44~E60,E84,E92). |
| [추정] 장애·필수 증거 누락 | evaluator RPC 오류, 본문 미확보, salary 의미 미확인, 정책 버전 미지원, 위조 allow payload. | 공개 금지·실패/검토 상태 표시. 정상 0건과 조회 실패를 구분(E80). |
| [추정] Chợ Tốt 일괄 공개·rollback | 후보에 위반 1행 넣고 기대 건수/최종 UPDATE 동작 검사. 숨김/active=false 저장·만료 변경 대조. | 위반 공개 차단·트랜잭션 보존, 정상 비공개 관리 허용(E66~E67,E75). |

**[추정/계획 파일]**
- `supabase/tests/job_posting_policy.pglite.test.mjs`(신규): 실제 proposed evaluator/trigger, 권한 bypass/최종 NEW행/롤백/경계 fixture. SQL regex·Unicode 정규화·월/통화 정의도 검증.
- `src/lib/jobPostingPolicy.test.ts`(신규), `src/lib/fetchJobsData.test.ts`(기존 E80): wrapper 오류·판정 응답, 로그인 공개 목록 격리, source mapping.
- `crawler/test_job_posting_policy.py`(신규), `crawler/test_job_quality.py`, `crawler/test_facebook_quality.py`: 공통 fixture 결과, 저장 직전 호출·정책 변경 재유입, 기존 허용 회귀. E81~E82는 현재 파일 내용만 읽었고 이번 실행 결과가 아님.
- `scripts/e2e-job-posting-policy.mjs`(신규): 로컬/격리 Supabase role·RPC·REST 통합 검사. Production 합성 공고를 만들지 않는다(E94~E95).
- 승인 후 명시 실행: `npx tsc --noEmit`, `npm test`, `npm run build`, 위 Python/SQL/격리 E2E, 실제 로컬 375px/desktop 공개·등록·관리 화면. npm test는 Python/SQL을 자동 포함하지 않으므로 별도 명령 결과 첨부(E79). 정책 fixture·함수 버전이 바뀌면 관련 기대값/허용 대조군을 같은 PR에서 갱신하고 하나라도 실패하면 정책 완료 금지.

## 6. Production 적용 영향·위험·운영 감시 (완료 증거 ⑥)

| 구체적 영향/위험 | 근거 | 승인 후 대응 |
|---|---|---|
| [추정] 기존 공개 위반 공고는 trigger 설치만으로 자동 숨김되지 않음 | 공개 UPDATE/INSERT 경계 E15~E17,E25~E26,E40 | 설치 전·후 공개 row 읽기 전용 전수 재평가. 위반 ID·원문 증거·reason을 검토 목록으로 제시, 실제 숨김은 별도 사용자 승인. |
| [추정] 기존 공개 위반은 일반 수정/급여/urgent 변경도 막힐 수 있음 | E32~E33,E43, EmployerDashboard 현재 urgent 호출 | 읽기 dry-run으로 영향 row 식별, 명확한 오류 메시지/수정 지침. trigger disable을 해결책으로 쓰지 않음. |
| [추정] 일반 판매/QC 오차단 | classifier는 공개 판단 아닌 분류 E18~E19; 기존 채권관리 회귀 E82 | 역할+주요 업무의 복합 증거, allow 대조 fixture 필수, ambiguity는 임의 exclude 금지. |
| [추정] ③ 급여 의미 오류 | 정책 문서 E01, 급여 구조 E77 | 사용자 정의 전 활성화 금지. 최대치/통화/기간/인센티브 의미를 증거로 남김. |
| [추정] 재공개 대상·기대 건수 변경, 빈 화면 | Chợ Tốt 공개 조건 E66~E69; empty/error 테스트 E80 | 새 dry-run 및 대상 승인. 연락처·위치 gate와 정책을 각각 출력. 기존 코드 0건 빈 상태 유지. |
| [추정] Python/TS network RPC 의존 추가 | 현재 Python 로컬판정 E05~E07, TS 동기 판정 E08 | 함수 timeout/오류는 공개 차단, 운영 정상 수집률·RPC 지연 관찰. DB 함수는 외부 HTTP 호출 없음. |
| [추정] trigger 비용·배포 잠금/SQL 호환성 | 실제 모든 공개 INSERT/UPDATE E15~E17,E25~E26,E37~E43 | 격리 부하/DB 버전·정규화 기능 확인, 짧은 DDL transaction·rollback 초안 사전 승인. raw text 길이 한도와 전체 본문 검사 범위는 승인 후 결정. |
| [추정] 구형 writer/owner가 우회 | register_job E70~E71, jobs 별도 E74, migration workflow E88 | live 카탈로그·Edge/VPS·외부 쓰기 인벤토리 조회. owner-level trigger 변경 권한은 운영 통제 필요; 완벽 차단 주장 금지. |
| [추정] 비공개 등록 성공이 공개 목록에 즉시 섞임 | JobsContext 반환 row를 setJobs에 넣음 E91 | review 저장 승인 시 active/hidden 반환 검사와 성공 안내까지 동시 수정. 공개 목록 hidden 조건 추가(E46), 관리 목록 보존(E92). |

**[추정/운영 감시 설계]** 신규 `scripts/ops/audit-job-policy.mjs`는 서버/Actions의 안전한 키 참조로 **읽기 전용** `active=true AND admin_hidden=false` row와 공통 evaluator를 비교한다. 반환 evidence·policy_version·대상 ID·검사 시각만 보고하며, 공고/원문/연락처 전체를 PC에 내보내지 않는다. 신규 `.github/workflows/job-policy-audit.yml`는 독립 정기 검사로 위반/검사 실패 때 실패 상태와 관리자 검토 필요를 남긴다. 기존 protected STATUS·scripts/status·status-*에는 의존성 수정/라벨 추가를 하지 않는다.

**[추정/사용자 결정 필요]** 실제 알림 채널(예: GitHub 실패 알림 또는 별도 운영 채널), 수신 설정·검사 주기·review 보존 장소는 승인해야 한다. 이번에는 어떤 채널로도 메시지를 보내거나 automation을 만들지 않는다. 기존 `admin_audit_logs.admin_user_id NOT NULL`(E83)에 service-role/guest의 가짜 관리자 UUID를 넣지 않는다. 새 private 검토 저장소를 선택하면 별도 DDL/RLS 승인 대상이다.

**[추정/운영 절차]** 위반 발견 → ID/최종 NEW 원문 증거와 규칙 버전 알림 → 사용자/관리자 검토 → 승인된 내용 수정 또는 숨김 → 같은 evaluator로 재검증 → 공개 검색·지도·추천·SSR/알림에 실제 남아 있지 않은지 확인. 자동으로 기존 공고를 숨기거나 재공개하는 monitor는 제안하지 않는다. 검사 실패도 “위반 0건”으로 기록하지 않는다.

## 7. 승인 후 구현·검증 순서 (완료 증거 ⑦)

1. **[추정/필수 선행]** GitHub master 최신 SHA와 STATUS 생성 시각 재고정, 실제 canonical local remote/worktree·미커밋 변경 확인. 승인 Preview 미보존 여부도 확인. 현재 도구에서 로컬 상태는 알 수 없으므로 clean·동일 tree라고 주장하지 않는다.
2. **[추정/필수 선행]** 읽기 전용 운영 DB 카탈로그(pg_trigger/pg_proc/pg_policies/GRANT), 배포된 Edge Function 목록, VPS SHA/crontab·실행파일, jobs/local_jobs 관계와 외부 SQL writer 확인. #4750의 title/description/salary 등 필요한 원문을 권한 있는 읽기로 확보·비식별 fixture화. 조사 원문이 없으면 실사례 회귀 테스트 완료 금지.
3. **[추정/사용자 승인]** ③ 금액 의미와 인센티브 기준, B2B 주요 업무/혼합 역할 경계, 애매한 공고 skip vs 비공개 검토, DB trigger DDL 및 관리자 예외 없음, 기존 공개 위반 처리 범위, 알림 채널을 결정한다. 이번 조사 요청은 구현·DDL·Production 적용 승인으로 해석하지 않는다.
4. **[추정/구현]** 새 브랜치에서 공통 fixture·SQL evaluator/trigger의 격리 테스트부터 구현. pending SQL diff·dry-run·rollback을 먼저 제시. 단일 판정 결과를 Python/TS/수집 준비기·관리자/기업/게스트 입력에 연결하고 공개 fetch hidden 조건을 수정. 기존 분류기/인증/위치 설계 유지.
5. **[추정/검증]** 타입·npm·build + Python·SQL·role E2E + 로컬 실제 화면. 각 로그에 SHA/명령/결과를 붙여 IMPLEMENTED와 VERIFIED 구분. fixture 실패·경로 누락·원문 없음·live 우회 미확인 중 하나라도 남으면 정책 VERIFIED/완료 금지.
6. **[추정/검토 제출]** GitHub commit/push·원격 diff·local clean 확인, HANDOFF/WORK_LOG는 이후 실제 코드/설정 변경 단계에서 규정대로 갱신. 구현 PR과 DDL은 사용자 검토·승인 후에만 다음 상태. 이번 보고서는 문서 한 파일 예외라 다른 문서를 덮어쓰지 않는다.
7. **[추정/Production 적용 — 별도 승인]** 승인된 DDL 및 배포 순서(공통 DB 함수 먼저, wrapper/trigger 호환성 점검, 앱 배포)를 격리환경에서 rehearsed 후 실행. 기존 공개 위반은 읽기 보고 후 별도 데이터 처리 승인. 최종 운영 role별 등록/재공개·검색·지도·추천·SSR·알림 증거와 신규 재유입 검사, GitHub SHA·배포 SHA 확인 뒤에만 DEPLOYED. 정상 허용 fixture도 반드시 확인.
8. **[추정/운영]** 위 독립 감시·관리자 검토·재검증 루프 도입. 정책 변경 PR은 version·관련 허용/차단 테스트 동시 갱신, 전체 유입/공개 인벤토리 재검토, 새 우회 경로 증거가 없으면 정책 완료로 승격하지 않는다.

## 8. 제출 상태와 완료 금지 게이트

| 필수 7개 증거 | 보고서 위치 | 현재 상태 |
|---|---|---|
| [직접 확인] ① 전체 유입·공개 경로 목록 | §2 + 소스 조회 목록/증거 E11~E96 | 저장소 경로 조사 기록 제출. 운영 외부 경로 미확인은 명시. |
| [직접 확인] ② 경로별 적용 여부 | §2, §2.1 | 금융만/없음/공개 조회 예외 구분. |
| [직접 확인] ③ 누락 원인·코드 위치 | §3 + 원문 E05~E08,E25~E43,E66~E78 | 코드 근거 있음; 실제 재유입 사건은 미조회. |
| [추정/설계] ④ 우회 가능성·차단 설계 | §4 | 단일 DB evaluator/trigger 제안. live DB 확인·DDL 승인 전 미구현. |
| [추정/계획] ⑤ 허용·차단 테스트 계획 | §5 | 전부 미실행. #4750 원문·③ 정의가 필수 선행. |
| [추정/영향 분석] ⑥ Production 영향·위험 | §6 | 영향 row 수·실제 운영 동작은 미조회. |
| [추정/계획] ⑦ 승인 후 구현·검증 순서 | §7 | 승인 대기 설계. |

**[직접 확인]** 보고서/PR 제출과 정책 완료는 구분한다. **정책 상태: IMPLEMENTED 아님 / VERIFIED 아님 / APPROVED 아님 / DEPLOYED 아님.** 이번 작업의 테스트·build·로컬 화면·운영 DB·실제 신규 수집 실행 결과는 없다. E 증거는 코드 원문 조회이지 기능 실행 결과가 아니다. live 외부 경로·③ 기준·#4750 원문을 확보하기 전 전체 정책 완료를 선언하지 않는다.

## 9. 증거 원문 (고정 SHA, 각 발췌 3~10줄)

아래 링크는 실제 조회한 GitHub 소스에 고정 SHA를 넣은 링크다. STATUS만 status 브랜치 응답의 파일 blob SHA를 별도로 기록했다: `f052a37fea3658b368e2f0ef4857cc1175a910bb`; 시각은 E03에 있다. 문서 항목의 정책/사건은 [기존 기록], 코드 원문은 [직접 확인]으로 분류한다.

### E01-12 [기존 기록] PROJECT_STATUS.md:12

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/PROJECT_STATUS.md#L12) — 12~18줄

```

**Việc gần Bạn = "근처 일자리"** — 생활밀착형, 도보/단거리 통근 가능한 현장직 중심 서비스.

### 크롤러/공고 게재 시 제외 대상

| 카테고리 | 이유 | 상태 |
|---|---|---|
```

### E01-19 [기존 기록] PROJECT_STATUS.md:19

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/PROJECT_STATUS.md#L19) — 19~24줄

```
| 채권추심 / 대출 / 금융 여신 영업 | 모토 불일치 + 사기 위험 (`thu hồi công nợ`, `công nợ`, `đòi nợ`, `vay tiền`, `tín dụng` 등) | 필터 적용 완료 (PR #4) |
| B2B 영업직 (외근·대리점 관리형, 출장 위주) | "근처"라는 서비스 성격과 안 맞음, 전문 커리어직에 가까움 | 판단 기준으로 채택, 크롤러 반영 필요 |
| 고소득 전문 영업직 (월 20백만동 이상 인센티브 중심) | 생활형 일자리보다 전문 커리어에 가까움 | 판단 기준으로 채택, 크롤러 반영 필요 |

새로운 카테고리 필터를 만들 때는 이 표에 먼저 추가하고, 그다음 크롤러/classifier 코드에 반영할 것. 판단 애매한 공고는 저장하지 말고 skip.

```

### E02 [기존 기록] CHATGPT_HANDOFF.md:20

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/CHATGPT_HANDOFF.md#L20) — 20~26줄

```
## 2. 다음 할 일 3개

1. 사용자 지시 대기: Goong 계정 활성화 후 상세주소 14건 VietMap·Goong 비교(결과 저장·지도 표시 없이 비교표만). Goong 약관(좌표 저장·타사 지도 표시) 서면 확인 전에는 실사용 금지.
2. 사용자 지시 대기: B2B 영업직 게재 제외 필터(PROJECT_STATUS.md 기준, 크롤러 미반영) 구현 여부.
3. 작업을 시작하면 먼저 STATUS.md와 이 파일을 대조하고, 다른 점만 보고한다.

## 3. 필수 규칙
```

### E03 [기존 기록] STATUS.md:5

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/status/STATUS.md#L5) — 5~10줄

```

- 생성 시각: **2026-10-11 12:12 (VN)**
- 기준 커밋: `9157ced` (Merge pull request #45 from KHOAILANG0926/docs/handoff-final-1011)
- 실행 기록: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38113983017
- 검증 스크립트 지문(SHA-256): `ee61465a031d5604`

```

### E04 [기존 기록] STATUS.md:72

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/status/STATUS.md#L72) — 72~79줄

```
## 7. 최근 관리자·자동 작업 기록 (admin_audit_logs)

| 시각 | 작업 | 대상 |
|---|---|---|
| 2026-10-11 10:44 (VN) | job.hide | job 4750 |
| 2026-10-11 10:44 (VN) | location_candidate.revoke | job 4750 |
| 2026-10-11 10:37 (VN) | location_candidate.revoke | job 4720 |
| 2026-10-11 10:37 (VN) | location_candidate.revoke | job 4702 |
```

### E05 [직접 확인] crawler/job_quality.py:213

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/job_quality.py#L213) — 213~218줄

```
EXCLUDED_LOAN_FINANCE_RE = re.compile(
    r"vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung"
    r"|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit"
    r"|mirae asset|shinhan finance|vpbank finance|loan",
    re.IGNORECASE,
)
```

### E06 [직접 확인] crawler/job_quality.py:236

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/job_quality.py#L236) — 236~242줄

```
_DEBT_COLLECTION_TITLE_STEM_PAIRS: tuple[tuple[str, tuple[str, ...], int, str], ...] = (
    ("thu hoi", ("no", "cong no", "khoan vay"), 15, "thu_hoi+no/cong_no/khoan_vay"),
    ("xu ly", ("no xau", "no"), 15, "xu_ly+no/no_xau"),
    ("nhac", ("no", "thanh toan"), 15, "nhac+no/thanh_toan"),
    ("doi", ("no",), 2, "doi+no"),
    ("field", ("collection",), 15, "field+collection"),
)
```

### E07 [직접 확인] crawler/job_quality.py:884

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/job_quality.py#L884) — 884~891줄

```
    for target_name, target_value in (("title", title), ("category", category)):
        normalized = ascii_key(str(target_value or ""))
        found = _find_debt_collection_stem_match(normalized)
        if found:
            rule_name, matched_text = found
            return True, f"exclude target={target_name} rule={rule_name} matched={matched_text!r}"

    return False, "allow checked_targets=title,category,company+description(loan/finance only) no rule matched"
```

### E08-39 [직접 확인] src/lib/jobQualityFilter.ts:39

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/jobQualityFilter.ts#L39) — 39~45줄

```
const EXCLUDED_MONEY_JOB_RE =
  /thu hoi no|doi no|thu no\b|vay tien|cho vay|ho tro vay|tu van vay|tin dung|the tin dung|tai chinh tieu dung|cong ty tai chinh|fe credit|home credit|mcredit|mirae asset|shinhan finance|vpbank finance|debt collector|debt collection|loan/i

export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'>): boolean {
  const text = normalizeForPolicy(`${job.title} ${job.company} ${job.description}`)
  return EXCLUDED_MONEY_JOB_RE.test(text)
}
```

### E08-46 [직접 확인] src/lib/jobQualityFilter.ts:46

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/jobQualityFilter.ts#L46) — 46~49줄

```

export function isPublicJobAllowed(job: Job): boolean {
  return !hasExcludedMoneyTerms(job)
}
```

### E09 [직접 확인] crawler/job_quality.py:780

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/job_quality.py#L780) — 780~785줄

```
def gate_auto_publish(
    has_location_or_region: bool,
    has_application_path_: bool,
) -> tuple[bool, str]:
    """Decide whether a freshly-scraped job may be auto-published (active=true)
    or must be held for manual review (active=false, never silently dropped).
```

### E10 [직접 확인] crawler/job_quality.py:812

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/job_quality.py#L812) — 812~818줄

```
    Returns (should_publish, reason) — reason은 'ok' / 'no_address_text' /
    'no_application_path' 중 하나."""
    if not has_location_or_region:
        return False, "no_address_text"
    if not has_application_path_:
        return False, "no_application_path"
    return True, "ok"
```

### E11 [직접 확인] crawler/crawl_topcv.py:1184

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L1184) — 1184~1188줄

```
    has_location_or_region = len(resolved_locations) > 0 or len(job_recruitment_regions) > 0
    should_publish, gate_reason = gate_auto_publish(
        has_location_or_region=has_location_or_region,
        has_application_path_=has_app_path,
    )
```

### E12 [직접 확인] crawler/crawl_topcv.py:1250

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L1250) — 1250~1256줄

```
    job["recruitment_regions"] = job_recruitment_regions or None
    quality_errors = validate_job_payload(job, source="vieclam24h", today=TODAY)
    if quality_errors:
        job["_skip"] = True
        job["_skip_reason"] = "quality_invalid"
        job["_skip_detail"] = ", ".join(quality_errors)
        return job
```

### E13 [직접 확인] crawler/crawl_topcv.py:1740

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L1740) — 1740~1747줄

```
    should_publish, gate_reason = gate_auto_publish(
        has_location_or_region=has_location_or_region,
        has_application_path_=has_app_path,
    )

    job = {
        "title": title,
        "company": company,
```

### E14 [직접 확인] crawler/crawl_topcv.py:1778

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L1778) — 1778~1785줄

```
    job["recruitment_regions"] = job_recruitment_regions or None
    quality_errors = validate_job_payload(job, source="vietnamworks", today=TODAY)
    if quality_errors:
        job["_skip"] = True
        job["_skip_reason"] = "quality_invalid"
        job["_skip_detail"] = ", ".join(quality_errors)
        return job

```

### E15 [직접 확인] crawler/crawl_topcv.py:2092

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L2092) — 2092~2101줄

```
    if existing is None:
        insert_payload = {k: v for k, v in job.items() if not k.startswith("_")}
        insert_payload["last_verified_at"] = datetime.now(timezone.utc).isoformat()
        if verify_write:
            # 최종 강제 — 호출자가 job["active"]/job["admin_hidden"]에 무엇을
            # 넣었든(심지어 True/False로 덮어썼든) 여기서 항상 이 3개 값으로
            # 확정한다. origin도 명시적으로 'crawler'를 재확정해, 검증 저장이
            # 절대 기업 직접 등록 공고로 오인되지 않게 한다.
            insert_payload["active"] = False
            insert_payload["admin_hidden"] = True
```

### E16 [직접 확인] crawler/crawl_topcv.py:2100

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L2100) — 2100~2108줄

```
            insert_payload["active"] = False
            insert_payload["admin_hidden"] = True
            insert_payload["origin"] = "crawler"
        result = supabase.table("local_jobs").insert(insert_payload).execute()
        row = (result.data or [{}])[0]
        job_id = row.get("id")
        action = "inserted"
    else:
        field_updates = compute_job_updates(existing, job)
```

### E17-2134 [직접 확인] crawler/crawl_topcv.py:2134

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L2134) — 2134~2140줄

```
        if existing.get("admin_hidden") is True:
            print(f"    🔒 id={existing['id']}: admin_hidden=True(관리자 수동 숨김/검증 격리) — active/게이트 사유 갱신 보류(기존 값 유지)")
        elif existing.get("origin") == "crawler" and not had_transient:
            field_updates["active"] = job["active"]
            field_updates["publish_gate_reason"] = job["publish_gate_reason"]
            field_updates["crawler_version"] = job["crawler_version"]
            field_updates["last_verified_at"] = datetime.now(timezone.utc).isoformat()
```

### E17-2141 [직접 확인] crawler/crawl_topcv.py:2141

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L2141) — 2141~2144줄

```
        elif existing.get("origin") == "crawler" and had_transient:
            print(f"    ⚠️  id={existing['id']}: geocode 일시 오류 — 공개 상태/게이트 사유 갱신 보류(기존 값 유지)")
        if field_updates:
            supabase.table("local_jobs").update(field_updates).eq("id", existing["id"]).execute()
```

### E18 [직접 확인] crawler/classifier.py:318

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/classifier.py#L318) — 318~325줄

```
    # 블랙리스트: 제목+회사 기준 (본문은 false positive 위험)
    if _SENIOR_PROFESSIONAL_TITLES_RE.search(title_co):
        return "other"

    # 2026-10-06 사용자 지시: 제목 우선. 제목만으로 직무 신호가 잡히면 회사명·본문으로 뒤집지 않는다.
    by_title = _classify_title(_norm_fields(title))
    if by_title:
        return by_title
```

### E19 [직접 확인] crawler/classifier.py:293

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/classifier.py#L293) — 293~301줄

```
    if _GIAO_DUC_GIANG_DAY.search(title_norm): return "giao_duc_giang_day"
    if _CNTT_KY_THUAT.search(title_norm):      return "cntt_ky_thuat"
    if _THIET_KE.search(title_norm):           return "thiet_ke"
    if _Y_TE_DIEU_DUONG.search(title_norm):    return "y_te_dieu_duong"
    if _TRUYEN_THONG.search(title_norm):       return "truyen_thong"
    if _OFFICE.search(title_norm):    return "office"
    if _RETAIL.search(title_norm):    return "retail"
    if _FACTORY.search(title_norm):   return "factory"
    return None
```

### E20 [직접 확인] crawler/crawl_facebook.py:808

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_facebook.py#L808) — 808~817줄

```
    if not text or not is_job_post(text):
        return "not_job", ["구인 키워드 없음"], None
    if is_self_promotion(text):
        return "self_promo", ["구직자 자기홍보"], None
    if has_excluded_money_terms(text):
        return "money", ["대출/채권추심"], None
    if is_office_job(text):
        return "office", ["사무/전문직(수집 범위 밖)"], None
    if not full_text_ok:
        return "truncated", ["본문 전문 미확보('더 보기' 펼치기 실패)"], None
```

### E21 [직접 확인] crawler/crawl_facebook.py:1064

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_facebook.py#L1064) — 1064~1073줄

```
        "description": f"[source:facebook] {text}",
        "category": category,
        "subcategory": subcategory,
        "posted_at": TODAY,
        "urgent": "tuyển gấp" in text.lower() or "gấp" in text.lower(),
        "application_deadline": extract_deadline(text),
        "active": True,
        "origin": "crawler",
        "admin_hidden": False,
        "image_url": images[0] if images else None,
```

### E22 [직접 확인] crawler/crawl_facebook.py:1226

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_facebook.py#L1226) — 1226~1234줄

```
    def to_db_payload(job: dict) -> dict:
        return {k: v for k, v in job.items() if k in db_columns}

    saved: list[dict] = []
    for i in range(0, len(new_jobs), 50):
        batch = [to_db_payload(j) for j in new_jobs[i:i+50]]
        res = supabase.table("local_jobs").insert(batch).execute()
        saved.extend({"id": r.get("id"), "title": r.get("title")} for r in (res.data or []))
        print(f"  ✅ 저장: {len(saved)}/{len(new_jobs)}개")
```

### E23 [직접 확인] crawler/crawl_facebook.py:1172

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_facebook.py#L1172) — 1172~1180줄

```
    # 잘린 본문·필수 정보 누락은 어떤 경로로 들어와도 저장하지 않는다(최종 방어선)
    complete = []
    for job in jobs:
        problems = missing_required(job)
        if problems:
            print(f"  ⛔ 저장 제외({', '.join(problems)}): {job.get('title', '')[:60]}")
        else:
            complete.append(job)
    jobs = complete
```

### E24 [직접 확인] src/pages/AdminDashboard.tsx:190

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/AdminDashboard.tsx#L190) — 190~199줄

```
  async function handleSave() {
    if (!jobForm.title || !jobForm.company) {
      setParseError('Vui lòng điền ít nhất Tiêu đề và Công ty.')
      return
    }
    setSaving(true)
    setParseError('')
    const { error } = await supabase.rpc('admin_create_job', { payload: {
      title: jobForm.title,
      company: jobForm.company,
```

### E25 [직접 확인] supabase/migrations/0009_admin_operations.sql:305

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L305) — 305~314줄

```
declare caller uuid := public.require_admin(); result public.local_jobs;
begin
  if nullif(trim(payload ->> 'title'), '') is null or nullif(trim(payload ->> 'company'), '') is null then
    raise exception 'title and company are required';
  end if;
  insert into public.local_jobs (
    title, company, category, salary, location, hours, employer_phone,
    application_deadline, urgent, description, posted_at, lat, lng, image_url,
    active, work_period, work_days, education, preference, num_hires,
    company_verified, company_founded_year, hire_count, origin, admin_hidden
```

### E26 [직접 확인] supabase/migrations/0009_admin_operations.sql:319

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L319) — 319~327줄

```
    coalesce((payload ->> 'urgent')::boolean, false), coalesce(payload ->> 'description', ''),
    coalesce(nullif(payload ->> 'posted_at', '')::date, current_date),
    nullif(payload ->> 'lat', '')::double precision, nullif(payload ->> 'lng', '')::double precision,
    payload ->> 'image_url', true, payload ->> 'work_period', payload ->> 'work_days',
    payload ->> 'education', payload ->> 'preference', payload ->> 'num_hires',
    coalesce((payload ->> 'company_verified')::boolean, false),
    nullif(payload ->> 'company_founded_year', '')::integer,
    nullif(payload ->> 'hire_count', '')::integer, 'admin', false
  ) returning * into result;
```

### E27 [직접 확인] src/pages/PostJob.tsx:209

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/PostJob.tsx#L209) — 209~218줄

```
        const deadline = form.applicationDeadline.trim() || addDays(14)
        const job = await addPostedJob({ ...baseFields, applicationDeadline: deadline, employerId: newUserId })
        await savePin(job.id, null)
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
        })
        resetForm()
        setImageFile(null)
        setImagePreview(null)
        setEmailSuccess({ jobId: job.id, email })
```

### E28 [직접 확인] src/pages/PostJob.tsx:224

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/PostJob.tsx#L224) — 224~231줄

```
        const token = crypto.randomUUID()
        const deadline = form.applicationDeadline.trim() || addDays(7)
        const job = await addPostedJob({
          ...baseFields,
          applicationDeadline: deadline,
          employerId: undefined,
          guestManageToken: token,
        })
```

### E29 [직접 확인] src/pages/PostJob.tsx:241

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/PostJob.tsx#L241) — 241~249줄

```
      } else {
        // 기존 기업 계정 경로 — 그대로 유지.
        const deadline = form.applicationDeadline.trim() || addDays(14)
        const job = await addPostedJob({ ...baseFields, applicationDeadline: deadline, employerId: user?.id })
        await savePin(job.id, null)
        resetForm()
        setImageFile(null)
        setImagePreview(null)
        navigate(`/viec-lam/${job.id}`, { replace: true })
```

### E30 [직접 확인] src/context/JobsContext.tsx:77

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/context/JobsContext.tsx#L77) — 77~85줄

```
  const addPostedJob = useCallback(async (draft: Omit<Job, 'id' | 'postedAt'> & { guestManageToken?: string }) => {
    const draftForPolicy = ensureJobFields({
      ...draft,
      id: 'draft',
      postedAt: new Date().toISOString().slice(0, 10),
    } as Job)
    if (!isPublicJobAllowed(draftForPolicy)) {
      throw new Error('Tin tuyển dụng liên quan đến vay tiền hoặc thu hồi công nợ không phù hợp với Viecganban.')
    }
```

### E31 [직접 확인] src/context/JobsContext.tsx:105

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/context/JobsContext.tsx#L105) — 105~113줄

```
        employer_id: draft.employerId ?? null,
        // 2026-09-20 "등록 없이 빠르게 게시" — 비로그인 게스트 등록은
        // employer_id 없이 guest_manage_token만으로 온다(local_jobs_guest_insert
        // RLS가 이 조합만 anon INSERT를 허용). 로그인 경로는 항상 undefined.
        guest_manage_token: draft.guestManageToken ?? null,
        origin: 'employer',
        admin_hidden: false,
        active: true,
        posted_at: new Date().toISOString().slice(0, 10),
```

### E32 [직접 확인] src/context/JobsContext.tsx:158

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/context/JobsContext.tsx#L158) — 158~165줄

```
    await supabase.from('local_jobs').update({
      title: patch.title,
      company: patch.company,
      category: patch.category,
      salary: patch.salary,
      location: patch.location,
      hours: patch.hours,
      description: patch.description,
```

### E33 [직접 확인] src/context/JobsContext.tsx:166

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/context/JobsContext.tsx#L166) — 166~170줄

```
      employer_phone: patch.employerPhone,
      application_deadline: patch.applicationDeadline,
      urgent: patch.urgent,
    }).eq('id', rawId)
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j))
```

### E34 [직접 확인] src/pages/ManageGuestJob.tsx:107

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/ManageGuestJob.tsx#L107) — 107~116줄

```
    const { data, error: rpcError } = await supabase.rpc('update_guest_job', {
      p_job_id: Number(id),
      p_token: token,
      p_title: draft.title.trim(),
      p_company: draft.company.trim(),
      p_salary: draft.salary.trim(),
      p_location: draft.location.trim(),
      p_hours: draft.hours.trim() || null,
      p_employer_phone: draft.employer_phone.trim(),
      p_application_deadline: draft.application_deadline || null,
```

### E35 [직접 확인] src/pages/ManageGuestJob.tsx:150

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/ManageGuestJob.tsx#L150) — 150~158줄

```
    const { data, error: rpcError } = await supabase.rpc('update_guest_job', {
      p_job_id: Number(id),
      p_token: token,
      p_active: !job.active,
    })
    setSaving(false)
    const row = (data as GuestJobRow[] | null)?.[0]
    if (rpcError || !row) { setError('Không thể cập nhật trạng thái. Vui lòng thử lại.'); return }
    setJob((prev) => (prev ? { ...prev, active: row.active } : prev))
```

### E36 [직접 확인] supabase/migrations/20260920120000_local_jobs_guest_posting.sql:43

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260920120000_local_jobs_guest_posting.sql#L43) — 43~51줄

```
create policy local_jobs_guest_insert on public.local_jobs
  for insert to anon
  with check (
    employer_id is null
    and guest_manage_token is not null
    and length(guest_manage_token) >= 20
  );

grant insert on public.local_jobs to anon;
```

### E37 [직접 확인] supabase/migrations/20260920120000_local_jobs_guest_posting.sql:118

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260920120000_local_jobs_guest_posting.sql#L118) — 118~127줄

```
  update public.local_jobs l
  set
    title = coalesce(p_title, l.title),
    company = coalesce(p_company, l.company),
    salary = coalesce(p_salary, l.salary),
    location = coalesce(p_location, l.location),
    hours = coalesce(p_hours, l.hours),
    employer_phone = coalesce(p_employer_phone, l.employer_phone),
    application_deadline = coalesce(p_application_deadline, l.application_deadline),
    description = coalesce(p_description, l.description),
```

### E38-128 [직접 확인] supabase/migrations/20260920120000_local_jobs_guest_posting.sql:128

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260920120000_local_jobs_guest_posting.sql#L128) — 128~134줄

```
    active = coalesce(p_active, l.active)
  where l.id = p_job_id
    and l.employer_id is null
    and l.guest_manage_token is not null
    and l.guest_manage_token = p_token
  returning l.id, l.title, l.active;
end;
```

### E38-135 [직접 확인] supabase/migrations/20260920120000_local_jobs_guest_posting.sql:135

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260920120000_local_jobs_guest_posting.sql#L135) — 135~138줄

```
$$;

revoke all on function public.update_guest_job(bigint, text, text, text, text, text, text, text, date, text, boolean) from public;
grant execute on function public.update_guest_job(bigint, text, text, text, text, text, text, text, date, text, boolean) to anon, authenticated;
```

### E39 [직접 확인] src/lib/adminOperations.ts:68

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/adminOperations.ts#L68) — 68~75줄

```
export async function setJobHidden(jobId: number, hidden: boolean, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_set_job_hidden', {
    target_job_id: jobId,
    hidden,
    reason,
  })
  if (error) throw new Error(error.message)
}
```

### E40 [직접 확인] supabase/migrations/0009_admin_operations.sql:223

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L223) — 223~231줄

```
declare caller uuid := public.require_admin(); result public.local_jobs;
begin
  update public.local_jobs set admin_hidden = hidden
  where id = target_job_id returning * into result;
  if result.id is null then raise exception 'job not found'; end if;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (caller, case when hidden then 'job.hide' else 'job.unhide' end,
    'job', target_job_id::text, jsonb_build_object('reason', coalesce(reason, '')));
  return result;
```

### E41 [직접 확인] supabase/migrations/0009_admin_operations.sql:383

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L383) — 383~390줄

```
create policy local_jobs_employer_insert on public.local_jobs for insert to authenticated
  with check (
    public.is_account_active(auth.uid())
    and employer_id = auth.uid()
    and origin = 'employer'
    and admin_hidden = false
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  );
```

### E42 [직접 확인] supabase/migrations/0009_admin_operations.sql:391

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L391) — 391~399줄

```
create policy local_jobs_employer_update on public.local_jobs for update to authenticated
  using (
    public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  )
  with check (
    public.is_account_active(auth.uid()) and employer_id = auth.uid()
    and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer')
  );
```

### E43 [직접 확인] supabase/migrations/0009_admin_operations.sql:406

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L406) — 406~415줄

```
-- origin/admin_hidden are intentionally absent: employers cannot alter operating ownership/visibility.
revoke all privileges on table public.local_jobs from anon, authenticated;
grant select on table public.local_jobs to anon, authenticated;
grant insert, delete on table public.local_jobs to authenticated;
grant update (
  title, company, category, salary, location, hours, employer_phone,
  application_deadline, urgent, description, lat, lng, active, image_url,
  work_period, work_days, education, preference, num_hires, company_verified,
  company_founded_year, hire_count, images
) on table public.local_jobs to authenticated;
```

### E44 [직접 확인] supabase/migrations/0019_local_jobs_public_select_rls_fix.sql:65

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0019_local_jobs_public_select_rls_fix.sql#L65) — 65~70줄

```
as $$
  select
    (p_active is true and p_admin_hidden is false)
    or (auth.uid() is not null and p_employer_id is not null and p_employer_id = auth.uid())
    or public.is_admin();
$$;
```

### E45 [직접 확인] supabase/migrations/0019_local_jobs_public_select_rls_fix.sql:78

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0019_local_jobs_public_select_rls_fix.sql#L78) — 78~86줄

```
drop policy if exists local_jobs_public_select on public.local_jobs;
create policy local_jobs_public_select on public.local_jobs
  for select to anon, authenticated
  using (public.local_job_is_visible(active, admin_hidden, employer_id));

drop policy if exists job_work_locations_public_select on public.job_work_locations;
create policy job_work_locations_public_select on public.job_work_locations
  for select to anon, authenticated
  using (
```

### E46 [직접 확인] src/lib/fetchJobsData.ts:24

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/fetchJobsData.ts#L24) — 24~32줄

```
  for (let page = 0; page < 20; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await client
      .from('local_jobs')
      .select('id,title,company,category,subcategory,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,created_at,image_url,source,work_period,job_duration,gender_requirement,age_requirement,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,labor_contract_pledge,social_insurance_pledge,images,recruitment_regions,shift_type,shuttle_bus,dormitory,meal_provided,immediate_start,recruitment_type,work_schedule,weekend_work,salary_basis,salary_note,employment_type,rotating_shifts,benefit_tags,required_documents,contact_zalo,salary_period,language_requirement,business_trip')
      .eq('active', true)
      .order('posted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
```

### E47 [직접 확인] src/lib/fetchJobsData.ts:78

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/fetchJobsData.ts#L78) — 78~86줄

```
  const fetched = applyLocationApprovals(
    rows.map((r) => rowToJob(r, locationsByJobId.get(r.id as number))),
    approvals,
  ).filter(isPublicJobAllowed)

  return {
    jobsError: fetchFailed,
    jobs: fetchFailed ? [] : fetched,
  }
```

### E48 [직접 확인] src/entry-server.tsx:23

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/entry-server.tsx#L23) — 23~31줄

```
/** api/ssr.js(순수 컴파일된 JS, Vercel Node 런타임에서 TS 소스를 직접
 *  import 안 함)가 쓰는 단 하나의 진입점 — 데이터 fetch부터 렌더까지 이
 *  파일(빌드되면 dist/server/entry-server.js) 안에서 전부 끝낸다. */
export async function loadJobsForSSR(): Promise<{ jobs: Job[]; jobsError: boolean }> {
  return fetchJobsData(supabaseServer)
}

// api/ssr.js·api/sitemap.xml.js가 TS 소스를 직접 못 읽으므로 재수출.
export { isRepresentativeCandidate, normalizeSearchQuery, buildRepresentativePageCopy, stripSourceTags, toPublicJobs }
```

### E49 [직접 확인] api/ssr.js:112

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/ssr.js#L112) — 112~119줄

```
  let jobs, jobsError
  try {
    ;({ jobs, jobsError } = await loadJobsForSSR())
  } catch (e) {
    console.error('api/ssr: loadJobsForSSR threw', e)
    jobsError = true
    jobs = []
  }
```

### E50 [직접 확인] api/sitemap.xml.js:24

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/sitemap.xml.js#L24) — 24~31줄

```
export default async function handler(req, res) {
  let jobs = []
  try {
    const result = await loadJobsForSSR()
    if (!result.jobsError) jobs = result.jobs.filter(isRealJob)
  } catch (e) {
    console.error('api/sitemap.xml: loadJobsForSSR threw', e)
  }
```

### E51 [직접 확인] src/pages/JobSearchPage.tsx:31

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/JobSearchPage.tsx#L31) — 31~38줄

```
 * 링크 등 기존 딥링크와 어휘를 맞추기 위함).
 */
export function JobSearchPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()
  const [searchParams, setSearchParams] = useSearchParams()
```

### E52 [직접 확인] src/pages/Home.tsx:162

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/Home.tsx#L162) — 162~170줄

```
/* ── Main component ──────────────────────────────────────────────── */

export function Home() {
  const { jobs, jobsError } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

```

### E53 [직접 확인] src/components/MapView.tsx:25

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/components/MapView.tsx#L25) — 25~32줄

```
const JobLocationMap = lazy(() => import('./JobLocationMap'))

export default function MapView() {
  const { jobs } = useJobs()
  const { user } = useAuth()

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [nearAddressLabel, setNearAddressLabel] = useState<string | null>(null)
```

### E54 [직접 확인] src/components/home/HomeMapExplorer.tsx:40

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/components/home/HomeMapExplorer.tsx#L40) — 40~47줄

```
}

export default function HomeMapExplorer() {
  const { jobs, mapAcceptanceJobs, loading, jobsError } = useJobs()
  const mapJobs = useMemo(() => [...jobs, ...mapAcceptanceJobs], [jobs, mapAcceptanceJobs])
  const [origin, setOrigin] = useState<Origin>(() => regionOrigin(DEFAULT_REGION) ?? { kind: 'region', label: 'Hà Nội', point: { lat: 21.0285, lng: 105.8542 } })
  const [filters, setFilters] = useState<HomeMapFilterState>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
```

### E55 [직접 확인] src/context/JobsContext.tsx:63

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/context/JobsContext.tsx#L63) — 63~72줄

```
  useEffect(() => {
    // The five reviewed records exist only in an explicitly opened Preview/dev
    // acceptance session. No DB write, SSR injection, or Production import.
    if (!(import.meta.env.DEV || import.meta.env.VITE_MAP_ACCEPTANCE === 'true')) return
    if (new URLSearchParams(window.location.search).get('mapAcceptance') !== '1') return
    let active = true
    void import('../data/previewMapAcceptanceJobs').then(({ previewMapAcceptanceJobs }) => {
      if (active) setAcceptanceJobs(previewMapAcceptanceJobs)
    })
    return () => { active = false }
```

### E56 [직접 확인] src/pages/jobsMenu/MatchedJobsPage.tsx:19

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/jobsMenu/MatchedJobsPage.tsx#L19) — 19~27줄

```
 * 흐름을 그대로 유지한다.
 */
export default function MatchedJobsPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  if (user?.role === 'seeker') {
    return (
      <div className="page jobs-menu-page">
        <header className="page-header">
```

### E57 [직접 확인] src/pages/jobsMenu/MatchedJobsPage.tsx:48

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/jobsMenu/MatchedJobsPage.tsx#L48) — 48~54줄

```
        <p className="page-header__lead">
          <Link to="/dang-nhap?redirect=/viec-lam/phu-hop">Đăng nhập</Link> để lưu điều kiện vào tài khoản và nhận thông báo khi có tin mới phù hợp.
        </p>
      )}
      <RecommendSection jobs={jobs} />
    </div>
  )
```

### E58 [직접 확인] src/lib/recommendStorage.ts:464

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/recommendStorage.ts#L464) — 464~473줄

```
export function matchJobs(jobs: Job[], prefs: RecommendPrefs): JobMatch[] {
  if (!hasPrefs(prefs)) return []
  // Khu vực là bộ lọc cứng khi người dùng đã chọn — không được trộn công việc
  // ngoài khu vực đã chọn vào kết quả chỉ vì điểm số ở các tiêu chí khác cao
  // hơn ngưỡng (scoreJob() vẫn cộng điểm baseline cho khu vực không khớp, nhưng
  // ở đây phải loại hẳn trước khi xét ngưỡng điểm).
  const candidates = prefs.regionId
    ? jobs.filter((j) => jobMatchesRegion(j.location, prefs.regionId as JobRegionId, j.workLocations))
    : jobs
  return candidates
```

### E59 [직접 확인] supabase/migrations/20260927090000_job_alerts.sql:623

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260927090000_job_alerts.sql#L623) — 623~632줄

```
create or replace function public.job_alert_job_is_open(p_job public.local_jobs)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select p_job.active is true
    and p_job.admin_hidden is false
    and (p_job.application_deadline is null
         or p_job.application_deadline >= (now() at time zone 'Asia/Ho_Chi_Minh')::date);
```

### E60 [직접 확인] supabase/migrations/20260927090000_job_alerts.sql:691

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260927090000_job_alerts.sql#L691) — 691~700줄

```
    for j in
      select lj.* from public.local_jobs lj
      where public.job_alert_job_is_open(lj)
        and lj.created_at >= greatest(pref.alerts_since, now() - interval '14 days')
        and not exists (
          select 1 from public.job_alert_notifications x
          where x.preference_id = pref.id and x.job_id = lj.id
        )
    loop
      res := public.job_alert_evaluate(pref, j, home.lat::double precision, home.lng::double precision);
```

### E61 [직접 확인] scripts/research/bn_prepare_chotot_insert.py:120

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_prepare_chotot_insert.py#L120) — 120~128줄

```
        category = classifier.classify(title, company, desc_body)
        subcategory = classifier.classify_subcategory(category, title, company, desc_body)
        category, subcategory = classifier.map_to_new_taxonomy(category, subcategory)
        salary = q.normalize_salary(r["salary"]) if r["salary"] else ""
        smin, smax, scur, sper, sneg = parse_salary(salary)
        gate_ok, gate_reason = q.gate_auto_publish(True, bool(q.normalize_whitespace(r["contact"])))
        job = {
            "title": title, "company": company, "category": category, "subcategory": subcategory,
            "salary": salary or None, "location": "Bắc Ninh", "employer_phone": r["contact"],
```

### E62 [직접 확인] scripts/research/bn_prepare_chotot_insert.py:129

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_prepare_chotot_insert.py#L129) — 129~138줄

```
            "urgent": q.detect_explicit_urgent_hiring(title, description), "description": description,
            "posted_at": posted_date(src.get("lt")), "active": gate_ok, "origin": "crawler", "admin_hidden": True,
            "source": f"{SOURCE_TAG}:{r['id']}", "source_url": None, "crawler_version": VERSION,
            "publish_gate_reason": gate_reason, "recruitment_regions": ["Bắc Ninh"],
            "recruitment_type": "agency" if agency else None,
            "salary_min": smin, "salary_max": smax, "salary_currency": scur, "salary_period": sper, "salary_negotiable": sneg,
            "_loc": {"raw_address": r["address"], "industrial_park": r["kcn"] or None,
                     # exact_text = 번지·도로 등 구체적 주소 텍스트가 있을 때만. 행정구역·KCN 이름만이면 region_only
                     "address_accuracy": "exact_text" if STREET_RE.search(r["address"]) else "region_only"},
            "_key": f"{q.ascii_key(company)}|{q.ascii_key(title)}|{r['contact']}",
```

### E63 [직접 확인] scripts/research/bn_prepare_chotot_insert.py:140

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_prepare_chotot_insert.py#L140) — 140~148줄

```
        errs = q.validate_job_payload(job, source=SOURCE_TAG, today=TODAY)
        if job["_key"] in seen:
            errs.append("batch duplicate (company+title+phone)")
        seen.add(job["_key"])
        if errs:
            errors.append({"id": r["id"], "title": title[:50], "errors": errs})
        jobs.append(job)

    return jobs, errors
```

### E64 [직접 확인] scripts/research/bn_apply_chotot_rest.py:53

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_apply_chotot_rest.py#L53) — 53~57줄

```
def main() -> None:
    n = int(sys.argv[1])
    jobs, errors = prep.build_jobs()
    if errors:
        raise SystemExit(f"validation errors, stop: {errors}")
```

### E65 [직접 확인] scripts/research/bn_apply_chotot_rest.py:70

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_apply_chotot_rest.py#L70) — 70~79줄

```
        row = {k: v for k, v in j.items() if not k.startswith("_")}
        try:
            created = post("local_jobs", row)
            loc = j["_loc"]
            post("job_work_locations", {
                "job_id": created["id"], "raw_address": loc["raw_address"], "country": "VN", "province": "Bắc Ninh",
                "geocode_status": "pending", "location_verified": False, "sort_order": 0,
                "address_accuracy": loc["address_accuracy"], "coordinate_accuracy": "unresolved",
                "matched_recruitment_regions": ["Bắc Ninh"], "resolved_province": "Bắc Ninh", "industrial_park": loc["industrial_park"],
            })
```

### E66 [직접 확인] supabase/pending/20261008100000_publish_chotot_jobs.sql:27

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/pending/20261008100000_publish_chotot_jobs.sql#L27) — 27~34줄

```
  where j.source like 'chotot:%'
    and j.id between 4685 and 4784
    and j.admin_hidden
    and j.active
    and length(btrim(coalesce(j.company, ''))) >= 2
    and length(regexp_replace(coalesce(j.employer_phone, ''), '\D', '', 'g')) >= 8
    and (j.application_deadline is null
         or j.application_deadline > (now() at time zone 'Asia/Ho_Chi_Minh')::date);
```

### E67 [직접 확인] supabase/pending/20261008100000_publish_chotot_jobs.sql:45

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/pending/20261008100000_publish_chotot_jobs.sql#L45) — 45~51줄

```
  if v_targets <> v_expected then
    raise exception '공개 대상 건수 불일치: 기대 %, 실제 %. 중단(변경 없음)', v_expected, v_targets;
  end if;

  update public.local_jobs set admin_hidden = false
  where id in (select id from _chotot_publish_targets) and admin_hidden;
  get diagnostics v_updated = row_count;
```

### E68 [직접 확인] docs/ops/2026-10-08_chotot_publish_dryrun.sql:18

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/docs/ops/2026-10-08_chotot_publish_dryrun.sql#L18) — 18~25줄

```
  where j.source like 'chotot:%' and j.id between 4685 and 4784
),
e as (select t.*, (admin_hidden and active and company_ok and phone_ok and deadline_ok) as eligible from t)
select
  count(*)                                                            as chotot_rows,
  count(*) filter (where eligible)                                    as publish_targets,
  count(*) filter (where not eligible and not admin_hidden)           as already_public,
  count(*) filter (where admin_hidden and not active)                 as excluded_inactive,
```

### E69 [직접 확인] scripts/ops/chotot_publish_classify.ts:17

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/ops/chotot_publish_classify.ts#L17) — 17~24줄

```
export function classifyRows(rows: DryRunRow[]) {
  const out = { total: rows.length, targets: 0, approvedPin: 0, kcnMap: 0, kcnMapWithGate: 0, kcnMapCallOnly: 0, callOnly: 0, agencyTargets: 0, ids: { approvedPin: [] as number[], kcnMap: [] as number[], callOnly: [] as number[], agency: [] as number[] } }
  for (const r of rows) {
    if (!r.eligible) continue
    out.targets++
    if (r.agency) { out.agencyTargets++; out.ids.agency.push(r.id) }
    if (r.approved_pin) { out.approvedPin++; out.ids.approvedPin.push(r.id); continue }
    const park = findIndustrialPark(r.location, ...(r.wl ?? []).flatMap((l) => [l.industrial_park, l.raw_address]))
```

### E70 [직접 확인] register_job.mjs:11

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/register_job.mjs#L11) — 11~16줄

```
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const jobsFile = process.argv[2]
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'))

for (const job of jobs) {
```

### E71 [직접 확인] register_job.mjs:25

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/register_job.mjs#L25) — 25~31줄

```
    delete job._imagePath
  }
  job.posted_at = new Date().toISOString()
  const { data, error } = await supabase.from('local_jobs').insert(job).select('id, title')
  if (error) console.log('error:', error.message)
  else console.log('등록완료 ID:', data[0].id, '-', data[0].title)
}
```

### E72 [직접 확인] crawler/reclassify_db.py:104

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/reclassify_db.py#L104) — 104~112줄

```
    # 배치 UPDATE (50개씩)
    updated = 0
    for i in range(0, len(updates), 50):
        batch = updates[i:i+50]
        for u in batch:
            supabase.table("local_jobs") \
                .update({"category": u["new_cat"], "subcategory": u["new_sub"]}) \
                .eq("id", u["id"]) \
                .execute()
```

### E73-194 [직접 확인] crawler/reclassify_node.mjs:194

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/reclassify_node.mjs#L194) — 194~200줄

```
let done = 0
for (const u of updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/local_jobs?id=eq.${u.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
```

### E73-201 [직접 확인] crawler/reclassify_node.mjs:201

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/reclassify_node.mjs#L201) — 201~204줄

```
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category: u.new }),
  })
```

### E74-245 [직접 확인] scripts/crawl.mjs:245

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/crawl.mjs#L245) — 245~251줄

```
    .from('jobs')
    .select('title, company')
    .gte('posted_at', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))

  const existingKeys = new Set((existing || []).map(r => `${r.title}__${r.company}`.toLowerCase()))
  const newJobs = unique.filter(j => !existingKeys.has(`${j.title}__${j.company}`.toLowerCase()))

```

### E74-252 [직접 확인] scripts/crawl.mjs:252

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/crawl.mjs#L252) — 252~255줄

```
  if (!newJobs.length) { console.log('  ℹ️  모두 중복'); return }

  for (let i = 0; i < newJobs.length; i += 50) {
    const { error } = await supabase.from('jobs').insert(newJobs.slice(i, i + 50))
```

### E75 [직접 확인] supabase/migrations/0011_deactivate_expired_jobs_fn.sql:15

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0011_deactivate_expired_jobs_fn.sql#L15) — 15~23줄

```
  affected integer;
begin
  update public.local_jobs
  set active = false
  where active = true
    and application_deadline is not null
    and application_deadline < now()::date;

  get diagnostics affected = row_count;
```

### E76 [직접 확인] supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql:139

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql#L139) — 139~148줄

```
  if not public.can_manage_local_job(p_job_id, p_token) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.local_jobs set
    shift_type = p_shift_type,
    shuttle_bus = p_shuttle_bus,
    dormitory = p_dormitory,
    meal_provided = p_meal_provided,
    recruitment_type = p_recruitment_type,
    immediate_start = p_immediate_start,
```

### E77 [직접 확인] supabase/migrations/20260923070000_local_jobs_salary_structured.sql:7

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260923070000_local_jobs_salary_structured.sql#L7) — 7~16줄

```
alter table public.local_jobs
  add column if not exists salary_min integer,
  add column if not exists salary_max integer,
  add column if not exists salary_currency text,
  add column if not exists salary_period text,
  add column if not exists salary_negotiable boolean;

alter table public.local_jobs
  add constraint local_jobs_salary_period_check
  check (salary_period is null or salary_period in ('hour', 'day', 'month', 'other'));
```

### E78 [직접 확인] supabase/migrations/20260905015705_publish_gate_reason_add_no_verified_coordinate.sql:28

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260905015705_publish_gate_reason_add_no_verified_coordinate.sql#L28) — 28~33줄

```
alter table public.local_jobs
  drop constraint if exists local_jobs_publish_gate_reason_check;

alter table public.local_jobs
  add constraint local_jobs_publish_gate_reason_check
  check (publish_gate_reason in ('ok', 'no_address_text', 'no_verified_coordinate', 'no_application_path') or publish_gate_reason is null);
```

### E79 [직접 확인] scripts/run-tests.mjs:13

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/run-tests.mjs#L13) — 13~22줄

```
const roots = [join(import.meta.dirname, '..', 'src'), join(import.meta.dirname, '..', 'api')]

function findTests(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...findTests(full))
    else if (name.endsWith('.test.ts')) out.push(full)
  }
  return out
```

### E80 [직접 확인] src/lib/fetchJobsData.test.ts:15

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/fetchJobsData.test.ts#L15) — 15~22줄

```
const empty = await fetchJobsData(fakeClient({ data: [], error: null }))
assert(empty.jobs.length === 0 && !empty.jobsError, '공개 공고 0건이면 jobs는 빈 배열 — 예시·가짜 공고로 채우지 않는다')
assert(!JSON.stringify(empty.jobs).includes('demo-'), 'no demo-* jobs')

const failed = await fetchJobsData(fakeClient({ data: null, error: { message: 'boom' } }))
assert(failed.jobs.length === 0 && failed.jobsError, '조회 실패는 0건과 구분(jobsError=true)')

console.log('fetchJobsData tests: all assertions passed')
```

### E81-364 [직접 확인] crawler/test_job_quality.py:364

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/test_job_quality.py#L364) — 364~370줄

```
    _assert_money_excluded(
        _minimal_job("Chuyên viên xử lý nợ", "Công việc văn phòng thông thường."),
        "title='Chuyên viên xử lý nợ' (no 'xấu' suffix) must still be excluded",
    )
    _assert_money_excluded(
        _minimal_job("Nhân viên nhắc nợ", "Công việc văn phòng thông thường."),
        "title='Nhân viên nhắc nợ' must still be excluded",
```

### E81-371 [직접 확인] crawler/test_job_quality.py:371

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/test_job_quality.py#L371) — 371~374줄

```
    )
    _assert_money_excluded(
        _minimal_job("Field Collection Specialist", "Công việc văn phòng thông thường."),
        "title='Field Collection Specialist' must still be excluded",
```

### E82 [직접 확인] crawler/test_job_quality.py:219

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/test_job_quality.py#L219) — 219~228줄

```
    normal_sales_job_with_debt_mention_in_body = {
        **good_job,
        "title": "NV Kinh Doanh Tôn Thép",
        "description": "[source:vieclam24h] Theo dõi đơn hàng, quản lý và thu hồi công nợ theo quy định công ty.",
        "category": "quan_ly_ban_hang",
    }
    errors_for_normal_sales = validate_job_payload(normal_sales_job_with_debt_mention_in_body, today="2026-08-22")
    assert_true(
        not any(e.startswith("excluded money/debt collection job") for e in errors_for_normal_sales),
        f"title has no debt-collection stems and 'công nợ' is only in the body -> must NOT be excluded, got errors={errors_for_normal_sales!r}",
```

### E83 [직접 확인] supabase/migrations/0009_admin_operations.sql:156

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/0009_admin_operations.sql#L156) — 156~164줄

```
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### E84 [직접 확인] src/pages/EmployerDashboard.tsx:348

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/EmployerDashboard.tsx#L348) — 348~356줄

```
                      </p>
                      {/* 사용자 지시(2026-09-04): "기업은 본인의 공개·비공개·관리자
                          숨김 공고를 볼 수 있고" — 이제 목록 자체는 셋 다 가져오므로
                          (RLS migration 0019), 어떤 상태인지 최소한으로 구분해 보여준다. */}
                      {job.adminHidden ? (
                        <p className="edb-job-item__status edb-job-item__status--hidden">🚫 Bị quản trị viên ẩn</p>
                      ) : job.active === false ? (
                        <p className="edb-job-item__status edb-job-item__status--pending">⏳ Chưa công khai</p>
                      ) : null}
```

### E85 [직접 확인] .github/workflows/pr-checks.yml:24

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/.github/workflows/pr-checks.yml#L24) — 24~33줄

```
      - run: npm ci
      - name: 타입 검사
        run: npx tsc --noEmit
      - name: 테스트
        run: npm test
      - name: 빌드
        run: npm run build
      - name: STATUS 생성기 점검 (가짜 응답으로 끝까지 실행)
        run: |
          node scripts/status/status-lib.test.mjs
```

### E86 [직접 확인] .github/workflows/crawl.yml:23

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/.github/workflows/crawl.yml#L23) — 23~27줄

```
      - name: 크롤링 실행
        env:
          SUPABASE_URL: https://edhuesdnuxlbcfephutq.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python crawler/crawl_topcv.py
```

### E87 [직접 확인] crawler/run_daily.sh:40

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/run_daily.sh#L40) — 40~47줄

```
elif grep -q '^FB_C_USER=.' .env && grep -q '^FB_XS=.' .env; then
  # 2026-09-28: 그룹당 최대 ~250초(스크롤/시간 상한) x 8 + 그룹 간 60~120초 대기 ≈ 47분이라 45m→60m
  run_crawler "Facebook" "${FACEBOOK_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_facebook.py
else
  echo "[$(date -Is)] Skipping Facebook crawler: FB_C_USER/FB_XS not configured"
fi

run_crawler "Vieclam24h" "${TOPCV_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_topcv.py
```

### E88 [직접 확인] .github/workflows/admin-operations.yml:76

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/.github/workflows/admin-operations.yml#L76) — 76~84줄

```
        shell: bash
        run: |
          set -euo pipefail
          psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 \
            -f supabase/migrations/0009_admin_operations.sql \
            > "$RUNNER_TEMP/0009_admin_operations.log"

      - name: Run isolated operating RLS and E2E
        run: node scripts/e2e-admin-operations.mjs
```

### E89 [직접 확인] scripts/research/bn_build_chotot_csv.mjs:60

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_build_chotot_csv.mjs#L60) — 60~67줄

```
  let reason = ''
  if (!r.ok) reason = '상세 데이터 없음(재방문 필요)'
  else if (!r.ph) reason = '연락처 없음'
  else if (!poster || PLACEHOLDER.test(poster)) reason = '회사명 없음'
  else if (looksPerson) reason = '회사명 없음(개인명·상호 불명)'
  else if (OLD_BG.test(text)) reason = '옛 박장 지역'
  else if (otherProvinceWorksite(text)) reason = '다른 성 근무지(박닌 아님·다성 모집)'
  else if (agency && !work && !kcnInText) reason = '대행사·근무 회사/KCN 근거 없음'
```

### E90 [직접 확인] src/pages/JobDetail.tsx:83

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/JobDetail.tsx#L83) — 83~91줄

```
  const [employerJobCount, setEmployerJobCount] = useState<number | undefined>(undefined)
  // 2026-10-07 상세 개편(알바몬 구조): 탭은 내용을 숨기지 않고 해당 구역으로 스크롤만 한다.
  // 구역 순서·키는 data/jobSchema.ts(JOB_SECTIONS)가 정본. 활성 탭은 스크롤 위치(IntersectionObserver)로 갱신.
  const [activeTab, setActiveTab] = useState<JobTabKey>('conditions')
  const [tabsTop, setTabsTop] = useState(0)

  const job = useMemo(() => jobs.find((j) => j.id === id) ?? mapAcceptanceJobs.find((j) => j.id === id), [jobs, mapAcceptanceJobs, id])
  // 목록의 '연락 방법 보기'(#lien-he)로 들어오면 로그인 없이 연락 안내로 바로 이동(2026-09-30)
  const location = useLocation()
```

### E91 [직접 확인] src/context/JobsContext.tsx:142

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/context/JobsContext.tsx#L142) — 142~148줄

```
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Đăng tin thất bại')
    const job = rowToJob(data)
    setJobs((prev) => [job, ...prev])
    return job
  }, [])
```

### E92 [직접 확인] src/lib/jobRows.ts:204

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/jobRows.ts#L204) — 204~213줄

```
  // 렌더링) — 실패 시 예외를 던져 호출자가 "공고 없음"과 "불러오기 실패"를
  // 구분하게 한다. job_work_locations 조회는 기존 설계대로 best-effort로
  // 남겨둔다(부가 정보일 뿐, 실패해도 공고 목록 자체를 막지 않음).
  const { data, error } = await client
    .from('local_jobs')
    .select(EMPLOYER_JOBS_SELECT_COLUMNS)
    .eq('employer_id', employerId)
    .order('posted_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
```

### E93 [직접 확인] supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql:98

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql#L98) — 98~107줄

```
  if p_lat is null or p_lng is null then
    return true;  -- 핀 해제
  end if;
  -- 베트남 범위 밖 좌표 거부(오입력 방지)
  if p_lat < 8 or p_lat > 24 or p_lng < 102 or p_lng > 110 then
    raise exception 'coordinates out of range' using errcode = '22023';
  end if;

  insert into public.job_work_locations (
    job_id, raw_address, lat, lng, geocode_status, geocode_source, location_verified,
```

### E94 [직접 확인] scripts/e2e-admin-operations.mjs:85

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/e2e-admin-operations.mjs#L85) — 85~94줄

```

  const inserted = await employerA.client.from('local_jobs').insert({
    title: marker, company: marker, category: 'office', salary: '', location: '', description: marker,
    employer_id: employerA.id, origin: 'employer', admin_hidden: false, active: true,
  }).select().single()
  if (inserted.error) throw inserted.error
  const jobId = inserted.data.id; jobs.push(jobId)
  const activeOwnUpdate = await employerA.client.from('local_jobs').update({ salary: marker }).eq('id', jobId).select('id').single()
  if (activeOwnUpdate.error) throw activeOwnUpdate.error
  const second = await employerA.client.from('local_jobs').insert({
```

### E95 [직접 확인] scripts/e2e-p0-foundation.mjs:63

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/e2e-p0-foundation.mjs#L63) — 63~72줄

```
  const { data: job, error: jobError } = await employerA.client
    .from('local_jobs')
    .insert({
      title: marker,
      company: marker,
      category: 'office',
      location: 'E2E',
      employer_id: employerA.id,
      origin: 'employer',
      admin_hidden: false,
```

### E96 [직접 확인] src/pages/jobsMenu/SuggestedJobsPage.tsx:91

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/pages/jobsMenu/SuggestedJobsPage.tsx#L91) — 91~98줄

```
    if (!hasSignal) return []
    // 지역 조건이 맞춤 공고에서 이미 설정돼 있으면 그 지역 밖 공고는 아예
    // 제외한다(다른 근거 점수가 높다는 이유로 지역 밖 공고를 섞지 않음).
    let candidates = prefs.regionId
      ? jobs.filter((j) => jobMatchesRegion(j.location, prefs.regionId as JobRegionId, j.workLocations))
      : jobs
    const savedOrAppliedIds = new Set([...savedJobs, ...appliedJobs].map((j) => j.id))
    candidates = candidates.filter((j) => !savedOrAppliedIds.has(j.id))
```

### E97 [직접 확인] crawler/crawl_topcv.py:2645

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L2645) — 2645~2652줄

```
    else:
        if not args.confirm_full_crawl:
            raise SystemExit(
                "인자 없이 실행하면 전체 운영 크롤이 곧바로 시작되지 않습니다 — 실수로 대량 수집되는 "
                "사고를 막기 위한 안전장치입니다. 전체 크롤을 실행하려면 --confirm-full-crawl을 명시적으로 "
                "지정하세요(검증만 하려면 --dry-run-urls를 쓰세요). 중단합니다."
            )
        return "full_crawl"
```

### E98 [직접 확인] crawler/job_quality.py:929

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/job_quality.py#L929) — 929~937줄

```
    if category not in VALID_CATEGORIES:
        errors.append(f"invalid category: {category}")
    if not has_source_tag(description, source):
        errors.append(f"missing source tag: {source}")
    money_excluded, money_log_line = classify_money_job_exclusion(title, company, description, category)
    if money_excluded:
        errors.append(f"excluded money/debt collection job ({money_log_line})")
    if job.get("origin") != "crawler":
        errors.append("origin must be crawler")
```

### E99 [직접 확인] src/lib/supabaseServer.ts:1

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/src/lib/supabaseServer.ts#L1) — 1~6줄

```
import { createClient } from '@supabase/supabase-js'

/** SSR(서버리스 함수)에서만 쓰는 클라이언트 — src/lib/supabase.ts와 같은
 *  프로젝트/anon key(공개용, RLS로 접근 제어됨)를 쓰지만, persistSession/
 *  autoRefreshToken은 브라우저 storage(localStorage)에 의존하므로 Node
 *  런타임에서는 꺼둔다. */
```

### E100 [직접 확인] scripts/research/bn_apply_chotot_rest.py:30

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/research/bn_apply_chotot_rest.py#L30) — 30~35줄

```
    vals = {}
    for line in (ROOT / "crawler" / ".env").read_text("utf-8").splitlines():
        for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            if line.startswith(k + "="):
                vals[k] = line.split("=", 1)[1].strip().strip("'\"")
    return vals["SUPABASE_URL"].rstrip("/"), vals["SUPABASE_SERVICE_ROLE_KEY"]
```

### E101 [직접 확인] crawler/crawl_topcv.py:46

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_topcv.py#L46) — 46~50줄

```
)
from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
```

### E102 [직접 확인] crawler/crawl_facebook.py:28

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/crawler/crawl_facebook.py#L28) — 28~33줄

```
from job_quality import ascii_key, has_excluded_money_terms
from classifier import classify, classify_subcategory, map_to_new_taxonomy
from supabase import create_client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
```

### E103 [직접 확인] api/admin-users.js:30

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/admin-users.js#L30) — 30~38줄

```
    async banUser(userId, suspended) {
      const attributes = suspended ? { ban_duration: '876000h' } : { ban_duration: 'none' }
      const { error } = await adminClient.auth.admin.updateUserById(userId, attributes)
      if (error) throw error
    },
    async setDatabaseStatus(userId, status, reason) {
      const { error } = await callerClient.rpc('admin_set_account_status', {
        target_user_id: userId,
        next_status: status,
```

### E104 [직접 확인] api/admin-vietmap.js:34

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/admin-vietmap.js#L34) — 34~43줄

```
    },
    async takeUsage(day, limit) {
      const { data, error } = await admin.rpc('vietmap_usage_take', { p_day: day, p_limit: limit })
      if (error) throw new Error('usage_counter_unavailable')
      const row = Array.isArray(data) ? data[0] : data
      if (!row || typeof row.ok !== 'boolean') throw new Error('usage_counter_unavailable')
      return { ok: row.ok, used: Number(row.used) }
    },
    async readUsage(day) {
      const { data, error } = await admin.from('vietmap_usage_daily').select('calls').eq('day', day).maybeSingle()
```

### E105 [직접 확인] api/ward-area.js:16

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/ward-area.js#L16) — 16~23줄

```
  const admin = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    async readCache() {
      const { data, error } = await admin.from('research_artifacts').select('payload').eq('kind', CACHE_KIND).eq('name', CACHE_NAME).maybeSingle()
      if (error) throw new Error('cache_unavailable')
      return data?.payload ?? null
    },
  }
```

### E106 [직접 확인] scripts/e2e-admin-operations.mjs:106

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/e2e-admin-operations.mjs#L106) — 106~113줄

```
  const hidden = await systemAdmin.client.rpc('admin_set_job_hidden', { target_job_id: jobId, hidden: true, reason: marker })
  if (hidden.error) throw hidden.error
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  assert.equal((await anon.from('local_jobs').select('id').eq('id', jobId)).data?.length, 0)
  assert.equal((await seeker.client.from('local_jobs').select('id').eq('id', jobId)).data?.length, 0)
  assert.equal((await systemAdmin.client.from('local_jobs').select('id').eq('id', jobId)).data?.length, 1)
  await systemAdmin.client.rpc('admin_set_job_hidden', { target_job_id: jobId, hidden: false, reason: marker })
  assert.equal((await anon.from('local_jobs').select('id').eq('id', jobId)).data?.length, 1)
```

### E107 [직접 확인] supabase/migrations/20260923060000_deactivate_expired_jobs_cron.sql:9

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/supabase/migrations/20260923060000_deactivate_expired_jobs_cron.sql#L9) — 9~13줄

```
select cron.schedule(
  'deactivate-expired-jobs-daily',
  '0 17 * * *',
  $$select public.deactivate_expired_jobs()$$
);
```

### E108 [직접 확인] api/zalo-token.js:10

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/zalo-token.js#L10) — 10~18줄

```
  const { code, code_verifier, app_id } = req.body ?? {}
  const appSecret = process.env.ZALO_APP_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const relayUrl = process.env.ZALO_RELAY_URL
  const relayKey = process.env.ZALO_RELAY_KEY

  if (!appSecret || !serviceKey || !relayUrl || !relayKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing env vars' })
  }
```

### E109 [직접 확인] api/status-recheck.js:60

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/api/status-recheck.js#L60) — 60~67줄

```
    fetchJwks: async () => (await fetch(`${ISSUER}/.well-known/jwks`)).json(),
    async readApproved() {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/job_location_candidates?select=job_id,lat,lng,evidence&status=eq.approved&order=reviewed_at.asc`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      })
      if (!r.ok) throw new Error('db_unavailable')
      return r.json()
    },
```

### E110 [직접 확인] scripts/status/generate-status.mjs:75

[조회한 원문](https://github.com/KHOAILANG0926/jobi-app/blob/9157ced522d024b2c378958f623beffbdfeb1aba/scripts/status/generate-status.mjs#L75) — 75~82줄

```

const jobs = await attempt('공고', async () => {
  const rows = await sb('local_jobs?select=id,source,active,admin_hidden')
  const visible = rows.filter((r) => r.active && !r.admin_hidden)
  const bySource = {}
  for (const r of visible) { const k = (r.source ?? '출처 없음').split(':')[0]; bySource[k] = (bySource[k] ?? 0) + 1 }
  return { total: rows.length, visible: visible.length, bySource, visibleIds: new Set(visible.map((r) => r.id)) }
})
```

## 10. 실행한 조회·검색 목록

**[직접 확인]** GitHub API recursive tree `/git/trees/9157ced522d024b2c378958f623beffbdfeb1aba?recursive=1`: 응답 `sha=9157ced522d024b2c378958f623beffbdfeb1aba`, `truncated=false`. 아래 286개 소스는 각각 `github_fetch_file(repository_full_name="KHOAILANG0926/jobi-app",ref="9157ced522d024b2c378958f623beffbdfeb1aba",path=...)`로 성공 조회하고, 반환된 전체 본문에서 메모리 검색했다. 키 값·공고 데이터·환경 파일은 저장하지 않았다.

**[직접 확인] 검색 표현:** `local_jobs|SERVICE_ROLE|service_role|insert|upsert|update|active|admin_hidden|publish|create trigger|create policy|hasExcludedMoney|has_excluded_money|isPublicJobAllowed|useJobs|loadJobsForSSR|B2B|hoa hong|20000000`. 매칭 후 관련 함수 전체를 읽었다. 검색 0건을 실제 운영 객체 없음으로 확대하지 않는다.

```text
.github/workflows/admin-operations.yml
.github/workflows/claude-auto.yml
.github/workflows/crawl.yml
.github/workflows/jobcard-integrity.yml
.github/workflows/p0-foundation.yml
.github/workflows/pr-checks.yml
.github/workflows/supabase-keepalive.yml
api/admin-users.js
api/admin-vietmap.js
api/sitemap.xml.js
api/ssr.js
api/ward-area.js
api/zalo-token.js
crawler/check_site.py
crawler/classifier.py
crawler/crawl_facebook.py
crawler/crawl_topcv.py
crawler/deploy.sh
crawler/geocode.py
crawler/install_zalo_relay.sh
crawler/job_quality.py
crawler/reclassify_db.py
crawler/reclassify_node.mjs
crawler/regeocode_work_locations.py
crawler/run_daily.sh
crawler/vn_province_merger_2025.py
crawler/vn_provinces_lookup.py
crawler/zalo_relay.py
scripts/crawl.mjs
scripts/e2e-admin-operations.mjs
scripts/e2e-p0-foundation.mjs
scripts/extract-job-fields.ts
scripts/generate-location-candidates.ts
scripts/local-vercel-sim.mjs
scripts/ops/chotot_publish_classify.ts
scripts/ops/fetch_osm_outline.mjs
scripts/research/backup_to_private_store.mjs
scripts/research/bn_apply_chotot_rest.py
scripts/research/bn_apply_poi_candidates.py
scripts/research/bn_build_chotot_csv.mjs
scripts/research/bn_build_csv.mjs
scripts/research/bn_collect_chotot_ext.js
scripts/research/bn_collect_v24h.py
scripts/research/bn_overpass_fetch.mjs
scripts/research/bn_poi_match.mjs
scripts/research/bn_poi_plan.mjs
scripts/research/bn_poi_plan2.mjs
scripts/research/bn_poi_scan_browser.js
scripts/research/bn_prepare_chotot_insert.py
scripts/research/bn_vietmap_search_dryrun.mjs
scripts/research/cleanup_local_jobs_delete.sql
scripts/research/contact_sources/chotot_login.py
scripts/research/kcn_gate_dryrun.mjs
scripts/research/lib/privateStore.mjs
scripts/research/migrate_out_to_private_store.mjs
scripts/ts-extensionless-loader.mjs
scripts/ts-extensionless-register.mjs
scripts/verify-location-approvals-api.mjs
src/App.tsx
src/components/ApplyModal.tsx
src/components/ApplyUnavailableNotice.tsx
src/components/CompanyReviews.tsx
src/components/CvBuilder.tsx
src/components/FeaturedJobsSection.tsx
src/components/HomeBanner.tsx
src/components/JobAlertsPanel.tsx
src/components/JobApplyButton.tsx
src/components/JobCard.tsx
src/components/JobLocationMap.tsx
src/components/JobVietMap.tsx
src/components/JobsListToolbar.tsx
src/components/JobsStatusTabs.tsx
src/components/JobsTable.tsx
src/components/Layout.tsx
src/components/MapView.tsx
src/components/MessageEmployerModal.tsx
src/components/MessagesInbox.tsx
src/components/NoPublicJobs.tsx
src/components/NotificationBell.tsx
src/components/PasswordField.tsx
src/components/RecommendSection.tsx
src/components/RegionFilter.tsx
src/components/ReportButton.tsx
src/components/RequireAdmin.tsx
src/components/RequireEmployer.tsx
src/components/ScheduleInterviewModal.tsx
src/components/ScrollToTop.tsx
src/components/StatusTimeline.tsx
src/components/Toast.tsx
src/components/ZaloIcon.tsx
src/components/admin/AdminAuditLogs.tsx
src/components/admin/AdminAutoLocate.tsx
src/components/admin/AdminBrands.tsx
src/components/admin/AdminJobs.tsx
src/components/admin/AdminLocations.tsx
src/components/admin/AdminReports.tsx
src/components/admin/AdminUsers.tsx
src/components/admin/AdminVietMap.tsx
src/components/admin/AdminWardLocate.tsx
src/components/home/HomeMapCanvas.tsx
src/components/home/HomeMapExplorer.tsx
src/components/home/MobileDetailSheet.tsx
src/components/home/NearbyLifePanel.tsx
src/components/home/PlaceDetailPanel.tsx
src/components/home/map/GeoapifyMapCanvas.tsx
src/components/home/map/GoogleJobMarkerLayer.ts
src/components/home/map/GoogleMapCanvas.tsx
src/components/home/map/HomeMapTypes.ts
src/components/home/map/VietMapMapCanvas.tsx
src/components/home/map/googleAuthFailure.ts
src/components/home/map/googleMapOptions.ts
src/components/home/map/googleMapsLoader.ts
src/components/home/map/groupHomeMapMarkers.ts
src/components/home/map/homeMapClusters.ts
src/components/home/map/homeMapGeometry.ts
src/components/home/map/homeMapGestures.ts
src/components/home/map/homeMapProviderState.ts
src/components/home/map/lifeMapStyle.ts
src/components/home/map/sharedJobPopupOptions.ts
src/components/home/map/vietMapError.ts
src/components/home/map/vietMapStyle.ts
src/components/home/map/visibleTimeout.ts
src/components/home/mobileSheetGesture.ts
src/components/home/pageScrollChain.ts
src/components/job-form/JobConditionsFields.tsx
src/components/job-form/LocationPinPicker.tsx
src/components/korea/KoreaJobCard.tsx
src/components/useApply.ts
src/context/AuthContext.tsx
src/context/BrandsContext.tsx
src/context/JobsContext.tsx
src/context/NotificationContext.tsx
src/data/brandDirectory.ts
src/data/categories.ts
src/data/industrialParkOutlines.ts
src/data/industrialParks.ts
src/data/jobDuration.ts
src/data/jobRegions.ts
src/data/jobRequirements.ts
src/data/jobSchema.ts
src/data/mockJobs.ts
src/data/previewMapAcceptanceJobs.ts
src/data/subcategories.ts
src/data/vnDistricts.ts
src/data/vnProvinces.ts
src/data/vnWards.ts
src/entry-server.tsx
src/lib/accountCvStorage.ts
src/lib/accountMigrationStorage.ts
src/lib/accountProfileStorage.ts
src/lib/accountRoles.ts
src/lib/addressLocate.ts
src/lib/addressParse.ts
src/lib/adminOperations.ts
src/lib/adminVietmapClient.ts
src/lib/applicationsStorage.ts
src/lib/authStorage.ts
src/lib/brandCandidates.ts
src/lib/categoryVisuals.ts
src/lib/chototAutoLocate.ts
src/lib/communityStorage.ts
src/lib/companyLogo.ts
src/lib/cvCompleteness.ts
src/lib/cvPdf.ts
src/lib/cvStorage.ts
src/lib/directionsPlan.ts
src/lib/fetchJobsData.ts
src/lib/formatVnd.ts
src/lib/geoapify.ts
src/lib/homeMapFilters.ts
src/lib/homeMapSearch.ts
src/lib/industrialPark.ts
src/lib/interviewStorage.ts
src/lib/jobAlerts.ts
src/lib/jobConditions.ts
src/lib/jobCoords.ts
src/lib/jobDescriptionExtract.ts
src/lib/jobDescriptionRows.ts
src/lib/jobDetailView.ts
src/lib/jobId.ts
src/lib/jobQualityFilter.ts
src/lib/jobRows.ts
src/lib/jobSearch.ts
src/lib/jobUtils.ts
src/lib/jobsListView.ts
src/lib/koreaJobFormat.ts
src/lib/koreaJobsApi.ts
src/lib/locationCandidateMatch.ts
src/lib/mapPlace.ts
src/lib/messagesStorage.ts
src/lib/nearbyFacilities.ts
src/lib/notificationsStorage.ts
src/lib/recommendStorage.ts
src/lib/representativeSearchPages.ts
src/lib/reviewsStorage.ts
src/lib/sourceTag.ts
src/lib/storage.ts
src/lib/supabase.ts
src/lib/supabaseServer.ts
src/lib/viewHistoryStorage.ts
src/lib/wardArea.ts
src/lib/wardAreaClient.ts
src/lib/wardLocate.ts
src/lib/workScheduleParse.ts
src/main.tsx
src/pages/AdminDashboard.tsx
src/pages/Community.tsx
src/pages/CommunityPostDetail.tsx
src/pages/EmployerDashboard.tsx
src/pages/ForgotPassword.tsx
src/pages/FranchiseJobs.tsx
src/pages/Home.tsx
src/pages/InterviewTips.tsx
src/pages/JobDetail.tsx
src/pages/JobSearchPage.tsx
src/pages/KoreaHome.tsx
src/pages/KoreaJobDetail.tsx
src/pages/KoreaJobs.tsx
src/pages/Login.tsx
src/pages/ManageGuestJob.tsx
src/pages/PostJob.tsx
src/pages/PrivacyPolicy.tsx
src/pages/Profile.tsx
src/pages/ResetPassword.tsx
src/pages/SalaryCalculator.tsx
src/pages/Signup.tsx
src/pages/TermsOfUse.tsx
src/pages/ToolsHub.tsx
src/pages/ZaloCallback.tsx
src/pages/jobsMenu/MatchedJobsPage.tsx
src/pages/jobsMenu/RecentlyViewedPage.tsx
src/pages/jobsMenu/SavedJobsPage.tsx
src/pages/jobsMenu/SuggestedJobsPage.tsx
src/pages/jobsMenu/UrgentJobsPage.tsx
src/types/auth.ts
src/types/job.ts
src/types/koreaJob.ts
src/vite-env.d.ts
supabase/audits/admin_operations_readonly.sql
supabase/audits/admin_operations_remaining_count.sql
supabase/audits/p0_e2e_remaining_count.sql
supabase/audits/p0_foundation_readonly.sql
supabase/audits/p0_role_conflict_gate.sql
supabase/migrations/0001_applications.sql
supabase/migrations/0002_messages.sql
supabase/migrations/0003_interviews.sql
supabase/migrations/0004_local_jobs_employer_id.sql
supabase/migrations/0005_account_roles_local_jobs_rls.sql
supabase/migrations/0006_user_profiles.sql
supabase/migrations/0007_user_cvs.sql
supabase/migrations/0008_cv_photos_storage.sql
supabase/migrations/0009_admin_operations.sql
supabase/migrations/0010_job_work_locations.sql
supabase/migrations/0011_deactivate_expired_jobs_fn.sql
supabase/migrations/0012_korea_jobs_expand.sql
supabase/migrations/0013_korea_jobs_public_views_grants_fix.sql
supabase/migrations/0014_korea_jobs_vi_translation.sql
supabase/migrations/0015_address_pipeline_audit_fields.sql
supabase/migrations/0018_replace_job_work_locations_wire_location_verified.sql
supabase/migrations/0019_local_jobs_public_select_rls_fix.sql
supabase/migrations/0020_admin_functions_revoke_anon_execute_draft.sql
supabase/migrations/20260905015705_publish_gate_reason_add_no_verified_coordinate.sql
supabase/migrations/20260910120000_job_brands_master.sql
supabase/migrations/20260916090000_application_cv_snapshot.sql
supabase/migrations/20260916221446_local_jobs_subcategory.sql
supabase/migrations/20260916231310_job_work_locations_resolved_admin.sql
supabase/migrations/20260918112447_local_jobs_job_duration.sql
supabase/migrations/20260919030243_local_jobs_gender_age_requirement.sql
supabase/migrations/20260920043000_fix_applications_insert_employer_check.sql
supabase/migrations/20260920060000_local_jobs_employer_pledges.sql
supabase/migrations/20260920120000_local_jobs_guest_posting.sql
supabase/migrations/20260920130000_fix_handle_new_auth_user_role_null.sql
supabase/migrations/20260921090000_community_board.sql
supabase/migrations/20260921091000_community_photos_storage.sql
supabase/migrations/20260923050000_community_views_count.sql
supabase/migrations/20260923060000_deactivate_expired_jobs_cron.sql
supabase/migrations/20260923070000_local_jobs_salary_structured.sql
supabase/migrations/20260923080000_local_jobs_work_hours_structured.sql
supabase/migrations/20260927090000_job_alerts.sql
supabase/migrations/20260929120000_job_location_approvals.sql
supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql
supabase/migrations/20261007013659_job_fields_structured_columns.sql
supabase/migrations/20261007031726_job_language_trip_and_description_backup.sql
supabase/pending/20261008000000_private_research_store.sql
supabase/pending/20261008100000_publish_chotot_jobs.sql
supabase/pending/20261011120000_location_approval_evidence_guard.sql
```

**[직접 확인] 추가 소스 조회:** `register_job.mjs`, `check_dup.mjs`, `public/sw.js`, `api/status-recheck.js`, `scripts/status/generate-status.mjs`, `scripts/status/status-lib.mjs`. 추가 문서·테스트 조회는 본문의 E증거 및 다음 목록: AGENTS.md, CLAUDE.md, PROJECT_STATUS.md, CHATGPT_HANDOFF.md, VIECGANBAN_STRUCTURE_BASELINE.md, WORK_LOG.md, status:STATUS.md, docs/ops/2026-09-29_hide_crawled_no_contact.md, docs/ops/2026-09-30_publish_criteria_restore.md, docs/ops/2026-10-08_chotot_publish_dryrun.md/.sql, crawler/test_job_quality.py, crawler/test_facebook_quality.py, src/lib/fetchJobsData.test.ts, scripts/test-admin-operations.mjs, scripts/test-p0-migrations.mjs, package.json, .github/workflows/pr-checks.yml, .github/workflows/status-guard.yml. 보호된 경로는 조회만 했다.

**[직접 확인] 미실행:** 로컬 git/rg/tsc/npm test/build, Python/SQL/E2E 테스트, Production SQL, 크롤러 실행, 원문 사이트 방문, 배포, PR 병합, 숨김/공개/삭제, 알림 송신. 기존 문서의 결과는 모두 [기존 기록]이며 이번 테스트 결과가 아니다.
