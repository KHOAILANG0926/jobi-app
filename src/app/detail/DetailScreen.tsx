import { Fragment, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bookmark, BookmarkCheck, ChevronLeft, MapPin, MessageCircle, Phone, Bus, BedDouble, Utensils, CalendarCheck, House, Fuel, ChartNoAxesColumnIncreasing } from 'lucide-react'
import { useBrandsOptional } from '../../context/BrandsContext'
import { useJobs } from '../../context/JobsContext'
import { industryPhotoUrl } from '../../lib/cardPhoto'
import { jobImagePublicUrl, jobRepresentativeImageUrl } from '../../lib/companyLogo'
import { DIRECTIONS_LABEL, planJobDirections } from '../../lib/directionsPlan'
import { JOB_SECTION_LABELS, contactOf } from '../../lib/jobDetailView'
import { LOCATION_LABELS, mapPointAccuracyNote } from '../../lib/mapR1'
import { resolveMapLocations } from '../../lib/jobCoords'
import { recordJobView } from '../../lib/viewHistoryStorage'
import { zaloMeUrl } from '../../lib/jobUtils'
import { useAppliedJobIds, useSavedJobIds } from '../data/useAppData'
import { appApplyButton } from '../data/applyAction'
import { buildDetailModel, DETAIL_LABELS, type DetailRow } from './detailModel'
import DetailRich from './DetailRich'

// 지도 부품은 웹 것을 그대로 쓴다(허용 목록). 지도 라이브러리가 커서 상세 지도 구역이 보일 때 처음 불러온다.
const JobVietMap = lazy(() => import('../../components/JobVietMap'))
const BENEFIT_ICONS = { bus: Bus, dorm: BedDouble, meal: Utensils, attendance: CalendarCheck, housing: House, fuel: Fuel, performance: ChartNoAxesColumnIncreasing } as const

function Row({ row }: { row: DetailRow }) {
  return (
    <div className="app-info__row"><dt>{row.label}</dt>
      <dd className={row.tone === 'soon' ? 'app-info__soon' : undefined}>
        {row.salary ? (
          <>
            {row.salary.period && <span className="app-pay-tag">{row.salary.period}</span>}
            {row.salary.rows?.length ? <span className="app-info__rows">{row.salary.rows.map((r, i) => <span key={i} className="app-info__rolerow"><span>{r.label}</span><b>{r.amount}</b></span>)}</span>
              : row.salary.parts?.length ? <span className="app-info__lines">{row.salary.parts.map((p, i) => <b key={i} className="app-pay-amount">{p}{i === 0 && row.salary?.overtimeNote ? <span className="app-info__sub"> · {row.salary.overtimeNote}</span> : null}</b>)}</span> : null}
            {row.salary.basis && <span> · {row.salary.basis}</span>}
            {row.salary.sub?.map((l, i) => <span key={i} className="app-info__sub">{l}</span>)}
            {row.salary.note && <span>{row.salary.amount ? ' · ' : ''}{row.salary.note}</span>}
          </>
        ) : row.lines ? <span className="app-info__lines">{row.lines.map((l, i) => <span key={i}>{l}</span>)}</span> : row.text}
      </dd>
    </div>
  )
}

