import { useMemo, useState } from 'react'

const BRACKETS = [
  { limit: 5_000_000,  rate: 0.05 },
  { limit: 10_000_000, rate: 0.10 },
  { limit: 18_000_000, rate: 0.15 },
  { limit: 32_000_000, rate: 0.20 },
  { limit: 52_000_000, rate: 0.25 },
  { limit: 80_000_000, rate: 0.30 },
  { limit: Infinity,   rate: 0.35 },
]
const PERSONAL_DEDUCTION = 15_500_000
const DEPENDENT_DEDUCTION = 6_200_000
const INSURANCE_RATE = 0.105

function calcPIT(taxable: number): number {
  if (taxable <= 0) return 0
  let tax = 0; let prev = 0
  for (const { limit, rate } of BRACKETS) {
    const band = Math.min(taxable - prev, limit - prev)
    if (band <= 0) break
    tax += band * rate
    prev = limit
    if (taxable <= limit) break
  }
  return Math.max(0, tax)
}

function grossToNet(gross: number, dependents: number) {
  const insurance = gross * INSURANCE_RATE
  const taxable = gross - insurance - PERSONAL_DEDUCTION - dependents * DEPENDENT_DEDUCTION
  const pit = calcPIT(taxable)
  return { insurance, pit, net: gross - insurance - pit, taxable }
}

function netToGross(net: number, dependents: number): number {
  let lo = net, hi = net * 2 + 50_000_000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    grossToNet(mid, dependents).net > net ? (hi = mid) : (lo = mid)
  }
  return Math.round((lo + hi) / 2)
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('vi-VN') + ' ₫'
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + ' Tr'
  return Math.round(n).toLocaleString('vi-VN')
}

const QUICK_AMOUNTS = [5_000_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000]

