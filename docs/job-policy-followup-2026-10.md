# PR48 후속: 운영 판정·review 보존·관리자 예외·게스트 회귀
[직접 확인] master `9157ced522d024b2c378958f623beffbdfeb1aba`, 시작 PR48 head `dc5190453335b1eb22527c1338cbce265c0c6e1c`; 같은 codex/job-posting-policy 브랜치. AGENTS/CLAUDE/baseline 원문 조회 완료. STATUS 생성 시각 2026-10-11 12:12(VN), master 테스트47/47 기록. Draft·미병합 유지.

## 1. 운영 공개 공고 전체 판정 — 미실행
[직접 확인] 도구 목록에 이 저장소의 Supabase/SSH SELECT 연결 없음. 기존 status-report.yml은 GitHub Secrets 연결(C10). 이 연결을 사용하는 임시 GET-only audit script/workflow 생성 요청이 성공 응답/commit SHA 없이 반환됐다. 후속 GitHub fetch_file은 두 파일 모두404였다. 자동 승인 검토에서 생성이 허용되지 않아 실행하지 못했으며 상세 거절 사유는 확보하지 못했다.
[추정] 차단/검토/허용 건수 및 차단·검토 ID·제목 목록은 **미확인**, 0건이 아니다. Production 조회·DB 변경·RPC·수집 실행 없음. 원문·연락처·키·백업을 회사 PC/PR에 저장하지 않았다. 승인된 읽기 연결 경로를 사용자에게 요청했다.
[추정] 승인된 경로 확보 후: SELECT/GET active=true AND admin_hidden=false, id/title/company/category/salary/description만 메모리 판정; pagination·중복·총수 검증. 출력은 집계 및 non-allow ID/연락처 제거 제목/reason/version만. 조회 시간 범위와 비transaction snapshot 한계를 명시한다. 동작 권한 우회는 하지 않는다.

## 2. crawler review를 비공개 검토로 보존 — 설계만
[직접 확인] 현재 review는 skip(C1)이다. 이번에 저장 동작/DB를 바꾸지 않았다.
[추정] 신규 review는 local_jobs.active=false로 보존하고 admin_hidden은 기존 moderation 용도로 유지한다. 제안 VN-only local_job_policy_reviews sidecar는 job/version/fingerprint/reason/state/최초·최근시각/reviewer·사유를 기록하며 admin만 읽는다. 신규 raw 연락처/token을 감사 기록에 복제하지 않는다.
[추정] 재유입 pending 행은 자동 활성화 금지, 바뀐 입력/규칙은 새 검토. 기존 공개 공고가 review인 재유입은 실제 공개 행을 변경하지 않고 별도 private staged revision으로 보관한다. 관리자가 승인할 때만 반영한다.
[추정] 최종 행 판정과 비공개 저장을 transaction RPC로 묶어야 한다. EXCLUDE skip, ALLOW 기존 저장, REVIEW private 검토보존의 구분을 한다. 현 앱 preflight만으로 원자적 강제는 불가능하다.
[직접 확인] pending SQL 파일(C6)은 전부 주석인 설계·롤백안이고 실행하지 않았다. 스키마·권한·기존 pending/public 처리 방식은 승인과 실제 catalog 조회 후 결정한다.

