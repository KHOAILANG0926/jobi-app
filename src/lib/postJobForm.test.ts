import { normalizeVnPhone, composeSalary, composeHours, composeAge, composeHires, composeLocation, composeDescription } from './postJobForm.ts'
import { detailSections } from './jobDetailSections.ts'

const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }

// 전화번호 형식
eq(normalizeVnPhone('0365 447 485'), '0365447485', 'mobile with spaces')
eq(normalizeVnPhone('+84 365 447 485'), '0365447485', '+84 prefix')
eq(normalizeVnPhone('08.778.807.56'), '0877880756', 'dots')
eq(normalizeVnPhone('0222 3820 123'), '02223820123', 'landline 02 + 9')
eq(normalizeVnPhone('123'), null, 'too short')
eq(normalizeVnPhone('0123456789'), null, 'bad mobile prefix')
eq(normalizeVnPhone('abc'), null, 'letters')

// 급여·시간·나이·인원·주소
eq(composeSalary('30.000 đ', 'hour', false), { salary: '30.000 đ/giờ', salaryPeriod: 'hour' }, 'salary + unit')
eq(composeSalary('', 'month', true), { salary: 'Thỏa thuận' }, 'negotiable')
eq(composeSalary('', 'month', false), null, 'salary required')
eq(composeHours('08:00', '17:00', '60'), '08:00 - 17:00 (nghỉ 60 phút)', 'hours with break')
eq(composeHours('08:00', '', ''), null, 'hours required')
eq(composeAge('18', '45'), '18 - 45 tuổi', 'age range')
eq(composeAge('', ''), undefined, 'age optional')
eq(composeAge('45', '18'), null, 'age reversed')
eq(composeHires('8', false, 'Nam/nữ', '5', '3'), '8 người (Nam 5, nữ 3)', 'hires with gender split')
eq(composeHires('', true, '', '', ''), 'Chưa xác định', 'hires undecided')
eq(composeHires('', false, '', '', ''), null, 'hires required')
eq(composeLocation('33 Lý Thái Tổ', 'Phường Kinh Bắc', 'Tỉnh Bắc Ninh', ''), '33 Lý Thái Tổ, Phường Kinh Bắc, Tỉnh Bắc Ninh', 'address')
eq(composeLocation('', 'Phường Kinh Bắc', 'Tỉnh Bắc Ninh', ''), null, 'street required')

// 상세요강은 기존 상세 칸 제목으로 나뉘어야 한다(같은 화면 틀로 보이게).
const desc = composeDescription({ work: 'Lắp ráp linh kiện', overtime: '45k/giờ', environment: 'Nhà xưởng sạch', process: 'Phỏng vấn trực tiếp', benefitOther: '' })!
const keys = detailSections(desc).sections.map((s) => s.key)
eq(keys, ['01', '03', '05', '06'], 'description headings map to detail sections')
eq(composeDescription({ work: ' ', overtime: '', environment: '', process: '', benefitOther: '' }), null, 'work content required')
console.log('postJobForm: phone/salary/hours/age/hires/address/description helpers pass')
