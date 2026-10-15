import { observeInViewOnce, type ObserverCtor } from './inViewOnce.ts'

function assert(cond: boolean, label: string): void { if (!cond) throw new Error(label) }

let fire: IntersectionObserverCallback = () => {}
let disconnected = 0
const Fake = class {
  constructor(cb: IntersectionObserverCallback) { fire = cb }
  observe() {}
  disconnect() { disconnected++ }
} as unknown as ObserverCtor
const el = {} as Element
const hit = (isIntersecting: boolean) => fire([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)

let calls = 0
observeInViewOnce(el, () => { calls++ }, Fake)
assert(calls === 0, '처음엔 지도를 불러오지 않음')
hit(false); assert(calls === 0, '화면 밖이면 그대로')
hit(true); assert(calls === 1 && disconnected === 1, '화면에 들어오면 한 번 불러오고 관찰 중지')
hit(true); assert(calls === 1, '다시 들어와도 중복 호출 없음')

let fallback = 0
observeInViewOnce(el, () => { fallback++ }, undefined)
assert(fallback === 1, 'IntersectionObserver 없으면 바로 불러옴')
console.log('inViewOnce: all assertions passed')
