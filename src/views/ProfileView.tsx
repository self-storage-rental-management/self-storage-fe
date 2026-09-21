import { useEffect, useState } from 'react'
import type { User } from '../types'
import { Card, Button, Input, Badge, Avatar, Modal } from '../components/ui'
import { useStorageHub } from '../store/StorageHubContext'

interface ProfileViewProps {
  user: User
  onUpdateUser?: (updated: Partial<User>) => void
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
  const isCustomer = user.role === 'customer'
  const isInternal = !isCustomer
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')

  // Form states
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone || '')
  const [address, setAddress] = useState('125 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh')
  const [emergencyContact, setEmergencyContact] = useState('Nguyễn Văn An (+84 909 777 888)')
  const [idCard, setIdCard] = useState('079098001234')

  // Security states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled] = useState(true)

  // Notification states
  const [notifEmailRent] = useState(true)
  const [notifSmsGate] = useState(true)
  const [notifMaintenance] = useState(true)
  const [notifMarketing] = useState(false)

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requestFields, setRequestFields] = useState<string[]>(['Họ và Tên', 'Email liên hệ'])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCustomer) return
    try {
      updateCustomerProfile({ name, email, phone }, user)
      showToast('Đã cập nhật thông tin cá nhân.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật thông tin cá nhân.')
    }
  }

  useEffect(() => {
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone || '')
  }, [user.id, user.name, user.email, user.phone])

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCustomer) return
    try {
      requestOwnPasswordReset(user)
      showToast('Đã ghi nhận yêu cầu. Email đổi mật khẩu cần auth backend gửi đi.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể tạo yêu cầu đổi mật khẩu.')
    }
  }

  const handleSubmitProfileRequest = () => {
    try {
      submitProfileChangeRequest({ requestedFields: requestFields, reason: requestReason }, user)
      setRequestModalOpen(false)
      setRequestReason('')
      showToast('Đã gửi yêu cầu chỉnh sửa tới Admin/HR.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu chỉnh sửa.')
    }
  }

  const handleDeleteAccount = () => {
    if (!isCustomer || !window.confirm('Bạn chắc chắn muốn xoá tài khoản? Chỉ được xoá khi không còn đơn hiện tại, đơn quá hạn hoặc khoản chưa thanh toán.')) return
    try {
      deleteOwnCustomerAccount(user)
      showToast('Đã xoá tài khoản. Phiên đăng nhập sẽ kết thúc.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể xoá tài khoản.')
    }
  }

  const roleLabelMap: Record<string, string> = {
    customer: 'Khách Hàng Thuê Kho',
    staff: 'Chuyên Viên Vận Hành Cơ Sở',
    manager: 'Giám Đốc Quản Lý Cơ Sở',
    business: 'Đối Tác Kinh Doanh',
    admin: 'Quản Trị Viên Hệ Thống'
  }

  const userSessions = sessions.filter(session => session.userId === user.id)
  const handleRevokeAllSessions = () => {
    try {
      const count = revokeAllUserSessions(user.id, user)
      if (count > 0) showToast(`Đã thu hồi ${count} phiên đăng nhập.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể thu hồi phiên đăng nhập.')
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
                title={'Đổi ảnh đại diện'}
                disabled
              >
                <svg className="show-icon w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-stone-100">{user.name}</h1>
                {isInternal && <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-[.08em] font-semibold bg-[#e9a12c] text-[#3f2607]">
                  {roleLabelMap[user.role] ?? user.role}
                </span>}
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
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {isCustomer ? 'Customer có thể cập nhật họ tên, email và số điện thoại. Thay đổi được lưu vào dữ liệu tài khoản.' : 'Hồ sơ tổ chức đang ở chế độ chỉ xem; thay đổi cần gửi yêu cầu tới Admin/HR.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={'Họ và Tên'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={isInternal}
                    required
                  />
                  <Input
                    label={'Địa Chỉ Email'}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={isInternal}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={'Số Điện Thoại Chính'}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    disabled={isInternal}
                  />
                  <Input
                    label={'Số CCCD / Hộ Chiếu'}
                    value={idCard}
                    onChange={e => setIdCard(e.target.value)}
                    disabled
                  />
                </div>

                <Input
                  label={'Địa Chỉ Thường Trú'}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  disabled
                />

                <Input
                  label={'Người Liên Hệ Khẩn Cấp (Tên & SĐT)'}
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                  disabled
                />

                <div className="pt-4 flex justify-end gap-3 border-t border-stone-100">
                  <Button type="submit" variant="outline" disabled={isInternal}>
                    {isCustomer ? 'Lưu Thay Đổi' : 'Chỉ xem · Gửi yêu cầu Admin/HR'}
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
                {isInternal && <>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">{'Vai Trò'}</span>
                    <span className="font-semibold uppercase font-mono text-xs text-stone-800">
                      {roleLabelMap[user.role] ?? user.role}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">{'Cơ Sở Kho'}</span>
                    <span className="font-medium text-stone-800">{user.facility || 'Toàn hệ thống'}</span>
                  </div>
                </>}
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

            {isInternal && <Card className="p-5 bg-[#fbfaf6] border-dashed">
              <h3 className="font-semibold text-stone-900 mb-2 text-sm">Thông Tin Tổ Chức</h3>
              <p className="text-xs text-stone-600 leading-relaxed">Vai trò và cơ sở của tài khoản do công ty cấp. Mọi thay đổi cần Admin/HR duyệt và lưu audit log.</p>
              <Button className="mt-4 w-full" size="sm" onClick={() => setRequestModalOpen(true)}>Gửi yêu cầu chỉnh sửa tới Admin/HR</Button>
            </Card>}

            {isCustomer && <Card className="p-5 bg-[#fbfaf6] border-dashed">
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-500 mb-2">
                {'Bảo vệ tài khoản Customer'}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">Customer không hiển thị role hoặc facility. Bạn có thể yêu cầu đổi mật khẩu qua email ở tab Bảo mật.</p>
            </Card>}
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
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {isCustomer ? 'Nhấn nút bên dưới để ghi nhận yêu cầu đổi mật khẩu qua email. Dịch vụ auth backend sẽ gửi email thật.' : 'Mật khẩu tài khoản nội bộ do công ty cấp; yêu cầu Admin/HR xử lý thay đổi.'}
                </p>
                <Input
                  label={'Mật Khẩu Hiện Tại'}
                  type="password"
                  placeholder={'Nhập mật khẩu hiện tại...'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  disabled
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={'Mật Khẩu Mới'}
                    type="password"
                    placeholder={'Ít nhất 6 ký tự...'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled
                  />
                  <Input
                    label={'Xác Nhận Mật Khẩu Mới'}
                    type="password"
                    placeholder={'Nhập lại mật khẩu mới...'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="outline" disabled={isInternal}>
                    {isCustomer ? 'Gửi email đổi mật khẩu' : 'Chỉ xem · Liên hệ Admin/HR'}
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
                  onClick={handleRevokeAllSessions}
                  disabled={!userSessions.some(session => session.status === 'active')}
                >
                  {'Đăng Xuất Tất Cả Thiết Bị'}
                </Button>
              </div>

              <div className="space-y-3">
                {!userSessions.length && <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">Chưa có phiên nào được ghi nhận cho tài khoản này.</p>}
                {userSessions.map(session => (
                  <div key={session.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${session.status === 'active' ? 'border-emerald-200 bg-emerald-50/50' : 'border-stone-200 bg-white'}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">{session.device}</p>
                        <Badge variant={session.status === 'active' ? 'success' : session.status === 'revoked' ? 'error' : 'muted'}>
                          {session.status === 'active' ? 'Đang hoạt động' : session.status === 'revoked' ? 'Đã thu hồi' : 'Đã đăng xuất'}
                        </Badge>
                      </div>
                      <p className="text-xs text-stone-500">{session.location} · Bắt đầu {session.createdAt}</p>
                    </div>
                    {session.status === 'active' && <Button variant="ghost" size="sm" onClick={() => {
                      try {
                        if (revokeSession(session.id, user)) showToast('Đã thu hồi phiên đăng nhập.')
                      } catch (error) {
                        showToast(error instanceof Error ? error.message : 'Không thể thu hồi phiên đăng nhập.')
                      }
                    }}>Thu hồi</Button>}
                  </div>
                ))}
              </div>
            </Card>

            {isCustomer && <Card className="border-red-200 bg-red-50/40 p-6">
              <h2 className="text-lg font-bold text-red-900">Xoá tài khoản Customer</h2>
              <p className="mt-2 text-xs leading-relaxed text-red-800">Không thể xoá khi còn đơn đặt hiện tại, đơn quá hạn, đơn chưa thanh toán hoặc hợp đồng thuê chưa hoàn tất. Hệ thống sẽ kiểm tra dữ liệu trước khi xoá.</p>
              <Button type="button" variant="danger" className="mt-4" onClick={handleDeleteAccount}>Xoá tài khoản</Button>
            </Card>}
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
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled
                >
                  {'Chỉ xem · Chưa kết nối auth backend'}
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
                disabled
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-not-allowed"
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
                disabled
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-not-allowed"
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
                disabled
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-not-allowed"
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
                disabled
                className="w-4 h-4 text-amber-600 rounded mt-1 cursor-not-allowed"
              />
            </div>
          </div>
        </Card>
      )}

      <Modal open={requestModalOpen && isInternal} onClose={() => setRequestModalOpen(false)} title="Gửi yêu cầu chỉnh sửa hồ sơ">
        <div className="space-y-4">
          <p className="text-sm text-stone-600">Chọn thông tin cần chỉnh sửa. Admin/HR sẽ tiếp nhận và xử lý theo audit log.</p>
          <div className="space-y-2">
            {['Họ và Tên', 'Email liên hệ', 'Số điện thoại', 'Vai trò', 'Cơ sở phụ trách'].map(field => (
              <label key={field} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={requestFields.includes(field)}
                  onChange={event => setRequestFields(current => event.target.checked ? [...new Set([...current, field])] : current.filter(item => item !== field))}
                  className="h-4 w-4 accent-amber-600"
                />
                {field}
              </label>
            ))}
          </div>
          <Input label="Lý do / nội dung đề nghị" value={requestReason} onChange={event => setRequestReason(event.target.value)} placeholder="Nêu rõ thông tin cần chỉnh sửa (tối thiểu 10 ký tự)" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRequestModalOpen(false)}>Hủy</Button>
            <Button disabled={!requestFields.length || requestReason.trim().length < 10} onClick={handleSubmitProfileRequest}>Gửi yêu cầu</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
