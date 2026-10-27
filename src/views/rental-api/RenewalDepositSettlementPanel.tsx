import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Card } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { useRenewalCommand, isUncertainRenewalOutcome } from "../../hooks/useRenewalCommand"
import { getAuthenticatedActor } from "../../services/authApi"
import { executeDepositRefund, getDepositSettlement, resolvePreparation, type RefundExecutionBody, type PreparationResolutionBody, type DepositSettlement } from "../../services/renewalDepositSettlementApi"
import type { RenewalOperationsRole } from "../../types/renewalOperationsApi"
import { EvidenceUpload } from "../rental-support-integration/EvidenceControls"
import { rentalError, rentalMoney } from "./presentation"

const labels = { AWAITING_FAULT_REVIEW: "Giữ tiền thuê trả trước, chờ xác minh trách nhiệm", FACILITY_FAULT: "Giữ tiền thuê trả trước để xử lý sự cố từ cơ sở", HELD: "Đã ghi nhận tiền thuê trả trước", AWAITING_RECOVERY_DEADLINE: "Chờ mốc xử lý tiền thuê trả trước ngày quá hạn thứ 8", APPLIED_TO_RENT: "Đã tính vào tiền thuê", REVIEW_REQUIRED: "Chờ xác minh nguyên nhân", FORFEITED: "Đã ghi nhận mất tiền thuê gia hạn trả trước", REFUND_ELIGIBLE: "Đủ điều kiện xem xét hoàn tiền thuê trả trước", REFUND_APPROVED: "Đã duyệt, chờ hoàn tiền thuê trả trước", REFUNDED: "Đã ghi nhận hoàn tiền thuê trả trước", UNKNOWN: "Chưa xác minh", NOT_APPLICABLE: "Không áp dụng" }
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
  const canRecord = role === "staff" && actor?.permissions.includes("payments:collect") && actor.permissions.includes("renewals:operate") && actor.permissions.includes("refunds:execute") && settlement.status === "REFUND_APPROVED"
  const canResolve = role === 'manager' && actor?.status === 'ACTIVE' && actor.roles.includes('MANAGER')
    && ['rentals:read','rentals:update','payments:read','payments:collect','refunds:approve'].every(permission => actor.permissions.includes(permission))
    && settlement.status === 'PREPARATION_BLOCKED'
  return <Card className="space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Tiền thuê gia hạn trả trước</h3><p className="mt-1 text-sm text-stone-600">{settlement.status === 'PREPARATION_BLOCKED' ? 'Đã thu tiền, đang chờ xử lý bước chuẩn bị ký' : labels[settlement.status]}{settlement.environment === "SANDBOX" ? " (Sandbox)" : ""}</p></div>
      <p className="font-semibold">{rentalMoney(settlement.amount,settlement.currency)}</p>
    </div>
    {settlement.status === "REVIEW_REQUIRED" && <p className="text-sm text-stone-500">Cần xác minh sự cố và nguyên nhân trước khi quyết định xử lý tiền thuê trả trước.</p>}
    {settlement.status === 'PREPARATION_BLOCKED' && <p className="text-sm text-stone-600">Khoản thu đã được đối soát nhưng chưa chuẩn bị được ký gia hạn. Cơ sở cần kiểm tra khả năng tiếp tục hoặc duyệt hoàn tiền. Trường hợp này không được tự coi là khách không đến.</p>}
    {canResolve && <PreparationResolutionForm id={id} settlement={settlement} onLocked={onLocked} onChanged={() => { read.refresh();onChanged() }} />}
    {canRecord && <div className="space-y-3 border-t border-stone-100 pt-4">
      <p className="text-sm text-stone-600">{settlement.environment === "SANDBOX" ? "Ghi nhận chứng từ hoàn tiền thuê trả trước Sandbox. Thao tác này không xác nhận chuyển tiền thật." : "Sau khi thực hiện khoản hoàn, tải chứng từ và xác nhận để ghi nhận kết quả."}</p>
      <fieldset disabled={locked} className="space-y-3">
        <label className="block text-sm">Mã giao dịch hoàn tiền thuê trả trước<input className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2" value={reference} maxLength={100} onChange={event => setReference(event.target.value)} /></label>
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
      }}>{command.busy ? "Đang ghi nhận..." : command.uncertain ? "Thử lại cùng yêu cầu" : "Xác nhận đã hoàn tiền thuê trả trước"}</Button>
    </div>}
  </Card>
}

