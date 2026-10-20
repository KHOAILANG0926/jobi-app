import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isAutomation, markPromptAsked, promptAlreadyAsked, requestUserLocation } from '../lib/userLocation'

// 첫 방문 위치 허용 창(2026-10-20 Lee 확정 — 문구는 "오토바이로 몇 분" 안 1번). 한 번만 띄우고, 거절해도 앱은 그대로 쓸 수 있다.
export function LocationPrompt() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    if (isAutomation() || promptAlreadyAsked()) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setOpen(true)
  }, [pathname])
  if (!open) return null
  const allow = async () => {
    setBusy(true)
    const p = await requestUserLocation()
    markPromptAsked(p ? 'allow' : 'denied')
    setOpen(false)
  }
  const later = () => { markPromptAsked('later'); setOpen(false) }
  return (
    <div className="loc-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="loc-prompt-title">
      <div className="loc-prompt">
        <h2 id="loc-prompt-title" className="loc-prompt-title">Tìm việc gần bạn</h2>
        <p className="loc-prompt-text">Xem mất bao nhiêu phút đi xe máy đến chỗ làm.</p>
        <div className="loc-prompt-actions">
          <button type="button" className="loc-prompt-later" onClick={later} disabled={busy}>Để sau</button>
          <button type="button" className="loc-prompt-allow" onClick={allow} disabled={busy}>{busy ? 'Đang xác định…' : 'Cho phép'}</button>
        </div>
      </div>
    </div>
  )
}