## 3. 사유가 있는 관리자 오차단 예외 — 설계만
[추정] admin_review_job_policy RPC가 auth.uid()+기존 is_admin()을 확인하고 행 잠금·expected version/fingerprint·필수 사유를 검증한다. caller actor/role/override boolean은 신뢰하지 않는다. 정상 allow 승인과 non-allow false-positive exception을 구분한다.
[추정] 예외는 job+version+content fingerprint에 한정하고 변경·만료·철회 시 재승인. actor/reason/time을 VN 감사 기록에 보존한다. 새 테이블 직접 사용자 write 금지, SECURITY DEFINER 필요성을 검토한 후 fixed search_path·schema-qualified 객체·최소 EXECUTE 권한 적용.
[추정] 미래 DB 공개 trigger와 앱이 동일한 살아 있는 예외를 검증해야 한다. 지금 helper는 예외를 지원하지 않는다. 정책 예외만으로 moderation admin_hidden이나 좌표 승인을 해제하지 않는다. service-role/직접SQL/SELECT→UPDATE 우회는 아직 남는다.
[추정] 롤백: 수집 중지 유지→앱 RPC 의존성 먼저 제거→새 trigger/function만 제거. review 비공개/감사 이력은 보존. CASCADE/기존 객체 삭제/공고 상태 변경 없음. 새 테이블 삭제는 별도 승인 필요(C6).

## 4. 게스트 admin_hidden 회귀 수정
[직접 확인] legacy get_guest_job 응답은 active만 있고 hidden은 없다(C2). 이전 helper가 hidden=false를 만들면서 숨김 active 공고 편집을 정책 위반 공개로 오인했다(C3).
[직접 확인] 새 helper는 RPC의 실제 hidden이 있으면 활용하고, legacy는 공개 membership SELECT(id만, active=true/hidden=false)를 확인한다. 숨김 편집은 원래 hidden을 쓰거나 바꾸지 않고 저장; 공개 non-allow 편집 거절·inactive→active 판정·종료 허용·조회오류 fail closed(C4/C11).
[추정] membership 부재는 실제 hidden 값의 증거가 아니다. anon SELECT가 모든 공개 행을 반환하는 기존 규약에 의존하며 운영 RLS는 미확인이다. race와 raw RPC 우회를 해결하지 않았다. token RPC hidden 응답 추가는 DB 승인 후 검토.
[직접 확인] 합성 회귀 사례: legacy hidden edit 허용/public edit 차단/SELECT오류/재활성 차단/known hidden edit 허용. 최소 id 조회만 하고 admin_hidden을 update payload에 넣지 않는 것도 확인한다(C5).

## 5. crawl 인자 불일치 확인
[직접 확인] PR48 및 master crawl.yml:27은 무인자 Python 실행(C7), run_daily.sh:47도 무인자(C8). PR48 crawler/crawl_topcv.py:2652부터 --confirm-full-crawl 없으면 SystemExit(C9)라 이 소스 호출 경로의 불일치가 남아 있다.
[직접 확인] PR47은 Draft 미병합이며 해당 수정은 PR48에 없다. 안전장치를 제거하지 않고 이번에는 확인만 수행했다. 실제 수집 실행/재개 없음.
[추정] VPS 배포 버전·cron·로그·운영 영향은 미확인이다.

## 6. 최초 50개 커밋 목록과 범위
[직접 확인] GET pulls/48/commits?per_page=100 →50개; 각 GET commits/SHA files를 대조. 모두 정책·테스트·해당 앱 경로·설계·보고/HANDOFF 변경 파일이며 **경로 기준 무관 커밋은 0개(목록 없음)**. contents API 파일별 commit으로 반복 제목이 생겼다.
[추정] 경로 대조는 모든 줄의 의미적 무관 가능성까지 증명하지 않는다. 아래 실제 SHA/파일이 검토 근거다. 후속 커밋은 이 최초50개와 구분한다.

