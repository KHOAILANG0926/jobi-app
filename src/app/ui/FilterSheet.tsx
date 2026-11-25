import { useMemo, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { CATEGORY_LABELS } from '../../data/categories'
import { JOB_DURATION_OPTIONS } from '../../data/jobDuration'
import { AGE_REQUIREMENT_OPTIONS } from '../../data/jobRequirements'
import { EXTRA_CONDITION_GROUPS, formatSalaryOption, SALARY_OPTIONS, type ExtraConditionKey } from '../../lib/homeMapFilters'
import { EMPLOYMENT_TYPE_LABEL } from '../../lib/jobDetailView'
import { DAY_LABELS, DAY_ORDER, TIME_BUCKET_LABELS, TIME_BUCKET_ORDER } from '../../lib/workScheduleParse'
import type { Job, JobCategory } from '../../types/job'
import { useJobAreas } from '../data/useAppData'
import { applyAppFilters, EMPTY_APP_FILTERS, type AppFilterState } from '../filters/applyFilters'
import BottomSheet from './BottomSheet'
import RegionSheet, { shortProvince } from './RegionSheet'

// 필터 시트(V3 시안) — 탭 = 섹션(1:1). 조건은 웹 필터가 이미 가진 것만 담는다(없는 데이터는 칸을 만들지 않는다).
export const FILTER_SECTIONS = [
  { id: 'region', tab: 'Khu vực' }, { id: 'category', tab: 'Ngành nghề' }, { id: 'duration', tab: 'Thời gian' }, { id: 'days', tab: 'Ngày' },
  { id: 'hours', tab: 'Giờ' }, { id: 'salary', tab: 'Lương' }, { id: 'benefit', tab: 'Phúc lợi' }, { id: 'type', tab: 'Hình thức' }, { id: 'other', tab: 'Khác' },
] as const
export type FilterSectionId = (typeof FILTER_SECTIONS)[number]['id']

const EXTRA_BY_TITLE = new Map(EXTRA_CONDITION_GROUPS.map((g) => [g.title, g.items]))
const extraKeys = (title: string): { key: ExtraConditionKey; label: string }[] => (EXTRA_BY_TITLE.get(title) ?? []).map((c) => ({ key: c.key, label: c.label }))

function Chips<T extends string | number>({ items, value, onToggle, label }: { items: { key: T; label: string }[]; value: readonly T[]; onToggle: (k: T) => void; label: string }) {
  return (
    <div className="app-chip-row app-chip-row--wrap" role="group" aria-label={label}>
      {items.map((it) => <button key={String(it.key)} type="button" className={'app-opt' + (value.includes(it.key) ? ' app-on' : '')} aria-pressed={value.includes(it.key)} onClick={() => onToggle(it.key)}>{it.label}</button>)}
    </div>
  )
}
const toggleIn = <T,>(arr: readonly T[], k: T): T[] => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k])

