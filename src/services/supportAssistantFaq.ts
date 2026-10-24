/** Standalone FAQ seed adapted from the demo topics. No demo records or assignment logic.
 * Reviewed 2026-10-23 against the current payment/renewal/return support contracts.
 * This is general guidance, not a statement about a Customer's actual records.
 */
export interface SupportAssistantFaq {
  id: string
  question: string
  keywords: string[]
  answer: string
}

export const SUPPORT_ASSISTANT_FAQS: SupportAssistantFaq[] = [
  {
    id: 'access', question: 'Mã truy cập không hoạt động',
    keywords: ['mã pin', 'mã truy cập', 'bàn phím', 'passcode', 'pin'],
    answer: 'Nếu mã truy cập không hoạt động, bạn hãy chọn Gặp nhân viên và xác nhận cơ sở hoặc hồ sơ thuê để nhân viên kiểm tra. Không gửi mã truy cập hay mật khẩu trong tin nhắn. Trợ lý không thể cấp hoặc đặt lại mã truy cập.',
  },
  {
    id: 'gate', question: 'Cổng hoặc cửa kho gặp sự cố',
    keywords: ['cổng', 'cửa cuốn', 'kẹt cửa', 'không vào được', 'không mở được'],
    answer: 'Sự cố cổng hoặc cửa kho cần nhân viên cơ sở kiểm tra trực tiếp. Bạn hãy chọn Gặp nhân viên, xác nhận đúng cơ sở và mô tả tình trạng. Trợ lý chưa tạo yêu cầu hoặc xác nhận có người tiếp nhận chỉ từ câu hỏi này.',
  },
  {
    id: 'renewal', question: 'Làm sao để gia hạn thuê kho?',
    keywords: ['gia hạn', 'thêm tháng', 'kéo dài', 'tiếp tục thuê', 'hợp đồng'],
    answer: 'Vào Hồ sơ thuê của tôi, chọn hồ sơ cần gia hạn và làm theo các bước hệ thống đang mở: xem báo giá, chọn gói, lịch ký và thanh toán. Số tiền và thời hạn lấy từ hồ sơ thực tế. Thanh toán thành công chưa đồng nghĩa việc ký và hoàn tất gia hạn đã xong.',
  },
  {
    id: 'switch', question: 'Tôi muốn đổi sang kho khác',
    keywords: ['đổi kho', 'chuyển kho', 'nâng cấp kho', 'kho lớn hơn', 'kho nhỏ hơn'],
    answer: 'Bạn có thể tham khảo kho tại mục Tìm gian kho trống. Với nhu cầu chuyển kho đang thuê, hãy chọn Gặp nhân viên để kiểm tra điều kiện tại cơ sở. Trợ lý không tự chuyển hợp đồng hoặc chuyển tiền cọc sang kho khác.',
  },
  {
    id: 'payment', question: 'Thanh toán và xem giao dịch ở đâu?',
    keywords: ['thanh toán', 'chuyển khoản', 'nộp tiền', 'trả tiền', 'hóa đơn', 'giao dịch', 'vnpay', 'biên lai'],
    answer: 'Xem giao dịch tại Lịch sử thanh toán. Để thanh toán, mở đúng đơn đặt kho hoặc yêu cầu gia hạn và dùng nút thanh toán đang được hệ thống cho phép. Kết quả cần được hệ thống xác nhận; nếu đã trừ tiền nhưng trạng thái chưa cập nhật, hãy gửi mã giao dịch cho nhân viên kiểm tra, không gửi thông tin thẻ hoặc mã OTP.',
  },
  {
    id: 'overdue', question: 'Tôi cần kiểm tra khoản quá hạn',
    keywords: ['quá hạn', 'phí trễ', 'phạt trễ', 'trễ tiền', 'trễ hạn', 'phụ thu'],
    answer: 'Mở Hồ sơ thuê của tôi để xem tình trạng quá hạn, khoản phải thanh toán và các thao tác còn được phép. Trợ lý FAQ không tính hoặc xác nhận số tiền cho hồ sơ của bạn. Nếu cần đối soát khoản thu hoặc thời hạn, hãy chọn Gặp nhân viên và liên kết đúng hồ sơ.',
  },
  {
    id: 'password', question: 'Quên hoặc muốn đổi mật khẩu',
    keywords: ['mật khẩu', 'quên pass', 'đổi pass', 'đăng nhập', 'password'],
    answer: 'Nếu quên mật khẩu, dùng chức năng Quên mật khẩu trên màn hình đăng nhập và làm theo hướng dẫn xác minh. Khi đã đăng nhập, bạn có thể kiểm tra chức năng đổi mật khẩu trong hồ sơ cá nhân. Không cung cấp mật khẩu hoặc OTP cho trợ lý hay nhân viên qua chat.',
  },
  {
    id: 'capacity', question: 'Chọn kích thước kho phù hợp',
    keywords: ['kích thước', 'chọn kho', 'diện tích', 'sức chứa', 'thể tích', 'cỡ kho', 'đặt kho'],
    answer: 'Vào Tìm gian kho trống, chọn cơ sở và xem thông số cỡ kho đang có. Khai báo kích thước, số lượng và đặc điểm đồ đạc để kiểm tra khả năng lưu trữ theo kết quả của hệ thống. Nếu đồ có yêu cầu đặc biệt, bạn nên trao đổi với nhân viên trước khi đặt.',
  },
  {
    id: 'incident', question: 'Báo hư hỏng hoặc sự cố tại kho',
    keywords: ['hư hỏng', 'mất đồ', 'thấm dột', 'ngập', 'mốc', 'cháy', 'côn trùng', 'bồi thường', 'khiếu nại'],
    answer: 'Bạn hãy chọn Gặp nhân viên, xác nhận cơ sở/hồ sơ và mô tả sự cố; có thể đính kèm hình ảnh trong cuộc trò chuyện với nhân viên. Trợ lý không kết luận nguyên nhân hoặc cam kết bồi thường. Nếu có nguy hiểm trực tiếp, ưu tiên rời khu vực nguy hiểm và liên hệ nhân sự tại cơ sở.',
  },
  {
    id: 'return', question: 'Trả kho và hoàn tiền cọc thế nào?',
    keywords: ['trả kho', 'thanh lý', 'nghiệm thu', 'lấy lại cọc', 'hoàn cọc', 'hoàn tiền', 'chấm dứt', 'dọn kho'],
    answer: 'Vào Hồ sơ thuê của tôi, chọn hồ sơ và dùng Yêu cầu trả kho nếu hệ thống cho phép. Nhân viên sẽ kiểm tra, nghiệm thu và đối soát các khoản liên quan. Việc hoàn cọc phụ thuộc kết quả quyết toán và trạng thái xử lý thực tế; trợ lý không cam kết số tiền hoặc thời gian hoàn.',
  },
]

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

export function findSupportAssistantFaq(question: string): SupportAssistantFaq | undefined {
  const query = ` ${normalize(question)} `
  let best: SupportAssistantFaq | undefined
  let bestScore = 0
  for (const faq of SUPPORT_ASSISTANT_FAQS) {
    const score = Math.max(0, ...faq.keywords.map(keyword => {
      const normalized = normalize(keyword)
      return query.includes(` ${normalized} `) ? normalized.split(' ').length : 0
    }))
    if (score > bestScore) { best = faq; bestScore = score }
  }
  return best
}
