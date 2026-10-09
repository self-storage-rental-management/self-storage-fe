import { createContext, useContext, type ReactNode } from 'react'
import { ApiClientError } from '../../services/apiClient'

// Presentation only: never translate wire values, identifiers or stored records.
const ManagerPresentationContext = createContext(false)

export function ManagerPresentationProvider({ children }: { children: ReactNode }) {
  return <ManagerPresentationContext.Provider value={true}>{children}</ManagerPresentationContext.Provider>
}

const labels: Record<string, string> = {
  CONFIRMED: 'Đã xác nhận', ACTIVE: 'Đang hiệu lực', AVAILABLE: 'Còn trống',
  MAINTENANCE: 'Đang bảo trì', COMPLETE: 'Đã kiểm tra đầy đủ', PARTIAL: 'Chưa đủ thông tin', UNKNOWN: 'Chưa có thông tin',
  RENTAL: 'Hồ sơ thuê', PAYMENT: 'Thanh toán', RESERVATION: 'Đặt chỗ',
  LOW: 'Thấp', NORMAL: 'Trung bình', MEDIUM: 'Trung bình', HIGH: 'Cao', URGENT: 'Khẩn cấp',
  CUSTOMER: 'Khách hàng', STAFF: 'Nhân viên', MANAGER: 'Quản lý cơ sở',
  PENDING: 'Đang chờ', COMPLETED: 'Đã hoàn tất', REJECTED: 'Đã từ chối', ROUTED: 'Đã chuyển xử lý',
  'Small Storage': 'Gian kho nhỏ', 'Medium Storage': 'Gian kho vừa', 'Large Storage': 'Gian kho lớn',
  'Extra Large Storage': 'Gian kho rất lớn',
  Small: 'Gian kho nhỏ', Medium: 'Gian kho vừa', Large: 'Gian kho lớn', 'Extra Large': 'Gian kho rất lớn',
  available: 'Còn trống', reserved: 'Đã giữ cho khách', occupied: 'Đang sử dụng', maintenance: 'Đang bảo trì',
  active: 'Đang hoạt động', inactive: 'Chưa hoạt động', revoked: 'Đã thu hồi', suspended: 'Tạm khóa', expired: 'Hết hạn',
  customer: 'Khách hàng', staff: 'Nhân viên', manager: 'Quản lý cơ sở', admin: 'Quản trị viên', system: 'Hệ thống',
  'Facility Staff': 'Nhân viên cơ sở', 'Facility Manager': 'Quản lý cơ sở',
}

const phrases: [RegExp, string][] = [
  [/Nghiệp vụ Trâm|NGHIỆP VỤ TRÂM/g, 'Quản lý gian kho'],
  [/FileAsset UUID|FileAsset/g, 'mã tệp minh chứng'],
  [/Soft-delete|soft-delete/g, 'ẩn khỏi danh sách'],
  [/nhật ký nguồn vẫn bất biến/g, 'dữ liệu gốc vẫn được giữ lại'],
  [/\bCustomer\b/g, 'khách hàng'], [/\bStaff\b/g, 'nhân viên'], [/\bManager\b/g, 'quản lý cơ sở'],
  [/\bUnitType\b/g, 'loại gian kho'], [/\bStorageUnit\b/g, 'gian kho'],
  [/\breservation\b|\bReservation\b/g, 'đặt chỗ'], [/\bassignment\b|\bAssignment\b|\bASSIGNMENT\b/g, 'phân gian'],
  [/\bcheck-in\b|\bCheck-in\b/g, 'nhận kho'], [/\brental\b/g, 'hồ sơ thuê'],
  [/\bcutoff\b|\bCutoff\b/g, 'mốc thu hồi'], [/\bCASH\b/g, 'tiền mặt'],
  [/\bpolicy\b|\bPolicy\b/g, 'chính sách'], [/\bworkflow\b/g, 'quy trình xử lý'],
  [/\bmodule\b|\bModule\b/g, 'bộ phận'], [/\bbackend\b|\bBackend\b|\bBE\b/g, 'hệ thống'],
  [/\bFE\b/g, 'giao diện'], [/\bBO\b/g, 'quản lý vận hành'],
  [/\bSLA\b/g, 'hạn xử lý'], [/\bRecovery\b/g, 'thu hồi kho'],
  [/\breceiver\b/g, 'bộ phận tiếp nhận'], [/\bcooldown\b/g, 'thời gian chờ'],
  [/Correlation ID|Correlation/g, 'Mã đối chiếu'], [/\bID\b/g, 'Mã'],
  [/\bAPI\b/g, ''], [/\s*\(D[1-5]\s*\)/g, ''],
  [/[—–]/g, '-'], [/;/g, ','],
]

