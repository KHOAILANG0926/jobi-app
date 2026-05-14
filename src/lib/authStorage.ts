import type { AuthUser, StoredAccount, UserRole } from '../types/auth'

const ACCOUNTS_KEY = 'jobi_accounts'
const SESSION_KEY = 'jobi_session'

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function loadAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredAccount[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function registerAccount(
  name: string,
  phone: string,
  password: string,
  role: UserRole,
): { ok: true } | { ok: false; error: string } {
  const p = normalizePhone(phone)
  if (!p || p.length < 9) {
    return { ok: false, error: 'Số điện thoại không hợp lệ.' }
  }
  if (!password || password.length < 6) {
    return { ok: false, error: 'Mật khẩu tối thiểu 6 ký tự.' }
  }
  if (!name.trim()) {
    return { ok: false, error: 'Vui lòng nhập họ tên.' }
  }
  const accounts = loadAccounts()
  if (accounts.some((a) => a.phone === p)) {
    return { ok: false, error: 'Số điện thoại đã được đăng ký.' }
  }
  const account: StoredAccount = {
    id: `user-${crypto.randomUUID()}`,
    name: name.trim(),
    phone: p,
    password,
    role,
    createdAt: new Date().toISOString(),
  }
  saveAccounts([account, ...accounts])
  return { ok: true }
}

export function authenticate(
  phone: string,
  password: string,
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const p = normalizePhone(phone)
  if (!p) {
    return { ok: false, error: 'Vui lòng nhập số điện thoại.' }
  }
  const accounts = loadAccounts()
  const found = accounts.find((a) => a.phone === p)
  if (!found || found.password !== password) {
    return { ok: false, error: 'Số điện thoại hoặc mật khẩu không đúng.' }
  }
  const user: AuthUser = {
    id: found.id,
    name: found.name,
    phone: found.phone,
    role: found.role,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  return { ok: true, user }
}

export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as AuthUser
    if (!u?.id || !u?.phone || !u?.role) return null
    // Validate against stored accounts to prevent role tampering via DevTools
    const accounts = loadAccounts()
    const account = accounts.find((a) => a.id === u.id)
    if (!account || account.role !== u.role || account.phone !== u.phone) return null
    return u
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)}${d.length > 10 ? d.slice(10) : ''}`.trim()
}
