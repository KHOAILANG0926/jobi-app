import type { AdminLanguage } from '../../lib/adminLanguage'
import { useEffect, useMemo, useState } from 'react'
import { listAdminJobs, setJobHidden, type AdminJob, type JobOrigin } from '../../lib/adminOperations'

// 2026-09-20 사용자 지시("미가입 등록은 어디서 확인하지" → "내가 봐야
// 확인을 하지") — "등록 없이 빠르게 게시"(게스트)로 들어온 공고는
// origin='employer'는 기업 계정 공고와 똑같이 찍히지만 employer_id가
// 항상 null이다(guest_manage_token 기반, 20260920120000 migration 참고)
// — 이 한 가지 차이만으로 구분 가능해 새 화면/쿼리 없이 여기서 필터+배지만
// 추가한다.
function isGuestPost(job: AdminJob): boolean {
  return job.origin === 'employer' && job.employer_id === null
}

export function AdminJobs({ language = 'ko' }: { language?: AdminLanguage }) {
  const t = (ko: string, vi: string) => language === 'ko' ? ko : vi
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [search, setSearch] = useState('')
  const [origin, setOrigin] = useState<JobOrigin | 'all'>('all')
  const [visibility, setVisibility] = useState<'all' | 'active' | 'inactive' | 'hidden'>('all')
  const [guestOnly, setGuestOnly] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const reload = () => listAdminJobs().then(setJobs).catch((e: Error) => setError(e.message))
  useEffect(() => { void reload() }, [])
  const filtered = useMemo(() => jobs.filter(job => {
    const q = search.trim().toLowerCase()
    return (!q || `${job.title} ${job.company}`.toLowerCase().includes(q))
      && (origin === 'all' || job.origin === origin)
      && (visibility === 'all'
        || (visibility === 'active' && job.active && !job.admin_hidden)
        || (visibility === 'inactive' && !job.active)
        || (visibility === 'hidden' && job.admin_hidden))
      && (!guestOnly || isGuestPost(job))
  }), [jobs, search, origin, visibility, guestOnly])

  async function toggle(job: AdminJob) {
    if (busyId !== null) return
    const next = !job.admin_hidden
    const reason = window.prompt(next ? t('공고 비공개 사유를 입력하세요','Nhập lý do ẩn tin') : t('공고 공개 사유를 입력하세요','Nhập lý do hiện tin'))
    if (!reason?.trim()) return
    setBusyId(job.id)
    try { await setJobHidden(job.id, next, reason.trim()); await reload() }
    catch (e) { setError(e instanceof Error ? e.message : t('공고 변경에 실패했습니다','Không thể cập nhật tin.')) }
    finally { setBusyId(null) }
  }

  return <section className="admin-panel">
    <div className="admin-toolbar">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("제목 또는 회사 검색","Tìm tiêu đề hoặc công ty")} />
      <select value={origin} onChange={e => setOrigin(e.target.value as JobOrigin | 'all')}>
        <option value="all">{t("모든 출처","Tất cả nguồn")}</option><option value="crawler">Crawler</option>
        <option value="employer">{t("기업","Doanh nghiệp")}</option><option value="admin">Admin</option><option value="legacy">Legacy</option>
      </select>
      <select value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)}>
        <option value="all">{t("모든 상태","Tất cả trạng thái")}</option><option value="active">{t("활성","Đang hoạt động")}</option>
        <option value="inactive">{t("중단","Đã ngừng")}</option><option value="hidden">{t("비공개","Đã ẩn")}</option>
      </select>
      <label className="admin-checkbox">
        <input type="checkbox" checked={guestOnly} onChange={e => setGuestOnly(e.target.checked)} />
        {t('비회원 등록 공고만','Chỉ tin đăng nhanh (không đăng ký)')}
      </label>
    </div>
    {error && <p className="admin-error">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr>
      <th>{t("채용공고","Tin tuyển dụng")}</th><th>{t("출처","Nguồn")}</th><th>{t("연락처","SĐT liên hệ")}</th><th>{t("상태","Trạng thái")}</th><th>{t("관리","Vận hành")}</th>
    </tr></thead><tbody>{filtered.map(job => <tr key={job.id}>
      <td><a href={`/viec-lam/sb-${job.id}`} target="_blank" rel="noreferrer"><strong>{job.title}</strong></a><small>{job.company} · #{job.id}</small></td>
      <td>
        {job.origin}
        {isGuestPost(job) && <><br /><span className="admin-badge admin-badge--guest">⚡ Không đăng ký</span></>}
      </td>
      <td>{job.employer_phone || '—'}</td>
      <td>{job.admin_hidden ? 'Đã ẩn' : job.active ? 'Hoạt động' : 'Ngừng tuyển'}</td>
      <td><button className="admin-action" disabled={busyId !== null} onClick={() => void toggle(job)}>{job.admin_hidden ? 'Hiện lại' : 'Ẩn tin'}</button></td>
    </tr>)}</tbody></table></div>
  </section>
}
