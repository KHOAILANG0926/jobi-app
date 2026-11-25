import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppProviders from './data/AppProviders'
import { AppFiltersProvider } from './filters/AppFilters'
import AppShell from './AppShell'
import { lazy, Suspense } from 'react'
import HomeScreen from './screens/HomeScreen'
import ScreenStub from './ScreenStub'
import { EMPLOYER_TABS, SEEKER_TABS } from './tabs'

// 주소는 /app 아래만 쓴다(vercel.json이 /app, /app/* 를 app.html로 보냄). 웹 주소와 섞이지 않는다.
// 1단계: 홈·목록(프리셋)·검색·메뉴·공고 상세·지도. 2단계 ①: 로그인·가입·마이·지원 내역. 추천 탭(/goi-y)은 목록의 '추천' 프리셋과 같은 화면이다. 아직 없는 화면은 ScreenStub.
// 홈 말고는 처음 열 때 불러온다(첫 화면 무게를 줄임).
const ListScreen = lazy(() => import('./screens/ListScreen'))
const MenuScreen = lazy(() => import('./screens/MenuScreen'))
const SearchScreen = lazy(() => import('./screens/SearchScreen'))
const DetailScreen = lazy(() => import('./detail/DetailScreen'))
const MapScreen = lazy(() => import('./map/MapScreen'))
const MeScreen = lazy(() => import('./account/MeScreen'))
const CommunityScreen = lazy(() => import('./community/CommunityScreen'))
const PostScreen = lazy(() => import('./community/PostScreen'))
const BizHomeScreen = lazy(() => import('./biz/BizHomeScreen'))
const BizManageScreen = lazy(() => import('./biz/BizManageScreen'))
const MessagesScreen = lazy(() => import('./inbox/MessagesScreen'))
const InterviewsScreen = lazy(() => import('./inbox/InterviewsScreen'))
const BizMessagesScreen = lazy(() => import('./biz/BizMessagesScreen'))
const BizCompanyScreen = lazy(() => import('./biz/BizCompanyScreen'))
const ConditionsScreen = lazy(() => import('./account/ConditionsScreen'))
const NotificationsScreen = lazy(() => import('./account/NotificationsScreen'))
const CvScreen = lazy(() => import('./account/CvScreen'))
const ApplicationsScreen = lazy(() => import('./account/ApplicationsScreen'))
const LoginScreen = lazy(() => import('./account/LoginScreens').then((m) => ({ default: m.LoginScreen })))
const SignupScreen = lazy(() => import('./account/LoginScreens').then((m) => ({ default: m.SignupScreen })))
const BUILT = new Set(['/', '/goi-y', '/ban-do', '/ho-so', '/cong-dong', '/biz', '/biz/quan-ly-tin', '/biz/doanh-nghiep'])
export default function AppRoot() {
  return (
    <AppProviders>
      <AppFiltersProvider>
        <BrowserRouter basename="/app">
          <Suspense fallback={<p className="app-state" role="status">Đang tải…</p>}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/goi-y" element={<ListScreen preset="goi-y" />} />
              <Route path="/danh-sach/:preset" element={<ListScreen />} />
              <Route path="/tim-kiem" element={<SearchScreen />} />
              <Route path="/ban-do" element={<MapScreen />} />
              <Route path="/menu" element={<MenuScreen />} />
              <Route path="/cong-dong" element={<CommunityScreen />} />
              <Route path="/cong-dong/:id" element={<PostScreen />} />
              <Route path="/biz" element={<BizHomeScreen />} />
              <Route path="/biz/quan-ly-tin" element={<BizManageScreen />} />
              <Route path="/biz/tin-nhan" element={<BizMessagesScreen />} />
              <Route path="/biz/doanh-nghiep" element={<BizCompanyScreen />} />
              <Route path="/ho-so" element={<MeScreen />} />
              <Route path="/ho-so/cv" element={<CvScreen />} />
              <Route path="/ho-so/tin-nhan" element={<MessagesScreen />} />
              <Route path="/ho-so/phong-van" element={<InterviewsScreen />} />
              <Route path="/ho-so/dieu-kien" element={<ConditionsScreen />} />
              <Route path="/ho-so/thong-bao" element={<NotificationsScreen />} />
              <Route path="/ho-so/ung-tuyen" element={<ApplicationsScreen />} />
              <Route path="/dang-nhap" element={<LoginScreen />} />
              <Route path="/dang-ky" element={<SignupScreen />} />
              <Route path="/viec-lam/:id" element={<DetailScreen />} />
              {[...SEEKER_TABS, ...EMPLOYER_TABS].filter((tab) => !BUILT.has(tab.to)).map((tab) => (
                <Route key={tab.key} path={tab.to} element={<ScreenStub />} />
              ))}
              <Route path="*" element={<ScreenStub />} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AppFiltersProvider>
    </AppProviders>
  )
}
