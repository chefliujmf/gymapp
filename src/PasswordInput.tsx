import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** Password field with a show/hide (eye) toggle so users can verify what they typed. */
export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  autoComplete,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrap">
      <input
        className="search"
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="pw-eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
