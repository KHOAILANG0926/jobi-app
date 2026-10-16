import { Home as DesktopHome } from './HomeDesktop'
import { Home as MobileHome } from './HomeMobile'
import { useMobileLayout } from '../lib/useMobileLayout'

export function Home() {
  return useMobileLayout() ? <MobileHome /> : <DesktopHome />
}
