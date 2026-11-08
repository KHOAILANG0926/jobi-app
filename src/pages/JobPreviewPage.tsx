// Lee 2026-11-08 "3 적용": 공고 등록 화면 '미리보기' 새 창. 등록 화면이 이 브라우저에 잠깐 둔 입력값을 상세 화면 그대로 보여 준다(저장·등록 없음).
import { useEffect, useState } from 'react'
import { JobDetail } from './JobDetail'
import { PREVIEW_KEY } from '../lib/postJobPreview'
import type { Job } from '../types/job'
import './JobPreviewPage.css'
import './demo/AlbamonTemplateDemo.css'

function readPreview(): Job | null {
  try { const j = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null'); return j && typeof j === 'object' ? (j as Job) : null } catch { return null }
}

export default function JobPreviewPage() {
  const [job, setJob] = useState<Job | null>(() => readPreview())
  // 등록 화면에서 다시 '미리보기'를 누르면 같은 창이 새 값으로 바뀐다
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === PREVIEW_KEY) setJob(readPreview()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  if (!job) return <div className="page page--narrow" role="status" style={{ textAlign: 'center', padding: '64px 24px' }}>Chưa có nội dung xem trước. Hãy bấm "Xem trước" trong trang đăng tin.</div>
  return <JobDetail key={JSON.stringify(job).length + job.title} previewJob={job} />
}
