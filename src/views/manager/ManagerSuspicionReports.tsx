import { useEffect, useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { apiRequest } from '../../services/apiClient'
import { getAuthenticatedActor } from '../../services/authApi'
import { rentalError } from '../rental-api/presentation'

type Report = {
  id: string
  code: string
  description: string
  facilityName: string
  reporterName: string | null
  submittedAt: string
  status: string
}

const reportDate = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
})

export default function ManagerSuspicionReports({ onOpenReport }: { onOpenReport: (id: string) => void }) {
  const actor = getAuthenticatedActor()
  const [page, setPage] = useState(0)
  const reports = useRentalApiResource(JSON.stringify([actor?.id, actor?.facilityScopes, page]), () =>
    apiRequest<{ data: Report[]; pagination: { totalPages: number } }>(`/api/manager/rentals/suspicion-reports?page=${page}`))

  const { refresh } = reports
  useEffect(() => {
    window.addEventListener('storagehub:suspicion-reports-refresh', refresh)
    return () => window.removeEventListener('storagehub:suspicion-reports-refresh', refresh)
  }, [refresh])

  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-bold">Báo cáo nghi vấn hàng cấm</h2>
      <Button size="sm" variant="outline" disabled={reports.loading} onClick={reports.refresh}>Tải lại</Button>
    </div>
    {reports.loading && <p role="status">Đang tải báo cáo…</p>}
    {reports.error != null && <p role="alert" className="text-red-700">{rentalError(reports.error)}</p>}
    {reports.data?.data.length === 0 && <p className="py-8 text-center text-sm text-stone-600">Chưa có báo cáo nghi vấn.</p>}
    {reports.data?.data.map(report => <article key={report.id} className="space-y-2 rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{report.code}</h3>
        {report.status === 'PENDING_MANAGER' && <Badge variant="warning">Chờ quản lý tiếp nhận</Badge>}
        {report.status === 'INVESTIGATING' && <Badge variant="info">Đang xác minh</Badge>}
        {report.status === 'CLOSED_NO_VIOLATION' && <Badge variant="success">Đã đóng</Badge>}
        {report.status === 'TRANSFERRED_TO_RECOVERY' && <Badge variant="info">Đã chuyển thu hồi</Badge>}
      </div>
      <p className="text-sm text-stone-600">
        {report.facilityName} · {report.reporterName ?? 'Chưa rõ người báo'} · {reportDate.format(new Date(report.submittedAt))}
      </p>
      <p className="line-clamp-2 break-words text-sm">{report.description}</p>
      <Button size="sm" variant="outline" onClick={() => onOpenReport(report.id)}>Xem báo cáo</Button>
    </article>)}
    {reports.data && reports.data.pagination.totalPages > 1 && <nav aria-label="Phân trang báo cáo" className="flex items-center justify-end gap-3 text-sm">
      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button>
      <span>Trang {page + 1} / {reports.data.pagination.totalPages}</span>
      <Button size="sm" variant="outline" disabled={page + 1 >= reports.data.pagination.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button>
    </nav>}
  </Card>
}
