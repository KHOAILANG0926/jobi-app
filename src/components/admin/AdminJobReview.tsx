import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ReviewItem = {
  job_id: number; title: string; company: string; source_name: string | null
  reason: string; queued_at: string; original_text: string | null
  description_text: string | null; location_text: string | null
  active: boolean; admin_hidden: boolean
}
export function AdminJobReview() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_job_review_queue')
    setError(error?.message ?? '')
    setItems(error ? [] : (data ?? []) as ReviewItem[])
    setLoading(false)
  }, [])
  useEffect(() => { void reload() }, [reload])
  const current = items.find(x => x.job_id === selected)
  return <section className="admin-panel">
    <h2>Duyệt tin tuyển dụng cần xử lý</h2>
    <p>Tin chưa vượt qua kiểm tra tự động sẽ được giữ ẩn. Chỉ quy trình xác minh mới cho phép đăng công khai.</p>
    <button type="button" onClick={() => void reload()}>Làm mới</button>
    {loading && <p>Đang tải...</p>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    {!loading && !error && <p>Chờ kiểm tra: <strong>{items.length}</strong></p>}
    <div className="admin-table-wrap"><table className="admin-table">
      <thead><tr><th>Mã tin</th><th>Doanh nghiệp</th><th>Vấn đề cần xử lý</th><th>Thời gian</th><th>Chi tiết</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.job_id}>
        <td>#{item.job_id}</td><td>{item.company || item.title}</td><td>{item.reason}</td>
        <td>{new Date(item.queued_at).toLocaleString('vi-VN')}</td>
        <td><button type="button" onClick={() => setSelected(item.job_id)}>Kiểm tra</button></td>
      </tr>)}</tbody></table></div>
    {current && <section style={{padding:16, marginTop:16, border:'1px solid #ddd', borderRadius:8}}>
      <h3>Kiểm tra tin #{current.job_id} · {current.title}</h3>
      <p><strong>Vị trí làm việc:</strong> {current.location_text || 'Chưa có thông tin'}</p>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16}}>
        <div><h4>Nội dung gốc</h4><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{current.original_text || 'Chưa có nội dung gốc'}</pre></div>
        <div><h4>Nội dung hiển thị</h4><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{current.description_text || 'Chưa có nội dung hiển thị'}</pre></div>
      </div>
      <p>Không thể bỏ qua quy trình kiểm tra để duyệt tin.</p>
      <button type="button" onClick={() => setSelected(null)}>Đóng</button>
    </section>}
  </section>
}
