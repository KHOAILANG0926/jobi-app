import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ScrollToTop } from './components/ScrollToTop'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireEmployer } from './components/RequireEmployer'
import { AuthProvider } from './context/AuthContext'
import { JobsProvider } from './context/JobsContext'
import { BrandsProvider } from './context/BrandsContext'
import { NotificationProvider } from './context/NotificationContext'
import type { Job } from './types/job'
// 2026-09-22 실제 브라우저로 hydration 검증하다가 발견한 진짜 원인 —
// entry-server.tsx는 SSR 전용이라 JobDetail/UrgentJobsPage를 처음부터
// lazy() 없이 직접 import해서 완전히 완결된 HTML을 내려주는데, 클라이언트가
// (다른 모든 라우트처럼) 이 둘도 여전히 lazy+Suspense로 열면, hydrate 시점에
// 그 라우트 청크가 아직 로드되기 전이라 클라이언트 쪽 Suspense가 "로딩 중"
// 상태로 시작한다 — 서버는 실제 콘텐츠를 이미 다 그려놨는데 클라이언트는
// 같은 자리에서 완전히 다른 구조(로딩 fallback)를 기대하는 셈이라 React가
// hydration 자체를 포기하고 페이지 전체를 클라이언트에서 통째로 다시
// 그렸다(React error #418/#423, 실제 DOM diff + onRecoverableError 스택으로
// 원인 추적). SSR이 실제로 서비스하는 이 두 라우트만 lazy를 빼고 즉시
// import해서 서버와 클라이언트의 최초 렌더 구조를 완전히 맞춘다 — 대신
// 이 두 페이지 코드가 메인 번들에 합쳐져 초기 다운로드가 조금 커지지만,
// SSR로 서비스하는 라우트를 code-split하지 않는 건 표준적인 트레이드오프다.
import { JobDetail } from './pages/JobDetail'
import UrgentJobsPage from './pages/jobsMenu/UrgentJobsPage'
import { JobSearchPage } from './pages/JobSearchPage'

