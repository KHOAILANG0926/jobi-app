# 신규 공고 제외 정책 — 애플리케이션 구현·검증 (PR #48)

[직접 확인] 시작 및 재확인 master: `9157ced522d024b2c378958f623beffbdfeb1aba`. GitHub branches/master 조회 응답 commit.sha 동일. 별도 브랜치 `codex/job-posting-policy`; 코드 검증 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`.
[직접 확인] AGENTS.md·CLAUDE.md·기존 구조 문서·status/STATUS.md를 읽었다. STATUS 생성 시각 2026-10-11 12:12(VN), master 검사 47/47 기록. 본 PR의 검사와 Production 상태를 혼동하지 않는다.
[기존 기록] [PR #46](https://github.com/KHOAILANG0926/jobi-app/pull/46)의 docs/policy-audit-2026-10.md(3c71b9507931f714a465b00e1085a63af68ef478)를 조사 기준으로 재사용했다. 기존 286개 파일 조사 전체를 반복하지 않았다.
[직접 확인] PR #47은 Draft·merged=false, head 443468b24c554ad5ea44df6c8e4a53e41c925dc8. 본 PR은 해당 변경을 병합하지 않는다. PR #48 mergeable=true 조회(문서 갱신 전); 충돌 상태는 최종 조회로 재확인한다.

## 판정과 기존 차이

[직접 확인] E1/E2/E6: Python과 JS는 동일 JSON 규칙·동일 39개 합성 사례를 사용하고 decision/reason/version 완전 일치 테스트를 수행한다. 예전 Python의 금융 본문 단어 차단과 TS 정규식 차이를 전담 직무 기준으로 좁혔다. 대출 복지, 일반 매장 정산/공장 QC가 금융 회사명·본문 단어만으로 차단되지 않는 사례를 포함한다.
[직접 확인] 금융·대출·채권추심 전담 제외; 외근·대리점 관리가 명확한 B2B 영업 제외; 매장/마트/생산/QC 허용. 전문 영업+고수입 표현+인센티브가 함께 확인되면 review; 금액 20,000,000 VND·최대 총액·인센티브 포함 총액만으로 제외하지 않는다(E1 및 fixtures).
[직접 확인] 불완전 본문/혼합 B2B·매장/불명확 영업은 review. 크롤러는 exclude와 review 모두 기존 skip 방식(E2); 새 검토 테이블·상태 저장 방식은 추가하지 않았다. 애플리케이션 공개 시도는 review도 거절하고 설명 보완 메시지를 표시한다.
[추정] 정규식은 모든 언어·은어를 이해하지 못한다. 운영 원문과 #4750 실제 원문은 조회하지 않았다. #4750 유형은 합성 사례이지 실 공고 재판정 증거가 아니다.

## PR #46 경로 대조 및 실제 연결

| 근거 | 경로 | 적용 |
|---|---|---|
| [직접 확인] E3–E5 | TopCV/Facebook 수집→품질→최종 저장 | 신규·기존 재유입마다 재판정, non-allow skip |
| [직접 확인] E7/E10/E11 | 기업/게스트 신규 등록, 공통 수정·재공개 | insert 전 검사; 수정은 fresh SELECT와 최종 행 검사 |
| [직접 확인] E8/E12/E13 | 관리자 등록·숨김 해제 | RPC 직전 preflight |
| [직접 확인] E9/E14 | 게스트 token 수정·재활성 | get_guest_job 이후 검사, 거절 시 write RPC 미호출 |
| [직접 확인] E15 | 기업 urgency 편집 | 공개 행 정책 재검사와 실패 표시 |
| [직접 확인] E17–E21 | 직접 스크립트/Chotot REST/재분류/legacy jobs | 해당 저장 직전 검사 |
| [직접 확인] E16/E25 | 공개 목록 공통 fetch→검색·지도·추천·SSR | active=true 및 admin_hidden=false 명시, 역할별 mock 검사 |
| [기존 기록] PR46 DB 경로 | DB RPC/직접 SQL/외부 service-role/Edge/VPS | 앱 helper를 사용하지 않으면 우회 가능; 운영 설치 현황 미확인 |

[직접 확인] 공개 읽기의 기존 금융 필터(E6)는 공유 금융 역할 판단을 사용한다. 새 B2B/review 전체 판정을 기존 공고 목록의 자동 숨김 필터로 추가하지 않았다. 기존 Production 공고를 수정·숨김·삭제하지 않았다.
[직접 확인] E7/E9: 일반 기업/관리자 현재 행 조회 실패는 공개 저장을 거절한다. 게스트 RPC는 admin_hidden을 반환하지 않아 active 공고 편집을 보수적으로 검사한다. 숨김 공고라도 active=true 게스트 편집이 거절될 수 있다.
[직접 확인] E7/E23: SELECT→UPDATE가 원자적이지 않다. 동시 변경 경쟁 조건, raw admin_create_job/update_guest_job/admin_set_job_hidden RPC, 직접 REST/SQL/service-role은 앱 검사 우회가 남는다. 테스트는 raw RPC 우회 가능성을 mock으로 보여줄 뿐 DB 강제 성공을 주장하지 않는다.
[추정] 배포된 Edge Function·VPS·DB 트리거/RLS/GRANT와 jobs/local_jobs 실제 연결은 승인된 Production 연결이 없어 미확인이다. 권한 우회를 시도하지 않았다.

## 격리 검사: 실제 실행 결과

[직접 확인] GitHub Actions Ubuntu 임시 runner에서 실행, Secret env와 실제 crawler import 없이 합성 fixture/mock/AST 함수만 사용. 외부 채용사이트 수집·Production DB 쓰기·전체 crawler 실행은 하지 않았다.
[직접 확인] 검사 코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`; [checks run 38154323163](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38154323163), job 114514040812 로그 및 steps 성공을 조회했다.
- [직접 확인] `npx tsc --noEmit`: 성공(step 타입 검사).
- [직접 확인] `npm test`: `50/50 test files passed.`; 새 정책/쓰기/노출 검사 3파일 포함.
- [직접 확인] `npm run build`: 성공; 로그 `built in 1.20s`, `built in 120ms`.
[직접 확인] [Python run 38154323195](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38154323195), job 114514040836:
- [직접 확인] `python crawler/test_job_posting_policy.py`: `Ran 6 tests in 0.145s / OK`.
- [직접 확인] `python crawler/test_job_quality.py`: `21/21 job quality tests passed`.
- [직접 확인] 변경 Python `py_compile`, JS `node --check`: 성공(스크립트 실제 실행 아님).
[직접 확인] 39 합성 판정: exclude 14 / review 10 / allow 15. E22는 39×7 애플리케이션 경로에서 허용 쓰기 1회 도달 및 non-allow 쓰기 0회를 확인한다. 금융/B2B/전문 인센티브/매장/마트/생산/QC/복지 대출/공급업체 공장 오차단/재활성/내용 수정/재유입/기존 판정 cache 무시를 포함한다.
[직접 확인] E24는 실제 TopCV 최종 upsert 함수 AST를 추출하여 non-allow 신규·기존 재유입 저장 차단을 검사한다. allow TopCV 전체 수집/DB 통합 실행은 수행하지 않았다. Facebook 최종 required guard는 39개 fixture 적용.
[직접 확인] initial CI에서 retail store 사례 오차단 및 TS 입력 타입 오류가 발생했고 규칙·입력 선언을 수정한 후 위 SHA 재검사가 성공했다. 실패한 중간 실행을 성공으로 기록하지 않는다.
[추정] 실제 DB 트리거/RPC 권한/로그인 브라우저·VPS·Production 영향 ID와 건수는 미확인이다. E25의 3역할은 mock이며 실제 로그인 화면 검증이 아니다.

