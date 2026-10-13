import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Finding {
  job_id: number
  outcome: 'candidate' | 'needs_check' | 'existing_approved'
  note: string
  lat: number | null
  lng: number | null
  sources: string[]
}

/** Private research snapshot. No approval writes and no public candidate pins. */
export default function AdminExactAddressReview() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void supabase.rpc('admin_get_research_artifact', { p_kind: 'exact_address_review', p_name: '2026-10-13' }).then(({ data, error: failure }) => {
      if (!active) return
      setError(!!failure)
      setFindings((data?.payload?.findings ?? []) as Finding[])
      setLoading(false)
    })
    return () => { active = false }
  }, [])
  return <details className="admin-location-card" style={{ padding: 16, marginBottom: 16, border: '1px solid #dce5ef', borderRadius: 12 }}>
    <summary><strong>Kiểm tra địa chỉ chi tiết · Nghiên cứu 13/10/2026</strong></summary>
    <p>Ảnh chụp nghiên cứu: 14 tin, 1 tọa độ đã duyệt, 2 ứng viên mới, 11 tin cần kiểm tra. Trạng thái hiện tại nằm ở danh sách vị trí bên dưới. Không tự động duyệt.</p>
    {loading && <p role="status">Đang tải nghiên cứu riêng tư…</p>}
    {error && <p role="alert">Không thể tải nghiên cứu. Cần phiên quản trị viên.</p>}
    {!loading && !error && !findings.length && <p>Chưa lưu nghiên cứu.</p>}
    {findings.map(f => <article key={f.job_id} style={{ borderTop: '1px solid #dce5ef', padding: '16px 0', overflowWrap: 'anywhere' }}>
      <h3><a href={`/viec-lam/sb-${f.job_id}`} target="_blank" rel="noopener noreferrer">Tin #{f.job_id} ↗</a> · {f.outcome === 'candidate' ? 'Ứng viên · Chưa duyệt' : f.outcome === 'existing_approved' ? 'Đã duyệt trước nghiên cứu' : 'Cần xác minh'}</h3>
      <p>{f.note}</p>
      {f.outcome === 'candidate' && f.lat !== null && f.lng !== null && <p>
        Tọa độ ứng viên: {f.lat}, {f.lng} · <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`}>Đối chiếu ứng viên trên bản đồ ↗</a>
      </p>}
      <ul>{f.sources.map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname} · Nguồn đối chiếu ↗</a></li>)}</ul>
      {f.outcome === 'candidate' && <p>Chỉ lưu ứng viên sau khi đối chiếu bằng công cụ “Tự chọn vị trí trên bản đồ”. Chưa thay đổi trạng thái duyệt.</p>}
    </article>)}
  </details>
}
