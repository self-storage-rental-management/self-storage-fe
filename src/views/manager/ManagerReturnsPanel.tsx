import React, { useEffect, useState } from 'react'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Select, Avatar, Input, Tabs } from '../../components/ui'
import { Icon } from '../../components/Layout'
import { formatVndAmount as formatVnd, USD_TO_VND_RATE } from '../../i18n/currency'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import type { ReturnCase, DamageClassification } from '../../types/storageHub'
import ReturnSettlementModal from '../../components/ReturnSettlementModal'
import {
  calculateManagerReturnSettlement,
  canManagerAssignStaff,
  isManagerFacilityVisible,
  type ManagerReturnSettlementFees
} from '../../domain/managerRules'
import ManagerActionNotice from './ManagerActionNotice'
import ManagerPagination from './ManagerPagination'
import { formatManagerDate, formatManagerDateTime, formatManagerMoney, managerDateValue, matchesManagerSearch, normalizeManagerMoney, paginateManagerItems } from './managerList'
import useManagerSoftDelete from './useManagerSoftDelete'

interface ManagerReturnsPanelProps {
  user: User
  showToast: (msg: string) => void
  sb: (v: string) => React.ReactNode
  onCreateMaintenanceWork?: (draft: { referenceId: string; title: string; notes: string }) => void
}

