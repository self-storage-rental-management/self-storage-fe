import { useState } from 'react'
import type { User } from '../types'
import { Card, Button, Input, Badge, Avatar } from '../components/ui'
import { useLanguage } from '../i18n/LanguageContext'

interface ProfileViewProps {
  user: User
  onUpdateUser?: (updated: Partial<User>) => void
}

export default function ProfileView({ user, onUpdateUser }: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')
  const { lang, t } = useLanguage()

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
    // Update local user if possible
    try {
      const saved = localStorage.getItem('storagehub:user')
      if (saved) {
        const parsed = JSON.parse(saved)
        localStorage.setItem('storagehub:user', JSON.stringify({ ...parsed, name, email }))
      }
    } catch {}
    showToast(lang === 'vi' ? 'Đã lưu hồ sơ trên thiết bị demo; chưa đồng bộ backend.' : 'Profile saved on this demo device; backend sync is not connected.')
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      alert(lang === 'vi' ? 'Vui lòng nhập mật khẩu hiện tại' : 'Please enter your current password')
      return
    }
    if (newPassword.length < 6) {
      alert(lang === 'vi' ? 'Mật khẩu mới phải có ít nhất 6 ký tự' : 'New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      alert(lang === 'vi' ? 'Mật khẩu xác nhận không khớp' : 'New passwords do not match')
      return
    }
    showToast(lang === 'vi' ? 'Chưa thể đổi mật khẩu: frontend chưa kết nối API xác thực.' : 'Password was not changed because the authentication API is not connected.')
  }

  const roleLabelMap: Record<string, Record<string, string>> = {
    vi: {
      customer: 'Khách Hàng Thuê Kho',
      staff: 'Chuyên Viên Vận Hành Cơ Sở',
      manager: 'Giám Đốc Quản Lý Cơ Sở',
      business: 'Đối Tác Kinh Doanh',
      admin: 'Quản Trị Viên Hệ Thống'
    },
    en: {
      customer: 'Customer Tenant',
      staff: 'On-Site Staff Specialist',
      manager: 'Facility General Manager',
      business: 'Business Operations Director',
      admin: 'System Super Administrator'
    }
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
                title={lang === 'vi' ? 'Đổi ảnh đại diện' : 'Change profile avatar'}
                onClick={() => showToast(lang === 'vi' ? 'Mô phỏng tải ảnh đại diện: Đã cập nhật ảnh mới!' : 'Avatar upload dialog simulation: image updated!')}
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
                  {roleLabelMap[lang]?.[user.role] ?? user.role}
                </span>
              </div>
              <p className="text-sm text-stone-300 flex items-center gap-3 flex-wrap">
                <span>{user.email}</span>
                <span>•</span>
                <span>{lang === 'vi' ? 'Thành viên từ Th1 2026' : 'Member since Jan 2026'}</span>
                <span>•</span>
                <span className="text-amber-300 font-medium">
                  {lang === 'vi' ? 'Trạng thái: Đã định danh CCCD' : 'Status: Active & Verified'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-mono tracking-wide text-stone-200 border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {lang === 'vi' ? 'PHIÊN HOẠT ĐỘNG' : 'SESSION ACTIVE'}
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
          {lang === 'vi' ? 'Thông Tin Cá Nhân' : 'General Information'}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-[2px] ${
            activeTab === 'security'
              ? 'border-[#e9a12c] text-stone-900 bg-white shadow-xs'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {lang === 'vi' ? 'Bảo Mật & Mật Khẩu' : 'Security & Credentials'}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-[2px] ${
            activeTab === 'notifications'
              ? 'border-[#e9a12c] text-stone-900 bg-white shadow-xs'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          {lang === 'vi' ? 'Tùy Chọn Thông Báo' : 'Notification Preferences'}
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
                    {lang === 'vi' ? 'Chi Tiết Cá Nhân' : 'Personal Details'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {lang === 'vi' ? 'Cập nhật thông tin liên hệ và định danh pháp lý của bạn' : 'Update your contact profile and legal verification data'}
                  </p>
                </div>
                <Badge variant="success">
                  {lang === 'vi' ? 'Đã Định Danh' : 'Verified ID'}
                </Badge>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={lang === 'vi' ? 'Họ và Tên' : 'Full Name'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                  <Input
                    label={lang === 'vi' ? 'Địa Chỉ Email' : 'Email Address'}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={lang === 'vi' ? 'Số Điện Thoại Chính' : 'Primary Phone Number'}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                  <Input
                    label={lang === 'vi' ? 'Số CCCD / Hộ Chiếu' : 'National ID / Passport Number'}
                    value={idCard}
                    onChange={e => setIdCard(e.target.value)}
                  />
                </div>

                <Input
                  label={lang === 'vi' ? 'Địa Chỉ Thường Trú' : 'Registered Address'}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />

                <Input
                  label={lang === 'vi' ? 'Người Liên Hệ Khẩn Cấp (Tên & SĐT)' : 'Emergency Contact (Name & Phone)'}
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                />

                <div className="pt-4 flex justify-end gap-3 border-t border-stone-100">
                  <Button type="submit" variant="primary">
                    {lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'}
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
                {lang === 'vi' ? 'Tổng Quan Tài Khoản' : 'Account Overview'}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">{lang === 'vi' ? 'Vai Trò' : 'User Role'}</span>
                  <span className="font-semibold uppercase font-mono text-xs text-stone-800">
                    {roleLabelMap[lang]?.[user.role] ?? user.role}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">{lang === 'vi' ? 'Cơ Sở Kho' : 'Default Facility'}</span>
                  <span className="font-medium text-stone-800">StorageHub Central</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-100">
                  <span className="text-stone-500">{lang === 'vi' ? 'Cấp Độ An Ninh' : 'Security Clearance'}</span>
                  <span className="font-medium text-emerald-700">
                    {lang === 'vi' ? 'Cấp 1 · Đã Xác Thực' : 'Tier 1 · Verified'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-stone-500">{lang === 'vi' ? 'Xác Thực 2 Bước' : 'Two-Factor Auth'}</span>
                  <Badge variant={twoFactorEnabled ? 'success' : 'warning'}>
                    {twoFactorEnabled ? (lang === 'vi' ? 'Đang Bật' : 'Active') : (lang === 'vi' ? 'Đã Tắt' : 'Disabled')}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-[#fbfaf6] border-dashed">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-500 mb-2">
                {lang === 'vi' ? 'Thẻ Ra Vào Kho Kỹ Thuật Số' : 'StorageHub Digital Keycard'}
              </h3>
              <div className="rounded-lg bg-[#292a27] p-4 text-white">
                <div className="flex justify-between items-center text-xs text-[#e9a12c] font-mono">
                  <span>{lang === 'vi' ? 'QUYỀN TRUY CẬP STORAGEHUB' : 'STORAGEHUB ACCESS'}</span>
                  <span>{lang === 'vi' ? 'ĐÃ ĐỒNG BỘ MÃ PIN' : 'PIN SYNCED'}</span>
                </div>
                <p className="mt-3 text-lg font-mono tracking-widest text-amber-200">
                  •••• 4921 #
                </p>
                <p className="mt-2 text-[11px] text-stone-400">
                  {lang === 'vi'
                    ? 'Ủy quyền mở cổng xe và cửa thông minh tại cơ sở StorageHub Central'
                    : 'Authorized for vehicle & passenger gate entry at StorageHub Central'}
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
                  {lang === 'vi' ? 'Đổi Mật Khẩu Đăng Nhập' : 'Change Password'}
                </h2>
                <p className="text-xs text-stone-500">
                  {lang === 'vi' ? 'Sử dụng mật khẩu mạnh có ít nhất 8 ký tự' : 'Use a strong password with at least 8 characters'}
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input
                  label={lang === 'vi' ? 'Mật Khẩu Hiện Tại' : 'Current Password'}
                  type="password"
                  placeholder={lang === 'vi' ? 'Nhập mật khẩu hiện tại...' : 'Enter current password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={lang === 'vi' ? 'Mật Khẩu Mới' : 'New Password'}
                    type="password"
                    placeholder={lang === 'vi' ? 'Ít nhất 6 ký tự...' : 'At least 6 characters'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <Input
                    label={lang === 'vi' ? 'Xác Nhận Mật Khẩu Mới' : 'Confirm New Password'}
                    type="password"
                    placeholder={lang === 'vi' ? 'Nhập lại mật khẩu mới...' : 'Repeat new password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="secondary">
                    {lang === 'vi' ? 'Lưu Mật Khẩu Mới' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Active Sessions */}
            <Card className="p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {lang === 'vi' ? 'Phiên Đăng Nhập Đang Hoạt Động' : 'Active Login Sessions'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {lang === 'vi' ? 'Các thiết bị hiện đang được xác thực với tài khoản này' : 'Devices currently authenticated with this account'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showToast(lang === 'vi' ? 'Đã hủy tất cả các phiên đăng nhập khác!' : 'Terminated all other active sessions!')}
                >
                  {lang === 'vi' ? 'Đăng Xuất Thiết Bị Khác' : 'Sign Out Other Devices'}
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
                          {lang === 'vi' ? 'Thiết Bị Hiện Tại (Windows Chrome)' : 'Current Device (Windows Chrome)'}
                        </p>
                        <Badge variant="success">
                          {lang === 'vi' ? 'Phiên Này' : 'This Session'}
                        </Badge>
                      </div>
                      <p className="text-xs text-stone-500">192.168.1.20 · TP. Hồ Chí Minh, Việt Nam</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-700">
                    {lang === 'vi' ? 'Đang hoạt động' : 'Active now'}
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
                        {lang === 'vi' ? 'Quận 1, TP.HCM · Hoạt động 2 giờ trước' : 'District 1, HCMC · Last active 2 hours ago'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => showToast(lang === 'vi' ? 'Đã thu hồi phiên đăng nhập!' : 'Session revoked!')}
                  >
                    {lang === 'vi' ? 'Thu Hồi' : 'Revoke'}
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
                  {lang === 'vi' ? 'Xác Thực 2 Bước (2FA)' : 'Two-Factor Authentication'}
                </h3>
                <Badge variant={twoFactorEnabled ? 'success' : 'muted'}>
                  {twoFactorEnabled ? (lang === 'vi' ? 'Đang Bật' : 'Enabled') : (lang === 'vi' ? 'Đã Tắt' : 'Disabled')}
                </Badge>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed mb-4">
                {lang === 'vi'
                  ? 'Bổ sung thêm lớp bảo mật bằng cách yêu cầu mã OTP từ ứng dụng Google Authenticator hoặc tin nhắn SMS khi đăng nhập.'
                  : 'Adds an additional layer of security by requiring an OTP code from Google Authenticator or SMS upon login.'}
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
                        ? (lang === 'vi' ? 'Đã kích hoạt bảo mật 2 bước!' : 'Two-Factor Authentication enabled!')
                        : (lang === 'vi' ? 'Đã tắt bảo mật 2 bước.' : 'Two-Factor Authentication disabled.')
                    )
                  }}
                >
                  {twoFactorEnabled
                    ? (lang === 'vi' ? 'Tắt Xác Thực 2FA' : 'Disable 2FA')
                    : (lang === 'vi' ? 'Kích Hoạt Bảo Mật 2FA' : 'Enable 2FA Protection')}
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
              {lang === 'vi' ? 'Kênh Thông Báo & Cảnh Báo' : 'Communication & Alert Channels'}
            </h2>
            <p className="text-xs text-stone-500">
              {lang === 'vi' ? 'Kiểm soát cách thức và thời điểm StorageHub gửi thông báo tự động cho bạn' : 'Control how and when StorageHub sends automated alerts'}
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {lang === 'vi' ? 'Cảnh Báo Hóa Đơn & Tiền Thuê Kho' : 'Monthly Rent & Invoicing Alerts'}
                </p>
                <p className="text-xs text-stone-500">
                  {lang === 'vi' ? 'Nhận nhắc nhở hạn thanh toán và hóa đơn điện tử qua email' : 'Receive payment due reminders and digital receipts via email'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifEmailRent}
                onChange={e => {
                  setNotifEmailRent(e.target.checked)
                  showToast(lang === 'vi' ? 'Đã lưu tùy chọn thông báo!' : 'Notification preference saved!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {lang === 'vi' ? 'Nhật Ký Mở Cổng & Khóa Cửa Điện Tử' : 'Gate Access & Digital Lock Events'}
                </p>
                <p className="text-xs text-stone-500">
                  {lang === 'vi' ? 'Nhận tin nhắn SMS tức thì khi cửa kho hoặc cổng phụ của bạn được mở ngoài giờ' : 'Get an instant SMS when your unit gate or keypad is opened after hours'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifSmsGate}
                onChange={e => {
                  setNotifSmsGate(e.target.checked)
                  showToast(lang === 'vi' ? 'Đã lưu tùy chọn thông báo!' : 'Notification preference saved!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {lang === 'vi' ? 'Bản Tin Bảo Trì Cơ Sở' : 'Facility Maintenance Bulletins'}
                </p>
                <p className="text-xs text-stone-500">
                  {lang === 'vi' ? 'Các thông báo quan trọng về kiểm tra PCCC, bảo dưỡng thang máy hoặc giờ đóng cửa nghỉ lễ' : 'Important notices about elevator maintenance, power inspections, or holiday hours'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifMaintenance}
                onChange={e => {
                  setNotifMaintenance(e.target.checked)
                  showToast(lang === 'vi' ? 'Đã lưu tùy chọn thông báo!' : 'Notification preference saved!')
                }}
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-stone-800 text-sm">
                  {lang === 'vi' ? 'Chương Trình Ưu Đãi & Điểm Thưởng' : 'Promotions & Referral Rewards'}
                </p>
                <p className="text-xs text-stone-500">
                  {lang === 'vi' ? 'Nhận thông báo về thay đổi dịch vụ và lịch vận hành cơ sở' : 'Receive service updates and facility operating notices'}
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifMarketing}
                onChange={e => {
                  setNotifMarketing(e.target.checked)
                  showToast(lang === 'vi' ? 'Đã lưu tùy chọn thông báo!' : 'Notification preference saved!')
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
