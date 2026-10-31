// 2026-10-31: Keep approved animated benefit art moving while visible; never pause mid-cycle on a fixed timer.
import { useEffect, useRef, useState } from 'react'
import './benefitIcons.css'
import { SVG, BENEFIT_ICON_COLORS, hasAnimatedBenefitIcon } from '../lib/benefitIconArt'
export { hasAnimatedBenefitIcon }

/** Animate only while the icon is on screen. Reduced-motion users are handled by CSS. */
export function AnimatedBenefitIcon({ iconKey }: { iconKey: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const c = BENEFIT_ICON_COLORS[iconKey]
  return <span ref={ref} className={`jd2-benefit__icon bai-tile${visible ? ' is-playing' : ''}`} style={{ background: c?.bg }}
    dangerouslySetInnerHTML={{ __html: SVG[iconKey] ?? '' }} />
}
