import { useEffect, useState } from 'react'
import { listAuditLogs, type AuditLog } from '../../lib/adminOperations'

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [error, setError] = useState('')
  useEffect(() => { listAuditLogs().then(setLogs).catch((e: Error) => setError(e.message)) }, [])
  return <section className="admin-panel">
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>
      {logs.map(log => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString('vi-VN')}</td><td>{log.action}</td><td>{log.target_type} · {log.target_id}</td><td><small>{JSON.stringify(log.metadata)}</small></td></tr>)}
    </tbody></table></div>
  </section>
}
