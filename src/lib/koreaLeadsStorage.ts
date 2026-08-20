export interface KoreaLead {
  id: string
  name: string
  birthYear: string
  region: string
  field: string
  zalo: string
  createdAt: string
}

const KEY = 'vgb_korea_leads'

export function loadKoreaLeads(): KoreaLead[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as KoreaLead[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addKoreaLead(entry: Omit<KoreaLead, 'id' | 'createdAt'>): KoreaLead {
  const next: KoreaLead = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const existing = loadKoreaLeads()
  localStorage.setItem(KEY, JSON.stringify([next, ...existing]))
  return next
}
