import { PUBLIC_SUPPORT_UNKNOWN } from './supportPublicKnowledgeApi'
/** Topic labels only. Authoritative answers come from the backend public knowledge catalog.
 * Local matching must never supply policy, amounts or status assertions.
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
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'gate', question: 'Cổng hoặc cửa kho gặp sự cố',
    keywords: ['cổng', 'cửa cuốn', 'kẹt cửa', 'không vào được', 'không mở được'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'renewal', question: 'Làm sao để gia hạn thuê kho?',
    keywords: ['gia hạn', 'thêm tháng', 'kéo dài', 'tiếp tục thuê', 'hợp đồng'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'switch', question: 'Tôi muốn đổi sang kho khác',
    keywords: ['đổi kho', 'chuyển kho', 'nâng cấp kho', 'kho lớn hơn', 'kho nhỏ hơn'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'payment', question: 'Thanh toán và xem giao dịch ở đâu?',
    keywords: ['thanh toán', 'chuyển khoản', 'nộp tiền', 'trả tiền', 'hóa đơn', 'giao dịch', 'vnpay', 'biên lai'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'overdue', question: 'Tôi cần kiểm tra khoản quá hạn',
    keywords: ['quá hạn', 'phí trễ', 'phạt trễ', 'trễ tiền', 'trễ hạn', 'phụ thu'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'password', question: 'Quên hoặc muốn đổi mật khẩu',
    keywords: ['mật khẩu', 'quên pass', 'đổi pass', 'đăng nhập', 'password'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'capacity', question: 'Chọn kích thước kho phù hợp',
    keywords: ['kích thước', 'chọn kho', 'diện tích', 'sức chứa', 'thể tích', 'cỡ kho', 'đặt kho'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'incident', question: 'Báo hư hỏng hoặc sự cố tại kho',
    keywords: ['hư hỏng', 'mất đồ', 'thấm dột', 'ngập', 'mốc', 'cháy', 'côn trùng', 'bồi thường', 'khiếu nại'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
  {
    id: 'return', question: 'Trả kho và hoàn tiền cọc thế nào?',
    keywords: ['trả kho', 'thanh lý', 'nghiệm thu', 'lấy lại cọc', 'hoàn cọc', 'hoàn tiền', 'chấm dứt', 'dọn kho'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
  },
]

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

export function findSupportAssistantFaq(question: string): SupportAssistantFaq | undefined {
  return SUPPORT_ASSISTANT_FAQS.find(faq => normalize(faq.question) === normalize(question))
}
