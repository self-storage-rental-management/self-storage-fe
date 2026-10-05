import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { Button, Card, PasswordField } from '../components/ui'
import { changePasswordWithApi, type ApiActor } from '../services/authApi'
import { getPasswordValidationError, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_HINT } from '../utils/passwordPolicy'

interface RequiredPasswordChangeProps {
  actor: ApiActor
  onChanged: (actor: ApiActor) => void
  onLogout: () => void
}

export default function RequiredPasswordChange({ actor, onChanged, onLogout }: RequiredPasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ current: '', next: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const nextErrors = {
      current: currentPassword ? '' : 'Vui lòng nhập mật khẩu hiện tại.',
      next: getPasswordValidationError(newPassword) ?? '',
      confirm: !confirmPassword
        ? 'Vui lòng nhập lại mật khẩu mới.'
        : newPassword === currentPassword
          ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
        : newPassword !== confirmPassword
          ? 'Mật khẩu xác nhận chưa khớp với mật khẩu mới.'
          : '',
    }
    setFieldErrors(nextErrors)
    if (nextErrors.current || nextErrors.next || nextErrors.confirm) {
      return
    }

    setSubmitting(true)
    try {
      const updatedActor = await changePasswordWithApi(currentPassword, newPassword)
      onChanged(updatedActor)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đổi mật khẩu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-recovery-card w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <BrandLogo />
          <Button type="button" variant="ghost" size="sm" onClick={onLogout}>Đăng xuất</Button>
        </div>
        <Card className="p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-amber-700">Bảo mật tài khoản</p>
          <h1 className="text-2xl font-bold text-stone-900">Đổi mật khẩu trước khi tiếp tục</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Tài khoản <strong>{actor.email}</strong> đang dùng mật khẩu tạm thời hoặc vừa được cấp lại. Hãy đặt mật khẩu mới để mở khóa không gian làm việc.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <PasswordField
              id="required-current-password"
              label="Mật khẩu hiện tại"
              value={currentPassword}
              onChange={event => {
                setCurrentPassword(event.target.value)
                setFieldErrors(previous => ({ ...previous, current: '' }))
              }}
              error={fieldErrors.current}
              autoComplete="current-password"
            />
            <PasswordField
              id="required-new-password"
              label="Mật khẩu mới"
              value={newPassword}
              onChange={event => {
                setNewPassword(event.target.value)
                setFieldErrors(previous => ({ ...previous, next: '' }))
              }}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              error={fieldErrors.next}
            />
            <PasswordField
              id="required-confirm-password"
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={event => {
                setConfirmPassword(event.target.value)
                setFieldErrors(previous => ({ ...previous, confirm: '' }))
              }}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              error={fieldErrors.confirm}
            />
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu và tiếp tục'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-stone-500">{PASSWORD_POLICY_HINT} Mật khẩu mới cũng phải khác mật khẩu hiện tại.</p>
        </Card>
      </div>
    </main>
  )
}
