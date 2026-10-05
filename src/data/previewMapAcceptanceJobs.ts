import type { Job, JobCategory } from '../types/job'

// Only loaded by the opt-in Preview map acceptance route. These workplace points
// match named business locations; they are not inserted into local_jobs.
function acceptanceJob(input: {
  id: string
  title: string
  company: string
  category: JobCategory
  address: string
  location?: string
  lat: number
  lng: number
  salary: string
  postedAt: string
  deadline: string
  hours?: string
  note: string
}): Job {
  return {
    id: `acceptance-${input.id}`,
    title: input.title,
    company: input.company,
    category: input.category,
    salary: input.salary,
    rawSalary: input.salary,
    location: input.location ?? input.address,
    rawLocation: input.location ?? input.address,
    description: `## Lưu ý\nBản ghi kiểm thử bản đồ trên Preview; JOBI chưa xác nhận trực tiếp việc tuyển dụng hoặc cách liên hệ.\n${input.note}`,
    postedAt: input.postedAt,
    applicationDeadline: input.deadline,
    employerPhone: '',
    hours: input.hours,
    workLocations: [{
      id: -1,
      rawAddress: input.location ?? input.address,
      sortOrder: 0,
      addressAccuracy: 'exact_text',
      coordinateAccuracy: 'exact',
      geocodeStatus: 'manual',
      approvedPoint: { lat: input.lat, lng: input.lng, placePrecision: 'site' },
    }],
  }
}

const terminal = {
  company: 'THE TERMINAL KITCHEN BAR',
  category: 'am_thuc_do_uong' as const,
  address: '168 Đường Nguyễn Công Hãng, Kinh Bắc, Bắc Ninh',
  lat: 21.1868716,
  lng: 106.0685263,
  salary: '10–15 triệu VND/tháng (gồm thưởng/tip; lương cơ bản 6–8 triệu)',
  postedAt: '2026-09-16',
  deadline: '2026-10-10',
  note: 'Ba vị trí cùng một cơ sở. Chưa xác minh được số điện thoại/email tuyển dụng trực tiếp.',
}

export const previewMapAcceptanceJobs: Job[] = [
  acceptanceJob({
    id: 'pizza',
    title: 'Pizza Hut Bắc Ninh tìm đồng đội phù hợp sinh viên',
    company: 'Công ty TNHH Pizza Việt Nam / Pizza Hut Bắc Ninh',
    category: 'am_thuc_do_uong',
    address: '1A Đường Lê Thái Tổ, Võ Cường, Bắc Ninh',
    lat: 21.1719011,
    lng: 106.061922,
    salary: '25.500–28.500 VND/giờ',
    postedAt: '2026-09-27',
    deadline: '2026-10-11',
    note: 'Tin gốc có nút liên hệ nhưng số điện thoại công khai bị che; chưa xác minh số liên hệ trực tiếp.',
  }),
  acceptanceJob({
    id: 'senna',
    title: 'Nhân viên Lễ tân',
    company: 'Senna Wellness Retreat',
    category: 'dich_vu',
    address: '120 Trần Lựu, Thị Cầu, Bắc Ninh (địa chỉ trong tin tuyển dụng)',
    location: 'Tin tuyển dụng: 120 Trần Lựu; cơ sở trên bản đồ: 122 Trần Lựu. Chưa đối chiếu số nhà.',
    lat: 21.1968565,
    lng: 106.091562,
    salary: 'Thỏa thuận',
    postedAt: '2026-09-28',
    deadline: '2026-10-15',
    note: 'Tin tuyển dụng ghi số 120; website chính thức của Senna và địa điểm bản đồ ghi số 122 Trần Lựu. Tọa độ là cơ sở Senna, không khẳng định đúng lối vào hay số nhà 120.',
  }),
  acceptanceJob({ id: 'terminal-reception', title: 'NHÂN VIÊN LỄ TÂN', hours: '17:00–02:00', ...terminal }),
  acceptanceJob({ id: 'terminal-bar', title: 'NHÂN VIÊN BAR', hours: 'Từ 17:00 đến hết ca phục vụ', ...terminal }),
  acceptanceJob({ id: 'terminal-service', title: 'NHÂN VIÊN PHỤC VỤ (Nam,Nữ)', hours: 'Từ 17:00 đến hết ca phục vụ', ...terminal }),
]
