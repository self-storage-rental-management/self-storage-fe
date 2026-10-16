import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { useRenewalCommand } from '../../hooks/useRenewalCommand'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getAuthenticatedActor } from '../../services/authApi'
import { getRecoveryOperations, recoveryOperationError, sendRecoveryCommand, validateRecoveryCommand, type RecoveryCommand, type RecoveryOperations } from '../../services/recoveryTaskOperationsApi'
import type { ApiReturn } from '../../services/returnApi'
import { EvidenceUpload } from '../rental-support-integration/EvidenceControls'

type ReceiptCommand = Extract<RecoveryCommand, { action: 'settlement-receipts' }>
type Props = { record: ApiReturn; busy: boolean; onChanged: () => void; onLocked: (locked: boolean) => void }

export default function RecoveryReturnSettlement(props: Props) {
  const { record } = props
  const actor = getAuthenticatedActor()
  const read = useRentalApiResource(`${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:recovery-return:${record.id}:${record.status}:${record.recoveryTaskId}`, async () => {
    const view = await getRecoveryOperations('staff', record.recoveryTaskId!)
    if (view.returnCaseId !== record.id) throw new Error('Hồ sơ quyết toán không khớp nhiệm vụ thu hồi.')
    return view
  })
  if (read.loading) return <p role="status">Đang tải thông tin quyết toán...</p>
  if (read.error || !read.data) return <p role="alert">{recoveryOperationError(read.error)} <Button type="button" variant="outline" disabled={props.busy} onClick={read.refresh}>Tải lại</Button></p>
  return <ReceiptForm key={`${read.data.expectedVersion}:${record.status}`} {...props} view={read.data} refresh={read.refresh} />
}

function ReceiptForm({ record, view, busy, onChanged, onLocked, refresh }: Props & { view: RecoveryOperations; refresh: () => void }) {
  const actor = getAuthenticatedActor()
  const command = useRenewalCommand()
  const pending = useRef<ReceiptCommand | null>(null)
  const uploadLock = useRef(false)
  const listener = useRef(onLocked)
  listener.current = onLocked
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER')
  const [confirmed, setConfirmed] = useState(false)
  const [validation, setValidation] = useState('')
  useEffect(() => () => listener.current(false), [])
  const allowed = actor?.status === 'ACTIVE' && actor.roles.includes('STAFF')
    && ['rentals:read', 'returns:process', 'payments:collect'].every(p => actor.permissions.includes(p))
    && ['OPERATE', 'MANAGE'].includes(actor.facilityScopes[record.facilityId])
    && view.status === 'IN_PROGRESS' && view.settlementStatus === record.status
    && !record.settlementBlocker && (record.status === 'payment_due' ? (record.amountDueFromCustomer ?? 0) > 0 : record.status === 'refund_pending' && (record.netRefundAmount ?? 0) > 0)
  const frozen = busy || uploading || command.busy || command.uncertain
  const submit = () => {
    if (!allowed || busy || uploadLock.current || (command.isLocked() && !command.uncertain) || command.conflict) return
    const request: ReceiptCommand = command.uncertain && pending.current ? pending.current : {
      action: 'settlement-receipts', body: { expectedVersion: view.expectedVersion, paymentMethod: method,
        transactionReference: reference.trim(), receiptFileId: files[0], confirmed },
    }
    try { validateRecoveryCommand(request) } catch (error) { setValidation(recoveryOperationError(error)); return }
    pending.current = request
    setValidation('')
    listener.current(true)
    void command.run(JSON.stringify(request), key => sendRecoveryCommand('staff', record.recoveryTaskId!, request, key), () => {
      listener.current(false)
      onChanged()
    }).finally(() => listener.current(uploadLock.current || command.isLocked()))
  }
  return <form className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3" onSubmit={event => { event.preventDefault(); submit() }}>
    <h5 className="font-semibold">{record.status === 'payment_due' ? 'Thu tiền quyết toán thu hồi' : 'Hoàn tiền quyết toán thu hồi'}</h5>
    <fieldset disabled={frozen || !allowed || command.conflict} className="space-y-2">
      <label className="block">Phương thức thanh toán<select className="block w-full rounded border p-2" value={method} onChange={event => setMethod(event.target.value as typeof method)}><option value="BANK_TRANSFER">Chuyển khoản</option><option value="CASH">Tiền mặt</option></select></label>
      <label className="block">Mã giao dịch hoặc biên nhận<input className="block w-full rounded border p-2" required maxLength={64} value={reference} onChange={event => setReference(event.target.value)} /></label>
      <EvidenceUpload entityType="DUONG_RECOVERY_SETTLEMENT" entityId={record.recoveryTaskId!} label="Biên lai quyết toán" limit={1} value={files} onChange={setFiles}
        disabled={frozen || !allowed || command.conflict} onBusy={value => { uploadLock.current = value; setUploading(value); listener.current(value || command.isLocked()) }} />
      <label className="block"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Tôi xác nhận đã thực thu hoặc thực hoàn đúng số tiền quyết toán, kèm biên lai đã đối chiếu.</label>
    </fieldset>
    {validation && <p role="alert">{validation}</p>}
    {!!command.error && <p role="alert">{recoveryOperationError(command.error)}</p>}
    {command.conflict
      ? <Button type="button" disabled={busy || uploading} onClick={() => { refresh(); onChanged() }}>Tải lại dữ liệu</Button>
      : <Button type="submit" disabled={!allowed || busy || uploading || command.busy || (!command.uncertain && (!reference.trim() || !files.length || !confirmed))}>{command.busy ? 'Đang lưu...' : command.uncertain ? 'Gửi lại cùng yêu cầu' : record.status === 'payment_due' ? 'Xác nhận đã thu tiền' : 'Xác nhận đã hoàn tiền'}</Button>}
  </form>
}
