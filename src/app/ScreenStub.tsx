import { useLocation } from 'react-router-dom'
import { EMPLOYER_TABS, SEEKER_TABS } from './tabs'

// 0단계 빈 화면. 탭 이름만 보여 주고 실제 화면은 2단계 이후에 이 자리를 교체한다.
export default function ScreenStub() {
  const { pathname } = useLocation()
  const tab = [...SEEKER_TABS, ...EMPLOYER_TABS].find((t) => t.to === pathname)
  return (
    <section className="app-stub" data-testid="app-screen-stub" data-screen={tab?.key ?? 'unknown'}>
      <h1 className="app-stub__title">{tab?.label ?? 'Không tìm thấy trang'}</h1>
    </section>
  )
}