export default function ManagerReturnsPanel({ user, showToast, sb, onCreateMaintenanceWork }: ManagerReturnsPanelProps) {
  const {
    returns: storeReturns,
    users,
    units,
    assignReturnInspection,
    completeReturnCase,
    createFacilityTask,
    updateUnitStatus,
    reviewReturnDispute,
    completeReturnRefund,
    payments
  } = useStorageHub()

  const [returnTab, setReturnTab] = useState(() => storeReturns.some(r => r.status === 'disputed' && isManagerFacilityVisible(user, r.facilityId, r.facilityName)) ? 'disputed' : 'All')
  const [returnSearch, setReturnSearch] = useState('')
  const [damageFilter, setDamageFilter] = useState('all')
  const [settlementFilter, setSettlementFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedReturn, setSelectedReturn] = useState<ReturnCase | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('')
  const [disputePreset, setDisputePreset] = useState<'facility_fault_full_refund' | 'customer_fault_deduct' | 'mutual_settlement' | undefined>(undefined)
  const [facilityCompensation, setFacilityCompensation] = useState<number>(0)
  const [disputeSettlement, setDisputeSettlement] = useState<ManagerReturnSettlementFees>({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0 })
  const [refundTxnRef, setRefundTxnRef] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ReturnCase | null>(null)
  const returnHistory = useManagerSoftDelete(`storagehub:manager:${user.id}:hidden-returns`)

  // Settlement document modal state (invoice, receipt, payment history)
  const [settlementModalOpen, setSettlementModalOpen] = useState(false)
  const [settlementTarget, setSettlementTarget] = useState<ReturnCase | null>(null)

  // Assign staff for inspection state
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<ReturnCase | null>(null)
  const [assignStaffId, setAssignStaffId] = useState('')
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assignNotes, setAssignNotes] = useState('')

  // Maintenance work order modal state
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [maintenanceTarget, setMaintenanceTarget] = useState<ReturnCase | null>(null)
  const [maintenanceReason, setMaintenanceReason] = useState('')
  const [maintenancePriority, setMaintenancePriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [maintenanceStaffId, setMaintenanceStaffId] = useState('')
  const [maintenanceDueAt, setMaintenanceDueAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().slice(0, 10)
  })

  // Complete return modal state
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<ReturnCase | null>(null)
  const [completeNotes, setCompleteNotes] = useState('')

  const availableStaff = users.filter(member => canManagerAssignStaff(user, member))

  // Filter returns by facility
  const scopedReturns = storeReturns.filter(r => isManagerFacilityVisible(user, r.facilityId, r.facilityName))
  const facilityReturns = scopedReturns.filter(r => !returnHistory.isHidden(r.id))
  const hiddenFacilityCount = scopedReturns.length - facilityReturns.length
  const moneyValue = (value?: number) => normalizeManagerMoney(value) ?? 0

  const disputedCount = facilityReturns.filter(r => r.status === 'disputed').length
  const refundPendingCount = facilityReturns.filter(r => r.status === 'refund_pending').length
  const completedCount = scopedReturns.filter(r => r.status === 'completed').length
  const awaitingInspectionCount = facilityReturns.filter(r => r.status === 'requested' || r.status === 'scheduled').length
  const inspectedCount = facilityReturns.filter(r => r.status === 'inspected' || r.status === 'awaiting_customer_confirmation').length
  const needsMaintenanceCount = facilityReturns.filter(r => (r.damageClassification && r.damageClassification !== 'no_damage') || r.proposedUnitStatus === 'maintenance').length

  const filteredReturns = facilityReturns.filter(r => {
    const matchTab =
      returnTab === 'All' ||
      returnTab === 'Tất cả' ||
      (returnTab === 'awaiting_inspection' && (r.status === 'requested' || r.status === 'scheduled')) ||
      (returnTab === 'inspected' && (r.status === 'inspected' || r.status === 'awaiting_customer_confirmation')) ||
      (returnTab === 'needs_maintenance' && ((r.damageClassification && r.damageClassification !== 'no_damage') || r.proposedUnitStatus === 'maintenance')) ||
      (returnTab === 'disputed' && r.status === 'disputed') ||
      (returnTab === 'refund_pending' && r.status === 'refund_pending') ||
      (returnTab === 'payment_due' && r.status === 'payment_due') ||
      (returnTab === 'completed' && r.status === 'completed')

    const matchSearch = matchesManagerSearch(returnSearch, [r.id, r.rentalId, r.customerId, r.customerName, r.unitId, r.customerEmail, r.customerPhone, r.staffNotes, r.customerDecisionNote])
    const matchDamage = damageFilter === 'all' || r.damageClassification === damageFilter
    const matchSettlement = settlementFilter === 'all' || (settlementFilter === 'refund' ? r.netRefundAmount > 0 : settlementFilter === 'customer_due' ? (r.amountDueFromCustomer || 0) > 0 : r.netRefundAmount === 0 && (r.amountDueFromCustomer || 0) === 0)
    const matchDate = (!dateFrom || r.scheduledDate >= dateFrom) && (!dateTo || r.scheduledDate <= dateTo)
    return matchTab && matchSearch && matchDamage && matchSettlement && matchDate
  }).sort((left, right) => {
    if (sortBy === 'date-asc') return managerDateValue(left.scheduledDate) - managerDateValue(right.scheduledDate)
    if (sortBy === 'date-desc') return managerDateValue(right.scheduledDate) - managerDateValue(left.scheduledDate)
    if (sortBy === 'amount-desc') return ((right.amountDueFromCustomer || 0) + right.netRefundAmount) - ((left.amountDueFromCustomer || 0) + left.netRefundAmount)
    const statusPriority: Record<string, number> = { requested: 0, scheduled: 1, inspected: 2, disputed: 3, refund_pending: 4, payment_due: 5, awaiting_customer_confirmation: 6, completed: 7 }
    return (statusPriority[left.status] ?? 99) - (statusPriority[right.status] ?? 99) || managerDateValue(left.requestedAt) - managerDateValue(right.requestedAt)
  })
  const pagination = paginateManagerItems(filteredReturns, page, pageSize)

  useEffect(() => setPage(1), [returnTab, returnSearch, damageFilter, settlementFilter, dateFrom, dateTo, sortBy, pageSize])

  const openAssignModal = (returnCase: ReturnCase) => {
    setAssignTarget(returnCase)
    setAssignStaffId(availableStaff[0]?.id || '')
    setAssignDate(returnCase.scheduledDate || new Date().toISOString().slice(0, 10))
    setAssignNotes('Kiểm tra hiện trường trả kho, thu hồi chìa khóa/thẻ từ, kiểm tra tường trần sàn và đối chiếu kiện hàng.')
    setAssignModalOpen(true)
  }

  const handleConfirmAssign = () => {
    if (!assignTarget) return
    if (!assignStaffId) {
      showToast('Vui lòng chọn nhân viên phụ trách nghiệm thu.')
      return
    }
    try {
      assignReturnInspection(assignTarget.id, assignStaffId, assignDate, assignNotes, user)
      const staffMember = users.find(u => u.id === assignStaffId)
      showToast(`Đã phân công ${staffMember?.name || 'nhân viên'} nghiệm thu trả kho gian ${assignTarget.unitId} vào ngày ${assignDate}!`)
      setAssignModalOpen(false)
      setAssignTarget(null)
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi khi phân công nhân viên.')
    }
  }

  const openMaintenanceModal = (returnCase: ReturnCase) => {
    if (onCreateMaintenanceWork) {
      onCreateMaintenanceWork({
        referenceId: returnCase.unitId,
        title: `Bảo trì gian ${returnCase.unitId} sau trả kho`,
        notes: `Hồ sơ trả kho ${returnCase.id}. Tình trạng: ${returnCase.damageClassification ? getDamageLabel(returnCase.damageClassification) : ''}. Ghi chú: ${returnCase.staffNotes || ''}`
      })
      return
    }
    setMaintenanceTarget(returnCase)
    setMaintenanceStaffId(availableStaff[0]?.id || '')
    const reasonParts = [
      `Bảo trì sau trả kho gian ${returnCase.unitId}`,
      returnCase.damageClassification && returnCase.damageClassification !== 'no_damage' ? `Hiện trạng: ${getDamageLabel(returnCase.damageClassification)}` : '',
      returnCase.staffNotes ? `Ghi chú nghiệm thu: ${returnCase.staffNotes}` : ''
    ].filter(Boolean).join('. ')
    setMaintenanceReason(reasonParts)
    setMaintenancePriority(returnCase.damageClassification === 'major_damage' ? 'high' : 'medium')
    const d = new Date()
    d.setDate(d.getDate() + 3)
    setMaintenanceDueAt(d.toISOString().slice(0, 10))
    setMaintenanceModalOpen(true)
  }

  const handleConfirmMaintenance = () => {
    if (!maintenanceTarget) return
    if (!maintenanceReason.trim()) {
      showToast('Vui lòng nhập lý do/nội dung bảo trì.')
      return
    }
    try {
      updateUnitStatus(maintenanceTarget.unitId, 'maintenance', user, maintenanceReason)
      createFacilityTask({
        facilityId: maintenanceTarget.facilityId,
        facilityName: maintenanceTarget.facilityName,
        type: 'maintenance',
        title: `Bảo trì gian ${maintenanceTarget.unitId} sau trả kho`,
        referenceId: maintenanceTarget.unitId,
        dueAt: maintenanceDueAt,
        priority: maintenancePriority,
        assignedStaffId: maintenanceStaffId || undefined,
        notes: maintenanceReason
      }, user)
      showToast(`Đã chuyển gian ${maintenanceTarget.unitId} sang bảo trì và tạo phiếu công việc cho nhân viên!`)
      setMaintenanceModalOpen(false)
      setMaintenanceTarget(null)
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi khi tạo phiếu bảo trì.')
    }
  }

  const openCompleteModal = (returnCase: ReturnCase) => {
    setCompleteTarget(returnCase)
    setCompleteNotes('Quản lý nghiệm thu đạt yêu cầu. Đóng hồ sơ trả kho.')
    setCompleteModalOpen(true)
  }

  const formatReturnManagerError = (err: any, fallback: string): string => {
    const msg = String(err?.message || '')
    if (msg.includes('not pending refund') || msg.includes('409') || msg.includes('Hồ sơ không ở trạng thái chờ hoàn cọc')) {
      return 'Xung đột trạng thái (409): Hồ sơ đang chờ khách duyệt hoặc đang có khiếu nại. Chưa thể thực hiện hoàn cọc / đóng hồ sơ.'
    }
    if (msg.includes('not in a state awaiting inspection')) {
      return 'Hồ sơ không ở trạng thái chờ nghiệm thu hiện trường.'
    }
    if (msg.includes('not awaiting customer confirmation')) {
      return 'Hồ sơ chưa ở trạng thái chờ khách hàng xác nhận.'
    }
    if (msg.includes('not in disputed status')) {
      return 'Hồ sơ không ở trạng thái khiếu nại.'
    }
    if (msg.includes('Only active rentals')) {
      return 'Chỉ hợp đồng đang hoạt động mới được yêu cầu trả kho.'
    }
    if (msg.includes('Error reviewing dispute')) {
      return 'Có lỗi khi xem xét khiếu nại.'
    }
    if (msg.includes('Error completing refund')) {
      return 'Có lỗi khi xác nhận hoàn cọc.'
    }
    return msg || fallback
  }

  const handleConfirmComplete = () => {
    if (!completeTarget) return
    try {
      completeReturnCase(completeTarget.id, user, completeNotes)
      showToast(`Đã xác nhận hoàn tất hồ sơ trả kho ${completeTarget.id}!`)
      setCompleteModalOpen(false)
      setCompleteTarget(null)
    } catch (err: any) {
      showToast(formatReturnManagerError(err, 'Có lỗi khi đóng hồ sơ trả kho.'))
    }
  }

  const getDamageLabel = (d?: DamageClassification) => {
    switch (d) {
      case 'no_damage':
        return 'Không hư hại'
      case 'minor_damage':
        return 'Hư hại nhẹ'
      case 'major_damage':
        return 'Hư hại nặng'
      case 'abandoned_goods':
        return 'Bỏ lại hàng hóa'
      default:
        return 'Chưa phân loại'
    }
  }

  const getReturnActionReason = (returnCase: ReturnCase) => {
    if (returnCase.status === 'requested' || returnCase.status === 'scheduled' || returnCase.status === 'inspected') return "Chờ nhân viên hoàn tất nghiệm thu và lập quyết toán."
    if (returnCase.status === 'awaiting_customer_confirmation') return "Chờ khách hàng xác nhận kết quả quyết toán."
    if (returnCase.status === 'payment_due') return "Chờ khách hàng thanh toán phần còn thiếu trước khi đóng hồ sơ."
    if (returnCase.status === 'completed') return "Hồ sơ đã hoàn tất, không còn thao tác quản lý cơ sở."
    return null
  }

  const applyDisputePreset = (preset: 'facility_fault_full_refund' | 'customer_fault_deduct' | 'mutual_settlement') => {
    setDisputePreset(preset)
    if (!selectedReturn) return

    if (preset === 'facility_fault_full_refund') {
      setDisputeSettlement({
        damageFee: 0,
        cleaningFee: 0,
        lostItemFee: Math.round(moneyValue(selectedReturn.lostItemFee) * USD_TO_VND_RATE),
        overdueFee: 0,
        outstandingFee: Math.round(moneyValue(selectedReturn.outstandingFee) * USD_TO_VND_RATE)
      })
      setFacilityCompensation(500000)
      setDisputeResolutionNote(
        'Thẩm định hiện trường: Phát hiện lỗi kết cấu cơ sở (nóc dột / vách ngấm nước ngoài vào). Cơ sở kho xin lỗi và chịu 100% trách nhiệm: Miễn toàn bộ phí vệ sinh & hư hại, hoàn 100% tiền cọc cho khách hàng và hỗ trợ bồi thường thiệt hại 500.000₫. Hệ thống sẽ kích hoạt lệnh bảo trì sửa chữa trần/vách kho khẩn cấp.'
      )
    } else if (preset === 'customer_fault_deduct') {
      const standardSanitization = 1500000 // 1.500.000 VND
      setDisputeSettlement({
        damageFee: Math.round(moneyValue(selectedReturn.damageFee) * USD_TO_VND_RATE),
        cleaningFee: standardSanitization,
        lostItemFee: Math.round(moneyValue(selectedReturn.lostItemFee) * USD_TO_VND_RATE),
        overdueFee: Math.round(moneyValue(selectedReturn.overdueFee) * USD_TO_VND_RATE),
        outstandingFee: Math.round(moneyValue(selectedReturn.outstandingFee) * USD_TO_VND_RATE)
      })
      setFacilityCompensation(0)
      setDisputeResolutionNote(
        'Thẩm định hiện trường: Kết cấu trần, vách, sàn kho khô ráo 100%. Nấm mốc phát sinh do khách đóng gói hàng còn ẩm hoặc vi phạm quy định bảo quản đồ nhạy cảm. Giữ nguyên khấu trừ Phí khử trùng & xử lý ẩm mốc 1.500.000₫ theo đúng Hợp đồng.'
      )
    } else if (preset === 'mutual_settlement') {
      const reducedFee = 750000 // 50% của 1.500.000 VND
      setDisputeSettlement({
        damageFee: Math.round(moneyValue(selectedReturn.damageFee) * USD_TO_VND_RATE),
        cleaningFee: reducedFee,
        lostItemFee: Math.round(moneyValue(selectedReturn.lostItemFee) * USD_TO_VND_RATE),
        overdueFee: Math.round(moneyValue(selectedReturn.overdueFee) * USD_TO_VND_RATE),
        outstandingFee: Math.round(moneyValue(selectedReturn.outstandingFee) * USD_TO_VND_RATE)
      })
      setFacilityCompensation(0)
      setDisputeResolutionNote(
        'Thỏa thuận hỗ trợ thiện chí: Khách thuê kho tiêu chuẩn không điều hòa, vào mùa nồm ẩm. Cơ sở hỗ trợ giảm 50% phí khử trùng nấm mốc (còn 750.000₫) để hai bên hoàn tất quyết toán nhanh chóng.'
      )
    }
  }

  const openDisputeReview = (returnCase: ReturnCase) => {
    setSelectedReturn(returnCase)
    setDisputeResolutionNote(returnCase.staffNotes || '')
    setDisputePreset(returnCase.disputeResolutionPreset || (returnCase.moistureOrigin === 'facility_fault' ? 'facility_fault_full_refund' : returnCase.moistureOrigin === 'customer_fault' ? 'customer_fault_deduct' : undefined))
    setFacilityCompensation(Math.round(moneyValue(returnCase.facilityCompensationAmount || 0) * USD_TO_VND_RATE))
    setDisputeSettlement({
      damageFee: Math.round(moneyValue(returnCase.damageFee) * USD_TO_VND_RATE),
      cleaningFee: Math.round(moneyValue(returnCase.cleaningFee) * USD_TO_VND_RATE),
      lostItemFee: Math.round(moneyValue(returnCase.lostItemFee) * USD_TO_VND_RATE),
      overdueFee: Math.round(moneyValue(returnCase.overdueFee) * USD_TO_VND_RATE),
      outstandingFee: Math.round(moneyValue(returnCase.outstandingFee) * USD_TO_VND_RATE)
    })
    setDisputeModalOpen(true)
  }

  const setSettlementFee = (field: keyof ManagerReturnSettlementFees, value: string) => {
    const parsed = Number(value)
    setDisputeSettlement(current => ({ ...current, [field]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }))
  }

  const handleReviewDispute = () => {
    if (!selectedReturn) return
    try {
      reviewReturnDispute(
        selectedReturn.id,
        user,
        disputeResolutionNote,
        settlementInBaseCurrency,
        disputePreset,
        facilityCompensation > 0 ? facilityCompensation / USD_TO_VND_RATE : undefined
      )
      showToast(
        `Đã rà soát khiếu nại cho đơn ${selectedReturn.id} thành công!`
      )
      setDisputeModalOpen(false)
      setDisputeResolutionNote('')
      setSelectedReturn(null)
    } catch (err: any) {
      showToast(formatReturnManagerError(err, 'Có lỗi khi xử lý khiếu nại.'))
    }
  }

  const handleCompleteRefund = () => {
    if (!selectedReturn) return
    if (!refundTxnRef.trim()) {
      showToast('Vui lòng nhập mã giao dịch hoàn cọc.')
      return
    }
    try {
      completeReturnRefund(selectedReturn.id, user, refundTxnRef.trim())
      showToast(
        `Đã xác nhận hoàn tiền cọc ${formatManagerMoney(selectedReturn.netRefundAmount)} cho ${selectedReturn.customerName}!`
      )
      setRefundModalOpen(false)
      setRefundTxnRef('')
      setSelectedReturn(null)
    } catch (err: any) {
      showToast(formatReturnManagerError(err, 'Có lỗi khi hoàn cọc.'))
    }
  }

  const settlementInBaseCurrency: ManagerReturnSettlementFees = {
    damageFee: disputeSettlement.damageFee / USD_TO_VND_RATE,
    cleaningFee: disputeSettlement.cleaningFee / USD_TO_VND_RATE,
    lostItemFee: disputeSettlement.lostItemFee / USD_TO_VND_RATE,
    overdueFee: disputeSettlement.overdueFee / USD_TO_VND_RATE,
    outstandingFee: disputeSettlement.outstandingFee / USD_TO_VND_RATE
  }

  const disputePreview = selectedReturn
    ? calculateManagerReturnSettlement(moneyValue(selectedReturn.depositAmount), settlementInBaseCurrency)
    : null

  return (
    <div className="fade-in space-y-6">
      <SectionHeader
        eyebrow="Vận hành cơ sở"
        title={'Quản Lý Trả Kho & Nghiệm Thu Hiện Trường'}
        subtitle={'Điều phối nhân viên nghiệm thu, kiểm tra biên bản hiện trường, xử lý bảo trì hỏng hóc và đóng hồ sơ trả kho.'}
      />

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={'Tổng yêu cầu trả kho'}
          value={scopedReturns.length}
          icon={Icon.box}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title={'Chờ nghiệm thu hiện trường'}
          value={awaitingInspectionCount}
          delta={awaitingInspectionCount > 0 ? ("Cần phân công nhân viên") : undefined}
          deltaPositive={awaitingInspectionCount === 0}
          icon={Icon.tasks}
          iconBg={awaitingInspectionCount > 0 ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-200' : 'bg-stone-50 text-stone-600'}
        />
        <StatCard
          title={'Đã kiểm tra hiện trường'}
          value={inspectedCount}
          delta={'Chờ quản lý nghiệm thu'}
          deltaPositive
          icon={Icon.check}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title={'Phát hiện hư hại / Bảo trì'}
          value={needsMaintenanceCount}
          delta={needsMaintenanceCount > 0 ? ("Cần lập phiếu sửa chữa") : undefined}
          deltaPositive={needsMaintenanceCount === 0}
          icon={Icon.alert}
          iconBg={needsMaintenanceCount > 0 ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'bg-stone-50 text-stone-600'}
        />
      </div>

      <ManagerActionNotice tone={awaitingInspectionCount || needsMaintenanceCount ? 'warning' : 'info'}>
        Quản lý cơ sở phân công nhân viên kiểm tra nghiệm thu hiện trường, xem xét báo cáo hư hỏng để kích hoạt sửa chữa bảo trì kho, và xác nhận hoàn tất giải phóng gian kho về trạng thái khả dụng.
      </ManagerActionNotice>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            `Tất cả (${facilityReturns.length})`,
            `Chờ nghiệm thu (${awaitingInspectionCount})`,
            `Đã kiểm tra (${inspectedCount})`,
            `Cần bảo trì (${needsMaintenanceCount})`,
            `Khiếu nại (${disputedCount})`,
            `Đã hoàn tất (${completedCount})`
          ]}
          active={
            returnTab === 'All' ? `Tất cả (${facilityReturns.length})` :
            returnTab === 'awaiting_inspection' ? `Chờ nghiệm thu (${awaitingInspectionCount})` :
            returnTab === 'inspected' ? `Đã kiểm tra (${inspectedCount})` :
            returnTab === 'needs_maintenance' ? `Cần bảo trì (${needsMaintenanceCount})` :
            returnTab === 'disputed' ? `Khiếu nại (${disputedCount})` :
            returnTab === 'completed' ? `Đã hoàn tất (${completedCount})` : `Tất cả (${facilityReturns.length})`
          }
          onChange={val => {
            if (val.startsWith('Tất cả')) setReturnTab('All')
            else if (val.startsWith('Chờ nghiệm thu')) setReturnTab('awaiting_inspection')
            else if (val.startsWith('Đã kiểm tra')) setReturnTab('inspected')
            else if (val.startsWith('Cần bảo trì')) setReturnTab('needs_maintenance')
            else if (val.startsWith('Khiếu nại')) setReturnTab('disputed')
            else if (val.startsWith('Đã hoàn tất')) setReturnTab('completed')
          }}
        />
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder={'Tìm theo mã, khách, gian kho...'}
            value={returnSearch}
            onChange={e => setReturnSearch(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          />
        </div>
      </div>
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Mức hư hại" value={damageFilter} onChange={event => setDamageFilter(event.target.value)}><option value="all">Tất cả mức độ</option><option value="no_damage">Không hư hại</option><option value="minor_damage">Hư hại nhẹ</option><option value="major_damage">Hư hại nặng</option><option value="abandoned_goods">Bỏ lại hàng hóa</option></Select>
          <Select label="Kết quả quyết toán" value={settlementFilter} onChange={event => setSettlementFilter(event.target.value)}><option value="all">Tất cả kết quả</option><option value="refund">Có tiền hoàn khách</option><option value="customer_due">Khách phải nộp thêm</option><option value="balanced">Không phát sinh</option></Select>
          <Input label="Từ ngày hẹn" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
          <Input label="Đến ngày hẹn" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
          <Select label="Sắp xếp" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="priority">Cần xử lý trước</option><option value="date-asc">Ngày hẹn gần nhất</option><option value="date-desc">Ngày hẹn xa nhất</option><option value="amount-desc">Giá trị quyết toán lớn nhất</option></Select>
        </div>
      </Card>

      {hiddenFacilityCount > 0 && (
        <ManagerActionNotice tone="info">
          <div className="flex items-center justify-between gap-3">
            <span>{hiddenFacilityCount} hồ sơ trả kho đã được ẩn khỏi danh sách quản lý cơ sở. Dữ liệu nguồn và báo cáo vẫn được giữ nguyên.</span>
            <Button size="sm" variant="outline" onClick={() => returnHistory.restoreAll()}>Khôi phục tất cả</Button>
          </div>
        </ManagerActionNotice>
      )}

      {/* Returns Table */}
      <Card className="overflow-hidden border border-stone-200/80 shadow-sm">
        <Table>
          <Thead>
            <tr>
              <Th>{'Mã Trả Kho / HĐ'}</Th>
              <Th>{'Khách Hàng'}</Th>
              <Th>{'Gian Kho'}</Th>
              <Th>{'Ngày Hẹn / Nghiệm Thu'}</Th>
              <Th>{'Đánh Giá Hiện Trường & Hư Hại'}</Th>
              <Th>{'Quyết Toán'}</Th>
              <Th>{'Trạng Thái'}</Th>
              <Th className="text-right">{'Thao Tác'}</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-stone-400 text-sm">
                  {'Không có hồ sơ trả kho nào trong danh mục này.'}
                </td>
              </tr>
            ) : (
              pagination.items.map(ret => {
                const totalDeductions =
                  moneyValue(ret.damageFee) +
                  moneyValue(ret.cleaningFee) +
                  moneyValue(ret.lostItemFee) +
                  moneyValue(ret.overdueFee) +
                  moneyValue(ret.outstandingFee)

                const isDamaged = (ret.damageClassification && ret.damageClassification !== 'no_damage') || ret.proposedUnitStatus === 'maintenance'

                return (
                  <Tr
                    key={ret.id}
                    className={
                      ret.status === 'disputed'
                        ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-rose-500'
                        : isDamaged && ret.status !== 'completed'
                        ? 'bg-amber-50/30 hover:bg-amber-50/60'
                        : undefined
                    }
                  >
                    <Td>
                      <span className="font-mono text-xs font-bold text-stone-800">{ret.id}</span>
                      <p className="text-[11px] text-stone-400 font-mono">Hồ sơ thuê: {ret.rentalId}</p>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={ret.customerName} size="sm" />
                        <div>
                          <p className="font-medium text-sm text-stone-900">{ret.customerName}</p>
                          <p className="text-xs text-stone-400">{ret.customerPhone || ret.customerEmail}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded text-xs">
                        {ret.unitId}
                      </span>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="text-stone-700 font-medium">{formatManagerDate(ret.scheduledDate)}</p>
                        <p className="text-[11px] text-stone-400">
                          {'Yêu cầu:'} {formatManagerDate(ret.requestedAt)}
                        </p>
                        {ret.staffId && (
                          <p className="text-[11px] text-blue-600 font-medium mt-0.5">
                            NV: {users.find(u => u.id === ret.staffId)?.name || ret.staffId}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs space-y-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                          ret.damageClassification === 'no_damage'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ret.damageClassification === 'minor_damage'
                            ? 'bg-amber-100 text-amber-800'
                            : ret.damageClassification === 'major_damage'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {getDamageLabel(ret.damageClassification)}
                        </span>
                        {ret.moistureOrigin && ret.moistureOrigin !== 'none' && (
                          <div>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              ret.moistureOrigin === 'facility_fault'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : ret.moistureOrigin === 'customer_fault'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {ret.moistureOrigin === 'facility_fault' ? 'Lỗi cơ sở dột' : ret.moistureOrigin === 'customer_fault' ? 'Đồ ẩm mốc' : 'Độ ẩm tự nhiên'}
                            </span>
                          </div>
                        )}
                        {ret.returnedItems && (
                          <p className="text-[11px] text-stone-500">
                            Bàn giao: {ret.returnedItems.key ? 'Đã trả khóa' : 'Chưa trả khóa'} · {ret.returnedItems.card ? 'Đã trả thẻ' : 'Chưa trả thẻ'}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs">
                        <p className="text-stone-500">
                          {'Cọc:'} <span className="font-mono">{formatManagerMoney(ret.depositAmount)}</span>
                        </p>
                        {ret.amountDueFromCustomer && ret.amountDueFromCustomer > 0 ? (
                          <p className="font-bold text-rose-600">
                            {`Khách nộp: ${formatManagerMoney(ret.amountDueFromCustomer ?? 0)}`}
                          </p>
                        ) : (
                          <p className="font-bold text-emerald-700">
                            {`Hoàn: ${formatManagerMoney(ret.netRefundAmount)}`}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>{sb(ret.status)}</Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReturn(ret)
                            setDetailModalOpen(true)
                          }}
                        >
                          {'Biên bản'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="font-medium text-amber-800 border-amber-300 hover:bg-amber-50"
                          onClick={() => {
                            setSettlementTarget(ret)
                            setSettlementModalOpen(true)
                          }}
                        >
                          {'Quyết toán'}
                        </Button>

                        {(ret.status === 'requested' || ret.status === 'scheduled') && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium whitespace-nowrap"
                            onClick={() => openAssignModal(ret)}
                          >
                            {ret.status === 'scheduled' ? 'Đổi NV' : 'Giao NV'}
                          </Button>
                        )}

                        {isDamaged && ret.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500 text-amber-700 hover:bg-amber-50 font-medium whitespace-nowrap"
                            onClick={() => openMaintenanceModal(ret)}
                          >
                            {'Lập bảo trì'}
                          </Button>
                        )}

                        {ret.status === 'awaiting_customer_confirmation' && (
                          <Button
                            size="sm"
                            variant="primary"
                            title="Duyệt hoàn tất và đóng hồ sơ trả kho ngay"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium whitespace-nowrap cursor-pointer"
                            onClick={() => openCompleteModal(ret)}
                          >
                            {'✓ Duyệt trả kho ngay'}
                          </Button>
                        )}

                        {ret.status === 'inspected' && (
                          <Button
                            size="sm"
                            variant="primary"
                            title="Hoàn tất trả kho ngay"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium whitespace-nowrap cursor-pointer"
                            onClick={() => openCompleteModal(ret)}
                          >
                            {'✓ Hoàn tất trả kho'}
                          </Button>
                        )}

                        {ret.status === 'payment_due' && (
                          <Button
                            size="sm"
                            variant="primary"
                            title="Xác nhận thu phí & hoàn tất trả kho"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium whitespace-nowrap cursor-pointer"
                            onClick={() => openCompleteModal(ret)}
                          >
                            {'✓ Hoàn tất trả kho'}
                          </Button>
                        )}

                        {ret.status === 'refund_pending' && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium whitespace-nowrap cursor-pointer"
                            onClick={() => openCompleteModal(ret)}
                          >
                            {'Hoàn tất'}
                          </Button>
                        )}

                        {ret.status === 'disputed' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white font-medium whitespace-nowrap"
                            onClick={() => {
                              openDisputeReview(ret)
                            }}
                          >
                            {'Xử lý khiếu nại'}
                          </Button>
                        )}

                        {ret.status === 'refund_pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-700 border-emerald-500 hover:bg-emerald-50 font-medium whitespace-nowrap"
                            onClick={() => {
                              setSelectedReturn(ret)
                              setRefundTxnRef('')
                              setRefundModalOpen(true)
                            }}
                          >
                            {'Hoàn cọc'}
                          </Button>
                        )}

                        {ret.status === 'completed' && (
                          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(ret)}>
                            Xóa
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>
        <ManagerPagination {...pagination} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </Card>

      {/* Return Details Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={'Chi Tiết Hồ Sơ Trả Kho & Nghiệm Thu'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-slate-900 text-white shadow-inner">
              <div className="flex justify-between items-center text-xs font-mono text-amber-400">
                <span>{selectedReturn.id}</span>
                <span>HĐ: {selectedReturn.rentalId}</span>
              </div>
              <div className="mt-2 flex justify-between items-end">
                <div>
                  <p className="text-xl font-bold font-mono">
                    {`Gian Kho ${selectedReturn.unitId}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedReturn.customerName}, {selectedReturn.customerPhone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{'Trạng thái'}</p>
                  {sb(selectedReturn.status)}
                </div>
              </div>
            </div>

            {/* Inspection & Fees Breakdown Bento Box */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3.5 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">{'Mức độ hư hại'}</span>
                <span className="font-semibold text-stone-800 text-sm">
                  {getDamageLabel(selectedReturn.damageClassification)}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{'Khớp danh mục đồ gửi'}</span>
                <span className="font-semibold text-stone-800 text-sm capitalize">
                  {selectedReturn.inventoryMatch || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{'Ngày nghiệm thu'}</span>
                <span className="font-medium text-stone-700">
                  {selectedReturn.inspectedAt ? formatManagerDateTime(selectedReturn.inspectedAt) : 'Chưa nghiệm thu'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block">{'Vật tư bàn giao lại'}</span>
                <span className="font-medium text-stone-700">
                  {selectedReturn.returnedItems
                    ? `Chìa: ${selectedReturn.returnedItems.key ? 'Đã trả' : 'Chưa trả'}, Thẻ: ${selectedReturn.returnedItems.card ? 'Đã trả' : 'Chưa trả'}, Khóa: ${selectedReturn.returnedItems.lock ? 'Đã trả' : 'Chưa trả'}`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Giám định kết cấu hạ tầng (Trần - Vách - Sàn) & Ẩm mốc */}
            {selectedReturn.structuralInspection && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-cyan-200 pb-1.5">
                  <span className="font-bold text-cyan-950 text-sm flex items-center gap-1.5">
                    Biên Bản Giám Định Kết Cấu & Ẩm Mốc Lúc Trả Kho
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    selectedReturn.moistureOrigin === 'facility_fault'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : selectedReturn.moistureOrigin === 'customer_fault'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : selectedReturn.moistureOrigin === 'climate_standard_uncontrolled'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {selectedReturn.moistureOrigin === 'facility_fault'
                      ? 'Lỗi do Cơ sở kho (Thấm dột)'
                      : selectedReturn.moistureOrigin === 'customer_fault'
                      ? 'Lỗi do Khách hàng (Đóng gói ẩm)'
                      : selectedReturn.moistureOrigin === 'climate_standard_uncontrolled'
                      ? 'Kho thường - Miễn trừ SLA độ ẩm'
                      : 'Kho hoàn toàn khô ráo'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-white p-2 rounded border border-cyan-100">
                    <span className="text-stone-400 block text-[10px]">Trần kho</span>
                    <span className="font-semibold text-stone-800">
                      {selectedReturn.structuralInspection.ceiling === 'leaking'
                        ? 'Thấm dột giọt nước'
                        : selectedReturn.structuralInspection.ceiling === 'stained'
                        ? 'Loang ố trần'
                        : 'Khô ráo, nguyên vẹn'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-cyan-100">
                    <span className="text-stone-400 block text-[10px]">Vách tường</span>
                    <span className="font-semibold text-stone-800">
                      {selectedReturn.structuralInspection.wall === 'damp_seepage'
                        ? 'Ngấm ẩm từ ngoài vào'
                        : selectedReturn.structuralInspection.wall === 'cracked'
                        ? 'Nứt nẻ vách'
                        : 'Khô ráo, sạch sẽ'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-cyan-100">
                    <span className="text-stone-400 block text-[10px]">Sàn kho</span>
                    <span className="font-semibold text-stone-800">
                      {selectedReturn.structuralInspection.floor === 'cracked'
                        ? 'Nứt vỡ sàn'
                        : selectedReturn.structuralInspection.floor === 'water_pooling'
                        ? 'Đọng nước ẩm'
                        : 'Khô ráo, nguyên vẹn'}
                    </span>
                  </div>
                </div>
                {selectedReturn.sanitizationFee && selectedReturn.sanitizationFee > 0 && (
                  <div className="flex justify-between items-center bg-amber-50 p-2 rounded border border-amber-200 text-amber-900 mt-1">
                    <span>Phí khử trùng nấm mốc áp dụng:</span>
                    <span className="font-mono font-bold">{formatManagerMoney(selectedReturn.sanitizationFee)}</span>
                  </div>
                )}
                {selectedReturn.facilityCompensationAmount && selectedReturn.facilityCompensationAmount > 0 && (
                  <div className="flex justify-between items-center bg-rose-50 p-2 rounded border border-rose-200 text-rose-900 mt-1">
                    <span>Cơ sở đồng ý bồi thường thiệt hại:</span>
                    <span className="font-mono font-bold text-rose-700">+{formatManagerMoney(selectedReturn.facilityCompensationAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Financial Calculation Matrix */}
            <div className="rounded-lg border border-stone-200 p-3.5 bg-white space-y-2 text-xs">
              <p className="font-semibold text-stone-900 border-b pb-1.5 text-sm">
                {'Chi Tiết Quyết Toán Tài Chính'}
              </p>
              <div className="flex justify-between py-0.5">
                <span className="text-stone-500">{'Tiền đặt cọc ban đầu'}</span>
                <span className="font-mono font-semibold text-stone-800">{formatManagerMoney(selectedReturn.depositAmount)}</span>
              </div>
              {selectedReturn.damageFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{'Phí sửa chữa hư hại'}</span>
                  <span className="font-mono">-{formatManagerMoney(selectedReturn.damageFee)}</span>
                </div>
              )}
              {selectedReturn.cleaningFee && selectedReturn.cleaningFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{'Phí vệ sinh kho'}</span>
                  <span className="font-mono">-{formatManagerMoney(selectedReturn.cleaningFee)}</span>
                </div>
              )}
              {selectedReturn.overdueFee && selectedReturn.overdueFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{`Phí phạt trễ hạn (${selectedReturn.overdueDays || 0} ngày)`}</span>
                  <span className="font-mono">-{formatManagerMoney(selectedReturn.overdueFee)}</span>
                </div>
              )}
              {selectedReturn.outstandingFee && selectedReturn.outstandingFee > 0 && (
                <div className="flex justify-between py-0.5 text-red-600">
                  <span>{'Cước thuê còn nợ'}</span>
                  <span className="font-mono">-{formatManagerMoney(selectedReturn.outstandingFee)}</span>
                </div>
              )}
              <div className="pt-2 border-t flex justify-between font-bold text-sm">
                <span>{'Thực hoàn lại cho khách'}</span>
                <span className={selectedReturn.netRefundAmount > 0 ? 'text-emerald-700 font-mono' : 'text-stone-600 font-mono'}>
                  {formatManagerMoney(selectedReturn.netRefundAmount)}
                </span>
              </div>
              {selectedReturn.amountDueFromCustomer && selectedReturn.amountDueFromCustomer > 0 && (
                <div className="flex justify-between font-bold text-sm text-rose-600 pt-1">
                  <span>{'Khách còn phải nộp thêm'}</span>
                  <span className="font-mono">{formatManagerMoney(selectedReturn.amountDueFromCustomer ?? 0)}</span>
                </div>
              )}
            </div>

            {/* Staff / Customer Notes */}
            {selectedReturn.staffNotes && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                <span className="font-semibold text-amber-900 block mb-1">{'Ghi chú nghiệp vụ'}</span>
                <p className="text-amber-800">{selectedReturn.staffNotes}</p>
              </div>
            )}

            {selectedReturn.customerDecisionNote && (
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg text-xs">
                <span className="font-semibold text-rose-900 block mb-1">
                  {'Lý do khiếu nại của khách hàng'}
                </span>
                <p className="text-rose-800">{selectedReturn.customerDecisionNote}</p>
              </div>
            )}

            {getReturnActionReason(selectedReturn) && <ManagerActionNotice tone={selectedReturn.status === 'completed' ? 'success' : 'info'}>{getReturnActionReason(selectedReturn)}</ManagerActionNotice>}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="font-medium text-amber-800 border-amber-300 hover:bg-amber-50"
                onClick={() => {
                  setSettlementTarget(selectedReturn)
                  setSettlementModalOpen(true)
                }}
              >
                Xem hóa đơn và biên lai
              </Button>
              {(selectedReturn.status === 'requested' || selectedReturn.status === 'scheduled') && (
                <Button
                  variant="primary"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    openAssignModal(selectedReturn)
                  }}
                >
                  {selectedReturn.status === 'scheduled' ? 'Đổi nhân viên nghiệm thu' : 'Giao nhân viên nghiệm thu'}
                </Button>
              )}
              {((selectedReturn.damageClassification && selectedReturn.damageClassification !== 'no_damage') || selectedReturn.proposedUnitStatus === 'maintenance') && selectedReturn.status !== 'completed' && (
                <Button
                  variant="outline"
                  className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    setDetailModalOpen(false)
                    openMaintenanceModal(selectedReturn)
                  }}
                >
                  Lập phiếu bảo trì
                </Button>
              )}
              {['inspected', 'awaiting_customer_confirmation', 'refund_pending', 'payment_due'].includes(selectedReturn.status) && (
                <Button
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    openCompleteModal(selectedReturn)
                  }}
                >
                  Hoàn tất trả kho
                </Button>
              )}
              {selectedReturn.status === 'disputed' && (
                <Button
                  variant="primary"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    openDisputeReview(selectedReturn)
                  }}
                >
                  {'Xử lý khiếu nại'}
                </Button>
              )}
              {selectedReturn.status === 'refund_pending' && (
                <Button
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setDetailModalOpen(false)
                    setRefundTxnRef('')
                    setRefundModalOpen(true)
                  }}
                >
                  {'Hoàn cọc ngay'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Review Dispute Modal */}
      <Modal
        open={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        title={'Phân Xử & Giải Quyết Khiếu Nại Quyết Toán'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs space-y-1.5">
              <p className="font-bold text-rose-900 text-sm">
                {`Khiếu nại từ khách: ${selectedReturn.customerName}`}
              </p>
              <p className="text-rose-800 font-mono">
                {`Kho ${selectedReturn.unitId}, Hồ sơ ${selectedReturn.id}`}
              </p>
              <div className="mt-2 pt-2 border-t border-rose-200/80">
                <p className="text-stone-500">{'Ý kiến phản ánh của khách:'}</p>
                <p className="font-medium text-rose-950 mt-0.5">
                  "{selectedReturn.customerDecisionNote || ('Không đồng ý với phí khấu trừ nghiệm thu kho.')}"
                </p>
              </div>
            </div>

            {/* 3 Kịch Bản Phân Xử Nhanh Theo Quy Định */}
            <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs">
              <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                Chọn Kịch Bản Phân Xử Theo Căn Cứ Hiện Trường & Quy Định:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => applyDisputePreset('facility_fault_full_refund')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    disputePreset === 'facility_fault_full_refund'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-500'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-800'
                  }`}
                >
                  <p className="font-bold text-xs text-emerald-800 flex items-center gap-1">
                    1. Lỗi Cơ Sở Kho
                  </p>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Nóc dột / vách ngấm nước. Miễn 100% phí, hoàn cọc + bồi thường, tạo task sửa P1.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyDisputePreset('customer_fault_deduct')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    disputePreset === 'customer_fault_deduct'
                      ? 'border-amber-600 bg-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-500'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-800'
                  }`}
                >
                  <p className="font-bold text-xs text-amber-800 flex items-center gap-1">
                    2. Lỗi Khách Hàng
                  </p>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Kho khô 100%, đồ ẩm phát mốc. Giữ nguyên trừ phí khử trùng 1.500.000₫.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyDisputePreset('mutual_settlement')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    disputePreset === 'mutual_settlement'
                      ? 'border-blue-600 bg-blue-50 text-blue-950 shadow-sm ring-2 ring-blue-500'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-800'
                  }`}
                >
                  <p className="font-bold text-xs text-blue-800 flex items-center gap-1">
                    3. Hòa Giải Thiện Chí
                  </p>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Kho thường nồm ẩm. Giảm 50% phí khử trùng (750.000₫), chia sẻ trách nhiệm.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-bold text-stone-900">Xác nhận lại các khoản quyết toán</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Phí hư hỏng (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.damageFee)} onChange={event => setSettlementFee('damageFee', event.target.value)} />
                <Input label="Phí vệ sinh & khử trùng (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.cleaningFee)} onChange={event => setSettlementFee('cleaningFee', event.target.value)} />
                <Input label="Phí mất vật dụng (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.lostItemFee)} onChange={event => setSettlementFee('lostItemFee', event.target.value)} />
                <Input label="Phí quá hạn (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.overdueFee)} onChange={event => setSettlementFee('overdueFee', event.target.value)} />
                <Input label="Công nợ còn lại (VND)" type="number" min="0" step="1000" value={String(disputeSettlement.outstandingFee)} onChange={event => setSettlementFee('outstandingFee', event.target.value)} />
                {disputePreset === 'facility_fault_full_refund' && (
                  <Input
                    label="Khoản bồi thường từ cơ sở (VND)"
                    type="number"
                    min="0"
                    step="100000"
                    value={String(facilityCompensation)}
                    onChange={e => setFacilityCompensation(Math.max(0, Number(e.target.value) || 0))}
                  />
                )}
              </div>
              {disputePreview && <div className="grid gap-2 border-t border-stone-200 pt-3 text-sm sm:grid-cols-3"><p>Khấu trừ: <b>{formatVnd(disputePreview.totalDeductions)}</b></p><p>Hoàn khách: <b className="text-emerald-700">{formatVnd(disputePreview.netRefundAmount)}</b></p><p>Khách nộp thêm: <b className="text-rose-700">{formatVnd(disputePreview.amountDueFromCustomer)}</b></p></div>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                {'Kết luận xử lý của quản lý cơ sở'}
              </label>
              <textarea
                rows={4}
                value={disputeResolutionNote}
                onChange={e => setDisputeResolutionNote(e.target.value)}
                placeholder={
                  "Nhập căn cứ xử lý (ví dụ: Đã đối chiếu ảnh chụp hiện trạng ngày vào và ra, chấp thuận giảm 50% phí vệ sinh...)"
                }
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setDisputeModalOpen(false)}>
                {'Hủy'}
              </Button>
              <Button
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleReviewDispute}
              >
                {'Gửi kết luận cho khách'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Complete Refund Modal */}
      <Modal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title={'Xác Nhận Hoàn Tiền Cọc Cho Khách'}
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800">{'Khách thụ hưởng'}</span>
                <span className="font-bold text-emerald-950 text-sm">{selectedReturn.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800">{'Mã gian kho thanh lý'}</span>
                <span className="font-mono font-bold text-emerald-950">{selectedReturn.unitId}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-emerald-200 text-sm">
                <span className="font-bold text-emerald-900">{'Số tiền hoàn cọc'}</span>
                <span className="font-mono font-extrabold text-emerald-700 text-lg">{formatManagerMoney(selectedReturn.netRefundAmount)}</span>
              </div>
            </div>

            <Input
              label={'Mã chứng từ / Tham chiếu chuyển khoản ngân hàng'}
              value={refundTxnRef}
              onChange={e => setRefundTxnRef(e.target.value)}
              placeholder="e.g. VCB-REF-849204"
            />

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setRefundModalOpen(false)}>
                {'Hủy'}
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleCompleteRefund}
              >
                {'Xác nhận hoàn cọc'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Ẩn khỏi danh sách hồ sơ trả kho">
        {deleteTarget && <div className="space-y-4"><ManagerActionNotice tone="warning">Hồ sơ {deleteTarget.id} chỉ bị ẩn khỏi lịch sử của quản lý cơ sở. Dữ liệu dùng chung, quyết toán và báo cáo không bị xóa.</ManagerActionNotice><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button><Button variant="danger" onClick={() => { returnHistory.hide(deleteTarget.id); setDeleteTarget(null); showToast(`Đã ẩn hồ sơ ${deleteTarget.id} khỏi lịch sử quản lý cơ sở.`) }}>Xóa khỏi lịch sử</Button></div></div>}
      </Modal>

      {/* 1. Modal Giao NV Nghiệm Thu */}
      <Modal open={assignModalOpen} onClose={() => { setAssignModalOpen(false); setAssignTarget(null) }} title="Giao Nhân Viên Nghiệm Thu Trả Kho">
        {assignTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-blue-800 font-medium">Hồ sơ trả kho:</span><b className="font-mono text-blue-950">{assignTarget.id}</b></div>
              <div className="flex justify-between"><span className="text-blue-800 font-medium">Gian kho / Cơ sở:</span><b className="font-mono text-blue-950">{assignTarget.unitId} · {assignTarget.facilityName}</b></div>
              <div className="flex justify-between"><span className="text-blue-800 font-medium">Khách hàng:</span><b>{assignTarget.customerName} ({assignTarget.customerPhone})</b></div>
            </div>

            <Select label="Chọn nhân viên phụ trách nghiệm thu" value={assignStaffId} onChange={e => setAssignStaffId(e.target.value)}>
              {availableStaff.length === 0 ? (
                <option value="">Chưa có nhân viên trực thuộc cơ sở</option>
              ) : (
                availableStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))
              )}
            </Select>

            <Input label="Ngày hẹn nghiệm thu tại cơ sở" type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} />

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Ghi chú & Chỉ đạo nhân viên</label>
              <textarea
                rows={3}
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                placeholder="Nhiệm vụ kiểm tra trần, sàn, vách, thu hồi khóa/thẻ..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => { setAssignModalOpen(false); setAssignTarget(null) }}>Hủy</Button>
              <Button variant="primary" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmAssign}>
                Xác nhận phân công
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Modal Tạo Phiếu Bảo Trì */}
      <Modal open={maintenanceModalOpen} onClose={() => { setMaintenanceModalOpen(false); setMaintenanceTarget(null) }} title="Lập phiếu bảo trì kho sau nghiệm thu">
        {maintenanceTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-amber-800 font-medium">Gian kho cần bảo dưỡng:</span><b className="font-mono text-amber-950 text-sm">{maintenanceTarget.unitId}</b></div>
              <div className="flex justify-between"><span className="text-amber-800 font-medium">Hồ sơ nghiệm thu gốc:</span><span className="font-mono text-stone-600">{maintenanceTarget.id}</span></div>
              <div className="flex justify-between"><span className="text-amber-800 font-medium">Hiện trạng phát hiện:</span><b className="text-rose-700">{getDamageLabel(maintenanceTarget.damageClassification)}</b></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">Nội dung bảo trì / Hạng mục hư hại cần sửa chữa</label>
              <textarea
                rows={3}
                value={maintenanceReason}
                onChange={e => setMaintenanceReason(e.target.value)}
                placeholder="Mô tả chi tiết hạng mục: trần dột, vách nứt ẩm, cửa hỏng, khử mùi..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Mức độ ưu tiên" value={maintenancePriority} onChange={e => setMaintenancePriority(e.target.value as any)}>
                <option value="high">Cao (Cần khắc phục khẩn cấp)</option>
                <option value="medium">Trung bình (Bảo trì định kỳ)</option>
                <option value="low">Thấp</option>
              </Select>
              <Input label="Hạn hoàn thành bảo trì" type="date" value={maintenanceDueAt} onChange={e => setMaintenanceDueAt(e.target.value)} />
            </div>

            <Select label="Phân công kỹ thuật viên / Nhân viên sửa chữa" value={maintenanceStaffId} onChange={e => setMaintenanceStaffId(e.target.value)}>
              <option value="">Chưa phân công cụ thể</option>
              {availableStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
              ))}
            </Select>

            <ManagerActionNotice tone="warning">
              Sau khi tạo phiếu bảo trì, gian kho <b>{maintenanceTarget.unitId}</b> sẽ tự động chuyển sang trạng thái <b>BẢO TRÌ (Maintenance)</b> và không được cấp phát cho khách thuê mới cho tới khi hoàn tất sửa chữa.
            </ManagerActionNotice>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => { setMaintenanceModalOpen(false); setMaintenanceTarget(null) }}>Hủy</Button>
              <Button variant="primary" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirmMaintenance}>
                Kích hoạt bảo trì & Tạo việc
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Modal Xác Nhận Hoàn Tất Trả Kho */}
      <Modal open={completeModalOpen} onClose={() => { setCompleteModalOpen(false); setCompleteTarget(null) }} title="Xác Nhận Hoàn Tất Hồ Sơ Trả Kho">
        {completeTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs space-y-2">
              <div className="flex justify-between items-center"><span className="text-stone-500">Mã trả kho:</span><b className="font-mono text-stone-900">{completeTarget.id}</b></div>
              <div className="flex justify-between items-center"><span className="text-stone-500">Gian kho:</span><b className="font-mono text-stone-900">{completeTarget.unitId}</b></div>
              <div className="flex justify-between items-center"><span className="text-stone-500">Khách hàng:</span><b className="text-stone-900">{completeTarget.customerName}</b></div>
              <div className="flex justify-between items-center"><span className="text-stone-500">Đánh giá hiện trường:</span><b>{getDamageLabel(completeTarget.damageClassification)}</b></div>
            </div>

            {((completeTarget.damageClassification && completeTarget.damageClassification !== 'no_damage') || completeTarget.proposedUnitStatus === 'maintenance') ? (
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900">
                <p className="font-bold">Gian kho có hư hại hoặc cần bảo trì</p>
                <p className="mt-1">Khi đóng hồ sơ trả kho này, hợp đồng của khách sẽ kết thúc. Gian kho sẽ tiếp tục được giữ ở trạng thái <b>BẢO TRÌ</b> để nhân viên kỹ thuật khắc phục.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-900">
                <p className="font-bold">Gian kho nguyên vẹn và đạt nghiệm thu</p>
                <p className="mt-1">Khi xác nhận hoàn tất, gian kho <b>{completeTarget.unitId}</b> sẽ tự động chuyển sang trạng thái <b>CÒN TRỐNG (Available)</b>, quyền truy cập PIN/thẻ được thu hồi và hồ sơ thuê được đóng hoàn toàn.</p>
              </div>
            )}

            <Input
              label="Ghi chú xác nhận của Quản lý"
              value={completeNotes}
              onChange={e => setCompleteNotes(e.target.value)}
              placeholder="Nghiệm thu đạt yêu cầu..."
            />

            {completeTarget.status === 'disputed' && (
              <div className="rounded-lg bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800">
                Hồ sơ đang khiếu nại, cần BO giải quyết. Chưa thể xác nhận hoàn tất ở trạng thái này.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => { setCompleteModalOpen(false); setCompleteTarget(null) }}>Hủy</Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                onClick={handleConfirmComplete}
              >
                Xác nhận hoàn tất trả kho
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ReturnSettlementModal
        open={settlementModalOpen}
        onClose={() => setSettlementModalOpen(false)}
        returnCase={settlementTarget}
        payments={payments}
        role="manager"
      />
    </div>
  )
}
