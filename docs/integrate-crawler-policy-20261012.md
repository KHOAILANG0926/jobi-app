# PR #47·#49 안전 통합 검증 — 2026-10-12

[직접 확인] 기준 master 9157ced522d024b2c378958f623beffbdfeb1aba, PR47 443468b24c554ad5ea44df6c8e4a53e41c925dc8, PR49 cc14ea45e7889d6155680cdb535e4b4ee5e258d6. 두 PR 모두 Draft/미병합 상태를 GitHub GET으로 확인했다.
[직접 확인] 통합 branch codex/integrate-crawler-policy-20261012. 네이티브 worktree C:/Users/Admin/.codex/worktrees/integrate-crawler-policy-20261012/JOBI에서만 수정했다. 원본 C:/Users/Admin/Desktop/JOBI의 master/d3940fa와 기존 변경26개는 보존했다.
[직접 확인] merge-tree와 실제 --no-ff --no-commit 병합은 CHATGPT_HANDOFF.md만 conflict; crawler/crawl_topcv.py는 자동 병합. HANDOFF는 원본47의 운영 기록/좌표B안/Goong14건·약관/수집 안전장치·WORK_LOG 보류와 원본49의 DB 우회·검토 저장·운영 RPC/RLS/UI 미완료를 함께 보존했다. 비공개 자료를 WORK_LOG에 복사하지 않았고 그 파일을 추가 수정하지 않았다.
[직접 확인] 기능 대조: PR47의 CLI confirmation/수동 opt-in/축약·혼합 모드 차단과 PR49의 최종 정책 저장 gate가 함께 남았다. CLI의 async/timeout은 대역으로 검사해 실제 수집은 없다. 금융/B2B/매장·마트/생산/QC/20M/모호한영업35 합성 case의 정책은 변경하지 않았다.
[직접 확인] 정상 lifecycle 검증을 기존 TS/SQL 테스트에 추가했다: 매장·마트·생산·QC 등록→내용 수정→비활성→재활성→숨김→숨김 해제. 앱 순수 gate 및 PGlite memory DB에서 허용됐고 위반/검토/읽기·판정 실패의 공개는 거절·원자적 rollback 됐다.
[직접 확인] 초기 추가 TS 테스트는 current-row object literal의 active/admin_hidden 타입으로 실패해 테스트 변수를 사용하도록 교정했다. Windows cp949 emoji 출력 실패는 python -X utf8 실행으로 해결했다. Git Bash 대신 System32 WSL이 선택되고 Windows 임시 PATH/CRLF로 timeout 대역이 누락된 문제는 테스트에서 절대 Bash 경로·POSIX 경로·LF synthetic fixture로 교정했다. 실 크롤러 본체의 실행/정책을 바꾸지 않았다.

## 실제 로컬 검증
- [직접 확인] python -m unittest discover -s crawler -p test_job_posting_policy.py: 2/2 OK.
- [직접 확인] python -m unittest discover -s crawler -p test_policy_write_gates.py: 3/3 OK. 실제 writer AST의 신규/재유입/Facebook/Chotot 쓰기 경계 대역 검사.
- [직접 확인] python -X utf8 crawler/test_job_quality.py: 21/21 passed.
- [직접 확인] Git Bash를 프로세스 PATH에만 지정한 python -I -X utf8 crawler/test_scheduled_cli.py: 14/14 OK (기존 CLI safety21개 포함), fake timeout 인자 및 반환 코드0/124 검사.
- [직접 확인] node scripts/test-job-policy-sql.mjs: 35 shared cases JS/Python/SQL decision/reason/version 일치, INSERT/수정/재공개/실패 atomic gate 및 정상4직종 lifecycle 통과. new PGlite() memory only; dataDir·운영 DB URL 없음.
- [직접 확인] npx tsc --noEmit: exit0. npm test: 49/49 test files passed. npm run build: client2.17s/SSR182ms 성공. 기존 큰 chunk 경고·mock.module deprecation은 비차단 경고.
- [직접 확인] 실제 UI E2E/Facebook credential 기반 전체 suite/Production DB RPC·RLS·trigger·권한/VPS 버전·cron·로그는 미확인이다. 운영 키/원문을 읽거나 저장하지 않았고 SQL은 memory 이외 적용하지 않았다.

## 첫 원격 생성 gate
[직접 확인] vercel.json의 기존 PR49 branch false를 유지하고 새 고정 통합 branch false만 추가했다. first commit을 만든 뒤 git show COMMIT:vercel.json으로 두 false, branch name, working tree clean, 부모47/49를 확인하고 SHA를 기록해야 한다. 다른 배포 설정/프로젝트 설정은 변경하지 않는다.
[기존 기록] Vercel 실제 설정은 GitHub KHOAILANG0926/jobi-app 연동, Production Branch=master, Preview Branch Tracking=All unassigned branches enabled. 기존 false는 새 branch에 적용되지 않으므로 새 false가 첫 원격 commit에 반드시 있어야 한다.
[추정/미확인] 첫 push 후 branch/SHA별 Preview 및 Production 배포 조회가 아직 남아 있다. 배포0 확인 전 PR 생성 금지; 예상치 못한 배포는 중단/보고하며 프로젝트 설정 변경·배포 삭제로 해결하지 않는다. 실제 최초 SHA/조회 응답/새 Draft PR CI run IDs는 PR 설명과 최종 보고에 기록한다.