## Pending DB 설계와 운영 영향

[직접 확인] E26 및 pending 파일: 모든 줄은 주석, 실행 SQL/DDL이 아니다. 미래 순수 evaluator는 SECURITY INVOKER·고정 search_path·schema-qualified 객체·최소 EXECUTE 권한, 정책 버전과 fixture parity 검증을 전제로 한다. DB 공통 RPC 호출 의존성을 현재 앱에 추가하지 않았다.
[추정] 제안 BEFORE INSERT/UPDATE guard는 FINAL NEW의 active=true/admin_hidden=false만 판정하고 non-allow면 statement 거절. 승인 전 실제 DB 구조와 권한 검토·격리 SQL parity가 필요하다. 보통 service-role/SECURITY DEFINER도 table trigger를 거치지만 owner의 trigger disable 등 절대 차단은 보장할 수 없다.
[직접 확인] 앱 수준에서도 기존 공개 위반 공고의 일반 urgency 편집·재활성은 거절될 수 있다(E7/E15); inactive/hidden 수정·종료는 허용(E1). 관리자 역할 예외를 만들지 않았다. 정상 등록도 조회 권한 부족/본문 누락이면 거절될 수 있다.
[추정] 향후 RPC 평가기에 의존하면 RPC 장애가 전체 등록 장애로 이어질 수 있다. 현재는 로컬 판정이므로 evaluator RPC 장애 의존성은 없다. 추가 SELECT 장애는 기존 행 편집을 fail closed 한다.
[직접 확인] pending 롤백은 신규 trigger/function만 DROP, CASCADE·기존 객체 삭제·데이터 수정 없음. 실제 객체 생성/롤백 실행하지 않았다. SQL 적용·관리자 예외·기존 공고 상태 변경은 별도 승인 사항이다.

