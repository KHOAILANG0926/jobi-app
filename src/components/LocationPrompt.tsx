import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isAutomation, markPromptAsked, promptAlreadyAsked, requestUserLocation } from '../lib/userLocation'

// 첫 방문 위치 허용 창(2026-10-20 Lee 확정 문구). 한 번만 띄우고, 거절해도 앱은 그대로 쓸 수 있다.
// 2026-10-20 Lee: 브라우저(Chrome) 권한 팝업은 모양을 바꿀 수 없으므로, 그 팝업이 떠 있는 동안 화면을 어둡게 하고
// 팝업 쪽을 가리키는 안내 한 줄을 보여 준다(PC: 왼쪽 위 주소창 아래, 휴대폰: 팝업 위치가 기기마다 달라 위쪽 안내만).
type Step = 'closed' | 'ask' | 'guide'

function isMobileScreen() {
  try { return window.matchMedia('(max-width: 768px)').matches } catch { return false }
}
async function alreadyGranted(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    return p?.state === 'granted'
  } catch { return false }
}

export function LocationPrompt() {
  const [step, setStep] = useState<Step>('closed')
  const [mobile, setMobile] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    if (isAutomation() || promptAlreadyAsked()) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    setStep('ask')
  }, [pathname])
  if (step === 'closed') return null

  const allow = async () => {
    setMobile(isMobileScreen())
    // 이미 허용한 브라우저는 팝업이 뜨지 않으므로 안내를 건너뛴다.
    if (!(await alreadyGranted())) setStep('guide')
    const p = await requestUserLocation()
    markPromptAsked(p ? 'allow' : 'denied')
    setStep('closed')
  }
  const later = () => { markPromptAsked('later'); setStep('closed') }

  if (step === 'guide') {
    return (
      <div className={`loc-guide-backdrop${mobile ? ' loc-guide-backdrop--mobile' : ''}`} role="status" aria-live="polite">
        <div className="loc-guide">
          {!mobile && <span className="loc-guide-arrow" aria-hidden="true">↑</span>}
          <p className="loc-guide-text">Bấm <strong>Cho phép / Allow</strong> để tiếp tục</p>
          <p className="loc-guide-sub">Việc làm gần bạn sẽ hiện ngay trên bản đồ.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="loc-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="loc-prompt-title">
      <div className="loc-prompt">
        <h2 id="loc-prompt-title" className="loc-prompt-title">Tìm việc gần bạn</h2>
        <p className="loc-prompt-text">Cho phép vị trí để xem việc làm gần bạn và chỉ đường nhanh.</p>
        <div className="loc-prompt-actions">
          <button type="button" className="loc-prompt-later" onClick={later}>Để sau</button>
          <button type="button" className="loc-prompt-allow" onClick={allow}>Cho phép</button>
        </div>
      </div>
    </div>
  )
}
