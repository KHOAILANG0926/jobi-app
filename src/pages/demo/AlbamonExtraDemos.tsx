// 알바몬 화면 그대로 따라 한 데모 모음(Lee 2026-11-08 "만들지 말고 카피, 뺄 건 빼고 더할 건 더하고, 기본 구성은 지킨다").
// 테마 채용관(알바몬 /jobs/short-term 등) · 고객센터 FAQ·공지(알바몬 /service-center) · 벽보 제작(알바몬 /business/poster-make) · 데모 목록.
// 목록 표·카드는 이미 승인된 우리 부품(JobsTable·JobsListToolbar)을 그대로 쓴다. 저장·전송 없음.
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import JobsListToolbar from '../../components/JobsListToolbar'
import JobsTable, { type JobsTableRow } from '../../components/JobsTable'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { CATEGORY_LABELS } from '../../data/categories'
import { JOB_DURATION_OPTIONS } from '../../data/jobDuration'
import { JOB_REGIONS, jobMatchesRegion, type JobRegionId } from '../../data/jobRegions'
import { loadJobsViewMode, matchesDateRange, saveJobsViewMode, type DateRangeFilter, type JobsViewMode } from '../../lib/jobsListView'
import type { Job, JobCategory } from '../../types/job'
import './AlbamonExtraDemos.css'

