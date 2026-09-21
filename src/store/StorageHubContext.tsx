import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import type {
  Facility,
  StorageUnit,
  StorageReservation,
  StorageHold,
  StorageContract,
  StoragePayment,
  CheckInRecord,
  RentalRecord,
  ReturnCase,
  ActivityRecord,
  BusinessConfig,
  GoodsDeclaration,
  PricingQuote,
  PricingSnapshot,
  ReservationValidationResult,
  UnitType,
  DamageClassification,
  ReservationStatus,
  AccessCredential,
  RenewalRecord,
  MaintenanceTask,
  ReservedPeriod,
  FacilityTask
} from '../types/storageHub'
import type { User } from '../types'
import { FACILITIES, UNITS, USERS, TICKETS, type TicketItem } from '../data/demoDatabase'
import { transitionReservation } from '../domain/reservationFlow'

const STORAGE_KEY = 'storagehub:v3:canonical'

type StoredUser = (typeof USERS)[number]

/**
 * Roles for pre-provisioned company accounts are authoritative seed data in
 * the demo. Persisted client state may contain profile edits, but it must not
 * be able to promote an account by changing its role field.
 */
function normalizeUsers(value: unknown): StoredUser[] {
  if (!Array.isArray(value)) return USERS

  return value
    .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate && typeof candidate === 'object'))
    .map(candidate => {
      const id = typeof candidate.id === 'string' ? candidate.id : ''
      const seeded = USERS.find(user => user.id === id)
      if (!id || typeof candidate.email !== 'string' || typeof candidate.name !== 'string') return null

      return {
        ...candidate,
        id,
        name: candidate.name,
        email: candidate.email,
        // Unknown self-registered accounts are always customers. Company
        // roles can only come from the provisioned account record/backend.
        role: seeded?.role ?? 'customer',
        facility: seeded?.facility ?? candidate.facility,
      } as StoredUser
    })
    .filter((candidate): candidate is StoredUser => candidate !== null)
}

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  dimDivisor: 5000,
  gracePeriodDays: 0,
  lateFeeAmount: 25,
  defaultDepositRatio: 0.2,
  holdExpiryHours: 12
}

// 4 Standard Unit Types based on Metric DIM (m, m², m³)
export const UNIT_TYPES: UnitType[] = [
  {
    id: 'small',
    name: 'Small Storage',
    lengthM: 1.5,
    widthM: 1.5,
    heightM: 2.8,
    areaM2: 2.25,
    volumeM3: 6.3,
    pricePerM3: 14,
    monthlyPrice: 89,
    maxLoadKg: 600,
    descriptionVi: 'Phù hợp: 20–30 thùng hàng, 1 xe máy, vali đồ đạc cá nhân (~2.25 m²)',
    descriptionEn: 'Fits: 20–30 storage boxes, 1 motorbike, luggage & personal items (~2.25 m²)'
  },
  {
    id: 'medium',
    name: 'Medium Storage',
    lengthM: 3.0,
    widthM: 2.0,
    heightM: 2.5,
    areaM2: 6.0,
    volumeM3: 15.0,
    pricePerM3: 10,
    monthlyPrice: 150,
    maxLoadKg: 1200,
    descriptionVi: 'Phù hợp: 50–70 thùng hàng, đồ đạc gia đình, thiết bị văn phòng (~6.0 m²)',
    descriptionEn: 'Fits: 50–70 storage boxes, household furniture, office equipment (~6.0 m²)'
  },
  {
    id: 'large',
    name: 'Large Storage',
    lengthM: 4.0,
    widthM: 3.0,
    heightM: 2.5,
    areaM2: 12.0,
    volumeM3: 30.0,
    pricePerM3: 9,
    monthlyPrice: 270,
    maxLoadKg: 2400,
    descriptionVi: 'Phù hợp: 100–150 thùng hàng, đồ đạc chuyển nhà, tồn kho kinh doanh (~12.0 m²)',
    descriptionEn: 'Fits: 100–150 boxes, apartment relocation, e-commerce business inventory (~12.0 m²)'
  },
  {
    id: 'xlarge',
    name: 'Extra Large Commercial',
    lengthM: 6.0,
    widthM: 3.0,
    heightM: 2.5,
    areaM2: 18.0,
    volumeM3: 45.0,
    pricePerM3: 8,
    monthlyPrice: 360,
    maxLoadKg: 3600,
    descriptionVi: 'Phù hợp: Kho thương mại, pallet hàng hóa số lượng lớn, máy móc công nghiệp (~18.0 m²)',
    descriptionEn: 'Fits: Commercial pallets, large volume freight, machinery (~18.0 m²)'
  }
]

// Date Overlap Checking Utility
export function checkDateOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  if (!startA || !endA || !startB || !endB) return false
  const sA = new Date(startA).getTime()
  const eA = new Date(endA).getTime()
  const sB = new Date(startB).getTime()
  const eB = new Date(endB).getTime()
  return sA < eB && eA > sB
}

