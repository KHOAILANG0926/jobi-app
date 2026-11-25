import { useCallback, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { buildProfile, submitApplication } from '../../lib/applySubmit'
import type { Job } from '../../types/job'
import BottomSheet from '../ui/BottomSheet'

// 앱의 사이트 안 지원 — 웹 useApply와 같은 제출 함수(lib/applySubmit)를 쓴다. 지원할 수 있는지는 appApplyButton(resolveApplyAction)이 이미 가렸고,
// 여기서는 로그인 확인 → 지원자 확인 시트 → 제출만 한다. 기업 계정이 보내면 서버(RLS)가 거절하고 시트에 오류가 보인다(웹과 같음).
type Phase = 'confirm' | 'loading' | 'success' | 'duplicate' | 'error'

export function useAppApply(): { start: (job: Job) => void; sheet: ReactNode } {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [job, setJob] = useState<Job | null>(null)
  const [phase, setPhase] = useState<Phase>('confirm')

  const start = useCallback((j: Job) => {
    if (!user) { navigate('/dang-nhap?redirect=' + encodeURIComponent(location.pathname + location.search)); return }
    setPhase('confirm')
    setJob(j)
  }, [user, navigate, location.pathname, location.search])

  const close = useCallback(() => setJob(null), [])
  const confirm = useCallback(async () => {
    if (!job) return
    setPhase('loading')
    const res = await submitApplication(job, user?.id)
    setPhase(res.ok ? 'success' : res.reason === 'duplicate' ? 'duplicate' : 'error')
  }, [job, user?.id])

  const profile = job ? buildProfile(user?.id) : null
  const sheet = job && profile ? (
    <BottomSheet
      title={phase === 'success' ? 'Đã gửi hồ sơ' : 'Ứng tuyển ngay'}
      onClose={phase === 'loading' ? () => {} : close}
      footer={
        phase === 'confirm' ? <div className="app-sheet__foot-row"><button type="button" className="app-btn app-btn--ghost" onClick={close}>Hủy</button><button type="button" className="app-btn app-btn--primary" onClick={confirm}>Xác nhận ứng tuyển</button></div>
        : phase === 'error' ? <div className="app-sheet__foot-row"><button type="button" className="app-btn app-btn--ghost" onClick={close}>Đóng</button><button type="button" className="app-btn app-btn--primary" onClick={() => setPhase('confirm')}>Thử lại</button></div>
        : phase === 'loading' ? undefined
        : <button type="button" className="app-btn app-btn--primary" onClick={close}>Đóng</button>
      }
    >
      <div className="app-apply" data-testid="app-apply" data-phase={phase}>
        <p className="app-apply__job"><strong>{job.title}</strong><span>{job.company}{job.location ? ` · ${job.location}` : ''}</span></p>
        {phase === 'confirm' && (
          <>
            <dl className="app-apply__me">
              <div><dt>Họ tên</dt><dd>{profile.name}</dd></div>
              <div><dt>Điện thoại</dt><dd>{profile.phone}</dd></div>
              <div><dt>Tuổi</dt><dd>{profile.age}</dd></div>
            </dl>
            <p className="app-apply__note">Hồ sơ của bạn sẽ được gửi trực tiếp đến nhà tuyển dụng. Họ sẽ liên hệ qua số điện thoại đã đăng ký.</p>
          </>
        )}
        {phase === 'loading' && <p className="app-state" role="status">Đang gửi hồ sơ…</p>}
        {phase === 'success' && <p className="app-apply__ok" role="status">Ứng tuyển thành công. Nhà tuyển dụng sẽ liên hệ với bạn trong 24–48 giờ tới.</p>}
        {phase === 'duplicate' && <p className="app-apply__ok" role="status">Bạn đã ứng tuyển tin này rồi. Xem trạng thái ở mục "Đã ứng tuyển".</p>}
        {phase === 'error' && <p className="app-apply__err" role="alert">Không thể gửi hồ sơ lúc này. Vui lòng thử lại.</p>}
      </div>
    </BottomSheet>
  ) : null

  return { start, sheet }
}
