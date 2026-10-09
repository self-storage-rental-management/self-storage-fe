import { useManagerPresentation } from "../manager/managerPresentation"
import { Button, Card } from "../../components/ui"
import type { RentalApiDetail } from "../../types/rentalApi"
import { rentalDate, rentalLabels, rentalMoney, unknown, accessStatusLabels, rentalDataWarning, rentalPeriodText } from "./presentation"
export default function RentalDetail({
  rental,
  onRequest,
}: {
  rental: RentalApiDetail
  onRequest?: () => void
}) {
  const { manager, copy, explain } = useManagerPresentation()

  const f = rental.financialSummary
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-bold mb-3">Hồ sơ thuê</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt>Mã hồ sơ thuê</dt>
            <dd className="break-all font-semibold">{rental.id}</dd>
          </div>
          <div>
            <dt>Khách hàng</dt>
            <dd>{rental.customer.fullName}</dd>
          </div>
          <div>
            <dt>Cơ sở / Gian kho</dt>
            <dd>
              {rental.facility.name} / {rental.storageUnit.code}
            </dd>
          </div>
          <div>
            <dt>Loại gian kho</dt>
            <dd>{copy(rental.unitType.name)}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>{copy(rentalLabels[rental.status])}</dd>
          </div>
          <div>
            <dt>{rental.dateSemantics?.completeness === "COMPLETE" ? "Thời hạn sử dụng" : "Ngày thuê đang lưu"}</dt>
            <dd>
              {rentalPeriodText(rental)}
            </dd>
          </div>
          <div>
            <dt>Đơn giá áp dụng / tháng</dt>
            <dd>{rentalMoney(rental.monthlyPrice, rental.currency)}</dd>
          </div>
          <div>
            <dt>Cọc hồ sơ thuê</dt>
            <dd>{f.completeness === "COMPLETE" ? rentalMoney(f.securityDepositAmount ?? null, f.currency) : unknown}</dd>
          </div>
          <div>
            <dt>Tình trạng tài chính</dt>
            <dd>{f.completeness === "UNKNOWN" ? unknown :
              f.completeness === "PARTIAL" ? "Đã xác minh một phần" : "Đã xác minh đầy đủ"}</dd>
          </div>
          <div>
            <dt>Hạn nghĩa vụ thanh toán kế tiếp</dt>
            <dd>
              {f.completeness === "UNKNOWN"
                ? unknown
                : f.billingMode === "PREPAID_FULL_PERIOD"
                  ? copy("Trả trước toàn kỳ, không có kỳ thu tiền định kỳ")
                  : rentalDate(f.nextDueDate)}
            </dd>
          </div>
          <div>
            <dt>Dư nợ / Quá hạn</dt>
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
          <div>
            <dt>Trạng thái truy cập</dt>
            <dd>
              {rental.access.completeness === "UNKNOWN"
                ? unknown
                : accessStatusLabels[rental.access.status?.toUpperCase() || ""] || unknown}
            </dd>
          </div>
        </dl>
      </Card>
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
      {onRequest && (
        <>
          <Button disabled={rental.status !== "active"} onClick={onRequest}>
            Yêu cầu gia hạn
          </Button>
          {rental.status !== "active" && (
            <p>
              Chỉ có thể yêu cầu gia hạn khi hồ sơ đang hiệu lực và chưa yêu cầu trả kho.</p>
          )}
        </>
      )}
    </div>
  )
}
