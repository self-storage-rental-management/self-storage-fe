/** Seed data for the frontend demo. Replace this module with API calls when the backend is connected. */

export const FACILITIES = [
  { id: 'fac-001', name: 'Downtown Storage', address: '125 Nguyen Hue, District 1', city: 'Ho Chi Minh City', rating: 4.8, available: 18, price: '$89', climate: true, security: '24/7', image: 'photo-1553413077-190dd305871c', units: 120, occupied: 96, revenue: 18450, growth: 8.4, manager: 'Demo Manager', status: 'active' },
  { id: 'fac-002', name: 'Riverside Storage', address: '42 Bach Dang, Binh Thanh', city: 'Ho Chi Minh City', rating: 4.6, available: 9, price: '$75', climate: false, security: '24/7', image: 'photo-1586864387967-d02ef85d93e8', units: 80, occupied: 61, revenue: 10890, growth: 5.1, manager: 'Mai Tran', status: 'active' },
]

export const UNITS = [
  { id: 'A-104', size: 5, sqft: 25, floor: 1, type: 'Small', price: 89, climate: true, status: 'available', facility: 'Downtown Storage' },
  { id: 'B-208', size: 10, sqft: 100, floor: 2, type: 'Medium', price: 149, climate: true, status: 'occupied', facility: 'Downtown Storage' },
  { id: 'C-301', size: 20, sqft: 400, floor: 3, type: 'Large', price: 269, climate: false, status: 'available', facility: 'Downtown Storage' },
  { id: 'A-115', size: 5, sqft: 25, floor: 1, type: 'Small', price: 85, climate: false, status: 'reserved', facility: 'Riverside Storage' },
  { id: 'R-106', size: 5, sqft: 25, floor: 1, type: 'Small', price: 75, climate: false, status: 'available', facility: 'Riverside Storage' },
  { id: 'R-214', size: 10, sqft: 100, floor: 2, type: 'Medium', price: 135, climate: false, status: 'available', facility: 'Riverside Storage' },
  { id: 'R-305', size: 20, sqft: 400, floor: 3, type: 'Large', price: 245, climate: true, status: 'available', facility: 'Riverside Storage' },
  { id: 'B-112', size: 10, sqft: 100, floor: 1, type: 'Medium', price: 155, climate: true, status: 'available', facility: 'Downtown Storage' },
  { id: 'D-402', size: 25, sqft: 500, floor: 4, type: 'Extra Large', price: 349, climate: true, status: 'occupied', facility: 'Downtown Storage' },
]

export const MY_RENTALS = [
  { id: 'rent-001', unit: 'B-208', facility: 'Downtown Storage', size: 10, status: 'active', paid: true, amount: 149, startDate: 'Jan 12, 2026', nextDue: 'Oct 12, 2026' },
  { id: 'rent-002', unit: 'A-104', facility: 'Downtown Storage', size: 5, status: 'active', paid: false, amount: 89, startDate: 'Feb 01, 2026', nextDue: 'Sep 25, 2026' }
]

export const PAYMENTS = [
  { id: 'INV-2026-0081', date: 'Sep 12, 2026', description: 'Unit B-208 · September rent', method: 'Visa ending 4242', amount: 149, status: 'paid' },
  { id: 'INV-2026-0070', date: 'Aug 12, 2026', description: 'Unit B-208 · August rent', method: 'Visa ending 4242', amount: 149, status: 'paid' },
  { id: 'INV-2026-0062', date: 'Jul 12, 2026', description: 'Unit B-208 · July rent', method: 'Visa ending 4242', amount: 149, status: 'paid' },
]

export interface TicketMessage {
  id: string
  sender: string
  role: 'customer' | 'staff' | 'system'
  time: string
  text: string
}

export interface TicketItem {
  id: string
  customer: string
  email: string
  subject: string
  category: string
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'resolved'
  created: string
  facility: string
  facilityId?: string
  unit: string
  assignedStaff?: string
  updatedAt?: string
  relatedType?: 'rental' | 'reservation' | 'general'
  relatedId?: string
  messages: TicketMessage[]
}

