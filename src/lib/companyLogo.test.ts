import { companyLogoUrl } from './companyLogo.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

const own = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/logo-123.png'
assert(companyLogoUrl(own) === own, 'logo uploaded to our own storage (direct posting / admin) is shown')

// Source job-site CDNs are never used as a company logo (incl. the site's own default logo).
assert(companyLogoUrl('https://cdn1.vieclam24h.vn/images/employer_avatar/vieclam24h_logo_customer_default.jpg') === undefined, 'vieclam24h default logo is blocked')
assert(companyLogoUrl('https://cdn1.vieclam24h.vn/company-logo-medium/032020/5e94.w-128.h-128.png?v=22051') === undefined, 'real company logo hosted on the source CDN is blocked too')
assert(companyLogoUrl('https://scontent.xx.fbcdn.net/v/t39/photo.jpg') === undefined, 'Facebook post images are not logos')
assert(companyLogoUrl('https://other-project.supabase.co/storage/v1/object/public/x.png') === undefined, 'another Supabase project is not ours')
assert(companyLogoUrl('https://edhuesdnuxlbcfephutq.supabase.co/rest/v1/local_jobs') === undefined, 'non-storage path on our host is not an image')
assert(companyLogoUrl('http://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/a.png') === undefined, 'plain http is rejected')
assert(companyLogoUrl(undefined) === undefined && companyLogoUrl('') === undefined && companyLogoUrl('not a url') === undefined, 'empty or invalid values fall back')

console.log('companyLogo.test.ts: source-site logo blocking assertions passed')