const descriptions: Record<string, string> = {
  'Hỗ trợ (D5 API)': 'Hỗ trợ khách hàng',
  'Hỗ trợ ()': 'Hỗ trợ khách hàng',
  'Cần tài khoản API đang hoạt động, đúng role, quyền và phạm vi cơ sở.': 'Bạn cần tài khoản đang hoạt động và quyền hỗ trợ tại cơ sở được phân công.',
  'Không lấy yêu cầu demo để thay thế dữ liệu API.': 'Chưa thể tải yêu cầu hỗ trợ khi chưa có quyền truy cập.',
  'Hỗ trợ vận hành (D5 API)': 'Yêu cầu hỗ trợ',
  'Điều phối đúng cơ sở; Staff xử lý, module sở hữu cung cấp kết quả thật.': 'Phân công nhân viên và theo dõi kết quả xử lý tại cơ sở.',
  'BE đã ghi nhận thao tác. Đang tải lại dữ liệu thật.': 'Đã ghi nhận thay đổi.',
  'Kết quả thao tác trước chưa xác định. Không gửi yêu cầu mới hoặc tải lại browser; thử lại đúng nội dung bằng cùng Idempotency-Key.': 'Chưa xác nhận được kết quả. Không tải lại trang hoặc gửi yêu cầu mới, hãy bấm Kiểm tra lại.',
  'Hồ sơ cũ chưa có workflow metadata được xác thực. Chỉ đọc; không tự backfill hoặc gán version 0.': 'Hồ sơ này chỉ được xem vì chưa đủ thông tin để tiếp tục xử lý.',
  'Chưa đủ nguồn dùng chung; không dùng dữ liệu demo để thay thế:': 'Chưa đủ thông tin để xử lý:',
  'SLA / mức ưu tiên: Chưa có nguồn policy/lịch làm việc chung.': 'Chưa đủ thông tin để xác định hạn xử lý và mức ưu tiên.',
  'Chưa có snapshot điều khoản đã chấp nhận; không tính lại giá/cọc từ catalog hiện tại.': 'Chưa có điều khoản được khách hàng chấp nhận, chưa thể xác định giá và tiền cọc.',
  'Đã duyệt; chờ bước thanh toán và hoàn tất D3. Duyệt không tự thay đổi ngày kết thúc hồ sơ thuê. Xem tiến độ ký/thanh toán D3 ở bên dưới; các thao tác chỉ khả dụng khi BE đã kết nối đủ nguồn dùng chung.': 'Đã duyệt, chờ khách hàng thanh toán và hoàn tất ký gia hạn. Ngày kết thúc thuê chưa thay đổi.',
  'Hồ sơ cũ thiếu workflow/version xác thực; không thể thao tác.': 'Hồ sơ chưa đủ thông tin để xử lý, hiện chỉ có thể xem.',
  '. BE chưa cung cấp nội dung lịch/hạn đề xuất cho Customer; chưa thể xác nhận trên FE.': '. Chưa có chi tiết lịch và thời hạn đề xuất để khách hàng xác nhận.',
  'Phân trang/lọc do BE thực hiện. Không tính priority hoặc kết luận quá hạn khi nguồn SLA chưa có.': 'Chưa thể xác định mức ưu tiên hoặc quá hạn nếu thiếu thông tin về hạn xử lý.',
  'Cần quyền manage_rentals và phạm vi MANAGE của cơ sở.': 'Bạn chưa có quyền quản lý hồ sơ thuê tại cơ sở này.',
  'Thiếu phiên bản workflow xác thực; không tự tạo version.': 'Hồ sơ chưa đủ thông tin để tiếp tục xử lý.',
  'Minh chứng đã lưu (FileAsset UUID, nếu có)': 'Mã tệp minh chứng đã lưu (nếu có)',
  'FileAsset UUID của văn bản gia hạn đã ký': 'Mã tệp văn bản gia hạn đã ký',
  'Ký & thanh toán gia hạn (D3)': 'Ký và thanh toán gia hạn',
  'Duyệt khoản hoàn — chờ thực thi': 'Duyệt hoàn tiền - chưa chuyển tiền',
  'Chưa có Staff đủ điều kiện. BE yêu cầu ACTIVE, đúng cơ sở, view_support và manage_support; không tự cấp quyền hoặc so tên.': 'Chưa có nhân viên đang hoạt động, thuộc đúng cơ sở và có quyền xử lý yêu cầu hỗ trợ.',
  'BE kiểm tra policy và kết quả từ nguồn chung. Chuyển module không đồng nghĩa đã xử lý xong; ghi chú không thay thế kết quả thanh toán/refund/bảo trì. Thiếu nguồn sẽ bị chặn, không tự giả lập thành công.': 'Chuyển yêu cầu sang bộ phận phụ trách chưa có nghĩa đã xử lý xong. Kết quả thanh toán, hoàn tiền hoặc bảo trì phải được ghi nhận trước khi hoàn tất.',
  'Đã xử lý xong, chưa đóng. Customer có thể xác nhận kết quả hoặc yêu cầu mở lại; backend vẫn kiểm tra policy và quyền. Không mặc định ticket sẽ tự đóng: tự đóng còn cần policy chung và bằng chứng notification đúng lần xử lý này.': 'Đã xử lý xong, chờ khách hàng xác nhận. Khách hàng có thể yêu cầu xử lý lại nếu chưa hài lòng. Yêu cầu chưa được tự động đóng.',
  'Kết quả chưa xác định. Giữ nguyên nội dung, thử lại cùng key; không đổi yêu cầu hoặc đóng/tải lại.': 'Chưa xác nhận được kết quả. Giữ nguyên nội dung và bấm Kiểm tra lại, không đóng hoặc tải lại trang.',
  'Đã chuyển module — chưa đồng nghĩa hoàn thành': 'Đã chuyển xử lý - chưa hoàn tất',
  'Điều phối escalation': 'Xử lý yêu cầu chuyển bộ phận',
  'Chuyển tới module được phép': 'Chuyển tới bộ phận phụ trách',
  'Mã minh chứng được BE cho phép đọc; tải file chờ tích hợp quyền chung.': 'Đã có mã tệp minh chứng, chức năng tải tệp hiện chưa khả dụng.',
}

