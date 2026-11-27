import { jobRoleInfo, jobCategories, categoryForOccupation } from './jobRoles.ts'
import { roleTitles } from './jobRolePresentation.ts'
import { filterAndSortJobs, DEFAULT_JOB_SEARCH_PARAMS } from './jobSearch.ts'
import { jobGroupCodes, matchesOccupationGroups, occupationGroupsInJobs } from './occupationGroups.ts'
import { mainCardJobs } from './mainJobCards.ts'
import type { Job } from '../types/job.ts'

// 복수 직무 검색(2026-11-27 Lee): 확인된 모든 모집 직무로 찾고, 같은 공고는 한 번만 나온다. 운영 공개 공고의 실제 상세요강(6337·5994·5368)으로 고정.
const assert = {
  equal(actual: unknown, expected: unknown, note = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${note}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
  },
  ok(v: unknown, note = '') { if (!v) throw new Error(`${note}: falsy`) },
}

const D6337 = "Công việc\nVỊ TRÍ:\n3 Nam & Nữ Phục Vụ : 7tr5~ 12tr\n2 Nữ oder : 8tr~11tr + tip\n1 Nam Làm Bếp : 8tr5 ~ 14tr\n2 Cô Tạp Vụ : 7 - 8tr\n+500k phụ cấp\nQuyền lợi\nHỖ TRỢ ĂN Ở ( phòng riêng,đầy đủ điều hòa nóng lạnh)\nQuy trình tuyển dụng\nSdt: 0833.210.308\nThông tin khác\nMỲ CAY YAGAMI ĐANG TUYỂN NHÂN VIÊN\nĐịa chỉ : Lê Đức Thọ - Nam Từ Liêm - Hà Nội"
const D5994 = "Công việc\nCác vị trí tuyển dụng:\n1. Quản lý giao hàng lắp đặt\n2. Nhân viên giao hàng kiêm lắp đặt sản phẩm\n3. Nhân viên Bảo hành\n4. Nhân viên lái xe\n5. Nhân viên bán hàng\nYêu cầu chung:\nNam/Nữ, từ 18 tuổi trở lên\nThu nhập\nThu nhập hấp dẫn, từ 10–15 triệu/tháng tùy vị trí và năng lực\nQuyền lợi\nHưởng đầy đủ BHXH, BHYT, BHTN theo quy định\nQuy trình tuyển dụng\nMs. Hải Anh – 037 261 9126\nHai Anh Anh\nThông tin khác\nHỆ THỐNG SIÊU THỊ ĐIỆN MÁY MEDIAMART TUYỂN DỤNG – KHU VỰC BẮC NINH\nLàm việc tại các trung tâm:\n- CN Bắc Ninh: Số 37 Đường Lý Thái Tổ, P. Võ Cường, TP. Bắc Ninh\n- CN Từ Sơn: Đường Trần Phú, Phường Từ Sơn, Thành phố Bắc Ninh, Việt Nam\n- Quế Võ: Khu phố Mao Dộc, Phường Phương Liễu , Tỉnh B"
const D5368 = "Công việc\nVỊ TRÍ CÔNG VIỆC: Nhân viên bảo vệ (Kho, nhà máy, văn phòng, công trình, trung tâm thương mại,...)\nYêu cầu\nNam / Nữ độ tuổi từ 18 – 60 tuổi.\nCó sức khỏe tốt, trung thực, trách nhiệm.\nKHÔNG yêu cầu kinh nghiệm – Nhận việc sẽ được đào tạo nghiệp vụ bài bản từ đầu.\nHồ sơ đơn giản: Sơ yếu lý lịch, CCCD công chứng, Giấy khám sức khỏe, Bằng cấp/chứng chỉ (nếu có).\nThời gian làm việc\nTHỜI GIAN "

// 직무 목록: 6337은 '인원 + 직무 : 금액' 줄 4개(인원 3·2·1·2), 5994는 'Các vị trí tuyển dụng:' 아래 번호 줄 5개, 5368은 직무 1개라 복수 직무 아님.
assert.equal(roleTitles(D6337).map((r) => r.count), [3, 2, 1, 2], '6337 role counts')
assert.equal(roleTitles(D5994).length, 5, '5994 numbered role list')
assert.equal(roleTitles(D5368), [], '5368 single role is not a multi-role posting')

