import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { Button } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { useRenewalCommand } from '../../hooks/useRenewalCommand'
import { getAuthenticatedActor } from '../../services/authApi'
import { getReturn, type InspectionInput } from '../../services/returnApi'
import { recoveryOperationError, sendRecoveryCommand, validateRecoveryCommand, type RecoveryCommand, type RecoveryOperations } from '../../services/recoveryTaskOperationsApi'
import type { RecoveryAudience, RecoveryTask } from '../../services/recoveryTasksApi'
import { EvidenceDownload, EvidenceUpload } from '../rental-support-integration/EvidenceControls'
import { rentalDate } from './presentation'

export type RecoveryCloseGuard = MutableRefObject<() => boolean>
export function recoveryAction(view: RecoveryOperations): RecoveryCommand['action'] | null {
  if (view.status === 'OPEN') return 'start'
  if (view.status !== 'IN_PROGRESS') return null
  if (!view.returnCaseId) return 'inspection'
  if (view.settlementStatus === 'payment_due' || view.settlementStatus === 'refund_pending') return 'settlement-receipts'
  if (view.settlementStatus === 'completed') return 'completion'
  return null
}
const feeLabels = { damageFee: 'Phí hư hỏng', cleaningFee: 'Phí vệ sinh', lostItemFee: 'Phí mất đồ', overdueFee: 'Phí quá hạn', outstandingFee: 'Công nợ còn lại' } as const
const actionLabels = { start: 'Bắt đầu xử lý', inspection: 'Lưu kiểm kê', 'settlement-receipts': 'Ghi nhận quyết toán', completion: 'Hoàn tất thu hồi và giải phóng kho' }
const money = (v: number) => `${v.toLocaleString('vi-VN')} đ`
const inputClass = 'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-100'
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-stone-700">{label}{children}</label>
}
function Check({ name, children }: { name: string; children: ReactNode }) {
  return <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={name} className="mt-1" />{children}</label>
}

