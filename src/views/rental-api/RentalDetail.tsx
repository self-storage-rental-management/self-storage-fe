import { useManagerPresentation } from "../manager/managerPresentation"
import { useState } from "react"
import RenewalRiskNotice from "./RenewalRiskNotice"
import RentalHandoverFiles from "./RentalHandoverFiles"
import { Badge, Button, Card, Modal } from "../../components/ui"
import BookingTransactionReceipt from "./BookingTransactionReceipt"
import type { RentalApiDetail, RentalApiRole } from "../../types/rentalApi"
import { bookingPaymentPurposes, bookingPaymentStatuses } from "../../services/rentalBookingEvidence"
import { rentalLabels, rentalMoney, unknown, rentalDataWarning, rentalPeriodText, rentalDate, accessStatusLabels } from "./presentation"
const labelClass = "text-xs font-normal text-slate-500"
const valueClass = "mt-1 text-sm font-medium text-slate-900"
export default function RentalDetail({
  rental,
  onRequest,
  role = "customer",
  showTechnicalWarnings = true,
}: {
  rental: RentalApiDetail
  onRequest?: () => void
  role?: RentalApiRole
  showTechnicalWarnings?: boolean
}) {
  const { copy } = useManagerPresentation()
  const [section, setSection] = useState<'documents' | 'payments'>('documents')
  const [receiptPayment, setReceiptPayment] = useState<string>()
  const labelClass = "text-xs font-medium text-stone-500"
  const valueClass = "mt-1 text-sm font-semibold text-stone-900"

  const evidence = rental.bookingEvidence
  const agreed = evidence?.agreedAmounts
  const warnings = rental.dataWarnings.filter(warning => warning.field !== "contractEndDate")
  const accessStatus = rental.access.completeness === "UNKNOWN"
    ? null
    : accessStatusLabels[rental.access.status?.toUpperCase() || ""] || null

  return (
    <div className="space-y-5 [&_dt]:text-xs [&_dt]:font-normal [&_dt]:text-stone-500 [&_dd]:mt-1.5 [&_dd]:break-words [&_dd]:text-sm [&_dd]:font-medium [&_dd]:leading-relaxed [&_dd]:text-stone-900">
      <div className="flex flex-wrap gap-2">
        <Button variant={section === 'documents' ? 'primary' : 'outline'} onClick={() => setSection('documents')}>Hồ sơ & tài liệu</Button>
        <Button variant={section === 'payments' ? 'primary' : 'outline'} onClick={() => setSection('payments')}>Thỏa thuận & giao dịch</Button>
      </div>
      <div className={section === 'documents' ? 'space-y-5' : 'hidden'}>
      {rental.status === "active" && <RenewalRiskNotice rentalId={rental.id} role={role} />}
      <Card className="overflow-hidden rounded-xl border-t-4 border-t-amber-500 bg-white px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">StorageHub · Hồ sơ lưu trữ</p><h3 className="text-2xl font-bold text-stone-900">Thông tin hồ sơ thuê</h3><p className="mt-2 text-sm text-stone-500">{rental.facility.name}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${rental.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{copy(rentalLabels[rental.status])}</span>
        </div>
        <dl className="divide-y divide-stone-100 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&>div]:py-4 sm:[&>div]:grid-cols-[180px_minmax(0,1fr)] sm:[&>div]:gap-6 [&_dd]:!mt-0">
          <div>
            <dt className={labelClass}>Mã hồ sơ thuê</dt>
            <dd className={`${valueClass} flex items-center gap-2`}>
              <span className="break-all font-mono text-xs sm:text-sm" title={rental.id}>{rental.id}</span>
              <button
                type="button"
                aria-label="Sao chép mã hồ sơ thuê"
                title="Sao chép mã hồ sơ"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => { void navigator.clipboard?.writeText(rental.id) }}
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="8" y="8" width="12" height="12" rx="2" strokeWidth="1.7" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" strokeWidth="1.7" />
                </svg>
              </button>
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Khách hàng</dt>
            <dd className={valueClass}>{rental.customer.fullName}</dd>
          </div>
          <div>
            <dt className={labelClass}>Cơ sở lưu trữ</dt>
            <dd className={valueClass}>{rental.facility.name}</dd>
          </div>
          <div>
            <dt className={labelClass}>Gian kho</dt>
            <dd className={valueClass}>{rental.storageUnit.code}</dd>
          </div>
          <div>
            <dt className={labelClass}>Loại gian kho</dt>
            <dd className={valueClass}>{copy(rental.unitType.name)}</dd>
          </div>
          <div>
            <dt>Thời hạn thuê</dt>
            <dd>{rentalPeriodText(rental, showTechnicalWarnings)}</dd>
          </div>
          {rental.setupStartedAt && rental.setupEndsAt && <div>
            <dt>Setup miễn phí</dt>
            <dd>
              <p>Bắt đầu bàn giao: {rentalDate(rental.setupStartedAt)}</p>
              <p>Setup đến hết: {rentalDate(new Date(new Date(rental.setupEndsAt).getTime() - 86_400_000).toISOString())}</p>
              <p>Thời hạn thuê tính từ: {rentalDate(rental.startDate)}</p>
              {rental.moveInCompletedAt && <p className="text-xs text-stone-500">Khách báo setup xong lúc: {rentalDate(rental.moveInCompletedAt)}</p>}
            </dd>
          </div>}
          {rental.inventoryPending && <div>
            <dt>Kiểm kê đầu vào</dt>
            <dd><Badge variant="warning">Chưa kiểm kê</Badge>
              <p className="mt-2 text-xs leading-5 text-stone-500">Kỳ thuê vẫn tính theo mốc đã bàn giao; hồ sơ kiểm kê cần được hoàn tất trước hạn xử lý.</p>
              {rental.inventoryDueAt && <p className="mt-1 text-xs text-stone-500">Hạn kiểm kê: {new Date(rental.inventoryDueAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>}
            </dd>
          </div>}
          <div>
            <dt>Giá thuê / tháng</dt>
            <dd>{rentalMoney(rental.monthlyPrice, rental.currency)}</dd>
          </div>
          <div>
            <dt>Quyền ra vào kho</dt>
            <dd><Badge variant={rental.access.status === 'ACTIVE' ? 'success' : 'muted'}>{accessStatus || 'Chưa xác minh'}</Badge>
            <p className="mt-2 text-xs leading-5 text-stone-500">{rental.access.completeness === 'UNKNOWN'
              ? 'Chưa tải được trạng thái cấp quyền ra vào. Vui lòng liên hệ nhân viên cơ sở.'
              : rental.access.status === 'ACTIVE' ? 'Đã có thẻ hoặc mã ra vào đang hoạt động.'
              : rental.access.status === 'REVOKED' ? 'Thẻ hoặc mã ra vào đã được thu hồi.'
              : rental.access.status === 'INACTIVE' ? 'Chưa ghi nhận thẻ hoặc mã ra vào được cấp cho hồ sơ này.'
              : 'Trạng thái được cập nhật theo thông tin quyền ra vào của cơ sở.'}</p></dd>
          </div>
        </dl>
      </Card>
      <RentalHandoverFiles key={`${role}:${rental.id}`} role={role === "manager" ? "manager" : "customer"} id={rental.id} />
      {onRequest && (
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end border-t border-stone-200 bg-white/95 px-1 py-3 backdrop-blur">
          <Button disabled={rental.status !== "active"} onClick={onRequest}>
            Yêu cầu gia hạn
          </Button>
          {rental.status !== "active" && (
            <p>
              Chỉ có thể yêu cầu gia hạn khi hồ sơ đang hiệu lực và chưa yêu cầu trả kho.
            </p>
          )}
        </div>
      )}
      </div>
      <div className={section === 'payments' ? 'space-y-5' : 'hidden'}>
      {evidence && (
        <Card className="rounded-xl p-5">
          <h3 className="mb-4 border-b border-stone-200 pb-3 text-base font-bold">Thỏa thuận ban đầu</h3>
          {agreed ? (
            <dl className="grid gap-3 sm:grid-cols-2 [&>div]:min-w-0 [&>div]:rounded-xl [&>div]:border [&>div]:border-stone-200 [&>div]:bg-stone-50 [&>div]:p-4">
              {([
                ["Tiền thuê toàn kỳ", agreed.netRentalAmount],
                ["Cọc giữ chỗ (trừ vào tiền thuê)", agreed.reservationDepositAmount],
                ["Tiền thuê còn lại sau cọc giữ chỗ", agreed.remainingRentalAmount],
                ["Cọc bảo đảm kho", agreed.securityDepositAmount],
                ["Thanh toán khi nhận kho (tiền thuê còn lại + cọc bảo đảm)", agreed.dueAtCheckIn],
                ["Tổng tiền thuê + cọc bảo đảm (không cộng cọc giữ chỗ lần nữa)", agreed.totalInitialObligation],
              ] as const).map(([label, amount]) => (
                <div key={label} className={label.startsWith('Tổng') ? '!border-emerald-200 !bg-emerald-50' : label.startsWith('Thanh toán') ? '!border-amber-200 !bg-amber-50' : ''}><dt>{label}</dt><dd className="!mt-2 !text-lg !font-bold">{rentalMoney(amount, evidence.currency)}</dd></div>
              ))}
            </dl>
          ) : <p>Không có dữ liệu</p>}
          <p className="mt-3 text-sm">Đây là số tiền theo thỏa thuận ban đầu, không phải xác nhận đã thu tiền hoặc dư nợ hiện tại.</p>
          <h4 className="font-bold mt-4 mb-2">Giao dịch của đơn đặt chỗ</h4>
          {evidence.payments.length === 0 ? <p>Không có dữ liệu</p> : (
            <ul className="space-y-3">
              {evidence.payments.map(payment => (
                <li key={payment.id} className="rounded-xl border border-stone-200 p-4">
                  <p className="text-sm font-medium text-stone-600">{bookingPaymentPurposes[payment.purpose]}</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">{rentalMoney(payment.amount, evidence.currency)}</p>
                  <p className="mt-2 text-sm"><strong>Trạng thái:</strong> {bookingPaymentStatuses[payment.status]}</p>
                  {payment.invoiceNumber && <p className="mt-1 text-sm"><strong>Hóa đơn:</strong> {payment.invoiceNumber} · {payment.invoiceStatus}</p>}
                  {role === 'customer' && payment.status === 'PAID' && rental.reservationId && <Button variant="outline" size="sm" className="mt-3" onClick={() => setReceiptPayment(payment.id)}>Xem biên lai</Button>}
                </li>
              ))}
            </ul>
          )}
          {evidence.paymentsTruncated && <p role="status" className="mt-3">Chỉ hiển thị 20 giao dịch gần nhất, chưa phải toàn bộ lịch sử.</p>}
        </Card>
      )}
      {!evidence && <p className="rounded-xl border border-stone-200 p-4 text-sm text-stone-500">Chưa có dữ liệu thỏa thuận và giao dịch của đơn đặt chỗ.</p>}
      </div>
      {receiptPayment && rental.reservationId && <Modal open onClose={() => setReceiptPayment(undefined)} title="Biên lai thanh toán" size="lg">
        <BookingTransactionReceipt reservationId={rental.reservationId} paymentId={receiptPayment} />
      </Modal>}
      {showTechnicalWarnings && warnings.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-50 p-4">
          <h4 className="font-semibold">Cần kiểm tra dữ liệu</h4>
          {warnings.map((w, i) => (
            <p key={i}>{rentalDataWarning(w.field)}</p>
          ))}
        </div>
      )}
    </div>
  )
}