export default function FilterSheet({ initial, jobs, section, hasOrigin, onApply, onClose }: { initial: AppFilterState; jobs: Job[]; section?: FilterSectionId; hasOrigin?: boolean; onApply: (f: AppFilterState) => void; onClose: () => void }) {
  const [d, setD] = useState<AppFilterState>(initial)
  const [regionOpen, setRegionOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [keywordDraft, setKeywordDraft] = useState('')
  const [active, setActive] = useState<FilterSectionId>(section ?? 'region')
  const patch = (p: Partial<AppFilterState>) => setD((cur) => ({ ...cur, ...p }))
  const toggleExtra = (k: ExtraConditionKey) => patch({ extras: toggleIn(d.extras, k) })
  const areas = useJobAreas(jobs, d.province !== null)
  const count = useMemo(() => applyAppFilters(jobs, d, areas).length, [jobs, d, areas])
  const go = (id: FilterSectionId) => { setActive(id); document.getElementById('app-fs-' + id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
  const ageItems = AGE_REQUIREMENT_OPTIONS.map((a) => ({ key: a as string, label: a }))
  return (
    <BottomSheet full title="Bộ lọc việc làm" onClose={onClose}
      footer={<div className="app-sheet__foot-row"><button type="button" className="app-btn app-btn--ghost" onClick={() => setD({ ...EMPTY_APP_FILTERS, province: d.province, wards: d.wards })}>Đặt lại</button><button type="button" className="app-btn app-btn--primary" onClick={() => { onApply(d); onClose() }}>Xem {count} việc làm</button></div>}>
      <p className="app-sheet__hint">Điều kiện lọc được áp dụng cho mọi danh sách việc làm.</p>
      <nav className="app-fs-tabs" aria-label="Nhóm điều kiện">
        {FILTER_SECTIONS.map((s) => <button key={s.id} type="button" className={active === s.id ? 'app-on' : ''} onClick={() => go(s.id)}>{s.tab}</button>)}
      </nav>

      <section className="app-fs" id="app-fs-region"><h3>Khu vực làm việc</h3>
        <button type="button" className="app-add-btn" onClick={() => setRegionOpen(true)}>{d.province ? <><MapPin size={16} aria-hidden />{shortProvince(d.province)}{d.wards.length > 0 ? ` · ${d.wards.length} phường/xã` : ''}</> : <><Plus size={16} aria-hidden />Thêm khu vực</>}</button>
        {hasOrigin && <Chips label="Bán kính" items={[1, 3, 5, 10, 20].map((k) => ({ key: k, label: `${k} km` }))} value={[d.radiusKm]} onToggle={(k) => patch({ radiusKm: k })} />}
      </section>

      <section className="app-fs" id="app-fs-category"><h3>Ngành nghề</h3>
        <button type="button" className="app-add-btn" onClick={() => setCatOpen(true)}>{d.categories.length ? d.categories.map((c) => CATEGORY_LABELS[c]).join(', ') : <><Plus size={16} aria-hidden />Thêm ngành nghề</>}</button>
      </section>

      <section className="app-fs" id="app-fs-duration"><h3>Thời gian làm việc</h3>
        <Chips label="Thời gian làm việc" items={JOB_DURATION_OPTIONS.map((o) => ({ key: o as string, label: o }))} value={d.jobDurations} onToggle={(k) => patch({ jobDurations: toggleIn(d.jobDurations, k) })} />
      </section>

      <section className="app-fs" id="app-fs-days"><h3>Ngày làm việc</h3>
        <Chips label="Ngày trong tuần" items={DAY_ORDER.map((c) => ({ key: c, label: DAY_LABELS[c] }))} value={d.days} onToggle={(k) => patch({ days: toggleIn(d.days, k) })} />
        <Chips label="Lịch làm việc" items={extraKeys('Lịch làm việc')} value={d.extras} onToggle={toggleExtra} />
      </section>

      <section className="app-fs" id="app-fs-hours"><h3>Giờ làm việc</h3>
        <Chips label="Khung giờ" items={TIME_BUCKET_ORDER.map((b) => ({ key: b, label: TIME_BUCKET_LABELS[b] }))} value={d.timeBuckets} onToggle={(k) => patch({ timeBuckets: toggleIn(d.timeBuckets, k) })} />
        <Chips label="Ca làm việc" items={extraKeys('Ca làm việc')} value={d.extras} onToggle={toggleExtra} />
      </section>

      <section className="app-fs" id="app-fs-salary"><h3>Mức lương tháng</h3>
        <Chips label="Mức lương tối thiểu" items={SALARY_OPTIONS.map((s) => ({ key: s, label: formatSalaryOption(s) }))} value={d.minSalary === null ? [] : [d.minSalary]} onToggle={(k) => patch({ minSalary: d.minSalary === k ? null : k })} />
      </section>

      <section className="app-fs" id="app-fs-benefit"><h3>Đi lại · Phúc lợi</h3>
        <Chips label="Đi lại · Phúc lợi" items={extraKeys('Đi lại · Phúc lợi')} value={d.extras} onToggle={toggleExtra} />
        <Chips label="Hợp đồng · BHXH" items={[{ key: 'pledge', label: 'Có cam kết hợp đồng / BHXH' }]} value={d.pledgeOnly ? ['pledge'] : []} onToggle={() => patch({ pledgeOnly: !d.pledgeOnly })} />
      </section>

      <section className="app-fs" id="app-fs-type"><h3>Hình thức làm việc</h3>
        <Chips label="Hình thức làm việc" items={(Object.keys(EMPLOYMENT_TYPE_LABEL) as (keyof typeof EMPLOYMENT_TYPE_LABEL)[]).map((k) => ({ key: k, label: EMPLOYMENT_TYPE_LABEL[k] }))} value={d.employmentTypes} onToggle={(k) => patch({ employmentTypes: toggleIn(d.employmentTypes, k) })} />
      </section>

      <section className="app-fs" id="app-fs-other"><h3>Điều kiện khác</h3>
        <Chips label="Hình thức tuyển" items={extraKeys('Hình thức tuyển')} value={d.extras} onToggle={toggleExtra} />
        <Chips label="Tình trạng tuyển" items={extraKeys('Tình trạng tuyển')} value={d.extras} onToggle={toggleExtra} />
        <Chips label="Giới tính" items={[{ key: 'Nam', label: 'Nam' }, { key: 'Nữ', label: 'Nữ' }]} value={d.gender ? [d.gender] : []} onToggle={(k) => patch({ gender: d.gender === k ? null : (k as 'Nam' | 'Nữ') })} />
        <Chips label="Độ tuổi" items={ageItems} value={d.age ? [d.age] : []} onToggle={(k) => patch({ age: d.age === k ? '' : k })} />
        <form className="app-keyword" onSubmit={(e) => { e.preventDefault(); const v = keywordDraft.trim(); if (v) patch({ keywords: [...new Set([...d.keywords, v])] }); setKeywordDraft('') }}>
          <input type="text" value={keywordDraft} onChange={(e) => setKeywordDraft(e.target.value)} placeholder="Từ khóa…" aria-label="Từ khóa" />
        </form>
        {d.keywords.length > 0 && <div className="app-chip-row app-chip-row--wrap">{d.keywords.map((k) => <button key={k} type="button" className="app-opt app-on" onClick={() => patch({ keywords: d.keywords.filter((x) => x !== k) })}>{k} ×</button>)}</div>}
      </section>

      {regionOpen && <RegionSheet province={d.province} wards={d.wards} onApply={(p, w) => patch({ province: p, wards: w })} onClose={() => setRegionOpen(false)} />}
      {catOpen && (
        <BottomSheet title="Chọn ngành nghề" onClose={() => setCatOpen(false)} footer={<button type="button" className="app-btn app-btn--primary" onClick={() => setCatOpen(false)}>Xong</button>}>
          <Chips label="Ngành nghề" items={(Object.keys(CATEGORY_LABELS) as JobCategory[]).map((c) => ({ key: c, label: CATEGORY_LABELS[c] }))} value={d.categories} onToggle={(k) => patch({ categories: toggleIn(d.categories, k) })} />
        </BottomSheet>
      )}
    </BottomSheet>
  )
}
