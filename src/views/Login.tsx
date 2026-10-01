import { useEffect, useState } from 'react'
import type { User } from '../types'
import BrandLogo from '../components/BrandLogo'
import { actorToUser, loginWithApi, registerWithApi, requestPasswordResetWithApi, resetPasswordWithApi, verifyEmailWithApi } from '../services/authApi'

interface LoginProps {
  onLogin: (user: User) => void
  onBackToHome?: () => void
  initialTab?: 'login' | 'register'
}
type AuthTab = 'login' | 'register'
type ResetStep = 'identify' | 'verify' | 'new-password' | 'success'
type RecoveryPurpose = 'password-reset' | 'email-verification'


export default function Login({ onLogin, onBackToHome, initialTab = 'login' }: LoginProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab)

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
    }
  }, [initialTab])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [resetStep, setResetStep] = useState<ResetStep | null>(null)
  const [recoveryAccount, setRecoveryAccount] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [recoveryPurpose, setRecoveryPurpose] = useState<RecoveryPurpose>('password-reset')
  const [pendingRegistrationPassword, setPendingRegistrationPassword] = useState('')
  const [debugCodeHint, setDebugCodeHint] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    const verificationToken = url.searchParams.get('verifyEmail')
    const resetToken = url.searchParams.get('resetPassword')
    if (verificationToken || resetToken) {
      setRecoveryAccount('')
      setVerificationCode(verificationToken || resetToken || '')
      setRecoveryPurpose(verificationToken ? 'email-verification' : 'password-reset')
      setResetStep(verificationToken || resetToken ? 'verify' : null)
    }
  }, [])


  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    setError('')
    setIsSubmitting(true)
    try {
      const actor = await loginWithApi(normalizedEmail, password)
      onLogin(actorToUser(actor))
      return
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Đăng nhập thất bại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }
    if (password.length < 12) {
      setError('Mật khẩu phải có ít nhất 12 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const normalizedEmail = email.trim().toLowerCase()
    setError('')
    setIsSubmitting(true)
    try {
      const registration = await registerWithApi({ email: normalizedEmail, password, fullName, phone })
      setRecoveryAccount(normalizedEmail)
      setPendingRegistrationPassword(password)
      setRecoveryPurpose('email-verification')
      setDebugCodeHint(registration.debugCode || '')
      setVerificationCode(registration.debugCode || '')
      setResetStep('verify')
      setTab('login')
      setError(registration.debugCode
        ? `Tài khoản đã tạo. Mã xác minh dev: ${registration.debugCode}`
        : 'Tài khoản đã tạo. Hãy nhập mã xác minh được gửi đến email.')
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'Không thể tạo tài khoản Customer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchTab(next: AuthTab) {
    setTab(next)
    setError('')
  }

  function startRecovery() {
    setRecoveryAccount(email)
    setRecoveryPurpose('password-reset')
    setDebugCodeHint('')
    setResetStep('identify')
    setError('')
  }

  function leaveRecovery() {
    setResetStep(null)
    setVerificationCode('')
    setNewPassword('')
    setNewPasswordConfirm('')
    setPendingRegistrationPassword('')
    setDebugCodeHint('')
    setRecoveryPurpose('password-reset')
    setError('')
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
      setVerificationCode(challenge.debugCode || '')
      setResetStep('verify')
      setError(challenge.debugCode ? `Mã xác minh dev: ${challenge.debugCode}` : 'Hãy nhập mã được gửi đến email của bạn.')
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'Không thể tạo yêu cầu khôi phục.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (!verificationCode.trim()) {
      setError('Nhập mã xác thực hoặc token trong email.')
      return
    }
    if (recoveryPurpose === 'email-verification') {
      setIsSubmitting(true)
      try {
        const actor = await verifyEmailWithApi(recoveryAccount || undefined, verificationCode.trim())
        if (pendingRegistrationPassword && recoveryAccount) {
          const authenticated = await loginWithApi(recoveryAccount, pendingRegistrationPassword)
          onLogin(actorToUser(authenticated))
          return
        }
        setError('Email đã được xác minh. Bạn có thể đăng nhập bằng mật khẩu của mình.')
        setResetStep(null)
      } catch (verificationError) {
        setError(verificationError instanceof Error ? verificationError.message : 'Mã xác minh không hợp lệ.')
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
    if (newPassword.length < 12) {
      setError('Mật khẩu mới phải có ít nhất 12 ký tự.')
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
      setError(resetError instanceof Error ? resetError.message : 'Không thể đặt lại mật khẩu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (resetStep) {
    return (
      <AuthShell compact>
        <div className="flex items-center justify-between mb-6">
          <BrandLogo />
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="text-xs font-semibold text-stone-500 hover:text-[#e9a12c] transition-colors"
            >
              ← Về Trang Chủ
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

  return (
    <AuthShell>
      <section className="hidden flex-col bg-[#292a27] p-10 text-white md:flex">
        <BrandLogo light className="mb-8" />
        <p className="mb-2.5 text-xs font-semibold tracking-wider text-[#e9a12c]">SELF-STORAGE</p>
        <h1 className="mb-3.5 text-[30px] font-bold leading-tight">
          {'Nền Tảng Quản Lý Kho'}
        </h1>
        <p className="mb-7 max-w-[32ch] text-sm leading-relaxed text-[#aaa99e]">
          {'Hệ thống hợp nhất giúp khách thuê và đội ngũ cơ sở quản lý kho bãi, thanh toán và kiểm soát ra vào bảo mật.'}
        </p>
        <div className="mb-8 flex gap-2.5">
          {[
            ['500+', 'Cơ sở kho'],
            ['98%', 'Độ ổn định SLA'],
            ['24/7', 'Hỗ trợ']
          ].map(([value, label]) => (
            <div key={label} className="flex-1 rounded-lg border border-[#44453f] bg-[#353630] px-2 py-2.5 text-center">
              <b className="block text-base">{value}</b>
              <span className="mt-0.5 block text-[10.5px] text-[#aaa99e]">{label}</span>
            </div>
          ))}
        </div>
        <p className="mb-3.5 text-[11px] font-semibold tracking-wider text-[#aaa99e]">
          {'TÍNH NĂNG NỔI BẬT'}
        </p>
        <ul className="flex list-none flex-col gap-3 p-0">
          {[
            'Kiểm tra kho trống theo thời gian thực',
            'Mở cửa bằng mã PIN & thẻ từ điện tử',
            'Tự động hóa thanh toán và gia hạn',
            'Hỗ trợ khách hàng đa kênh tập trung'
          ].map(item => (
            <li key={item} className="flex items-center gap-2.5 text-[13.5px] text-[#e5e3da]">
              <i className="h-[7px] w-[7px] shrink-0 rotate-45 bg-[#e9a12c]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="p-7 sm:p-9 md:px-11 md:py-10 relative">
        {onBackToHome && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onBackToHome}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-[#e9a12c] transition-colors"
            >
              <span className="text-sm font-bold transition-transform group-hover:-translate-x-0.5">←</span>
              <span>Về Trang Chủ</span>
            </button>
          </div>
        )}
        {/* Auth tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-6 border-b border-[#e5e3da] flex-1 mr-4">
            {(['login', 'register'] as const).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => switchTab(item)}
                className={`relative border-0 bg-transparent pb-3 text-sm ${
                  tab === item
                    ? 'font-semibold text-[#9a5a05] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[#e9a12c]'
                    : 'font-medium text-[#8b897f]'
                }`}
              >
                {item === 'login'
                  ? ('Đăng Nhập')
                  : ('Tạo Tài Khoản')}
              </button>
            ))}
          </div>
        </div>

        {tab === 'login' ? (
          <>
            <div>
              <h2 className="mb-1.5 text-xl font-bold text-[#24241f]">
                {'Chào mừng trở lại'}
              </h2>
              <p className="mb-5 text-[13px] text-[#77766d]">
                {'Đăng nhập để truy cập bảng điều khiển StorageHub của bạn.'}
              </p>

            </div>

            <form onSubmit={handleLogin} noValidate>
              <Field id="login-email" label={'Địa chỉ email'}>
                <input
                  id="login-email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                />
              </Field>
              <Field id="login-password" label={'Mật khẩu'}>
                <PasswordInput
                  id="login-password"
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  toggle={() => setShowPassword(!showPassword)}
                  autoComplete="current-password"
                />
              </Field>
              <div className="-mt-1.5 mb-[18px] flex justify-end">
                <button
                  type="button"
                  onClick={startRecovery}
                  className="border-0 bg-transparent text-xs font-semibold text-[#9a5a05] hover:underline"
                >
                  {'Quên mật khẩu?'}
                </button>
              </div>
              <ErrorMessage message={error} />
              <PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Đang đăng nhập…' : 'Đăng Nhập'}</PrimaryButton>
            </form>

          </>
        ) : (
          <form onSubmit={handleRegister} noValidate>
            <h2 className="mb-1.5 text-xl font-bold text-[#24241f]">
              {'Đăng ký tài khoản'}
            </h2>
            <p className="mb-5 text-[13px] text-[#77766d]">
              {'Tạo tài khoản khách hàng để đặt giữ chỗ và quản lý kho lưu trữ.'}
            </p>

            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field id="first-name" label={'Tên'}>
                <input id="first-name" value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="given-name" />
              </Field>
              <Field id="last-name" label={'Họ và đệm'}>
                <input id="last-name" value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="family-name" />
              </Field>
            </div>
            <Field id="register-email" label={'Địa chỉ email'}>
              <input id="register-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" />
            </Field>
            <Field id="phone" label={'Số điện thoại'}>
              <input id="phone" value={phone} onChange={event => setPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="0901 234 567" />
            </Field>
            <Field id="register-password" label={'Mật khẩu'}>
              <PasswordInput id="register-password" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
            </Field>
            <Field id="confirm-password" label={'Xác nhận mật khẩu'}>
              <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
            </Field>
            <ErrorMessage message={error} />
            <PrimaryButton disabled={isSubmitting}>{isSubmitting ? 'Đang tạo tài khoản…' : 'Hoàn Tất Đăng Ký'}</PrimaryButton>
            <p className="mt-[18px] text-center text-[11.5px] leading-relaxed text-[#8b897f]">
              {'Khi đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của StorageHub.'}
            </p>
          </form>
        )}
      </section>

    </AuthShell>
  )
}


function RecoveryFlow({ step, account, setAccount, code, setCode, newPassword, setNewPassword, confirmPassword, setConfirmPassword, error, onFindAccount, onVerify, onSavePassword, onBack, onReturnToLogin, purpose, debugCodeHint, submitting }: {
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
  onFindAccount: (event: React.FormEvent) => void
  onVerify: (event: React.FormEvent) => void
  onSavePassword: (event: React.FormEvent) => void
  onBack: () => void
  onReturnToLogin: () => void
  purpose: RecoveryPurpose
  debugCodeHint: string
  submitting: boolean
}) {

  if (step === 'success') {
    return (
      <div className="text-center">
        <StatusIcon />
        <h1 className="mt-5 text-2xl font-bold text-stone-900">
          {purpose === 'email-verification' ? 'Xác minh email thành công' : 'Cập nhật mật khẩu thành công'}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
          {purpose === 'email-verification' ? 'Email đã được xác minh. Bạn có thể đăng nhập vào StorageHub.' : 'Mật khẩu của bạn đã được thay đổi. Bạn có thể đăng nhập ngay bằng mật khẩu mới.'}
        </p>
        <PrimaryButton className="mt-6" onClick={onReturnToLogin}>
          {'Quay lại Đăng nhập'}
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
      title: 'Nhập mã xác thực bảo mật',
      text: purpose === 'email-verification'
        ? `Chúng tôi đã gửi mã xác minh đến ${account || 'email của bạn'}. Nhập mã hoặc token liên kết bên dưới.`
        : `Chúng tôi đã gửi mã 6 chữ số đến ${account}. Nhập mã bên dưới để tiếp tục.`
    },
    'new-password': {
      title: 'Tạo mật khẩu mới',
      text: 'Tạo mật khẩu mạnh mà bạn chưa từng sử dụng trước đây.'
    },
  }[step]

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.1em] text-[#9a5a05]">
        {'KHÔI PHỤC TÀI KHOẢN'}
      </p>
      <h1 className="text-2xl font-bold text-stone-900">{copy.title}</h1>
      <p className="mt-2 text-sm leading-6 text-stone-500">{copy.text}</p>
      <div className="my-6 flex gap-2" aria-label="Recovery progress">
        {['identify', 'verify', 'new-password'].map((item, index) => (
          <span
            key={item}
            className={`h-1 flex-1 rounded ${
              index <= ['identify', 'verify', 'new-password'].indexOf(step) ? 'bg-[#e9a12c]' : 'bg-stone-200'
            }`}
          />
        ))}
      </div>

      {step === 'identify' && (
        <form onSubmit={onFindAccount}>
          <Field id="recovery-account" label={'Số điện thoại hoặc Email'}>
            <input
              id="recovery-account"
              value={account}
              onChange={event => setAccount(event.target.value)}
              autoFocus
              placeholder={'Nhập SĐT hoặc email...'}
            />
          </Field>
          <ErrorMessage message={error} />
          <PrimaryButton disabled={submitting}>{submitting ? 'Đang gửi…' : 'Tiếp Tục'}</PrimaryButton>
          <SecondaryButton onClick={onReturnToLogin}>{'Hủy Bỏ'}</SecondaryButton>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={onVerify}>
          <Field id="verification-code" label={purpose === 'email-verification' ? 'Mã hoặc liên kết xác thực' : 'Mã hoặc liên kết đặt lại mật khẩu'}>
            <input
              id="verification-code"
              value={code}
              onChange={event => setCode(event.target.value.trim().slice(0, 128))}
              autoComplete="one-time-code"
              autoFocus
              placeholder={purpose === 'email-verification' ? '123456 hoặc token từ email' : '123456 hoặc token từ email'}
              className="text-center font-mono text-lg tracking-[.35em]"
            />
          </Field>
          {debugCodeHint && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{'Mã xác minh development: '}<strong className="font-mono">{debugCodeHint}</strong></div>}
          <ErrorMessage message={error} />
          <PrimaryButton disabled={submitting}>{submitting ? 'Đang xác minh…' : 'Xác Nhận Mã'}</PrimaryButton>
          <SecondaryButton onClick={onBack}>
            {'Dùng tài khoản khác'}
          </SecondaryButton>
        </form>
      )}

      {step === 'new-password' && (
        <form onSubmit={onSavePassword}>
          <Field id="new-password" label={'Mật khẩu mới'}>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              show={false}
              toggle={() => undefined}
              autoComplete="new-password"
              hideToggle
            />
          </Field>
          <Field id="new-password-confirm" label={'Xác nhận mật khẩu mới'}>
            <PasswordInput
              id="new-password-confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={false}
              toggle={() => undefined}
              autoComplete="new-password"
              hideToggle
            />
          </Field>
          <p className="-mt-2 mb-4 text-xs text-stone-500">
            {'Sử dụng ít nhất 12 ký tự.'}
          </p>
          <ErrorMessage message={error} />
          <PrimaryButton disabled={submitting}>{submitting ? 'Đang lưu…' : 'Lưu Mật Khẩu Mới'}</PrimaryButton>
          <SecondaryButton onClick={onBack}>{'Quay Lại'}</SecondaryButton>
        </form>
      )}
    </div>
  )
}


function AuthShell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return <main className="auth-page"><div className={compact ? 'auth-recovery-card' : 'auth-main-card'}>{children}</div></main>
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="mb-4"><label htmlFor={id} className="mb-1.5 block text-[12.5px] font-semibold text-[#3f403a]">{label}</label>{children}</div>
}

function PasswordInput({ id, value, onChange, show, toggle, autoComplete, hideToggle = false }: { id: string; value: string; onChange: (value: string) => void; show: boolean; toggle: () => void; autoComplete: string; hideToggle?: boolean }) {
  return <div className="relative"><input id={id} value={value} onChange={event => onChange(event.target.value)} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder="••••••••" className={hideToggle ? '' : 'pr-10'} />{!hideToggle && <button type="button" onClick={toggle} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 border-0 bg-transparent text-[#77766d]"><Eye open={show} /></button>}</div>
}

function PrimaryButton({ children, className = '', onClick, disabled = false }: { children: React.ReactNode; className?: string; onClick?: () => void; disabled?: boolean }) {
  return <button type={onClick ? 'button' : 'submit'} onClick={onClick} disabled={disabled} className={`w-full rounded-lg border-0 bg-[#e9a12c] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d8901f] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}>{children}</button>
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mt-3 w-full rounded-lg border-0 bg-transparent py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100">{children}</button>
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null
}

function StatusIcon() {
  return null
}

function Eye({ open }: { open: boolean }) {
  return open ? 'Ẩn' : 'Hiện'
}
