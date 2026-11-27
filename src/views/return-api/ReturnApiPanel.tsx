import ProcessingLeaseBoundary from '../../components/ProcessingLeaseBoundary'
import { recordDisplayCode, receiptDisplayCode } from '../../utils/recordDisplayCode'
import { compareReturnQueue } from '../../utils/returnQueueSort'
import { awaitsCustomerClearance, ClearanceStatus, CustomerClearance, ReturnContract, ReturnPreparation } from './ReturnClearance'
import ReturnAttendance, { requiresReturnAttendance } from './ReturnAttendance'
import { ViolationRecoveryEntry, ViolationRecoveryPanel } from './ViolationRecoveryPanel'
import { listMaintenanceStaff } from '../../services/maintenanceApi'
import { getRental } from '../../services/rentalApi'
import { getCustomerReservation, extendCustomerInventoryReturnWindow, resolveCustomerInventory } from '../../services/customerReservationApi'
import ReturnPolicyNotice from '../../components/ReturnPolicyNotice'
import EmergencyContactsPanel from '../../components/EmergencyContactsPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { FilePreviewList } from '../staff/StaffFileUpload'
import VietnameseDateInput from '../../components/VietnameseDateInput'
import LockInspectionSelect, { lockInspectionLabels } from '../../components/LockInspectionSelect'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { rentalDate, rentalMoney } from '../rental-api/presentation'
import { VIETNAM_TIME_ZONE, vietnamDateInput } from '../../utils/vietnamTime'
import RecoveryReturnSettlement from './RecoveryReturnSettlement'
import RecoveryTaskLink from '../rental-api/RecoveryTaskLink'
import AssignedRecoveryTasks from '../staff/AssignedRecoveryTasks'
import RecoveryTaskDetail from '../rental-api/RecoveryTaskDetail'
import type { NotificationRecordTarget } from '../../services/notificationRecordTarget'
import {
  getReturn,
  confirmReturn,
  extendMismatchReturnWindow,
  feeKeys,
  inspectReturn,
  sanitizeFees,
  listReturns,
  requestReturn,
  updateReturnRequest,
  reviewDispute,
  returnError,
  uploadReturnEvidence,
  calculateDamageFee,
  returnDamageCatalog,
  isCustomFee,
  returnCleaningOptions,
  getReturnFeeScheduleForReturn,
  getReturnFeeDetails,
  type ReturnFeeSchedule,
  type DamagePricingItem,
  type ApiReturn,
  type DamageItemInput,
  type InspectionInput,
  type LockInspectionResult,
  type ReturnFees,
  type ReturnRole,
} from '../../services/returnApi'

const labels: Record<ApiReturn['status'], string> = {
  requested: 'Đã yêu cầu trả kho',
  scheduled: 'Đã hẹn nghiệm thu',
  inspected: 'Đã nghiệm thu',
  awaiting_business_review: 'Chờ Ban điều hành duyệt bảng giá cũ',
  awaiting_customer_confirmation: 'Chờ khách xác nhận',
  disputed: 'Đang khiếu nại - Cần BO giải quyết',
  payment_due: 'Chờ thanh toán quyết toán',
  refund_pending: 'Chờ hoàn cọc',
  recovery_required: 'Cần xử lý khách không đến',
  withdrawn_for_recovery: 'Đã chuyển sang thu hồi',
  completed: 'Đã hoàn tất',
}
const returnStatusOptions: Array<[ApiReturn['status'] | 'all', string]> = [
  ['all', 'Tất cả trạng thái'],
  ['requested', 'Đã yêu cầu trả kho'],
  ['scheduled', 'Đã hẹn nghiệm thu'],
  ['inspected', 'Đã nghiệm thu'],
  ['awaiting_business_review', 'Chờ Ban điều hành duyệt bảng giá cũ'],
  ['awaiting_customer_confirmation', 'Chờ khách xác nhận'],
  ['disputed', 'Đang khiếu nại - Cần BO giải quyết'],
  ['payment_due', 'Chờ thanh toán quyết toán'],
  ['refund_pending', 'Chờ hoàn cọc'],
  ['recovery_required', 'Cần xử lý khách không đến'],
  ['completed', 'Đã hoàn tất'],
]

