import { APPLICATION_STATUS_META, type ApplicationStatus, type JobApplication } from '../lib/applicationsStorage'

const FLOW: ApplicationStatus[] = ['submitted', 'reviewing', 'interview', 'accepted']

const STATUS_ICONS: Record<ApplicationStatus, string> = {
  submitted: '📩',
  reviewing: '🔍',
  interview: '🗓',
  accepted: '✅',
  rejected: '❌',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  application: JobApplication
}

export function StatusTimeline({ application }: Props) {
  const history = application.statusHistory ?? [
    { status: application.status, changedAt: application.appliedAt },
  ]

  const historyMap: Partial<Record<ApplicationStatus, string>> = {}
  for (const entry of history) {
    if (!historyMap[entry.status]) historyMap[entry.status] = entry.changedAt
  }

  const isRejected = application.status === 'rejected'
  const steps: ApplicationStatus[] = isRejected
    ? [...FLOW.slice(0, FLOW.indexOf('accepted')), 'rejected']
    : FLOW

  return (
    <div className="status-timeline" aria-label="Lịch sử trạng thái đơn ứng tuyển">
      {steps.map((step, i) => {
        const changedAt = historyMap[step]
        const isDone = Boolean(changedAt)
        const isCurrent = application.status === step
        const isLast = i === steps.length - 1

        return (
          <div key={step} className="status-timeline__row">
            <div className="status-timeline__col-left">
              <div
                className={`status-timeline__dot${isDone ? ' status-timeline__dot--done' : ''}${isCurrent ? ' status-timeline__dot--current' : ''}${isRejected && step === 'rejected' ? ' status-timeline__dot--rejected' : ''}`}
                aria-hidden="true"
              >
                {isDone ? STATUS_ICONS[step] : ''}
              </div>
              {!isLast && (
                <div className={`status-timeline__line${isDone ? ' status-timeline__line--done' : ''}`} />
              )}
            </div>
            <div className={`status-timeline__content${isCurrent ? ' status-timeline__content--current' : ''}${!isDone ? ' status-timeline__content--future' : ''}`}>
              <span className="status-timeline__label">
                {APPLICATION_STATUS_META[step].labelVi}
              </span>
              {changedAt ? (
                <time className="status-timeline__time" dateTime={changedAt}>
                  {formatTime(changedAt)}
                </time>
              ) : (
                <span className="status-timeline__time status-timeline__time--pending">
                  Chưa cập nhật
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
