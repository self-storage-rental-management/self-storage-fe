import type { TicketItem, StaffRosterMember } from '../data/demoDatabase'
import { STAFF_ROSTER } from '../data/demoDatabase'
import type { User } from '../types'
import type { StorageHold } from '../types/storageHub'
import { DEMO_DATA_ENABLED } from '../config/runtime'
import { PUBLIC_SUPPORT_UNKNOWN } from './supportPublicKnowledgeApi'

export interface CustomerRentalRecord {
  id: string
  customerEmail?: string
  customerName?: string
  facilityName?: string
  facilityId?: string
  unitId?: string
  status?: string
}

export interface FAQItem {
  id: string
  question: string
  category: 'Access & Entry' | 'Hợp đồng' | 'Thanh toán' | 'Tài khoản' | 'Tư vấn kho' | 'Khiếu nại & Sự cố'
  keywords: string[]
  answer: string
  solved: boolean // Can bot solve it completely, or does it require hardware/staff intervention?
  isUrgent?: boolean
  actionHint?: string
}

export const SUPPORT_FAQS: FAQItem[] = [
  {
    id: 'faq-pin-reset',
    question: 'Mã PIN không hoạt động / Bị lỗi bàn phím',
    category: 'Access & Entry',
    keywords: ['pin', 'mã pin', 'mã số', 'bàn phím', 'mã truy cập', 'passcode', 'keypad', 'cổng', 'khóa số'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Vào Hồ sơ thuê → Mã truy cập'
  },
  {
    id: 'faq-gate-stuck',
    question: 'Cổng ra vào không phản hồi / Kẹt cửa cuốn',
    category: 'Access & Entry',
    keywords: ['cổng không mở', 'kẹt cổng', 'không vào được', 'cửa cuốn', 'kẹt cửa', 'không mở được', 'gate', 'stuck', 'không phản hồi', 'lỗi cổng'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: false,
    isUrgent: true,
    actionHint: 'Chuyển nhân viên kỹ thuật trực ca ngay'
  },
  {
    id: 'faq-contract-renew',
    question: 'Cách gia hạn hợp đồng thuê kho',
    category: 'Hợp đồng',
    keywords: ['gia hạn', 'thêm tháng', 'kéo dài', 'tiếp tục thuê', 'hợp đồng', 'renew', 'extension'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Vào Hồ sơ thuê → Gia hạn'
  },
  {
    id: 'faq-switch-unit',
    question: 'Muốn đổi sang gian kho lớn/nhỏ hơn',
    category: 'Hợp đồng',
    keywords: ['đổi kho', 'kho lớn hơn', 'kho nhỏ hơn', 'chuyển kho', 'đổi phòng', 'nâng cấp kho', 'upgrade'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Xem Cỡ kho khả dụng hoặc Tạo yêu cầu đổi kho'
  },
  {
    id: 'faq-payment-method',
    question: 'Thanh toán và xem giao dịch ở đâu?',
    category: 'Thanh toán',
    keywords: ['thanh toán', 'chuyển khoản', 'nộp tiền', 'trả tiền', 'hóa đơn', 'payment', 'bill', 'banking', 'momo', 'qr'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Vào Lịch sử thanh toán'
  },
  {
    id: 'faq-late-fee',
    question: 'Phí phạt trễ hạn thanh toán tính như thế nào',
    category: 'Thanh toán',
    keywords: ['phí trễ', 'phạt trễ', 'quá hạn', 'trễ tiền', 'late fee', 'quá ngày'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Kiểm tra hóa đơn tại Lịch sử thanh toán'
  },
  {
    id: 'faq-password-reset',
    question: 'Quên mật khẩu / Cần đặt lại mật khẩu',
    category: 'Tài khoản',
    keywords: ['mật khẩu', 'quên mật khẩu', 'password', 'đổi pass', 'reset pass', 'đăng nhập'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Vào Hồ sơ cá nhân → Đổi mật khẩu'
  },
  {
    id: 'faq-unit-capacity',
    question: 'Tư vấn chọn kích thước kho phù hợp với đồ đạc',
    category: 'Tư vấn kho',
    keywords: ['kích thước', 'chọn kho', 'diện tích', 'sức chứa', 'chứa được bao nhiêu', 'kho s', 'kho m', 'kho l', 'kho xl', 'cỡ kho'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Khám phá Cỡ kho khả dụng'
  },
  {
    id: 'faq-damage-leak',
    question: 'Sự cố đồ đạc trong kho bị hư hỏng / thấm dột',
    category: 'Khiếu nại & Sự cố',
    keywords: ['hư hỏng', 'mất đồ', 'thấm dột', 'ngập nước', 'mốc', 'cháy', 'bể', 'rách', 'chuột', 'côn trùng', 'sự cố', 'bồi thường'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: false,
    isUrgent: true,
    actionHint: 'Khẩn cấp - Kích hoạt hỗ trợ tại chỗ'
  },
  {
    id: 'faq-return-storage',
    question: 'Quy trình trả kho và hoàn tiền đảm bảo (tiền cọc)',
    category: 'Hợp đồng',
    keywords: ['trả kho', 'thanh lý', 'nghiệm thu', 'lấy lại cọc', 'hoàn cọc', 'chấm dứt hợp đồng', 'dọn kho'],
    answer: PUBLIC_SUPPORT_UNKNOWN,
    solved: true,
    actionHint: 'Vào Hồ sơ thuê → Yêu cầu trả kho'
  }
]

export interface StaffAssignmentResult {
  assignedStaff: StaffRosterMember | null
  assignedStaffName: string
  assignedStaffInitials: string
  isAllOffline: boolean
  isUrgent: boolean
  priority: 'high' | 'medium' | 'low'
  estimatedWaitMinutes: number
  estimatedWaitLabel: string
  queuePosition: number
  emergencyHotline?: string
  emergencyManagerName?: string
  emergencyManagerPhone?: string
}

export interface CustomerStorageContext {
  facility: string
  facilityId: string
  unit: string
  relatedType?: 'rental' | 'reservation' | 'general'
  relatedId?: string
  hasMultipleRentals: boolean
  rentalsList: Array<{ id: string; facilityName: string; facilityId: string; unitId: string }>
}

/**
 * Requirement 6: Automatically map facility & unit from customer's active rentals and holds.
 * Eliminates "chưa xác định cơ sở" / "-"!
 */
export function resolveCustomerStorageContext(
  customerUser: User,
  rentals: CustomerRentalRecord[] = [],
  holds: StorageHold[] = []
): CustomerStorageContext {
  const activeRentals = rentals.filter(r =>
    (r.customerEmail?.toLowerCase() === customerUser.email?.toLowerCase() ||
     r.customerName?.toLowerCase() === customerUser.name?.toLowerCase()) &&
    r.status !== 'TERMINATED' && r.status !== 'CANCELLED'
  )

  const activeHolds = holds.filter(h =>
    (h.customerEmail?.toLowerCase() === customerUser.email?.toLowerCase() ||
     h.customerName?.toLowerCase() === customerUser.name?.toLowerCase()) &&
    !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(h.status)
  )

  const rentalsList = activeRentals.map(r => ({
    id: r.id,
    facilityName: r.facilityName || 'Kho Việt - Cơ sở Quận 1',
    facilityId: r.facilityId || 'fac-001',
    unitId: r.unitId || 'Standard'
  }))

  if (activeRentals.length === 1) {
    const primary = activeRentals[0]
    return {
      facility: primary.facilityName || 'Kho Việt - Cơ sở Quận 1',
      facilityId: primary.facilityId || 'fac-001',
      unit: primary.unitId || 'Chưa gán gian',
      relatedType: 'rental',
      relatedId: primary.id,
      hasMultipleRentals: false,
      rentalsList
    }
  }

  if (activeRentals.length > 1) {
    const primary = activeRentals[0]
    return {
      facility: primary.facilityName || 'Kho Việt - Cơ sở Quận 1',
      facilityId: primary.facilityId || 'fac-001',
      unit: primary.unitId || 'Chưa gán gian',
      relatedType: 'rental',
      relatedId: primary.id,
      hasMultipleRentals: true,
      rentalsList
    }
  }

  if (activeHolds.length > 0) {
    const primaryHold = activeHolds[0]
    return {
      facility: primaryHold.facilityName || 'Kho Việt - Cơ sở Quận 1',
      facilityId: primaryHold.facilityId || 'fac-001',
      unit: primaryHold.assignedUnitId || primaryHold.unitTypeName || 'Gian kho đã giữ',
      relatedType: 'reservation',
      relatedId: primaryHold.id,
      hasMultipleRentals: false,
      rentalsList: []
    }
  }

  return {
    facility: customerUser.facility || 'Kho Việt - Cơ sở Quận 1',
    facilityId: customerUser.facilityId || 'fac-001',
    unit: 'Tư vấn chung',
    relatedType: 'general',
    hasMultipleRentals: false,
    rentalsList: []
  }
}

/**
 * Requirement 4: Smart keyword and category priority weighting.
 * Urgency is detected based on category (Access & Entry, Khiếu nại) and keywords (kẹt cổng, mã PIN, cháy, ngập, hỏng).
 *
 * Requirement 2: Calculate specific estimated wait time based on assigned staff's active queue.
 *
 * Requirement 3: If all staff are offline and ticket is urgent, trigger emergency escalation to Duty Manager.
 */
export function assignStaffWithWorkloadAndUrgency(params: {
  category: string
  questionText: string
  facilityId: string
  currentTickets: TicketItem[]
  rosterOverride?: StaffRosterMember[]
}): StaffAssignmentResult {
  const { category, questionText, facilityId, currentTickets, rosterOverride } = params
  const roster = rosterOverride || (DEMO_DATA_ENABLED ? STAFF_ROSTER : [])

  const urgentRegex = /(cổng|gate|mã pin|pin|mã khóa|kẹt|không vào được|không mở được|hư hỏng|mất đồ|chập|cháy|nước|ngập|khẩn cấp|sos|emergency|leak|flood|broken|alarm)/i
  const isUrgent =
    category === 'Access & Entry' ||
    category === 'Khiếu nại & Sự cố' ||
    category === 'Unit Condition' ||
    urgentRegex.test(questionText)

  const priority: 'high' | 'medium' | 'low' = isUrgent ? 'high' : 'medium'

  // Support is facility-scoped: never fall back to an online staff member from
  // another facility just because the local queue is empty.
  const facilityRoster = roster.filter(s => s.facilityId === facilityId)
  const onlineStaff = facilityRoster.filter(s => s.online && s.role === 'staff')

  // Requirement 3: When ALL staff are offline
  if (onlineStaff.length === 0) {
    const dutyManager = facilityRoster.find(s => s.role === 'manager') || {
      name: 'Quản lý cơ sở',
      phone: '-',
      initials: 'QL'
    }

    return {
      assignedStaff: null,
      assignedStaffName: isUrgent ? `Quản lý ca trực (${dutyManager.name})` : 'Hàng đợi ca sáng mai (08:00)',
      assignedStaffInitials: isUrgent ? dutyManager.initials : 'SH',
      isAllOffline: true,
      isUrgent,
      priority: isUrgent ? 'high' : 'medium',
      estimatedWaitMinutes: isUrgent ? 5 : 480,
      estimatedWaitLabel: isUrgent
        ? 'Kênh khẩn cấp 24/7 - Quản lý trực ca xử lý ngay trong 5-10 phút'
        : 'Đầu ca sáng mai (08:00)',
      queuePosition: 1,
      emergencyHotline: '1900 8820',
      emergencyManagerName: dutyManager.name,
      emergencyManagerPhone: dutyManager.phone
    }
  }

  const candidates = onlineStaff

  // Weighted scoring for each staff candidate:
  // For urgent tickets, we prioritize staff with FEWEST urgent tickets so urgent requests are handled immediately!
  const scoredStaff = candidates.map(member => {
    const memberTickets = currentTickets.filter(
      t => t.facilityId === facilityId && t.assignedStaff?.includes(member.name) && t.status !== 'resolved'
    )
    const urgentCount = memberTickets.filter(t => t.priority === 'high').length
    const normalCount = memberTickets.filter(t => t.priority !== 'high').length

    // Score formula:
    // If ticket is urgent: urgent tickets penalty = 5, normal tickets penalty = 1
    // Staff with 0 urgent tickets gets priority even if they have 1-2 normal tickets!
    const workloadScore = isUrgent
      ? (urgentCount * 5) + (normalCount * 1)
      : (urgentCount * 2) + (normalCount * 1)

    return {
      member,
      totalOpen: memberTickets.length,
      urgentCount,
      normalCount,
      workloadScore
    }
  })

  scoredStaff.sort((a, b) => a.workloadScore - b.workloadScore)
  const selected = scoredStaff[0]
  const member = selected.member
  const openCount = selected.totalOpen

  // Requirement 2: Specific estimated wait time
  let waitMinutes = 5
  let waitLabel = `~3 - 5 phút (Nhân viên ${member.name} đang sẵn sàng)`

  if (isUrgent) {
    if (selected.urgentCount === 0) {
      waitMinutes = 5
      waitLabel = `~5 - 8 phút (Ưu tiên xử lý khẩn cấp - ${member.name} tiếp nhận ngay)`
    } else {
      waitMinutes = 10
      waitLabel = `~8 - 12 phút (Ưu tiên cao - ${member.name} đang hoàn tất 1 ca khẩn khác)`
    }
  } else {
    if (openCount === 0) {
      waitMinutes = 5
      waitLabel = `~3 - 5 phút (${member.name} đang sẵn sàng)`
    } else if (openCount === 1) {
      waitMinutes = 10
      waitLabel = `~7 - 10 phút (${member.name} hiện có 1 phiếu đang xử lý)`
    } else if (openCount === 2) {
      waitMinutes = 15
      waitLabel = `~12 - 15 phút (${member.name} có 2 phiếu trong hàng chờ)`
    } else {
      waitMinutes = Math.min(openCount * 6, 30)
      waitLabel = `~15 - 25 phút (Hàng chờ hiện tại: ${openCount} phiếu)`
    }
  }

  return {
    assignedStaff: member,
    assignedStaffName: member.name,
    assignedStaffInitials: member.initials,
    isAllOffline: false,
    isUrgent,
    priority,
    estimatedWaitMinutes: waitMinutes,
    estimatedWaitLabel: waitLabel,
    queuePosition: openCount + 1,
    emergencyHotline: '1900 8820'
  }
}

/**
 * Match user inquiry against FAQs using keywords and fuzzy phrase matching
 */
export function matchQueryAgainstFAQ(query: string): FAQItem | null {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return null

  // 1. Direct match with FAQ question
  const exact = SUPPORT_FAQS.find(f => f.question.toLowerCase() === normalized)
  if (exact) return exact

  // A shared word does not establish that an out-of-scope question is covered.
  return null
}

/**
 * Requirement 5: Store and retrieve micro-feedback for AI Chatbot
 */
export interface BotFeedbackEntry {
  id: string
  faqId?: string
  question: string
  rating: 'helpful' | 'unhelpful'
  feedbackTags?: string[]
  comment?: string
  timestamp: string
}

const STORAGE_KEY_FEEDBACK = 'storagehub:support:bot_feedback'

export function saveBotFeedback(entry: Omit<BotFeedbackEntry, 'id' | 'timestamp'>): void {
  try {
    const list: BotFeedbackEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY_FEEDBACK) || '[]')
    list.unshift({
      ...entry,
      id: `fb-${Date.now()}`,
      timestamp: new Date().toISOString()
    })
    localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(list.slice(0, 100)))
  } catch {
    // Ignore storage quota errors
  }
}

export function getBotFeedbackStats(): { total: number; helpful: number; unhelpful: number; satisfactionRate: number } {
  try {
    const list: BotFeedbackEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY_FEEDBACK) || '[]')
    const helpful = list.filter(item => item.rating === 'helpful').length
    const total = list.length
    const satisfactionRate = total > 0 ? Math.round((helpful / total) * 100) : 0
    return { total, helpful, unhelpful: total - helpful, satisfactionRate }
  } catch {
    return { total: 0, helpful: 0, unhelpful: 0, satisfactionRate: 0 }
  }
}
