import type { AdminLanguage } from '../../lib/adminLanguage'
import { useEffect, useState } from 'react'
import { handleReport, listReports, type ReportStatus, type UserReport } from '../../lib/adminOperations'

export function AdminReports({ language = 'ko' }: { language?: AdminLanguage }) {
  const t = (ko: string, vi: string) => language === 'ko' ? ko : vi
  const [reports, setReports] = useState<UserReport[]>([])
  const [status, setStatus] = useState<'all' | ReportStatus>('all')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const reload = () => listReports().then(setReports).catch((e: Error) => setError(e.message))
  useEffect(() => { void reload() }, [])
  async function update(id: string, next: Exclude<ReportStatus, 'pending'>) {
    if (busyId) return
    if (!window.confirm(t('신고 상태를 변경하시겠습니까?','Xác nhận thay đổi trạng thái báo cáo?'))) return
    setBusyId(id)
    try { await handleReport(id, next); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : t('신고 처리 실패','Không thể xử lý báo cáo.')) }
    finally { setBusyId(null) }
  }
  return <section className="admin-panel">
    <div className="admin-toolbar"><select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="all">{t("모든 신고","Mọi báo cáo")}</option><option value="pending">{t("대기","Pending")}</option><option value="reviewing">{t("검토 중","Reviewing")}</option><option value="resolved">{t("처리 완료","Resolved")}</option><option value="rejected">{t("반려","Rejected")}</option></select></div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t("대상","Đối tượng")}</th><th>{t("신고 사유","Lý do")}</th><th>{t("상태","Trạng thái")}</th><th>{t("처리","Xử lý")}</th></tr></thead><tbody>
      {reports.filter(r => status === 'all' || r.status === status).map(report => <tr key={report.id}><td><strong>{report.target_type}</strong><small>{report.target_id}</small></td><td>{report.category}<small>{report.description}</small></td><td>{({pending:t('대기','Pending'),reviewing:t('검토 중','Reviewing'),resolved:t('완료','Resolved'),rejected:t('반려','Rejected')} as Record<ReportStatus,string>)[report.status]}</td><td className="admin-actions"><button disabled={busyId !== null} onClick={() => void update(report.id, 'reviewing')}>{t("검토","Xem xét")}</button><button onClick={() => update(report.id, 'resolved')}>{t("처리","Xử lý")}</button><button onClick={() => update(report.id, 'rejected')}>{t("반려","Bỏ qua")}</button></td></tr>)}
    </tbody></table></div>
  </section>
}
