import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatVnd } from '../lib/formatVnd'

function CalculatorIcon() {
  return (
    <svg className="salary-calc__icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <path
        fill="currentColor"
        d="M7 2h10a2 2 0 012 2v5.33h-2V4H7v16h5v2H7a2 2 0 01-2-2V4a2 2 0 012-2zm7.5 8.5a1 1 0 011 1v1H19a1 1 0 011 1V19a2 2 0 01-2 2h-6a2 2 0 01-2-2v-5.5a1 1 0 011-1h1v-1a1 1 0 011-1h3.5zm-4 4H12v4h6v-4h-1.5zm2.5 1a1 1 0 100 2 1 1 0 000-2zm2 0a1 1 0 100 2 1 1 0 000-2zM9 6H8v1h1V6zm0 3H8v1h1V9zm3-3h-1v1h1V6zm0 3h-1v1h1V9z"
      />
    </svg>
  )
}

export function SalaryCalculator() {
  const [rate, setRate] = useState(25000)
  const [hoursPerDay, setHoursPerDay] = useState(4)
  const [daysPerWeek, setDaysPerWeek] = useState(5)

  const { daily, weekly, monthly } = useMemo(() => {
    const r = Number(rate) || 0
    const h = Number(hoursPerDay) || 0
    const d = Number(daysPerWeek) || 0
    const day = r * h
    const week = day * d
    const month = week * (52 / 12)
    return { daily: day, weekly: week, monthly: month }
  }, [rate, hoursPerDay, daysPerWeek])

  return (
    <div className="page page--narrow salary-calc">
      <button type="button" className="back-link" onClick={() => window.history.back()}>
        ← Quay lại
      </button>
      <header className="page-header salary-calc__header">
        <div className="salary-calc__title-row">
          <CalculatorIcon />
          <div>
            <h1 className="page-header__title salary-calc__title">Tính lương</h1>
            <p className="page-header__lead salary-calc__subtitle">
              Ước lương theo giờ làm (theo ca linh hoạt)
            </p>
          </div>
        </div>
      </header>

      <section className="salary-calc__card form-card">
        <div className="salary-calc__fields">
          <label className="field">
            <span className="field__label">Mức lương (đ/giờ)</span>
            <input
              className="field__input"
              type="number"
              min={0}
              step={1000}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field__label">Số giờ làm / ngày</span>
            <input
              className="field__input"
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span className="field__label">Số ngày làm / tuần</span>
            <input
              className="field__input"
              type="number"
              min={0}
              max={7}
              step={1}
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="salary-calc__results">
          <h2 className="salary-calc__results-title">Ước tính</h2>
          <p className="salary-calc__result-row">
            <span>Mỗi ngày</span>
            <strong>{formatVnd(daily, 'đ/ngày')}</strong>
          </p>
          <p className="salary-calc__result-row">
            <span>Mỗi tuần</span>
            <strong>{formatVnd(weekly, 'đ/tuần')}</strong>
          </p>
          <p className="salary-calc__result-row salary-calc__result-row--highlight">
            <span>Mỗi tháng (ước tính)</span>
            <strong>{formatVnd(monthly, 'đ/tháng')}</strong>
          </p>
          <p className="salary-calc__footnote">
            Tháng = tuần × 52/12 (trung bình). Số thực tế có thể khác theo ca và hợp đồng.
          </p>
        </div>
      </section>

      <p className="salary-calc__footer-link">
        <Link to="/" className="text-link">
          Về trang chủ
        </Link>
      </p>
    </div>
  )
}
