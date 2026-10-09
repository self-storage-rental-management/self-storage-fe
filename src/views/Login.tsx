import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '../types'
import BrandLogo from '../components/BrandLogo'
import GoogleLoginButton from '../components/GoogleLoginButton'
import {
  actorToUser,
  loginWithApi,
  loginWithGoogleApi,
  registerWithApi,
  requestPasswordResetWithApi,
  resetPasswordWithApi,
  updateCurrentProfileWithApi,
  verifyEmailWithApi,
  type ApiActor
} from '../services/authApi'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from '../utils/passwordPolicy'
import StepIndicator from './auth/StepIndicator'
import PasswordStrength from './auth/PasswordStrength'
import AuthSidePanel from './auth/AuthSidePanel'

interface LoginProps {
  onLogin: (user: User) => void
  onBackToHome?: () => void
  initialTab?: 'login' | 'register'
}

type AuthTab = 'login' | 'register'
type ResetStep = 'identify' | 'verify' | 'new-password' | 'success'
type RecoveryPurpose = 'password-reset' | 'email-verification'

function normalizeVietnamesePhone(value: string) {
  let phone = value.replace(/[\s().-]/g, '')
  if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`
  if (phone.startsWith('84')) phone = `0${phone.slice(2)}`
  return /^0[0-9]{9}$/.test(phone) ? phone : ''
}

function formatAuthError(error: unknown, fallback: string): string {
  console.error('[Auth Error Technical Detail]:', error)
  const message = error instanceof Error ? error.message : String(error || '')
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('timeout') ||
    message.includes('Không thể kết nối') ||
    message.includes('ERR_CONNECTION')
  ) {
    return 'Không thể kết nối, vui lòng thử lại sau.'
  }
  const translations: Record<string, string> = {
    'The email delivery service is unavailable': 'Dịch vụ gửi email hiện không khả dụng. Vui lòng thử lại sau.',
    'The email delivery service is not configured': 'Dịch vụ gửi email chưa được cấu hình. Vui lòng báo Admin.',
    'An account with this email already exists': 'Email này đã được đăng ký trong hệ thống.',
    'Invalid email or password': 'Email hoặc mật khẩu không chính xác.',
    'User not found': 'Không tìm thấy tài khoản với thông tin đã cung cấp.',
    'Account is disabled': 'Tài khoản của bạn tạm thời bị khóa. Vui lòng liên hệ hỗ trợ.',
  }
  return translations[message] || (message.length > 0 && !message.includes('http') && !message.includes('Error:') ? message : fallback)
}

// ── Validation Helpers ───────────────────────────────────────────
function validateEmail(val: string): string | null {
  if (!val.trim()) return 'Vui lòng nhập địa chỉ email.'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(val.trim())) return 'Email chưa đúng định dạng'
  return null
}

function cleanPhoneNumber(val: string): string {
  return val.replace(/[\s.]/g, '')
}

function validatePhone(val: string): string | null {
  const cleaned = cleanPhoneNumber(val)
  if (!cleaned.trim()) return 'Vui lòng nhập số điện thoại.'
  if (!/^0[0-9]{9}$/.test(cleaned)) {
    return 'Số điện thoại gồm 10 số, bắt đầu bằng 0'
  }
  return null
}

function validatePassword(val: string): string | null {
  if (!val) return 'Vui lòng nhập mật khẩu.'
  const hasMinLength = val.length >= 8
  const hasLetter = /[a-zA-Z]/.test(val)
  const hasNumber = /[0-9]/.test(val)
  if (!hasMinLength || !hasLetter || !hasNumber) {
    return 'Tối thiểu 8 ký tự, gồm chữ và số'
  }
  return null
}

function validateConfirmPassword(val: string, matchVal: string): string | null {
  // Chỉ so sánh khi ô "Mật khẩu" đã có giá trị; nếu mật khẩu rỗng thì chỉ báo lỗi ở ô mật khẩu
  if (!matchVal) return null
  if (!val) return 'Vui lòng xác nhận mật khẩu.'
  if (val !== matchVal) return 'Mật khẩu xác nhận không khớp.'
  return null
}

function validateFullName(val: string): string | null {
  if (!val.trim()) return 'Vui lòng nhập họ và tên.'
  if (val.trim().length < 2) return 'Họ và tên tối thiểu 2 ký tự.'
  return null
}

function validateAddress(val: string): string | null {
  if (!val.trim()) return 'Vui lòng nhập địa chỉ thường trú.'
  if (val.trim().length < 5) return 'Địa chỉ thường trú tối thiểu 5 ký tự.'
  return null
}

function validateEmergencyName(val: string): string | null {
  if (!val.trim()) return 'Vui lòng nhập họ tên người liên hệ khẩn cấp.'
  if (val.trim().length < 2) return 'Họ tên người liên hệ tối thiểu 2 ký tự.'
  return null
}

function validateEmergencyPhone(val: string): string | null {
  const cleaned = cleanPhoneNumber(val)
  if (!cleaned.trim()) return 'Vui lòng nhập SĐT người liên hệ khẩn cấp.'
  if (!/^0[0-9]{9}$/.test(cleaned)) {
    return 'Số điện thoại gồm 10 số, bắt đầu bằng 0'
  }
  return null
}

export default function Login({ onLogin, onBackToHome, initialTab = 'login' }: LoginProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab)

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
    }
  }, [initialTab])

  // Register 2-step state
  const [registerStep, setRegisterStep] = useState<1 | 2>(1)
  const [googleActor, setGoogleActor] = useState<ApiActor | null>(null)

  // Login & Shared State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Register Form Fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [permanentAddress, setPermanentAddress] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')

  // Touched state for inline validation on blur + onChange
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Status & Error
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Recovery flow states
  const [resetStep, setResetStep] = useState<ResetStep | null>(null)
  const [recoveryAccount, setRecoveryAccount] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [recoveryPurpose, setRecoveryPurpose] = useState<RecoveryPurpose>('password-reset')
  const [pendingRegistrationPassword, setPendingRegistrationPassword] = useState('')
  const [debugCodeHint, setDebugCodeHint] = useState('')
  const recoveryLinkHandledRef = useRef(false)

  // Load remembered email on mount
  useEffect(() => {
    const saved = localStorage.getItem('storagehub:remember_email')
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  // Check query params for verification/reset tokens
  useEffect(() => {
    if (recoveryLinkHandledRef.current) return
    recoveryLinkHandledRef.current = true

    const url = new URL(window.location.href)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const verificationToken = url.searchParams.get('verifyEmail')
      || (pathname === '/verify-email' ? url.searchParams.get('token') : null)
    const resetToken = url.searchParams.get('resetPassword')
      || (pathname === '/reset-password' ? url.searchParams.get('token') : null)
    if (!verificationToken && !resetToken) {
      if (pathname === '/reset-password') {
        setRecoveryPurpose('password-reset')
        setResetStep('identify')
      } else if (pathname === '/verify-email') {
        setTab('login')
        setError('Liên kết xác minh email thiếu token hoặc không hợp lệ.')
      }
      return
    }

    setRecoveryAccount('')
    setVerificationCode('')
    setRecoveryPurpose(verificationToken ? 'email-verification' : 'password-reset')
    setError('')
    setNotice('')

    if (verificationToken) {
      setResetStep(null)
      setIsSubmitting(true)
      void verifyEmailWithApi(undefined, verificationToken)
        .then(() => {
          window.history.replaceState({}, document.title, '/login')
          setTab('login')
          setNotice('Xác minh email thành công. Bạn có thể đăng nhập ngay.')
        })
        .catch(verificationError => {
          window.history.replaceState({}, document.title, '/login')
          setTab('login')
          setError(formatAuthError(verificationError, 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.'))
        })
        .finally(() => setIsSubmitting(false))
      return
    }

    window.history.replaceState({}, document.title, '/reset-password')
    setVerificationCode(resetToken || '')
    setResetStep('new-password')
    setNotice('Liên kết đặt lại mật khẩu hợp lệ. Hãy tạo mật khẩu mới.')
  }, [])

  // ── Real-time Computed Errors ──────────────────────────────────
  const emailError = validateEmail(email)
  const loginPasswordError = !password ? 'Vui lòng nhập mật khẩu.' : null
  const fullNameError = validateFullName(fullName)
  const phoneError = validatePhone(phone)
  const passwordError = validatePassword(password)
  const confirmPasswordError = validateConfirmPassword(confirmPassword, password)

  const addressError = validateAddress(permanentAddress)
  const emergencyNameError = validateEmergencyName(emergencyContactName)
  const emergencyPhoneError = validateEmergencyPhone(emergencyContactPhone)

  // Step 1 check
  const isStep1Complete = Boolean(fullName && email && phone && password && confirmPassword)
  const isStep1Valid = isStep1Complete && !fullNameError && !emailError && !phoneError && !passwordError && !confirmPasswordError

  // Step 2 check
  const isStep2Complete = Boolean(permanentAddress && emergencyContactName && emergencyContactPhone)
  const isStep2Valid = isStep2Complete && !addressError && !emergencyNameError && !emergencyPhoneError

  // Login check
  const isLoginValid = Boolean(email && password) && !emailError && !loginPasswordError

  // ── Handler: Login ─────────────────────────────────────────────
  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setTouched(prev => ({ ...prev, loginEmail: true, loginPassword: true }))

    if (!isLoginValid) return

    const normalizedEmail = email.trim().toLowerCase()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const actor = await loginWithApi(normalizedEmail, password)
      if (rememberMe) {
        localStorage.setItem('storagehub:remember_email', normalizedEmail)
      } else {
        localStorage.removeItem('storagehub:remember_email')
      }
      onLogin(actorToUser(actor))
    } catch (apiError) {
      setError(formatAuthError(apiError, 'Đăng nhập thất bại.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Handler: Google Credential ──────────────────────────────────
  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setError('')
    setNotice('')
    setIsSubmitting(true)

    // If on Register tab: skip Step 1 and proceed to Step 2
    if (tab === 'register') {
      try {
        const actor = await loginWithGoogleApi(idToken)
        setGoogleActor(actor)
        if (actor.fullName && !fullName) setFullName(actor.fullName)
        if (actor.email && !email) setEmail(actor.email)
        if (actor.phone && !phone) setPhone(actor.phone)
        if (actor.permanentAddress && !permanentAddress) setPermanentAddress(actor.permanentAddress)
        if (actor.emergencyContactName && !emergencyContactName) setEmergencyContactName(actor.emergencyContactName)
        if (actor.emergencyContactPhone && !emergencyContactPhone) setEmergencyContactPhone(actor.emergencyContactPhone)

        // If the Google account already had full address and emergency contacts:
        if (actor.permanentAddress && actor.emergencyContactName && actor.emergencyContactPhone) {
          onLogin(actorToUser(actor))
          return
        }

        // Otherwise jump straight to Step 2 to supplement missing information
        setRegisterStep(2)
        setNotice('Tài khoản Google đã kết nối. Vui lòng bổ sung địa chỉ và thông tin liên hệ khẩn cấp để hoàn tất.')
      } catch (googleError) {
        setError(formatAuthError(googleError, 'Đăng ký Google thất bại.'))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Default Login tab: standard Google sign-in
    try {
      const actor = await loginWithGoogleApi(idToken)
      onLogin(actorToUser(actor))
    } catch (googleError) {
      setError(formatAuthError(googleError, 'Đăng nhập Google thất bại.'))
    } finally {
      setIsSubmitting(false)
    }
  }, [tab, fullName, email, phone, permanentAddress, emergencyContactName, emergencyContactPhone, onLogin])

  // ── Handler: Step 1 Continue ────────────────────────────────────
  function handleContinueStep1(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting) return

    setTouched(prev => ({
      ...prev,
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true
    }))

    if (!isStep1Valid) {
      let firstErrorId: string | null = null
      if (fullNameError) firstErrorId = 'register-full-name'
      else if (emailError) firstErrorId = 'register-email'
      else if (phoneError) firstErrorId = 'register-phone'
      else if (passwordError) firstErrorId = 'register-password'
      else if (confirmPasswordError) firstErrorId = 'register-confirm-password'

      if (firstErrorId) {
        const el = document.getElementById(firstErrorId)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      }
      return
    }

    setError('')
    setRegisterStep(2)
  }

  // ── Handler: Step 2 Complete Register ───────────────────────────
  async function handleRegister(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting) return

    setTouched(prev => ({
      ...prev,
      permanentAddress: true,
      emergencyContactName: true,
      emergencyContactPhone: true
    }))

    if (!isStep2Valid) {
      let firstErrorId: string | null = null
      if (addressError) firstErrorId = 'register-permanent-address'
      else if (emergencyNameError) firstErrorId = 'emergency-contact-name'
      else if (emergencyPhoneError) firstErrorId = 'emergency-contact-phone'

      if (firstErrorId) {
        const el = document.getElementById(firstErrorId)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      }
      return
    }

    const normalizedPhone = normalizeVietnamesePhone(phone)
    const normalizedEmergencyPhone = normalizeVietnamesePhone(emergencyContactPhone)

    if (!normalizedEmergencyPhone) {
      setError('Số điện thoại người liên hệ khẩn cấp không hợp lệ.')
      return
    }

    // If registering via Google: update profile with supplementary info
    if (googleActor) {
      setError('')
      setIsSubmitting(true)
      try {
        const updatedActor = await updateCurrentProfileWithApi({
          fullName: fullName.trim() || googleActor.fullName,
          phone: normalizedPhone || googleActor.phone || undefined,
          permanentAddress: permanentAddress.trim(),
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactPhone: normalizedEmergencyPhone,
        })
        onLogin(actorToUser(updatedActor))
        return
      } catch (updateError) {
        setError(formatAuthError(updateError, 'Không thể lưu thông tin bổ sung.'))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Standard registration with email & password
    if (!normalizedPhone) {
      setError('Số điện thoại phải là số điện thoại Việt Nam hợp lệ (10 số, bắt đầu bằng 0).')
      setRegisterStep(1)
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      const registration = await registerWithApi({
        email: normalizedEmail,
        password,
        fullName: fullName.trim(),
        phone: normalizedPhone,
        permanentAddress: permanentAddress.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: normalizedEmergencyPhone,
      })
      setRecoveryAccount(normalizedEmail)
      setPendingRegistrationPassword(password)
      setRecoveryPurpose('email-verification')
      setDebugCodeHint(registration.debugCode || '')
      setVerificationCode('')
      setResetStep('verify')
      setTab('login')
      setError('')
      setNotice(registration.debugCode
        ? 'Mã xác minh development đã được tạo. Nhập mã hiển thị bên dưới để tiếp tục.'
        : `Mã xác minh đã được gửi đến ${normalizedEmail}. Hãy kiểm tra hộp thư đến hoặc thư rác.`)
    } catch (registrationError) {
      setNotice('')
      setError(formatAuthError(registrationError, 'Không thể tạo tài khoản Customer.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchTab(next: AuthTab) {
    window.history.pushState({ tab: next }, '', next === 'login' ? '/login' : '/register')
    setTab(next)
    setRegisterStep(1)
    setError('')
    setNotice('')
  }

  function startRecovery() {
    window.history.pushState({ recovery: true }, '', '/reset-password')
    setRecoveryAccount(email)
    setRecoveryPurpose('password-reset')
    setDebugCodeHint('')
    setResetStep('identify')
    setError('')
    setNotice('')
  }

  function leaveRecovery() {
    window.history.replaceState({ tab: 'login' }, '', '/login')
    setResetStep(null)
    setVerificationCode('')
    setNewPassword('')
    setNewPasswordConfirm('')
    setPendingRegistrationPassword('')
    setDebugCodeHint('')
    setRecoveryPurpose('password-reset')
    setError('')
    setNotice('')
  }

  async function findAccount(event: React.FormEvent) {
    event.preventDefault()
    if (!recoveryAccount.trim()) {
      setError('Nhập địa chỉ email của bạn.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const challenge = await requestPasswordResetWithApi(recoveryAccount.trim())
      setRecoveryPurpose('password-reset')
      setDebugCodeHint(challenge.debugCode || '')
      setVerificationCode('')
      setResetStep('verify')
      setError('')
      setNotice(challenge.debugCode
        ? 'Mã khôi phục development đã được tạo. Nhập mã hiển thị bên dưới để tiếp tục.'
        : `Mã đặt lại mật khẩu đã được gửi đến ${recoveryAccount.trim()}. Hãy kiểm tra hộp thư đến hoặc thư rác.`)
    } catch (recoveryError) {
      setNotice('')
      setError(formatAuthError(recoveryError, 'Không thể tạo yêu cầu khôi phục.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setNotice('')
    if (!verificationCode.trim()) {
      setError(recoveryPurpose === 'email-verification' ? 'Nhập mã xác minh email.' : 'Nhập mã khôi phục tài khoản.')
      return
    }
    if (recoveryPurpose === 'email-verification') {
      setIsSubmitting(true)
      try {
        await verifyEmailWithApi(recoveryAccount || undefined, verificationCode.trim())
        if (pendingRegistrationPassword && recoveryAccount) {
          const authenticated = await loginWithApi(recoveryAccount, pendingRegistrationPassword)
          onLogin(actorToUser(authenticated))
          return
        }
        setTab('login')
        window.history.replaceState({ tab: 'login' }, '', '/login')
        setNotice('Email đã được xác minh thành công. Bạn có thể đăng nhập ngay.')
        setResetStep(null)
      } catch (verificationError) {
        setError(formatAuthError(verificationError, 'Mã xác minh không hợp lệ hoặc đã hết hạn.'))
      } finally {
        setIsSubmitting(false)
      }
      return
    }
    setError('')
    setResetStep('new-password')
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await resetPasswordWithApi(recoveryAccount.includes('@') ? recoveryAccount.trim() : undefined, verificationCode.trim(), newPassword)
      setPassword(newPassword)
      setResetStep('success')
    } catch (resetError) {
      setError(formatAuthError(resetError, 'Không thể đặt lại mật khẩu.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Recovery Flow View ──────────────────────────────────────────
  if (resetStep) {
    return (
      <AuthShell compact>
        <div className="flex items-center justify-between mb-6">
          <BrandLogo />
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="text-xs font-semibold text-stone-500 hover:text-[#F59E0B] transition-colors cursor-pointer"
            >
              ← Về trang chủ
            </button>
          )}
        </div>
        <RecoveryFlow
          step={resetStep}
          account={recoveryAccount}
          setAccount={setRecoveryAccount}
          code={verificationCode}
          setCode={setVerificationCode}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={newPasswordConfirm}
          setConfirmPassword={setNewPasswordConfirm}
          error={error}
          notice={notice}
          onFindAccount={findAccount}
          onVerify={verifyCode}
          onSavePassword={saveNewPassword}
          purpose={recoveryPurpose}
          debugCodeHint={debugCodeHint}
          submitting={isSubmitting}
          onBack={() => {
            setError('')
            setResetStep(resetStep === 'verify' ? 'identify' : resetStep === 'new-password' ? 'verify' : 'identify')
          }}
          onReturnToLogin={leaveRecovery}
        />
      </AuthShell>
    )
  }

  // ── Main Auth Shell (Split Layout) ──────────────────────────────
  return (
    <AuthShell>
      {/* ── Left Panel (hidden on mobile < 768px) ── */}
      <AuthSidePanel tab={tab} />

      {/* ── Right Panel: Auth Form ── */}
      <section className="bg-[#FCFBF7] p-5 sm:p-8 md:p-10 relative flex flex-col justify-between">
        <div>
          {/* Mobile-only Header (< 768px): Logo and Slogan */}
          <div className="md:hidden flex flex-col items-center text-center mb-6 pt-1">
            <BrandLogo className="items-center" />
            <p className="text-xs text-stone-500 font-medium mt-1">Hệ thống tự lưu trữ thông minh chuẩn quốc tế</p>
          </div>

          {/* Top navigation: Back to home */}
          {onBackToHome && (
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={onBackToHome}
                className="group inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#F59E0B] transition-colors cursor-pointer"
              >
                <span className="text-sm font-bold transition-transform group-hover:-translate-x-0.5">←</span>
                <span>Về trang chủ</span>
              </button>
            </div>
          )}

          {/* Tab buttons */}
          <div className="flex items-center border-b border-stone-200 mb-5">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`pb-3 text-sm font-semibold transition-all relative border-0 bg-transparent cursor-pointer mr-6 ${
                tab === 'login'
                  ? 'text-[#F59E0B] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2.5px] after:bg-[#F59E0B]'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`pb-3 text-sm font-semibold transition-all relative border-0 bg-transparent cursor-pointer ${
                tab === 'register'
                  ? 'text-[#F59E0B] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2.5px] after:bg-[#F59E0B]'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Đăng ký
            </button>
          </div>

          {/* ── TAB 1: ĐĂNG NHẬP (LOGIN) ── */}
          {tab === 'login' ? (
            <div className="animate-in fade-in duration-200">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-stone-900">
                  Chào mừng trở lại
                </h2>
                <p className="text-[13px] text-stone-500 mt-1">
                  Đăng nhập để quản lý kho bãi, thanh toán và kiểm soát ra vào 24/7.
                </p>
              </div>

              {/* Google login button with official logo */}
              <div className="mb-4">
                <GoogleLoginButton onCredential={handleGoogleCredential} disabled={isSubmitting} />
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#FCFBF7] px-3 font-medium text-stone-400">
                    hoặc tiếp tục với email
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} noValidate>
                <FormField
                  id="login-email"
                  label="Địa chỉ email"
                  required
                  error={emailError}
                  touched={touched.loginEmail}
                >
                  <input
                    id="login-email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      if (touched.loginEmail) setTouched(prev => ({ ...prev, loginEmail: true }))
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, loginEmail: true }))}
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={getInputClassName(touched.loginEmail, emailError, Boolean(email))}
                    aria-invalid={Boolean(touched.loginEmail && emailError)}
                  />
                </FormField>

                <FormField
                  id="login-password"
                  label="Mật khẩu"
                  required
                  error={loginPasswordError}
                  touched={touched.loginPassword}
                >
                  <PasswordInput
                    id="login-password"
                    value={password}
                    onChange={val => {
                      setPassword(val)
                      if (touched.loginPassword) setTouched(prev => ({ ...prev, loginPassword: true }))
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, loginPassword: true }))}
                    show={showPassword}
                    toggle={() => setShowPassword(!showPassword)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    touched={touched.loginPassword}
                    error={loginPasswordError}
                  />
                </FormField>

                {/* Remember Me Checkbox & Forgot Password */}
                <div className="flex items-center justify-between -mt-1 mb-4 text-xs">
                  <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer text-stone-600 select-none">
                    <input
                      type="checkbox"
                      id="remember-me"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-[#F59E0B] focus:ring-[#F59E0B] cursor-pointer"
                    />
                    <span className="font-medium text-stone-700">Ghi nhớ đăng nhập</span>
                  </label>
                  <button
                    type="button"
                    onClick={startRecovery}
                    className="font-semibold text-[#F59E0B] hover:text-[#D97706] hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <NoticeMessage message={notice} />
                <ErrorMessage message={error} />

                <PrimaryButton
                  type="submit"
                  disabled={!email.trim() || !password || isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
                </PrimaryButton>
              </form>
            </div>
          ) : (
            /* ── TAB 2: ĐĂNG KÝ (REGISTER 2-STEP) ── */
            <div className="animate-in fade-in duration-200">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-stone-900">
                  Tạo tài khoản khách hàng
                </h2>
                <p className="text-[13px] text-stone-500 mt-1">
                  {registerStep === 1
                    ? 'Nhập thông tin cơ bản để bắt đầu quản lý kho tự lưu trữ.'
                    : 'Bổ sung địa chỉ và thông tin liên hệ khẩn cấp để kích hoạt quyền thuê kho.'}
                </p>
              </div>

              {/* Progress Indicator */}
              <StepIndicator
                currentStep={registerStep}
                totalSteps={2}
                stepTitles={['Thông tin cá nhân & mật khẩu', 'Địa chỉ & liên hệ khẩn cấp']}
              />

              {/* Google signup button (Shown in Step 1) */}
              {registerStep === 1 && (
                <>
                  <div className="mb-4">
                    <GoogleLoginButton
                      onCredential={handleGoogleCredential}
                      text="signup_with"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-stone-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-[#FCFBF7] px-3 font-medium text-stone-400">
                        hoặc điền thông tin bên dưới
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 1 FORM ── */}
              {registerStep === 1 ? (
                <form onSubmit={handleContinueStep1} noValidate>
                  <FormField
                    id="register-full-name"
                    label="Họ và tên"
                    required
                    error={fullNameError}
                    touched={touched.fullName}
                  >
                    <input
                      id="register-full-name"
                      value={fullName}
                      onChange={e => {
                        setFullName(e.target.value)
                        if (touched.fullName) setTouched(prev => ({ ...prev, fullName: true }))
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, fullName: true }))}
                      autoComplete="name"
                      placeholder="Nguyễn Văn An"
                      maxLength={120}
                      className={getInputClassName(touched.fullName, fullNameError, Boolean(fullName))}
                      aria-invalid={Boolean(touched.fullName && fullNameError)}
                    />
                  </FormField>

                  <FormField
                    id="register-email"
                    label="Địa chỉ email"
                    required
                    error={emailError}
                    touched={touched.email}
                  >
                    <input
                      id="register-email"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value)
                        if (touched.email) setTouched(prev => ({ ...prev, email: true }))
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      className={getInputClassName(touched.email, emailError, Boolean(email))}
                      aria-invalid={Boolean(touched.email && emailError)}
                    />
                  </FormField>

                  <FormField
                    id="register-phone"
                    label="Số điện thoại Việt Nam"
                    required
                    error={phoneError}
                    touched={touched.phone}
                  >
                    <input
                      id="register-phone"
                      value={phone}
                      onChange={e => {
                        const cleaned = cleanPhoneNumber(e.target.value)
                        setPhone(cleaned)
                        if (touched.phone) setTouched(prev => ({ ...prev, phone: true }))
                      }}
                      onPaste={e => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text')
                        const cleaned = cleanPhoneNumber(pasted)
                        setPhone(cleaned)
                        if (touched.phone) setTouched(prev => ({ ...prev, phone: true }))
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0901234567"
                      maxLength={15}
                      className={getInputClassName(touched.phone, phoneError, Boolean(phone))}
                      aria-invalid={Boolean(touched.phone && phoneError)}
                    />
                  </FormField>

                  <FormField
                    id="register-password"
                    label="Mật khẩu"
                    required
                    error={passwordError}
                    touched={touched.password}
                  >
                    <PasswordInput
                      id="register-password"
                      value={password}
                      onChange={val => {
                        setPassword(val)
                        if (touched.password) setTouched(prev => ({ ...prev, password: true }))
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                      show={showPassword}
                      toggle={() => setShowPassword(!showPassword)}
                      autoComplete="new-password"
                      placeholder="Tối thiểu 8 ký tự"
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      touched={touched.password}
                      error={passwordError}
                    />
                    {/* Password Strength Indicator */}
                    <PasswordStrength password={password} />
                  </FormField>

                  <FormField
                    id="register-confirm-password"
                    label="Xác nhận mật khẩu"
                    required
                    error={confirmPasswordError}
                    touched={touched.confirmPassword}
                  >
                    <PasswordInput
                      id="register-confirm-password"
                      value={confirmPassword}
                      onChange={val => {
                        setConfirmPassword(val)
                        if (touched.confirmPassword) setTouched(prev => ({ ...prev, confirmPassword: true }))
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                      show={showConfirmPassword}
                      toggle={() => setShowConfirmPassword(!showConfirmPassword)}
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      touched={touched.confirmPassword}
                      error={confirmPasswordError}
                    />
                  </FormField>

                  <ErrorMessage message={error} />
                  <NoticeMessage message={notice} />

                  <PrimaryButton
                    type="submit"
                    visualDisabled={!isStep1Valid}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  >
                    Tiếp tục →
                  </PrimaryButton>
                </form>
              ) : (
                /* ── STEP 2 FORM ── */
                <form onSubmit={handleRegister} noValidate>
                  {googleActor && (
                    <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">Đăng ký qua Google:</span> {googleActor.email}
                      </div>
                      <span className="text-[10px] bg-amber-200 px-2 py-0.5 rounded font-bold uppercase">Đã liên kết</span>
                    </div>
                  )}

                  <FormField
                    id="register-permanent-address"
                    label="Địa chỉ thường trú"
                    required
                    error={addressError}
                    touched={touched.permanentAddress}
                  >
                    <textarea
                      id="register-permanent-address"
                      value={permanentAddress}
                      onChange={e => {
                        setPermanentAddress(e.target.value)
                        if (touched.permanentAddress) setTouched(prev => ({ ...prev, permanentAddress: true }))
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, permanentAddress: true }))}
                      rows={2}
                      style={{ resize: 'none' }}
                      autoComplete="street-address"
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                      maxLength={500}
                      className={getInputClassName(touched.permanentAddress, addressError, Boolean(permanentAddress))}
                      aria-invalid={Boolean(touched.permanentAddress && addressError)}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                    <FormField
                      id="emergency-contact-name"
                      label="Người liên hệ khẩn cấp"
                      required
                      error={emergencyNameError}
                      touched={touched.emergencyContactName}
                    >
                      <input
                        id="emergency-contact-name"
                        value={emergencyContactName}
                        onChange={e => {
                          setEmergencyContactName(e.target.value)
                          if (touched.emergencyContactName) setTouched(prev => ({ ...prev, emergencyContactName: true }))
                        }}
                        onBlur={() => setTouched(prev => ({ ...prev, emergencyContactName: true }))}
                        autoComplete="off"
                        placeholder="Họ và tên"
                        maxLength={160}
                        className={getInputClassName(touched.emergencyContactName, emergencyNameError, Boolean(emergencyContactName))}
                        aria-invalid={Boolean(touched.emergencyContactName && emergencyNameError)}
                      />
                    </FormField>

                    <FormField
                      id="emergency-contact-phone"
                      label="SĐT liên hệ khẩn cấp"
                      required
                      error={emergencyPhoneError}
                      touched={touched.emergencyContactPhone}
                    >
                      <input
                        id="emergency-contact-phone"
                        value={emergencyContactPhone}
                        onChange={e => {
                          const cleaned = cleanPhoneNumber(e.target.value)
                          setEmergencyContactPhone(cleaned)
                          if (touched.emergencyContactPhone) setTouched(prev => ({ ...prev, emergencyContactPhone: true }))
                        }}
                        onPaste={e => {
                          e.preventDefault()
                          const pasted = e.clipboardData.getData('text')
                          const cleaned = cleanPhoneNumber(pasted)
                          setEmergencyContactPhone(cleaned)
                          if (touched.emergencyContactPhone) setTouched(prev => ({ ...prev, emergencyContactPhone: true }))
                        }}
                        onBlur={() => setTouched(prev => ({ ...prev, emergencyContactPhone: true }))}
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        placeholder="0901234567"
                        maxLength={15}
                        className={getInputClassName(touched.emergencyContactPhone, emergencyPhoneError, Boolean(emergencyContactPhone))}
                        aria-invalid={Boolean(touched.emergencyContactPhone && emergencyPhoneError)}
                      />
                    </FormField>
                  </div>

                  <ErrorMessage message={error} />
                  <NoticeMessage message={notice} />

                  <div className="flex items-center gap-3 pt-2">
                    <SecondaryButton
                      onClick={() => {
                        setError('')
                        setRegisterStep(1)
                      }}
                      disabled={isSubmitting}
                    >
                      ← Quay lại
                    </SecondaryButton>
                    <PrimaryButton
                      type="submit"
                      visualDisabled={!isStep2Valid}
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? 'Đang tạo tài khoản…' : 'Hoàn tất đăng ký'}
                    </PrimaryButton>
                  </div>
                </form>
              )}

              {/* Note under registration form */}
              <div className="mt-5 pt-3 border-t border-stone-200/80 text-center space-y-1.5">
                <p className="text-xs font-medium text-stone-500">
                  Nhân viên và quản lý: tài khoản do quản trị viên cấp.
                </p>
                <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
                  Khi đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của StorageHub.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </AuthShell>
  )
}

// ── Shared UI Subcomponents ──────────────────────────────────────

function AuthShell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <main className="auth-page flex min-h-screen items-center justify-center p-3 sm:p-6 bg-[#F3F2EB]">
      <div className={`w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl ${
        compact ? 'max-w-[520px] p-6 sm:p-10' : 'grid max-w-[960px] grid-cols-1 md:grid-cols-2'
      }`}>
        {children}
      </div>
    </main>
  )
}

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  touched?: boolean
  required?: boolean
  children: React.ReactNode
}

function FormField({ id, label, error, touched, required, children }: FormFieldProps) {
  const hasError = Boolean(touched && error)
  return (
    <div className="mb-3.5">
      <label
        htmlFor={id}
        className="mb-1 flex items-center justify-between text-[13px] font-semibold text-stone-800"
      >
        <span>
          {label} {required && <span className="text-red-500 font-bold">*</span>}
        </span>
      </label>
      {children}
      {hasError && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#EF4444] font-medium leading-tight">
          <svg className="show-icon w-3.5 h-3.5 shrink-0 text-[#EF4444]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

function getInputClassName(touched?: boolean, error?: string | null, hasValue?: boolean) {
  const base = "w-full rounded-lg px-3.5 py-2.5 text-[13.5px] transition-all duration-150 outline-none placeholder:text-stone-400 placeholder:font-normal"
  if (touched && error) {
    return `${base} !border-2 !border-[#EF4444] !bg-[#FEF2F2] text-stone-900 focus:!border-[#B91C1C] focus:!ring-2 focus:!ring-[#EF4444]/25 focus:!outline-none`
  }
  if (touched && !error && hasValue) {
    return `${base} border-2 border-emerald-400 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-stone-900`
  }
  return `${base} border border-[#CFCDC1] bg-white focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-stone-900`
}

function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  show,
  toggle,
  autoComplete,
  placeholder = "••••••••",
  minLength,
  maxLength,
  touched,
  error
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  show: boolean
  toggle: () => void
  autoComplete: string
  placeholder?: string
  minLength?: number
  maxLength?: number
  touched?: boolean
  error?: string | null
}) {
  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={onBlur}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`${getInputClassName(touched, error, Boolean(value))} pr-11`}
        aria-invalid={Boolean(touched && error)}
        aria-describedby={touched && error ? `${id}-error` : undefined}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={show}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
      >
        <Eye open={show} />
      </button>
    </div>
  )
}

