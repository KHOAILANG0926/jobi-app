import { useEffect, useMemo, useState } from 'react'
import { listAdminUsers, setAccountStatus, type AccountStatus, type AdminUser } from '../../lib/adminOperations'
import type { AdminLanguage } from '../../lib/adminLanguage'

export function AdminUsers({ language = 'ko', selectedMemberId = null }: { language?: AdminLanguage; selectedMemberId?: string | null }) {
  const ko = language === 'ko'
  const t = (k: string, v: string) => ko ? k : v
  const empty = t('미등록','Chưa đăng ký')
  const displayName = (u: AdminUser) => u.full_name || u.display_name || (u.details_unavailable ? t('이름 조회 실패','Không tải được tên') : empty)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all'|'seeker'|'employer'>('all')
  const [status, setStatus] = useState<'all'|AccountStatus>('all')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminUser|null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const reload = async () => { try { setUsers(await listAdminUsers()); setError('') } catch (e) { setError(e instanceof Error ? e.message : String(e)) } }
  useEffect(() => { void reload() }, [])
  useEffect(() => { if (selectedMemberId && users.length) { const match = users.find(u => u.user_id === selectedMemberId); if (match) setSelected(match) } }, [selectedMemberId, users])
  const filtered = useMemo(() => users.filter(user =>
    (!search.trim() || [user.full_name,user.display_name,user.email,user.phone,user.user_id].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())))
    && (role === 'all' || user.role === role)
    && (status === 'all' || user.status === status)
  ),[users,search,role,status])
  const roles = (r: AdminUser['role']) => r === 'employer' ? t('기업회원','Nhà tuyển dụng') : r === 'seeker' ? t('구직자','Người tìm việc') : empty
  const states = (r: AccountStatus) => r === 'active' ? t('활성','Đang hoạt động') : t('정지','Đã tạm khóa')
  const formatDate = (x?:string|null) => x ? new Date(x).toLocaleString(ko ? 'ko-KR' : 'vi-VN') : empty
  async function changeAccount() {
    if (!selected || !reason.trim() || busy) return
    const next = selected.status === 'active' ? 'suspended' : 'active'
    setBusy(true)
    try {
      await setAccountStatus(selected.user_id,next,reason.trim())
      setSelected(null); setReason(''); await reload()
    } catch(e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <section className="admin-panel">
    <div className="admin-toolbar">
      <input aria-label={t('회원 검색','Tìm thành viên')} value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('실명·이메일·전화번호·회원 ID 검색','Tìm tên, email, điện thoại hoặc mã tài khoản')} />
      <select aria-label={t('회원 구분','Vai trò')} value={role} onChange={e=>setRole(e.target.value as typeof role)}>
        <option value="all">{t('모든 회원','Tất cả vai trò')}</option><option value="seeker">{roles('seeker')}</option><option value="employer">{roles('employer')}</option>
      </select>
      <select aria-label={t('상태','Trạng thái')} value={status} onChange={e=>setStatus(e.target.value as typeof status)}>
        <option value="all">{t('모든 상태','Tất cả trạng thái')}</option><option value="active">{states('active')}</option><option value="suspended">{states('suspended')}</option>
      </select>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {users.some(u => u.details_unavailable) && <p className="admin-error" role="alert">{t('회원 실명·연락처 상세 조회가 실패했습니다. 계정 정보가 미등록된 것이 아닙니다.','Không thể tải chi tiết tên và liên hệ. Không có nghĩa là dữ liệu chưa đăng ký.')}</p>}
    <p>{t('조회 회원','Thành viên')}: {filtered.length}</p>
    <div className="admin-table-wrap"><table className="admin-table">
      <thead><tr>
        <th>{t('실명 / 회원 ID','Họ tên / Mã tài khoản')}</th>
        <th>{t('연락처','Liên hệ')}</th><th>{t('회원 구분','Vai trò')}</th>
        <th>{t('가입·최근 로그인','Ngày đăng ký / Đăng nhập gần nhất')}</th>
        <th>{t('활동','Hoạt động')}</th><th>{t('상태 / 관리','Trạng thái / Quản lý')}</th>
      </tr></thead><tbody>{filtered.map(user=><tr key={user.user_id}>
        <td><strong>{displayName(user)}</strong><div><small>{user.user_id}</small></div></td>
        <td>{user.email || (user.details_unavailable ? t('조회 실패','Không tải được') : empty)}<div><small>{user.phone || (user.details_unavailable ? t('조회 실패','Không tải được') : empty)}</small></div></td>
        <td>{roles(user.role)}</td>
        <td>{formatDate(user.joined_at)}<div><small>{formatDate(user.last_sign_in_at)}</small></div></td>
        <td>{user.job_count} {t('공고','tin')} · {user.application_count} {t('지원','hồ sơ')}</td>
        <td>{states(user.status)}<div>
          <button type="button" className="admin-action" onClick={()=>{setSelected(user);setReason('')}}>{t('상세·계정 관리','Xem / Quản lý')}</button>
        </div></td>
      </tr>)}</tbody></table></div>
    {selected && <div role="dialog" aria-modal="true" aria-label={t('회원 상세 확인','Xác nhận tài khoản')} style={{padding:20,border:'2px solid #456',borderRadius:12,marginTop:16,background:'#fff'}}>
      <h3>{t('회원 상세 확인','Chi tiết tài khoản')}</h3>
      <p><strong>{displayName(selected)}</strong> · {roles(selected.role)}</p>
      <p>{t('회원 ID','Mã tài khoản')}: <code>{selected.user_id}</code></p>
      <p>{t('이메일','Email')}: {selected.email || empty} · {t('전화','Điện thoại')}: {selected.phone || empty}</p>
      <p>{t('지역','Khu vực')}: {selected.city || empty} · {t('최근 로그인','Đăng nhập gần nhất')}: {formatDate(selected.last_sign_in_at)}</p>
      <p>{t('현재 상태','Trạng thái hiện tại')}: {states(selected.status)}</p>
      <label htmlFor="account-change-reason">{t('변경 사유 (필수)','Lý do thay đổi (bắt buộc)')}</label>
      <textarea id="account-change-reason" value={reason} onChange={e=>setReason(e.target.value)} rows={2} style={{display:'block',width:'100%',maxWidth:550}} />
      <p>{t('위 회원 ID·연락처를 확인한 후 변경하십시오. 변경 내역이 기록됩니다.','Kiểm tra mã tài khoản và thông tin liên hệ trước khi thay đổi. Thao tác sẽ được ghi lại.')}</p>
      <button disabled={!reason.trim() || busy} onClick={()=>void changeAccount()}>{selected.status==='active'?t('계정 정지 확정','Xác nhận tạm khóa'):t('계정 활성화 확정','Xác nhận mở khóa')}</button>
      <button type="button" onClick={()=>setSelected(null)} style={{marginLeft:10}}>{t('취소','Hủy')}</button>
    </div>}
  </section>
}
