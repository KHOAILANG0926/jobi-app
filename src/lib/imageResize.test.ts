import { fitSize } from './imageResize.ts'
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }
eq(fitSize(4000, 3000), { w: 1600, h: 1200 }, 'landscape shrinks to 1600 long side')
eq(fitSize(3000, 4000), { w: 1200, h: 1600 }, 'portrait shrinks to 1600 long side')
eq(fitSize(800, 600), { w: 800, h: 600 }, 'small image unchanged')
console.log('imageResize: fit sizes pass')
