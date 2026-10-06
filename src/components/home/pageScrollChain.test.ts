import { canScrollFurther, wheelDeltaPx } from './pageScrollChain.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

const box = (scrollTop: number) => ({ scrollTop, scrollHeight: 660, clientHeight: 423 })

assert(canScrollFurther(box(0), 100), 'top of filter column: wheel down scrolls the column first')
assert(!canScrollFurther(box(0), -100), 'top of filter column: wheel up goes to the page')
assert(canScrollFurther(box(100), -100) && canScrollFurther(box(100), 100), 'middle: both directions stay inside')
assert(!canScrollFurther(box(237), 100), 'bottom of filter column: wheel down goes to the page')
assert(!canScrollFurther(box(236.5), 100), 'sub-pixel bottom counts as the end')
assert(!canScrollFurther({ scrollTop: 0, scrollHeight: 423, clientHeight: 423 }, 100), 'column without overflow passes every wheel to the page')
assert(!canScrollFurther(box(50), 0), 'zero delta is never consumed')

assert(wheelDeltaPx(100, 0, 768) === 100, 'pixel mode unchanged')
assert(wheelDeltaPx(3, 1, 768) === 120, 'line mode uses 40px lines')
assert(wheelDeltaPx(1, 2, 768) === 768, 'page mode uses the viewport height')

console.log('pageScrollChain.test.ts: wheel chaining assertions passed')
