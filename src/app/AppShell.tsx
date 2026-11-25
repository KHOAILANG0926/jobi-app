import { Outlet, useMatch } from 'react-router-dom'
import TabBar from './TabBar'

// 모든 화면이 공유하는 앱 틀. 공고 상세는 하단에 고정 지원 바가 있어 하단 탭을 숨긴다(V3 시안).
export default function AppShell() {
  const detail = useMatch('/viec-lam/:id')
  return (
    <div className={'app-shell' + (detail ? ' app-shell--detail' : '')}>
      <main className="app-screen">
        <Outlet />
      </main>
      {!detail && <TabBar />}
    </div>
  )
}
