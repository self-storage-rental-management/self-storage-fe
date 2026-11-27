import { useRef, useState, type FormEvent } from 'react'
import { Badge, Button, Modal } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { apiRequest } from '../../services/apiClient'
import { formatCustomerDate } from '../../i18n/customerDate'
import { rentalError } from '../rental-api/presentation'

interface SuspicionReport {
  code: string
  status: string
  rentalId: string
  detectedAt: string
  submittedAt: string
  description: string
  reporterName: string | null
  facilityName: string
  acceptedByName: string | null
  acceptedAt: string | null
}

interface ReportDetail {
  closure: { reason: string; decidedBy: string | null; decidedAt: string } | null
  transfer: { recoveryId: string; conclusion: string; grounds: string; decidedBy: string | null; decidedAt: string } | null
  report: SuspicionReport
  rental: {
    displayCode: string | null
    reservationCode: string
    unitCode: string
    customerName: string
  } | null
}

const formatTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function reportDateTime(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? `${formatTime.format(date)} ${formatCustomerDate(date)}` : 'Chưa có'
}

export default function ManagerSuspicionReport({ id, staffRentalId, onClose, onOpenRental, onOpenRecovery }: {
  id: string
  staffRentalId?: string
  onClose: () => void
  onOpenRental: (id: string) => void
  onOpenRecovery?: (id: string) => void
}) {
  const role = staffRentalId ? 'staff' : 'manager'
  const path = staffRentalId ? `/api/staff/rentals/${encodeURIComponent(staffRentalId)}` : '/api/manager/rentals'
  const url = `${path}/suspicion-reports/${encodeURIComponent(id)}`
  const { loading, data, error, refresh } = useRentalApiResource(url, () => apiRequest<{ data: ReportDetail }>(url))
  const [accepted, setAccepted] = useState<ReportDetail>()
  const [accepting, setAccepting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [resolution, setResolution] = useState<'transfer' | 'close' | null>(null)
  const [saving, setSaving] = useState(false)
  const [resolutionError, setResolutionError] = useState('')
  const resolutionLock = useRef(false)
  const acceptLock = useRef(false)
  const detail = accepted ?? data?.data
  const report = detail?.report
  const rental = detail?.rental
  const transfer = detail?.transfer
  const closure = detail?.closure

  async function acceptReport() {
    if (acceptLock.current) return
    acceptLock.current = true
    setAccepting(true)
    setActionError('')
    try {
      const result = await apiRequest<{ data: ReportDetail }>(`${url}/accept`, { method: 'POST' })
      setAccepted(result.data)
      window.dispatchEvent(new Event('storagehub:suspicion-reports-refresh'))
    } catch (failure) {
      setActionError(rentalError(failure))
      refresh()
    } finally {
      acceptLock.current = false
      setAccepting(false)
    }
  }

  function toggleResolution(next: 'transfer' | 'close') {
    setResolution(current => current === next ? null : next)
    setResolutionError('')
  }

  async function resolveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolution || resolutionLock.current) return
    const details = String(new FormData(event.currentTarget).get('details') ?? '').trim()
    if (!details) {
      setResolutionError(resolution === 'close' ? 'Vui lòng nhập lý do đóng báo cáo.' : 'Vui lòng nhập kết luận và căn cứ thu hồi.')
      return
    }
    const body = resolution === 'close' ? { reason: details } : { conclusion: details }
    resolutionLock.current = true
    setSaving(true)
    setResolutionError('')
    try {
      const result = await apiRequest<{ data: ReportDetail }>(`${url}/${resolution}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setAccepted(result.data)
      setResolution(null)
      window.dispatchEvent(new Event('storagehub:suspicion-reports-refresh'))
    } catch (failure) {
      setResolutionError(rentalError(failure))
    } finally {
      resolutionLock.current = false
      setSaving(false)
    }
  }

  return <Modal open onClose={onClose} title="Báo cáo nghi vấn hàng cấm" closeLabel="Đóng cửa sổ chi tiết" size="lg">
    {loading && <p role="status">Đang tải báo cáo…</p>}
    {error != null && <div role="alert" className="space-y-3 text-red-700">
      <p>{rentalError(error)}</p>
      <Button size="sm" onClick={refresh}>Thử lại</Button>
    </div>}
    {report && <div className="space-y-4">
      <dl className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-stone-600">Trạng thái xử lý</dt>
          <dd className="mt-1">{report.status === 'PENDING_MANAGER'
            ? <Badge variant="warning">Chờ quản lý tiếp nhận</Badge>
            : report.status === 'INVESTIGATING' ? <Badge variant="info">Đang xác minh</Badge>
            : report.status === 'TRANSFERRED_TO_RECOVERY' ? <Badge variant="info">Đã chuyển thu hồi</Badge>
            : report.status === 'CLOSED_NO_VIOLATION' ? <Badge variant="success">Đã đóng</Badge> : 'Chưa có thông tin' }</dd>
        </div>
        {[
          ['Mã báo cáo', report.code],
          ['Cơ sở', report.facilityName],
          ['Gian kho', rental?.unitCode ?? 'Chưa có'],
          ['Mã hồ sơ thuê', rental?.displayCode ?? 'Chưa có'],
          ['Mã đặt kho', rental?.reservationCode ?? 'Chưa có'],
          ['Khách thuê', rental?.customerName ?? 'Chưa có'],
          ['Người báo', report.reporterName ?? 'Chưa rõ'],
          ['Thời điểm phát hiện', reportDateTime(report.detectedAt)],
          ['Thời điểm gửi', reportDateTime(report.submittedAt)],
          ...(report.acceptedAt ? [
            ['Người tiếp nhận', report.acceptedByName ?? 'Chưa rõ'],
            ['Thời điểm tiếp nhận', reportDateTime(report.acceptedAt)],
          ] : []),
        ].map(([key, value]) => <div key={key}><dt className="text-stone-600">{key}</dt><dd className="font-semibold">{value}</dd></div>)}
      </dl>
      <section>
        <h3 className="mb-1 font-semibold">Mô tả dấu hiệu</h3>
        <p className="whitespace-pre-wrap break-words">{report.description}</p>
      </section>
      {transfer && <section className="space-y-2 border-t border-stone-200 pt-4" aria-label="Kết luận chuyển thu hồi">
        <h3 className="font-bold">Kết luận chuyển thu hồi</h3>
        <p className="text-sm text-stone-600">{transfer.decidedBy ?? 'Chưa rõ người quyết định'} · {reportDateTime(transfer.decidedAt)}</p>
        <p className="whitespace-pre-wrap break-words text-sm">{transfer.conclusion}</p>
        {transfer.grounds && <>
          <h4 className="text-sm font-semibold">Căn cứ</h4>
          <p className="whitespace-pre-wrap break-words text-sm">{transfer.grounds}</p>
        </>}
        {onOpenRecovery && <Button onClick={() => onOpenRecovery(transfer.recoveryId)}>Xem hồ sơ thu hồi</Button>}
      </section>}
      {closure && <section className="space-y-2 border-t border-stone-200 pt-4">
        <h3 className="font-bold">Kết luận không phát hiện hàng cấm</h3>
        <p className="text-sm text-stone-600">{closure.decidedBy ?? 'Chưa rõ người quyết định'} · {reportDateTime(closure.decidedAt)}</p>
        <h4 className="text-sm font-semibold">Lý do đóng báo cáo</h4>
        <p className="whitespace-pre-wrap break-words text-sm">{closure.reason}</p>
      </section>}
      {role === 'manager' && report.status === 'INVESTIGATING' && <section className="space-y-3 border-t border-stone-200 pt-4">
        <div className="flex flex-wrap gap-2">
          {onOpenRecovery && <Button variant="danger" aria-expanded={resolution === 'transfer'} disabled={saving}
            onClick={() => toggleResolution('transfer')}>Chuyển sang thu hồi</Button>}
          <Button aria-expanded={resolution === 'close'} disabled={saving}
            onClick={() => toggleResolution('close')}>Đóng báo cáo</Button>
        </div>
        {resolution && <form key={resolution} onSubmit={resolveReport} className="space-y-3 rounded-lg bg-stone-50 p-3">
          <p className="text-sm text-stone-600">{resolution === 'close'
            ? 'Kết luận không phát hiện hàng cấm. Hồ sơ thuê tiếp tục như bình thường.'
            : 'Hệ thống sẽ mở hồ sơ thu hồi ở bước Chờ phân công và gửi thông báo theo lịch thu hồi.'}</p>
          <label className="block text-sm font-medium">
            {resolution === 'close' ? 'Lý do đóng báo cáo' : 'Kết luận và căn cứ chuyển thu hồi'}
            <textarea name="details" required maxLength={2000} rows={3} disabled={saving}
              className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2" />
          </label>
          {resolutionError && <p role="alert" className="text-sm text-red-700">{resolutionError}</p>}
          <Button type="submit" variant={resolution === 'transfer' ? 'danger' : 'primary'} disabled={saving}>
            {resolution === 'close'
              ? (saving ? 'Đang đóng…' : 'Xác nhận đóng báo cáo')
              : (saving ? 'Đang chuyển…' : 'Xác nhận chuyển thu hồi')}
          </Button>
        </form>}
      </section>}
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
      <div className="flex flex-wrap gap-2">
        {role === 'manager' && report.status === 'PENDING_MANAGER' && <Button disabled={accepting} onClick={() => void acceptReport()}>
          {accepting ? 'Đang tiếp nhận…' : 'Tiếp nhận xử lý'}
        </Button>}
        {rental && <Button onClick={() => onOpenRental(report.rentalId)}>Xem hồ sơ thuê</Button>}
      </div>
    </div>}
  </Modal>
}
