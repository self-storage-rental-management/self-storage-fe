import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Language = 'en' | 'vi'
export const USD_TO_VND_RATE = 26000

// interface LanguageContextType {
//   lang: Language
//   setLang: (lang: Language) => void
//   toggleLang: () => void
//   t: (key: string, fallback?: string) => string
// }

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  toggleLang: () => void
  t: (key: string, fallback?: string) => string
  formatCurrency: (usdAmount: number) => string
}

const STORAGE_KEY = 'storagehub:lang'

export const dictionary: Record<Language, Record<string, string>> = {
  en: {
    // Nav & Common
    'nav.overview': 'Overview',
    'nav.browse-facilities': 'Find a Facility',
    'nav.browse-units': 'Available Units',
    'nav.reservations': 'Reservations',
    'nav.my-rentals': 'My Rentals',
    'nav.payments': 'Payments',
    'nav.tasks': 'Daily Tasks',
    'nav.checkin': 'Check-in / Handover',
    'nav.return': 'Return Inspection',
    'nav.support': 'Support Tickets',
    'nav.rentals': 'Active Rentals',
    'nav.overdue': 'Overdue Accounts',
    'nav.dashboard': 'Dashboard',
    'nav.reports': 'Facility Reports',
    'nav.units': 'Unit Management',
    'nav.staff': 'Staff Assignment',
    'nav.facilities': 'Facilities Overview',
    'nav.performance': 'Performance Reports',
    'nav.policies': 'Rental Policies',
    'nav.pricing': 'Pricing & Fees',
    'nav.revenue': 'Revenue Reports',
    'nav.users': 'User Management',
    'nav.roles': 'Roles & Permissions',
    'nav.login-history': 'Login History',
    'nav.activity': 'Activity Logs',
    'nav.settings': 'System Settings',
    'nav.profile': 'My Profile',
    'nav.account': 'My Account',
    'nav.signout': 'Sign Out',
    'nav.group.mystorage': 'My Storage',
    'nav.group.findstorage': 'Find Storage',
    'nav.group.bookings': 'Bookings',
    'nav.group.account': 'Account',
    'nav.group.work': 'Work Queue',
    'nav.group.service': 'Customer Service',
    'nav.group.support': 'Support',
    'nav.group.leasing': 'Leasing Operations',
    'nav.group.finance': 'Finance & Risk',
    'nav.group.governance': 'Governance & Audit',
    'nav.group.overview': 'Overview',
    'nav.group.facilityops': 'Facility Operations',
    'nav.group.rentalsfinance': 'Rentals & Finance',
    'nav.group.portfolio': 'Portfolio',
    'nav.group.commercial': 'Commercial',
    'nav.group.reporting': 'Reporting',
    'nav.group.admin': 'Administration',
    'nav.group.securityaudit': 'Security & Audit',
    'nav.group.system': 'System',

    // Header & Brand
    'header.tagline': 'StorageHub Intelligent Facility Management',
    'header.portal': 'Portal',
    'header.profile': 'Profile',
    'role.staff': 'Staff',
    'role.customer': 'Customer',
    'role.manager': 'Facility Manager',
    'role.business': 'Commercial Partner',
    'role.admin': 'System Admin',

    // Staff - Daily Tasks
    'tasks.title': 'Daily Tasks',
    'tasks.total': 'Total Tasks',
    'tasks.completed': 'Completed',
    'tasks.remaining': 'Remaining',

    // Staff - Reservations
    'reservations.title': 'Reservation Verification',
    'reservations.subtitle': 'Review and confirm incoming reservations',
    'reservations.col.id': 'Reservation',
    'reservations.col.customer': 'Customer',
    'reservations.col.unit': 'Unit',
    'reservations.col.moveIn': 'Move-in',
    'reservations.col.payment': 'Payment',
    'reservations.col.status': 'Status',
    'reservations.col.actions': 'Actions',
    'reservations.view': 'View',
    'reservations.verify': 'Verify',
    'reservations.paid': 'Paid',
    'reservations.unpaid': 'Unpaid',

    // Staff - Check-in
    'checkin.title': 'Check-in / Handover',
    'checkin.subtitle': 'Process customer move-ins and unit handovers',
    'checkin.process': 'Process Check-in',
    'checkin.viewRecord': 'View Record',
    'checkin.modalTitle': 'Process Check-in',
    'checkin.step1': 'ID verified (National ID / Passport)',
    'checkin.step2': 'Signed paper contract scan uploaded',
    'checkin.step3': 'Initial deposit & first month payment confirmed',
    'checkin.step4': 'Digital keycard / Gate PIN code issued',
    'checkin.step5': 'Unit walkthrough & facility orientation complete',
    'checkin.notes': 'Staff Operational Notes',
    'checkin.complete': 'Complete Check-in & Handover',

    // Staff - Return Inspection
    'return.title': 'Return Inspection',
    'return.subtitle': 'Inspect returned units and process deposits',
    'return.col.id': 'Return ID',
    'return.col.customer': 'Customer',
    'return.col.unit': 'Unit',
    'return.col.date': 'Return Date',
    'return.col.condition': 'Condition',
    'return.col.deposit': 'Deposit',
    'return.col.status': 'Status',
    'return.action.inspect': 'Inspect',
    'return.action.details': 'Details',
    'return.good': 'Good – No damage',
    'return.minorDamage': 'Minor damage – Partial deduction',
    'return.majorDamage': 'Major damage – Full deduction',
    'return.notesLabel': 'Inspection Notes',
    'return.notesPlaceholder': 'Document any damage, dirtiness, or leftover items...',
    'return.submit': 'Submit Inspection',

    // Staff - Support Queue
    'support.title': 'Support Queue & Dispatch',
    'support.subtitle': 'Triage incoming tenant inquiries, resolve access glitches, and log resolutions',
    'support.stat.awaiting': 'Awaiting Response',
    'support.stat.inProgress': 'In Progress',
    'support.stat.resolved': 'Resolved Tickets',
    'support.tab.open': 'Open',
    'support.tab.inProgress': 'In Progress',
    'support.tab.resolved': 'Resolved',
    'support.col.id': 'Ticket ID',
    'support.col.tenant': 'Tenant Customer',
    'support.col.subject': 'Subject & Facility',
    'support.col.category': 'Category',
    'support.col.priority': 'Priority',
    'support.col.opened': 'Opened Date',
    'support.col.status': 'Status',
    'support.col.action': 'Action',
    'support.respond': 'Respond',
    'support.empty': 'No tickets currently in this queue.',
    'support.modal.title': 'Staff Ticket Response & Resolution',
    'support.modal.updateStatus': 'Update Ticket Status',
    'support.modal.handler': 'Assigned Handler',
    'support.modal.reply': 'Official Staff Response to Tenant',
    'support.modal.replyPlaceholder': 'Type resolution instructions, gate code update, or notes for tenant...',
    'support.modal.dispatch': 'Save & Dispatch Response',

    // Common Actions
    'btn.cancel': 'Cancel',
    'btn.save': 'Save',
    'btn.submit': 'Submit',
    'btn.delete': 'Delete',
    'btn.confirm': 'Confirm',
    'btn.filter': 'Filter',
    'btn.search': 'Search',
    'btn.close': 'Close',

    // Statuses
    'status.active': 'Active',
    'status.pending': 'Pending',
    'status.confirmed': 'Confirmed',
    'status.completed': 'Completed',
    'status.open': 'Open',
    'status.inProgress': 'In Progress',
    'status.resolved': 'Resolved',
    'status.overdue': 'Overdue',
    'status.scheduled': 'Scheduled',
    'status.inspected': 'Inspected',
    'status.refunded': 'Refunded',
    'priority.high': 'High',
    'priority.medium': 'Medium',
    'priority.low': 'Low',
  },
  vi: {
    // Nav & Common
    'nav.overview': 'Tổng Quan',
    'nav.browse-facilities': 'Tìm Cơ Sở Kho',
    'nav.browse-units': 'Gian Kho Khả Dụng',
    'nav.reservations': 'Đơn Đặt Giữ Kho',
    'nav.my-rentals': 'Hồ Sơ Thuê Của Tôi',
    'nav.payments': 'Lịch Sử Thanh Toán',
    'nav.tasks': 'Nhiệm Vụ Hàng Ngày',
    'nav.checkin': 'Bàn Giao & Nhận Kho',
    'nav.return': 'Nghiệm Thu Trả Kho',
    'nav.support': 'Hỗ Trợ Khách Hàng',
    'nav.rentals': 'Hồ Sơ Thuê Kho',
    'nav.overdue': 'Quản Lý Nợ Quá Hạn',
    'nav.dashboard': 'Bảng Điều Khiển',
    'nav.reports': 'Báo Cáo Cơ Sở',
    'nav.units': 'Quản Lý Gian Kho',
    'nav.staff': 'Phân Công Nhân Viên',
    'nav.facilities': 'Tổng Quan Cơ Sở',
    'nav.performance': 'Hiệu Suất Vận Hành',
    'nav.policies': 'Chính Sách Thuê',
    'nav.pricing': 'Bảng Giá & Biểu Phí',
    'nav.revenue': 'Báo Cáo Doanh Thu',
    'nav.users': 'Quản Lý Người Dùng',
    'nav.roles': 'Vai Trò & Phân Quyền',
    'nav.login-history': 'Lịch Sử Đăng Nhập',
    'nav.activity': 'Nhật Ký Hoạt Động',
    'nav.settings': 'Cài Đặt Hệ Thống',
    'nav.profile': 'Hồ Sơ Cá Nhân',
    'nav.account': 'Tài Khoản Của Tôi',
    'nav.signout': 'Đăng Xuất',
    'nav.group.mystorage': 'Kho Của Tôi',
    'nav.group.findstorage': 'Tìm Gian Kho',
    'nav.group.bookings': 'Đặt Giữ Kho',
    'nav.group.account': 'Tài Khoản',
    'nav.group.work': 'Ca Làm Việc',
    'nav.group.service': 'Dịch Vụ Khách Hàng',
    'nav.group.support': 'Chăm Sóc & Hỗ Trợ',
    'nav.group.leasing': 'Vận Hành Kho',
    'nav.group.finance': 'Tài Chính & Rủi Ro',
    'nav.group.governance': 'Quản Trị & Giám Sát',
    'nav.group.overview': 'Tổng Quan',
    'nav.group.facilityops': 'Vận Hành Cơ Sở',
    'nav.group.rentalsfinance': 'Kỳ Thuê & Tài Chính',
    'nav.group.portfolio': 'Danh Mục Cơ Sở',
    'nav.group.commercial': 'Thương Mại & Biểu Phí',
    'nav.group.reporting': 'Báo Cáo Thống Kê',
    'nav.group.admin': 'Quản Trị Hệ Thống',
    'nav.group.securityaudit': 'An Ninh & Giám Sát',
    'nav.group.system': 'Hệ Thống',

    // Header & Brand
    'header.tagline': 'Hệ Thống Quản Lý Kho Thông Minh StorageHub',
    'header.portal': 'Cổng Quản Trị',
    'header.profile': 'Hồ sơ',
    'role.staff': 'Nhân Viên',
    'role.customer': 'Khách Hàng',
    'role.manager': 'Quản Lý Cơ Sở',
    'role.business': 'Đối Tác Kinh Doanh',
    'role.admin': 'Quản Trị Viên',

    // Staff - Daily Tasks
    'tasks.title': 'Nhiệm Vụ Ca Trực Hàng Ngày',
    'tasks.total': 'Tổng Nhiệm Vụ',
    'tasks.completed': 'Đã Hoàn Thành',
    'tasks.remaining': 'Chưa Hoàn Thành',

    // Staff - Reservations
    'reservations.title': 'Xác Thực Yêu Cầu Đặt Kho',
    'reservations.subtitle': 'Đối chiếu thông tin và xác nhận các yêu cầu giữ kho mới',
    'reservations.col.id': 'Mã Đơn',
    'reservations.col.customer': 'Khách Hàng',
    'reservations.col.unit': 'Mã Kho',
    'reservations.col.moveIn': 'Ngày Chuyển Vào',
    'reservations.col.payment': 'Thanh Toán',
    'reservations.col.status': 'Trạng Thái',
    'reservations.col.actions': 'Thao Tác',
    'reservations.view': 'Chi Tiết',
    'reservations.verify': 'Xác Nhận',
    'reservations.paid': 'Đã Trả',
    'reservations.unpaid': 'Chưa Trả',

    // Staff - Check-in
    'checkin.title': 'Quy Trình Nhận Kho & Bàn Giao',
    'checkin.subtitle': 'Tiếp đón khách hàng, kiểm tra hợp đồng và cấp phát quyền mở kho',
    'checkin.process': 'Tiến Hành Bàn Giao',
    'checkin.viewRecord': 'Xem Hồ Sơ',
    'checkin.modalTitle': 'Tiến Hành Bàn Giao Kho Cho Khách Hàng',
    'checkin.step1': 'Đã đối chiếu giấy tờ tùy thân (CCCD / Hộ chiếu)',
    'checkin.step2': 'Đã lưu bản scan hợp đồng giấy có chữ ký hai bên',
    'checkin.step3': 'Đã thu tiền cọc và phí thuê tháng đầu tiên',
    'checkin.step4': 'Đã kích hoạt Thẻ từ / Cấp mã PIN cửa điện tử',
    'checkin.step5': 'Đã dẫn khách nghiệm thu thực tế và hướng dẫn PCCC',
    'checkin.notes': 'Ghi Chú Nghiệp Vụ Của Nhân Viên',
    'checkin.complete': 'Hoàn Tất Bàn Giao & Mở Kho',

    // Staff - Return Inspection
    'return.title': 'Nghiệm Thu Trả Kho & Quyết Toán',
    'return.subtitle': 'Kiểm tra hiện trạng cơ sở vật chất kho trả và giải ngân tiền đặt cọc',
    'return.col.id': 'Mã Trả Kho',
    'return.col.customer': 'Khách Hàng',
    'return.col.unit': 'Mã Kho',
    'return.col.date': 'Ngày Trả',
    'return.col.condition': 'Hiện Trạng',
    'return.col.deposit': 'Tiền Cọc',
    'return.col.status': 'Trạng Thái',
    'return.action.inspect': 'Nghiệm Thu',
    'return.action.details': 'Chi Tiết',
    'return.good': 'Nguyên vẹn – Không hư hại',
    'return.minorDamage': 'Hư hỏng nhẹ – Khấu trừ một phần cọc',
    'return.majorDamage': 'Hư hỏng nặng – Khấu trừ toàn bộ cọc',
    'return.notesLabel': 'Biên Bản Ghi Chú Hiện Trường',
    'return.notesPlaceholder': 'Ghi rõ các vết trầy xước, cửa kẹt hoặc rác thải còn sót lại...',
    'return.submit': 'Nộp Biên Bản Nghiệm Thu',

    // Staff - Support Queue
    'support.title': 'Hàng Đợi Tiếp Nhận & Xử Lý Hỗ Trợ',
    'support.subtitle': 'Phân luồng yêu cầu từ khách thuê, khắc phục sự cố kỹ thuật và giải đáp thắc mắc',
    'support.stat.awaiting': 'Chờ Xử Lý',
    'support.stat.inProgress': 'Đang Khắc Phục',
    'support.stat.resolved': 'Đã Giải Quyết',
    'support.tab.open': 'Chờ Xử Lý',
    'support.tab.inProgress': 'Đang Khắc Phục',
    'support.tab.resolved': 'Đã Giải Quyết',
    'support.col.id': 'Mã Yêu Cầu',
    'support.col.tenant': 'Khách Thuê',
    'support.col.subject': 'Tiêu Đề & Cơ Sở',
    'support.col.category': 'Phân Loại',
    'support.col.priority': 'Độ Ưu Tiên',
    'support.col.opened': 'Ngày Tạo',
    'support.col.status': 'Trạng Thái',
    'support.col.action': 'Thao Tác',
    'support.respond': 'Phản Hồi',
    'support.empty': 'Hiện không có yêu cầu nào trong hàng đợi này.',
    'support.modal.title': 'Xử Lý Yêu Cầu & Phản Hồi Cho Khách',
    'support.modal.updateStatus': 'Cập Nhật Trạng Thái Yêu Cầu',
    'support.modal.handler': 'Nhân Viên Tiếp Nhận',
    'support.modal.reply': 'Nội Dung Phản Hồi Chính Thức Tới Khách',
    'support.modal.replyPlaceholder': 'Nhập hướng dẫn khắc phục, cấp lại mã mở khóa hoặc thông báo bảo trì...',
    'support.modal.dispatch': 'Lưu & Gửi Phản Hồi Tức Thì',

    // Common Actions
    'btn.cancel': 'Hủy Bỏ',
    'btn.save': 'Lưu Thay Đổi',
    'btn.submit': 'Xác Nhận Gửi',
    'btn.delete': 'Xóa',
    'btn.confirm': 'Xác Nhận',
    'btn.filter': 'Lọc',
    'btn.search': 'Tìm kiếm...',
    'btn.close': 'Đóng',

    // Statuses
    'status.active': 'Đang Hoạt Động',
    'status.pending': 'Chờ Duyệt',
    'status.confirmed': 'Đã Xác Nhận',
    'status.completed': 'Đã Hoàn Tất',
    'status.open': 'Mở Mới',
    'status.inProgress': 'Đang Xử Lý',
    'status.resolved': 'Đã Xong',
    'status.overdue': 'Quá Hạn',
    'status.scheduled': 'Đã Lên Lịch',
    'status.inspected': 'Đã Kiểm Tra',
    'status.refunded': 'Đã Hoàn Cọc',
    'priority.high': 'Khẩn Cấp',
    'priority.medium': 'Trung Bình',
    'priority.low': 'Tiêu Chuẩn',
  }
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'vi',
  setLang: () => { },
  toggleLang: () => { },
  t: (key: string, fallback?: string) => fallback || key,
  formatCurrency: () => '',
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'vi') return saved
    } catch { }
    return 'vi' // Mặc định Tiếng Việt theo yêu cầu của user
  })
  // add new func
  const formatCurrency = (usdAmount: number): string => {
    if (lang === 'vi') {
      const vnd = Math.round(usdAmount * USD_TO_VND_RATE)
      return `${vnd.toLocaleString('vi-VN')} ₫` // hoặc 'VNĐ'
    }
    return `$${usdAmount.toLocaleString('en-US')}`
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch { }
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (nextLang: Language) => {
    setLangState(nextLang)
  }

  const toggleLang = () => {
    setLangState(prev => (prev === 'vi' ? 'en' : 'vi'))
  }

  const t = (key: string, fallback?: string): string => {
    return dictionary[lang]?.[key] || fallback || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, formatCurrency }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

