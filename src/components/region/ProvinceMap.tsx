/**
 * 지역별 페이지 지도 고르기(Lee 2026-11-03 "A 데모 간단하게") — 베트남 지도 위 성마다
 * 공고 수 동그라미, 누르면 그 성을 고르고 확대한다.
 *
 * 경계는 저장소의 옛 63개 성 경계(originalProvinceBoundaries.ts, Natural Earth)를
 * 공식 대응표(vnOldProvinces.ts)로 지금 34개 성에 묶어 같은 색으로 칠한다. 외부 지도
 * API를 쓰지 않는 SVG라 키·요금이 없다. 큰 자료라 이 부품은 페이지에서 lazy로 불러온다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ORIGINAL_PROVINCES } from '../../data/originalProvinceBoundaries'
import { VN_OLD_PROVINCE_TO_NEW } from '../../data/vnOldProvinces'
import { provinceShortName } from '../../lib/jobArea'
import { normalizeViText } from '../../lib/jobCoords'
import './province-map.css'

type Ring = number[][]
const W = 360
const LON0 = 102
const LAT0 = 23.6
const K = 46 // px per degree (lat)
const COS = Math.cos((16 * Math.PI) / 180)
const px = (lng: number) => (lng - LON0) * K * COS
const py = (lat: number) => (LAT0 - lat) * K
const FULL = { x: 0, y: 0, w: W, h: Math.ceil((LAT0 - 8.3) * K) }

// 옛 성 key("province:bac giang") → 지금 성(공식 이름). 둘로 나뉜 옛 성(Tiền Giang)은 첫 번째.
const OLD_TO_NEW = new Map<string, string>()
for (const [oldName, news] of Object.entries(VN_OLD_PROVINCE_TO_NEW)) {
  OLD_TO_NEW.set(normalizeViText(provinceShortName(oldName)), news[0])
}
// 경계 자료는 옛 이름 "Thừa Thiên Huế", 공식 대응표는 "Thành phố Huế".
if (!OLD_TO_NEW.has('thua thien hue')) OLD_TO_NEW.set('thua thien hue', 'Thành phố Huế')

type Shape = { province: string; d: string; bbox: [number, number, number, number] }

function buildShapes(): { shapes: Shape[]; centers: Map<string, { x: number; y: number }> } {
  const shapes: Shape[] = []
  const acc = new Map<string, { x: number; y: number; n: number }>()
  for (const area of ORIGINAL_PROVINCES) {
    const province = OLD_TO_NEW.get(area.key.replace(/^province:/, ''))
    if (!province) continue
    const polys = (area.geometry.type === 'Polygon' ? [area.geometry.coordinates] : area.geometry.coordinates) as Ring[][]
    let d = ''
    const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const poly of polys) {
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const x = px(lng), y = py(lat)
          bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y)
          bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y)
          d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        d += 'Z'
      }
    }
    shapes.push({ province, d, bbox })
    const c = acc.get(province) ?? { x: 0, y: 0, n: 0 }
    acc.set(province, { x: c.x + px(area.lng), y: c.y + py(area.lat), n: c.n + 1 })
  }
  const centers = new Map([...acc].map(([p, c]) => [p, { x: c.x / c.n, y: c.y / c.n }]))
  return { shapes, centers }
}

type Box = typeof FULL

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

  // 고른 성으로 부드럽게 확대(viewBox 보간), 다시 Toàn quốc면 전체로.
  useEffect(() => {
    let target = FULL
    if (selected) {
      const bs = shapes.filter((s) => s.province === selected).map((s) => s.bbox)
      if (bs.length) {
        const x0 = Math.min(...bs.map((b) => b[0])), y0 = Math.min(...bs.map((b) => b[1]))
        const x1 = Math.max(...bs.map((b) => b[2])), y1 = Math.max(...bs.map((b) => b[3]))
        const pad = Math.max(x1 - x0, y1 - y0) * 0.35 + 12
        const w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2
        const scale = Math.max(w / FULL.w, h / FULL.h)
        const tw = FULL.w * scale, th = FULL.h * scale
        target = { x: (x0 + x1) / 2 - tw / 2, y: (y0 + y1) / 2 - th / 2, w: tw, h: th }
      }
    }
    const from = boxRef.current
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 450)
      const e = 1 - Math.pow(1 - k, 3)
      setBox({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e })
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [selected, shapes])

  const zoom = FULL.w / box.w
  const active = hover ?? selected
  return (
    <div className="pmap">
      <svg className="pmap__svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label="Bản đồ chọn tỉnh/thành phố">
        <rect x={-500} y={-500} width={2000} height={2000} className="pmap__sea" onClick={() => onSelect(null)} />
        {shapes.map((s, i) => {
          const n = counts.get(s.province) ?? 0
          return (
            <path key={i} d={s.d}
              className={`pmap__prov${n > 0 ? ' has-jobs' : ''}${s.province === selected ? ' is-selected' : ''}${s.province === hover ? ' is-hover' : ''}`}
              strokeWidth={0.6 / zoom}
              onMouseEnter={() => setHover(s.province)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(s.province === selected ? null : s.province)}>
              <title>{provinceShortName(s.province)} · {n} việc làm</title>
            </path>
          )
        })}
        {[...centers].filter(([p]) => (counts.get(p) ?? 0) > 0).map(([p, c]) => {
          const n = counts.get(p)!
          const r = (11 + Math.min(10, Math.sqrt(n) * 3)) / zoom
          return (
            <g key={p} className={`pmap__bubble${p === selected ? ' is-selected' : ''}`} onClick={() => onSelect(p === selected ? null : p)}
              onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
              <circle cx={c.x} cy={c.y} r={r} />
              <text x={c.x} y={c.y} dy="0.35em" fontSize={12 / zoom}>{n}</text>
            </g>
          )
        })}
      </svg>
      <div className="pmap__label" aria-live="polite">
        {active ? <><b>{provinceShortName(active)}</b> · {counts.get(active) ?? 0} việc làm</> : <>Chạm vào tỉnh trên bản đồ</>}
      </div>
      {selected && <button type="button" className="pmap__back" onClick={() => onSelect(null)}>← Toàn quốc</button>}
    </div>
  )
}
