import { useState } from "react"
import { Button, Card } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  getRentalLedger,
  integrationError,
  type LedgerRole,
  type LedgerView,
} from "../../services/duongIntegrationApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { rentalDate, rentalMoney } from "../rental-api/presentation"

const kinds = {
  RENT: "Tiền thuê",
  SECURITY_DEPOSIT: "Cọc bảo đảm",
  RENEWAL_DEPOSIT: "Cọc gia hạn",
  RENEWAL_REMAINDER: "Tiền thuê gia hạn còn lại",
}
export function LedgerContent({ data }: { data: LedgerView }) {
  if (data.completeness === "UNKNOWN")
    return <p role="status">Không có dữ liệu</p>
  return (
    <div className="space-y-3 text-sm">
      <p role="status" className="rounded bg-amber-50 p-3 text-amber-900">
        Dữ liệu tài chính chưa được xác minh đầy đủ. Các khoản dưới đây không
        xác nhận toàn bộ công nợ.
      </p>
      <h4 className="font-semibold">Các khoản phải thanh toán đã ghi nhận</h4>
      {!data.obligations?.length ? (
        <p>Không có dữ liệu</p>
      ) : (
        data.obligations.map((o) => (
          <div key={o.id} className="rounded border p-3">
            <p>{kinds[o.kind]}</p>
            <p>
              Số tiền: {rentalMoney(o.amount, "VND")} · Còn phải trả:{" "}
              {rentalMoney(o.outstanding, "VND")}
            </p>
            <p>Hạn thanh toán: {rentalDate(o.dueAt)}</p>
          </div>
        ))
      )}
      <h4 className="font-semibold">Các khoản thu đã ghi nhận</h4>
      {!data.receipts?.length ? (
        <p>Không có dữ liệu</p>
      ) : (
        data.receipts.map((p) => (
          <div key={p.id} className="rounded border p-3">
            <p>
              {p.method === "CASH"
                ? "Tiền mặt"
                : p.method === "VERIFIED_BANK"
                  ? "Chuyển khoản đã xác minh"
                  : "Thanh toán thử nghiệm - không thu tiền thật"}
            </p>
            <p>
              {rentalMoney(p.amount, "VND")} · {rentalDate(p.receivedAt)}
            </p>
          </div>
        ))
      )}
      <h4 className="font-semibold">Hoàn tiền</h4>
      {!data.refunds?.length ? (
        <p>Không có dữ liệu</p>
      ) : (
        data.refunds.map((f) => (
          <p key={f.id}>
            {rentalMoney(f.amount, "VND")} ·{" "}
            {f.status === "RESERVED"
              ? "Đã dành tiền để hoàn, chưa chuyển tiền"
              : "Đã ghi nhận chi hoàn tiền"}
          </p>
        ))
      )}
    </div>
  )
}
function LedgerRead({ role, id }: {
  role: LedgerRole
  id: string
}) {
  const actor = getAuthenticatedActor()
  const read = useRentalApiResource(
    `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:ledger:${id}`,
    () => getRentalLedger(role, id),
  )
  return (
    <div>
      {read.loading && <p role="status">Đang tải dữ liệu...</p>}
      {!!read.error && <p role="alert">{integrationError(read.error)}</p>}
      {read.data && <LedgerContent data={read.data} />}
    </div>
  )
}
export default function LedgerPanel({
  role,
  id,
}: {
  role: LedgerRole
  id: string
}) {
  const [open, setOpen] = useState(false)
  const actor = getAuthenticatedActor()
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    !actor.roles.includes(
      role === "business"
        ? "BUSINESS"
        : role === "manager"
          ? "MANAGER"
          : "CUSTOMER",
    ) ||
    (role !== "customer" &&
      !["rentals:read", "payments:read"].every((p) =>
        actor.permissions.includes(p),
      ))
  )
    return null
  return (
    <Card className="p-4 space-y-3">
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open
          ? "Ẩn các khoản tài chính"
          : "Xem các khoản tài chính đã ghi nhận"}
      </Button>
      {open && (
        <LedgerRead key={`${actor.id}:${role}:${id}`} role={role} id={id} />
      )}
    </Card>
  )
}
