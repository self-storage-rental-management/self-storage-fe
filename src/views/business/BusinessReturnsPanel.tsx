import { useReturnRecords } from '../../hooks/useReturnRecords'
import LocalizedDateInput from '../../components/LocalizedDateInput'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, Modal, Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui'
import { formatVndAmount as formatRawVnd } from '../../i18n/currency'
import { isApiAuthenticated } from '../../services/authApi'
import {
  feeKeys,
  getReturn,
  listReturns,
  inspectReturn,
  confirmReturn,
  reviewDispute,
  decideSetupExit,
  decideLegacyPricing,
  completeRefund,
  uploadReturnEvidence,
  validateReturnSettlementReceipt,
  paySettlement,
  requestReturn,
  returnError,
  type ApiReturn,
  type ReturnFees,
  type InspectionInput,
} from '../../services/returnApi'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { ReturnCase } from '../../types/storageHub'

interface Props {
  user: User
}

export const statusLabels: Record<string, string> = {
  requested: 'Đã yêu cầu trả kho',
  scheduled: 'Đã hẹn nghiệm thu',
  inspected: 'Đã nghiệm thu hiện trường',
  awaiting_business_review: 'Chờ Business duyệt bảng giá cũ',
  awaiting_customer_confirmation: 'Chờ khách xác nhận quyết toán',
  disputed: 'Đang khiếu nại - Cần BO giải quyết',
  payment_due: 'Chờ khách nộp phụ phí',
  refund_pending: 'Chờ giải ngân hoàn cọc',
  completed: 'Đã hoàn tất thanh lý & trả kho',
  cancelled: 'Đã hủy yêu cầu',
}

export const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'disputed':
      return 'error'
    case 'refund_pending':
      return 'purple'
    case 'completed':
      return 'success'
    case 'awaiting_customer_confirmation':
    case 'awaiting_business_review':
    case 'payment_due':
    case 'requested':
    case 'scheduled':
    case 'inspected':
      return 'warning'
    default:
      return 'info'
  }
}

// Bộ dữ liệu mẫu phong phú đại diện cho các kịch bản thực tế
const SAMPLE_RETURNS: Array<{
  id: string
  rentalId: string
  unitNumber: string
  facilityName: string
  customerName: string
  customerPhone?: string
  scheduledDate: string
  status: string
  returnType?: ApiReturn['returnType']
  settlementMode?: ApiReturn['settlementMode']
  depositAmount: number
  totalDeductions: number
  netRefundAmount: number
  amountDueFromCustomer: number
  damageFee: number
  cleaningFee: number
  lostItemFee: number
  overdueFee: number
  outstandingFee: number
  returnedKey: boolean
  returnedCard: boolean
  returnedLock: boolean
  inspectionNotes?: string | null
  inspectedAt?: string | null
  customerDecisionNote?: string | null
  managerResolutionNote?: string | null
  evidencePhotos?: string[]
  proposedUnitStatus?: 'available' | 'maintenance' | null
  settlementPaymentId?: string | null
  completedAt?: string | null
  settlementReceipt?: ApiReturn['settlementReceipt']
  setupExitReviewRequired?: boolean
  moveInCompletedAt?: string | null
  earlyTerminationPolicy?: import('../../services/returnApi').EarlyTerminationPolicyView | null
  activeReturnPolicy?: import('../../services/returnApi').ActiveReturnPolicyView | null
  legacyPricingReviewRequired?: boolean
  legacyPricingSnapshotAvailable?: boolean
  legacyPricingEvidenceFileId?: string | null
}> = [
  {
    id: 'sample-ret-001',
    rentalId: 'sample-rnt-001',
    unitNumber: 'HCM-Q1-M-001',
    facilityName: 'Kho Việt - Cơ sở Quận 1',
    customerName: 'Nguyễn Văn An',
    customerPhone: '0903 112 334',
    scheduledDate: '2026-10-18',
    status: 'scheduled',
    depositAmount: 9500000,
    totalDeductions: 0,
    netRefundAmount: 9500000,
    amountDueFromCustomer: 0,
    damageFee: 0,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
    returnedKey: false,
    returnedCard: false,
    returnedLock: false,
    inspectionNotes: 'Khách hàng hẹn trả kho đúng hạn hợp đồng. Chờ Staff kiểm tra hiện trạng.',
    customerDecisionNote: null,
    managerResolutionNote: null,
    proposedUnitStatus: 'available',
  },
  {
    id: 'sample-ret-002',
    rentalId: 'sample-rnt-002',
    unitNumber: 'HCM-Q7-L-002',
    facilityName: 'Kho Việt - Cơ sở Quận 7 (Phú Mỹ Hưng)',
    customerName: 'Trần Thị Mai',
    customerPhone: '0918 554 221',
    scheduledDate: '2026-10-15',
    status: 'awaiting_customer_confirmation',
    depositAmount: 15000000,
    totalDeductions: 300000,
    netRefundAmount: 14700000,
    amountDueFromCustomer: 0,
    damageFee: 200000,
    cleaningFee: 100000,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
    returnedKey: true,
    returnedCard: true,
    returnedLock: true,
    inspectionNotes: 'Mặt sàn trầy xước nhẹ do kéo lê kiện hàng gỗ. Vệ sinh bụi sàn kho.',
    customerDecisionNote: null,
    managerResolutionNote: null,
    proposedUnitStatus: 'available',
  },
  {
    id: 'sample-ret-003',
    rentalId: 'sample-rnt-003',
    unitNumber: 'BD-F01-XL-003',
    facilityName: 'Kho Việt - Cơ sở Bình Dương',
    customerName: 'Lê Hoàng Long',
    customerPhone: '0977 889 001',
    scheduledDate: '2026-10-14',
    status: 'disputed',
    depositAmount: 6000000,
    totalDeductions: 550000,
    netRefundAmount: 5450000,
    amountDueFromCustomer: 0,
    damageFee: 300000,
    cleaningFee: 250000,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
    returnedKey: true,
    returnedCard: true,
    returnedLock: true,
    inspectionNotes: 'Tường có vết ố nhỏ, sàn kho còn nhiều bụi cát.',
    customerDecisionNote: 'Tôi đã tự thuê dịch vụ vệ sinh công nghiệp trước khi trả kho, có hóa đơn đính kèm. Đề nghị Ban Điều Hành xem xét hủy bỏ phí vệ sinh 250.000đ.',
    managerResolutionNote: null,
    proposedUnitStatus: 'available',
  },
  {
    id: 'sample-ret-004',
    rentalId: 'sample-rnt-004',
    unitNumber: 'HCM-TD-S-001',
    facilityName: 'Kho Việt - Cơ sở Thủ Đức',
    customerName: 'Phạm Minh Đức',
    customerPhone: '0934 667 889',
    scheduledDate: '2026-10-10',
    status: 'refund_pending',
    depositAmount: 4800000,
    totalDeductions: 0,
    netRefundAmount: 4800000,
    amountDueFromCustomer: 0,
    damageFee: 0,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
    returnedKey: true,
    returnedCard: true,
    returnedLock: true,
    inspectionNotes: 'Kho được giữ gìn sạch đẹp, hoàn trả nguyên trạng. Bàn giao đầy đủ tài sản.',
    customerDecisionNote: 'Đồng ý với kết quả nghiệm thu.',
    managerResolutionNote: 'Đã phê duyệt quyết toán hoàn cọc 100%.',
    proposedUnitStatus: 'available',
  },
  {
    id: 'sample-ret-005',
    rentalId: 'sample-rnt-005',
    unitNumber: 'HCM-Q1-XL-001',
    facilityName: 'Kho Việt - Cơ sở Quận 1',
    customerName: 'Vũ Đình Khoa',
    customerPhone: '0908 333 444',
    scheduledDate: '2026-10-05',
    status: 'completed',
    depositAmount: 18000000,
    totalDeductions: 500000,
    netRefundAmount: 17500000,
    amountDueFromCustomer: 0,
    damageFee: 500000,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
    returnedKey: true,
    returnedCard: true,
    returnedLock: true,
    inspectionNotes: 'Thay thế 01 bản lề cửa kho bị xệ. Bàn giao đủ khóa.',
    customerDecisionNote: 'Đã xác nhận quyết toán.',
    managerResolutionNote: 'Đã hoàn tiền cọc thành công vào tài khoản khách hàng qua cổng VNPay.',
    proposedUnitStatus: 'available',
    settlementPaymentId: 'VNPAY-REFUND-88992211',
    completedAt: '2026-10-06 14:30:00',
  },
]

