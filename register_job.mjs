import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// crawler/.env(gitignore 처리됨)에서 자격증명을 읽는다 — 저장소에 키를 하드코딩하지 않는다.
const env = {}
for (const line of fs.readFileSync(new URL('./crawler/.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const jobsFile = process.argv[2]
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'))

for (const job of jobs) {
  // 이미지 업로드
  if (job._imagePath) {
    const bytes = fs.readFileSync(job._imagePath)
    const ext = job._imagePath.split('.').pop()
    const fileName = `job_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await supabase.storage.from('job-images').upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true })
    if (upErr) { console.log('upload error:', upErr.message); continue }
    job.image_url = supabase.storage.from('job-images').getPublicUrl(fileName).data.publicUrl
    delete job._imagePath
  }
  job.posted_at = new Date().toISOString()
  const { data, error } = await supabase.from('local_jobs').insert(job).select('id, title')
  if (error) console.log('error:', error.message)
  else console.log('등록완료 ID:', data[0].id, '-', data[0].title)
}
