// 브랜드 로고 수평 전개(Lee 2026-11-01) — 공고 회사 이름이 브랜드와 맞을 때만, 공식 사이트 domain이 있을 때만
import { brandLogoFor } from './brandLogo.ts'
function eq(got: unknown, want: unknown, name: string) { if (got !== want) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
const brands = [
  { id: 1, name: 'Highlands Coffee', matchKeys: ['Highlands Coffee'], category: 'cafe', linkTo: 'Highlands Coffee', domain: 'highlandscoffee.com.vn', initial: 'H', color: '#b22830', featured: true },
  { id: 2, name: 'Tamba Coffee', matchKeys: ['Tamba Coffee'], category: 'cafe', linkTo: 'Tamba Coffee', initial: 'T', color: '#8b4513', featured: true },
] as never
eq(brandLogoFor({ company: 'Highlands Coffee Mường Thanh Bắc Ninh', title: 'x' }, brands), 'https://www.google.com/s2/favicons?sz=128&domain=highlandscoffee.com.vn', '#5157 brand logo')
eq(brandLogoFor({ company: 'Tamba Coffee Bắc Ninh', title: 'x' }, brands), undefined, 'brand without official domain → no logo')
eq(brandLogoFor({ company: 'ADTEK', title: 'Việc làm' }, brands), undefined, 'not a brand')
console.log('brandLogo: passed')
