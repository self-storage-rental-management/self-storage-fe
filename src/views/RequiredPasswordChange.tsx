import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { Button, Card, Input } from '../components/ui'
import { changePasswordWithApi, type ApiActor } from '../services/authApi'

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
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 12) {
      setError('Mật khẩu mới phải có ít nhất 12 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
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
            <Input
              label="Mật khẩu hiện tại"
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <Input
              label="Mật khẩu mới"
              type="password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
            <Input
              label="Xác nhận mật khẩu mới"
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu và tiếp tục'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-stone-500">Mật khẩu mới cần từ 12 đến 128 ký tự và phải khác mật khẩu hiện tại.</p>
        </Card>
      </div>
    </main>
  )
}
