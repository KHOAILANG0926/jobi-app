import { useEffect, useMemo, useState } from 'react'
import { listAdminJobs, setJobHidden, type AdminJob, type JobOrigin } from '../../lib/adminOperations'

export function AdminJobs() {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [search, setSearch] = useState('')
  const [origin, setOrigin] = useState<JobOrigin | 'all'>('all')
  const [visibility, setVisibility] = useState<'all' | 'active' | 'inactive' | 'hidden'>('all')
  const [error, setError] = useState('')

  const reload = () => listAdminJobs().then(setJobs).catch((e: Error) => setError(e.message))
  useEffect(() => { void reload() }, [])
  const filtered = useMemo(() => jobs.filter(job => {
    const q = search.trim().toLowerCase()
    return (!q || `${job.title} ${job.company}`.toLowerCase().includes(q))
      && (origin === 'all' || job.origin === origin)
      && (visibility === 'all'
        || (visibility === 'active' && job.active && !job.admin_hidden)
        || (visibility === 'inactive' && !job.active)
        || (visibility === 'hidden' && job.admin_hidden))
  }), [jobs, search, origin, visibility])

  async function toggle(job: AdminJob) {
    try { await setJobHidden(job.id, !job.admin_hidden); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật tin.') }
  }

  return <section className="admin-panel">
    <div className="admin-toolbar">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tiêu đề hoặc công ty" />
      <select value={origin} onChange={e => setOrigin(e.target.value as JobOrigin | 'all')}>
        <option value="all">Tất cả nguồn</option><option value="crawler">Crawler</option>
        <option value="employer">Doanh nghiệp</option><option value="admin">Admin</option><option value="legacy">Legacy</option>
      </select>
      <select value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)}>
        <option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option>
        <option value="inactive">Đã ngừng</option><option value="hidden">Đã ẩn</option>
      </select>
    </div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr>
      <th>Tin tuyển dụng</th><th>Nguồn</th><th>Trạng thái</th><th>Vận hành</th>
    </tr></thead><tbody>{filtered.map(job => <tr key={job.id}>
      <td><a href={`/viec-lam/sb-${job.id}`} target="_blank" rel="noreferrer"><strong>{job.title}</strong></a><small>{job.company} · #{job.id}</small></td>
      <td>{job.origin}</td><td>{job.admin_hidden ? 'Đã ẩn' : job.active ? 'Hoạt động' : 'Ngừng tuyển'}</td>
      <td><button className="admin-action" onClick={() => toggle(job)}>{job.admin_hidden ? 'Hiện lại' : 'Ẩn tin'}</button></td>
    </tr>)}</tbody></table></div>
  </section>
}