function toValidDate(value: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Ngày không hợp lệ: ${value}`)
  return parsed
}

function toDateInputValue(value: Date): string {
  return value.toISOString().split('T')[0]
}

function addCalendarMonths(value: string, months: number): string {
  const date = toValidDate(value)
  date.setMonth(date.getMonth() + months)
  return toDateInputValue(date)
}

function nextCalendarDay(value: string): string {
  const date = toValidDate(value)
  date.setDate(date.getDate() + 1)
  return toDateInputValue(date)
}

function assertFacilityManager(user: User, facilityId: string, facilityName: string) {
  if (user.role !== 'manager' && user.role !== 'admin') {
    throw new Error('Chỉ Facility Manager được thực hiện thao tác này.')
  }
  if (user.role === 'admin' || !user.facility || user.facility === 'All facilities') return
  if (user.facility !== facilityName && user.facility !== facilityId) {
    throw new Error('Bạn không có quyền thao tác dữ liệu của cơ sở khác.')
  }
}

function unitMatchesReservation(unit: StorageUnit, reservation: StorageReservation) {
  const expected = reservation.unitTypeId.toLowerCase().replace('xlarge', 'extra large')
  const actual = unit.type.toLowerCase()
  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual)
}

// Map demo facilities
const INITIAL_FACILITIES: Facility[] = FACILITIES.map(f => ({
  id: f.id,
  name: f.name,
  address: f.address,
  city: f.city,
  rating: f.rating,
  available: f.available,
  price: f.price,
  climate: f.climate,
  security: f.security,
  image: f.image,
  units: f.units,
  occupied: f.occupied,
  revenue: f.revenue,
  growth: f.growth,
  manager: f.manager,
  status: 'active',
  accessHours: '06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)',
  timezone: 'Asia/Ho_Chi_Minh'
}))

// Map demo units to typed StorageUnit using purely metric dimensions
const INITIAL_UNITS: StorageUnit[] = UNITS.map((u, idx) => {
  const facilityId = u.facility === 'Downtown Storage' ? 'fac-001' : 'fac-002'
  let lengthM = 1.5, widthM = 1.5, heightM = 2.8, volumeM3 = 6.3, price = 89, maxLoadKg = 600, areaM2 = 2.25
  if (u.type === 'Medium') {
    lengthM = 3.0; widthM = 2.0; heightM = 2.5; volumeM3 = 15.0; price = 150; maxLoadKg = 1200; areaM2 = 6.0
  } else if (u.type === 'Large') {
    lengthM = 4.0; widthM = 3.0; heightM = 2.5; volumeM3 = 30.0; price = 270; maxLoadKg = 2400; areaM2 = 12.0
  } else if (u.type === 'Extra Large') {
    lengthM = 6.0; widthM = 3.0; heightM = 2.5; volumeM3 = 45.0; price = 360; maxLoadKg = 3600; areaM2 = 18.0
  }

  // Customer test inventory: only one physical unit is locked; every other unit is bookable.
  const isReservedDemo = u.id === 'A-104'
  const demoRentalByUnit: Record<string, string> = {
    'B-208': 'RNT-2026-001',
    'C-301': 'RNT-INIT-PREV',
    'D-402': 'RNT-2026-002'
  }
  const isOccupiedDemo = Boolean(demoRentalByUnit[u.id])
  const reservedPeriods: ReservedPeriod[] = []
  if (u.id === 'A-104') {
    reservedPeriods.push({
      reservationId: 'RSV-2048',
      customerName: 'Nguyen Minh Anh',
      startDate: '2026-09-20',
      endDate: '2027-03-20'
    })
  }

  return {
    id: u.id,
    code: u.id,
    facilityId,
    facilityName: u.facility,
    floor: u.floor,
    zone: `Khu ${String.fromCharCode(65 + (idx % 4))}`,
    type: u.type as any,
    areaM2,
    dimensions: { lengthM, widthM, heightM },
    doorDimensions: { widthM: 1.1, heightM: 2.2 },
    volumeM3,
    maxLoadKg,
    allowedGoods: ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
    prohibitedGoods: ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
    price,
    deposit: price,
    climate: u.climate,
    status: isOccupiedDemo ? 'occupied' : isReservedDemo ? 'reserved' : 'available',
    reservedPeriods,
    nextAvailableDate: u.id === 'A-104' ? '2027-03-21' : u.id === 'B-208' ? '2027-01-13' : undefined,
    currentRentalId: demoRentalByUnit[u.id],
    version: 1
  }
})

// Initial reservations demonstrating the canonical lifecycle
const INITIAL_RESERVATIONS: StorageReservation[] = [
  {
    id: 'RSV-2048',
    customerId: 'cust-demo-1',
    customerName: 'Nguyen Minh Anh',
    customerEmail: 'anh.nguyen@outlook.com',
    customerPhone: '090 123 4567',
    identityId: '079203001234',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    unitId: 'A-104',
    unitTypeId: 'small',
    unitTypeName: 'Small Storage',
    assignedUnitId: 'A-104',
    rentalMonths: 6,
    startDate: '2026-09-20',
    endDate: '2027-03-20',
    moveInDate: '2026-09-20',
    status: 'READY_FOR_CHECKIN',
    approvalType: 'AUTO',
    reservationDepositAmount: 36, // 20% of (89 + 89)
    securityDepositAmount: 89,    // 1-month rent
    depositConvertedAt: '2026-09-17T10:00:00Z',
    remainingAmount: 0,
    firstMonthRent: 89,
    totalInitialAmount: 178,
    largestItemDimensionsCm: { lengthCm: 80, widthCm: 60, heightCm: 70 },
    goods: {
      category: 'Tài liệu và đồ gia dụng',
      packageCount: 12,
      lengthCm: 80,
      widthCm: 60,
      heightCm: 70,
      weightKg: 180,
      dimWeightKg: 67,
      material: 'Giấy, nhựa, vải',
      condition: '12 kiện nguyên niêm phong, khô ráo',
      fragile: false,
      notes: 'Thùng carton tiêu chuẩn niêm phong băng dính'
    },
    quote: {
      quoteId: 'QUO-2048',
      unitId: 'A-104',
      facilityId: 'fac-001',
      baseMonthlyPrice: 89,
      depositAmount: 89,
      dimSurcharge: 0,
      totalFirstPayment: 178,
      dimWeightKg: 67,
      actualWeightKg: 180,
      billableWeightKg: 180,
      dimDivisor: 5000,
      quotedAt: '2026-09-17T08:30:00Z',
      expiresAt: '2026-09-21T08:30:00Z'
    },
    payment: {
      amount: 178,
      status: 'paid',
      method: 'Chuyển khoản VietQR',
      transactionId: 'VNPAY-204899',
      paidAt: '2026-09-17T10:00:00Z'
    },
    contractId: 'CTR-2048',
    appointmentDate: '2026-09-20',
    appointmentTime: '11:00 AM',
    generatedAccessPin: '4921#',
    expiresAt: '2026-09-21T18:00:00Z',
    evidence: ['EV-2048-01 · Ảnh hàng hóa lúc khai báo'],
    createdAt: '2026-09-17T08:30:00Z'
  },
  {
    id: 'RSV-2049',
    customerId: 'cust-demo-2',
    customerName: 'Hoang Van Bach',
    customerEmail: 'bach.hoang@gmail.com',
    customerPhone: '091 999 8811',
    identityId: '079198004567',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    unitId: '',
    unitTypeId: 'small',
    unitTypeName: 'Small Storage',
    assignedUnitId: undefined, // Unassigned - Manager needs to assign!
    rentalMonths: 3,
    startDate: '2026-09-22',
    endDate: '2026-12-22',
    moveInDate: '2026-09-22',
    status: 'DEPOSIT_PAID',
    approvalType: 'AUTO',
    reservationDepositAmount: 36,
    securityDepositAmount: 89,
    remainingAmount: 142,
    firstMonthRent: 89,
    totalInitialAmount: 178,
    paymentExpiresAt: new Date(Date.now() + 11 * 60 * 1000).toISOString(),
    largestItemDimensionsCm: { lengthCm: 60, widthCm: 50, heightCm: 50 },
    goods: {
      category: 'Tài liệu và đồ dùng cá nhân',
      packageCount: 6,
      lengthCm: 60,
      widthCm: 50,
      heightCm: 50,
      weightKg: 90,
      dimWeightKg: 36,
      material: 'Giấy, nhựa',
      condition: '6 kiện niêm phong tốt',
      fragile: false
    },
    quote: {
      quoteId: 'QUO-2049',
      unitId: '',
      facilityId: 'fac-001',
      baseMonthlyPrice: 89,
      depositAmount: 89,
      dimSurcharge: 0,
      totalFirstPayment: 178,
      dimWeightKg: 36,
      actualWeightKg: 90,
      billableWeightKg: 90,
      dimDivisor: 5000,
      quotedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 11 * 60 * 1000).toISOString()
    },
    payment: {
      amount: 36,
      status: 'paid',
      method: 'Cọc giữ chỗ qua VietQR',
      transactionId: 'TX-DEP-2049',
      paidAt: new Date().toISOString()
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    evidence: ['RSV-2049 · Đã cọc giữ chỗ 20%, chờ Facility Manager phân kho'],
    createdAt: new Date().toISOString()
  }
]

export function normalizeCheckin(c: any): CheckInRecord {
  const l = Number(c?.actualMeasurements?.lengthCm) || 0
  const w = Number(c?.actualMeasurements?.widthCm) || 0
  const h = Number(c?.actualMeasurements?.heightCm) || 0
  const computedVol = Math.round(((l * w * h) / 1_000_000) * 1000) / 1000
  const actualVolumeM3 = typeof c?.actualMeasurements?.actualVolumeM3 === 'number'
    ? c.actualMeasurements.actualVolumeM3
    : computedVol

  return {
    id: c?.id || `CHK-${Date.now()}`,
    holdId: c?.holdId || '',
    unitId: c?.unitId || '',
    facilityId: c?.facilityId || 'fac-001',
    customerId: c?.customerId || '',
    customerName: c?.customerName || 'Khách hàng',
    staffId: c?.staffId || 'unassigned',
    staffName: c?.staffName || 'Nhân viên ca trực',
    scheduledDate: c?.scheduledDate || '',
    scheduledTime: c?.scheduledTime || '',
    completedAt: c?.completedAt,
    status: c?.status || 'scheduled',
    checklist: {
      identityVerified: Boolean(c?.checklist?.identityVerified),
      termsAccepted: Boolean(c?.checklist?.termsAccepted),
      paymentConfirmed: Boolean(c?.checklist?.paymentConfirmed),
      unitWalkthrough: Boolean(c?.checklist?.unitWalkthrough),
      accessCodeIssued: Boolean(c?.checklist?.accessCodeIssued),
    },
    actualMeasurements: {
      lengthCm: l,
      widthCm: w,
      heightCm: h,
      weightKg: Number(c?.actualMeasurements?.weightKg) || 0,
      actualVolumeM3,
      dimWeightKg: c?.actualMeasurements?.dimWeightKg,
      varianceAccepted: Boolean(c?.actualMeasurements?.varianceAccepted ?? false),
      varianceNotes: c?.actualMeasurements?.varianceNotes,
    },
    initialCondition: c?.initialCondition || '',
    initialConditionEn: c?.initialConditionEn,
    evidencePhotos: Array.isArray(c?.evidencePhotos) ? c.evidencePhotos : [],
    accessCodeIssued: c?.accessCodeIssued,
    preparedAccessPin: c?.preparedAccessPin,
    accessPreparedAt: c?.accessPreparedAt,
    customerConfirmationTimestamp: c?.customerConfirmationTimestamp,
  }
}

const INITIAL_CHECKINS: CheckInRecord[] = [
  {
    id: 'CHK-301',
    holdId: 'RSV-2048',
    unitId: 'A-104',
    facilityId: 'fac-001',
    customerId: 'cust-demo-1',
    customerName: 'Nguyen Minh Anh',
    staffId: 'demo-staff',
    staffName: 'Demo Staff',
    scheduledDate: '2026-09-20',
    scheduledTime: '11:00 AM',
    status: 'scheduled',
    checklist: {
      identityVerified: true,
      termsAccepted: true,
      paymentConfirmed: true,
      unitWalkthrough: false,
      accessCodeIssued: false
    },
    actualMeasurements: {
      lengthCm: 80,
      widthCm: 60,
      heightCm: 70,
      weightKg: 180,
      actualVolumeM3: 0.336,
      dimWeightKg: 67,
      varianceAccepted: false
    },
    initialCondition: 'Kho sạch, đèn và khóa điện tử hoạt động tốt. 12 kiện hàng dán kín niêm phong.',
    initialConditionEn: 'The unit is clean; lighting and the electronic lock work properly. All 12 packages are sealed.',
    evidencePhotos: ['EV-2048-01 · Ảnh hàng hóa khai báo']
  }
]

const demoDateOffset = (days: number) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const RENEWAL_TEST_RENTALS: RentalRecord[] = [
  {
    id: 'RNT-TEST-RENEW-BEFORE-2D',
    holdId: 'RSV-TEST-RENEW-BEFORE-2D',
    unitId: 'B-209',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    customerId: 'demo-customer',
    customerName: 'Demo Customer',
    customerEmail: 'customer@storagehub.demo',
    customerPhone: '+84 908 123 456',
    unitType: 'Medium Storage',
    areaM2: 6,
    volumeM3: 15,
    startDate: demoDateOffset(-28),
    endDate: demoDateOffset(2),
    nextDue: demoDateOffset(2),
    monthlyRate: 149,
    deposit: 149,
    securityDeposit: 149,
    status: 'active',
    paymentStatus: 'paid',
    autoRenew: false,
    gateCode: '2202#',
    initialCondition: 'Dữ liệu kiểm thử: hợp đồng còn đúng 2 ngày trước khi hết hạn.',
    evidencePhotos: ['TEST · Gia hạn trước hạn 2 ngày']
  },
  {
    id: 'RNT-TEST-RENEW-AFTER-2D',
    holdId: 'RSV-TEST-RENEW-AFTER-2D',
    unitId: 'B-210',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    customerId: 'demo-customer',
    customerName: 'Demo Customer',
    customerEmail: 'customer@storagehub.demo',
    customerPhone: '+84 908 123 456',
    unitType: 'Medium Storage',
    areaM2: 6,
    volumeM3: 15,
    startDate: demoDateOffset(-32),
    endDate: demoDateOffset(-2),
    nextDue: demoDateOffset(-2),
    monthlyRate: 149,
    deposit: 149,
    securityDeposit: 149,
    status: 'active',
    paymentStatus: 'overdue',
    autoRenew: false,
    gateCode: '2200#',
    initialCondition: 'Dữ liệu kiểm thử: hợp đồng đã hết hạn đúng 2 ngày.',
    evidencePhotos: ['TEST · Gia hạn muộn sau hạn 2 ngày']
  },
  {
    id: 'RNT-TEST-RETURN-DEDUCT',
    holdId: 'RSV-TEST-RETURN-DEDUCT',
    unitId: 'A-105',
    facilityId: 'fac-001', facilityName: 'Downtown Storage',
    customerId: 'demo-customer', customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456',
    unitType: 'Small Storage', areaM2: 2.25, volumeM3: 6.3,
    startDate: demoDateOffset(-32), endDate: demoDateOffset(-2), nextDue: demoDateOffset(-2),
    monthlyRate: 89, deposit: 89, securityDeposit: 89,
    status: 'return_requested', paymentStatus: 'overdue', autoRenew: false, gateCode: '5105#',
    initialCondition: 'Dữ liệu kiểm thử trả kho: quá hạn 2 ngày, phí nhỏ hơn tiền đảm bảo.', evidencePhotos: ['TEST · Trả kho quá hạn và khấu trừ trong cọc']
  },
  {
    id: 'RNT-TEST-RETURN-EXCESS',
    holdId: 'RSV-TEST-RETURN-EXCESS',
    unitId: 'A-106',
    facilityId: 'fac-001', facilityName: 'Downtown Storage',
    customerId: 'demo-customer', customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456',
    unitType: 'Small Storage', areaM2: 2.25, volumeM3: 6.3,
    startDate: demoDateOffset(-95), endDate: demoDateOffset(-65), nextDue: demoDateOffset(-65),
    monthlyRate: 89, deposit: 89, securityDeposit: 89,
    status: 'return_requested', paymentStatus: 'overdue', autoRenew: false, gateCode: '5106#',
    initialCondition: 'Dữ liệu kiểm thử trả kho: phí quá hạn vượt tiền đảm bảo.', evidencePhotos: ['TEST · Trả kho quá hạn vượt cọc']
  }
]

const mergeRenewalTestRentals = (rentals: RentalRecord[]) => [
  ...RENEWAL_TEST_RENTALS.filter(sample => !rentals.some(rental => rental.id === sample.id)),
  ...rentals
]

const INITIAL_RENTALS: RentalRecord[] = [
  ...RENEWAL_TEST_RENTALS,
  {
    id: 'RNT-INIT-PREV',
    holdId: 'RSV-INIT-PREV',
    unitId: 'C-301',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    customerId: 'cust-ha-pham',
    customerName: 'Pham Thu Ha',
    customerEmail: 'ha.pham@gmail.com',
    customerPhone: '093 555 0128',
    unitType: 'Large Storage',
    areaM2: 12.0,
    volumeM3: 30.0,
    startDate: 'Mar 18, 2026',
    endDate: 'Sep 18, 2026',
    nextDue: 'Sep 18, 2026',
    monthlyRate: 269,
    deposit: 269,
    securityDeposit: 269,
    status: 'return_requested',
    paymentStatus: 'paid',
    autoRenew: false,
    gateCode: '7318#',
    initialCondition: 'Kho sạch, tường và khóa nguyên vẹn; 6 kiện đồ gia dụng gỗ và vải.',
    evidencePhotos: ['EV-IN-118 · 6 ảnh hiện trạng lúc nhận kho']
  },
  {
    id: 'RNT-2026-001',
    holdId: 'RSV-INIT-001',
    unitId: 'B-208',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    customerId: 'demo-customer',
    customerName: 'Demo Customer',
    customerEmail: 'customer@storagehub.demo',
    customerPhone: '+84 908 123 456',
    unitType: 'Medium Storage',
    areaM2: 6.0,
    volumeM3: 15.0,
    startDate: 'Jan 12, 2026',
    endDate: 'Jan 12, 2027',
    nextDue: 'Oct 12, 2026',
    monthlyRate: 149,
    deposit: 149,
    securityDeposit: 149,
    status: 'active',
    paymentStatus: 'paid',
    autoRenew: true,
    gateCode: '4921#',
    initialCondition: 'Sàn sạch, ổ khóa thông minh đã test hoạt động, không có vết nứt tường.',
    evidencePhotos: ['EV-INIT-B208-01 · Biên bản bàn giao kho ban đầu']
  },
  {
    id: 'RNT-2026-002',
    holdId: 'RSV-INIT-002',
    unitId: 'D-402',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    customerId: 'demo-customer-2',
    customerName: 'Saigon Logistics Co.',
    customerEmail: 'contact@sg-logistics.vn',
    customerPhone: '+84 28 3822 9999',
    unitType: 'Extra Large Commercial',
    areaM2: 18.0,
    volumeM3: 45.0,
    startDate: 'May 01, 2026',
    endDate: 'May 01, 2027',
    nextDue: 'Oct 01, 2026',
    monthlyRate: 349,
    deposit: 349,
    securityDeposit: 349,
    status: 'active',
    paymentStatus: 'paid',
    autoRenew: true,
    gateCode: '9004#',
    initialCondition: 'Kho pallet thương mại, cửa cuốn cơ điện hoạt động bình thường.',
    evidencePhotos: ['EV-INIT-D402-01 · Biên bản bàn giao kho pallet']
  }
]

const RETURN_TEST_CASES: ReturnCase[] = [
  { id: 'RET-TEST-DEDUCT', rentalId: 'RNT-TEST-RETURN-DEDUCT', unitId: 'A-105', facilityId: 'fac-001', facilityName: 'Downtown Storage', customerId: 'demo-customer', customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456', requestedAt: new Date().toISOString(), scheduledDate: demoDateOffset(0), status: 'requested', initialConditionSnapshot: 'Kho sạch, khóa và tường nguyên vẹn.', packageCount: 4, initialWeightKg: 40, damageFee: 0, outstandingFee: 0, depositAmount: 89, netRefundAmount: 89, evidence: ['TEST · Khấu trừ phí trễ trong tiền đảm bảo'], customerConfirmed: false },
  { id: 'RET-TEST-EXCESS', rentalId: 'RNT-TEST-RETURN-EXCESS', unitId: 'A-106', facilityId: 'fac-001', facilityName: 'Downtown Storage', customerId: 'demo-customer', customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456', requestedAt: new Date().toISOString(), scheduledDate: demoDateOffset(0), status: 'requested', initialConditionSnapshot: 'Kho sạch, khóa và tường nguyên vẹn.', packageCount: 4, initialWeightKg: 40, damageFee: 0, outstandingFee: 0, depositAmount: 89, netRefundAmount: 89, evidence: ['TEST · Phí trễ vượt tiền đảm bảo'], customerConfirmed: false }
]

const mergeReturnTestCases = (returns: ReturnCase[]) => [...RETURN_TEST_CASES.filter(sample => !returns.some(item => item.id === sample.id)), ...returns]

const INITIAL_RETURNS: ReturnCase[] = [
  ...RETURN_TEST_CASES,
  {
    id: 'RET-118',
    rentalId: 'RNT-INIT-PREV',
    unitId: 'C-301',
    facilityId: 'fac-001',
    facilityName: 'Downtown Storage',
    customerId: 'cust-ha-pham',
    customerName: 'Pham Thu Ha',
    customerEmail: 'ha.pham@gmail.com',
    customerPhone: '093 555 0128',
    requestedAt: '2026-09-15T09:00:00Z',
    scheduledDate: '2026-09-18',
    status: 'scheduled',
    initialConditionSnapshot: 'Kho sạch, tường và khóa nguyên vẹn; 6 kiện đồ gia dụng gỗ và vải.',
    initialConditionSnapshotEn: 'The unit was clean with intact walls and lock; six packages of wooden and fabric household goods.',
    packageCount: 6,
    initialWeightKg: 132,
    damageFee: 0,
    outstandingFee: 0,
    depositAmount: 269, // Security deposit
    netRefundAmount: 269,
    evidence: ['EV-IN-118 · 6 ảnh hiện trạng lúc nhận kho'],
    customerConfirmed: false
  }
]

const INITIAL_CONTRACTS: StorageContract[] = [
  {
    id: 'CTR-2048',
    contractNumber: 'HD-2026-001',
    reservationId: 'RSV-2048',
    customerId: 'cust-demo-1',
    unitId: 'A-104',
    signedAt: '2026-09-17',
    startDate: '2026-09-20',
    endDate: '2027-03-20',
    monthlyRent: 89,
    securityDeposit: 89,
    scannedFileUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...',
    scannedFileName: 'HopDong_HD-2026-001_signed.pdf',
    uploadedAt: '2026-09-17T09:45:00Z',
    uploadedBy: 'demo-staff',
    status: 'SIGNED'
  }
]

const INITIAL_ACTIVITIES: ActivityRecord[] = [
  {
    id: 'act-101',
    action: 'POLICY_UPDATE',
    actorId: 'demo-admin',
    actorName: 'Demo Administrator',
    actorRole: 'admin',
    facilityId: 'fac-001',
    entityType: 'policy',
    entityId: 'sec-policy-01',
    notes: 'Cập nhật chính sách tỷ lệ đặt cọc 20% và chu kỳ đổi mã PIN an ninh.',
    timestamp: '2026-09-18 11:58:14'
  },
  {
    id: 'act-102',
    action: 'RESERVATION_CREATED',
    actorId: 'cust-demo-1',
    actorName: 'Nguyen Minh Anh',
    actorRole: 'customer',
    facilityId: 'fac-001',
    entityType: 'hold',
    entityId: 'RSV-2048',
    notes: 'Khách hàng đặt cỡ kho Small Storage, cọc giữ chỗ 20% ($36) thành công.',
    timestamp: '2026-09-17 08:30:00'
  },
  {
    id: 'act-103',
    action: 'UNIT_ASSIGNED',
    actorId: 'demo-manager',
    actorName: 'Demo Manager',
    actorRole: 'manager',
    facilityId: 'fac-001',
    entityType: 'unit',
    entityId: 'A-104',
    notes: 'Facility Manager phân kho A-104 cho đơn RSV-2048 (20/09/2026 - 20/03/2027).',
    timestamp: '2026-09-17 09:00:00'
  }
]

interface StorageHubState {
  users: StoredUser[]
  facilities: Facility[]
  units: StorageUnit[]
  holds: StorageReservation[] // holds is alias for reservations
  contracts: StorageContract[]
  payments: StoragePayment[]
  checkins: CheckInRecord[]
  rentals: RentalRecord[]
  returns: ReturnCase[]
  renewals: RenewalRecord[]
  maintenanceTasks: MaintenanceTask[]
  staffTasks: FacilityTask[]
  accessCredentials: AccessCredential[]
  activities: ActivityRecord[]
  tickets: TicketItem[]
  config: BusinessConfig
}

interface StorageHubContextValue extends StorageHubState {
  unitTypes: UnitType[]
  // Pricing & DIM calculation
  calculateDIMAndQuote: (
    unit: StorageUnit,
    goods: {
      lengthCm: number
      widthCm: number
      heightCm: number
      weightKg: number
      packageCount: number
    }
  ) => PricingQuote
  // Customer reservation & hold lifecycle actions
  payStorageHold: (holdId: string, paymentMethod?: string) => void
  verifyHoldEmail: (holdId: string, token: string) => boolean
  resendHoldEmail: (holdId: string) => string
  scheduleCheckIn: (holdId: string, appointmentDate: string, appointmentTime: string) => void
  // Actions
  validateAndCreateReservation: (params: {
    customer: User
    unitTypeId: string
    facilityId: string
    goods: GoodsDeclaration
    rentalMonths: number
    moveInDate: string
    identityId: string
    customerPhone: string
    customerAddress?: string
    appointmentTime: string
    largestItemDimensionsCm?: { lengthCm: number; widthCm: number; heightCm: number }
  }) => ReservationValidationResult
  approveReservation: (reservationId: string, reviewer: User) => void
  assignUnitToHold: (reservationId: string, unitId: string, managerUser: User) => void
  cancelReservation: (reservationId: string, user: User, reason?: string) => void
  archiveReservationHistory: (reservationId: string, customer: User) => void
  archiveRentalHistory: (rentalId: string, customer: User) => void
  archiveContractHistory: (contractId: string, customer: User) => void
  expireReservation: (reservationId: string, reason?: 'NO_SHOW' | 'PAYMENT_EXPIRED') => void
  signPaperContract: (params: {
    holdId: string
    staffUser: User
    identityVerified: boolean
    contractNumber: string
    signedAt: string
    startDate: string
    endDate: string
    scannedFileUrl: string
    scannedFileName: string
  }) => void
  recordRemainingPayment: (
    reservationId: string,
    staffUser: User,
    paymentDetails: {
      amount: number
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY'
      transactionReference: string
      proofImage?: string
    }
  ) => void
  payRemainingBalance: (holdId: string, staffUser: User, paymentMethod: string) => void
  completeCheckIn: (params: {
    holdId: string
    staffUser: User
    checklist: CheckInRecord['checklist']
    actualMeasurements: CheckInRecord['actualMeasurements']
    initialCondition: string
    evidencePhotos: string[]
    goodsHandover: NonNullable<CheckInRecord['goodsHandover']>
    handedOverItems: string[]
  }) => RentalRecord
  confirmUnitReceipt: (rentalId: string, customer: User) => void
  requestRenewal: (rentalId: string, renewalMonths: number, customer: User) => RenewalRecord
  updateRenewalRequest: (renewalId: string, renewalMonths: number, customer: User) => void
  cancelRenewalRequest: (renewalId: string, customer: User) => void
  approveRenewal: (renewalId: string, managerUser: User) => void
  rejectRenewal: (renewalId: string, managerUser: User, reason: string) => void
  payRenewal: (renewalId: string, customer: User, paymentMethod: 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionId: string, termsAccepted: boolean, appointmentDate: string, appointmentTime: string) => void
  completeRenewalAtFacility: (params: {
    renewalId: string
    staffUser: User
    transactionReference: string
    identityVerified: boolean
    unitAndTermsVerified: boolean
    contractNumber: string
    signedAt: string
    scannedFileUrl: string
    scannedFileName: string
  }) => void
  expireRenewalPayment: (renewalId: string) => void
  requestReturn: (rentalId: string, scheduledDate: string, customer: User, reason?: string) => ReturnCase
  completeReturnInspection: (params: {
    returnId: string
    staffUser: User
    inventoryMatch: 'match' | 'missing' | 'excess'
    damageClassification: DamageClassification
    damageFee: number
    cleaningFee: number
    lostItemFee: number
    overdueFee: number
    outstandingFee: number
    staffNotes: string
    evidencePhotos: string[]
    returnedItems: { key: boolean; card: boolean; lock: boolean }
  }) => void
  confirmReturnSettlement: (returnId: string, customer: User, decision: 'accepted' | 'disputed', note?: string) => void
  payReturnBalance: (returnId: string, customer: User, paymentMethod: 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionReference: string) => void
  completeReturnRefund: (returnId: string, staffUser: User, transactionReference: string) => void
  reviewReturnDispute: (returnId: string, manager: User, resolutionNote?: string) => void
  createMaintenanceTask: (unitId: string, reason: string, staffUser?: User) => MaintenanceTask
  completeMaintenanceTask: (taskId: string, managerUser: User) => void
  releaseMaintenanceUnit: (unitId: string, staffUser: User) => void
  updateUnitStatus: (unitId: string, status: 'available' | 'maintenance', manager: User, reason?: string) => void
  recordRentalPayment: (rentalId: string, amount: number, paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionReference: string, manager: User) => void
  applyRentalLateFee: (rentalId: string, amount: number, manager: User) => void
  waiveRentalLateFee: (rentalId: string, manager: User) => void
  setRentalOverlock: (rentalId: string, overlocked: boolean, manager: User) => void
  sendDelinquencyReminder: (rentalId: string, manager: User) => void
  createFacilityTask: (task: Omit<FacilityTask, 'id' | 'createdAt' | 'status'>, manager: User) => FacilityTask
  updateFacilityTask: (taskId: string, updates: Partial<Pick<FacilityTask, 'assignedStaffId' | 'assignedStaffName' | 'dueAt' | 'priority' | 'status' | 'notes'>>, manager: User) => void
  updateBusinessConfig: (newConfig: Partial<BusinessConfig>, actor: User) => void
  respondSupportTicket: (ticketId: string, replyText: string, status: TicketItem['status'], staffUser: User) => void
  replySupportTicket: (ticketId: string, replyText: string, customer: User) => void
  createSupportTicket: (ticket: Omit<TicketItem, 'id' | 'created' | 'messages'>, initialMessage: string) => void
  registerCustomer: (params: { name: string; email: string; phone?: string }) => User
  resetToDemoData: () => void
}

const StorageHubContext = createContext<StorageHubContextValue | null>(null)

const normalizeReservationPricing = (hold: StorageReservation): StorageReservation => {
  const monthlyRent = hold.firstMonthRent || hold.quote.baseMonthlyPrice
  const rentalTermAmount = monthlyRent * hold.rentalMonths
  const securityDepositAmount = hold.securityDepositAmount || monthlyRent
  const expectedTotal = rentalTermAmount + securityDepositAmount
  if (hold.remainingAmount <= 0 || Math.abs((hold.totalInitialAmount || 0) - expectedTotal) <= 0.01) return hold

  const calculatedBookingDeposit = Math.round(rentalTermAmount * 0.2 * 100) / 100
  const bookingDeposit = hold.payment.status === 'paid' ? hold.reservationDepositAmount : calculatedBookingDeposit
  return {
    ...hold,
    reservationDepositAmount: bookingDeposit,
    securityDepositAmount,
    remainingAmount: rentalTermAmount - bookingDeposit + securityDepositAmount,
    totalInitialAmount: rentalTermAmount + securityDepositAmount,
    quote: {
      ...hold.quote,
      depositAmount: securityDepositAmount,
      totalFirstPayment: rentalTermAmount + securityDepositAmount
    }
  }
}

const reconcileReservationCheckins = (holds: StorageReservation[], records: CheckInRecord[]): CheckInRecord[] => {
  const normalized = records.map(normalizeCheckin)
  const existingHoldIds = new Set(normalized.map(record => record.holdId))
  const recovered = holds
    .filter(hold => hold.assignedUnitId && hold.appointmentDate && hold.appointmentTime && !existingHoldIds.has(hold.id) && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status))
    .map(hold => normalizeCheckin({
      id: `CHK-${hold.id}`,
      holdId: hold.id,
      unitId: hold.assignedUnitId!,
      facilityId: hold.facilityId,
      customerId: hold.customerId,
      customerName: hold.customerName,
      staffId: '',
      staffName: 'Chưa phân công',
      scheduledDate: hold.appointmentDate!,
      scheduledTime: hold.appointmentTime!,
      status: 'scheduled',
      checklist: { identityVerified: false, termsAccepted: false, paymentConfirmed: hold.payment.status === 'paid', unitWalkthrough: false, accessCodeIssued: false },
      actualMeasurements: { lengthCm: hold.goods.lengthCm, widthCm: hold.goods.widthCm, heightCm: hold.goods.heightCm, weightKg: hold.goods.weightKg, actualVolumeM3: (hold.goods.lengthCm * hold.goods.widthCm * hold.goods.heightCm * hold.goods.packageCount) / 1_000_000, varianceAccepted: false },
      initialCondition: '',
      evidencePhotos: []
    }))
  return [...recovered, ...normalized]
}

export function StorageHubProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StorageHubState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const normalizedHolds = Array.isArray(parsed.holds) ? parsed.holds.map((hold: StorageReservation) => normalizeReservationPricing({ ...hold, appointmentDate: hold.appointmentDate || hold.moveInDate, appointmentTime: hold.appointmentTime || '09:00' })) : INITIAL_RESERVATIONS
        return {
          ...parsed,
          users: normalizeUsers(parsed.users),
          units: Array.isArray(parsed.units) && parsed.units.length >= INITIAL_UNITS.length ? parsed.units : INITIAL_UNITS,
          holds: normalizedHolds,
          contracts: parsed.contracts || INITIAL_CONTRACTS,
          payments: parsed.payments || [],
          renewals: Array.isArray(parsed.renewals) ? parsed.renewals.map((renewal: RenewalRecord) => ({ ...renewal, renewalMonths: renewal.renewalMonths || 1 })) : [],
          maintenanceTasks: parsed.maintenanceTasks || [],
          staffTasks: parsed.staffTasks || [],
          accessCredentials: parsed.accessCredentials || [],
          checkins: reconcileReservationCheckins(normalizedHolds, Array.isArray(parsed.checkins) ? parsed.checkins : INITIAL_CHECKINS),
          rentals: Array.isArray(parsed.rentals) ? mergeRenewalTestRentals(parsed.rentals) : INITIAL_RENTALS,
          returns: Array.isArray(parsed.returns) ? mergeReturnTestCases(parsed.returns) : INITIAL_RETURNS,
          activities: parsed.activities || INITIAL_ACTIVITIES,
          tickets: parsed.tickets || TICKETS,
          config: parsed.config || DEFAULT_BUSINESS_CONFIG
        }
      }
    } catch (e) {
      console.error('Failed to load storageHub state from localStorage', e)
    }
    return {
      users: USERS,
      facilities: INITIAL_FACILITIES,
      units: INITIAL_UNITS,
      holds: INITIAL_RESERVATIONS,
      contracts: INITIAL_CONTRACTS,
      payments: [],
      checkins: INITIAL_CHECKINS,
      rentals: INITIAL_RENTALS,
      returns: INITIAL_RETURNS,
      renewals: [],
      maintenanceTasks: [],
      staffTasks: [],
      accessCredentials: [],
      activities: INITIAL_ACTIVITIES,
      tickets: TICKETS,
      config: DEFAULT_BUSINESS_CONFIG
    }
  })

  // Reconcile older locally saved demo data with the return lifecycle introduced later.
  useEffect(() => {
    setState(prev => {
      const inactiveRentals = prev.rentals.filter(rental => rental.status === 'completed')
      if (!inactiveRentals.length) return prev
      const inactiveRentalIds = new Set(inactiveRentals.map(rental => rental.id))
      const inactiveUnitIds = new Set(inactiveRentals.map(rental => rental.unitId))
      return {
        ...prev,
        rentals: prev.rentals.map(rental => inactiveRentalIds.has(rental.id) ? { ...rental, gateCode: '', accessRevokedAt: rental.accessRevokedAt || rental.checkedOutAt || new Date().toISOString() } : rental),
        holds: prev.holds.map(hold => inactiveRentals.some(rental => rental.holdId === hold.id) ? { ...hold, generatedAccessPin: undefined } : hold),
        units: prev.units.map(unit => {
          if (!inactiveUnitIds.has(unit.id) || prev.rentals.some(rental => rental.unitId === unit.id && rental.status === 'active')) return unit
          const completedReturn = prev.returns.find(item => item.unitId === unit.id && ['refund_pending', 'completed'].includes(item.status))
          const needsMaintenance = completedReturn?.proposedUnitStatus === 'maintenance' || prev.maintenanceTasks.some(task => task.unitId === unit.id && task.status !== 'completed')
          return { ...unit, status: needsMaintenance ? 'maintenance' : 'available', currentRentalId: undefined, nextAvailableDate: undefined, reservedPeriods: (unit.reservedPeriods || []).filter(period => !inactiveRentals.some(rental => rental.holdId === period.reservationId)) }
        }),
        accessCredentials: prev.accessCredentials.map(credential => credential.rentalId && inactiveRentalIds.has(credential.rentalId) ? { ...credential, status: 'REVOKED' as const, revokedAt: credential.revokedAt || new Date().toISOString() } : credential)
      }
    })
  }, [])

  // Save to localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to persist storageHub state', e)
    }
  }, [state])

  // Sync state across browser tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          const holds = Array.isArray(parsed.holds) ? parsed.holds.map(normalizeReservationPricing) : []
          const checkins = reconcileReservationCheckins(holds, Array.isArray(parsed.checkins) ? parsed.checkins : [])
          setState({ ...parsed, users: normalizeUsers(parsed.users), holds, checkins })
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // 1. Customer: Validate and create reservation with 20% Reservation Deposit
  const validateAndCreateReservation = (params: {
    customer: User
    unitTypeId: string
    facilityId: string
    goods: GoodsDeclaration
    rentalMonths: number
    moveInDate: string
    identityId: string
    customerPhone: string
    customerAddress?: string
    appointmentTime: string
    largestItemDimensionsCm?: { lengthCm: number; widthCm: number; heightCm: number }
  }): ReservationValidationResult => {
    const unitType = UNIT_TYPES.find(ut => ut.id === params.unitTypeId) || UNIT_TYPES[1]
    const now = new Date()
    const nowTime = now.getTime()

    // Calculate end date based on moveInDate and rentalMonths
    const startDate = params.moveInDate
    const startObj = new Date(startDate)
    const endObj = new Date(startObj)
    endObj.setMonth(endObj.getMonth() + params.rentalMonths)
    const endDate = endObj.toISOString().split('T')[0]

    // Availability check: check units of this type in facility that don't have overlapping reservedPeriods or rentals
    const candidateUnits = state.units.filter(
      u => u.facilityId === params.facilityId && u.type.toLowerCase().includes(unitType.name.split(' ')[0].toLowerCase()) && u.status !== 'maintenance'
    )

    const dateAvailableUnits = candidateUnits.filter(u => {
      // Check if any reservation or rental overlaps on this unit
      const overlapsReservation = state.holds.some(
        h => h.assignedUnitId === u.id && ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) &&
             checkDateOverlap(startDate, endDate, h.startDate, h.endDate)
      )
      const overlapsRental = state.rentals.some(
        r => r.unitId === u.id && r.status === 'active' &&
             checkDateOverlap(startDate, endDate, r.startDate, r.endDate)
      )
      return !overlapsReservation && !overlapsRental
    })
    const unassignedCapacityHolds = state.holds.filter(hold =>
      !hold.assignedUnitId &&
      hold.facilityId === params.facilityId &&
      hold.unitTypeId === unitType.id &&
      (hold.status === 'DEPOSIT_PAID' || (['awaiting_email', 'awaiting_review', 'awaiting_payment'].includes(hold.status) && Boolean(hold.paymentExpiresAt) && new Date(hold.paymentExpiresAt!).getTime() > nowTime)) &&
      checkDateOverlap(startDate, endDate, hold.startDate, hold.endDate)
    )
    const availableUnit = dateAvailableUnits[unassignedCapacityHolds.length]

    if (!availableUnit) {
      return {
        outcome: 'HARD_VIOLATION',
        rejectionReason: 'Cơ sở hiện không còn kho trống cho loại kích thước này trong khoảng thời gian đã chọn.',
        messageVi: 'Rất tiếc, loại gian kho đã chọn tạm thời kín lịch trong khoảng thời gian này tại cơ sở. Vui lòng chọn thời gian khác hoặc cơ sở lân cận.',
        messageEn: 'Unfortunately, this unit type is fully booked for your selected date range at this facility.'
      }
    }

    // Physical & Prohibited items validation
    const prohibitedKeywords = ['xăng', 'dầu', 'cháy', 'nổ', 'vũ khí', 'hóa chất độc', 'động vật', 'chó', 'mèo', 'thịt tươi', 'thực phẩm tươi', 'pháo', 'thuốc nổ']
    const declaredText = `${params.goods.category} ${params.goods.notes || ''} ${params.goods.material}`.toLowerCase()
    const hasProhibited = prohibitedKeywords.some(kw => declaredText.includes(kw))

    if (hasProhibited) {
      return {
        outcome: 'HARD_VIOLATION',
        rejectionReason: 'Hàng hóa chứa vật phẩm cấm hoặc nguy cơ cháy nổ cao theo quy định PCCC.',
        messageVi: 'Từ chối tự động: Hàng hóa vi phạm quy chế an toàn PCCC.',
        messageEn: 'Automatic Rejection: Prohibited hazardous goods or combustible materials.'
      }
    }

    // DIM Volume calculation
    const itemL = params.largestItemDimensionsCm?.lengthCm ?? params.goods.lengthCm
    const itemW = params.largestItemDimensionsCm?.widthCm ?? params.goods.widthCm
    const itemH = params.largestItemDimensionsCm?.heightCm ?? params.goods.heightCm
    const totalGoodsVolM3 = Math.round(((itemL * itemW * itemH * params.goods.packageCount) / 1000000) * 1000) / 1000

    const sortedItem = [itemL / 100, itemW / 100, itemH / 100].sort((a, b) => b - a)
    const sortedUnit = [unitType.lengthM, unitType.widthM, unitType.heightM].sort((a, b) => b - a)

    const packageDimensionsM = [itemL / 100, itemW / 100, itemH / 100]
    const doorWidth = availableUnit.doorDimensions.widthM
    const doorHeight = availableUnit.doorDimensions.heightM
    const doorPairs = [[0, 1], [0, 2], [1, 2]]
    const fitsThroughDoor = doorPairs.some(([a, b]) => {
      const first = packageDimensionsM[a]
      const second = packageDimensionsM[b]
      return (first <= doorWidth && second <= doorHeight) || (second <= doorWidth && first <= doorHeight)
    })

    const boxDoesNotFit = sortedItem[0] > sortedUnit[0] || sortedItem[1] > sortedUnit[1] || sortedItem[2] > sortedUnit[2]
    const weightExceeds = params.goods.weightKg > unitType.maxLoadKg
    const volumeExceeds = totalGoodsVolM3 > unitType.volumeM3

    if (!fitsThroughDoor || boxDoesNotFit || weightExceeds || volumeExceeds) {
      const suggested = UNIT_TYPES.find(ut => {
        const su = [ut.lengthM, ut.widthM, ut.heightM].sort((a, b) => b - a)
        return (
          ut.volumeM3 >= totalGoodsVolM3 &&
          ut.maxLoadKg >= params.goods.weightKg &&
          sortedItem[0] <= su[0] &&
          sortedItem[1] <= su[1] &&
          sortedItem[2] <= su[2]
        )
      })

      let reason = ''
      if (!fitsThroughDoor) reason = `Kiện hàng lớn nhất (${itemL}×${itemW}×${itemH} cm) không lọt qua cửa kho ${Math.round(doorWidth * 100)}×${Math.round(doorHeight * 100)} cm, kể cả khi xoay kiện.`
      else if (volumeExceeds) reason = `Tổng thể tích hàng (${totalGoodsVolM3} m³) vượt quá dung tích gian kho (${unitType.volumeM3} m³).`
      else if (boxDoesNotFit) reason = `Kiện hàng lớn nhất (${itemL}×${itemW}×${itemH} cm) vượt quá kích thước kho sau khi xoay các chiều.`
      else if (weightExceeds) reason = `Tổng cân nặng (${params.goods.weightKg} kg) vượt quá tải trọng sàn (${unitType.maxLoadKg} kg).`

      return {
        outcome: 'HARD_VIOLATION',
        rejectionReason: reason,
        suggestedUnitTypeId: suggested?.id,
        suggestedUnitTypeName: suggested?.name,
        suggestedVolumeM3: suggested?.volumeM3,
        messageVi: `Từ chối tự động: ${reason}${suggested ? ` Hệ thống đề xuất nâng cấp lên gian kho ${suggested.name} (${suggested.volumeM3} m³).` : ''}`,
        messageEn: `Automatic Rejection: ${reason}${suggested ? ` Recommended upgrade: ${suggested.name}.` : ''}`
      }
    }

    // Pricing policy: the 20% booking deposit is credited toward rent, while a
    // separate one-month security deposit is collected at check-in and may be
    // refunded only after the move-out inspection and settlement.
    const firstMonthRent = unitType.monthlyPrice
    const rentalTermAmount = unitType.monthlyPrice * params.rentalMonths
    const securityDepositAmount = unitType.monthlyPrice
    const reservationDepositAmount = Math.round(rentalTermAmount * 0.2 * 100) / 100
    const remainingAmount = rentalTermAmount - reservationDepositAmount + securityDepositAmount
    const totalInitialAmount = rentalTermAmount + securityDepositAmount

    const holdId = `RSV-${Date.now().toString().slice(-4)}`
    const quoteId = `QUO-${Date.now().toString().slice(-4)}`
    const paymentExpiresAt = new Date(nowTime + 12 * 60 * 60 * 1000).toISOString()
    const emailToken = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(6, '0').slice(-6)

    const pricingQuote: PricingQuote = {
      quoteId,
      unitId: '',
      facilityId: params.facilityId,
      baseMonthlyPrice: unitType.monthlyPrice,
      depositAmount: securityDepositAmount,
      dimSurcharge: 0,
      totalFirstPayment: totalInitialAmount,
      dimWeightKg: Math.ceil((itemL * itemW * itemH * params.goods.packageCount) / 5000),
      actualWeightKg: params.goods.weightKg,
      billableWeightKg: params.goods.weightKg,
      dimDivisor: 5000,
      quotedAt: now.toISOString(),
      expiresAt: paymentExpiresAt
    }

    const newReservation: StorageReservation = {
      id: holdId,
      customerId: params.customer.id,
      customerName: params.customer.name,
      customerEmail: params.customer.email,
      customerPhone: params.customerPhone,
      customerAddress: params.customerAddress,
      identityId: params.identityId,
      facilityId: params.facilityId,
      facilityName: availableUnit.facilityName,
      unitId: '',
      unitTypeId: unitType.id,
      unitTypeName: unitType.name,
      assignedUnitId: undefined, // Manager will assign!
      rentalMonths: params.rentalMonths,
      startDate,
      endDate,
      moveInDate: params.moveInDate,
      status: 'awaiting_email',
      reservationDepositAmount,
      securityDepositAmount,
      remainingAmount,
      firstMonthRent,
      totalInitialAmount,
      approvalType: 'AUTO',
      paymentExpiresAt,
      largestItemDimensionsCm: { lengthCm: itemL, widthCm: itemW, heightCm: itemH },
      goods: params.goods,
      quote: pricingQuote,
      payment: {
        amount: reservationDepositAmount,
        status: 'pending'
      },
      emailVerification: {
        token: emailToken,
        verified: false,
        sentAt: now.toISOString(),
        expiresAt: new Date(nowTime + 24 * 60 * 60 * 1000).toISOString(),
        attemptCount: 1
      },
      appointmentDate: params.moveInDate,
      appointmentTime: params.appointmentTime,
      expiresAt: paymentExpiresAt,
      evidence: [`${holdId} · Đã xác nhận thông tin. Chờ thanh toán cọc 20% trước ${paymentExpiresAt}.`],
      createdAt: now.toISOString()
    }

    setState(prev => ({
      ...prev,
      holds: [newReservation, ...prev.holds],
      activities: [
        {
          id: `act-${Date.now()}`,
          action: 'RESERVATION_CREATED',
          actorId: params.customer.id,
          actorName: params.customer.name,
          actorRole: params.customer.role,
          facilityId: params.facilityId,
          entityType: 'hold',
          entityId: holdId,
          notes: `Khách hàng xác nhận đặt cỡ kho ${unitType.name}. Chờ cọc 20% ($${reservationDepositAmount}) trong 12 giờ.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))

    return {
      outcome: 'PASS',
      hold: newReservation,
      messageVi: 'Yêu cầu đã được tạo. Vui lòng xác minh email để chuyển hồ sơ sang bước phê duyệt.',
      messageEn: 'Request created. Verify your email before the facility review.'
    }
  }

  const approveReservation = (reservationId: string, reviewer: User) => {
    const reservation = state.holds.find(item => item.id === reservationId)
    if (!reservation) throw new Error('Không tìm thấy yêu cầu đặt giữ kho.')
    if (reviewer.role !== 'staff' && reviewer.role !== 'manager' && reviewer.role !== 'admin') throw new Error('Chỉ nhân viên cơ sở được phê duyệt yêu cầu.')
    if (reviewer.role === 'manager' || reviewer.role === 'admin') {
      assertFacilityManager(reviewer, reservation.facilityId, reservation.facilityName)
    } else if (reviewer.facility && reviewer.facility !== 'All facilities' && reviewer.facility !== reservation.facilityId && reviewer.facility !== reservation.facilityName) {
      throw new Error('Bạn không có quyền phê duyệt yêu cầu của cơ sở khác.')
    }
    const nextStatus = transitionReservation(reservation.status as ReservationStatus, 'APPROVE')
    const approvedAt = new Date().toISOString()
    setState(prev => ({
      ...prev,
      holds: prev.holds.map(item => item.id === reservationId ? { ...item, status: nextStatus, evidence: [...item.evidence, `APPROVED · ${reviewer.name} đã duyệt hồ sơ lúc ${approvedAt}`] } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RESERVATION_APPROVED', actorId: reviewer.id, actorName: reviewer.name, actorRole: reviewer.role, facilityId: reservation.facilityId, entityType: 'hold', entityId: reservation.id, notes: 'Hồ sơ đã được phê duyệt và mở bước thanh toán cọc.', timestamp: approvedAt }, ...prev.activities]
    }))
  }

  // 2. Facility Manager: Assign specific Unit for date range
  const assignUnitToHold = (reservationId: string, unitId: string, managerUser: User) => {
    const reservation = state.holds.find(h => h.id === reservationId)
    const unit = state.units.find(u => u.id === unitId)
    if (!reservation || !unit) throw new Error('Không tìm thấy thông tin đơn đặt hoặc gian kho.')
    assertFacilityManager(managerUser, reservation.facilityId, reservation.facilityName)
    if (!['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(reservation.status)) {
      throw new Error('Chỉ đơn đã thanh toán cọc và còn hiệu lực mới được phân kho.')
    }
    if (reservation.payment.status !== 'paid') throw new Error('Đơn chưa thanh toán cọc giữ chỗ.')
    if (unit.facilityId !== reservation.facilityId) throw new Error('Gian kho không thuộc cơ sở của đơn đặt.')
    if (!unitMatchesReservation(unit, reservation)) throw new Error('Loại gian kho không khớp với loại khách đã đặt.')
    if (reservation.assignedUnitId !== unit.id && unit.status !== 'available') {
      throw new Error(`Gian kho ${unit.code} không còn ở trạng thái AVAILABLE.`)
    }

    // Date-range overlap conflict check
    const isConflicted = state.holds.some(
      h => h.id !== reservationId && h.assignedUnitId === unitId &&
           ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) &&
           checkDateOverlap(reservation.startDate, reservation.endDate, h.startDate, h.endDate)
    ) || state.rentals.some(
      r => r.unitId === unitId && r.status === 'active' &&
           checkDateOverlap(reservation.startDate, reservation.endDate, r.startDate, r.endDate)
    )

    if (isConflicted) {
      throw new Error(`Gian kho ${unit.code} đã có booking/hợp đồng khác trùng khoảng thời gian ${reservation.startDate} đến ${reservation.endDate}.`)
    }

    const now = new Date()
    const newPeriod: ReservedPeriod = {
      reservationId: reservation.id,
      customerName: reservation.customerName,
      startDate: reservation.startDate,
      endDate: reservation.endDate
    }

    setState(prev => {
      // Check if all 4 conditions are met for READY_FOR_CHECKIN
      const hasContract = prev.contracts.some(c => c.reservationId === reservation.id && c.status === 'SIGNED')
      const isBalancePaid = reservation.remainingAmount <= 0
      const nextStatus: ReservationStatus = (hasContract && isBalancePaid) ? 'READY_FOR_CHECKIN' : 'UNIT_RESERVED'

      // System generates PIN if ready for checkin
      let generatedPin = reservation.generatedAccessPin
      let newCred: AccessCredential | undefined
      if (nextStatus === 'READY_FOR_CHECKIN' && !generatedPin) {
        const digits = new Uint32Array(1)
        crypto.getRandomValues(digits)
        generatedPin = `${1000 + (digits[0] % 9000)}#`
        newCred = {
          id: `AC-${Date.now()}`,
          reservationId: reservation.id,
          unitId,
          type: 'PIN',
          pinCode: generatedPin,
          status: 'PENDING',
          generatedAt: now.toISOString()
        }
      }

      return {
        ...prev,
        units: prev.units.map(u => {
          if (reservation.assignedUnitId && reservation.assignedUnitId !== unitId && u.id === reservation.assignedUnitId) {
            const remainingPeriods = (u.reservedPeriods || []).filter(period => period.reservationId !== reservation.id)
            return {
              ...u,
              status: remainingPeriods.length ? 'reserved' : 'available',
              reservedPeriods: remainingPeriods,
              nextAvailableDate: remainingPeriods[remainingPeriods.length - 1]?.endDate
            }
          }
          if (u.id === unitId) {
            return {
              ...u,
              status: 'reserved',
              reservedPeriods: [...(u.reservedPeriods || []).filter(p => p.reservationId !== reservation.id), newPeriod],
              nextAvailableDate: reservation.endDate
            }
          }
          return u
        }),
        holds: prev.holds.map(h => {
          if (h.id === reservationId) {
            return {
              ...h,
              assignedUnitId: unitId,
              unitId,
              unitAssignedAt: now.toISOString(),
              status: nextStatus,
              generatedAccessPin: generatedPin,
              evidence: [...h.evidence, `UNIT_RESERVED · Manager ${managerUser.name} đã phân kho ${unit.code} (${reservation.startDate} → ${reservation.endDate})`]
            }
          }
          return h
        }),
        checkins: reservation.appointmentDate && reservation.appointmentTime && !prev.checkins.some(c => c.holdId === reservation.id)
          ? [{ id: `CHK-${Date.now().toString().slice(-6)}`, holdId: reservation.id, unitId, facilityId: reservation.facilityId, customerId: reservation.customerId, customerName: reservation.customerName, staffId: '', staffName: 'Chưa phân công', scheduledDate: reservation.appointmentDate, scheduledTime: reservation.appointmentTime, status: 'scheduled', checklist: { identityVerified: false, termsAccepted: false, paymentConfirmed: reservation.payment.status === 'paid', unitWalkthrough: false, accessCodeIssued: false }, actualMeasurements: { lengthCm: reservation.goods.lengthCm, widthCm: reservation.goods.widthCm, heightCm: reservation.goods.heightCm, weightKg: reservation.goods.weightKg, actualVolumeM3: (reservation.goods.lengthCm * reservation.goods.widthCm * reservation.goods.heightCm * reservation.goods.packageCount) / 1000000, varianceAccepted: false }, initialCondition: '', evidencePhotos: [] }, ...prev.checkins]
          : prev.checkins,
        accessCredentials: newCred ? [...prev.accessCredentials, newCred] : prev.accessCredentials,
        activities: [
          {
            id: `act-${Date.now()}`,
            action: 'UNIT_ASSIGNED',
            actorId: managerUser.id,
            actorName: managerUser.name,
            actorRole: managerUser.role,
            facilityId: unit.facilityId,
            entityType: 'unit',
            entityId: unit.id,
            notes: `Manager phân kho ${unit.code} cho khách ${reservation.customerName} từ ${reservation.startDate} đến ${reservation.endDate}.`,
            timestamp: now.toLocaleString('vi-VN')
          },
          ...prev.activities
        ]
      }
    })
  }

  // 3. Cancel / Expired / No-show: Release Unit allocation
  const cancelReservation = (reservationId: string, user: User, reason?: string) => {
    const reservation = state.holds.find(h => h.id === reservationId)
    if (!reservation) return
    if (reservation.customerId !== user.id && reservation.customerEmail !== user.email) throw new Error('Đơn giữ kho không thuộc tài khoản này.')
    if (['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(reservation.status)) throw new Error('Đơn giữ kho đã hết hiệu lực.')
    const now = new Date()

    setState(prev => {
      const assignedUnit = prev.units.find(u => u.id === reservation.assignedUnitId)
      const updatedPeriods = (assignedUnit?.reservedPeriods || []).filter(p => p.reservationId !== reservation.id)
      const unitHasOtherCurrentReservations = updatedPeriods.some(p => checkDateOverlap(now.toISOString().split('T')[0], now.toISOString().split('T')[0], p.startDate, p.endDate))

      return {
        ...prev,
        units: prev.units.map(u => {
          if (u.id === reservation.assignedUnitId) {
            return {
              ...u,
              status: unitHasOtherCurrentReservations ? 'reserved' : 'available',
              reservedPeriods: updatedPeriods
            }
          }
          return u
        }),
        holds: prev.holds.map(h => {
          if (h.id === reservationId) {
            return {
              ...h,
              status: 'CANCELLED',
              expireReason: 'CUSTOMER_CANCELLED',
              evidence: [...h.evidence, `CANCELLED · Hủy bởi ${user.name}. Lý do: ${reason || 'Khách hủy đơn'}.${h.payment.status === 'paid' ? ' Cọc giữ chỗ không hoàn lại do hủy trước Check-in.' : ''}`]
            }
          }
          return h
        }),
        checkins: prev.checkins.map(checkin => checkin.holdId === reservationId ? { ...checkin, status: 'cancelled' as const } : checkin),
        accessCredentials: prev.accessCredentials.map(credential => credential.reservationId === reservationId ? { ...credential, status: 'REVOKED' as const, revokedAt: now.toISOString() } : credential),
        activities: [
          {
            id: `act-${Date.now()}`,
            action: 'RESERVATION_CANCELLED',
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            facilityId: reservation.facilityId,
            entityType: 'hold',
            entityId: reservation.id,
            notes: `Hủy đơn ${reservation.id}. Kho ${reservation.assignedUnitId || 'N/A'} đã được giải phóng.${reservation.payment.status === 'paid' ? ` Cọc giữ chỗ $${reservation.reservationDepositAmount} không hoàn lại.` : ''}`,
            timestamp: now.toLocaleString('vi-VN')
          },
          ...prev.activities
        ]
      }
    })
  }

  const expireReservation = (reservationId: string, reason: 'NO_SHOW' | 'PAYMENT_EXPIRED' = 'NO_SHOW') => {
    const reservation = state.holds.find(h => h.id === reservationId)
    if (!reservation) return
    const now = new Date()

    setState(prev => {
      const assignedUnit = prev.units.find(u => u.id === reservation.assignedUnitId)
      const updatedPeriods = (assignedUnit?.reservedPeriods || []).filter(p => p.reservationId !== reservation.id)

      return {
        ...prev,
        units: prev.units.map(u => {
          if (u.id === reservation.assignedUnitId) {
            return {
              ...u,
              status: 'available',
              reservedPeriods: updatedPeriods
            }
          }
          return u
        }),
        holds: prev.holds.map(h => {
          if (h.id === reservationId) {
            return {
              ...h,
              status: 'EXPIRED',
              expireReason: reason,
              evidence: [...h.evidence, `EXPIRED · Quá hạn (${reason}). Giải phóng kho.`]
            }
          }
          return h
        })
      }
    })
  }

  // 4. Facility Staff: Sign paper contract and upload scan
  const signPaperContract = (params: {
    holdId: string
    staffUser: User
    identityVerified: boolean
    contractNumber: string
    signedAt: string
    startDate: string
    endDate: string
    scannedFileUrl: string
    scannedFileName: string
  }) => {
    const reservation = state.holds.find(h => h.id === params.holdId)
    if (params.staffUser.role !== 'staff' && params.staffUser.role !== 'manager') {
      throw new Error('Chỉ nhân viên cơ sở được ghi nhận hợp đồng giấy.')
    }
    if (!params.identityVerified) throw new Error('Cần đối chiếu bản gốc CCCD/Hộ chiếu trước khi ký hợp đồng.')
    if (!reservation) throw new Error('Không tìm thấy đơn đặt giữ kho.')
    if (!params.contractNumber.trim()) throw new Error('Vui lòng nhập số hợp đồng.')
    if (!params.scannedFileUrl) throw new Error('Vui lòng tải lên bản scan hợp đồng giấy đã ký.')

    const now = new Date()
    const contract: StorageContract = {
      id: `CTR-${Date.now()}`,
      contractNumber: params.contractNumber.trim(),
      reservationId: reservation.id,
      customerId: reservation.customerId,
      unitId: reservation.assignedUnitId,
      signedAt: params.signedAt,
      startDate: params.startDate,
      endDate: params.endDate,
      monthlyRent: reservation.firstMonthRent || reservation.quote.baseMonthlyPrice,
      securityDeposit: reservation.securityDepositAmount,
      scannedFileUrl: params.scannedFileUrl,
      scannedFileName: params.scannedFileName,
      uploadedAt: now.toISOString(),
      uploadedBy: params.staffUser.id,
      status: 'SIGNED'
    }

    setState(prev => {
      const isBalancePaid = reservation.remainingAmount <= 0
      const hasUnit = Boolean(reservation.assignedUnitId)
      const nextStatus: ReservationStatus = (isBalancePaid && hasUnit) ? 'READY_FOR_CHECKIN' : 'UNIT_RESERVED'

      // System generates PIN if ready for check-in
      let generatedPin = reservation.generatedAccessPin
      let newCred: AccessCredential | undefined
      if (nextStatus === 'READY_FOR_CHECKIN' && !generatedPin) {
        const digits = new Uint32Array(1)
        crypto.getRandomValues(digits)
        generatedPin = `${1000 + (digits[0] % 9000)}#`
        newCred = {
          id: `AC-${Date.now()}`,
          reservationId: reservation.id,
          unitId: reservation.assignedUnitId || '',
          type: 'PIN',
          pinCode: generatedPin,
          status: 'PENDING',
          generatedAt: now.toISOString()
        }
      }

      return {
        ...prev,
        contracts: [contract, ...prev.contracts],
        holds: prev.holds.map(h => {
          if (h.id === reservation.id) {
            return {
              ...h,
              contractId: contract.id,
              status: nextStatus,
              generatedAccessPin: generatedPin,
              evidence: [...h.evidence, `CONTRACT_SIGNED · Số HĐ: ${contract.contractNumber} bởi ${params.staffUser.name}`]
            }
          }
          return h
        }),
        accessCredentials: newCred ? [...prev.accessCredentials, newCred] : prev.accessCredentials,
        activities: [
          {
            id: `act-${Date.now()}`,
            action: 'PAPER_CONTRACT_SIGNED',
            actorId: params.staffUser.id,
            actorName: params.staffUser.name,
            actorRole: params.staffUser.role,
            facilityId: reservation.facilityId,
            entityType: 'hold',
            entityId: reservation.id,
            notes: `Nhân viên lưu bản scan hợp đồng ${contract.contractNumber}. Tiền đảm bảo kho: $${contract.securityDeposit}.`,
            timestamp: now.toLocaleString('vi-VN')
          },
          ...prev.activities
        ]
      }
    })
  }

  // 5. Facility Staff: Record remaining payment (CASH / BANK_TRANSFER) with formal Payment Record
  const recordRemainingPayment = (
    reservationId: string,
    staffUser: User,
    paymentDetails: {
      amount: number
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY'
      transactionReference: string
      proofImage?: string
    }
  ) => {
    const reservation = state.holds.find(h => h.id === reservationId)
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager') {
      throw new Error('Chỉ nhân viên cơ sở được ghi nhận thanh toán tại quầy.')
    }
    if (!reservation) throw new Error('Không tìm thấy đơn đặt chỗ.')
    if (paymentDetails.amount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.')
    if (Math.abs(paymentDetails.amount - reservation.remainingAmount) > 0.01) {
      throw new Error(`Số tiền cần thu chính xác là $${reservation.remainingAmount}, gồm tiền thuê còn lại và tiền đảm bảo kho.`)
    }
    if (!paymentDetails.transactionReference.trim()) throw new Error('Cần nhập mã giao dịch hoặc số phiếu thu.')

    const now = new Date()
    const txId = `TX-BAL-${Date.now()}`

    const newPayment: StoragePayment = {
      id: txId,
      reservationId,
      type: 'INITIAL_RENT',
      amount: paymentDetails.amount,
      paymentMethod: paymentDetails.paymentMethod,
      transactionReference: paymentDetails.transactionReference.trim(),
      proofImage: paymentDetails.proofImage,
      receivedAt: now.toISOString(),
      receivedBy: staffUser.id,
      status: 'PAID',
      paidAt: now.toISOString(),
      recordedBy: staffUser.id,
      description: `Tiền thuê còn lại và tiền đảm bảo kho $${reservation.securityDepositAmount}`
    }

    setState(prev => {
      const hasContract = prev.contracts.some(c => c.reservationId === reservation.id && c.status === 'SIGNED')
      const hasUnit = Boolean(reservation.assignedUnitId)
      const nextStatus: ReservationStatus = (hasContract && hasUnit) ? 'READY_FOR_CHECKIN' : 'UNIT_RESERVED'

      let generatedPin = reservation.generatedAccessPin
      let newCred: AccessCredential | undefined
      if (nextStatus === 'READY_FOR_CHECKIN' && !generatedPin) {
        const digits = new Uint32Array(1)
        crypto.getRandomValues(digits)
        generatedPin = `${1000 + (digits[0] % 9000)}#`
        newCred = {
          id: `AC-${Date.now()}`,
          reservationId: reservation.id,
          unitId: reservation.assignedUnitId || '',
          type: 'PIN',
          pinCode: generatedPin,
          status: 'PENDING',
          generatedAt: now.toISOString()
        }
      }

      return {
        ...prev,
        payments: [newPayment, ...prev.payments],
        holds: prev.holds.map(h => {
          if (h.id === reservationId) {
            return {
              ...h,
              remainingAmount: 0,
              depositConvertedAt: now.toISOString(), // Booking deposit is credited toward rent; security deposit is collected separately.
              status: nextStatus,
              generatedAccessPin: generatedPin,
              evidence: [...h.evidence, `PAYMENT_PAID · Thu $${paymentDetails.amount} qua ${paymentDetails.paymentMethod} (Mã: ${paymentDetails.transactionReference})`]
            }
          }
          return h
        }),
        accessCredentials: newCred ? [...prev.accessCredentials, newCred] : prev.accessCredentials,
        activities: [
          {
            id: `act-${Date.now()}`,
            action: 'INITIAL_BALANCE_PAID',
            actorId: staffUser.id,
            actorName: staffUser.name,
            actorRole: staffUser.role,
            facilityId: reservation.facilityId,
            entityType: 'payment',
            entityId: txId,
            notes: `Nhân viên ${staffUser.name} lập phiếu thu $${paymentDetails.amount} (${paymentDetails.paymentMethod} - ${paymentDetails.transactionReference}), gồm tiền thuê còn lại và tiền đảm bảo kho $${reservation.securityDepositAmount}.`,
            timestamp: now.toLocaleString('vi-VN')
          },
          ...prev.activities
        ]
      }
    })
  }

  // Alias for backward-compat
  const payRemainingBalance = (holdId: string, staffUser: User, paymentMethod: string) => {
    const reservation = state.holds.find(h => h.id === holdId)
    const amount = reservation?.remainingAmount || 0
    recordRemainingPayment(holdId, staffUser, {
      amount,
      paymentMethod: paymentMethod.includes('Chuyển khoản') ? 'BANK_TRANSFER' : 'CASH',
      transactionReference: `REF-${Date.now().toString().slice(-6)}`
    })
  }

  // 6. Facility Staff: Perform Check-in & Handover (Activating Rental & Access)
  const completeCheckIn = (params: {
    holdId: string
    staffUser: User
    checklist: CheckInRecord['checklist']
    actualMeasurements: CheckInRecord['actualMeasurements']
    initialCondition: string
    evidencePhotos: string[]
    goodsHandover: NonNullable<CheckInRecord['goodsHandover']>
    handedOverItems: string[]
  }): RentalRecord => {
    if (params.staffUser.role !== 'staff') throw new Error('Chỉ nhân viên ca trực được hoàn tất check-in.')
    const reservation = state.holds.find(h => h.id === params.holdId)
    if (!reservation) throw new Error('Không tìm thấy đơn đặt kho.')
    if (reservation.status !== 'READY_FOR_CHECKIN') {
      throw new Error('Đơn chưa đạt trạng thái READY_FOR_CHECKIN (Cần: Cọc PAID, Hợp đồng SIGNED, Tiền còn lại PAID, Unit RESERVED).')
    }
    const unit = state.units.find(u => u.id === reservation.assignedUnitId)
    if (!unit) throw new Error('Không tìm thấy gian kho được phân.')

    const { identityVerified, unitWalkthrough, accessCodeIssued } = params.checklist
    if (!identityVerified || !unitWalkthrough || !accessCodeIssued) {
      throw new Error('Cần xác minh CCCD, kiểm tra kho thực tế và xác nhận bàn giao mã PIN.')
    }
    if (!params.initialCondition.trim()) {
      throw new Error('Cần ghi nhận hiện trạng kho trước khi hoàn tất bàn giao.')
    }

    const now = new Date()
    const rentalId = `RNT-${Date.now().toString().slice(-6)}`
    const gatePin = reservation.generatedAccessPin || '4921#'

    const newRental: RentalRecord = {
      id: rentalId,
      holdId: reservation.id,
      contractId: reservation.contractId,
      unitId: unit.id,
      facilityId: unit.facilityId,
      facilityName: unit.facilityName,
      customerId: reservation.customerId,
      customerName: reservation.customerName,
      customerEmail: reservation.customerEmail,
      customerPhone: reservation.customerPhone,
      unitType: unit.type,
      areaM2: unit.areaM2,
      volumeM3: unit.volumeM3,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      nextDue: reservation.startDate,
      monthlyRate: reservation.firstMonthRent || unit.price,
      deposit: reservation.securityDepositAmount,
      securityDeposit: reservation.securityDepositAmount,
      status: 'active',
      paymentStatus: 'paid',
      autoRenew: true,
      gateCode: gatePin,
      initialCondition: params.initialCondition,
      evidencePhotos: params.evidencePhotos
    }

    setState(prev => ({
      ...prev,
      units: prev.units.map(u => (u.id === unit.id ? { ...u, status: 'occupied', currentRentalId: rentalId } : u)),
      holds: prev.holds.map(h => (h.id === reservation.id ? { ...h, status: 'COMPLETED', checkedInAt: now.toISOString(), checkedInBy: params.staffUser.id } : h)),
      rentals: [newRental, ...prev.rentals],
      checkins: prev.checkins.map(c => c.holdId === reservation.id ? { ...c, status: 'completed' as const, completedAt: now.toISOString(), staffId: params.staffUser.id, staffName: params.staffUser.name, checklist: params.checklist, initialCondition: params.initialCondition, evidencePhotos: params.evidencePhotos, goodsHandover: params.goodsHandover, handedOverItems: params.handedOverItems } : c),
      accessCredentials: prev.accessCredentials.map(ac => {
        if (ac.reservationId === reservation.id) {
          return { ...ac, rentalId, status: 'ACTIVE', activatedAt: now.toISOString() }
        }
        return ac
      }),
      activities: [
        {
          id: `act-${Date.now()}`,
          action: 'CHECKIN_COMPLETED',
          actorId: params.staffUser.id,
          actorName: params.staffUser.name,
          actorRole: params.staffUser.role,
          facilityId: unit.facilityId,
          entityType: 'rental',
          entityId: rentalId,
          notes: `Check-in hoàn tất kho ${unit.code}. Kích hoạt hợp đồng thuê và mã PIN ${gatePin}.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))

    return newRental
  }

  const confirmUnitReceipt = (rentalId: string, customer: User) => {
    const rental = state.rentals.find(r => r.id === rentalId)
    if (!rental || rental.customerId !== customer.id) throw new Error('Không tìm thấy hồ sơ thuê thuộc tài khoản này.')
    if (rental.receiptConfirmedAt) return
    const now = new Date()
    setState(prev => ({
      ...prev,
      rentals: prev.rentals.map(r => r.id === rentalId ? { ...r, receiptConfirmedAt: now.toISOString(), receiptConfirmedBy: customer.id } : r),
      checkins: prev.checkins.map(c => c.holdId === rental.holdId ? { ...c, customerConfirmationTimestamp: now.toISOString() } : c),
      activities: [{
        id: `act-${Date.now()}`,
        action: 'UNIT_RECEIPT_CONFIRMED',
        actorId: customer.id,
        actorName: customer.name,
        actorRole: customer.role,
        facilityId: rental.facilityId,
        entityType: 'rental',
        entityId: rental.id,
        notes: `Khách hàng xác nhận đã nhận gian kho ${rental.unitId} và thông tin truy cập.`,
        timestamp: now.toLocaleString('vi-VN')
      }, ...prev.activities]
    }))
  }

  // 7. Renewals: Customer requests, Manager approves, Customer pays
  const requestRenewal = (rentalId: string, renewalMonths: number, customer: User): RenewalRecord => {
    const rental = state.rentals.find(r => r.id === rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Chỉ hợp đồng đang hoạt động mới được yêu cầu gia hạn.')
    if (rental.customerId !== customer.id && rental.customerEmail !== customer.email) throw new Error('Hợp đồng không thuộc tài khoản Customer này.')
    if (![1, 3, 6, 12].includes(renewalMonths)) throw new Error('Gói gia hạn không hợp lệ.')
    if (state.renewals.some(item => item.rentalId === rentalId && ['pending', 'approved', 'deposit_paid', 'appointment_scheduled', 'payment_processing'].includes(item.status))) throw new Error('Hợp đồng đã có một yêu cầu gia hạn đang chờ xử lý.')
    const requestedEndDate = addCalendarMonths(rental.endDate, renewalMonths)

    const renewalRecord: RenewalRecord = {
      id: `RNW-${Date.now().toString().slice(-6)}`,
      rentalId: rental.id,
      unitId: rental.unitId,
      facilityId: rental.facilityId,
      customerId: customer.id,
      customerName: customer.name,
      oldEndDate: rental.endDate,
      newEndDate: requestedEndDate,
      renewalMonths,
      renewalFee: rental.monthlyRate * renewalMonths,
      originalMonthlyRate: rental.monthlyRate,
      totalAmount: rental.monthlyRate * renewalMonths,
      bookingDepositAmount: Math.round(rental.monthlyRate * renewalMonths * 0.2 * 100) / 100,
      remainingAmount: Math.round(rental.monthlyRate * renewalMonths * 0.8 * 100) / 100,
      status: 'pending',
      requestedAt: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      renewals: [renewalRecord, ...prev.renewals],
      activities: [
        {
          id: `act-${Date.now()}`,
          action: 'RENEWAL_REQUESTED',
          actorId: customer.id,
          actorName: customer.name,
          actorRole: customer.role,
          facilityId: rental.facilityId,
          entityType: 'rental',
          entityId: rental.id,
          notes: `Khách gửi yêu cầu gia hạn kho ${rental.unitId} thêm ${renewalMonths} tháng, đến ngày ${requestedEndDate}.`,
          timestamp: new Date().toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))

    return renewalRecord
  }

  const updateRenewalRequest = (renewalId: string, renewalMonths: number, customer: User) => {
    const renewal = state.renewals.find(item => item.id === renewalId)
    if (!renewal || renewal.status !== 'pending') throw new Error('Chỉ có thể sửa yêu cầu đang chờ Manager xét duyệt.')
    if (renewal.customerId !== customer.id) throw new Error('Yêu cầu gia hạn không thuộc tài khoản này.')
    if (![1, 3, 6, 12].includes(renewalMonths)) throw new Error('Gói gia hạn không hợp lệ.')
    const rental = state.rentals.find(item => item.id === renewal.rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Hợp đồng không còn ở trạng thái hoạt động.')
    const updatedAt = new Date().toISOString()
    const newEndDate = addCalendarMonths(rental.endDate, renewalMonths)
    const totalAmount = rental.monthlyRate * renewalMonths
    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, oldEndDate: rental.endDate, newEndDate, renewalMonths, renewalFee: totalAmount, totalAmount, bookingDepositAmount: Math.round(totalAmount * 0.2 * 100) / 100, remainingAmount: Math.round(totalAmount * 0.8 * 100) / 100, originalMonthlyRate: rental.monthlyRate, updatedAt } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_REQUEST_UPDATED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: `Khách đã sửa yêu cầu ${renewal.id}: gia hạn ${renewalMonths} tháng, đến ${newEndDate}. Manager cần xét duyệt theo thông tin mới.`, timestamp: updatedAt }, ...prev.activities]
    }))
  }

  const cancelRenewalRequest = (renewalId: string, customer: User) => {
    const renewal = state.renewals.find(item => item.id === renewalId)
    if (!renewal || !['pending', 'approved', 'appointment_scheduled'].includes(renewal.status)) throw new Error('Chỉ có thể hủy yêu cầu trước khi ký phụ lục và hoàn tất gia hạn.')
    if (renewal.customerId !== customer.id) throw new Error('Yêu cầu gia hạn không thuộc tài khoản này.')
    const cancelledAt = new Date().toISOString()
    const wasApproved = renewal.status === 'approved'
    const depositWasPaid = renewal.status === 'appointment_scheduled'
    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, status: 'cancelled', cancelledAt, notes: depositWasPaid ? 'Customer hủy sau khi đã cọc; cọc gia hạn 20% không hoàn lại.' : wasApproved ? 'Customer hủy sau khi được duyệt; hóa đơn gia hạn đã mất hiệu lực.' : 'Customer chủ động hủy trước khi Manager xét duyệt.' } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_REQUEST_CANCELLED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: depositWasPaid ? `Khách đã hủy yêu cầu ${renewal.id} sau khi cọc; cọc $${renewal.bookingDepositAmount} không hoàn lại. Manager đã được thông báo.` : wasApproved ? `Khách đã hủy yêu cầu gia hạn ${renewal.id} sau khi duyệt. Hóa đơn ${renewal.invoiceNumber || 'gia hạn'} đã mất hiệu lực.` : `Khách đã hủy yêu cầu gia hạn ${renewal.id}. Manager không cần tiếp tục xét duyệt.`, timestamp: cancelledAt }, ...prev.activities]
    }))
  }

  const approveRenewal = (renewalId: string, managerUser: User) => {
    const renewal = state.renewals.find(r => r.id === renewalId)
    if (!renewal || renewal.status !== 'pending') return
    const rental = state.rentals.find(item => item.id === renewal.rentalId)
    assertFacilityManager(managerUser, renewal.facilityId, rental?.facilityName || renewal.facilityId)

    // Conflict check on date range
    const isConflicted = state.holds.some(
      h => h.assignedUnitId === renewal.unitId && ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) &&
           checkDateOverlap(renewal.oldEndDate, renewal.newEndDate, h.startDate, h.endDate)
    )

    if (isConflicted) {
      throw new Error('Kho đã có booking khác trong khoảng thời gian gia hạn yêu cầu.')
    }

    const now = new Date()
    const paymentDueAt = new Date(now.getTime() + 72 * 60 * 60 * 1000)
    const invoiceNumber = `INV-RNW-${Date.now().toString().slice(-8)}`
    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(r => r.id === renewalId ? { ...r, status: 'approved', approvedBy: managerUser.name, approvedAt: now.toISOString(), paymentDueAt: paymentDueAt.toISOString(), invoiceNumber, invoiceIssuedAt: now.toISOString() } : r),
      activities: [
        {
          id: `act-${Date.now()}`,
          action: 'RENEWAL_APPROVED',
          actorId: managerUser.id,
          actorName: managerUser.name,
          actorRole: managerUser.role,
          facilityId: renewal.facilityId,
          entityType: 'rental',
          entityId: renewal.rentalId,
          notes: `Manager duyệt gia hạn kho ${renewal.unitId} đến ${renewal.newEndDate}. Chờ khách thanh toán.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))
  }

  const rejectRenewal = (renewalId: string, managerUser: User, reason: string) => {
    const renewal = state.renewals.find(r => r.id === renewalId)
    if (!renewal || renewal.status !== 'pending') return
    const rental = state.rentals.find(item => item.id === renewal.rentalId)
    assertFacilityManager(managerUser, renewal.facilityId, rental?.facilityName || renewal.facilityId)
    if (!reason.trim()) throw new Error('Vui lòng nhập lý do từ chối yêu cầu gia hạn.')
    const now = new Date()

    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(r => r.id === renewalId ? { ...r, status: 'rejected', approvedBy: managerUser.name, approvedAt: now.toISOString(), notes: reason.trim() } : r),
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_REJECTED', actorId: managerUser.id, actorName: managerUser.name, actorRole: managerUser.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: `Từ chối yêu cầu ${renewal.id}. Lý do: ${reason.trim()}`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const expireRenewalPayment = (renewalId: string) => {
    const renewal = state.renewals.find(item => item.id === renewalId)
    if (!renewal || renewal.status !== 'approved' || !renewal.paymentDueAt || new Date(renewal.paymentDueAt).getTime() > Date.now()) return
    setState(prev => ({ ...prev, renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, status: 'payment_expired', notes: 'Quá 72 giờ thanh toán cọc gia hạn.' } : item) }))
  }

  const payRenewal = (renewalId: string, customer: User, paymentMethod: 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionId: string, termsAccepted: boolean, appointmentDate: string, appointmentTime: string) => {
    const renewal = state.renewals.find(r => r.id === renewalId)
    if (!renewal || renewal.status !== 'approved') throw new Error('Đơn gia hạn chưa được Manager duyệt.')
    if (renewal.customerId !== customer.id) throw new Error('Yêu cầu gia hạn không thuộc tài khoản này.')
    if (!termsAccepted) throw new Error('Vui lòng xác nhận thông tin và điều khoản gia hạn.')
    if (!transactionId.trim()) throw new Error('Vui lòng nhập mã giao dịch thanh toán.')
    if (!appointmentDate || !appointmentTime) throw new Error('Vui lòng chọn ngày và giờ đến cơ sở ký phụ lục.')
    if (appointmentTime < '08:00' || appointmentTime > '17:00') throw new Error('Giờ hẹn phải nằm trong giờ làm việc 08:00–17:00.')
    if (!renewal.paymentDueAt || new Date(renewal.paymentDueAt).getTime() < Date.now()) {
      setState(prev => ({ ...prev, renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, status: 'payment_expired', notes: 'Quá 72 giờ thanh toán cọc gia hạn.' } : item) }))
      throw new Error('Đã quá thời hạn thanh toán 72 giờ. Vui lòng gửi yêu cầu gia hạn mới.')
    }
    const rental = state.rentals.find(item => item.id === renewal.rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Hợp đồng không còn ở trạng thái hoạt động.')
    if (state.payments.some(payment => payment.renewalId === renewalId && payment.status === 'PAID')) throw new Error('Yêu cầu gia hạn này đã được thanh toán.')

    const now = new Date()
    const oldEndAt = new Date(`${renewal.oldEndDate}T23:59:59`)
    const latestSigningDate = new Date(now)
    latestSigningDate.setDate(latestSigningDate.getDate() + 7)
    latestSigningDate.setHours(23, 59, 59, 999)
    const appointmentAt = new Date(`${appointmentDate}T${appointmentTime}:00`)
    if (Number.isNaN(appointmentAt.getTime()) || appointmentAt.getTime() < now.getTime()) throw new Error('Lịch hẹn phải ở thời điểm tương lai.')
    if (appointmentAt.getTime() > latestSigningDate.getTime()) throw new Error(`Lịch ký phải nằm trong 7 ngày, chậm nhất ${latestSigningDate.toLocaleString('vi-VN')}.`)
    const overdueStart = new Date(`${renewal.oldEndDate}T00:00:00`)
    overdueStart.setDate(overdueStart.getDate() + 1)
    const appointmentDay = new Date(`${appointmentDate}T00:00:00`)
    const paymentDay = new Date(now); paymentDay.setHours(0, 0, 0, 0)
    const lateThroughDay = appointmentDay.getTime() > paymentDay.getTime() ? appointmentDay : paymentDay
    const overdueDays = lateThroughDay.getTime() >= overdueStart.getTime() ? Math.floor((lateThroughDay.getTime() - overdueStart.getTime()) / 86_400_000) + 1 : 0
    const lateFeePerDay = Math.round((((renewal.originalMonthlyRate || rental.monthlyRate) / 30) * 0.5) * 100) / 100
    const lateFeeAmount = Math.round(overdueDays * lateFeePerDay * 100) / 100
    const txId = transactionId.trim()
    const paymentId = `PAY-RNW-${Date.now().toString().slice(-8)}`
    const bookingDepositAmount = renewal.bookingDepositAmount ?? Math.round(renewal.renewalFee * 0.2 * 100) / 100

    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(r => r.id === renewalId ? {
        ...r,
        status: 'appointment_scheduled',
        paidAt: now.toISOString(),
        paymentMethod,
        transactionReference: txId,
        paymentId,
        bookingDepositAmount,
        remainingAmount: Math.round((renewal.renewalFee - bookingDepositAmount) * 100) / 100,
        appointmentDate,
        appointmentTime,
        signingDeadline: latestSigningDate.toISOString(),
        overdueDays,
        lateFeePerDay,
        lateFeeAmount
      } : r),
      payments: [
        {
          id: paymentId,
          reservationId: rental.holdId,
          rentalId: renewal.rentalId,
          renewalId,
          type: 'RENEWAL',
          amount: bookingDepositAmount,
          paymentMethod,
          transactionReference: txId,
          status: 'PAID',
          paidAt: now.toISOString(),
          recordedBy: renewal.customerId,
          invoiceNumber: renewal.invoiceNumber,
          description: `Cọc giữ chỗ gia hạn 20% cho ${renewal.renewalMonths} tháng (${renewal.oldEndDate} → ${renewal.newEndDate})`,
          gatewayVerifiedAt: now.toISOString()
        },
        ...prev.payments
      ],
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_DEPOSIT_PAID', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: renewal.facilityId, entityType: 'payment', entityId: paymentId, notes: `Đã thu cọc gia hạn 20% $${bookingDepositAmount}. Khách hẹn ký ngày ${appointmentDate} ${appointmentTime}; còn $${Math.round((renewal.renewalFee - bookingDepositAmount) * 100) / 100}${lateFeeAmount ? ` và phụ thu trễ dự kiến $${lateFeeAmount}` : ''}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const completeRenewalAtFacility = (params: {
    renewalId: string
    staffUser: User
    transactionReference: string
    identityVerified: boolean
    unitAndTermsVerified: boolean
    contractNumber: string
    signedAt: string
    scannedFileUrl: string
    scannedFileName: string
  }) => {
    const { renewalId, staffUser, transactionReference, identityVerified, unitAndTermsVerified, contractNumber, signedAt, scannedFileUrl, scannedFileName } = params
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager') throw new Error('Chỉ nhân viên cơ sở được hoàn tất gia hạn.')
    const renewal = state.renewals.find(item => item.id === renewalId)
    if (!renewal || renewal.status !== 'appointment_scheduled') throw new Error('Yêu cầu chưa cọc hoặc chưa có lịch ký hợp lệ.')
    if (!transactionReference.trim()) throw new Error('Vui lòng nhập mã phiếu thu hoặc mã giao dịch.')
    if (!identityVerified) throw new Error('Cần đối chiếu giấy tờ khách hàng trước khi hoàn tất gia hạn.')
    if (!unitAndTermsVerified) throw new Error('Cần kiểm tra gian kho và xác nhận lại điều khoản gia hạn.')
    if (!contractNumber.trim() || !signedAt || !scannedFileUrl || !scannedFileName) throw new Error('Cần nhập đầy đủ và tải lên hợp đồng gia hạn đã ký.')
    if (state.contracts.some(contract => contract.contractNumber === contractNumber.trim())) throw new Error('Số hợp đồng đã tồn tại.')
    const rental = state.rentals.find(item => item.id === renewal.rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Hợp đồng không còn hoạt động.')
    const now = new Date()
    const remainingAmount = renewal.remainingAmount ?? Math.round(renewal.renewalFee * 0.8 * 100) / 100
    const overdueStart = new Date(`${renewal.oldEndDate}T00:00:00`)
    overdueStart.setDate(overdueStart.getDate() + 1)
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    const actualOverdueDays = today.getTime() >= overdueStart.getTime() ? Math.floor((today.getTime() - overdueStart.getTime()) / 86_400_000) + 1 : 0
    const lateFeePerDay = renewal.lateFeePerDay ?? Math.round(((rental.monthlyRate / 30) * 0.5) * 100) / 100
    const lateFeeAmount = Math.round(Math.max(actualOverdueDays, renewal.overdueDays || 0) * lateFeePerDay * 100) / 100
    const finalPayment = Math.round((remainingAmount + lateFeeAmount) * 100) / 100
    const paymentId = `PAY-RNW-BAL-${Date.now().toString().slice(-8)}`
    const renewalContractId = `CTR-RNW-${Date.now().toString().slice(-8)}`
    const renewalContractNumber = contractNumber.trim()
    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, status: 'completed', overdueDays: Math.max(actualOverdueDays, renewal.overdueDays || 0), lateFeePerDay, lateFeeAmount, signedAt, completedBy: staffUser.id, renewalContractId, renewalContractNumber, effectiveAt: nextCalendarDay(renewal.oldEndDate) } : item),
      rentals: prev.rentals.map(item => item.id === renewal.rentalId ? { ...item, endDate: renewal.newEndDate } : item),
      contracts: [{ id: renewalContractId, contractNumber: renewalContractNumber, reservationId: rental.holdId, customerId: rental.customerId, unitId: rental.unitId, signedAt, startDate: nextCalendarDay(renewal.oldEndDate), endDate: renewal.newEndDate, monthlyRent: renewal.originalMonthlyRate ?? rental.monthlyRate, securityDeposit: 0, scannedFileUrl, scannedFileName, uploadedAt: now.toISOString(), uploadedBy: staffUser.name, status: 'SIGNED', contractType: 'RENEWAL', renewalId }, ...prev.contracts],
      units: prev.units.map(unit => unit.id === renewal.unitId ? { ...unit, nextAvailableDate: renewal.newEndDate } : unit),
      payments: [{ id: paymentId, reservationId: rental.holdId, rentalId: renewal.rentalId, renewalId, type: 'RENEWAL', amount: finalPayment, paymentMethod: 'CASH', transactionReference: transactionReference.trim(), status: 'PAID', paidAt: now.toISOString(), recordedBy: staffUser.id, invoiceNumber: renewal.invoiceNumber, description: `Thanh toán phần còn lại của kỳ gia hạn: $${remainingAmount}${lateFeeAmount ? ` + phụ thu trễ $${lateFeeAmount}` : ''}` }, ...prev.payments],
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_COMPLETED_AT_FACILITY', actorId: staffUser.id, actorName: staffUser.name, actorRole: staffUser.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: `Đã đối chiếu hồ sơ, ký hợp đồng gia hạn ${renewalContractNumber}, thu $${finalPayment} và gia hạn đến ${renewal.newEndDate}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  // 8. Return & Checkout: Separate Refund Calculation vs Unit Condition
  const requestReturn = (rentalId: string, scheduledDate: string, customer: User, reason?: string): ReturnCase => {
    const rental = state.rentals.find(r => r.id === rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Chỉ hợp đồng đang hoạt động mới được gửi yêu cầu trả kho.')
    const requestedReturnDate = toValidDate(scheduledDate)
    requestedReturnDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (requestedReturnDate < today) throw new Error('Ngày trả kho không được trước ngày hiện tại.')

    const returnId = `RET-${Date.now().toString().slice(-6)}`
    const now = new Date()

    const newReturn: ReturnCase = {
      id: returnId,
      rentalId: rental.id,
      unitId: rental.unitId,
      facilityId: rental.facilityId,
      facilityName: rental.facilityName,
      customerId: rental.customerId,
      customerName: rental.customerName,
      customerEmail: rental.customerEmail,
      customerPhone: rental.customerPhone,
      requestedAt: now.toISOString(),
      scheduledDate,
      status: 'requested',
      initialConditionSnapshot: rental.initialCondition || 'Kho sạch sẽ lúc bàn giao',
      packageCount: 0,
      initialWeightKg: 0,
      damageFee: 0,
      outstandingFee: 0,
      depositAmount: rental.securityDeposit, // Refund is calculated from Security Deposit!
      netRefundAmount: rental.securityDeposit,
      evidence: rental.evidencePhotos || [],
      customerConfirmed: false
    }

    setState(prev => ({
      ...prev,
      rentals: prev.rentals.map(r => (r.id === rentalId ? { ...r, status: 'return_requested' } : r)),
      returns: [newReturn, ...prev.returns]
    }))

    return newReturn
  }

  const completeReturnInspection = (params: {
    returnId: string
    staffUser: User
    inventoryMatch: 'match' | 'missing' | 'excess'
    damageClassification: DamageClassification
    damageFee: number
    cleaningFee: number
    lostItemFee: number
    overdueFee: number
    outstandingFee: number
    staffNotes: string
    evidencePhotos: string[]
    returnedItems: { key: boolean; card: boolean; lock: boolean }
  }) => {
    const returnCase = state.returns.find(r => r.id === params.returnId)
    if (!returnCase) throw new Error('Không tìm thấy hồ sơ trả kho.')
    const rental = state.rentals.find(r => r.id === returnCase.rentalId)
    const unit = state.units.find(u => u.id === returnCase.unitId)
    if (!rental || !unit) throw new Error('Không tìm thấy hợp đồng hoặc gian kho.')

    const now = new Date()
    const contractEndDay = toValidDate(rental.endDate); contractEndDay.setHours(0, 0, 0, 0)
    const inspectionDay = new Date(now); inspectionDay.setHours(0, 0, 0, 0)
    const overdueDays = inspectionDay.getTime() > contractEndDay.getTime() ? Math.floor((inspectionDay.getTime() - contractEndDay.getTime()) / 86_400_000) : 0
    const lateFeePerDay = Math.round(((rental.monthlyRate / 30) * 0.5) * 100) / 100
    const calculatedOverdueFee = Math.round(overdueDays * lateFeePerDay * 100) / 100
    const totalFees = params.damageFee + params.cleaningFee + params.lostItemFee + calculatedOverdueFee + params.outstandingFee
    const netRefund = Math.max(0, returnCase.depositAmount - totalFees)
    const amountDueFromCustomer = Math.max(0, Math.round((totalFees - returnCase.depositAmount) * 100) / 100)

    // UNIT CONDITION: Separate from fees! Only physical repair/cleaning needs MAINTENANCE
    const needsPhysicalRepair = params.damageClassification !== 'no_damage' || params.cleaningFee > 0 || params.inventoryMatch === 'excess'
    const nextUnitStatus: 'available' | 'maintenance' = needsPhysicalRepair ? 'maintenance' : 'available'

    setState(prev => ({
      ...prev,
      units: prev.units.map(u => (u.id === unit.id ? { ...u, status: 'maintenance' } : u)),
      rentals: prev.rentals.map(r => (r.id === rental.id ? { ...r, status: 'closing' } : r)),
      returns: prev.returns.map(r => r.id === returnCase.id ? {
        ...r,
        status: 'awaiting_customer_confirmation',
        inspectedAt: now.toISOString(),
        damageClassification: params.damageClassification,
        damageFee: params.damageFee,
        cleaningFee: params.cleaningFee,
        lostItemFee: params.lostItemFee,
        overdueFee: calculatedOverdueFee,
        overdueDays,
        outstandingFee: params.outstandingFee,
        netRefundAmount: netRefund,
        amountDueFromCustomer,
        staffNotes: params.staffNotes,
        evidence: [...r.evidence, ...params.evidencePhotos],
        customerConfirmed: false,
        returnedItems: params.returnedItems,
        staffId: params.staffUser.id,
        proposedUnitStatus: nextUnitStatus
      } : r),
      activities: [
        {
          id: `act-${Date.now()}`,
          action: 'RETURN_INSPECTION_COMPLETED',
          actorId: params.staffUser.id,
          actorName: params.staffUser.name,
          actorRole: params.staffUser.role,
          facilityId: unit.facilityId,
          entityType: 'return',
          entityId: returnCase.id,
          notes: `Đã nghiệm thu kho ${unit.code}. Quá hạn ${overdueDays} ngày, phí trễ $${calculatedOverdueFee}. ${amountDueFromCustomer > 0 ? `Tiền đảm bảo không đủ; khách cần đóng thêm $${amountDueFromCustomer}.` : `Đề xuất hoàn $${netRefund}.`} Chờ khách hàng xác nhận quyết toán.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))
  }

  // 9. Facility Manager: Maintenance Task Handling
  const createMaintenanceTask = (unitId: string, reason: string, staffUser?: User): MaintenanceTask => {
    const task: MaintenanceTask = {
      id: `MNT-${Date.now().toString().slice(-6)}`,
      unitId,
      facilityId: state.units.find(u => u.id === unitId)?.facilityId || 'fac-001',
      reason,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    setState(prev => ({
      ...prev,
      units: prev.units.map(u => u.id === unitId ? { ...u, status: 'maintenance' } : u),
      maintenanceTasks: [task, ...prev.maintenanceTasks]
    }))
    return task
  }

  const completeMaintenanceTask = (taskId: string, managerUser: User) => {
    const task = state.maintenanceTasks.find(t => t.id === taskId)
    if (!task) return
    const unit = state.units.find(item => item.id === task.unitId)
    assertFacilityManager(managerUser, task.facilityId, unit?.facilityName || task.facilityId)
    const now = new Date()

    setState(prev => ({
      ...prev,
      maintenanceTasks: prev.maintenanceTasks.map(t => t.id === taskId ? { ...t, status: 'completed', completedAt: now.toISOString() } : t),
      units: prev.units.map(u => u.id === task.unitId ? { ...u, status: 'available' } : u),
      activities: [
        {
          id: `act-${Date.now()}`,
          action: 'MAINTENANCE_COMPLETED',
          actorId: managerUser.id,
          actorName: managerUser.name,
          actorRole: managerUser.role,
          facilityId: task.facilityId,
          entityType: 'unit',
          entityId: task.unitId,
          notes: `Manager ${managerUser.name} nghiệm thu bảo trì xong kho ${task.unitId}. Trạng thái kho chuyển sang AVAILABLE.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))
  }

  const releaseMaintenanceUnit = (unitId: string, staffUser: User) => {
    const unit = state.units.find(item => item.id === unitId)
    if (!unit) throw new Error('Không tìm thấy gian kho.')
    assertFacilityManager(staffUser, unit.facilityId, unit.facilityName)
    const task = state.maintenanceTasks.find(t => t.unitId === unitId && t.status !== 'completed')
    if (task) {
      completeMaintenanceTask(task.id, staffUser)
    } else {
      setState(prev => ({
        ...prev,
        units: prev.units.map(u => u.id === unitId ? { ...u, status: 'available' } : u)
      }))
    }
  }

  const updateUnitStatus = (unitId: string, status: 'available' | 'maintenance', manager: User, reason?: string) => {
    const unit = state.units.find(item => item.id === unitId)
    if (!unit) throw new Error('Không tìm thấy gian kho.')
    assertFacilityManager(manager, unit.facilityId, unit.facilityName)
    const hasActiveRental = state.rentals.some(rental => rental.unitId === unitId && rental.status === 'active')
    const hasActiveReservation = state.holds.some(hold => hold.assignedUnitId === unitId && ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(hold.status))
    if (hasActiveRental || hasActiveReservation) throw new Error('Không thể đổi trạng thái gian kho đang có hợp đồng hoặc đặt chỗ hiệu lực.')
    const now = new Date()
    setState(prev => {
      const openTask = prev.maintenanceTasks.find(task => task.unitId === unitId && task.status !== 'completed')
      const maintenanceTask: MaintenanceTask | undefined = status === 'maintenance' && !openTask ? {
        id: `MNT-${Date.now().toString().slice(-6)}`,
        unitId,
        facilityId: unit.facilityId,
        reason: reason?.trim() || 'Manager chuyển gian kho sang bảo trì.',
        status: 'pending',
        createdAt: now.toISOString()
      } : undefined
      return {
        ...prev,
        units: prev.units.map(item => item.id === unitId ? { ...item, status, conditionNotes: reason?.trim() || item.conditionNotes, version: item.version + 1 } : item),
        maintenanceTasks: status === 'available'
          ? prev.maintenanceTasks.map(task => task.unitId === unitId && task.status !== 'completed' ? { ...task, status: 'completed', completedAt: now.toISOString(), notes: reason?.trim() || task.notes } : task)
          : maintenanceTask ? [maintenanceTask, ...prev.maintenanceTasks] : prev.maintenanceTasks,
        activities: [{ id: `act-${Date.now()}`, action: status === 'maintenance' ? 'UNIT_MAINTENANCE_STARTED' : 'UNIT_RELEASED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: unit.facilityId, entityType: 'unit', entityId: unit.id, notes: reason?.trim() || `Trạng thái gian kho chuyển sang ${status.toUpperCase()}.`, timestamp: now.toISOString() }, ...prev.activities]
      }
    })
  }

  const recordRentalPayment = (rentalId: string, amount: number, paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionReference: string, manager: User) => {
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (rental.status !== 'active') throw new Error('Chỉ ghi nhận thanh toán cho hợp đồng đang hoạt động.')
    const expectedAmount = Math.round((rental.monthlyRate + (rental.lateFeeAmount || 0)) * 100) / 100
    if (amount <= 0 || Math.abs(amount - expectedAmount) > 0.01) throw new Error(`Số tiền cần thu chính xác là $${expectedAmount}.`)
    if (!transactionReference.trim()) throw new Error('Cần nhập mã giao dịch hoặc số phiếu thu.')
    const now = new Date()
    const baseDue = toValidDate(rental.nextDue)
    const nextDueBase = baseDue.getTime() < now.getTime() ? now.toISOString().split('T')[0] : rental.nextDue
    const nextDue = addCalendarMonths(nextDueBase, 1)
    const paymentId = `PAY-RENT-${Date.now().toString().slice(-8)}`
    const payment: StoragePayment = { id: paymentId, reservationId: rental.holdId, rentalId, type: 'RENT', amount, paymentMethod, transactionReference: transactionReference.trim(), receivedAt: now.toISOString(), receivedBy: manager.id, status: 'PAID', paidAt: now.toISOString(), recordedBy: manager.id, description: `Thu cước kho ${rental.unitId}${rental.lateFeeAmount ? ` gồm phí trễ $${rental.lateFeeAmount}` : ''}` }
    setState(prev => ({
      ...prev,
      payments: [payment, ...prev.payments],
      rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, paymentStatus: 'paid', lateFeeAmount: 0, overlocked: false, nextDue } : item),
      accessCredentials: prev.accessCredentials.map(item => item.rentalId === rentalId && item.status === 'SUSPENDED' ? { ...item, status: 'ACTIVE' } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RENT_PAYMENT_RECORDED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'payment', entityId: paymentId, notes: `Đã thu $${amount} cho hợp đồng ${rental.id}; kỳ tiếp theo ${nextDue}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const applyRentalLateFee = (rentalId: string, amount: number, manager: User) => {
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (rental.paymentStatus !== 'overdue') throw new Error('Chỉ áp dụng phí trễ cho hợp đồng đang quá hạn.')
    if (amount <= 0) throw new Error('Phí trễ phải lớn hơn 0.')
    const now = new Date()
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, lateFeeAmount: Math.round(((item.lateFeeAmount || 0) + amount) * 100) / 100 } : item), activities: [{ id: `act-${Date.now()}`, action: 'LATE_FEE_APPLIED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `Áp dụng phí trễ $${amount}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  const waiveRentalLateFee = (rentalId: string, manager: User) => {
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    const previousFee = rental.lateFeeAmount || 0
    const now = new Date()
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, lateFeeAmount: 0 } : item), activities: [{ id: `act-${Date.now()}`, action: 'LATE_FEE_WAIVED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `Miễn phí trễ $${previousFee}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  const setRentalOverlock = (rentalId: string, overlocked: boolean, manager: User) => {
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (overlocked && rental.paymentStatus !== 'overdue') throw new Error('Chỉ khóa truy cập đối với hợp đồng quá hạn.')
    const now = new Date()
    setState(prev => ({
      ...prev,
      rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, overlocked } : item),
      accessCredentials: prev.accessCredentials.map(item => item.rentalId === rentalId && item.status !== 'REVOKED' ? { ...item, status: overlocked ? 'SUSPENDED' : 'ACTIVE' } : item),
      activities: [{ id: `act-${Date.now()}`, action: overlocked ? 'RENTAL_ACCESS_SUSPENDED' : 'RENTAL_ACCESS_RESTORED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `${overlocked ? 'Khóa' : 'Khôi phục'} quyền truy cập gian kho ${rental.unitId}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const sendDelinquencyReminder = (rentalId: string, manager: User) => {
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (rental.paymentStatus !== 'overdue') throw new Error('Hợp đồng không ở trạng thái quá hạn.')
    const now = new Date()
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, lastReminderAt: now.toISOString(), remindersSent: (item.remindersSent || 0) + 1 } : item), activities: [{ id: `act-${Date.now()}`, action: 'DELINQUENCY_REMINDER_SENT', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `Đã ghi nhận gửi nhắc nợ cho ${rental.customerName}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  const createFacilityTask = (task: Omit<FacilityTask, 'id' | 'createdAt' | 'status'>, manager: User): FacilityTask => {
    assertFacilityManager(manager, task.facilityId, task.facilityName)
    if (!task.title.trim() || !task.dueAt) throw new Error('Nhiệm vụ cần có tiêu đề và hạn xử lý.')
    const created: FacilityTask = { ...task, id: `TSK-${Date.now().toString().slice(-7)}`, title: task.title.trim(), notes: task.notes?.trim(), status: 'open', createdAt: new Date().toISOString() }
    setState(prev => ({ ...prev, staffTasks: [created, ...prev.staffTasks], activities: [{ id: `act-${Date.now()}`, action: 'FACILITY_TASK_CREATED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: task.facilityId, entityType: 'task', entityId: created.id, notes: `Tạo nhiệm vụ "${created.title}"${created.assignedStaffName ? ` cho ${created.assignedStaffName}` : ''}.`, timestamp: created.createdAt }, ...prev.activities] }))
    return created
  }

  const updateFacilityTask = (taskId: string, updates: Partial<Pick<FacilityTask, 'assignedStaffId' | 'assignedStaffName' | 'dueAt' | 'priority' | 'status' | 'notes'>>, manager: User) => {
    const task = state.staffTasks.find(item => item.id === taskId)
    if (!task) throw new Error('Không tìm thấy nhiệm vụ.')
    assertFacilityManager(manager, task.facilityId, task.facilityName)
    const now = new Date()
    setState(prev => ({ ...prev, staffTasks: prev.staffTasks.map(item => item.id === taskId ? { ...item, ...updates, completedAt: updates.status === 'completed' ? now.toISOString() : item.completedAt } : item), activities: [{ id: `act-${Date.now()}`, action: 'FACILITY_TASK_UPDATED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: task.facilityId, entityType: 'task', entityId: taskId, notes: updates.status === 'completed' ? 'Nhiệm vụ đã hoàn tất.' : `Cập nhật nhiệm vụ${updates.assignedStaffName ? ` cho ${updates.assignedStaffName}` : ''}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  // 10. Operations Config & Support Tickets
  const updateBusinessConfig = (newConfig: Partial<BusinessConfig>, actor: User) => {
    if (actor.role !== 'manager' && actor.role !== 'admin') throw new Error('Chỉ Manager hoặc Admin được cập nhật cấu hình vận hành.')
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...newConfig }
    }))
  }

  const respondSupportTicket = (ticketId: string, replyText: string, status: TicketItem['status'], staffUser: User) => {
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager' && staffUser.role !== 'admin') throw new Error('Chỉ nhân viên cơ sở được cập nhật yêu cầu hỗ trợ.')
    if (!replyText.trim()) throw new Error('Vui lòng nhập nội dung phản hồi.')
    const ticket = state.tickets.find(item => item.id === ticketId)
    if (!ticket) throw new Error('Không tìm thấy yêu cầu hỗ trợ.')
    if (staffUser.facility && staffUser.facility !== 'All facilities' && staffUser.facility !== ticket.facility && staffUser.facility !== ticket.facilityId) throw new Error('Bạn không có quyền xử lý yêu cầu của cơ sở khác.')
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => {
        if (t.id !== ticketId) return t
        const nextStatus: TicketItem['status'] = status === 'open' ? 'in-progress' : status
        const newMsg = replyText.trim()
          ? {
              id: `msg-${Date.now()}`,
              sender: staffUser.name,
              role: 'staff' as const,
              time: now,
              text: replyText.trim()
            }
          : null
        return {
          ...t,
          status: nextStatus,
          assignedStaff: staffUser.name,
          updatedAt: now,
          messages: newMsg ? [...t.messages, newMsg] : t.messages
        }
      })
    }))
  }

  const createSupportTicket = (ticket: Omit<TicketItem, 'id' | 'created' | 'messages'>, initialMessage: string) => {
    if (!ticket.subject.trim() || !initialMessage.trim()) throw new Error('Tiêu đề và nội dung yêu cầu là bắt buộc.')
    const id = `TKT-${Date.now().toString(36).toUpperCase()}`
    const now = new Date().toISOString()
    const newTicket: TicketItem = {
      ...ticket,
      id,
      created: now,
      updatedAt: now,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: ticket.customer,
          role: 'customer',
          time: now,
          text: initialMessage
        }
      ]
    }
    setState(prev => ({
      ...prev,
      tickets: [newTicket, ...prev.tickets]
    }))
  }

  const registerCustomer = ({ name, email, phone = '' }: { name: string; email: string; phone?: string }): User => {
    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone.trim()
    if (!normalizedName || !normalizedEmail) throw new Error('Vui lòng điền đầy đủ thông tin đăng ký.')

    const existing = state.users.find(item => item.email.toLowerCase() === normalizedEmail)
    if (existing) {
      if (existing.role !== 'customer') throw new Error('Email này đã được công ty cấp cho tài khoản nội bộ.')
      return {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: 'customer',
        facility: existing.facility
      }
    }

    const created = {
      id: `customer-${Date.now().toString(36)}`,
      name: normalizedName,
      email: normalizedEmail,
      role: 'customer' as const,
      facility: undefined,
      phone: normalizedPhone,
      status: 'active',
      joined: new Date().toISOString().slice(0, 10)
    } as StoredUser

    setState(prev => ({ ...prev, users: [created, ...prev.users] }))
    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: 'customer',
      facility: created.facility
    }
  }

  const resetToDemoData = () => {
    localStorage.removeItem(STORAGE_KEY)
    setState({
      users: USERS,
      facilities: INITIAL_FACILITIES,
      units: INITIAL_UNITS,
      holds: INITIAL_RESERVATIONS,
      contracts: INITIAL_CONTRACTS,
      payments: [],
      checkins: INITIAL_CHECKINS,
      rentals: INITIAL_RENTALS,
      returns: INITIAL_RETURNS,
      renewals: [],
      maintenanceTasks: [],
      staffTasks: [],
      accessCredentials: [],
      activities: INITIAL_ACTIVITIES,
      tickets: TICKETS,
      config: DEFAULT_BUSINESS_CONFIG
    })
  }

  const calculateDIMAndQuote = (
    unit: StorageUnit,
    goods: {
      lengthCm: number
      widthCm: number
      heightCm: number
      weightKg: number
      packageCount: number
    }
  ): PricingQuote => {
    const dimDivisor = state.config.dimDivisor || 5000
    const dimWeightKg = Math.ceil((goods.lengthCm * goods.widthCm * goods.heightCm * goods.packageCount) / dimDivisor)
    const actualWeightKg = goods.weightKg
    const billableWeightKg = Math.max(actualWeightKg, dimWeightKg)
    const baseMonthlyPrice = unit.price
    const depositAmount = unit.deposit || unit.price
    const dimSurcharge = 0
    const totalFirstPayment = baseMonthlyPrice + depositAmount + dimSurcharge

    return {
      quoteId: `QUO-${Date.now().toString().slice(-4)}`,
      unitId: unit.id,
      facilityId: unit.facilityId,
      baseMonthlyPrice,
      depositAmount,
      dimSurcharge,
      totalFirstPayment,
      dimWeightKg,
      actualWeightKg,
      billableWeightKg,
      dimDivisor,
      quotedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const payStorageHold = (holdId: string, paymentMethod: string = 'Chuyển khoản VietQR') => {
    const paidAt = new Date()
    const checkInDeadline = new Date(paidAt.getTime() + 14 * 24 * 60 * 60 * 1000)
    const targetHold = state.holds.find(hold => hold.id === holdId)
    if (!targetHold) throw new Error('Không tìm thấy đơn đặt giữ kho.')
    if (!targetHold.emailVerification?.verified) throw new Error('Bạn cần xác minh email trước khi thanh toán.')
    const paidStatus = transitionReservation(targetHold.status as ReservationStatus, 'PAY_DEPOSIT')
    if (!targetHold.appointmentDate || !targetHold.appointmentTime) throw new Error('Đơn chưa có lịch Check-in hợp lệ.')
    const scheduledDate = toValidDate(targetHold.appointmentDate)
    if (scheduledDate.getTime() > checkInDeadline.getTime()) throw new Error('Lịch Check-in phải nằm trong 14 ngày sau khi thanh toán cọc. Vui lòng đổi lịch trước khi thanh toán.')
    setState(prev => ({
      ...prev,
      holds: prev.holds.map(h => {
        if (h.id === holdId) {
          const isAssigned = !!h.assignedUnitId
          return {
            ...h,
            status: isAssigned ? 'UNIT_RESERVED' : paidStatus,
            depositPaidAt: paidAt.toISOString(),
            checkInDeadline: checkInDeadline.toISOString(),
            payment: {
              amount: h.reservationDepositAmount,
              status: 'paid',
              method: paymentMethod,
              paidAt: paidAt.toISOString(),
              transactionId: `TX-DEP-${Date.now().toString().slice(-6)}`
            }
          }
        }
        return h
      }),
      payments: (() => {
        const hold = prev.holds.find(h => h.id === holdId)
        if (!hold || hold.payment.status === 'paid') return prev.payments
        const transactionId = `TX-DEP-${Date.now().toString().slice(-6)}`
        return [{
          id: transactionId,
          reservationId: hold.id,
          type: 'RESERVATION_DEPOSIT' as const,
          amount: hold.reservationDepositAmount,
          paymentMethod: 'ONLINE_GATEWAY' as const,
          transactionReference: transactionId,
          status: 'PAID' as const,
          paidAt: paidAt.toISOString(),
          recordedBy: hold.customerId
        }, ...prev.payments]
      })()
    }))
  }

  const replySupportTicket = (ticketId: string, replyText: string, customer: User) => {
    if (customer.role !== 'customer') throw new Error('Chỉ Customer được phản hồi từ cổng khách hàng.')
    if (!replyText.trim()) throw new Error('Vui lòng nhập nội dung tin nhắn.')
    const ticket = state.tickets.find(item => item.id === ticketId)
    if (!ticket || (ticket.email !== customer.email && ticket.customer !== customer.name)) throw new Error('Không tìm thấy yêu cầu hỗ trợ thuộc tài khoản này.')
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(item => item.id === ticketId ? {
        ...item,
        status: item.status === 'resolved' ? 'open' : item.status,
        updatedAt: now,
        messages: [...item.messages, { id: `msg-${Date.now()}`, sender: customer.name, role: 'customer' as const, time: now, text: replyText.trim() }]
      } : item)
    }))
  }

  const confirmReturnSettlement = (returnId: string, customer: User, decision: 'accepted' | 'disputed', note?: string) => {
    const returnCase = state.returns.find(r => r.id === returnId)
    if (!returnCase || returnCase.customerId !== customer.id) throw new Error('Không tìm thấy hồ sơ trả kho thuộc tài khoản này.')
    if (returnCase.status !== 'awaiting_customer_confirmation') throw new Error('Hồ sơ chưa sẵn sàng để xác nhận quyết toán.')
    const rental = state.rentals.find(r => r.id === returnCase.rentalId)
    const unit = state.units.find(u => u.id === returnCase.unitId)
    if (!rental || !unit) throw new Error('Không tìm thấy hợp đồng hoặc gian kho.')
    const now = new Date()

    if (decision === 'disputed') {
      setState(prev => ({
        ...prev,
        returns: prev.returns.map(r => r.id === returnId ? { ...r, status: 'disputed', customerDecision: 'disputed', customerDecisionNote: note?.trim() || 'Khách hàng yêu cầu xem xét lại quyết toán.' } : r),
        activities: [{ id: `act-${Date.now()}`, action: 'RETURN_SETTLEMENT_DISPUTED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: note?.trim() || 'Khách hàng yêu cầu xem xét lại quyết toán.', timestamp: now.toLocaleString('vi-VN') }, ...prev.activities]
      }))
      return
    }

    const refundId = `RF-${Date.now().toString().slice(-8)}`
    const refundPayment: StoragePayment = {
      id: refundId,
      reservationId: rental.holdId,
      rentalId: rental.id,
      type: 'REFUND',
      amount: returnCase.netRefundAmount,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: refundId,
      status: 'PENDING',
      recordedBy: 'SYSTEM'
    }
    const amountDueFromCustomer = returnCase.amountDueFromCustomer ?? 0
    const needsMaintenance = returnCase.proposedUnitStatus === 'maintenance'
    const maintenanceTask: MaintenanceTask = {
      id: `MNT-${Date.now().toString().slice(-6)}`,
      unitId: unit.id,
      facilityId: unit.facilityId,
      reason: needsMaintenance
        ? (returnCase.staffNotes || 'Xử lý hiện trạng sau trả kho')
        : 'Manager nghiệm thu cuối, xác nhận vệ sinh và điều kiện vận hành trước khi mở lại kho.',
      damageClassification: returnCase.damageClassification,
      status: 'pending',
      createdAt: now.toISOString()
    }

    setState(prev => ({
      ...prev,
      payments: returnCase.netRefundAmount > 0 ? [refundPayment, ...prev.payments] : prev.payments,
      units: prev.units.map(u => u.id === unit.id ? { ...u, status: 'maintenance', currentRentalId: undefined, reservedPeriods: (u.reservedPeriods || []).filter(period => period.reservationId !== rental.holdId), nextAvailableDate: undefined } : u),
      holds: prev.holds.map(hold => hold.id === rental.holdId ? { ...hold, generatedAccessPin: undefined } : hold),
      rentals: prev.rentals.map(r => r.id === rental.id ? { ...r, status: amountDueFromCustomer > 0 ? 'closing' : 'completed', gateCode: '', checkedOutAt: amountDueFromCustomer > 0 ? undefined : now.toISOString(), accessRevokedAt: now.toISOString() } : r),
      returns: prev.returns.map(r => r.id === returnId ? { ...r, status: amountDueFromCustomer > 0 ? 'payment_due' : returnCase.netRefundAmount > 0 ? 'refund_pending' : 'completed', customerConfirmed: true, customerConfirmedAt: now.toISOString(), customerDecision: 'accepted', customerDecisionNote: note?.trim(), completedAt: amountDueFromCustomer > 0 || returnCase.netRefundAmount > 0 ? undefined : now.toISOString() } : r),
      accessCredentials: prev.accessCredentials.map(ac => ac.rentalId === rental.id ? { ...ac, status: 'REVOKED', revokedAt: now.toISOString() } : ac),
      maintenanceTasks: prev.maintenanceTasks.some(task => task.unitId === unit.id && task.status !== 'completed') ? prev.maintenanceTasks : [maintenanceTask, ...prev.maintenanceTasks],
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_SETTLEMENT_CONFIRMED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: `${amountDueFromCustomer > 0 ? `Khách xác nhận quyết toán và cần đóng thêm $${amountDueFromCustomer} do tổng phí vượt tiền đảm bảo.` : returnCase.netRefundAmount > 0 ? `Khách hàng xác nhận quyết toán. Chờ Staff xác nhận chuyển hoàn cọc $${returnCase.netRefundAmount}.` : 'Khách hàng xác nhận quyết toán; không phát sinh khoản hoàn cọc.'} Gian kho chuyển sang chờ Manager nghiệm thu trước khi mở lại.`, timestamp: now.toLocaleString('vi-VN') }, ...prev.activities]
    }))
  }

  const payReturnBalance = (returnId: string, customer: User, paymentMethod: 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionReference: string) => {
    const returnCase = state.returns.find(item => item.id === returnId)
    if (!returnCase || returnCase.customerId !== customer.id || returnCase.status !== 'payment_due') throw new Error('Không tìm thấy khoản quyết toán trả kho cần thanh toán.')
    const amountDue = returnCase.amountDueFromCustomer ?? 0
    if (amountDue <= 0) throw new Error('Hồ sơ không còn khoản phải đóng thêm.')
    if (!transactionReference.trim()) throw new Error('Thiếu mã giao dịch thanh toán.')
    const rental = state.rentals.find(item => item.id === returnCase.rentalId)
    if (!rental) throw new Error('Không tìm thấy hồ sơ thuê liên quan.')
    const now = new Date()
    const paymentId = `PAY-RET-BAL-${Date.now().toString().slice(-8)}`
    const payment: StoragePayment = { id: paymentId, reservationId: rental.holdId, rentalId: rental.id, type: 'DAMAGE_FEE', amount: amountDue, paymentMethod, transactionReference: transactionReference.trim(), status: 'PAID', paidAt: now.toISOString(), recordedBy: customer.id, description: `Thanh toán phần quyết toán trả kho vượt tiền đảm bảo: $${amountDue}` }
    setState(prev => ({
      ...prev,
      payments: [payment, ...prev.payments],
      rentals: prev.rentals.map(item => item.id === rental.id ? { ...item, status: 'completed', checkedOutAt: now.toISOString(), accessRevokedAt: item.accessRevokedAt || now.toISOString(), gateCode: '' } : item),
      returns: prev.returns.map(item => item.id === returnId ? { ...item, status: 'completed', settlementPaymentId: paymentId, settlementPaidAt: now.toISOString(), completedAt: now.toISOString() } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_BALANCE_PAID', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: returnCase.facilityId, entityType: 'payment', entityId: paymentId, notes: `Khách đã thanh toán thêm $${amountDue} do quyết toán trả kho vượt tiền đảm bảo. Mã giao dịch: ${transactionReference.trim()}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const completeReturnRefund = (returnId: string, staffUser: User, transactionReference: string) => {
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager' && staffUser.role !== 'admin') throw new Error('Chỉ nhân viên cơ sở được xác nhận chuyển hoàn cọc.')
    const returnCase = state.returns.find(item => item.id === returnId)
    if (!returnCase || returnCase.status !== 'refund_pending') throw new Error('Hồ sơ không ở trạng thái chờ hoàn cọc.')
    if (staffUser.role === 'manager' || staffUser.role === 'admin') assertFacilityManager(staffUser, returnCase.facilityId, returnCase.facilityName)
    if (staffUser.role === 'staff' && staffUser.facility && staffUser.facility !== 'All facilities' && staffUser.facility !== returnCase.facilityName && staffUser.facility !== returnCase.facilityId) throw new Error('Bạn không có quyền xử lý hồ sơ của cơ sở khác.')
    if (!transactionReference.trim()) throw new Error('Vui lòng nhập mã giao dịch hoàn cọc.')
    const refundPayment = state.payments.find(item => item.rentalId === returnCase.rentalId && item.type === 'REFUND' && item.status === 'PENDING')
    if (!refundPayment) throw new Error('Không tìm thấy lệnh hoàn cọc đang chờ xử lý.')
    const now = new Date()
    setState(prev => ({
      ...prev,
      payments: prev.payments.map(item => item.id === refundPayment.id ? { ...item, status: 'PAID', transactionReference: transactionReference.trim(), paidAt: now.toISOString(), receivedBy: staffUser.id, recordedBy: staffUser.id } : item),
      returns: prev.returns.map(item => item.id === returnId ? { ...item, status: 'completed', completedAt: now.toISOString(), refundTransaction: { id: refundPayment.id, type: 'refund', amount: item.netRefundAmount, status: 'paid', recordedAt: now.toISOString() } } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_REFUND_COMPLETED', actorId: staffUser.id, actorName: staffUser.name, actorRole: staffUser.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: `Đã chuyển hoàn cọc $${returnCase.netRefundAmount}. Mã giao dịch: ${transactionReference.trim()}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const reviewReturnDispute = (returnId: string, manager: User, resolutionNote?: string) => {
    const returnCase = state.returns.find(r => r.id === returnId)
    if (!returnCase || returnCase.status !== 'disputed') throw new Error('Không tìm thấy hồ sơ khiếu nại đang chờ xử lý.')
    assertFacilityManager(manager, returnCase.facilityId, returnCase.facilityName)
    const now = new Date()
    setState(prev => ({
      ...prev,
      returns: prev.returns.map(r => r.id === returnId ? { ...r, status: 'awaiting_customer_confirmation', staffNotes: `${r.staffNotes || ''}${r.staffNotes ? ' · ' : ''}Manager: ${resolutionNote?.trim() || 'Đã rà soát và giữ nguyên quyết toán.'}` } : r),
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_DISPUTE_REVIEWED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: resolutionNote?.trim() || 'Manager đã rà soát và gửi lại quyết toán cho khách.', timestamp: now.toLocaleString('vi-VN') }, ...prev.activities]
    }))
  }

  const verifyHoldEmail = (holdId: string, token: string): boolean => {
    let success = false
    setState(prev => ({
      ...prev,
      holds: prev.holds.map(h => {
        if (h.id === holdId && h.status === 'awaiting_email' && h.emailVerification) {
          const isExpired = new Date(h.emailVerification.expiresAt).getTime() <= Date.now()
          if (!isExpired && h.emailVerification.token === token.trim()) {
            success = true
            return {
              ...h,
              status: transitionReservation(h.status as ReservationStatus, 'VERIFY_EMAIL'),
              emailVerification: {
                ...h.emailVerification,
                verified: true,
                verifiedAt: new Date().toISOString()
              }
            }
          }
        }
        return h
      })
    }))
    return success
  }

  const resendHoldEmail = (holdId: string) => {
    const newToken = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(6, '0').slice(-6)
    setState(prev => ({
      ...prev,
      holds: prev.holds.map(h => {
        if (h.id === holdId) {
          return {
            ...h,
            emailVerification: {
              token: newToken,
              verified: false,
              sentAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              attemptCount: (h.emailVerification?.attemptCount || 0) + 1
            }
          }
        }
        return h
      })
    }))
    return newToken
  }

  const scheduleCheckIn = (holdId: string, appointmentDate: string, appointmentTime: string) => {
    setState(prev => {
      const reservation = prev.holds.find(h => h.id === holdId)
      if (!reservation) return prev
      if (!appointmentTime) throw new Error('Vui lòng chọn khung giờ Check-in.')
      const requestedDate = toValidDate(appointmentDate)
      requestedDate.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const paidAt = reservation.depositPaidAt || reservation.payment.paidAt
      const deadline = reservation.checkInDeadline
        ? toValidDate(reservation.checkInDeadline)
        : new Date(toValidDate(paidAt || reservation.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000)
      deadline.setHours(23, 59, 59, 999)
      if (requestedDate < today || requestedDate > deadline) {
        throw new Error(`Lịch Check-in phải từ hôm nay đến ${toDateInputValue(deadline)} (trong 14 ngày sau khi đóng cọc).`)
      }
      const nextEndDate = addCalendarMonths(appointmentDate, reservation.rentalMonths)
      if (reservation.assignedUnitId) {
        const hasConflict = prev.holds.some(h => h.id !== holdId && h.assignedUnitId === reservation.assignedUnitId && ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) && checkDateOverlap(appointmentDate, nextEndDate, h.startDate, h.endDate)) || prev.rentals.some(r => r.unitId === reservation.assignedUnitId && r.status === 'active' && checkDateOverlap(appointmentDate, nextEndDate, r.startDate, r.endDate))
        if (hasConflict) throw new Error('Lịch mới xung đột với khoảng thuê khác của gian kho đã phân. Vui lòng chọn ngày khác.')
      }
      const existingCheckin = prev.checkins.find(c => c.holdId === holdId)
      const nextCheckins = existingCheckin
        ? prev.checkins.map(c => c.holdId === holdId ? { ...c, scheduledDate: appointmentDate, scheduledTime: appointmentTime } : c)
        : reservation.assignedUnitId
          ? [{ id: `CHK-${Date.now().toString().slice(-6)}`, holdId: reservation.id, unitId: reservation.assignedUnitId, facilityId: reservation.facilityId, customerId: reservation.customerId, customerName: reservation.customerName, staffId: '', staffName: 'Chưa phân công', scheduledDate: appointmentDate, scheduledTime: appointmentTime, status: 'scheduled' as const, checklist: { identityVerified: false, termsAccepted: false, paymentConfirmed: reservation.payment.status === 'paid', unitWalkthrough: false, accessCodeIssued: false }, actualMeasurements: { lengthCm: reservation.goods.lengthCm, widthCm: reservation.goods.widthCm, heightCm: reservation.goods.heightCm, weightKg: reservation.goods.weightKg, actualVolumeM3: (reservation.goods.lengthCm * reservation.goods.widthCm * reservation.goods.heightCm * reservation.goods.packageCount) / 1000000, varianceAccepted: false }, initialCondition: '', evidencePhotos: [] }, ...prev.checkins]
          : prev.checkins
      return {
        ...prev,
        holds: prev.holds.map(h => {
        if (h.id === holdId) {
          return {
            ...h,
            appointmentDate,
            appointmentTime,
            moveInDate: appointmentDate,
            startDate: appointmentDate,
            endDate: nextEndDate
          }
        }
        return h
        }),
        checkins: nextCheckins,
        units: prev.units.map(unit => unit.id === reservation.assignedUnitId ? { ...unit, reservedPeriods: (unit.reservedPeriods || []).map(period => period.reservationId === holdId ? { ...period, startDate: appointmentDate, endDate: nextEndDate } : period), nextAvailableDate: nextEndDate } : unit)
      }
    })
  }

  const archiveReservationHistory = (reservationId: string, customer: User) => {
    const reservation = state.holds.find(item => item.id === reservationId)
    if (!reservation || (reservation.customerId !== customer.id && reservation.customerEmail !== customer.email)) throw new Error('Không tìm thấy lịch sử giữ kho thuộc tài khoản này.')
    const linkedRental = state.rentals.find(item => item.holdId === reservationId)
    const canArchive = ['CANCELLED', 'EXPIRED'].includes(reservation.status) || (reservation.status === 'COMPLETED' && linkedRental?.status === 'completed')
    if (!canArchive) throw new Error('Chỉ có thể xóa khỏi danh sách những hồ sơ giữ kho đã hết hiệu lực.')
    setState(prev => ({ ...prev, holds: prev.holds.map(item => item.id === reservationId ? { ...item, customerArchivedAt: new Date().toISOString() } : item) }))
  }

  const archiveRentalHistory = (rentalId: string, customer: User) => {
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental || (rental.customerId !== customer.id && rental.customerEmail !== customer.email)) throw new Error('Không tìm thấy hồ sơ thuê thuộc tài khoản này.')
    if (rental.status !== 'completed') throw new Error('Chỉ có thể xóa khỏi danh sách hồ sơ thuê đã hết hiệu lực.')
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, customerArchivedAt: new Date().toISOString() } : item) }))
  }

  const archiveContractHistory = (contractId: string, customer: User) => {
    const contract = state.contracts.find(item => item.id === contractId)
    if (!contract || contract.customerId !== customer.id) throw new Error('Không tìm thấy hợp đồng thuộc tài khoản này.')
    const rental = state.rentals.find(item => item.contractId === contract.id || item.holdId === contract.reservationId)
    if (!rental || rental.status !== 'completed') throw new Error('Chỉ có thể xóa khỏi danh sách hợp đồng đã hết hiệu lực.')
    setState(prev => ({ ...prev, contracts: prev.contracts.map(item => item.id === contractId ? { ...item, customerArchivedAt: new Date().toISOString() } : item) }))
  }

  const contextValue: StorageHubContextValue = {
    ...state,
    unitTypes: UNIT_TYPES,
    calculateDIMAndQuote,
    payStorageHold,
    verifyHoldEmail,
    resendHoldEmail,
    scheduleCheckIn,
    validateAndCreateReservation,
    approveReservation,
    assignUnitToHold,
    cancelReservation,
    archiveReservationHistory,
    archiveRentalHistory,
    archiveContractHistory,
    expireReservation,
    signPaperContract,
    recordRemainingPayment,
    payRemainingBalance,
    completeCheckIn,
    confirmUnitReceipt,
    requestRenewal,
    updateRenewalRequest,
    cancelRenewalRequest,
    approveRenewal,
    rejectRenewal,
    payRenewal,
    completeRenewalAtFacility,
    expireRenewalPayment,
    requestReturn,
    completeReturnInspection,
    confirmReturnSettlement,
    payReturnBalance,
    completeReturnRefund,
    reviewReturnDispute,
    createMaintenanceTask,
    completeMaintenanceTask,
    releaseMaintenanceUnit,
    updateUnitStatus,
    recordRentalPayment,
    applyRentalLateFee,
    waiveRentalLateFee,
    setRentalOverlock,
    sendDelinquencyReminder,
    createFacilityTask,
    updateFacilityTask,
    updateBusinessConfig,
    respondSupportTicket,
    replySupportTicket,
    createSupportTicket,
    registerCustomer,
    resetToDemoData
  }

  return <StorageHubContext.Provider value={contextValue}>{children}</StorageHubContext.Provider>
}

export function useStorageHub() {
  const ctx = useContext(StorageHubContext)
  if (!ctx) {
    throw new Error('useStorageHub must be used within StorageHubProvider')
  }
  return ctx
}
