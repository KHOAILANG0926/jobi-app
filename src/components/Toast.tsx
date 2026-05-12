import { useEffect } from 'react'

type Props = {
  message: string
  open: boolean
  onClose: () => void
  durationMs?: number
}

export function Toast({ message, open, onClose, durationMs = 3200 }: Props) {
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(t)
  }, [open, onClose, durationMs])

  if (!open) return null

  return (
    <div className="jobi-toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