## 승인 후 순서·남은 범위

1. [직접 확인] 먼저 이 Draft PR의 역할 규칙과 review 공개 거절/크롤러 skip UX를 검토한다. 규칙 수정 시 JSON+Python/TS shared fixture를 같은 PR에서 변경하고 위 명령 재실행한다.
2. [추정] 승인된 읽기 전용 DB 연결로 pg_trigger/pg_proc/pg_policies/GRANT·Edge/VPS·jobs 연결과 영향 ID만 확인한다. 불명확 사례 저장 방식·기존 공개 공고 일반 편집 제한·관리자 예외 여부를 사용자가 결정해야 한다.
3. [추정] DB 강제가 필요하면 pending 설계를 실제 격리 DB SQL로 구현·허용/차단/RPC/service-role/동시수정/권한/롤백 검증 후 별도 승인받는다. 지금 우회 차단 완료로 처리하지 않는다.
4. [추정] 운영 위반 알림·ID 검토·정책 버전 재검증 자동화는 미구현이며 별도 승인 범위다. 실 공고 본문·연락처·Secret은 공개 보고서에 기록하지 않는다.
5. [직접 확인] PR47/48 Draft 유지, 병합·배포·수집 재개 없음. STATUS 보호 장치·location approval guard·PR46 보고서·한국 모듈·WORK_LOG는 변경하지 않는다(기존 사용자 WORK_LOG 갱신 보류 유지).
[직접 확인] 로컬 PC에 Production 데이터/키/백업을 저장하지 않았다. 변경은 GitHub 별도 브랜치에 보존했다. 로컬 git clean·VPS 상태는 조회하지 않아 미확인이다.

## 수정 파일 목록

- [직접 확인] `policy/job-posting-rules.json`
- [직접 확인] `src/lib/jobPostingPolicy.mjs`
- [직접 확인] `crawler/job_posting_policy.py`
- [직접 확인] `src/lib/jobPostingPolicy.d.mts`
- [직접 확인] `src/lib/jobPolicyWrite.ts`
- [직접 확인] `src/lib/jobQualityFilter.ts`
- [직접 확인] `src/context/JobsContext.tsx`
- [직접 확인] `src/pages/AdminDashboard.tsx`
- [직접 확인] `src/lib/adminOperations.ts`
- [직접 확인] `src/pages/ManageGuestJob.tsx`
- [직접 확인] `src/lib/fetchJobsData.ts`
- [직접 확인] `crawler/job_quality.py`
- [직접 확인] `crawler/crawl_topcv.py`
- [직접 확인] `crawler/crawl_facebook.py`
- [직접 확인] `register_job.mjs`
- [직접 확인] `scripts/research/bn_apply_chotot_rest.py`
- [직접 확인] `policy/job-posting-fixtures.json`
- [직접 확인] `crawler/reclassify_db.py`
- [직접 확인] `crawler/reclassify_node.mjs`
- [직접 확인] `scripts/crawl.mjs`
- [직접 확인] `src/lib/jobPostingPolicy.test.ts`
- [직접 확인] `src/lib/jobPolicyWrite.test.ts`
- [직접 확인] `scripts/job-policy-results.mjs`
- [직접 확인] `crawler/test_job_posting_policy.py`
- [직접 확인] `.github/workflows/job-policy-tests.yml`
- [직접 확인] `supabase/pending/20261011_job_posting_policy_design.sql`
- [직접 확인] `policy/job-posting-fixtures.mjs`
- [직접 확인] `policy/job-posting-fixtures.d.mts`
- [직접 확인] `src/lib/jobPolicyExposure.test.ts`
- [직접 확인] `src/pages/EmployerDashboard.tsx`
- [직접 확인] 이 구현 검증 보고서와 CHATGPT_HANDOFF.md 최신 snapshot.

