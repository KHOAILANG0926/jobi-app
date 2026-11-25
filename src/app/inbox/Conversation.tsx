import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { StoredMessage } from '../../lib/messagesStorage'

const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// 대화 화면(구직자·기업 공용) — 말풍선 목록 + 입력. 보내기·읽음 처리는 부르는 쪽이 lib/messagesStorage 함수로 한다.
export default function Conversation({ title, subtitle, jobHref, messages, mine, otherName, onBack, onSend }: {
  title: string; subtitle?: string; jobHref?: string; messages: StoredMessage[]; mine: 'seeker' | 'employer'; otherName: string
  onBack: () => void; onSend: (body: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length])
  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true); setError(false); setDraft('')
    const ok = await onSend(body)
    setSending(false)
    if (!ok) { setDraft(body); setError(true) }
  }
  return (
    <div className="app-page app-conv" data-testid="app-conv">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={onBack}><ChevronLeft size={24} aria-hidden /></button>
        <div className="app-conv__head"><h1 className="app-pagebar__title">{title}</h1>{subtitle && <span>{subtitle}</span>}</div>
        {jobHref && <Link className="app-link-btn" to={jobHref}>Xem tin</Link>}</header>
      <div className="app-conv__stream" role="log" aria-live="polite">
        {messages.length === 0 && <p className="app-state">Chưa có tin nhắn.</p>}
        {messages.map((m) => (
          <div key={m.id} className={'app-conv__bubble' + (m.from === mine ? ' app-conv__bubble--me' : '')}>
            <small>{m.from === mine ? 'Bạn' : otherName}</small><p>{m.body}</p><time dateTime={m.sentAt}>{fmt(m.sentAt)}</time>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {error && <p className="app-form__error app-conv__err" role="alert">Không gửi được tin nhắn. Vui lòng thử lại.</p>}
      <form className="app-conv__composer" onSubmit={(e) => { e.preventDefault(); void send() }}>
        <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nhập tin nhắn..." aria-label="Tin nhắn" />
        <button type="submit" className="app-btn app-btn--primary" disabled={!draft.trim() || sending} aria-label="Gửi"><Send size={18} aria-hidden /></button>
      </form>
    </div>
  )
}
