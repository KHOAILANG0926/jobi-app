import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * 로그인/회원가입 비밀번호 입력란 — 사용자 지적("숨김 표시로만 되어 있으면
 * 내가 뭘 썼는지 모르잖아")으로 보기/숨기기 토글 버튼 추가. Login.tsx/
 * Signup.tsx 둘 다 같은 패턴이 필요해 중복을 피하려고 공유 컴포넌트로 뺐다.
 */
interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
}

export function PasswordField({ label, value, onChange, placeholder, autoComplete }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <div className="password-field">
        <input
          className="field__input password-field__input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-field__toggle"
          tabIndex={-1}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
        </button>
      </div>
    </label>
  )
}