export function SalaryCalculator() {
  const [mode, setMode] = useState<'gross' | 'net'>('gross')
  const [amount, setAmount] = useState('10.000.000')
  const [dependents, setDependents] = useState(0)

  const amountNum = useMemo(() => Number(amount.replace(/[^\d]/g, '')) || 0, [amount])

  const result = useMemo(() => {
    if (mode === 'gross') return { gross: amountNum, ...grossToNet(amountNum, dependents) }
    const gross = netToGross(amountNum, dependents)
    return { gross, ...grossToNet(gross, dependents) }
  }, [mode, amountNum, dependents])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    setAmount(raw ? Number(raw).toLocaleString('vi-VN') : '')
  }

  const addAmount = (delta: number) => {
    const next = amountNum + delta
    setAmount(next > 0 ? next.toLocaleString('vi-VN') : '')
  }

  const deductions = [
    { label: 'BHXH (8%)', value: result.gross * 0.08, color: '#6366f1' },
    { label: 'BHYT (1.5%)', value: result.gross * 0.015, color: '#8b5cf6' },
    { label: 'BHTN (1%)', value: result.gross * 0.01, color: '#a78bfa' },
    { label: 'Thuế TNCN', value: result.pit, color: '#f59e0b' },
  ]

  const totalDeduction = deductions.reduce((s, d) => s + d.value, 0)

  return (
    <div className="page sc2-page">

      {/* Page header */}
      <div className="sc2-header">
        <span className="sc2-header__eyebrow">Công cụ tính lương</span>
        <h1 className="sc2-header__title">Tính lương Gross ↔ Net</h1>
        <p className="sc2-header__desc">Tính lương thực nhận theo quy định BHXH và Thuế TNCN Việt Nam 2026</p>
      </div>

      {/* 2-column layout */}
      <div className="sc2-layout">

        {/* LEFT — input panel */}
        <div className="sc2-input-panel">

          {/* Mode toggle */}
          <div className="sc2-toggle">
            <button
              type="button"
              className={`sc2-toggle__btn${mode === 'gross' ? ' sc2-toggle__btn--active' : ''}`}
              onClick={() => setMode('gross')}
            >
              Gross → Net
            </button>
            <button
              type="button"
              className={`sc2-toggle__btn${mode === 'net' ? ' sc2-toggle__btn--active' : ''}`}
              onClick={() => setMode('net')}
            >
              Net → Gross
            </button>
          </div>

          {/* Salary input */}
          <div className="sc2-field">
            <label className="sc2-field__label">
              {mode === 'gross' ? 'Lương Gross (trước thuế)' : 'Lương Net (sau thuế)'}
            </label>
            <div className="sc2-field__input-wrap">
              <input
                className="sc2-field__input"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={handleAmountChange}
              />
              <span className="sc2-field__unit">₫</span>
            </div>

            {/* Quick-amount chips */}
            <div className="sc2-quick">
              {QUICK_AMOUNTS.map(q => (
                <button key={q} type="button" className="sc2-quick__btn" onClick={() => addAmount(q)}>
                  +{fmtShort(q)}
                </button>
              ))}
              <button type="button" className="sc2-quick__btn sc2-quick__btn--reset" onClick={() => setAmount('')}>
                Xóa
              </button>
            </div>
          </div>

          {/* Dependents */}
          <div className="sc2-field">
            <label className="sc2-field__label">Số người phụ thuộc</label>
            <div className="sc2-deps">
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`sc2-dep-btn${dependents === n ? ' sc2-dep-btn--active' : ''}`}
                  onClick={() => setDependents(n)}
                >
                  {n === 0 ? 'Không có' : `${n} người`}
                </button>
              ))}
            </div>
            {dependents > 0 && (
              <p className="sc2-field__hint">Giảm trừ: {fmt(dependents * DEPENDENT_DEDUCTION)}/tháng</p>
            )}
          </div>

          {/* Info — compact */}
          <details className="sc2-info">
            <summary className="sc2-info__summary">Căn cứ tính toán</summary>
            <ul className="sc2-info__list">
              <li>BHXH (NLĐ): 8% · BHYT: 1.5% · BHTN: 1%</li>
              <li>Giảm trừ bản thân: {fmt(PERSONAL_DEDUCTION)}/tháng</li>
              <li>Giảm trừ người phụ thuộc: {fmt(DEPENDENT_DEDUCTION)}/người/tháng</li>
              <li>Thuế TNCN: lũy tiến 5%–35% (7 bậc)</li>
            </ul>
            <p className="sc2-info__note">⚠️ Kết quả mang tính tham khảo.</p>
          </details>
        </div>

        {/* RIGHT — result panel */}
        <div className="sc2-result-panel">

          {/* Net highlight */}
          <div className="sc2-net-card">
            <span className="sc2-net-card__label">Lương thực nhận (Net)</span>
            <span className="sc2-net-card__value">{fmt(result.net)}</span>
            {mode === 'net' && (
              <span className="sc2-net-card__gross">từ Gross {fmt(result.gross)}</span>
            )}
          </div>

          {/* Deduction bars */}
          <div className="sc2-deductions">
            <p className="sc2-deductions__title">Các khoản khấu trừ</p>
            {deductions.map(d => (
              <div key={d.label} className="sc2-deduction-row">
                <div className="sc2-deduction-row__top">
                  <span className="sc2-deduction-row__label">{d.label}</span>
                  <span className="sc2-deduction-row__value">- {fmt(d.value)}</span>
                </div>
                <div className="sc2-deduction-row__bar-bg">
                  <div
                    className="sc2-deduction-row__bar-fill"
                    style={{
                      width: result.gross > 0 ? `${Math.min((d.value / result.gross) * 100, 100)}%` : '0%',
                      background: d.color,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="sc2-total-row">
              <span>Tổng khấu trừ</span>
              <span>- {fmt(totalDeduction)}</span>
            </div>
          </div>

          {/* Summary table */}
          <div className="sc2-summary">
            <div className="sc2-summary__row">
              <span>Lương Gross</span><span>{fmt(result.gross)}</span>
            </div>
            <div className="sc2-summary__row">
              <span>Bảo hiểm</span><span>- {fmt(result.insurance)}</span>
            </div>
            <div className="sc2-summary__row">
              <span>Thuế TNCN</span><span>- {fmt(result.pit)}</span>
            </div>
            {result.taxable <= 0 && (
              <div className="sc2-summary__badge">Miễn thuế TNCN</div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default SalaryCalculator
