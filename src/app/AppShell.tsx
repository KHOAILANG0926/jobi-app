import { Outlet, useMatch, useSearchParams } from 'react-router-dom'
import TabBar from './TabBar'

// 모든 화면이 공유하는 앱 틀. 공고 상세는 하단에 고정 지원 바가 있어 하단 탭을 숨긴다(V3 시안).
// 대화 화면(메시지함에서 대화를 연 상태)도 하단에 입력창이 있어 하단 탭을 숨긴다.
export default function AppShell() {
  const detail = useMatch('/viec-lam/:id')
  const inbox = useMatch('/ho-so/tin-nhan') ?? useMatch('/biz/tin-nhan')
  const [params] = useSearchParams()
  const conv = !!inbox && (params.has('job') || params.has('thread'))
  return (
    <div className={'app-shell' + (detail ? ' app-shell--detail' : '') + (conv ? ' app-shell--conv' : '')}>
      <main className="app-screen">
        <Outlet />
      </main>
      {!detail && !conv && <TabBar />}
    </div>
  )
}
