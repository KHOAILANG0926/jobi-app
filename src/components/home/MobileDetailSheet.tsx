// 모바일 전용 생활지도 상세 bottom sheet (2026-10-06).
// 모바일에서 지도가 화면 대부분을 차지해, 장소·건물·공고를 고른 뒤 상세를 보려면 지도 밖으로
// 손가락을 옮겨 페이지를 스크롤해야 했다. 상세를 화면 하단 sheet로 띄워 지도와 동시에 본다.
// - 처음엔 접힌 상태(화면 약 38%), 손잡이 위로 끌기/탭 = 펼침(약 85%), 아래로 끌기 = 접기 → 닫기
// - 내용이 길면 sheet 안에서만 스크롤(페이지로 번지지 않음, overscroll-behavior: contain)
// - 페이지 자동 스크롤·지도 viewport 변경 없음. 데스크톱은 기존 오른쪽 패널 그대로(HomeMapExplorer).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { sheetDragResult } from './mobileSheetGesture'

interface Props {
  /** 선택이 바뀌면 다시 접힌 상태로 시작한다. */
  selectionKey: string
  label: string
  onClose: () => void
  children: ReactNode
}

export default function MobileDetailSheet({ selectionKey, label, onClose, children }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [dragY, setDragY] = useState(0)
  const drag = useRef<{ id: number; startY: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setExpanded(false)
    bodyRef.current?.scrollTo({ top: 0 })
  }, [selectionKey])

  const finish = (dy: number) => {
    drag.current = null
    setDragY(0)
    const result = sheetDragResult(dy, expanded)
    if (result === 'toggle') setExpanded((v) => !v)
    else if (result === 'expand') setExpanded(true)
    else if (result === 'collapse') setExpanded(false)
    else if (result === 'close') onClose()
  }

  return createPortal(
    <section className={`hme-sheet${expanded ? ' is-expanded' : ''}`} role="dialog" aria-label={label}
      style={dragY ? { transform: `translateY(${Math.max(dragY, -40)}px)`, transition: 'none' } : undefined}>
      <div className="hme-sheet__bar">
        <button type="button" className="hme-sheet__handle" aria-label={expanded ? 'Thu gọn' : 'Mở rộng'} aria-expanded={expanded}
          onPointerDown={(e) => { drag.current = { id: e.pointerId, startY: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => { if (drag.current?.id === e.pointerId) setDragY(e.clientY - drag.current.startY) }}
          onPointerUp={(e) => { if (drag.current?.id === e.pointerId) finish(e.clientY - drag.current.startY) }}
          onPointerCancel={() => { drag.current = null; setDragY(0) }}>
          <span aria-hidden />
        </button>
        <button type="button" className="hme-sheet__close" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="hme-sheet__body" ref={bodyRef}>{children}</div>
    </section>,
    document.body,
  )
}