function PreparationResolutionForm({ id,settlement,onLocked,onChanged }: {
  id: string; settlement: DepositSettlement; onLocked: (value: boolean) => void; onChanged: () => void
}) {
  const command = useRenewalCommand()
  const [reason,setReason] = useState('')
  const [files,setFiles] = useState<string[]>([])
  const [unavailable,setUnavailable] = useState(false)
  const [uploading,setUploading] = useState(false)
  const uploadRef = useRef(false)
  const payload = useRef<PreparationResolutionBody | undefined>(undefined)
  const locked = uploading || command.busy || command.uncertain
  const uploadBusy = useCallback((value: boolean) => {
    uploadRef.current=value;setUploading(value);onLocked(value || command.isLocked())
  },[onLocked,command.isLocked])
  useEffect(() => { onLocked(uploading || command.isLocked()) },[uploading,command.busy,command.uncertain,onLocked,command.isLocked])
  const ready = !!reason.trim() && files.length > 0 && !!settlement.preparationPaymentId && settlement.expectedVersion != null
  const submit = (action: 'RETRY' | 'REFUND') => {
    if (uploadRef.current || command.isLocked() && !command.uncertain || !ready) return
    payload.current ??= {
      paymentId: settlement.preparationPaymentId!,action,serviceUnavailable: unavailable,reason: reason.trim(),
      evidenceFileIds: [...files],expectedVersion: settlement.expectedVersion!,
    }
    const body=payload.current
    onLocked(true)
    void command.run(JSON.stringify({ id,body }),async key => {
      try { return await resolvePreparation(id,body,key) }
      catch(error) { if (!isUncertainRenewalOutcome(error)) payload.current=undefined;throw error }
    },() => { payload.current=undefined;onChanged() })
      .finally(() => onLocked(uploadRef.current || command.isLocked()))
  }
  return <div className="space-y-3 border-t border-stone-100 pt-4">
    <fieldset disabled={locked} className="space-y-3">
      <label className="block text-sm">Kết quả kiểm tra của cơ sở
        <textarea className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2" rows={3} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} />
      </label>
      <EvidenceUpload entityType="DUONG_RENEWAL_REFUND" entityId={id} value={files} limit={10} disabled={locked} onChange={setFiles} onBusy={uploadBusy} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={unavailable} onChange={event => setUnavailable(event.target.checked)} />Tôi xác nhận cơ sở không thể thực hiện kỳ gia hạn này và đề nghị hoàn khoản đã thu chưa sử dụng.</label>
    </fieldset>
    <p className="text-xs text-stone-500">Duyệt hoàn chưa xác nhận đã chuyển tiền. Nhân viên khác thực hiện khoản hoàn và lưu chứng từ.</p>
    {Boolean(command.error) && <p role="alert" className="text-sm text-red-700">{rentalError(command.error)}</p>}
    {command.uncertain ? <>
      <p role="status" className="text-sm text-amber-800">Chưa xác định kết quả. Thử lại đúng yêu cầu trước đó để tránh xử lý trùng.</p>
      <Button disabled={uploading || command.busy} onClick={() => { if(payload.current)submit(payload.current.action) }}>Thử lại cùng yêu cầu</Button>
    </> : <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={locked || command.conflict || !ready || !settlement.preparationRetryAllowed} onClick={() => submit('RETRY')}>Yêu cầu chuẩn bị ký lại</Button>
      <Button disabled={locked || command.conflict || !ready || !unavailable} onClick={() => submit('REFUND')}>{command.busy ? 'Đang xử lý...' : 'Duyệt hoàn khoản đã thu'}</Button>
    </div>}
  </div>
}
