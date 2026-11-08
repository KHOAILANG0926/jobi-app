// Lee 2026-11-08 6번: 고객센터 1:1 문의 목록(관리자만 읽기·처리 — support_inquiries RLS).
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Inquiry = { id: number; created_at: string; audience: 'seeker' | 'employer'; category: string; name: string; contact: string; message: string; status: 'new' | 'done'; admin_note: string | null }

export function AdminInquiries() {
  const [rows, setRows] = useState<Inquiry[]>([])
  const [status, setStatus] = useState<'all' | 'new' | 'done'>('new')
  const [error, setError] = useState('')
  const reload = async () => {
    const { data, error: e } = await supabase.from('support_inquiries').select('id,created_at,audience,category,name,contact,message,status,admin_note').order('created_at', { ascending: false }).limit(200)
    if (e) setError(e.message); else setRows((data ?? []) as Inquiry[])
  }
  useEffect(() => { void reload() }, [])
  const mark = async (id: number, next: 'new' | 'done') => {
    const { error: e } = await supabase.from('support_inquiries').update({ status: next }).eq('id', id)
    if (e) setError(e.message); else await reload()
  }
  const list = rows.filter((r) => status === 'all' || r.status === status)
  return <section className="admin-panel">
    <div className="admin-toolbar"><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="new">Chưa trả lời</option><option value="done">Đã xong</option><option value="all">Tất cả</option></select> <span>{list.length} câu hỏi</span></div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Ngày</th><th>Người hỏi</th><th>Nội dung</th><th>Trạng thái</th></tr></thead><tbody>
      {list.map((r) => <tr key={r.id}>
        <td>{new Date(r.created_at).toLocaleString('vi-VN')}</td>
        <td><strong>{r.name}</strong><small>{r.contact}</small><small>{r.audience === 'employer' ? 'Nhà tuyển dụng' : 'Người tìm việc'}</small></td>
        <td><strong>{r.category}</strong><small style={{ whiteSpace: 'pre-wrap' }}>{r.message}</small></td>
        <td className="admin-actions">{r.status === 'new' ? <button onClick={() => mark(r.id, 'done')}>Đã trả lời</button> : <button onClick={() => mark(r.id, 'new')}>Mở lại</button>}</td>
      </tr>)}
      {list.length === 0 && <tr><td colSpan={4}>Không có câu hỏi.</td></tr>}
    </tbody></table></div>
  </section>
}
