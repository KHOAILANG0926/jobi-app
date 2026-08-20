import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// crawler/.env(gitignore 처리됨)에서 자격증명을 읽는다 — 저장소에 키를 하드코딩하지 않는다.
const env = {}
for (const line of fs.readFileSync(new URL('./crawler/.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const company = process.argv[2] || ''
const { data } = await supabase.from('local_jobs').select('id, title, location, company').ilike('company', `%${company}%`)
if (!data || data.length === 0) console.log('중복 없음')
else data.forEach(d => console.log(`ID ${d.id} | ${d.company} | ${d.title} | ${d.location}`))
