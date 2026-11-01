// 공고 1개 자동 검사표 실행기(2026-10-25 Lee 결정). job-ocr-check.yml에서 OCR 대조·상세요강 만들기 뒤에 실행.
// 공고 내용이나 검사 규칙이 바뀐 공고만 다시 검사하고, 결과가 바뀌면 이슈 "공고 검사표"에 쉬운 말로 남긴다(Lee에게 메일·앱 알림).
// 결과는 local_jobs.ocr_check.inspect에 저장. 크롤링 시작 조건: 새 공고 연속 10개 통과("연속 통과 N/10").
// 필요 환경변수: SUPABASE_DB_URL, (알림용) GH_TOKEN·REPO
import pg from 'pg'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { inspectJob, inspectReport, publishDecision } from '../../src/lib/jobInspect.ts'

const { SUPABASE_DB_URL, GH_TOKEN, REPO } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
const RULES = ['jobInspect.ts', 'jobDetailSections.ts', 'jobDescriptionBuild.ts', 'jobDetailFill.ts'].map((f) => readFileSync(new URL(`../../src/lib/${f}`, import.meta.url), 'utf8')).join('\n')
const VERSION = 'inspect-v1:' + createHash('md5').update(RULES).digest('hex').slice(0, 8)
const STREAK_GOAL = 10

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const reports = []
try {
  const { rows } = await client.query(`
    select public.job_inspect_content_hash(j) as content_hash, coalesce((j.ocr_check->>'inspect_hold')::boolean, false) as hold,
           j.application_deadline, j.id, j.title, j.contact_name, j.company, j.salary, j.employer_phone, j.contact_zalo, j.location, j.description, j.source_text,
           j.category, j.occupation_code, j.active, j.admin_hidden, j.shuttle_bus, j.dormitory, j.meal_provided,
           j.age_requirement, j.gender_requirement, j.education, j.preference, j.num_hires, j.language_requirement, j.required_documents, j.hours, j.work_days,
           coalesce(jsonb_array_length(case when jsonb_typeof(j.images) = 'array' then j.images end), 0) as image_count,
           j.ocr_check->>'status' as ocr_status,
           coalesce(j.ocr_check->'detail_fill'->'unclassified', '[]'::jsonb) as unclassified,
           j.ocr_check->'inspect' as prev,
           coalesce((select array_agg(w.raw_address) from public.job_work_locations w where w.job_id = j.id), '{}') as addresses,
           case when exists (select 1 from public.job_work_locations w where w.job_id = j.id and w.lat is not null) then 'exact'
                else (select s.result->>'kind' from public.map_r1_location_jobs s where s.job_id = j.id and s.result->>'kind' in ('gate','area')) end as pin,
           (select u.reason from public.map_r1_unlocated u where u.job_id = j.id) as unlocated_reason
    from public.local_jobs j
    where j.origin in ('crawler','admin')
    order by j.id`)
  for (const job of rows) {
    const input = {
      id: Number(job.id), title: job.title, company: job.company, contact_name: job.contact_name, salary: job.salary, description: job.description, source_text: job.source_text,
      phones: [job.employer_phone, job.contact_zalo], addresses: [job.location, ...job.addresses],
      values: [job.age_requirement, job.gender_requirement, job.education, job.preference, job.num_hires, job.language_requirement, job.required_documents],
      valueGroups: [[job.hours, job.work_days]],
      category: job.category, occupation_code: job.occupation_code, active: job.active, admin_hidden: job.admin_hidden,
      image_count: job.image_count, ocr_status: job.ocr_status, pin: job.pin, unlocated_reason: job.unlocated_reason,
      shuttle_bus: job.shuttle_bus, dormitory: job.dormitory, meal_provided: job.meal_provided, unclassified_lines: job.unclassified,
    }
    const r0 = inspectJob(input)
    // 공개 여부(public 항목)는 검사 결과가 아니라 이 판정의 결과다. 나머지 항목이 전부 통과해야 공개할 수 있다.
    const d = publishDecision(r0, { active: job.active, admin_hidden: job.admin_hidden, hold: job.hold, application_deadline: job.application_deadline })
    const items = r0.items.map((i) => i.key !== 'public' ? i
      : { ...i, ok: d.active && !job.admin_hidden, detail: job.admin_hidden ? '관리자가 숨김' : d.active ? undefined : d.publishable ? '비공개' : '검사 실패로 비공개 보류' })
    const r = { ok: items.every((i) => i.ok), items }
    const hash = createHash('md5').update(VERSION + JSON.stringify(r)).digest('hex')
    // 결과 지문이 같아도 공고 내용 지문이 바뀌었거나 공개 상태를 바꿔야 하면 반드시 다시 기록한다.
    if (job.prev?.hash === hash && job.prev?.content_hash === job.content_hash && d.active === !!job.active && !job.hold) continue
    const inspect = { version: VERSION, hash, content_hash: job.content_hash, publishable: d.publishable, ok: r.ok, checked_at: new Date().toISOString(), items: r.items }
    const recorded = await client.query(`update public.local_jobs
      set ocr_check = (coalesce(ocr_check, '{}'::jsonb) - 'inspect_hold') || jsonb_build_object('inspect', $2::jsonb),
          active = $3::boolean
      where id = $1 and public.job_inspect_content_hash(local_jobs) = $4
      returning active`,
      [job.id, JSON.stringify(inspect), d.active, job.content_hash])
    if (recorded.rowCount !== 1) {
      console.warn(`#${job.id} 검사 중 공고 내용 변경: 다음 실행에서 재검사`)
      continue
    }
    // 다른 공개 규정(R4·R7·R8 트리거)이 공개를 막았으면 기록도 실제 상태로 맞춘다.
    if (recorded.rows[0].active !== d.active) {
      const pub = items.find((i) => i.key === 'public')
      pub.ok = false; pub.detail = '다른 공개 규정이 비공개 유지'
      r.ok = false
      await client.query(`update public.local_jobs set ocr_check = jsonb_set(ocr_check, '{inspect}', $2::jsonb) where id = $1`,
        [job.id, JSON.stringify({ ...inspect, ok: false, items })])
    }
    // 관리자가 숨긴 공고는 알림하지 않는다(Lee가 이미 뺀 공고)
    if (!job.admin_hidden) reports.push(inspectReport({ id: job.id, title: job.title }, r))
    console.log(`#${job.id} ${r.ok ? '통과' : '문제 ' + r.items.filter((i) => !i.ok).length + '개'}`)
  }
  // 연속 통과: 최근 공고부터(숨긴 공고 제외) 통과가 몇 개 이어지는지
  const { rows: recent } = await client.query(`
    select (ocr_check->'inspect'->>'ok')::boolean as ok from public.local_jobs
    where origin in ('crawler','admin') and not admin_hidden order by created_at desc, id desc limit 50`)
  let streak = 0
  for (const x of recent) { if (x.ok) streak++; else break }
  console.log(`연속 통과 ${streak}/${STREAK_GOAL}`)
  if (reports.length && GH_TOKEN && REPO) {
    const title = '공고 검사표'
    const body = `${reports.join('\n\n')}\n\n**연속 통과 ${streak}/${STREAK_GOAL}** ${streak >= STREAK_GOAL ? '— 크롤링 시작 조건 충족' : '(10개가 되면 크롤링 시작 조건 충족)'}`
    const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()
    const num = gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--search', `"${title}" in:title`, '--json', 'number', '--jq', '.[0].number // empty'])
    if (num) gh(['issue', 'comment', num, '--repo', REPO, '--body', body])
    else gh(['issue', 'create', '--repo', REPO, '--title', title, '--body', body])
  }
} finally {
  await client.end()
}
