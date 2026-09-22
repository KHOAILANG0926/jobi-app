import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import type { Job } from './types/job'
import './index.css'
import './components/apply.css'

const rootEl = document.getElementById('root')!

// api/ssr.js가 렌더링한 페이지만 이 태그를 내려준다(SSR을 거치지 않은 일반
// 라우트는 없음 → 항상 일반 클라이언트 렌더로 폴백). 서버와 다른 초기
// jobs 데이터로 hydrate하면 JobDetail/UrgentJobsPage가 mismatch를 내므로
// 반드시 서버가 쓴 것과 같은 데이터를 그대로 넘겨야 한다.
const initialStateEl = document.getElementById('__INITIAL_STATE__')
let initialJobs: Job[] | undefined
let initialJobsError: boolean | undefined
if (initialStateEl?.textContent) {
  try {
    const parsed = JSON.parse(initialStateEl.textContent) as { jobs: Job[]; jobsError: boolean }
    initialJobs = parsed.jobs
    initialJobsError = parsed.jobsError
  } catch (e) {
    console.error('Failed to parse __INITIAL_STATE__', e)
  }
}

if (initialJobs !== undefined) {
  hydrateRoot(
    rootEl,
    <StrictMode>
      <App initialJobs={initialJobs} initialJobsError={initialJobsError} />
    </StrictMode>,
    {
      // hydration mismatch는 React가 자동으로 전체 클라이언트 재렌더로
      // 복구하기 때문에 사용자에게는 안 보이지만, 원인 자체는 실제 버그다
      // (2026-09-22 이 콜백으로 App.tsx의 lazy 라우트 vs entry-server.tsx의
      // 즉시 import 불일치를 실측으로 찾아낸 적 있음) — 조용히 묻히지 않게
      // 콘솔에는 남긴다.
      onRecoverableError: (error, errorInfo) => {
        console.error('React hydration recovered from an error:', error, (errorInfo as { componentStack?: string })?.componentStack)
      },
    },
  )
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}