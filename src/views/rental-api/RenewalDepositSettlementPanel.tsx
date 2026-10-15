import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand, isUncertainRenewalOutcome } from "../../hooks/useRenewalCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import { executeDepositRefund, getDepositSettlement, type RefundExecutionBody } from "../../services/renewalDepositSettlementApi"
import type { RenewalOperationsRole } from "../../types/renewalOperationsApi"
import { EvidenceUpload } from "../rental-support-integration/EvidenceControls"
import { rentalError, rentalMoney } from "./presentation"

const labels = { HELD: "Đã ghi nhận cọc", AWAITING_RECOVERY_DEADLINE: "Chờ mốc xử lý cọc ngày quá hạn thứ 8", APPLIED_TO_RENT: "Đã tính vào tiền thuê", REVIEW_REQUIRED: "Chờ xác minh nguyên nhân", FORFEITED: "Đã ghi nhận mất cọc gia hạn", REFUND_ELIGIBLE: "Đủ điều kiện xem xét hoàn cọc", REFUND_APPROVED: "Đã duyệt, chờ hoàn cọc", REFUNDED: "Đã ghi nhận hoàn cọc", UNKNOWN: "Chưa xác minh", NOT_APPLICABLE: "Không áp dụng" }
export default function RenewalDepositSettlementPanel({ id, role, revision, onLocked, onChanged }: {
  id: string; role: RenewalOperationsRole; revision?: number | null; onLocked: (value: boolean) => void; onChanged: () => void
}) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${id}:deposit-settlement:${revision}`
  const read = useRentalApiResource(identity, () => getDepositSettlement(role,id))
  const command = useRenewalCommand()
  const payload = useRef<RefundExecutionBody | undefined>(undefined)
  const [file, setFile] = useState("")
  const [reference, setReference] = useState("")
  const [attested, setAttested] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadRef = useRef(false)
  const locked = uploading || command.busy || command.uncertain
  const uploadBusy = useCallback((value: boolean) => { uploadRef.current = value; setUploading(value); onLocked(value || command.isLocked()) }, [onLocked,command.isLocked])
  useEffect(() => { onLocked(uploadRef.current || command.isLocked()) }, [locked,onLocked])
  const settlement = read.data
  if (read.loading) return null
  if (read.error) return null
  if (!settlement || ["UNKNOWN","NOT_APPLICABLE","APPLIED_TO_RENT","HELD"].includes(settlement.status)) return null
  const canRecord = role === "manager" && actor?.permissions.includes("payments:collect") && actor.permissions.includes("rentals:update") && settlement.status === "REFUND_APPROVED"
  return <Card className="space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Cọc gia hạn</h3><p className="mt-1 text-sm text-stone-600">{labels[settlement.status]}{settlement.environment === "SANDBOX" ? " (Sandbox)" : ""}</p></div>
      <p className="font-semibold">{rentalMoney(settlement.amount,settlement.currency)}</p>
    </div>
    {settlement.status === "REVIEW_REQUIRED" && <p className="text-sm text-stone-500">Cần xác minh sự cố và nguyên nhân trước khi quyết định xử lý cọc.</p>}
    {canRecord && <div className="space-y-3 border-t border-stone-100 pt-4">
      <p className="text-sm text-stone-600">{settlement.environment === "SANDBOX" ? "Ghi nhận chứng từ hoàn cọc Sandbox. Thao tác này không xác nhận chuyển tiền thật." : "Sau khi thực hiện khoản hoàn, tải chứng từ và xác nhận để ghi nhận kết quả."}</p>
      <fieldset disabled={locked} className="space-y-3">
        <label className="block text-sm">Mã giao dịch hoàn cọc<input className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2" value={reference} maxLength={100} onChange={event => setReference(event.target.value)} /></label>
        <EvidenceUpload entityType="DUONG_RENEWAL_REFUND" entityId={id} value={file ? [file] : []} limit={1} disabled={locked} onChange={ids => setFile(ids[0] ?? "")} onBusy={uploadBusy} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} />Tôi xác nhận khoản hoàn đã được thực hiện và chứng từ đúng với hồ sơ này.</label>
      </fieldset>
      {Boolean(command.error) && <p role="alert" className="text-sm text-red-700">{rentalError(command.error)}</p>}
      {command.uncertain && <p role="status" className="text-sm text-amber-800">Chưa xác định kết quả. Thử lại cùng yêu cầu để kiểm tra, không tạo khoản hoàn mới.</p>}
      <Button disabled={uploading || command.busy || command.conflict || !file || !reference.trim() || !attested || settlement.expectedVersion === null} onClick={() => {
        if (uploadRef.current || command.isLocked() && !command.uncertain) return
        payload.current ??= { refundId: settlement.refundId!,receiptFileId: file,transactionReference: reference.trim(),transferred: true as const,expectedVersion: settlement.expectedVersion! }
        const body = payload.current
        onLocked(true)
        void command.run(JSON.stringify({ id,body }),async key => {
          try { return await executeDepositRefund(id,body,key) }
          catch(error) { if (!command.uncertain && !isUncertainRenewalOutcome(error)) payload.current = undefined; throw error }
        },() => { payload.current = undefined;read.refresh();onChanged() })
          .finally(() => onLocked(uploadRef.current || command.isLocked()))
      }}>{command.busy ? "Đang ghi nhận..." : command.uncertain ? "Thử lại cùng yêu cầu" : "Xác nhận đã hoàn cọc"}</Button>
    </div>}
  </Card>
}