export const TICKETS: TicketItem[] = [
  {
    id: 'TKT-1042',
    customer: 'Demo Customer',
    email: 'customer@storagehub.demo',
    subject: 'Access gate code not responding at main entry',
    category: 'Access & Entry',
    priority: 'high',
    status: 'open',
    created: 'Sep 17, 2026 · 10:24 AM',
    facility: 'Downtown Storage',
    unit: 'B-208',
    messages: [
      {
        id: 'msg-1',
        sender: 'Demo Customer',
        role: 'customer',
        time: 'Sep 17, 2026 · 10:24 AM',
        text: 'Hello, I tried entering my digital passcode (4921#) at the north vehicle gate around 10:15 AM today but the keypad beeped three times with a red LED error. Could you verify if my pin is synced?'
      },
      {
        id: 'msg-2',
        sender: 'Staff Member (Mai Tran)',
        role: 'staff',
        time: 'Sep 17, 2026 · 10:45 AM',
        text: 'Hi Demo Customer, we just pushed a firmware refresh to the North Gate controller. Could you test it again or use emergency code 8820# for immediate access while we investigate?'
      }
    ]
  },
  {
    id: 'TKT-1039',
    customer: 'Tran Van Binh',
    email: 'binh.tran@email.com',
    subject: 'Request invoice receipt with business VAT tax code',
    category: 'Billing & Invoices',
    priority: 'medium',
    status: 'in-progress',
    created: 'Sep 16, 2026 · 02:15 PM',
    facility: 'Downtown Storage',
    unit: 'A-210',
    messages: [
      {
        id: 'msg-3',
        sender: 'Tran Van Binh',
        role: 'customer',
        time: 'Sep 16, 2026 · 02:15 PM',
        text: 'Please re-issue my last two rent receipts with Company Tax ID: 0314892019.'
      },
      {
        id: 'msg-4',
        sender: 'Accounting Team',
        role: 'staff',
        time: 'Sep 16, 2026 · 04:30 PM',
        text: 'Your request has been forwarded to accounting. Revised e-invoices will be sent to your registered email.'
      }
    ]
  },
  {
    id: 'TKT-1025',
    customer: 'Le Hoang Nam',
    email: 'nam.le@gmail.com',
    subject: 'Inquiry about climate-controlled unit temperature range',
    category: 'Unit Condition',
    priority: 'low',
    status: 'resolved',
    created: 'Sep 14, 2026 · 09:00 AM',
    facility: 'Downtown Storage',
    unit: 'C-301',
    messages: [
      {
        id: 'msg-5',
        sender: 'Le Hoang Nam',
        role: 'customer',
        time: 'Sep 14, 2026 · 09:00 AM',
        text: 'What is the standard humidity and temperature maintained on Floor 3?'
      },
      {
        id: 'msg-6',
        sender: 'Facility Operations',
        role: 'staff',
        time: 'Sep 14, 2026 · 10:12 AM',
        text: 'Hi Mr. Nam, Floor 3 is temperature controlled between 20°C–23°C with humidity strictly maintained under 55% RH 24/7.'
      }
    ]
  },
  {
    id: 'TKT-1018',
    customer: 'Nguyen Minh Anh',
    email: 'anh.nguyen@outlook.com',
    subject: 'Extend monthly rental contract automatically',
    category: 'Billing & Invoices',
    priority: 'low',
    status: 'resolved',
    created: 'Sep 12, 2026 · 03:40 PM',
    facility: 'Downtown Storage',
    unit: 'A-104',
    messages: [
      {
        id: 'msg-7',
        sender: 'Nguyen Minh Anh',
        role: 'customer',
        time: 'Sep 12, 2026 · 03:40 PM',
        text: 'I would like to activate auto-renewal for my lease on Unit A-104.'
      },
      {
        id: 'msg-8',
        sender: 'Demo Staff',
        role: 'staff',
        time: 'Sep 12, 2026 · 04:00 PM',
        text: 'Auto-renewal is now active on your account with payment method ending in 4242.'
      }
    ]
  }
]

export const SUPPORT_TICKETS = TICKETS

export const TASKS = [
  { id: 'task-1', title: 'Inspect unit A-104 before handover', time: '09:00 AM', priority: 'high', done: false },
  { id: 'task-2', title: 'Verify reservation R-2048', time: '10:30 AM', priority: 'medium', done: true },
  { id: 'task-3', title: 'Check corridor cameras', time: '02:00 PM', priority: 'low', done: false }
]

export const RESERVATIONS = [
  { id: 'RSV-2048', customer: 'Nguyen Minh Anh', email: 'anh.nguyen@outlook.com', phone: '090 123 4567', identityId: '079203001234', unit: 'A-104', facility: 'Downtown Storage', facilityAddress: '125 Nguyen Hue, District 1', size: 5, moveIn: 'Sep 20, 2026', payment: 'paid', paid: true, status: 'pending', emailVerified: true, goodsType: 'Tài liệu và đồ gia dụng', material: 'Giấy, nhựa, vải', packageCount: 12, weightKg: 180, dimensionsCm: '80 × 60 × 70', dimWeightKg: 56, initialCondition: '12 kiện nguyên niêm phong, khô ráo', evidence: ['EV-2048-01 · Ảnh hàng hóa lúc khai báo', 'MAIL-2048 · Email đã xác nhận lúc 09:42 18/09/2026'] },
  { id: 'RSV-2049', customer: 'Hoang Van Bach', email: 'bach.hoang@gmail.com', phone: '091 999 8811', identityId: '079198004567', unit: 'B-112', facility: 'Downtown Storage', facilityAddress: '125 Nguyen Hue, District 1', size: 10, moveIn: 'Sep 22, 2026', payment: 'pending', paid: false, status: 'confirmed', emailVerified: false, goodsType: 'Thiết bị văn phòng', material: 'Kim loại, nhựa', packageCount: 8, weightKg: 240, dimensionsCm: '120 × 80 × 90', dimWeightKg: 173, initialCondition: '8 kiện, 1 thùng móp góc nhẹ', evidence: ['EV-2049-01 · Phiếu khai báo hàng hóa'] }
]

