import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ScrollToTop } from './components/ScrollToTop'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireEmployer } from './components/RequireEmployer'
import { AuthProvider } from './context/AuthContext'
import { JobsProvider } from './context/JobsContext'
import { NotificationProvider } from './context/NotificationContext'

const Community = lazy(() => import('./pages/Community').then((module) => ({ default: module.Community })))
const CommunityPostDetail = lazy(() => import('./pages/CommunityPostDetail').then((module) => ({ default: module.CommunityPostDetail })))
const EmployerDashboard = lazy(() => import('./pages/EmployerDashboard').then((module) => ({ default: module.EmployerDashboard })))
const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })))
const JobDetail = lazy(() => import('./pages/JobDetail').then((module) => ({ default: module.JobDetail })))
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))
const PostJob = lazy(() => import('./pages/PostJob').then((module) => ({ default: module.PostJob })))
const Profile = lazy(() => import('./pages/Profile').then((module) => ({ default: module.Profile })))
const SalaryCalculator = lazy(() => import('./pages/SalaryCalculator').then((module) => ({ default: module.SalaryCalculator })))
const Signup = lazy(() => import('./pages/Signup').then((module) => ({ default: module.Signup })))
const KoreaHome = lazy(() => import('./pages/KoreaHome'))
const KoreaJobs = lazy(() => import('./pages/KoreaJobs'))
const KoreaJobDetail = lazy(() => import('./pages/KoreaJobDetail'))
const MapView = lazy(() => import('./components/MapView'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const FranchiseJobs = lazy(() => import('./pages/FranchiseJobs'))
const ZaloCallback = lazy(() => import('./pages/ZaloCallback').then((module) => ({ default: module.ZaloCallback })))
const InterviewTips = lazy(() => import('./pages/InterviewTips').then((module) => ({ default: module.InterviewTips })))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse').then((module) => ({ default: module.TermsOfUse })))

function RouteLoading() {
  return <div className="page page--narrow" role="status">Đang tải...</div>
}

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <JobsProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={lazyRoute(<Home />)} />
                <Route path="/viec-lam/:id" element={lazyRoute(<JobDetail />)} />
                <Route path="/dang-tin" element={<RequireEmployer>{lazyRoute(<PostJob />)}</RequireEmployer>} />
                <Route path="/ho-so" element={lazyRoute(<Profile />)} />
                <Route path="/tinh-luong" element={lazyRoute(<SalaryCalculator />)} />
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
        </JobsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}


