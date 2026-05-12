import { useEffect, useState } from 'react'
import {
  REGION_MACRO_TABS,
  macroGroupForRegionId,
  type MacroGroupId,
  type RegionFilter,
} from '../data/jobRegions'

type Props = {
  value: RegionFilter
  onChange: (next: RegionFilter) => void
}

export function RegionFilter({ value, onChange }: Props) {
  const [openMacro, setOpenMacro] = useState<MacroGroupId | null>(null)

  useEffect(() => {
    if (value === 'all') return
    const m = macroGroupForRegionId(value)
    if (m) setOpenMacro(m)
  }, [value])

  const isAll = value === 'all'

  const macroTabActive = (id: MacroGroupId) =>
    openMacro === id || (!isAll && macroGroupForRegionId(value) === id)

  const onAllClick = () => {
    onChange('all')
    setOpenMacro(null)
  }

  const onMacroClick = (id: MacroGroupId) => {
    if (!isAll && macroGroupForRegionId(value) !== id) {
      onChange('all')
    }
    setOpenMacro(id)
  }

  const openTab = REGION_MACRO_TABS.find((t) => t.id === openMacro)

  return (
    <div className="region-filter">
      <div className="region-filter__tabs" role="tablist" aria-label="Khu vực tuyển dụng">
        <button
          type="button"
          role="tab"
          id="region-tab-all"
          aria-selected={isAll}
          className={`region-filter__tab region-filter__tab--all${isAll ? ' region-filter__tab--active' : ''}`}
          onClick={onAllClick}
        >
          Tất cả
        </button>
        {REGION_MACRO_TABS.map((tab) => {
          const active = macroTabActive(tab.id)
          const filterOnThisMacro = !isAll && macroGroupForRegionId(value) === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`region-tab-${tab.id}`}
              aria-selected={filterOnThisMacro}
              aria-expanded={openMacro === tab.id}
              aria-controls="region-filter-panel"
              className={`region-filter__tab region-filter__tab--${tab.id}${active ? ' region-filter__tab--active' : ''}`}
              onClick={() => onMacroClick(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {openMacro && openTab ? (
        <div
          id="region-filter-panel"
          className={`region-filter__panel region-filter__panel--${openMacro}`}
          role="tabpanel"
          aria-labelledby={`region-tab-${openMacro}`}
        >
          <p className="region-filter__panel-label">Chọn tỉnh / thành</p>
          <div className="region-filter__pills" role="group" aria-label={`Tỉnh thành ${openTab.label}`}>
            {openTab.provinces.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`region-filter__pill${value === p.id ? ' region-filter__pill--active' : ''}`}
                onClick={() => onChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