const Community = lazy(() => import('./pages/Community').then((module) => ({ default: module.Community })))
const CommunityPostDetail = lazy(() => import('./pages/CommunityPostDetail').then((module) => ({ default: module.CommunityPostDetail })))
const EmployerDashboard = lazy(() => import('./pages/EmployerDashboard').then((module) => ({ default: module.EmployerDashboard })))
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })))
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))
const PostJob = lazy(() => import('./pages/PostJob').then((module) => ({ default: module.PostJob })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))
const SalaryCalculator = lazy(() => import('./pages/SalaryCalculator').then((module) => ({ default: module.SalaryCalculator })))
const Signup = lazy(() => import('./pages/Signup').then((module) => ({ default: module.Signup })))
const ManageGuestJob = lazy(() => import('./pages/ManageGuestJob'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const KoreaHome = lazy(() => import('./pages/KoreaHome'))
const KoreaJobs = lazy(() => import('./pages/KoreaJobs'))
const KoreaJobDetail = lazy(() => import('./pages/KoreaJobDetail'))
const MapView = lazy(() => import('./components/MapView'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const FranchiseJobs = lazy(() => import('./pages/FranchiseJobs'))
const ToolsHub = lazy(() => import('./pages/ToolsHub'))
const ZaloCallback = lazy(() => import('./pages/ZaloCallback').then((module) => ({ default: module.ZaloCallback })))
const InterviewTips = lazy(() => import('./pages/InterviewTips').then((module) => ({ default: module.InterviewTips })))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse').then((module) => ({ default: module.TermsOfUse })))
const SavedJobsPage = lazy(() => import('./pages/jobsMenu/SavedJobsPage'))
const RecentlyViewedPage = lazy(() => import('./pages/jobsMenu/RecentlyViewedPage'))
const MatchedJobsPage = lazy(() => import('./pages/jobsMenu/MatchedJobsPage'))
const SuggestedJobsPage = lazy(() => import('./pages/jobsMenu/SuggestedJobsPage'))

function RouteLoading() {
  return <div className="page page--narrow" role="status">Đang tải...</div>
}

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

interface AppProps {
  /** SSR이 렌더링 시점에 이미 채워둔 초기 데이터 — hydration 시 서버와
   *  동일한 데이터로 시작해야 JobDetail/UrgentJobsPage의 hydration mismatch가
   *  안 생긴다(entry-server.tsx가 렌더한 것과 같은 데이터). SSR을 거치지
   *  않은 일반 클라이언트 진입(main.tsx의 기본 경로)은 항상 undefined. */
  initialJobs?: Job[]
  initialJobsError?: boolean
}

export default function App({ initialJobs, initialJobsError }: AppProps = {}) {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <JobsProvider initialJobs={initialJobs} initialJobsError={initialJobsError}>
          <BrandsProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={lazyRoute(<Home />)} />
                <Route path="/viec-lam/da-luu" element={lazyRoute(<SavedJobsPage />)} />
                <Route path="/viec-lam/da-xem" element={lazyRoute(<RecentlyViewedPage />)} />
                <Route path="/viec-lam/phu-hop" element={lazyRoute(<MatchedJobsPage />)} />
                <Route path="/viec-lam/goi-y" element={lazyRoute(<SuggestedJobsPage />)} />
                <Route path="/viec-lam/tim-kiem" element={<JobSearchPage />} />
                <Route path="/viec-lam/tuyen-gap" element={<UrgentJobsPage />} />
                <Route path="/viec-lam/:id" element={<JobDetail />} />
                <Route path="/dang-tin" element={lazyRoute(<PostJob />)} />
                <Route path="/quan-ly-tin/:id" element={lazyRoute(<ManageGuestJob />)} />
                <Route path="/ho-so" element={lazyRoute(<Profile />)} />
                <Route path="/tinh-luong" element={lazyRoute(<SalaryCalculator />)} />
                <Route path="/cong-cu" element={lazyRoute(<ToolsHub />)} />
                <Route
                  path="/bang-dieu-khien"
                  element={
                    <RequireEmployer>
                      {lazyRoute(<EmployerDashboard />)}
                    </RequireEmployer>
                  }
                />
                <Route path="/cong-dong" element={lazyRoute(<Community />)} />
                <Route path="/cong-dong/:id" element={lazyRoute(<CommunityPostDetail />)} />
                <Route path="/dang-nhap" element={lazyRoute(<Login />)} />
                <Route path="/dang-ky" element={lazyRoute(<Signup />)} />
                <Route path="/quen-mat-khau" element={lazyRoute(<ForgotPassword />)} />
                <Route path="/dat-lai-mat-khau" element={lazyRoute(<ResetPassword />)} />
                <Route path="/ban-do" element={lazyRoute(<MapView />)} />
                <Route path="/viec-han-quoc" element={lazyRoute(<KoreaHome />)} />
                <Route path="/viec-han-quoc/tim-viec" element={lazyRoute(<KoreaJobs />)} />
                <Route path="/viec-han-quoc/:id" element={lazyRoute(<KoreaJobDetail />)} />
                <Route path="/franchise-jobs" element={lazyRoute(<FranchiseJobs />)} />
                <Route path="/zalo-callback" element={lazyRoute(<ZaloCallback />)} />
                <Route path="/cau-hoi-phong-van" element={lazyRoute(<InterviewTips />)} />
                <Route path="/chinh-sach-bao-mat" element={lazyRoute(<PrivacyPolicy />)} />
                <Route path="/dieu-khoan" element={lazyRoute(<TermsOfUse />)} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
              <Route
                path="/admin"
                element={<RequireAdmin>{lazyRoute(<AdminDashboard />)}</RequireAdmin>}
              />
            </Routes>
          </NotificationProvider>
          </BrandsProvider>
        </JobsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}


