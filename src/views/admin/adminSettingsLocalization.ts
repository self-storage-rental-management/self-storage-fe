export const SETTING_TAB_TO_GROUP: Record<string, string> = {
  'Thông tin chung': 'Facility & Business Profile',
  'Hóa đơn & Biểu phí': 'Billing & Invoicing Rules',
  'Bảo mật & Xác thực': 'Security & Access Controls',
  'Thông báo tự động': 'Automated Notifications & Webhooks',
  'Bảo trì & Dịch vụ': 'Maintenance & Service Mode',
}

export const SETTING_GROUP_NAMES: Record<string, string> = {
  'Thông tin chung': 'Facility & Business Profile',
  'Cơ sở kho': 'Facility & Business Profile',
  'Hóa đơn & Biểu phí': 'Billing & Invoicing Rules',
  'Thanh toán': 'Billing & Invoicing Rules',
  'Bảo mật & Xác thực': 'Security & Access Controls',
  'Bảo mật': 'Security & Access Controls',
  'Thông báo tự động': 'Automated Notifications & Webhooks',
  'Thông báo': 'Automated Notifications & Webhooks',
  'Bảo trì & Dịch vụ': 'Maintenance & Service Mode',
  'Bảo trì': 'Maintenance & Service Mode',
}

const GROUP_LABELS: Record<string, string> = {
  'Facility & Business Profile': 'Thông tin chung và liên hệ',
  'Billing & Invoicing Rules': 'Hóa đơn và quy tắc biểu phí',
  'Security & Access Controls': 'Bảo mật và kiểm soát truy cập',
  'Automated Notifications & Webhooks': 'Thông báo tự động và webhook',
  'Maintenance & Service Mode': 'Bảo trì và chế độ dịch vụ',
}

const ITEM_LABELS: Record<string, string> = {
  businessName: 'Tên công ty / cơ sở',
  contactEmail: 'Email hỗ trợ chính',
  hotline: 'Hotline chăm sóc khách hàng',
  currency: 'Đơn vị tiền tệ hạch toán',
  timezone: 'Múi giờ vận hành cơ sở',
  gracePeriod: 'Số ngày ân hạn phí trễ',
  lateFeeAmount: 'Mức phí trễ cố định',
  autoInvoiceDays: 'Tạo hóa đơn trước hạn',
  autoProrate: 'Tính tiền theo ngày thực tế (Prorate)',
  require2FA: 'Bắt buộc xác thực hai yếu tố (2FA)',
  pinRotation: 'Chu kỳ tự động đổi mã PIN cổng',
  lockoutAttempts: 'Ngưỡng khóa khi nhập sai mã PIN',
  sessionTimeout: 'Thời gian hết hạn phiên quản trị',
  emailAlerts: 'Tự động gửi email nhắc nợ quá hạn',
  smsGateAlerts: 'Gửi SMS khi mở cổng ngoài giờ',
  slackWebhook: 'Webhook Slack xử lý sự cố vận hành',
  dailyDigest: 'Báo cáo hiệu suất hằng ngày cho quản lý',
  maintenanceMode: 'Chế độ bảo trì hệ thống',
  bannerNotice: 'Thông báo công khai cho khách hàng',
}