## 코드 근거 (원문 발췌)


### E1 [직접 확인] 공통 역할 판정
src/lib/jobPostingPolicy.mjs:29 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
}
export function evaluateJobPostingPolicy(job = {}) {
  const fields = Object.fromEntries(['title', 'company', 'description', 'category', 'salary']
    .map(key => [key, normalizePolicyText(key === 'description'
      ? String(job[key] ?? '').replace(/\[source:[^\]]*\]/gi, '') : job[key])]))
  const result = (decision, reason) => ({ decision, reason, version: POLICY_VERSION })
  const money = moneyReason(fields)
  if (money) return result('exclude', money)
```

### E2 [직접 확인] exclude/review 크롤러 skip
crawler/job_posting_policy.py:70 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```

def crawler_policy_errors(job):
    result = evaluate_job_posting_policy(job)
    if result["decision"] == "allow":
        return []
    return ["posting policy skip: " + result["decision"] + "/" + result["reason"]]

```

### E3 [직접 확인] 기존 품질 검사 연결
crawler/job_quality.py:9 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
import classifier
from job_posting_policy import evaluate_job_posting_policy, has_excluded_money_role, crawler_policy_errors


# Pure mirror of crawl_category()'s in-browser line-parsing JS in
# crawl_topcv.py — kept here ONLY so that logic can be unit tested without a
# real browser (the actual crawl always runs the JS version in-page, this
# never executes during a real crawl). If either side changes, update both —
```

### E4 [직접 확인] 신규·재유입 최종 upsert 검사
crawler/crawl_topcv.py:2089 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```

    policy_errors = crawler_policy_errors(job)
    if policy_errors:
        print(f"    ⛔ 정책 수집 제외: {policy_errors}")
        return {"action": "policy_skipped", "id": existing.get("id") if existing else None}

    resolved = job.get("_resolved_locations") or []
    had_transient = job.get("_had_transient_geocode_failure", False)
```

### E5 [직접 확인] Facebook 최종 저장 검사
crawler/crawl_facebook.py:1152 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    body = (job.get("description") or "").replace("[source:facebook]", "", 1)
    problems = crawler_policy_errors(job)
    tail = body.rstrip()
    if tail.endswith(SEE_MORE_LABELS) or (tail.endswith(("…", "...")) and not job.get("fb_full_text_confirmed")):
        # 말줄임표로 끝나는 글은 크롤링 중 '더 보기' 요소가 없음을 화면에서 확인한 경우만 허용
        problems.append("본문 잘림")
    if not (job.get("title") or "").strip():
        problems.append("제목 없음")
```

### E6 [직접 확인] Python/TS 금융 역할 판정 통일
src/lib/jobQualityFilter.ts:1 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
import type { Job } from '../types/job'
import { hasExcludedMoneyRole } from './jobPostingPolicy.mjs'

// Shared dedicated-role rules; company alone and incidental body receivables
// are not debt-collection evidence. B2B/review gating happens on NEW writes.
export function hasExcludedMoneyTerms(job: Pick<Job, 'title' | 'company' | 'description'> & { category?: unknown }): boolean {
  return hasExcludedMoneyRole(job)
}
```

### E7 [직접 확인] 현재 DB 행과 patch의 최종 공개 상태 검사
src/lib/jobPolicyWrite.ts:13 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
}
export async function checkedLocalJobUpdate(
  client: SupabaseClient, id: string | number, patch: Record<string, unknown>,
) {
  const previous = await readJobForPolicy(client, id)
  assertPublicJobWrite(previous, patch)
  return client.from('local_jobs').update(patch).eq('id', id)
}
```

### E8 [직접 확인] 관리자 생성/숨김 해제 검사
src/lib/jobPolicyWrite.ts:20 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
}
export async function checkedAdminCreateJob(client: SupabaseClient, payload: Record<string, unknown>) {
  assertJobPublishable(payload)
  return client.rpc('admin_create_job', { payload })
}
export async function checkedAdminUnhide(client: SupabaseClient, id: number, reason: string) {
  const previous = await readJobForPolicy(client, id)
  assertPublicJobWrite(previous, { admin_hidden: false })
```

