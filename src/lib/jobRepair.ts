/**
 * 자동 수리(회사 이름만) — 2026-11-01 Lee: "막는 것만으론 안 된다. 계속 틀리는 상태에서 공개가 안 되는 게 문제".
 * 검사표가 실패한 칸만 AI가 원문에서 올바른 값을 찾아 제안하고, 기계가 확인한 값만 고친다.
 * - AI는 원문(source_text·ocr_text)에 글자 그대로 있는 값만 낼 수 있다(지어낸 값은 버림). DB 규칙(R5 등)이 한 번 더 막는다.
 * - 항목 이름표("Vị trí" 등)·빈 값·원래 값과 같은 값은 버린다.
 * - 고칠 수 없으면 아무것도 바꾸지 않는다(비공개 유지 → 관리자 확인 목록). 같은 유형이 쌓이면 코드 규칙으로 옮긴다.
 */
import { bare } from './jobDetailSections.ts'

/** 검사 항목 키 → 고칠 칸. 여기에 없는 항목은 자동 수리 대상이 아니다. */
// 급여는 자동 수리 대상이 아니다: 급여 읽기·쓰기는 salaryReader.readSalary + scripts/ocr/salary-fill.mjs 한 곳(R2 #753, Lee 2026-11-01 "읽는 규칙을 하나로") — AI 제안 값으로 따로 쓰지 않는다.
export const REPAIRABLE: Record<string, 'company'> = { company: 'company' }

const LABEL = /^(?:vi tri|dia diem|muc luong|thoi gian|yeu cau|lien he|quyen loi|bang tin|tuyen dung|nha tuyen dung facebook)$/

export interface RepairInput { id: number; title?: string | null; company?: string | null; salary?: string | null; source_text?: string | null; ocr_text?: string | null }
export interface RepairProposal { field: 'company'; from: string; to: string; evidence: string }

const FIELD_HELP: Record<'company', string> = {
  company: 'Tên công ty / cửa hàng / thương hiệu đang tuyển dụng (không phải nhãn mục như "Vị trí", "Địa điểm").',
}

export function buildRepairPrompt(job: RepairInput, fields: Array<'company'>): string {
  const source = [job.source_text, job.ocr_text].filter(Boolean).join('\n---\n')
  return [
    'Bạn sửa dữ liệu tin tuyển dụng. Chỉ được chép NGUYÊN VĂN một đoạn có trong "TIN GỐC". Không được tự viết, dịch, sửa chính tả hay ghép từ nhiều chỗ.',
    'Nếu không tìm thấy, trả về chuỗi rỗng.',
    ...fields.map((f) => `- ${f}: ${FIELD_HELP[f]} Giá trị hiện tại (sai): "${String(job[f] ?? '')}"`),
    `Tiêu đề: ${job.title ?? ''}`,
    'TIN GỐC:', source,
    `Trả lời CHỈ bằng JSON: {${fields.map((f) => `"${f}": {"value": "...", "evidence": "dòng gốc chứa giá trị"}`).join(', ')}}`,
  ].join('\n')
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

/** AI 답 검사: 원문에 글자 그대로 있는 값만, 이름표·빈 값·원래 값 제외. */
export function guardRepair(job: RepairInput, fields: Array<'company'>, answer: unknown): { proposals: RepairProposal[]; rejected: string[] } {
  const source = norm([job.source_text, job.ocr_text].filter(Boolean).join('\n'))
  const proposals: RepairProposal[] = []
  const rejected: string[] = []
  const a = (answer && typeof answer === 'object' ? answer : {}) as Record<string, { value?: unknown; evidence?: unknown } | undefined>
  for (const f of fields) {
    const value = String(a[f]?.value ?? '').trim()
    const evidence = String(a[f]?.evidence ?? '').trim()
    const from = String(job[f] ?? '').trim()
    if (!value) { rejected.push(`${f}: 값 없음`); continue }
    if (!source.includes(norm(value))) { rejected.push(`${f}: 원문에 없는 값 "${value}"`); continue }
    if (LABEL.test(bare(value))) { rejected.push(`${f}: 항목 이름표 "${value}"`); continue }
    if (norm(value) === norm(from)) { rejected.push(`${f}: 원래 값과 같음`); continue }
    if (value.length > 120) { rejected.push(`${f}: 너무 김`); continue }
    proposals.push({ field: f, from, to: value, evidence: source.includes(norm(evidence)) ? evidence : value })
  }
  return { proposals, rejected }
}
