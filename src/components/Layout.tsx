import { Layout as DesktopLayout } from './LayoutDesktop'
import { Layout as MobileLayout } from './LayoutMobile'
import { useMobileLayout } from '../lib/useMobileLayout'

export function Layout() {
  return useMobileLayout() ? <MobileLayout /> : <DesktopLayout />
}