### E9 [직접 확인] 게스트 수정/재공개 검사
src/lib/jobPolicyWrite.ts:29 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
}
export async function checkedGuestJobUpdate(client: SupabaseClient, params: Record<string, unknown>) {
  const { data, error } = await client.rpc('get_guest_job', {
    p_job_id: params.p_job_id, p_token: params.p_token,
  })
  const previous = data?.[0]
  if (error || !previous) throw new Error('Không đọc được tin để kiểm tra.')
  const patch: Record<string, unknown> = {}
```

### E10 [직접 확인] 기업·게스트 등록 공통 검사
src/context/JobsContext.tsx:85 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```

    const { data, error } = await checkedPublicJobInsert(supabase, {
        title: draft.title,
        company: draft.company,
        category: draft.category,
        subcategory: draft.subcategory ?? null,
        salary: draft.salary,
        location: draft.location,
```

### E11 [직접 확인] 공통 수정 검사
src/context/JobsContext.tsx:171 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    const defined = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
    const { error } = await checkedLocalJobUpdate(supabase, rawId, defined)
    if (error) throw new Error(error.message)
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j)
      .filter((j) => j.active !== false && j.adminHidden !== true))
  }, [])

  const value = useMemo(
```

### E12 [직접 확인] 관리자 UI 연결
src/pages/AdminDashboard.tsx:199 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    try {
      const result = await checkedAdminCreateJob(supabase, {
      title: jobForm.title,
      company: jobForm.company,
      category: jobForm.category,
      salary: jobForm.salary,
      location: jobForm.location,
      hours: jobForm.hours || null,
```

### E13 [직접 확인] 관리자 숨김 해제 연결
src/lib/adminOperations.ts:73 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    reason,
  }) : await checkedAdminUnhide(supabase, jobId, reason)
  if (error) throw new Error(error.message)
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  return unwrap((data ?? []) as AdminUser[], error)
```

### E14 [직접 확인] 게스트 UI 연결
src/pages/ManageGuestJob.tsx:107 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    setSaving(true)
    const { data, error: rpcError } = await checkedGuestJobUpdate(supabase, {
      p_job_id: Number(id),
      p_token: token,
      p_title: draft.title.trim(),
      p_company: draft.company.trim(),
      p_salary: draft.salary.trim(),
      p_location: draft.location.trim(),
```

### E15 [직접 확인] 기업 편집 오류 표시
src/pages/EmployerDashboard.tsx:52 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
  const [applicationError, setApplicationError] = useState('')
  const [jobPolicyError, setJobPolicyError] = useState('')
  const [expandedCvId, setExpandedCvId] = useState<string | null>(null)
  const [cvPhotoById, setCvPhotoById] = useState<Record<string, string>>({})
  const [cvPhotoLoading, setCvPhotoLoading] = useState<string | null>(null)
  const [cvPhotoError, setCvPhotoError] = useState<string | null>(null)

  useEffect(() => {
```

### E16 [직접 확인] 공개 목록 hidden 명시 조건
src/lib/fetchJobsData.ts:29 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
      .eq('active', true)
      .eq('admin_hidden', false)
      .order('posted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('fetchJobsData: local_jobs query failed', error)
      fetchFailed = true
```

### E17 [직접 확인] 직접 등록 스크립트 preflight
register_job.mjs:17 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
// Preflight the whole batch before any upload/INSERT; no partial policy publication.
for (const job of jobs) assertJobPublishable(job)

for (const job of jobs) {
  // 이미지 업로드
  if (job._imagePath) {
    const bytes = fs.readFileSync(job._imagePath)
    const ext = job._imagePath.split('.').pop()
```

### E18 [직접 확인] Chotot REST 저장 preflight
scripts/research/bn_apply_chotot_rest.py:48 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    if table == "local_jobs":
        errors = crawler_policy_errors(body)
        if errors:
            raise ValueError("posting policy skip: " + "; ".join(errors))
    r = requests.post(f"{URL}/rest/v1/{table}", headers={**H, "Prefer": "return=representation"}, data=json.dumps(body), timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"POST {table}: HTTP {r.status_code} {red(r.text[:400])}")
    return r.json()[0]
```

### E19 [직접 확인] Python 재분류 공개 검사
crawler/reclassify_db.py:75 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
        if j.get("active") is True and j.get("admin_hidden") is False:
            policy = evaluate_job_posting_policy({**j, "category": new_cat})
            if policy["decision"] != "allow":
                print(f"policy skip id={j['id']}: {policy['reason']}")
                continue
        if new_cat != old_cat or new_sub != old_sub:
            updates.append({
                "id": j["id"], "old_cat": old_cat, "new_cat": new_cat,
```

### E20 [직접 확인] Node 재분류 공개 검사
crawler/reclassify_node.mjs:170 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
  const newCat = classify(j.title || '', j.company || '', descClean)
  try { assertPublicJobWrite(j, { category: newCat }) }
  catch { console.log('policy skip id=' + j.id); continue }
  if (newCat !== oldCat) {
    updates.push({ id: j.id, old: oldCat, new: newCat, title: j.title, company: j.company })
  }
}

```

### E21 [직접 확인] legacy jobs 수집 허용 검사
scripts/crawl.mjs:238 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
    if (!j.title || j.title.length < 3) return false
    if (evaluateJobPostingPolicy(j).decision !== 'allow') return false
    const key = `${j.title}__${j.company}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

```

### E22 [직접 확인] 39×7 mock 허용/차단 경로
src/lib/jobPolicyWrite.test.ts:45 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
}
for (const fixture of cases) {
  const row = { ...fixture.input, active: true, admin_hidden: false }
  const actions = [
    (client: SupabaseClient) => checkedPublicJobInsert(client, row),
    (client: SupabaseClient) => checkedAdminCreateJob(client, row),
    (client: SupabaseClient) => checkedAdminUnhide(client, 1, ''),
    (client: SupabaseClient) => checkedLocalJobUpdate(client, 1, { urgent: true }),
```

### E23 [직접 확인] raw RPC mock bypass 미해결 증거
src/lib/jobPolicyWrite.test.ts:90 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
// This fake has no DB trigger; this is not a real DB enforcement test.
const bypass = fake(safe)
await bypass.client.rpc('admin_create_job', { payload: blocked })
assert.equal(bypass.writes.length, 1)
console.log('policy write helpers: ' + cases.length + ' cases x 7 paths, content edit, reactivation, deactivation, read failure and unresolved raw-RPC bypass passed')

```

### E24 [직접 확인] 실제 TopCV 함수 AST 오프라인 검사
crawler/test_job_posting_policy.py:38 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```

    def test_topcv_final_upsert_rejects_new_and_existing_without_db(self):
        tree = ast.parse((ROOT / "crawler/crawl_topcv.py").read_text("utf-8"))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "upsert_job_record")
        # Run the actual final write boundary only. Any escaped INSERT/UPDATE,
        # location sync or top-level crawler import would fail this namespace.
        for fixture in CASES:
            if fixture["expected"] == "allow":
```

### E25 [직접 확인] 로그인 역할별 공개 조건 mock 검사
src/lib/jobPolicyExposure.test.ts:2 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
import { fetchJobsData } from './fetchJobsData.ts'
for (const role of ['anonymous', 'employer-owner', 'admin']) {
  const filters: [string, unknown][] = []
  const rows = [
    { id: 1, active: true, admin_hidden: false },
    { id: 2, active: true, admin_hidden: true },
    { id: 3, active: false, admin_hidden: false },
  ].map(row => ({ ...row, title: 'Nhân viên QC', company: 'Synthetic',
```

### E26 [직접 확인] 주석뿐인 DB pending 설계
supabase/pending/20261011_job_posting_policy_design.sql:15 (코드 SHA `1bc622d2f9b52dd14c5860935a52ed3fcd89e557`)
```
--
-- Proposed BEFORE INSERT OR UPDATE ON public.local_jobs, FOR EACH ROW:
-- evaluate FINAL NEW.title/company/category/salary/description.
-- If NEW.active IS TRUE AND NEW.admin_hidden IS FALSE and decision <> allow,
-- RAISE EXCEPTION (stable policy code); rollback entire statement.
-- Never trust caller policy_decision/policy_version or role-based administrator override.
-- Allow inactive/hidden correction and deactivation. Review candidates are NOT
-- automatically persisted under any new DB storage scheme.
```