export default function DetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { jobs, loading } = useJobs()
  const brands = useBrandsOptional()
  const saved = useSavedJobIds()
  const applied = useAppliedJobIds()
  const job = jobs.find((j) => j.id === id)
  const model = useMemo(() => (job ? buildDetailModel(job) : null), [job])
  const [tab, setTab] = useState<string>('conditions')
  useEffect(() => { if (job) recordJobView(job.id) }, [job])
  useEffect(() => { window.scrollTo(0, 0) }, [id])

  if (!job || !model) {
    return (
      <div className="app-page" data-testid="app-detail">
        <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Chi tiết việc làm</h1></header>
        <p className="app-state" role={loading ? 'status' : undefined}>{loading ? 'Đang tải…' : 'Tin tuyển dụng này không còn hoặc không tồn tại.'}</p>
        {!loading && <Link to="/" className="app-more">Xem việc làm khác</Link>}
      </div>
    )
  }

  const logo = [jobRepresentativeImageUrl(job, brands), industryPhotoUrl(job.category, job.subcategory, `${job.company} ${job.title}`, job.description)].find(Boolean)
  const contact = contactOf(job)
  const action = appApplyButton(job)
  const isSaved = saved.set.has(job.id)
  const mapLocations = resolveMapLocations(job)
  const displayPoints = mapLocations.source === 'default' ? [] : mapLocations.points
  const hasMapPoints = displayPoints.length > 0
  const plan = planJobDirections(job)
  const mapDirections = plan.tier === 'approved' ? plan.links : []
  const addresses = job.workLocations?.length ? job.workLocations.map((l) => l.rawAddress).filter(Boolean) : (job.recruitmentRegions?.length ? job.recruitmentRegions : job.rawLocation?.trim() ? [job.rawLocation.trim()] : [])
  const extraImages = (job.images ?? []).map(jobImagePublicUrl).filter((u): u is string => !!u)
  const hasConditions = model.conditionColumns.flat().length > 0 // PC 전용 행을 뺀 휴대폰 행 기준(웹도 휴대폰에서 그 행만으로 판단)
  const showDescription = model.sections.length > 0 || extraImages.length > 0
  const go = (key: string, sectionId: string) => { setTab(key); document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  return (
    <div className="app-page app-detail" data-testid="app-detail" data-job-id={job.id}>
      <header className="app-pagebar">
        <button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button>
        <h1 className="app-pagebar__title">Chi tiết việc làm</h1>
        <button type="button" className="app-icon-btn" aria-label={isSaved ? 'Bỏ lưu tin' : 'Lưu tin'} aria-pressed={isSaved} onClick={() => saved.toggle(job.id)}>{isSaved ? <BookmarkCheck size={22} aria-hidden /> : <Bookmark size={22} aria-hidden />}</button>
      </header>

      <section className="app-dcard" aria-label="Thông tin chính">
        <div className="app-dcard__top">
          {logo && <img className="app-dcard__logo" src={logo} alt="" />}
          <div className="app-dcard__chips">
            {model.categoryChip && <span className="app-pill">{model.categoryChip}</span>}
            {model.chips.map((c) => <span key={c.text} className={'app-pill' + (c.tone === 'urgent' ? ' app-pill--urgent' : c.tone === 'soon' ? ' app-pill--soon' : '')}>{c.text}</span>)}
          </div>
        </div>
        <h2 className="app-dcard__title">{model.title}</h2>
        {model.company && <p className="app-dcard__company">{model.company}</p>}
        {model.salaryHead && (
          <p className="app-dcard__salary">
            {model.salaryHead.period && <span className="app-pay-tag">{model.salaryHead.period}</span>}
            <span className="app-dcard__amount">{model.salaryHead.amount}</span>
            {model.salaryHead.basis && <small>{model.salaryHead.basis}</small>}
            {model.salaryHead.note && <small>{model.salaryHead.note}</small>}
          </p>
        )}
        <div className="app-benefits" aria-label="Phúc lợi: màu thể hiện quyền lợi được xác nhận; màu xám là chưa có thông tin">
          {model.benefits.map((b) => { const Icon = BENEFIT_ICONS[b.key as keyof typeof BENEFIT_ICONS]; return <span key={b.key} data-key={b.key} className={'app-benefit' + (b.active ? ' app-benefit--on' : '')}><span className="app-benefit__icon"><Icon size={19} strokeWidth={1.9} aria-hidden /></span><span>{b.label}</span></span> })}
        </div>
        {model.tags.length > 0 && <p className="app-card__tags">{model.tags.map((t) => <span key={t} className="app-tag">{t}</span>)}</p>}
        <p className="app-dcard__meta">{model.address && <span><MapPin size={13} aria-hidden />{model.address}</span>}<span>Ngày đăng: {model.posted} · Hạn nộp: {model.deadline}</span></p>
      </section>

      <nav className="app-dtabs" aria-label="Các phần của tin tuyển dụng">
        {model.tabs.filter((t) => t.key !== 'description' || showDescription).map((t) => <button key={t.key} type="button" className={tab === t.key ? 'app-on' : ''} aria-current={tab === t.key ? 'true' : undefined} onClick={() => go(t.key, t.sectionId)}>{t.label}</button>)}
      </nav>

      {hasConditions && (
        <section id="app-sec-conditions" className="app-dsec"><h2>{JOB_SECTION_LABELS.conditions}</h2>
          <dl className="app-box app-info">{model.conditionColumns.flat().map((r) => <Row key={r.key} row={r} />)}</dl>
        </section>
      )}
      {model.recruitRows.length > 0 && (
        <section id="app-sec-recruit" className="app-dsec"><h2>Thông tin tuyển dụng</h2>
          <dl className="app-box app-info">{model.recruitRows.map((r) => <Row key={r.key} row={r} />)}</dl>
        </section>
      )}

      <section id="app-sec-location" className="app-dsec"><h2>{JOB_SECTION_LABELS.location}</h2>
        {addresses.map((addr, i) => (
          <div className="app-addr" key={i}><MapPin size={15} aria-hidden /><span>{addr}</span><button type="button" onClick={() => { void navigator.clipboard?.writeText(addr) }}>Sao chép</button></div>
        ))}
        <div className="app-box app-map-box">
          {mapLocations.source === 'pending' && !hasMapPoints
            ? <p className="app-map-note" role="status">Đang xác minh khu vực theo địa chỉ trong tin gốc.</p>
            : hasMapPoints && (
              <>
                <Suspense fallback={<p className="app-map-note" role="status">Đang tải bản đồ…</p>}>
                  <JobVietMap lat={displayPoints[0].lat} lng={displayPoints[0].lng} title={job.title} zoom={mapLocations.zoom} height={240}
                    markers={displayPoints.map((p) => ({ ...p, jobId: job.id, label: `${p.label || job.title} · ${LOCATION_LABELS[p.kind === 'exact' && !p.precise ? 'area' : p.kind ?? 'area']}` }))}
                    directions={mapDirections} />
                </Suspense>
                <p className="app-map-note">{mapPointAccuracyNote(displayPoints)}</p>
              </>
            )}
          {plan.tier === 'approved' && <div className="app-map-links">{plan.links.map((l) => <a key={l.href} className="app-map-dir" href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}</div>}
          {plan.tier === 'gate' && <div className="app-map-links"><a className="app-map-dir" href={plan.link.href} target="_blank" rel="noopener noreferrer">{plan.link.label} ↗</a>{plan.note && <p className="app-map-note">{plan.note}</p>}</div>}
          {plan.tier === 'address' && (
            <div className="app-map-links">
              {plan.links.map((l) => <a key={l.href} className="app-map-dir" href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
              {plan.call && !(contact.phone || contact.zalo) && <a className="app-map-dir" href={plan.call.href}>{DIRECTIONS_LABEL.call}</a>}
              <p className="app-map-note">{plan.note}</p>
            </div>
          )}
          {plan.tier === 'call' && <div className="app-map-links"><a className="app-map-dir" href={plan.href}>{plan.label} ({plan.phone})</a><p className="app-map-note">Chưa có tọa độ đã xác minh — hãy gọi nhà tuyển dụng để hỏi đường.</p></div>}
          {!hasMapPoints && mapLocations.source !== 'pending' && <p className="app-map-note">Vị trí nơi làm việc chưa được xác minh.</p>}
        </div>
      </section>

      {showDescription && (
        <section id="app-sec-description" className="app-dsec"><h2>{JOB_SECTION_LABELS.description}</h2>
          {model.sections.length > 0 && (
            <div className="app-box app-desc">
              {model.rich
                ? <DetailRich {...model.rich} sections={model.sections} benefits={model.benefits} />
                : model.sections.map((section) => (
                  <section key={section.key} className="app-desc__sec"><h3>{section.label}</h3>
                    {(model.roleSections.find((s) => s.key === section.key)?.groups ?? []).map((group, gi) => (
                      <Fragment key={group.role ?? gi}>
                        {group.role && <p className="app-desc__line"><strong>{group.role}</strong></p>}
                        {group.lines.map((line, i) => <p key={i} className="app-desc__line">{line.replace(/^\s*[-•*]\s+/, '')}</p>)}
                      </Fragment>
                    ))}
                  </section>
                ))}
            </div>
          )}
          {extraImages.length > 0 && (
            <div className="app-box app-desc"><h3 className="app-desc__plain">{DETAIL_LABELS['08']}</h3>
              {extraImages.map((u, i) => <img key={u} className="app-desc__img" src={u} alt={`${job.title} — ${i + 1}`} loading="lazy" />)}
            </div>
          )}
        </section>
      )}
      <p className="app-warn">⚠️ Việc gần Bạn không thu phí. Cẩn thận nếu bị yêu cầu đặt cọc, mã OTP hoặc chuyển tiền.</p>
      {action.kind === 'none' && <p className="app-state" role="status">Tin này chưa có số điện thoại hay Zalo của nhà tuyển dụng. Nếu phần mô tả công việc có ghi cách liên hệ, vui lòng dùng thông tin đó.</p>}

      <div className="app-actionbar" data-testid="app-actionbar" data-action={action.kind}>
        <button type="button" className={'app-actionbar__save' + (isSaved ? ' app-on' : '')} aria-label={isSaved ? 'Bỏ lưu tin' : 'Lưu tin'} aria-pressed={isSaved} onClick={() => saved.toggle(job.id)}>{isSaved ? <BookmarkCheck size={22} aria-hidden /> : <Bookmark size={22} aria-hidden />}</button>
        {contact.phone && <a className="app-actionbar__btn" href={`tel:${contact.phone.replace(/\s/g, '')}`} aria-label={`Gọi ${contact.phone}`}><Phone size={17} aria-hidden />Gọi</a>}
        {contact.zalo && <a className="app-actionbar__btn" href={zaloMeUrl(contact.zalo)} target="_blank" rel="noopener noreferrer" aria-label="Liên hệ qua Zalo"><MessageCircle size={17} aria-hidden />Zalo</a>}
        {action.kind === 'internal' && (
          applied.has(job.id)
            ? <span className="app-actionbar__main app-actionbar__main--off">Đã ứng tuyển</span>
            // 사이트 안 지원(로그인·CV)은 2단계(회원·지원)에서 앱에 만든다. 그 전에는 같은 사이트의 웹 상세 지원 화면으로 연결한다.
            : <a className="app-actionbar__main" href={`/viec-lam/${job.id}`}>Ứng tuyển ngay</a>
        )}
        {action.kind === 'none' && !contact.phone && !contact.zalo && <span className="app-actionbar__main app-actionbar__main--off">Chưa có thông tin liên hệ</span>}
      </div>
    </div>
  )
}