function PrimaryButton({
  children,
  className = '',
  onClick,
  disabled = false,
  loading = false,
  type = 'submit',
  visualDisabled = false
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  visualDisabled?: boolean
}) {
  const isActuallyDisabled = disabled || loading
  const isVisuallyDisabled = isActuallyDisabled || visualDisabled
  return (
    <button
      type={onClick ? 'button' : type}
      onClick={onClick}
      disabled={isActuallyDisabled}
      className={`w-full rounded-lg border-0 py-2.5 sm:py-3 px-4 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 select-none ${
        isVisuallyDisabled
          ? 'bg-[#F59E0B]/50 text-[#1F2328]'
          : 'bg-[#F59E0B] text-white hover:bg-[#D97706] hover:shadow cursor-pointer'
      } ${isActuallyDisabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {loading && (
        <svg className="show-icon w-4 h-4 animate-spin text-[#1F2328] shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
  disabled = false
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-stone-300 bg-white py-2.5 sm:py-3 px-4 sm:px-5 text-sm font-bold text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="mb-3.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 font-medium">
      {message}
    </p>
  ) : null
}

function NoticeMessage({ message }: { message: string }) {
  return message ? (
    <p role="status" className="mb-3.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-800 font-medium">
      {message}
    </p>
  ) : null
}

function Eye({ open }: { open: boolean }) {
  return (
    <svg className="show-icon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {open && <path d="m4 4 16 16" />}
    </svg>
  )
}

// ── Recovery Flow Subcomponent (Preserved) ────────────────────────
function RecoveryFlow({
  step,
  account,
  setAccount,
  code,
  setCode,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  notice,
  onFindAccount,
  onVerify,
  onSavePassword,
  onBack,
  onReturnToLogin,
  purpose,
  debugCodeHint,
  submitting
}: {
  step: ResetStep
  account: string
  setAccount: (value: string) => void
  code: string
  setCode: (value: string) => void
  newPassword: string
  setNewPassword: (value: string) => void
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  error: string
  notice: string
  onFindAccount: (event: React.FormEvent) => void
  onVerify: (event: React.FormEvent) => void
  onSavePassword: (event: React.FormEvent) => void
  onBack: () => void
  onReturnToLogin: () => void
  purpose: RecoveryPurpose
  debugCodeHint: string
  submitting: boolean
}) {
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  if (step === 'success') {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="show-icon w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900">
          {purpose === 'email-verification' ? 'Xác minh email thành công' : 'Cập nhật mật khẩu thành công'}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
          {purpose === 'email-verification'
            ? 'Email đã được xác minh. Bạn có thể đăng nhập vào StorageHub ngay.'
            : 'Mật khẩu của bạn đã được thay đổi. Bạn có thể đăng nhập ngay bằng mật khẩu mới.'}
        </p>
        <PrimaryButton className="mt-6" onClick={onReturnToLogin}>
          Quay lại đăng nhập
        </PrimaryButton>
      </div>
    )
  }

  const copy = {
    identify: {
      title: 'Tìm tài khoản của bạn',
      text: 'Nhập số điện thoại hoặc email liên kết với tài khoản StorageHub.'
    },
    verify: {
      title: purpose === 'email-verification' ? 'Xác minh email để hoàn tất đăng ký' : 'Nhập mã khôi phục tài khoản',
      text: purpose === 'email-verification'
        ? `Mã xác minh đã được gửi đến ${account || 'email của bạn'}. Nhập mã 6 chữ số bên dưới.`
        : `Mã đặt lại mật khẩu đã được gửi đến ${account}. Nhập mã 6 chữ số để tiếp tục.`
    },
    'new-password': {
      title: 'Tạo mật khẩu mới',
      text: 'Tạo mật khẩu mạnh mà bạn chưa từng sử dụng trước đây.'
    },
  }[step]

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.1em] text-[#F59E0B]">
        {purpose === 'email-verification' ? 'XÁC MINH EMAIL' : 'KHÔI PHỤC TÀI KHOẢN'}
      </p>
      <h1 className="text-2xl font-bold text-stone-900">{copy.title}</h1>
      <p className="mt-2 text-sm leading-6 text-stone-500">{copy.text}</p>
      <div className="my-6 flex gap-2" aria-label="Recovery progress">
        {['identify', 'verify', 'new-password'].map((item, index) => (
          <span
            key={item}
            className={`h-1 flex-1 rounded ${
              index <= ['identify', 'verify', 'new-password'].indexOf(step) ? 'bg-[#F59E0B]' : 'bg-stone-200'
            }`}
          />
        ))}
      </div>

      {step === 'identify' && (
        <form onSubmit={onFindAccount}>
          <FormField id="recovery-account" label="Số điện thoại hoặc Email">
            <input
              id="recovery-account"
              value={account}
              onChange={event => setAccount(event.target.value)}
              autoFocus
              placeholder="Nhập SĐT hoặc email..."
              className={getInputClassName(false, null, Boolean(account))}
            />
          </FormField>
          <ErrorMessage message={error} />
          <PrimaryButton disabled={submitting} loading={submitting}>
            {submitting ? 'Đang gửi…' : 'Tiếp Tục'}
          </PrimaryButton>
          <SecondaryButton onClick={onReturnToLogin}>Hủy Bỏ</SecondaryButton>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={onVerify}>
          <FormField id="verification-code" label={purpose === 'email-verification' ? 'Mã xác minh email' : 'Mã đặt lại mật khẩu'}>
            <input
              id="verification-code"
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              autoFocus
              inputMode="numeric"
              placeholder="Nhập mã 6 chữ số"
              className="w-full text-center font-mono text-xl tracking-[.35em] py-3 rounded-lg border border-[#CFCDC1] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none"
            />
          </FormField>
          {debugCodeHint && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {purpose === 'email-verification' ? 'Mã xác minh email development: ' : 'Mã khôi phục development: '}
              <strong className="font-mono">{debugCodeHint}</strong>
            </div>
          )}
          <NoticeMessage message={notice} />
          <ErrorMessage message={error} />
          <PrimaryButton disabled={submitting} loading={submitting}>
            {submitting ? 'Đang xác minh…' : 'Xác Nhận Mã'}
          </PrimaryButton>
          <SecondaryButton onClick={onBack}>Dùng tài khoản khác</SecondaryButton>
        </form>
      )}

      {step === 'new-password' && (
        <form onSubmit={onSavePassword}>
          <FormField id="new-password" label="Mật khẩu mới">
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNewPassword}
              toggle={() => setShowNewPassword(current => !current)}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
            />
            <PasswordStrength password={newPassword} />
          </FormField>
          <FormField id="new-password-confirm" label="Xác nhận mật khẩu mới">
            <PasswordInput
              id="new-password-confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPassword}
              toggle={() => setShowConfirmPassword(current => !current)}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
            />
          </FormField>
          <p className="-mt-1 mb-4 text-xs text-stone-500">
            {PASSWORD_POLICY_HINT}
          </p>
          <NoticeMessage message={notice} />
          <ErrorMessage message={error} />
          <PrimaryButton disabled={submitting} loading={submitting}>
            {submitting ? 'Đang lưu…' : 'Lưu Mật Khẩu Mới'}
          </PrimaryButton>
          <SecondaryButton onClick={onBack}>Quay Lại</SecondaryButton>
        </form>
      )}
    </div>
  )
}
