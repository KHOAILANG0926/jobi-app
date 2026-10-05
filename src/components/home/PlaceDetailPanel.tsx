// 지도에서 클릭한 건물/시설 상세 (2026-10-05, 생활지도 2차). VietMap 원천 데이터와
// JOBI 공고의 확인된 근무지 좌표만 쓴다. 건물 이름은 폴리곤 "안"에 POI가 하나뿐일 때만
// 보여주고, 그 외에는 "Chưa có tên trên bản đồ"로 둔다.
import { NavLink } from 'react-router-dom'
import { ArrowLeft, Building2, MapPin, Satellite, X } from 'lucide-react'
import type { Job } from '../../types/job'
import type { HomeMapMode } from './map/HomeMapTypes'
import { NearbySummaryView } from './NearbyLifePanel'
import { formatMeters } from '../../lib/nearbyFacilities'
import { buildingNameFromInside, isWorkplacePlace, poiCategoryLabel, type JobNearPlace, type PickedPlace } from '../../lib/mapPlace'
import { calcDistanceKm } from '../../lib/jobCoords'

interface Props {
  place: PickedPlace
  origin: { label: string; point: { lat: number; lng: number } }
  selectedJob: { title: string; point: { lat: number; lng: number } } | null
  jobs: JobNearPlace<Job>[]
  /** 지도 결과(현재 필터·반경)에 있는 공고 id — 지도에서 선택 가능. */
  selectableIds: Set<string>
  mapMode: HomeMapMode
  onMapModeChange: (mode: HomeMapMode) => void
  onSelectJob: (id: string) => void
  onRequestZoom: () => void
  onClose: () => void
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return Math.round(calcDistanceKm(a.lat, a.lng, b.lat, b.lng) * 1000)
}

export default function PlaceDetailPanel({ place, origin, selectedJob, jobs, selectableIds, mapMode, onMapModeChange, onSelectJob, onRequestZoom, onClose }: Props) {
  const buildingName = place.kind === 'building' ? buildingNameFromInside(place.insidePois) : null
  const title = place.kind === 'poi' ? place.name! : buildingName ?? 'Tòa nhà chưa có tên trên bản đồ'
  const category = place.kind === 'poi' ? poiCategoryLabel(place.cls, place.name) : 'Tòa nhà'
  const workplace = isWorkplacePlace(place)
  const samePlace = jobs.filter((j) => j.samePlace)
  const nearbyJobs = jobs.filter((j) => !j.samePlace)

  return (
    <div className="hme-place" data-testid="place-detail" data-place-kind={place.kind} data-place-key={place.key}>
      <div className="hme-place__bar">
        {selectedJob && <button type="button" className="hme-place__back" onClick={onClose}><ArrowLeft size={15} aria-hidden /> Tin đang chọn</button>}
        <button type="button" className="hme-job__close" aria-label="Đóng thông tin địa điểm" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="hme-place__category">{place.kind === 'building' ? <Building2 size={14} aria-hidden /> : <MapPin size={14} aria-hidden />} {category}{workplace && place.kind === 'poi' ? ' · nơi làm việc' : ''}</div>
      <h3 className={`hme-place__title${place.kind === 'building' && !buildingName ? ' is-unknown' : ''}`}>{title}</h3>

      {place.kind === 'building' && (
        <div className="hme-place__inside">
          {place.insidePois.length === 0 && <p>Bản đồ chưa ghi tên hoặc doanh nghiệp nào nằm trong tòa nhà này.</p>}
          {place.insidePois.length === 1 && <p>Tên lấy từ điểm <strong>{place.insidePois[0].name}</strong> ({poiCategoryLabel(place.insidePois[0].cls, place.insidePois[0].name)}) nằm trong ranh giới tòa nhà.</p>}
          {place.insidePois.length > 1 && (
            <>
              <p>{place.insidePois.length} điểm nằm trong tòa nhà (không chọn một tên chung):</p>
              <ul>{place.insidePois.slice(0, 8).map((p) => <li key={`${p.name}-${p.lat}`}>{p.name} <span>· {poiCategoryLabel(p.cls, p.name)}</span></li>)}</ul>
            </>
          )}
        </div>
      )}

      <dl className="hme-place__rows">
        <div><dt>Tọa độ</dt><dd>{place.lat.toFixed(5)}, {place.lng.toFixed(5)}{place.kind === 'building' ? ' (giữa tòa nhà)' : ''}</dd></div>
        <div><dt>Từ {origin.label}</dt><dd>{formatMeters(distanceM(origin.point, place))} · đường chim bay</dd></div>
        {selectedJob && <div><dt>Từ tin đang chọn</dt><dd>{formatMeters(distanceM(selectedJob.point, place))}</dd></div>}
      </dl>
      <p className="hme-job__note">Bản đồ chưa có địa chỉ chính thức cho điểm này — hiển thị theo tọa độ.</p>

      <button type="button" className="hme-place__sat" aria-pressed={mapMode === 'satellite'} onClick={() => onMapModeChange(mapMode === 'satellite' ? 'street' : 'satellite')}>
        <Satellite size={15} aria-hidden /> {mapMode === 'satellite' ? 'Về bản đồ thường' : 'Xem ảnh vệ tinh'}
      </button>

      <section className="hme-place__jobs" aria-label="Việc làm tại đây">
        <h4 className="hme-life__title">Việc làm trên Viecganban</h4>
        {jobs.length === 0 ? (
          <p className="hme-place__empty">Chưa có tin tuyển dụng tại hoặc trong 500 m quanh điểm này.</p>
        ) : (
          <>
            {samePlace.length > 0 && <div className="hme-life__sub">Tại {place.kind === 'building' ? 'tòa nhà' : 'địa điểm'} này ({samePlace.length})</div>}
            <ul>{samePlace.map((j) => <JobRow key={j.job.id} item={j} selectable={selectableIds.has(j.job.id)} onSelect={onSelectJob} />)}</ul>
            {nearbyJobs.length > 0 && <div className="hme-life__sub">Trong 500 m ({nearbyJobs.length})</div>}
            <ul>{nearbyJobs.slice(0, 6).map((j) => <JobRow key={j.job.id} item={j} selectable={selectableIds.has(j.job.id)} onSelect={onSelectJob} />)}</ul>
          </>
        )}
      </section>

      {place.nearby && (
        <NearbySummaryView
          key={place.key}
          summary={place.nearby}
          title="Quanh điểm này"
          origin="điểm đã chọn"
          footer={!place.nearbyComplete && (
            <p className="hme-life__note hme-place__partial">
              Ở mức thu phóng hiện tại bản đồ chưa tải hết điểm sinh hoạt.{' '}
              <button type="button" className="hme-more-link" onClick={onRequestZoom}>Phóng to để đếm đầy đủ</button>
            </p>
          )}
        />
      )}
    </div>
  )
}

function JobRow({ item, selectable, onSelect }: { item: JobNearPlace<Job>; selectable: boolean; onSelect: (id: string) => void }) {
  const { job, distanceM: d } = item
  const body = (
    <>
      <span className="hme-place__job-title">{job.title}</span>
      <span className="hme-place__job-meta">{job.company} · {item.samePlace ? 'cùng địa điểm' : formatMeters(d)}</span>
    </>
  )
  return (
    <li>
      {selectable
        ? <button type="button" className="hme-place__job" onClick={() => onSelect(job.id)}>{body}</button>
        : <NavLink className="hme-place__job" to={`/viec-lam/${job.id}${job.id.startsWith('acceptance-') ? '?mapAcceptance=1' : ''}`}>{body}</NavLink>}
    </li>
  )
}
