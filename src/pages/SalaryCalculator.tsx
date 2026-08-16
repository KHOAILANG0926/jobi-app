import { useMemo, useState } from 'react'

// ── Vietnam PIT brackets (monthly, VND) ─────────────────────────────
const BRACKETS = [
  { limit: 5_000_000,  rate: 0.05 },
  { limit: 10_000_000, rate: 0.10 },
  { limit: 18_000_000, rate: 0.15 },
  { limit: 32_000_000, rate: 0.20 },
  { limit: 52_000_000, rate: 0.25 },
  { limit: 80_000_000, rate: 0.30 },
  { limit: Infinity,   rate: 0.35 },
]
const PERSONAL_DEDUCTION = 11_000_000
const DEPENDENT_DEDUCTION = 4_400_000
const INSURANCE_RATE = 0.105 // 8% + 1.5% + 1%

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

function grossToNet(gross: number, dependents: number): { insurance: number; pit: number; net: number; taxable: number } {
  const insurance = gross * INSURANCE_RATE
  const taxable = gross - insurance - PERSONAL_DEDUCTION - dependents * DEPENDENT_DEDUCTION
  const pit = calcPIT(taxable)
  return { insurance, pit, net: gross - insurance - pit, taxable }
}

function netToGross(net: number, dependents: number): number {
  // Binary search
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

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`sc-row${highlight ? ' sc-row--hl' : ''}`}>
      <span className="sc-row__label">{label}</span>
      <span className="sc-row__value">{value}</span>
    </div>
  )
}

export function SalaryCalculator() {
  const [mode, setMode] = useState<'gross' | 'net'>('gross')
  const [amount, setAmount] = useState('')
  const [dependents, setDependents] = useState(0)

  const amountNum = useMemo(() => {
    const raw = amount.replace(/[^\d]/g, '')
    return Number(raw) || 0
  }, [amount])

  const result = useMemo(() => {
    if (!amountNum) return null
    if (mode === 'gross') return { gross: amountNum, ...grossToNet(amountNum, dependents) }
    const gross = netToGross(amountNum, dependents)
    return { gross, ...grossToNet(gross, dependents) }
  }, [mode, amountNum, dependents])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '')
    setAmount(raw ? Number(raw).toLocaleString('vi-VN') : '')
  }

  return (
    <div className="page page--narrow sc-page">
      <h1 className="sc-title">Tính lương Gross ↔ Net</h1>
      <p className="sc-subtitle">Tính toán theo quy định Bảo hiểm xã hội và Thuế TNCN Việt Nam 2024</p>

      {/* Mode toggle */}
      <div className="sc-toggle">
        <button
          type="button"
          className={`sc-toggle__btn${mode === 'gross' ? ' sc-toggle__btn--active' : ''}`}
          onClick={() => setMode('gross')}
        >
          Gross → Net
        </button>
        <button
          type="button"
          className={`sc-toggle__btn${mode === 'net' ? ' sc-toggle__btn--active' : ''}`}
          onClick={() => setMode('net')}
        >
          Net → Gross
        </button>
      </div>

      {/* Inputs */}
      <div className="sc-form">
        <div className="sc-field">
          <label className="sc-field__label">
            {mode === 'gross' ? 'Lương Gross (trước thuế)' : 'Lương Net (sau thuế)'}
          </label>
          <div className="sc-field__input-wrap">
            <input
              className="sc-field__input"
              type="text"
              inputMode="numeric"
              placeholder="Nhập số tiền (VD: 10.000.000)"
              value={amount}
              onChange={handleAmountChange}
            />
            <span className="sc-field__unit">₫/tháng</span>
          </div>
        </div>

        <div className="sc-field">
          <label className="sc-field__label">Số người phụ thuộc</label>
          <div className="sc-dependents">
            {[0, 1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                className={`sc-dep-btn${dependents === n ? ' sc-dep-btn--active' : ''}`}
                onClick={() => setDependents(n)}
              >
                {n} người
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="sc-result">
          <Row label="Lương Gross" value={fmt(result.gross)} />
          <div className="sc-divider">Các khoản khấu trừ</div>
          <Row label="BHXH (8%)" value={`- ${fmt(result.gross * 0.08)}`} />
          <Row label="BHYT (1.5%)" value={`- ${fmt(result.gross * 0.015)}`} />
          <Row label="BHTN (1%)" value={`- ${fmt(result.gross * 0.01)}`} />
          <Row label="Giảm trừ bản thân" value={`- ${fmt(PERSONAL_DEDUCTION)}`} />
          {dependents > 0 && (
            <Row label={`Giảm trừ ${dependents} người phụ thuộc`} value={`- ${fmt(dependents * DEPENDENT_DEDUCTION)}`} />
          )}
          <Row label="Thu nhập tính thuế" value={result.taxable > 0 ? fmt(result.taxable) : '0 ₫ (miễn thuế)'} />
          <Row label="Thuế TNCN" value={`- ${fmt(result.pit)}`} />
          <div className="sc-divider sc-divider--result" />
          <Row label="💰 Lương Net thực nhận" value={fmt(result.net)} highlight />
        </div>
      )}

      {/* Info box */}
      <div className="sc-info">
        <h3 className="sc-info__title">Căn cứ tính toán</h3>
        <ul className="sc-info__list">
          <li>Bảo hiểm xã hội (NLĐ đóng): 8%</li>
          <li>Bảo hiểm y tế (NLĐ đóng): 1.5%</li>
          <li>Bảo hiểm thất nghiệp (NLĐ đóng): 1%</li>
          <li>Giảm trừ bản thân: 11.000.000 ₫/tháng</li>
          <li>Giảm trừ người phụ thuộc: 4.400.000 ₫/người/tháng</li>
          <li>Thuế TNCN: lũy tiến 5% – 35% theo 7 bậc</li>
        </ul>
        <p className="sc-info__note">⚠️ Kết quả mang tính tham khảo. Mức lương thực tế có thể khác tùy doanh nghiệp.</p>
      </div>
    </div>
  )
}

export default SalaryCalculator