| [직접 확인] SHA | 실제 변경 파일 |
|---|---|
| `d1830bed47e8af0a0c2120042e2de0dd7975040a` | `policy/job-posting-rules.json` |
| `9881f281eccdd0ccac4c1a4ce900bd2c4696da61` | `src/lib/jobPostingPolicy.mjs` |
| `56ce32d45bcd3323062a4b2b1e3eec11fa3ec616` | `crawler/job_posting_policy.py` |
| `f3e6791be16c99fcdeed809f1493a6b5bc9e290f` | `src/lib/jobPostingPolicy.d.mts` |
| `3fee5b500b7263a4b2915fc311f3df6b932c946b` | `src/lib/jobPolicyWrite.ts` |
| `6b65aeece1dda98f441a93290b4a698aff75a489` | `src/lib/jobQualityFilter.ts` |
| `6db14f8837339540cffa8851715dfb9aaca131a1` | `src/context/JobsContext.tsx` |
| `4284f6eede69ea18ea66691ac8ddc9c439ec0647` | `src/pages/AdminDashboard.tsx` |
| `642d4655919f11daa8ef8418a43a42304e42ae60` | `src/lib/adminOperations.ts` |
| `0a64257cadd1ed828b9f762fe4109e7cb04c616d` | `src/pages/ManageGuestJob.tsx` |
| `97b24eb275b00822e6f8283511b299b14fa1ef99` | `src/lib/fetchJobsData.ts` |
| `19164eca11e1ecde74d92b0af91a239138febfd4` | `crawler/job_quality.py` |
| `86a9a61f60913a20541a74c8cff9c8a5571653c8` | `crawler/crawl_topcv.py` |
| `4f8db51a5f79eae6a4a8746fa1d215f5737917df` | `crawler/crawl_facebook.py` |
| `7e9ca480ae2a8841756bcad7b8701420b5a38113` | `register_job.mjs` |
| `dd043eefdd427de8723e89d2097ff33acd8947d0` | `scripts/research/bn_apply_chotot_rest.py` |
| `283f0d5e07a91193ab64be4ad97392f730ef44c3` | `policy/job-posting-fixtures.json` |
| `7c9d61be80d84c3a036aa08bec601230a36f9bd8` | `crawler/reclassify_db.py` |
| `4ce0a3fbc0314538972c861024a58a23c7f83c97` | `crawler/reclassify_node.mjs` |
| `16ac497282411fba7c908e17615de8a998a2798b` | `scripts/crawl.mjs` |
| `d95e34fd5a77f7a02d49d0e0373788f938cfcb42` | `src/lib/jobPostingPolicy.test.ts` |
| `e619ec46d7e16a0129c52b52c6f7ce849700243a` | `src/lib/jobPolicyWrite.test.ts` |
| `ade0afb3baf682066d3eee93d4c5202cba68c2bb` | `scripts/job-policy-results.mjs` |
| `f520d2ba055b039a6d211d8771601cced83bad4b` | `crawler/test_job_posting_policy.py` |
| `96fbcdc25576e257c306feda03ad295343ca0d50` | `.github/workflows/job-policy-tests.yml` |
| `6bdbe01dd333abf3c9d3b5729957c06c0ceb0b55` | `supabase/pending/20261011_job_posting_policy_design.sql` |
| `8440976c8d6611c687759433baf296ee1f47a8eb` | `policy/job-posting-rules.json` |
| `e7ff5d65e021be5ce8627d0c995d582ebbb72992` | `src/lib/jobPostingPolicy.mjs` |
| `fd70b1d4f83c9203bda1dedf47ebc504f7b49455` | `crawler/job_posting_policy.py` |
| `6bf1803732344c034494f95b177ed94692545c83` | `policy/job-posting-fixtures.json` |
| `024bcc1bfdb5be57d900133e348fe12275e39e8a` | `src/lib/jobPostingPolicy.test.ts` |
| `1ec0910ca13b6eb6f337065ffb66c7ac24ffeab1` | `src/lib/jobPolicyWrite.test.ts` |
| `5d86f23acb75f15094c8d414b5d52612ed2bd2c1` | `policy/job-posting-rules.json` |
| `0c71736626fab74ce118bc913e5dda6aa0c6267e` | `src/lib/jobPostingPolicy.test.ts` |
| `d9157e87c8740bf9b343c1eb54ab001534486c15` | `src/lib/jobPolicyWrite.test.ts` |
| `c67981140ba35452ac6a5d1ae174058ab8ec6d49` | `policy/job-posting-fixtures.mjs` |
| `58615ffc49e33cc2301c0d093d3e8d5a7a347ef6` | `policy/job-posting-fixtures.d.mts` |
| `b453d4b31c3e20bf49bec4c29735730c74f47f01` | `src/lib/jobPostingPolicy.d.mts` |
| `d66122cd5ee622dd5627891d45604a8c3d18a17a` | `src/lib/jobPolicyExposure.test.ts` |
| `66427a4f0937b3b9f81732aeec527021223c9883` | `src/lib/jobPostingPolicy.d.mts` |
| `3f0b39573613f2261e4856df8ee01b348f5445ca` | `src/pages/EmployerDashboard.tsx` |
| `9faa683511a64e54c0a679a796ee15bd0230b153` | `src/lib/jobPostingPolicy.mjs` |
| `e57240ef07d44c88c0c85e3a24e328cf50da06c4` | `.github/workflows/job-policy-tests.yml` |
| `75bf3b0a49b7c94becb212ca4cb50f38ee839cd5` | `src/context/JobsContext.tsx` |
| `d01b7503854b22905e89ab98804199d5f435e555` | `src/lib/jobPostingPolicy.d.mts` |
| `3164db52175b925df708a760af5075c97ea94315` | `src/lib/jobPostingPolicy.test.ts` |
| `52147ddfd30d1b3db6b015a422683a13bde6e8ae` | `policy/job-posting-rules.json` |
| `1bc622d2f9b52dd14c5860935a52ed3fcd89e557` | `policy/job-posting-fixtures.json` |
| `dffcc90ae4ba472689a3071aebd446e1f707ca16` | `docs/job-posting-policy-implementation-2026-10.md` |
| `dc5190453335b1eb22527c1338cbce265c0c6e1c` | `CHATGPT_HANDOFF.md` |

