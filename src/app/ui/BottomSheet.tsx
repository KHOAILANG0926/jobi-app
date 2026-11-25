import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

// 바텀시트(지역 선택·필터 공통 틀). full = 화면 전체(필터), 아니면 아래서 올라오는 시트(지역·업종).
export default function BottomSheet({ title, onClose, children, footer, full }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; full?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  return (
    <div className="app-sheet-layer" role="dialog" aria-modal="true" aria-label={title}>
      {!full && <button type="button" className="app-sheet-backdrop" aria-label="Đóng" onClick={onClose} />}
      <div className={'app-sheet' + (full ? ' app-sheet--full' : '')}>
        <header className="app-sheet__head">
          <h2 className="app-sheet__title">{title}</h2>
          <button type="button" className="app-icon-btn" aria-label="Đóng" onClick={onClose}><X size={22} aria-hidden /></button>
        </header>
        <div className="app-sheet__body">{children}</div>
        {footer && <footer className="app-sheet__foot">{footer}</footer>}
      </div>
    </div>
  )
}
