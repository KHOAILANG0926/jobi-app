// 2026-10-30 Lee 확정 움직이는 복리후생 아이콘(데모 all7-52px). 그림은 데모와 같은 SVG, 클래스는 bai- 접두로 사이트 CSS와 섞이지 않게.
import { useEffect, useRef, useState } from 'react'
import './benefitIcons.css'
import { SVG, BENEFIT_ICON_COLORS, hasAnimatedBenefitIcon } from '../lib/benefitIconArt'
export { hasAnimatedBenefitIcon }

/** 처음 화면에 보일 때 한 번(약 3.5초) + 누르거나 마우스를 올릴 때 다시 움직인다. */
export function AnimatedBenefitIcon({ iconKey }: { iconKey: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const play = () => { setPlaying(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setPlaying(false), 3500) }
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { play(); io.disconnect() } }, { threshold: 0.6 })
    io.observe(el)
    return () => { io.disconnect(); window.clearTimeout(timer.current) }
  }, [])
  const c = BENEFIT_ICON_COLORS[iconKey]
  return <span ref={ref} className={`jd2-benefit__icon bai-tile${playing ? ' is-playing' : ''}`} style={{ background: c?.bg }}
    onPointerEnter={play} onClick={play} dangerouslySetInnerHTML={{ __html: SVG[iconKey] ?? '' }} />
}