## 7. 실행 검사 및 미확인
[직접 확인] 첫 회귀 CI run38155327690의 타입 검사에서 Object.hasOwn ES target 호환 오류가 났고 npm/build는 skipped였다. 프로젝트 target 변경 없이 hasOwnProperty.call로 수정했다. 이 실패를 통과로 기록하지 않는다.
[직접 확인] 로컬 exec helper setup 오류와 Node kernel unexpected exit로 skill 파일/로컬 테스트 실행 불가. 원격 GitHub Actions 격리 검사로 진행한다. Production 검증은 포함되지 않는다.
[직접 확인] 회귀 수정 code SHA `082911b790bdbe4fcfbef0bee1b5455574659ce7`: [checks38155634979](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38155634979), job114517927697 로그 `guest hidden regression: legacy hidden/public, SELECT errors, activation and known-hidden cases passed`, `50/50 test files passed.`; tsc 성공, build `built in 749ms / 212ms`. [Python38155634893](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38155634893), job114517927311 `Ran 6 tests in 0.134s / OK`, `21/21 job quality tests passed`; 문법검사 성공. 실제 DB·브라우저 통합 검사가 아니다.
[직접 확인] WORK_LOG 갱신 보류·기존 운영 지침/미완료 Goong 항목 보존. 보호된 STATUS/location guard/PR46 보고/한국 모듈 변경 없음. 병합·배포·수집·DB 적용 없음.

## 원문 코드 근거

### C1 [직접 확인] crawler/job_posting_policy.py:69
```


def crawler_policy_errors(job):
    result = evaluate_job_posting_policy(job)
    if result["decision"] == "allow":
        return []
    return ["posting policy skip: " + result["decision"] + "/" + result["reason"]]

```

### C2 [직접 확인] supabase/migrations/20260920120000_local_jobs_guest_posting.sql:68
```
  description text,
  active boolean,
  posted_at date
)
language sql
stable
security definer
set search_path = public
```