// 대표 직무: 인원이 많은 서빙(5131)이 대표, 잡일(9112)도 모집 직무로 남는다. 저장된 대표 코드(9112)는 지워지지 않는다.
const i6337 = jobRoleInfo({ description: D6337, occupationCode: '9112' })
assert.equal(i6337.primaryRoleCode, '5131', '6337 representative role = most headcount')
assert.ok(i6337.roleCodes.includes('5131') && i6337.roleCodes.includes('9112'), '6337 keeps every confirmed role')
// 직무가 1개면 저장된 코드 그대로(식당 청소원도 청소원, 공장 경비원도 경비원 — 업체로 바꾸지 않는다).
assert.equal(jobRoleInfo({ description: D5368, occupationCode: '540' }), { roleCodes: ['540'], primaryRoleCode: '540' }, 'single role unchanged')
// 5994: 배송·운전·판매·AS가 모두 모집 직무다.
const i5994 = jobRoleInfo({ description: D5994, occupationCode: '8322' })
assert.ok(i5994.roleCodes.includes('8322') && i5994.roleCodes.includes('5223'), '5994 delivery driver and sales both searchable')

assert.equal(categoryForOccupation('5131'), 'am_thuc_do_uong')
assert.equal(categoryForOccupation('9112'), 'dich_vu')
assert.equal(categoryForOccupation(undefined), undefined)

// 검색·필터·칩: 비대표 직무로도 찾히고 공고는 한 번만 나온다.
const mk = (id: string, category: Job['category'], occupationCode: string, description: string): Job => ({ id, title: id, company: id, category, occupationCode, salary: '10 triệu', location: 'Bắc Ninh', hours: '', employerPhone: '', description, ...jobRoleInfo({ description, occupationCode }) }) as unknown as Job
const j6337 = mk('sb-6337', 'dich_vu', '9112', D6337)
const j5994 = mk('sb-5994', 'lai_xe_giao_hang', '8322', D5994)
const j5368 = mk('sb-5368', 'dich_vu', '540', D5368)
const jobs = [j6337, j5994, j5368]
assert.equal(jobCategories(j6337).sort(), ['am_thuc_do_uong', 'dich_vu'], '6337 categories from all roles')
const byCat = (cat: string) => filterAndSortJobs(jobs, { ...DEFAULT_JOB_SEARCH_PARAMS, category: cat as never }, new Map()).map((j) => j.id)
assert.equal(byCat('am_thuc_do_uong'), ['sb-6337'], '6337 found by restaurant role')
assert.equal(byCat('dich_vu'), ['sb-6337', 'sb-5368'], '6337 still found by its cleaning role, once')
assert.equal(byCat('quan_ly_ban_hang').includes('sb-5994'), true, '5994 found by sales role')
assert.equal(filterAndSortJobs(jobs, { ...DEFAULT_JOB_SEARCH_PARAMS, category: 'dich_vu', subcategory: 'x' }, new Map()), [], 'subcategory stays on the representative category')
assert.equal(matchesOccupationGroups(j6337, ['51']) && matchesOccupationGroups(j6337, ['91']), true, 'group filter matches any role')
assert.equal(jobGroupCodes(j6337).sort(), ['51', '91'], '6337 groups once each')
const groups = occupationGroupsInJobs(jobs)
assert.equal(groups.find((g) => g.code === '91')?.count, 1, 'chip counts the posting once per group')
assert.equal(mainCardJobs([j6337, j6337]).length <= 1, true, 'never listed twice')
// 코드 '5'(Wallace 등 업무 미기재 가게 공고)는 category를 코드로 다시 계산하지 않는다 — 음식점이 서비스 검색에 끼지 않는다.
assert.equal(jobCategories({ category: 'am_thuc_do_uong', roleCodes: ['5'] }), ['am_thuc_do_uong'], "code '5' keeps stored category")
console.log('jobRoles: multi-role search, chips and no-duplicate checks passed')
