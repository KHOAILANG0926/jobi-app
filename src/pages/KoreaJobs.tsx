import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

interface KoreaJob {
  id: number
  title: string
  company: string
  region: string
  salary: string
  deadline: string
  source_url: string
  description: string
}

interface TranslatedJob extends KoreaJob {
  title_vi: string
  description_vi: string
}

async function translateToVietnamese(text: string): Promise<string> {
  if (!text) return ''
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Dich sang tieng Viet, chi tra loi ban dich, khong giai thich:\n${text}`
        }]
      })
    })
    const data = await response.json()
    return data.content?.[0]?.text ?? text
  } catch {
    return text
  }
}

export default function KoreaJobs() {
  const [jobs, setJobs] = useState<TranslatedJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('korea_jobs')
      .select('*')
      .then(async ({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return }
        const translated = await Promise.all((data ?? []).map(async (job: KoreaJob) => ({
          ...job,
          title_vi: await translateToVietnamese(job.title),
          description_vi: await translateToVietnamese(job.description),
        })))
        setJobs(translated)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111' }}>
          Viec lam tai Han Quoc
        </h1>
        <p style={{ color: '#666', marginTop: '4px' }}>
          Thong tin tuyen dung chinh thuc tu WorkNet Han Quoc
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
          Dang tai va dich danh sach viec lam...
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
          Chua co viec lam nao.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {jobs.map((job) => (
            <div key={job.id} style={{
              background: '#fff',
              border: '1px solid #eee',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111', marginBottom: '8px' }}>
                {job.title_vi || job.title}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', color: '#555', fontSize: '14px', marginBottom: '10px' }}>
                <span>Cong ty: {job.company}</span>
                <span>Khu vuc: {job.region}</span>
                <span>Luong: {job.salary}</span>
                {job.deadline && <span>Han: {job.deadline}</span>}
              </div>
              {job.description_vi && (
                <p style={{ fontSize: '14px', color: '#444', marginBottom: '12px', lineHeight: '1.6' }}>
                  {job.description_vi}
                </p>
              )}
              <a
                href={job.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: '#0ea5e9',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  textDecoration: 'none'
                }}
              >
                Xem chi tiet
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
