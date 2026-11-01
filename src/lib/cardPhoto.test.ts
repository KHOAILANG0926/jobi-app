// 메인 카드 사진 고르기(Lee 2026-11-01 사람인 방식) — 포스터 먼저, 없으면 업종 사진
import { cardPhoto, industryPhotoUrl, benefitTags, deadlineLabel } from './cardPhoto.ts'
function eq(got: unknown, want: unknown, name: string) { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
const own = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/a.jpg'
eq(cardPhoto({ imageUrl: own, category: 'dich_vu' }), { url: own, kind: 'poster' }, 'own poster first')
eq(cardPhoto({ imageUrl: 'https://scontent.fbcdn.net/x.jpg', category: 'am_thuc_do_uong' }), { url: '/images/industry/am_thuc_do_uong.jpg', kind: 'industry' }, 'source CDN poster blocked → industry photo')
eq(cardPhoto({ category: 'san_xuat_xay_dung' }).url, '/images/industry/san_xuat_xay_dung.jpg', 'no poster → industry')
eq(industryPhotoUrl(undefined), '/images/industry/khac.jpg', 'unknown → khac')
eq(benefitTags({ dormitory: true, shuttleBus: false, mealProvided: true }), ['Ký túc xá', 'Bao ăn'], 'tags')
eq(deadlineLabel('2026-11-15'), '~15/11', 'date')
eq(deadlineLabel('Tuyển thường xuyên'), 'Thường xuyên', 'ongoing')
eq(deadlineLabel(''), null, 'none')
console.log('cardPhoto ok')