export const CHECKINS = [
  { id: 'CHK-301', reservationId: 'RSV-2048', customer: 'Nguyen Minh Anh', email: 'anh.nguyen@outlook.com', phone: '090 123 4567', identityId: '079203001234', unit: 'A-104', facility: 'Downtown Storage', date: 'Sep 20, 2026', time: '11:00 AM', status: 'scheduled', goodsType: 'Tài liệu và đồ gia dụng', material: 'Giấy, nhựa, vải', packageCount: 12, weightKg: 180, dimensionsCm: '80 × 60 × 70', dimWeightKg: 56, initialCondition: 'Kho sạch, khóa hoạt động; 12 kiện nguyên niêm phong', evidence: ['Ảnh CCCD đã đối chiếu', 'Ảnh hiện trạng kho trước bàn giao', 'Phiếu cân & đo kích thước'] }
]

export const RETURNS = [
  { id: 'RET-118', customer: 'Pham Thu Ha', email: 'ha.pham@gmail.com', phone: '093 555 0128', unit: 'A-102', facility: 'Downtown Storage', date: 'Sep 15, 2026', returnDate: 'Sep 15, 2026', condition: 'good', status: 'pending', deposit: 89, damageNotes: '', goodsType: 'Đồ gia dụng', material: 'Gỗ, vải', packageCount: 6, initialWeightKg: 132, finalWeightKg: 130, initialCondition: 'Kho sạch, tường và khóa nguyên vẹn; 6 kiện', finalCondition: 'Chờ kiểm kê', classification: 'Chờ phân loại', evidence: ['EV-IN-118 · 6 ảnh hiện trạng lúc nhận kho'] }
]

export const OCCUPANCY_DATA = [
  { month: 'Apr', occupied: 78, total: 120 },
  { month: 'May', occupied: 84, total: 120 },
  { month: 'Jun', occupied: 89, total: 120 },
  { month: 'Jul', occupied: 92, total: 120 },
  { month: 'Aug', occupied: 95, total: 120 },
  { month: 'Sep', occupied: 96, total: 120 }
]

export const REVENUE_DATA = [
  { month: 'Apr', revenue: 14200 },
  { month: 'May', revenue: 15600 },
  { month: 'Jun', revenue: 16300 },
  { month: 'Jul', revenue: 17100 },
  { month: 'Aug', revenue: 17900 },
  { month: 'Sep', revenue: 18450 }
]

export const UNIT_TYPE_DATA = [
  { name: 'Small', value: 42, color: '#3b82f6' },
  { name: 'Medium', value: 48, color: '#8b5cf6' },
  { name: 'Large', value: 22, color: '#f59e0b' },
  { name: 'Extra Large', value: 8, color: '#10b981' }
]

export interface RentalRecord {
  id: string
  customer: string
  tenant: string
  email: string
  phone: string
  unit: string
  unitType: string
  size: number
  facility: string
  amount: number
  deposit: number
  status: 'active' | 'pending' | 'expiring' | 'terminated'
  paid: 'paid' | 'pending' | 'overdue'
  paymentStatus: 'paid' | 'pending' | 'overdue'
  startDate: string
  nextDue: string
  dueDate: string
  endDate: string
  autoRenew: boolean
  gateCode: string
}

