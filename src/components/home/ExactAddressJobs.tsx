import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exactAddressEntries, type ExactAddressEntry } from '../../lib/exactAddressJobs'
import './exact-address-jobs.css'

export default function ExactAddressJobs() {
  const [entries, setEntries] = useState<ExactAddressEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [approvalError, setApprovalError] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const rows: Record<string, unknown>[] = []
      for (let page = 0; ; page++) {
        const result = await supabase.from('local_jobs')
          .select('id,title,company,active,admin_hidden,job_work_locations!inner(id,raw_address,address_accuracy,sort_order)')
          .eq('active', true).eq('admin_hidden', false).eq('job_work_locations.address_accuracy', 'exact_text')
          .order('id').range(page * 1000, page * 1000 + 999)
        if (result.error) throw result.error
        rows.push(...(result.data ?? []))
        if ((result.data?.length ?? 0) < 1000) break
      }
      const approvals = rows.length ? await supabase.from('job_location_candidates')
        .select('job_id,work_location_id,company_snapshot,address_snapshot,lat,lng,place_precision,status')
        .eq('status', 'approved').in('job_id', rows.map(r => Number(r.id))) : { data: [], error: null }
      setApprovalError(!!approvals.error)
      setEntries(exactAddressEntries(rows, approvals.data ?? []))
    } catch {
      setError(true)
      setEntries([])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  return <section className="exact-address-jobs" aria-labelledby="exact-address-title" aria-busy={loading}>
    <header>
      <div><h2 id="exact-address-title">Tin có địa chỉ chi tiết{!loading && !error ? ` · ${entries.length} tin` : ''}</h2>
        <p>Địa chỉ chi tiết không đồng nghĩa với vị trí đã xác minh. Kiểm tra trạng thái từng địa điểm.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}>Cập nhật</button>
    </header>
    {loading ? <p role="status">Đang tải tin có địa chỉ chi tiết…</p>
      : error ? <p role="alert">Không thể tải danh sách. Vui lòng thử lại.</p>
      : <>
        {approvalError && <p role="alert">Không thể tải trạng thái duyệt vị trí. Chưa hiển thị ghim bản đồ.</p>}
        {!entries.length && <p>Chưa có tin công khai với địa chỉ chi tiết.</p>}
        <ol className="exact-address-jobs__list">{entries.map(entry => <li key={entry.id}>
          <span className="exact-address-jobs__id">#{entry.id}</span>
          <h3><NavLink to={`/viec-lam/sb-${entry.id}`}>{entry.title}</NavLink></h3>
          <p className="exact-address-jobs__company">{entry.company}</p>
          {entry.locations.map(loc => <div className="exact-address-jobs__location" key={loc.id}>
            <p>{loc.address}</p>
            <span className={loc.point ? 'exact-address-jobs__approved' : 'exact-address-jobs__pending'}>
              {approvalError ? 'Chưa tải được trạng thái' : loc.point ? 'Tọa độ đã duyệt · Chờ kiểm tra cuối' : 'Cần xác minh · Chưa duyệt tọa độ'}
            </span>
            <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.point ? `${loc.point.lat},${loc.point.lng}` : `${entry.company} ${loc.address}`)}`}>
              {loc.point ? 'Xem vị trí đã duyệt ↗' : 'Tìm trên bản đồ · Chưa xác minh ↗'}
            </a>
          </div>)}
          <NavLink className="exact-address-jobs__detail" to={`/viec-lam/sb-${entry.id}`}>Xem tin #{entry.id} →</NavLink>
        </li>)}</ol>
      </>}
  </section>
}
