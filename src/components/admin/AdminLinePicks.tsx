import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Pending = { jobId: number; title: string; line: string }
const choices = [
  ['01','Công việc'],['02','Yêu cầu'],['03','Thời gian'],['04','Lương'],
  ['05','Phúc lợi'],['06','Ứng tuyển'],['07','Khác'],
  ['shuttle_bus','Xe đưa đón'],['dormitory','Ký túc xá'],['meal_provided','Ăn ca'],
  ['fuel','Xăng xe'],['housing','Nhà ở'],['attendance','Chuyên cần'],['productivity','Năng suất'],
] as const

async function api(method: 'GET' | 'POST', body?: object) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn')
  const res = await fetch('/api/admin-users?action=line-picks', {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const response = await res.json()
  if (!res.ok) throw new Error(response.error || 'Không thể tải dữ liệu')
  return response
}

export function AdminLinePicks() {
  const [items, setItems] = useState<Pending[]>([])
  const [selected, setSelected] = useState<Record<string,string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = async () => {
    try { setItems((await api('GET')).pending); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Lỗi tải danh sách') }
  }
  useEffect(() => { void load() }, [])
  const save = async (item: Pending) => {
    const key = `${item.jobId}:${item.line}`
    const code = selected[key]
    if (!code || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api('POST', { action:'line-pick', jobId:item.jobId, line:item.line, code })
      setNotice(result.rebuild_required
        ? 'Đã lưu lựa chọn. Đang chờ hệ thống tạo lại nội dung từ bài gốc.'
        : 'Đã lưu phúc lợi từ bài gốc.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể lưu') }
    finally { setBusy(false) }
  }
  return <section className="admin-panel" style={{borderRadius:0}}>
    <h2>Chọn mục cho dòng chưa xác định</h2>
    <p>Chỉ chọn từ danh sách. Nội dung gốc không được chỉnh sửa.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {items.length === 0 && <p>Không có dòng nào cần chọn.</p>}
    {items.map(item => {
      const key = `${item.jobId}:${item.line}`
      return <div key={key} style={{borderTop:'1px solid #ddd',padding:'12px 0'}}>
        <p><a href={`/viec-lam/sb-${item.jobId}`} target="_blank" rel="noreferrer">#{item.jobId} — {item.title}</a></p>
        <p style={{whiteSpace:'pre-wrap'}}>{item.line}</p>
        <select aria-label={`Chọn loại cho tin ${item.jobId}`} value={selected[key] || ''}
          onChange={e=>setSelected(prev=>({...prev,[key]:e.target.value}))}>
          <option value="">Chọn một mục</option>
          {choices.map(([value,label])=><option key={value} value={value}>{value} — {label}</option>)}
        </select>
        <button className="admin-action" disabled={!selected[key] || busy} onClick={()=>void save(item)}>Lưu lựa chọn</button>
      </div>
    })}
  </section>
}