export default function RecoveryTaskOperationsPanel({ role, task, view, identity, refresh, closeGuard, onSuccess }: {
  role: RecoveryAudience; task: RecoveryTask; view: RecoveryOperations; identity: string
  refresh: () => void; closeGuard?: RecoveryCloseGuard; onSuccess: (message: string) => void
}) {
  const actor = getAuthenticatedActor()
  const canProcess = actor?.status === 'ACTIVE' && actor.roles.includes(role === 'staff' ? 'STAFF' : 'MANAGER')
    && actor.permissions.includes('rentals:read') && actor.permissions.includes('returns:process')
    && ['OPERATE', 'MANAGE'].includes(actor.facilityScopes[task.facilityId])
  const canCollect = !!canProcess && !!actor?.permissions.includes('payments:collect')
  const canReadReturn = !!actor?.permissions.includes('returns:read')
  const settlement = useRentalApiResource(`${identity}:return:${view.returnCaseId}:${canReadReturn}`, async () => {
    if (!view.returnCaseId || !canReadReturn) return null
    const record = await getReturn(role, view.returnCaseId)
    if (record.rentalId !== task.rentalId || record.facilityId !== task.facilityId) throw new Error('Hồ sơ quyết toán không khớp nhiệm vụ.')
    return record
  })
  const command = useRenewalCommand()
  const pending = useRef<RecoveryCommand | null>(null)
  const uploading = useRef(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [validation, setValidation] = useState('')
  // The parent reads this function synchronously, including before React rerenders.
  const lockReader = useRef<() => boolean>(() => false)
  lockReader.current = () => command.isLocked() || uploading.current
  useEffect(() => {
    if (closeGuard) closeGuard.current = () => lockReader.current()
    return () => { if (closeGuard) closeGuard.current = () => false }
  }, [closeGuard])
  const action = recoveryAction(view)
  const record = settlement.data
  const receiptReady = !!record && record.status === view.settlementStatus && !settlement.loading && !settlement.error
    && !record.settlementBlocker && (record.status === 'payment_due' ? (record.amountDueFromCustomer ?? 0) > 0 : record.status === 'refund_pending' && (record.netRefundAmount ?? 0) > 0)
  const allowed = !!canProcess && (action !== 'settlement-receipts' || (canCollect && receiptReady))
  const frozen = command.busy || command.uncertain || uploadBusy
  const stage = view.status === 'CLOSED' ? 4 : !view.startedAt ? 0 : !view.returnCaseId ? 1 : view.settlementStatus === 'completed' ? 3 : 2
  const submit = (form: HTMLFormElement) => {
    if (uploading.current || (command.isLocked() && !command.uncertain) || command.busy || command.conflict || !allowed || !action) return
    let request = pending.current
    if (!command.uncertain) {
      const f = new FormData(form)
      const text = (name: string) => String(f.get(name) ?? '').trim()
      const checked = (name: string) => f.get(name) === 'on'
      const expectedVersion = view.expectedVersion
      if (action === 'start') request = { action, body: { expectedVersion, note: text('note') } }
      if (action === 'inspection') {
        const inspection: Omit<InspectionInput, 'evidencePhotos'> = {
          inventoryMatch: text('inventoryMatch') as InspectionInput['inventoryMatch'],
          damageClassification: text('damageClassification') as InspectionInput['damageClassification'],
          damageFee: Number(text('damageFee')), cleaningFee: Number(text('cleaningFee')), lostItemFee: Number(text('lostItemFee')),
          overdueFee: Number(text('overdueFee')), outstandingFee: Number(text('outstandingFee')),
          staffNotes: text('staffNotes'), returnedKey: checked('returnedKey'), returnedCard: checked('returnedCard'), returnedLock: checked('returnedLock'),
          proposedUnitStatus: text('proposedUnitStatus') as InspectionInput['proposedUnitStatus'],
        }
        request = { action, body: { expectedVersion, inspection, evidenceFileIds: [...files] } }
      }
      if (action === 'settlement-receipts') request = { action, body: { expectedVersion, paymentMethod: text('paymentMethod') as 'CASH' | 'BANK_TRANSFER', transactionReference: text('transactionReference'), receiptFileId: files[0], confirmed: checked('confirmed') } }
      if (action === 'completion') request = { action, body: { expectedVersion, assetsCleared: checked('assetsCleared'), unitInspected: checked('unitInspected'), reportFileId: files[0], note: text('note') } }
      if (!request) return
      try { validateRecoveryCommand(request) } catch (error) { setValidation(recoveryOperationError(error)); return }
      pending.current = request
    }
    if (!request) return
    setValidation('')
    const snapshot = request
    void command.run(JSON.stringify(snapshot), key => sendRecoveryCommand(role, task.id, snapshot, key), () => {
      onSuccess(`${actionLabels[snapshot.action]} thành công.`)
    })
  }
  return <div className="space-y-4">
    <ol aria-label="Tiến trình thu hồi" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {['Tiếp nhận', 'Kiểm kê', 'Quyết toán', 'Hoàn tất thu hồi'].map((label, index) => <li key={label}
        aria-current={stage === index ? 'step' : undefined}
        className={`rounded-lg border p-3 text-sm ${index < stage ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : index === stage ? 'border-amber-400 bg-amber-50 font-semibold' : 'border-stone-200 text-stone-500'}`}>
        <span className="mr-2 font-bold">{index < stage ? '✓' : index + 1}</span>{label}
      </li>)}
    </ol>
    {view.returnCaseId && <details className="rounded-lg border border-stone-200 p-4" open={action === 'settlement-receipts'}>
      <summary className="cursor-pointer font-semibold">Quyết toán</summary>
      <div className="mt-3 space-y-2 text-sm">
        {!canReadReturn && <p>Cần quyền xem hồ sơ trả kho để đọc số tiền quyết toán.</p>}
        {canReadReturn && settlement.loading && <p role="status">Đang tải quyết toán...</p>}
        {!!settlement.error && <p role="alert">{recoveryOperationError(settlement.error)}</p>}
        {record && <dl className="grid grid-cols-2 gap-3">
          {[['Tiền bảo đảm hồ sơ thuê', record.depositAmount], ['Tổng khấu trừ', record.totalDeductions], ['Cần thu thêm', record.amountDueFromCustomer], ['Cần hoàn lại', record.netRefundAmount]].map(([label, value]) => <div key={String(label)}><dt className="text-stone-500">{label}</dt><dd className="font-semibold">{typeof value === 'number' ? money(value) : '—'}</dd></div>)}
        </dl>}
        {view.settlementStatus === 'awaiting_customer_confirmation' && <p>Đang chờ khách hàng xác nhận quyết toán tại hồ sơ trả kho.</p>}
        {view.settlementStatus === 'disputed' && <p>Khách hàng đã khiếu nại quyết toán. Manager xử lý tại hồ sơ trả kho.</p>}
        {view.settlementStatus === 'completed' && <p>Quyết toán đã hoàn tất.</p>}
        <p className="break-all text-stone-500">Mã hồ sơ trả kho: {view.returnCaseId}</p>
      </div>
    </details>}
    {action && <form onSubmit={e => { e.preventDefault(); submit(e.currentTarget) }} className="space-y-4 rounded-lg border border-stone-200 p-4">
      <h3 className="font-semibold">{actionLabels[action]}</h3>
      {!canProcess && <p className="text-sm">Cần quyền xử lý trả kho và quyền thao tác tại cơ sở để xử lý nhiệm vụ.</p>}
      {action === 'settlement-receipts' && canProcess && !canCollect && <p className="text-sm">Cần quyền quản lý thanh toán để ghi nhận quyết toán.</p>}
      <fieldset disabled={frozen || !allowed || command.conflict} className="space-y-4 disabled:opacity-70">
        {action === 'start' && <Field label="Ghi chú tiếp nhận"><textarea name="note" required maxLength={2000} className={inputClass} rows={3} /></Field>}
        {action === 'inspection' && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Đối chiếu tài sản"><select name="inventoryMatch" className={inputClass}><option value="match">Khớp kiểm kê</option><option value="missing">Thiếu tài sản</option><option value="excess">Thừa tài sản</option></select></Field>
            <Field label="Tình trạng tài sản"><select name="damageClassification" className={inputClass}><option value="no_damage">Không hư hỏng</option><option value="minor_damage">Hư hỏng nhẹ</option><option value="major_damage">Hư hỏng nặng</option><option value="abandoned_goods">Tài sản bỏ lại</option></select></Field>
            {Object.entries(feeLabels).map(([name, label]) => <Field key={name} label={`${label} (VND)`}><input name={name} type="number" min={0} max={999999999999} step={1} defaultValue={0} required className={inputClass} /></Field>)}
            <Field label="Trạng thái kho sau thu hồi"><select name="proposedUnitStatus" className={inputClass}><option value="available">Sẵn sàng cho thuê</option><option value="maintenance">Cần bảo trì</option></select></Field>
          </div>
          <div className="flex flex-wrap gap-4"><Check name="returnedKey">Đã trả chìa khóa</Check><Check name="returnedCard">Đã trả thẻ</Check><Check name="returnedLock">Đã trả khóa</Check></div>
          <Field label="Ghi chú kiểm kê"><textarea name="staffNotes" rows={3} maxLength={4000} className={inputClass} /></Field>
        </>}
        {action === 'settlement-receipts' && <>
          {record && <p className="rounded-lg bg-stone-50 p-3 font-semibold">{record.status === 'payment_due' ? 'Thực thu' : 'Thực hoàn'}: {money((record.status === 'payment_due' ? record.amountDueFromCustomer : record.netRefundAmount) ?? 0)}</p>}
          <Field label="Phương thức"><select name="paymentMethod" className={inputClass}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></Field>
          <Field label="Mã giao dịch hoặc biên nhận"><input name="transactionReference" required maxLength={64} className={inputClass} /><span className="mt-1 block text-xs text-stone-500">Tối đa 64 ký tự: chữ, số, dấu chấm, gạch dưới, hai chấm, gạch chéo hoặc gạch ngang.</span></Field>
          <Check name="confirmed">Tôi xác nhận đã thực thu hoặc thực hoàn đúng số tiền quyết toán. Chứng từ chuyển khoản được đối chiếu thủ công.</Check>
        </>}
        {action === 'completion' && <>
          <Check name="assetsCleared">Tài sản trong kho đã được xử lý xong.</Check>
          <Check name="unitInspected">Đã kiểm tra gian kho và xác nhận trạng thái sau thu hồi.</Check>
          <Field label="Ghi chú hoàn tất"><textarea name="note" required rows={3} maxLength={2000} className={inputClass} /></Field>
        </>}
      </fieldset>
      {action !== 'start' && <EvidenceUpload entityType={`DUONG_RECOVERY_${action === 'inspection' ? 'INSPECTION' : action === 'completion' ? 'COMPLETION' : 'SETTLEMENT'}`} entityId={task.id}
        value={files} onChange={setFiles} limit={action === 'inspection' ? 10 : 1}
        label={action === 'inspection' ? 'Biên bản và minh chứng kiểm kê' : action === 'completion' ? 'Biên bản hoàn tất thu hồi' : 'Biên lai thu hoặc hoàn tiền'}
        disabled={frozen || !allowed || command.conflict} onBusy={busy => { uploading.current = busy; setUploadBusy(busy) }} />}
      {validation && <p role="alert" className="text-sm text-red-700">{validation}</p>}
      {!!command.error && <p role="alert" className="text-sm text-red-700">{recoveryOperationError(command.error)}</p>}
      <Button type="submit" disabled={!allowed || command.busy || uploadBusy || command.conflict}>{command.busy ? 'Đang lưu...' : command.uncertain ? 'Gửi lại cùng yêu cầu' : actionLabels[action]}</Button>
    </form>}
    {view.status === 'CLOSED' && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Đã hoàn tất thu hồi{view.completedAt ? ` lúc ${rentalDate(view.completedAt)}` : ''}.</p>}
    {(view.evidenceFileIds.length > 0 || view.receiptFileId || view.completionFileId) && <details className="rounded-lg border border-stone-200 p-4">
      <summary className="cursor-pointer font-semibold">Chứng từ</summary>
      <div className="mt-3 space-y-4">
        {view.evidenceFileIds.map((id, i) => <div key={id}><p className="mb-2 text-sm font-medium">Kiểm kê {i + 1}</p><EvidenceDownload id={id} previewLabel="Xem trước" label="Tải chứng từ" /></div>)}
        {view.receiptFileId && <div><p className="mb-2 text-sm font-medium">Biên lai quyết toán</p><EvidenceDownload id={view.receiptFileId} previewLabel="Xem trước" label="Tải biên lai" /></div>}
        {view.completionFileId && <div><p className="mb-2 text-sm font-medium">Biên bản hoàn tất thu hồi</p><EvidenceDownload id={view.completionFileId} previewLabel="Xem trước" label="Tải biên bản" /></div>}
      </div>
    </details>}
  </div>
}