export function managerDisplayText(value: string): string {
  if (labels[value]) return labels[value]
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (descriptions[normalized]) return descriptions[normalized]
  if (/^[A-Z][A-Z_]{2,}$/.test(normalized)) return 'Chưa có mô tả trạng thái'
  return phrases.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s*\(\s*\)/g, '')
}

export function managerDisplayExplanation(value: string): string {
  if (/DEFERRED_SOURCE|SOURCE_MISSING|Source missing/i.test(value)) return 'Chưa đủ dữ liệu hoặc chính sách để xử lý.'
  if (!/[À-ỹ]/u.test(value)) return 'Chưa có mô tả chi tiết bằng tiếng Việt cho thông tin này.'
  return managerDisplayText(value)
}

export function managerDisplayError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'DEFERRED_SOURCE' || error.message.includes('DEFERRED_SOURCE'))
      return 'Chưa đủ dữ liệu hoặc chính sách để thực hiện thao tác này.'
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Bạn không có quyền xử lý hồ sơ này.'
    if (error.status === 404) return 'Không tìm thấy hồ sơ trong phạm vi cơ sở được phép truy cập.'
    if (error.status === 409) return 'Hồ sơ đã thay đổi hoặc chưa đủ điều kiện xử lý. Hãy mở lại hồ sơ trước khi tiếp tục.'
    if (error.status === null || error.status >= 500) return 'Chưa nhận được kết quả từ hệ thống. Vui lòng kiểm tra kết nối.'
    return 'Không thể thực hiện yêu cầu. Vui lòng kiểm tra thông tin và điều kiện xử lý.'
  }
  return error instanceof Error && /[À-ỹ]/u.test(error.message)
    ? managerDisplayText(error.message)
    : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.'
}

export function useManagerPresentation() {
  const manager = useContext(ManagerPresentationContext)
  return {
    manager,
    copy: (value: string) => manager ? managerDisplayText(value) : value,
    explain: (value: string) => manager ? managerDisplayExplanation(value) : value,
    errorText: (error: unknown, fallback: (error: unknown) => string) => manager ? managerDisplayError(error) : fallback(error),
  }
}
