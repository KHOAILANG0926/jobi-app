import { AdminLinePicks } from './AdminLinePicks'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchKoreaJobs } from '../../lib/koreaJobsApi'
import type { KoreaJob } from '../../types/koreaJob'
import { listAdminJobs, setJobHidden, type AdminJob, type JobOrigin } from '../../lib/adminOperations'

// 2026-09-20 사용자 지시("미가입 등록은 어디서 확인하지" → "내가 봐야
// 확인을 하지") — "등록 없이 빠르게 게시"(게스트)로 들어온 공고는
// origin='employer'는 기업 계정 공고와 똑같이 찍히지만 employer_id가
// 항상 null이다(guest_manage_token 기반, 20260920120000 migration 참고)
// — 이 한 가지 차이만으로 구분 가능해 새 화면/쿼리 없이 여기서 필터+배지만
// 추가한다.
// 2026-10-30 Lee "내가 볼 수 있게 해줘야지": 공개 안 된 공고도 관리자가 내용과 비공개 이유를 바로 본다(읽기만).
type JobPeek = Record<string, unknown>
function hiddenReasons(j: JobPeek): string[] {
  const r: string[] = []
  if (j.admin_hidden) r.push('Quản trị viên đã ẩn (관리자가 숨김)')
  if (!j.occupation_code) r.push('Thiếu mã nghề occupation_code (직업코드 없음 → 공개 게이트가 비공개)')
  else if (!j.occupation_evidence) r.push('Thiếu bằng chứng nghề occupation_evidence (원문 근거 없음)')
  if (!j.employer_phone) r.push('Không có số liên hệ (연락처 없음)')
  return r
}
function JobPeekPanel({ id }: { id: number }) {
  const [data, setData] = useState<JobPeek | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    void supabase.from('local_jobs').select('title,company,salary,location,hours,employer_phone,occupation_code,occupation_evidence,description,active,admin_hidden').eq('id', id).single()
      .then(({ data, error }) => { if (error) setErr(error.message); else setData(data as JobPeek) })
  }, [id])
  if (err) return <p className="admin-error">{err}</p>
  if (!data) return <p>Đang tải…</p>
  const reasons = data.active && !data.admin_hidden ? [] : hiddenReasons(data)
  return <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, display: 'grid', gap: 6 }}>
    <p style={{ margin: 0, fontWeight: 700, color: reasons.length ? '#d92d20' : '#15803d' }}>
      {data.active && !data.admin_hidden ? '🟢 Đang công khai' : `🔴 Chưa công khai — ${reasons.join(' · ') || 'lý do khác (xem nhật ký)'}`}</p>
    {(['title', 'company', 'salary', 'location', 'hours', 'employer_phone', 'occupation_code', 'occupation_evidence'] as const).map((k) =>
      <p key={k} style={{ margin: 0 }}><b>{k}:</b> {String(data[k] ?? '—')}</p>)}
    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 320, overflow: 'auto', background: '#fff', padding: 8, borderRadius: 6 }}>{String(data.description ?? '')}</pre>
  </div>
}

function isGuestPost(job: AdminJob): boolean {
  return job.origin === 'employer' && job.employer_id === null
}

