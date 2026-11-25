// 공고 목록 프리셋 — 홈 바로가기·전체 메뉴·검색이 모두 같은 목록 화면(ListScreen)으로 들어온다. 화면은 하나, 맨 위 줄·기본 조건만 다르다.
export type PresetId = 'moi-nhat' | 'tuyen-gap' | 'khu-vuc' | 'ngan-han' | 'gan-toi' | 'phu-hop' | 'goi-y' | 'da-luu' | 'da-xem' | 'thuong-hieu'

export const PRESET_TITLES: Record<PresetId, string> = {
  'moi-nhat': 'Việc làm mới nhất',
  'tuyen-gap': 'Tuyển gấp',
  'khu-vuc': 'Việc làm theo khu vực',
  'ngan-han': 'Việc ngắn hạn',
  'gan-toi': 'Việc gần tôi',
  'phu-hop': 'Việc làm phù hợp',
  'goi-y': 'Gợi ý cho bạn',
  'da-luu': 'Việc đã lưu',
  'da-xem': 'Việc đã xem',
  'thuong-hieu': 'Thương hiệu tuyển dụng',
}

export const isPresetId = (v: string | undefined): v is PresetId => !!v && v in PRESET_TITLES

/** 단기 목록 맨 위 기간 칩(근무기간 옵션 중 짧은 것) — 값은 data/jobDuration의 실제 옵션만. */
export const SHORT_TERM_DURATIONS = ['Một ngày', 'Dưới 1 tuần', '1 tuần - 1 tháng'] as const
