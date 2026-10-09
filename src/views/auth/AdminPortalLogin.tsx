import React, { useState, useEffect, useRef } from 'react'
import type { User } from '../../types'
import BrandLogo from '../../components/BrandLogo'
import { actorToUser, loginWithApi, type ApiActor } from '../../services/authApi'
import { useStorageHub } from '../../store/StorageHubContext'
import { USERS } from '../../data/demoDatabase'

interface AdminLoginProps {
  onLogin: (user: User) => void
  onBackToHome?: () => void
  onSwitchToCustomerPortal?: () => void
}

type Step = 'credentials' | 'two-factor'

interface InternalDemoAccount {
  email: string
  name: string
  role: 'staff' | 'manager' | 'business' | 'admin'
  roleLabel: string
  badgeColor: string
}

const INTERNAL_ACCOUNTS: InternalDemoAccount[] = [
  { email: 'staff@storagehub.demo', name: 'Demo Staff', role: 'staff', roleLabel: 'Nhân Viên Kho', badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { email: 'manager@storagehub.demo', name: 'Demo Manager', role: 'manager', roleLabel: 'Quản Lý Cơ Sở', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { email: 'business@storagehub.demo', name: 'Demo Operations', role: 'business', roleLabel: 'Ban Điều Hành (BOM)', badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { email: 'admin@storagehub.demo', name: 'Demo Administrator', role: 'admin', roleLabel: 'Quản Trị Viên', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
]

export default function AdminPortalLogin({ onLogin, onBackToHome, onSwitchToCustomerPortal }: AdminLoginProps) {
  const { users } = useStorageHub()
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)

  // 2FA state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [generatedOtp, setGeneratedOtp] = useState('688246')
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [pendingActor, setPendingActor] = useState<ApiActor | null>(null)
  const [pendingUser, setPendingUser] = useState<User | null>(null)

  // Feedback & Loading
  const [error, setError] = useState('')
  const [blockedCustomer, setBlockedCustomer] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [otpError, setOtpError] = useState('')

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for 2FA
  useEffect(() => {
    if (step !== 'two-factor') return
    if (countdown <= 0) {
      setCanResend(true)
      return
    }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanResend(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [step, countdown])

  // Focus first OTP field when entering step 2
  useEffect(() => {
    if (step === 'two-factor') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus()
      }, 100)
    }
  }, [step])

  // Step 1: Validate Corporate Credentials
  async function handleVerifyCredentials(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBlockedCustomer(false)

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Vui lòng nhập email công ty của bạn.')
      return
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu nội bộ.')
      return
    }

    setIsLoading(true)

    try {
      // 1. Check if user is a customer in demo database or local list
      const candidateUser = users.find(u => u.email.toLowerCase() === normalizedEmail)
        || USERS.find(u => u.email.toLowerCase() === normalizedEmail)

      if (candidateUser && candidateUser.role === 'customer') {
        setBlockedCustomer(true)
        setError('Tài khoản này là tài khoản Khách hàng thuê kho, không có thẩm quyền truy cập Cổng Nội bộ.')
        setIsLoading(false)
        return
      }

      let actorResult: ApiActor | null = null
      let matchedLocalUser: User | null = null

      try {
        actorResult = await loginWithApi(normalizedEmail, password)
        const userObj = actorToUser(actorResult)
        if (userObj.role === 'customer') {
          setBlockedCustomer(true)
          setError('Tài khoản này là tài khoản Khách hàng thuê kho, không có thẩm quyền truy cập Cổng Nội bộ.')
          setIsLoading(false)
          return
        }
      } catch (apiErr) {
        // Fallback for local demo environment if API is offline
        const localMatch = users.find(u => u.email.toLowerCase() === normalizedEmail)
          || USERS.find(u => u.email.toLowerCase() === normalizedEmail)

        if (localMatch) {
          if (localMatch.role === 'customer') {
            setBlockedCustomer(true)
            setError('Tài khoản này là tài khoản Khách hàng thuê kho, không có thẩm quyền truy cập Cổng Nội bộ.')
            setIsLoading(false)
            return
          }
          matchedLocalUser = {
            id: localMatch.id,
            name: localMatch.name,
            email: localMatch.email,
            role: localMatch.role as User['role'],
            facility: localMatch.facility,
            facilityId: localMatch.facilityId,
            phone: localMatch.phone,
            status: 'active',
          } as unknown as User
        } else {
          throw apiErr
        }
      }

      // Generate random 6-digit OTP
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString()
      setGeneratedOtp(newOtp)
      setOtpDigits(['', '', '', '', '', ''])
      setCountdown(60)
      setCanResend(false)
      setOtpError('')

      if (actorResult) {
        setPendingActor(actorResult)
        setPendingUser(actorToUser(actorResult))
      } else if (matchedLocalUser) {
        setPendingUser(matchedLocalUser)
        setPendingActor(null)
      }

      setStep('two-factor')
    } catch (err: unknown) {
      console.warn('Admin login validation error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Không thể kết nối')) {
        setError('Không thể kết nối máy chủ xác thực. Nếu đang thử nghiệm, vui lòng chọn tài khoản nội bộ có sẵn bên dưới.')
      } else {
        setError('Thông tin đăng nhập nội bộ không chính xác hoặc tài khoản đã bị vô hiệu hóa.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned) {
      const updated = [...otpDigits]
      updated[index] = ''
      setOtpDigits(updated)
      return
    }

    // Single digit input
    const char = cleaned.slice(-1)
    const updated = [...otpDigits]
    updated[index] = char
    setOtpDigits(updated)
    setOtpError('')

    // Auto-advance to next input
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const updated = [...otpDigits]
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || ''
    }
    setOtpDigits(updated)
    setOtpError('')

    const nextIndex = Math.min(pasted.length, 5)
    otpInputRefs.current[nextIndex]?.focus()
  }

  const fillDemoOtp = () => {
    const digits = generatedOtp.split('')
    setOtpDigits(digits)
    setOtpError('')
    otpInputRefs.current[5]?.focus()
  }

  // Step 2: Verify 2FA and Complete Login
  const handleVerify2Fa = (e: React.FormEvent) => {
    e.preventDefault()
    const enteredCode = otpDigits.join('')
    if (enteredCode.length < 6) {
      setOtpError('Vui lòng nhập đầy đủ 6 chữ số mã xác thực 2FA.')
      return
    }

    // Validate OTP (matches generatedOtp or default master demo code '123456')
    if (enteredCode !== generatedOtp && enteredCode !== '123456' && enteredCode !== '688246') {
      setOtpError('Mã 2FA không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại.')
      return
    }

    // Success! Log the user in
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      if (pendingUser) {
        onLogin(pendingUser)
      } else if (pendingActor) {
        onLogin(actorToUser(pendingActor))
      }
    }, 400)
  }

  // Resend 2FA OTP
  const handleResendOtp = () => {
    if (!canResend) return
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(newOtp)
    setOtpDigits(['', '', '', '', '', ''])
    setCountdown(60)
    setCanResend(false)
    setOtpError('')
    setTimeout(() => {
      otpInputRefs.current[0]?.focus()
    }, 50)
  }

  // Select demo account helper
  const handleSelectDemoAccount = (acc: InternalDemoAccount) => {
    setEmail(acc.email)
    setPassword('password123')
    setError('')
    setBlockedCustomer(false)
  }

  // Mask email for privacy display
  const maskEmail = (str: string) => {
    if (!str.includes('@')) return str
    const [name, domain] = str.split('@')
    if (name.length <= 2) return `${name[0]}*@${domain}`
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`
  }

  return (
    <main className="min-h-screen bg-[#0B0F17] text-stone-100 flex flex-col justify-between selection:bg-[#F59E0B] selection:text-black relative overflow-hidden font-sans">
      {/* ── Background Cyber/Vault Security Ambiance ── */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="w-full h-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="admin-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38BDF8" strokeWidth="0.5" strokeOpacity="0.25" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#admin-grid)" />
        </svg>
      </div>

      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── Header Bar ── */}
      <header className="relative z-10 border-b border-stone-800/80 bg-stone-950/70 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo light />
            <div className="hidden sm:flex items-center gap-2 border-l border-stone-800 pl-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Back-Office Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="text-stone-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-stone-800/60"
              >
                ← Trang chủ
              </button>
            )}
            {onSwitchToCustomerPortal && (
              <button
                type="button"
                onClick={onSwitchToCustomerPortal}
                className="text-amber-400 hover:text-amber-300 transition-colors font-medium cursor-pointer border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg"
              >
                Cổng Khách Hàng →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Auth Card ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-[500px] bg-[#121722]/95 border border-stone-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative">
          {/* Subtle Security Badge */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-stone-400 block">
                  CỔNG NỘI BỘ
                </span>
                <span className="text-xs font-bold text-stone-200">
                  StorageHub Internal Portal
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-stone-800 text-stone-300 border border-stone-700">
                {step === 'credentials' ? 'BƯỚC 1/2' : 'BƯỚC 2/2 · 2FA'}
              </span>
            </div>
          </div>

          {/* ── STEP 1: CORPORATE CREDENTIALS ── */}
          {step === 'credentials' && (
            <div className="animate-in fade-in duration-200">
              <div className="mb-5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Đăng Nhập Cổng Nội Bộ
                </h1>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  Dành riêng cho <strong className="text-stone-300">Staff</strong>, <strong className="text-stone-300">Manager</strong>, <strong className="text-stone-300">Ban điều hành (BOM)</strong> & <strong className="text-stone-300">Admin</strong>.
                </p>
              </div>

              {/* Strict Security Policy Note (Explicit requirement: NO REGISTER BUTTON) */}
              <div className="mb-5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs text-stone-400 leading-relaxed flex items-start gap-2.5">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-1">
                  <p className="font-semibold text-stone-300">Chính sách bảo mật nội bộ</p>
                  <p className="text-[11px] text-stone-400">
                    Tài khoản được cấp tập trung bởi Quản trị viên (Admin/HR). Cổng này <strong className="text-amber-400">không mở đăng ký tự do</strong>.
                  </p>
                </div>
              </div>

              {/* Blocked Customer Alert if customer tries to log in */}
              {blockedCustomer && (
                <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 p-3.5 text-xs text-red-200 leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-bold text-red-300">Từ Chối Truy Cập (403 Forbidden)</p>
                      <p className="mt-1 text-stone-300">
                        {error}
                      </p>
                      {onSwitchToCustomerPortal && (
                        <button
                          type="button"
                          onClick={onSwitchToCustomerPortal}
                          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                        >
                          → Chuyển sang Cổng Khách Hàng (/login) để đăng nhập
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* General Error */}
              {!blockedCustomer && error && (
                <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-400 font-medium">
                  {error}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleVerifyCredentials} className="space-y-4">
                <div>
                  <label htmlFor="admin-email" className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Email công ty <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ten.nhanvien@storagehub.vn"
                    className="w-full bg-[#181F2E] border border-stone-700/80 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="admin-password" className="block text-xs font-semibold text-stone-300">
                      Mật khẩu nội bộ <span className="text-red-400">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#181F2E] border border-stone-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-stone-400 hover:text-stone-300 select-none">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={e => setRememberDevice(e.target.checked)}
                      className="rounded border-stone-700 bg-stone-900 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                    />
                    <span>Thiết bị nội bộ tin cậy</span>
                  </label>
                  <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Bắt buộc 2FA ở bước tiếp theo
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim() || !password}
                  className="w-full bg-[#E89520] hover:bg-[#D98514] disabled:opacity-50 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-sm mt-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span>Đang kiểm tra bảo mật…</span>
                    </>
                  ) : (
                    <>
                      <span>Tiếp tục xác thực 2FA</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Quick internal test accounts drawer */}
              <div className="mt-6 pt-5 border-t border-stone-800/80">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-mono font-bold uppercase text-stone-400">
                    Tài khoản demo nội bộ (Test Roles)
                  </span>
                  <span className="text-[10px] text-stone-500">Bấm để điền nhanh</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {INTERNAL_ACCOUNTS.map(acc => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectDemoAccount(acc)}
                      className="p-2 rounded-lg border border-stone-800 bg-stone-900/50 hover:bg-stone-800/80 hover:border-stone-700 transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-200 group-hover:text-amber-400 transition-colors">
                          {acc.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${acc.badgeColor}`}>
                          {acc.role.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500 font-mono block mt-0.5 truncate">
                        {acc.email}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: MANDATORY 2FA CHALLENGE ── */}
          {step === 'two-factor' && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3.5 shadow-lg shadow-amber-500/5">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Xác Thực Hai Yếu Tố (2FA)
                </h2>
                <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Bắt buộc đối với toàn bộ nhân sự StorageHub. Vui lòng nhập mã bảo mật 6 số từ Google/Microsoft Authenticator hoặc đã gửi đến email:
                </p>
                <div className="mt-2 inline-block px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-xs font-mono font-medium text-amber-400">
                  {maskEmail(email)}
                </div>
              </div>

              {/* Demo Helper Box */}
              <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">🧪</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-200">Mã 2FA thử nghiệm của phiên này:</p>
                    <span className="font-mono font-black text-amber-400 tracking-wider text-sm">
                      {generatedOtp}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fillDemoOtp}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs border border-amber-500/30 transition-colors cursor-pointer shrink-0"
                >
                  Điền nhanh
                </button>
              </div>

              {otpError && (
                <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-400 font-medium text-center">
                  {otpError}
                </div>
              )}

              <form onSubmit={handleVerify2Fa} className="space-y-5">
                {/* 6 Digit Input Group */}
                <div className="flex items-center justify-between gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(index, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 sm:w-14 sm:h-16 text-center font-mono font-bold text-xl sm:text-2xl bg-[#181F2E] border border-stone-700/80 rounded-xl text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 transition-all select-all shadow-inner"
                    />
                  ))}
                </div>

                {/* Countdown & Resend */}
                <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
                  <span>
                    {countdown > 0 ? (
                      <span className="font-mono text-stone-300">
                        Mã hiệu lực trong: <strong className="text-amber-400">{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</strong>
                      </span>
                    ) : (
                      <span className="text-red-400">Mã xác thực đã hết hạn</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!canResend}
                    className="text-amber-400 hover:text-amber-300 disabled:text-stone-600 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
                  >
                    Gửi lại mã
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials')
                      setError('')
                      setOtpError('')
                    }}
                    className="w-1/3 py-2.5 sm:py-3 px-3 rounded-xl border border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ← Đổi tài khoản
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || otpDigits.join('').length < 6}
                    className="w-2/3 bg-[#E89520] hover:bg-[#D98514] disabled:opacity-50 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span>Đang xác nhận 2FA…</span>
                      </>
                    ) : (
                      <>
                        <span>Xác nhận & Vào hệ thống</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer Link to Switch to Customer Portal ── */}
      <footer className="relative z-10 border-t border-stone-800/80 bg-stone-950/80 px-4 py-4 text-center text-xs text-stone-400">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>Bạn là khách hàng thuê kho cá nhân hoặc doanh nghiệp?</span>
          {onSwitchToCustomerPortal && (
            <button
              type="button"
              onClick={onSwitchToCustomerPortal}
              className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
            >
              Chuyển sang Cổng Khách Hàng (/login) →
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-stone-600">
          © {new Date().getFullYear()} StorageHub Enterprise Back-Office Security Framework. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
