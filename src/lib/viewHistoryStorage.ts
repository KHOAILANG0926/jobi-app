const KEY = 'vgb_view_history'
const MAX_ENTRIES = 100
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30일

export interface ViewHistoryEntry {
  id: string
  viewedAt: string // ISO
}

// "최근 본 공고"는 이 브라우저에만 저장된다(계정 서버 동기화 없음) — 최대
// 30일 · 100건만 보관하고, 읽을 때마다 30일이 지난 항목은 잘라낸다.
function readRaw(): ViewHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ViewHistoryEntry[]
    if (!Array.isArray(parsed)) return []
    const cutoff = Date.now() - MAX_AGE_MS
    return parsed.filter((e) => e && typeof e.id === 'string' && typeof e.viewedAt === 'string' && new Date(e.viewedAt).getTime() >= cutoff)
  } catch {
    return []
  }
}

function writeRaw(entries: ViewHistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  window.dispatchEvent(new CustomEvent('vgb:view-history'))
}

/** 최근 본 순(내림차순)으로 반환 — 30일 경과분은 이미 제외됨. */
export function loadViewHistory(): ViewHistoryEntry[] {
  return readRaw()
}

/** 같은 공고를 다시 보면 기존 항목을 지우고 맨 앞으로 옮긴다(중복 제거). */
export function recordJobView(id: string): void {
  if (!id) return
  const existing = readRaw().filter((e) => e.id !== id)
  const next = [{ id, viewedAt: new Date().toISOString() }, ...existing]
  writeRaw(next)
}

export function removeFromViewHistory(id: string): void {
  writeRaw(readRaw().filter((e) => e.id !== id))
}

export function clearViewHistory(): void {
  writeRaw([])
}
