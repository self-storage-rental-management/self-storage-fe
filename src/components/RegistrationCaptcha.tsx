import { useEffect, useId, useState } from 'react'
import { apiRequest } from '../services/apiClient'

interface ApiEnvelope<T> { data: T }

export interface CaptchaProof { captchaId: string; captchaAnswer: string }
interface Challenge { captchaId: string; imageDataUrl: string; expiresAt: string }

export default function RegistrationCaptcha({ onChange, disabled = false }: {
  onChange: (value: CaptchaProof | null) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [answer, setAnswer] = useState('')
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setChallenge(null); setAnswer(''); setError(''); onChange(null)
    void apiRequest<ApiEnvelope<Challenge>>('/api/auth/captcha', { skipAuth: true })
      .then(response => { if (active) setChallenge(response.data) })
      .catch(() => { if (active) setError('Không tải được CAPTCHA. Vui lòng thử lại.') })
    return () => { active = false }
  }, [version, onChange])
  return <section className="my-4 rounded-lg border border-stone-300 bg-stone-50 p-3" aria-label="Xác minh đăng ký">
    <label htmlFor={inputId} className="text-sm font-semibold text-stone-800">Mã xác minh CAPTCHA *</label>
    <div className="my-2 flex flex-wrap items-center gap-3">
      {challenge ? <img width={240} height={76} src={challenge.imageDataUrl} alt="CAPTCHA gồm 6 chữ cái hoặc chữ số" className="max-w-full rounded border border-stone-200" /> : <span role="status" className="text-xs text-stone-600">{error || 'Đang tải mã xác minh…'}</span>}
      <button type="button" disabled={disabled} className="text-sm font-semibold text-amber-800 underline disabled:opacity-50" onClick={() => setVersion(value => value + 1)}>Đổi mã</button>
    </div>
    <input id={inputId} value={answer} maxLength={6} disabled={disabled || !challenge} autoComplete="off" autoCapitalize="characters" spellCheck={false}
      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 uppercase" placeholder="Nhập 6 ký tự trong ảnh"
      onChange={event => {
        const value = event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase()
        setAnswer(value)
        onChange(challenge && value.length === 6 ? { captchaId: challenge.captchaId, captchaAnswer: value } : null)
      }} />
    <p className="mt-1 text-xs text-stone-500">Mã có hiệu lực 5 phút và chỉ dùng một lần. Nhấn Đổi mã nếu ảnh khó đọc.</p>
  </section>
}
