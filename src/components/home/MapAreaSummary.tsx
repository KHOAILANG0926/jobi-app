import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_SHORT } from '../../data/categories'
import { summarizeMapEntries, type MapEntry } from '../../lib/mapR1'
import type { JobCategory } from '../../types/job'
import styles from './MapAreaSummary.module.css'

interface Props {
  entries: MapEntry[]
  radiusLabel?: string
  selectedCategories: JobCategory[]
  onCategory: (category: JobCategory) => void
  onClearCategory: () => void
  loading: boolean
  error: boolean
}

export default function MapAreaSummary({ entries, radiusLabel, selectedCategories, onCategory, onClearCategory, loading, error }: Props) {
  const summary = summarizeMapEntries(entries)
  return (
    <div className={styles.summary} data-testid="map-area-summary">
      <p className={styles.eyebrow}>TỔNG QUAN VIỆC LÀM</p>
      <h2 className={styles.title}>Trong khung bản đồ</h2>
      <p className={styles.subtitle}>Cập nhật khi bạn di chuyển hoặc thu phóng bản đồ.</p>
      <div className={styles.total} aria-live="polite" aria-atomic="true">
        <strong data-testid="map-summary-total">{loading ? '…' : summary.total}</strong>
        <span>việc làm phù hợp</span>
      </div>
      {radiusLabel && <p className={styles.radius}>Trong bán kính {radiusLabel}</p>}
      {error ? <p role="status">Chưa tải được đầy đủ việc làm. Vui lòng thử lại sau.</p> : (
        <>
          <div className={styles.heading}><h3>Theo ngành</h3>{selectedCategories.length > 0 && <button type="button" onClick={onClearCategory}>Bỏ lọc ngành</button>}</div>
          {selectedCategories.length > 0 && <p className={styles.filter}>Đang lọc: {selectedCategories.map(c => CATEGORY_SHORT[c]).join(', ')}</p>}
          <div className={styles.categories}>
            {summary.categories.map(({ category, count }) => (
              <button type="button" key={category} className={styles.category} aria-pressed={selectedCategories.includes(category)}
                data-category={category} onClick={() => onCategory(category)}>
                <span className={styles.icon} aria-hidden>{CATEGORY_ICONS[category]}</span>
                <span className={styles.label}>{CATEGORY_LABELS[category]}<span className={styles.track} aria-hidden><span style={{ width: `${count / summary.total * 100}%` }} /></span></span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          {!loading && summary.total === 0 && <p className={styles.empty}>Chưa có việc làm phù hợp trong khung bản đồ này. Hãy di chuyển bản đồ hoặc đổi bộ lọc.</p>}
          {summary.total > 0 && <div className={styles.urgent}><span>Tuyển gấp</span><strong>{summary.urgent}</strong></div>}
        </>
      )}
      <p className={styles.note}>Chỉ tính tin có ghim trong khung bản đồ và điều kiện đã chọn. Có thể gồm vị trí đại diện của KCN hoặc khu vực.</p>
      <p className={styles.hint}>Chọn ngành để lọc · Chọn ghim để xem chi tiết</p>
    </div>
  )
}