function returnRecoveryCutoff(value: string | null | undefined) {
  if (!value) return null
  const at = new Date(value)
  return Number.isFinite(at.getTime())
    ? at.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: VIETNAM_TIME_ZONE })
    : null
}
export function returnRecoveryCountdown(value: string | null | undefined, now = Date.now()) {
  if (!value) return null
  const deadline = Date.parse(value)
  if (!Number.isFinite(deadline)) return null
  const remaining = deadline - now
  if (remaining <= 0) return 'Đã quá hạn'
  const totalSeconds = Math.ceil(remaining / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  return `Còn ${days} ngày ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function statusLabel(record: Pick<ApiReturn, 'status' | 'returnType'>) {
  if (record.status === 'awaiting_business_review' && record.returnType === 'INVENTORY_MISMATCH') {
    return 'Chờ quản lý cơ sở duyệt quyết toán'
  }
  if (record.status === 'awaiting_business_review') return 'Chờ Ban điều hành duyệt bảng giá cũ'
  return labels[record.status]
}

export function ReturnSummary({ record, hideTerminationFee = false, hideHeader = false }: { record: ApiReturn; hideTerminationFee?: boolean; hideHeader?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!(['requested', 'scheduled'].includes(record.status) && record.recoveryEligibleAt)) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [record.status, record.recoveryEligibleAt])
  if (record.sourceType === "RECOVERY") return <RecoveryReturnSummary record={record} hideTerminationFee={hideTerminationFee} hideHeader={hideHeader} />
  const inventoryMismatch = record.returnType === 'INVENTORY_MISMATCH'
  const afterInspection = !['requested', 'scheduled', 'recovery_required'].includes(record.status)
  const handoverAppointment = ['requested', 'scheduled'].includes(record.status) ? record.attendance?.handoverAppointmentAt : null
  const showFixedTerminationFee = !hideTerminationFee && !inventoryMismatch
  const badgeClass =
    record.status === 'disputed'
      ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
      : record.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-800'

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h4 className="text-lg font-bold text-stone-900">{record.unitNumber}</h4><p className="mt-1 text-sm text-stone-500">{record.facilityName}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{statusLabel(record)}</span>
          </div>
          {!handoverAppointment && (
            record.returnType === 'INVENTORY_MISMATCH' && record.scheduledAppointmentAt
              ? <p className="text-sm text-stone-600">{'Ngày, giờ hẹn bàn giao: '}<strong className="text-stone-900">{returnRecoveryCutoff(record.scheduledAppointmentAt)}</strong></p>
              : <p className="text-sm text-stone-600">{'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
          )}
        </>
      )}
      {['requested', 'scheduled'].includes(record.status) && record.recoveryEligibleAt && !record.attendance?.arrivedAt && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Nếu khách chưa đến và chưa hoàn tất trả kho, hồ sơ sẽ chuyển sang nhiệm vụ xử lý sau <strong>{returnRecoveryCountdown(record.recoveryEligibleAt, now) || returnRecoveryCutoff(record.recoveryEligibleAt)}</strong>. Hàng chưa được tự động di chuyển.</p>}
      {inventoryMismatch && <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
        <p className="font-bold">Đơn trả kho do kiểm kê sai lệch</p>
        <p className="mt-1">Tính tiền theo số ngày sử dụng thực tế (Đơn giá tháng × Số ngày / 30).</p>
        <p className="mt-1 text-xs font-medium">Khách dọn hàng trong hạn và xác nhận khi sẵn sàng bàn giao.</p>
      </div>}
      {record.status === 'recovery_required' && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950">Khách chưa đến theo lịch và đã hết thời gian ân hạn. Hàng chưa được tự động di chuyển. Cơ sở cần lập biên bản, kiểm kê và bàn giao hai người trước khi thu hồi.</p>}
      {record.status === 'recovery_required' && record.recoveryTaskDeadlineAt && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-950">Hạn xử lý nhiệm vụ thu hồi: {returnRecoveryCutoff(record.recoveryTaskDeadlineAt)}</p>}
      {handoverAppointment && !hideHeader && (
        <p className="text-sm font-medium">Lịch bàn giao sau đối soát · {returnRecoveryCutoff(handoverAppointment)}</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {([
          ['Cọc theo hợp đồng', record.depositAmount],
          ...(afterInspection ? [['Phí đã ghi nhận', record.totalDeductions]] as const : []),
          ...(afterInspection && record.setupEarlyExit ? [['Tiền thuê được hoàn (80%)', record.rentalRefundCredit], ...(showFixedTerminationFee ? [['Khoản giữ lại theo chính sách chuẩn bị (Phí chấm dứt sớm một lần)', record.earlyTerminationFee]] as const : [])] as const : []),
          ...(afterInspection && !record.setupEarlyExit && record.activeReturnPolicy ? [['Tiền thuê các tháng còn lại chưa sử dụng', record.activeReturnPolicy.rentalRefundAmount]] as const : []),
          ...(afterInspection ? [['Khoản hoàn tiền', record.netRefundAmount], ['Khách cần đóng thêm', record.amountDueFromCustomer]] as const : []),
        ] as const).map(([label, amount]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {['requested', 'scheduled'].includes(record.status) && <p className="text-sm text-stone-600">Số tiền quyết toán sẽ được xác định sau nghiệm thu.</p>}
      {record.setupExitRequested && !inventoryMismatch && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{record.setupEarlyExit
          ? hideTerminationFee ? 'Trả trong thời gian chuẩn bị: hoàn 80% tiền thuê sau ưu đãi, giữ lại 20%; tiền cọc đảm bảo quyết toán riêng sau khi trừ hư hỏng theo bảng giá.' : 'Trả trong thời gian chuẩn bị: hệ thống giữ lại 20% tiền thuê sau ưu đãi và hoàn 80%. Hư hỏng trừ vào cọc một tháng; phần vượt cọc được bù vào tiền thuê chưa sử dụng trước khi yêu cầu khách trả thêm.'
          : record.setupReturnedAt ? 'Kho được nghiệm thu sau hạn chuẩn bị, áp dụng quyết toán của kỳ thuê đã bắt đầu.' : 'Nhân viên cần xác nhận đã dọn hết hàng và bàn giao kho trống. Điều khoản thời gian chuẩn bị áp dụng theo thời điểm nghiệm thu thực tế.'}</p>}
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          {record.settlementBlocker}
        </p>
      )}
    </div>
  )
}

function SettlementCalculationBreakdown({ record }: { record: ApiReturn }) {
  const isMismatch = record.returnType === 'INVENTORY_MISMATCH'
  const mismatchUsedDays = record.earlyTerminationPolicy?.billableSetupDays ?? null
  const deposit = record.depositAmount ?? 0
  const feeValues = [record.damageFee, record.cleaningFee, record.lostItemFee, record.overdueFee, record.outstandingFee]
  const totalFees = record.totalDeductions ?? feeValues.reduce((sum, value) => sum + (value || 0), 0)
  const setupExit = !!record.setupEarlyExit
  const useEarlyPolicy = setupExit || isMismatch
  const rentalCredit = useEarlyPolicy
    ? (record.earlyTerminationPolicy?.rentalRefundAmount ?? record.rentalRefundCredit ?? 0)
    : (record.activeReturnPolicy?.rentalRefundAmount ?? record.earlyTerminationPolicy?.rentalRefundAmount ?? 0)
  const usedRental = useEarlyPolicy
    ? (record.earlyTerminationPolicy?.totalRentalCharge ?? record.earlyTerminationFee ?? 0)
    : (record.activeReturnPolicy?.totalRentalCharge ?? record.earlyTerminationPolicy?.totalRentalCharge ?? 0)
  const totalRental = usedRental + rentalCredit
  const activePolicy = record.activeReturnPolicy
  const rentalMonths = record.activeReturnPolicy?.rentalMonths
    ?? record.activeReturnPolicy?.pricingTierMonths
    ?? null
  // The current API may come from an older BE that does not yet include
  // monthlyPrice/rentalMonths. In that case, the active-return rule charges
  // the first started month in full, so the used month count is authoritative.
  const usedMonthsFromPolicy = !isMismatch && !setupExit && activePolicy
    ? Math.max(1, activePolicy.completedRentalMonths + 1)
    : null
  // The security deposit is one effective monthly rent in the contract.
  // This keeps older return responses readable while the BE starts returning
  // the explicit discounted monthly price.
  const monthlyPrice = record.activeReturnPolicy?.monthlyPrice
    ?? (deposit > 0
      ? deposit
      : rentalMonths && rentalMonths > 0
        ? totalRental / rentalMonths
        : null)
  const usedMonths = isMismatch ? null : (usedMonthsFromPolicy
    ?? (monthlyPrice && monthlyPrice > 0 && usedRental > 0
      ? Math.max(1, Math.round(usedRental / monthlyPrice))
      : null))
  const remainingMonths = !isMismatch && !setupExit && monthlyPrice && monthlyPrice > 0 && rentalCredit > 0
    ? Math.max(0, Math.round(rentalCredit / monthlyPrice))
    : null
  const displayRentalMonths = rentalMonths && rentalMonths > 0
    ? rentalMonths
    : usedMonths != null && remainingMonths != null ? usedMonths + remainingMonths : null
  const depositAfterFees = deposit - totalFees
  const refundableDeposit = Math.max(0, depositAfterFees)
  const depositShortfall = Math.max(0, -depositAfterFees)
  const rentalRefundAfterOffset = Math.max(0, rentalCredit - depositShortfall)
  const calculatedRefund = refundableDeposit + rentalRefundAfterOffset
  const calculatedDue = Math.max(0, depositShortfall - rentalCredit)
  const storedAmount = record.netRefundAmount ?? null
  const hasDifference = record.status !== 'requested' && storedAmount != null && Math.abs(storedAmount - calculatedRefund) >= 0.01
  const formulaClass = 'mt-1 text-xs font-normal leading-5 text-stone-500'

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-stone-700">Tính toán theo báo giá và bảng kê</p>

      <div className="space-y-2.5 rounded-xl border border-stone-200 bg-white p-4">
        {!setupExit && usedMonths != null && remainingMonths != null && (
          <>
            <div className="flex justify-between gap-4 rounded-lg bg-amber-50 px-3 py-2 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-amber-900">Thời gian đã sử dụng</span>
                <p className="mt-0 text-xs leading-4 text-amber-800">Số tháng đã bắt đầu tính tiền thuê.</p>
              </div>
              <span className="shrink-0 text-right font-mono text-amber-900">{usedMonths} tháng</span>
            </div>
            <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-emerald-900">Thời gian còn lại</span>
                <p className="mt-0 text-xs leading-4 text-emerald-800">{usedMonths} tháng đã sử dụng + {remainingMonths} tháng còn lại = {displayRentalMonths} tháng.</p>
              </div>
              <span className="shrink-0 text-right font-mono text-emerald-900">{remainingMonths} tháng</span>
            </div>
          </>
        )}

        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <div>
            <span className="font-semibold text-stone-800">Tiền cọc đảm bảo</span>
            <p className={formulaClass}>1 × đơn giá tháng = {rentalMoney(deposit, 'VND')}.</p>
          </div>
          <span className="shrink-0 font-mono text-sm text-stone-900">+ {rentalMoney(deposit, 'VND')}</span>
        </div>

        <div className="flex justify-between gap-4 text-xs sm:text-sm">
          <div>
            <span className="font-semibold text-stone-800">Chi phí phát sinh</span>
            <p className={formulaClass}>Hư hỏng + vệ sinh + mất đồ + quá hạn + còn thiếu = {rentalMoney(totalFees, 'VND')}.</p>
          </div>
          <span className="shrink-0 font-mono text-sm text-rose-700">− {rentalMoney(totalFees, 'VND')}</span>
        </div>

        <div className={`flex justify-between gap-4 rounded-lg px-3 py-2 text-xs sm:text-sm ${depositAfterFees >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
          <div>
            <span className="font-semibold">{depositAfterFees >= 0 ? 'Phí hoàn đảm bảo sau phát sinh' : 'Khoản phí còn thiếu sau khi trừ tiền cọc'}</span>
            <p className="mt-0 text-xs leading-4 opacity-80">{rentalMoney(deposit, 'VND')} − {rentalMoney(totalFees, 'VND')} = {rentalMoney(depositAfterFees, 'VND')}.</p>
          </div>
          <span className="shrink-0 font-mono font-bold">{depositAfterFees >= 0 ? `+ ${rentalMoney(refundableDeposit, 'VND')}` : rentalMoney(depositAfterFees, 'VND')}</span>
        </div>

        {isMismatch ? (
          <>
            <div className="flex justify-between gap-4 rounded-lg bg-amber-50 px-3 py-2 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-amber-900">Thời gian sử dụng thực tế</span>
                <p className="mt-0 text-xs leading-4 text-amber-800">Tính theo ngày lịch từ ngày đưa hàng vào kho đến ngày bàn giao kho trống, tính cả hai ngày (không cộng ngày chậm thu hồi sau hạn).</p>
              </div>
              <span className="shrink-0 text-right font-mono text-amber-900">{mismatchUsedDays != null ? `${mismatchUsedDays} ngày` : 'Chờ xác nhận'}</span>
            </div>

            <div className="flex justify-between gap-4 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-stone-800">Tiền thuê theo kỳ đã chốt</span>
                <p className={formulaClass}>Tổng tiền thuê đã thanh toán theo báo giá.</p>
              </div>
              <span className="shrink-0 font-mono text-sm text-stone-900">{rentalMoney(totalRental, 'VND')}</span>
            </div>

            <div className="flex justify-between gap-4 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-stone-800">Tiền sử dụng theo ngày</span>
                <p className={formulaClass}>
                  {monthlyPrice != null && mismatchUsedDays != null
                    ? `${rentalMoney(monthlyPrice, 'VND')} × ${mismatchUsedDays} ngày / 30 = ${rentalMoney(usedRental, 'VND')}.`
                    : 'Đơn giá tháng × số ngày sử dụng / 30.'}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm text-rose-700">− {rentalMoney(usedRental, 'VND')}</span>
            </div>

            <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 sm:text-sm">
              <div>
                <span className="font-semibold">Tiền thuê còn lại được hoàn</span>
                <p className="mt-0 text-xs font-normal leading-4 text-emerald-700">{rentalMoney(totalRental, 'VND')} − {rentalMoney(usedRental, 'VND')} = {rentalMoney(rentalCredit, 'VND')}.</p>
              </div>
              <span className="shrink-0 font-mono font-bold">+ {rentalMoney(rentalCredit, 'VND')}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-stone-800">Đơn giá mỗi tháng sau giảm giá</span>
                <p className={formulaClass}>
                  {monthlyPrice != null && usedMonths != null
                    ? `${rentalMoney(usedRental, 'VND')} ÷ ${usedMonths} tháng đã sử dụng = ${rentalMoney(monthlyPrice, 'VND')}.`
                    : 'Theo đơn giá sau giảm giá trong báo giá đã chốt.'}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm text-stone-900">
                {monthlyPrice == null ? 'Chưa xác định' : rentalMoney(monthlyPrice, 'VND')}
              </span>
            </div>

            <div className="flex justify-between gap-4 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-stone-800">Tiền thuê theo kỳ đã chốt</span>
                <p className={formulaClass}>
                  {monthlyPrice != null && displayRentalMonths
                    ? `${rentalMoney(monthlyPrice, 'VND')} × ${displayRentalMonths} tháng = ${rentalMoney(totalRental, 'VND')}.`
                    : `Tiền đã sử dụng/giữ lại ${rentalMoney(usedRental, 'VND')} + tiền thuê các tháng còn lại chưa sử dụng ${rentalMoney(rentalCredit, 'VND')} = ${rentalMoney(totalRental, 'VND')}.`}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm text-stone-900">{rentalMoney(totalRental, 'VND')}</span>
            </div>

            <div className="flex justify-between gap-4 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-stone-800">Tiền thuê số tháng đã sử dụng</span>
                <p className={formulaClass}>{monthlyPrice != null && usedMonths != null ? `${rentalMoney(monthlyPrice, 'VND')} × ${usedMonths} tháng = ${rentalMoney(usedRental, 'VND')}.` : 'Theo số tiền thuê đã ghi nhận.'}</p>
              </div>
              <span className="shrink-0 font-mono text-sm text-stone-900">{rentalMoney(usedRental, 'VND')}</span>
            </div>

            <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 sm:text-sm">
              <div>
                <span className="font-semibold">Tiền thuê số tháng còn lại được hoàn</span>
                <p className="mt-0 text-xs font-normal leading-4 text-emerald-700">
                  {remainingMonths != null && monthlyPrice != null
                    ? `${rentalMoney(totalRental, 'VND')} − ${rentalMoney(usedRental, 'VND')} = ${remainingMonths} tháng × ${rentalMoney(monthlyPrice, 'VND')} = ${rentalMoney(rentalCredit, 'VND')}.`
                    : `${rentalMoney(totalRental, 'VND')} − ${rentalMoney(usedRental, 'VND')} = ${rentalMoney(rentalCredit, 'VND')}.`}
                </p>
              </div>
              <span className="shrink-0 font-mono font-bold">+ {rentalMoney(rentalCredit, 'VND')}</span>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl bg-stone-900 p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Kết quả quyết toán</p>
            <p className="text-xs leading-5 text-stone-300">Tiền hoàn = phí hoàn cọc sau phát sinh + tiền thuê còn lại sau bù trừ.</p>
          </div>
          <span className="shrink-0 font-mono text-xl font-bold">{rentalMoney(calculatedRefund, 'VND')}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-300">
          {depositAfterFees >= 0
            ? `${rentalMoney(refundableDeposit, 'VND')} + ${rentalMoney(rentalCredit, 'VND')} = ${rentalMoney(calculatedRefund, 'VND')}.`
            : `${rentalMoney(rentalCredit, 'VND')} − ${rentalMoney(depositShortfall, 'VND')} = ${rentalMoney(calculatedRefund, 'VND')}.`}
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-300">
          Tổng phí khấu trừ = {feeValues.map((value) => rentalMoney(value || 0, 'VND')).join(' + ')} = {rentalMoney(totalFees, 'VND')}.
        </p>
        {depositShortfall > 0 && (
          <p className="mt-1 text-xs leading-5 text-stone-300">
            Phí phát sinh vượt tiền cọc {rentalMoney(depositShortfall, 'VND')}; đã dùng tiền thuê còn lại để bù trừ {rentalMoney(Math.min(rentalCredit, depositShortfall), 'VND')}.
          </p>
        )}
      </div>

      {calculatedDue > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold">Khách cần đóng thêm</p>
              <p className="mt-1 text-xs leading-5">Phí khấu trừ vượt quá các khoản tiền có thể bù trừ.</p>
            </div>
            <span className="shrink-0 font-mono font-bold">{rentalMoney(calculatedDue, 'VND')}</span>
          </div>
        </div>
      )}

      {hasDifference && (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-900">
          Số tiền đang lưu trong bảng kê là {rentalMoney(storedAmount, 'VND')}, khác số tính lại {rentalMoney(calculatedRefund, 'VND')}. Cần đồng bộ lại quyết toán trước khi hoàn tiền.
        </p>
      )}
    </div>
  )
}

function RecoveryReturnSummary({ record, hideTerminationFee, hideHeader = false }: { record: ApiReturn; hideTerminationFee: boolean; hideHeader?: boolean }) {
  const awaitingInspection = !record.inspectedAt && ['requested', 'scheduled'].includes(record.status)
  const badgeClass =
    record.status === 'disputed'
      ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
      : record.status === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-800'

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h4 className="text-lg font-bold text-stone-900">{record.unitNumber}</h4><p className="mt-1 text-sm text-stone-500">{record.facilityName}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{record.sourceType === 'RECOVERY' && record.status === 'completed' ? record.recoveryTaskStatus === 'CLOSED' ? 'Đã hoàn tất thu hồi' : 'Quyết toán xong, chờ thu hồi' : (record.status === "refund_pending" ? "Chờ hoàn tiền quyết toán" : labels[record.status])}</span>
          </div>
          <p className="text-sm text-stone-600">{record.sourceType === 'RECOVERY' ? 'Hồ sơ từ thu hồi kho - Ngày kiểm kê: ' : 'Ngày dự kiến trả: '}<strong className="text-stone-900">{rentalDate(record.scheduledDate)}</strong></p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {([
          ['Tiền cọc đảm bảo thuê thực thu', record.depositAmount, false], ['Phí đã ghi nhận', record.totalDeductions, awaitingInspection],
          ...(record.setupEarlyExit ? [['Tiền thuê được hoàn (80%)', record.rentalRefundCredit, false], ...(!hideTerminationFee ? [[(record.returnType === 'INVENTORY_MISMATCH' ? 'Khoản giữ lại theo chính sách chuẩn bị' : 'Khoản giữ lại theo chính sách chuẩn bị (Phí chấm dứt sớm một lần)'), record.earlyTerminationFee, false]] as const : [])] as const : []),
          ...(!record.setupEarlyExit && record.activeReturnPolicy ? [['Tiền thuê các tháng còn lại chưa sử dụng', record.activeReturnPolicy.rentalRefundAmount, false]] as const : []),
          ['Khoản hoàn tiền', record.netRefundAmount, awaitingInspection], ['Khách cần đóng thêm', record.amountDueFromCustomer, awaitingInspection],
        ] as const).map(([label, amount, pendingInspection]) => <div key={label} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-sm font-bold text-stone-900">{amount == null ? 'Chưa xác định' : pendingInspection ? 'Chờ nghiệm thu' : rentalMoney(amount, 'VND')}</p></div>)}
      </div>
      {record.setupExitRequested && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{record.setupEarlyExit
          ? hideTerminationFee ? 'Trả trong thời gian chuẩn bị: hoàn 80% tiền thuê sau ưu đãi, giữ lại 20%; tiền cọc đảm bảo quyết toán riêng sau khi trừ hư hỏng theo bảng giá.' : 'Trả trong thời gian chuẩn bị: hệ thống giữ lại 20% tiền thuê sau ưu đãi và hoàn 80%. Hư hỏng trừ vào cọc một tháng; phần vượt cọc được bù vào tiền thuê chưa sử dụng trước khi yêu cầu khách trả thêm.'
        : record.setupReturnedAt ? 'Kho được nghiệm thu sau hạn chuẩn bị, áp dụng quyết toán của kỳ thuê đã bắt đầu.' : 'Nhân viên cần xác nhận đã dọn hết hàng và bàn giao kho trống. Điều khoản thời gian chuẩn bị áp dụng theo thời điểm nghiệm thu thực tế.'}</p>}
      {record.settlementBlocker && (
        <p role="status" className="rounded bg-amber-50 p-3">
          {record.settlementBlocker}
        </p>
      )}
    </div>
  )
}

export default function ReturnApiPanel({
  role,
  rentalId,
  notificationTarget,
  rentalActive = false,
  onChanged,
}: {
  role: ReturnRole
  rentalId?: string
  notificationTarget?: NotificationRecordTarget
  rentalActive?: boolean
  onChanged?: () => void
}) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${rentalId ?? ''}`
  return (
    <ReturnWorkspace
      key={`${identity}:${notificationTarget?.kind ?? ''}:${notificationTarget?.id ?? ''}`}
      role={role}
      rentalId={rentalId}
      notificationTarget={notificationTarget}
      rentalActive={rentalActive}
      onChanged={onChanged}
      identity={identity}
    />
  )
}

function ReturnWorkspace({
  role,
  rentalId,
  notificationTarget,
  rentalActive,
  onChanged,
  identity,
}: {
  role: ReturnRole
  rentalId?: string
  notificationTarget?: NotificationRecordTarget
  rentalActive: boolean
  onChanged?: () => void
  identity: string
}) {
  const actor = getAuthenticatedActor()
  const contract = useRentalApiResource(identity, async () => role === 'customer' && rentalId ? getRental('customer', rentalId) : null)
  const mismatch = Boolean(contract.data?.inventoryMismatchReturn || (contract.data?.inventory?.mismatch && !contract.data.inventory.fullFit)
    || contract.data?.inventory?.decision === 'RETURN_REQUESTED')
  const reservationId = contract.data?.reservationId
  const removal = useRentalApiResource(`${identity}:removal:${mismatch}:${reservationId}`, async () =>
    mismatch && reservationId ? getCustomerReservation(reservationId) : null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!mismatch) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [mismatch])
  const [sort, setSort] = useState<'priority' | 'createdAt,desc' | 'createdAt,asc'>('priority')
  const [page, setPage] = useState(0)
  const [directReturnId, setDirectReturnId] = useState(notificationTarget?.kind === 'return' ? notificationTarget.id : undefined)
  const directReturn = useRentalApiResource(`${identity}:return-detail:${directReturnId}`,
    async () => directReturnId ? getReturn(role, directReturnId) : null, { retainDataOnRefresh: true })
  const read = useRentalApiResource(`${identity}:${page}:${sort}`, async () => {
    if (!rentalId) return listReturns(role, page, 20, sort)
    const first = await listReturns(role, 0, 100)
    const data = [...first.data]
    for (let next = 1; next < first.pagination.totalPages; next++) data.push(...(await listReturns(role, next, 100)).data)
    return { ...first, data }
  }, { retainDataOnRefresh: true })
  useEffect(() => {
    if (role !== 'staff') return
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') read.refresh()
    }
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () => document.removeEventListener('visibilitychange', refreshOnReturn)
  }, [role, read.refresh])
  const [busy, setBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const recoveryLock = useRef(false)
  const recoveryLocks = useRef(new Set<string>())
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [feedback, setFeedback] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!mismatch) return
    const summary = removal.data?.inventoryMismatchSummary || contract.data?.inventory?.mismatchSummary
    setNotes(current => current || `Trả kho do kiểm kê sai lệch${summary ? `: ${summary}` : '.'}`)
  }, [mismatch, removal.data?.inventoryMismatchSummary, contract.data?.inventory?.mismatchSummary])
  const [editing, setEditing] = useState<string | null>(null)
  const [listMode, setListMode] = useState<'returns' | 'recovery'>(
    notificationTarget?.kind === 'recovery-task' || notificationTarget?.kind === 'violation-recovery' ? 'recovery' : 'returns')
  const [recoveryTaskId, setRecoveryTaskId] = useState(notificationTarget?.kind === 'recovery-task' ? notificationTarget.id : undefined)
  const [violationTarget, setViolationTarget] = useState(notificationTarget?.kind === 'violation-recovery'
    ? { id: notificationTarget.id, request: 0 } : undefined)
  const recoveryTaskGuard = useRef<() => boolean>(() => false)
  const today = vietnamDateInput()

  async function run(work: () => Promise<unknown>) {
    if (lock.current || recoveryLock.current) return
    lock.current = true
    setBusy(true)
    setFeedback('')
    try {
      await work()
      if (!mounted.current || getAuthenticatedActor()?.id !== actor?.id) return
      setEditing(null)
      read.refresh()
      if (directReturnId) directReturn.refresh()
      onChanged?.()
    } catch (error) {
      if (mounted.current) {
        setFeedback(returnError(error))
        read.refresh()
        if (directReturnId) directReturn.refresh()
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  function extendRemovalWindow(returnRecord?: ApiReturn) {
    if (returnRecord?.returnType === 'INVENTORY_MISMATCH') {
      void run(async () => {
        await extendMismatchReturnWindow(returnRecord.id, returnRecord.returnVersion, crypto.randomUUID())
        if (mounted.current) {
          removal.refresh()
          contract.refresh()
        }
      })
      return
    }
    if (!reservationId) return
    void run(async () => {
      await extendCustomerInventoryReturnWindow(reservationId)
      if (mounted.current) {
        removal.refresh()
        contract.refresh()
      }
    })
  }

  const rows = useMemo(() => {
    const records = read.data?.data.filter((item) => !rentalId || item.rentalId === rentalId) ?? []
    if (role === 'staff' && !rentalId) {
      // The API ranks the entire staff queue before pagination. Re-sorting one page
      // would put a later appointment ahead of a customer already waiting on another page.
      return records
    }
    return records.sort((left, right) => compareReturnQueue(left, right, role))
  }, [read.data, rentalId, role, today])

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_inspection' | 'review' | 'settlement' | 'completed'>('all')
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false)

  // Automatically select record if exactly 1 record is present (e.g. within a specific rental's context)
  useEffect(() => {
    if (rentalId && rows.length > 0 && !selectedRecordId) {
      setSelectedRecordId(rows[0].id)
      setFeedback('')
    }
  }, [rentalId, rows, selectedRecordId])

  const selectedRecord = useMemo(() => {
    if (directReturnId) return directReturn.data ?? null
    return selectedRecordId ? rows.find((r) => r.id === selectedRecordId) ?? null : null
  }, [rows, selectedRecordId, directReturnId, directReturn.data])

  const counts = useMemo(() => {
    const pending = rows.filter((r) => ['requested', 'scheduled'].includes(r.status)).length
    const review = rows.filter((r) => ['inspected', 'awaiting_business_review', 'awaiting_customer_confirmation', 'disputed'].includes(r.status)).length
    const settlement = rows.filter((r) => ['payment_due', 'refund_pending'].includes(r.status)).length
    const completed = rows.filter((r) => r.status === 'completed').length
    return { all: rows.length, pending, review, settlement, completed }
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'pending_inspection' && !['requested', 'scheduled'].includes(r.status)) return false
      if (statusFilter === 'review' && !['inspected', 'awaiting_business_review', 'awaiting_customer_confirmation', 'disputed'].includes(r.status)) return false
      if (statusFilter === 'settlement' && !['payment_due', 'refund_pending'].includes(r.status)) return false
      if (statusFilter === 'completed' && r.status !== 'completed') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchUnit = r.unitNumber.toLowerCase().includes(q)
        const matchFacility = r.facilityName.toLowerCase().includes(q)
        const matchCustomer = (r.customerName || '').toLowerCase().includes(q)
        const matchNotes = (r.customerNotes || '').toLowerCase().includes(q)
        const matchCode = [r.displayCode, r.rentalDisplayCode, recordDisplayCode(r.id), recordDisplayCode(r.rentalId)].some(code => code?.toLowerCase().includes(q))
        if (!matchCode && !matchUnit && !matchFacility && !matchCustomer && !matchNotes) return false
      }
      return true
    })
  }, [rows, statusFilter, searchQuery])

  const pendingMismatch = role === 'customer' && selectedRecord?.returnType === 'INVENTORY_MISMATCH'
    && ['requested', 'scheduled'].includes(selectedRecord.status) && selectedRecord.sourceType !== 'RECOVERY'

  const readable = actor?.status === 'ACTIVE' && (
    actor.roles.includes(role.toUpperCase() as 'CUSTOMER' | 'STAFF' | 'MANAGER') ||
    (role === 'manager' && (actor.roles.includes('BUSINESS') || actor.roles.includes('ADMIN')))
  )

  if (!readable) return null


  if (directReturnId && !selectedRecord) return directReturn.error
    ? <div className="space-y-3"><p role="alert">{returnError(directReturn.error)}</p>
        <Button onClick={directReturn.refresh}>Thử lại</Button>
        {role !== 'customer' && <Button variant="outline" onClick={() => setDirectReturnId(undefined)}>Về danh sách</Button>}</div>
    : <p role="status">Đang tải hồ sơ trả kho…</p>

  if (role === 'customer' && rentalId && !selectedRecord) {
    if (read.loading && !read.data) return <p role="status">Đang tải thông tin trả kho…</p>
    if (read.error) return <p role="alert">{returnError(read.error)}</p>
    if (rows.length) return null
    if (!rentalActive) return <p className="text-sm text-stone-600">Hồ sơ thuê hiện chưa thể gửi yêu cầu trả kho.</p>

    const minReturnDate = vietnamDateInput(new Date(Date.now() + 86_400_000))
    const deadline = removal.data?.inventoryRemovalDeadlineAt || contract.data?.inventory?.removalDeadline
    const expired = mismatch && Boolean(deadline && now >= Date.parse(deadline))
    const invalidDate = !mismatch && (!date || date < minReturnDate)
    const removalUnavailable = mismatch && (removal.loading || !!removal.error || !deadline || !reservationId)
    return <div className="space-y-3">
      <form onSubmit={(event) => {
        event.preventDefault()
        if (busy || removalUnavailable || expired || invalidDate) return
        if (mismatch && reservationId) {
          void run(() => resolveCustomerInventory(reservationId, 'CANCEL_AND_RETURN', notes))
        } else {
          void run(() => requestReturn(rentalId, date, notes))
        }
      }} className="space-y-4">
        {contract.data ? <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong className="break-all text-sm text-stone-900">{contract.data.storageUnit.code}</strong>
          <span className="text-sm text-stone-600">{contract.data.facility.name}</span>
        </div> : <p role={contract.error ? 'alert' : 'status'}>{contract.error ? returnError(contract.error) : 'Đang tải thông tin hợp đồng…'}</p>}
        {mismatch && <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {deadline && <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p>Hạn cuối dọn hàng · <strong>{returnRecoveryCutoff(deadline)}</strong></p>
            <p role="timer" className="tabular-nums">{returnRecoveryCountdown(deadline, now)}</p>
          </div>}
          {removal.loading && <p role="status">Đang tải hạn dọn hàng…</p>}
          {!!removal.error && <><p role="alert">{returnError(removal.error)}</p><Button type="button" variant="outline" onClick={removal.refresh}>Tải lại hạn dọn hàng</Button></>}
          {!removal.loading && !removal.error && !deadline && <p role="alert">Chưa xác định được hạn dọn hàng. Vui lòng liên hệ cơ sở.</p>}
          {removal.data && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-amber-200 pt-2">
            <p>Đã gia hạn {removal.data.inventoryReturnExtensionCount ?? 0}/2 lần{removal.data.inventoryReturnExtensionDays ? ` · Mỗi lần thêm ${removal.data.inventoryReturnExtensionDays} ngày` : ''}.</p>
            {removal.data.inventoryReturnCanExtend && !expired
              ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => extendRemovalWindow()}>{busy ? 'Đang xử lý…' : 'Gia hạn dọn hàng'}</Button>
              : <p>{expired ? 'Đã hết hạn dọn hàng. Vui lòng liên hệ cơ sở để xử lý.'
                : (removal.data.inventoryReturnExtensionCount ?? 0) >= 2 ? 'Đã sử dụng hết 2 lượt gia hạn.'
                : 'Hồ sơ không còn đủ điều kiện gia hạn.'}</p>}
          </div>}
        </section>}
        <p className="text-sm leading-5 text-stone-600">Dọn hết hàng rồi xác nhận trong hồ sơ trả kho. Khoản hoàn hoặc thu thêm được xác định sau nghiệm thu.</p>
        {!mismatch && <VietnameseDateInput label="Ngày hẹn trả kho" value={date} min={minReturnDate} onChange={setDate} />}
        <label className="block text-sm font-medium text-stone-700">Lý do<textarea required rows={2} placeholder="Nhập lý do trả kho…" value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-3 font-normal" /></label>
        <div className="space-y-2">
          {contract.data && <details className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-stone-800">Thông tin hợp đồng</summary>
            <div className="mt-2"><ReturnContract rental={contract.data} date={date} depositAmount={removal.data?.reservation.securityDepositAmount} reservationCode={removal.data?.reservation.reservationCode} inventoryMismatch={mismatch} /></div>
          </details>}
          <ReturnPolicyNotice />
        </div>
        <div className="flex justify-end border-t border-stone-200 pt-3">
          <Button type="submit" disabled={busy || invalidDate || expired || removalUnavailable || !notes.trim() || read.loading || contract.loading || !contract.data}>Gửi yêu cầu trả kho</Button>
        </div>
      </form>
      {feedback && <p role="status">{feedback}</p>}
    </div>
  }

  return (
    <div className={rentalId ? 'space-y-4' : 'space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs'}>
      {/* ─── FOCUSED DETAIL WORKSPACE (When a record is selected) ─── */}
      {selectedRecord ? (
        <div className="space-y-4 fade-in">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono font-extrabold text-stone-900 text-sm sm:text-base bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">
                {selectedRecord.unitNumber}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-stone-600">
                {selectedRecord.facilityName}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                selectedRecord.status === 'disputed'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : selectedRecord.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : selectedRecord.status === 'refund_pending'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : selectedRecord.status === 'payment_due'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {labels[selectedRecord.status]}
              </span>
              {role !== 'customer' && selectedRecord.customerName && (
                <span className="text-xs text-stone-700">
                  Khách: <strong className="font-bold text-stone-900">{selectedRecord.customerName}</strong>
                </span>
              )}
              {!pendingMismatch && selectedRecord.customerNotes && (
                <span className="text-xs text-stone-600 italic">
                  Lý do: &ldquo;{selectedRecord.customerNotes}&rdquo;
                </span>
              )}
              {(selectedRecord.attendance?.handoverAppointmentAt || selectedRecord.scheduledAppointmentAt || selectedRecord.scheduledDate) && <span className="text-xs text-stone-500">
                {selectedRecord.attendance?.handoverAppointmentAt ? <>
                  Lịch bàn giao sau đối soát · <strong className="text-stone-700">{returnRecoveryCutoff(selectedRecord.attendance.handoverAppointmentAt)}</strong>
                </> : selectedRecord.scheduledAppointmentAt ? <>
                  Lịch hẹn bàn giao · <strong className="text-stone-700">{returnRecoveryCutoff(selectedRecord.scheduledAppointmentAt)}</strong>
                </> : <>Ngày hẹn trả · <strong className="text-stone-700">{rentalDate(selectedRecord.scheduledDate)}</strong></>}
              </span>}
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {!rentalId && role !== 'customer' && (
              <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedRecordId(null); setDirectReturnId(undefined) }} className="font-semibold text-xs border-stone-300 text-stone-700 hover:bg-stone-50">
                ← Quay lại danh sách hồ sơ
              </Button>
            )}
            {role !== 'customer' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEmergencyModalOpen(true)}
                className="shrink-0 text-xs font-semibold text-stone-700 border-stone-300 bg-white hover:bg-stone-50"
              >
                Liên hệ khẩn cấp
              </Button>
            )}
            </div>
          </div>

          {feedback && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{feedback}</p>}
          {role === 'customer' && selectedRecord.sourceType !== 'RECOVERY' && <>
            <CustomerClearance record={selectedRecord} ownerId={actor?.id} busy={busy || read.loading}
              run={async work => {
                await run(async () => {
                  const updated = await work()
                  if (mounted.current && selectedRecord.returnType === 'INVENTORY_MISMATCH') {
                    removal.refresh()
                    contract.refresh()
                  }
                  return updated
                })
              }}
              countdown={pendingMismatch ? returnRecoveryCountdown(selectedRecord.inventoryRemovalDeadlineAt ?? selectedRecord.recoveryEligibleAt, now) : undefined}
              extension={pendingMismatch ? {
                count: selectedRecord.returnExtensionCount ?? removal.data?.inventoryReturnExtensionCount ?? 0,
                onExtend: selectedRecord.canExtendReturnWindow !== false
                  && (selectedRecord.returnExtensionCount ?? removal.data?.inventoryReturnExtensionCount ?? 0) < (selectedRecord.maxReturnExtensions ?? 2)
                  && Date.parse(selectedRecord.inventoryRemovalDeadlineAt ?? removal.data?.inventoryRemovalDeadlineAt ?? '') > now
                  && !selectedRecord.attendance?.arrivedAt
                  && !selectedRecord.attendance?.lateArrivalClaimedAt
                  && selectedRecord.attendance?.reviewStatus !== 'PENDING'
                  ? () => extendRemovalWindow(selectedRecord) : undefined,
              } : undefined} />
            {contract.data && <details className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-semibold text-stone-800">Thông tin hợp đồng</summary>
              <div className="mt-2"><ReturnContract rental={contract.data} record={selectedRecord} /></div>
            </details>}
          </>}
          {role === 'staff' && actor?.permissions.includes('returns:process') && awaitsCustomerClearance(selectedRecord) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p role="status" className="text-sm text-amber-900">Chờ khách xác nhận đã dọn kho để nghiệm thu.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={read.loading} onClick={read.refresh}>Kiểm tra lại</Button>
                <Button type="button" disabled>Ghi nhận kết quả nghiệm thu</Button>
              </div>
            </div>
          )}
          {/* Form Actions / 2-Column Inspection */}
          {role === 'staff' && <ReturnAttendance key={selectedRecord.id} record={selectedRecord} role="staff"
            editable={!!actor?.permissions.includes('returns:process')} onChanged={read.refresh} />}
          {pendingMismatch ? <details className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-stone-800">Lý do trả kho và quyết toán</summary>
            <div className="mt-2 space-y-2 text-stone-700">
              {selectedRecord.customerNotes && <p className="whitespace-pre-wrap break-words">{selectedRecord.customerNotes}</p>}
              <p>Tiền sử dụng tính theo số ngày thực tế. Khoản hoàn hoặc thu thêm được xác định sau nghiệm thu.</p>
            </div>
          </details> : (role !== 'staff' || !requiresReturnAttendance(selectedRecord) || (!!selectedRecord.attendance?.arrivedAt && !!selectedRecord.attendance.verifiedAt)) && <LeasedReturnActions
            key={selectedRecord.id + ":" + (selectedRecord.clearanceRevision ?? 0) + ":" + (selectedRecord.settlementVersion ?? 0)}
            role={role}
            record={selectedRecord}
            run={run}
            busy={busy || read.loading || (recoveryBusy && !recoveryLocks.current.has(selectedRecord.id))}
            recoveryLocked={recoveryBusy}
            onRecoveryLocked={value => {
              if (value) recoveryLocks.current.add(selectedRecord.id)
              else recoveryLocks.current.delete(selectedRecord.id)
              recoveryLock.current = recoveryLocks.current.size > 0
              setRecoveryBusy(recoveryLock.current)
            }}
            onRecoveryChanged={() => {
              setFeedback('Đã cập nhật hồ sơ trả kho.')
              read.refresh()
              if (directReturnId) directReturn.refresh()
              onChanged?.()
            }}
          />}


          {role === 'customer' && !selectedRecord.attendance?.arrivedAt && selectedRecord.returnType !== 'INVENTORY_MISMATCH' && selectedRecord.status === 'requested' && editing !== selectedRecord.id && (
            <div className="mt-3 flex justify-end border-t border-stone-100 pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy || read.loading}
                onClick={() => {
                  const minNext = vietnamDateInput(Date.now() + 86_400_000)
                  setEditing(selectedRecord.id)
                  setDate(selectedRecord.scheduledDate && selectedRecord.scheduledDate >= minNext ? selectedRecord.scheduledDate : '')
                  setNotes(selectedRecord.customerNotes || '')
                }}
              >
                Chỉnh sửa yêu cầu
              </Button>
            </div>
          )}

          {role === 'customer' && selectedRecord.returnType !== 'INVENTORY_MISMATCH' && editing === selectedRecord.id && (() => {
            const minReturnDate = vietnamDateInput(Date.now() + 86_400_000)
            const tooEarly = Boolean(date && date < minReturnDate)
            return (
              <form onSubmit={(event) => {
                event.preventDefault()
                if (!date || tooEarly) {
                  setFeedback('Ngày hẹn trả kho phải sau ngày tạo đơn trả kho ít nhất 1 ngày.')
                  return
                }
                void run(() => updateReturnRequest(selectedRecord.id, date, notes))
              }} className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm font-bold text-stone-900">Chọn lịch hẹn trả kho dự kiến</p>
                <div>
                  <VietnameseDateInput label="Ngày hẹn trả kho dự kiến" value={date} min={minReturnDate} onChange={setDate} />
                  {tooEarly && <p className="mt-1 text-xs font-semibold text-rose-600">Ngày hẹn trả kho phải sau ngày tạo đơn trả kho ít nhất 1 ngày.</p>}
                </div>
                <label className="block text-sm font-medium text-stone-700">Lý do / ghi chú
                  <textarea required rows={2} value={notes} maxLength={2000} disabled={busy} onChange={(event) => setNotes(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2.5 text-sm font-normal" />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>Hủy</Button>
                  <Button type="submit" disabled={busy || !date || tooEarly || !notes.trim()}>Lưu lịch hẹn trả kho</Button>
                </div>
              </form>
            )
          })()}

          {/* Emergency contacts modal */}
          {emergencyModalOpen && selectedRecord.rentalId && (
            <Modal open={emergencyModalOpen} onClose={() => setEmergencyModalOpen(false)} title="Thông tin người liên hệ khẩn cấp" size="lg">
              <div className="p-1">
                <EmergencyContactsPanel rentalId={selectedRecord.rentalId} />
              </div>
            </Modal>
          )}
        </div>
      ) : (
        /* ─── MASTER LIST VIEW (When no record is selected) ─── */
        <div className="space-y-4">
          {role !== 'customer' && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={listMode === 'returns' ? 'primary' : 'outline'}
                onClick={() => setListMode('returns')}
              >
                Danh sách hồ sơ trả kho &amp; quyết toán
              </Button>
              <Button
                type="button"
                size="sm"
                variant={listMode === 'recovery' ? 'primary' : 'outline'}
                onClick={() => setListMode('recovery')}
              >
                Thu hồi kho
              </Button>
            </div>
          )}
          {role !== 'customer' && listMode === 'recovery' ? (
            <>
              <ViolationRecoveryPanel key={violationTarget?.id ?? 'list'} target={violationTarget}
                compact={role === 'staff'} allowDateSort={role === 'staff'} leadingCards={role === 'staff' ? <AssignedRecoveryTasks identity={identity} /> : undefined}
                detailOnly={!!violationTarget} onDetailClosed={() => setViolationTarget(undefined)} />
              {role === 'staff' && recoveryTaskId && <Modal open size="xl" title="Chi tiết nhiệm vụ thu hồi"
                onClose={() => { if (!recoveryTaskGuard.current()) setRecoveryTaskId(undefined) }}>
                <RecoveryTaskDetail role="staff" id={recoveryTaskId} closeGuard={recoveryTaskGuard} onChanged={onChanged} />
              </Modal>}
            </>
          ) : (
          <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">Danh sách hồ sơ trả kho &amp; quyết toán</h3>
              <p className="text-xs text-stone-500 mt-0.5">Chọn một hồ sơ để tiến hành nghiệm thu hoặc xem quyết toán chi tiết.</p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700 border border-stone-200">
              {rows.length} hồ sơ
            </span>
          </div>

          {/* Search bar & Status Tabs */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo mã kho, tên khách hàng, cơ sở hoặc lý do trả kho..."
                className="!h-9 w-full rounded-lg border border-stone-200 bg-white !px-3 !py-1.5 !text-xs text-stone-900 focus:border-amber-500 focus:outline-none placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400 hover:text-stone-700"
                >
                  Xóa
                </button>
              )}
            </div>
          {role === 'staff' && <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-stone-500">
            Sắp xếp
            <select aria-label="Sắp xếp hồ sơ trả kho" className="!h-9 !w-40 !min-w-0 shrink-0 rounded-lg border border-stone-200 bg-white !px-3 !py-1.5 !text-xs text-stone-700"
              value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(0) }}>
              <option value="priority">Ưu tiên xử lý</option>
              <option value="createdAt,desc">Mới nhất</option>
              <option value="createdAt,asc">Cũ nhất</option>
            </select>
          </label>}
            </div>

            {/* Segmented control tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 pb-2 text-xs">
              {[
                { id: 'all' as const, label: 'Tất cả', count: counts.all },
                { id: 'pending_inspection' as const, label: 'Chờ nghiệm thu', count: counts.pending },
                { id: 'review' as const, label: 'Chờ khách / Khiếu nại', count: counts.review },
                { id: 'settlement' as const, label: 'Quyết toán / Hoàn cọc', count: counts.settlement },
                { id: 'completed' as const, label: 'Đã hoàn tất', count: counts.completed },
              ].map((tab) => {
                const active = statusFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active ? 'bg-amber-700 text-white' : 'bg-stone-200 text-stone-700'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {read.loading && !read.data && <p role="status">Đang tải hồ sơ trả kho...</p>}
          {!!read.error && <p role="alert">{returnError(read.error)}</p>}
          {feedback && <p role="status">{feedback}</p>}

          {/* Empty states */}
          {!read.loading && !read.error && filteredRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
              {rows.length === 0 ? 'Chưa có yêu cầu trả kho nào.' : 'Không tìm thấy hồ sơ trả kho phù hợp với bộ lọc hiện tại.'}
            </div>
          )}

          {/* Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredRows.map((record) => {
              const isCompleted = record.status === 'completed'
              const isPending = ['requested', 'scheduled'].includes(record.status)
              const clearancePending = role === 'staff' && awaitsCustomerClearance(record)
              const isSettlement = ['payment_due', 'refund_pending'].includes(record.status)
              const badgeClass =
                record.status === 'disputed'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                  : record.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : record.status === 'refund_pending'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold'
                  : record.status === 'payment_due'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'

              return (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecordId(record.id)}
                  className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200 font-mono tracking-tight">
                          {record.unitNumber}
                        </span>
                        <span className="text-xs font-semibold text-stone-500">
                          {record.facilityName}
                        </span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {labels[record.status]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-y border-stone-100 text-xs">
                      <div>
                        <span className="text-stone-400 block text-[11px]">Khách hàng</span>
                        <span className="font-bold text-stone-800">{record.customerName || 'Khách thuê'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[11px]">Hạn dự kiến trả</span>
                        <span className="font-semibold text-stone-700">
                          {record.returnType === 'INVENTORY_MISMATCH' && record.scheduledAppointmentAt
                            ? returnRecoveryCutoff(record.scheduledAppointmentAt)
                            : rentalDate(record.scheduledDate)}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-stone-50 flex items-center justify-between">
                        <span className="text-stone-400 text-[11px]">
                          {record.status === 'refund_pending' ? 'Tiền hoàn cọc:' : record.status === 'payment_due' ? 'Phụ phí cần thu:' : 'Cọc theo HĐ:'}
                        </span>
                        <span className={`font-mono font-bold text-sm ${
                          record.status === 'refund_pending' ? 'text-purple-700' : record.status === 'payment_due' ? 'text-amber-800' : 'text-stone-900'
                        }`}>
                          {record.status === 'refund_pending' && record.netRefundAmount != null
                            ? rentalMoney(record.netRefundAmount, 'VND')
                            : record.status === 'payment_due' && record.amountDueFromCustomer != null
                            ? rentalMoney(record.amountDueFromCustomer, 'VND')
                            : record.depositAmount != null
                            ? rentalMoney(record.depositAmount, 'VND')
                            : 'Chưa xác định'}
                        </span>
                      </div>
                    </div>

                    {record.customerNotes && (
                      <p className="text-xs text-stone-600 line-clamp-1 italic">
                        Lý do: &ldquo;{record.customerNotes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <span className="text-[11px] text-stone-400 font-medium">
                      Hồ sơ thuê · {record.rentalDisplayCode || recordDisplayCode(record.rentalId)}
                    </span>
                    {clearancePending ? (
                      <div className="flex flex-wrap items-center justify-end gap-2" onClick={event => event.stopPropagation()}>
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRecordId(record.id)}>Xem chi tiết</Button>
                        <Button type="button" size="sm" disabled>Tiến hành nghiệm thu</Button>
                      </div>
                    ) : <Button
                      type="button"
                      size="sm"
                      className={
                        isPending
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs'
                          : isSettlement
                          ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs'
                          : 'border-stone-300 text-stone-700 hover:bg-stone-50 font-semibold text-xs'
                      }
                      variant={isPending || isSettlement ? 'primary' : 'outline'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedRecordId(record.id)
                      }}
                    >
                      {isPending
                        ? 'Tiến hành nghiệm thu'
                        : isSettlement
                        ? 'Xử lý quyết toán'
                        : isCompleted
                        ? 'Xem biên bản quyết toán'
                        : 'Xem chi tiết'}
                    </Button>}
                  </div>
                </div>
              )
            })}
          </div>

          {!rentalId && rows.length > 0 && (
            <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-xs">
              <span className="text-stone-500">
                Hiển thị {filteredRows.length} / {rows.length} hồ sơ
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy || recoveryBusy || page === 0} onClick={() => { if (!recoveryLock.current) setPage((value) => value - 1) }}>Trang trước</Button>
                <span className="font-semibold text-stone-600 px-2">Trang {page + 1}</span>
                <Button size="sm" variant="outline" disabled={busy || recoveryBusy || !read.data || page + 1 >= read.data.pagination.totalPages} onClick={() => { if (!recoveryLock.current) setPage((value) => value + 1) }}>Trang sau</Button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  )
}

function DamagePricingSelector({
  category,
  items,
  onChange,
  disabled,
  prices,
}: {
  category: 'minor' | 'major'
  items: DamageItemInput[]
  onChange: (items: DamageItemInput[]) => void
  disabled?: boolean
  prices: DamagePricingItem[]
}) {
  const catalog = prices.filter((item) => item.category === category)
  const addItem = () => {
    const first = catalog[0]
    if (first) onChange([...items, { code: first.code, quantity: 1 }])
  }
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-stone-800">Bảng giá hư hỏng tự động</p>
          <p className="text-[11px] text-stone-500">Chọn hạng mục và số lượng/diện tích; hệ thống tự tính theo giá chuẩn.</p>
        </div>
        <span className="shrink-0 rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">Tự động tính</span>
      </div>
      {items.length === 0 && <p className="rounded-lg bg-white/70 p-2 text-xs text-stone-500">Chưa có hạng mục. Nếu kho không hư hại, giữ nguyên mức phí 0 ₫.</p>}
      {items.map((item, index) => {
        const price = catalog.find((entry) => entry.code === item.code) ?? catalog[0]
        return (
          <div key={`${item.code}-${index}`} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-end gap-2">
            <label className="text-[11px] font-semibold text-stone-700">
              Hạng mục
              <select
                value={item.code}
                disabled={disabled}
                onChange={(event) => onChange(items.map((current, currentIndex) => currentIndex === index ? { ...current, code: event.target.value } : current))}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs text-stone-800"
              >
                {catalog.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-700">
              Số lượng ({price?.unit ?? 'đơn vị'})
              <input
                type="number"
                min={price?.unit === 'm²' ? '0.01' : '1'}
                step={price?.unit === 'm²' ? '0.01' : '1'}
                value={item.quantity}
                disabled={disabled}
                onChange={(event) => onChange(items.map((current, currentIndex) => currentIndex === index ? { ...current, quantity: Number(event.target.value) || 0 } : current))}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-right text-xs text-stone-800"
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              aria-label="Xóa hạng mục hư hỏng"
              onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-600 hover:border-rose-300 hover:text-rose-700"
            >
              Xóa
            </button>
            <p className="col-span-full -mt-1 text-[10px] text-stone-500">
              Giá chuẩn: {price ? `${rentalMoney(price.unitPrice, 'VND')} / ${price.unit}` : ''}
            </p>
            {price?.trigger && <p className="col-span-full text-[11px] text-stone-500">Điều kiện: {price.trigger}</p>}
            {price?.applies && <p className="col-span-full text-[11px] text-stone-500">Đối tượng: {price.applies}</p>}
            <p className="col-span-full text-[10px] font-semibold text-stone-800">
              Tính: {item.quantity || 0} × {price ? rentalMoney(price.unitPrice, 'VND') : '0 ₫'} = {rentalMoney(calculateDamageFee([item], prices), 'VND')}
            </p>
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-2">
        <button type="button" disabled={disabled || !catalog.length} onClick={addItem} className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50">
          + Thêm hạng mục
        </button>
        <span className="text-sm font-extrabold text-stone-900">{rentalMoney(calculateDamageFee(items, prices), 'VND')}</span>
      </div>
    </div>
  )
}

function getNextStepText(status: ApiReturn['status'], role: ReturnRole, recoveryNextStep: string | null): string {
  if (recoveryNextStep) return recoveryNextStep

  if (role === 'customer') {
    const customerSteps: Record<ApiReturn['status'], string> = {
      requested: 'Yêu cầu đã được gửi. Cơ sở sẽ sắp xếp lịch và thực hiện nghiệm thu trước khi quyết toán.',
      scheduled: 'Đến cơ sở theo ngày hẹn để trả kho và bàn giao cho nhân viên nghiệm thu.',
      inspected: 'Nghiệm thu đã được ghi nhận. Chờ cơ sở gửi kết quả quyết toán để khách hàng xác nhận.',
      awaiting_business_review: 'Hồ sơ cũ chưa có bảng giá trả sớm đã lưu. Chờ Ban điều hành xem xét.',
      awaiting_customer_confirmation: 'Kiểm tra các khoản phí bên dưới, sau đó đồng ý quyết toán hoặc yêu cầu xem xét lại.',
      disputed: 'Hồ sơ đang có khiếu nại từ bạn. Chờ Ban điều hành hoặc Quản lý cơ sở giải quyết.',
      payment_due: 'Thanh toán khoản quyết toán còn thiếu để tiếp tục hoàn tất trả kho.',
      refund_pending: 'Cơ sở đang xử lý hoàn cọc. Khoản tiền sẽ được chuyển hoàn theo thông tin của bạn.',
      recovery_required: 'Khách chưa đến theo lịch. Cơ sở cần xử lý hồ sơ thu hồi theo quy trình.',
      completed: 'Hồ sơ trả kho và quyết toán đã hoàn tất.',
      withdrawn_for_recovery: 'Mở mục Thu hồi kho để theo dõi hồ sơ.',
    }
    return customerSteps[status] || 'Đang xử lý hồ sơ trả kho.'
  }

  // Staff / Manager / Business perspective:
  const staffSteps: Record<ApiReturn['status'], string> = {
    requested: 'Khách hàng đã gửi yêu cầu trả kho. Cơ sở sắp xếp lịch hẹn và thực hiện nghiệm thu.',
    scheduled: 'Hẹn trả kho đã được lên lịch. Tiến hành nghiệm thu thực địa khi khách bàn giao gian kho.',
    inspected: 'Đã nghiệm thu hiện trường. Kiểm tra và hoàn tất bảng quyết toán để gửi cho khách hàng.',
    awaiting_business_review: 'Hồ sơ chưa có bảng giá trả sớm đã lưu. Chờ Ban điều hành xem xét phê duyệt.',
    awaiting_customer_confirmation: 'Đã gửi biên bản quyết toán. Đang chờ khách hàng xác nhận để tiến hành hoàn cọc.',
    disputed: 'Hồ sơ đang có khiếu nại từ khách hàng. Cần Ban điều hành hoặc Quản lý cơ sở giải quyết trước khi tiếp tục.',
    payment_due: 'Khách hàng có phụ phí vượt cọc cần thanh toán. Ghi nhận thanh toán và phát hành biên lai thu tiền.',
    refund_pending: 'Cơ sở thực hiện hoàn cọc cho khách hàng và ghi nhận biên lai hoàn tiền để hoàn tất hồ sơ.',
    recovery_required: 'Khách chưa đến theo lịch. Cơ sở cần lập biên bản và xử lý thu hồi theo quy trình.',
    completed: 'Hồ sơ trả kho và quyết toán đã hoàn tất.',
    withdrawn_for_recovery: 'Mở mục Thu hồi kho để tiếp tục xử lý.',
  }
  return staffSteps[status] || 'Đang xử lý hồ sơ trả kho.'
}

function LeasedReturnActions(props: Parameters<typeof ReturnActions>[0]) {
  const [fresh, setFresh] = useState(props.record)
  useEffect(() => setFresh(props.record), [props.record])
  const actionable = props.role === 'staff' ? ['requested', 'scheduled', 'payment_due', 'refund_pending'].includes(fresh.status)
    && !awaitsCustomerClearance(fresh)
    : props.role === 'manager' && fresh.status === 'disputed'
  return <ProcessingLeaseBoundary target="RETURN" id={props.record.id} enabled={actionable && fresh.sourceType !== 'RECOVERY'} onAcquired={async () => {
    setFresh(await getReturn(props.role, props.record.id))
  }}><ReturnActions key={fresh.id} {...props} record={fresh} /></ProcessingLeaseBoundary>
}

function ReturnActions({ role, record, run, busy, recoveryLocked, onRecoveryLocked, onRecoveryChanged }: { role: ReturnRole; record: ApiReturn; run: (work: () => Promise<ApiReturn>) => Promise<void>; busy: boolean; recoveryLocked: boolean; onRecoveryLocked: (locked: boolean) => void; onRecoveryChanged: () => void }) {
  const [applicableSchedule, setApplicableSchedule] = useState<{ returnId: string; value: ReturnFeeSchedule } | null>(null)
  const feeSchedule = applicableSchedule?.returnId === record.id ? applicableSchedule.value : null
  useEffect(() => {
    setApplicableSchedule(null)
    if (role !== 'staff') return
    let active = true
    getReturnFeeScheduleForReturn(record.id).then(value => { if (active) setApplicableSchedule({ returnId: record.id, value }) }).catch(() => { if (active) setApplicableSchedule(null) })
    return () => { active = false }
  }, [role, record.id])
  const customDamage: DamagePricingItem[] = Object.entries(feeSchedule?.prices ?? {}).filter(([code]) => isCustomFee(code) && !code.startsWith('custom_cleaning_')).map(([code, amount]) => ({
    code, category: code.startsWith('custom_minor_') ? 'minor' : 'major', unit: 'lần',
    label: feeSchedule!.details[code].label, suggestedMin: amount, suggestedMax: amount, unitPrice: amount,
  }))
  const damagePrices = [...returnDamageCatalog, ...customDamage].filter(item => !feeSchedule?.editableCatalog || item.code in feeSchedule.prices).map(item => ({ ...item, ...getReturnFeeDetails(feeSchedule, item.code), unitPrice: feeSchedule?.prices[item.code] ?? item.unitPrice }))
  const cleaningOptions = returnCleaningOptions.filter(item => !feeSchedule?.editableCatalog || item.id in feeSchedule.prices).map(item => ({ ...item, ...getReturnFeeDetails(feeSchedule, item.id), fee: feeSchedule?.prices[item.id] ?? item.fee }))
  for (const [id, fee] of Object.entries(feeSchedule?.prices ?? {})) {
    if (id.startsWith('custom_cleaning_')) cleaningOptions.push({ id, fee, desc: '', ...getReturnFeeDetails(feeSchedule, id) })
  }
  const majorCleaningFee = feeSchedule?.prices.major ?? 0
  const attendance = record.attendance
  const handoverApproved = attendance?.reviewAccepted === true
  const appointmentAt = attendance?.handoverAppointmentAt
  const expiresAt = handoverApproved ? attendance.handoverDueAt : attendance?.expiresAt
  const [inspectionNow, setInspectionNow] = useState(Date.now)
  useEffect(() => {
    const milestones = [Date.parse(appointmentAt ?? ''), Date.parse(expiresAt ?? '')]
    let timer: number | undefined
    const updateInspectionClock = () => {
      const now = Date.now()
      setInspectionNow(now)
      const next = Math.min(...milestones.filter(time => time > now))
      if (Number.isFinite(next)) timer = window.setTimeout(updateInspectionClock, Math.min(next - now, 2_147_483_647))
    }
    updateInspectionClock()
    return () => window.clearTimeout(timer)
  }, [appointmentAt, expiresAt])
  const id = record.id
  const [acceptedSettlement, setAcceptedSettlement] = useState(false)
  const [confirmationError, setConfirmationError] = useState('')
  const actor = getAuthenticatedActor()
  const [note, setNote] = useState(record.inspectionNotes || record.staffNotes || '')
  const [fees, setFees] = useState<ReturnFees>(() => ({ damageFee: record.damageFee, cleaningFee: record.cleaningFee, lostItemFee: record.lostItemFee, overdueFee: record.overdueFee, outstandingFee: record.outstandingFee }))
  const [damageItems, setDamageItems] = useState<DamageItemInput[]>([])
  const [empty, setEmpty] = useState<boolean | null>(record.warehouseEmptyVerified === false ? false : null)
  const goodsLeft = empty === false
  const [missingPalletCount, setMissingPalletCount] = useState(0)
  const [damagedFrames, setDamagedFrames] = useState(0)
  const framePrice = feeSchedule?.prices.equipment_frame_damage ?? 0
  const inspectionItems = damagedFrames > 0
    ? [...damageItems, { code: 'equipment_frame_damage', quantity: damagedFrames }]
    : damageItems
  const palletFee = missingPalletCount * (record.equipment?.palletUnitPrice || 0)
  const [damage, setDamage] = useState<InspectionInput['damageClassification']>('no_damage')
  const [unit, setUnit] = useState<'available' | 'maintenance'>('available')
  const requiresMaintenance = goodsLeft || fees.cleaningFee > 0 || damage !== 'no_damage' || missingPalletCount > 0 || damagedFrames > 0
  const [returnedLock, setReturnedLock] = useState((record.lostItemFee ?? 0) <= 0)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const initialized = useRef(false)

  useEffect(() => {
    if (record && !initialized.current) {
      initialized.current = true
      const initialLock = record.returnedLock !== undefined ? record.returnedLock : (record.lostItemFee ?? 0) <= 0
      setReturnedLock(initialLock)
      setFees({
        damageFee: record.damageFee,
        cleaningFee: record.cleaningFee,
        lostItemFee: ['requested', 'scheduled'].includes(record.status) ? (initialLock ? 0 : 150000) : record.lostItemFee,
        overdueFee: record.overdueFee,
        outstandingFee: record.outstandingFee,
      })
      if (record.proposedUnitStatus) setUnit(record.proposedUnitStatus)
    }
  }, [record])

  const handleToggleLock = () => {
    const next = !returnedLock
    setReturnedLock(next)
    setFees((f) => ({ ...f, lostItemFee: next ? 0 : 150000 }))
  }

  const handleCleaningChange = (fee: number) => {
    if (goodsLeft) fee = majorCleaningFee
    setFees((f) => ({ ...f, cleaningFee: fee }))
    if (fee > 0) {
      setUnit('maintenance')
    } else if (damage === 'no_damage' && !goodsLeft) {
      setUnit('available')
    }
  }

  const handleDamageChange = (newDamage: InspectionInput['damageClassification']) => {
    setDamage(newDamage)
    setDamageItems([])
    if (newDamage !== 'no_damage') {
      setUnit('maintenance')
    } else if (fees.cleaningFee === 0 && !goodsLeft) {
      setUnit('available')
    }
  }

  const write = role === 'customer' || !!actor?.permissions.includes(role === 'manager' ? 'rentals:update' : 'returns:process')
  const recovery = record.sourceType === 'RECOVERY'
  const mismatch = record.returnType === 'INVENTORY_MISMATCH'
  const noShowRecovery = !recovery && record.status === 'recovery_required'
  const [recoveryLocation, setRecoveryLocation] = useState('')
  const [recoveryWitness, setRecoveryWitness] = useState('')
  const needsWitness = noShowRecovery && role === 'staff' && write
  const witnessRead = useRentalApiResource(`return-witness:${record.facilityId}:${needsWitness}`,
    () => needsWitness ? listMaintenanceStaff(record.facilityId) : Promise.resolve([]))
  const recoveryIncomplete = noShowRecovery && (!recoveryWitness || !recoveryLocation.trim() || !note.trim())
  const assignedStaffId = handoverApproved ? attendance.handoverStaffId : attendance?.reverificationStaffId
  const canInspect = !recovery && write && role === 'staff' && !awaitsCustomerClearance(record) && (noShowRecovery ||
    (['requested', 'scheduled'].includes(record.status)
      && (!assignedStaffId || assignedStaffId === actor?.id)
      && (!appointmentAt || inspectionNow >= Date.parse(appointmentAt))
      && (!attendance || (mismatch && !!record.setupReturnedAt)
        || (!!attendance.verifiedAt && attendance.reviewAccepted !== false
          && ((!expiresAt && handoverApproved) || inspectionNow < Date.parse(expiresAt ?? ''))))))
  const canReview = write && role === 'manager' && record.status === 'disputed'
  // The mismatch confirmation SLA uses publication time, with review or inspection time for older statements.
  const statementAt = Date.parse(record.settlementPublishedAt ?? record.reviewedAt ?? record.inspectedAt ?? '')
  const confirmationDeadline = mismatch && record.status === 'awaiting_customer_confirmation' && !record.customerConfirmed && Number.isFinite(statementAt)
    ? new Date(statementAt + 72 * 60 * 60 * 1000).toISOString() : null
  const recoveryNextStep = !recovery ? null : record.recoveryTaskStatus === 'CLOSED'
    ? 'Thu hồi đã hoàn tất. Hồ sơ thuê đã kết thúc và trạng thái kho đã được cập nhật.'
    : record.status === 'completed' ? 'Quyết toán đã hoàn tất. Hồ sơ thuê chỉ kết thúc sau khi nhân viên hoàn tất xử lý tài sản và giải phóng kho.'
      : record.status === 'payment_due' ? 'Liên hệ cơ sở để thanh toán khoản quyết toán còn thiếu. Nhân viên ghi nhận tiền kèm biên lai đã đối chiếu.'
        : record.status === 'refund_pending' ? 'Cơ sở thực hiện hoàn tiền và ghi nhận biên lai quyết toán. Thu hồi kho được hoàn tất riêng sau đó.' : null
  const hasEvidence = evidenceFiles.length > 0 || (Array.isArray(record.evidencePhotos) && record.evidencePhotos.length > 0)
  const uploadPhotos = async () => {
    const evidencePhotos = [...(record.evidencePhotos ?? [])]
    for (const file of evidenceFiles) {
      const asset = await uploadReturnEvidence(id, file, role, 'bien-ban-nghiem-thu-tra-kho')
      evidencePhotos.push(asset.id)
    }
    return evidencePhotos
  }
  const submitInspection = async () => {
    if (!feeSchedule) throw new Error('Không tải được biểu phí trả kho. Vui lòng tải lại trang.')
    const applicable = await getReturnFeeScheduleForReturn(id)
    if (applicable.revision !== feeSchedule.revision) throw new Error('Biểu phí áp dụng cho đơn đã thay đổi. Vui lòng tải lại trang trước khi nghiệm thu.')
    if (recoveryIncomplete) throw new Error('Cần ghi danh mục hàng, tình trạng niêm phong, nhân chứng và thông tin lưu tạm.')
    if (empty !== true) throw new Error('Vui lòng xác minh gian kho đã trống hoàn toàn.')
    if (!hasEvidence) throw new Error('Cần ít nhất một ảnh hiện trường để hoàn tất nghiệm thu.')
    const evidencePhotos = await uploadPhotos()
    return inspectReturn(id, {
      ...sanitizeFees(fees),
      missingPalletCount,
      lostItemFee: (returnedLock ? 0 : 150000) + palletFee,
      damageFee: calculateDamageFee(inspectionItems, damagePrices),
      damageItems: inspectionItems,
      inventoryMatch: missingPalletCount > 0 ? 'missing' : 'match',
      damageClassification: goodsLeft ? 'abandoned_goods' : damagedFrames > 0 && damage === 'no_damage' ? 'minor_damage' : damage,
      staffNotes: note,
      evidencePhotos,
      returnedKey: returnedLock,
      returnedCard: false,
      returnedLock,
      lockInspectionResult: returnedLock ? 'RETURNED_USABLE' : 'MISSING_OR_INCOMPLETE',
      proposedUnitStatus: requiresMaintenance ? 'maintenance' : unit,
      unitVacated: true,
      ...(noShowRecovery ? { customerPresent: false, recoveryHandoverLocation: recoveryLocation.trim(), recoveryWitnessStaffId: recoveryWitness } : {}),
    }, record.clearanceRevision ?? 0)
  }

  return (
    <section className="space-y-4" aria-label="Xử lý trả kho">
      {mismatch && (record.settlementVersion ?? 0) > 0 && <p className="text-sm text-stone-600">
        Bảng kê phiên bản {record.settlementVersion}
        {record.settlementPublishedAt && <> · Phát hành {returnRecoveryCutoff(record.settlementPublishedAt)}</>}
      </p>}
      {role === 'customer' && confirmationDeadline && <p className="text-sm">
        Hạn phản hồi bảng kê · <time dateTime={confirmationDeadline}>{returnRecoveryCutoff(confirmationDeadline)}</time> (giờ Việt Nam)
      </p>}
      {record.status === 'withdrawn_for_recovery' && <ViolationRecoveryEntry sourceReturnId={record.id} label="Mở hồ sơ thu hồi" />}
      {mismatch && record.status === 'payment_due' && record.settlementPaymentDueAt && <p className="text-sm">
        Hạn thanh toán trước {returnRecoveryCutoff(record.settlementPaymentDueAt)}
      </p>}
      {!!record.settlementReceipts?.length && <ul className="space-y-1 text-sm">
        {record.settlementReceipts.map(receipt => receipt && <li key={receipt.transactionReference}>
          {receipt.direction === 'COLLECTION' ? 'Đã thu' : 'Đã hoàn'} {rentalMoney(receipt.amount, 'VND')} · {receipt.transactionReference}
        </li>)}
      </ul>}
      {!canInspect && !canReview && (
        <>
          <ReturnSummary record={record} hideHeader hideTerminationFee={false} />
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Bước tiếp theo</p>
            <p className="mt-1">{getNextStepText(record.status, role, recoveryNextStep)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-stone-200 p-4">
              <h4 className="mb-3 font-semibold text-stone-900">Thông tin trả kho & nghiệm thu</h4>
              <dl className="space-y-3 text-sm">
                {([
                  ['Khách hàng', record.customerName], ['Lý do trả kho', record.customerNotes || 'Chưa ghi nhận'],
                  ['Ghi chú nghiệm thu', record.inspectionNotes || record.staffNotes || (record as any).notes || 'Chưa ghi nhận'],
                  ...(record.customerDecisionNote ? [['Ý kiến khiếu nại của khách', record.customerDecisionNote]] : []),
                  ['Kết quả xem xét', record.managerResolutionNote || 'Chưa có'],
                  ['Khách xác nhận quyết toán', record.customerConfirmed ? 'Đã xác nhận' : 'Chưa xác nhận'],
                  ['Hiện trạng kho đề xuất', record.proposedUnitStatus === 'available' ? 'Sẵn sàng' : record.proposedUnitStatus === 'maintenance' ? 'Cần bảo trì' : 'Chưa ghi nhận'],
                  ['Bằng chứng nghiệm thu', `${record.evidencePhotos?.length ?? 0} tệp`],
                ] as Array<[string, string]>).map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium text-stone-800">{value}</dd></div>)}
              </dl>
            </div>
            <div className="rounded-xl border border-stone-200 p-4">
              <h4 className="mb-3 font-semibold text-stone-900">Chi tiết các khoản phí</h4>
              <dl className="divide-y divide-stone-100 text-sm">
                {!recovery && record.setupEarlyExit && <>
                  <div className="flex justify-between gap-3 py-2"><dt className="text-stone-500">Tiền thuê thực thu được quyết toán</dt><dd className="shrink-0 font-medium">{record.rentalRefundCredit == null ? 'Chưa xác định' : rentalMoney(record.rentalRefundCredit, 'VND')}</dd></div>
                  {<div className="flex justify-between gap-3 py-2"><dt className="text-stone-500">Khoản giữ lại theo chính sách chuẩn bị</dt><dd className="shrink-0 font-medium">{record.earlyTerminationFee == null ? 'Chưa xác định' : rentalMoney(record.earlyTerminationFee, 'VND')}</dd></div>}
                </>}
                {feeKeys.map((key, index) => <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{['Phí hư hỏng', 'Phí vệ sinh', 'Phí thiếu khóa', 'Phí quá hạn', 'Phí còn thiếu'][index]}</dt><dd className="shrink-0 font-medium">{rentalMoney(key === 'lostItemFee' ? Math.max(0, record.lostItemFee - (record.palletLossFee || 0)) : record[key], 'VND')}</dd></div>)}
                <div className="flex justify-between gap-3 py-2"><dt className="text-stone-500">Phí thiếu tấm kê</dt><dd className="shrink-0 font-medium">{rentalMoney(record.palletLossFee || 0, 'VND')}</dd></div>
                <div className="flex justify-between gap-3 py-3 font-bold"><dt>Tổng phí ghi nhận</dt><dd>{rentalMoney(record.totalDeductions, 'VND')}</dd></div>
              </dl>
              {!['requested', 'scheduled', 'recovery_required'].includes(record.status) && <SettlementCalculationBreakdown record={record} />}
            </div>
          </div>
        </>
      )}

      {/* Ghi chú phản hồi cho khách khi xác nhận */}
      {role === 'customer' && record.status === 'awaiting_customer_confirmation' && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
          <label className="block text-xs font-bold text-stone-800">
            Ghi chú phản hồi / lý do khiếu nại (nếu có)
          </label>
          <textarea
            className="block w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-amber-500 focus:outline-none"
            disabled={busy}
            value={note}
            maxLength={2000}
            rows={3}
            placeholder="Nhập ý kiến của bạn về bảng quyết toán..."
            onChange={(event) => setNote(event.target.value)}
          />

        </div>
      )}

      {/* ─── OPTION 1: MODERN 2-COLUMN INSPECTION & LIVE SETTLEMENT ─── */}
      {(canInspect || canReview) && (() => {
        const deposit = record.depositAmount ?? 0
        const calculatedDamage = canInspect ? calculateDamageFee(inspectionItems, damagePrices) : fees.damageFee
        const effectiveFees = { ...fees, damageFee: calculatedDamage, lostItemFee: fees.lostItemFee + (canInspect ? palletFee : 0) }
        const displayedPalletFee = canInspect ? palletFee : (record.palletLossFee || 0)
        const displayedLockFee = Math.max(0, effectiveFees.lostItemFee - displayedPalletFee)
        const totalFees = Object.values(effectiveFees).reduce((sum, v) => sum + (Number.isNaN(v) ? 0 : v), 0)
        const rentalCredit = record.setupEarlyExit
          ? (record.rentalRefundCredit ?? record.earlyTerminationPolicy?.rentalRefundAmount ?? 0)
          : (record.activeReturnPolicy?.rentalRefundAmount ?? 0)
        const projectedRefund = record.setupEarlyExit
          ? rentalCredit + Math.max(0, deposit - totalFees)
          : Math.max(0, deposit + rentalCredit - totalFees)
        const projectedDue = record.setupEarlyExit
          ? Math.max(0, totalFees - deposit)
          : Math.max(0, totalFees - deposit - rentalCredit)
        const missingDamageItems = canInspect && !goodsLeft && damage !== 'no_damage' && damage !== 'abandoned_goods'
          && damagePrices.some(item => item.category === (damage === 'major_damage' ? 'major' : 'minor'))
          && (damageItems.length === 0 || damageItems.some((item) => item.quantity <= 0))

        return (
          <div className="space-y-4">
            {/* Form Nghiệm Thu 2 Cột */}
            <form onSubmit={(event) => {
              event.preventDefault()
              void run(canInspect ? submitInspection : () => reviewDispute(id, { ...fees, resolutionNote: note, proposedUnitStatus: unit }))
            }} className="space-y-4">
              <div className="grid gap-5 lg:grid-cols-12">
                {/* ─── CỘT TRÁI (7 cols): Khảo sát thực địa, Phụ kiện & Bằng chứng ─── */}
                <div className="lg:col-span-7 space-y-4">
                  {canInspect && (
                    <>
                      {/* KHỐI 1: BÀN GIAO PHỤ KIỆN & KIỂM TRA HÀNG HÓA */}
                      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                          <h4 className="text-sm font-bold text-stone-900">
                            1. Thu hồi khóa &amp; Kiểm tra hàng hóa
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/40 text-left transition select-none flex flex-col justify-between">
                            <div>
                              <div className="flex w-full items-center justify-between gap-2">
                                <span className="text-xs font-bold text-stone-800">Ổ khóa / Chìa khóa</span>
                                <div className="inline-flex rounded-lg border border-stone-300 bg-stone-100 p-0.5 text-xs">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (!returnedLock) handleToggleLock()
                                    }}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                                      returnedLock
                                        ? 'bg-white text-stone-900 shadow-xs'
                                        : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                  >
                                    Đã thu hồi đủ
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (returnedLock) handleToggleLock()
                                    }}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                                      !returnedLock
                                        ? 'bg-white text-stone-900 shadow-xs'
                                        : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                  >
                                    Làm mất / Thiếu
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-stone-500 leading-tight mt-2">
                                {returnedLock
                                  ? 'Đã nhận lại đủ bộ khóa đã cấp.'
                                  : 'Khách làm mất hoặc không bàn giao bộ khóa.'}
                              </p>
                            </div>
                            {!returnedLock && (
                              <div className="mt-3 pt-2.5 border-t border-stone-200 flex items-center justify-between gap-2">
                                <span className="text-xs text-stone-600 font-medium">Phí làm lại khóa:</span>
                                <span className="font-mono font-bold text-xs text-stone-900">
                                  150.000 ₫
                                </span>
                              </div>
                            )}
                          </div>

                          <fieldset className="space-y-3 rounded-xl border border-stone-200 p-3.5 text-sm">
                            <legend className="px-1 font-semibold">Tình trạng tài sản trong gian kho</legend>
                            <ClearanceStatus record={record} />
                            {record.warehouseEmptyVerifiedAt && <p className="text-xs text-stone-600">Lần kiểm tra đã lưu · {returnRecoveryCutoff(record.warehouseEmptyVerifiedAt)} · {record.warehouseEmptyVerified ? 'Kho trống' : 'Còn tài sản'}</p>}
                            {[true, false].map(value => <label key={String(value)} className="flex items-start gap-2">
                              <input type="radio" name="unitVacated" checked={empty === value} disabled={busy} onChange={() => setEmpty(value)} />
                              {value ? 'Gian kho đã trống hoàn toàn' : 'Gian kho vẫn còn tài sản của khách hàng'}
                            </label>)}
                          </fieldset>
                        </div>
                        {goodsLeft && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{noShowRecovery
                          ? 'Cần kiểm kê và bàn giao hàng vào khu lưu tạm trước khi xác nhận gian trống.'
                          : 'Gian kho vẫn còn tài sản của khách hàng. Vui lòng yêu cầu khách di chuyển toàn bộ tài sản trước khi hoàn tất nghiệm thu.'}</p>}
                        {noShowRecovery && <fieldset className="space-y-2 rounded border p-3">
                          <legend>Biên bản thu hồi hàng</legend>
                          <label className="block">Nhân viên thứ hai<select className="block w-full rounded border p-2" value={recoveryWitness}
                            disabled={busy || witnessRead.loading} onChange={e => setRecoveryWitness(e.target.value)}>
                            <option value="">Chọn nhân viên cùng cơ sở</option>
                            {witnessRead.data?.filter(witness => witness.id !== actor?.id).map(witness =>
                              <option key={witness.id} value={witness.id}>{witness.fullName}</option>)}
                          </select></label>
                          {!!witnessRead.error && <Button type="button" variant="outline" onClick={witnessRead.refresh}>Tải lại nhân chứng</Button>}
                          <label className="block">Khu vực lưu tạm và người nhận bàn giao
                            <input className="block w-full rounded border p-2" maxLength={500} value={recoveryLocation}
                              disabled={busy} onChange={e => setRecoveryLocation(e.target.value)} />
                          </label>
                          <p>Ghi danh mục hàng và tình trạng niêm phong trong ghi chú biên bản.</p>
                        </fieldset>}
                      </div>

                      {/* KHỐI 2: ĐÁNH GIÁ HIỆN TRẠNG, VỆ SINH & HƯ HẠI */}
                      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4">
                        <div className="border-b border-stone-100 pb-2.5">
                          <h4 className="text-sm font-bold text-stone-900">
                            2. Đánh giá vệ sinh, hư hại &amp; Đề xuất trạng thái
                          </h4>
                        </div>

                        {/* Tình trạng vệ sinh gian kho */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-stone-700 block">
                              Tình trạng vệ sinh gian kho
                            </label>
                            {fees.cleaningFee > 0 && (
                              <span className="text-xs font-bold font-mono text-stone-800">
                                Phí vệ sinh: {rentalMoney(fees.cleaningFee, 'VND')}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {cleaningOptions.map((opt) => {
                              const active = fees.cleaningFee === opt.fee
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  disabled={busy || !feeSchedule || (goodsLeft && opt.id !== 'major')}
                                  onClick={() => handleCleaningChange(opt.fee)}
                                  className={`rounded-xl border p-2.5 text-center transition cursor-pointer select-none ${
                                    active
                                      ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900 font-bold text-stone-900 shadow-xs'
                                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50/50'
                                  }`}
                                >
                                  <div className="text-xs font-bold mt-0.5">{opt.label}</div>
                                  <div className={`text-[10px] mt-0.5 ${active ? 'text-stone-600' : 'text-stone-400'}`}>{rentalMoney(opt.fee, 'VND')}</div>
                                  <div className="mt-1 text-[11px] font-normal">Điều kiện: {opt.trigger}</div>
                                  <div className="mt-1 text-[11px] font-normal">Đối tượng: {opt.applies}</div>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="rounded-xl border border-stone-200 p-3 space-y-2">
                          <p className="text-xs font-bold">Kiểm kê thiết bị đã bàn giao</p>
                          {record.equipment && <>
                            <label className="text-xs font-semibold block">Số khung kệ bị hư
                              <input type="number" min={0} max={record.equipment.frameCount} step={1} value={damagedFrames}
                                disabled={busy || !feeSchedule || !record.equipment.frameCount}
                                onChange={event => setDamagedFrames(Math.min(record.equipment!.frameCount, Math.max(0, Math.trunc(Number(event.target.value) || 0))))}
                                className="ml-3 w-24 rounded-lg border p-2" />
                            </label>
                            <p className="text-xs">Khung hư: {damagedFrames}/{record.equipment.frameCount}. Phí hư khung: {damagedFrames} × {rentalMoney(framePrice, 'VND')} = {rentalMoney(damagedFrames * framePrice, 'VND')}.</p>
                          </>}
                          {record.equipment?.palletCount != null ? <>
                            <label className="text-xs font-semibold block">Số tấm kê bị thiếu
                              <input type="number" min={0} max={record.equipment.palletCount} step={1} value={missingPalletCount} disabled={busy}
                                onChange={(event) => { setMissingPalletCount(Math.min(record.equipment!.palletCount!, Math.max(0, Math.trunc(Number(event.target.value) || 0)))); setUnit('maintenance') }}
                                className="ml-3 w-24 rounded-lg border p-2" />
                            </label>
                            <div className="flex items-center gap-2 py-1">
                              <button type="button" aria-label="Giảm số tấm kê bị thiếu" disabled={busy || missingPalletCount === 0} onClick={() => setMissingPalletCount((n) => Math.max(0, n - 1))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded border">−</button>
                              <button type="button" aria-label="Tăng số tấm kê bị thiếu" disabled={busy || missingPalletCount >= record.equipment.palletCount} onClick={() => { setMissingPalletCount((n) => Math.min(record.equipment!.palletCount!, n + 1)); setUnit('maintenance') }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded border">+</button>
                            </div>
                            <p className="text-xs">Thu hồi: {record.equipment.palletCount - missingPalletCount} / {record.equipment.palletCount} tấm. Phí thiếu: {rentalMoney(palletFee, 'VND')}.</p>
                            {missingPalletCount > 0 && !record.equipment.palletUnitPrice && <p className="text-xs text-amber-700">Chưa cấu hình đơn giá bồi thường tấm kê; cần bổ sung trước khi nghiệm thu.</p>}
                          </> : <p className="text-xs text-amber-700">{noShowRecovery
                            ? 'Hồ sơ chưa có số tấm kê bàn giao. Ghi thiết bị đếm được trong biên bản.'
                            : 'Hồ sơ chưa có cấu hình thiết bị bàn giao. Cần đối soát số tấm kê trước khi nghiệm thu.'}</p>}
                        </div>

                        {/* Mức độ hư hại */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 block">
                            Mức độ hư hại kết cấu (Trần, Vách, Sàn, Cửa)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {([
                              { id: 'no_damage', label: 'Không hư hại', desc: 'Kho nguyên vẹn' },
                              { id: 'minor_damage', label: 'Hư hỏng nhẹ', desc: 'Trầy xước, bong tróc sơn' },
                              { id: 'major_damage', label: 'Hư hỏng nặng', desc: 'Cong cửa, hỏng khóa, nứt/vỡ sàn' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={busy}
                                onClick={() => handleDamageChange(opt.id)}
                                className={`rounded-xl border p-2.5 text-center transition cursor-pointer select-none ${
                                  damage === opt.id
                                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900 font-bold text-stone-900 shadow-xs'
                                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50/50'
                                }`}
                              >
                                <div className="text-xs font-bold mt-0.5">{opt.label}</div>
                                <div className={`text-[10px] mt-0.5 ${damage === opt.id ? 'text-stone-600' : 'text-stone-400'}`}>{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Đề xuất trạng thái sau trả kho */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 block">
                            Đề xuất trạng thái gian kho sau khi nghiệm thu
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {([
                              { id: 'available' as const, label: 'Sẵn sàng cho thuê tiếp', desc: 'Kho đạt chuẩn vệ sinh & kỹ thuật' },
                              { id: 'maintenance' as const, label: 'Cần bảo trì / vệ sinh', desc: 'Cần nhân viên xử lý trước khi cho thuê' },
                            ]).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={busy || (opt.id === 'available' && requiresMaintenance)}
                                onClick={() => setUnit(opt.id)}
                                className={`rounded-xl border p-3 text-left transition cursor-pointer select-none ${
                                  (requiresMaintenance ? 'maintenance' : unit) === opt.id
                                    ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900 font-bold text-stone-900 shadow-xs'
                                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold">{opt.label}</span>
                                </div>
                                <p className={`text-[11px] mt-1 ${(requiresMaintenance ? 'maintenance' : unit) === opt.id ? 'text-stone-600' : 'text-stone-400'}`}>{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* KHỐI 3: BẰNG CHỨNG HÌNH ẢNH & GHI CHÚ */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4">
                    <div className="border-b border-stone-100 pb-2.5">
                      <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <span>3. Ảnh hiện trường & Biên bản nghiệm thu</span>
                      </h4>
                    </div>

                    {canInspect && (
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-stone-700">Ảnh hiện trường theo khu vực</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(['Trần', 'Vách', 'Sàn', 'Cửa'] as const).map((area) => {
                            const areaCount = evidenceFiles.filter(file => file.name.startsWith(`${area} - `)).length
                            return <label key={area} className={`relative cursor-pointer rounded-xl border border-dashed p-3 text-center text-xs font-semibold transition ${areaCount ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-stone-300 bg-stone-50/50 text-stone-700 hover:border-stone-400 hover:bg-stone-100/50'}`}>
                              {areaCount ? `Đã thêm ${areaCount} ảnh ${area.toLowerCase()}` : `Thêm ảnh ${area.toLowerCase()}`}
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                disabled={busy}
                                aria-label={`Ảnh hiện trạng ${area.toLowerCase()}`}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                onChange={(event) => {
                                  const files = Array.from(event.target.files ?? []).map((file) => new File([file], `${area} - ${file.name}`, { type: file.type, lastModified: file.lastModified }))
                                  setEvidenceFiles((current) => [...current, ...files])
                                  event.target.value = ''
                                }}
                              />
                            </label>
                          })}
                        </div>
                        <p className="text-[11px] text-stone-500">Đối chiếu với ảnh và hiện trạng kho trống trong hồ sơ nhận kho.</p>
                        <label className="text-xs font-semibold text-stone-700 block">
                          Biên bản đối chứng / Tài liệu khác
                        </label>
                        <div className="relative rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/50 p-4 text-center hover:border-stone-400 hover:bg-stone-100/50 transition cursor-pointer group">
                          <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            disabled={busy}
                            onChange={(event) => setEvidenceFiles((current) => [...current, ...Array.from(event.target.files ?? [])])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            title="Tải ảnh bằng chứng nghiệm thu"
                          />
                          <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                            
                            <p className="text-xs font-bold text-stone-800">
                              Nhấn để chọn ảnh hoặc kéo thả ảnh chụp kho vào đây
                            </p>
                            <p className="text-[11px] text-stone-500">
                              Hỗ trợ định dạng JPG, PNG, PDF (có thể chọn nhiều ảnh)
                            </p>
                          </div>
                        </div>
                        <FilePreviewList
                          files={evidenceFiles}
                          onRemove={(index) => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                          disabled={busy}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700 block">
                        {canInspect ? 'Ghi chú biên bản của nhân viên' : 'Kết luận xem xét giải quyết khiếu nại'}
                      </label>
                      <textarea
                        className="block w-full rounded-xl border border-stone-300 p-3 text-xs leading-relaxed focus:border-stone-500 focus:outline-none bg-stone-50/40"
                        disabled={busy}
                        rows={3}
                        value={note}
                        maxLength={2000}
                        placeholder={canInspect ? 'Ví dụ: Gian kho nguyên vẹn, tường vách khô ráo, khách đã dọn sạch hàng hóa...' : 'Nhập nội dung giải quyết khiếu nại...'}
                        onChange={(event) => setNote(event.target.value)}
                      />
                      <p className="text-right text-[10px] text-stone-400">{note.length}/2000 ký tự</p>
                    </div>
                  </div>
                </div>

                {/* ─── CỘT PHẢI (5 cols): BẢNG QUYẾT TOÁN CỌC & KHẤU TRỪ ─── */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-4 sticky top-4">
                    <div className="border-b border-stone-100 pb-3">
                      <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <span>Bảng quyết toán hoàn tiền & khấu trừ</span>
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Phí hư hỏng lấy từ bảng giá chuẩn. Hệ thống trừ vào cọc trước; với trả sau ngày bắt đầu thuê, phần vượt cọc mới trừ vào tiền thuê chưa sử dụng.
                      </p>
                    </div>

                    {/* Tiền cọc gốc */}
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-stone-800">Tiền cọc theo hợp đồng</p>
                        <p className="text-[11px] text-stone-500">Khoản bảo đảm thực thu</p>
                      </div>
                      <span className="text-base font-extrabold text-stone-900 font-mono">
                        {rentalMoney(deposit, 'VND')}
                      </span>
                    </div>
                    {rentalCredit > 0 && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-stone-800">{record.setupEarlyExit ? 'Tiền thuê được hoàn theo chính sách chuẩn bị' : 'Tiền thuê các tháng chưa bắt đầu'}</p>
                          <p className="text-[11px] text-stone-500">{record.setupEarlyExit ? 'Hoàn 80%; giữ lại 20% theo báo giá.' : 'Hoàn sau khi trừ phí vượt cọc (nếu có).'}</p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-stone-900 font-mono">{rentalMoney(rentalCredit, 'VND')}</span>
                      </div>
                    )}

                    {/* Danh sách phí khấu trừ */}
                    <div className="space-y-2">
                      {/* Phí hư hỏng kết cấu */}
                      {canInspect && !goodsLeft && damage !== 'no_damage' && damage !== 'abandoned_goods' ? (
                        <DamagePricingSelector
                          category={damage === 'major_damage' ? 'major' : 'minor'}
                          items={damageItems}
                          onChange={setDamageItems}
                          disabled={busy || !feeSchedule}
                          prices={damagePrices}
                        />
                      ) : (
                        <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs text-stone-600 flex items-center justify-between">
                          <span className="font-semibold text-stone-800">Phí hư hỏng</span>
                          <span className={`font-mono font-bold ${effectiveFees.damageFee > 0 ? 'text-rose-700' : 'text-stone-700'}`}>
                            {effectiveFees.damageFee > 0 ? `− ${rentalMoney(effectiveFees.damageFee, 'VND')}` : '0 ₫'}
                          </span>
                        </div>
                      )}
                      {missingDamageItems && <p className="text-[11px] font-semibold text-rose-700">Chọn ít nhất một hạng mục và số lượng hư hỏng để hệ thống tính phí.</p>}

                      {/* Phí thiếu khóa và tấm kê được trình bày riêng; tổng quyết toán chỉ cộng một lần. */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs text-stone-600 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-stone-800 block">Phí thiếu khóa đã bàn giao</span>
                          <span className="text-[10px] text-stone-400">{returnedLock ? 'Đã nhận đủ khóa' : 'Khách làm mất / thiếu khóa'}</span>
                        </div>
                        <span className={`font-mono font-bold ${displayedLockFee > 0 ? 'text-rose-700' : 'text-stone-700'}`}>
                          {displayedLockFee > 0 ? `− ${rentalMoney(displayedLockFee, 'VND')}` : '0 ₫'}
                        </span>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs text-stone-600 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-stone-800 block">Phí thiếu tấm kê đã bàn giao</span>
                          <span className="text-[10px] text-stone-400">{canInspect
                            ? missingPalletCount > 0 ? `Thiếu ${missingPalletCount} tấm × ${rentalMoney(record.equipment?.palletUnitPrice || 0, 'VND')}`
                              : record.equipment?.palletCount == null ? 'Chưa có số tấm kê để đối chiếu' : 'Đã thu hồi đủ tấm kê'
                            : (record.missingPalletCount || 0) > 0 ? `Thiếu ${record.missingPalletCount} tấm kê` : 'Không ghi nhận thiếu tấm kê'}</span>
                        </div>
                        <span className={`font-mono font-bold ${displayedPalletFee > 0 ? 'text-rose-700' : 'text-stone-700'}`}>
                          {displayedPalletFee > 0 ? `− ${rentalMoney(displayedPalletFee, 'VND')}` : '0 ₫'}
                        </span>
                      </div>

                      {/* Phí vệ sinh */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs text-stone-600 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-stone-800 block">Phí vệ sinh gian kho</span>
                          <span className="text-[10px] text-stone-400">{cleaningOptions.find(option => option.fee === fees.cleaningFee)?.label ?? 'Phí vệ sinh đã ghi nhận'}</span>
                        </div>
                        <span className={`font-mono font-bold ${fees.cleaningFee > 0 ? 'text-rose-700' : 'text-stone-700'}`}>
                          {fees.cleaningFee > 0 ? `− ${rentalMoney(fees.cleaningFee, 'VND')}` : '0 ₫'}
                        </span>
                      </div>

                      {/* Phí quá hạn & công nợ nếu có */}
                      {fees.overdueFee > 0 && (
                        <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs">
                          <span className="text-stone-600">Phí quá hạn (tự động)</span>
                          <span className="font-mono font-bold text-rose-700">− {rentalMoney(fees.overdueFee, 'VND')}</span>
                        </div>
                      )}
                      {fees.outstandingFee > 0 && (
                        <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-xs">
                          <span className="text-stone-600">Công nợ còn thiếu (tự động)</span>
                          <span className="font-mono font-bold text-rose-700">− {rentalMoney(fees.outstandingFee, 'VND')}</span>
                        </div>
                      )}
                    </div>

                    {/* Tổng khấu trừ */}
                    <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
                      <span className="font-semibold text-stone-700">Tổng phí khấu trừ:</span>
                      <span className="font-bold text-stone-900 font-mono">
                        {rentalMoney(totalFees, 'VND')}
                      </span>
                    </div>

                    {/* THẺ DỰ TÍNH KẾT QUẢ THỜI GIAN THỰC */}
                    {projectedDue === 0 ? (
                      <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                            Hoàn tiền dự kiến cho khách
                          </span>
                          <span className="rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            HOÀN CỌC
                          </span>
                        </div>
                        <p className="text-2xl font-black text-stone-900 font-mono">
                          {rentalMoney(projectedRefund, 'VND')}
                        </p>
                        <p className="text-xs text-stone-500 leading-relaxed">
                          Số tiền này sẽ được chuyển hoàn cho khách sau khi khách xác nhận biên bản.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                            Khách cần nộp thêm phụ phí
                          </span>
                          <span className="rounded-md bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900">
                            THU THÊM
                          </span>
                        </div>
                        <p className="text-2xl font-black text-rose-700 font-mono">
                          {rentalMoney(projectedDue, 'VND')}
                        </p>
                        <p className="text-xs text-rose-700/80 leading-relaxed">
                          Tổng phí vượt quá tiền cọc gốc. Khách hàng cần thanh toán thêm khoản chênh lệch này.
                        </p>
                      </div>
                    )}

                    {/* Nút hành động chính */}
                    <div className="space-y-2 pt-1">
                      {canInspect && !feeSchedule && <p role="status" className="text-xs text-amber-900">Chưa tải được biểu phí áp dụng cho đơn này. Nếu tình trạng kéo dài, vui lòng tải lại trang trước khi nghiệm thu.</p>}
                      {canInspect && !hasEvidence && (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center text-xs text-amber-900 font-semibold">
                          Cần tải lên ít nhất 1 ảnh hiện trường để làm bằng chứng nghiệm thu.
                        </p>
                      )}
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={busy || recoveryIncomplete || (canInspect && !feeSchedule) || (canInspect && ((!noShowRecovery && record.equipment?.palletCount == null) || (missingPalletCount > 0 && !record.equipment?.palletUnitPrice))) || (canReview && !note.trim()) || missingDamageItems || (canInspect && !hasEvidence) || (canInspect && empty !== true)}
                        className="w-full font-bold py-3 text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{canInspect ? 'Ghi nhận kết quả nghiệm thu' : 'Ghi nhận xem xét khiếu nại'}</span>
                      </Button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setFees({ damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: record.outstandingFee || 0 })
                          setDamageItems([])
                          setDamage('no_damage')
                          setEmpty(null)
                          setDamagedFrames(0)
                          setMissingPalletCount(0)
                          setReturnedLock(true)
                          setUnit('available')
                        }}
                        className="w-full py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition cursor-pointer"
                      >
                        Đặt lại tất cả phụ phí về 0đ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )
      })()}
      {write && !recovery && role === 'staff' && ['payment_due', 'refund_pending'].includes(record.status) && (
        <RecoveryReturnSettlement
          role={role}
          record={record}
          busy={busy}
          onLocked={onRecoveryLocked}
          onChanged={onRecoveryChanged}
        />
      )}
      {!recovery && record.status === 'completed' && record.settlementReceipt?.direction === 'COLLECTION' &&
        record.settlementReceipt.paymentMethod === 'CASH' && (
          <p className="break-all text-sm text-stone-700">Mã biên lai <b>{receiptDisplayCode(record.settlementReceipt.receiptCode, record.settlementReceipt.transactionReference, record.id)}</b></p>
      )}
      {recovery && (role === 'staff' || role === 'manager') && record.recoveryTaskId && <RecoveryTaskLink role={role} taskId={record.recoveryTaskId} facilityId={record.facilityId} disabled={busy || recoveryLocked} onChanged={onRecoveryChanged} />}
      {write && recovery && role === 'staff' && ['payment_due', 'refund_pending'].includes(record.status) && <RecoveryReturnSettlement role={role} record={record} busy={busy} onLocked={onRecoveryLocked} onChanged={onRecoveryChanged} />}
      {role === 'customer' && (record.status === 'awaiting_customer_confirmation' || acceptedSettlement || (record.customerConfirmed && record.status !== 'disputed')) && (
        <div className="space-y-2">
          {confirmationError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{confirmationError}</p>}
          {(acceptedSettlement || (record.customerConfirmed && record.status !== 'disputed')) && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Đã gửi xác nhận đồng ý quyết toán thành công.</p>}
          {!acceptedSettlement && !(record.customerConfirmed && record.status !== 'disputed') && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            Vui lòng kiểm tra biên bản và đồng ý quyết toán hoặc gửi yêu cầu xem xét lại.
          </div>}
          <div className="flex gap-2">
            <Button disabled={busy || acceptedSettlement || (record.customerConfirmed && record.status !== 'disputed') || !note.trim()} onClick={() => void run(() => confirmReturn(id, 'disputed', note, 'customer', record.settlementVersion))}>Yêu cầu xem xét lại</Button>
            <Button disabled={busy || acceptedSettlement || (record.customerConfirmed && record.status !== 'disputed') || !!record.settlementBlocker || record.netRefundAmount === null || record.amountDueFromCustomer === null} onClick={() => { setConfirmationError(''); void run(async () => { try { const result = await confirmReturn(id, 'accepted', note, 'customer', record.settlementVersion); setAcceptedSettlement(true); return result } catch (error) { setConfirmationError(returnError(error)); throw error } }) }}>{acceptedSettlement || (record.customerConfirmed && record.status !== 'disputed') ? 'Đã đồng ý quyết toán' : 'Đồng ý quyết toán'}</Button>
          </div>
        </div>
      )}
      {record.customerDecisionNote && record.customerDecisionNote.includes('Auto-Settlement SLA') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
          Quyết toán này đã được hệ thống <b>tự động xác nhận</b> do quá hạn phản hồi của khách hàng.
        </div>
      )}
    </section>
  )
}
