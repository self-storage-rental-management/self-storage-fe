import { useEffect, useRef, useState } from 'react'
import type { PermissionKey, Role, User } from '../types'
import { Card, Button, Input, PasswordField, Badge, Avatar, Modal } from '../components/ui'
import { useStorageHub } from '../store/StorageHubContext'
import { actorToUser, changePasswordWithApi, getAuthenticatedActor, isApiAuthenticated, listMySessions, updateCurrentProfileWithApi, type ApiSession } from '../services/authApi'
import { listAccessibleFacilities, listCustomerFacilities, type CustomerFacility } from '../services/customerReservationApi'
import { listCustomerRentals, type CustomerRental } from '../services/customerRentalApi'
import { listManagerMaintenanceTasks, listStaffMaintenanceTasks, type MaintenanceTask } from '../services/maintenanceApi'
import { getManagerReportSummary, type ManagerReportSummary } from '../services/managerReportingApi'
import { getPasswordValidationError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT } from '../utils/passwordPolicy'

interface ProfileViewProps {
  user: User
  onUpdateUser?: (updated: Partial<User>) => void
}

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024
const MAX_AVATAR_DATA_LENGTH = 450_000
type ProfileTab = 'profile' | 'security' | 'role' | 'notifications'

export const roleLabelMap: Record<Role, string> = {
  customer: 'Khách Hàng Thuê Kho',
  staff: 'Chuyên Viên Vận Hành Cơ Sở',
  manager: 'Giám Đốc Quản Lý Cơ Sở',
  business: 'Quản Lý Vận Hành Kinh Doanh',
  admin: 'Quản Trị Viên Hệ Thống'
}

export interface NotificationChannel {
  id: string
  title: string
  description: string
  defaultEnabled: boolean
  badge?: string
  badgeColor?: string
}

export interface RoleNotificationConfig {
  roleTitle: string
  title: string
  subtitle: string
  channels: NotificationChannel[]
}

