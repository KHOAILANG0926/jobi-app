// 업종 대표 사진 주소(Lee 2026-11-02: 비는 로고 자리만 채움)
import { industryPhotoUrl } from './cardPhoto.ts'
function eq(got: unknown, want: unknown, name: string) { if (got !== want) throw new Error(`${name}: ${got} ≠ ${want}`) }
eq(industryPhotoUrl('am_thuc_do_uong'), '/images/industry/am_thuc_do_uong.jpg', 'known category')
eq(industryPhotoUrl('other'), '/images/industry/khac.jpg', 'legacy/unknown → khac')
eq(industryPhotoUrl(undefined), '/images/industry/khac.jpg', 'missing → khac')
console.log('cardPhoto ok')
