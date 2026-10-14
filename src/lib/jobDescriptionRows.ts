// Preserve every non-empty description line unless it is a recognised heading,
// the repeated job title, or a safely confirmed salary/phone/address duplicate.
// Only description presentation is affected; no source/DB values are modified.
export type DescRowKey = 'duty' | 'preferred' | 'otherReq' | 'salary' | 'environment' | 'workplace' | 'contact' | 'unclassified'
export interface DescRow { key: DescRowKey; label: string; lines: string[] }
export interface DescriptionContext { salaryText?: string; contactPhone?: string; locationText?: string }
export const DESC_ROW_LABELS: Record<DescRowKey, string> = {
  duty: 'Nội dung công việc',
  preferred: 'Ưu tiên',
  otherReq: 'Yêu cầu khác',
  salary: 'Lương · Thu nhập',
  environment: 'Quyền lợi · Môi trường làm việc',
  workplace: 'Địa điểm bổ sung',
  contact: 'Thông tin liên hệ bổ sung',
  unclassified: 'Thông tin khác',
}
const ORDER: DescRowKey[] = ['duty', 'preferred', 'otherReq', 'salary', 'environment', 'workplace', 'contact', 'unclassified']
const foldHeading = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const stripBullet = (s: string) => s.replace(/^[•\-–*·]\s+/, '').trim()
function headingType(value: string): DescRowKey | undefined {
  const h = foldHeading(value.replace(/^##\s*/, '').replace(/:\s*$/, ''))
  if (/^(mo ta cong viec|cong viec|nhiem vu|trach nhiem)$/.test(h)) return 'duty'
  if (/^(yeu cau|yeu cau tuyen dung|doi tuong|tieu chuan)$/.test(h)) return 'otherReq'
  if (/^(luong|luong thuong|luong va phuc loi|thu nhap|muc luong)$/.test(h)) return 'salary'
  if (/^(quyen loi|phuc loi|che do|moi truong)$/.test(h)) return 'environment'
  if (/^(dia diem lam viec|dia chi lam viec|noi lam viec)$/.test(h)) return 'workplace'
  if (/^(lien he|thong tin lien he|so dien thoai)$/.test(h)) return 'contact'
  return undefined
}
function phoneKey(s: string): string | undefined {
  const digits = s.replace(/[^\d]/g, '')
  if (!/^\d{9,11}$/.test(digits)) return undefined
  if (digits.startsWith('84') && digits.length === 11) return '0' + digits.slice(2)
  // Older Vietnamese 11-digit mobile prefixes are compared only; the rendered source stays original.
  if (digits.length === 11 && digits.startsWith('0')) {
    const prefixes: Record<string, string> = { '0162':'032','0163':'033','0164':'034','0165':'035','0166':'036','0167':'037','0168':'038','0169':'039','0120':'070','0121':'079','0122':'077','0126':'076','0128':'078','0123':'083','0124':'084','0125':'085','0127':'081','0129':'082','0186':'056','0188':'058','0199':'059' }
    const mapped = prefixes[digits.slice(0, 4)]
    if (mapped) return mapped + digits.slice(4)
  }
  return digits
}
function isPurePhoneLine(line: string, phone: string): boolean {
  const match = line.match(/^(?:(?:sđt|sdt|điện thoại|số điện thoại|phone|tel|liên hệ|zalo)\s*[:：-]?\s*)?(\+?[\d\s().-]+)$/iu)
  return !!match && !!phoneKey(match[1]) && phoneKey(match[1]) === phoneKey(phone)
}
// Accent-sensitive, exact comparison only. Never strip street/building/entrance differences.
function exactAddress(s: string): string {
  return s.normalize('NFC').toLocaleLowerCase('vi').replace(/\bphường\b/giu,'p.').replace(/\bkhu công nghiệp\b/giu,'kcn').replace(/[.,]+/g,' ').replace(/\s+/g,' ').trim()
}
function isPureAddressLine(line: string, location: string): boolean {
  const withoutLabel = line.replace(/^(?:địa điểm làm việc|địa chỉ làm việc|địa chỉ)\s*[:：]\s*/iu,'')
  return exactAddress(withoutLabel) === exactAddress(location)
}
// No salary arithmetic or fuzzy range equivalence. Both pure salary AND an exact, explicitly
// comparable structured salary string must match; otherwise retain the original line.
function isPureDuplicateSalary(line: string, salary: string): boolean {
  const text = line.replace(/^(?:mức lương|lương|thu nhập)\s*[:：]\s*/iu,'').trim()
  if (/[+;]|chuyên cần|phụ cấp|thưởng|ăn ca|xăng xe|xe đưa đón/iu.test(text)) return false
  if (!/^\d[\d.,\s]*(?:tr|triệu|k|đ|vnd)?(?:\s*[-–]\s*\d[\d.,\s]*(?:tr|triệu|k|đ|vnd)?)?(?:\s*\/\s*(?:ngày|tháng|giờ|ca))?$/iu.test(text)) return false
  return text.toLocaleLowerCase('vi').replace(/\s+/g,'') === salary.trim().toLocaleLowerCase('vi').replace(/\s+/g,'')
}
export function descriptionRows(description: string | null | undefined, title: string, context: DescriptionContext = {}): DescRow[] {
  const text = (description ?? '').trim()
  if (!text || /^https?:\/\/\S+$/i.test(text)) return []
  const titleKey = foldHeading(title)
  const buckets = Object.fromEntries(ORDER.map((key) => [key, [] as string[]])) as Record<DescRowKey, string[]>
  let current: DescRowKey = 'unclassified'
  for (const rawLine of text.replace(/^\s*\[source:[^\]]*\]\s*/i, '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const heading = headingType(line)
    if (heading) { current = heading; continue }
    if (titleKey && foldHeading(line) === titleKey) continue
    // A heading-like unknown line is content: keep it, never silently discard it.
    const body = stripBullet(line)
    if (!body) continue
    if (context.salaryText && isPureDuplicateSalary(body, context.salaryText)) continue
    if (context.contactPhone && isPurePhoneLine(body, context.contactPhone)) continue
    if (context.locationText && isPureAddressLine(body, context.locationText)) continue
    const key: DescRowKey = current === 'otherReq' && /^ưu tiên\b/iu.test(body) ? 'preferred' : current
    buckets[key].push(body)
  }
  return ORDER.filter((k) => buckets[k].length).map((k) => ({ key: k, label: DESC_ROW_LABELS[k], lines: buckets[k] }))
}