export const RENTALS: RentalRecord[] = [
  {
    id: 'RNT-2026-001',
    customer: 'Demo Customer',
    tenant: 'Demo Customer',
    email: 'customer@storagehub.demo',
    phone: '+84 908 123 456',
    unit: 'B-208',
    unitType: 'Medium Climate',
    size: 10,
    facility: 'Downtown Storage',
    amount: 149,
    deposit: 149,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'Jan 12, 2026',
    nextDue: 'Oct 12, 2026',
    dueDate: 'Oct 12, 2026',
    endDate: 'Jan 12, 2027',
    autoRenew: true,
    gateCode: '4921#'
  },
  {
    id: 'RNT-2026-002',
    customer: 'Tran Van Binh',
    tenant: 'Tran Van Binh',
    email: 'binh.tran@email.com',
    phone: '+84 912 345 678',
    unit: 'A-210',
    unitType: 'Small Standard',
    size: 5,
    facility: 'Downtown Storage',
    amount: 89,
    deposit: 89,
    status: 'active',
    paid: 'overdue',
    paymentStatus: 'overdue',
    startDate: 'Mar 01, 2026',
    nextDue: 'Sep 05, 2026',
    dueDate: 'Sep 05, 2026',
    endDate: 'Mar 01, 2027',
    autoRenew: false,
    gateCode: '1092#'
  },
  {
    id: 'RNT-2026-003',
    customer: 'Nguyen Minh Anh',
    tenant: 'Nguyen Minh Anh',
    email: 'anh.nguyen@outlook.com',
    phone: '+84 903 555 123',
    unit: 'A-104',
    unitType: 'Small Climate',
    size: 5,
    facility: 'Downtown Storage',
    amount: 89,
    deposit: 89,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'Apr 10, 2026',
    nextDue: 'Oct 10, 2026',
    dueDate: 'Oct 10, 2026',
    endDate: 'Apr 10, 2027',
    autoRenew: true,
    gateCode: '7731#'
  },
  {
    id: 'RNT-2026-004',
    customer: 'Le Hoang Nam',
    tenant: 'Le Hoang Nam',
    email: 'nam.le@gmail.com',
    phone: '+84 988 776 655',
    unit: 'C-301',
    unitType: 'Large Storage',
    size: 20,
    facility: 'Downtown Storage',
    amount: 269,
    deposit: 269,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'Jun 15, 2026',
    nextDue: 'Oct 15, 2026',
    dueDate: 'Oct 15, 2026',
    endDate: 'Dec 15, 2026',
    autoRenew: false,
    gateCode: '3128#'
  },
  {
    id: 'RNT-2026-005',
    customer: 'Saigon Logistics Co.',
    tenant: 'Saigon Logistics Co.',
    email: 'contact@sg-logistics.vn',
    phone: '+84 28 3822 9999',
    unit: 'D-402',
    unitType: 'Extra Large Commercial',
    size: 25,
    facility: 'Downtown Storage',
    amount: 349,
    deposit: 349,
    status: 'active',
    paid: 'paid',
    paymentStatus: 'paid',
    startDate: 'May 01, 2026',
    nextDue: 'Oct 01, 2026',
    dueDate: 'Oct 01, 2026',
    endDate: 'May 01, 2027',
    autoRenew: true,
    gateCode: '9004#'
  },
  {
    id: 'RNT-2026-006',
    customer: 'Doan Thi Mai',
    tenant: 'Doan Thi Mai',
    email: 'mai.doan@gmail.com',
    phone: '+84 977 112 233',
    unit: 'A-115',
    unitType: 'Small Standard',
    size: 5,
    facility: 'Riverside Storage',
    amount: 75,
    deposit: 75,
    status: 'pending',
    paid: 'pending',
    paymentStatus: 'pending',
    startDate: 'Sep 25, 2026',
    nextDue: 'Sep 25, 2026',
    dueDate: 'Sep 25, 2026',
    endDate: 'Mar 25, 2027',
    autoRenew: false,
    gateCode: 'Pending'
  },
  {
    id: 'RNT-2026-007',
    customer: 'Vuong Quoc Tuan',
    tenant: 'Vuong Quoc Tuan',
    email: 'tuan.vuong@vcorp.vn',
    phone: '+84 909 888 222',
    unit: 'B-108',
    unitType: 'Medium Standard',
    size: 10,
    facility: 'Riverside Storage',
    amount: 135,
    deposit: 135,
    status: 'active',
    paid: 'overdue',
    paymentStatus: 'overdue',
    startDate: 'Feb 15, 2026',
    nextDue: 'Sep 01, 2026',
    dueDate: 'Sep 01, 2026',
    endDate: 'Feb 15, 2027',
    autoRenew: false,
    gateCode: '5561#'
  }
]

export const STAFF_LIST = [
  { id: 'demo-staff', name: 'Demo Staff', email: 'staff@storagehub.demo', role: 'Operations Specialist', roleVi: 'Chuyên viên vận hành', shift: 'Morning', shiftVi: 'Ca sáng', tasks: 3, status: 'on-duty', phone: '090 555 0101', facilityId: 'fac-001', facilityName: 'Downtown Storage' },
  { id: 'staff-2', name: 'Mai Tran', email: 'mai@storagehub.demo', role: 'Facility Supervisor', roleVi: 'Giám sát cơ sở', shift: 'Day', shiftVi: 'Ca ngày', tasks: 5, status: 'on-duty', phone: '090 555 0102', facilityId: 'fac-001', facilityName: 'Downtown Storage' },
  { id: 'staff-3', name: 'Nguyen Quoc Dat', email: 'dat.nguyen@storagehub.demo', role: 'Security & Access Tech', roleVi: 'Kỹ thuật an ninh và truy cập', shift: 'Night', shiftVi: 'Ca đêm', tasks: 1, status: 'off-duty', phone: '090 555 0103', facilityId: 'fac-002', facilityName: 'Riverside Storage' }
]

export interface OverdueAccount {
  id: string
  customer: string
  tenant: string
  email: string
  phone: string
  unit: string
  facility: string
  amount: number
  baseAmount: number
  lateFee: number
  days: number
  overdueDays: number
  stage: 'grace' | 'notice' | 'overlocked' | 'lien'
  stageLabel: string
  status: 'overdue' | 'critical' | 'lien'
  overlocked: boolean
  lastContact: string
  remindersSent: number
  dueDate: string
}

