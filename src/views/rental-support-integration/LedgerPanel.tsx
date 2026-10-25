import { useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import { ApiClientError } from "../../services/apiClient"
import {
  getRentalLedger,
  reconcileSandboxPayment,
  integrationError,
  type LedgerRole,
  type LedgerView,
} from "../../services/duongIntegrationApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { rentalDate, rentalMoney } from "../rental-api/presentation"

const kinds = {
  RENT: "Tiền thuê",
  SECURITY_DEPOSIT: "Cọc bảo đảm",
  RENEWAL_DEPOSIT: "Tiền thuê gia hạn trả trước",
  RENEWAL_REMAINDER: "Tiền thuê gia hạn còn lại",
}
export function ledgerReadError(error: unknown): string {
  if (error instanceof ApiClientError && [401, 403, 404, 409].includes(error.status ?? 0))
    return integrationError(error)
  return "Không tải được dữ liệu tài chính. Vui lòng thử lại."
}
export function LedgerContent({ data }: { data: LedgerView }) {
  if (data.completeness === "UNKNOWN")
    return <div><p role="status">Không có dữ liệu</p><CoverageDetails data={data} /></div>
  return (
    <div className="space-y-3 text-sm">
      <CoverageDetails data={data} />
      <h4 className="font-semibold">Các khoản phải thanh toán đã ghi nhận</h4>
      {!data.obligations?.length ? (
        <p>Không có dữ liệu</p>
      ) : (
        data.obligations.map((o) => (
          <div key={o.id} className="rounded border p-3">
            <p>{kinds[o.kind]}</p>
            <p>
              Số tiền: {rentalMoney(o.amount, "VND")}, Còn phải trả:{" "}
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
                  : p.method === "VNPAY_SANDBOX"
                    ? "VNPay Sandbox đã đối soát trong dự án - không thu tiền thật"
                    : "Thanh toán thử nghiệm - không thu tiền thật"}
            </p>
            <p>
              {rentalMoney(p.amount, "VND")}, {rentalDate(p.receivedAt)}
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
            {rentalMoney(f.amount, "VND")},{" "}
            {f.status === "RESERVED"
              ? "Đã dành tiền để hoàn, chưa chuyển tiền"
              : "Đã ghi nhận chi hoàn tiền"}
          </p>
        ))
      )}
    </div>
  )
}
function CoverageDetails({ data }: { data: LedgerView }) {
  const inventory = data.coverageInventory
  if (!inventory) return null
  const labels = [...new Set(inventory.gaps.map(gap => {
    if (gap === "RENEWAL_DEPOSIT_UNPOSTED_OR_INVALID") return "Nghĩa vụ tiền thuê gia hạn trả trước chưa khớp số tiền, hạn trả hoặc nguồn duyệt."
    if (gap === "RENEWAL_APPROVAL_UNCERTIFIED") return "Chưa xác minh quyết định duyệt làm phát sinh tiền thuê gia hạn trả trước."
    if (gap === "RENEWAL_TERMINAL_ACCOUNTING_UNRECONCILED") return "Gia hạn đã kết thúc hoặc hết hạn cần đối soát nghĩa vụ đã ghi."
    if (gap.startsWith("INITIAL_OBLIGATION")) return "Nghĩa vụ tiền thuê hoặc cọc chưa được đối soát."
    if (gap.startsWith("BOOKING_SNAPSHOT") || gap === "BOOKING_SOURCE_MISSING") return "Thông tin giá đã chấp nhận chưa được xác minh đầy đủ."
    if (gap.includes("REFUND")) return "Chưa xác minh hoàn tiền đã được chuyển."
    if (gap === "PAYMENT_DISPUTED") return "Có giao dịch đang được khiếu nại."
    if (gap === "SANDBOX_RECEIPT_BINDING_INVALID") return "Chứng cứ hoặc phân bổ VNPay Sandbox không khớp dữ liệu đã lưu."
    if (gap.includes("PAYMENT") || gap.includes("RECEIPT")) return "Chứng cứ thu tiền chưa được đối soát đầy đủ."
    if (gap.includes("SECURITY_DEPOSIT")) return "Chưa xác minh số tiền cọc đang được giữ."
    if (gap.includes("RENEWAL")) return "Nghĩa vụ gia hạn chưa được xác minh đầy đủ."
    return "Dữ liệu tài chính lịch sử chưa được xác minh đầy đủ."
  }))]
  return <section aria-label="Dữ liệu cần đối soát" className="rounded border border-amber-200 p-3">
    <p className="font-semibold">Dữ liệu cần đối soát</p>
    {inventory.renewalDeposits?.map(deposit => <p key={deposit.acceptedRevisionId}>
      {deposit.status === "NOT_EFFECTIVE" ? "Gia hạn chưa phát sinh nghĩa vụ tiền thuê trả trước từ quyết định duyệt." : deposit.status === "MATCHED" ? "Tiền thuê gia hạn trả trước đã khớp nguồn duyệt và nghĩa vụ đã ghi, chưa xác nhận đã thanh toán."
        : deposit.status === "UNPOSTED_OR_INVALID" ? "Tiền thuê gia hạn trả trước đã có nguồn duyệt, nhưng nghĩa vụ chưa được đối soát."
        : "Tiền thuê gia hạn trả trước chưa có nguồn duyệt được xác minh."}
    </p>)}
    <ul className="list-disc pl-5">{labels.map(label => <li key={label}>{label}</li>)}</ul>
  </section>
}
export function canReconcileSandboxPayment(payment: NonNullable<LedgerView["coverageInventory"]>["payments"][number]) {
  return payment.provenance === "SANDBOX" && payment.eligibleForReconciliation === true && !payment.linkedReceipt && !payment.refundUnreconciled
}
function LedgerRead({ role, id }: {
  role: LedgerRole
  id: string
}) {
  const actor = getAuthenticatedActor()
  const lock = useRef(false)
  const attempt = useRef<{paymentId: string; revision: number; key: string} | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const read = useRentalApiResource(
    `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:ledger:${id}`,
    () => getRentalLedger(role, id),
  )
  const reconcile = async (paymentId: string) => {
    if (lock.current || read.data?.revision == null || (attempt.current && attempt.current.paymentId !== paymentId)) return
    lock.current = true; setBusy(true); setError(undefined)
    attempt.current ??= { paymentId, revision: read.data.revision, key: crypto.randomUUID() }
    setPending(paymentId)
    try {
      await reconcileSandboxPayment(id, paymentId, attempt.current.revision, attempt.current.key)
      attempt.current = undefined; setPending(undefined); read.refresh()
    } catch (e) { setError(integrationError(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  return (
    <div>
      {read.loading && <p role="status">Đang tải dữ liệu...</p>}
      {!!read.error && <p role="alert">{ledgerReadError(read.error)}</p>}
      {read.data && <LedgerContent data={read.data} />}
      {error && <p role="alert">{error} Thử lại cùng yêu cầu để xác định kết quả, không tạo khoản thu mới.</p>}
      {role === "manager" && read.data?.sandboxReconciliationEnabled === true && actor?.permissions.includes("payments:update") && read.data?.revision != null &&
        read.data.coverageInventory?.payments.filter(canReconcileSandboxPayment).map(p => (
          <Button key={p.paymentId} disabled={busy || (!!pending && pending !== p.paymentId)} onClick={() => void reconcile(p.paymentId)}>
            {pending === p.paymentId ? "Thử lại đối soát Sandbox" : "Đối soát VNPay Sandbox"}
          </Button>
        ))}
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
