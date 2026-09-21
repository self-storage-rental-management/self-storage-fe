import { useState } from 'react'
import type { User } from '../types'
import BrandLogo from '../components/BrandLogo'
import { useLanguage } from '../i18n/LanguageContext'
import { useStorageHub } from '../store/StorageHubContext'

interface LoginProps { onLogin: (user: User) => void }
type AuthTab = 'login' | 'register'
type ResetStep = 'identify' | 'verify' | 'new-password' | 'success'

const DEMO_PASSWORD = 'demo123'
const DEMO_CODE = '123456'
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  )
}


export default function Login({ onLogin }: LoginProps) {
  const { users, registerCustomer } = useStorageHub()
  const [tab, setTab] = useState<AuthTab>('login')
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
  const [googleModal, setGoogleModal] = useState(false)

  const { lang, t } = useLanguage()

  function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    const demoUser = users.find(user => user.status !== 'suspended' && user.email === email.trim().toLowerCase())
    if (!demoUser || password !== DEMO_PASSWORD) {
      setError(
        lang === 'vi'
          ? 'Email hoặc mật khẩu không đúng.'
          : 'Invalid email or password.'
      )
      return
    }
    onLogin(demoUser)
  }

  function handleGoogleCustomerLogin(googleUser: { name: string; email: string }) {
    try {
      const customer = registerCustomer({ name: googleUser.name, email: googleUser.email, phone: '' })
      setGoogleModal(false)
      onLogin(customer)
    } catch (error) {
      setError(error instanceof Error ? error.message : (lang === 'vi' ? 'Không thể tạo tài khoản Customer.' : 'Unable to create the customer account.'))
    }
  }

  function handleRegister(event: React.FormEvent) {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError(lang === 'vi' ? 'Vui lòng điền đầy đủ các thông tin bắt buộc.' : 'Please complete all required fields.')
      return
    }
    if (password.length < 8) {
      setError(lang === 'vi' ? 'Mật khẩu phải có ít nhất 8 ký tự.' : 'Password must contain at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError(lang === 'vi' ? 'Mật khẩu nhập lại không khớp.' : 'Passwords do not match.')
      return
    }
    try {
      const customer = registerCustomer({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email,
        phone
      })
      onLogin(customer)
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : (lang === 'vi' ? 'Không thể tạo tài khoản Customer.' : 'Unable to create the customer account.'))
    }
  }

  function switchTab(next: AuthTab) {
    setTab(next)
    setError('')
  }

  function startRecovery() {
    setRecoveryAccount(email)
    setResetStep('identify')
    setError('')
  }

  function leaveRecovery() {
    setResetStep(null)
    setVerificationCode('')
    setNewPassword('')
    setNewPasswordConfirm('')
    setError('')
  }

  function findAccount(event: React.FormEvent) {
    event.preventDefault()
    if (!recoveryAccount.trim()) {
      setError(lang === 'vi' ? 'Nhập số điện thoại hoặc địa chỉ email của bạn.' : 'Enter your mobile number or email address.')
      return
    }
    setError('')
    setResetStep('verify')
  }

  function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (verificationCode !== DEMO_CODE) {
      setError(lang === 'vi' ? `Nhập mã xác thực demo: ${DEMO_CODE}.` : `For this demo, enter the verification code ${DEMO_CODE}.`)
      return
    }
    setError('')
    setResetStep('new-password')
  }

  function saveNewPassword(event: React.FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setError(lang === 'vi' ? 'Mật khẩu mới phải có ít nhất 8 ký tự.' : 'New password must contain at least 8 characters.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError(lang === 'vi' ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.')
      return
    }
    setError('')
    setPassword(newPassword)
    setResetStep('success')
  }

  if (resetStep) {
    return (
      <AuthShell compact>
        <div className="flex items-center justify-between mb-6">
          <BrandLogo />
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
          {lang === 'vi' ? 'Nền Tảng Quản Lý Kho' : 'Management Platform'}
        </h1>
        <p className="mb-7 max-w-[32ch] text-sm leading-relaxed text-[#aaa99e]">
          {lang === 'vi'
            ? 'Hệ thống hợp nhất giúp khách thuê và đội ngũ cơ sở quản lý kho bãi, thanh toán và kiểm soát ra vào bảo mật.'
            : 'A unified system for customers and facility teams to manage rentals, payments and secure access.'}
        </p>
        <div className="mb-8 flex gap-2.5">
          {[
            ['500+', lang === 'vi' ? 'Cơ sở kho' : 'Facilities'],
            ['98%', lang === 'vi' ? 'Độ ổn định SLA' : 'Uptime SLA'],
            ['24/7', lang === 'vi' ? 'Hỗ trợ' : 'Support']
          ].map(([value, label]) => (
            <div key={label} className="flex-1 rounded-lg border border-[#44453f] bg-[#353630] px-2 py-2.5 text-center">
              <b className="block text-base">{value}</b>
              <span className="mt-0.5 block text-[10.5px] text-[#aaa99e]">{label}</span>
            </div>
          ))}
        </div>
        <p className="mb-3.5 text-[11px] font-semibold tracking-wider text-[#aaa99e]">
          {lang === 'vi' ? 'TÍNH NĂNG NỔI BẬT' : 'PLATFORM FEATURES'}
        </p>
        <ul className="flex list-none flex-col gap-3 p-0">
          {[
            lang === 'vi' ? 'Kiểm tra kho trống theo thời gian thực' : 'Real-time unit availability',
            lang === 'vi' ? 'Mở cửa bằng mã PIN & thẻ từ điện tử' : 'Secure digital access',
            lang === 'vi' ? 'Tự động hóa thanh toán và gia hạn' : 'Automated billing and renewals',
            lang === 'vi' ? 'Hỗ trợ khách hàng đa kênh tập trung' : 'Customer support in one place'
          ].map(item => (
            <li key={item} className="flex items-center gap-2.5 text-[13.5px] text-[#e5e3da]">
              <i className="h-[7px] w-[7px] shrink-0 rotate-45 bg-[#e9a12c]" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="p-7 sm:p-9 md:px-11 md:py-10 relative">
        {/* Top Header with Language Switcher */}
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
                  ? (lang === 'vi' ? 'Đăng Nhập' : 'Sign In')
                  : (lang === 'vi' ? 'Tạo Tài Khoản' : 'Create Account')}
              </button>
            ))}
          </div>
        </div>

        {tab === 'login' ? (
          <>
            <div>
              <h2 className="mb-1.5 text-xl font-bold text-[#24241f]">
                {lang === 'vi' ? 'Chào mừng trở lại' : 'Welcome back'}
              </h2>
              <p className="mb-5 text-[13px] text-[#77766d]">
                {lang === 'vi'
                  ? 'Đăng nhập để truy cập bảng điều khiển StorageHub của bạn.'
                  : 'Sign in to access your StorageHub dashboard.'}
              </p>

              {/* Continue with Google button */}
              <button
                type="button"
                onClick={() => setGoogleModal(true)}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 hover:border-stone-400 text-stone-700 font-medium text-sm transition-all shadow-sm active:scale-[0.99] mb-4"
              >
                <GoogleIcon />
                <span>{lang === 'vi' ? 'Tiếp tục với Google' : 'Continue with Google'}</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#fcfbf7] sm:bg-white px-2.5 text-stone-400 font-medium">
                    {lang === 'vi' ? 'hoặc tiếp tục với email' : 'or continue with email'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} noValidate>
              <Field id="login-email" label={lang === 'vi' ? 'Địa chỉ email' : 'Email address'}>
                <input
                  id="login-email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                />
              </Field>
              <Field id="login-password" label={lang === 'vi' ? 'Mật khẩu' : 'Password'}>
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
                  {lang === 'vi' ? 'Quên mật khẩu?' : 'Forgot password?'}
                </button>
              </div>
              <ErrorMessage message={error} />
              <PrimaryButton>{lang === 'vi' ? 'Đăng Nhập' : 'Sign In'}</PrimaryButton>
            </form>

          </>
        ) : (
          <form onSubmit={handleRegister} noValidate>
            <h2 className="mb-1.5 text-xl font-bold text-[#24241f]">
              {lang === 'vi' ? 'Đăng ký tài khoản' : 'Create your account'}
            </h2>
            <p className="mb-5 text-[13px] text-[#77766d]">
              {lang === 'vi'
                ? 'Tạo tài khoản khách hàng để đặt giữ chỗ và quản lý kho lưu trữ.'
                : 'Create a customer account to reserve and manage storage.'}
            </p>

            {/* Google sign up option */}
            <button
              type="button"
              onClick={() => setGoogleModal(true)}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 hover:border-stone-400 text-stone-700 font-medium text-sm transition-all shadow-sm active:scale-[0.99] mb-4"
            >
              <GoogleIcon />
              <span>{lang === 'vi' ? 'Đăng ký nhanh với Google' : 'Sign up with Google'}</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#fcfbf7] sm:bg-white px-2.5 text-stone-400 font-medium">
                  {lang === 'vi' ? 'hoặc điền thông tin bên dưới' : 'or fill in details'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field id="first-name" label={lang === 'vi' ? 'Tên' : 'First name'}>
                <input id="first-name" value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="given-name" />
              </Field>
              <Field id="last-name" label={lang === 'vi' ? 'Họ và đệm' : 'Last name'}>
                <input id="last-name" value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="family-name" />
              </Field>
            </div>
            <Field id="register-email" label={lang === 'vi' ? 'Địa chỉ email' : 'Email address'}>
              <input id="register-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" />
            </Field>
            <Field id="phone" label={lang === 'vi' ? 'Số điện thoại' : 'Phone number'}>
              <input id="phone" value={phone} onChange={event => setPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="0901 234 567" />
            </Field>
            <Field id="register-password" label={lang === 'vi' ? 'Mật khẩu' : 'Password'}>
              <PasswordInput id="register-password" value={password} onChange={setPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
            </Field>
            <Field id="confirm-password" label={lang === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm password'}>
              <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} show={showPassword} toggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
            </Field>
            <ErrorMessage message={error} />
            <PrimaryButton>{lang === 'vi' ? 'Hoàn Tất Đăng Ký' : 'Create Account'}</PrimaryButton>
            <p className="mt-[18px] text-center text-[11.5px] leading-relaxed text-[#8b897f]">
              {lang === 'vi'
                ? 'Khi đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của StorageHub.'
                : 'By creating an account you agree to our Terms of Service and Privacy Policy.'}
            </p>
          </form>
        )}
      </section>

      {/* Google OAuth Account Chooser Modal */}
      {googleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-stone-900">
            {/* Header */}
            <div className="p-6 text-center border-b border-stone-100">
              <div className="flex justify-center mb-3">
                <GoogleIcon />
              </div>
              <h3 className="text-lg font-bold text-stone-900">
                {lang === 'vi' ? 'Đăng nhập bằng Google' : 'Sign in with Google'}
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                {lang === 'vi' ? 'để tiếp tục đến StorageHub Platform' : 'to continue to StorageHub Platform'}
              </p>
            </div>

            {/* Account List */}
            <div className="p-4 space-y-2 divide-y divide-stone-100">
              <button
                type="button"
                onClick={() => handleGoogleCustomerLogin({ name: 'Alex Morgan', email: 'alex.morgan@gmail.com' })}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-stone-50 transition text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0">
                  A
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 group-hover:text-blue-600 truncate">Alex Morgan</p>
                  <p className="text-xs text-stone-400 truncate">alex.morgan@gmail.com</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {lang === 'vi' ? 'Khách Hàng' : 'Customer'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleGoogleCustomerLogin({ name: 'Google Demo User', email: 'user.google@storagehub.vn' })}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-stone-50 transition text-left group pt-3"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                  G
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 group-hover:text-amber-600 truncate">
                    {lang === 'vi' ? 'Tài khoản Google bất kỳ' : 'Any Google Account'}
                  </p>
                  <p className="text-xs text-stone-400 truncate">user.google@storagehub.vn</p>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setGoogleModal(false)}
                className="text-xs text-stone-500 hover:text-stone-800 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-200/60"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <span className="text-[11px] text-stone-400">
                StorageHub Google Identity Service
              </span>
            </div>
          </div>
        </div>
      )}
    </AuthShell>
  )
}