export default function BusinessReturnsPanel({ user }: Props) {
  const hub = useStorageHub()
  const useApi = isApiAuthenticated()
  const isBusiness = user.role === 'business'
  const formatVnd = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'Chưa xác định' : formatRawVnd(value)
  const apiRead = useReturnRecords('business', useApi)

  const apiRows = apiRead.rows
  const apiLoading = apiRead.loading
  const apiError = apiRead.error

  // Local fallback state (cho phép người dùng luôn tương tác mượt mà)
  const [localReturns, setLocalReturns] = useState<typeof SAMPLE_RETURNS>(() => {
    if (useApi) return []
    try {
      const saved = localStorage.getItem('storagehub:bo:returns-cache')
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return (parsed as typeof SAMPLE_RETURNS).filter((r) => r.status === 'completed')
        }
      }
    } catch {}
    return SAMPLE_RETURNS.filter((r) => r.status === 'completed')
  })

  // Filter State
  const [statusFilter, setStatusFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal Chi tiết & Thao tác
  const [selectedItem, setSelectedItem] = useState<(typeof SAMPLE_RETURNS)[0] | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'inspect' | 'dispute' | 'refund' | 'pay'>('overview')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Form states
  // 1. Inspection Form
  const [inspectFees, setInspectFees] = useState<ReturnFees>({
    damageFee: 0,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
  })
  const [inspectInventory, setInspectInventory] = useState<'match' | 'missing' | 'excess'>('match')
  const [inspectDamage, setInspectDamage] = useState<'no_damage' | 'minor_damage' | 'major_damage' | 'abandoned_goods'>('minor_damage')
  const [inspectReturned, setInspectReturned] = useState(() => ({
    returnedKey: !useApi,
    returnedCard: !useApi,
    returnedLock: !useApi,
  }))
  const [inspectProposedUnit, setInspectProposedUnit] = useState<'available' | 'maintenance'>('available')
  const [inspectNotes, setInspectNotes] = useState('')

  // 2. Dispute Review Form (BO)
  const [resolutionNote, setResolutionNote] = useState('')
  const [proposedUnit, setProposedUnit] = useState<'available' | 'maintenance'>('available')
  const [reviewFees, setReviewFees] = useState<ReturnFees>({
    damageFee: 0,
    cleaningFee: 0,
    lostItemFee: 0,
    overdueFee: 0,
    outstandingFee: 0,
  })

  // 3. Customer Dispute Note simulation
  const [disputeNoteInput, setDisputeNoteInput] = useState('')

  // 4. Refund Form
  const [refundReference, setRefundReference] = useState('')
  const [refundNotes, setRefundNotes] = useState('')
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER')
  const [refundFile, setRefundFile] = useState<File | null>(null)
  const [refundConfirmed, setRefundConfirmed] = useState(false)
  const refundLock = useRef(false)
  const refundUpload = useRef<{ file: File; id: string } | null>(null)
  const [setupRefundAmount, setSetupRefundAmount] = useState(0)
  const [setupRentalRefundAmount, setSetupRentalRefundAmount] = useState(0)
  const [setupDecisionNote, setSetupDecisionNote] = useState('')
  const [legacyRentalCharge, setLegacyRentalCharge] = useState(0)
  const [legacyRentalRefund, setLegacyRentalRefund] = useState(0)
  const [legacyDecisionNote, setLegacyDecisionNote] = useState('')
  const [legacySnapshotJson, setLegacySnapshotJson] = useState('')
  const [legacyEvidenceFileId, setLegacyEvidenceFileId] = useState('')

  // 5. Payment Due Form
  const [payMethod, setPayMethod] = useState('VNPAY')
  const [payNotes, setPayNotes] = useState('')

  // Modal Tạo yêu cầu trả kho mới
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newRentalId, setNewRentalId] = useState('')
  const [newScheduledDate, setNewScheduledDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10))
  const [newNotes, setNewNotes] = useState('Hết hạn hợp đồng, đề nghị nghiệm thu đúng hẹn để nhận lại tiền cọc.')

  // Modal Demo Auto-runner
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [demoStep, setDemoStep] = useState(0)
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoLogs, setDemoLogs] = useState<string[]>([])

  // Lưu cache local state
  const saveLocalState = (items: typeof localReturns) => {
    setLocalReturns(items)
    try {
      localStorage.setItem('storagehub:bo:returns-cache', JSON.stringify(items))
    } catch {}
  }

  // Dọn dẹp cache local ngay khi mở màn hình, loại bỏ toàn bộ hồ sơ đang chạy dở
  useEffect(() => {
    try {
      const saved = localStorage.getItem('storagehub:bo:returns-cache')
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          const completedOnly = (parsed as typeof SAMPLE_RETURNS).filter((r) => r.status === 'completed')
          if (completedOnly.length !== parsed.length) {
            localStorage.setItem('storagehub:bo:returns-cache', JSON.stringify(completedOnly))
            setLocalReturns(completedOnly)
          }
        }
      }
    } catch {}
  }, [])

  const loadApiData = apiRead.refresh

  // Normalized list of return items
  const displayItems = useMemo<typeof SAMPLE_RETURNS>(() => {
    if (useApi && !apiError && !apiLoading) {
      return apiRows.map((r) => ({
        id: r.id,
        rentalId: r.rentalId,
        unitNumber: r.unitNumber,
        facilityName: r.facilityName,
        customerName: r.customerName,
        customerPhone: (r as unknown as { customerPhone?: string }).customerPhone || '',
        scheduledDate: r.scheduledDate,
        status: r.status,
        returnType: r.returnType,
        settlementMode: r.settlementMode,
        depositAmount: r.depositAmount ?? 0,
        totalDeductions: r.totalDeductions,
        netRefundAmount: r.netRefundAmount ?? Number.NaN,
        amountDueFromCustomer: r.amountDueFromCustomer ?? Number.NaN,
        damageFee: r.damageFee,
        cleaningFee: r.cleaningFee,
        lostItemFee: r.lostItemFee,
        overdueFee: r.overdueFee,
        outstandingFee: r.outstandingFee,
        returnedKey: false,
        returnedCard: false,
        returnedLock: false,
        inspectionNotes: r.inspectionNotes,
        inspectedAt: r.inspectedAt,
        customerDecisionNote: r.customerDecisionNote ?? null,
        managerResolutionNote: r.managerResolutionNote,
        evidencePhotos: r.evidencePhotos,
        proposedUnitStatus: r.proposedUnitStatus,
        settlementPaymentId: r.settlementPaymentId ?? r.settlementReceipt?.transactionReference ?? null,
        completedAt: r.completedAt ?? r.settlementPaidAt ?? null,
        settlementReceipt: r.settlementReceipt,
        setupExitReviewRequired: r.setupExitReviewRequired,
        moveInCompletedAt: r.moveInCompletedAt,
        earlyTerminationPolicy: r.earlyTerminationPolicy,
        activeReturnPolicy: r.activeReturnPolicy,
        legacyPricingReviewRequired: r.legacyPricingReviewRequired,
        legacyPricingSnapshotAvailable: r.legacyPricingSnapshotAvailable,
        legacyPricingEvidenceFileId: r.legacyPricingEvidenceFileId,
      }))
    }

    return useApi ? [] : localReturns
  }, [useApi, apiRows, apiError, apiLoading, localReturns])

  // Facilities list for filter
  const facilityNames = useMemo(() => {
    const set = new Set<string>()
    displayItems.forEach((r) => r.facilityName && set.add(r.facilityName))
    if (!useApi) {
      hub.facilities.forEach((f) => f.name && set.add(f.name))
    }
    return Array.from(set)
  }, [displayItems, hub.facilities, useApi])

  // Filtered rows
  const filteredItems = useMemo(() => {
    return displayItems.filter((item) => {
      const matchStatus = statusFilter === 'all' || item.status === statusFilter
      const matchFacility = facilityFilter === 'all' || item.facilityName === facilityFilter
      const matchQuery =
        !searchQuery.trim() ||
        item.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchStatus && matchFacility && matchQuery
    })
  }, [displayItems, statusFilter, facilityFilter, searchQuery])

  // Quick stats
  const totalCount = displayItems.length
  const disputedCount = displayItems.filter((i) => i.status === 'disputed').length
  const refundPendingCount = displayItems.filter((i) => i.status === 'refund_pending').length
  const awaitingCustCount = displayItems.filter((i) => i.status === 'awaiting_customer_confirmation' || i.status === 'inspected').length
  const completedCount = displayItems.filter((i) => i.status === 'completed').length
  const totalSettledRefund = displayItems
    .filter((i) => i.status === 'completed' || i.status === 'refund_pending')
    .reduce((sum, item) => sum + (item.netRefundAmount || 0), 0)

  // Mở modal chi tiết hồ sơ
  const handleOpenDetail = (item: (typeof displayItems)[0], initialTab: typeof activeTab = 'overview') => {
    if (refundLock.current) return
    setSelectedItem(item)
    setRefundMethod('BANK_TRANSFER')
    setRefundFile(null)
    setRefundConfirmed(false)
    refundUpload.current = null
    setActiveTab(initialTab)
    setReviewFees({
      damageFee: item.damageFee || 0,
      cleaningFee: item.cleaningFee || 0,
      lostItemFee: item.lostItemFee || 0,
      overdueFee: item.overdueFee || 0,
      outstandingFee: item.outstandingFee || 0,
    })
    setInspectFees({
      damageFee: useApi ? (item.damageFee ?? 0) : (item.damageFee || 200000),
      cleaningFee: useApi ? (item.cleaningFee ?? 0) : (item.cleaningFee || 100000),
      lostItemFee: item.lostItemFee || 0,
      overdueFee: item.overdueFee || 0,
      outstandingFee: item.outstandingFee || 0,
    })
    setInspectReturned({
      returnedKey: useApi ? false : item.returnedKey,
      returnedCard: useApi ? false : item.returnedCard,
      returnedLock: useApi ? false : item.returnedLock,
    })
    setInspectNotes(item.inspectionNotes ?? (useApi ? '' : 'Đã kiểm tra hiện trường: sàn kho xước nhẹ, tường sạch, bàn giao đủ khóa.'))
    setProposedUnit(item.proposedUnitStatus || 'available')
    setInspectProposedUnit(item.proposedUnitStatus || 'available')
    setResolutionNote(item.managerResolutionNote ?? (useApi ? '' : 'Ban Điều Hành xem xét: Chấp thuận miễn giảm phí vệ sinh cho khách hàng sau khi kiểm tra biên nhận.'))
    setRefundReference(useApi ? '' : `VNPAY-REFUND-${Date.now().toString().slice(-6)}`)
    setRefundNotes(useApi ? '' : `Đã chuyển hoàn tiền cọc cho khách hàng ${item.customerName} theo quyết toán thanh lý hợp đồng.`)
    setSetupRefundAmount(item.netRefundAmount || item.depositAmount || 0)
    setSetupRentalRefundAmount(item.earlyTerminationPolicy?.rentalRefundAmount || 0)
    setSetupDecisionNote(useApi ? '' : 'Business duyệt xử lý theo chính sách hủy hiện hành.')
    setLegacyRentalCharge(item.activeReturnPolicy?.totalRentalCharge || item.earlyTerminationPolicy?.totalRentalCharge || 0)
    setLegacyRentalRefund(item.activeReturnPolicy?.rentalRefundAmount || item.earlyTerminationPolicy?.rentalRefundAmount || 0)
    setLegacyDecisionNote(useApi ? '' : 'Business duyệt theo chứng cứ lưu cùng hồ sơ cũ.')
    setLegacySnapshotJson('')
    setLegacyEvidenceFileId(item.legacyPricingEvidenceFileId || '')
    setDisputeNoteInput(useApi ? '' : 'Tôi đã tự dọn vệ sinh kho trước khi bàn giao. Đề nghị Ban Điều Hành xem xét giảm phí vệ sinh.')
    setFeedback('')
    setModalOpen(true)
  }

  const handleSetupExitDecision = async () => {
    if (!selectedItem || !selectedItem.setupExitReviewRequired) return
    if (selectedItem.moveInCompletedAt && !selectedItem.inspectedAt) {
      setFeedback('Hàng đã được đưa vào kho, Staff phải kiểm kê/trả kho trước khi Business quyết định số tiền hoàn.')
      return
    }
    if (!setupDecisionNote.trim()) {
      setFeedback('Vui lòng nhập lý do quyết định setup.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      if (useApi) {
        await decideSetupExit(selectedItem.id, setupRefundAmount, setupDecisionNote, setupRentalRefundAmount)
        await loadApiData()
      } else {
        saveLocalState(localReturns.map((item) => item.id === selectedItem.id
          ? {
              ...item,
              setupExitReviewRequired: false,
              netRefundAmount: setupRefundAmount + setupRentalRefundAmount,
              totalDeductions: Math.max(0, item.depositAmount - setupRefundAmount),
              status: setupRefundAmount + setupRentalRefundAmount > 0 ? 'refund_pending' : 'completed',
              managerResolutionNote: `Business setup-exit decision: ${setupDecisionNote.trim()}`,
            }
          : item))
      }
      setSelectedItem((prev) => prev ? {
        ...prev,
        setupExitReviewRequired: false,
        netRefundAmount: setupRefundAmount + setupRentalRefundAmount,
        totalDeductions: Math.max(0, prev.depositAmount - setupRefundAmount),
        status: setupRefundAmount + setupRentalRefundAmount > 0 ? 'refund_pending' : 'completed',
        managerResolutionNote: `Business setup-exit decision: ${setupDecisionNote.trim()}`,
      } : null)
      setFeedback(setupRefundAmount > 0
        ? 'Đã duyệt khoản hoàn. Staff sẽ thực hiện chứng từ hoàn tiền thực tế.'
        : 'Đã chốt không hoàn tiền và giải phóng hồ sơ setup.')
      setActiveTab('overview')
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleLegacyPricingDecision = async () => {
    if (!selectedItem || selectedItem.status !== 'awaiting_business_review') return
    if (!legacyDecisionNote.trim() || !legacySnapshotJson.trim() || !legacyEvidenceFileId.trim()) {
      setFeedback('Cần nhập lý do, snapshot bảng giá JSON và mã file bằng chứng nguồn.')
      return
    }
    setSubmitting(true)
    setFeedback('')
    try {
      if (useApi) {
        await decideLegacyPricing(selectedItem.id, {
          approvedRentalCharge: legacyRentalCharge,
          approvedRentalRefund: legacyRentalRefund,
          resolutionNote: legacyDecisionNote,
          pricingSnapshotJson: legacySnapshotJson,
          sourceDocumentFileId: legacyEvidenceFileId,
        })
        await loadApiData()
      }
      setFeedback('Đã lưu snapshot bảng giá cũ và chuyển hồ sơ sang bước quyết toán.')
    } catch (error) {
      setFeedback(returnError(error))
    } finally {
      setSubmitting(false)
    }
  }

  // 1. Thao tác: Nghiệm thu hiện trường (Inspection)
  const handlePerformInspection = async () => {
    if (!selectedItem) return
    if (useApi) { setFeedback('Nghiệm thu thuộc Staff tại cơ sở.'); return }
    if (isBusiness) {
      setFeedback('Business chỉ được theo dõi hồ sơ và thực hiện hoàn cọc đã đủ điều kiện.')
      return
    }
    setSubmitting(true)
    setFeedback('')

    const totalDed = inspectFees.damageFee + inspectFees.cleaningFee + inspectFees.lostItemFee + inspectFees.overdueFee + inspectFees.outstandingFee
    const deposit = selectedItem.depositAmount || 0
    const netRef = Math.max(0, deposit - totalDed)
    const due = Math.max(0, totalDed - deposit)

    try {
      if (useApi) {
        await inspectReturn(selectedItem.id, {
          ...inspectFees,
          inventoryMatch: inspectInventory,
          damageClassification: inspectDamage,
          staffNotes: inspectNotes.trim() || 'Nghiệm thu hoàn tất',
          evidencePhotos: selectedItem.evidencePhotos || [],
          ...inspectReturned,
          proposedUnitStatus: inspectProposedUnit,
        })
        await loadApiData()
      }

      if (useApi) {
        setSelectedItem((prev) => prev ? { ...prev, status: 'awaiting_customer_confirmation', ...inspectFees, totalDeductions: totalDed, netRefundAmount: netRef, amountDueFromCustomer: due, inspectionNotes: inspectNotes.trim(), proposedUnitStatus: inspectProposedUnit } : null)
        setFeedback('Đã lập biên bản nghiệm thu hiện trạng thành công! Hồ sơ chuyển sang Chờ khách xác nhận.')
        setActiveTab('overview')
        return
      }

      // Cập nhật local state
      const updated = localReturns.map((r) =>
        r.id === selectedItem.id
          ? {
              ...r,
              status: 'awaiting_customer_confirmation',
              ...inspectFees,
              totalDeductions: totalDed,
              netRefundAmount: netRef,
              amountDueFromCustomer: due,
              inspectionNotes: inspectNotes.trim(),
              proposedUnitStatus: inspectProposedUnit,
              returnedKey: inspectReturned.returnedKey,
              returnedCard: inspectReturned.returnedCard,
              returnedLock: inspectReturned.returnedLock,
            }
          : r
      )
      saveLocalState(updated)

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              status: 'awaiting_customer_confirmation',
              ...inspectFees,
              totalDeductions: totalDed,
              netRefundAmount: netRef,
              amountDueFromCustomer: due,
              inspectionNotes: inspectNotes.trim(),
              proposedUnitStatus: inspectProposedUnit,
            }
          : null
      )
      setFeedback('Đã lập biên bản nghiệm thu hiện trạng thành công! Hồ sơ chuyển sang Chờ khách xác nhận.')
      setActiveTab('overview')
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Thao tác: Khách hàng duyệt / Khiếu nại (Confirmation & Dispute)
  const handleCustomerConfirm = async (decision: 'accepted' | 'disputed') => {
    if (!selectedItem) return
    if (useApi) { setFeedback('Xác nhận quyết toán thuộc khách hàng sở hữu hồ sơ.'); return }
    if (isBusiness) {
      setFeedback('Business không thay khách hàng xác nhận quyết toán.')
      return
    }
    setSubmitting(true)
    setFeedback('')

    try {
      if (useApi) {
        await confirmReturn(selectedItem.id, decision, decision === 'disputed' ? disputeNoteInput : 'Đồng ý quyết toán')
        await loadApiData()
      }

      let nextStatus = 'disputed'
      if (decision === 'accepted') {
        if (selectedItem.netRefundAmount > 0) nextStatus = 'refund_pending'
        else if (selectedItem.amountDueFromCustomer > 0) nextStatus = 'payment_due'
        else nextStatus = 'completed'
      }

      if (useApi) {
        setSelectedItem((prev) => prev ? { ...prev, status: nextStatus, customerDecisionNote: decision === 'disputed' ? disputeNoteInput : 'Khách hàng đã xác nhận đồng ý quyết toán.' } : null)
        setFeedback(decision === 'accepted' ? `Khách hàng đã đồng ý quyết toán! Hồ sơ chuyển sang: ${statusLabels[nextStatus] || nextStatus}.` : 'Khách hàng đã gửi khiếu nại! Hồ sơ đã được chuyển đến Ban Điều Hành để thẩm định.')
        setActiveTab('overview')
        return
      }

      const updated = localReturns.map((r) =>
        r.id === selectedItem.id
          ? {
              ...r,
              status: nextStatus,
              customerDecisionNote: decision === 'disputed' ? disputeNoteInput : 'Khách hàng đã xác nhận đồng ý quyết toán.',
            }
          : r
      )
      saveLocalState(updated)

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              customerDecisionNote: decision === 'disputed' ? disputeNoteInput : 'Khách hàng đã xác nhận đồng ý quyết toán.',
            }
          : null
      )

      if (decision === 'accepted') {
        setFeedback(`Khách hàng đã đồng ý quyết toán! Hồ sơ chuyển sang: ${statusLabels[nextStatus] || nextStatus}.`)
      } else {
        setFeedback('Khách hàng đã gửi khiếu nại! Hồ sơ đã được chuyển đến Ban Điều Hành để thẩm định.')
      }
      setActiveTab('overview')
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // 3. Thao tác: Thẩm định khiếu nại (BO Review Dispute)
  const handleReviewDispute = async () => {
    if (!selectedItem) return
    if (useApi) { setFeedback('Xem xét khiếu nại thuộc Manager theo quyền hiện tại.'); return }
    if (isBusiness) {
      setFeedback('Business không thẩm định khiếu nại, thao tác này thuộc Manager.')
      return
    }
    if (!resolutionNote.trim()) {
      setFeedback('Vui lòng nhập ghi chú kết luận thẩm định khiếu nại của Ban Điều Hành.')
      return
    }

    setSubmitting(true)
    setFeedback('')

    const totalDed = reviewFees.damageFee + reviewFees.cleaningFee + reviewFees.lostItemFee + reviewFees.overdueFee + reviewFees.outstandingFee
    const deposit = selectedItem.depositAmount || 0
    const netRef = Math.max(0, deposit - totalDed)
    const due = Math.max(0, totalDed - deposit)
    const nextStatus = due > 0 ? 'payment_due' : netRef > 0 ? 'refund_pending' : 'completed'

    try {
      if (useApi) {
        await reviewDispute(selectedItem.id, {
          damageFee: reviewFees.damageFee,
          cleaningFee: reviewFees.cleaningFee,
          lostItemFee: reviewFees.lostItemFee,
          overdueFee: reviewFees.overdueFee,
          outstandingFee: reviewFees.outstandingFee,
          resolutionNote: resolutionNote.trim(),
          proposedUnitStatus: proposedUnit,
        })
        await loadApiData()
      }

      if (useApi) {
        setSelectedItem((prev) => prev ? { ...prev, status: nextStatus, ...reviewFees, totalDeductions: totalDed, netRefundAmount: netRef, amountDueFromCustomer: due, managerResolutionNote: resolutionNote.trim(), proposedUnitStatus: proposedUnit } : null)
        setFeedback(`Đã thẩm định khiếu nại thành công! Hồ sơ chuyển sang: ${statusLabels[nextStatus] || nextStatus}.`)
        setActiveTab('overview')
        return
      }

      const updated = localReturns.map((r) =>
        r.id === selectedItem.id
          ? {
              ...r,
              status: nextStatus,
              ...reviewFees,
              totalDeductions: totalDed,
              netRefundAmount: netRef,
              amountDueFromCustomer: due,
              managerResolutionNote: resolutionNote.trim(),
              proposedUnitStatus: proposedUnit,
            }
          : r
      )
      saveLocalState(updated)

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              ...reviewFees,
              totalDeductions: totalDed,
              netRefundAmount: netRef,
              amountDueFromCustomer: due,
              managerResolutionNote: resolutionNote.trim(),
              proposedUnitStatus: proposedUnit,
            }
          : null
      )
      setFeedback(`Đã thẩm định khiếu nại thành công! Hồ sơ chuyển sang: ${statusLabels[nextStatus] || nextStatus}.`)
      setActiveTab('overview')
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // 4. Thao tác: Thực hiện giải ngân hoàn tiền cọc (Complete Refund)
  const handleCompleteRefund = async () => {
    if (!selectedItem || refundLock.current) return
    if (isBusiness) {
      setFeedback('Business chỉ phê duyệt/giám sát, Staff mới được ghi nhận thu hoặc hoàn tiền kèm biên lai thực tế.')
      return
    }
    if (useApi && !refundReference.trim()) {
      setFeedback('Vui lòng nhập mã giao dịch hoàn tiền thực tế trước khi hoàn tất hồ sơ.')
      return
    }
    if (useApi && (!refundFile || !refundConfirmed || selectedItem.status !== 'refund_pending'
      || !Number.isFinite(selectedItem.netRefundAmount) || Number(selectedItem.netRefundAmount) <= 0)) {
      setFeedback('Kiểm tra số tiền được hoàn, tải biên lai và xác nhận đã thực hoàn trước khi ghi nhận.')
      return
    }
    refundLock.current = true
    setSubmitting(true)
    setFeedback('')

    try {
      if (useApi) {
        let receiptFileId = refundUpload.current?.file === refundFile ? refundUpload.current.id : undefined
        if (!receiptFileId) {
          const asset = await uploadReturnEvidence(selectedItem.id, refundFile!)
          receiptFileId = asset.id
          refundUpload.current = { file: refundFile!, id: asset.id }
        }
        const proof = {
          amount: selectedItem.netRefundAmount!,
          transactionReference: refundReference.trim(),
          paymentMethod: refundMethod,
          receiptFileId,
          confirmed: refundConfirmed,
        }
        validateReturnSettlementReceipt(proof)
        await completeRefund(selectedItem.id, {
          ...proof,
          notes: refundNotes.trim() || 'Hoàn tiền cọc quyết toán',
        })
        await loadApiData()
        setFeedback('Đã ghi nhận chứng từ hoàn tiền và hoàn tất hồ sơ theo kết quả backend.')
        setActiveTab('overview')
        return
      }

      const updated = localReturns.map((r) =>
        r.id === selectedItem.id
          ? {
              ...r,
              status: 'completed',
              settlementPaymentId: refundReference.trim() || `VNPAY-REFUND-${Date.now().toString().slice(-6)}`,
              completedAt: new Date().toLocaleString('vi-VN'),
            }
          : r
      )
      saveLocalState(updated)

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              settlementPaymentId: refundReference.trim() || `VNPAY-REFUND-${Date.now().toString().slice(-6)}`,
              completedAt: new Date().toLocaleString('vi-VN'),
            }
          : null
      )
      setFeedback('Đã giải ngân tiền hoàn cọc thành công! Hồ sơ thanh lý đã hoàn tất và gian kho đã được giải phóng.')
      setActiveTab('overview')
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      refundLock.current = false
      setSubmitting(false)
    }
  }

  // 5. Thao tác: Khách nộp phụ phí phát sinh (Pay Due)
  const handlePayDue = async () => {
    if (!selectedItem) return
    if (useApi) { setFeedback('Thu khoản còn thiếu thuộc Staff tại cơ sở.'); return }
    if (isBusiness) {
      setFeedback('Business không ghi nhận phụ phí, thao tác này thuộc Customer/Staff theo contract.')
      return
    }
    setSubmitting(true)
    setFeedback('')

    try {
      if (useApi) {
        await paySettlement(selectedItem.id, payMethod, payNotes.trim())
        await loadApiData()
      }

      if (useApi) {
        setSelectedItem((prev) => prev ? { ...prev, status: 'completed', settlementPaymentId: `PAY-DUE-${Date.now().toString().slice(-6)}`, completedAt: new Date().toLocaleString('vi-VN') } : null)
        setFeedback('Đã xác nhận thu phụ phí thành công! Hồ sơ thanh lý đã đóng hoàn tất.')
        setActiveTab('overview')
        return
      }

      const updated = localReturns.map((r) =>
        r.id === selectedItem.id
          ? {
              ...r,
              status: 'completed',
              settlementPaymentId: `PAY-DUE-${Date.now().toString().slice(-6)}`,
              completedAt: new Date().toLocaleString('vi-VN'),
            }
          : r
      )
      saveLocalState(updated)

      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              settlementPaymentId: `PAY-DUE-${Date.now().toString().slice(-6)}`,
              completedAt: new Date().toLocaleString('vi-VN'),
            }
          : null
      )
      setFeedback('Đã xác nhận thu phụ phí thành công! Hồ sơ thanh lý đã đóng hoàn tất.')
      setActiveTab('overview')
    } catch (err) {
      setFeedback(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // 6. Thao tác: Tạo yêu cầu trả kho mới (+ Tạo hồ sơ)
  const handleCreateNewReturn = async () => {
    if (useApi) { setFeedback('Khách hàng tạo yêu cầu từ hồ sơ thuê, BO không tạo hồ sơ giả thay cho API.'); return }
    if (!newScheduledDate) {
      alert('Vui lòng chọn ngày hẹn trả kho.')
      return
    }

    setSubmitting(true)
    try {
      const generatedId = `ret-${Date.now()}`
      const newDossier = {
        id: generatedId,
        rentalId: newRentalId || `rnt-${Date.now()}`,
        unitNumber: 'HCM-Q1-M-004',
        facilityName: 'Kho Việt - Cơ sở Quận 1',
        customerName: 'Trịnh Thanh Phương (Khách hàng)',
        customerPhone: '0909 112 233',
        scheduledDate: newScheduledDate,
        status: 'scheduled',
        depositAmount: 12000000,
        totalDeductions: 0,
        netRefundAmount: 12000000,
        amountDueFromCustomer: 0,
        damageFee: 0,
        cleaningFee: 0,
        lostItemFee: 0,
        overdueFee: 0,
        outstandingFee: 0,
        returnedKey: false,
        returnedCard: false,
        returnedLock: false,
        inspectionNotes: 'Hồ sơ mới tạo từ cổng Ban Điều Hành. Chờ Staff kiểm tra hiện trạng gian kho.',
        customerDecisionNote: newNotes,
        managerResolutionNote: null,
        proposedUnitStatus: 'available' as const,
      }

      if (useApi) {
        if (!newRentalId) throw new Error('Vui lòng nhập mã hồ sơ thuê từ Backend.')
        await requestReturn(newRentalId, newScheduledDate, newNotes)
        await loadApiData()
        setCreateModalOpen(false)
        alert('Đã khởi tạo yêu cầu trả kho mới thành công!')
        return
      }

      saveLocalState([newDossier, ...localReturns])
      setCreateModalOpen(false)
      alert('Đã khởi tạo yêu cầu trả kho mới thành công!')
    } catch (err) {
      alert(returnError(err))
    } finally {
      setSubmitting(false)
    }
  }

  // 7. Thao tác: Chạy Demo toàn trình tự động 5 bước (Automated E2E Flow Runner)
  const runAutomatedDemo = async () => {
    if (useApi) return
    setDemoRunning(true)
    setDemoLogs([])
    setDemoStep(1)

    const addLog = (msg: string) => {
      setDemoLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    addLog('BẮT ĐẦU DEMO QUY TRÌNH TOÀN TRÌNH: TRẢ KHO & QUYẾT TOÁN CỌC (STORAGEHUB)')

    // Bước 1
    await new Promise((r) => setTimeout(r, 1200))
    addLog('1. Customer tạo yêu cầu trả kho cho gian HCM-Q1-M-001 (Cọc: 9,500,000 ₫, Hẹn trả: 2026-10-18)')
    setDemoStep(2)

    // Bước 2
    await new Promise((r) => setTimeout(r, 1500))
    addLog('2. Staff tiến hành nghiệm thu: Thu đủ chìa & thẻ, phát hiện xước sàn (-200k), vệ sinh bụi (-100k) ➔ Tổng trừ: 300,000 ₫')
    setDemoStep(3)

    // Bước 3
    await new Promise((r) => setTimeout(r, 1600))
    addLog('3. Customer xem biên bản: Không đồng ý phí vệ sinh 100k, gửi khiếu nại lên Ban Điều Hành ➔ Trạng thái: DISPUTED')
    setDemoStep(4)

    // Bước 4
    await new Promise((r) => setTimeout(r, 1800))
    addLog('4. Ban Điều Hành (BO) thẩm định: Miễn giảm 100% phí vệ sinh (100k -> 0k). Tái quyết toán: Hoàn cọc 9,300,000 ₫ ➔ Trạng thái: REFUND_PENDING')
    setDemoStep(5)

    // Bước 5
    await new Promise((r) => setTimeout(r, 1800))
    addLog('5. Kế toán giải ngân hoàn tiền cọc 9,300,000 ₫ qua VNPay (Mã GD: VNPAY-REFUND-20261017) ➔ Hợp đồng thanh lý thành công, Gian kho chuyển sang AVAILABLE!')

    // Cập nhật demo record vào danh sách
    const demoRecord = {
      id: `demo-e2e-${Date.now()}`,
      rentalId: 'demo-rental-q1',
      unitNumber: 'HCM-Q1-M-001 (Demo E2E)',
      facilityName: 'Kho Việt - Cơ sở Quận 1',
      customerName: 'Demo Khách Hàng Toàn Trình',
      customerPhone: '0901 888 999',
      scheduledDate: new Date().toISOString().slice(0, 10),
      status: 'completed',
      depositAmount: 9500000,
      totalDeductions: 200000,
      netRefundAmount: 9300000,
      amountDueFromCustomer: 0,
      damageFee: 200000,
      cleaningFee: 0,
      lostItemFee: 0,
      overdueFee: 0,
      outstandingFee: 0,
      returnedKey: true,
      returnedCard: true,
      returnedLock: true,
      inspectionNotes: 'Sàn kho xước nhẹ, đã làm sạch. BO đã duyệt miễn phí vệ sinh.',
      customerDecisionNote: 'Tôi khiếu nại phí vệ sinh vì đã dọn dẹp trước đó.',
      managerResolutionNote: 'BO đồng ý miễn phí vệ sinh 100k. Đã chuyển hoàn 9,300,000 ₫ cho khách.',
      proposedUnitStatus: 'available' as const,
      settlementPaymentId: 'VNPAY-REFUND-20261017-OK',
      completedAt: new Date().toLocaleString('vi-VN'),
    }

    saveLocalState([demoRecord, ...localReturns])
    setDemoRunning(false)
  }

  // 8. Nạp lại bộ dữ liệu mẫu chuẩn (Reset/Seed demo)
  const handleSeedDemoData = () => {
    if (useApi) return
    saveLocalState(SAMPLE_RETURNS)
    alert('Đã nạp thành công 5 hồ sơ trả kho & quyết toán mẫu vào hệ thống!')
  }

  // 9. Xóa toàn bộ dữ liệu đang xử lý dở dang (chỉ giữ các hồ sơ đã hoàn tất thanh lý)
  const handleClearInProgressData = () => {
    if (useApi) {
      void loadApiData()
      return
    }
    try {
      localStorage.removeItem('storagehub:bo:returns-cache')
    } catch {}
    const completedOnly = SAMPLE_RETURNS.filter((r) => r.status === 'completed')
    setLocalReturns(completedOnly)
    try {
      localStorage.setItem('storagehub:bo:returns-cache', JSON.stringify(completedOnly))
    } catch {}
    setFeedback('Đã xóa dữ liệu hồ sơ đang chạy dở và làm mới danh sách từ máy chủ!')
    setTimeout(() => setFeedback(''), 4000)
  }

  return (
    <div className="space-y-6">
      {/* ── THỐNG KÊ TỔNG QUAN KPI TRẢ KHO & QUYẾT TOÁN ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="p-4 bg-white border border-[#cfcdc1] shadow-2xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Tổng hồ sơ trả kho</p>
          <p className="mt-1.5 text-2xl font-black text-stone-900">{totalCount}</p>
          <p className="text-[11px] text-stone-400 mt-1">Toàn bộ mạng lưới cơ sở</p>
        </Card>

        <Card className="p-4 bg-amber-50/80 border border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Khiếu nại cần BO xử lý</p>
            {disputedCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <p className="mt-1.5 text-2xl font-black text-amber-950">{disputedCount}</p>
          <p className="text-[11px] text-amber-700 mt-1">Khách yêu cầu xem xét lại phí</p>
        </Card>

        <Card className="p-4 bg-purple-50/80 border border-purple-200 shadow-2xs">
          <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Chờ giải ngân hoàn cọc</p>
          <p className="mt-1.5 text-2xl font-black text-purple-950">{refundPendingCount}</p>
          <p className="text-[11px] text-purple-700 mt-1">Đã chốt quyết toán, chờ lệnh chi</p>
        </Card>

        <Card className="p-4 bg-blue-50/80 border border-blue-200 shadow-2xs">
          <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Chờ khách duyệt biên bản</p>
          <p className="mt-1.5 text-2xl font-black text-blue-950">{awaitingCustCount}</p>
          <p className="text-[11px] text-blue-700 mt-1">Biên bản nghiệm thu đã lập</p>
        </Card>

        <Card className="p-4 bg-emerald-50/80 border border-emerald-300 shadow-2xs">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Đã hoàn tất thanh lý</p>
          <p className="mt-1.5 text-2xl font-black text-emerald-950">{completedCount}</p>
          <p className="text-[11px] text-emerald-700 mt-1">Đã giải phóng mặt bằng kho</p>
        </Card>
      </div>

      {/* ── THANH CÔNG CỤ TÌM KIẾM, LỌC & CÁC NÚT HÀNH ĐỘNG ── */}
      <Card className="p-4 space-y-3.5 bg-white border border-[#cfcdc1] shadow-2xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-1 flex-wrap gap-2.5 items-center">
            <input
              type="text"
              placeholder="Tìm theo mã gian kho, tên khách, mã hồ sơ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-[#cfcdc1] rounded-lg text-sm bg-white min-w-[280px] flex-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-[#cfcdc1] rounded-lg text-sm bg-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái quy trình</option>
              <option value="disputed">⚠️ Đang khiếu nại (Cần BO giải quyết)</option>
              <option value="refund_pending">💰 Chờ giải ngân hoàn cọc</option>
              <option value="payment_due">💵 Chờ khách đóng thêm tiền</option>
              <option value="awaiting_customer_confirmation">⏳ Chờ khách xác nhận biên bản</option>
              <option value="scheduled">📋 Đã hẹn nghiệm thu hiện trường</option>
              <option value="completed">✅ Đã hoàn tất thanh lý</option>
            </select>

            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              className="px-3 py-2 border border-[#cfcdc1] rounded-lg text-sm bg-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả chi nhánh cơ sở</option>
              {facilityNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Nhóm nút hành động */}
          <div className="flex flex-wrap gap-2 items-center">
            {!useApi && <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 bg-red-50/50 hover:bg-red-100 font-semibold flex items-center gap-1 cursor-pointer"
              onClick={handleClearInProgressData}
              title="Xóa toàn bộ các hồ sơ đang chạy dở và làm mới từ máy chủ"
            >
              🗑️ Xóa dữ liệu chạy dở
            </Button>}
            {!isBusiness && <Button
              variant="outline"
              size="sm"
              className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold flex items-center gap-1 cursor-pointer"
              onClick={() => setCreateModalOpen(true)}
            >
              + Tạo hồ sơ trả kho
            </Button>}
          </div>
        </div>

        {feedback && <p className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200 font-medium">{feedback}</p>}
        {apiLoading && <p className="text-xs text-stone-500 italic">Đang đồng bộ dữ liệu từ Backend Spring Boot...</p>}
        {apiError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{apiError}</p>}
      </Card>

      {/* ── BẢNG DANH SÁCH HỒ SƠ QUY TRÌNH TRẢ KHO & QUYẾT TOÁN ── */}
      <Card className="overflow-hidden border border-[#cfcdc1] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr className="bg-stone-50/80">
                <Th className="font-bold text-stone-900">Gian Kho & Cơ Sở</Th>
                <Th className="font-bold text-stone-900">Khách Hàng</Th>
                <Th className="font-bold text-stone-900">Ngày Hẹn Trả</Th>
                <Th className="font-bold text-stone-900">Tiền Cọc An Ninh</Th>
                <Th className="font-bold text-stone-900">Tổng Khấu Trừ</Th>
                <Th className="font-bold text-stone-900">Kết Quả Quyết Toán</Th>
                <Th className="font-bold text-stone-900">Trạng Thái Hồ Sơ</Th>
                <Th className="text-right font-bold text-stone-900">Thao Tác Nghiệp Vụ</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredItems.length === 0 ? (
                <Tr>
                  <Td colSpan={8} className="text-center py-12 text-stone-500">
                    <div className="space-y-3">
                      <p className="text-base font-semibold text-stone-700">Chưa có hồ sơ trả kho nào trong danh sách</p>
                      <p className="text-xs text-stone-500 max-w-md mx-auto">
                        {useApi ? 'Chưa có hồ sơ trả kho từ Backend.' : 'Bấm nút bên dưới để nạp bộ dữ liệu mẫu chuẩn nghiệp vụ hoặc tự tạo hồ sơ mới.'}
                      </p>
                      <div className="flex justify-center gap-2 pt-2">
                        {!useApi && <Button variant="primary" size="sm" onClick={handleSeedDemoData}>Nạp 5 hồ sơ mẫu chuẩn</Button>}
                        {!isBusiness && <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(true)}>
                          + Tạo yêu cầu trả kho mới
                        </Button>}
                      </div>
                    </div>
                  </Td>
                </Tr>
              ) : (
                filteredItems.map((item) => (
                  <Tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                    <Td>
                      <p className="font-bold text-stone-900 font-mono text-sm">{item.unitNumber}</p>
                      <p className="text-xs text-stone-500 truncate max-w-[200px]">{item.facilityName}</p>
                    </Td>
                    <Td>
                      <p className="font-bold text-stone-800 text-sm">{item.customerName}</p>
                      <p className="text-xs text-stone-400 font-mono">{item.customerPhone || 'Khách hàng cá nhân'}</p>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-stone-600 font-semibold">
                      {item.scheduledDate}
                    </Td>
                    <Td className="whitespace-nowrap font-semibold text-stone-800">
                      {formatVnd(item.depositAmount)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {item.totalDeductions > 0 ? (
                        <span className="text-red-600 font-bold">-{formatVnd(item.totalDeductions)}</span>
                      ) : (
                        <span className="text-stone-400">0 ₫</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {item.netRefundAmount > 0 ? (
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Hoàn: {formatVnd(item.netRefundAmount)}
                        </span>
                      ) : item.amountDueFromCustomer > 0 ? (
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-100 text-amber-900 border border-amber-300">
                          Thu thêm: {formatVnd(item.amountDueFromCustomer)}
                        </span>
                      ) : (
                        <span className="text-stone-500 text-xs">Cân bằng 0 ₫</span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={statusBadgeVariant(item.status)}>
                        {statusLabels[item.status] || item.status}
                      </Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap space-x-1.5">
                      {item.status === 'disputed' && !isBusiness ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer shadow-2xs"
                          onClick={() => handleOpenDetail(item, 'dispute')}
                        >
                          ⚖️ Thẩm Định BO
                        </Button>
                      ) : item.status === 'refund_pending' && !isBusiness ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer shadow-2xs"
                          onClick={() => handleOpenDetail(item, 'refund')}
                        >
                          💳 Giải Ngân Cọc
                        </Button>
                      ) : item.status === 'scheduled' || item.status === 'requested' ? (
                        isBusiness ? <Button variant="outline" size="sm" className="font-medium cursor-pointer" onClick={() => handleOpenDetail(item, 'overview')}>Xem Chi Tiết</Button> : <Button
                          variant="primary"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-2xs"
                          onClick={() => handleOpenDetail(item, 'inspect')}
                        >
                          📋 Nghiệm Thu
                        </Button>
                      ) : item.status === 'awaiting_customer_confirmation' || item.status === 'inspected' ? (
                        isBusiness ? <Button variant="outline" size="sm" className="font-medium cursor-pointer" onClick={() => handleOpenDetail(item, 'overview')}>Xem Chi Tiết</Button> : <Button
                          variant="primary"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer shadow-2xs"
                          onClick={() => handleOpenDetail(item, 'overview')}
                        >
                          ⏳ Duyệt Quyết Toán
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-medium cursor-pointer"
                          onClick={() => handleOpenDetail(item, 'overview')}
                        >
                          Xem Chi Tiết
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </Card>

      {/* ── MODAL CHI TIẾT & ĐIỀU KHIỂN QUY TRÌNH TOÀN TRÌNH (INTERACTIVE LIFECYCLE MODAL) ── */}
      {modalOpen && selectedItem && (
        <Modal
          open={modalOpen}
          onClose={() => { if (!submitting && !refundLock.current) setModalOpen(false) }}
          title={`Hồ sơ trả kho: ${selectedItem.unitNumber} (${selectedItem.facilityName})`}
        >
          <div className="space-y-5 text-sm max-h-[80vh] overflow-y-auto pr-1">
            {/* 1. THANH TIẾN TRÌNH 5 BƯỚC QUY TRÌNH CHUẨN HOÁ */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5">
                Tiến Trình Quy Trình Nghiệp Vụ (Lifecycle Progress)
              </p>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  {
                    step: 1,
                    title: '1. Yêu cầu',
                    done: true,
                    active: selectedItem.status === 'requested',
                  },
                  {
                    step: 2,
                    title: '2. Nghiệm thu',
                    done: ['inspected', 'awaiting_customer_confirmation', 'disputed', 'refund_pending', 'payment_due', 'completed'].includes(selectedItem.status),
                    active: selectedItem.status === 'scheduled',
                  },
                  {
                    step: 3,
                    title: '3. Khách duyệt',
                    done: ['disputed', 'refund_pending', 'payment_due', 'completed'].includes(selectedItem.status),
                    active: selectedItem.status === 'awaiting_customer_confirmation' || selectedItem.status === 'inspected',
                  },
                  {
                    step: 4,
                    title: '4. Thẩm định BO',
                    done: ['refund_pending', 'payment_due', 'completed'].includes(selectedItem.status),
                    active: selectedItem.status === 'disputed',
                  },
                  {
                    step: 5,
                    title: '5. Hoàn tất',
                    done: selectedItem.status === 'completed',
                    active: selectedItem.status === 'refund_pending' || selectedItem.status === 'payment_due',
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-2 rounded-lg text-xs font-bold transition-all ${
                      s.done
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs'
                        : s.active
                        ? 'bg-amber-100 text-amber-950 border-2 border-amber-500 animate-pulse'
                        : 'bg-white text-stone-400 border border-stone-200'
                    }`}
                  >
                    <span>{s.title}</span>
                    <span className="block text-[10px] font-normal mt-0.5">
                      {s.done ? '✓ Xong' : s.active ? '● Đang xử lý' : 'Chưa đến'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. THANH CHUYỂN TAB TƯƠNG TÁC */}
            <div className="flex border-b border-stone-200 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                  activeTab === 'overview'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Tổng quan & Đối soát
              </button>
              {!isBusiness && (selectedItem.status === 'scheduled' || selectedItem.status === 'requested') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('inspect')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'inspect'
                      ? 'border-blue-600 text-blue-800'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  📋 Biên bản nghiệm thu
                </button>
              )}
              {!isBusiness && selectedItem.status === 'disputed' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dispute')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'dispute'
                      ? 'border-red-600 text-red-800'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  ⚖️ Thẩm định khiếu nại (BO)
                </button>
              )}
              {!isBusiness && selectedItem.status === 'refund_pending' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('refund')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'refund'
                      ? 'border-purple-600 text-purple-800'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  💳 Lệnh giải ngân hoàn cọc
                </button>
              )}
              {!isBusiness && selectedItem.status === 'payment_due' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pay')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                    activeTab === 'pay'
                      ? 'border-amber-600 text-amber-800'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  💵 Thu phụ phí
                </button>
              )}
            </div>

            {/* TAB 1: TỔNG QUAN & ĐỐI SOÁT TÀI CHÍNH */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Thông tin hồ sơ */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Khách hàng</p>
                    <p className="font-bold text-stone-900">{selectedItem.customerName}</p>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">{selectedItem.customerPhone || '0901 888 999'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Ngày hẹn trả kho</p>
                    <p className="font-bold text-stone-900 font-mono">{selectedItem.scheduledDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Trạng thái hồ sơ</p>
                    <Badge variant={statusBadgeVariant(selectedItem.status)}>
                      {statusLabels[selectedItem.status] || selectedItem.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Phân loại trả kho</p>
                    <p className="font-bold text-stone-900">{selectedItem.returnType || 'Chưa phân loại'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Cách quyết toán</p>
                    <p className="font-bold text-stone-900">{selectedItem.settlementMode || 'AUTO'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">Tiền cọc an ninh ban đầu</p>
                    <p className="font-bold text-stone-900">{formatVnd(selectedItem.depositAmount)}</p>
                  </div>
                </div>

                {isBusiness && selectedItem.setupExitReviewRequired && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-3">
                    <div>
                      <p className="font-bold text-amber-950 text-sm">Quyết định trả/hủy trong thời gian setup</p>
                      <p className="text-xs text-amber-900 mt-1">
                        Setup chưa phải kỳ thuê đã trả. Business quyết định số tiền hoàn, Staff chỉ thực hiện sau khi có chứng từ thực tế.
                        {selectedItem.moveInCompletedAt && !selectedItem.inspectedAt && ' Hàng đã vào kho nên cần Staff kiểm tra trả kho trước.'}
                      </p>
                      {selectedItem.earlyTerminationPolicy && <p className="mt-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-950">
                        Theo snapshot lúc đặt: phí chấm dứt sớm <b>{formatVnd(selectedItem.earlyTerminationPolicy.earlyTerminationFee)}</b>
                        {selectedItem.earlyTerminationPolicy.type === 'GOODS_MOVED_IN' && <> + phí dùng hàng {selectedItem.earlyTerminationPolicy.billableSetupDays} ngày ({formatVnd(selectedItem.earlyTerminationPolicy.usedGoodsCharge)})</>}, tiền thuê dự kiến hoàn <b>{formatVnd(selectedItem.earlyTerminationPolicy.rentalRefundAmount)}</b>. Cọc đảm bảo kho vẫn quyết toán riêng.
                      </p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="text-xs font-semibold text-stone-700">
                        Số tiền duyệt hoàn (VND)
                        <input
                          type="number"
                          min="0"
                          max={selectedItem.depositAmount}
                          step="1000"
                          value={setupRefundAmount}
                          onChange={(e) => setSetupRefundAmount(Math.max(0, Number(e.target.value) || 0))}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-stone-700">
                        Hoàn tiền thuê theo snapshot (VND)
                        <input
                          type="number"
                          min="0"
                          max={selectedItem.earlyTerminationPolicy?.rentalRefundAmount ?? 0}
                          step="1000"
                          value={setupRentalRefundAmount}
                          onChange={(e) => setSetupRentalRefundAmount(Math.max(0, Number(e.target.value) || 0))}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                        />
                        <span className="mt-1 block text-[11px] font-normal text-stone-500">Cọc đảm bảo kho được duyệt riêng ở ô bên cạnh.</span>
                      </label>
                      <label className="text-xs font-semibold text-stone-700">
                        Lý do quyết định
                        <textarea
                          value={setupDecisionNote}
                          onChange={(e) => setSetupDecisionNote(e.target.value)}
                          maxLength={2000}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                          placeholder="Nêu căn cứ chính sách hủy/trả trong setup"
                        />
                      </label>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={submitting || Boolean(selectedItem.moveInCompletedAt && !selectedItem.inspectedAt)}
                      className="bg-amber-700 hover:bg-amber-800 text-white font-bold cursor-pointer"
                      onClick={handleSetupExitDecision}
                    >
                      Duyệt quyết định setup
                    </Button>
                  </div>
                )}

                {isBusiness && selectedItem.status === 'awaiting_business_review' && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-300 space-y-3">
                    <div>
                      <p className="font-bold text-rose-950 text-sm">Bổ sung snapshot cho hồ sơ cũ</p>
                      <p className="mt-1 text-xs text-rose-900">Hồ sơ này không có bảng giá trả sớm bất biến. Business phải dựa trên chứng cứ gốc, lưu JSON snapshot và chịu trách nhiệm phê duyệt trước khi khách xác nhận.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="text-xs font-semibold text-stone-700">
                        Tổng phí thuê được duyệt (VND)
                        <input type="number" min="0" step="1" value={legacyRentalCharge} onChange={(event) => setLegacyRentalCharge(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs font-semibold text-stone-700">
                        Tiền thuê hoàn được duyệt (VND)
                        <input type="number" min="0" step="1" value={legacyRentalRefund} onChange={(event) => setLegacyRentalRefund(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Mã file báo giá/hợp đồng gốc
                      <input required value={legacyEvidenceFileId} onChange={(event) => setLegacyEvidenceFileId(event.target.value)} placeholder="UUID file đã lưu trong hệ thống" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono" />
                    </label>
                    <label className="block text-xs font-semibold text-stone-700">
                      Pricing snapshot JSON
                      <textarea required rows={5} value={legacySnapshotJson} onChange={(event) => setLegacySnapshotJson(event.target.value)} placeholder='{"policyVersion":"legacy-approved","tiers":[]}' className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono" />
                    </label>
                    <label className="block text-xs font-semibold text-stone-700">
                      Lý do và căn cứ duyệt
                      <textarea required rows={3} maxLength={2000} value={legacyDecisionNote} onChange={(event) => setLegacyDecisionNote(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                    </label>
                    <Button variant="primary" size="sm" disabled={submitting} className="bg-rose-700 hover:bg-rose-800 text-white font-bold" onClick={() => void handleLegacyPricingDecision()}>
                      Lưu snapshot & chuyển duyệt
                    </Button>
                  </div>
                )}

                {selectedItem.activeReturnPolicy?.recalculationRequired && (
                  <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
                    <p className="font-bold">Tính lại ưu đãi do trả kho sau khi ACTIVE</p>
                    <p className="mt-1">
                      Đã đủ {selectedItem.activeReturnPolicy.completedRentalMonths} tháng, áp dụng tier {selectedItem.activeReturnPolicy.pricingTierMonths ?? 'niêm yết'}.
                      Phí chấm dứt sớm: <b>{formatVnd(selectedItem.activeReturnPolicy.earlyTerminationFee)}</b> ·
                      Phí sử dụng/notice: <b>{formatVnd(selectedItem.activeReturnPolicy.totalRentalCharge - selectedItem.activeReturnPolicy.earlyTerminationFee)}</b> ·
                      Hoàn tiền thuê dự kiến: <b>{formatVnd(selectedItem.activeReturnPolicy.rentalRefundAmount)}</b>.
                      Tiền đảm bảo kho vẫn đối soát riêng.
                    </p>
                  </div>
                )}

                {/* Bảng chi tiết khấu trừ tài chính */}
                <div>
                  <p className="font-bold text-stone-900 text-sm mb-2">Bảng đối soát tài chính quyết toán</p>
                  <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="flex justify-between p-2.5 bg-stone-100/70 font-bold text-xs text-stone-700 border-b border-stone-200">
                      <span>Khoản Mục Quyết Toán</span>
                      <span>Số Tiền (VND)</span>
                    </div>
                    <div className="flex justify-between p-2.5 border-b border-stone-100">
                      <span className="font-semibold text-stone-800">Cọc an ninh bảo đảm ban đầu</span>
                      <span className="font-bold text-stone-900">{formatVnd(selectedItem.depositAmount)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                      <span>• Phí hư hại gian kho (sàn, vách, cửa)</span>
                      <span className="text-red-600 font-mono">-{formatVnd(selectedItem.damageFee)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                      <span>• Phí dọn dẹp vệ sinh kho</span>
                      <span className="text-red-600 font-mono">-{formatVnd(selectedItem.cleaningFee)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                      <span>• Phí mất chìa khóa / thẻ từ / tài sản</span>
                      <span className="text-red-600 font-mono">-{formatVnd(selectedItem.lostItemFee)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                      <span>• Phí phạt trễ hạn trả kho</span>
                      <span className="text-red-600 font-mono">-{formatVnd(selectedItem.overdueFee)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                      <span>• Tiền nợ cước kỳ trước</span>
                      <span className="text-red-600 font-mono">-{formatVnd(selectedItem.outstandingFee)}</span>
                    </div>
                    {selectedItem.activeReturnPolicy?.recalculationRequired && <>
                      <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                        <span>• Phí tính lại khi trả sớm sau ACTIVE</span>
                        <span className="text-red-600 font-mono">-{formatVnd(selectedItem.activeReturnPolicy.totalRentalCharge)}</span>
                      </div>
                      <div className="flex justify-between p-2 border-b border-stone-100 text-stone-600 text-xs">
                        <span>• Hoàn tiền thuê theo snapshot</span>
                        <span className="text-emerald-700 font-mono">+{formatVnd(selectedItem.activeReturnPolicy.rentalRefundAmount)}</span>
                      </div>
                    </>}
                    <div className="flex justify-between p-3 bg-amber-50/80 font-bold text-sm border-t border-amber-200">
                      <span>KẾT QUẢ QUYẾT TOÁN THỰC THU:</span>
                      {selectedItem.netRefundAmount > 0 ? (
                        <span className="text-emerald-800 font-extrabold text-base">
                          Hoàn trả khách: {formatVnd(selectedItem.netRefundAmount)}
                        </span>
                      ) : selectedItem.amountDueFromCustomer > 0 ? (
                        <span className="text-amber-900 font-extrabold text-base">
                          Khách nộp thêm: {formatVnd(selectedItem.amountDueFromCustomer)}
                        </span>
                      ) : (
                        <span className="text-stone-700">Cân bằng 0 ₫</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Biên bản bàn giao tài sản & hiện trạng */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Hiện trạng bàn giao chìa khóa & thiết bị
                  </p>
                  <div className="flex gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" /> Chìa khóa: Đầy đủ
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" /> Thẻ từ ra vào: Đầy đủ
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" /> Ổ khóa thông minh: Đầy đủ
                    </span>
                  </div>
                </div>

                {/* Ghi chú hiện trường */}
                {selectedItem.inspectionNotes && (
                  <div>
                    <p className="font-semibold text-stone-900 mb-1 text-xs">Ghi chú nghiệm thu của nhân viên:</p>
                    <p className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-stone-700 text-xs leading-relaxed">
                      {selectedItem.inspectionNotes}
                    </p>
                  </div>
                )}

                {/* Ý kiến khiếu nại của khách */}
                {selectedItem.customerDecisionNote && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300">
                    <p className="font-bold text-amber-950 text-xs mb-1">Ý kiến khiếu nại của khách hàng:</p>
                    <p className="text-amber-900 text-xs leading-relaxed">{selectedItem.customerDecisionNote}</p>
                  </div>
                )}

                {/* Kết luận thẩm định BO */}
                {selectedItem.managerResolutionNote && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="font-bold text-blue-950 text-xs mb-1">Kết luận chỉ đạo của Ban Điều Hành (BO):</p>
                    <p className="text-blue-900 text-xs leading-relaxed">{selectedItem.managerResolutionNote}</p>
                  </div>
                )}

                {/* Thông tin giải ngân nếu đã hoàn tất */}
                {selectedItem.settlementPaymentId && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                    <p className="font-bold text-emerald-950 text-xs mb-1">Thông tin chứng từ thanh lý:</p>
                    <p className="text-emerald-900 text-xs font-mono">
                      Mã giao dịch giải ngân: <strong>{selectedItem.settlementPaymentId}</strong>
                    </p>
                    {selectedItem.completedAt && (
                      <p className="text-emerald-800 text-xs mt-0.5">Thời điểm hoàn tất: {selectedItem.completedAt}</p>
                    )}
                  </div>
                )}

                {/* HÀNH ĐỘNG NHANH THEO TRẠNG THÁI HIỆN TẠI (CONTEXTUAL ACTIONS) */}
                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2.5">
                  <p className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Thao Tác Chuyển Giai Đoạn Tiếp Theo
                  </p>

                  {!isBusiness && (selectedItem.status === 'scheduled' || selectedItem.status === 'requested') && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                        onClick={() => setActiveTab('inspect')}
                      >
                        📋 Tiến hành nghiệm thu hiện trường
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
                        onClick={() => handleCompleteRefund()}
                      >
                        ⚡ Cho trả kho ngay (Không trừ cọc)
                      </Button>
                    </div>
                  )}

                  {!isBusiness && (selectedItem.status === 'awaiting_customer_confirmation' || selectedItem.status === 'inspected') && (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-600">
                        Biên bản đã được lập. Để tiếp tục, bạn có thể mô phỏng phản hồi từ khách hàng hoặc hoàn tất trả kho ngay:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={submitting}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                          onClick={() => handleCustomerConfirm('accepted')}
                        >
                          ✓ Khách hàng đồng ý quyết toán
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={submitting}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                          onClick={() => handleCompleteRefund()}
                        >
                          ⚡ Hoàn tất trả kho ngay (Giải phóng gian)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={submitting}
                          className="border-red-400 text-red-700 hover:bg-red-50 font-bold cursor-pointer"
                          onClick={() => {
                            const reason = prompt('Nhập nội dung khiếu nại của khách hàng:', 'Tôi đề nghị xem xét lại phí vệ sinh vì đã dọn dẹp trước khi trả kho.')
                            if (reason) {
                              setDisputeNoteInput(reason)
                              setTimeout(() => handleCustomerConfirm('disputed'), 100)
                            }
                          }}
                        >
                          ⚠️ Khách hàng gửi khiếu nại
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isBusiness && selectedItem.status === 'disputed' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                        onClick={() => setActiveTab('dispute')}
                      >
                        ⚖️ Thẩm định & Tái quyết toán khiếu nại ngay
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
                        onClick={() => handleCompleteRefund()}
                      >
                        ⚡ Bỏ qua khiếu nại & Cho trả kho ngay
                      </Button>
                    </div>
                  )}

                  {!isBusiness && selectedItem.status === 'refund_pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                        onClick={() => setActiveTab('refund')}
                      >
                        💳 Chuyển khoản hoàn cọc cho khách
                      </Button>
                    </div>
                  )}

                  {!isBusiness && selectedItem.status === 'payment_due' && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                        onClick={() => setActiveTab('pay')}
                      >
                        💵 Ghi nhận thu phụ phí
                      </Button>
                    </div>
                  )}

                  {selectedItem.status === 'completed' && (
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                      <span>✓ Hồ sơ đã hoàn tất mọi thủ tục pháp lý và tài chính.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: BIÊN BẢN NGHIỆM THU HIỆN TRƯỜNG */}
            {activeTab === 'inspect' && (
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-4">
                <p className="font-bold text-blue-950 text-sm">
                  Lập Biên Bản Nghiệm Thu Hiện Trường & Bàn Giao
                </p>

                {/* Bàn giao chìa/khóa */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700">Tình trạng bàn giao tài sản:</label>
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inspectReturned.returnedKey}
                        onChange={(e) => setInspectReturned((prev) => ({ ...prev, returnedKey: e.target.checked }))}
                      />
                      <span>Bàn giao chìa khóa cơ</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inspectReturned.returnedCard}
                        onChange={(e) => setInspectReturned((prev) => ({ ...prev, returnedCard: e.target.checked }))}
                      />
                      <span>Bàn giao thẻ từ ra vào</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inspectReturned.returnedLock}
                        onChange={(e) => setInspectReturned((prev) => ({ ...prev, returnedLock: e.target.checked }))}
                      />
                      <span>Bàn giao ổ khóa an toàn</span>
                    </label>
                  </div>
                </div>

                {/* Phân loại hư hại */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Đánh giá hư hại:</label>
                    <select
                      value={inspectDamage}
                      onChange={(e) => setInspectDamage(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-xs"
                    >
                      <option value="no_damage">Không có hư hại</option>
                      <option value="minor_damage">Hư hại nhẹ (Xước sàn, ố tường)</option>
                      <option value="major_damage">Hư hại nặng (Hỏng cửa, bản lề)</option>
                      <option value="abandoned_goods">Còn đồ đạc bỏ quên</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Hiện trạng kho sau thu hồi:</label>
                    <select
                      value={inspectProposedUnit}
                      onChange={(e) => setInspectProposedUnit(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-xs"
                    >
                      <option value="available">Sẵn sàng đón khách mới (Available)</option>
                      <option value="maintenance">Cần bảo trì sửa chữa (Maintenance)</option>
                    </select>
                  </div>
                </div>

                {/* Các khoản phí khấu trừ */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Khấu trừ chi phí sửa chữa / vệ sinh (₫):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {feeKeys.map((k, idx) => (
                      <div key={k}>
                        <span className="block text-[11px] text-stone-600 mb-0.5">
                          {['Phí hư hại', 'Phí vệ sinh', 'Phí mất chìa/thẻ', 'Phí phạt trễ', 'Nợ cũ'][idx]}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="10000"
                          value={inspectFees[k]}
                          onChange={(e) =>
                            setInspectFees((prev) => ({
                              ...prev,
                              [k]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-2 py-1 border border-stone-300 rounded bg-white text-xs font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ghi chú nhân viên */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Ghi chú hiện trường:</label>
                  <textarea
                    rows={2}
                    value={inspectNotes}
                    onChange={(e) => setInspectNotes(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-xs"
                    placeholder="Mô tả cụ thể vết xước, khu vực cần sơn lại..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('overview')}>
                    Quay lại
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                    onClick={handlePerformInspection}
                  >
                    {submitting ? 'Đang lưu...' : 'Xác nhận biên bản nghiệm thu'}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: THẨM ĐỊNH KHIẾU NẠI DÀNH CHO BAN ĐIỀU HÀNH (BO REVIEW) */}
            {activeTab === 'dispute' && (
              <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-300 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-amber-950 text-sm">
                    ⚖️ Thẩm Định & Quyết Định Giải Quyết Khiếu Nại (Ban Điều Hành)
                  </p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-400">
                    Quyền hạn BO
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-amber-200 text-xs">
                  <p className="font-bold text-amber-900 mb-0.5">Khách hàng phản ánh:</p>
                  <p className="text-stone-700 italic">"{selectedItem.customerDecisionNote || 'Không đồng ý phí khấu trừ'}"</p>
                </div>

                <p className="text-xs text-amber-900">
                  Ban Điều Hành xem xét lại biên bản hiện trường và chứng từ của khách để điều chỉnh giảm hoặc miễn trừ các khoản phí hợp lý.
                </p>

                {/* Điều chỉnh phí */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {feeKeys.map((k, idx) => (
                    <div key={k}>
                      <span className="block text-[11px] font-medium text-stone-700 mb-0.5">
                        {['Phí hư hại', 'Phí vệ sinh', 'Phí mất chìa/thẻ', 'Phí trễ hạn', 'Nợ cũ'][idx]} (₫)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={reviewFees[k]}
                        onChange={(e) =>
                          setReviewFees((prev) => ({
                            ...prev,
                            [k]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white text-xs font-mono font-semibold"
                      />
                    </div>
                  ))}
                  <div>
                    <span className="block text-[11px] font-medium text-stone-700 mb-0.5">Trạng thái kho sau thu hồi</span>
                    <select
                      value={proposedUnit}
                      onChange={(e) => setProposedUnit(e.target.value as any)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white text-xs"
                    >
                      <option value="available">Sẵn sàng (Available)</option>
                      <option value="maintenance">Bảo trì (Maintenance)</option>
                    </select>
                  </div>
                </div>

                {/* Kết luận chỉ đạo */}
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    Kết luận thẩm định của Ban Điều Hành (*)
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Ghi rõ lý do miễn giảm hoặc giữ nguyên các khoản phí để thông báo đến khách hàng và cơ sở..."
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('overview')}>
                    Quay lại
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submitting || !resolutionNote.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                    onClick={handleReviewDispute}
                  >
                    {submitting ? 'Đang lưu...' : 'Xác nhận kết luận & Tái quyết toán'}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 4: GIẢI NGÂN HOÀN TIỀN CỌC */}
            {activeTab === 'refund' && (
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-4">
                <p className="font-bold text-purple-950 text-sm">
                  💳 Lệnh Giải Ngân Hoàn Tiền Cọc Cho Khách Hàng
                </p>

                <div className="p-3 bg-white rounded-lg border border-purple-200 flex items-center justify-between">
                  <span className="text-xs text-stone-600 font-medium">Số tiền cọc thực hoàn (Net Refund):</span>
                  <span className="text-base font-extrabold text-purple-900 font-mono">
                    {formatVnd(selectedItem.netRefundAmount)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Mã giao dịch chuyển khoản / biên nhận tiền mặt (*)
                  </label>
                  <input
                    type="text"
                    value={refundReference}
                    disabled={submitting}
                    maxLength={120}
                    onChange={(e) => { setRefundReference(e.target.value); setRefundConfirmed(false) }}
                    placeholder="VD: VNPAY-REFUND-992288 hoặc FT261017001"
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Ghi chú kế toán giải ngân:
                  </label>
                  <textarea
                    rows={2}
                    value={refundNotes}
                    disabled={submitting}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-xs"
                  />
                </div>

                {useApi && <>
                  <label className="block text-xs font-bold text-stone-700">Phương thức hoàn tiền<select className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-normal" value={refundMethod} disabled={submitting} onChange={event => { setRefundMethod(event.target.value as 'CASH' | 'BANK_TRANSFER'); setRefundConfirmed(false) }}><option value="BANK_TRANSFER">Chuyển khoản</option><option value="CASH">Tiền mặt</option></select></label>
                  <label className="block text-xs font-bold text-stone-700">Biên lai thực hoàn (*)<input key={selectedItem.id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={submitting} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-normal" onChange={event => { setRefundFile(event.target.files?.[0] ?? null); setRefundConfirmed(false); refundUpload.current = null }} /></label>
                  <label className="flex items-start gap-2 text-xs text-stone-700"><input type="checkbox" className="mt-0.5" checked={refundConfirmed} disabled={submitting || !refundFile} onChange={event => setRefundConfirmed(event.target.checked)} /><span>Tôi xác nhận đã thực hoàn đúng số tiền hiển thị và đã đối chiếu biên lai. Hệ thống chỉ ghi nhận chứng từ, không tự chuyển tiền.</span></label>
                </>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('overview')}>
                    Quay lại
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submitting || (useApi && (!refundFile || !refundConfirmed || !refundReference.trim() || selectedItem.status !== 'refund_pending'))}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                    onClick={handleCompleteRefund}
                  >
                    {submitting ? 'Đang xử lý...' : 'Xác nhận đã giải ngân & Đóng hợp đồng'}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 5: THU PHỤ PHÍ */}
            {activeTab === 'pay' && (
              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 space-y-4">
                <p className="font-bold text-amber-950 text-sm">
                  💵 Thu Phụ Phí Quyết Toán Phát Sinh
                </p>

                <div className="p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between">
                  <span className="text-xs text-stone-600 font-medium">Số tiền khách cần nộp thêm:</span>
                  <span className="text-base font-extrabold text-amber-900 font-mono">
                    {formatVnd(selectedItem.amountDueFromCustomer)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Phương thức thanh toán:</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white text-xs"
                  >
                    <option value="VNPAY">Cổng trực tuyến VNPay</option>
                    <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                    <option value="CASH">Tiền mặt tại quầy cơ sở</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('overview')}>
                    Quay lại
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submitting}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                    onClick={handlePayDue}
                  >
                    {submitting ? 'Đang lưu...' : 'Xác nhận thu đủ & Đóng hồ sơ'}
                  </Button>
                </div>
              </div>
            )}

            {feedback && (
              <p
                className={`text-xs p-2.5 rounded-lg border font-medium ${
                  feedback.includes('thành công')
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-red-50 text-red-900 border-red-300'
                }`}
              >
                {feedback}
              </p>
            )}

            <div className="flex justify-end pt-2 border-t border-stone-200">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Đóng cửa sổ
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL KHỞI TẠO YÊU CẦU TRẢ KHO MỚI (+ TẠO HỒ SƠ) ── */}
      {createModalOpen && (
        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Khởi tạo yêu cầu trả kho & quyết toán mới"
        >
          <div className="space-y-4 text-sm">
            <p className="text-xs text-stone-600">
              Chọn hợp đồng thuê đang kích hoạt để bắt đầu quy trình nghiệm thu, thẩm định và quyết toán cọc.
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Gian kho / Hợp đồng đang thuê (*):</label>
              <select
                value={newRentalId}
                onChange={(e) => setNewRentalId(e.target.value)}
                className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white text-xs"
              >
                <option value="rnt-q1-m004">HCM-Q1-M-004 (Kho Việt Quận 1) - Tiền cọc: 12.000.000 ₫</option>
                <option value="rnt-q7-xl002">HCM-Q7-XL-002 (Kho Việt Quận 7) - Tiền cọc: 24.000.000 ₫</option>
                <option value="rnt-bd-l003">BD-F01-L-003 (Kho Việt Bình Dương) - Tiền cọc: 15.000.000 ₫</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Ngày hẹn trả kho dự kiến (*):</label>
              <LocalizedDateInput
                type="date"
                value={newScheduledDate}
                onChange={(e) => setNewScheduledDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-stone-300 rounded-lg bg-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Lý do trả kho & Ghi chú:</label>
              <textarea
                rows={3}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                onClick={handleCreateNewReturn}
              >
                {submitting ? 'Đang tạo...' : 'Tạo hồ sơ trả kho'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
