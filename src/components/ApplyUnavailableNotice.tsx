import { MessageCircle, Phone } from 'lucide-react'
import { zaloMeUrl } from '../lib/jobUtils'
import type { Job } from '../types/job'

/**
 * 2026-09-29 긴급 원복: 기업 계정이 없는 크롤링 공고는 사이트 안에서 지원을 받을 수
 * 없다(applications RLS). 원문 사이트로 보내지 않고, 그 사실과 공고에 등록된 연락
 * 방법(전화·Zalo)만 보여준다. 연락처가 없으면 없다고 밝힌다.
 */
export function ApplyUnavailableNotice({ job, onShowDescription }: {
  job: Pick<Job, 'employerPhone' | 'zalo'>
  onShowDescription?: () => void
}) {
  const phone = job.employerPhone?.trim()
  const zalo = job.zalo?.trim() || phone
  return (
    <div className="apply-unavailable" role="status">
      <p className="apply-unavailable__title">Tin này chưa nhận hồ sơ trực tuyến trên Việc Gần Bạn</p>
      {phone || zalo ? (
        <>
          <p className="apply-unavailable__text">Vui lòng liên hệ trực tiếp nhà tuyển dụng:</p>
          <div className="apply-unavailable__contacts">
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="apply-unavailable__contact">
                <Phone size={15} strokeWidth={1.8} /> {phone}
              </a>
            )}
            {zalo && (
              <a href={zaloMeUrl(zalo)} target="_blank" rel="noopener noreferrer" className="apply-unavailable__contact">
                <MessageCircle size={15} strokeWidth={2} /> Zalo
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="apply-unavailable__text">
          Tin này chưa có số điện thoại hay Zalo của nhà tuyển dụng. Nếu phần mô tả công việc có ghi cách liên hệ,
          vui lòng dùng thông tin đó.
          {onShowDescription && (
            <>
              {' '}
              <button type="button" className="apply-unavailable__link" onClick={onShowDescription}>
                Xem mô tả công việc
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}
