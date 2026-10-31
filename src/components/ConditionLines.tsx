import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CONDITION_MAX_LINES, conditionItems } from '../lib/conditionLines'

// 근무조건 한 칸: 한 항목 = 한 줄(항목 중간 꺾임 금지), 최대 3줄. 넘치면 'Xem thêm'만 보이고 전체는 상세요강에.
// 넘침 판단은 실제 칸 폭으로 잰다(숨긴 측정용 사본) — 화면 폭이 바뀌어도 다시 잰다.
export function ConditionLines({ text, compactText, showPreview = false, onOverflowChange, onMore }: {
  text: string
  compactText?: string
  showPreview?: boolean
  onOverflowChange?: (overflow: boolean) => void
  onMore: () => void
}) {
  const items = useMemo(() => conditionItems(text), [text])
  const measureRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(items.length > CONDITION_MAX_LINES)

  useLayoutEffect(() => {
    const el = measureRef.current
    const check = () => {
      const host = el?.parentElement
      let next = items.length > CONDITION_MAX_LINES
      if (!next && el && host) {
        const width = host.clientWidth
        next = [...el.children].some((child) => (child as HTMLElement).scrollWidth > width + 0.5)
      }
      setOverflow(next)
    }
    check()
    const host = el?.parentElement
    if (!host || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(host)
    return () => ro.disconnect()
  }, [items])

  // 부모가 매번 새 함수를 넘겨도 넘침 상태가 바뀔 때만 알린다.
  const notify = useRef(onOverflowChange)
  notify.current = onOverflowChange
  useLayoutEffect(() => { notify.current?.(overflow) }, [overflow])

  return (
    <>
      <span ref={measureRef} className="jd2-cond-measure" aria-hidden="true">
        {items.map((item, i) => <span key={i} className="jd2-cond-item">{item}</span>)}
      </span>
      {overflow && items.length ? (
        compactText ? <span className="jd2-salary-lines jd2-cond-lines">
          <span className="jd2-cond-item" data-condition-summary="true" aria-label={text} title={text}>{compactText}</span>
          <button type="button" className="jd2-cond-more" onClick={onMore}>Xem thêm</button>
        </span> : showPreview ? <span className="jd2-salary-lines jd2-cond-lines">
          {items.slice(0, CONDITION_MAX_LINES).map((item, i) => <span key={i} className="jd2-salary-line jd2-cond-item">{item}</span>)}
          <button type="button" className="jd2-cond-more" onClick={onMore}>Xem thêm</button>
        </span> : <button type="button" className="jd2-cond-more" onClick={onMore}>Xem thêm</button>
      ) : (
        <span className="jd2-salary-lines jd2-cond-lines">
          {items.map((item, i) => <span key={i} className="jd2-salary-line jd2-cond-item">{item}</span>)}
        </span>
      )}
    </>
  )
}
