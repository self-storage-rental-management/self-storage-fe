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
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')
  const transferLock = useRef(false)
  const acceptLock = useRef(false)
  const detail = accepted ?? data?.data
  const report = detail?.report
  const rental = detail?.rental
  const transfer = detail?.transfer

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

  async function transferReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const conclusion = String(values.get('conclusion') ?? '').trim()
    const grounds = String(values.get('grounds') ?? '').trim()
    if (!conclusion || !grounds || transferLock.current) return
    transferLock.current = true
    setTransferring(true)
    setTransferError('')
    try {
      const result = await apiRequest<{ data: ReportDetail }>(`${url}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ conclusion, grounds }),
      })
      setAccepted(result.data)
      setTransferOpen(false)
      window.dispatchEvent(new Event('storagehub:suspicion-reports-refresh'))
    } catch (failure) {
      setTransferError(rentalError(failure))
    } finally {
      transferLock.current = false
      setTransferring(false)
    }
  }

  return <Modal open onClose={onClose} title="Báo cáo nghi vấn hàng cấm" closeLabel="Đóng báo cáo" size="lg">
    {loading && <p role="status">Đang tải báo cáo…</p>}
    {error != null && <div role="alert" className="space-y-3 text-red-700">
      <p>{rentalError(error)}</p>
      <Button size="sm" variant="outline" onClick={refresh}>Thử lại</Button>
    </div>}
    {report && <div className="space-y-4">
      <dl className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="text-stone-600">Trạng thái xử lý</dt>
          <dd className="mt-1">{report.status === 'PENDING_MANAGER'
            ? <Badge variant="warning">Chờ quản lý tiếp nhận</Badge>
            : report.status === 'INVESTIGATING' ? <Badge variant="info">Đang xác minh</Badge>
            : report.status === 'TRANSFERRED_TO_RECOVERY' ? <Badge variant="info">Đã chuyển thu hồi</Badge> : 'Chưa có thông tin'}</dd>
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
        <h4 className="text-sm font-semibold">Căn cứ</h4>
        <p className="whitespace-pre-wrap break-words text-sm">{transfer.grounds}</p>
        {onOpenRecovery && <Button variant="outline" onClick={() => onOpenRecovery(transfer.recoveryId)}>Xem hồ sơ thu hồi</Button>}
      </section>}
      {role === 'manager' && onOpenRecovery && report.status === 'INVESTIGATING' && <section className="space-y-3 border-t border-stone-200 pt-4">
        <Button variant="outline" aria-expanded={transferOpen} disabled={transferring}
          onClick={() => setTransferOpen(open => !open)}>Chuyển sang thu hồi</Button>
        {transferOpen && <form onSubmit={transferReport} className="space-y-3 rounded-lg bg-stone-50 p-3">
          <p className="text-sm text-stone-600">Hệ thống sẽ mở hồ sơ thu hồi ở bước Chờ phân công và gửi thông báo theo lịch thu hồi.</p>
          <label className="block text-sm font-medium">Kết luận xác minh
            <textarea name="conclusion" required maxLength={2000} rows={3} disabled={transferring}
              className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2" />
          </label>
          <label className="block text-sm font-medium">Căn cứ chuyển thu hồi
            <textarea name="grounds" required maxLength={2000} rows={3} disabled={transferring}
              className="mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2" />
          </label>
          {transferError && <p role="alert" className="text-sm text-red-700">{transferError}</p>}
          <Button type="submit" disabled={transferring}>
            {transferring ? 'Đang chuyển…' : 'Xác nhận chuyển thu hồi'}
          </Button>
        </form>}
      </section>}
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
      <div className="flex flex-wrap gap-2">
        {role === 'manager' && report.status === 'PENDING_MANAGER' && <Button disabled={accepting} onClick={() => void acceptReport()}>
          {accepting ? 'Đang tiếp nhận…' : 'Tiếp nhận xử lý'}
        </Button>}
        {rental && <Button variant="outline" onClick={() => onOpenRental(report.rentalId)}>Xem hồ sơ thuê</Button>}
      </div>
    </div>}
  </Modal>
}
