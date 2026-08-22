import { useEffect, useState } from 'react'
import { handleReport, listReports, type ReportStatus, type UserReport } from '../../lib/adminOperations'

export function AdminReports() {
  const [reports, setReports] = useState<UserReport[]>([])
  const [status, setStatus] = useState<'all' | ReportStatus>('all')
  const [error, setError] = useState('')
  const reload = () => listReports().then(setReports).catch((e: Error) => setError(e.message))
  useEffect(() => { void reload() }, [])
  async function update(id: string, next: Exclude<ReportStatus, 'pending'>) {
    try { await handleReport(id, next); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể xử lý báo cáo.') }
  }
  return <section className="admin-panel">
    <div className="admin-toolbar"><select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="all">Mọi báo cáo</option><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Đối tượng</th><th>Lý do</th><th>Trạng thái</th><th>Xử lý</th></tr></thead><tbody>
      {reports.filter(r => status === 'all' || r.status === status).map(report => <tr key={report.id}><td><strong>{report.target_type}</strong><small>{report.target_id}</small></td><td>{report.category}<small>{report.description}</small></td><td>{report.status}</td><td className="admin-actions"><button onClick={() => update(report.id, 'reviewing')}>Xem xét</button><button onClick={() => update(report.id, 'resolved')}>Xử lý</button><button onClick={() => update(report.id, 'rejected')}>Bỏ qua</button></td></tr>)}
    </tbody></table></div>
  </section>
}
