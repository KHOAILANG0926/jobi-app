// 공고 1개 자동 검사표 실행기(2026-10-25 Lee 결정). job-ocr-check.yml에서 OCR 대조·상세요강 만들기 뒤에 실행.
// 공고 내용이나 검사 규칙이 바뀐 공고만 다시 검사하고, 결과가 바뀌면 이슈 "공고 검사표"에 쉬운 말로 남긴다(Lee에게 메일·앱 알림).
// 결과는 local_jobs.ocr_check.inspect에 저장. 크롤링 시작 조건: 새 공고 연속 10개 통과("연속 통과 N/10").
// 필요 환경변수: SUPABASE_DB_URL, (알림용) GH_TOKEN·REPO
import pg from 'pg'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { inspectJob, inspectReport, publishDecision, INSPECT_KEYS, INFO_ONLY, SCREEN_WAIT } from '../../src/lib/jobInspect.ts'
import { afterCutoff } from './auto-cutoff.mjs'
import { SCREEN_CANDIDATES } from './screen-collect.mjs'
import { photoSource } from '../../src/lib/logoLookup.ts'
import { assembleBrands } from '../../src/lib/brandRows.ts'

const { SUPABASE_DB_URL, GH_TOKEN, REPO } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
const RULES = ['jobInspect.ts', 'jobDetailSections.ts', 'jobDescriptionBuild.ts', 'jobDetailFill.ts', 'logoLookup.ts', 'companyLogo.ts'].map((f) => readFileSync(new URL(`../../src/lib/${f}`, import.meta.url), 'utf8')).join('\n')
const VERSION = 'inspect-v1:' + createHash('md5').update(RULES).digest('hex').slice(0, 8)
const STREAK_GOAL = 10

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const reports = []
try {
  // 규정 = 검사(2026-11-01): 규정 표가 가리키는 검사표 항목이 실제로 있는지 매번 확인. 없으면 실패(빨간불).
  const refs = await client.query(`select rule_key, ref from public.job_posting_rules, unnest(coalesce(check_ref, '{}')) as ref where ref like 'inspect:%'`).then((r) => r.rows, () => [])
  const missing = refs.filter((r) => !INSPECT_KEYS.includes(r.ref.slice(8)))
  if (missing.length) { console.error('::error::규정이 가리키는 검사표 항목 없음: ' + missing.map((m) => `${m.rule_key}→${m.ref}`).join(', ')); process.exitCode = 3 }

  // 대표 사진·로고 출처(Lee 2026-11-07): 화면과 같은 브랜드 목록
  const brands = assembleBrands(
    (await client.query(`select id,name,slug,category,domain,logo_url,initial,color,active,featured from public.job_brands where active`)).rows,
    (await client.query(`select brand_id,alias,is_primary from public.job_brand_aliases where active`)).rows)
  const selectJobs = (where) => client.query(`
    select public.job_inspect_content_hash(j) as content_hash, (coalesce((j.ocr_check->>'inspect_hold')::boolean, false)
             -- OCR이 공개 중이던 공고를 내린 표지(ocr-check-write.mjs): OCR이 검사표보다 먼저 정상으로 돌아와도 되살린다(Codex P1, #728 R4)
             or coalesce((j.ocr_check->>'ocr_hold')::boolean, false)
             -- 검사 실패로 내린 공고도 다시 통과하면 되살린다(관리자가 직접 내린 공고는 해당 없음)
             or exists (select 1 from jsonb_array_elements(coalesce(j.ocr_check->'inspect'->'items', '[]'::jsonb)) i
                        where i->>'key' = 'public' and i->>'detail' = '검사 실패로 비공개 보류')) as hold,
           j.origin, j.application_deadline, j.employment_type, j.work_period, j.id, j.title, j.contact_name, j.company, j.salary, j.employer_phone, j.contact_zalo, j.location, j.description, j.source_text,
           j.category, j.occupation_code, j.active, j.admin_hidden, j.shuttle_bus, j.dormitory, j.meal_provided,
           j.age_requirement, j.gender_requirement, j.education, j.preference, j.num_hires, j.language_requirement, j.required_documents, j.hours, j.work_days,
           coalesce(jsonb_array_length(case when jsonb_typeof(j.images) = 'array' then j.images end), 0) as image_count,
           j.ocr_check->>'status' as ocr_status,
           j.image_url, j.images, j.company_domain, j.logo_lookup->>'result' as logo_result, j.created_at,
           coalesce(j.ocr_check->'detail_fill'->'unclassified', '[]'::jsonb) as unclassified,
           coalesce(j.ocr_check->'detail_fill'->'still_missing', '[]'::jsonb) as still_missing,
           j.ocr_check->'inspect' as prev, j.ocr_check->'screen_audit' as screen_audit,
           coalesce((select array_agg(w.raw_address) from public.job_work_locations w where w.job_id = j.id), '{}') as addresses,
           -- 2026-11-07 수평 전개(#5599): 화면(src/lib/jobCoords.ts precise·mapR1 locationPoints)과 같은 기준.
           -- 정확한 위치 = 핀 종류 exact + 확인됨(location_verified). 좌표만 있다고 정확한 위치가 아니다(대략 위치에도 좌표가 있음, 10-28 핀 무조건).
           coalesce((select case when bool_or(w.point_kind = 'exact' and w.location_verified) then 'exact'
                        when bool_or(w.point_kind = 'gate') then 'gate'
                        when bool_or(w.point_kind in ('exact','area') and w.lat is not null) then 'area' end
              from public.job_work_locations w where w.job_id = j.id)
           , (select s.result->>'kind' from public.map_r1_location_jobs s where s.job_id = j.id and s.result->>'kind' in ('gate','area'))) as pin,
           (select u.reason from public.map_r1_unlocated u where u.job_id = j.id) as unlocated_reason
    from public.local_jobs j
    where ${where}
    order by j.id`).then((r) => r.rows)
  // 자동 작업 대상: 수집·관리자 공고 중 기준 시각 이후(Lee 2026-11-01: 기존 공고는 건드리지 않는다)
  // 승인 대기 짝 변경(supabase/pending/20261113000000_inspect_gate_employer_legacy.sql, #728 R2 A4): DB가 공개 시작을 막아 inspect_hold를 건 고용주·legacy 공고도 검사 대상.
  // hold가 걸린 것만 — 고용주가 직접 내린 공고(hold 없음)는 검사기가 다시 올리지 않는다(publishDecision은 hold가 있는 공고만 공개).
  const SCOPE = `((j.origin in ('crawler','admin') and ${afterCutoff('j')}) or (j.origin in ('employer','legacy') and coalesce(j.ocr_check->>'inspect_hold', '') = 'true'))`
  const rows = await selectJobs(SCOPE)
  const toInput = (job) => ({
    id: Number(job.id), title: job.title, company: job.company, contact_name: job.contact_name, salary: job.salary, description: job.description, source_text: job.source_text,
    // Lee 2026-11-06 "비워두고 공개해야지": 원문에 없는 필수 항목은 비워 둔 채 공개한다 — 누락은 경고만(모든 공고).
    // 고용형태는 employment_type이 없으면 원문에서 옮긴 work_period(화면 "Hình thức làm việc"와 같은 값)로 본다.
    postingFields: { hours: job.hours, employment_type: job.employment_type || job.work_period, application_deadline: job.application_deadline, num_hires: job.num_hires, reviewOnly: true },
    phones: [job.employer_phone, job.contact_zalo], addresses: [job.location, ...job.addresses],
    values: [job.age_requirement, job.gender_requirement, job.education, job.preference, job.num_hires, job.language_requirement, job.required_documents],
    valueGroups: [[job.hours, job.work_days]],
    category: job.category, occupation_code: job.occupation_code, active: job.active, admin_hidden: job.admin_hidden,
    image_count: job.image_count, ocr_status: job.ocr_status, pin: job.pin, unlocated_reason: job.unlocated_reason,
    shuttle_bus: job.shuttle_bus, dormitory: job.dormitory, meal_provided: job.meal_provided, unclassified_lines: job.unclassified,
    still_missing_lines: job.still_missing,
    photo: photoSource({ company: job.company ?? '', title: job.title ?? '', imageUrl: job.image_url ?? undefined, companyDomain: job.company_domain ?? undefined,
      images: Array.isArray(job.images) ? job.images.map((x) => (typeof x === 'string' ? x : x?.url ?? x?.path ?? '')).filter(Boolean) : undefined,
      lookupResult: job.logo_result, createdAt: job.created_at instanceof Date ? job.created_at.toISOString() : job.created_at }, brands),
    screen: screenState(job),
  })
  // 화면 대조(#646): 같은 내용 지문의 기록만 쓴다. 비공개 공고는 대조 전이면 대기, 이미 공개 중이면 공개 유지(대조 기록 없음).
  function screenState(job) {
    const a = job.screen_audit
    if (a && a.content_hash === job.content_hash) {
      const sure = (a.findings ?? []).filter((f) => f.sure)
      return sure.length ? { state: 'fail', detail: sure.slice(0, 3).map((f) => `[${f.device}] ${f.detail}`).join(' / ') }
        : { state: 'ok', unsure: (a.findings ?? []).length }
    }
    return { state: job.active ? 'none' : 'pending' }
  }
  for (const job of rows) {
    // Do not retroactively withdraw postings that were already public when this
    // new check first ran. Persist the rollout mode; new/held postings stay strict.
    const requiredFieldsEnforced = job.prev?.required_fields_enforced ?? !job.active
    const input = toInput(job)
    const r0 = inspectJob(input)
    // 공개 여부(public 항목)는 검사 결과가 아니라 이 판정의 결과다. 나머지 항목이 전부 통과해야 공개할 수 있다.
    const d = publishDecision(r0, { active: job.active, admin_hidden: job.admin_hidden, hold: job.hold, application_deadline: job.application_deadline })
    const items = r0.items.map((i) => i.key !== 'public' ? i
      : { ...i, ok: d.active && !job.admin_hidden, detail: job.admin_hidden ? '관리자가 숨김' : d.active ? undefined : d.publishable ? '비공개' : '검사 실패로 비공개 보류' })
    const r = { ok: items.every((i) => i.ok || INFO_ONLY.includes(i.key)), items }
    const hash = createHash('md5').update(VERSION + JSON.stringify(r)).digest('hex')
    // 결과 지문이 같아도 공고 내용 지문이 바뀌었거나 공개 상태를 바꿔야 하면 반드시 다시 기록한다.
    if (job.prev?.hash === hash && job.prev?.content_hash === job.content_hash && d.active === !!job.active && !job.hold) continue
    // 화면 대조만 남은 비공개 공고 = 대조 대상(detail-read.mjs SCREEN_CANDIDATES가 읽음)
    const screenWaitOnly = !d.publishable && !job.admin_hidden && r0.items.some((i) => i.key === 'screen' && i.detail === SCREEN_WAIT) &&
      publishDecision({ ...r0, items: r0.items.filter((i) => i.key !== 'screen') }, { active: job.active, admin_hidden: job.admin_hidden, hold: job.hold, application_deadline: job.application_deadline }).publishable
    const inspect = { version: VERSION, hash, content_hash: job.content_hash, required_fields_enforced: requiredFieldsEnforced, publishable: d.publishable, ok: r.ok, checked_at: new Date().toISOString(), items: r.items, ...(screenWaitOnly ? { screen_wait: true } : {}) }
    // 고용주·legacy 공고는 검사 대기 표지(inspect_hold)가 범위 조건이라, 아직 공개 못 한 동안(화면 대조 대기 포함) 유지해야 다음 단계(화면 대조·재검사)에 닿는다.
    // 공개되거나 관리자가 숨기면 제거(소유자가 직접 내린 공고는 hold가 없어 애초에 범위 밖).
    const keepHold = ['employer', 'legacy'].includes(job.origin) && !d.active && !job.admin_hidden
    const recorded = await client.query(`update public.local_jobs
      set ocr_check = (case when $5::boolean then coalesce(ocr_check, '{}'::jsonb) else coalesce(ocr_check, '{}'::jsonb) - 'inspect_hold' end
                       - case when $3::boolean or $6::boolean then 'ocr_hold' else '' end) || jsonb_build_object('inspect', $2::jsonb),   -- OCR 내림 표지는 다시 공개되거나 관리자가 숨기면 지운다
          active = $3::boolean
      where id = $1 and public.job_inspect_content_hash(local_jobs) = $4
        and (origin in ('crawler','admin') or coalesce(ocr_check->>'inspect_hold', '') = 'true')   -- 읽은 뒤 소유자가 철회(hold 제거)했으면 덮어쓰지 않는다(Codex #797)
      returning active`,
      [job.id, JSON.stringify(inspect), d.active, job.content_hash, keepHold, !!job.admin_hidden])
    if (recorded.rowCount !== 1) {
      console.warn(`#${job.id} 검사 중 공고 내용 변경: 다음 실행에서 재검사`)
      continue
    }
    // 다른 공개 규정(R4·R7·R8 트리거)이 공개를 막았으면 기록도 실제 상태로 맞춘다.
    if (recorded.rows[0].active !== d.active) {
      const pub = items.find((i) => i.key === 'public')
      pub.ok = false; pub.detail = '다른 공개 규정이 비공개 유지'
      r.ok = false
      await client.query(`update public.local_jobs set ocr_check = jsonb_set(ocr_check, '{inspect}', $2::jsonb) || (case when $3::boolean then '{"inspect_hold": true}'::jsonb else '{}'::jsonb end) where id = $1`,
        [job.id, JSON.stringify({ ...inspect, ok: false, items }), ['employer', 'legacy'].includes(job.origin) && !job.admin_hidden])
    }
    // 관리자가 숨긴 공고는 알림하지 않는다(Lee가 이미 뺀 공고). 화면 대조 대기만 남은 공고는 같은 실행에서 대조 뒤 다시 검사하므로 그때 알린다.
    if (!screenWaitOnly && !job.admin_hidden) reports.push(inspectReport({ id: job.id, title: job.title }, r))
    console.log(`#${job.id} ${r.ok ? '통과' : '문제 ' + r.items.filter((i) => !i.ok).length + '개'}`)
  }
  // 연속 통과: 최근 공고부터(숨긴 공고 제외) 통과가 몇 개 이어지는지
  const { rows: recent } = await client.query(`
    select (ocr_check->'inspect'->>'ok')::boolean as ok from public.local_jobs
    where origin in ('crawler','admin') and not admin_hidden order by created_at desc, id desc limit 50`)
  let streak = 0
  for (const x of recent) { if (x.ok) streak++; else break }
  console.log(`연속 통과 ${streak}/${STREAK_GOAL}`)
  // 화면 대조 대상(#646): 화면 대조만 남은 비공개 공고 + 확정 오류로 막힌 지 3시간 지난 공고(화면 코드가 고쳐졌을 수 있어 다시 대조)
  const screenWait = Number((await client.query(`select count(*)::int as n from public.local_jobs j where ${SCREEN_CANDIDATES}`)).rows[0].n)
  console.log(`화면 대조 대기 ${screenWait}건`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `screen_wait=${screenWait}\n`)
  // 읽기 전용 검사(Lee 2026-11-09): 자동 작업 대상 밖 공고(고용주 직접 등록·기준 시각 이전 등)에도 같은 검사(inspectJob)를 돌려 결과만 알린다.
  // DB에는 아무것도 쓰지 않는다 — 공고 내용·공개 상태·검사 기록 그대로, 과거 공고 자동 수정 없음. 관리자가 숨긴 공고는 제외.
  const outside = await selectJobs(`not (${SCOPE}) and not j.admin_hidden`)
  const outsideBad = []
  for (const job of outside) {
    let bad
    // 읽기 전용 검사가 실패해도 위의 본 검사 결과에는 영향 없게(경고만, 다음 실행에 다시)
    try { bad = inspectJob(toInput(job)).items.filter((i) => i.key !== 'public' && !i.ok && !INFO_ONLY.includes(i.key)) }
    catch (e) { console.log(`::warning::#${job.id} 읽기 전용 검사 실패: ${e.message}`); continue }
    if (bad.length) outsideBad.push(`- #${job.id} (${job.origin ?? '?'}·${job.active ? '공개' : '비공개'}) ${String(job.title ?? '').slice(0, 50)}: ${bad.map((i) => i.label + (i.detail ? ` — ${i.detail}` : '')).join(' / ')}`)
  }
  console.log(`읽기 전용 검사(대상 밖) ${outside.length}건, 문제 있음 ${outsideBad.length}건`)
  for (const line of outsideBad) console.log(line)
  const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
  const title = '공고 검사표'
  const issue = () => gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--search', `"${title}" in:title`, '--json', 'number', '--jq', '.[0].number // empty'])
  const post = (body) => { const num = issue(); if (num) gh(['issue', 'comment', num, '--repo', REPO, '--body', body]); else gh(['issue', 'create', '--repo', REPO, '--title', title, '--body', body]) }
  if (reports.length && GH_TOKEN && REPO) {
    post(`${reports.join('\n\n')}\n\n**연속 통과 ${streak}/${STREAK_GOAL}** ${streak >= STREAK_GOAL ? '— 크롤링 시작 조건 충족' : '(10개가 되면 크롤링 시작 조건 충족)'}`)
  }
  // 대상 밖 결과는 지난번 알림과 달라졌을 때만 남긴다(기록은 이슈 댓글로만 — DB에 쓰지 않음).
  if (GH_TOKEN && REPO) {
    const marker = '<!-- readonly-inspect'
    const digest = createHash('md5').update(VERSION + outsideBad.join('\n')).digest('hex').slice(0, 12)
    const num = issue()
    // 이슈가 없어서 처음 결과를 이슈 본문으로 만든 경우도 있으므로 본문 + 댓글을 순서대로 본다(Codex #593 지적).
    // 댓글 전체를 받으면 너무 커서 실패한다(2026-11-09 ENOBUFS) → 표시가 든 댓글 본문만 한 줄씩(JSON 글자) 받는다.
    const found = num ? gh(['api', `repos/${REPO}/issues/${num}/comments?per_page=100`, '--paginate', '--jq', `.[] | select(.body | contains("${marker}")) | .body | @json`]) : ''
    const issueBody = num ? gh(['api', `repos/${REPO}/issues/${num}`, '--jq', '.body // ""']) : ''
    const last = [issueBody, ...found.split('\n').filter(Boolean).map((l) => JSON.parse(l))].filter((b) => b.includes(marker)).at(-1) ?? ''
    if (!last.includes(digest) && (outsideBad.length || last)) {
      post(`**읽기 전용 검사 — 자동 작업 대상 밖 공고(고용주 직접 등록·기준 시각 이전 등) ${outside.length}건 중 문제 ${outsideBad.length}건**\n` +
        `공고 내용·공개 상태는 바꾸지 않았습니다(표시만). 공개 판정은 기존대로입니다.\n\n${outsideBad.join('\n') || '문제 없음'}\n\n${marker} ${digest} -->`)
    }
  }
} finally {
  await client.end()
}