export const OVERDUE: OverdueAccount[] = [
  {
    id: 'OD-11',
    customer: 'Tran Van Binh',
    tenant: 'Tran Van Binh',
    email: 'binh.tran@email.com',
    phone: '+84 912 345 678',
    unit: 'A-210',
    facility: 'Downtown Storage',
    amount: 89,
    baseAmount: 89,
    lateFee: 25,
    days: 13,
    overdueDays: 13,
    stage: 'notice',
    stageLabel: '8–14 Days (Notice Sent)',
    status: 'overdue',
    overlocked: false,
    lastContact: 'Sep 15, 2026 · SMS Sent',
    remindersSent: 2,
    dueDate: 'Sep 05, 2026'
  },
  {
    id: 'OD-12',
    customer: 'Vuong Quoc Tuan',
    tenant: 'Vuong Quoc Tuan',
    email: 'tuan.vuong@vcorp.vn',
    phone: '+84 909 888 222',
    unit: 'B-108',
    facility: 'Riverside Storage',
    amount: 135,
    baseAmount: 135,
    lateFee: 35,
    days: 17,
    overdueDays: 17,
    stage: 'overlocked',
    stageLabel: '15–30 Days (Overlocked)',
    status: 'critical',
    overlocked: true,
    lastContact: 'Sep 14, 2026 · Phone Call',
    remindersSent: 3,
    dueDate: 'Sep 01, 2026'
  },
  {
    id: 'OD-13',
    customer: 'Nguyen Dinh Trinh',
    tenant: 'Nguyen Dinh Trinh',
    email: 'trinh.nguyen@freemail.com',
    phone: '+84 902 119 922',
    unit: 'C-105',
    facility: 'Downtown Storage',
    amount: 220,
    baseAmount: 220,
    lateFee: 50,
    days: 34,
    overdueDays: 34,
    stage: 'lien',
    stageLabel: '30+ Days (Notice of Lien)',
    status: 'lien',
    overlocked: true,
    lastContact: 'Sep 10, 2026 · Certified Mail',
    remindersSent: 5,
    dueDate: 'Aug 15, 2026'
  },
  {
    id: 'OD-14',
    customer: 'Ha Gia Bao',
    tenant: 'Ha Gia Bao',
    email: 'giabao.ha@gmail.com',
    phone: '+84 938 445 566',
    unit: 'A-304',
    facility: 'Downtown Storage',
    amount: 89,
    baseAmount: 89,
    lateFee: 0,
    days: 4,
    overdueDays: 4,
    stage: 'grace',
    stageLabel: '1–7 Days (Grace Period)',
    status: 'overdue',
    overlocked: false,
    lastContact: 'Sep 17, 2026 · Automated Email',
    remindersSent: 1,
    dueDate: 'Sep 14, 2026'
  }
]

export const UTILIZATION = [
  { name: 'Downtown Storage', value: 80 },
  { name: 'Riverside Storage', value: 76 }
]

export const SUPPORT_METRICS = [
  { label: 'Open', value: 4 },
  { label: 'Resolved', value: 28 }
]

export const REVENUE_TREND = REVENUE_DATA

export const CONVERSION_DATA = [
  { month: 'Apr', visits: 420, bookings: 38 },
  { month: 'May', visits: 510, bookings: 49 },
  { month: 'Jun', visits: 580, bookings: 61 },
  { month: 'Jul', visits: 620, bookings: 66 },
  { month: 'Aug', visits: 710, bookings: 78 },
  { month: 'Sep', visits: 760, bookings: 84 }
]

// export const PRICING_TIERS = [
//   { id: 'tier-1', name: 'Small Unit', size: '5 ft (25 sq ft)', basePrice: 89, climateAdder: 20, highDemandMultiplier: 1.15, facility: 'All facilities' },
//   { id: 'tier-2', name: 'Medium Unit', size: '10 ft (100 sq ft)', basePrice: 149, climateAdder: 30, highDemandMultiplier: 1.2, facility: 'All facilities' },
//   { id: 'tier-3', name: 'Large Unit', size: '20 ft (400 sq ft)', basePrice: 269, climateAdder: 45, highDemandMultiplier: 1.25, facility: 'All facilities' }
// ]

export const PRICING_TIERS =
  [
    {
      id: 'tier-1',
      name: 'Small Unit',
      size: '7,500,000 cm³',
      basePrice: 89,
      climateAdder: 20,
      highDemandMultiplier: 1.15,
      facility: 'All facilities'
    },

    {
      id: 'tier-2',
      name: 'Medium Unit',
      size: '18,750,000 cm³',
      basePrice: 149,
      climateAdder: 30,
      highDemandMultiplier: 1.2,
      facility: 'All facilities'
    },

    {
      id: 'tier-3',
      name: 'Large Unit',
      size: '60,000,000 cm³',
      basePrice: 269,
      climateAdder: 45,
      highDemandMultiplier: 1.25,
      facility: 'All facilities'
    }
  ];

export interface PromotionItem {
  id: string
  code: string
  name: string
  description: string
  value: string
  discount: string
  type: 'percentage' | 'fixed-amount' | 'first-month-free' | 'seasonal'
  typeLabel: string
  active: boolean
  status: 'active' | 'paused' | 'expired'
  uses: number
  maxUses: number
  minLeaseMonths: number
  applicableFacility: string
  applicableUnitType: string
  startDate: string
  expires: string
}