### C3 [직접 확인] src/lib/jobPolicyWrite.ts (old PR48):40
```
  }
  // Guest RPC exposes active but not admin_hidden; conservatively check any active
  // write without requesting hidden/private/token columns via public SELECT.
  assertPublicJobWrite({ ...previous, admin_hidden: false }, patch)
  return client.rpc('update_guest_job', params)
}

export function checkedPublicJobInsert(client: SupabaseClient, payload: Record<string, unknown>) {
```

### C4 [직접 확인] src/lib/jobPolicyWrite.ts:44
```
  // No private columns/token are requested and no guest caller controls hidden.
  let currentlyPublic: boolean
  if (typeof previous.admin_hidden === 'boolean') {
    currentlyPublic = previous.active && !previous.admin_hidden
  } else {
    const { data: publicRow, error: publicError } = await client.from('local_jobs')
      .select('id').eq('id', params.p_job_id)
      .eq('active', true).eq('admin_hidden', false).maybeSingle()
```

### C5 [직접 확인] src/lib/jobPolicyWrite.test.ts:119
```
const { admin_hidden: _hidden, ...legacyBlocked } = { ...blocked, active: true, admin_hidden: true }
const hiddenEdit = legacyGuest(legacyBlocked, false)
await checkedGuestJobUpdate(hiddenEdit.client, { p_job_id: 1, p_token: 'synthetic', p_description: blocked.description })
assert.equal(hiddenEdit.writes.length, 1, 'legacy hidden edit must be saved')
assert.equal(Object.prototype.hasOwnProperty.call(hiddenEdit.writes[0], 'admin_hidden'), false, 'hidden not changed by guest')
assert.deepEqual(hiddenEdit.publicReads, ['id'], 'no private fields read')
const publicEdit = legacyGuest(legacyBlocked, true)
await assert.rejects(() => checkedGuestJobUpdate(publicEdit.client, {
```

### C6 [직접 확인] supabase/pending/20261011_job_policy_review_exception_design.sql:14
```
--
-- ADMIN EXCEPTION proposal: admin_review_job_policy(job_id, expected_version,
-- expected_fingerprint, action, reason), with mandatory nonempty reason.
-- Validate auth.uid() and existing public.is_admin(); lock row/recompute policy.
-- allow only normal ALLOW; exception acknowledges an EXCLUDE/REVIEW false positive.
-- Proposed local_job_policy_exceptions: job_id/version/fingerprint/actor/reason,
-- created_at/revoked_at/optional expires_at. Immutable VN admin audit event.
-- Direct anon/authenticated writes denied; caller-supplied actor/role ignored.
```

### C7 [직접 확인] .github/workflows/crawl.yml:21
```
          python -m playwright install --with-deps chromium

      - name: 크롤링 실행
        env:
          SUPABASE_URL: https://edhuesdnuxlbcfephutq.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python crawler/crawl_topcv.py

```

### C8 [직접 확인] crawler/run_daily.sh:44
```
  echo "[$(date -Is)] Skipping Facebook crawler: FB_C_USER/FB_XS not configured"
fi

run_crawler "Vieclam24h" "${TOPCV_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_topcv.py

echo "[$(date -Is)] Daily crawler finished"
exit "$STATUS"

```

### C9 [직접 확인] crawler/crawl_topcv.py:2651
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


### C10 [직접 확인] .github/workflows/status-report.yml:27
```
    env:
      SUPABASE_URL: https://edhuesdnuxlbcfephutq.supabase.co
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
    steps:
      - uses: actions/checkout@v4
        with:
```

### C11 [직접 확인] src/lib/jobPolicyWrite.ts:48
```
  } else {
    const { data: publicRow, error: publicError } = await client.from('local_jobs')
      .select('id').eq('id', params.p_job_id)
      .eq('active', true).eq('admin_hidden', false).maybeSingle()
    if (publicError) throw new Error('Không xác định được trạng thái công khai của tin.')
    currentlyPublic = publicRow != null
  }
  // Hidden edits preserve DB hidden state; explicit activation still requires
```