## 남은 위험·승인 항목
[직접 확인] Production trigger 미적용이라 direct SQL/service-role 및 TOCTOU 우회 미해결. UI/RPC 운영 원자성/권한은 격리 검증으로 대신하지 않는다. 검토 비공개 저장·관리자 예외·DDL·수집 재개는 별도 승인이다.
[직접 확인] PR47의 schedule 설정은 소스 변경만 결합했고 dispatch/실제 수집은 실행하지 않았다. master/기존PR/Production/기존공고/위치 승인 SQL/보호 STATUS 장치를 변경하지 않았다.
[추정] git.deploymentEnabled는 Vercel Git 자동 배포 차단이며 CLI/API/Deploy Hook 호출은 별도 경로다. 최초 ref는 차단 commit을 직접 가리켜야 하고, 이후 모든 통합 push에도 false를 유지한다. 병합 전 차단 정리 및 운영 적용은 새로운 승인 범위다.

## 코드 원문 근거

### [직접 확인] vercel.json:1
```
{
  "git": {
    "deploymentEnabled": {
      "codex/job-posting-policy-implementation-20261012": false,
      "codex/integrate-crawler-policy-20261012": false
    }
  },
  "rewrites": [
```

### [직접 확인] .github/workflows/crawl.yml:28
```
          python -m pip install -r crawler/requirements.txt
          python -m playwright install --with-deps chromium

      - name: 크롤링 실행
        env:
          SUPABASE_URL: https://edhuesdnuxlbcfephutq.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python crawler/crawl_topcv.py --confirm-full-crawl
```

### [직접 확인] crawler/run_daily.sh:45
```
fi

# 정기 실행 wrapper는 전체 수집을 명시적으로 확인한다.
# 단건/검증 수동 작업은 이 wrapper 대신 crawl_topcv.py의 해당 CLI 모드를 사용한다.
run_crawler "Vieclam24h" "${TOPCV_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_topcv.py --confirm-full-crawl

echo "[$(date -Is)] Daily crawler finished"
exit "$STATUS"
```

### [직접 확인] crawler/crawl_topcv.py:2610
```
        raise SystemExit("실행 모드는 하나만 지정하세요. 중단합니다.")
    if args.confirm_full_crawl and any(explicit_modes):
        raise SystemExit("--confirm-full-crawl은 다른 실행 모드와 함께 쓸 수 없습니다. 중단합니다.")

    # 사용자 지시(2026-09-04, "운영 적용 준비" 4/5번): --verify-write가
    # 일반 --process-url이나 --reprocess-ids(UPDATE 경로)로 잘못 새어들어가지
    # 않도록, 조합 자체를 CLI 레벨에서 명시적으로 검증한다 — 두 플래그가
    # 각각 무엇을 요구하는지 한곳에서 확인 가능하게.
```

### [직접 확인] crawler/crawl_topcv.py:2074
```
    _require_write_enabled()
    verdict = evaluate_job_policy(job)
    if verdict['decision'] != 'allow':
        return {'action': 'policy_skipped', 'id': None, 'reason': verdict['reason']}
    existing = match_existing_row(job, by_source_url, by_key)

    if verify_write and existing is not None:
        raise VerifyWriteExistingMatchError(
```

### [직접 확인] policy/job-posting.mjs:49
```

export function assertJobChange(current, patch = {}, publishing = false) {
  if (!current || typeof current !== 'object') throw new Error(spec.messages.policy_unavailable)
  const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
  if (definedPatch.active === false || definedPatch.admin_hidden === true) return result('allow', 'depublication')
  const contentChanged = ['title', 'description', 'category'].some(key => key in definedPatch && definedPatch[key] !== current[key])
  if (!publishing && !contentChanged && definedPatch.active !== true && definedPatch.admin_hidden !== false) return result('allow', 'unchanged_policy_content')
  return assertJobPolicy({ ...current, ...definedPatch })
```

### [직접 확인] scripts/test-job-policy-sql.mjs:36
```
// Normal retail/mart/production/QC lifecycle, entirely in the disposable DB.
const normalCases = cases.filter(c => ['retail', 'mart', 'production high salary', 'qc high salary'].includes(c.name))
assert.equal(normalCases.length, 4)
for (const [index, c] of normalCases.entries()) {
  const id = 100 + index
  await db.query('INSERT INTO local_jobs VALUES ($1,$2,$3,$4,true,false)', [id,c.job.title,c.job.description,''])
  await db.query('UPDATE local_jobs SET description=$1 WHERE id=$2', [c.job.description + ' ca',id])
  await db.query('UPDATE local_jobs SET active=false WHERE id=$1', [id])
```