const shortDate = (iso?: string) => { if (!iso) return undefined; const d = new Date(iso); return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

// ── 테마 채용관: 우리 데이터에 근거가 있는 것만(알바몬의 역세권·대학가·시니어·관공서 등은 뺌) ──
const SHORT = new Set(['Một ngày', 'Dưới 1 tuần', '1 tuần - 1 tháng'])
export const THEMES: { slug: string; label: string; test: (j: Job) => boolean }[] = [
  { slug: 'ky-tuc-xa', label: 'Có ký túc xá', test: (j) => j.dormitory === true },
  { slug: 'xe-dua-don', label: 'Có xe đưa đón', test: (j) => j.shuttleBus === true },
  { slug: 'bao-an', label: 'Có bao ăn', test: (j) => j.mealProvided === true },
  { slug: 'ngan-han', label: 'Việc ngắn hạn', test: (j) => !!j.jobDuration && SHORT.has(j.jobDuration) },
  { slug: 'part-time', label: 'Việc part-time', test: (j) => j.employmentType === 'part_time' },
  { slug: 'ca-dem', label: 'Làm ca đêm', test: (j) => j.shiftType === 'night' },
  { slug: 'di-lam-ngay', label: 'Đi làm ngay', test: (j) => j.immediateStart === true },
  { slug: 'khu-cong-nghiep', label: 'Việc trong KCN', test: (j) => !!j.workLocations?.some((w) => !!w.industrialPark) },
]

export function ThemeJobsDemo() {
  const { slug = THEMES[0].slug } = useParams()
  const navigate = useNavigate()
  const { jobs } = useJobs()
  const theme = THEMES.find((t) => t.slug === slug) ?? THEMES[0]
  const [cat, setCat] = useState<JobCategory | ''>('')
  const [region, setRegion] = useState<JobRegionId | ''>('')
  const [duration, setDuration] = useState('')
  const [view, setView] = useState<JobsViewMode>(() => loadJobsViewMode())
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [sortValue, setSortValue] = useState('posted')
  const [pageSize, setPageSize] = useState(20)
  const base = useMemo(() => jobs.filter(theme.test), [jobs, theme])
  const cats = useMemo(() => [...new Set(base.map((j) => j.category))], [base])
  const list = base
    .filter((j) => !cat || j.category === cat)
    .filter((j) => !region || jobMatchesRegion(j.location, region, j.workLocations))
    .filter((j) => !duration || j.jobDuration === duration)
    .filter((j) => matchesDateRange(j.postedAt, dateRange))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  const rows = list.slice(0, pageSize).map((job): JobsTableRow => ({
    id: job.id, href: `/viec-lam/${job.id}`, region: job.location, title: job.title, company: job.company, salary: job.salary,
    salaryPeriod: job.salaryPeriod, description: job.description, hours: job.hours, dateLabel: shortDate(job.postedAt), badge: theme.label,
  }))
  return (
    <div className="page jobs-menu-page ad-theme">
      <div className="ad-theme__switch" role="tablist" aria-label="Chủ đề">
        {THEMES.map((t) => (
          <button key={t.slug} type="button" role="tab" aria-selected={t.slug === theme.slug} className={t.slug === theme.slug ? 'is-on' : ''}
            onClick={() => { setCat(''); navigate(`/demo/chu-de/${t.slug}`) }}>{t.label}</button>
        ))}
      </div>
      <h1 className="ad-theme__title">{theme.label}</h1>
      <div className="ad-tabs" role="tablist" aria-label="Ngành nghề">
        <button type="button" role="tab" aria-selected={!cat} className={!cat ? 'is-on' : ''} onClick={() => setCat('')}>Tất cả</button>
        {cats.map((c) => <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'is-on' : ''} onClick={() => setCat(c)}>{CATEGORY_LABELS[c]}</button>)}
      </div>
      <div className="ad-filter">
        <select value={region} onChange={(e) => setRegion(e.target.value as JobRegionId | '')} aria-label="Khu vực">
          <option value="">Khu vực</option>
          {JOB_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value as JobCategory | '')} aria-label="Ngành nghề">
          <option value="">Ngành nghề</option>
          {cats.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Thời hạn làm việc">
          <option value="">Thời hạn làm việc</option>
          {JOB_DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {(cat || region || duration) ? (
        <p className="ad-filter__picked">Đang lọc: {[cat && CATEGORY_LABELS[cat], region && JOB_REGIONS.find((r) => r.id === region)?.label, duration].filter(Boolean).join(' · ')}
          <button type="button" onClick={() => { setCat(''); setRegion(''); setDuration('') }}>Bỏ lọc</button></p>
      ) : <p className="ad-filter__picked ad-filter__picked--empty">Hãy chọn điều kiện tìm kiếm.</p>}
      <h2 className="ad-theme__sub">Danh sách việc làm</h2>
      {list.length === 0 ? (
        <div className="city-result__empty"><span>🔍</span><p>Hiện chưa có tin phù hợp với chủ đề này.</p><Link to="/">← Xem tất cả việc làm</Link></div>
      ) : (
        <>
          <JobsListToolbar count={list.length} countLabel="việc" dateRange={dateRange} onDateRangeChange={setDateRange}
            sortOptions={[{ value: 'posted', label: 'Đăng gần đây nhất' }]} sortValue={sortValue} onSortChange={setSortValue}
            pageSize={pageSize} onPageSizeChange={setPageSize} view={view} onViewChange={(v) => { setView(v); saveJobsViewMode(v) }} />
          <JobsTable dateColumnLabel="Ngày đăng" rows={rows} />
        </>
      )}
    </div>
  )
}

// ── 고객센터: FAQ(아코디언, 개인/기업 탭, 분류·검색) + 공지(표). 지어낸 공지는 넣지 않는다. ──
type Faq = { cat: string; q: string; a: string }
const FAQ_SEEKER: Faq[] = [
  { cat: 'Ứng tuyển', q: 'Làm sao để ứng tuyển một công việc?', a: 'Mở tin tuyển dụng rồi bấm "Ứng tuyển", hoặc gọi điện/nhắn Zalo theo số trong tin. Muốn ứng tuyển trên trang cần đăng nhập.' },
  { cat: 'Ứng tuyển', q: 'Viecganban có thu phí người tìm việc không?', a: 'Không. Nếu ai đó yêu cầu đặt cọc, mã OTP hoặc chuyển tiền để nhận việc, hãy dừng lại và bấm "Báo cáo" ở cuối tin.' },
  { cat: 'Hồ sơ', q: 'Tạo hồ sơ (CV) ở đâu?', a: 'Đăng nhập rồi vào mục Hồ sơ, chọn thẻ CV để điền thông tin và tải ảnh.' },
  { cat: 'Tìm việc', q: 'Tin đã lưu có xem được trên máy khác không?', a: 'Hiện tin đã lưu chỉ được giữ trên trình duyệt bạn đang dùng.' },
  { cat: 'Tìm việc', q: 'Vị trí ghi "chưa xác minh" là gì?', a: 'Địa điểm được lấy từ nội dung tin nhưng chưa được xác nhận đúng điểm làm việc. Hãy gọi nhà tuyển dụng để hỏi đường trước khi đi.' },
  { cat: 'Báo cáo', q: 'Tin sai thông tin hoặc đã hết hạn thì làm sao?', a: 'Bấm "Báo cáo" ở cuối trang tin. Quản trị viên sẽ kiểm tra và xử lý.' },
]
const FAQ_EMPLOYER: Faq[] = [
  { cat: 'Đăng tin', q: 'Đăng tin có mất phí không?', a: 'Đăng tin tuyển dụng trên Viecganban miễn phí.' },
  { cat: 'Đăng tin', q: 'Không có tài khoản có đăng tin được không?', a: 'Được. Chọn "Đăng nhanh, không cần đăng ký": tin hiển thị ngay và tự hết hạn sau 7 ngày nếu không chọn hạn nộp. Bạn nhận một link riêng để sửa hoặc ngừng đăng — hãy lưu link đó.' },
  { cat: 'Đăng tin', q: 'Đăng ký bằng email thì sao?', a: 'Chúng tôi gửi email để bạn đặt mật khẩu, sau đó đăng nhập để quản lý tin trong bảng điều khiển nhà tuyển dụng.' },
  { cat: 'Quản lý tin', q: 'Sửa hoặc ngừng đăng tin ở đâu?', a: 'Tài khoản nhà tuyển dụng: vào Bảng điều khiển. Đăng nhanh không tài khoản: mở link quản lý tin đã nhận lúc đăng.' },
  { cat: 'Ứng viên', q: 'Xem ứng viên đã ứng tuyển ở đâu?', a: 'Trong Bảng điều khiển nhà tuyển dụng, mục ứng viên của từng tin; có thể nhắn tin và hẹn phỏng vấn.' },
]
export function SupportDemo() {
  const [tab, setTab] = useState<'faq' | 'notice'>('faq')
  const [who, setWho] = useState<'seeker' | 'employer'>('seeker')
  const [fcat, setFcat] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(0)
  const all = who === 'seeker' ? FAQ_SEEKER : FAQ_EMPLOYER
  const list = all.filter((f) => (!fcat || f.cat === fcat) && (!q.trim() || (f.q + f.a).toLowerCase().includes(q.trim().toLowerCase())))
  return (
    <div className="page ad-cs">
      <div className="ad-cs__menu">
        <button type="button" className={tab === 'faq' ? 'is-on' : ''} onClick={() => setTab('faq')}>Câu hỏi thường gặp</button>
        <button type="button" className={tab === 'notice' ? 'is-on' : ''} onClick={() => setTab('notice')}>Thông báo</button>
      </div>
      {tab === 'faq' ? (
        <>
          <h1 className="ad-cs__title">Câu hỏi thường gặp</h1>
          <div className="ad-cs__tabs">
            <button type="button" className={who === 'seeker' ? 'is-on' : ''} onClick={() => { setWho('seeker'); setFcat(''); setOpen(0) }}>Người tìm việc</button>
            <button type="button" className={who === 'employer' ? 'is-on' : ''} onClick={() => { setWho('employer'); setFcat(''); setOpen(0) }}>Nhà tuyển dụng</button>
          </div>
          <div className="ad-cs__bar">
            <span>Tổng {list.length} câu</span>
            <div>
              <select value={fcat} onChange={(e) => setFcat(e.target.value)} aria-label="Phân loại">
                <option value="">Tất cả</option>
                {[...new Set(all.map((f) => f.cat))].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập từ khóa tìm kiếm." aria-label="Tìm kiếm" />
            </div>
          </div>
          <ul className="ad-faq">
            {list.map((f, i) => (
              <li key={f.q} className={open === i ? 'is-open' : ''}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}><b>Q.</b>{f.q}<span aria-hidden>{open === i ? '︿' : '﹀'}</span></button>
                {open === i && <div className="ad-faq__a"><b>A.</b><p>{f.a}</p></div>}
              </li>
            ))}
            {list.length === 0 && <li className="ad-faq__none">Không tìm thấy câu hỏi phù hợp.</li>}
          </ul>
          <p className="ad-cs__contact">Chưa tìm thấy câu trả lời? Liên hệ <a href="mailto:support@viecganban.vn">support@viecganban.vn</a> (T2–T6, 09:00–18:00).</p>
        </>
      ) : (
        <>
          <h1 className="ad-cs__title">Thông báo</h1>
          <div className="ad-cs__bar"><span>Tổng 0 thông báo</span></div>
          <table className="ad-notice">
            <thead><tr><th>Phân loại</th><th>Tiêu đề</th><th>Ngày đăng</th></tr></thead>
            <tbody><tr><td colSpan={3} className="ad-notice__none">Chưa có thông báo.</td></tr></tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ── 벽보 제작: 알바몬 안내 3줄 + 공고 고르기 + 내용 고치기(제목 40자, 나머지 30자) + 벽보 그림 받기·인쇄 ──
export function PosterDemo() {
  const { user } = useAuth()
  const { jobs } = useJobs()
  const navigate = useNavigate()
  const mine = user ? jobs.filter((j) => j.employerId === user.id) : []
  const [sample, setSample] = useState(false)
  const pool = mine.length ? mine : sample ? jobs.slice(0, 20) : []
  const [jobId, setJobId] = useState('')
  const job = pool.find((j) => j.id === jobId) ?? pool[0]
  const [edit, setEdit] = useState<Record<string, string>>({})
  const ref = useRef<HTMLDivElement>(null)
  const val = (k: string, d: string) => edit[`${job?.id}:${k}`] ?? d
  const setVal = (k: string, v: string) => setEdit((e) => ({ ...e, [`${job?.id}:${k}`]: v }))
  const download = async () => {
    if (!ref.current) return
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `poster-${job?.id ?? 'viecganban'}.png`; a.click()
  }
  return (
    <div className="page ad-poster">
      <h1 className="ad-cs__title">Làm poster tuyển dụng</h1>
      <ul className="ad-poster__notes">
        <li>Có thể in poster của tin đang đăng; tải ảnh poster về rồi in sẽ đẹp hơn (tin đã hết hạn hoặc đang chờ thì không in được).</li>
        <li>Có thể sửa nội dung trừ tên công ty, lương và phúc lợi trước khi in (tiêu đề tối đa 40 ký tự, các mục khác tối đa 30 ký tự).</li>
        <li>Sửa nội dung để in không làm thay đổi tin đang đăng.</li>
      </ul>
      {!job ? (
        <div className="ad-poster__empty">
          <p className="ad-poster__lead">Biến tin tuyển dụng của bạn thành poster dán tường thật nhanh</p>
          <p>Hiện chưa có tin đang đăng. Hãy đăng tin trước.</p>
          <button type="button" className="ad-btn-line" onClick={() => navigate('/dang-tin')}>Đăng tin tuyển dụng</button>
          <button type="button" className="ad-link" onClick={() => setSample(true)}>(Bản demo) Thử với một tin đang đăng trên trang</button>
        </div>
      ) : (
        <div className="ad-poster__wrap">
          <div className="ad-poster__form">
            <label>Chọn tin
              <select value={job.id} onChange={(e) => setJobId(e.target.value)}>{pool.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
            </label>
            <label>Tiêu đề <small>{val('title', job.title).length}/40</small>
              <input maxLength={40} value={val('title', job.title).slice(0, 40)} onChange={(e) => setVal('title', e.target.value)} />
            </label>
            {[['place', 'Nơi làm việc', job.location], ['hours', 'Giờ làm việc', job.hours ?? ''], ['contact', 'Liên hệ', job.employerPhone || job.zalo || '']].map(([k, l, d]) => (
              <label key={k}>{l} <small>{val(k, d).length}/30</small>
                <input maxLength={30} value={val(k, d).slice(0, 30)} onChange={(e) => setVal(k, e.target.value)} />
              </label>
            ))}
            <p className="ad-hint">Tên công ty và lương lấy nguyên từ tin, không sửa ở đây.</p>
            <div className="ad-poster__btns">
              <button type="button" className="ad-btn-line" onClick={() => window.print()}>In</button>
              <button type="button" className="ad-btn-main" onClick={() => void download()}>Tải ảnh poster</button>
            </div>
          </div>
          <div className="ad-poster__paper" ref={ref}>
            <p className="ad-poster__head">TUYỂN DỤNG</p>
            <p className="ad-poster__company">{job.company}</p>
            <h2 className="ad-poster__title">{val('title', job.title).slice(0, 40)}</h2>
            <dl>
              <dt>Lương</dt><dd>{job.salary || 'Thỏa thuận'}</dd>
              <dt>Nơi làm việc</dt><dd>{val('place', job.location).slice(0, 30)}</dd>
              {val('hours', job.hours ?? '') && <><dt>Giờ làm việc</dt><dd>{val('hours', job.hours ?? '').slice(0, 30)}</dd></>}
            </dl>
            <p className="ad-poster__call">Liên hệ: <b>{val('contact', job.employerPhone || job.zalo || '').slice(0, 30)}</b></p>
            <p className="ad-poster__foot">Xem tin trên <b>Việcganban</b> · viecganban.vn</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 데모 목록 ──
export function DemoHub() {
  return (
    <div className="page ad-hub">
      <h1 className="ad-cs__title">Bản demo theo Albamon</h1>
      <ul>
        <li><Link to="/demo/mau-nhanh">Đăng tin tuyển dụng + Mô tả chi tiết (mẫu nhanh)</Link><span>Albamon 공고등록 + 상세모집요강</span></li>
        <li><Link to={`/demo/chu-de/${THEMES[0].slug}`}>Việc làm theo chủ đề</Link><span>Albamon 테마 채용관(단기알바 등)</span></li>
        <li><Link to="/demo/ho-tro">Câu hỏi thường gặp · Thông báo</Link><span>Albamon 고객센터 FAQ·공지사항</span></li>
        <li><Link to="/demo/poster">Làm poster tuyển dụng</Link><span>Albamon 벽보 제작 서비스</span></li>
      </ul>
    </div>
  )
}
