export interface RegulationArticle {
  id: number
  articleNumber: string
  title: string
  category: 'scope' | 'finance' | 'safety' | 'operations'
  categoryLabel: string
  badgeVariant: 'info' | 'warning' | 'purple' | 'success'
  iconBg: string
  clauses: string[]
  importantNote?: string
}

export const REGULATIONS: RegulationArticle[] = [
  {
    id: 1,
    articleNumber: 'Điều 1',
    title: 'Đối tượng và phạm vi sử dụng',
    category: 'scope',
    categoryLabel: 'Phạm vi sử dụng',
    badgeVariant: 'info',
    iconBg: 'bg-blue-50 text-blue-700 border-blue-200',
    clauses: [
      'Khách hàng được quyền sử dụng khu vực lưu trữ được chỉ định trong hợp đồng trong thời hạn đã thỏa thuận.',
      'Kho chỉ được sử dụng để lưu trữ tài sản, không được sử dụng làm nơi cư trú, nơi sản xuất hoặc hoạt động khác trái với mục đích thuê.',
      'Khách hàng không được tự ý chuyển nhượng hoặc cho thuê lại kho nếu chưa được StorageHub chấp thuận.',
    ],
  },
  {
    id: 2,
    articleNumber: 'Điều 2',
    title: 'Thời hạn thuê',
    category: 'scope',
    categoryLabel: 'Thời hạn hợp đồng',
    badgeVariant: 'info',
    iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    clauses: [
      'Thời hạn thuê do hai bên thỏa thuận và được ghi rõ trong hợp đồng.',
      'Thời điểm bắt đầu và kết thúc thuê phải được xác định rõ, tránh phát sinh tranh chấp về ngày tính phí.',
      'Việc thay đổi thời hạn thuê phải được xác nhận trước khi kỳ thuê mới bắt đầu.',
    ],
  },
  {
    id: 3,
    articleNumber: 'Điều 3',
    title: 'Giá thuê và thanh toán',
    category: 'finance',
    categoryLabel: 'Giá thuê & Thanh toán',
    badgeVariant: 'purple',
    iconBg: 'bg-purple-50 text-purple-700 border-purple-200',
    clauses: [
      'Giá thuê, mức giảm giá, kỳ thanh toán và các khoản phí phải được thông báo rõ trước khi khách hàng xác nhận giao dịch.',
      'Mức giảm giá chỉ áp dụng khi khách đáp ứng điều kiện của chính sách đã công bố.',
      'Các khoản đặt cọc, phí dịch vụ và điều kiện hoàn trả phải được quy định riêng, không gộp mơ hồ vào tiền thuê.',
      'Khi thanh toán trễ hạn, StorageHub thông báo cho khách hàng và áp dụng biện pháp xử lý theo hợp đồng và pháp luật có liên quan.',
    ],
  },
  {
    id: 4,
    articleNumber: 'Điều 4',
    title: 'Gia hạn hợp đồng',
    category: 'finance',
    categoryLabel: 'Gia hạn thuê',
    badgeVariant: 'purple',
    iconBg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    clauses: [
      'Khách hàng có thể gửi yêu cầu gia hạn trước ngày kết thúc hợp đồng.',
      'Gia hạn cần xác nhận thời hạn mới, giá thuê, ưu đãi và các điều kiện áp dụng.',
      'Chính sách giá mới không tự động thay đổi khoản tiền đã chốt cho kỳ thuê cũ.',
      'Nếu khách hàng đã hết hạn thuê, việc tiếp tục sử dụng kho phải được kiểm tra và xác nhận lại theo quy trình.',
    ],
  },
  {
    id: 5,
    articleNumber: 'Điều 5',
    title: 'Hàng hóa bị cấm hoặc hạn chế',
    category: 'safety',
    categoryLabel: 'An toàn & Hàng cấm',
    badgeVariant: 'warning',
    iconBg: 'bg-rose-50 text-rose-700 border-rose-200',
    clauses: [
      'Không được lưu trữ tài sản bị pháp luật cấm, chất dễ cháy nổ, chất độc hại hoặc hàng hóa gây nguy hiểm.',
      'Không được lưu trữ động vật sống, hàng dễ phân hủy hoặc vật phẩm có nguy cơ gây ô nhiễm, hư hại cho kho và tài sản khác.',
      'Khách hàng phải tuân thủ hướng dẫn an toàn và thông báo các yêu cầu bảo quản đặc biệt khi có liên quan.',
    ],
    importantNote: 'Nghiêm cấm tuyệt đối hóa chất dễ nổ, pháo hoa, vũ khí, hàng lậu và chất độc hại. Vi phạm sẽ bị đơn phương hủy hợp đồng và chuyển giao cơ quan chức năng.',
  },
  {
    id: 6,
    articleNumber: 'Điều 6',
    title: 'Bảo quản và trách nhiệm tài sản',
    category: 'safety',
    categoryLabel: 'Trách nhiệm tài sản',
    badgeVariant: 'warning',
    iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
    clauses: [
      'Khách hàng có trách nhiệm đóng gói, sắp xếp và bảo quản tài sản phù hợp với điều kiện của kho.',
      'Các bên phối hợp ghi nhận hiện trạng, lập biên bản khi phát hiện mất mát hoặc hư hỏng.',
      'Trách nhiệm của mỗi bên được xác định dựa trên nguyên nhân, chứng cứ, thỏa thuận và quy định pháp luật, không mặc nhiên loại trừ trách nhiệm của bất kỳ bên nào.',
      'Khách hàng được thông báo rõ về phạm vi bảo hiểm nếu có và trách nhiệm đối với tài sản của mình.',
    ],
  },
  {
    id: 7,
    articleNumber: 'Điều 7',
    title: 'Sự cố và bảo trì',
    category: 'operations',
    categoryLabel: 'Bảo trì & Sự cố',
    badgeVariant: 'success',
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    clauses: [
      'Khách hàng cần thông báo khi phát hiện rò rỉ nước, cháy, mùi bất thường, hư hỏng kết cấu hoặc sự cố an ninh.',
      'StorageHub tiếp nhận, ghi nhận và xử lý sự cố theo mức độ nghiêm trọng.',
      'Việc tiếp cận kho để kiểm tra hoặc sửa chữa phải tuân theo quy trình an toàn và quyền riêng tư, trừ tình huống khẩn cấp được xử lý theo quy định áp dụng.',
    ],
  },
  {
    id: 8,
    articleNumber: 'Điều 8',
    title: 'Chấm dứt thuê và bàn giao kho',
    category: 'operations',
    categoryLabel: 'Chấm dứt & Bàn giao',
    badgeVariant: 'success',
    iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
    clauses: [
      'Khách hàng thông báo chấm dứt thuê theo thời hạn đã thỏa thuận.',
      'Khách hàng lấy tài sản ra khỏi kho, thanh toán các khoản còn nợ và bàn giao kho theo quy trình.',
      'Hai bên xác nhận tình trạng kho, tài sản còn lại và các khoản cần xử lý.',
      'Tài sản bị bỏ lại không được tự ý thanh lý nếu chưa thực hiện đúng quy trình thông báo và xử lý hợp pháp.',
    ],
  },
  {
    id: 9,
    articleNumber: 'Điều 9',
    title: 'Khiếu nại và giải quyết tranh chấp',
    category: 'operations',
    categoryLabel: 'Tranh chấp & Pháp lý',
    badgeVariant: 'info',
    iconBg: 'bg-sky-50 text-sky-700 border-sky-200',
    clauses: [
      'Khách hàng có quyền yêu cầu giải thích phí, cung cấp chứng từ và khiếu nại về dịch vụ.',
      'Hai bên ưu tiên trao đổi và đối chiếu hồ sơ giao dịch để giải quyết.',
      'Nếu không giải quyết được, tranh chấp được xử lý theo thỏa thuận hợp pháp và pháp luật có liên quan.',
    ],
  },
]
