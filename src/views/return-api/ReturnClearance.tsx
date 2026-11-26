import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { setCustomerClearance, type ApiReturn } from '../../services/returnApi'
import type { RentalApiDetail } from '../../types/rentalApi'
import { rentalDate, rentalMoney } from '../rental-api/presentation'

const returnTypes = {
  CANCELLED_IN_SETUP: 'Hủy trong thời gian chuẩn bị',
  RETURN_IN_SETUP: 'Trả trong thời gian chuẩn bị',
  INVENTORY_MISMATCH: 'Trả do kiểm kê sai lệch',
  EARLY_RETURN: 'Trả trước hạn',
  NORMAL: 'Trả đúng hạn',
}

const steps = ['Đã gửi yêu cầu trả kho', 'Chuẩn bị bàn giao kho', 'Nhân viên nghiệm thu',
  'Xác nhận quyết toán', 'Thu hoặc hoàn tiền nếu có', 'Hoàn tất trả kho']
const currentStep: Record<ApiReturn['status'], number> = {
  requested: 1, scheduled: 1, recovery_required: 2, inspected: 2, awaiting_business_review: 3,
  awaiting_customer_confirmation: 3, disputed: 3, payment_due: 4, refund_pending: 4, completed: 5, withdrawn_for_recovery: 1,
}

export function ReturnPreparation() {
  return <p className="text-sm text-stone-700">Quý khách cần di chuyển toàn bộ tài sản cá nhân ra khỏi gian kho trước khi nhân viên hoàn tất nghiệm thu. Sau khi dọn kho, vui lòng xác nhận tại màn hình chi tiết yêu cầu trả kho.</p>
}

export function ReturnContract({ rental, date, record }: { rental: RentalApiDetail; date?: string; record?: ApiReturn }) {
  const lastDay = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  const deposit = rental.financialSummary.securityDepositAmount ?? rental.bookingEvidence?.agreedAmounts?.securityDepositAmount
  const type = record ? record.returnType : rental.inventory?.decision === 'RETURN_REQUESTED' ? 'INVENTORY_MISMATCH'
    : rental.setupReturnWindow || rental.status === 'setup' ? 'RETURN_IN_SETUP'
    : lastDay && date ? date < lastDay ? 'EARLY_RETURN' : 'NORMAL' : undefined
  const fields = [
    ['Mã hợp đồng', rental.contractNumber ?? 'Chưa có mã hợp đồng'],
    ['Gian kho', rental.storageUnit.code], ['Cơ sở', rental.facility.name],
    ['Ngày bắt đầu thuê', rentalDate(rental.startDate)], ['Ngày hết hạn hợp đồng', rentalDate(lastDay)],
    ['Tiền cọc đảm bảo', deposit == null ? 'Chưa xác định' : rentalMoney(deposit, rental.currency)],
    ['Hình thức trả kho', type ? returnTypes[type] : 'Hệ thống xác định theo ngày hẹn'],
  ]
  return <dl className="grid gap-3 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
    {fields.map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="font-semibold text-stone-900">{value}</dd></div>)}
  </dl>
}

export function ClearanceStatus({ record }: { record: ApiReturn }) {
  return <p className="text-sm font-medium text-stone-700">{record.customerClearedAt
    ? <>Khách đã xác nhận dọn kho · <time dateTime={record.customerClearedAt}>{new Date(record.customerClearedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></>
    : 'Khách chưa xác nhận dọn kho'}</p>
}

export function CustomerClearance({ record, busy, run, ownerId }: { record: ApiReturn; busy: boolean; ownerId?: string;
  run: (work: () => Promise<ApiReturn>) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const editable = ownerId === record.customerId && ['requested', 'scheduled'].includes(record.status)
    && !record.inspectedAt && !record.noShowAt && record.sourceType !== 'RECOVERY'
  const clearanceDeadline = record.returnType === 'INVENTORY_MISMATCH'
    ? record.inventoryRemovalDeadlineAt ?? record.recoveryEligibleAt
    : record.attendance?.reviewAccepted === true
      ? record.attendance.handoverDueAt ?? record.recoveryEligibleAt
      : record.recoveryEligibleAt
  return <section className="space-y-3 rounded-xl border border-stone-200 p-4">
    <p className="break-all text-sm">Mã yêu cầu · {record.displayCode || recordDisplayCode(record.id)}</p>
    <ClearanceStatus record={record} />
    {editable && <>
      {clearanceDeadline && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <strong>Hạn cuối dọn kho</strong> · Trước <time dateTime={clearanceDeadline}>{formatCustomerDateTime(clearanceDeadline)}</time> (giờ Việt Nam)
      </p>}
      <ReturnPreparation />
      {record.warehouseEmptyVerified === false && <p className="rounded-lg bg-amber-50 p-3 text-sm">Nhân viên ghi nhận còn tài sản. {record.inspectionNotes}</p>}
      {record.customerClearedAt
        ? <Button variant="outline" disabled={busy} onClick={() => void run(() => setCustomerClearance(record, false))}>Thu hồi xác nhận dọn kho</Button>
        : <Button disabled={busy} onClick={() => setConfirming(true)}>Xác nhận đã dọn kho</Button>}
      {confirming && !record.customerClearedAt && <Modal open title="Xác nhận đã dọn kho" onClose={() => setConfirming(false)}>
        <p>Tôi xác nhận đã di chuyển toàn bộ tài sản cá nhân ra khỏi gian kho và sẵn sàng bàn giao để nhân viên kiểm tra thực tế.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Quay lại</Button>
          <Button disabled={busy} onClick={() => { setConfirming(false); void run(() => setCustomerClearance(record, true)) }}>Xác nhận</Button>
        </div>
      </Modal>}
    </>}
    <ol aria-label="Tiến độ trả kho" className="grid gap-2 border-t border-stone-200 pt-3 text-xs sm:grid-cols-3">
      {steps.map((label, index) => <li key={label} aria-current={index === currentStep[record.status] ? 'step' : undefined}
        className={index === currentStep[record.status] ? 'font-bold text-amber-800' : index < currentStep[record.status] ? 'text-stone-800' : 'text-stone-500'}>{index + 1}. {label}</li>)}
    </ol>
  </section>
}