export function AdminJobs({view='all'}:{view?:'all'|'public'|'korea'}) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [koreaJobs,setKoreaJobs]=useState<KoreaJob[]>([])
  const [verified,setVerified]=useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [origin, setOrigin] = useState<JobOrigin | 'all'>('all')
  const [visibility, setVisibility] = useState<'all' | 'active' | 'inactive' | 'hidden'>('all')
  const [guestOnly, setGuestOnly] = useState(false)
  const [peekId, setPeekId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const reload = () => listAdminJobs().then(setJobs).catch((e: Error) => setError(e.message))
  useEffect(() => {
    void reload()
    void fetchKoreaJobs().then(setKoreaJobs)
    void Promise.all([
      supabase.from('job_work_locations').select('job_id').eq('location_verified',true),
      supabase.from('job_location_candidates').select('job_id').eq('status','approved')
    ]).then(([w,c])=>{
      if(w.error||c.error)return
      setVerified(new Set([...(w.data||[]),...(c.data||[])].map(p=>p.job_id)))
    })
  }, [])
  const filtered = useMemo(() => jobs.filter(job => {
    const q = search.trim().toLowerCase()
    return (!q || `${job.title} ${job.company}`.toLowerCase().includes(q))
      && (origin === 'all' || job.origin === origin)
      && (visibility === 'all'
        || (visibility === 'active' && job.active && !job.admin_hidden)
        || (visibility === 'inactive' && !job.active)
        || (visibility === 'hidden' && job.admin_hidden))
      && (view !== 'public' || (job.active && !job.admin_hidden))
      && (!guestOnly || isGuestPost(job))
  }), [jobs, search, origin, visibility, guestOnly, view])

  async function toggle(job: AdminJob) {
    try { await setJobHidden(job.id, !job.admin_hidden); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật tin.') }
  }

  return <>{(view === 'korea'||view === 'all') && <section className="admin-panel"><h2>Tin Hàn Quốc ({koreaJobs.length})</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã / Tiêu đề</th><th>Vị trí</th><th>Trạng thái</th></tr></thead><tbody>{koreaJobs.map(j=><tr key={j.id}><td><a href={`/viec-han-quoc/${j.id}`} target="_blank" rel="noreferrer">#{j.id} — {j.title_vi||j.title||'Chưa có tiêu đề'}</a></td><td>{j.region||j.province||'—'}</td><td>Công khai</td></tr>)}</tbody></table></div></section>}{view !== 'korea' && <><AdminLinePicks /><section className="admin-panel">
    <div className="admin-toolbar">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tiêu đề hoặc công ty" />
      <select value={origin} onChange={e => setOrigin(e.target.value as JobOrigin | 'all')}>
        <option value="all">Tất cả nguồn</option><option value="crawler">Crawler</option>
        <option value="employer">Doanh nghiệp</option><option value="admin">Admin</option><option value="legacy">Legacy</option>
      </select>
      <select value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)}>
        <option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option>
        <option value="inactive">Đã ngừng</option><option value="hidden">Đã ẩn</option>
      </select>
      <label className="admin-checkbox">
        <input type="checkbox" checked={guestOnly} onChange={e => setGuestOnly(e.target.checked)} />
        Chỉ tin đăng nhanh (không đăng ký)
      </label>
    </div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr>
      <th>Tin tuyển dụng</th><th>Nguồn</th><th>Vị trí</th><th>SĐT liên hệ</th><th>Trạng thái</th><th>Vận hành</th>
    </tr></thead><tbody>{filtered.map(job => <Fragment key={job.id}><tr>
      <td><a href={`/viec-lam/sb-${job.id}`} target="_blank" rel="noreferrer"><strong>{job.title}</strong></a><small>{job.company} · #{job.id}</small>
        <br /><button type="button" className="admin-action" aria-expanded={peekId === job.id} onClick={() => setPeekId(peekId === job.id ? null : job.id)}>{peekId === job.id ? 'Đóng' : 'Xem nội dung (내용 보기)'}</button></td>
      <td>
        {job.origin}
        {isGuestPost(job) && <><br /><span className="admin-badge admin-badge--guest">⚡ Không đăng ký</span></>}
      </td>
      <td>{verified.has(job.id)?'Đã xác nhận':'Chờ xác nhận'}</td>
      <td>{job.employer_phone || '—'}</td>
      <td>{job.admin_hidden ? 'Đã ẩn' : job.active ? 'Hoạt động' : 'Ngừng tuyển'}</td>
      <td><button className="admin-action" onClick={() => toggle(job)}>{job.admin_hidden ? 'Hiện lại' : 'Ẩn tin'}</button></td>
    </tr>{peekId === job.id && <tr><td colSpan={6}><JobPeekPanel id={job.id} /></td></tr>}</Fragment>)}</tbody></table></div>
  </section></>}</>
}
