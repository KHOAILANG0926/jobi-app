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
    <div style={{ background: '#f7f8fc', minHeight: '100vh' }}>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 50%, #e67e22 100%)',
        padding: '36px 24px 32px',
        textAlign: 'center',
        color: '#fff'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🇰🇷</div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px' }}>
          Viec lam tai Han Quoc
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
          Tuyen dung chinh thuc tu WorkNet Han Quoc — cap nhat moi ngay
        </p>
        {!loading && (
          <div style={{
            display: 'inline-block',
            marginTop: '16px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            padding: '6px 18px',
            fontSize: '13px',
            fontWeight: 600
          }}>
            {jobs.length} viec lam dang tuyen
          </div>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
            <p style={{ color: '#666', fontSize: '15px' }}>Dang tai va dich danh sach viec lam...</p>
            <p style={{ color: '#aaa', fontSize: '13px', marginTop: '8px' }}>Co the mat 10-20 giay</p>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: '#888' }}>
            Chua co viec lam nao.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {jobs.map((job, idx) => (
              <div key={job.id} style={{
                background: '#fff',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                border: '1px solid #f0f0f0'
              }}>
                {/* Card top accent */}
                <div style={{
                  height: '4px',
                  background: idx % 3 === 0
                    ? 'linear-gradient(90deg, #c0392b, #e74c3c)'
                    : idx % 3 === 1
                    ? 'linear-gradient(90deg, #2980b9, #3498db)'
                    : 'linear-gradient(90deg, #27ae60, #2ecc71)'
                }} />

                <div style={{ padding: '20px' }}>
                  {/* Title */}
                  <h2 style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#1a1a1a',
                    marginBottom: '12px',
                    lineHeight: '1.4'
                  }}>
                    {job.title_vi || job.title}
                  </h2>

                  {/* Info chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                    <span style={{
                      background: '#fff3f3', color: '#c0392b',
                      borderRadius: '20px', padding: '4px 12px',
                      fontSize: '12px', fontWeight: 600
                    }}>
                      🏢 {job.company}
                    </span>
                    <span style={{
                      background: '#f0f7ff', color: '#2980b9',
                      borderRadius: '20px', padding: '4px 12px',
                      fontSize: '12px', fontWeight: 600
                    }}>
                      📍 {job.region}
                    </span>
                    <span style={{
                      background: '#f0fff4', color: '#27ae60',
                      borderRadius: '20px', padding: '4px 12px',
                      fontSize: '12px', fontWeight: 600
                    }}>
                      💰 {job.salary}
                    </span>
                    {job.deadline && (
                      <span style={{
                        background: '#fffbf0', color: '#e67e22',
                        borderRadius: '20px', padding: '4px 12px',
                        fontSize: '12px', fontWeight: 600
                      }}>
                        ⏰ {job.deadline}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {job.description_vi && (
                    <p style={{
                      fontSize: '13px',
                      color: '#555',
                      lineHeight: '1.7',
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#f9f9f9',
                      borderRadius: '10px',
                      borderLeft: '3px solid #e0e0e0'
                    }}>
                      {job.description_vi}
                    </p>
                  )}

                  {/* CTA button */}
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
                      color: '#fff',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 2px 8px rgba(192,57,43,0.3)'
                    }}
                  >
                    Xem chi tiet va ung tuyen
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
