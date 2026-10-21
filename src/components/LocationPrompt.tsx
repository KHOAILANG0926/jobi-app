import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isAutomation, markPromptAsked, promptAlreadyAsked, requestUserLocation } from '../lib/userLocation'

// 첫 방문 위치 허용 창(2026-10-20 Lee 확정 문구). 한 번만 띄우고, 거절해도 앱은 그대로 쓸 수 있다.
export function LocationPrompt() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { pathname } = useLocation()
  // 2026-10-21 Lee: 이 기기에서 이미 허용했으면 접속할 때마다 묻지 않고 바로 위치를 쓴다(자동 승인).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || isAutomation()) return
    let alive = true
    void (async () => {
      let state: PermissionState | null = null
      try { state = (await navigator.permissions?.query({ name: 'geolocation' as PermissionName }))?.state ?? null } catch { state = null }
      if (!alive) return
      if (state === 'granted') { void requestUserLocation(); return }
      if (pathname.startsWith('/admin') || promptAlreadyAsked() || state === 'denied') return
      setOpen(true)
    })()
    return () => { alive = false }
    // 첫 화면에서 한 번만 판단한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
        <p className="loc-prompt-text">Cho phép vị trí để xem việc làm gần bạn và chỉ đường nhanh.</p>
        <div className="loc-prompt-actions">
          <button type="button" className="loc-prompt-later" onClick={later} disabled={busy}>Để sau</button>
          <button type="button" className="loc-prompt-allow" onClick={allow} disabled={busy}>{busy ? 'Đang xác định…' : 'Cho phép'}</button>
        </div>
        <p className="loc-prompt-note">Một lần cho phép, lần sau vào trang sẽ tự dùng vị trí — không hỏi lại.</p>
      </div>
    </div>
  )
}
