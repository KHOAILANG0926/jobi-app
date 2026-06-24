import { loadProfile } from './storage'

const CV_KEY = 'vgb_cv_draft'

export interface CvExperience {
  id: string
  /** Chức danh / job title */
  role: string
  company: string
  /** Thời gian (bắt đầu – kết thúc) */
  period: string
  description: string
}

export interface CvEducation {
  id: string
  school: string
  degree: string
  graduationYear: string
}

export interface CvReference {
  id: string
  name: string
  phone: string
}

export interface CvData {
  fullName: string
  headline: string
  email: string
  phone: string
  city: string
  dateOfBirth: string
  /** Base64 data URL or null */
  profilePhotoDataUrl: string | null
  /** Mục tiêu / tự giới thiệu ngắn, tối đa 200 ký tự */
  objective: string
  experiences: CvExperience[]
  education: CvEducation[]
  skillTags: string[]
  references: CvReference[]
}

function seedFromProfile(): Partial<CvData> {
  const p = loadProfile()
  return {
    fullName: p.fullName,
    phone: p.phone,
    email: p.email,
    city: p.city,
    objective: p.bio ? p.bio.slice(0, 200) : '',
  }
}

function emptyCv(): CvData {
  return {
    fullName: '',
    headline: 'Ứng viên — việc bán thời gian',
    email: '',
    phone: '',
    city: '',
    dateOfBirth: '',
    profilePhotoDataUrl: null,
    objective: '',
    experiences: [
      { id: 'exp-1', company: '', role: '', period: '', description: '' },
    ],
    education: [{ id: 'edu-1', school: '', degree: '', graduationYear: '' }],
    skillTags: [],
    references: [],
  }
}

function migrateExperience(raw: unknown): CvExperience[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return emptyCv().experiences
  }
  return raw.map((item: unknown, i: number) => {
    const e = item as Record<string, string>
    return {
      id: e.id ?? `exp-${i}`,
      company: e.company ?? '',
      role: e.role ?? '',
      period: e.period ?? '',
      description: e.description ?? e.details ?? '',
    }
  })
}

function migrateEducation(raw: unknown): CvEducation[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return emptyCv().education
  }
  return raw.map((item: unknown, i: number) => {
    const e = item as Record<string, string>
    return {
      id: e.id ?? `edu-${i}`,
      school: e.school ?? '',
      degree: e.degree ?? '',
      graduationYear: e.graduationYear ?? e.period ?? '',
    }
  })
}

function migrateReferences(raw: unknown): CvReference[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: unknown, i: number) => {
    const r = item as Record<string, string>
    return {
      id: r.id ?? `ref-${i}`,
      name: r.name ?? '',
      phone: r.phone ?? '',
    }
  })
}

function parseSkillTags(parsed: Record<string, unknown>): string[] {
  if (Array.isArray(parsed.skillTags)) {
    return (parsed.skillTags as string[]).map((s) => String(s).trim()).filter(Boolean)
  }
  if (typeof parsed.skills === 'string') {
    return parsed.skills
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeFromStorage(parsed: Record<string, unknown>, base: CvData): CvData {
  const objectiveRaw =
    typeof parsed.objective === 'string'
      ? parsed.objective
      : typeof parsed.summary === 'string'
        ? parsed.summary
        : ''
  const objective = (objectiveRaw || base.objective).slice(0, 200)

  return {
    ...base,
    fullName: typeof parsed.fullName === 'string' ? parsed.fullName : base.fullName,
    headline: typeof parsed.headline === 'string' ? parsed.headline : base.headline,
    email: typeof parsed.email === 'string' ? parsed.email : base.email,
    phone: typeof parsed.phone === 'string' ? parsed.phone : base.phone,
    city: typeof parsed.city === 'string' ? parsed.city : base.city,
    dateOfBirth: typeof parsed.dateOfBirth === 'string' ? parsed.dateOfBirth : base.dateOfBirth,
    profilePhotoDataUrl:
      typeof parsed.profilePhotoDataUrl === 'string' ? parsed.profilePhotoDataUrl : null,
    objective,
    experiences: migrateExperience(parsed.experiences),
    education: migrateEducation(parsed.education),
    skillTags: parseSkillTags(parsed),
    references: migrateReferences(parsed.references),
  }
}

export function loadCv(): CvData {
  const base = emptyCv()
  try {
    const raw = localStorage.getItem(CV_KEY)
    if (!raw) {
      return { ...base, ...seedFromProfile() }
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return normalizeFromStorage(parsed, { ...base, ...seedFromProfile() })
  } catch {
    return { ...base, ...seedFromProfile() }
  }
}

export function saveCv(data: CvData): void {
  localStorage.setItem(CV_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('vgb:cv-saved'))
}
