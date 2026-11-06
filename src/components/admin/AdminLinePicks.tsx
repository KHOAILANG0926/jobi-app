import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Pending = { jobId: number; title: string; line: string }
// 중복 의심(Lee 2026-11-07): 회사는 같은데 일·위치를 확정 못 한 새 공고(비공개 대기)
type DupSuspect = { jobId: number; title: string; company: string | null; reason: string | null; other: { jobId: number; title: string; company: string | null } | null }
const DUP_REASON: Record<string, string> = {
  job_unclear: 'chưa rõ công việc cụ thể (업무 불명확)',
  location_unclear: 'chưa xác định được vị trí chính xác (위치 불명확)',
  job_and_location_unclear: 'chưa rõ công việc và vị trí (업무·위치 불명확)',
}
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
  const res = await fetch('/api/admin?action=users&operation=line-picks', {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const response = await res.json()
  if (!res.ok) throw new Error(response.error || 'Không thể tải dữ liệu')
  return response
}

export function AdminLinePicks() {
  const [items, setItems] = useState<Pending[]>([])
  const [dups, setDups] = useState<DupSuspect[]>([])
  const [selected, setSelected] = useState<Record<string,string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = async () => {
    try { const r = await api('GET'); setItems(r.pending); setDups(r.duplicates ?? []); setError('') }
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
  const decide = async (d: DupSuspect, decision: 'not_duplicate' | 'duplicate') => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api('POST', { action: 'duplicate-decision', jobId: d.jobId, decision })
      setNotice(decision === 'not_duplicate' ? `#${d.jobId}: không trùng — đã công khai (các quy tắc công khai khác vẫn áp dụng).` : `#${d.jobId}: trùng — giữ ẩn.`)
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
    {dups.length > 0 && <div style={{borderTop:'2px solid #ddd',marginTop:'8px',paddingTop:'8px'}}>
      <h3>🔁 Nghi trùng lặp ({dups.length})</h3>
      {dups.map(d => <div key={d.jobId} style={{borderTop:'1px solid #ddd',padding:'12px 0'}}>
        <p><a href={`/viec-lam/sb-${d.jobId}`} target="_blank" rel="noreferrer">#{d.jobId} — {d.title}</a> <span>(tin mới, đang ẩn)</span></p>
        {d.other && <p><a href={`/viec-lam/sb-${d.other.jobId}`} target="_blank" rel="noreferrer">#{d.other.jobId} — {d.other.title}</a> <span>(tin đã công khai)</span></p>}
        <p>Lý do: {DUP_REASON[d.reason ?? ''] ?? d.reason ?? '—'}</p>
        <button className="admin-action" disabled={busy} onClick={()=>void decide(d,'not_duplicate')}>Không trùng → Công khai</button>{' '}
        <button className="admin-action" disabled={busy} onClick={()=>void decide(d,'duplicate')}>Trùng → Bỏ</button>
      </div>)}
    </div>}
  </section>
}
