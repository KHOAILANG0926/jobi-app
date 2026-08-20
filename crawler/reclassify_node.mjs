// Node port of classifier.py (kept in sync manually) — used because this
// environment has no working Python interpreter. Mirrors classify() 1:1.
import fs from 'fs'

const env = {}
for (const line of fs.readFileSync(new URL('.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const SUPABASE_URL = env.SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

function norm(text) {
  text = (text || '').toLowerCase()
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '')
  text = text.replace(/đ/g, 'd')
  text = text.replace(/[^\w\s&]/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

const BLACKLIST = new RegExp([
  'senior developer', 'lead developer', 'software engineer',
  'devops', 'data scientist', 'machine learning', 'ai engineer',
  'full.?stack', 'backend developer', 'frontend developer',
  'mobile developer', 'android developer', 'ios developer',
  'system architect', 'cloud architect',
  'giam doc', 'director', 'ceo', 'cfo', 'cto', 'coo',
  'truong phong', 'pho giam doc',
  'ke toan truong', 'giam doc tai chinh', 'chief financial',
  'kiem toan vien', 'auditor',
  'luat su', 'bac si', 'duoc si', 'bac si chuyen khoa',
  'moi gioi bat dong san', 'kinh doanh bat dong san',
  'bat dong san cao cap', 'phan phoi du an',
  'giang vien dai hoc', 'tien si', 'thac si giao duc',
].join('|'))

const DELIVERY = new RegExp([
  'giao hang', 'shipper', 'tai xe', 'lai xe', 'xe om', 'grab\\b',
  'be xe', 'xe tai', 'xe container', 'xe dau keo', 'van chuyen',
  'nhan vien giao hang', 'nhan vien phat hang', 'nhan vien van chuyen',
  'giao nhan', 'boc xep', 'phu kho\\b', 'thu kho\\b', 'nhan vien kho\\b',
  'logistic', 'kho van\\b', 'last.?mile', 'delivery driver',
].join('|'))

// FIXED version (matches the updated classifier.py)
const CLEANING = new RegExp([
  'nhan vien ve sinh', 'cong nhan ve sinh', 'to ve sinh\\b', 'doi ve sinh\\b',
  've sinh cong nghiep', 've sinh van phong', 've sinh toa nha', 've sinh moi truong',
  'giup viec', 'lao cong\\b', 'don dep nha', 'tap vu\\b',
  'trong tre', 'bao mau', 'cham soc nguoi cao tuoi', 'cham soc tre',
  'dich vu don dep', 'dich vu nha', 'housekeeper', 'janitor', 'cleaner\\b',
].join('|'))

const FACTORY = new RegExp([
  'nha may\\b', 'kcn\\b', 'khu cong nghiep',
  'cong nhan san xuat', 'cong nhan nha may', 'cong nhan\\b',
  'nhan vien san xuat', 'nhan vien dong goi', 'cong nhan lap rap',
  'dong goi\\b', 'lap rap\\b', 'cat may\\b', 'may mac\\b', 'det\\b', 'gia cong\\b',
  'han xi\\b', 'han dien\\b', 'tho han\\b',
  'thiet bi san xuat', 'co khi chinh xac', 'co khi\\b',
  'lao dong pho thong\\b', 'cong nhan pho thong\\b',
  'linh kien dien tu', 'kiem tra chat luong san pham',
  'san xuat linh kien', 'san xuat hang hoa',
  'xuong san xuat', 'khu san xuat',
].join('|'))

const CAFE = new RegExp([
  'ca phe\\b', 'cafe\\b', 'coffee\\b', 'tra sua\\b', 'milk tea', 'boba\\b', 'tra sua',
  'pha che\\b', 'barista\\b', 'bartender\\b', 'mixologist',
  'highlands\\b', 'starbucks', 'phuc long', 'gong cha',
  'the coffee house', 'trung nguyen', 'passio\\b', 'cong ca phe',
  'bingsu', 'kem tuoi', 'dessert\\b', 'yogurt', 'tran chau',
  'nhan vien pha che', 'nhan vien quan ca phe', 'nhan vien cafe',
].join('|'))

const RESTAURANT = new RegExp([
  'nha hang\\b', 'quan an\\b', 'quan nhau', 'beer club', 'bia hoi',
  'hai san\\b', 'lau\\b', 'buffet\\b', 'bbq\\b', 'nuong\\b', 'dim sum',
  'jollibee', 'kfc\\b', 'lotteria', 'mcdonald', 'burger king', 'pizza\\b', 'subway\\b',
  'haidilao', 'pho\\b', 'bun\\b', 'com rang', 'an uong', 'am thuc',
  'phuc vu ban', 'phuc vu nha hang', 'phuc vu khach', 'nhan vien phuc vu',
  'phu bep', 'bep chinh', 'bep truong', 'dau bep', 'nau an',
  'fb\\b', 'fnb\\b', 'f&b', 'f and b', 'food.?beverage',
  'rua bat', 'rua chen', 'don ban', 'quan ly nha hang',
  'nhan vien bep', 'nhan vien nha hang',
].join('|'))

const RETAIL = new RegExp([
  'ban hang\\b', 'thu ngan', 'cua hang\\b', 'sieu thi\\b',
  'winmart', 'vinmart', 'circle k', '7.eleven', 'familymart', 'ministop', 'gs25\\b',
  'tap hoa\\b', 'showroom\\b', 'dai ly\\b',
  'ban le\\b', 'ban si\\b', 'phan phoi\\b',
  'nhan vien ban hang', 'sale\\b', 'nhan vien cua hang', 'quan ly cua hang',
  'samsung store', 'apple store', 'dien may', 'dien thoai di dong',
  'wincommerce', 'coopmart', 'bsmart', 'co.op',
  'nhan vien thi truong', 'nhan vien kinh doanh ban le',
  'nhan vien phat trien thi truong ban le',
].join('|'))

const OFFICE = new RegExp([
  'nhan vien nhap lieu', 'nhap lieu\\b', 'data entry',
  'tong dai\\b', 'cskh\\b', 'cham soc khach hang\\b', 'hotline\\b',
  'tu van khach hang\\b', 'tu van san pham\\b', 'inbound\\b',
  'telesale\\b', 'telesales\\b', 'tele\\b',
  'ho tro van phong', 'tro ly van phong', 'nhan vien van phong',
  'admin ban hang', 'truc page\\b', 'quan ly page\\b', 'cham soc fanpage',
  'nhan vien hanh chinh\\b', 'thu ky\\b', 'le tan\\b', 'receptionist',
  'nhan vien dat hang', 'xu ly don hang', 'order\\b',
  'part.?time van phong', 'lam them van phong', 'lam them buoi',
  'nhan vien xuat nhap khau van phong', 'nhan vien bao cao',
  'nhan vien marketing online\\b', 'content\\b', 'social media part',
  'nhan vien ke toan thue\\b', 'ke toan thue\\b', 'ke toan\\b',
  'hanh chinh nhan su\\b', 'nhan su\\b',
].join('|'))

function classify(title, company = '', description = '') {
  const combined = norm(`${title} ${company} ${(description || '').slice(0, 300)}`)
  const titleCo = norm(`${title} ${company}`)

  if (BLACKLIST.test(titleCo)) return 'other'

  if (DELIVERY.test(combined)) return 'delivery'
  if (CLEANING.test(combined)) return 'cleaning'
  if (FACTORY.test(combined)) return 'factory'
  if (CAFE.test(combined)) return 'cafe'
  if (RESTAURANT.test(combined)) return 'restaurant'
  if (RETAIL.test(combined)) return 'retail'
  if (OFFICE.test(combined)) return 'office'

  if (FACTORY.test(titleCo)) return 'factory'
  if (CAFE.test(titleCo)) return 'cafe'
  if (RESTAURANT.test(titleCo)) return 'restaurant'
  if (RETAIL.test(titleCo)) return 'retail'
  if (OFFICE.test(titleCo)) return 'office'
  if (DELIVERY.test(titleCo)) return 'delivery'
  if (CLEANING.test(titleCo)) return 'cleaning'

  return 'other'
}

async function fetchAllJobs() {
  const all = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/local_jobs?select=id,title,company,category,description&order=id.asc&offset=${page * pageSize}&limit=${pageSize}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const batch = await res.json()
    all.push(...batch)
    if (batch.length < pageSize) break
    page++
  }
  return all
}

const DRY_RUN = process.argv.includes('--dry-run')

const jobs = await fetchAllJobs()
console.log(`총 ${jobs.length}개 공고`)

const updates = []
for (const j of jobs) {
  const oldCat = j.category || 'other'
  const desc = j.description || ''
  const descClean = desc.includes(']') ? desc.split(']').slice(1).join(']').trim() : desc
  const newCat = classify(j.title || '', j.company || '', descClean)
  if (newCat !== oldCat) {
    updates.push({ id: j.id, old: oldCat, new: newCat, title: j.title, company: j.company })
  }
}

console.log(`변경 대상: ${updates.length}개`)
const byPair = {}
for (const u of updates) {
  const k = `${u.old} -> ${u.new}`
  byPair[k] = (byPair[k] || 0) + 1
}
for (const [k, n] of Object.entries(byPair).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${n}개`)
}
console.log('\n샘플 (최대 20개):')
for (const u of updates.slice(0, 20)) {
  console.log(`  #${u.id} [${u.old} -> ${u.new}] ${u.title} | ${u.company}`)
}

if (DRY_RUN) {
  console.log('\n--dry-run: DB 업데이트 건너뜀')
  process.exit(0)
}

let done = 0
for (const u of updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/local_jobs?id=eq.${u.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category: u.new }),
  })
  done++
  if (done % 50 === 0) console.log(`  업데이트: ${done}/${updates.length}`)
}
console.log(`완료: ${updates.length}개 업데이트`)
