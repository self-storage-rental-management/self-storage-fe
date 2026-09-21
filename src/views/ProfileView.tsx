import { useState } from 'react'
import type { User } from '../types'
import { Card, Button, Input, Badge, Avatar } from '../components/ui'

interface ProfileViewProps {
  user: User
  onUpdateUser?: (updated: Partial<User>) => void
}

export default function ProfileView({ user, onUpdateUser }: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')

  // Form states
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState('+84 908 123 456')
  const [address, setAddress] = useState('125 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh')
  const [emergencyContact, setEmergencyContact] = useState('Nguyễn Văn An (+84 909 777 888)')
  const [idCard, setIdCard] = useState('079098001234')

  // Security states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)

  // Notification states
  const [notifEmailRent, setNotifEmailRent] = useState(true)
  const [notifSmsGate, setNotifSmsGate] = useState(true)
  const [notifMaintenance, setNotifMaintenance] = useState(true)
  const [notifMarketing, setNotifMarketing] = useState(false)

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (onUpdateUser) {
      onUpdateUser({ name, email })
    }
    showToast('Đã lưu hồ sơ trên thiết bị demo; chưa đồng bộ backend.')
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      alert('Vui lòng nhập mật khẩu hiện tại')
      return
    }
    if (newPassword.length < 6) {
      alert('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp')
      return
    }
    showToast('Chưa thể đổi mật khẩu: frontend chưa kết nối API xác thực.')
  }

  const roleLabelMap: Record<string, string> = {
    customer: 'Khách Hàng Thuê Kho',
    staff: 'Chuyên Viên Vận Hành Cơ Sở',
    manager: 'Giám Đốc Quản Lý Cơ Sở',
    business: 'Đối Tác Kinh Doanh',
    admin: 'Quản Trị Viên Hệ Thống'
  }


  return (
    <div className="fade-in max-w-5xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#292a27] text-white px-5 py-3 rounded-lg shadow-xl border border-amber-500/40 flex items-center gap-3 fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#deddd2] bg-gradient-to-r from-[#292a27] to-[#3a3933] text-white p-6 sm:p-8 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-[#e9a12c]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar name={user.name} size="lg" />
              <button
                type="button"
                className="absolute -bottom-1 -right-1 bg-[#e9a12c] text-[#292a27] p-1.5 rounded-full hover:bg-amber-400 transition shadow"
                title={'Đổi ảnh đại diện'}
                onClick={() => showToast('Mô phỏng tải ảnh đại diện: Đã cập nhật ảnh mới!')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-stone-100">{user.name}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-[.08em] font-semibold bg-[#e9a12c] text-[#3f2607]">
                  {roleLabelMap[user.role] ?? user.role}
                </span>
              </div>
              <p className="text-sm text-stone-300 flex items-center gap-3 flex-wrap">
                <span>{user.email}</span>
                <span>•</span>
                <span>{'Thành viên từ Th1 2026'}</span>
                <span>•</span>
                <span className="text-amber-300 font-medium">
                  {'Trạng thái: Đã định danh CCCD'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-mono tracking-wide text-stone-200 border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {'PHIÊN HOẠT ĐỘNG'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#deddd2] gap-2 pb-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-[2px] ${
            activeTab === 'profile'
              ? 'border-[#e9a12c] text-stone-900 bg-white shadow-xs'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {'Thông Tin Cá Nhân'}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-[2px] ${
            activeTab === 'security'
              ? 'border-[#e9a12c] text-stone-900 bg-white shadow-xs'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {'Bảo Mật & Mật Khẩu'}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-[2px] ${
            activeTab === 'notifications'
              ? 'border-[#e9a12c] text-stone-900 bg-white shadow-xs'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {'Tùy Chọn Thông Báo'}
        </button>
      </div>

      {/* TAB 1: General Info */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-stone-100">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {'Chi Tiết Cá Nhân'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {'Cập nhật thông tin liên hệ và định danh pháp lý của bạn'}
                  </p>
                </div>
                <Badge variant="success">
                  {'Đã Định Danh'}
                </Badge>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={'Họ và Tên'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                  <Input
                    label={'Địa Chỉ Email'}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={'Số Điện Thoại Chính'}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                  <Input
                    label={'Số CCCD / Hộ Chiếu'}
                    value={idCard}
                    onChange={e => setIdCard(e.target.value)}
                  />
                </div>

                <Input
                  label={'Địa Chỉ Thường Trú'}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />

                <Input
                  label={'Người Liên Hệ Khẩn Cấp (Tên & SĐT)'}
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                />

                <div className="pt-4 flex justify-end gap-3 border-t border-stone-100">
                  <Button type="submit" variant="primary">
                    {'Lưu Thay Đổi'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Quick Account Summary */}
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-stone-900 mb-3 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {'Tổng Quan Tài Khoản'}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">{'Vai Trò'}</span>
                  <span className="font-semibold uppercase font-mono text-xs text-stone-800">
                    {roleLabelMap[user.role] ?? user.role}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">{'Cơ Sở Kho'}</span>
                  <span className="font-medium text-stone-800">StorageHub Central</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">{'Cấp Độ An Ninh'}</span>
                  <span className="font-medium text-emerald-700">
                    {'Cấp 1 · Đã Xác Thực'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-stone-500">{'Xác Thực 2 Bước'}</span>
                  <Badge variant={twoFactorEnabled ? 'success' : 'warning'}>
                    {twoFactorEnabled ? ('Đang Bật') : ('Đã Tắt')}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-[#fbfaf6] border-dashed">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-500 mb-2">
                {'Thẻ Ra Vào Kho Kỹ Thuật Số'}
              </h3>
              <div className="rounded-lg bg-[#292a27] p-4 text-white">
                <div className="flex justify-between items-center text-xs text-[#e9a12c] font-mono">
                  <span>{'QUYỀN TRUY CẬP STORAGEHUB'}</span>
                  <span>{'ĐÃ ĐỒNG BỘ MÃ PIN'}</span>
                </div>
                <p className="mt-3 text-lg font-mono tracking-widest text-amber-200">
                  •••• 4921 #
                </p>
                <p className="mt-2 text-[11px] text-stone-400">
                  {'Ủy quyền mở cổng xe và cửa thông minh tại cơ sở StorageHub Central'}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Security & Credentials */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Password change */}
            <Card className="p-6">
              <div className="pb-4 mb-5 border-b border-stone-100">
                <h2 className="text-lg font-bold text-stone-900">
                  {'Đổi Mật Khẩu Đăng Nhập'}
                </h2>
                <p className="text-xs text-stone-500">
                  {'Sử dụng mật khẩu mạnh có ít nhất 8 ký tự'}
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input
                  label={'Mật Khẩu Hiện Tại'}
                  type="password"
                  placeholder={'Nhập mật khẩu hiện tại...'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={'Mật Khẩu Mới'}
                    type="password"
                    placeholder={'Ít nhất 6 ký tự...'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <Input
                    label={'Xác Nhận Mật Khẩu Mới'}
                    type="password"
                    placeholder={'Nhập lại mật khẩu mới...'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="secondary">
                    {'Lưu Mật Khẩu Mới'}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Active Sessions */}
            <Card className="p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {'Phiên Đăng Nhập Đang Hoạt Động'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {'Các thiết bị hiện đang được xác thực với tài khoản này'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showToast('Đã hủy tất cả các phiên đăng nhập khác!')}
                >
                  {'Đăng Xuất Thiết Bị Khác'}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      PC
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900">
                          {'Thiết Bị Hiện Tại (Windows Chrome)'}
                        </p>
                        <Badge variant="success">
                          {'Phiên Này'}
                        </Badge>
                      </div>
                      <p className="text-xs text-stone-500">192.168.1.20 · TP. Hồ Chí Minh, Việt Nam</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-700">
                    {'Đang hoạt động'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                      iOS
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">StorageHub Mobile (iPhone 15 Pro)</p>
                      <p className="text-xs text-stone-500">
                        {'Quận 1, TP.HCM · Hoạt động 2 giờ trước'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => showToast('Đã thu hồi phiên đăng nhập!')}
                  >
                    {'Thu Hồi'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* 2FA Sidebar Card */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-stone-900 text-sm">
                  {'Xác Thực 2 Bước (2FA)'}
                </h3>
                <Badge variant={twoFactorEnabled ? 'success' : 'muted'}>
                  {twoFactorEnabled ? ('Đang Bật') : ('Đã Tắt')}
                </Badge>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed mb-4">
                {'Bổ sung thêm lớp bảo mật bằng cách yêu cầu mã OTP từ ứng dụng Google Authenticator hoặc tin nhắn SMS khi đăng nhập.'}
              </p>
              <div className="pt-2">
                <Button
                  variant={twoFactorEnabled ? 'outline' : 'primary'}
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const next = !twoFactorEnabled
                    setTwoFactorEnabled(next)
                    showToast(
                      next
                        ? ('Đã kích hoạt bảo mật 2 bước!')
                        : ('Đã tắt bảo mật 2 bước.')
                    )
                  }}
                >
                  {twoFactorEnabled
                    ? ('Tắt Xác Thực 2FA')
                    : ('Kích Hoạt Bảo Mật 2FA')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: Notifications */}
      {activeTab === 'notifications' && (
        <Card className="p-6 max-w-3xl">
          <div className="pb-4 mb-5 border-b border-stone-100">
            <h2 className="text-lg font-bold text-stone-900">
              {'Kênh Thông Báo & Cảnh Báo'}
            </h2>
            <p className="text-xs text-stone-500">
              {'Kiểm soát cách thức và thời điểm StorageHub gửi thông báo tự động cho bạn'}
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {'Cảnh Báo Hóa Đơn & Tiền Thuê Kho'}
                </p>
                <p className="text-xs text-stone-500">
                  {'Nhận nhắc nhở hạn thanh toán và hóa đơn điện tử qua email'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifEmailRent}
                onChange={e => {
                  setNotifEmailRent(e.target.checked)
                  showToast('Đã lưu tùy chọn thông báo!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {'Nhật Ký Mở Cổng & Khóa Cửa Điện Tử'}
                </p>
                <p className="text-xs text-stone-500">
                  {'Nhận tin nhắn SMS tức thì khi cửa kho hoặc cổng phụ của bạn được mở ngoài giờ'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifSmsGate}
                onChange={e => {
                  setNotifSmsGate(e.target.checked)
                  showToast('Đã lưu tùy chọn thông báo!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {'Bản Tin Bảo Trì Cơ Sở'}
                </p>
                <p className="text-xs text-stone-500">
                  {'Các thông báo quan trọng về kiểm tra PCCC, bảo dưỡng thang máy hoặc giờ đóng cửa nghỉ lễ'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifMaintenance}
                onChange={e => {
                  setNotifMaintenance(e.target.checked)
                  showToast('Đã lưu tùy chọn thông báo!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {'Chương Trình Ưu Đãi & Điểm Thưởng'}
                </p>
                <p className="text-xs text-stone-500">
                  {'Nhận thông báo về thay đổi dịch vụ và lịch vận hành cơ sở'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifMarketing}
                onChange={e => {
                  setNotifMarketing(e.target.checked)
                  showToast('Đã lưu tùy chọn thông báo!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
