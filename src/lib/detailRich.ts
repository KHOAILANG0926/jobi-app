// 상세 ④ 꾸민 본문(DetailRich)의 순수 판정 — 줄 아이콘·채용 절차 단계. 글자는 바꾸지 않고 고르기만 한다.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

export type RichIcon = 'operate' | 'pack' | 'check' | 'clean' | 'time' | 'drive' | 'cash' | 'serve' | 'cook' | 'people' | 'chat' | 'mail' | 'phone' | 'dot'
const RULES: [RegExp, RichIcon][] = [
  [/\b(?:email|e-mail|gmail)\b|@/, 'mail'],
  [/dong goi|lap rap|dong thung|xep hang|boc xep/, 'pack'],
  [/kiem tra|phan loai|kiem hang|\bqc\b/, 'check'],
  [/ve sinh|don dep|gon gang|lau don/, 'clean'],
  [/\b(?:dien thoai|sdt|hotline)\b|(?:\+?84|\b0)\d[\d .-]{7,}/, 'phone'],
  [/\bzalo\b|nhan tin|lien he/, 'chat'],
  [/tang ca|lam them|ca dem|ca ngay|gio lam|thoi gian/, 'time'],
  [/lai xe|giao hang|shipper|tai xe|van chuyen/, 'drive'],
  [/thu ngan|ban hang|thanh toan|luong|thuong|phu cap/, 'cash'],
  [/phuc vu|chay ban|order|rua bat/, 'serve'],
  [/nau an|\bbep\b|che bien mon|pha che/, 'cook'],
  [/can tuyen|tuyen dung|ung vien|nhan vien moi|dao tao/, 'people'],
  [/van hanh|may moc|san xuat|ep nhua|cnc|dung may/, 'operate'],
]
export function richLineIcon(line: string, _section?: string): RichIcon {
  const t = fold(line)
  return RULES.find(([re]) => re.test(t))?.[1] ?? 'dot'
}

/** 채용 절차 단계: 원문 줄에 나오는 단계 낱말만, 나온 순서대로(2개 이상일 때 화살표로 보여 줌). 이름은 원문 낱말 그대로의 기본형. */
const STEPS: [RegExp, string][] = [
  [/nop (?:ho so|cv)|gui (?:ho so|cv)|ung tuyen/, 'Nộp hồ sơ'],
  [/lien he/, 'Liên hệ'],
  [/tu van/, 'Tư vấn'],
  [/phong van/, 'Phỏng vấn'],
  [/kham suc khoe/, 'Khám sức khỏe'],
  [/nhan viec|di lam ngay|bat dau lam/, 'Nhận việc'],
]
export function richProcessSteps(lines: string[]): string[] {
  const t = fold(lines.join(' '))
  return STEPS.map(([re, label]) => ({ label, at: t.search(re) })).filter((s) => s.at >= 0).sort((a, b) => a.at - b.at).map((s) => s.label)
}

/** 상여 알약: 급여·수당 칸(04) 원문 줄 중 대문자 홍보 줄이면서 위 급여 금액만 다시 쓴 줄이 아닌 것(원문 그대로, 1개). */
export function richPill(lines: string[], topAmounts: number[], amountsOf: (s: string) => number[]): string | undefined {
  return lines.map((l) => l.replace(/^\s*[-•*]\s+/, '').trim()).find((l) => {
    const letters = l.replace(/[^\p{L}]/gu, '')
    if (letters.length < 4 || letters !== letters.toLocaleUpperCase('vi')) return false
    const a = amountsOf(l)
    return a.length > 0 && !a.some((x) => topAmounts.includes(x))
  })
}
