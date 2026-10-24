export type AdminLanguage = 'ko' | 'vi'
const KEY = 'vgb_admin_language'
export function getAdminLanguage(userId?: string): AdminLanguage {
  try {
    const result = localStorage.getItem(userId ? `${KEY}_${userId}` : KEY)
    return result === 'vi' ? 'vi' : 'ko'
  } catch { return 'ko' }
}
export function saveAdminLanguage(value: AdminLanguage, userId?: string): void {
  try { localStorage.setItem(userId ? `${KEY}_${userId}` : KEY, value) } catch { /* private browsing */ }
}