export const DISCOUNTS: PromotionItem[] = [
  {
    id: 'DSC-101',
    code: 'WELCOME10',
    name: 'New Tenant Welcome Offer',
    description: '10% discount off the first 3 months of storage rental for first-time customers.',
    value: '10% OFF',
    discount: '10% off for 3 months',
    type: 'percentage',
    typeLabel: 'Percentage Off',
    active: true,
    status: 'active',
    uses: 48,
    maxUses: 100,
    minLeaseMonths: 3,
    applicableFacility: 'All facilities',
    applicableUnitType: 'All Sizes',
    startDate: 'Jan 01, 2026',
    expires: 'Dec 31, 2026'
  },
  {
    id: 'DSC-102',
    code: 'FIRSTFREE',
    name: '1st Month Free on Annual Lease',
    description: 'Pay for 11 months upfront or sign a 12-month contract and receive the 1st full month completely free.',
    value: '100% OFF M1',
    discount: '1st Month 100% Free',
    type: 'first-month-free',
    typeLabel: 'Free Month',
    active: true,
    status: 'active',
    uses: 22,
    maxUses: 50,
    minLeaseMonths: 12,
    applicableFacility: 'Downtown Storage',
    applicableUnitType: 'Medium & Large',
    startDate: 'Feb 15, 2026',
    expires: 'Nov 30, 2026'
  },
  {
    id: 'DSC-103',
    code: 'FALLSTORAGE25',
    name: 'Autumn Move-In Special',
    description: 'Instant $25 deduction on the first month invoice for any new storage unit reservation.',
    value: '$25 OFF',
    discount: '$25 one-time adjustment',
    type: 'fixed-amount',
    typeLabel: 'Fixed Amount',
    active: true,
    status: 'active',
    uses: 36,
    maxUses: 80,
    minLeaseMonths: 1,
    applicableFacility: 'Riverside Storage',
    applicableUnitType: 'Small & Medium',
    startDate: 'Sep 01, 2026',
    expires: 'Oct 31, 2026'
  },
  {
    id: 'DSC-104',
    code: 'BIZBULK15',
    name: 'Corporate Bulk Lease Advantage',
    description: '15% ongoing monthly discount for enterprise & B2B accounts renting 2 or more units simultaneously.',
    value: '15% OFF',
    discount: '15% recurring discount',
    type: 'percentage',
    typeLabel: 'Enterprise Bulk',
    active: true,
    status: 'active',
    uses: 14,
    maxUses: 30,
    minLeaseMonths: 6,
    applicableFacility: 'All facilities',
    applicableUnitType: 'Large & Extra Large',
    startDate: 'Mar 01, 2026',
    expires: 'Dec 31, 2026'
  },
  {
    id: 'DSC-105',
    code: 'SUMMER2026',
    name: 'Summer Flash Promotion (Expired)',
    description: 'Summer seasonal campaign for student locker and mini storage.',
    value: '$15 OFF',
    discount: '$15 one-time off',
    type: 'seasonal',
    typeLabel: 'Seasonal Flash',
    active: false,
    status: 'expired',
    uses: 60,
    maxUses: 60,
    minLeaseMonths: 2,
    applicableFacility: 'All facilities',
    applicableUnitType: 'Small',
    startDate: 'Jun 01, 2026',
    expires: 'Aug 31, 2026'
  }
]

// export const POLICIES = [
//   { id: 'pol-1', name: 'Standard monthly rental', description: 'Month-to-month rental with 30-day notice.', status: 'active' },
//   { id: 'pol-2', name: 'Annual corporate lease', description: '12-month fixed commitment with discounted base rate.', status: 'active' }
// ]

export const POLICIES = [
  { id: 'pol-1', name: 'Grace Period', value: '5 days', scope: 'All Facilities', editable: true },
  { id: 'pol-2', name: 'Late Fee', value: '$25 / month', scope: 'All Facilities', editable: true },
  { id: 'pol-3', name: 'Security Deposit', value: '1 month', scope: 'All Facilities', editable: true },
  { id: 'pol-4', name: 'Notice to Vacate', value: '15 days', scope: 'All Facilities', editable: true },
  { id: 'pol-5', name: 'Minimum Lease', value: '1 month', scope: 'All Facilities', editable: true }
]


export const FEES = [
  { type: 'Late payment fee', amount: '$25.00', trigger: 'Applied automatically 5 days after payment due date', applies: 'All tenants' },
  { type: 'Digital lock replacement', amount: '$45.00', trigger: 'Upon tenant physical loss or key fob damage', applies: 'Tenant responsibility' },
  { type: 'Unit cleaning & restoration', amount: '$80.00', trigger: 'Charged if unit returned with debris or biohazard', applies: 'Move-out inspection' },
  { type: 'Emergency unlock assistance', amount: '$30.00', trigger: 'After-hours on-site manual lock release', applies: 'Per call-out' }
]

