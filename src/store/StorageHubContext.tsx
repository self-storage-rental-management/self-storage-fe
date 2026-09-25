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
import type { PermissionKey, Role, RolePermissionsState, User, LoginHistoryRecord, SessionRecord, SecurityAlert, ProfileChangeRequest } from '../types'
import { FACILITIES, UNITS, USERS, TICKETS, LOGIN_HISTORY, UNIT_SPECS, type TicketItem } from '../data/demoDatabase'
import { transitionReservation } from '../domain/reservationFlow'
import { isFacilityVisible } from '../domain/managerRules'
import { formatVnd, USD_TO_VND_RATE } from '../i18n/currency'
import { normalizeRolePermissions } from '../auth/rbac'

const STORAGE_KEY = 'storagehub:v5:released-orphan-holds'

const createRecordId = (prefix: string) => {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${random}`
}

const clientSecurityContext = () => ({
  ip: 'Không xác định từ trình duyệt',
  location: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Không xác định' : 'Không xác định',
  device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 140) : 'Không xác định'
})

type CompanyRole = Exclude<User['role'], 'customer'>
type AccountStatus = 'active' | 'inactive' | 'suspended'
type StoredUser = (typeof USERS)[number] & {
  passwordResetAt?: string
  mustChangePassword?: boolean
}

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
      const provisionedRole = (['staff', 'manager', 'business', 'admin'] as const).find(role => id.startsWith(`${role}-`))

      return {
        ...candidate,
        id,
        name: candidate.name,
        email: candidate.email,
        // Unknown self-registered accounts are always customers. Company
        // roles can only come from the provisioned account record/backend.
        role: seeded?.role ?? provisionedRole ?? 'customer',
        facility: seeded?.facility ?? candidate.facility,
        facilityId: seeded?.facilityId ?? candidate.facilityId,
      } as StoredUser
    })
    .filter((candidate): candidate is StoredUser => candidate !== null)
}

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  dimDivisor: 5000,
  gracePeriodDays: 0,
  lateFeeAmount: 25,
  defaultDepositRatio: 0.2,
  holdExpiryHours: 1 / 6
}

// 4 Standard Unit Types based on Metric DIM (m, m², m³)
export const UNIT_TYPES: UnitType[] = [
  {
    id: 'small',
    name: 'Small Storage',
    lengthM: 8,
    widthM: 10,
    heightM: 5,
    areaM2: 80,
    volumeM3: 400,
    pricePerM3: (5_500_000 / 26_000) / 400,
    monthlyPrice: 5_500_000 / 26_000,
    maxLoadKg: 1000,
    descriptionVi: 'Phù hợp: đồ gia dụng, thiết bị văn phòng và hàng hóa đóng kiện (80 m²)',
    descriptionEn: 'Fits household goods, office equipment and boxed inventory (80 m²)'
  },
  {
    id: 'medium',
    name: 'Medium Storage',
    lengthM: 12.6,
    widthM: 10.4,
    heightM: 5,
    areaM2: 131.04,
    volumeM3: 655.2,
    pricePerM3: (9_500_000 / 26_000) / 655.2,
    monthlyPrice: 9_500_000 / 26_000,
    maxLoadKg: 1600,
    descriptionVi: 'Phù hợp: đồ đạc gia đình, thiết bị văn phòng và hàng kinh doanh (131,04 m²)',
    descriptionEn: 'Fits household furniture, office equipment and business inventory (131.04 m²)'
  },
  {
    id: 'large',
    name: 'Large Storage',
    lengthM: 18.3,
    widthM: 10.8,
    heightM: 5,
    areaM2: 197.64,
    volumeM3: 988.2,
    pricePerM3: (15_000_000 / 26_000) / 988.2,
    monthlyPrice: 15_000_000 / 26_000,
    maxLoadKg: 2800,
    descriptionVi: 'Phù hợp: đồ chuyển nhà, pallet và tồn kho kinh doanh (197,64 m²)',
    descriptionEn: 'Fits relocation goods, pallets and business inventory (197.64 m²)'
  },
  {
    id: 'xlarge',
    name: 'Extra Large Commercial',
    lengthM: 25,
    widthM: 11.2,
    heightM: 5,
    areaM2: 280,
    volumeM3: 1400,
    pricePerM3: (22_500_000 / 26_000) / 1400,
    monthlyPrice: 22_500_000 / 26_000,
    maxLoadKg: 4000,
    descriptionVi: 'Phù hợp: kho thương mại, pallet số lượng lớn và máy móc (280 m²)',
    descriptionEn: 'Fits commercial pallets, high-volume inventory and machinery (280 m²)'
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
  if (user.role === 'admin' || isFacilityVisible(user, facilityId, facilityName)) return
  throw new Error('Bạn không có quyền thao tác dữ liệu của cơ sở khác.')
}

function unitMatchesReservation(unit: StorageUnit, reservation: StorageReservation) {
  const expected = reservation.unitTypeId.toLowerCase().replace('xlarge', 'extra large')
  const actual = unit.type.toLowerCase()
  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual)
}

// Map demo facilities
const INITIAL_FACILITIES: Facility[] = FACILITIES.map(f => ({
  id: f.id,
  code: f.code,
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

const LEGACY_FACILITY_NAMES: Record<string, string> = {
  'Downtown Storage': 'Kho Việt – Cơ sở Quận 1',
  'Riverside Storage': 'Kho Việt – Cơ sở Bình Dương'
}

const findCanonicalFacility = (facilityId?: string, facilityName?: string) => {
  const normalizedName = facilityName ? LEGACY_FACILITY_NAMES[facilityName] || facilityName : undefined
  return INITIAL_FACILITIES.find(item => item.id === facilityId || item.code === facilityId || item.name === normalizedName)
}

const normalizeStoredFacilities = (facilities: Facility[]): Facility[] => {
  if (!Array.isArray(facilities) || facilities.length === 0) return INITIAL_FACILITIES
  return facilities.map(stored => {
    const canonical = findCanonicalFacility(stored.id, stored.name) || findCanonicalFacility(stored.code, stored.name)
    if (!canonical) return stored
    return {
      ...canonical,
      ...stored,
      id: canonical.id,
      code: stored.code || canonical.code,
      name: stored.name || canonical.name,
      address: stored.address || canonical.address,
      city: stored.city || canonical.city,
      price: stored.price || canonical.price
    }
  })
}

const normalizeStoredTickets = (tickets: TicketItem[]): TicketItem[] => tickets.map(ticket => ({
  ...ticket,
  facility: ticket.facility === 'Downtown Storage' ? 'Kho Việt – Cơ sở Quận 1' : ticket.facility === 'Riverside Storage' ? 'Kho Việt – Cơ sở Bình Dương' : ticket.facility
}))

// Map demo units to typed StorageUnit using purely metric dimensions
const INITIAL_UNITS: StorageUnit[] = UNITS.map((u, idx) => {
  const facilityId = u.customerCode?.startsWith('HCM-Q1-F01') ? 'fac-001' : 'fac-002'
  let lengthM = u.dimensionsM?.[0] ?? 1.5
  let widthM = u.dimensionsM?.[1] ?? 1.5
  let heightM = u.dimensionsM?.[2] ?? 2.8
  let volumeM3 = u.volumeM3 ?? 6.3
  let price = u.price ?? 89
  let maxLoadKg = u.maxLoadKg ?? 600
  let areaM2 = u.areaM2 ?? 2.25
  if (u.type === 'Medium') {
    lengthM = u.dimensionsM?.[0] ?? 3.0; widthM = u.dimensionsM?.[1] ?? 2.0; heightM = u.dimensionsM?.[2] ?? 2.5; volumeM3 = u.volumeM3 ?? 15.0; price = u.price ?? 150; maxLoadKg = u.maxLoadKg ?? 1200; areaM2 = u.areaM2 ?? 6.0
  } else if (u.type === 'Large') {
    lengthM = u.dimensionsM?.[0] ?? 4.0; widthM = u.dimensionsM?.[1] ?? 3.0; heightM = u.dimensionsM?.[2] ?? 2.5; volumeM3 = u.volumeM3 ?? 30.0; price = u.price ?? 270; maxLoadKg = u.maxLoadKg ?? 2400; areaM2 = u.areaM2 ?? 12.0
  } else if (u.type === 'Extra Large') {
    lengthM = u.dimensionsM?.[0] ?? 6.0; widthM = u.dimensionsM?.[1] ?? 3.0; heightM = u.dimensionsM?.[2] ?? 2.5; volumeM3 = u.volumeM3 ?? 45.0; price = u.price ?? 360; maxLoadKg = u.maxLoadKg ?? 3600; areaM2 = u.areaM2 ?? 18.0
  }

  // Customer catalog is normalized from the approved spreadsheet. Keep the
  // monetary state in base currency because formatVnd performs the conversion.
  const canonicalTypeId = u.type === 'Small' ? 'small' : u.type === 'Medium' ? 'medium' : u.type === 'Large' ? 'large' : 'xlarge'
  const canonicalType = UNIT_TYPES.find(item => item.id === canonicalTypeId)!
  lengthM = canonicalType.lengthM
  widthM = canonicalType.widthM
  heightM = canonicalType.heightM
  areaM2 = canonicalType.areaM2
  volumeM3 = canonicalType.volumeM3
  price = canonicalType.monthlyPrice
  maxLoadKg = canonicalType.maxLoadKg

  // Customer test inventory: demo reservations lock their selected physical units; every other unit is bookable.
  const isReservedDemo = u.id === 'A-104' || u.id === 'B-112'
  const demoRentalByUnit: Record<string, string> = {
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
  } else if (u.id === 'B-112') {
    reservedPeriods.push({
      reservationId: 'RSV-2049',
      customerName: 'Hoang Van Bach',
      startDate: '2026-09-22',
      endDate: '2026-12-22'
    })
  }

  return {
    id: u.id,
    code: u.customerCode || u.id,
    facilityId,
    facilityName: u.facility,
    floor: u.floor,
    zone: `Khu ${String.fromCharCode(65 + (idx % 4))}`,
    type: u.type as any,
    areaM2,
    dimensions: { lengthM, widthM, heightM },
    doorDimensions: { widthM: 2, heightM: 2.4 },
    volumeM3,
    maxLoadKg,
    allowedGoods: ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
    prohibitedGoods: ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
    price,
    deposit: price,
    climate: u.climate,
    status: isOccupiedDemo ? 'occupied' : 'available',
    reservedPeriods,
    nextAvailableDate: u.id === 'A-104' ? '2027-03-21' : u.id === 'B-112' ? '2026-12-23' : u.id === 'B-208' ? '2027-01-13' : undefined,
    currentRentalId: demoRentalByUnit[u.id],
    version: 1
  }
})

// Keep runtime state (status, reservations, next available date) while
// upgrading older browser snapshots to the current Customer catalog metadata.
const normalizeStoredUnits = (units: StorageUnit[]): StorageUnit[] => {
  if (!Array.isArray(units) || units.length === 0) return INITIAL_UNITS
  return units.map(stored => {
    const canonical = INITIAL_UNITS.find(unit => unit.id === stored.id || unit.code === stored.code)
    if (!canonical) return stored
    return {
      ...canonical,
      ...stored,
      id: canonical.id,
      code: canonical.code,
      facilityId: canonical.facilityId,
      facilityName: canonical.facilityName,
      type: canonical.type,
      areaM2: canonical.areaM2,
      dimensions: canonical.dimensions,
      doorDimensions: canonical.doorDimensions,
      volumeM3: canonical.volumeM3,
      maxLoadKg: canonical.maxLoadKg,
      price: stored.price ?? canonical.price,
      deposit: stored.deposit ?? canonical.deposit
    }
  })
}

const DEMO_SMALL_MONTHLY = UNIT_TYPES.find(item => item.id === 'small')!.monthlyPrice
const DEMO_MEDIUM_MONTHLY = UNIT_TYPES.find(item => item.id === 'medium')!.monthlyPrice

// Initial reservations demonstrating the canonical lifecycle. The values use
// the same metric catalog and monthly prices shown on Customer's browse-units.
const INITIAL_RESERVATIONS: StorageReservation[] = [
  {
    id: 'RSV-2048',
    customerId: 'cust-demo-1',
    customerName: 'Nguyen Minh Anh',
    customerEmail: 'anh.nguyen@outlook.com',
    customerPhone: '090 123 4567',
    identityId: '079203001234',
    facilityId: 'fac-001',
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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
    reservationDepositAmount: Math.round(DEMO_SMALL_MONTHLY * 6 * 0.2 * 100) / 100,
    securityDepositAmount: DEMO_SMALL_MONTHLY,
    depositConvertedAt: '2026-09-17T10:00:00Z',
    remainingAmount: 0,
    firstMonthRent: DEMO_SMALL_MONTHLY,
    totalInitialAmount: DEMO_SMALL_MONTHLY * 7,
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
      baseMonthlyPrice: DEMO_SMALL_MONTHLY,
      depositAmount: DEMO_SMALL_MONTHLY,
      dimSurcharge: 0,
      totalFirstPayment: DEMO_SMALL_MONTHLY * 7,
      dimWeightKg: 67,
      actualWeightKg: 180,
      billableWeightKg: 180,
      dimDivisor: 5000,
      quotedAt: '2026-09-17T08:30:00Z',
      expiresAt: '2026-09-21T08:30:00Z'
    },
    payment: {
      amount: Math.round(DEMO_SMALL_MONTHLY * 6 * 0.2 * 100) / 100,
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
    facilityName: 'Kho Việt – Cơ sở Quận 1',
    unitId: 'B-112',
    unitTypeId: 'medium',
    unitTypeName: 'Medium Storage',
    assignedUnitId: 'B-112',
    rentalMonths: 3,
    startDate: '2026-09-22',
    endDate: '2026-12-22',
    moveInDate: '2026-09-22',
    status: 'DEPOSIT_PAID',
    approvalType: 'AUTO',
    reservationDepositAmount: Math.round(DEMO_MEDIUM_MONTHLY * 3 * 0.2 * 100) / 100,
    securityDepositAmount: DEMO_MEDIUM_MONTHLY,
    remainingAmount: Math.round((DEMO_MEDIUM_MONTHLY * 3 * 0.8 + DEMO_MEDIUM_MONTHLY) * 100) / 100,
    firstMonthRent: DEMO_MEDIUM_MONTHLY,
    totalInitialAmount: DEMO_MEDIUM_MONTHLY * 4,
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
      baseMonthlyPrice: DEMO_MEDIUM_MONTHLY,
      depositAmount: DEMO_MEDIUM_MONTHLY,
      dimSurcharge: 0,
      totalFirstPayment: DEMO_MEDIUM_MONTHLY * 4,
      dimWeightKg: 36,
      actualWeightKg: 90,
      billableWeightKg: 90,
      dimDivisor: 5000,
      quotedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 11 * 60 * 1000).toISOString()
    },
    payment: {
      amount: Math.round(DEMO_MEDIUM_MONTHLY * 3 * 0.2 * 100) / 100,
      status: 'paid',
      method: 'Cọc giữ chỗ qua VietQR',
      transactionId: 'TX-DEP-2049',
      paidAt: new Date().toISOString()
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    evidence: ['RSV-2049 · Đã cọc giữ chỗ 20%, gian kho đã được xác định từ lúc đặt'],
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
    unitId: 'HCM-Q1-F01-M-003',
    facilityId: 'fac-001',
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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
    contractId: 'CTR-TEST-RENEW-BEFORE-2D',
    initialCondition: 'Dữ liệu kiểm thử: hợp đồng còn đúng 2 ngày trước khi hết hạn.',
    evidencePhotos: ['TEST · Gia hạn trước hạn 2 ngày']
  },
  {
    id: 'RNT-TEST-RENEW-AFTER-2D',
    holdId: 'RSV-TEST-RENEW-AFTER-2D',
    unitId: 'HCM-Q1-F01-M-004',
    facilityId: 'fac-001',
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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
    id: 'RNT-CUSTOMER-UPCOMING-02', holdId: 'RSV-CUSTOMER-UPCOMING-02', unitId: 'B-112',
    facilityId: 'fac-001', facilityName: 'Kho Việt – Cơ sở Quận 1', customerId: 'demo-customer',
    customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456',
    unitType: 'Medium Storage', areaM2: 6, volumeM3: 15,
    startDate: demoDateOffset(-28), endDate: demoDateOffset(2), nextDue: demoDateOffset(2),
    monthlyRate: 2200000 / 26000, deposit: 2200000 / 26000, securityDeposit: 2200000 / 26000,
    status: 'active', paymentStatus: 'paid', autoRenew: false, gateCode: '4202#',
    initialCondition: 'Hồ sơ kiểm thử: hợp đồng còn đúng 2 ngày.', evidencePhotos: ['TEST · Sắp hết hạn sau 2 ngày'],
    receiptConfirmedAt: new Date().toISOString(), receiptConfirmedBy: 'demo-customer'
  },
  {
    id: 'RNT-CUSTOMER-OVERDUE-02', holdId: 'RSV-CUSTOMER-OVERDUE-02', unitId: 'A-115',
    facilityId: 'fac-002', facilityName: 'Kho Việt – Cơ sở Bình Dương', customerId: 'demo-customer',
    customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456',
    unitType: 'Small Storage', areaM2: 2.25, volumeM3: 6.3,
    startDate: demoDateOffset(-32), endDate: demoDateOffset(-2), nextDue: demoDateOffset(-2),
    monthlyRate: 850000 / 26000, deposit: 850000 / 26000, securityDeposit: 850000 / 26000,
    status: 'active', paymentStatus: 'overdue', autoRenew: false, gateCode: '5202#',
    initialCondition: 'Hồ sơ kiểm thử: hợp đồng đã hết hạn đúng 2 ngày.', evidencePhotos: ['TEST · Đã hết hạn 2 ngày'],
    receiptConfirmedAt: new Date().toISOString(), receiptConfirmedBy: 'demo-customer'
  }
]

const RETIRED_EXPIRY_TEST_RENTAL_IDS = new Set(RENEWAL_TEST_RENTALS.map(rental => rental.id))
const RETIRED_EXPIRY_TEST_RESERVATION_IDS = new Set(RENEWAL_TEST_RENTALS.map(rental => rental.holdId))
const mergeRenewalTestRentals = (rentals: RentalRecord[]) => rentals.filter(rental => !RETIRED_EXPIRY_TEST_RENTAL_IDS.has(rental.id))

// Older browser snapshots may contain a facility display name copied from a
// customer profile. The physical unit is the authoritative source for the
// facility, so reconcile persisted rentals before renewal filtering/approval.
const normalizeRentalFacilities = (rentals: RentalRecord[]) => rentals.map(rental => {
  const unit = INITIAL_UNITS.find(item => item.id === rental.unitId || item.code === rental.unitId)
  if (unit) return { ...rental, unitId: unit.id, facilityId: unit.facilityId, facilityName: unit.facilityName }
  const facility = findCanonicalFacility(rental.facilityId, rental.facilityName)
  return facility ? { ...rental, facilityId: facility.id, facilityName: facility.name } : rental
})

const INITIAL_RENTALS: RentalRecord[] = [
  {
    id: 'RNT-INIT-PREV',
    holdId: 'RSV-INIT-PREV',
    unitId: 'C-301',
    facilityId: 'fac-001',
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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
  { id: 'RET-TEST-DEDUCT', rentalId: 'RNT-TEST-RETURN-DEDUCT', unitId: 'A-105', facilityId: 'fac-001', facilityName: 'Kho Việt – Cơ sở Quận 1', customerId: 'demo-customer', customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456', requestedAt: new Date().toISOString(), scheduledDate: demoDateOffset(0), status: 'requested', initialConditionSnapshot: 'Kho sạch, khóa và tường nguyên vẹn.', packageCount: 4, initialWeightKg: 40, damageFee: 0, outstandingFee: 0, depositAmount: 89, netRefundAmount: 89, evidence: ['TEST · Khấu trừ phí trễ trong tiền đảm bảo'], customerConfirmed: false },
  { id: 'RET-TEST-EXCESS', rentalId: 'RNT-TEST-RETURN-EXCESS', unitId: 'A-106', facilityId: 'fac-001', facilityName: 'Kho Việt – Cơ sở Quận 1', customerId: 'demo-customer', customerName: 'Demo Customer', customerEmail: 'customer@storagehub.demo', customerPhone: '+84 908 123 456', requestedAt: new Date().toISOString(), scheduledDate: demoDateOffset(0), status: 'requested', initialConditionSnapshot: 'Kho sạch, khóa và tường nguyên vẹn.', packageCount: 4, initialWeightKg: 40, damageFee: 0, outstandingFee: 0, depositAmount: 89, netRefundAmount: 89, evidence: ['TEST · Phí trễ vượt tiền đảm bảo'], customerConfirmed: false }
]

const mergeReturnTestCases = (returns: ReturnCase[]) => [...RETURN_TEST_CASES.filter(sample => !returns.some(item => item.id === sample.id)), ...returns]

const INITIAL_RETURNS: ReturnCase[] = [
  ...RETURN_TEST_CASES,
  {
    id: 'RET-118',
    rentalId: 'RNT-INIT-PREV',
    unitId: 'C-301',
    facilityId: 'fac-001',
    facilityName: 'Kho Việt – Cơ sở Quận 1',
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

const mergeRenewalTestContracts = (contracts: StorageContract[]) => contracts.filter(contract => !RETIRED_EXPIRY_TEST_RESERVATION_IDS.has(contract.reservationId))

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
    monthlyRent: DEMO_SMALL_MONTHLY,
    securityDeposit: DEMO_SMALL_MONTHLY,
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
    notes: `Khách hàng đặt cỡ kho Small Storage, cọc giữ chỗ 20% (${formatVnd(36)}) thành công.`,
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
    notes: 'Gian A-104 đã được khách chọn cho đơn RSV-2048 (20/09/2026 - 20/03/2027).',
    timestamp: '2026-09-17 09:00:00'
  }
]

const INITIAL_LOGIN_HISTORY: LoginHistoryRecord[] = LOGIN_HISTORY.map(item => ({
  id: item.id,
  userId: USERS.find(user => user.email === item.email)?.id,
  user: item.user,
  email: item.email,
  role: item.role as Role,
  timestamp: item.time,
  ip: item.ip,
  location: item.location,
  device: item.device,
  status: item.status === 'failed' ? 'failed' : 'success',
  suspicious: item.status === 'failed',
  reason: item.status === 'failed' ? 'Thông tin xác thực không hợp lệ.' : undefined
}))

const INITIAL_SESSIONS: SessionRecord[] = INITIAL_LOGIN_HISTORY
  .filter(item => item.status === 'success' && item.userId)
  .map(item => ({
    id: `session-${item.id}`,
    userId: item.userId!,
    userName: item.user,
    email: item.email,
    role: item.role || 'customer',
    createdAt: item.timestamp,
    lastSeenAt: item.timestamp,
    ip: item.ip,
    location: item.location,
    device: item.device,
    status: 'active'
  }))

const INITIAL_SECURITY_ALERTS: SecurityAlert[] = INITIAL_LOGIN_HISTORY
  .filter(item => item.suspicious)
  .map(item => ({
    id: `alert-${item.id}`,
    userId: item.userId,
    email: item.email,
    type: 'failed_login_burst',
    severity: 'warning',
    message: `Đăng nhập thất bại cho ${item.email} từ ${item.location}.`,
    createdAt: item.timestamp
  }))

const INITIAL_PROFILE_CHANGE_REQUESTS: ProfileChangeRequest[] = []

interface StorageHubState {
  users: StoredUser[]
  rolePermissions: RolePermissionsState
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
  loginHistory: LoginHistoryRecord[]
  sessions: SessionRecord[]
  securityAlerts: SecurityAlert[]
  profileChangeRequests: ProfileChangeRequest[]
  tickets: TicketItem[]
  config: BusinessConfig
}

interface StorageHubContextValue extends StorageHubState {
  unitTypes: UnitType[]
  can: (actor: User | Role, permission: PermissionKey) => boolean
  updateRolePermissions: (role: Role, permissions: Partial<Record<PermissionKey, boolean>>, actor: User) => void
  recordLoginAttempt: (params: { email: string; userId?: string; success: boolean; reason?: string }) => void
  startSession: (user: User) => string
  endSession: (sessionId: string, user: User) => void
  revokeSession: (sessionId: string, actor: User) => boolean
  revokeAllUserSessions: (userId: string, actor: User) => number
  updateCustomerProfile: (updates: { name: string; email: string; phone?: string }, customer: User) => void
  requestOwnPasswordReset: (customer: User) => void
  submitProfileChangeRequest: (params: { requestedFields: string[]; reason: string }, requester: User) => ProfileChangeRequest
  deleteOwnCustomerAccount: (customer: User) => void
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
  payStorageHold: (holdId: string, paymentMethod: string | undefined, customer: User) => void
  verifyHoldEmail: (holdId: string, token: string, customer: User) => boolean
  resendHoldEmail: (holdId: string, customer: User) => string
  scheduleCheckIn: (holdId: string, appointmentDate: string, appointmentTime: string, customer: User) => void
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
    capacityValidatedByFrames?: boolean
    discountAmount?: number
    customerCatalogUnit?: { id: string; facilityName: string; doorWidthM: number; doorHeightM: number; physicalUnitId?: string }
  }) => ReservationValidationResult
  approveReservation: (reservationId: string, reviewer: User) => void
  rejectGoodsReview: (reservationId: string, reviewer: User, note: string) => void
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
  }) => void
  confirmUnitReceipt: (reservationId: string, customer: User) => void
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
  createSupportTicket: (ticket: Omit<TicketItem, 'id' | 'created' | 'messages'>, initialMessage: string, customer: User) => void
  deleteResolvedSupportTicket: (ticketId: string, customer: User) => void
  registerCustomer: (params: { name: string; email: string; phone?: string }) => User
  createInternalAccount: (params: { name: string; email: string; phone?: string; role: CompanyRole; facility?: string }, actor: User) => User
  createCustomerSupportAccount: (params: { name: string; email: string; phone?: string; facility?: string; reason: string }, actor: User) => User
  updateUserAccount: (userId: string, updates: { name: string; email: string; phone?: string; role?: CompanyRole; facility?: string; status?: AccountStatus }, actor: User) => void
  setUserAccountStatus: (userId: string, status: AccountStatus, actor: User) => void
  deleteUserAccount: (userId: string, actor: User) => void
  requestUserPasswordReset: (userId: string, actor: User) => void
  resetToDemoData: () => void
  // Facility & Unit CRUD
  createFacility: (data: Partial<Facility>, actor?: User) => Facility
  updateFacility: (facilityId: string, updates: Partial<Facility>, actor?: User) => void
  deleteFacility: (facilityId: string, actor?: User) => { success: boolean; reason?: string }
  createUnit: (data: Partial<StorageUnit>, actor?: User) => StorageUnit
  updateUnit: (unitId: string, updates: Partial<StorageUnit>, actor?: User) => void
  deleteUnit: (unitId: string, actor?: User) => { success: boolean; reason?: string }
}

const StorageHubContext = createContext<StorageHubContextValue | null>(null)

const normalizeReservationPricing = (hold: StorageReservation): StorageReservation => {
  const normalizedTypeValue = (hold.unitTypeId || hold.unitTypeName || '').toLowerCase().replace(/[-_]/g, ' ').trim()
  const canonicalType = normalizedTypeValue
    ? UNIT_TYPES.find(item => item.id === hold.unitTypeId || item.name.toLowerCase() === normalizedTypeValue || item.name.toLowerCase().startsWith(normalizedTypeValue))
    : undefined
  const canonicalAssignedUnit = hold.assignedUnitId
    ? INITIAL_UNITS.find(item => item.id === hold.assignedUnitId || item.code === hold.assignedUnitId)
    : undefined
  const normalizedHold = {
    ...hold,
    unitTypeId: canonicalType?.id || hold.unitTypeId,
    unitTypeName: canonicalType?.name || hold.unitTypeName,
    assignedUnitId: canonicalAssignedUnit?.id || hold.assignedUnitId
  }
  if (!canonicalType) return normalizedHold
  const storedMonthlyRent = normalizedHold.firstMonthRent || normalizedHold.quote.baseMonthlyPrice
  const monthlyRent = canonicalType?.monthlyPrice || storedMonthlyRent
  const shouldReprice = Boolean(Math.abs(monthlyRent - storedMonthlyRent) > 0.01 && !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(normalizedHold.status))
  const grossRentalTermAmount = monthlyRent * normalizedHold.rentalMonths
  const discountAmount = Math.min(grossRentalTermAmount, Math.max(0, normalizedHold.discountAmount || 0))
  const rentalTermAmount = grossRentalTermAmount - discountAmount
  const securityDepositAmount = shouldReprice ? monthlyRent : (normalizedHold.securityDepositAmount || monthlyRent)
  const expectedTotal = rentalTermAmount + securityDepositAmount
  if (!shouldReprice && (normalizedHold.remainingAmount <= 0 || Math.abs((normalizedHold.totalInitialAmount || 0) - expectedTotal) <= 0.01)) return normalizedHold

  const calculatedBookingDeposit = Math.round(rentalTermAmount * 0.2 * 100) / 100
  const bookingDeposit = shouldReprice || normalizedHold.payment.status !== 'paid' ? calculatedBookingDeposit : normalizedHold.reservationDepositAmount
  const isPaidInFull = normalizedHold.payment.status === 'paid' && normalizedHold.remainingAmount <= 0
  return {
    ...normalizedHold,
    reservationDepositAmount: bookingDeposit,
    discountAmount,
    securityDepositAmount,
    remainingAmount: isPaidInFull ? 0 : rentalTermAmount - bookingDeposit + securityDepositAmount,
    totalInitialAmount: rentalTermAmount + securityDepositAmount,
    firstMonthRent: monthlyRent,
    quote: {
      ...normalizedHold.quote,
      baseMonthlyPrice: monthlyRent,
      depositAmount: securityDepositAmount,
      totalFirstPayment: rentalTermAmount + securityDepositAmount
    },
    payment: shouldReprice && normalizedHold.payment.status === 'paid'
      ? { ...normalizedHold.payment, amount: bookingDeposit }
      : normalizedHold.payment
  }
}

const reconcileReservationCheckins = (holds: StorageReservation[], records: CheckInRecord[]): CheckInRecord[] => {
  const normalized = records.map(normalizeCheckin)
  const existingHoldIds = new Set(normalized.map(record => record.holdId))
  const recovered = holds
    .filter(hold => hold.assignedUnitId && hold.payment.status === 'paid' && hold.appointmentDate && hold.appointmentTime && !existingHoldIds.has(hold.id) && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status))
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
        const normalizedHolds = Array.isArray(parsed.holds) ? parsed.holds.filter((hold: StorageReservation) => !['RSV-6618', 'RSV-2104', 'RSV-9654'].includes(hold.id)).map((hold: StorageReservation) => {
            const facility = findCanonicalFacility(hold.facilityId, hold.facilityName)
            return normalizeReservationPricing({
              ...hold,
              facilityId: facility?.id || hold.facilityId,
              facilityName: facility?.name || hold.facilityName,
              appointmentDate: hold.appointmentDate || hold.moveInDate,
              appointmentTime: hold.appointmentTime || '09:00'
            })
          }) : INITIAL_RESERVATIONS
        return {
          ...parsed,
          facilities: Array.isArray(parsed.facilities) && parsed.facilities.length ? normalizeStoredFacilities(parsed.facilities as Facility[]) : INITIAL_FACILITIES,
          users: normalizeUsers(parsed.users),
          rolePermissions: normalizeRolePermissions(parsed.rolePermissions),
          units: (Array.isArray(parsed.units) ? normalizeStoredUnits(parsed.units as StorageUnit[]) : INITIAL_UNITS).map(unit => unit.currentRentalId === 'RNT-9654' || (unit.currentRentalId && RETIRED_EXPIRY_TEST_RENTAL_IDS.has(unit.currentRentalId)) ? { ...unit, status: 'available' as const, currentRentalId: undefined, reservedPeriods: (unit.reservedPeriods || []).filter(period => period.reservationId !== 'RSV-9654' && !RETIRED_EXPIRY_TEST_RESERVATION_IDS.has(period.reservationId)) } : unit),
          holds: normalizedHolds,
          contracts: Array.isArray(parsed.contracts) ? mergeRenewalTestContracts(parsed.contracts.filter((contract: StorageContract) => contract.reservationId !== 'RSV-9654')) : INITIAL_CONTRACTS,
payments: Array.isArray(parsed.payments) ? parsed.payments.filter((payment: StoragePayment) => payment.reservationId !== 'RSV-9654' && !RETIRED_EXPIRY_TEST_RESERVATION_IDS.has(payment.reservationId) && payment.rentalId !== 'RNT-9654' && (!payment.rentalId || !RETIRED_EXPIRY_TEST_RENTAL_IDS.has(payment.rentalId))) : [],
renewals: Array.isArray(parsed.renewals)
  ? parsed.renewals.filter((renewal: RenewalRecord) => !RETIRED_EXPIRY_TEST_RENTAL_IDS.has(renewal.rentalId)).map((renewal: RenewalRecord) => {
      const rental = Array.isArray(parsed.rentals)
        ? parsed.rentals.find(
            (item: RentalRecord) => item.id === renewal.rentalId
          )
        : undefined
      const unit = INITIAL_UNITS.find(
        item => item.id === (rental?.unitId || renewal.unitId)
      )

      return {
        ...renewal,
        renewalMonths: renewal.renewalMonths || 1,
        facilityId:
          unit?.facilityId || rental?.facilityId || renewal.facilityId
      }
    })
  : [],
maintenanceTasks: parsed.maintenanceTasks || [],
staffTasks: parsed.staffTasks || [],
accessCredentials: Array.isArray(parsed.accessCredentials) ? parsed.accessCredentials.filter((credential: AccessCredential) => credential.reservationId !== 'RSV-9654' && (!credential.reservationId || !RETIRED_EXPIRY_TEST_RESERVATION_IDS.has(credential.reservationId)) && credential.rentalId !== 'RNT-9654' && (!credential.rentalId || !RETIRED_EXPIRY_TEST_RENTAL_IDS.has(credential.rentalId))) : [],
checkins: reconcileReservationCheckins(normalizedHolds, Array.isArray(parsed.checkins) ? parsed.checkins.filter((checkin: CheckInRecord) => checkin.holdId !== 'RSV-9654') : []),
rentals: Array.isArray(parsed.rentals)
  ? mergeRenewalTestRentals(normalizeRentalFacilities(parsed.rentals.filter((rental: RentalRecord) => rental.id !== 'RNT-9654' && rental.holdId !== 'RSV-9654')))
  : INITIAL_RENTALS,
          returns: Array.isArray(parsed.returns) ? parsed.returns.filter((returnCase: ReturnCase) => !RETIRED_EXPIRY_TEST_RENTAL_IDS.has(returnCase.rentalId)) : [],
          activities: Array.isArray(parsed.activities) ? parsed.activities.filter((activity: ActivityRecord) => !['RSV-9654', 'RNT-9654'].includes(activity.entityId) && !RETIRED_EXPIRY_TEST_RENTAL_IDS.has(activity.entityId) && !RETIRED_EXPIRY_TEST_RESERVATION_IDS.has(activity.entityId)) : INITIAL_ACTIVITIES,
          loginHistory: Array.isArray(parsed.loginHistory) ? parsed.loginHistory : INITIAL_LOGIN_HISTORY,
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : INITIAL_SESSIONS,
          securityAlerts: Array.isArray(parsed.securityAlerts) ? parsed.securityAlerts : INITIAL_SECURITY_ALERTS,
          profileChangeRequests: Array.isArray(parsed.profileChangeRequests) ? parsed.profileChangeRequests : INITIAL_PROFILE_CHANGE_REQUESTS,
          tickets: Array.isArray(parsed.tickets) ? normalizeStoredTickets(parsed.tickets as TicketItem[]) : TICKETS,
          config: parsed.config || DEFAULT_BUSINESS_CONFIG
        }
      }
    } catch (e) {
      console.error('Failed to load storageHub state from localStorage', e)
    }
    return {
      users: USERS,
      rolePermissions: normalizeRolePermissions(undefined),
      facilities: INITIAL_FACILITIES,
      units: INITIAL_UNITS,
      holds: [],
      contracts: [],
      payments: [],
      checkins: [],
      rentals: INITIAL_RENTALS,
      returns: [],
      renewals: [],
      maintenanceTasks: [],
      staffTasks: [],
      accessCredentials: [],
      activities: INITIAL_ACTIVITIES,
      loginHistory: INITIAL_LOGIN_HISTORY,
      sessions: INITIAL_SESSIONS,
      securityAlerts: INITIAL_SECURITY_ALERTS,
      profileChangeRequests: INITIAL_PROFILE_CHANGE_REQUESTS,
      tickets: TICKETS,
      config: DEFAULT_BUSINESS_CONFIG
    }
  })

  const assertCanonicalAdmin = (actor: User): StoredUser => {
    const canonicalActor = state.users.find(item => item.id === actor.id)
    if (!canonicalActor || canonicalActor.role !== 'admin' || canonicalActor.status !== 'active') {
      throw new Error('Chỉ Admin đang hoạt động được quản lý tài khoản.')
    }
    if (!state.rolePermissions.admin.manage_users) {
      throw new Error('Quyền quản lý tài khoản của Admin đang bị tắt.')
    }
    return canonicalActor
  }

  const updateRolePermissions = (role: Role, permissions: Partial<Record<PermissionKey, boolean>>, actor: User) => {
    const canonicalActor = assertPermission(actor, 'manage_roles')
    const current = state.rolePermissions[role]
    const next = { ...current }
    for (const key of Object.keys(permissions) as PermissionKey[]) {
      if (typeof permissions[key] === 'boolean') next[key] = permissions[key] as boolean
    }
    if (role === 'admin' && (!next.manage_roles || !next.manage_users)) {
      throw new Error('Không thể tắt quyền quản lý quyền hoặc tài khoản của Admin để tránh tự khóa hệ thống.')
    }
    const timestamp = new Date().toISOString()
    setState(prev => ({
      ...prev,
      rolePermissions: { ...prev.rolePermissions, [role]: next },
      activities: [{
        id: `act-${Date.now()}`,
        action: 'ROLE_PERMISSIONS_UPDATED',
        actorId: canonicalActor.id,
        actorName: canonicalActor.name,
        actorRole: canonicalActor.role,
        facilityId: canonicalActor.facility || 'ALL',
        entityType: 'user',
        entityId: role,
        beforeState: { role, permissions: current },
        afterState: { role, permissions: next },
        notes: `Cập nhật bảng quyền cho vai trò ${role}.`,
        timestamp
      }, ...prev.activities]
    }))
  }

  const recordLoginAttempt = ({ email, userId, success, reason }: { email: string; userId?: string; success: boolean; reason?: string }) => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return
    const account = state.users.find(item => item.id === userId || item.email.toLowerCase() === normalizedEmail)
    const timestamp = new Date().toISOString()
    const metadata = clientSecurityContext()
    const recentFailures = state.loginHistory.filter(item => {
      if (item.email !== normalizedEmail || item.status !== 'failed') return false
      const eventTime = Date.parse(item.timestamp)
      return Number.isFinite(eventTime) && Date.now() - eventTime <= 15 * 60 * 1000
    }).length
    const suspicious = !success && recentFailures >= 2
    const event: LoginHistoryRecord = {
      id: createRecordId('login'),
      userId: account?.id || userId,
      user: account?.name || 'Không xác định',
      email: normalizedEmail,
      role: account?.role as Role | undefined,
      timestamp,
      ...metadata,
      status: success ? 'success' : 'failed',
      reason: success ? undefined : reason || 'Thông tin xác thực không hợp lệ.',
      suspicious
    }
    const alert: SecurityAlert | null = suspicious ? {
      id: createRecordId('alert'),
      userId: account?.id || userId,
      email: normalizedEmail,
      type: 'failed_login_burst',
      severity: 'critical',
      message: `Phát hiện ${recentFailures + 1} lần đăng nhập thất bại trong 15 phút cho ${normalizedEmail}.`,
      createdAt: timestamp
    } : null
    setState(prev => ({
      ...prev,
      loginHistory: [event, ...prev.loginHistory],
      securityAlerts: alert ? [alert, ...prev.securityAlerts] : prev.securityAlerts
    }))
  }

  const startSession = (user: User): string => {
    const canonical = resolveCanonicalActor(user)
    const sessionId = createRecordId('session')
    const timestamp = new Date().toISOString()
    const metadata = clientSecurityContext()
    const hasKnownDevice = state.sessions.some(item => item.userId === canonical.id && item.device === metadata.device && item.location === metadata.location)
    const session: SessionRecord = {
      id: sessionId,
      userId: canonical.id,
      userName: canonical.name,
      email: canonical.email,
      role: canonical.role as Role,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      ...metadata,
      status: 'active'
    }
    const alert: SecurityAlert | null = !hasKnownDevice && state.sessions.some(item => item.userId === canonical.id) ? {
      id: createRecordId('alert'),
      userId: canonical.id,
      email: canonical.email,
      type: 'unknown_device',
      severity: 'warning',
      message: `Tài khoản ${canonical.email} vừa mở phiên từ thiết bị hoặc vị trí mới.`,
      createdAt: timestamp
    } : null
    setState(prev => ({
      ...prev,
      sessions: [session, ...prev.sessions],
      securityAlerts: alert ? [alert, ...prev.securityAlerts] : prev.securityAlerts
    }))
    return sessionId
  }

  const endSession = (sessionId: string, user: User) => {
    const canonical = resolveCanonicalActor(user)
    const session = state.sessions.find(item => item.id === sessionId && item.userId === canonical.id)
    if (!session || session.status !== 'active') return
    const timestamp = new Date().toISOString()
    const event: LoginHistoryRecord = {
      id: createRecordId('logout'),
      userId: canonical.id,
      user: canonical.name,
      email: canonical.email,
      role: canonical.role as Role,
      timestamp,
      ...clientSecurityContext(),
      status: 'logout'
    }
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(item => item.id === sessionId ? { ...item, status: 'signed_out', lastSeenAt: timestamp } : item),
      loginHistory: [event, ...prev.loginHistory]
    }))
  }

  const revokeSession = (sessionId: string, actor: User): boolean => {
    const session = state.sessions.find(item => item.id === sessionId)
    if (!session || session.status !== 'active') return false
    const target = state.users.find(item => item.id === session.userId)
    if (!target) throw new Error('Không tìm thấy tài khoản của phiên đăng nhập.')
    const canonicalActor = actor.id === session.userId ? resolveCanonicalActor(actor) : assertCanonicalAdmin(actor)
    const timestamp = new Date().toISOString()
    const revokedSession = { ...session, status: 'revoked' as const, revokedAt: timestamp, lastSeenAt: timestamp }
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(item => item.id === sessionId ? revokedSession : item),
      activities: [{
        id: createRecordId('act'),
        action: 'SESSION_REVOKED',
        actorId: canonicalActor.id,
        actorName: canonicalActor.name,
        actorRole: canonicalActor.role,
        facilityId: target.facility || 'ALL',
        entityType: 'user',
        entityId: target.id,
        beforeState: session,
        afterState: revokedSession,
        notes: `Thu hồi phiên ${session.id} của ${target.email}.`,
        timestamp
      }, ...prev.activities]
    }))
    return true
  }

  const revokeAllUserSessions = (userId: string, actor: User): number => {
    const target = state.users.find(item => item.id === userId)
    if (!target) throw new Error('Không tìm thấy tài khoản.')
    const canonicalActor = actor.id === userId ? resolveCanonicalActor(actor) : assertCanonicalAdmin(actor)
    const activeSessions = state.sessions.filter(item => item.userId === userId && item.status === 'active')
    if (!activeSessions.length) return 0
    const timestamp = new Date().toISOString()
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(item => item.userId === userId && item.status === 'active' ? { ...item, status: 'revoked', revokedAt: timestamp, lastSeenAt: timestamp } : item),
      activities: [{
        id: createRecordId('act'),
        action: 'ALL_SESSIONS_REVOKED',
        actorId: canonicalActor.id,
        actorName: canonicalActor.name,
        actorRole: canonicalActor.role,
        facilityId: target.facility || 'ALL',
        entityType: 'user',
        entityId: userId,
        beforeState: activeSessions,
        afterState: activeSessions.map(session => ({ ...session, status: 'revoked', revokedAt: timestamp, lastSeenAt: timestamp })),
        notes: `Đăng xuất toàn bộ ${activeSessions.length} phiên của ${target.email}.`,
        timestamp
      }, ...prev.activities]
    }))
    return activeSessions.length
  }

  const toPublicUser = (account: StoredUser): User => ({
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    role: account.role as User['role'],
    facility: account.facility
  })

  const accountSnapshot = (account: StoredUser | null) => account ? {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    facility: account.facility,
    status: account.status,
    phone: account.phone,
    mustChangePassword: account.mustChangePassword ?? false,
    passwordResetAt: account.passwordResetAt
  } : null

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

  const resolveCanonicalActor = (actor: User): StoredUser => {
    const canonical = state.users.find(item => item.id === actor.id)
    if (!canonical || canonical.status !== 'active') throw new Error('Tài khoản không tồn tại hoặc đã bị khóa.')
    return canonical
  }

  const can = (actor: User | Role, permission: PermissionKey): boolean => {
    const role = (typeof actor === 'string'
      ? actor
      : state.users.find(item => item.id === actor.id && item.status === 'active')?.role) as Role | undefined
    if (!role) return false
    return Boolean(state.rolePermissions[role]?.[permission])
  }

  const assertPermission = (actor: User, permission: PermissionKey): StoredUser => {
    const canonical = resolveCanonicalActor(actor)
    if (!state.rolePermissions[canonical.role as Role]?.[permission]) {
      throw new Error(`Vai trò ${canonical.role} không có quyền thực hiện thao tác này.`)
    }
    return canonical
  }

  const assertHoldPermission = (holdId: string, permission: PermissionKey): StorageReservation => {
    const hold = state.holds.find(item => item.id === holdId)
    if (!hold) throw new Error('Không tìm thấy đơn đặt giữ kho.')
    const actor = state.users.find(item => item.id === hold.customerId)
    if (!actor) throw new Error('Không tìm thấy tài khoản khách hàng của đơn đặt giữ kho.')
    assertPermission(toPublicUser(actor), permission)
    return hold
  }

  // Save to localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to persist storageHub state', e)
    }
  }, [state])

  // Release reservations automatically when email verification, goods review,
  // or deposit payment misses its deadline. A server scheduler must enforce the
  // same rule in production; this interval keeps the frontend demo consistent.
  useEffect(() => {
    const expireOverdueReservations = () => {
      const nowMs = Date.now()
      setState(prev => {
        let changed = false
        const holds = prev.holds.map(hold => {
          const emailExpired = hold.status === 'awaiting_email' && Boolean(hold.emailVerification?.expiresAt) && new Date(hold.emailVerification!.expiresAt).getTime() <= nowMs
          const reviewExpired = hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING' && Boolean(hold.goodsReviewDueAt) && new Date(hold.goodsReviewDueAt!).getTime() <= nowMs
          const paymentExpired = hold.status === 'awaiting_payment' && Boolean(hold.paymentExpiresAt) && new Date(hold.paymentExpiresAt!).getTime() <= nowMs
          if (!emailExpired && !reviewExpired && !paymentExpired) return hold
          changed = true
          const reason = emailExpired ? 'quá hạn xác minh email' : reviewExpired ? 'quá 12 giờ chờ duyệt hàng hóa' : 'quá hạn thanh toán tiền cọc'
          return {
            ...hold,
            status: 'EXPIRED' as const,
            depositRequired: false,
            evidence: [...hold.evidence, `EXPIRED · Đơn tự động hết hạn do ${reason}; gian kho được giải phóng.`]
          }
        })
        if (!changed) return prev
        const expiredIds = new Set(holds.filter((hold, index) => hold.status === 'EXPIRED' && prev.holds[index].status !== 'EXPIRED').map(hold => hold.id))
        const units = prev.units.map(unit => {
          const reservedPeriods = (unit.reservedPeriods || []).filter(period => !expiredIds.has(period.reservationId))
          if (reservedPeriods.length === (unit.reservedPeriods || []).length) return unit
          const occupied = Boolean(unit.currentRentalId) || prev.rentals.some(rental => rental.unitId === unit.id && ['active', 'return_requested', 'return_inspection', 'closing'].includes(rental.status))
          return { ...unit, reservedPeriods, status: occupied ? unit.status : reservedPeriods.length ? 'reserved' as const : 'available' as const, nextAvailableDate: reservedPeriods.length ? unit.nextAvailableDate : undefined }
        })
        return { ...prev, holds, units }
      })
    }
    expireOverdueReservations()
    const timer = window.setInterval(expireOverdueReservations, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // Sync state across browser tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          const holds = Array.isArray(parsed.holds) ? parsed.holds.map(normalizeReservationPricing) : []
          const checkins = reconcileReservationCheckins(holds, Array.isArray(parsed.checkins) ? parsed.checkins : [])
          setState({
            ...parsed,
            users: normalizeUsers(parsed.users),
            rolePermissions: normalizeRolePermissions(parsed.rolePermissions),
            units: Array.isArray(parsed.units) ? normalizeStoredUnits(parsed.units as StorageUnit[]) : INITIAL_UNITS,
            holds,
            checkins,
            loginHistory: Array.isArray(parsed.loginHistory) ? parsed.loginHistory : INITIAL_LOGIN_HISTORY,
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : INITIAL_SESSIONS,
            securityAlerts: Array.isArray(parsed.securityAlerts) ? parsed.securityAlerts : INITIAL_SECURITY_ALERTS,
            profileChangeRequests: Array.isArray(parsed.profileChangeRequests) ? parsed.profileChangeRequests : INITIAL_PROFILE_CHANGE_REQUESTS
          })
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
    capacityValidatedByFrames?: boolean
    discountAmount?: number
    customerCatalogUnit?: { id: string; facilityName: string; doorWidthM: number; doorHeightM: number; physicalUnitId?: string }
  }): ReservationValidationResult => {
    assertPermission(params.customer, 'book_storage')
    const unitType = UNIT_TYPES.find(ut => ut.id === params.unitTypeId) || UNIT_TYPES[1]
    const now = new Date()
    const nowTime = now.getTime()

    // Calculate end date based on moveInDate and rentalMonths
    const startDate = params.moveInDate
    const startObj = new Date(startDate)
    const endObj = new Date(startObj)
    endObj.setMonth(endObj.getMonth() + params.rentalMonths)
    const endDate = endObj.toISOString().split('T')[0]

    // Customer đã chọn đúng mã gian kho trên trang browse-units. Chỉ giữ đúng gian
    // đó; không còn để Manager chọn lại một gian khác sau khi khách đặt.
    const requestedPhysicalUnit = params.customerCatalogUnit
      ? state.units.find(unit => unit.id === params.customerCatalogUnit?.physicalUnitId || unit.id === params.customerCatalogUnit?.id || unit.code === params.customerCatalogUnit?.id)
      : undefined

    // Availability check: check units of this type in facility that don't have overlapping reservedPeriods or rentals
    const candidateUnits = state.units.filter(
      u => u.facilityId === params.facilityId && u.type.toLowerCase().includes(unitType.name.split(' ')[0].toLowerCase()) && u.status === 'available'
    )

    const dateAvailableUnits = candidateUnits.filter(u => {
      const overlapsReservedPeriod = (u.reservedPeriods || []).some(period => checkDateOverlap(startDate, endDate, period.startDate, period.endDate))
      // Check if any reservation or rental overlaps on this unit
      const overlapsReservation = state.holds.some(
         h => h.assignedUnitId === u.id && !['CANCELLED', 'EXPIRED', 'COMPLETED', 'awaiting_review'].includes(h.status) && !(h.status === 'awaiting_email' && h.goodsReviewStatus === 'PENDING') &&
             checkDateOverlap(startDate, endDate, h.startDate, h.endDate)
      )
      const overlapsRental = state.rentals.some(
        r => r.unitId === u.id && ['active', 'return_requested', 'return_inspection', 'closing'].includes(r.status) &&
             checkDateOverlap(startDate, endDate, r.startDate, r.endDate)
      )
      return !overlapsReservedPeriod && !overlapsReservation && !overlapsRental
    })
    const unassignedCapacityHolds = state.holds.filter(hold =>
      !hold.assignedUnitId &&
      hold.facilityId === params.facilityId &&
      hold.unitTypeId === unitType.id &&
      (hold.status === 'DEPOSIT_PAID' || (hold.status === 'awaiting_review' && hold.goodsReviewStatus === 'PENDING') || (['awaiting_email', 'awaiting_review', 'awaiting_payment'].includes(hold.status) && Boolean(hold.paymentExpiresAt) && new Date(hold.paymentExpiresAt!).getTime() > nowTime)) &&
      checkDateOverlap(startDate, endDate, hold.startDate, hold.endDate)
    )
    const availableUnit = requestedPhysicalUnit
      ? dateAvailableUnits.find(unit => unit.id === requestedPhysicalUnit.id)
      : dateAvailableUnits[unassignedCapacityHolds.length]

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

    if (!params.capacityValidatedByFrames && (!fitsThroughDoor || boxDoesNotFit || weightExceeds || volumeExceeds)) {
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
    const grossRentalTermAmount = unitType.monthlyPrice * params.rentalMonths
    const discountAmount = Math.min(grossRentalTermAmount, Math.max(0, params.discountAmount || 0))
    const rentalTermAmount = grossRentalTermAmount - discountAmount
    const securityDepositAmount = unitType.monthlyPrice
    const reservationDepositAmount = Math.round(rentalTermAmount * 0.2 * 100) / 100
    const remainingAmount = rentalTermAmount - reservationDepositAmount + securityDepositAmount
    const totalInitialAmount = rentalTermAmount + securityDepositAmount

    const holdId = `RSV-${Date.now().toString().slice(-4)}`
    const quoteId = `QUO-${Date.now().toString().slice(-4)}`
    const requiresGoodsReview = Boolean(params.goods.items?.some(item => item.category === 'OTHER' || item.requiresStaffReview))
    const emailExpiresAt = new Date(nowTime + 10 * 60 * 1000).toISOString()
    const goodsReviewSubmittedAt = undefined
    const goodsReviewDueAt = undefined
    const paymentExpiresAt = requiresGoodsReview ? undefined : emailExpiresAt
    const emailToken = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(6, '0').slice(-6)

    const pricingQuote: PricingQuote = {
      quoteId,
      unitId: availableUnit.id,
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
      expiresAt: paymentExpiresAt || emailExpiresAt
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
      unitId: availableUnit.id,
      unitTypeId: unitType.id,
      unitTypeName: unitType.name,
      assignedUnitId: availableUnit.id,
      rentalMonths: params.rentalMonths,
      startDate,
      endDate,
      moveInDate: params.moveInDate,
      status: 'awaiting_email',
      reservationDepositAmount: requiresGoodsReview ? 0 : reservationDepositAmount,
      securityDepositAmount,
      remainingAmount,
      firstMonthRent,
      totalInitialAmount,
      approvalType: requiresGoodsReview ? 'MANUAL' : 'AUTO',
      discountAmount,
      paymentExpiresAt,
      goodsReviewStatus: requiresGoodsReview ? 'PENDING' : 'NOT_REQUIRED',
      goodsReviewSubmittedAt,
      goodsReviewDueAt,
      depositRequired: !requiresGoodsReview,
      largestItemDimensionsCm: { lengthCm: itemL, widthCm: itemW, heightCm: itemH },
      goods: params.goods,
      quote: pricingQuote,
      payment: {
        amount: requiresGoodsReview ? 0 : reservationDepositAmount,
        status: 'pending'
      },
      emailVerification: {
        token: emailToken,
        verified: false,
        sentAt: now.toISOString(),
        expiresAt: emailExpiresAt,
        attemptCount: 1
      },
      appointmentDate: params.moveInDate,
      appointmentTime: params.appointmentTime,
      expiresAt: paymentExpiresAt || emailExpiresAt,
      evidence: [requiresGoodsReview
        ? `${holdId} · Gian ${availableUnit.code} đã được giữ. Chờ khách xác minh email trước khi gửi Staff duyệt hàng hóa “Khác”.`
        : `${holdId} · Đã xác nhận thông tin và giữ gian ${availableUnit.code}. Chờ thanh toán cọc 20% trước ${paymentExpiresAt}.`],
      createdAt: now.toISOString()
    }

    setState(prev => ({
      ...prev,
      units: prev.units.map(unit => !requiresGoodsReview && unit.id === availableUnit.id
        ? {
            ...unit,
            status: 'reserved',
            reservedPeriods: [...(unit.reservedPeriods || []).filter(period => period.reservationId !== holdId), {
              reservationId: holdId,
              customerName: params.customer.name,
              startDate,
              endDate
            }],
            nextAvailableDate: endDate
          }
        : unit),
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
          notes: requiresGoodsReview
            ? `Khách hàng xác nhận gian ${availableUnit.code}. Chờ xác minh email trước khi Staff duyệt hàng hóa “Khác”, chưa thu cọc.`
            : `Khách hàng xác nhận gian ${availableUnit.code}. Chờ cọc 20% (${formatVnd(reservationDepositAmount)}) trong 10 phút.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))

    return {
      outcome: 'PASS',
      hold: newReservation,
      messageVi: requiresGoodsReview ? 'Kho đã được giữ. Vui lòng xác minh email để gửi hồ sơ hàng hóa cho Staff duyệt.' : 'Kho đã được giữ. Vui lòng xác minh email để chuyển sang bước thanh toán cọc.',
      messageEn: 'Request created. Verify your email before the facility review.'
    }
  }

  const approveReservation = (reservationId: string, reviewer: User) => {
    assertPermission(reviewer, 'approve_reservations')
    const reservation = state.holds.find(item => item.id === reservationId)
    if (!reservation) throw new Error('Không tìm thấy yêu cầu đặt giữ kho.')
    if (reviewer.role !== 'staff' && reviewer.role !== 'manager' && reviewer.role !== 'admin') throw new Error('Chỉ nhân viên cơ sở được phê duyệt yêu cầu.')
    if (reviewer.role === 'manager' || reviewer.role === 'admin') {
      assertFacilityManager(reviewer, reservation.facilityId, reservation.facilityName)
    } else if (!isFacilityVisible(reviewer, reservation.facilityId, reservation.facilityName)) {
      throw new Error('Bạn không có quyền phê duyệt yêu cầu của cơ sở khác.')
    }
    const approvedAt = new Date().toISOString()
    const isGoodsReview = reservation.goodsReviewStatus === 'PENDING'
    if (isGoodsReview && (!reservation.emailVerification?.verified || reservation.status !== 'awaiting_review')) {
      throw new Error('Khách hàng chưa xác minh email; hồ sơ chưa sẵn sàng để duyệt.')
    }
    if (isGoodsReview && reservation.goodsReviewDueAt && new Date(reservation.goodsReviewDueAt).getTime() < Date.now()) {
      throw new Error('Thời hạn duyệt hàng hóa 12 giờ đã hết. Kho đã được giải phóng.')
    }
    if (isGoodsReview) {
      const earlier = state.holds.some(item => item.id !== reservation.id && item.status === 'awaiting_review' && item.goodsReviewStatus === 'PENDING' && item.facilityId === reservation.facilityId && item.unitTypeId === reservation.unitTypeId && item.createdAt < reservation.createdAt && (!item.goodsReviewDueAt || new Date(item.goodsReviewDueAt).getTime() > Date.now()))
      if (earlier) throw new Error('Vui lòng xử lý hồ sơ đến trước theo thứ tự FCFS.')
      const unit = state.units.find(item => item.id === reservation.assignedUnitId)
      if (!unit || unit.status !== 'available' || (unit.reservedPeriods || []).some(period => period.reservationId !== reservation.id && checkDateOverlap(period.startDate, period.endDate, reservation.startDate, reservation.endDate))) {
        throw new Error('Gian kho đã được khách khác giữ. Vui lòng chọn gian kho còn trống trước khi duyệt hồ sơ.')
      }
    }
    const nextStatus = isGoodsReview ? 'awaiting_payment' : transitionReservation(reservation.status as ReservationStatus, 'APPROVE')
    const paymentExpiresAt = isGoodsReview ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : reservation.paymentExpiresAt
    const reservationDepositAmount = isGoodsReview ? Math.round(((reservation.totalInitialAmount || 0) - reservation.securityDepositAmount) * 0.2 * 100) / 100 : reservation.reservationDepositAmount
    setState(prev => ({
      ...prev,
      units: isGoodsReview ? prev.units.map(unit => unit.id === reservation.assignedUnitId ? { ...unit, status: 'reserved' as const, reservedPeriods: [...(unit.reservedPeriods || []), { reservationId, customerName: reservation.customerName, startDate: reservation.startDate, endDate: reservation.endDate }], nextAvailableDate: reservation.endDate } : unit) : prev.units,
      holds: prev.holds.map(item => item.id === reservationId ? {
        ...item,
        status: nextStatus,
        goodsReviewStatus: isGoodsReview ? 'APPROVED' : item.goodsReviewStatus,
        goods: isGoodsReview ? { ...item.goods, items: item.goods.items?.map(goodsItem => goodsItem.requiresStaffReview ? { ...goodsItem, reviewStatus: 'APPROVED' as const } : goodsItem) } : item.goods,
        depositRequired: isGoodsReview ? true : item.depositRequired,
        paymentExpiresAt,
        expiresAt: paymentExpiresAt || item.expiresAt,
        reservationDepositAmount,
        payment: isGoodsReview ? { ...item.payment, amount: reservationDepositAmount } : item.payment,
        reviewedByStaffId: reviewer.id,
        reviewedAt: approvedAt,
        reviewExpiresAt: undefined,
        evidence: [...item.evidence, `APPROVED · ${reviewer.name} đã duyệt hàng hóa lúc ${approvedAt}. Khách được mở bước thanh toán cọc.`]
      } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RESERVATION_APPROVED', actorId: reviewer.id, actorName: reviewer.name, actorRole: reviewer.role, facilityId: reservation.facilityId, entityType: 'hold', entityId: reservation.id, notes: 'Hồ sơ đã được phê duyệt và mở bước thanh toán cọc.', timestamp: approvedAt }, ...prev.activities]
    }))
  }

  const rejectGoodsReview = (reservationId: string, reviewer: User, note: string) => {
    assertPermission(reviewer, 'approve_reservations')
    const reservation = state.holds.find(item => item.id === reservationId)
    if (!reservation || reservation.goodsReviewStatus !== 'PENDING') throw new Error('Không tìm thấy yêu cầu hàng hóa đang chờ duyệt.')
    if (!reservation.emailVerification?.verified || reservation.status !== 'awaiting_review') throw new Error('Khách hàng chưa xác minh email; hồ sơ chưa sẵn sàng để duyệt.')
    if (reviewer.role === 'manager' || reviewer.role === 'admin') {
      assertFacilityManager(reviewer, reservation.facilityId, reservation.facilityName)
    } else if (!isFacilityVisible(reviewer, reservation.facilityId, reservation.facilityName)) {
      throw new Error('Bạn không có quyền xử lý yêu cầu của cơ sở khác.')
    }
    if (reservation.goodsReviewDueAt && new Date(reservation.goodsReviewDueAt).getTime() < Date.now()) {
      throw new Error('Thời hạn duyệt hàng hóa 12 giờ đã hết. Kho đã được giải phóng.')
    }
    const rejectedAt = new Date().toISOString()
    setState(prev => ({
      ...prev,
      units: prev.units.map(unit => {
        if (unit.id !== reservation.assignedUnitId) return unit
        const reservedPeriods = (unit.reservedPeriods || []).filter(period => period.reservationId !== reservation.id)
        const hasCurrentReservation = prev.holds.some(hold => hold.id !== reservation.id && hold.assignedUnitId === unit.id && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(hold.status) && checkDateOverlap(hold.startDate, hold.endDate, reservation.startDate, reservation.endDate))
        const hasActiveRental = prev.rentals.some(rental => rental.unitId === unit.id && ['active', 'return_requested', 'return_inspection', 'closing'].includes(rental.status))
        return { ...unit, status: hasActiveRental ? 'occupied' : hasCurrentReservation ? 'reserved' : 'available', reservedPeriods, nextAvailableDate: reservedPeriods[reservedPeriods.length - 1]?.endDate }
      }),
      holds: prev.holds.map(item => item.id === reservationId ? {
        ...item,
        status: 'CANCELLED',
        goodsReviewStatus: 'REJECTED',
        goods: { ...item.goods, items: item.goods.items?.map(goodsItem => goodsItem.requiresStaffReview ? { ...goodsItem, reviewStatus: 'REJECTED' as const, staffReviewNote: note } : goodsItem) },
        depositRequired: false,
        paymentExpiresAt: undefined,
        staffReviewNotes: note,
        reviewedByStaffId: reviewer.id,
        reviewedAt: rejectedAt,
        reviewExpiresAt: undefined,
        evidence: [...item.evidence, `REJECTED · ${reviewer.name}: ${note}`],
      } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'GOODS_REVIEW_REJECTED', actorId: reviewer.id, actorName: reviewer.name, actorRole: reviewer.role, facilityId: reservation.facilityId, entityType: 'hold', entityId: reservation.id, notes: note, timestamp: rejectedAt }, ...prev.activities]
    }))
  }

  // 2. Facility Manager: Assign specific Unit for date range
  const assignUnitToHold = (reservationId: string, unitId: string, managerUser: User) => {
    assertPermission(managerUser, 'assign_units')
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
      throw new Error(`Gian kho ${unit.code} không còn ở trạng thái còn trống.`)
    }

    // Date-range overlap conflict check
    const reservedPeriodConflict = (unit.reservedPeriods || []).some(period =>
      period.reservationId !== reservationId &&
      checkDateOverlap(reservation.startDate, reservation.endDate, period.startDate, period.endDate)
    )
    const isConflicted = reservedPeriodConflict || state.holds.some(
      h => h.id !== reservationId && h.assignedUnitId === unitId &&
           ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(h.status) &&
           checkDateOverlap(reservation.startDate, reservation.endDate, h.startDate, h.endDate)
    ) || state.rentals.some(
      r => r.unitId === unitId && ['active', 'return_requested', 'return_inspection', 'closing'].includes(r.status) &&
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
    assertPermission(user, 'view_reservations')
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
            notes: `Hủy đơn ${reservation.id}. Kho ${reservation.assignedUnitId || 'N/A'} đã được giải phóng.${reservation.payment.status === 'paid' ? ` Cọc giữ chỗ ${formatVnd(reservation.reservationDepositAmount)} không hoàn lại.` : ''}`,
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
    assertPermission(params.staffUser, 'perform_checkin')
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
            notes: `Nhân viên lưu bản scan hợp đồng ${contract.contractNumber}. Tiền đảm bảo kho: ${formatVnd(contract.securityDeposit)}.`,
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
    assertPermission(staffUser, 'manage_payments')
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager') {
      throw new Error('Chỉ nhân viên cơ sở được ghi nhận thanh toán tại quầy.')
    }
    if (!reservation) throw new Error('Không tìm thấy đơn đặt chỗ.')
    if (paymentDetails.amount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.')
    if (Math.abs(paymentDetails.amount - reservation.remainingAmount) > 0.01) {
      throw new Error(`Số tiền cần thu chính xác là ${formatVnd(reservation.remainingAmount)}, gồm tiền thuê còn lại và tiền đảm bảo kho.`)
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
      description: `Tiền thuê còn lại và tiền đảm bảo kho ${formatVnd(reservation.securityDepositAmount)}`
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
              evidence: [...h.evidence, `PAYMENT_PAID · Thu ${formatVnd(paymentDetails.amount)} qua ${paymentDetails.paymentMethod} (Mã: ${paymentDetails.transactionReference})`]
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
            notes: `Nhân viên ${staffUser.name} lập phiếu thu ${formatVnd(paymentDetails.amount)} (${paymentDetails.paymentMethod} - ${paymentDetails.transactionReference}), gồm tiền thuê còn lại và tiền đảm bảo kho ${formatVnd(reservation.securityDepositAmount)}.`,
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
    const normalizedMethod = paymentMethod.trim().toUpperCase()
    const mappedMethod = normalizedMethod.includes('BANK') || normalizedMethod.includes('TRANSFER') || paymentMethod.includes('Chuyển khoản')
      ? 'BANK_TRANSFER'
      : normalizedMethod.includes('ONLINE') || normalizedMethod.includes('GATEWAY')
        ? 'ONLINE_GATEWAY'
        : 'CASH'
    recordRemainingPayment(holdId, staffUser, {
      amount,
      paymentMethod: mappedMethod,
      transactionReference: `REF-${Date.now().toString().slice(-6)}`
    })
  }

  // 6. Facility Staff: complete the physical handover. The rental record is
  // created only after the customer confirms receipt from their reservation.
  const completeCheckIn = (params: {
    holdId: string
    staffUser: User
    checklist: CheckInRecord['checklist']
    actualMeasurements: CheckInRecord['actualMeasurements']
    initialCondition: string
    evidencePhotos: string[]
    goodsHandover: NonNullable<CheckInRecord['goodsHandover']>
    handedOverItems: string[]
  }): void => {
    assertPermission(params.staffUser, 'perform_checkin')
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
    const gatePin = reservation.generatedAccessPin || '4921#'

    setState(prev => ({
      ...prev,
      units: prev.units.map(u => (u.id === unit.id ? { ...u, status: 'occupied', currentRentalId: undefined } : u)),
      holds: prev.holds.map(h => (h.id === reservation.id ? { ...h, status: 'COMPLETED', checkedInAt: now.toISOString(), checkedInBy: params.staffUser.id } : h)),
      checkins: prev.checkins.map(c => c.holdId === reservation.id ? { ...c, status: 'completed' as const, completedAt: now.toISOString(), staffId: params.staffUser.id, staffName: params.staffUser.name, checklist: params.checklist, initialCondition: params.initialCondition, evidencePhotos: params.evidencePhotos, goodsHandover: params.goodsHandover, handedOverItems: params.handedOverItems } : c),
      accessCredentials: prev.accessCredentials.map(ac => {
        if (ac.reservationId === reservation.id) {
          return { ...ac, rentalId: undefined, status: 'ACTIVE', activatedAt: now.toISOString() }
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
          entityType: 'hold',
          entityId: reservation.id,
          notes: `Check-in và bàn giao kho ${unit.code} đã hoàn tất. Chờ khách hàng xác nhận nhận kho để lập hồ sơ thuê.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))

  }

  const confirmUnitReceipt = (reservationId: string, customer: User) => {
    assertPermission(customer, 'view_reservations')
    const reservation = state.holds.find(item => item.id === reservationId)
    if (!reservation || (reservation.customerId !== customer.id && reservation.customerEmail !== customer.email)) throw new Error('Không tìm thấy đơn đặt giữ kho thuộc tài khoản này.')
    if (reservation.status !== 'COMPLETED') throw new Error('Kho chưa hoàn tất bàn giao để khách hàng xác nhận.')
    const unit = state.units.find(item => item.id === reservation.assignedUnitId)
    const checkin = state.checkins.find(item => item.holdId === reservation.id && item.status === 'completed')
    if (!unit) throw new Error('Không tìm thấy thông tin gian kho đã bàn giao.')
    const existingRental = state.rentals.find(item => item.holdId === reservation.id)
    const now = new Date()
    const rentalId = existingRental?.id || `RNT-${Date.now().toString().slice(-6)}`
    const rental: RentalRecord = existingRental ? {
      ...existingRental,
      receiptConfirmedAt: existingRental.receiptConfirmedAt || now.toISOString(),
      receiptConfirmedBy: existingRental.receiptConfirmedBy || customer.id
    } : {
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
      gateCode: reservation.generatedAccessPin || checkin?.preparedAccessPin || '4921#',
      initialCondition: checkin?.initialCondition || reservation.goods.condition || 'Đã hoàn tất bàn giao tại cơ sở.',
      evidencePhotos: checkin?.evidencePhotos?.length ? checkin.evidencePhotos : reservation.evidence,
      receiptConfirmedAt: now.toISOString(),
      receiptConfirmedBy: customer.id
    }
    setState(prev => ({
      ...prev,
      rentals: existingRental ? prev.rentals.map(item => item.id === rental.id ? rental : item) : [rental, ...prev.rentals],
      holds: prev.holds.map(item => item.id === reservation.id ? { ...item, customerArchivedAt: now.toISOString() } : item),
      units: prev.units.map(item => item.id === unit.id ? { ...item, status: 'occupied', currentRentalId: rental.id } : item),
      checkins: prev.checkins.map(c => c.holdId === reservation.id ? { ...c, customerConfirmationTimestamp: now.toISOString() } : c),
      accessCredentials: prev.accessCredentials.map(item => item.reservationId === reservation.id ? { ...item, rentalId: rental.id, status: 'ACTIVE' as const, activatedAt: item.activatedAt || now.toISOString() } : item),
      payments: prev.payments.map(item => item.reservationId === reservation.id ? { ...item, rentalId: rental.id } : item),
      activities: [{
        id: `act-${Date.now()}`,
        action: 'UNIT_RECEIPT_CONFIRMED',
        actorId: customer.id,
        actorName: customer.name,
        actorRole: customer.role,
        facilityId: rental.facilityId,
        entityType: 'rental',
        entityId: rental.id,
        notes: `Khách hàng xác nhận đã nhận gian kho ${rental.unitId}; hệ thống lập hồ sơ thuê và ẩn đơn đặt giữ kho.`,
        timestamp: now.toLocaleString('vi-VN')
      }, ...prev.activities]
    }))
  }

  // 7. Renewals: Customer requests, Manager approves, Customer pays
  const requestRenewal = (rentalId: string, renewalMonths: number, customer: User): RenewalRecord => {
    assertPermission(customer, 'manage_rentals')
    const rental = state.rentals.find(r => r.id === rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Chỉ hợp đồng đang hoạt động mới được yêu cầu gia hạn.')
    if (rental.customerId !== customer.id && rental.customerEmail !== customer.email) throw new Error('Hợp đồng không thuộc tài khoản Customer này.')
    if (![1, 3, 6, 12].includes(renewalMonths)) throw new Error('Gói gia hạn không hợp lệ.')
    if (state.renewals.some(item => item.rentalId === rentalId && ['pending', 'approved', 'deposit_paid', 'appointment_scheduled', 'payment_processing'].includes(item.status))) throw new Error('Hợp đồng đã có một yêu cầu gia hạn đang chờ xử lý.')
    const requestedEndDate = addCalendarMonths(rental.endDate, renewalMonths)
    const grossRenewalAmount = rental.monthlyRate * renewalMonths
    const discountRate = renewalMonths === 6 ? 0.03 : renewalMonths === 12 ? 0.05 : 0
    const discountAmount = Math.round(grossRenewalAmount * discountRate * 100) / 100
    const renewalTotal = Math.round((grossRenewalAmount - discountAmount) * 100) / 100

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
      renewalFee: renewalTotal,
      originalMonthlyRate: rental.monthlyRate,
      discountRate,
      discountAmount,
      totalAmount: renewalTotal,
      bookingDepositAmount: Math.round(renewalTotal * 0.2 * 100) / 100,
      remainingAmount: Math.round(renewalTotal * 0.8 * 100) / 100,
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
    assertPermission(customer, 'manage_rentals')
    const renewal = state.renewals.find(item => item.id === renewalId)
    if (!renewal || renewal.status !== 'pending') throw new Error('Chỉ có thể sửa yêu cầu đang chờ Manager xét duyệt.')
    if (renewal.customerId !== customer.id) throw new Error('Yêu cầu gia hạn không thuộc tài khoản này.')
    if (![1, 3, 6, 12].includes(renewalMonths)) throw new Error('Gói gia hạn không hợp lệ.')
    const rental = state.rentals.find(item => item.id === renewal.rentalId)
    if (!rental || rental.status !== 'active') throw new Error('Hợp đồng không còn ở trạng thái hoạt động.')
    const updatedAt = new Date().toISOString()
    const newEndDate = addCalendarMonths(rental.endDate, renewalMonths)
    const grossRenewalAmount = rental.monthlyRate * renewalMonths
    const discountRate = renewalMonths === 6 ? 0.03 : renewalMonths === 12 ? 0.05 : 0
    const discountAmount = Math.round(grossRenewalAmount * discountRate * 100) / 100
    const totalAmount = Math.round((grossRenewalAmount - discountAmount) * 100) / 100
    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, oldEndDate: rental.endDate, newEndDate, renewalMonths, renewalFee: totalAmount, discountRate, discountAmount, totalAmount, bookingDepositAmount: Math.round(totalAmount * 0.2 * 100) / 100, remainingAmount: Math.round(totalAmount * 0.8 * 100) / 100, originalMonthlyRate: rental.monthlyRate, updatedAt } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_REQUEST_UPDATED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: `Khách đã sửa yêu cầu ${renewal.id}: gia hạn ${renewalMonths} tháng, đến ${newEndDate}. Manager cần xét duyệt theo thông tin mới.`, timestamp: updatedAt }, ...prev.activities]
    }))
  }

  const cancelRenewalRequest = (renewalId: string, customer: User) => {
    assertPermission(customer, 'manage_rentals')
    const renewal = state.renewals.find(item => item.id === renewalId)
    if (!renewal || !['pending', 'approved', 'appointment_scheduled'].includes(renewal.status)) throw new Error('Chỉ có thể hủy yêu cầu trước khi ký phụ lục và hoàn tất gia hạn.')
    if (renewal.customerId !== customer.id) throw new Error('Yêu cầu gia hạn không thuộc tài khoản này.')
    const cancelledAt = new Date().toISOString()
    const wasApproved = renewal.status === 'approved'
    const depositWasPaid = renewal.status === 'appointment_scheduled'
    setState(prev => ({
      ...prev,
      renewals: prev.renewals.map(item => item.id === renewalId ? { ...item, status: 'cancelled', cancelledAt, notes: depositWasPaid ? 'Customer hủy sau khi đã cọc; cọc gia hạn 20% không hoàn lại.' : wasApproved ? 'Customer hủy sau khi được duyệt; hóa đơn gia hạn đã mất hiệu lực.' : 'Customer chủ động hủy trước khi Manager xét duyệt.' } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_REQUEST_CANCELLED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: depositWasPaid ? `Khách đã hủy yêu cầu ${renewal.id} sau khi cọc; cọc ${formatVnd(renewal.bookingDepositAmount ?? 0)} không hoàn lại. Manager đã được thông báo.` : wasApproved ? `Khách đã hủy yêu cầu gia hạn ${renewal.id} sau khi duyệt. Hóa đơn ${renewal.invoiceNumber || 'gia hạn'} đã mất hiệu lực.` : `Khách đã hủy yêu cầu gia hạn ${renewal.id}. Manager không cần tiếp tục xét duyệt.`, timestamp: cancelledAt }, ...prev.activities]
    }))
  }

  const approveRenewal = (renewalId: string, managerUser: User) => {
    assertPermission(managerUser, 'manage_rentals')
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
    assertPermission(managerUser, 'manage_rentals')
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
    assertPermission(customer, 'manage_rentals')
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
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_DEPOSIT_PAID', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: renewal.facilityId, entityType: 'payment', entityId: paymentId, notes: `Đã thu cọc gia hạn 20% ${formatVnd(bookingDepositAmount)}. Khách hẹn ký ngày ${appointmentDate} ${appointmentTime}; còn ${formatVnd(Math.round((renewal.renewalFee - bookingDepositAmount) * 100) / 100)}${lateFeeAmount ? ` và phụ thu trễ dự kiến ${formatVnd(lateFeeAmount)}` : ''}.`, timestamp: now.toISOString() }, ...prev.activities]
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
    assertPermission(staffUser, 'perform_checkin')
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
      payments: [{ id: paymentId, reservationId: rental.holdId, rentalId: renewal.rentalId, renewalId, type: 'RENEWAL', amount: finalPayment, paymentMethod: 'CASH', transactionReference: transactionReference.trim(), status: 'PAID', paidAt: now.toISOString(), recordedBy: staffUser.id, invoiceNumber: renewal.invoiceNumber, description: `Thanh toán phần còn lại của kỳ gia hạn: ${formatVnd(remainingAmount)}${lateFeeAmount ? ` + phụ thu trễ ${formatVnd(lateFeeAmount)}` : ''}` }, ...prev.payments],
      activities: [{ id: `act-${Date.now()}`, action: 'RENEWAL_COMPLETED_AT_FACILITY', actorId: staffUser.id, actorName: staffUser.name, actorRole: staffUser.role, facilityId: renewal.facilityId, entityType: 'rental', entityId: renewal.rentalId, notes: `Đã đối chiếu hồ sơ, ký hợp đồng gia hạn ${renewalContractNumber}, thu ${formatVnd(finalPayment)} và gia hạn đến ${renewal.newEndDate}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  // 8. Return & Checkout: Separate Refund Calculation vs Unit Condition
  const requestReturn = (rentalId: string, scheduledDate: string, customer: User, reason?: string): ReturnCase => {
    assertPermission(customer, 'process_returns')
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
    assertPermission(params.staffUser, 'process_returns')
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
          notes: `Đã nghiệm thu kho ${unit.code}. Quá hạn ${overdueDays} ngày, phí trễ ${formatVnd(calculatedOverdueFee)}. ${amountDueFromCustomer > 0 ? `Tiền đảm bảo không đủ; khách cần đóng thêm ${formatVnd(amountDueFromCustomer)}.` : `Đề xuất hoàn ${formatVnd(netRefund)}.`} Chờ khách hàng xác nhận quyết toán.`,
          timestamp: now.toLocaleString('vi-VN')
        },
        ...prev.activities
      ]
    }))
  }

  // 9. Facility Manager: Maintenance Task Handling
  const createMaintenanceTask = (unitId: string, reason: string, staffUser?: User): MaintenanceTask => {
    if (staffUser) assertPermission(staffUser, 'manage_inventory')
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
    assertPermission(managerUser, 'manage_inventory')
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
    assertPermission(staffUser, 'manage_inventory')
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
    assertPermission(manager, 'manage_inventory')
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
    assertPermission(manager, 'manage_payments')
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (rental.status !== 'active') throw new Error('Chỉ ghi nhận thanh toán cho hợp đồng đang hoạt động.')
    const expectedAmount = Math.round((rental.monthlyRate + (rental.lateFeeAmount || 0)) * 100) / 100
    if (amount <= 0 || Math.abs(amount - expectedAmount) > 0.01) throw new Error(`Số tiền cần thu chính xác là ${formatVnd(expectedAmount)}.`)
    if (!transactionReference.trim()) throw new Error('Cần nhập mã giao dịch hoặc số phiếu thu.')
    const now = new Date()
    const baseDue = toValidDate(rental.nextDue)
    const nextDueBase = baseDue.getTime() < now.getTime() ? now.toISOString().split('T')[0] : rental.nextDue
    const nextDue = addCalendarMonths(nextDueBase, 1)
    const paymentId = `PAY-RENT-${Date.now().toString().slice(-8)}`
    const payment: StoragePayment = { id: paymentId, reservationId: rental.holdId, rentalId, type: 'RENT', amount, paymentMethod, transactionReference: transactionReference.trim(), receivedAt: now.toISOString(), receivedBy: manager.id, status: 'PAID', paidAt: now.toISOString(), recordedBy: manager.id, description: `Thu cước kho ${rental.unitId}${rental.lateFeeAmount ? ` gồm phí trễ ${formatVnd(rental.lateFeeAmount)}` : ''}` }
    setState(prev => ({
      ...prev,
      payments: [payment, ...prev.payments],
      rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, paymentStatus: 'paid', lateFeeAmount: 0, overlocked: false, nextDue } : item),
      accessCredentials: prev.accessCredentials.map(item => item.rentalId === rentalId && item.status === 'SUSPENDED' ? { ...item, status: 'ACTIVE' } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RENT_PAYMENT_RECORDED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'payment', entityId: paymentId, notes: `Đã thu ${formatVnd(amount)} cho hợp đồng ${rental.id}; kỳ tiếp theo ${nextDue}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const applyRentalLateFee = (rentalId: string, amount: number, manager: User) => {
    assertPermission(manager, 'manage_payments')
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (rental.paymentStatus !== 'overdue') throw new Error('Chỉ áp dụng phí trễ cho hợp đồng đang quá hạn.')
    if (amount <= 0) throw new Error('Phí trễ phải lớn hơn 0.')
    const now = new Date()
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, lateFeeAmount: Math.round(((item.lateFeeAmount || 0) + amount) * 100) / 100 } : item), activities: [{ id: `act-${Date.now()}`, action: 'LATE_FEE_APPLIED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `Áp dụng phí trễ ${formatVnd(amount)}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  const waiveRentalLateFee = (rentalId: string, manager: User) => {
    assertPermission(manager, 'manage_payments')
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    const previousFee = rental.lateFeeAmount || 0
    const now = new Date()
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, lateFeeAmount: 0 } : item), activities: [{ id: `act-${Date.now()}`, action: 'LATE_FEE_WAIVED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `Miễn phí trễ ${formatVnd(previousFee)}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  const setRentalOverlock = (rentalId: string, overlocked: boolean, manager: User) => {
    assertPermission(manager, 'manage_payments')
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
    assertPermission(manager, 'manage_payments')
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental) throw new Error('Không tìm thấy hợp đồng thuê.')
    assertFacilityManager(manager, rental.facilityId, rental.facilityName)
    if (rental.paymentStatus !== 'overdue') throw new Error('Hợp đồng không ở trạng thái quá hạn.')
    const now = new Date()
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, lastReminderAt: now.toISOString(), remindersSent: (item.remindersSent || 0) + 1 } : item), activities: [{ id: `act-${Date.now()}`, action: 'DELINQUENCY_REMINDER_SENT', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: rental.facilityId, entityType: 'rental', entityId: rentalId, notes: `Đã ghi nhận gửi nhắc nợ cho ${rental.customerName}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  const createFacilityTask = (task: Omit<FacilityTask, 'id' | 'createdAt' | 'status'>, manager: User): FacilityTask => {
    assertPermission(manager, 'manage_staff_tasks')
    assertFacilityManager(manager, task.facilityId, task.facilityName)
    if (!task.title.trim() || !task.dueAt) throw new Error('Nhiệm vụ cần có tiêu đề và hạn xử lý.')
    const created: FacilityTask = { ...task, id: `TSK-${Date.now().toString().slice(-7)}`, title: task.title.trim(), notes: task.notes?.trim(), status: 'open', createdAt: new Date().toISOString() }
    setState(prev => ({ ...prev, staffTasks: [created, ...prev.staffTasks], activities: [{ id: `act-${Date.now()}`, action: 'FACILITY_TASK_CREATED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: task.facilityId, entityType: 'task', entityId: created.id, notes: `Tạo nhiệm vụ "${created.title}"${created.assignedStaffName ? ` cho ${created.assignedStaffName}` : ''}.`, timestamp: created.createdAt }, ...prev.activities] }))
    return created
  }

  const updateFacilityTask = (taskId: string, updates: Partial<Pick<FacilityTask, 'assignedStaffId' | 'assignedStaffName' | 'dueAt' | 'priority' | 'status' | 'notes'>>, manager: User) => {
    assertPermission(manager, 'manage_staff_tasks')
    const task = state.staffTasks.find(item => item.id === taskId)
    if (!task) throw new Error('Không tìm thấy nhiệm vụ.')
    assertFacilityManager(manager, task.facilityId, task.facilityName)
    const now = new Date()
    setState(prev => ({ ...prev, staffTasks: prev.staffTasks.map(item => item.id === taskId ? { ...item, ...updates, completedAt: updates.status === 'completed' ? now.toISOString() : item.completedAt } : item), activities: [{ id: `act-${Date.now()}`, action: 'FACILITY_TASK_UPDATED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: task.facilityId, entityType: 'task', entityId: taskId, notes: updates.status === 'completed' ? 'Nhiệm vụ đã hoàn tất.' : `Cập nhật nhiệm vụ${updates.assignedStaffName ? ` cho ${updates.assignedStaffName}` : ''}.`, timestamp: now.toISOString() }, ...prev.activities] }))
  }

  // 10. Operations Config & Support Tickets
  const updateBusinessConfig = (newConfig: Partial<BusinessConfig>, actor: User) => {
    assertPermission(actor, 'manage_policies')
    if (actor.role !== 'manager' && actor.role !== 'admin') throw new Error('Chỉ Manager hoặc Admin được cập nhật cấu hình vận hành.')
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...newConfig }
    }))
  }

  const respondSupportTicket = (ticketId: string, replyText: string, status: TicketItem['status'], staffUser: User) => {
    assertPermission(staffUser, 'manage_support')
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager' && staffUser.role !== 'admin') throw new Error('Chỉ nhân viên cơ sở được cập nhật yêu cầu hỗ trợ.')
    if (!replyText.trim()) throw new Error('Vui lòng nhập nội dung phản hồi.')
    const ticket = state.tickets.find(item => item.id === ticketId)
    if (!ticket) throw new Error('Không tìm thấy yêu cầu hỗ trợ.')
    if (!isFacilityVisible(staffUser, ticket.facilityId, ticket.facility)) throw new Error('Bạn không có quyền xử lý yêu cầu của cơ sở khác.')
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

  const createSupportTicket = (ticket: Omit<TicketItem, 'id' | 'created' | 'messages'>, initialMessage: string, customer: User) => {
    assertPermission(customer, 'view_support')
    if (customer.role !== 'customer') throw new Error('Chỉ khách hàng được tạo yêu cầu hỗ trợ từ cổng khách hàng.')
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
      facility: '',
      phone: normalizedPhone,
      status: 'active',
      lastLogin: new Date().toISOString().slice(0, 10),
      joined: new Date().toISOString().slice(0, 10)
    } as unknown as StoredUser

    setState(prev => ({ ...prev, users: [created, ...prev.users] }))
    return {
      id: created.id,
      name: created.name,
      email: created.email,
      role: 'customer',
      facility: created.facility
    }
  }

  const createAccount = (params: { name: string; email: string; phone?: string; role: User['role']; facility?: string; supportReason?: string }, actor: User): User => {
    const canonicalAdmin = assertCanonicalAdmin(actor)
    const name = params.name.trim()
    const email = params.email.trim().toLowerCase()
    const phone = params.phone?.trim() || ''
    if (!name || !email) throw new Error('Họ tên và email là bắt buộc.')
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email không hợp lệ.')
    if (params.role === 'customer' && !params.supportReason?.trim()) throw new Error('Tài khoản Customer hỗ trợ phải có lý do và audit log.')
    if (params.role !== 'customer' && !['staff', 'manager', 'business', 'admin'].includes(params.role)) throw new Error('Role tài khoản không hợp lệ.')
    const requestedFacility = params.facility?.trim() || ''
    if ((params.role === 'staff' || params.role === 'manager') && (!requestedFacility || requestedFacility === 'All facilities')) throw new Error('Staff và Manager phải được gán một cơ sở cụ thể.')

    if (state.users.some(item => item.email.toLowerCase() === email)) throw new Error('Email đã tồn tại trong hệ thống.')
    const facility = requestedFacility || (params.role === 'business' || params.role === 'admin' ? 'All facilities' : undefined)
    const created = {
      id: `${params.role}-${Date.now().toString(36)}`,
      name,
      email,
      role: params.role,
      facility,
      phone,
      status: 'active',
      joined: new Date().toISOString().slice(0, 10),
      mustChangePassword: true
    } as StoredUser
    const now = new Date().toISOString()
    const action = params.role === 'customer' ? 'CUSTOMER_ACCOUNT_CREATED_BY_SUPPORT' : 'INTERNAL_ACCOUNT_CREATED'
    const notes = params.role === 'customer' ? `Customer được tạo bởi bộ phận hỗ trợ. Lý do: ${params.supportReason!.trim()}` : `Tạo tài khoản ${params.role} và gán cơ sở ${facility || 'chưa gán'}.`
    setState(prev => ({
      ...prev,
      users: [created, ...prev.users],
      activities: [{
        id: `act-${Date.now()}`,
        action,
        actorId: canonicalAdmin.id,
        actorName: canonicalAdmin.name,
        actorRole: 'admin',
        facilityId: facility || 'ALL',
        entityType: 'user',
        entityId: created.id,
        beforeState: null,
        afterState: accountSnapshot(created),
        notes,
        timestamp: now
      }, ...prev.activities]
    }))
    return toPublicUser(created)
  }

  const createInternalAccount = (params: { name: string; email: string; phone?: string; role: CompanyRole; facility?: string }, actor: User): User => {
    return createAccount({ ...params, role: params.role }, actor)
  }

  const createCustomerSupportAccount = (params: { name: string; email: string; phone?: string; facility?: string; reason: string }, actor: User): User => {
    return createAccount({ ...params, role: 'customer', supportReason: params.reason }, actor)
  }

  const updateUserAccount = (userId: string, updates: { name: string; email: string; phone?: string; role?: CompanyRole; facility?: string; status?: AccountStatus }, actor: User) => {
    const canonicalAdmin = assertCanonicalAdmin(actor)
    const target = state.users.find(item => item.id === userId)
    if (!target) throw new Error('Không tìm thấy tài khoản.')
    const name = updates.name.trim()
    const email = updates.email.trim().toLowerCase()
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Họ tên và email hợp lệ là bắt buộc.')
    if (state.users.some(item => item.id !== userId && item.email.toLowerCase() === email)) throw new Error('Email đã tồn tại trong hệ thống.')
    if (target.role === 'customer' && updates.role) throw new Error('Customer không được đổi sang role nội bộ từ màn hình này.')
    const nextRole = target.role === 'customer' ? 'customer' : (updates.role ?? target.role) as CompanyRole
    const nextStatus = updates.status ?? target.status
    if (target.id === canonicalAdmin.id && nextStatus !== 'active') throw new Error('Không thể tự khóa tài khoản Admin hiện tại.')
    if (target.role === 'admin' && nextRole !== 'admin' && state.users.filter(item => item.role === 'admin' && item.status === 'active').length <= 1) throw new Error('Không thể hạ quyền Admin cuối cùng đang hoạt động.')
    if (target.role === 'admin' && target.status === 'active' && nextStatus !== 'active' && state.users.filter(item => item.role === 'admin' && item.status === 'active').length <= 1) throw new Error('Phải giữ lại ít nhất một Admin đang hoạt động.')
    const nextFacility = updates.facility?.trim() || (nextRole === 'business' || nextRole === 'admin' ? 'All facilities' : target.facility)
    if ((nextRole === 'staff' || nextRole === 'manager') && (!nextFacility || nextFacility === 'All facilities')) throw new Error('Staff và Manager phải được gán một cơ sở cụ thể.')
    const updated = { ...target, name, email, phone: updates.phone?.trim() || '', role: nextRole, facility: nextFacility, status: nextStatus } as StoredUser
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      users: prev.users.map(item => item.id === userId ? updated : item),
      sessions: nextStatus === 'active' ? prev.sessions : prev.sessions.map(session => session.userId === userId && session.status === 'active' ? { ...session, status: 'revoked' as const, revokedAt: now, lastSeenAt: now } : session),
      activities: [{
        id: `act-${Date.now()}`,
        action: 'INTERNAL_ACCOUNT_UPDATED',
        actorId: canonicalAdmin.id,
        actorName: canonicalAdmin.name,
        actorRole: 'admin',
        facilityId: nextFacility || 'ALL',
        entityType: 'user',
        entityId: userId,
        beforeState: accountSnapshot(target),
        afterState: accountSnapshot(updated),
        notes: 'Admin cập nhật thông tin tài khoản.',
        timestamp: now
      }, ...prev.activities]
    }))
  }

  const setUserAccountStatus = (userId: string, status: AccountStatus, actor: User) => {
    const canonicalAdmin = assertCanonicalAdmin(actor)
    const target = state.users.find(item => item.id === userId)
    if (!target) throw new Error('Không tìm thấy tài khoản.')
    if (target.id === canonicalAdmin.id && status !== 'active') throw new Error('Không thể tự khóa tài khoản Admin hiện tại.')
    if (target.role === 'admin' && target.status === 'active' && status !== 'active' && state.users.filter(item => item.role === 'admin' && item.status === 'active').length <= 1) throw new Error('Phải giữ lại ít nhất một Admin đang hoạt động.')
    const updated = { ...target, status } as StoredUser
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      users: prev.users.map(item => item.id === userId ? updated : item),
      sessions: status === 'active' ? prev.sessions : prev.sessions.map(session => session.userId === userId && session.status === 'active' ? { ...session, status: 'revoked' as const, revokedAt: now, lastSeenAt: now } : session),
      activities: [{
        id: `act-${Date.now()}`,
        action: status === 'suspended' ? 'ACCOUNT_SUSPENDED' : status === 'active' ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_DEACTIVATED',
        actorId: canonicalAdmin.id,
        actorName: canonicalAdmin.name,
        actorRole: 'admin',
        facilityId: target.facility || 'ALL',
        entityType: 'user',
        entityId: userId,
        beforeState: accountSnapshot(target),
        afterState: accountSnapshot(updated),
        notes: `Trạng thái tài khoản chuyển sang ${status}.`,
        timestamp: now
      }, ...prev.activities]
    }))
  }

  const deleteUserAccount = (userId: string, actor: User) => {
    const canonicalAdmin = assertCanonicalAdmin(actor)
    const target = state.users.find(item => item.id === userId)
    if (!target) throw new Error('Không tìm thấy tài khoản.')
    if (target.id === canonicalAdmin.id) throw new Error('Không thể xóa tài khoản Admin hiện tại.')
    if (target.role === 'admin' && target.status === 'active' && state.users.filter(item => item.role === 'admin' && item.status === 'active').length <= 1) throw new Error('Phải giữ lại ít nhất một Admin đang hoạt động.')
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      users: prev.users.filter(item => item.id !== userId),
      sessions: prev.sessions.map(session => session.userId === userId && session.status === 'active' ? { ...session, status: 'revoked' as const, revokedAt: now, lastSeenAt: now } : session),
      activities: [{
        id: `act-${Date.now()}`,
        action: 'ACCOUNT_DELETED',
        actorId: canonicalAdmin.id,
        actorName: canonicalAdmin.name,
        actorRole: 'admin',
        facilityId: target.facility || 'ALL',
        entityType: 'user',
        entityId: userId,
        beforeState: accountSnapshot(target),
        afterState: null,
        notes: 'Admin xóa tài khoản khỏi hệ thống.',
        timestamp: now
      }, ...prev.activities]
    }))
  }

  const requestUserPasswordReset = (userId: string, actor: User) => {
    const canonicalAdmin = assertCanonicalAdmin(actor)
    const target = state.users.find(item => item.id === userId)
    if (!target) throw new Error('Không tìm thấy tài khoản.')
    const now = new Date().toISOString()
    const updated = { ...target, passwordResetAt: now, mustChangePassword: true } as StoredUser
    setState(prev => ({
      ...prev,
      users: prev.users.map(item => item.id === userId ? updated : item),
      activities: [{
        id: `act-${Date.now()}`,
        action: 'PASSWORD_RESET_REQUESTED',
        actorId: canonicalAdmin.id,
        actorName: canonicalAdmin.name,
        actorRole: 'admin',
        facilityId: target.facility || 'ALL',
        entityType: 'user',
        entityId: userId,
        beforeState: accountSnapshot(target),
        afterState: accountSnapshot(updated),
        notes: 'Đã tạo yêu cầu reset mật khẩu; mật khẩu mới phải được xử lý bởi auth backend/email service.',
        timestamp: now
      }, ...prev.activities]
    }))
  }

  const updateCustomerProfile = (updates: { name: string; email: string; phone?: string }, customer: User) => {
    const canonicalCustomer = resolveCanonicalActor(customer)
    if (canonicalCustomer.role !== 'customer') throw new Error('Chỉ Customer được tự cập nhật thông tin cá nhân.')
    const name = updates.name.trim()
    const email = updates.email.trim().toLowerCase()
    const phone = updates.phone?.trim() || ''
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Họ tên và email hợp lệ là bắt buộc.')
    if (state.users.some(item => item.id !== canonicalCustomer.id && item.email.toLowerCase() === email)) throw new Error('Email đã tồn tại trong hệ thống.')
    const updated = { ...canonicalCustomer, name, email, phone } as StoredUser
    const before = accountSnapshot(canonicalCustomer)
    const after = accountSnapshot(updated)
    if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('Thông tin cá nhân chưa có thay đổi.')
    const now = new Date().toISOString()
    setState(prev => ({
      ...prev,
      users: prev.users.map(item => item.id === canonicalCustomer.id ? updated : item),
      sessions: prev.sessions.map(session => session.userId === canonicalCustomer.id ? { ...session, userName: name, email } : session),
      activities: [{
        id: createRecordId('act'),
        action: 'CUSTOMER_PROFILE_UPDATED',
        actorId: canonicalCustomer.id,
        actorName: canonicalCustomer.name,
        actorRole: canonicalCustomer.role,
        facilityId: canonicalCustomer.facility || 'ALL',
        entityType: 'user',
        entityId: canonicalCustomer.id,
        beforeState: before,
        afterState: after,
        notes: 'Customer tự cập nhật thông tin cá nhân.',
        timestamp: now
      }, ...prev.activities]
    }))
  }

  const requestOwnPasswordReset = (customer: User) => {
    const canonicalCustomer = resolveCanonicalActor(customer)
    if (canonicalCustomer.role !== 'customer') throw new Error('Chỉ Customer được yêu cầu đổi mật khẩu qua email.')
    const now = new Date().toISOString()
    const updated = { ...canonicalCustomer, passwordResetAt: now, mustChangePassword: true } as StoredUser
    setState(prev => ({
      ...prev,
      users: prev.users.map(item => item.id === canonicalCustomer.id ? updated : item),
      activities: [{
        id: createRecordId('act'),
        action: 'CUSTOMER_PASSWORD_RESET_REQUESTED',
        actorId: canonicalCustomer.id,
        actorName: canonicalCustomer.name,
        actorRole: canonicalCustomer.role,
        facilityId: canonicalCustomer.facility || 'ALL',
        entityType: 'user',
        entityId: canonicalCustomer.id,
        beforeState: accountSnapshot(canonicalCustomer),
        afterState: accountSnapshot(updated),
        notes: 'Customer yêu cầu auth backend gửi email đổi mật khẩu; frontend không tự đặt mật khẩu mới.',
        timestamp: now
      }, ...prev.activities]
    }))
  }

  const submitProfileChangeRequest = ({ requestedFields, reason }: { requestedFields: string[]; reason: string }, requester: User): ProfileChangeRequest => {
    const canonicalRequester = resolveCanonicalActor(requester)
    if (canonicalRequester.role === 'customer') throw new Error('Customer không dùng luồng yêu cầu chỉnh sửa nội bộ.')
    const fields = [...new Set(requestedFields.map(field => field.trim()).filter(Boolean))].slice(0, 10)
    const cleanReason = reason.trim()
    if (!fields.length) throw new Error('Vui lòng chọn ít nhất một nội dung cần chỉnh sửa.')
    if (cleanReason.length < 10) throw new Error('Lý do yêu cầu phải có ít nhất 10 ký tự.')
    const now = new Date().toISOString()
    const request: ProfileChangeRequest = {
      id: createRecordId('profile-request'),
      requesterId: canonicalRequester.id,
      requesterName: canonicalRequester.name,
      requesterEmail: canonicalRequester.email,
      requesterRole: canonicalRequester.role as Exclude<Role, 'customer'>,
      facility: canonicalRequester.facility,
      requestedFields: fields,
      reason: cleanReason,
      status: 'pending',
      createdAt: now
    }
    setState(prev => ({
      ...prev,
      profileChangeRequests: [request, ...prev.profileChangeRequests],
      activities: [{
        id: createRecordId('act'),
        action: 'PROFILE_CHANGE_REQUESTED',
        actorId: canonicalRequester.id,
        actorName: canonicalRequester.name,
        actorRole: canonicalRequester.role,
        facilityId: canonicalRequester.facility || 'ALL',
        entityType: 'user',
        entityId: canonicalRequester.id,
        beforeState: accountSnapshot(canonicalRequester),
        afterState: request,
        notes: 'Gửi yêu cầu chỉnh sửa thông tin tới Admin/HR.',
        timestamp: now
      }, ...prev.activities]
    }))
    return request
  }

  const deleteOwnCustomerAccount = (customer: User) => {
    const canonicalCustomer = resolveCanonicalActor(customer)
    if (canonicalCustomer.role !== 'customer') throw new Error('Chỉ Customer được tự xoá tài khoản.')
    const nowMs = Date.now()
    const closedHoldStatuses = ['CANCELLED', 'COMPLETED', 'cancelled', 'completed', 'REJECTED', 'rejected', 'NO_SHOW', 'no_show']
    const activeHolds = state.holds.filter(hold => hold.customerId === canonicalCustomer.id && ![...closedHoldStatuses, 'EXPIRED', 'expired'].includes(String(hold.status)))
    const overdueHolds = state.holds.filter(hold => hold.customerId === canonicalCustomer.id && !closedHoldStatuses.includes(String(hold.status)) && Boolean(hold.expiresAt) && Date.parse(hold.expiresAt) < nowMs)
    const unpaidHolds = state.holds.filter(hold => hold.customerId === canonicalCustomer.id && !closedHoldStatuses.includes(String(hold.status)) && hold.payment.status !== 'paid')
    const activeRentals = state.rentals.filter(rental => rental.customerId === canonicalCustomer.id && rental.status !== 'completed')
    const overdueRentals = activeRentals.filter(rental => rental.paymentStatus === 'overdue' || (rental.paymentStatus !== 'paid' && Boolean(rental.nextDue) && Date.parse(rental.nextDue) < nowMs))
    const unpaidRentals = activeRentals.filter(rental => rental.paymentStatus !== 'paid')
    const activeRenewals = state.renewals.filter(renewal => renewal.customerId === canonicalCustomer.id && !['completed', 'cancelled', 'rejected', 'payment_expired'].includes(renewal.status))
    const blockers: string[] = []
    if (activeHolds.length || activeRentals.length || activeRenewals.length) blockers.push('đơn/hồ sơ đang xử lý')
    if (overdueHolds.length || overdueRentals.length) blockers.push('đơn quá hạn')
    if (unpaidHolds.length || unpaidRentals.length || activeRenewals.some(renewal => renewal.status !== 'cancelled' && renewal.status !== 'completed')) blockers.push('đơn chưa thanh toán')
    if (blockers.length) throw new Error(`Không thể xoá tài khoản khi còn ${blockers.join(', ')}. Vui lòng hoàn tất hoặc huỷ các hồ sơ trước.`)
    const before = accountSnapshot(canonicalCustomer)
    const timestamp = new Date().toISOString()
    setState(prev => ({
      ...prev,
      users: prev.users.filter(item => item.id !== canonicalCustomer.id),
      sessions: prev.sessions.map(session => session.userId === canonicalCustomer.id && session.status === 'active' ? { ...session, status: 'revoked' as const, revokedAt: timestamp, lastSeenAt: timestamp } : session),
      activities: [{
        id: createRecordId('act'),
        action: 'CUSTOMER_ACCOUNT_DELETED',
        actorId: canonicalCustomer.id,
        actorName: canonicalCustomer.name,
        actorRole: canonicalCustomer.role,
        facilityId: canonicalCustomer.facility || 'ALL',
        entityType: 'user',
        entityId: canonicalCustomer.id,
        beforeState: before,
        afterState: null,
        notes: 'Customer tự xoá tài khoản sau khi vượt qua kiểm tra hồ sơ, quá hạn và thanh toán.',
        timestamp
      }, ...prev.activities]
    }))
  }

  const resetToDemoData = () => {
    localStorage.removeItem(STORAGE_KEY)
    setState({
      users: USERS,
      rolePermissions: normalizeRolePermissions(undefined),
      facilities: INITIAL_FACILITIES,
      units: INITIAL_UNITS,
      holds: [],
      contracts: [],
      payments: [],
      checkins: [],
      rentals: INITIAL_RENTALS,
      returns: [],
      renewals: [],
      maintenanceTasks: [],
      staffTasks: [],
      accessCredentials: [],
      activities: INITIAL_ACTIVITIES,
      loginHistory: INITIAL_LOGIN_HISTORY,
      sessions: INITIAL_SESSIONS,
      securityAlerts: INITIAL_SECURITY_ALERTS,
      profileChangeRequests: INITIAL_PROFILE_CHANGE_REQUESTS,
      tickets: TICKETS,
      config: DEFAULT_BUSINESS_CONFIG
    })
  }

  // ── Facility & Unit CRUD ──
  const createFacility = (data: Partial<Facility>, actor?: User): Facility => {
    if (actor) assertPermission(actor, 'view_facilities')
    const id = data.id || `fac-${Date.now().toString(36)}`
    const code = (data.code?.trim() || id).toUpperCase()
    const unitsCount = data.units ?? 20
    const defaultOccupied = data.occupied ?? Math.min(unitsCount, 6)
    const defaultRevenue = data.revenue ?? 48_500_000
    const defaultGrowth = data.growth ?? 5.5
    const newFacility: Facility = {
      id,
      code,
      name: data.name?.trim() || `Kho Việt – Cơ sở ${code}`,
      address: data.address?.trim() || 'TP. Hồ Chí Minh',
      city: data.city?.trim() || 'TP. Hồ Chí Minh',
      rating: data.rating ?? 4.9,
      available: data.available ?? Math.max(0, unitsCount - defaultOccupied),
      price: data.price || '5.500.000đ',
      climate: data.climate ?? false,
      security: data.security || 'Khóa riêng tự quản, Bảo vệ cổng',
      image: data.image || (data.city?.includes('Hà Nội') ? 'photo-1586864387967-d02ef85d93e8' : 'photo-1553413077-190dd305871c'),
      units: unitsCount,
      occupied: defaultOccupied,
      revenue: defaultRevenue,
      growth: defaultGrowth,
      manager: data.manager?.trim() || 'Quản lý cơ sở',
      phone: data.phone?.trim() || '1900 6868',
      status: data.status || 'active',
      accessHours: data.accessHours || '06:00 - 22:00 hàng ngày (24/7 đối với kho VIP)',
      timezone: data.timezone || 'Asia/Ho_Chi_Minh'
    }

    // Tự động phân bổ gian kho chuẩn S, M, L, XL theo quy mô cơ sở
    const countPerSize = Math.max(1, Math.floor(unitsCount / 4))
    const remainder = unitsCount - countPerSize * 3
    const distribution: Array<{ size: 'S' | 'M' | 'L' | 'XL'; type: 'Small' | 'Medium' | 'Large' | 'Extra Large'; floor: number; zone: string; count: number }> = [
      { size: 'S', type: 'Small', floor: 1, zone: 'Khu A', count: countPerSize },
      { size: 'M', type: 'Medium', floor: 2, zone: 'Khu B', count: countPerSize },
      { size: 'L', type: 'Large', floor: 3, zone: 'Khu C', count: countPerSize },
      { size: 'XL', type: 'Extra Large', floor: 4, zone: 'Khu D', count: Math.max(1, remainder) }
    ]

    const newUnits: StorageUnit[] = []
    let assignedOccupied = 0
    distribution.forEach(({ size, type, floor, zone, count }) => {
      const spec = UNIT_SPECS[size]
      for (let i = 1; i <= count; i++) {
        const unitNumber = String(i).padStart(3, '0')
        const unitCode = `${code}-${size}-${unitNumber}`
        const isOccupied = assignedOccupied < defaultOccupied && i <= 2
        if (isOccupied) assignedOccupied++
        newUnits.push({
          id: unitCode,
          code: unitCode,
          customerCode: unitCode,
          size,
          sizeCode: size,
          type,
          dimensions: {
            lengthM: spec.lengthM,
            widthM: spec.widthM,
            heightM: spec.heightM
          },
          doorDimensions: {
            widthM: 1.2,
            heightM: 2.4
          },
          areaM2: spec.areaM2,
          volumeM3: spec.volumeM3,
          maxLoadKg: size === 'S' ? 600 : size === 'M' ? 1200 : size === 'L' ? 2000 : 3500,
          allowedGoods: ['Đồ gia dụng', 'Thiết bị văn phòng', 'Hồ sơ tài liệu'],
          prohibitedGoods: ['Chất dễ cháy nổ', 'Hóa chất độc hại'],
          price: spec.priceMonthly,
          deposit: spec.priceMonthly,
          floor,
          zone,
          climate: false,
          status: isOccupied ? 'occupied' : 'available',
          facility: newFacility.name,
          facilityName: newFacility.name,
          facilityId: newFacility.id,
          version: 1
        } as unknown as StorageUnit)
      }
    })

    setState(prev => {
      const nextFacilities = [newFacility, ...prev.facilities]
      const nextUnits = [...prev.units, ...newUnits]
      try {
        localStorage.setItem('storagehub:facilities', JSON.stringify(nextFacilities))
        localStorage.setItem('storagehub:units', JSON.stringify(nextUnits))
      } catch {}
      return {
        ...prev,
        facilities: nextFacilities,
        units: nextUnits
      }
    })

    return newFacility
  }

  const updateFacility = (facilityId: string, updates: Partial<Facility>, actor?: User) => {
    if (actor) assertPermission(actor, 'view_facilities')
    setState(prev => {
      const nextFacilities = prev.facilities.map(f => {
        if (f.id !== facilityId && f.code !== facilityId) return f
        return {
          ...f,
          ...updates,
          id: f.id
        }
      })
      const updatedFacility = nextFacilities.find(f => f.id === facilityId || f.code === facilityId)
      const nextUnits = updatedFacility && updates.name ? prev.units.map(u => {
        if (u.facilityId === facilityId || u.facilityId === updatedFacility.id || (updatedFacility.code && u.facilityId === updatedFacility.code)) {
          return { ...u, facilityName: updatedFacility.name, facility: updatedFacility.name }
        }
        return u
      }) : prev.units

      try {
        localStorage.setItem('storagehub:facilities', JSON.stringify(nextFacilities))
        if (nextUnits !== prev.units) localStorage.setItem('storagehub:units', JSON.stringify(nextUnits))
      } catch {}

      return {
        ...prev,
        facilities: nextFacilities,
        units: nextUnits
      }
    })
  }

  const deleteFacility = (facilityId: string, actor?: User): { success: boolean; reason?: string } => {
    if (actor) assertPermission(actor, 'view_facilities')
    const hasActiveHolds = state.holds.some(h => (h.facilityId === facilityId || h.facilityName?.includes(facilityId)) && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(h.status))
    const hasActiveRentals = state.rentals.some(r => (r.facilityId === facilityId || r.facilityName?.includes(facilityId)) && ['active', 'return_requested', 'return_inspection', 'closing'].includes(r.status))
    const hasOccupiedUnits = state.units.some(u => (u.facilityId === facilityId) && u.status === 'occupied')

    if (hasActiveHolds || hasActiveRentals || hasOccupiedUnits) {
      return {
        success: false,
        reason: 'Không thể xóa cơ sở đang có gian kho cho thuê hoạt động hoặc có đơn giữ chỗ chưa hoàn tất.'
      }
    }

    setState(prev => {
      const targetFac = prev.facilities.find(f => f.id === facilityId || f.code === facilityId)
      const nextFacilities = prev.facilities.filter(f => f.id !== facilityId && f.code !== facilityId)
      const nextUnits = prev.units.filter(u => u.facilityId !== facilityId && (!targetFac?.code || u.facilityId !== targetFac.code) && (!targetFac?.id || u.facilityId !== targetFac.id))
      try {
        localStorage.setItem('storagehub:facilities', JSON.stringify(nextFacilities))
        localStorage.setItem('storagehub:units', JSON.stringify(nextUnits))
      } catch {}
      return {
        ...prev,
        facilities: nextFacilities,
        units: nextUnits
      }
    })

    return { success: true }
  }

  const createUnit = (data: Partial<StorageUnit>, actor?: User): StorageUnit => {
    if (actor) assertPermission(actor, 'view_facilities')
    const code = (data.code || data.id || `UNIT-${Date.now().toString(36)}`).toUpperCase().trim()
    const targetFacility = state.facilities.find(f => f.id === data.facilityId || f.code === data.facilityId)
    const facilityId = targetFacility ? targetFacility.id : (data.facilityId || 'fac-001')
    const facilityName = targetFacility ? targetFacility.name : (data.facilityName || 'Kho Việt')

    const type = data.type || 'Small'
    const lengthM = data.dimensions?.lengthM ?? (type === 'Medium' ? 9.0 : type === 'Large' ? 13.5 : type === 'Extra Large' ? 19.0 : 5.6)
    const widthM = data.dimensions?.widthM ?? (type === 'Medium' ? 6.4 : type === 'Large' ? 6.8 : type === 'Extra Large' ? 7.2 : 6.0)
    const heightM = data.dimensions?.heightM ?? (type === 'Medium' ? 3.4 : type === 'Large' ? 3.6 : type === 'Extra Large' ? 4.0 : 3.2)
    const areaM2 = data.areaM2 ?? Math.round(lengthM * widthM * 10) / 10
    const volumeM3 = data.volumeM3 ?? Math.round(lengthM * widthM * heightM * 100) / 100
    const maxLoadKg = data.maxLoadKg ?? (type === 'Medium' ? 1200 : type === 'Large' ? 2400 : type === 'Extra Large' ? 3600 : 600)
    
    let basePrice = data.price ?? (type === 'Medium' ? 9_500_000 / USD_TO_VND_RATE : type === 'Large' ? 15_000_000 / USD_TO_VND_RATE : type === 'Extra Large' ? 22_500_000 / USD_TO_VND_RATE : 5_500_000 / USD_TO_VND_RATE)
    if (basePrice > 10000) {
      basePrice = basePrice / USD_TO_VND_RATE
    }

    const newUnit: StorageUnit = {
      id: code,
      code,
      facilityId,
      facilityName,
      floor: data.floor ?? 1,
      zone: data.zone || `Khu ${type[0]}`,
      type,
      areaM2,
      dimensions: { lengthM, widthM, heightM },
      doorDimensions: data.doorDimensions || { widthM: 2, heightM: 2.4 },
      volumeM3,
      maxLoadKg,
      allowedGoods: data.allowedGoods || ['Đồ gia dụng', 'Thiết bị văn phòng', 'Tài liệu, hồ sơ', 'Hàng thương mại điện tử'],
      prohibitedGoods: data.prohibitedGoods || ['Chất dễ cháy nổ', 'Hóa chất độc hại', 'Hàng cấm theo luật', 'Thực phẩm tươi sống'],
      price: basePrice,
      deposit: data.deposit ? (data.deposit > 10000 ? data.deposit / USD_TO_VND_RATE : data.deposit) : basePrice,
      climate: data.climate ?? (targetFacility?.climate ?? true),
      status: data.status || 'available',
      reservedPeriods: [],
      version: 1
    }

    setState(prev => {
      const nextUnits = [newUnit, ...prev.units]
      const nextFacilities = prev.facilities.map(f => {
        if (f.id === facilityId || f.code === facilityId) {
          const facUnits = nextUnits.filter(u => u.facilityId === f.id || u.facilityId === f.code)
          return {
            ...f,
            units: facUnits.length,
            available: facUnits.filter(u => u.status === 'available').length,
            occupied: facUnits.filter(u => u.status === 'occupied').length
          }
        }
        return f
      })
      try {
        localStorage.setItem('storagehub:units', JSON.stringify(nextUnits))
        localStorage.setItem('storagehub:facilities', JSON.stringify(nextFacilities))
      } catch {}
      return {
        ...prev,
        units: nextUnits,
        facilities: nextFacilities
      }
    })

    return newUnit
  }

  const updateUnit = (unitId: string, updates: Partial<StorageUnit>, actor?: User) => {
    if (actor) assertPermission(actor, 'view_facilities')
    setState(prev => {
      const nextUnits = prev.units.map(u => {
        if (u.id !== unitId && u.code !== unitId) return u
        let price = updates.price !== undefined ? updates.price : u.price
        if (price > 10000) price = price / USD_TO_VND_RATE
        let deposit = updates.deposit !== undefined ? updates.deposit : u.deposit
        if (deposit > 10000) deposit = deposit / USD_TO_VND_RATE
        return {
          ...u,
          ...updates,
          price,
          deposit,
          id: u.id,
          code: u.code
        }
      })
      const targetUnit = prev.units.find(u => u.id === unitId || u.code === unitId)
      const nextFacilities = prev.facilities.map(f => {
        if (f.id === targetUnit?.facilityId || f.code === targetUnit?.facilityId) {
          const facUnits = nextUnits.filter(u => u.facilityId === f.id || u.facilityId === f.code)
          return {
            ...f,
            units: facUnits.length,
            available: facUnits.filter(u => u.status === 'available').length,
            occupied: facUnits.filter(u => u.status === 'occupied').length
          }
        }
        return f
      })
      try {
        localStorage.setItem('storagehub:units', JSON.stringify(nextUnits))
        localStorage.setItem('storagehub:facilities', JSON.stringify(nextFacilities))
      } catch {}
      return {
        ...prev,
        units: nextUnits,
        facilities: nextFacilities
      }
    })
  }

  const deleteUnit = (unitId: string, actor?: User): { success: boolean; reason?: string } => {
    if (actor) assertPermission(actor, 'view_facilities')
    const unit = state.units.find(u => u.id === unitId || u.code === unitId)
    if (!unit) return { success: false, reason: 'Không tìm thấy gian kho.' }
    if (unit.status === 'occupied') {
      return { success: false, reason: 'Không thể xóa gian kho đang có khách thuê hoạt động!' }
    }
    const hasActiveHold = state.holds.some(h => (h.assignedUnitId === unit.id || h.assignedUnitId === unit.code) && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(h.status))
    if (hasActiveHold) {
      return { success: false, reason: 'Không thể xóa gian kho đang có đơn đặt giữ chỗ!' }
    }

    setState(prev => {
      const nextUnits = prev.units.filter(u => u.id !== unitId && u.code !== unitId)
      const nextFacilities = prev.facilities.map(f => {
        if (f.id === unit.facilityId || f.code === unit.facilityId) {
          const facUnits = nextUnits.filter(u => u.facilityId === f.id || u.facilityId === f.code)
          return {
            ...f,
            units: facUnits.length,
            available: facUnits.filter(u => u.status === 'available').length,
            occupied: facUnits.filter(u => u.status === 'occupied').length
          }
        }
        return f
      })
      try {
        localStorage.setItem('storagehub:units', JSON.stringify(nextUnits))
        localStorage.setItem('storagehub:facilities', JSON.stringify(nextFacilities))
      } catch {}
      return {
        ...prev,
        units: nextUnits,
        facilities: nextFacilities
      }
    })
    return { success: true }
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

  const payStorageHold = (holdId: string, paymentMethod: string = 'Chuyển khoản VietQR', customer: User) => {
    const paidAt = new Date()
    const checkInDeadline = new Date(paidAt.getTime() + 14 * 24 * 60 * 60 * 1000)
    const targetHold = assertHoldPermission(holdId, 'book_storage')
    if (targetHold.customerId !== customer.id && targetHold.customerEmail !== customer.email) throw new Error('Đơn đặt giữ kho không thuộc tài khoản này.')
    assertPermission(customer, 'book_storage')
    if (targetHold.depositRequired === false || targetHold.goodsReviewStatus === 'PENDING') throw new Error('Hàng hóa đang chờ Staff cơ sở duyệt; chưa thể thanh toán tiền cọc.')
    if (!targetHold.emailVerification?.verified) throw new Error('Bạn cần xác minh email trước khi thanh toán.')
    if (!targetHold.paymentExpiresAt || new Date(targetHold.paymentExpiresAt).getTime() <= paidAt.getTime()) throw new Error('Đã quá 10 phút giữ kho. Vui lòng tạo đơn đặt giữ kho mới.')
    const paidStatus = transitionReservation(targetHold.status as ReservationStatus, 'PAY_DEPOSIT')
    if (!targetHold.appointmentDate || !targetHold.appointmentTime) throw new Error('Đơn chưa có lịch Check-in hợp lệ.')
    const scheduledDate = toValidDate(targetHold.appointmentDate)
    if (scheduledDate.getTime() > checkInDeadline.getTime()) throw new Error('Lịch Check-in phải nằm trong 14 ngày sau khi thanh toán cọc. Vui lòng đổi lịch trước khi thanh toán.')
    setState(prev => {
      const nextHolds = prev.holds.map(h => {
        if (h.id === holdId) {
          const isAssigned = !!h.assignedUnitId
          return {
            ...h,
            status: isAssigned ? 'UNIT_RESERVED' : paidStatus,
            depositPaidAt: paidAt.toISOString(),
            checkInDeadline: checkInDeadline.toISOString(),
            payment: {
              amount: h.reservationDepositAmount,
              status: 'paid' as const,
              method: paymentMethod,
              paidAt: paidAt.toISOString(),
              transactionId: `TX-DEP-${Date.now().toString().slice(-6)}`
            },
            evidence: [...h.evidence, `DEPOSIT_PAID · Đã thanh toán cọc 20% qua ${paymentMethod}.`]
          }
        }
        return h
      })
      const nextCheckins = reconcileReservationCheckins(nextHolds, prev.checkins).map(checkin => checkin.holdId === holdId
        ? { ...checkin, checklist: { ...checkin.checklist, paymentConfirmed: true } }
        : checkin)

      return {
        ...prev,
        holds: nextHolds,
        // A customer-created hold already has its selected unit and appointment.
        // Create the shared Check-in record at deposit time so Staff sees it
        // immediately without requiring a reload or a second tab.
        checkins: nextCheckins,
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
      }
    })
  }

  const replySupportTicket = (ticketId: string, replyText: string, customer: User) => {
    assertPermission(customer, 'view_support')
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

  const deleteResolvedSupportTicket = (ticketId: string, customer: User) => {
    assertPermission(customer, 'view_support')
    if (customer.role !== 'customer') throw new Error('Chỉ khách hàng được xóa yêu cầu hỗ trợ của mình.')
    const ticket = state.tickets.find(item => item.id === ticketId)
    if (!ticket || (ticket.email !== customer.email && ticket.customer !== customer.name)) throw new Error('Không tìm thấy yêu cầu hỗ trợ thuộc tài khoản này.')
    if (ticket.status !== 'resolved') throw new Error('Chỉ có thể xóa yêu cầu đã được giải quyết.')
    setState(prev => ({
      ...prev,
      tickets: prev.tickets.filter(item => item.id !== ticketId)
    }))
  }

  const confirmReturnSettlement = (returnId: string, customer: User, decision: 'accepted' | 'disputed', note?: string) => {
    assertPermission(customer, 'process_returns')
    const returnCase = state.returns.find(r => r.id === returnId)
    if (!returnCase || returnCase.customerId !== customer.id) throw new Error('Không tìm thấy hồ sơ trả kho thuộc tài khoản này.')
    if (returnCase.status !== 'awaiting_customer_confirmation') throw new Error('Hồ sơ chưa sẵn sàng để xác nhận quyết toán.')
    const rental = state.rentals.find(r => r.id === returnCase.rentalId)
    const unit = state.units.find(u => u.id === returnCase.unitId)
    if (!rental || !unit) throw new Error('Không tìm thấy hợp đồng hoặc gian kho.')
    const now = new Date()

    if (decision === 'disputed') {
      if (!note?.trim()) throw new Error('Vui lòng nhập lý do yêu cầu xem xét lại quyết toán.')
      setState(prev => ({
        ...prev,
        returns: prev.returns.map(r => r.id === returnId ? { ...r, status: 'disputed', customerDecision: 'disputed', customerDecisionNote: note!.trim() } : r),
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
      rentals: prev.rentals.map(r => r.id === rental.id ? { ...r, status: amountDueFromCustomer > 0 || returnCase.netRefundAmount > 0 ? 'closing' : 'completed', gateCode: '', checkedOutAt: amountDueFromCustomer > 0 || returnCase.netRefundAmount > 0 ? undefined : now.toISOString(), accessRevokedAt: now.toISOString() } : r),
      returns: prev.returns.map(r => r.id === returnId ? { ...r, status: amountDueFromCustomer > 0 ? 'payment_due' : returnCase.netRefundAmount > 0 ? 'refund_pending' : 'completed', customerConfirmed: true, customerConfirmedAt: now.toISOString(), customerDecision: 'accepted', customerDecisionNote: note?.trim(), completedAt: amountDueFromCustomer > 0 || returnCase.netRefundAmount > 0 ? undefined : now.toISOString() } : r),
      accessCredentials: prev.accessCredentials.map(ac => ac.rentalId === rental.id ? { ...ac, status: 'REVOKED', revokedAt: now.toISOString() } : ac),
      maintenanceTasks: prev.maintenanceTasks.some(task => task.unitId === unit.id && task.status !== 'completed') ? prev.maintenanceTasks : [maintenanceTask, ...prev.maintenanceTasks],
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_SETTLEMENT_CONFIRMED', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: `${amountDueFromCustomer > 0 ? `Khách xác nhận quyết toán và cần đóng thêm ${formatVnd(amountDueFromCustomer)} do tổng phí vượt tiền đảm bảo.` : returnCase.netRefundAmount > 0 ? `Khách hàng xác nhận quyết toán. Chờ Staff xác nhận chuyển hoàn cọc ${formatVnd(returnCase.netRefundAmount)}.` : 'Khách hàng xác nhận quyết toán; không phát sinh khoản hoàn cọc.'} Gian kho chuyển sang chờ Manager nghiệm thu trước khi mở lại.`, timestamp: now.toLocaleString('vi-VN') }, ...prev.activities]
    }))
  }

  const payReturnBalance = (returnId: string, customer: User, paymentMethod: 'BANK_TRANSFER' | 'ONLINE_GATEWAY', transactionReference: string) => {
    assertPermission(customer, 'process_returns')
    const returnCase = state.returns.find(item => item.id === returnId)
    if (!returnCase || returnCase.customerId !== customer.id || returnCase.status !== 'payment_due') throw new Error('Không tìm thấy khoản quyết toán trả kho cần thanh toán.')
    const amountDue = returnCase.amountDueFromCustomer ?? 0
    if (amountDue <= 0) throw new Error('Hồ sơ không còn khoản phải đóng thêm.')
    if (!transactionReference.trim()) throw new Error('Thiếu mã giao dịch thanh toán.')
    const rental = state.rentals.find(item => item.id === returnCase.rentalId)
    if (!rental) throw new Error('Không tìm thấy hồ sơ thuê liên quan.')
    const now = new Date()
    const paymentId = `PAY-RET-BAL-${Date.now().toString().slice(-8)}`
    const payment: StoragePayment = { id: paymentId, reservationId: rental.holdId, rentalId: rental.id, type: 'DAMAGE_FEE', amount: amountDue, paymentMethod, transactionReference: transactionReference.trim(), status: 'PAID', paidAt: now.toISOString(), recordedBy: customer.id, description: `Thanh toán phần quyết toán trả kho vượt tiền đảm bảo: ${formatVnd(amountDue)}` }
    setState(prev => ({
      ...prev,
      payments: [payment, ...prev.payments],
      rentals: prev.rentals.map(item => item.id === rental.id ? { ...item, status: 'completed', checkedOutAt: now.toISOString(), accessRevokedAt: item.accessRevokedAt || now.toISOString(), gateCode: '' } : item),
      returns: prev.returns.map(item => item.id === returnId ? { ...item, status: 'completed', settlementPaymentId: paymentId, settlementPaidAt: now.toISOString(), completedAt: now.toISOString() } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_BALANCE_PAID', actorId: customer.id, actorName: customer.name, actorRole: customer.role, facilityId: returnCase.facilityId, entityType: 'payment', entityId: paymentId, notes: `Khách đã thanh toán thêm ${formatVnd(amountDue)} do quyết toán trả kho vượt tiền đảm bảo. Mã giao dịch: ${transactionReference.trim()}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const completeReturnRefund = (returnId: string, staffUser: User, transactionReference: string) => {
    assertPermission(staffUser, 'process_returns')
    if (staffUser.role !== 'staff' && staffUser.role !== 'manager' && staffUser.role !== 'admin') throw new Error('Chỉ nhân viên cơ sở được xác nhận chuyển hoàn cọc.')
    const returnCase = state.returns.find(item => item.id === returnId)
    if (!returnCase || returnCase.status !== 'refund_pending') throw new Error('Hồ sơ không ở trạng thái chờ hoàn cọc.')
    if (staffUser.role === 'manager' || staffUser.role === 'admin') assertFacilityManager(staffUser, returnCase.facilityId, returnCase.facilityName)
    if (staffUser.role === 'staff' && !isFacilityVisible(staffUser, returnCase.facilityId, returnCase.facilityName)) throw new Error('Bạn không có quyền xử lý hồ sơ của cơ sở khác.')
    if (!transactionReference.trim()) throw new Error('Vui lòng nhập mã giao dịch hoàn cọc.')
    const refundPayment = state.payments.find(item => item.rentalId === returnCase.rentalId && item.type === 'REFUND' && item.status === 'PENDING')
    if (!refundPayment) throw new Error('Không tìm thấy lệnh hoàn cọc đang chờ xử lý.')
    const now = new Date()
    setState(prev => ({
      ...prev,
      payments: prev.payments.map(item => item.id === refundPayment.id ? { ...item, status: 'PAID', transactionReference: transactionReference.trim(), paidAt: now.toISOString(), receivedBy: staffUser.id, recordedBy: staffUser.id } : item),
      rentals: prev.rentals.map(item => item.id === returnCase.rentalId ? { ...item, status: 'completed', checkedOutAt: now.toISOString() } : item),
      returns: prev.returns.map(item => item.id === returnId ? { ...item, status: 'completed', completedAt: now.toISOString(), refundTransaction: { id: refundPayment.id, type: 'refund', amount: item.netRefundAmount, status: 'paid', recordedAt: now.toISOString() } } : item),
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_REFUND_COMPLETED', actorId: staffUser.id, actorName: staffUser.name, actorRole: staffUser.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: `Đã chuyển hoàn cọc ${formatVnd(returnCase.netRefundAmount)}. Mã giao dịch: ${transactionReference.trim()}.`, timestamp: now.toISOString() }, ...prev.activities]
    }))
  }

  const reviewReturnDispute = (returnId: string, manager: User, resolutionNote?: string) => {
    assertPermission(manager, 'process_returns')
    const returnCase = state.returns.find(r => r.id === returnId)
    if (!returnCase || returnCase.status !== 'disputed') throw new Error('Không tìm thấy hồ sơ khiếu nại đang chờ xử lý.')
    assertFacilityManager(manager, returnCase.facilityId, returnCase.facilityName)
    if (!resolutionNote?.trim()) throw new Error('Vui lòng nhập lý do và kết quả rà soát quyết toán.')
    const now = new Date()
    setState(prev => ({
      ...prev,
      returns: prev.returns.map(r => r.id === returnId ? { ...r, status: 'awaiting_customer_confirmation', staffNotes: `${r.staffNotes || ''}${r.staffNotes ? ' · ' : ''}Manager: ${resolutionNote?.trim() || 'Đã rà soát và giữ nguyên quyết toán.'}` } : r),
      activities: [{ id: `act-${Date.now()}`, action: 'RETURN_DISPUTE_REVIEWED', actorId: manager.id, actorName: manager.name, actorRole: manager.role, facilityId: returnCase.facilityId, entityType: 'return', entityId: returnId, notes: resolutionNote?.trim() || 'Manager đã rà soát và gửi lại quyết toán cho khách.', timestamp: now.toLocaleString('vi-VN') }, ...prev.activities]
    }))
  }

  const verifyHoldEmail = (holdId: string, token: string, customer: User): boolean => {
    const hold = assertHoldPermission(holdId, 'book_storage')
    if (hold.customerId !== customer.id && hold.customerEmail !== customer.email) throw new Error('Đơn đặt giữ kho không thuộc tài khoản này.')
    assertPermission(customer, 'book_storage')
    let success = false
    setState(prev => ({
      ...prev,
      holds: prev.holds.map(h => {
        if (h.id === holdId && h.status === 'awaiting_email' && h.emailVerification) {
          const isExpired = new Date(h.emailVerification.expiresAt).getTime() <= Date.now()
          if (!isExpired && h.emailVerification.token === token.trim()) {
            success = true
            const verifiedAt = new Date()
            const requiresGoodsReview = h.goodsReviewStatus === 'PENDING'
            const goodsReviewDueAt = requiresGoodsReview
              ? new Date(verifiedAt.getTime() + 12 * 60 * 60 * 1000).toISOString()
              : h.goodsReviewDueAt
            return {
              ...h,
              status: requiresGoodsReview ? transitionReservation(h.status as ReservationStatus, 'VERIFY_EMAIL') : 'awaiting_payment',
              goodsReviewSubmittedAt: requiresGoodsReview ? verifiedAt.toISOString() : h.goodsReviewSubmittedAt,
              goodsReviewDueAt,
              expiresAt: requiresGoodsReview ? goodsReviewDueAt! : h.expiresAt,
              evidence: requiresGoodsReview
                ? [...h.evidence, `EMAIL_VERIFIED · Khách đã xác minh email; hồ sơ hàng hóa được gửi Staff duyệt trước ${goodsReviewDueAt}.`]
                : h.evidence,
              emailVerification: {
                ...h.emailVerification,
                verified: true,
                verifiedAt: verifiedAt.toISOString()
              }
            }
          }
        }
        return h
      })
    }))
    return success
  }

  const resendHoldEmail = (holdId: string, customer: User) => {
    const hold = assertHoldPermission(holdId, 'book_storage')
    if (hold.customerId !== customer.id && hold.customerEmail !== customer.email) throw new Error('Đơn đặt giữ kho không thuộc tài khoản này.')
    assertPermission(customer, 'book_storage')
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

  const scheduleCheckIn = (holdId: string, appointmentDate: string, appointmentTime: string, customer: User) => {
    const hold = assertHoldPermission(holdId, 'view_reservations')
    if (hold.customerId !== customer.id && hold.customerEmail !== customer.email) throw new Error('Đơn đặt giữ kho không thuộc tài khoản này.')
    assertPermission(customer, 'view_reservations')
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
    assertPermission(customer, 'view_reservations')
    const reservation = state.holds.find(item => item.id === reservationId)
    if (!reservation || (reservation.customerId !== customer.id && reservation.customerEmail !== customer.email)) throw new Error('Không tìm thấy lịch sử giữ kho thuộc tài khoản này.')
    const linkedRental = state.rentals.find(item => item.holdId === reservationId)
    const canArchive = ['CANCELLED', 'EXPIRED'].includes(reservation.status) || (reservation.status === 'COMPLETED' && Boolean(linkedRental))
    if (!canArchive) throw new Error('Chỉ có thể xóa khỏi danh sách những hồ sơ giữ kho đã hết hiệu lực.')
    setState(prev => ({ ...prev, holds: prev.holds.map(item => item.id === reservationId ? { ...item, customerArchivedAt: new Date().toISOString() } : item) }))
  }

  const archiveRentalHistory = (rentalId: string, customer: User) => {
    assertPermission(customer, 'view_rentals')
    const rental = state.rentals.find(item => item.id === rentalId)
    if (!rental || (rental.customerId !== customer.id && rental.customerEmail !== customer.email)) throw new Error('Không tìm thấy hồ sơ thuê thuộc tài khoản này.')
    if (rental.status !== 'completed') throw new Error('Chỉ có thể xóa khỏi danh sách hồ sơ thuê đã hết hiệu lực.')
    setState(prev => ({ ...prev, rentals: prev.rentals.map(item => item.id === rentalId ? { ...item, customerArchivedAt: new Date().toISOString() } : item) }))
  }

  const archiveContractHistory = (contractId: string, customer: User) => {
    assertPermission(customer, 'view_contracts')
    const contract = state.contracts.find(item => item.id === contractId)
    if (!contract || contract.customerId !== customer.id) throw new Error('Không tìm thấy hợp đồng thuộc tài khoản này.')
    const rental = state.rentals.find(item => item.contractId === contract.id || item.holdId === contract.reservationId)
    if (!rental || rental.status !== 'completed') throw new Error('Chỉ có thể xóa khỏi danh sách hợp đồng đã hết hiệu lực.')
    setState(prev => ({ ...prev, contracts: prev.contracts.map(item => item.id === contractId ? { ...item, customerArchivedAt: new Date().toISOString() } : item) }))
  }

  const contextValue: StorageHubContextValue = {
    ...state,
    unitTypes: UNIT_TYPES,
    can,
    updateRolePermissions,
    recordLoginAttempt,
    startSession,
    endSession,
    revokeSession,
    revokeAllUserSessions,
    updateCustomerProfile,
    requestOwnPasswordReset,
    submitProfileChangeRequest,
    deleteOwnCustomerAccount,
    calculateDIMAndQuote,
    payStorageHold,
    verifyHoldEmail,
    resendHoldEmail,
    scheduleCheckIn,
    validateAndCreateReservation,
    approveReservation,
    rejectGoodsReview,
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
    deleteResolvedSupportTicket,
    registerCustomer,
    createInternalAccount,
    createCustomerSupportAccount,
    updateUserAccount,
    setUserAccountStatus,
    deleteUserAccount,
    requestUserPasswordReset,
    resetToDemoData,
    createFacility,
    updateFacility,
    deleteFacility,
    createUnit,
    updateUnit,
    deleteUnit
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
