import { describe, it, expect } from 'vitest'
import { sourceRecruitmentRoles } from './sourceRecruitmentRoles'
import { detailSections } from './jobDetailSections'

const highlands = `[source:facebook] 🎉 HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI 🎉
📍 Khu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh
🏠 Địa điểm: Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh
🔎 Vị trí tuyển dụng:
• Nhân viên Bán hàng (Sales)  Fulltime- partime
• Nhân viên Pha chế (Barista) Fulltime- partime
• Nhân viên Phục vụ (Server) Fulltime- partime
💎 Quyền lợi:
• Thu nhập cạnh tranh
📩 Cách nộp hồ sơ:
Hotline/Zalo:
ĐỊA CHỈ LÀM VIỆC:`

describe('source-backed Facebook recruitment classification', () => {
  it('separates three real roles from mixed Fulltime/Parttime without inventing job duties', () => {
    const result = sourceRecruitmentRoles(highlands)
    expect(result.roles).toEqual(['Nhân viên Bán hàng (Sales)', 'Nhân viên Pha chế (Barista)', 'Nhân viên Phục vụ (Server)'])
    expect(result.workTypes).toEqual(['Fulltime', 'Parttime'])
  })
  it('does not infer roles from a non-Facebook job or free-form duty', () => {
    expect(sourceRecruitmentRoles('Pha chế thức uống\nChăm sóc khách hàng').roles).toEqual([])
  })
  it('does not render content-free headings as detail text and preserves original accounting', () => {
    const result = detailSections(highlands)
    expect(result.preserved).toBe(true)
    expect(result.sections.flatMap(s => s.lines)).not.toContain('Hotline/Zalo:')
    expect(result.sections.flatMap(s => s.lines)).not.toContain('ĐỊA CHỈ LÀM VIỆC:')
    expect(result.sections.flatMap(s => s.lines)).not.toContain('📩 Cách nộp hồ sơ:')
  })
})
