import { describe, it, expect, beforeEach } from 'vitest'
import {
  matchQueryAgainstFAQ,
  assignStaffWithWorkloadAndUrgency,
  resolveCustomerStorageContext,
  saveBotFeedback,
  getBotFeedbackStats,
  SUPPORT_FAQS
} from '../src/services/supportBotService'
import type { User } from '../src/types'
import type { StaffRosterMember, TicketItem } from '../src/data/demoDatabase'

describe('supportBotService', () => {
  const dummyCustomer: User = {
    id: 'user-demo',
    name: 'Nguyen Van A',
    email: 'vana@storagehub.demo',
    role: 'customer',
    facility: 'Kho Việt – Cơ sở Quận 1',
    facilityId: 'fac-001'
  }

  const mockRoster: StaffRosterMember[] = [
    {
      id: 'staff-1',
      name: 'Mai Tran',
      initials: 'MT',
      role: 'staff',
      email: 'mai.tran@storagehub.demo',
      phone: '+84 905 111 222',
      facility: 'Kho Việt – Cơ sở Quận 1',
      facilityId: 'fac-001',
      online: true
    },
    {
      id: 'staff-2',
      name: 'Huy Le',
      initials: 'HL',
      role: 'staff',
      email: 'huy.le@storagehub.demo',
      phone: '+84 905 333 444',
      facility: 'Kho Việt – Cơ sở Quận 1',
      facilityId: 'fac-001',
      online: true
    },
    {
      id: 'mgr-1',
      name: 'Demo Manager',
      initials: 'DM',
      role: 'manager',
      email: 'manager@storagehub.demo',
      phone: '+84 903 444 888',
      facility: 'Kho Việt – Cơ sở Quận 1',
      facilityId: 'fac-001',
      online: true
    }
  ]

  let store: Record<string, string> = {}
  const mockLocalStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
    removeItem: (key: string) => { delete store[key] }
  }
  // @ts-ignore
  globalThis.localStorage = mockLocalStorage

  beforeEach(() => {
    store = {}
  })

  // Requirement 6: Unit & facility mapping
  it('Requirement 6: automatically maps facility and unit from single active rental', () => {
    const rentals = [
      {
        id: 'RNT-001',
        customerEmail: 'vana@storagehub.demo',
        customerName: 'Nguyen Van A',
        facilityName: 'Kho Việt – Cơ sở Quận 1',
        facilityId: 'fac-001',
        unitId: 'HCM-Q1-F01-M-005',
        status: 'active'
      }
    ]

    const context = resolveCustomerStorageContext(dummyCustomer, rentals, [])
    expect(context.facility).toBe('Kho Việt – Cơ sở Quận 1')
    expect(context.facilityId).toBe('fac-001')
    expect(context.unit).toBe('HCM-Q1-F01-M-005')
    expect(context.hasMultipleRentals).toBe(false)
  })

  it('Requirement 6: provides multi-rental list when customer has multiple active units', () => {
    const rentals = [
      {
        id: 'RNT-001',
        customerEmail: 'vana@storagehub.demo',
        facilityName: 'Kho Việt – Cơ sở Quận 1',
        facilityId: 'fac-001',
        unitId: 'HCM-Q1-F01-M-005',
        status: 'active'
      },
      {
        id: 'RNT-002',
        customerEmail: 'vana@storagehub.demo',
        facilityName: 'Kho Việt – Cơ sở Bình Dương',
        facilityId: 'fac-002',
        unitId: 'BD-F01-S-010',
        status: 'active'
      }
    ]

    const context = resolveCustomerStorageContext(dummyCustomer, rentals, [])
    expect(context.hasMultipleRentals).toBe(true)
    expect(context.rentalsList).toHaveLength(2)
  })

  // Requirement 4: Smart priority detection by keywords and category
  it('Requirement 4: assigns high priority to urgent Access & Entry and keyword issues', () => {
    const result = assignStaffWithWorkloadAndUrgency({
      category: 'Access & Entry',
      questionText: 'Cổng ra vào bị kẹt mã PIN không mở được',
      facilityId: 'fac-001',
      currentTickets: [],
      rosterOverride: mockRoster
    })

    expect(result.isUrgent).toBe(true)
    expect(result.priority).toBe('high')
    expect(result.assignedStaff).not.toBeNull()
  })

  // Requirement 2: Specific estimated wait time
  it('Requirement 2: calculates specific wait time based on queue load', () => {
    // Mai Tran has 2 open tickets
    const existingTickets: TicketItem[] = [
      {
        id: 'T1',
        customer: 'B',
        email: 'b@demo.com',
        subject: 'Vấn đề 1',
        category: 'Hợp đồng',
        priority: 'medium',
        status: 'in-progress',
        created: 'now',
        facility: 'Kho Việt – Cơ sở Quận 1',
        unit: 'U1',
        assignedStaff: 'Mai Tran',
        messages: []
      },
      {
        id: 'T2',
        customer: 'C',
        email: 'c@demo.com',
        subject: 'Vấn đề 2',
        category: 'Hợp đồng',
        priority: 'medium',
        status: 'in-progress',
        created: 'now',
        facility: 'Kho Việt – Cơ sở Quận 1',
        unit: 'U2',
        assignedStaff: 'Mai Tran',
        messages: []
      }
    ]

    // Huy Le has 0 tickets, so Huy Le should get assigned!
    const result = assignStaffWithWorkloadAndUrgency({
      category: 'Hợp đồng',
      questionText: 'Cách gia hạn hợp đồng',
      facilityId: 'fac-001',
      currentTickets: existingTickets,
      rosterOverride: mockRoster
    })

    expect(result.assignedStaffName).toBe('Huy Le')
    expect(result.estimatedWaitLabel).toContain('đang sẵn sàng')
  })

  // Requirement 3: Emergency escalation when ALL staff are offline
  it('Requirement 3: triggers emergency escalation to Duty Manager when all staff offline', () => {
    const offlineRoster: StaffRosterMember[] = mockRoster.map(s =>
      s.role === 'staff' ? { ...s, online: false } : s
    )

    const result = assignStaffWithWorkloadAndUrgency({
      category: 'Access & Entry',
      questionText: 'Kẹt cổng chính khẩn cấp',
      facilityId: 'fac-001',
      currentTickets: [],
      rosterOverride: offlineRoster
    })

    expect(result.isAllOffline).toBe(true)
    expect(result.isUrgent).toBe(true)
    expect(result.emergencyHotline).toBe('1900 8820')
    expect(result.emergencyManagerName).toBe('Demo Manager')
    expect(result.estimatedWaitLabel).toContain('Kênh khẩn cấp 24/7')
  })

  // Requirement 5: Micro feedback collection
  it('Requirement 5: saves feedback ratings and updates satisfaction rate', () => {
    saveBotFeedback({
      question: 'Cách thanh toán',
      rating: 'helpful'
    })
    saveBotFeedback({
      question: 'Mã PIN không chạy',
      rating: 'helpful'
    })
    saveBotFeedback({
      question: 'Chuyển kho',
      rating: 'unhelpful',
      feedbackTags: ['Chưa rõ ràng']
    })

    const stats = getBotFeedbackStats()
    expect(stats.total).toBe(3)
    expect(stats.helpful).toBe(2)
    expect(stats.unhelpful).toBe(1)
    expect(stats.satisfactionRate).toBe(67)
  })

  // FAQ matching
  it('matches FAQs accurately based on keywords', () => {
    const match = matchQueryAgainstFAQ('mã pin không mở được cửa')
    expect(match).not.toBeNull()
    expect(match?.category).toBe('Access & Entry')
  })
})
