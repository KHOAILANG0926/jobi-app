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

export function KoreaJobs() {
  const [jobs, setJobs] = useState<KoreaJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('korea_jobs')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error(error)
        else setJobs(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="korea-jobs">
      <h1>🇰🇷 Việc làm tại Hàn Quốc</h1>
      <p>Thông tin tuyển dụng chính thức từ WorkNet Hàn Quốc</p>
      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="korea-jobs__list">
          {jobs.map((job) => (
            <div key={job.id} className="korea-jobs__card">
              <h2>{job.title}</h2>
              <p>🏢 {job.company} | 📍 {job.region} | 💰 {job.salary}</p>
              <p>{job.description}</p>
              <a href={job.source_url} target="_blank" rel="noopener noreferrer">Xem chi tiết </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
