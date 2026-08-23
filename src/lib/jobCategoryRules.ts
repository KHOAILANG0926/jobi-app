import type { Job, JobCategory } from '../types/job'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/đ/g, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const DELIVERY = /giao hang|shipper|tai xe|lai xe|xe om|grab\b|be xe|xe tai|xe container|xe dau keo|van chuyen|nhan vien giao hang|nhan vien phat hang|nhan vien van chuyen|giao nhan|boc xep|phu kho\b|thu kho\b|nhan vien kho\b|logistic|kho van\b|last.?mile|delivery driver/
const CLEANING = /nhan vien ve sinh|cong nhan ve sinh|to ve sinh\b|doi ve sinh\b|ve sinh cong nghiep|ve sinh van phong|ve sinh toa nha|ve sinh moi truong|giup viec|lao cong\b|don dep nha|tap vu\b|trong tre|bao mau|cham soc nguoi cao tuoi|cham soc tre|housekeeper|janitor|cleaner\b/
const FACTORY = /nha may\b|kcn\b|khu cong nghiep|cong nhan san xuat|cong nhan nha may|cong nhan\b|nhan vien san xuat|nhan vien dong goi|cong nhan lap rap|dong goi\b|lap rap\b|cat may\b|may mac\b|det\b|gia cong\b|han xi\b|han dien\b|tho han\b|thiet bi san xuat|co khi chinh xac|co khi\b|ky thuat bao tri|bao tri co dien|bao tri dien|bao tri may|co dien\b|ky thuat vien\b|nhan vien ky thuat|to truong ky thuat|van hanh may|lao dong pho thong\b|cong nhan pho thong\b|linh kien dien tu|kiem tra chat luong san pham|san xuat linh kien|san xuat hang hoa|xuong san xuat|khu san xuat/
const CAFE = /ca phe\b|cafe\b|coffee\b|tra sua\b|milk tea|boba\b|pha che\b|barista\b|bartender\b|mixologist|highlands\b|starbucks|phuc long|gong cha|the coffee house|trung nguyen|passio\b|cong ca phe|bingsu|kem tuoi|dessert\b|yogurt|tran chau|nhan vien pha che|nhan vien quan ca phe|nhan vien cafe/
const RESTAURANT = /nha hang\b|quan an\b|quan nhau|beer club|bia hoi|hai san\b|lau\b|buffet\b|bbq\b|nuong\b|dim sum|jollibee|kfc\b|lotteria|mcdonald|burger king|pizza\b|subway\b|haidilao|pho\b|bun\b|com rang|an uong|am thuc|phuc vu ban|phuc vu nha hang|phuc vu khach|nhan vien phuc vu|phu bep|bep chinh|bep truong|dau bep|nau an|fb\b|fnb\b|f&b|f and b|food.?beverage|rua bat|rua chen|don ban|quan ly nha hang|nhan vien bep|nhan vien nha hang/
const RETAIL = /ban hang\b|thu ngan|cua hang\b|sieu thi\b|winmart|vinmart|circle k|7.eleven|familymart|ministop|gs25\b|tap hoa\b|showroom\b|dai ly\b|ban le\b|ban si\b|phan phoi\b|nhan vien ban hang|\bsales?\b|nhan vien cua hang|quan ly cua hang|samsung store|apple store|dien may|dien thoai di dong|wincommerce|coopmart|bsmart|co.op|nhan vien thi truong|nhan vien kinh doanh ban le|nhan vien phat trien thi truong ban le|nhan vien kinh doanh\b|kinh doanh thi truong|phat trien thi truong|dai dien kinh doanh|tu van ban hang|sales executive|sales representative|ton thep|vat lieu xay dung|qua tang|hang nhap khau/
const OFFICE = /nhan vien nhap lieu|nhap lieu\b|data entry|tong dai\b|cskh\b|cham soc khach hang\b|hotline\b|tu van khach hang\b|tu van san pham\b|inbound\b|telesale\b|telesales\b|tele\b|ho tro van phong|tro ly van phong|nhan vien van phong|admin ban hang|truc page\b|quan ly page\b|cham soc fanpage|nhan vien hanh chinh\b|thu ky\b|le tan\b|receptionist|nhan vien dat hang|xu ly don hang|order\b|part.?time van phong|lam them van phong|lam them buoi|nhan vien xuat nhap khau van phong|nhan vien bao cao|nhan vien marketing online\b|content\b|social media part|nhan vien ke toan thue\b|ke toan thue\b|ke toan\b|hanh chinh nhan su\b|nhan su\b|tu van tuyen sinh|tuyen sinh\b|giao vu\b|nhan vien tu van|tu van vien|dieu phoi\b|van thu\b|tro ly\b|marketing\b/

export function classifyJobCategory(job: Pick<Job, 'title' | 'company' | 'description' | 'category'>): JobCategory {
  const combined = normalize(`${job.title} ${job.company} ${job.description.slice(0, 300)}`)
  const titleCompany = normalize(`${job.title} ${job.company}`)

  if (DELIVERY.test(combined)) return 'delivery'
  if (CLEANING.test(combined)) return 'cleaning'
  if (CAFE.test(combined)) return 'cafe'
  if (RESTAURANT.test(combined)) return 'restaurant'
  if (OFFICE.test(titleCompany)) return 'office'
  if (RETAIL.test(titleCompany)) return 'retail'
  if (FACTORY.test(combined)) return 'factory'
  if (RETAIL.test(combined)) return 'retail'
  if (OFFICE.test(combined)) return 'office'

  return job.category || 'other'
}
