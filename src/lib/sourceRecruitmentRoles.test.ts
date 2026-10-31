import { sourceRecruitmentRoles } from './sourceRecruitmentRoles.ts'
import { detailSections } from './jobDetailSections.ts'

function assert(ok: boolean, message: string) { if (!ok) throw new Error(message) }
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

const roles = sourceRecruitmentRoles(highlands)
assert(JSON.stringify(roles.roles) === JSON.stringify([
  'Nhân viên Bán hàng (Sales)',
  'Nhân viên Pha chế (Barista)',
  'Nhân viên Phục vụ (Server)',
]), 'Highlands three real recruitment roles')
assert(JSON.stringify(roles.workTypes) === JSON.stringify(['Fulltime', 'Parttime']), 'Fulltime / Parttime from source')
assert(sourceRecruitmentRoles('Pha chế thức uống\nChăm sóc khách hàng').roles.length === 0, 'no inferred roles without source')
const sections = detailSections(highlands)
assert(sections.preserved, 'original evidence preserved')
assert(!sections.sections.find(s => s.key === '01')?.lines.some(s => s.includes('Nhân viên Pha chế')), 'roles are not classified as actual job duties')
assert(!!sections.sections.find(s => s.key === '07')?.lines.some(s => s.includes('Nhân viên Pha chế')), 'role source line preserved in original supplemental text')
assert(!sections.sections.flatMap(s => s.lines).some(s => /^(?:Hotline\/Zalo:|ĐỊA CHỈ LÀM VIỆC:|📩 Cách nộp hồ sơ:)$/.test(s)), 'no empty labels')
console.log('sourceRecruitmentRoles: Highlands verified')