export const USERS = [
  { id: 'demo-customer', name: 'Demo Customer', email: 'customer@storagehub.demo', role: 'customer', facility: 'Downtown Storage', phone: '+84 908 123 456', status: 'active', lastLogin: 'Today, 09:12 AM', joined: 'Jan 12, 2026' },
  { id: 'demo-staff', name: 'Demo Staff', email: 'staff@storagehub.demo', role: 'staff', facility: 'Downtown Storage', phone: '+84 905 550 101', status: 'active', lastLogin: 'Today, 08:45 AM', joined: 'Jan 10, 2026' },
  { id: 'demo-manager', name: 'Demo Manager', email: 'manager@storagehub.demo', role: 'manager', facility: 'Downtown Storage', phone: '+84 903 444 888', status: 'active', lastLogin: 'Today, 08:30 AM', joined: 'Jan 05, 2026' },
  { id: 'demo-business', name: 'Demo Operations', email: 'business@storagehub.demo', role: 'business', facility: 'All facilities', phone: '+84 28 3999 1111', status: 'active', lastLogin: 'Yesterday, 04:20 PM', joined: 'Dec 20, 2025' },
  { id: 'demo-admin', name: 'Demo Administrator', email: 'admin@storagehub.demo', role: 'admin', facility: 'All facilities', phone: '+84 901 000 999', status: 'active', lastLogin: 'Today, 07:55 AM', joined: 'Dec 01, 2025' }
]

export const LOGIN_HISTORY = [
  { id: 'log-1', user: 'Demo Customer', email: 'customer@storagehub.demo', role: 'customer', time: 'Today, 09:12 AM', ip: '192.168.1.20', location: 'District 1, HCMC', device: 'Chrome on macOS', status: 'success' },
  { id: 'log-2', user: 'Demo Staff', email: 'staff@storagehub.demo', role: 'staff', time: 'Today, 08:45 AM', ip: '192.168.1.21', location: 'District 1, HCMC', device: 'Firefox on Windows', status: 'success' },
  { id: 'log-3', user: 'Demo Manager', email: 'manager@storagehub.demo', role: 'manager', time: 'Today, 08:30 AM', ip: '192.168.1.10', location: 'District 1, HCMC', device: 'Safari on iPhone 15', status: 'success' },
  { id: 'log-4', user: 'Unknown User', email: 'admin@storagehub.demo', role: 'admin', time: 'Yesterday, 11:42 PM', ip: '14.232.180.99', location: 'Da Nang, VN', device: 'Chrome on Windows', status: 'failed' }
]

export interface AuditActivityLog {
  id: string
  user: string
  actor: string
  role: string
  action: string
  target: string
  time: string
  timestamp: string
  type: 'info' | 'success' | 'warning' | 'error'
  severity: 'info' | 'warning' | 'error'
  category: 'rental' | 'billing' | 'pricing' | 'admin' | 'security' | 'access'
  ip: string
  device: string
  details: Record<string, any>
}

export const ACTIVITY_LOGS: AuditActivityLog[] = [
  {
    id: 'act-101',
    user: 'Demo Administrator',
    actor: 'Demo Administrator',
    role: 'admin',
    action: 'Updated facility operating security policy',
    target: 'Downtown Storage · Gate PIN Policy',
    time: '8 minutes ago',
    timestamp: '2026-09-18 11:58:14',
    type: 'info',
    severity: 'info',
    category: 'security',
    ip: '192.168.1.10',
    device: 'Chrome 128 / macOS Sequoia',
    details: {
      actionType: 'POLICY_UPDATE',
      changedFields: {
        pinRotationDays: { old: 90, new: 60 },
        failedLockoutThreshold: { old: 5, new: 3 }
      }
    }
  },
  {
    id: 'act-102',
    user: 'Demo Manager',
    actor: 'Demo Manager',
    role: 'manager',
    action: 'Overlocked Unit B-108 due to 17 days delinquency',
    target: 'Unit B-108 · Tenant Vuong Quoc Tuan',
    time: '24 minutes ago',
    timestamp: '2026-09-18 11:42:00',
    type: 'warning',
    severity: 'warning',
    category: 'access',
    ip: '192.168.1.15',
    device: 'Safari / iPadOS 18',
    details: {
      actionType: 'DIGITAL_LOCKOUT',
      tenantId: 'OD-12',
      pastDueAmount: 170,
      gatePinSuspended: true
    }
  },
  {
    id: 'act-104',
    user: 'Demo Staff',
    actor: 'Demo Staff',
    role: 'staff',
    action: 'Completed unit return inspection for RET-118',
    target: 'Unit A-102 · Tenant Pham Thu Ha',
    time: '2 hours ago',
    timestamp: '2026-09-18 10:14:19',
    type: 'success',
    severity: 'info',
    category: 'rental',
    ip: '192.168.1.21',
    device: 'Firefox 130 / Windows 11',
    details: {
      actionType: 'INSPECTION_FINALIZE',
      conditionResult: 'PASS_CLEAN',
      depositRefundApproved: 89
    }
  },
  {
    id: 'act-105',
    user: 'Security System',
    actor: 'Automated Access Daemon',
    role: 'system',
    action: 'Repeated unauthorized keypad entry attempts recorded',
    target: 'North Vehicle Gate Keypad',
    time: '3 hours ago',
    timestamp: '2026-09-18 09:15:02',
    type: 'error',
    severity: 'error',
    category: 'security',
    ip: '10.0.4.12',
    device: 'Hardware Controller v3.2',
    details: {
      actionType: 'SECURITY_ALERT',
      event: 'EXCESSIVE_FAILED_PINS',
      count: 4,
      lockoutDurationSeconds: 300
    }
  },
  {
    id: 'act-106',
    user: 'Demo Customer',
    actor: 'Demo Customer',
    role: 'customer',
    action: 'Processed online credit card payment for September rent',
    target: 'Invoice INV-2026-0081 · $149.00',
    time: '5 hours ago',
    timestamp: '2026-09-18 07:11:45',
    type: 'success',
    severity: 'info',
    category: 'billing',
    ip: '14.232.88.19',
    device: 'Chrome Mobile / Android 14',
    details: {
      actionType: 'PAYMENT_CAPTURE',
      amount: 149.00,
      method: 'Visa •••• 4242',
      status: 'SETTLED'
    }
  }
]

