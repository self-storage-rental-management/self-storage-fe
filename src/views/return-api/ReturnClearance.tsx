import { recordDisplayCode } from '../../utils/recordDisplayCode'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button } from '../../components/ui'
import VietnameseDateTimeField from '../../components/VietnameseDateTimeField'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import {
  extendMismatchReturnWindow,
  scheduleMismatchReturnAppointment,
  setCustomerClearance,
  type ApiReturn,
} from '../../services/returnApi'
import type { RentalApiDetail } from '../../types/rentalApi'
import { vietnamDateTimeInput } from '../../utils/vietnamTime'
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

function formatMismatchCountdown(value: string | null | undefined, now: number) {
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

export function ReturnPreparation() {
  return <p className="text-sm text-stone-700">Quý khách cần di chuyển toàn bộ tài sản cá nhân ra khỏi gian kho trước khi nhân viên hoàn tất nghiệm thu. Sau khi dọn kho, vui lòng xác nhận tại màn hình chi tiết yêu cầu trả kho.</p>
}

export function ReturnContract({ rental, date, record, depositAmount, reservationCode, inventoryMismatch }: { rental: RentalApiDetail; date?: string; record?: ApiReturn; depositAmount?: number | null; reservationCode?: string; inventoryMismatch?: boolean }) {
  const lastDay = rental.dateSemantics?.lastPermittedDate || rental.contractEndDate
  const deposit = record?.depositAmount ?? rental.financialSummary.securityDepositAmount ?? rental.bookingEvidence?.agreedAmounts?.securityDepositAmount ?? depositAmount
  const type = record ? record.returnType : (inventoryMismatch || rental.inventory?.decision === 'RETURN_REQUESTED') ? 'INVENTORY_MISMATCH'
    : rental.setupReturnWindow || rental.status === 'setup' ? 'RETURN_IN_SETUP'
    : lastDay && date ? date < lastDay ? 'EARLY_RETURN' : 'NORMAL' : undefined
  const fields = [
    ['Mã hợp đồng', rental.contractNumber || 'Chưa có mã hợp đồng'],
    ...(!rental.contractNumber && reservationCode ? [['Mã đơn đặt kho', reservationCode]] : []),
    ['Gian kho', rental.storageUnit.code], ['Cơ sở', rental.facility.name],
    ['Ngày bắt đầu thuê', rentalDate(rental.startDate)], ['Ngày hết hạn hợp đồng', rentalDate(lastDay)],
    ['Tiền cọc đảm bảo', deposit == null ? 'Chưa xác định' : rentalMoney(deposit, rental.currency)],
    ['Hình thức trả kho', type ? returnTypes[type] : 'Hệ thống xác định theo ngày hẹn'],
  ]
  return <dl className="grid gap-3 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
    {fields.map(([label, value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="font-semibold text-stone-900">{value}</dd></div>)}
  </dl>
}

export function awaitsCustomerClearance(record: ApiReturn) {
  return record.sourceType !== 'RECOVERY' && ['requested', 'scheduled'].includes(record.status)
    && !record.customerClearedAt
}

export function ClearanceStatus({ record }: { record: ApiReturn }) {
  return <p className="text-sm font-medium text-stone-700">{record.customerClearedAt
    ? <>Khách đã xác nhận dọn kho · <time dateTime={record.customerClearedAt}>{new Date(record.customerClearedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></>
    : 'Khách chưa xác nhận dọn kho'}</p>
}

export function CustomerClearance({ record, busy, run, ownerId, countdown, extension }: { record: ApiReturn; busy: boolean; ownerId?: string; countdown?: string | null;
  extension?: { count: number; onExtend?: () => void };
  run: (work: () => Promise<ApiReturn>) => Promise<void> }) {
  const isMismatch = record.returnType === 'INVENTORY_MISMATCH'
  const [confirming, setConfirming] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [appointmentAt, setAppointmentAt] = useState(() =>
    record.scheduledAppointmentAt ? vietnamDateTimeInput(record.scheduledAppointmentAt) : '')
  const extensionIdemRef = useRef<string | null>(null)

  useEffect(() => {
    setAppointmentAt(record.scheduledAppointmentAt ? vietnamDateTimeInput(record.scheduledAppointmentAt) : '')
  }, [record.id, record.scheduledAppointmentAt])

  useEffect(() => {
    extensionIdemRef.current = null
  }, [record.id, record.returnExtensionCount, record.returnVersion])

  const editable = ownerId === record.customerId && ['requested', 'scheduled'].includes(record.status)
    && !record.inspectedAt && !record.noShowAt && record.sourceType !== 'RECOVERY'
  const clearanceDeadline = isMismatch
    ? record.inventoryRemovalDeadlineAt ?? record.recoveryEligibleAt
    : record.attendance?.reviewAccepted === true
      ? record.attendance.handoverDueAt ?? record.recoveryEligibleAt
      : record.recoveryEligibleAt

  useEffect(() => {
    if (!isMismatch || !editable || !clearanceDeadline || countdown) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isMismatch, editable, clearanceDeadline, countdown])

  if (!isMismatch) {
    return <section className="space-y-3 rounded-xl border border-stone-200 p-4">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="font-semibold text-stone-900">{steps[currentStep[record.status]]}</h3>
          <p className="break-all text-xs text-stone-600">Mã yêu cầu · {record.displayCode || recordDisplayCode(record.id)}</p>
        </div>
        <ClearanceStatus record={record} />
      </header>
      {editable && <>
        {clearanceDeadline && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p><strong>Hạn cuối dọn kho</strong> · Trước <time dateTime={clearanceDeadline}>{formatCustomerDateTime(clearanceDeadline)}</time> (giờ Việt Nam)</p>
          {countdown && <p role="timer" className="font-medium tabular-nums">{countdown}</p>}
          {extension && <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-2">
            <p className="text-xs">Đã gia hạn {extension.count}/2 lần</p>
            {extension.onExtend && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={extension.onExtend}>Gia hạn dọn kho thêm 2 ngày</Button>}
          </div>}
        </div>}
        <ReturnPreparation />
        {record.warehouseEmptyVerified === false && <p className="rounded-lg bg-amber-50 p-3 text-sm">Nhân viên ghi nhận còn tài sản. {record.inspectionNotes}</p>}
        <div className="flex justify-end">{record.customerClearedAt
          ? <Button variant="outline" disabled={busy} onClick={() => void run(() => setCustomerClearance(record, false))}>Thu hồi xác nhận dọn kho</Button>
          : !confirming && <Button disabled={busy} onClick={() => setConfirming(true)}>Xác nhận đã dọn kho</Button>}</div>
        {confirming && !record.customerClearedAt && <div role="group" aria-label="Xác nhận đã dọn kho" className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
          <p>Tôi đã dọn hết tài sản và sẵn sàng bàn giao để cơ sở nghiệm thu.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Quay lại</Button>
            <Button disabled={busy} onClick={() => { setConfirming(false); void run(() => setCustomerClearance(record, true)) }}>Xác nhận</Button>
          </div>
        </div>}
      </>}
      <ol aria-label="Tiến độ trả kho" className="grid gap-2 border-t border-stone-200 pt-3 text-xs sm:grid-cols-3">
        {steps.map((label, index) => <li key={label} aria-current={index === currentStep[record.status] ? 'step' : undefined}
          className={index === currentStep[record.status] ? 'font-bold text-amber-800' : index < currentStep[record.status] ? 'text-stone-800' : 'text-stone-500'}>{index + 1}. {label}</li>)}
      </ol>
    </section>
  }

  const deadlineMs = clearanceDeadline ? Date.parse(clearanceDeadline) : NaN
  const hasDeadline = Number.isFinite(deadlineMs)
  const effectiveCountdown = countdown ?? formatMismatchCountdown(clearanceDeadline, now)
  const expired = hasDeadline && now >= deadlineMs
  const maxExtensions = record.maxReturnExtensions ?? 2
  const usedExtensions = extension?.count ?? record.returnExtensionCount ?? 0
  const remainingExtensions = Math.max(0, maxExtensions - usedExtensions)
  const extensionDays = record.returnExtensionDays ?? 2
  const arrivalLocked = Boolean(
    record.attendance?.arrivedAt
    || record.attendance?.lateArrivalClaimedAt
    || record.attendance?.reviewStatus === 'PENDING'
    || record.warehouseEmptyVerified === true,
  )
  const minDateTime = vietnamDateTimeInput(Math.ceil(now / 60_000) * 60_000)
  const maxDateTime = hasDeadline ? vietnamDateTimeInput(deadlineMs - 60_000) : undefined
  const selectedOutOfRange = Boolean(
    appointmentAt && (appointmentAt < minDateTime || (maxDateTime && appointmentAt > maxDateTime)),
  )
  const canSchedule = editable && !arrivalLocked && !expired && hasDeadline
  const canExtend = editable && !arrivalLocked && !expired && hasDeadline && remainingExtensions > 0
    && (extension?.onExtend != null || record.canExtendReturnWindow !== false)
  const previewExtendedDeadline = hasDeadline
    ? formatCustomerDateTime(new Date(deadlineMs + extensionDays * 86_400_000).toISOString())
    : null

  const formatDeadlineText = formatCustomerDateTime(clearanceDeadline)
  const formatStartText = formatCustomerDateTime(new Date(Math.ceil(now / 60_000) * 60_000).toISOString())

  return <section
    className={`space-y-4 rounded-xl border p-4 text-left text-sm ${expired ? 'border-red-300 bg-red-50/70 text-stone-900' : 'border-stone-200 bg-white text-stone-800'}`}
    aria-label="Chuẩn bị và bàn giao trả kho"
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-semibold text-stone-900">Lịch hẹn &amp; thời hạn trả kho</h3>
        <p className="break-all text-xs text-stone-600">
          {steps[currentStep[record.status]]} · Mã yêu cầu · {record.displayCode || recordDisplayCode(record.id)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {effectiveCountdown && (
          <Badge variant={expired ? 'error' : 'warning'}>
            <span role="timer" className="tabular-nums">{effectiveCountdown}</span>
          </Badge>
        )}
      </div>
    </div>

    <div className="text-xs text-stone-600">
      <ClearanceStatus record={record} />
    </div>

    {editable && <>
      <dl className="grid gap-2.5 sm:grid-cols-2">
        {clearanceDeadline && (
          <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
            <dt className="text-xs text-stone-500">Hạn cuối dọn kho</dt>
            <dd className="mt-0.5 font-semibold text-stone-900">
              <time dateTime={clearanceDeadline}>{formatDeadlineText}</time>
            </dd>
          </div>
        )}

        <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
          <dt className="flex items-center justify-between gap-2 text-xs text-stone-500">
            <span>Lịch hẹn bàn giao trả kho</span>
            <Badge variant={record.attendance?.arrivedAt ? 'success' : record.scheduledAppointmentAt ? 'success' : 'muted'}>
              {record.attendance?.arrivedAt
                ? 'Đã tiếp nhận'
                : record.attendance?.reviewStatus === 'PENDING'
                  ? 'Đang đối soát'
                  : record.scheduledAppointmentAt
                    ? 'Đã đặt lịch'
                    : record.scheduledDate
                      ? 'Chưa chọn giờ'
                      : 'Chưa đặt lịch'}
            </Badge>
          </dt>
          <dd className="mt-0.5 font-semibold text-stone-900">
            {record.scheduledAppointmentAt
              ? formatCustomerDateTime(record.scheduledAppointmentAt)
              : record.scheduledDate
                ? `${rentalDate(record.scheduledDate)} (chưa chọn giờ)`
                : <span className="text-xs font-normal text-stone-500">Chọn ngày giờ bên dưới</span>}
          </dd>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5">
          <dt className="text-xs text-stone-500">Số lần gia hạn còn lại</dt>
          <dd className="mt-0.5 font-semibold text-stone-900">
            {remainingExtensions}/{maxExtensions} lần{' '}
            <span className="text-xs font-normal text-stone-500">
              (Đã dùng {usedExtensions}/{maxExtensions} lần · {extensionDays} ngày/lần)
            </span>
          </dd>
        </div>
      </dl>

      {arrivalLocked && (
        <p role="status" className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
          {record.attendance?.reviewStatus === 'PENDING'
            ? 'Hồ sơ đang được Quản lý đối soát lượt đến. Không thể đổi lịch hoặc gia hạn thêm.'
            : 'Cơ sở đã tiếp nhận khách hoặc đã bắt đầu nghiệm thu. Không thể đổi lịch hoặc gia hạn thêm.'}
        </p>
      )}

      <div className="space-y-3 border-t border-stone-200 pt-3">
        {canSchedule && (
          <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/70 p-3">
            <p className="text-xs font-semibold text-stone-800">
              {record.scheduledAppointmentAt ? 'Đổi lịch hẹn bàn giao trả kho' : 'Đặt lịch hẹn bàn giao trả kho'}
            </p>
            <p className="text-[11px] text-stone-500">
              Chọn thời gian từ {formatStartText} đến trước hạn cuối dọn kho ({formatDeadlineText}). Đổi lịch không làm thay đổi hạn dọn hàng.
            </p>
            <VietnameseDateTimeField
              label="Ngày hẹn (dd/mm/yyyy)"
              value={appointmentAt}
              minDate={minDateTime.slice(0, 10)}
              maxDate={maxDateTime?.slice(0, 10)}
              minDateTime={minDateTime}
              maxDateTime={maxDateTime}
              disabled={busy}
              onChange={setAppointmentAt}
            />
            {selectedOutOfRange && (
              <p role="alert" className="text-xs font-medium text-red-700">
                Thời điểm hẹn phải nằm trong tương lai và trước hạn cuối dọn kho.
              </p>
            )}
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !appointmentAt || selectedOutOfRange}
                onClick={() => void run(() => scheduleMismatchReturnAppointment(
                  record.id,
                  new Date(`${appointmentAt}:00+07:00`).toISOString(),
                  record.returnVersion,
                  crypto.randomUUID(),
                ))}
              >
                {record.scheduledAppointmentAt ? 'Đổi lịch bàn giao' : 'Đặt lịch bàn giao'}
              </Button>
            </div>
          </div>
        )}

        {!arrivalLocked && !expired && hasDeadline && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 text-xs">
            <div className="space-y-0.5">
              {remainingExtensions > 0 ? (
                <>
                  <p className="font-semibold text-stone-800">
                    Cần thêm thời gian? Gia hạn thêm {extensionDays} ngày (còn {remainingExtensions}/{maxExtensions} lượt)
                  </p>
                  {previewExtendedDeadline && (
                    <p className="text-[11px] text-stone-600">
                      Hạn cuối dọn kho sẽ dời đến <b>{previewExtendedDeadline}</b>; sau đó bạn có thể chọn lại ngày hẹn mới ở trên.
                    </p>
                  )}
                </>
              ) : (
                <p className="font-medium text-stone-700">Đã sử dụng hết {maxExtensions} lượt gia hạn cho phép.</p>
              )}
            </div>
            {canExtend && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  extensionIdemRef.current ??= crypto.randomUUID()
                  const key = extensionIdemRef.current
                  if (extension?.onExtend) {
                    extension.onExtend()
                  } else {
                    void run(() => extendMismatchReturnWindow(record.id, record.returnVersion, key))
                  }
                }}
              >
                Gia hạn dọn hàng thêm 2 ngày
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2.5 rounded-lg border border-stone-200 bg-stone-50/70 p-3">
          <p className="text-xs text-stone-700">
            Dọn hết hàng rồi bấm xác nhận bên dưới để cơ sở tiếp nhận và nghiệm thu. Xác nhận này không tự hoàn tất trả kho, giải phóng gian kho hay quyết toán.
          </p>
          {record.warehouseEmptyVerified === false && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
              Nhân viên ghi nhận còn tài sản trong gian kho. {record.inspectionNotes}
            </p>
          )}
          <div className="flex justify-end">
            {record.customerClearedAt
              ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => setCustomerClearance(record, false))}>Thu hồi xác nhận dọn kho</Button>
              : !confirming && <Button size="sm" disabled={busy} onClick={() => setConfirming(true)}>Xác nhận đã dọn hàng xong</Button>}
          </div>
          {confirming && !record.customerClearedAt && (
            <div role="group" aria-label="Xác nhận đã dọn hàng xong" className="space-y-3 rounded-lg border border-stone-200 bg-white p-3 text-sm">
              <p>Tôi đã dọn hết tài sản và sẵn sàng bàn giao để cơ sở tiếp nhận, kiểm tra và nghiệm thu.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Quay lại</Button>
                <Button size="sm" disabled={busy} onClick={() => { setConfirming(false); void run(() => setCustomerClearance(record, true)) }}>Xác nhận</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>}

    <ol aria-label="Tiến độ trả kho" className="grid gap-2 border-t border-stone-200 pt-3 text-xs sm:grid-cols-3">
      {steps.map((label, index) => <li key={label} aria-current={index === currentStep[record.status] ? 'step' : undefined}
        className={index === currentStep[record.status] ? 'font-bold text-amber-800' : index < currentStep[record.status] ? 'text-stone-800' : 'text-stone-500'}>{index + 1}. {label}</li>)}
    </ol>
  </section>
}
