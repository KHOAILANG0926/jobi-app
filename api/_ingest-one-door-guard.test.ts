// 공고 등록은 DB 입구 public.ingest_job 하나만 (Lee 2026-10-29, migration 20261029010000_ingest_one_door).
// DB가 입구 밖 INSERT를 거부하지만, 새 코드가 직접 넣는 길을 만들면 운영에서야 실패한다.
// 그래서 PR 검사(npm test)에서 미리 막는다: local_jobs에 직접 insert/upsert하는 코드가 새로 생기면 실패.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ONE_DOOR_MIGRATION = '20261029010000'
// 이미 운영에 적용돼 다시 돌지 않는 기록, 입구 적용 전 fixture를 만드는 시험, 연구용 파일만 예외.
const exempt = (file: string) =>
  /^supabase\/(tests|pending)\//.test(file) ||
  /^scripts\/research\//.test(file) ||
  /^scripts\/ops\/jobs\/.+\.sql$/.test(file) ||
  /^scripts\/ci\/(postgres-location-fixture|reference-location-fixed)\.sql$/.test(file) ||
  (file.startsWith('supabase/migrations/') && file.slice('supabase/migrations/'.length, 'supabase/migrations/'.length + 14) <= ONE_DOOR_MIGRATION) ||
  /(^|\/)test_[^/]+\.py$/.test(file) || /\.test\.(ts|tsx|mjs|js)$/.test(file) ||
  file === 'api/_ingest-one-door-guard.test.ts'

const patterns: Array<[string, RegExp]> = [
  // 같은 호출 사슬 안에서만 본다(다음 from(/table( 이나 ; 를 넘지 않음)
  ['JS local_jobs insert/upsert', /from\(\s*['"`]local_jobs['"`]\s*\)(?:(?!from\(|;)[\s\S]){0,400}?\.(insert|upsert)\s*\(/],
  ['Python local_jobs insert/upsert', /table\(\s*['"]local_jobs['"]\s*\)(?:(?!table\(|\n)[\s\S]){0,300}?\.(insert|upsert)\s*\(/],
  ['SQL insert into local_jobs', /insert\s+into\s+(public\.)?local_jobs(?![a-z_])/i],
]

export function findDirectInserts(files: Array<{ file: string, text: string }>) {
  const found: string[] = []
  for (const { file, text: raw } of files) {
    if (exempt(file)) continue
    // "직접 넣으면 거부되는지" 확인하는 시험 줄은 그 줄에 표시를 단다: ingest-guard: expect-denied
    const text = raw.split('\n').filter(line => !line.includes('ingest-guard: expect-denied')).join('\n')
    for (const [label, rx] of patterns) if (rx.test(text)) found.push(`${file}: ${label}`)
  }
  return found
}

// 검사 자체가 잡는지 확인(가짜 파일)
const probe = findDirectInserts([
  { file: 'src/x.ts', text: "await supabase.from('local_jobs')\n  .insert({ title })" },
  { file: 'crawler/x.py', text: 'supabase.table("local_jobs").upsert(rows).execute()' },
  { file: 'supabase/migrations/20991231000000_x.sql', text: 'insert into public.local_jobs(title) values (1);' },
  { file: 'scripts/x.mjs', text: "db.from('local_jobs').update({a:1}); db.from('other').insert({})" },
  { file: 'supabase/migrations/20991231000001_y.sql', text: 'insert into public.local_jobs_description_backup values (1);' },
  { file: 'scripts/y.mjs', text: "await denied(c.from('local_jobs').insert({}).select(), 'x') // ingest-guard: expect-denied" },
  { file: 'api/z.js', text: "await db.from('local_jobs').select('id').eq('id',1)\n await db.from('other').upsert({})" },
])
if (probe.length !== 3) throw new Error('guard self-check failed: ' + JSON.stringify(probe))

const tracked = execFileSync('git', ['ls-files', 'src', 'api', 'scripts', 'crawler', 'supabase/migrations', '.github/workflows'], { encoding: 'utf8' })
  .split('\n').filter(f => /\.(ts|tsx|js|mjs|py|sql|yml)$/.test(f))
const offenders = findDirectInserts(tracked.map(file => ({ file, text: readFileSync(file, 'utf8') })))
if (offenders.length) {
  throw new Error('공고 등록은 public.ingest_job(입구)으로만 합니다. 직접 local_jobs에 넣는 코드:\n' + offenders.join('\n'))
}
console.log(`ingest one-door guard: ${tracked.length} files checked, no direct local_jobs insert — all assertions passed`)
