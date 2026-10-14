import { useManagerPresentation } from "../manager/managerPresentation"
import RenewalRiskNotice from "./RenewalRiskNotice"
import RentalHandoverFiles from "./RentalHandoverFiles"
import { Badge, Button, Card } from "../../components/ui"
import type { RentalApiDetail } from "../../types/rentalApi"
import {
  bookingPaymentPurposes,
  bookingPaymentStatuses,
  bookingPaymentVerification,
} from "../../services/rentalBookingEvidence"
import {
  rentalDate,
  rentalLabels,
  rentalMoney,
  unknown,
  accessStatusLabels,
  rentalDataWarning,
  rentalPeriodText,
} from "./presentation"

const labelClass = "text-[13px] font-normal text-slate-500"
const valueClass = "mt-0.5 font-medium text-slate-900"

export default function RentalDetail({
  rental,
  onRequest,
  role = "customer",
  showTechnicalWarnings = true,
}: {
  rental: RentalApiDetail
  onRequest?: () => void
  role?: "customer" | "manager"
  showTechnicalWarnings?: boolean
}) {
  const { copy } = useManagerPresentation()

  const f = rental.financialSummary
  const evidence = rental.bookingEvidence
  const agreed = evidence?.agreedAmounts
  const accessStatus = rental.access.completeness === "UNKNOWN"
    ? null
    : accessStatusLabels[rental.access.status?.toUpperCase() || ""] || null
  const paymentStatus = f.completeness === "UNKNOWN"
    ? unknown
    : f.completeness === "PARTIAL"
      ? "Đã xác minh một phần"
      : (f.overdueAmount ?? 0) > 0
        ? `Quá hạn: ${rentalMoney(f.overdueAmount, f.currency)}`
        : `Đang đúng hạn (Dư nợ: ${rentalMoney(f.outstandingAmount, f.currency)})`

  return (
    <div className="space-y-4">
      {rental.status === "active" && <RenewalRiskNotice rentalId={rental.id} role={role} />}

      <Card className="p-4 sm:p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Hồ sơ thuê</h3>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className={labelClass}>Mã hồ sơ thuê</dt>
            <dd className={`${valueClass} flex items-center gap-2`}>
              <span title={rental.id}>#{rental.id.slice(0, 8)}</span>
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
            <dt className={labelClass}>Cơ sở / Gian kho</dt>
            <dd className={valueClass}>{rental.facility.name} / {rental.storageUnit.code}</dd>
          </div>
          <div>
            <dt className={labelClass}>Loại gian kho</dt>
            <dd className={valueClass}>{copy(rental.unitType.name)}</dd>
          </div>
          <div>
            <dt className={labelClass}>Thời hạn sử dụng</dt>
            <dd className={valueClass}>{rentalPeriodText(rental, showTechnicalWarnings)}</dd>
          </div>
          <div>
            <dt className={labelClass}>Đơn giá / tháng</dt>
            <dd className={valueClass}>{rentalMoney(rental.monthlyPrice, rental.currency)}</dd>
          </div>
          <div>
            <dt className={labelClass}>Trạng thái hồ sơ</dt>
            <dd className="mt-1">
              {rental.status === "active"
                ? <Badge variant="success">{copy(rentalLabels[rental.status])}</Badge>
                : <span className={valueClass}>{copy(rentalLabels[rental.status])}</span>}
            </dd>
          </div>
          {accessStatus && (
            <div>
              <dt className={labelClass}>Trạng thái truy cập</dt>
              <dd className={valueClass}>{accessStatus}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className={labelClass}>Tình trạng thanh toán</dt>
            <dd className={valueClass}>{paymentStatus}</dd>
            {f.completeness === "COMPLETE" && f.billingMode === "PREPAID_FULL_PERIOD" && (
              <p className="mt-1 text-xs text-slate-500">Đã thanh toán trước toàn kỳ; không có kỳ thu định kỳ.</p>
            )}
            {f.completeness === "COMPLETE" && f.billingMode !== "PREPAID_FULL_PERIOD" && f.nextDueDate && (
              <p className="mt-1 text-xs text-slate-500">Kỳ thanh toán tiếp theo: {rentalDate(f.nextDueDate)}</p>
            )}
          </div>
        </dl>
      </Card>

      {evidence && (
        <Card className="p-4 sm:p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Tài chính ban đầu</h3>
          {agreed ? (
            <>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
                {([
                  ["Tiền thuê kỳ đầu", agreed.netRentalAmount],
                  ["Tiền cọc bảo đảm", agreed.securityDepositAmount],
                  ["Tổng giá trị ban đầu", agreed.totalInitialObligation],
                ] as const).map(([label, amount]) => (
                  <div key={label}>
                    <dt className={labelClass}>{label}</dt>
                    <dd className={valueClass}>{rentalMoney(amount, evidence.currency)}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-4 border-t border-slate-200 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-950">Xem chi tiết ban đầu</summary>
                <div className="mt-3 space-y-4">
                  <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {([
                      ["Tiền đặt chỗ", agreed.reservationDepositAmount],
                      ["Tiền thuê còn lại sau đặt chỗ", agreed.remainingRentalAmount],
                      ["Khoản phải thanh toán khi nhận kho", agreed.dueAtCheckIn],
                    ] as const).map(([label, amount]) => (
                      <div key={label}>
                        <dt className={labelClass}>{label}</dt>
                        <dd className={valueClass}>{rentalMoney(amount, evidence.currency)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-slate-500">Đây là số tiền theo thỏa thuận ban đầu, không xác nhận số tiền đã thu hoặc dư nợ hiện tại.</p>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-800">Giao dịch đặt chỗ</h4>
                    {evidence.payments.length === 0 ? <p className="text-sm text-slate-500">Không có dữ liệu</p> : (
                      <ul className="divide-y divide-slate-100">
                        {evidence.payments.map(payment => (
                          <li key={payment.id} className="space-y-1 py-3 text-sm">
                            <p><span className={labelClass}>{bookingPaymentPurposes[payment.purpose]}</span>: <span className="font-medium text-slate-900">{rentalMoney(payment.amount, evidence.currency)}</span></p>
                            <p><span className={labelClass}>Trạng thái:</span> {bookingPaymentStatuses[payment.status]}</p>
                            <p className="text-xs text-slate-500">{bookingPaymentVerification[payment.verification]}</p>
                            {payment.projectRecognition && <p role="status" className="text-xs text-slate-500">
                              {payment.projectRecognition.eligibleForReconciliation
                                ? "Chứng cứ VNPay Sandbox hợp lệ để đối soát trong dự án; chưa xác nhận phân bổ vào sổ công nợ."
                                : "Giao dịch chưa đủ điều kiện đối soát theo chính sách VNPay Sandbox của dự án."}
                            </p>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {evidence.paymentsTruncated && <p role="status" className="mt-2 text-xs text-slate-500">Chỉ hiển thị 20 giao dịch gần nhất.</p>}
                  </div>
                </div>
              </details>
            </>
          ) : <p className="text-sm text-slate-500">Không có dữ liệu</p>}
        </Card>
      )}

      <RentalHandoverFiles key={`${role}:${rental.id}`} role={role} id={rental.id} />

      {onRequest && (
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end border-t border-stone-200 bg-white/95 px-1 py-3 backdrop-blur">
          <Button disabled={rental.status !== "active"} onClick={onRequest}>
            Yêu cầu gia hạn
          </Button>
        </div>
      )}

      {showTechnicalWarnings && rental.dataWarnings.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-50 p-4">
          <h4 className="font-semibold">Cần kiểm tra dữ liệu</h4>
          {rental.dataWarnings.map((w, i) => (
            <p key={i}>{rentalDataWarning(w.field)}</p>
          ))}
        </div>
      )}
    </div>
  )
}
