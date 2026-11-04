import * as images from './companyLogo.ts'
import { readFileSync } from 'node:fs'
import type { BrandDefinition } from '../data/brandDirectory'

function eq(got: unknown, want: unknown, name: string) {
  if (got !== want) throw new Error(`${name}: ${JSON.stringify(got)} !== ${JSON.stringify(want)}`)
}
eq(typeof images.jobRepresentativeImageUrl, 'function', 'shared representative image resolver exists')
const resolve = images.jobRepresentativeImageUrl
const own = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/'
const job = { company: 'Test company', title: 'Hiring', category: 'san_xuat_xay_dung' as const, imageUrl: `${own}logo.png`, images: ['workplace.png'] }
const brands: BrandDefinition[] = [{ id: 1, name: 'Test company', matchKeys: ['Test company'], category: 'retail', linkTo: 'Test company', domain: 'example.com', initial: 'T', color: '#333', featured: true }]
eq(resolve(job, brands), 'https://www.google.com/s2/favicons?sz=128&domain=example.com', '1 brand logo wins')
eq(resolve(job, []), `${own}logo.png`, '2 imageUrl wins over images')
eq(resolve({ ...job, imageUrl: undefined }, []), `${own}workplace.png`, '3 first stored image becomes public URL')
eq(resolve({ ...job, imageUrl: 'https://scontent.xx.fbcdn.net/logo.png' }, []), `${own}workplace.png`, '4 blocked external imageUrl falls through')
eq(resolve({ ...job, imageUrl: 'invalid' }, []), `${own}workplace.png`, '4 malformed imageUrl falls through')
eq(resolve({ ...job, imageUrl: undefined, images: [] }, []), '/images/industry/san_xuat_xay_dung.jpg', '5 industry fallback')
eq(resolve({ ...job, imageUrl: undefined, images: ['../secret.png'] }, []), '/images/industry/san_xuat_xay_dung.jpg', 'unsafe first stored image falls through')
eq(resolve({ ...job, imageUrl: undefined, images: ['https://cdn.example.com/a.png', 'workplace.png'] }, []), '/images/industry/san_xuat_xay_dung.jpg', 'only images[0] is considered and external URLs stay blocked')
const detail = readFileSync(new URL('../pages/JobDetail.tsx', import.meta.url), 'utf8')
eq(detail.includes('const extraImages = (job.images ?? []).map(jobImagePublicUrl).filter((u): u is string => !!u)'), true, '6 lower recruitment images retain their independent conversion')
console.log('jobRepresentativeImage: all assertions passed')