export const ROLE_NOTIFICATION_CONFIGS: Record<Role, RoleNotificationConfig> = {
  admin: {
    roleTitle: 'Quản Trị Viên Hệ Thống',
    title: 'Kênh Giám Sát & An Ninh Toàn Hệ Thống',
    subtitle: 'Cấu hình cảnh báo an ninh hạ tầng, audit log bảo mật và giám sát dịch vụ toàn nền tảng StorageHub.',
    channels: [
      {
        id: 'admin_security_threats',
        title: 'Cảnh Báo An Ninh & Đăng Nhập Bất Thường',
        description: 'Gửi cảnh báo tức thì khi phát hiện nhiều lần đăng nhập thất bại liên tiếp, IP lạ hoặc hành vi nghi ngờ tấn công brute-force.',
        defaultEnabled: true,
        badge: 'Bảo mật cao',
        badgeColor: 'bg-red-50 text-red-700 border-red-200'
      },
      {
        id: 'admin_audit_logs',
        title: 'Nhật Ký Quản Trị & Biến Động Phân Quyền (Audit Log)',
        description: 'Thông báo khi có nhân sự mới được tạo, tài khoản bị khóa/mở hoặc quyền hạn vai trò (Role/Permission) bị chỉnh sửa.',
        defaultEnabled: true,
        badge: 'Kiểm toán',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      {
        id: 'admin_system_health',
        title: 'Giám Sát Hạ Tầng & Trạng Thái Dịch Vụ',
        description: 'Cảnh báo khẩn cấp khi dịch vụ gửi email/SMS gặp sự cố, API gateway quá tải, thời gian phản hồi máy chủ tăng đột biến hoặc kết nối DB lỗi.',
        defaultEnabled: true,
        badge: 'Hạ tầng',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        id: 'admin_account_recovery',
        title: 'Yêu Cầu Hỗ Trợ & Mở Khóa Tài Khoản Nhân Sự',
        description: 'Nhận thông báo khi nhân sự nội bộ gửi đề xuất cấp lại mật khẩu, mở khóa tài khoản hoặc chỉnh sửa thông tin hồ sơ.',
        defaultEnabled: true,
        badge: 'Tài khoản',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
      },
      {
        id: 'admin_backup_digest',
        title: 'Báo Cáo Tình Trạng Toàn Hệ Thống Định Kỳ',
        description: 'Nhận email tổng hợp tình trạng sao lưu dữ liệu tự động, kiểm tra tính toàn vẹn hệ thống và thống kê tài nguyên hàng ngày.',
        defaultEnabled: false,
        badge: 'Báo cáo',
        badgeColor: 'bg-stone-100 text-stone-700 border-stone-200'
      }
    ]
  },
  business: {
    roleTitle: 'Quản Lý Vận Hành Kinh Doanh',
    title: 'Kênh Thông Báo Doanh Thu & Chỉ Số Vận Hành',
    subtitle: 'Theo dõi sức khỏe tài chính, dòng tiền thanh toán, hiệu suất khai thác cơ sở và các rủi ro vận hành trọng yếu.',
    channels: [
      {
        id: 'biz_revenue_summary',
        title: 'Báo Cáo Doanh Thu & Dòng Tiền Tự Động',
        description: 'Nhận bản tin email tổng hợp doanh thu thực thu, tiền cọc mới và đối soát dòng tiền theo ngày/tuần/tháng.',
        defaultEnabled: true,
        badge: 'Tài chính',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        id: 'biz_occupancy_threshold',
        title: 'Cảnh Báo Tỷ Lệ Lấp Đầy & Hiệu Suất Cơ Sở',
        description: 'Thông báo khi tỷ lệ lấp đầy tại một cơ sở đạt ngưỡng cao (>90%) để mở rộng, hoặc xuống thấp (<50%) cần chạy ưu đãi.',
        defaultEnabled: true,
        badge: 'Hiệu suất',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        id: 'biz_bad_debt_risk',
        title: 'Cảnh Báo Nợ Quá Hạn & Rủi Ro Hợp Đồng Lớn',
        description: 'Cảnh báo ngay khi có khách thuê nợ tiền kho quá 7 ngày với giá trị hợp đồng lớn cần can thiệp pháp lý.',
        defaultEnabled: true,
        badge: 'Công nợ',
        badgeColor: 'bg-red-50 text-red-700 border-red-200'
      },
      {
        id: 'biz_pricing_proposal',
        title: 'Đề Xuất Thay Đổi Bảng Giá & Chiết Khấu Cơ Sở',
        description: 'Nhận thông báo khi quản lý chi nhánh gửi đề xuất điều chỉnh bảng giá niêm yết hoặc chính sách ưu đãi thời hạn.',
        defaultEnabled: true,
        badge: 'Chính sách',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      {
        id: 'biz_high_value_disputes',
        title: 'Phê Duyệt Khiếu Nại Bồi Thường & Hoàn Tiền Lớn',
        description: 'Thông báo khi có trường hợp hoàn tiền hoặc bồi thường thiệt hại tài sản vượt quá hạn mức phê duyệt của Quản lý chi nhánh.',
        defaultEnabled: false,
        badge: 'Duyệt chi',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
      }
    ]
  },
  manager: {
    roleTitle: 'Giám Đốc Quản Lý Cơ Sở',
    title: 'Kênh Điều Phối Tác Vụ & Quản Lý Chi Nhánh',
    subtitle: 'Giám sát tiến độ công việc đội ngũ nhân viên, duyệt đặt giữ gian kho, xử lý trả kho và bảo trì cơ sở.',
    channels: [
      {
        id: 'mgr_task_progress',
        title: 'Tiến Độ Nhiệm Vụ Của Đội Ngũ Nhân Viên Cơ Sở',
        description: 'Nhận thông báo tức thì khi nhân viên tiếp nhận, hoàn thành hoặc báo không thể thực hiện nhiệm vụ được giao.',
        defaultEnabled: true,
        badge: 'Nhân sự',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
      },
      {
        id: 'mgr_reservation_assignment',
        title: 'Đơn Đặt Giữ Kho Mới Chờ Phân Gian',
        description: 'Thông báo ngay khi khách thuê cọc giữ chỗ thành công và đang chờ Quản lý chỉ định mã kho vật lý phù hợp.',
        defaultEnabled: true,
        badge: 'Đơn mới',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      {
        id: 'mgr_return_dispute_alerts',
        title: 'Biên Bản Trả Kho Hư Hại & Tranh Chấp Bồi Thường',
        description: 'Cảnh báo khi nhân viên nghiệm thu ghi nhận hư hại cơ sở vật chất hoặc khách thuê có khiếu nại về tiền cọc hoàn lại.',
        defaultEnabled: true,
        badge: 'Trả kho',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
      },
      {
        id: 'mgr_facility_incidents',
        title: 'Sự Cố Kho Bãi & Yêu Cầu Bảo Trì Khẩn Cấp',
        description: 'Nhận cảnh báo khi có sự cố khóa điện tử, rò rỉ nước, kiểm tra an toàn PCCC hoặc bảo trì thang máy tải hàng.',
        defaultEnabled: true,
        badge: 'Bảo trì',
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
      },
      {
        id: 'mgr_contract_expiries',
        title: 'Nhắc Nhở Hợp Đồng Thuê Sắp Hết Hạn Tại Chi Nhánh',
        description: 'Danh sách hợp đồng thuê còn dưới 7 ngày cần rà soát để nhân viên liên hệ tư vấn gia hạn và giữ chân khách hàng.',
        defaultEnabled: true,
        badge: 'Gia hạn',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
    ]
  },
  staff: {
    roleTitle: 'Chuyên Viên Vận Hành Cơ Sở',
    title: 'Kênh Tác Vụ Trực Tiếp & Phục Vụ Khách Hàng',
    subtitle: 'Cập nhật phân công công việc từ quản lý, lịch hẹn đón khách check-in và hỗ trợ kỹ thuật tại cơ sở.',
    channels: [
      {
        id: 'staff_new_assignments',
        title: 'Phân Công Nhiệm Vụ Mới Từ Quản Lý',
        description: 'Nhận thông báo tức thì khi Quản lý giao việc kiểm tra kho, vệ sinh, niêm phong hoặc bảo trì kỹ thuật cho bạn.',
        defaultEnabled: true,
        badge: 'Nhiệm vụ',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        id: 'staff_checkin_appointments',
        title: 'Lịch Hẹn Khách Hàng Check-in Trong Ngày',
        description: 'Nhắc nhở lịch hẹn khách thuê đến nhận kho để bạn chủ động chuẩn bị hợp đồng và hướng dẫn kích hoạt mã PIN mở cửa.',
        defaultEnabled: true,
        badge: 'Check-in',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        id: 'staff_return_handover',
        title: 'Yêu Cầu Nghiệm Thu & Tiếp Nhận Trả Kho',
        description: 'Thông báo khi khách thuê có mặt tại cơ sở hoặc gửi yêu cầu bàn giao kho để tiến hành kiểm tra tình trạng thực tế.',
        defaultEnabled: true,
        badge: 'Nghiệm thu',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
      },
      {
        id: 'staff_task_overdue_warning',
        title: 'Nhắc Nhở Hạn Chót Thực Hiện Nhiệm Vụ',
        description: 'Cảnh báo trước 30 phút khi nhiệm vụ được giao sắp đến thời hạn hoàn thành (due time) mà chưa được chốt kết quả.',
        defaultEnabled: true,
        badge: 'Gấp',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      }
    ]
  },
  customer: {
    roleTitle: 'Khách Hàng Thuê Kho',
    title: 'Kênh Thông Báo & Cảnh Báo Khách Thuê',
    subtitle: 'Kiểm soát cách thức và thời điểm StorageHub gửi thông báo tự động cho bạn về gian kho và dịch vụ.',
    channels: [
      {
        id: 'cust_invoices',
        title: 'Cảnh Báo Hóa Đơn & Tiền Thuê Kho',
        description: 'Nhận nhắc nhở hạn thanh toán và hóa đơn điện tử tự động qua email đã đăng ký.',
        defaultEnabled: true,
        badge: 'Hóa đơn',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        id: 'cust_gate_access',
        title: 'Nhật Ký Mở Cổng & Khóa Cửa Điện Tử',
        description: 'Nhận thông báo bảo mật tức thì khi mã PIN hoặc thẻ khóa kho của bạn được kích hoạt mở cửa.',
        defaultEnabled: true,
        badge: 'Bảo mật kho',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      {
        id: 'cust_maintenance',
        title: 'Bản Tin Bảo Trì Cơ Sở & Giờ Hoạt Động',
        description: 'Các thông báo quan trọng về kiểm tra PCCC, bảo dưỡng thang máy hoặc giờ đóng/mở cửa nghỉ lễ tại cơ sở bạn thuê.',
        defaultEnabled: true,
        badge: 'Cơ sở',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      {
        id: 'cust_marketing',
        title: 'Chương Trình Ưu Đãi & Điểm Thưởng Thành Viên',
        description: 'Nhận thông báo về các ưu đãi chiết khấu gia hạn, nâng cấp gian kho và quyền lợi thành viên StorageHub.',
        defaultEnabled: false,
        badge: 'Ưu đãi',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
      }
    ]
  }
}

function profileTabFromLocation(): ProfileTab {
  const url = new URL(window.location.href)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/profile/security' || url.searchParams.get('tab') === 'security') return 'security'
  if (url.searchParams.get('tab') === 'role') return 'role'
  if (url.searchParams.get('tab') === 'notifications') return 'notifications'
  return 'profile'
}

function cleanProfilePhone(value: string): string {
  let phone = value.replace(/[\s().-]/g, '')
  if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`
  if (phone.startsWith('84')) phone = `0${phone.slice(2)}`
  return phone
}

function validateProfileForm(fields: {
  name: string
  phone: string
  permanentAddress: string
  emergencyContactName: string
  emergencyContactPhone: string
}): string | null {
  const name = fields.name.trim()
  const address = fields.permanentAddress.trim()
  const emergencyName = fields.emergencyContactName.trim()
  const phone = cleanProfilePhone(fields.phone.trim())
  const emergencyPhone = cleanProfilePhone(fields.emergencyContactPhone.trim())

  if (name.length < 2) return 'Họ và tên phải có ít nhất 2 ký tự.'
  if (fields.phone.trim() && !/^0\d{9}$/.test(phone)) return 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0.'
  if (address.length < 5) return 'Địa chỉ thường trú phải có ít nhất 5 ký tự.'
  if (emergencyName.length < 2) return 'Tên người liên hệ khẩn cấp phải có ít nhất 2 ký tự.'
  if (!/^0\d{9}$/.test(emergencyPhone)) return 'SĐT liên hệ khẩn cấp phải gồm 10 số và bắt đầu bằng 0.'
  return null
}

function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Vui lòng chọn tệp hình ảnh.'))
  if (file.size > MAX_AVATAR_FILE_SIZE) return Promise.reject(new Error('Ảnh đại diện không được vượt quá 5 MB.'))

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Tệp ảnh không hợp lệ.'))
      image.onload = () => {
        const maxSide = 256
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        if (dataUrl.length > MAX_AVATAR_DATA_LENGTH) {
          reject(new Error('Ảnh đại diện sau khi nén vẫn quá lớn. Vui lòng chọn ảnh khác.'))
          return
        }
        resolve(dataUrl)
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

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

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 border-b border-stone-100 pb-4">
      <h2 className="text-lg font-bold text-stone-900">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">{description}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 py-2 last:border-0">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-semibold text-stone-800">{value}</span>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
    </div>
  )
}

export default function ProfileView({ user, onUpdateUser }: ProfileViewProps) {
  const {
    sessions,
    rentals,
    facilities,
    staffTasks,
    revokeSession,
    revokeAllUserSessions,
    updateCustomerProfile,
    submitProfileChangeRequest,
  } = useStorageHub()
  const isCustomer = user.role === 'customer'
  const isInternal = !isCustomer
  const apiMode = isApiAuthenticated()
  const apiActor = getAuthenticatedActor()
  const [activeTab, setActiveTab] = useState<ProfileTab>(profileTabFromLocation)

  // Form states
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone || '')
  const [permanentAddress, setPermanentAddress] = useState(user.permanentAddress || '')
  const [emergencyContactName, setEmergencyContactName] = useState(user.emergencyContactName || '')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user.emergencyContactPhone || '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || '')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Security states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Persisted notification preferences per user and role
  const userRole = (user.role in ROLE_NOTIFICATION_CONFIGS ? user.role : 'customer') as Role
  const roleConfig = ROLE_NOTIFICATION_CONFIGS[userRole]

  const notifStorageKey = `storagehub:notifications:${user.id}`
  const [notifPreferences, setNotifPreferences] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(notifStorageKey)
      if (stored) return JSON.parse(stored)
    } catch {
      // ignore
    }
    const defaults: Record<string, boolean> = {}
    roleConfig.channels.forEach(ch => {
      defaults[ch.id] = ch.defaultEnabled
    })
    return defaults
  })

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requestFields, setRequestFields] = useState<string[]>(['Họ và Tên', 'Email liên hệ'])
  const [apiSessions, setApiSessions] = useState<ApiSession[]>([])
  const [apiFacilities, setApiFacilities] = useState<CustomerFacility[]>([])
  const [apiFacilitiesError, setApiFacilitiesError] = useState(false)
  const [apiRentals, setApiRentals] = useState<CustomerRental[]>([])
  const [apiRentalsError, setApiRentalsError] = useState(false)
  const [apiMaintenanceTasks, setApiMaintenanceTasks] = useState<MaintenanceTask[]>([])
  const [apiMaintenanceError, setApiMaintenanceError] = useState(false)
  const [apiManagerSummary, setApiManagerSummary] = useState<ManagerReportSummary | null>(null)
  const [apiManagerSummaryError, setApiManagerSummaryError] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Synchronize notification preferences when user or role changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`storagehub:notifications:${user.id}`)
      if (stored) {
        setNotifPreferences(JSON.parse(stored))
        return
      }
    } catch {
      // ignore
    }
    const currentConfig = ROLE_NOTIFICATION_CONFIGS[user.role] ?? ROLE_NOTIFICATION_CONFIGS.customer
    const defaults: Record<string, boolean> = {}
    currentConfig.channels.forEach(ch => {
      defaults[ch.id] = ch.defaultEnabled
    })
    setNotifPreferences(defaults)
  }, [user.id, user.role])

  const handleToggleChannel = (channelId: string, channelTitle: string, nextVal: boolean) => {
    const updated = { ...notifPreferences, [channelId]: nextVal }
    setNotifPreferences(updated)
    try {
      localStorage.setItem(`storagehub:notifications:${user.id}`, JSON.stringify(updated))
    } catch {
      // ignore
    }
    showToast(`Đã ${nextVal ? 'bật' : 'tắt'} ${channelTitle}.`)
  }

  const handleToggleAllChannels = (enabled: boolean) => {
    const updated = { ...notifPreferences }
    roleConfig.channels.forEach(ch => {
      updated[ch.id] = enabled
    })
    setNotifPreferences(updated)
    try {
      localStorage.setItem(`storagehub:notifications:${user.id}`, JSON.stringify(updated))
    } catch {
      // ignore
    }
    showToast(enabled ? 'Đã bật tất cả thông báo.' : 'Đã tắt tất cả thông báo.')
  }

  const handleResetChannelDefaults = () => {
    const defaults: Record<string, boolean> = {}
    roleConfig.channels.forEach(ch => {
      defaults[ch.id] = ch.defaultEnabled
    })
    setNotifPreferences(defaults)
    try {
      localStorage.setItem(`storagehub:notifications:${user.id}`, JSON.stringify(defaults))
    } catch {
      // ignore
    }
    showToast('Đã khôi phục cài đặt thông báo mặc định.')
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCustomer) return
    const validationError = validateProfileForm({ name, phone, permanentAddress, emergencyContactName, emergencyContactPhone })
    if (validationError) {
      showToast(validationError)
      return
    }
    try {
      const normalizedPhone = cleanProfilePhone(phone.trim())
      const normalizedEmergencyPhone = cleanProfilePhone(emergencyContactPhone.trim())
      const profile = {
        fullName: name.trim(),
        phone: normalizedPhone,
        permanentAddress: permanentAddress.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: normalizedEmergencyPhone,
        avatarUrl,
      }
      if (isApiAuthenticated()) {
        const actor = await updateCurrentProfileWithApi(profile)
        setAvatarUrl(actor.avatarUrl || '')
        onUpdateUser?.(actorToUser(actor))
      } else {
        updateCustomerProfile({ name, email, phone, permanentAddress, emergencyContactName, emergencyContactPhone, avatar: avatarUrl }, user)
      }
      showToast('Đã cập nhật thông tin cá nhân.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật thông tin cá nhân.')
    }
  }

  useEffect(() => {
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone || '')
    setPermanentAddress(user.permanentAddress || '')
    setEmergencyContactName(user.emergencyContactName || '')
    setEmergencyContactPhone(user.emergencyContactPhone || '')
    setAvatarUrl(user.avatar || '')
  }, [user.id, user.name, user.email, user.phone, user.permanentAddress, user.emergencyContactName, user.emergencyContactPhone, user.avatar])

  useEffect(() => {
    const syncProfileTab = () => setActiveTab(profileTabFromLocation())
    window.addEventListener('popstate', syncProfileTab)
    return () => window.removeEventListener('popstate', syncProfileTab)
  }, [])

  const selectProfileTab = (tab: ProfileTab) => {
    const url = new URL(window.location.href)
    url.pathname = '/'
    url.searchParams.set('page', 'profile')
    if (tab === 'security' || tab === 'role' || tab === 'notifications') url.searchParams.set('tab', tab)
    else url.searchParams.delete('tab')
    window.history.pushState({ page: 'profile', tab }, '', url)
    setActiveTab(tab)
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const nextAvatarUrl = await compressAvatar(file)
      setAvatarUrl(nextAvatarUrl)
      if (isApiAuthenticated()) {
        const actor = await updateCurrentProfileWithApi({
          fullName: name.trim(),
          avatarUrl: nextAvatarUrl,
        })
        setAvatarUrl(actor.avatarUrl || nextAvatarUrl)
        onUpdateUser?.(actorToUser(actor))
      } else if (isCustomer) {
        updateCustomerProfile({ name, email, phone, permanentAddress, emergencyContactName, emergencyContactPhone, avatar: nextAvatarUrl }, user)
      }
      showToast('Đã cập nhật ảnh đại diện.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể cập nhật ảnh đại diện.')
    }
  }

  useEffect(() => {
    if (!isApiAuthenticated()) {
      setApiSessions([])
      return
    }
    let cancelled = false
    void listMySessions()
      .then(nextSessions => {
        if (!cancelled) setApiSessions(nextSessions)
      })
      .catch(() => {
        if (!cancelled) setApiSessions([])
      })
    return () => {
      cancelled = true
    }
  }, [user.id, activeTab])

  useEffect(() => {
    if (!apiMode || user.role === 'admin') {
      setApiFacilities([])
      setApiFacilitiesError(false)
      return
    }

    let cancelled = false
    setApiFacilitiesError(false)
    const loadFacilities = user.role === 'customer' ? listCustomerFacilities : listAccessibleFacilities
    loadFacilities(0, 100)
      .then(response => {
        if (!cancelled) setApiFacilities(Array.isArray(response.data) ? response.data : [])
      })
      .catch(() => {
        if (!cancelled) {
          setApiFacilities([])
          setApiFacilitiesError(true)
        }
      })

    return () => { cancelled = true }
  }, [apiMode, user.id, user.role])

  useEffect(() => {
    if (!apiMode || user.role !== 'customer') {
      setApiRentals([])
      setApiRentalsError(false)
      return
    }

    let cancelled = false
    setApiRentalsError(false)
    listCustomerRentals()
      .then(response => {
        if (!cancelled) setApiRentals(Array.isArray(response.data) ? response.data : [])
      })
      .catch(() => {
        if (!cancelled) {
          setApiRentals([])
          setApiRentalsError(true)
        }
      })

    return () => { cancelled = true }
  }, [apiMode, user.id, user.role])

  useEffect(() => {
    if (!apiMode || !['staff', 'manager'].includes(user.role)) {
      setApiMaintenanceTasks([])
      setApiMaintenanceError(false)
      setApiManagerSummary(null)
      setApiManagerSummaryError(false)
      return
    }

    let cancelled = false
    setApiMaintenanceError(false)
    setApiManagerSummaryError(false)
    const taskRequest = user.role === 'staff'
      ? listStaffMaintenanceTasks({ assignedStaffId: user.id, pageSize: 100 })
      : listManagerMaintenanceTasks({ facilityId: user.facilityId, pageSize: 100 })
    const summaryRequest = user.role === 'manager' ? getManagerReportSummary(user.facilityId) : Promise.resolve(null)

    void Promise.allSettled([taskRequest, summaryRequest]).then(([tasksResult, summaryResult]) => {
      if (cancelled) return
      if (tasksResult.status === 'fulfilled') setApiMaintenanceTasks(tasksResult.value.data)
      else setApiMaintenanceError(true)
      if (user.role === 'manager') {
        if (summaryResult.status === 'fulfilled' && summaryResult.value) setApiManagerSummary(summaryResult.value.data)
        else setApiManagerSummaryError(true)
      }
    })

    return () => { cancelled = true }
  }, [apiMode, user.id, user.role, user.facilityId])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      showToast('Vui lòng nhập mật khẩu hiện tại.')
      return
    }
    const passwordError = getPasswordValidationError(newPassword)
    if (passwordError) {
      showToast(passwordError)
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp.')
      return
    }
    if (newPassword === currentPassword) {
      showToast('Mật khẩu mới phải khác mật khẩu hiện tại.')
      return
    }
    try {
      await changePasswordWithApi(currentPassword, newPassword)
      showToast('Đổi mật khẩu thành công.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      showToast(message === 'The current password is incorrect'
        ? 'Mật khẩu hiện tại không chính xác.'
        : message === 'The new password must be different from the current password'
          ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
          : message || 'Không thể đổi mật khẩu.')
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



  const userSessions = sessions.filter(session => session.userId === user.id)
  const apiSessionRows = apiSessions.map(session => ({
    id: session.id,
    userId: user.id,
    userName: user.name,
    email: user.email,
    status: session.active ? 'active' as const : session.revokedAt ? 'revoked' as const : 'signed_out' as const,
    device: session.userAgent || 'Thiết bị không xác định',
    location: session.createdIp || 'Địa chỉ IP không xác định',
    createdAt: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.createdAt)),
  }))
  const sessionRows = isApiAuthenticated() ? apiSessionRows : userSessions
  const handleRevokeAllSessions = () => {
    try {
      const count = revokeAllUserSessions(user.id, user)
      if (count > 0) showToast(`Đã thu hồi ${count} phiên đăng nhập.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể thu hồi phiên đăng nhập.')
    }
  }

  const roleTabLabels: Record<Role, string> = {
    admin: 'Bảo Mật Cấp Cao',
    customer: 'Kho & Liên Hệ',
    staff: 'Công Việc & Ca Trực',
    manager: 'Phạm Vi & Ủy Quyền',
    business: 'Phê Duyệt & Báo Cáo',
  }
  const currentFacility = facilities.find(item => item.id === user.facilityId || item.code === user.facilityId)
  const apiFacility = apiFacilities.find(item => item.id === user.facilityId || item.code === user.facilityId)
  const roleFacilityName = apiMode
    ? apiFacility?.name || (apiFacilitiesError ? 'Không tải được dữ liệu cơ sở' : 'Chưa gán cơ sở')
    : currentFacility?.name || user.facility || 'Chưa gán cơ sở'
  const businessPermissionLabels: Array<[PermissionKey, string]> = [
    ['reports:read', 'Báo cáo'],
    ['policies:read', 'Xem chính sách'],
    ['policies:update', 'Cập nhật chính sách'],
    ['reservations:approve', 'Phê duyệt yêu cầu'],
  ]
  const grantedBusinessCapabilities = businessPermissionLabels
    .filter(([permission]) => user.permissions?.includes(permission))
    .map(([, label]) => label)
  const userRentals = rentals.filter(item => item.customerId === user.id || item.customerEmail === user.email)
  const activeRentals = userRentals.filter(item => ['active', 'return_requested'].includes(item.status))
  const assignedTasks = staffTasks.filter(item => item.assignedStaffId === user.id || item.facilityId === user.facilityId)
  const openTasks = assignedTasks.filter(item => ['open', 'in_progress'].includes(item.status))
  const openApiTasks = apiMaintenanceTasks.filter(item => ['open', 'in_progress'].includes(item.status))

  const renderRolePanel = () => {
    if (user.role === 'admin') {
      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <SectionTitle title="Xác thực đa yếu tố" description="Tăng cường bảo vệ tài khoản quản trị hệ thống." />
            <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="font-semibold text-stone-900">Google Authenticator / FIDO2</p>
                <p className="mt-1 text-xs text-stone-600">Chưa có cấu hình MFA từ backend.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => showToast('Tính năng MFA sẽ mở sau khi backend cung cấp cấu hình bảo mật.')}>Cấu hình</Button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-stone-200 p-4">
              <div>
                <p className="font-semibold text-stone-900">Mã khôi phục khẩn cấp</p>
                <p className="mt-1 text-xs text-stone-500">Chưa phát hành bộ mã dự phòng.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => showToast('Chưa thể tạo mã khôi phục khi backend chưa bật MFA.')}>Tạo mã</Button>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle title="Lược sử truy cập kỹ thuật" description="Năm phiên gần nhất được trả về từ hệ thống." />
            <div className="space-y-2">
              {apiSessions.slice(0, 5).map(session => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">{session.userAgent || 'Thiết bị không xác định'}</p>
                    <p className="text-xs text-stone-500">{session.createdIp || 'Không có IP'} · {new Date(session.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  <Badge variant={session.active ? 'success' : 'muted'}>{session.active ? 'Đang hoạt động' : 'Đã đóng'}</Badge>
                </div>
              ))}
              {!apiSessions.length && <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">Chưa có dữ liệu truy cập từ backend.</p>}
            </div>
          </Card>

          <Card className="p-6 xl:col-span-2">
            <SectionTitle title="API Key & Personal Access Token" description="Dành cho tích hợp nội bộ, webhook và công cụ DevOps." />
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-600">Chưa có token cá nhân nào. Token chỉ được hiển thị một lần sau khi backend hỗ trợ phát hành.</p>
              <Button variant="outline" size="sm" onClick={() => showToast('API token chưa được bật cho tài khoản này.')}>Tạo token</Button>
            </div>
          </Card>
          <Card className="p-6 xl:col-span-2">
            <SectionTitle title="Nhật ký thao tác của tôi" description="Các thay đổi do tài khoản này thực hiện trên hệ thống." />
            <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500">Nhật ký cá nhân sẽ hiển thị khi backend cung cấp bộ lọc theo người thực hiện.</p>
          </Card>
        </div>
      )
    }

    if (user.role === 'customer') {
      const visibleRentals = apiMode ? apiRentals.filter(rental => ['active', 'return_requested'].includes(rental.status)) : activeRentals
      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="p-6 xl:col-span-2">
            <SectionTitle title={`Kho đang thuê (${visibleRentals.length})`} description="Các hợp đồng còn hiệu lực thuộc tài khoản của bạn." />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {apiMode && visibleRentals.map(rental => (
                <div key={rental.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-stone-900">{rental.storageUnitCode}</p>
                    <Badge variant={rental.status === 'active' ? 'success' : 'warning'}>{rental.status === 'active' ? 'Đang thuê' : 'Đang trả kho'}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{rental.facilityName}</p>
                  <p className="mt-1 text-xs text-stone-500">Hết hạn: {new Date(rental.contractEndDate).toLocaleDateString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-stone-500">Địa chỉ: {rental.facilityAddress}</p>
                </div>
              ))}
              {!apiMode && activeRentals.map(rental => (
                <div key={rental.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-stone-900">{rental.unitId}</p>
                    <Badge variant="success">Đang thuê</Badge>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{rental.facilityName}</p>
                  <p className="mt-1 text-xs text-stone-500">Hết hạn: {new Date(rental.endDate).toLocaleDateString('vi-VN')}</p>
                  <p className="mt-1 text-xs text-stone-500">Mã PIN: {rental.gateCode || 'Được cấp khi bàn giao'}</p>
                </div>
              ))}
              {apiMode && apiRentalsError && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700 md:col-span-2">Không tải được hồ sơ thuê từ backend.</p>}
              {apiMode && !apiRentalsError && !visibleRentals.length && <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500 md:col-span-2">Chưa có hồ sơ thuê đang hiệu lực.</p>}
              {!apiMode && !activeRentals.length && <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-500 md:col-span-2">Chưa có kho đang thuê trong dữ liệu tài khoản.</p>}
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Người liên hệ khẩn cấp" description="Dùng khi có sự cố kho hoặc không thể liên lạc với chủ hợp đồng." />
            <div className="space-y-2 text-sm">
              <InfoRow label="Họ và tên" value={emergencyContactName || 'Chưa cập nhật'} />
              <InfoRow label="Số điện thoại" value={emergencyContactPhone || 'Chưa cập nhật'} />
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Thanh toán & nhắc hạn" description="Thiết lập thanh toán mặc định và thông báo kỳ thuê." />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-4">
              <div>
                <p className="font-semibold text-stone-900">Phương thức thanh toán mặc định</p>
                <p className="mt-1 text-xs text-stone-500">Chưa liên kết thẻ hoặc tài khoản ngân hàng.</p>
              </div>
              <Badge variant="muted">Chưa thiết lập</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-4">
              <p className="text-sm text-stone-700">Nhận email nhắc hạn thuê trước 5 ngày</p>
              <ToggleSwitch id="customer-rent-reminder" checked={notifPreferences.cust_invoices ?? true} onChange={value => handleToggleChannel('cust_invoices', 'Nhắc hạn thuê', value)} label="Nhắc hạn thuê" />
            </div>
          </Card>
        </div>
      )
    }

    if (user.role === 'staff') {
      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <SectionTitle title="Thông tin điểm làm việc" description="Định danh cơ sở và kênh liên hệ tại chỗ." />
            <div className="space-y-2 text-sm">
              <InfoRow label="Mã nhân viên" value={`#STF-${user.id.slice(0, 8).toUpperCase()}`} />
              <InfoRow label="Cơ sở trực thuộc" value={roleFacilityName} />
              <InfoRow label="Quản lý trực tiếp" value={apiMode ? 'Chưa có API thông tin quản lý' : currentFacility?.manager || 'Chưa có dữ liệu quản lý'} />
              <InfoRow label="Hotline cơ sở" value={apiMode ? 'Chưa có API hotline cơ sở' : currentFacility?.phone || 'Chưa cập nhật'} />
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Ca trực & nhiệm vụ hôm nay" description="Công việc được phân công từ hệ thống vận hành." />
            {apiMode ? (
              apiMaintenanceError ? (
                <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Không tải được nhiệm vụ vận hành từ backend.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricTile label="Đang xử lý" value={openApiTasks.length} />
                    <MetricTile label="Tổng nhiệm vụ" value={apiMaintenanceTasks.length} />
                  </div>
                  {!apiMaintenanceTasks.length && <p className="mt-4 rounded-lg bg-stone-50 p-3 text-xs text-stone-500">Chưa có nhiệm vụ được phân công.</p>}
                </>
              )
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile label="Đang xử lý" value={openTasks.length} />
                  <MetricTile label="Tổng nhiệm vụ" value={assignedTasks.length} />
                </div>
                <p className="mt-4 rounded-lg bg-stone-50 p-3 text-xs text-stone-500">Lịch ca chi tiết sẽ hiển thị khi backend ca trực được kết nối.</p>
              </>
            )}
          </Card>
        </div>
      )
    }

    if (user.role === 'manager') {
      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <SectionTitle title="Phạm vi quản lý chi nhánh" description="Quy mô và cơ sở đang được gắn trong hồ sơ tài khoản." />
            <div className="space-y-2 text-sm">
              <InfoRow label="Cơ sở quản lý" value={roleFacilityName} />
              <InfoRow label="Tổng số gian kho" value={apiMode ? (apiManagerSummary ? String(apiManagerSummary.totalUnits) : apiManagerSummaryError ? 'Không tải được dữ liệu' : 'Đang tải...') : currentFacility ? String(currentFacility.units) : 'Chưa có dữ liệu'} />
              <InfoRow label="Đang khai thác" value={apiMode ? (apiManagerSummary ? String(apiManagerSummary.occupiedUnits) : apiManagerSummaryError ? 'Không tải được dữ liệu' : 'Đang tải...') : currentFacility ? String(currentFacility.occupied) : 'Chưa có dữ liệu'} />
              {apiMode && apiManagerSummary && <InfoRow label="Nhiệm vụ bảo trì mở" value={String(apiManagerSummary.openMaintenanceTasksCount)} />}
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Ủy quyền ca trực" description="Thiết lập người thay thế khi vắng mặt hoặc nghỉ phép." />
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
              <p className="font-semibold text-stone-800">Chưa có người được ủy quyền</p>
              <p className="mt-1 text-xs text-stone-500">Dữ liệu ủy quyền cần được lưu và kiểm tra từ backend.</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => showToast('Tính năng ủy quyền chưa được bật.')}>Thiết lập</Button>
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <SectionTitle title="Phạm vi vận hành" description="Thông tin thẩm quyền kinh doanh được cấp cho tài khoản." />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <span className="text-sm font-semibold text-emerald-900">Phạm vi dữ liệu</span>
              <Badge variant="success">{apiMode && Object.keys(apiActor?.facilityScopes ?? {}).length ? 'Theo cơ sở được cấp' : 'Toàn quốc (Tất cả cơ sở)'}</Badge>
            </div>
            <InfoRow label="Số cơ sở trong phạm vi" value={apiMode ? (apiFacilities.length ? `${apiFacilities.length} cơ sở` : apiFacilitiesError ? 'Không tải được dữ liệu cơ sở' : 'Chưa có dữ liệu') : facilities.length ? `${facilities.length} cơ sở` : 'Chưa có dữ liệu'} />
            <InfoRow
              label="Quyền nghiệp vụ"
              value={apiMode
                ? grantedBusinessCapabilities.join(', ') || 'Chưa có quyền nghiệp vụ từ backend'
                : 'Báo cáo, chính sách và phê duyệt theo phân quyền'}
            />
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle title="Mã xác nhận phê duyệt" description="Xác nhận riêng cho các thao tác nhạy cảm về giá và chính sách." />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
            <div>
              <p className="font-semibold text-stone-800">Approval PIN</p>
              <p className="mt-1 text-xs text-stone-500">Chưa thiết lập mã xác nhận trong backend.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => showToast('Approval PIN chưa được bật.')}>Thiết lập</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="fade-in mx-auto w-full max-w-7xl space-y-6">
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
              <Avatar name={user.name} size="lg" imageUrl={avatarUrl} />
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <button
                type="button"
                className="absolute -bottom-1 -right-1 bg-[#e9a12c] text-[#292a27] p-1.5 rounded-full hover:bg-amber-400 transition shadow cursor-pointer"
                title="Đổi ảnh đại diện"
                aria-label="Đổi ảnh đại diện"
                onClick={() => avatarInputRef.current?.click()}
              >
                <svg className="show-icon w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-stone-100">{user.name}</h1>
                <span className="inline-flex items-center rounded bg-[#e9a12c] px-2.5 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-[.08em] text-[#3f2607]">
                  {roleLabelMap[user.role] ?? user.role}
                </span>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-300">
                <span>{user.email}</span>
                <span className="text-stone-500">•</span>
                <span>Mã người dùng: {user.id.slice(0, 12).toUpperCase()}</span>
                {user.facility && <><span className="text-stone-500">•</span><span>Cơ sở: {user.facility}</span></>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#deddd2] pb-1">
        {([
          ['profile', 'Thông Tin Cơ Bản'],
          ['security', 'Bảo Mật Tài Khoản'],
          ['role', roleTabLabels[user.role]],
          ['notifications', 'Tùy Chọn Thông Báo'],
        ] as [ProfileTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => selectProfileTab(tab)}
            className={`-mb-[2px] rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? 'border-[#e9a12c] bg-white text-stone-900 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: General Info */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isInternal ? (
              /* Internal Staff / Manager / Business / Admin: Clean Key-Value Profile Card */
              <Card className="p-6">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-stone-100">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Thông Tin Cơ Bản</h2>
                    <p className="text-xs text-stone-500">Thông tin nhận diện và liên hệ của tài khoản</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-stone-100 text-stone-700">Hồ sơ nội bộ</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Họ và Tên</span>
                    <span className="font-bold text-stone-900 text-base">{name}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Địa Chỉ Email Công Tác</span>
                    <span className="font-semibold text-stone-900 text-sm">{email}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Số Điện Thoại Chính</span>
                    <span className="font-semibold text-stone-900 text-sm">{phone || 'Chưa cập nhật'}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1">Mã Định Danh Người Dùng</span>
                    <span className="font-mono text-xs font-semibold text-stone-900">{user.id}</span>
                  </div>

                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-500">
                  <span>Thông tin nhân sự được đồng bộ tập trung. Khi cần thay đổi, hãy gửi yêu cầu tới Admin/HR.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRequestModalOpen(true)}
                    className="shrink-0 border-stone-300 hover:bg-stone-100 text-stone-800 cursor-pointer"
                  >
                    Gửi Yêu Cầu Chỉnh Sửa
                  </Button>
                </div>
              </Card>
            ) : (
              /* Customer: Editable Profile Form */
              <Card className="p-6">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-stone-100">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Thông Tin Cơ Bản</h2>
                    <p className="text-xs text-stone-500">Cập nhật thông tin liên hệ và người liên hệ khẩn cấp</p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Họ và tên"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                    />
                    <Input
                      label="Địa Chỉ Email"
                      type="email"
                      value={email}
                      readOnly
                      title="Email đăng nhập không thể thay đổi"
                    />
                  </div>

                  <Input
                    label="Số điện thoại Việt Nam"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0901 234 567"
                    inputMode="tel"
                  />

                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                    <span className="block text-xs font-medium text-stone-500">Mã định danh người dùng</span>
                    <span className="font-mono text-xs font-semibold text-stone-800">{user.id}</span>
                  </div>

                  <label className="space-y-1 block text-sm font-medium text-stone-700">
                    <span>Địa chỉ thường trú</span>
                    <textarea
                      value={permanentAddress}
                      onChange={e => setPermanentAddress(e.target.value)}
                      placeholder="Nhập số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                      rows={3}
                      className="w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal text-stone-800 placeholder-stone-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Người liên hệ khẩn cấp"
                      value={emergencyContactName}
                      onChange={e => setEmergencyContactName(e.target.value)}
                      placeholder="Họ và tên người liên hệ"
                      required
                    />
                    <Input
                      label="SĐT liên hệ khẩn cấp"
                      value={emergencyContactPhone}
                      onChange={e => setEmergencyContactPhone(e.target.value)}
                      placeholder="0901 234 567"
                      inputMode="tel"
                      required
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-stone-100">
                    <Button type="submit" variant="primary" className="cursor-pointer">
                      Lưu Thay Đổi
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </div>

          {/* Supporting information */}
          <div className="space-y-4">
            {isInternal && (
              <Card className="p-5 bg-[#fbfaf6] border-stone-200">
                <h3 className="font-semibold text-stone-900 mb-2 text-sm">Thông Tin Tổ Chức</h3>
                <p className="text-xs text-stone-600 leading-relaxed">Vai trò và cơ sở của tài khoản do công ty cấp. Mọi thay đổi cần Admin/HR duyệt và lưu audit log.</p>
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
                <p className="text-xs text-stone-600 leading-relaxed">Hồ sơ khách hàng được bảo mật theo tiêu chuẩn StorageHub. Bạn có thể đổi mật khẩu trực tiếp ở tab Bảo mật.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Security & Credentials */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="max-w-5xl space-y-6">
            <Card className="p-6">
              <div className="pb-4 mb-5 border-b border-stone-100">
                <h2 className="text-lg font-bold text-stone-900">Đổi Mật Khẩu Cá Nhân</h2>
                <p className="text-xs text-stone-500">{PASSWORD_POLICY_HINT}</p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <PasswordField
                  id="profile-current-password"
                  label="Mật Khẩu Hiện Tại"
                  placeholder="Nhập mật khẩu hiện tại..."
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PasswordField
                    id="profile-new-password"
                    label="Mật Khẩu Mới"
                    placeholder={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự...`}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    maxLength={PASSWORD_MAX_LENGTH}
                  />
                  <PasswordField
                    id="profile-confirm-password"
                    label="Xác Nhận Mật Khẩu Mới"
                    placeholder="Nhập lại mật khẩu mới..."
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    maxLength={PASSWORD_MAX_LENGTH}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" className="cursor-pointer">
                    Đổi Mật Khẩu
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
                {!isApiAuthenticated() && <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeAllSessions}
                  disabled={!userSessions.some(session => session.status === 'active')}
                  className="cursor-pointer"
                >
                  {'Đăng Xuất Tất Cả Thiết Bị'}
                </Button>}
              </div>

              <div className="space-y-3">
                {!sessionRows.length && <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">Chưa có phiên nào được ghi nhận cho tài khoản này.</p>}
                {sessionRows.map(session => (
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
                    {session.status === 'active' && !isApiAuthenticated() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => {
                          try {
                            if (revokeSession(session.id, user)) showToast('Đã thu hồi phiên đăng nhập.')
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : 'Không thể thu hồi phiên đăng nhập.')
                          }
                        }}
                      >
                        Thu hồi
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

          </div>

        </div>
      )}

      {/* TAB 3: Role-specific workspace */}
      {activeTab === 'role' && renderRolePanel()}

      {/* TAB 4: Notifications (Tailored per Role) */}
      {activeTab === 'notifications' && (
        <Card className="max-w-5xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 mb-6 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h2 className="text-lg font-bold text-stone-900">
                  {roleConfig.title}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#e9a12c]/15 text-[#8f5200] border border-[#e9a12c]/30">
                  Vai trò: {roleLabelMap[user.role] ?? roleConfig.roleTitle}
                </span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed max-w-xl">
                {roleConfig.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleAllChannels(true)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
              >
                Bật tất cả
              </button>
              <button
                type="button"
                onClick={() => handleToggleAllChannels(false)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
              >
                Tắt tất cả
              </button>
              <button
                type="button"
                onClick={handleResetChannelDefaults}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition cursor-pointer"
                title="Khôi phục mặc định"
              >
                Mặc định
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {roleConfig.channels.map(channel => {
              const isChecked = notifPreferences[channel.id] ?? channel.defaultEnabled
              return (
                <div
                  key={channel.id}
                  className="flex items-start justify-between gap-4 p-4 rounded-xl bg-stone-50/80 border border-stone-200/80 hover:bg-stone-100/70 transition"
                >
                  <div className="space-y-1.5 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-stone-900 text-sm">
                        {channel.title}
                      </p>
                      {channel.badge && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${channel.badgeColor || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                          {channel.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {channel.description}
                    </p>
                  </div>
                  <ToggleSwitch
                    id={`toggle-notif-${channel.id}`}
                    checked={isChecked}
                    onChange={val => handleToggleChannel(channel.id, channel.title, val)}
                    label={channel.title}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
            <span>Tùy chọn được lưu tự động theo tài khoản của bạn trên thiết bị này</span>
            <span className="font-mono text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Tự động lưu
            </span>
          </div>
        </Card>
      )}

      <Modal open={requestModalOpen && isInternal} onClose={() => setRequestModalOpen(false)} title="Gửi Yêu Cầu Chỉnh Sửa Hồ Sơ">
        <div className="space-y-5">
          <p className="text-xs text-stone-500 leading-relaxed">
            Chọn các hạng mục thông tin cần điều chỉnh. Đề xuất sẽ được chuyển trực tiếp đến bộ phận Quản Trị & Nhân Sự (Admin/HR) xem xét, phê duyệt và lưu nhật ký kiểm toán (audit log).
          </p>

          <div>
            <span className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2.5">
              Hạng mục cần cập nhật <span className="text-amber-600">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { id: 'Họ và Tên', label: 'Họ và Tên' },
                { id: 'Email liên hệ', label: 'Email công tác' },
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
              Gửi Yêu Cầu Tới Admin/HR
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
