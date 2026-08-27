import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Per-history-entry scroll position, keyed by React Router's location.key.
const scrollPositions = new Map<string, number>()

/**
 * BrowserRouter doesn't reset scroll position on client-side navigation (pushState
 * keeps whatever the browser was scrolled to), so a link near the bottom of a long
 * page — e.g. a job card far down the Home feed — opened the next route mid-scroll.
 *
 * The browser's own `history.scrollRestoration` is supposed to handle the back/forward
 * side of this automatically, but it's unreliable once anything else shifts navigation
 * timing, so scroll restoration is handled explicitly and deterministically here:
 * - Right before leaving a history entry, its scroll position is recorded (effect
 *   cleanup keyed on `location.key`, so it fires exactly once per entry as we navigate
 *   away — no reliance on scroll-event timing).
 * - PUSH/REPLACE (a normal forward navigation, e.g. clicking a job card): jump to top.
 * - POP (back/forward): restore whatever position was recorded for that history entry.
 * - A #hash target is left alone in both cases, for the browser/anchor to handle.
 *
 * Every route here is `React.lazy` (see App.tsx), so right after a navigation the page
 * briefly renders the tiny <Suspense> fallback before the real, full-height content
 * mounts. A single scrollTo at that moment gets clamped by the browser to whatever the
 * fallback's short document height allows, landing well short of the intended target
 * once the real content expands the page a moment later. Re-applying the scroll across
 * a few animation frames covers that gap without needing to know when the lazy chunk
 * (already cached after the first visit, so this is normally just 1–2 frames) resolves.
 */
export function ScrollToTop() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    const key = location.key
    return () => { scrollPositions.set(key, window.scrollY) }
  }, [location.key])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (location.hash) return

    const top = navigationType === 'POP' ? (scrollPositions.get(location.key) ?? 0) : 0

    let cancelled = false
    let frame = 0
    const applyScroll = () => {
      if (cancelled) return
      // `html { scroll-behavior: smooth }` (src/index.css) would otherwise animate
      // this — force an instant jump so the route never renders mid-scroll.
      window.scrollTo({ top, left: 0, behavior: 'instant' })
      frame += 1
      if (frame < 12) requestAnimationFrame(applyScroll)
    }
    requestAnimationFrame(applyScroll)

    return () => { cancelled = true }
  }, [location, navigationType])

  return null
}
