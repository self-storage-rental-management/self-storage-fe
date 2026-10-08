interface PasswordStrengthProps {
  password: string
}

export type StrengthLevel = 'none' | 'weak' | 'medium' | 'strong'

export function calculatePasswordStrength(password: string): {
  level: StrengthLevel
  score: number
  label: string
  color: string
} {
  if (!password) {
    return { level: 'none', score: 0, label: '', color: 'bg-stone-200' }
  }

  if (password.length < 8) {
    return {
      level: 'weak',
      score: 1,
      label: 'Yếu (Cần tối thiểu 8 ký tự)',
      color: 'bg-red-500'
    }
  }

  let bonus = 0
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) bonus++
  if (/\d/.test(password)) bonus++
  if (/[^a-zA-Z0-9]/.test(password)) bonus++
  if (password.length >= 10) bonus++

  if (bonus <= 1) {
    return {
      level: 'weak',
      score: 1,
      label: 'Yếu',
      color: 'bg-red-500'
    }
  }

  if (bonus === 2) {
    return {
      level: 'medium',
      score: 2,
      label: 'Trung bình',
      color: 'bg-[#F59E0B]'
    }
  }

  return {
    level: 'strong',
    score: 3,
    label: 'Mạnh',
    color: 'bg-emerald-500'
  }
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null

  const { score, label, color } = calculatePasswordStrength(password)

  return (
    <div className="mt-1.5 space-y-1" aria-live="polite">
      {/* 3-segment strength track */}
      <div className="flex items-center gap-1.5 h-1.5">
        {[1, 2, 3].map(step => (
          <div
            key={step}
            className={`h-full flex-1 rounded-full transition-all duration-300 ${
              score >= step ? color : 'bg-stone-200'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-stone-500">Độ mạnh mật khẩu:</span>
        <span
          className={`font-semibold ${
            score === 1
              ? 'text-red-500'
              : score === 2
              ? 'text-[#F59E0B]'
              : 'text-emerald-600'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
