import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listAuditLogs, type AuditLog } from '../../lib/adminOperations'

type AccessEvent = { id:number; admin_user_id:string; occurred_at:string; event_type:string; ip_address:string | null; user_agent:string | null }

export function AdminAuditLogs() {
  const [access, setAccess] = useState<AccessEvent[]>([])
  const [accessError, setAccessError] = useState('')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [error, setError] = useState('')
  useEffect(() => { listAuditLogs().then(setLogs).catch((e: Error) => setError(e.message)) }, [])
  useEffect(() => { void supabase.rpc('admin_access_history').then(({data,error}) => { if(error) setAccessError(error.message); else setAccess((data ?? []) as AccessEvent[]) }) }, [])
  return <section className="admin-panel">
    <h2>Lịch sử truy cập trang quản trị</h2>
    <p>Ghi nhận khi mở trang quản trị; không thay thế nhật ký đăng nhập của hệ thống xác thực.</p>
    {accessError && <p className="admin-error">{accessError}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Thời gian</th><th>Quản trị viên</th><th>Địa chỉ IP ghi nhận</th><th>Thiết bị / trình duyệt</th></tr></thead><tbody>
      {access.map(e => <tr key={e.id}><td>{new Date(e.occurred_at).toLocaleString('vi-VN')}</td><td><code>{e.admin_user_id}</code></td><td>{e.ip_address ?? 'Không rõ'}</td><td>{e.user_agent ?? 'Không rõ'}</td></tr>)}
    </tbody></table></div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Thời gian</th><th>Quản trị viên</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>
      {logs.map(log => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString('vi-VN')}</td><td><code>{log.admin_user_id}</code></td><td>{log.action}</td><td>{log.target_type} · {log.target_id}</td><td><small>{JSON.stringify(log.metadata)}</small></td></tr>)}
    </tbody></table></div>
  </section>
}
