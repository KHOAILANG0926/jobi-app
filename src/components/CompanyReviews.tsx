import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadProfile } from '../lib/storage'
import {
  addCompanyReview,
  getCompanyRatingSummary,
  getRecentReviewsForCompany,
  hasUserReviewedCompany,
  type CompanyReview,
} from '../lib/reviewsStorage'

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="company-reviews__stars" aria-label={`${rating} / 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'company-reviews__star--on' : 'company-reviews__star--off'}>
          ★
        </span>
      ))}
    </span>
  )
}

type Props = { company: string }

export function CompanyReviews({ company }: Props) {
  const { user } = useAuth()
  const reviewerKey = useMemo(() => {
    if (user?.email) return `user:${user?.email}`
    const em = loadProfile().email?.trim()
    if (em) return `email:${em}`
    let gid = sessionStorage.getItem('vgb_guest_id')
    if (!gid) {
      gid = `guest:${crypto.randomUUID()}`
      sessionStorage.setItem('vgb_guest_id', gid)
    }
    return gid
  }, [user?.email])

  const [reviews, setReviews] = useState<CompanyReview[]>(() => getRecentReviewsForCompany(company, 3))
  const [summary, setSummary] = useState(() => getCompanyRatingSummary(company))

  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [formMsg, setFormMsg] = useState<string | null>(null)

  const alreadyReviewed = useMemo(
    () => hasUserReviewedCompany(company, reviewerKey),
    [company, reviewerKey],
  )

  const sync = () => {
    setReviews(getRecentReviewsForCompany(company, 3))
    setSummary(getCompanyRatingSummary(company))
  }

  useEffect(() => {
    sync()
    const onEvt = () => sync()
    window.addEventListener('vgb:company-reviews', onEvt)
    return () => window.removeEventListener('vgb:company-reviews', onEvt)
  }, [company])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormMsg(null)
    const res = addCompanyReview({
      companyDisplay: company,
      rating,
      text,
      reviewerKey,
    })
    if (res.ok) {
      setText('')
      setFormMsg('Cảm ơn bạn đã đánh giá!')
      sync()
    } else if (res.reason === 'duplicate') {
      setFormMsg('Bạn đã gửi đánh giá cho công ty này.')
    } else {
      setFormMsg('Vui lòng chọn số sao và nhập nội dung.')
    }
  }

  const avgDisplay = summary.count > 0 ? summary.average.toFixed(1) : '—'

  return (
    <section className="company-reviews" aria-labelledby="company-reviews-heading">
      <h2 id="company-reviews-heading" className="company-reviews__heading">
        Đánh giá công ty
      </h2>

      <div className="company-reviews__summary">
        <div className="company-reviews__avg">
          <span className="company-reviews__avg-num">{avgDisplay}</span>
          <StarRow rating={summary.count > 0 ? Math.round(summary.average) : 0} />
        </div>
        <p className="company-reviews__count">
          {summary.count === 0 ? 'Chưa có đánh giá' : `${summary.count} đánh giá`}
        </p>
      </div>

      {reviews.length > 0 ? (
        <ul className="company-reviews__list">
          {reviews.map((r) => (
            <li key={r.id} className="company-reviews__item">
              <div className="company-reviews__item-head">
                <StarRow rating={r.rating} />
                <time dateTime={r.createdAt} className="company-reviews__date">
                  {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                </time>
              </div>
              <p className="company-reviews__text">{r.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="company-reviews__empty">Hãy là người đầu tiên chia sẻ trải nghiệm.</p>
      )}

      <div className="company-reviews__form-wrap">
        <h3 className="company-reviews__form-title">Viết đánh giá</h3>
        {alreadyReviewed ? (
          <p className="company-reviews__note">Bạn đã gửi một đánh giá cho nhà tuyển dụng này.</p>
        ) : (
          <form className="company-reviews__form" onSubmit={onSubmit}>
            <div className="company-reviews__rating-input" role="radiogroup" aria-label="Số sao (1–5)">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  className={`company-reviews__star-btn${n <= rating ? ' company-reviews__star-btn--on' : ''}`}
                  onClick={() => setRating(n)}
                  aria-label={`${n} sao`}
                >
                  ★
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field__label">Nội dung ngắn</span>
              <textarea
                className="field__input field__textarea"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Chia sẻ trải nghiệm làm việc hoặc phỏng vấn..."
                maxLength={600}
              />
            </label>
            <button type="submit" className="btn btn--primary">
              Gửi đánh giá
            </button>
            {formMsg ? (
              <p className={`company-reviews__form-msg${formMsg.includes('Cảm ơn') ? ' company-reviews__form-msg--ok' : ''}`}>
                {formMsg}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  )
}
