import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import JobLocationMap from '../components/JobLocationMap'
import { resolveMapLocations } from '../lib/jobCoords'
import { fetchKoreaJob, fetchKoreaJobWorkLocations } from '../lib/koreaJobsApi'
import type { KoreaJob, KoreaJobWorkLocation } from '../types/koreaJob'

const SALARY_UNIT: Record<string, string> = {
  hourly: '/giờ', daily: '/ngày', monthly: '/tháng', annual: '/năm',
}

function formatSalary(job: KoreaJob): string | null {
  if (job.salary_min != null || job.salary_max != null) {
    const unit = job.salary_type ? SALARY_UNIT[job.salary_type] ?? '' : ''
    const min = job.salary_min != null ? job.salary_min.toLocaleString('ko-KR') : null
    const max = job.salary_max != null ? job.salary_max.toLocaleString('ko-KR') : null
    if (min && max && min !== max) return `${min} - ${max} KRW${unit}`
    if (min || max) return `${min ?? max} KRW${unit}`
  }
  return job.salary
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#1a1a1a', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function yesNo(v: boolean | null): string | null {
  if (v === null) return null
  return v ? 'Có' : 'Không'
}

export default function KoreaJobDetail() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<KoreaJob | null>(null)
  const [workLocations, setWorkLocations] = useState<KoreaJobWorkLocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const numericId = Number(id)
    if (!id || Number.isNaN(numericId)) { setLoading(false); return }
    let cancelled = false
    Promise.all([fetchKoreaJob(numericId), fetchKoreaJobWorkLocations(numericId)]).then(
      ([jobData, locations]) => {
        if (cancelled) return
        setJob(jobData)
        setWorkLocations(locations)
        setLoading(false)
      },
    )
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return <div className="page page--narrow" role="status" style={{ textAlign: 'center', padding: '64px 24px' }}>Đang tải...</div>
  }

  if (!job) {
    return (
      <div className="page page--narrow not-found">
        <h1>Không tìm thấy tin tuyển dụng</h1>
        <p>Tin có thể đã hết hạn hoặc không tồn tại.</p>
        <Link to="/viec-han-quoc" className="btn btn--primary">Quay lại danh sách</Link>
      </div>
    )
  }

  const geocoded = workLocations.filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number')
  // resolveMapLocations()의 region/default fallback은 베트남 지명만 알기 때문에, 실제
  // geocode된 근무지가 있을 때만 호출한다(그 경우엔 fallback 경로를 아예 안 타므로 안전).
  const mapView = geocoded.length > 0
    ? resolveMapLocations({
        workLocations: geocoded.map((l) => ({ rawAddress: l.raw_address, lat: l.lat!, lng: l.lng! })),
      })
    : null

  return (
    <div style={{ background: '#f7f8fc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 16px' }}>
        <Link to="/viec-han-quoc" style={{ color: '#c0392b', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
          ← Quay lại danh sách
        </Link>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', marginTop: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          {job.category && (
            <span style={{ display: 'inline-block', background: '#fff3f3', color: '#c0392b', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>
              {job.category}
            </span>
          )}
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.3 }}>{job.title}</h1>
          {job.company && <p style={{ color: '#555', fontWeight: 600, margin: 0 }}>{job.company}</p>}
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginTop: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>THÔNG TIN TUYỂN DỤNG</h2>
          <InfoRow label="Mức lương" value={formatSalary(job)} />
          <InfoRow label="Khu vực" value={job.province ? [job.province, job.district].filter(Boolean).join(' ') : job.region} />
          <InfoRow label="Hạn nộp hồ sơ" value={job.deadline} />
          <InfoRow label="Thời gian làm việc" value={job.working_hours} />
          <InfoRow label="Ngày làm việc" value={job.working_days} />
          <InfoRow label="Ngày nghỉ" value={job.days_off} />
          <InfoRow label="Số lượng tuyển" value={job.headcount != null ? String(job.headcount) : null} />
          <InfoRow label="Yêu cầu giới tính" value={job.gender_condition === 'male' ? 'Nam' : job.gender_condition === 'female' ? 'Nữ' : job.gender_condition === 'any' ? 'Không yêu cầu' : null} />
          <InfoRow label="Độ tuổi" value={job.age_condition} />
          <InfoRow label="Yêu cầu tiếng Hàn" value={job.korean_level_required} />
          <InfoRow label="Kinh nghiệm" value={job.experience_required} />
          <InfoRow label="Yêu cầu visa" value={job.visa_status_required} />
          <InfoRow label="Ký túc xá" value={yesNo(job.dormitory)} />
          <InfoRow label="Ăn uống" value={yesNo(job.meals)} />
          <InfoRow label="Đưa đón" value={yesNo(job.transportation)} />
        </div>

        {geocoded.length > 0 && mapView && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginTop: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>KHU VỰC LÀM VIỆC</h2>
            {geocoded.map((loc) => (
              <p key={loc.id} style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>{loc.raw_address}</p>
            ))}
            <JobLocationMap
              lat={mapView.points[0].lat}
              lng={mapView.points[0].lng}
              title={job.title ?? ''}
              zoom={mapView.zoom}
              extraMarkers={mapView.points.length > 1 ? mapView.points : undefined}
            />
            <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              Vị trí hiển thị là vị trí gần đúng theo khu vực tuyển dụng.
            </p>
          </div>
        )}

        {job.description && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginTop: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>MÔ TẢ CÔNG VIỆC</h2>
            <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{job.description}</p>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginTop: '16px', marginBottom: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>CÁCH LIÊN HỆ ỨNG TUYỂN</h2>
          <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.6, marginBottom: job.source_url ? '16px' : 0 }}>
            {job.contact_method || 'Vui lòng xem chi tiết tại tin tuyển dụng gốc để biết cách liên hệ.'}
          </p>
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px', background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
                color: '#fff', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                textDecoration: 'none', boxShadow: '0 2px 8px rgba(192,57,43,0.3)',
              }}
            >
              Xem tin gốc & Liên hệ ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
