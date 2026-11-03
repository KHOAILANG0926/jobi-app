/**
 * 지역별 페이지 지도 고르기(Lee 2026-11-03 "A 데모 간단하게") — 베트남 지도 위 성마다
 * 공고 수 동그라미, 누르면 그 성을 고르고 확대한다. 마우스 휠로 확대·축소, 끌어서 이동.
 *
 * 경계는 저장소의 옛 63개 성 경계(originalProvinceBoundaries.ts, Natural Earth)를
 * 공식 대응표(vnOldProvinces.ts)로 지금 34개 성에 묶어 같은 색으로 칠한다. 거친 축척이라
 * 빠진 섬(Hoàng Sa·Trường Sa 군도 포함)은 vnIslands.ts에서 그 섬이 속한 성의 일부로 그린다.
 * 외부 지도 API를 쓰지 않는 SVG라 키·요금이 없다. 큰 자료라 페이지에서 lazy로 불러온다.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ORIGINAL_PROVINCES } from '../../data/originalProvinceBoundaries'
import { VN_OLD_PROVINCE_TO_NEW } from '../../data/vnOldProvinces'
import { ISLAND_GROUP_LABELS, PHU_QUOC_OUTLINE, VN_ISLANDS } from '../../data/vnIslands'
import { provinceShortName } from '../../lib/jobArea'
import { normalizeViText } from '../../lib/jobCoords'
import './province-map.css'

type Ring = number[][]
const LON0 = 102
const LON1 = 117.2
const LAT0 = 23.6
const LAT1 = 7.2
const K = 46 // px per degree (lat)
const COS = Math.cos((16 * Math.PI) / 180)
const px = (lng: number) => (lng - LON0) * K * COS
const py = (lat: number) => (LAT0 - lat) * K
const KM = K / 111 // px per km
const FULL = { x: 0, y: 0, w: Math.ceil(px(LON1)), h: Math.ceil(py(LAT1)) }
const MIN_W = FULL.w / 40

// 옛 성 key("province:bac giang") → 지금 성(공식 이름). 둘로 나뉜 옛 성(Tiền Giang)은 첫 번째.
const OLD_TO_NEW = new Map<string, string>()
for (const [oldName, news] of Object.entries(VN_OLD_PROVINCE_TO_NEW)) {
  OLD_TO_NEW.set(normalizeViText(provinceShortName(oldName)), news[0])
}
// 경계 자료는 옛 이름 "Thừa Thiên Huế", 공식 대응표는 "Thành phố Huế".
if (!OLD_TO_NEW.has('thua thien hue')) OLD_TO_NEW.set('thua thien hue', 'Thành phố Huế')

type Shape = { province: string; d: string; bbox: [number, number, number, number] }

function ringPath(ring: Ring, bbox: [number, number, number, number]): string {
  let d = ''
  ring.forEach(([lng, lat], i) => {
    const x = px(lng), y = py(lat)
    bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y)
    bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return d + 'Z'
}

function buildShapes(): { shapes: Shape[]; centers: Map<string, { x: number; y: number }> } {
  const shapes: Shape[] = []
  const acc = new Map<string, { x: number; y: number; n: number }>()
  for (const area of ORIGINAL_PROVINCES) {
    const province = OLD_TO_NEW.get(area.key.replace(/^province:/, ''))
    if (!province) continue
    const polys = (area.geometry.type === 'Polygon' ? [area.geometry.coordinates] : area.geometry.coordinates) as Ring[][]
    const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    let d = ''
    for (const poly of polys) for (const ring of poly) d += ringPath(ring, bbox)
    shapes.push({ province, d, bbox })
    const c = acc.get(province) ?? { x: 0, y: 0, n: 0 }
    acc.set(province, { x: c.x + px(area.lng), y: c.y + py(area.lat), n: c.n + 1 })
  }
  const pqBox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  shapes.push({ province: 'Tỉnh An Giang', d: ringPath(PHU_QUOC_OUTLINE, pqBox), bbox: pqBox })
  const centers = new Map([...acc].map(([p, c]) => [p, { x: c.x / c.n, y: c.y / c.n }]))
  return { shapes, centers }
}

type Box = typeof FULL

function fitBox(x0: number, y0: number, x1: number, y1: number): Box {
  const pad = Math.max(x1 - x0, y1 - y0) * 0.35 + 12
  const w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2
  const scale = Math.max(w / FULL.w, h / FULL.h)
  const tw = FULL.w * scale, th = FULL.h * scale
  return { x: (x0 + x1) / 2 - tw / 2, y: (y0 + y1) / 2 - th / 2, w: tw, h: th }
}

export default function ProvinceMap({ counts, selected, onSelect }: {
  counts: Map<string, number>
  selected: string | null
  onSelect: (province: string | null) => void
}) {
  const { shapes, centers } = useMemo(buildShapes, [])
  const [hover, setHover] = useState<string | null>(null)
  const [box, setBox] = useState<Box>(FULL)
  const boxRef = useRef(box)
  boxRef.current = box
  const svgRef = useRef<SVGSVGElement>(null)
  const anim = useRef(0)
  const drag = useRef<{ x: number; y: number; box: Box; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const animateTo = (target: Box) => {
    cancelAnimationFrame(anim.current)
    const from = boxRef.current
    const start = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 450)
      const e = 1 - Math.pow(1 - k, 3)
      setBox({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e })
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }

  // 고른 성으로 부드럽게 확대(섬까지 포함), 다시 Toàn quốc면 전체로.
  useEffect(() => {
    if (!selected) { animateTo(FULL); return }
    const bs = shapes.filter((s) => s.province === selected).map((s) => s.bbox)
    if (!bs.length) return
    animateTo(fitBox(Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))))
    return () => cancelAnimationFrame(anim.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, shapes])

  // 마우스 휠 확대·축소(커서 위치 기준). 페이지 스크롤을 막아야 해서 passive:false로 직접 등록.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cancelAnimationFrame(anim.current)
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
      const b = boxRef.current
      const f = Math.pow(1.0015, e.deltaY)
      const w = Math.min(FULL.w * 1.2, Math.max(MIN_W, b.w * f))
      const s = w / b.w
      setBox({ x: pt.x - (pt.x - b.x) * s, y: pt.y - (pt.y - b.y) * s, w, h: b.h * s })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // 끌어 이동 + 휴대폰 두 손가락 확대(pinch). 손가락(포인터)을 id별로 기억한다.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; box: Box; mid: { x: number; y: number } } | null>(null)
  const toSvg = (cx: number, cy: number) => {
    const ctm = svgRef.current?.getScreenCTM()
    return ctm ? new DOMPoint(cx, cy).matrixTransform(ctm.inverse()) : null
  }
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    cancelAnimationFrame(anim.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2)
      pinch.current = mid ? { dist: Math.hypot(a.x - b.x, a.y - b.y), box: boxRef.current, mid: { x: mid.x, y: mid.y } } : null
      drag.current = null
      suppressClick.current = true
      return
    }
    if (pointers.current.size === 1) suppressClick.current = false
    drag.current = { x: e.clientX, y: e.clientY, box: boxRef.current, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pz = pinch.current
    if (pz && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (dist < 1) return
      const w = Math.min(FULL.w * 1.2, Math.max(MIN_W, pz.box.w * (pz.dist / dist)))
      const s = w / pz.box.w
      setBox({ x: pz.mid.x - (pz.mid.x - pz.box.x) * s, y: pz.mid.y - (pz.mid.y - pz.box.y) * s, w, h: pz.box.h * s })
      return
    }
    const d = drag.current
    const ctm = svgRef.current?.getScreenCTM()
    if (!d || !ctm) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    if (!d.moved) { d.moved = true; svgRef.current?.setPointerCapture(e.pointerId) }
    setBox({ ...d.box, x: d.box.x - dx / ctm.a, y: d.box.y - dy / ctm.d })
  }
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null
      drag.current = null
      return
    }
    suppressClick.current = !!drag.current?.moved
    drag.current = null
  }
  const pick = (p: string | null) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    onSelect(p)
  }

  const zoom = FULL.w / box.w
  const active = hover ?? selected
  const cls = (p: string) => `${(counts.get(p) ?? 0) > 0 ? ' has-jobs' : ''}${p === selected ? ' is-selected' : ''}${p === hover ? ' is-hover' : ''}`
  const enter = (p: string) => () => setHover(p)
  const leave = () => setHover(null)
  return (
    <div className="pmap">
      <svg ref={svgRef} className={`pmap__svg${drag.current?.moved ? ' is-dragging' : ''}`} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        role="img" aria-label="Bản đồ chọn tỉnh/thành phố"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {/* 2026-11-03 Lee "입체적으로, 바다도 꾸미고": 바다 그라데이션 + 물결, 땅은 두께(아래로 밀린 그림자 층)
            + 위쪽 밝은 그라데이션으로 떠 있는 판처럼. */}
        <defs>
          <radialGradient id="pmap-sea" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#d9eff9" />
            <stop offset="55%" stopColor="#a9d6ee" />
            <stop offset="100%" stopColor="#6fb0d6" />
          </radialGradient>
          <pattern id="pmap-waves" width="28" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 7 Q7 3 14 7 T28 7" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.8" />
          </pattern>
          <linearGradient id="pmap-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffdf7" />
            <stop offset="100%" stopColor="#efe5cf" />
          </linearGradient>
          <filter id="pmap-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="4" result="b" />
            <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="url(#pmap-sea)" className="pmap__sea" onClick={() => pick(null)} />
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="url(#pmap-waves)" pointerEvents="none" />
        {/* 땅 두께(옆면): 같은 모양을 아래로 조금 밀어 진하게 */}
        <g transform={`translate(0 ${2.4 / zoom})`} filter="url(#pmap-shadow)" pointerEvents="none">
          {shapes.map((s, i) => <path key={i} d={s.d} className="pmap__side" />)}
          {VN_ISLANDS.filter((i) => i.km > 0).map((i) => <circle key={i.name} cx={px(i.lng)} cy={py(i.lat)} r={Math.max(i.km * KM, 1.8 / zoom)} className="pmap__side" />)}
        </g>
        {shapes.map((s, i) => (
          <path key={i} d={s.d} className={`pmap__prov${cls(s.province)}`} strokeWidth={0.6 / zoom}
            onMouseEnter={enter(s.province)} onMouseLeave={leave} onClick={() => pick(s.province === selected ? null : s.province)}>
            <title>{provinceShortName(s.province)} · {counts.get(s.province) ?? 0} việc làm</title>
          </path>
        ))}
        {VN_ISLANDS.filter((i) => i.km > 0).map((i) => (
          <circle key={i.name} cx={px(i.lng)} cy={py(i.lat)} r={Math.max(i.km * KM, 1.8 / zoom)}
            className={`pmap__prov pmap__island${cls(i.province)}`} strokeWidth={0.5 / zoom}
            onMouseEnter={enter(i.province)} onMouseLeave={leave} onClick={() => pick(i.province === selected ? null : i.province)}>
            <title>{i.group ? 'Đảo ' : 'Đặc khu '}{i.name} · {provinceShortName(i.province)}</title>
          </circle>
        ))}
        {Object.values(ISLAND_GROUP_LABELS).map((g) => (
          <text key={g.label} x={px(g.lng)} y={py(g.lat)} className="pmap__group-label" fontSize={10 / zoom}>{g.label}</text>
        ))}
        {zoom > 3 && VN_ISLANDS.map((i) => (
          <text key={`l-${i.name}`} x={px(i.lng) + 4 / zoom} y={py(i.lat)} dy="0.35em" className="pmap__island-label" fontSize={8 / zoom}>{i.name}</text>
        ))}
        {[...centers].filter(([p]) => (counts.get(p) ?? 0) > 0).map(([p, c]) => {
          const n = counts.get(p)!
          const r = (11 + Math.min(10, Math.sqrt(n) * 3)) / zoom
          return (
            <g key={p} className={`pmap__bubble${p === selected ? ' is-selected' : ''}`} onClick={() => pick(p === selected ? null : p)}
              onMouseEnter={enter(p)} onMouseLeave={leave}>
              <circle cx={c.x} cy={c.y} r={r} />
              <text x={c.x} y={c.y} dy="0.35em" fontSize={12 / zoom}>{n}</text>
            </g>
          )
        })}
      </svg>
      <div className="pmap__label" aria-live="polite">
        {active ? <><b>{provinceShortName(active)}</b> · {counts.get(active) ?? 0} việc làm</> : <>Chạm vào tỉnh · cuộn chuột để phóng to</>}
      </div>
      <div className="pmap__zoom">
        <button type="button" aria-label="Phóng to" onClick={() => { const b = boxRef.current; const w = Math.max(MIN_W, b.w / 1.6); animateTo({ x: b.x + (b.w - w) / 2, y: b.y + (b.h - b.h * w / b.w) / 2, w, h: b.h * w / b.w }) }}>+</button>
        <button type="button" aria-label="Thu nhỏ" onClick={() => { const b = boxRef.current; const w = Math.min(FULL.w * 1.2, b.w * 1.6); animateTo({ x: b.x + (b.w - w) / 2, y: b.y + (b.h - b.h * w / b.w) / 2, w, h: b.h * w / b.w }) }}>−</button>
      </div>
      {selected && <button type="button" className="pmap__back" onClick={() => onSelect(null)}>← Toàn quốc</button>}
    </div>
  )
}