export interface SettingGroup {
  group: string
  description?: string
  items: Array<{
    id: string
    label: string
    description?: string
    type: 'text' | 'select' | 'toggle' | 'number'
    value: string | number | boolean
    options?: string[]
  }>
}

export const SETTINGS_GROUPS: SettingGroup[] = [
  {
    group: 'Facility & Business Profile',
    description: 'General organization parameters and primary contact channels.',
    items: [
      { id: 'businessName', label: 'Company / Facility Name', type: 'text', value: 'StorageHub Vietnam' },
      { id: 'contactEmail', label: 'Primary Support Email', type: 'text', value: 'support@storagehub.demo' },
      { id: 'hotline', label: 'Customer Hotline', type: 'text', value: '+84 28 3822 8888' },
      { id: 'currency', label: 'Operating Currency', type: 'select', value: 'USD ($)', options: ['USD ($)', 'VND (₫)', 'EUR (€)', 'SGD ($)'] },
      { id: 'timezone', label: 'Facility Timezone', type: 'select', value: 'GMT+7 (Asia/Ho_Chi_Minh)', options: ['GMT+7 (Asia/Ho_Chi_Minh)', 'GMT+8 (Asia/Singapore)', 'GMT+0 (UTC)'] }
    ]
  },
  {
    group: 'Billing & Invoicing Rules',
    description: 'Automated invoice generation, grace periods, and late penalty triggers.',
    items: [
      { id: 'gracePeriod', label: 'Late Fee Grace Period (Days)', type: 'number', value: 5 },
      { id: 'lateFeeAmount', label: 'Fixed Late Fee Amount ($)', type: 'number', value: 25 },
      { id: 'autoInvoiceDays', label: 'Advance Invoice Generation (Days)', type: 'select', value: '7 days before due date', options: ['3 days before due date', '7 days before due date', '14 days before due date', '30 days before due date'] },
      { id: 'autoProrate', label: 'Prorate First Month Rent on Move-in', type: 'toggle', value: true }
    ]
  },
  {
    group: 'Security & Access Controls',
    description: 'Hardware controller security, access lockout, and authentication requirements.',
    items: [
      { id: 'require2FA', label: 'Enforce Two-Factor Authentication (2FA) for Staff', type: 'toggle', value: true },
      { id: 'pinRotation', label: 'Gate PIN Auto-Rotation Interval', type: 'select', value: '90 days', options: ['30 days', '60 days', '90 days', 'Never (Manual)'] },
      { id: 'lockoutAttempts', label: 'Failed PIN Lockout Threshold', type: 'select', value: '3 failed attempts', options: ['3 failed attempts', '5 failed attempts', '10 failed attempts'] },
      { id: 'sessionTimeout', label: 'Admin Session Inactivity Timeout', type: 'select', value: '30 minutes', options: ['15 minutes', '30 minutes', '60 minutes', '4 hours'] }
    ]
  },
  {
    group: 'Automated Notifications & Webhooks',
    description: 'Direct SMS and email dispatch configurations for operational alerts.',
    items: [
      { id: 'emailAlerts', label: 'Send Overdue Reminder Emails', type: 'toggle', value: true },
      { id: 'smsGateAlerts', label: 'Send SMS on After-Hours Gate Access', type: 'toggle', value: false },
      { id: 'slackWebhook', label: 'Operational Incident Slack Webhook', type: 'text', value: 'https://hooks.slack.com/services/T00/B00/XXXX' },
      { id: 'dailyDigest', label: 'Daily Executive Performance Digest to Managers', type: 'toggle', value: true }
    ]
  },
  {
    group: 'Maintenance & Service Mode',
    description: 'Emergency controls and maintenance banners.',
    items: [
      { id: 'maintenanceMode', label: 'Maintenance Mode (Block New Bookings)', type: 'toggle', value: false },
      { id: 'bannerNotice', label: 'Public Facility Announcement Banner', type: 'text', value: 'Routine fire alarm testing scheduled this Sunday 9:00 AM - 11:00 AM.' }
    ]
  }
]

export const SETTINGS = SETTINGS_GROUPS
