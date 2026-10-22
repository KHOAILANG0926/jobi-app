import { useState } from 'react'
import { ArrowUpRight, Wallet } from 'lucide-react'
import { SALARY_OPTIONS, formatSalaryOption, type HomeMapFilterState } from '../../lib/homeMapFilters'
import './salary-ticket.css'

type SalarySelection = Pick<HomeMapFilterState, 'minSalary' | 'salaryMode'>

export default function SalaryTicket({ filters, onChange }: {
  filters: SalarySelection
  onChange: (selection: SalarySelection) => void
}) {
  const [lastMonthly, setLastMonthly] = useState(filters.minSalary ?? 8_000_000)
  const mode = filters.salaryMode ?? (filters.minSalary === null ? 'all' : 'month')
  const selectAmount = (value: number) => {
    setLastMonthly(value)
    onChange({ minSalary: value, salaryMode: undefined })
  }
  return <div className="hme-block salary-ticket" aria-label="Tìm theo mức lương">
    <div className="hme-block__head"><Wallet size={16} aria-hidden /><span>Tìm theo mức lương</span></div>
    <div className="salary-ticket__paper">
      <div className="salary-ticket__amounts" role="group" aria-label="Mức lương tháng">
        {SALARY_OPTIONS.map(value => <button type="button" key={value} aria-pressed={filters.minSalary === value && !filters.salaryMode}
          aria-label={formatSalaryOption(value)} onClick={() => selectAmount(value)}>
          <strong>{value / 1_000_000}M</strong><span>trở lên</span>
        </button>)}
        <button type="button" aria-label="Tất cả mức lương" aria-pressed={mode === 'all'} onClick={() => onChange({ minSalary: null, salaryMode: undefined })}>
          <strong className="salary-ticket__all">Tất cả</strong>
        </button>
      </div>
      <div className="salary-ticket__footer" role="group" aria-label="Loại lương khác">
        <button type="button" aria-label="Lương ngày / giờ" aria-pressed={mode === 'daily_hourly'} onClick={() => onChange({ minSalary: null, salaryMode: 'daily_hourly' })}>
          <span>Ngày / giờ</span><ArrowUpRight size={14} aria-hidden />
        </button>
        <button type="button" aria-pressed={mode === 'negotiable'} onClick={() => onChange({ minSalary: null, salaryMode: 'negotiable' })}>
          <span>Thỏa thuận</span><ArrowUpRight size={14} aria-hidden />
        </button>
      </div>
    </div>
    {mode === 'daily_hourly' || mode === 'negotiable' ? <button className="salary-ticket__return" type="button" onClick={() => selectAmount(lastMonthly)}>← Lương tháng</button> : null}
    <p className="salary-ticket__hint">Mức M+ theo lương tháng ghi trong tin. Không quy đổi lương ngày / giờ.</p>
  </div>
}