function RecoveryFlow({ step, account, setAccount, code, setCode, newPassword, setNewPassword, confirmPassword, setConfirmPassword, error, onFindAccount, onVerify, onSavePassword, onBack, onReturnToLogin }: {
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
}) {
  const { lang } = useLanguage()

  if (step === 'success') {
    return (
      <div className="text-center">
        <StatusIcon />
        <h1 className="mt-5 text-2xl font-bold text-stone-900">
          {lang === 'vi' ? 'Cập nhật mật khẩu thành công' : 'Password updated'}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
          {lang === 'vi'
            ? 'Mật khẩu của bạn đã được thay đổi. Bạn có thể đăng nhập ngay bằng mật khẩu mới.'
            : 'Your password has been changed successfully. You can now sign in with your new password.'}
        </p>
        <PrimaryButton className="mt-6" onClick={onReturnToLogin}>
          {lang === 'vi' ? 'Quay lại Đăng nhập' : 'Back to Sign In'}
        </PrimaryButton>
      </div>
    )
  }

  const copy = {
    identify: {
      title: lang === 'vi' ? 'Tìm tài khoản của bạn' : 'Find your account',
      text: lang === 'vi' ? 'Nhập số điện thoại hoặc email liên kết với tài khoản StorageHub.' : 'Enter the mobile number or email address connected to your StorageHub account.'
    },
    verify: {
      title: lang === 'vi' ? 'Nhập mã xác thực bảo mật' : 'Enter security code',
      text: lang === 'vi' ? `Chúng tôi đã gửi mã 6 chữ số đến ${account}. Nhập mã bên dưới để tiếp tục.` : `We sent a 6-digit code to ${account}. Enter it below to continue.`
    },
    'new-password': {
      title: lang === 'vi' ? 'Tạo mật khẩu mới' : 'Choose a new password',
      text: lang === 'vi' ? 'Tạo mật khẩu mạnh mà bạn chưa từng sử dụng trước đây.' : 'Create a strong password you have not used before.'
    },
  }[step]

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.1em] text-[#9a5a05]">
        {lang === 'vi' ? 'KHÔI PHỤC TÀI KHOẢN' : 'ACCOUNT RECOVERY'}
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
          <Field id="recovery-account" label={lang === 'vi' ? 'Số điện thoại hoặc Email' : 'Mobile number or email'}>
            <input
              id="recovery-account"
              value={account}
              onChange={event => setAccount(event.target.value)}
              autoFocus
              placeholder={lang === 'vi' ? 'Nhập SĐT hoặc email...' : 'Mobile number or email'}
            />
          </Field>
          <ErrorMessage message={error} />
          <PrimaryButton>{lang === 'vi' ? 'Tiếp Tục' : 'Continue'}</PrimaryButton>
          <SecondaryButton onClick={onReturnToLogin}>{lang === 'vi' ? 'Hủy Bỏ' : 'Cancel'}</SecondaryButton>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={onVerify}>
          <Field id="verification-code" label={lang === 'vi' ? 'Mã xác thực 6 số' : 'Security code'}>
            <input
              id="verification-code"
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              className="text-center font-mono text-lg tracking-[.35em]"
            />
          </Field>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {lang === 'vi' ? 'Mã xác thực demo: ' : 'Demo code: '}
            <strong className="font-mono">{DEMO_CODE}</strong>
          </div>
          <ErrorMessage message={error} />
          <PrimaryButton>{lang === 'vi' ? 'Xác Nhận Mã' : 'Continue'}</PrimaryButton>
          <SecondaryButton onClick={onBack}>
            {lang === 'vi' ? 'Dùng tài khoản khác' : 'Use another account'}
          </SecondaryButton>
        </form>
      )}

      {step === 'new-password' && (
        <form onSubmit={onSavePassword}>
          <Field id="new-password" label={lang === 'vi' ? 'Mật khẩu mới' : 'New password'}>
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
          <Field id="new-password-confirm" label={lang === 'vi' ? 'Xác nhận mật khẩu mới' : 'Confirm new password'}>
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
            {lang === 'vi' ? 'Sử dụng ít nhất 8 ký tự.' : 'Use at least 8 characters.'}
          </p>
          <ErrorMessage message={error} />
          <PrimaryButton>{lang === 'vi' ? 'Lưu Mật Khẩu Mới' : 'Save new password'}</PrimaryButton>
          <SecondaryButton onClick={onBack}>{lang === 'vi' ? 'Quay Lại' : 'Back'}</SecondaryButton>
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

function PrimaryButton({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <button type={onClick ? 'button' : 'submit'} onClick={onClick} className={`w-full rounded-lg border-0 bg-[#e9a12c] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d8901f] ${className}`}>{children}</button>
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
