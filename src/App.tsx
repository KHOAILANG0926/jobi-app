import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireEmployer } from './components/RequireEmployer'
import { AuthProvider } from './context/AuthContext'
import { JobsProvider } from './context/JobsContext'
import { NotificationProvider } from './context/NotificationContext'
import { Community } from './pages/Community'
import { CommunityPostDetail } from './pages/CommunityPostDetail'
import { EmployerDashboard } from './pages/EmployerDashboard'
import { Home } from './pages/Home'
import { JobDetail } from './pages/JobDetail'
import { Login } from './pages/Login'
import { PostJob } from './pages/PostJob'
import { Profile } from './pages/Profile'
import { SalaryCalculator } from './pages/SalaryCalculator'
import { Signup } from './pages/Signup'
import KoreaJobs from './pages/KoreaJobs'
import MapView from './components/MapView'
import AdminDashboard from './pages/AdminDashboard'
import FranchiseJobs from './pages/FranchiseJobs'
import { ZaloCallback } from './pages/ZaloCallback'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <JobsProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/viec-lam/:id" element={<JobDetail />} />
                <Route path="/dang-tin" element={<RequireEmployer><PostJob /></RequireEmployer>} />
                <Route path="/ho-so" element={<Profile />} />
                <Route path="/tinh-luong" element={<SalaryCalculator />} />
                <Route
                  path="/bang-dieu-khien"
                  element={
                    <RequireEmployer>
                      <EmployerDashboard />
                    </RequireEmployer>
                  }
                />
                <Route path="/cong-dong" element={<Community />} />
                <Route path="/cong-dong/:id" element={<CommunityPostDetail />} />
                <Route path="/dang-nhap" element={<Login />} />
                <Route path="/dang-ky" element={<Signup />} />
                <Route path="/ban-do" element={<MapView />} />
                <Route path="/viec-han-quoc" element={<KoreaJobs />} />
                <Route path="/franchise-jobs" element={<FranchiseJobs />} />
                <Route path="/zalo-callback" element={<ZaloCallback />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </NotificationProvider>
        </JobsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}


