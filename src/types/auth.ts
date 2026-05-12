export type UserRole = 'seeker' | 'employer'

export interface StoredAccount {
  id: string
  name: string
  /** Chuẩn hoá: chỉ chữ số */
  phone: string
  password: string
  role: UserRole
  createdAt: string
}

export interface AuthUser {
  id: string
  name: string
  phone: string
  role: UserRole
}
