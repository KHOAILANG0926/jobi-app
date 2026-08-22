import { useEffect, useMemo, useState } from 'react'
import { listAdminUsers, setAccountStatus, type AccountStatus, type AdminUser } from '../../lib/adminOperations'

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | 'seeker' | 'employer'>('all')
  const [status, setStatus] = useState<'all' | AccountStatus>('all')
  const [error, setError] = useState('')
  const reload = () => listAdminUsers().then(setUsers).catch((e: Error) => setError(e.message))
  useEffect(() => { void reload() }, [])
  const filtered = useMemo(() => users.filter(user =>
    (!search.trim() || `${user.display_name} ${user.user_id}`.toLowerCase().includes(search.toLowerCase()))
    && (role === 'all' || user.role === role) && (status === 'all' || user.status === status)
  ), [users, search, role, status])

  async function toggle(user: AdminUser) {
    const next = user.status === 'active' ? 'suspended' : 'active'
    const reason = next === 'suspended' ? window.prompt('Lý do tạm khóa tài khoản:') : ''
    if (next === 'suspended' && reason === null) return
    try { await setAccountStatus(user.user_id, next, reason || ''); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật tài khoản.') }
  }

  return <section className="admin-panel">
    <div className="admin-toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc mã người dùng" />
      <select value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="all">Mọi vai trò</option><option value="seeker">Người tìm việc</option><option value="employer">Nhà tuyển dụng</option></select>
      <select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="all">Mọi trạng thái</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
    </div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Hoạt động</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{filtered.map(user => <tr key={user.user_id}><td><strong>{user.display_name || 'Chưa đặt tên'}</strong><small>{new Date(user.joined_at).toLocaleDateString('vi-VN')}</small></td>
        <td>{user.role || '—'}</td><td>{user.job_count} tin · {user.application_count} hồ sơ</td><td>{user.status}</td>
        <td><button className="admin-action" onClick={() => toggle(user)}>{user.status === 'active' ? 'Tạm khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table></div>
  </section>
}
