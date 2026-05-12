import type { Job } from '../types/job'

const DEFAULT = { lat: 16.0471, lng: 108.2068 }

const PLACES: { keys: string[]; lat: number; lng: number }[] = [
  { keys: ['bac ninh', 'bắc ninh'], lat: 21.1861, lng: 106.0763 },
  { keys: ['ha noi', 'hà nội', 'ha dong', 'hà đông', 'cau giay', 'cầu giấy'], lat: 21.0285, lng: 105.8542 },
  { keys: ['ho chi minh', 'hồ chí minh', 'tp.hcm', 'tp. hcm', 'sai gon', 'sài gòn', 'quan 1', 'quận 1', 'q1'], lat: 10.7769, lng: 106.7009 },
  { keys: ['da nang', 'đà nẵng'], lat: 16.0471, lng: 108.2068 },
  { keys: ['binh duong', 'bình dương'], lat: 11.3254, lng: 106.4774 },
  { keys: ['hai phong', 'hải phòng'], lat: 20.8449, lng: 106.6881 },
  { keys: ['can tho', 'cần thơ'], lat: 10.0452, lng: 105.7469 },
  { keys: ['nha trang'], lat: 12.2388, lng: 109.1967 },
  { keys: ['hue', 'huế'], lat: 16.4637, lng: 107.5909 },
]

/** Chuẩn hoá để so khớp địa điểm / từ khoá (bỏ dấu, thường). */
export function normalizeViText(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ước lượng tọa độ từ chuỗi địa điểm (VN) */
export function guessCoordinatesFromLocation(location: string): { lat: number; lng: number } {
  const n = normalizeViText(location)
  if (!n) return { ...DEFAULT }
  for (const p of PLACES) {
    if (p.keys.some((k) => n.includes(normalizeViText(k)))) {
      return { lat: p.lat, lng: p.lng }
    }
  }
  return { ...DEFAULT }
}

export function withJobCoordinates(job: Job): Job {
  if (
    typeof job.lat === 'number' &&
    typeof job.lng === 'number' &&
    Number.isFinite(job.lat) &&
    Number.isFinite(job.lng)
  ) {
    return job
  }
  const c = guessCoordinatesFromLocation(job.location)
  return { ...job, lat: c.lat, lng: c.lng }
}