export const ITEM_DESCRIPTIONS: Record<string, string> = {
  businessName: 'Tên hiển thị chính thức của thương hiệu StorageHub trên hóa đơn, hợp đồng và email gửi khách hàng.',
  contactEmail: 'Địa chỉ email tiếp nhận phản hồi, khiếu nại và hiển thị ở phần chân trang hệ thống.',
  hotline: 'Số điện thoại đường dây nóng hỗ trợ khẩn cấp 24/7 và giải đáp thắc mắc dịch vụ.',
  currency: 'Đơn vị tiền tệ chuẩn sử dụng cho biểu phí niêm yết, tính cước thuê và biên lai giao dịch.',
  timezone: 'Múi giờ chuẩn để tính toán thời điểm ra vào kho, ghi nhận audit log và đối soát thanh toán.',
  gracePeriod: 'Số ngày cho phép quá hạn trước khi hệ thống bắt đầu phạt phí trễ hoặc đình chỉ mã PIN mở cổng.',
  lateFeeAmount: 'Khoản phí phạt phát sinh tự động khi khách hàng chưa thanh toán tiền thuê sau khi hết hạn ân hạn.',
  autoInvoiceDays: 'Hệ thống sẽ tự động phát hành hóa đơn kỳ tiếp theo trước ngày hết hạn của hợp đồng thuê kho.',
  autoProrate: 'Tự động tính cước thuê theo số ngày sử dụng thực tế cho tháng đầu tiên nếu khách nhận kho giữa tháng.',
  require2FA: 'Bật để yêu cầu xác thực OTP qua email hoặc ứng dụng Authenticator đối với toàn bộ tài khoản nội bộ.',
  pinRotation: 'Tự động làm mới mã PIN kiểm soát cổng định kỳ nhằm phòng ngừa nguy cơ lộ mã số ra vào.',
  lockoutAttempts: 'Tự động tạm khóa quyền mở khóa của gian kho khi vượt quá số lần nhập sai liên tiếp này.',
  sessionTimeout: 'Tự động đăng xuất tài khoản quản trị khi không có thao tác chuột hoặc bàn phím trong khoảng thời gian này.',
  emailAlerts: 'Tự động gửi email thông báo nhắc nợ định kỳ khi hóa đơn thuê kho chưa được thanh toán.',
  smsGateAlerts: 'Gửi tin nhắn SMS tức thì tới số điện thoại của quản lý cơ sở khi phát hiện có lượt mở cổng ngoài giờ quy định.',
  slackWebhook: 'Đường dẫn Webhook để gửi cảnh báo an ninh khẩn cấp và sự cố vận hành vào kênh Slack nội bộ.',
  dailyDigest: 'Gửi email tổng hợp các chỉ số vận hành (tỉ lệ lấp đầy, doanh thu, đơn đặt mới) cho ban quản lý mỗi sáng.',
  maintenanceMode: 'Tạm khóa chức năng đặt kho mới và thanh toán trực tuyến để đội ngũ kỹ thuật nâng cấp hệ thống.',
  bannerNotice: 'Dòng thông báo nổi bật xuất hiện trên thanh đầu trang của trang chủ và cổng đặt kho công khai.',
}

const OPTION_LABELS: Record<string, Record<string, string>> = {
  currency: { 'VND (?)': 'VND (₫)', 'VND (₫)': 'VND (₫)' },
  timezone: {
    'GMT+7 (Asia/Ho_Chi_Minh)': 'GMT+7 (Giờ Việt Nam - Hồ Chí Minh)',
    'GMT+8 (Asia/Singapore)': 'GMT+8 (Giờ Singapore)',
    'GMT+0 (UTC)': 'GMT+0 (Giờ Quốc tế UTC)',
  },
  autoInvoiceDays: {
    '3 days before due date': 'Trước hạn 3 ngày',
    '7 days before due date': 'Trước hạn 7 ngày',
    '14 days before due date': 'Trước hạn 14 ngày',
    '30 days before due date': 'Trước hạn 30 ngày',
  },
  pinRotation: {
    '30 days': '30 ngày đổi một lần',
    '60 days': '60 ngày đổi một lần',
    '90 days': '90 ngày đổi một lần',
    'Never (Manual)': 'Không tự động (Đổi thủ công)',
  },
  lockoutAttempts: {
    '3 failed attempts': '3 lần nhập sai liên tiếp',
    '5 failed attempts': '5 lần nhập sai liên tiếp',
    '10 failed attempts': '10 lần nhập sai liên tiếp',
  },
  sessionTimeout: {
    '15 minutes': '15 phút không thao tác',
    '30 minutes': '30 phút không thao tác',
    '60 minutes': '60 phút không thao tác',
    '4 hours': '4 giờ không thao tác',
  },
}

export function settingGroupLabel(group: string) {
  return GROUP_LABELS[group] ?? group
}

export function settingItemLabel(id: string, fallback: string) {
  return ITEM_LABELS[id] ?? fallback
}

export function settingItemDescription(id: string, fallback?: string | null) {
  return ITEM_DESCRIPTIONS[id] ?? fallback ?? ''
}

export function settingOptionLabel(id: string, option: string) {
  return OPTION_LABELS[id]?.[option] ?? option
}

export const SETTING_GROUP_DESCRIPTIONS: Record<string, string> = {
  'Facility & Business Profile': 'Cấu hình thông tin pháp nhân doanh nghiệp, múi giờ và các kênh liên hệ chính.',
  'Billing & Invoicing Rules': 'Thiết lập quy tắc tạo hóa đơn, thời gian ân hạn và mức phí phạt trễ hạn tự động.',
  'Security & Access Controls': 'Quản lý chính sách đăng nhập, xác thực hai yếu tố (2FA) và thời gian hết hạn phiên.',
  'Automated Notifications & Webhooks': 'Cấu hình thông báo tự động gửi email, SMS và webhook tích hợp với Slack.',
  'Maintenance & Service Mode': 'Kích hoạt chế độ bảo trì khẩn cấp và hiển thị biểu ngữ thông báo công khai.',
}
