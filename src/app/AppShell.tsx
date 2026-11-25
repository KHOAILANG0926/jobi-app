import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

// 모든 화면이 공유하는 앱 틀. 상단바·바텀시트 같은 공통 부품은 1단계에서 채운다.
export default function AppShell() {
  return (
    <div className="app-shell">
      <main className="app-screen">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
