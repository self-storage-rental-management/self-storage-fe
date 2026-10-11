import { useManagerPresentation } from "../manager/managerPresentation"
import { Button, Card } from "../../components/ui"
import type { RentalApiDetail } from "../../types/rentalApi"
import { bookingPaymentPurposes, bookingPaymentStatuses } from "../../services/rentalBookingEvidence"
import { rentalDate, rentalLabels, rentalMoney, unknown, accessStatusLabels, rentalDataWarning, rentalPeriodText } from "./presentation"
export default function RentalDetail({
  rental,
  onRequest,
}: {
  rental: RentalApiDetail
  onRequest?: () => void
}) {
  const { copy } = useManagerPresentation()

  const f = rental.financialSummary
  const evidence = rental.bookingEvidence
  const agreed = evidence?.agreedAmounts
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-bold mb-3">Hồ sơ thuê</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-bold">Mã hồ sơ thuê</dt>
            <dd className="break-all font-semibold">{rental.id}</dd>
          </div>
          <div>
            <dt className="font-bold">Khách hàng</dt>
            <dd>{rental.customer.fullName}</dd>
          </div>
          <div>
            <dt className="font-bold">Cơ sở / Gian kho</dt>
            <dd>
              {rental.facility.name} / {rental.storageUnit.code}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Loại gian kho</dt>
            <dd>{copy(rental.unitType.name)}</dd>
          </div>
          <div>
            <dt className="font-bold">Trạng thái</dt>
            <dd>{copy(rentalLabels[rental.status])}</dd>
          </div>
          <div>
            <dt className="font-bold">{rental.dateSemantics?.completeness === "COMPLETE" ? "Thời hạn sử dụng" : "Ngày thuê đang lưu"}</dt>
            <dd>
              {rentalPeriodText(rental)}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Trạng thái truy cập</dt>
            <dd>
              {rental.access.completeness === "UNKNOWN"
                ? unknown
                : accessStatusLabels[rental.access.status?.toUpperCase() || ""] || unknown}
            </dd>
          </div>
        </dl>
      </Card>
      <Card className="p-4">
        <h3 className="font-bold mb-3">Theo dõi quá hạn</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-bold">Tình trạng tài chính</dt>
            <dd>{f.completeness === "UNKNOWN" ? unknown :
              f.completeness === "PARTIAL" ? "Đã xác minh một phần" : "Đã xác minh đầy đủ"}</dd>
          </div>
          <div>
            <dt className="font-bold">Hạn nghĩa vụ thanh toán kế tiếp</dt>
            <dd>
              {f.completeness === "UNKNOWN"
                ? unknown
                : f.billingMode === "PREPAID_FULL_PERIOD"
                  ? copy("Trả trước toàn kỳ, không có kỳ thu tiền định kỳ")
                  : rentalDate(f.nextDueDate)}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Dư nợ / Quá hạn</dt>
            <dd>
              {f.completeness === "UNKNOWN" ? (
                unknown
              ) : (
                <>
                  {rentalMoney(f.outstandingAmount, f.currency)} /{" "}
                  {rentalMoney(f.overdueAmount, f.currency)}
                </>
              )}
            </dd>
          </div>
        </dl>
      </Card>
      {onRequest && (
        <Card className="p-4 space-y-3">
          <h3 className="font-bold">Gia hạn</h3>
          <Button disabled={rental.status !== "active"} onClick={onRequest}>
            Yêu cầu gia hạn
          </Button>
          {rental.status !== "active" && (
            <p>
              Chỉ có thể yêu cầu gia hạn khi hồ sơ đang hiệu lực và chưa yêu cầu trả kho.
            </p>
          )}
        </Card>
      )}
      {evidence && (
        <Card className="p-4">
          <h3 className="font-bold mb-3">Thỏa thuận ban đầu</h3>
          {agreed ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {([
                ["Tiền thuê theo thỏa thuận", agreed.netRentalAmount],
                ["Tiền đặt chỗ theo thỏa thuận", agreed.reservationDepositAmount],
                ["Cọc bảo đảm theo thỏa thuận", agreed.securityDepositAmount],
                ["Tiền thuê còn lại sau khoản đặt chỗ", agreed.remainingRentalAmount],
                ["Khoản phải thanh toán khi nhận kho", agreed.dueAtCheckIn],
                ["Tổng tiền thuê và cọc ban đầu", agreed.totalInitialObligation],
              ] as const).map(([label, amount]) => (
                <div key={label}><dt className="font-bold">{label}</dt><dd>{rentalMoney(amount, evidence.currency)}</dd></div>
              ))}
            </dl>
          ) : <p>Không có dữ liệu</p>}
          <p className="mt-3 text-sm">Đây là số tiền theo thỏa thuận ban đầu, không phải xác nhận đã thu tiền hoặc dư nợ hiện tại.</p>
          <h4 className="font-bold mt-4 mb-2">Giao dịch của đơn đặt chỗ</h4>
          {evidence.payments.length === 0 ? <p>Không có dữ liệu</p> : (
            <ul className="space-y-3">
              {evidence.payments.map(payment => (
                <li key={payment.id} className="border-t pt-3">
                  <p><strong>{bookingPaymentPurposes[payment.purpose]}:</strong> {rentalMoney(payment.amount, evidence.currency)}</p>
                  <p><strong>Trạng thái:</strong> {bookingPaymentStatuses[payment.status]}</p>
                  <p role="status">{payment.verification === "SIMULATED"
                    ? "Thanh toán thử nghiệm - không thu tiền thật"
                    : "Chưa có bằng chứng xác minh tiền thực nhận"}</p>
                </li>
              ))}
            </ul>
          )}
          {evidence.paymentsTruncated && <p role="status" className="mt-3">Chỉ hiển thị 20 giao dịch gần nhất, chưa phải toàn bộ lịch sử.</p>}
        </Card>
      )}
      {rental.dataWarnings.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-50 p-4">
          <h4 className="font-semibold">Cần kiểm tra dữ liệu</h4>
          {rental.dataWarnings.map((w, i) => (
            <p key={i}>
              {rentalDataWarning(w.field)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
