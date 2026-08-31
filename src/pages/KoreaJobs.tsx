import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchKoreaJobs } from '../lib/koreaJobsApi'
import type { KoreaJob } from '../types/koreaJob'

function formatSalary(job: KoreaJob): string | null {
  if (job.salary_min != null || job.salary_max != null) {
    const unit = job.salary_type === 'hourly' ? '/giờ'
      : job.salary_type === 'daily' ? '/ngày'
      : job.salary_type === 'annual' ? '/năm'
      : '/tháng'
    const min = job.salary_min != null ? job.salary_min.toLocaleString('ko-KR') : null
    const max = job.salary_max != null ? job.salary_max.toLocaleString('ko-KR') : null
    if (min && max && min !== max) return `${min} - ${max} KRW${unit}`
    if (min || max) return `${min ?? max} KRW${unit}`
  }
  return job.salary
}

function formatLocation(job: KoreaJob): string | null {
  if (job.province) return job.district ? `${job.province} ${job.district}` : job.province
  return job.region
}

export default function KoreaJobs() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<KoreaJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchKoreaJobs().then((data) => {
      if (!cancelled) { setJobs(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh' }}>
      <div style={{
        background: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 50%, #e67e22 100%)',
        padding: '36px 24px 32px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🇰🇷</div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px' }}>
          Làm việc tại Hàn Quốc
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
          Danh sách việc làm tại Hàn Quốc
        </p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
            <p style={{ color: '#666', fontSize: '15px' }}>Đang tải danh sách việc làm...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: '#888' }}>
            Chưa có việc làm nào.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {jobs.map((job, idx) => (
              <div
                key={job.id}
                onClick={() => navigate(`/viec-han-quoc/${job.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/viec-han-quoc/${job.id}`) }}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  height: '4px',
                  background: idx % 3 === 0
                    ? 'linear-gradient(90deg, #c0392b, #e74c3c)'
                    : idx % 3 === 1
                    ? 'linear-gradient(90deg, #2980b9, #3498db)'
                    : 'linear-gradient(90deg, #27ae60, #2ecc71)',
                }} />
                <div style={{ padding: '20px' }}>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px', lineHeight: '1.4' }}>
                    {job.title}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {job.company && (
                      <span style={{ background: '#fff3f3', color: '#c0392b', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                        🏢 {job.company}
                      </span>
                    )}
                    {formatLocation(job) && (
                      <span style={{ background: '#f0f7ff', color: '#2980b9', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                        📍 {formatLocation(job)}
                      </span>
                    )}
                    {formatSalary(job) && (
                      <span style={{ background: '#f0fff4', color: '#27ae60', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                        💰 {formatSalary(job)}
                      </span>
                    )}
                    {job.deadline && (
                      <span style={{ background: '#fffbf0', color: '#e67e22', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
                        ⏰ {job.deadline}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
