import { useState } from 'react'
import type { User } from '../types'
import { Card, Button, Input, Badge, Avatar } from '../components/ui'

interface ProfileViewProps {
  user: User
  onUpdateUser?: (updated: Partial<User>) => void
}

<<<<<<< Updated upstream
export default function ProfileView({ user, onUpdateUser }: ProfileViewProps) {
=======
function ToggleSwitch({
  checked,
  onChange,
  label,
  id
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#e9a12c] focus:ring-offset-2 ${
        checked ? 'bg-[#e9a12c]' : 'bg-stone-300'
      }`}
    >
      <span className="sr-only">{label}</span>
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function ProfileView({ user }: ProfileViewProps) {
  const {
    sessions,
    revokeSession,
    revokeAllUserSessions,
    updateCustomerProfile,
    requestOwnPasswordReset,
    submitProfileChangeRequest,
    deleteOwnCustomerAccount
  } = useStorageHub()
  const staffText = (text: string) => user.role === 'staff' ? text.replace(/Admin\/HR/g, 'bộ phận quản trị và nhân sự').replace(/audit log/g, 'nhật ký kiểm toán').replace(/Email|email/g, 'thư điện tử') : text
  const isCustomer = user.role === 'customer'
  const isInternal = !isCustomer
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp')
      return
=======
    try {
      requestOwnPasswordReset(user)
      showToast('Đã gửi yêu cầu đặt lại mật khẩu tới email của bạn.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tạo yêu cầu đổi mật khẩu.')
    }
  }

  const handleSubmitProfileRequest = () => {
    try {
      submitProfileChangeRequest({ requestedFields: requestFields, reason: requestReason }, user)
      setRequestModalOpen(false)
      setRequestReason('')
      showToast(staffText('Đã gửi yêu cầu chỉnh sửa tới Admin/HR.'))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu chỉnh sửa.')
    }
  }

  const handleDeleteAccount = () => {
    if (!isCustomer) return
    setDeleteAccountConfirmationOpen(true)
  }

  const confirmDeleteAccount = () => {
    try {
      deleteOwnCustomerAccount(user)
      setDeleteAccountConfirmationOpen(false)
      showToast('Đã xoá tài khoản. Phiên đăng nhập sẽ kết thúc.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xoá tài khoản.')
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Họ và Tên</span>
                    <span className="font-bold text-stone-900 text-base">{name}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">{staffText("Địa Chỉ Email Công Tác")}</span>
                    <span className="font-semibold text-stone-900 text-sm">{email}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Số Điện Thoại Chính</span>
                    <span className="font-semibold text-stone-900 text-sm">{phone || 'Chưa cập nhật'}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Số CCCD / Hộ Chiếu</span>
                    <span className="font-mono font-bold text-stone-900 text-sm">{idCard}</span>
                  </div>

                  <div className="sm:col-span-2 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Địa Chỉ Thường Trú</span>
                    <span className="text-stone-800 text-sm leading-relaxed">{address}</span>
                  </div>

                  <div className="sm:col-span-2 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Người Liên Hệ Khẩn Cấp (Tên & SĐT)</span>
                    <span className="text-stone-800 text-sm font-medium">{emergencyContact}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-500">
                  <span>{staffText("Thông tin nhân sự được đồng bộ tập trung. Khi cần thay đổi, hãy gửi yêu cầu tới Admin/HR.")}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRequestModalOpen(true)}
                    className="shrink-0 border-stone-300 hover:bg-stone-100 text-stone-800 cursor-pointer"
                  >
                    Gửi Yêu Cầu Chỉnh Sửa
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
            {isInternal && (
              <Card className="p-5 bg-[#fbfaf6] border-stone-200">
                <h3 className="font-semibold text-stone-900 mb-2 text-sm">Thông Tin Tổ Chức</h3>
                <p className="text-xs text-stone-600 leading-relaxed">{staffText("Vai trò và cơ sở của tài khoản do công ty cấp. Mọi thay đổi cần Admin/HR duyệt và lưu audit log.")}</p>
                <Button className="mt-4 w-full cursor-pointer" size="sm" onClick={() => setRequestModalOpen(true)}>
                  Gửi Yêu Cầu Chỉnh Sửa
                </Button>
              </Card>
            )}

            {isCustomer && (
              <Card className="p-5 bg-[#fbfaf6] border-stone-200">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-500 mb-2">
                  Bảo vệ tài khoản Khách hàng
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">Hồ sơ khách hàng được mã hóa và bảo mật theo tiêu chuẩn StorageHub. Bạn có thể yêu cầu đổi mật khẩu ở tab Bảo mật.</p>
              </Card>
            )}
>>>>>>> Stashed changes
          </div>
        </div>
      )}

      {/* TAB 2: Security & Credentials */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
<<<<<<< Updated upstream
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
=======
            {isInternal ? (
              /* Internal Staff / Manager / Business / Admin: Enterprise Security Card */
              <Card className="p-6">
                <div className="pb-4 mb-5 border-b border-stone-100">
                  <h2 className="text-lg font-bold text-stone-900">Chính Sách Bảo Mật Tài Khoản Nội Bộ</h2>
                  <p className="text-xs text-stone-500">{staffText("Tài khoản công tác được quản trị tập trung bởi bộ phận Quản Trị & Nhân Sự (Admin/HR)")}</p>
                </div>
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
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
=======
                <span className="text-xs text-stone-500 block">{staffText("Liên hệ Admin/HR để kích hoạt xác thực 2 bước.")}</span>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                <p className="text-xs text-stone-500">
                  {'Nhận nhắc nhở hạn thanh toán và hóa đơn điện tử qua email'}
=======
                <p className="text-xs text-stone-500 leading-relaxed">
                  {staffText('Nhận nhắc nhở hạn thanh toán và hóa đơn điện tử tự động qua email đã đăng ký')}
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======

      <Modal closeLabel={user.role === 'staff' ? 'Đóng hộp thoại' : undefined} open={requestModalOpen && isInternal} onClose={() => setRequestModalOpen(false)} title="Gửi Yêu Cầu Chỉnh Sửa Hồ Sơ">
        <div className="space-y-5">
          <p className="text-xs text-stone-500 leading-relaxed">
            {staffText("Chọn các hạng mục thông tin cần điều chỉnh. Đề xuất sẽ được chuyển trực tiếp đến bộ phận Quản Trị & Nhân Sự (Admin/HR) xem xét, phê duyệt và lưu nhật ký kiểm toán (audit log).")}</p>

          <div>
            <span className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2.5">
              Hạng mục cần cập nhật <span className="text-amber-600">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { id: 'Họ và Tên', label: 'Họ và Tên' },
                { id: 'Email liên hệ', label: staffText('Email công tác') },
                { id: 'Số điện thoại', label: 'Số điện thoại' },
                { id: 'Mật khẩu', label: 'Mật khẩu đăng nhập' },
                { id: 'Vai trò', label: 'Vai trò chức danh' },
                { id: 'Cơ sở phụ trách', label: 'Cơ sở phụ trách' },
              ].map(({ id, label }) => {
                const isSelected = requestFields.includes(id)
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium cursor-pointer transition select-none ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-semibold shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={event =>
                        setRequestFields(current =>
                          event.target.checked
                            ? [...new Set([...current, id])]
                            : current.filter(item => item !== id)
                        )
                      }
                      className="w-4 h-4 shrink-0 rounded border-stone-300 accent-amber-600 cursor-pointer"
                    />
                    <span className="truncate">{label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Nội dung đề nghị chi tiết <span className="text-amber-600">*</span>
            </label>
            <textarea
              rows={3}
              value={requestReason}
              onChange={event => setRequestReason(event.target.value)}
              placeholder="Nêu rõ thông tin mới cần cập nhật (ví dụ: Cập nhật SĐT sang 0905 123 456; Điều chuyển cơ sở sang Kho Việt – Cơ sở Quận 1...)"
              className="w-full rounded-xl border border-stone-300 p-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none transition"
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-stone-400">
              <span>Tối thiểu 10 ký tự</span>
              <span className={requestReason.trim().length >= 10 ? 'text-emerald-600 font-semibold' : 'text-stone-400'}>
                {requestReason.trim().length}/10 ký tự
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
            <Button
              variant="outline"
              className="cursor-pointer border-stone-300 text-stone-700 hover:bg-stone-100"
              onClick={() => setRequestModalOpen(false)}
            >
              Hủy Bỏ
            </Button>
            <Button
              variant="primary"
              className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              disabled={!requestFields.length || requestReason.trim().length < 10}
              onClick={handleSubmitProfileRequest}
            >
              {staffText("Gửi Yêu Cầu Tới Admin/HR")}</Button>
          </div>
        </div>
      </Modal>

      <Modal closeLabel={user.role === 'staff' ? 'Đóng hộp thoại' : undefined} open={deleteAccountConfirmationOpen && isCustomer} onClose={() => setDeleteAccountConfirmationOpen(false)} title="Xác nhận xóa tài khoản">
        <div className="space-y-5">
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">Bạn chắc chắn muốn xóa tài khoản? Chỉ có thể xóa khi không còn đơn hiện tại, đơn quá hạn hoặc khoản chưa thanh toán.</p>
          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4"><Button variant="outline" onClick={() => setDeleteAccountConfirmationOpen(false)}>Quay lại</Button><Button variant="danger" onClick={confirmDeleteAccount}>Xóa tài khoản</Button></div>
        </div>
      </Modal>
>>>>>>> Stashed changes
    </div>
  )
}
