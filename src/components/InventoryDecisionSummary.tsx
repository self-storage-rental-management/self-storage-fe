import { useState } from 'react'
import { Button } from './ui'
import { apiDownload } from '../services/apiClient'
import { intakeDecisionLabels, type InventoryDecision } from '../services/inventoryDecision'
import { userFacingError } from '../presentation/userFacingError'

const returnLabels: Record<string, string> = {
  requested: 'Chờ nghiệm thu', scheduled: 'Đã hẹn nghiệm thu', inspected: 'Đã nghiệm thu',
  awaiting_business_review: 'Chờ duyệt quyết toán', awaiting_customer_confirmation: 'Chờ khách xác nhận quyết toán',
  disputed: 'Đang xem xét khiếu nại', payment_due: 'Chờ khách thanh toán', refund_pending: 'Chờ hoàn tiền',
  recovery_required: 'Chờ xử lý thu hồi', completed: 'Đã hoàn tất trả kho',
}

export default function InventoryDecisionSummary({ decision, onPreview, onOpenReturns, compact = false }: {
  compact?: boolean
  decision?: InventoryDecision | null
  onPreview?: (id: string) => void
  onOpenReturns?: () => void
}) {
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  if (!decision) return null
  const preview = async (id: string) => {
    if (onPreview) { onPreview(id); return }
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setOpening(true); setError('')
    try {
      const file = await apiDownload(`/api/files/${encodeURIComponent(id)}`)
      const url = URL.createObjectURL(file.blob)
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (reason) {
      tab?.close(); setError(userFacingError(reason, 'Không thể mở biên bản tiếp nhận.'))
    } finally { setOpening(false) }
  }
  const refused = decision.outcome === 'REFUSED'
  const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  return <section aria-label="Quyết định tiếp nhận đã ghi nhận" className={compact ? 'space-y-3 border-t border-stone-200 pt-3 text-sm text-stone-700' : `space-y-3 rounded-lg border p-4 text-sm ${refused ? 'border-red-200 bg-red-50 text-red-950' : 'border-stone-200 bg-white text-stone-900'}`}>
    {!compact && <h4 className="font-bold">{refused ? 'Cơ sở từ chối tiếp nhận hàng hóa' : intakeDecisionLabels[decision.outcome]}</h4>}
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      <div><dt className="text-xs">Người ghi nhận</dt><dd className="font-medium">{decision.decidedByName || (decision.source === 'STAFF' ? 'Nhân viên cơ sở' : 'Khách hàng')}</dd></div>
      {decision.decidedAt && <div><dt className="text-xs">Thời điểm ghi nhận</dt><dd>{date(decision.decidedAt)}</dd></div>}
      {decision.note && !compact && <div className="sm:col-span-2"><dt className="text-xs">{refused ? 'Lý do từ chối' : 'Ghi chú quyết định'}</dt><dd className="whitespace-pre-wrap break-words font-medium">{decision.outcome === 'TRANSFER_REQUESTED' ? 'Đã tạo yêu cầu chuyển hàng. Theo dõi tại mục Hỗ trợ khách hàng.' : decision.note}</dd></div>}
      {decision.returnCaseId && <div><dt className="text-xs">Tiến trình trả kho</dt><dd className="font-semibold">{returnLabels[decision.returnStatus || ''] || 'Đang cập nhật hồ sơ trả kho'}</dd></div>}
      {decision.scheduledReturnDate && <div><dt className="text-xs">Ngày trả kho dự kiến</dt><dd>{decision.scheduledReturnDate.split('-').reverse().join('/')}</dd></div>}
    </dl>
    {!compact && decision.source === 'STAFF' && <p className="text-xs">Quyết định đã được ghi nhận tại cơ sở theo biên bản có chữ ký khách.</p>}
    {!compact && decision.source === 'MANAGER' && <p className="text-xs">Quản lý đã phát hành quyết định sau khi xem xét biên bản từ chối ký.</p>}
    <div className="flex flex-wrap gap-2">
      {decision.evidenceReferences.map((id, index) => <Button key={id} type="button" size="sm" variant="outline" disabled={opening} onClick={() => void preview(id)}>{decision.evidenceReferences.length === 1 ? 'Xem biên bản đã ký' : `Xem biên bản ${index + 1}`}</Button>)}
      {decision.returnCaseId && onOpenReturns && <Button type="button" size="sm" variant="outline" onClick={onOpenReturns}>Theo dõi hồ sơ trả kho</Button>}
    </div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>
}
