import { useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ApiClientError } from '../../services/apiClient'
import { getAuthenticatedActor, type ApiActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getManagerReportSummary, listManagerReportActivities } from '../../services/managerReportingApi'
import { formatVnd } from '../../i18n/currency'
import { Badge, Button, Card, Input, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import ManagerPagination from './ManagerPagination'
import { managerApiIdentity } from './managerD1D5Api'
import { managerDisplayError } from './managerPresentation'
import { managerFacilityNotice, singleManagerFacility } from './managerFacilityUi'

const colors = ['#10b981', '#3b82f6', '#e9a12c', '#57534e', '#ef4444', '#8b5cf6']

function ReportMetric({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return <Card className="min-w-0 overflow-hidden p-4 sm:p-5">
    <p className="min-h-10 text-sm font-medium leading-5 text-stone-500">{title}</p>
    <p className="mt-1 min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-stone-900 sm:text-2xl">{value}</p>
    {detail && <p className="mt-2 text-xs leading-4 text-stone-500">{detail}</p>}
  </Card>
}

function authorizedManager(): ApiActor {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('MANAGER') || !actor.permissions.includes('reports:read')) {
    throw new ApiClientError('Bạn chưa có quyền xem báo cáo cơ sở.', { status: 403, code: 'FORBIDDEN' })
  }
  return actor
}

export default function ManagerReportsApiPanel() {
  let actor: ApiActor
  try {
    actor = authorizedManager()
  } catch (error) {
    return <Card className="p-5" role="alert">{managerDisplayError(error)}</Card>
  }
  const facilityId = singleManagerFacility(actor)
  if (!facilityId) return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return <ManagerReportsSession key={managerApiIdentity(actor)} actor={actor} facilityId={facilityId} />
}

function ManagerReportsSession({ actor, facilityId }: { actor: ApiActor; facilityId: string }) {
  const identity = managerApiIdentity(actor)
  const summaryRead = useRentalApiResource(`${identity}:report-summary:${facilityId}`, async () => {
    const response = await getManagerReportSummary(facilityId)
    if (response.data.facilityId !== facilityId) {
      throw new ApiClientError('Báo cáo trả về nằm ngoài phạm vi cơ sở được phép xem.', { code: 'INVALID_RESPONSE' })
    }
    return response.data
  })
  const [page, setPage] = useState(1)
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const pageSize = 10
  const activityRead = useRentalApiResource(`${identity}:report-activities:${facilityId}:${page}:${search}`, () =>
    listManagerReportActivities({ facilityId, page: page - 1, pageSize, search }))
  const summary = !summaryRead.loading && !summaryRead.error ? summaryRead.data : undefined
  const activities = !activityRead.loading && !activityRead.error ? activityRead.data : undefined

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setSearch(draftSearch.trim())
  }

  return <div className="fade-in mx-auto w-full max-w-[1600px] space-y-5">
    <SectionHeader eyebrow="Phân tích vận hành" title="Báo cáo cơ sở" subtitle={summary ? `${summary.facilityName} · Số liệu từ hệ thống vận hành` : 'Số liệu báo cáo lấy trực tiếp từ API cơ sở.'} />
    {summaryRead.loading ? <Card className="p-5" role="status">Đang tải báo cáo cơ sở...</Card> : summaryRead.error ? <Card className="flex flex-wrap items-center justify-between gap-3 p-5" role="alert"><p>{managerDisplayError(summaryRead.error)}</p><Button variant="outline" onClick={summaryRead.refresh}>Thử lại</Button></Card> : summary ? <>
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <ReportMetric title="Tỷ lệ lấp đầy" value={`${summary.occupancyRate}%`} />
        <ReportMetric title="Tiền thuê dự kiến/tháng" value={formatVnd(summary.monthlyRecurringRevenue)} detail="Theo các hợp đồng đang hiệu lực" />
        <ReportMetric title="Tiền đã thu, đã xác minh" value={summary.collectedRevenue === null ? 'Chưa xác minh' : formatVnd(summary.collectedRevenue)} detail="Chỉ tính khoản thu có đủ bằng chứng đối soát" />
        <ReportMetric title="Hợp đồng quá hạn" value={summary.overdueRentalsCount} />
        <ReportMetric title="Lượt nhận kho tháng này" value={summary.monthCheckinsCount} />
        <ReportMetric title="Yêu cầu trả kho đang mở" value={summary.openReturnsCount} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-bold">Phân bổ trạng thái gian kho</h3>
          {summary.unitStatusBreakdown.some(row => row.count > 0) ? <>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={summary.unitStatusBreakdown} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{summary.unitStatusBreakdown.map((entry, index) => <Cell key={entry.status} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => [value, 'Số gian']} /></PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 text-xs">{summary.unitStatusBreakdown.map((entry, index) => <div key={entry.status} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="flex-1 text-stone-500">{entry.name}</span><b>{entry.count}</b></div>)}</div>
          </> : <p className="flex h-[280px] items-center justify-center text-sm text-stone-500">Chưa có dữ liệu gian kho.</p>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-bold">Công suất theo loại kho</h3>
          {summary.unitTypeBreakdown.length ? <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary.unitTypeBreakdown}><CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" /><XAxis dataKey="typeName" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="totalUnits" fill="#d6d3d1" name="Tổng số" radius={[4, 4, 0, 0]} /><Bar dataKey="occupiedUnits" fill="#e9a12c" name="Đang sử dụng" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer> : <p className="flex h-[300px] items-center justify-center text-sm text-stone-500">Chưa có dữ liệu loại kho.</p>}
        </Card>
      </div>
    </> : null}

    <Card>
      <div className="space-y-3 border-b border-stone-200 p-4">
        <div><h3 className="font-bold">Nhật ký hoạt động cơ sở</h3><p className="text-xs text-stone-500">Dữ liệu lấy từ nhật ký API của cơ sở.</p></div>
        <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1 text-sm font-medium text-stone-700">Tìm hoạt động<Input value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder="Hành động, mã hồ sơ hoặc ghi chú" className="mt-1" /></label>
          <Button type="submit">Tìm kiếm</Button>
          {search && <Button type="button" variant="ghost" onClick={() => { setDraftSearch(''); setSearch(''); setPage(1) }}>Xóa tìm kiếm</Button>}
        </form>
      </div>
      {activityRead.loading ? <p className="p-6 text-center text-sm text-stone-500" role="status">Đang tải nhật ký hoạt động...</p> : activityRead.error ? <div className="flex flex-wrap items-center justify-between gap-3 p-5" role="alert"><p>{managerDisplayError(activityRead.error)}</p><Button variant="outline" onClick={activityRead.refresh}>Thử lại</Button></div> : activities ? <>
        <Table>
          <Thead><tr><Th>Thời gian</Th><Th>Hành động</Th><Th>Đối tượng</Th><Th>Người thực hiện</Th><Th>Ghi chú</Th><Th>Dấu vết</Th></tr></Thead>
          <Tbody>{activities.data.map(row => <Tr key={row.id}>
            <Td className="whitespace-nowrap text-xs">{new Date(row.timestamp).toLocaleString('vi-VN')}</Td>
            <Td><Badge variant="muted">{row.actionLabel || row.action}</Badge></Td>
            <Td className="text-sm">{row.entityType} · <span className="font-mono text-xs">{row.entityId}</span></Td>
            <Td>{row.actorName}<p className="text-xs text-stone-500">{row.actorRole}</p></Td>
            <Td className="max-w-md text-sm text-stone-600">{row.notes || '—'}</Td>
            <Td className="font-mono text-xs">{row.correlationId || '—'}</Td>
          </Tr>)}{!activities.data.length && <tr><td colSpan={6} className="p-10 text-center text-sm text-stone-500">Không có hoạt động phù hợp.</td></tr>}</Tbody>
        </Table>
        <ManagerPagination page={page} pageCount={Math.max(activities.pagination.totalPages, 1)} total={activities.pagination.totalItems} pageSize={pageSize} onPageChange={setPage} />
      </> : null}
    </Card>
  </div>
}
