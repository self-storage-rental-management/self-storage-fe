import { useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ApiClientError } from '../../services/apiClient'
import { getAuthenticatedActor, type ApiActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getManagerReportSummary, listManagerReportActivities, type ManagerReportActivity } from '../../services/managerReportingApi'
import { formatVndAmount } from '../../i18n/currency'
import { exportManagerFacilityExcel } from '../../utils/excelExport'
import { Badge, Button, Card, Input, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import ManagerPagination from './ManagerPagination'
import { managerApiIdentity } from './managerD1D5Api'
import { managerDisplayError, managerDisplayExplanation } from './managerPresentation'
import { managerFacilityNotice, singleManagerFacility } from './managerFacilityUi'

const colors = ['#10b981', '#3b82f6', '#e9a12c', '#57534e', '#ef4444', '#8b5cf6']

const activityLabels: Record<string, string> = {
  RENEWAL_POLICY_PUBLISHED: 'Công bố chính sách gia hạn',
  RENTAL_PACKAGE_POLICY_UPDATED: 'Cập nhật chính sách gói thuê',
  RESERVATION_GOODS_REJECT: 'Từ chối hàng hóa đặt kho',
  RESERVATION_GOODS_APPROVE: 'Chấp thuận hàng hóa đặt kho',
  RESERVATION_EMAIL_VERIFIED: 'Xác minh thư điện tử đặt kho',
  CUSTOMER_RECEIPT_CONFIRMED: 'Khách hàng xác nhận nhận kho',
  CHECKIN_HANDOVER_COMPLETED: 'Hoàn tất bàn giao nhận kho',
  BOOKING_CONFIRMATION_ISSUED: 'Phát hành xác nhận đặt kho',
  CUSTOMER_CHECKIN_APPOINTMENT_SET: 'Khách hàng đặt lịch nhận kho',
  UNIT_TYPE_CHANGE_REQUESTED: 'Gửi đề xuất thay đổi loại kho',
  UNIT_TYPE_CHANGE_APPROVED: 'Duyệt thay đổi loại kho',
  UNIT_TYPE_CHANGE_REVIEWED: 'Xử lý đề xuất thay đổi loại kho',
  UNIT_TYPE_CREATED_BY_MANAGER: 'Thêm loại kho',
  UNIT_TYPE_ARCHIVED_BY_MANAGER: 'Lưu trữ loại kho',
  UNIT_TYPE_PRICED_BY_BUSINESS: 'Cấu hình giá loại kho',
  FACILITY_PUBLISHED: 'Công bố cơ sở',
  FACILITY_UPDATED: 'Cập nhật cơ sở',
  GOODS_CATEGORIES_REORDERED: 'Sắp xếp loại hàng hóa',
  GOODS_MATERIALS_REORDERED: 'Sắp xếp vật liệu chính',
  GOODS_CATEGORY_CREATED: 'Thêm loại hàng hóa',
  GOODS_CATEGORY_UPDATED: 'Cập nhật loại hàng hóa',
  GOODS_MATERIAL_CREATED: 'Thêm vật liệu chính',
  GOODS_MATERIAL_UPDATED: 'Cập nhật vật liệu chính',
  RECOVERY_START: 'Bắt đầu xử lý thu hồi',
  RECOVERY_INSPECTION: 'Ghi nhận kiểm kê thu hồi',
  RECOVERY_SETTLEMENT: 'Ghi nhận quyết toán thu hồi',
  RECOVERY_SETTLEMENT_RECORDED: 'Ghi nhận quyết toán thu hồi',
  RECOVERY_SETTLEMENT_RECALCULATED: 'Đối soát lại phí quá hạn',
  RECOVERY_COMPLETION: 'Hoàn tất thu hồi',
  RECOVERY_RENTAL_RELEASED: 'Hoàn tất hồ sơ thuê sau thu hồi',
  AUTO_RECOVERY_HANDOFF: 'Tự động chuyển hồ sơ thu hồi',
  VNPAY_AUTHENTICATED_CALLBACK_V1: 'Xác thực kết quả thanh toán VNPay',
  VNPAY_RENEWAL_PAYMENT_CREATED: 'Tạo giao dịch thanh toán gia hạn',
  D3_APPOINTMENT: 'Đặt lịch ký gia hạn',
  D3_RESCHEDULE: 'Đổi lịch ký gia hạn',
  RENEWAL_EDIT: 'Cập nhật yêu cầu gia hạn',
}
const entityLabels: Record<string, string> = {
  recoverytask: 'Nhiệm vụ thu hồi', payment: 'Thanh toán', renewal: 'Gia hạn',
  return: 'Hồ sơ trả kho', rental: 'Hồ sơ thuê', reservation: 'Đặt kho',
  supportticket: 'Yêu cầu hỗ trợ', storageunit: 'Gian kho',
  systemsetting: 'Chính sách hệ thống', rentalpackagepolicy: 'Chính sách gói thuê',
  checkin: 'Hồ sơ nhận kho', bookingdocument: 'Xác nhận đặt kho',
  unittype: 'Loại kho', unittypechangerequest: 'Đề xuất thay đổi loại kho',
  goodstypecatalog: 'Loại hàng hóa', goodsmaterialcatalog: 'Vật liệu chính', facility: 'Cơ sở',
}
function activityTitle(row: ManagerReportActivity) {
  return activityLabels[row.action.toUpperCase()] || (row.actionLabel && /[À-ỹ]/u.test(row.actionLabel) ? managerDisplayExplanation(row.actionLabel) : 'Cập nhật thông tin tại cơ sở')
}
const actorLabel = (value: string) => ({ SYSTEM: 'Hệ thống tự động', BUSINESS: 'Quản lý vận hành', 'Business Owner': 'Quản lý vận hành', MANAGER: 'Quản lý cơ sở', STAFF: 'Nhân viên', CUSTOMER: 'Khách hàng', ADMIN: 'Quản trị viên' } as Record<string, string>)[value] || (/@/.test(value) || /[À-ỹ]/u.test(value) ? value : 'Người dùng hệ thống')
function activityVariant(action: string) {
  const code = action.toUpperCase()
  return code.includes('RECOVERY') ? 'info' : code.includes('RENEWAL') || code.startsWith('D3_') ? 'warning' : code.includes('PAYMENT') || code.includes('VNPAY') ? 'purple' : 'muted'
}
function ActivityTime({ value }: { value: string }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span className="text-xs text-stone-400">Chưa ghi nhận</span>
  return <time dateTime={value} className="block whitespace-nowrap text-xs tabular-nums leading-5">
    <span className="block font-medium text-stone-700">{date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
    <span className="block text-stone-400">{date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23' })}</span>
  </time>
}

function ReportMetric({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return <Card className="flex min-h-[112px] min-w-0 flex-col overflow-hidden p-3 sm:p-4">
    <p className="text-sm font-medium leading-5 text-stone-500">{title}</p>
    <p className="mt-2 min-w-0 text-xl font-bold leading-tight tracking-tight tabular-nums text-stone-900">{value}</p>
    <p className="mt-auto pt-2 text-xs leading-4 text-stone-500">{detail}</p>
  </Card>
}

function authorizedManager(): ApiActor {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('MANAGER') || !actor.permissions.includes('reports:read')) {
    throw new ApiClientError('Bạn chưa có quyền xem báo cáo cơ sở.', { status: 403, code: 'FORBIDDEN' })
  }
  return actor
}

export default function ManagerReportsApiPanel({ overview = false }: { overview?: boolean } = {}) {
  let actor: ApiActor
  try {
    actor = authorizedManager()
  } catch (error) {
    return <Card className="p-5" role="alert">{managerDisplayError(error)}</Card>
  }
  const facilityId = singleManagerFacility(actor)
  if (!facilityId) return <Card className="p-5" role="alert">{managerFacilityNotice(actor)}</Card>
  return <ManagerReportsSession key={managerApiIdentity(actor)} actor={actor} facilityId={facilityId} overview={overview} />
}

function ManagerReportsSession({ actor, facilityId, overview }: { actor: ApiActor; facilityId: string; overview: boolean }) {
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
  const [selectedActivity, setSelectedActivity] = useState<ManagerReportActivity>()
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

  const handleExportExcel = () => {
    if (!summary) return
    exportManagerFacilityExcel({
      facilityName: summary.facilityName || facilityId,
      metrics: {
        occupancyRate: summary.occupancyRate,
        totalUnits: summary.totalUnits,
        occupiedUnits: summary.occupiedUnits,
        availableUnits: summary.availableUnits,
        maintenanceUnits: summary.maintenanceUnits,
        monthlyRevenue: summary.monthlyRecurringRevenue,
        collectedRevenue: summary.collectedRevenue ?? 'Chưa đối soát',
        overdueRentalsCount: summary.overdueRentalsCount,
        monthCheckinsCount: summary.monthCheckinsCount,
        openReturnsCount: summary.openReturnsCount,
      },
      activities: activities?.data?.map(a => ({
        timestamp: a.timestamp,
        action: a.actionLabel || a.action,
        actorName: a.actorName,
        actorRole: a.actorRole,
        entityType: a.entityType,
        entityId: a.entityId,
        notes: a.notes || undefined,
      })),
    })
  }

  return <div className="fade-in mx-auto w-full max-w-[1600px] space-y-5">
    {!overview && (
      <SectionHeader
        eyebrow="Quản lý cơ sở"
        title="Báo cáo cơ sở"
        subtitle={summary ? `${summary.facilityName} · Số liệu từ hệ thống vận hành` : 'Số liệu lấy trực tiếp từ API cơ sở.'}
        action={
          summary ? (
            <Button variant="outline" onClick={handleExportExcel}>
              <span>Xuất báo cáo Excel</span>
            </Button>
          ) : undefined
        }
      />
    )}
    {summaryRead.loading ? <Card className="p-5" role="status">Đang tải báo cáo cơ sở...</Card> : summaryRead.error ? <Card className="flex flex-wrap items-center justify-between gap-3 p-5" role="alert"><p>{managerDisplayError(summaryRead.error)}</p><Button variant="outline" onClick={summaryRead.refresh}>Thử lại</Button></Card> : summary ? <>
      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        <ReportMetric title="Tỷ lệ lấp đầy" value={`${summary.occupancyRate}%`} detail="Tỷ lệ gian kho đang được sử dụng" />
        <ReportMetric title="Tiền thuê dự kiến/tháng" value={formatVndAmount(summary.monthlyRecurringRevenue)} detail="Theo các hợp đồng đang hiệu lực" />
        <ReportMetric title="Tiền đã thu" value={summary.collectedRevenue === null ? 'Chưa xác minh' : formatVndAmount(summary.collectedRevenue)} detail="Chỉ tính khoản thu đã được đối soát" />
        <ReportMetric title="Hợp đồng quá hạn" value={summary.overdueRentalsCount} detail="Hồ sơ đã qua ngày hết hạn thuê" />
        <ReportMetric title="Nhận kho trong tháng" value={summary.monthCheckinsCount} detail="Số lượt nhận kho trong tháng này" />
        <ReportMetric title="Yêu cầu trả kho" value={summary.openReturnsCount} detail="Các yêu cầu đang chờ hoàn tất" />
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

    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-stone-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900">Nhật ký hoạt động cơ sở</h3>
          {activities && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs tabular-nums text-stone-600">{activities.pagination.totalItems.toLocaleString('vi-VN')} hoạt động</span>}
        </div>
        <form onSubmit={submitSearch} className="flex max-w-4xl flex-wrap items-end gap-2">
          <label className="min-w-0 basis-60 flex-1 text-xs font-semibold text-stone-600">Tìm hoạt động<Input value={draftSearch} onChange={event => setDraftSearch(event.target.value)} placeholder="Hành động, mã hồ sơ hoặc ghi chú" className="mt-1" /></label>
          <Button type="submit">Tìm kiếm</Button>
          {search && <Button type="button" variant="ghost" onClick={() => { setDraftSearch(''); setSearch(''); setPage(1) }}>Xóa tìm kiếm</Button>}
        </form>
      </div>
      {activityRead.loading ? <p className="p-6 text-center text-sm text-stone-500" role="status">Đang tải nhật ký hoạt động...</p> : activityRead.error ? <div className="flex flex-wrap items-center justify-between gap-3 p-5" role="alert"><p>{managerDisplayError(activityRead.error)}</p><Button variant="outline" onClick={activityRead.refresh}>Thử lại</Button></div> : activities ? <>
        <Table tableClassName="min-w-[800px] table-fixed [&_th]:bg-stone-50 [&_th]:normal-case [&_th]:tracking-normal [&_th]:font-sans [&_td]:py-4 [&_td]:align-top">
          <colgroup><col className="w-[15%]" /><col className="w-[48%]" /><col className="w-[25%]" /><col className="w-[12%]" /></colgroup>
          <Thead><tr><Th>Thời gian</Th><Th>Hoạt động</Th><Th>Người thực hiện</Th><Th className="text-right">Chi tiết</Th></tr></Thead>
          <Tbody>{activities.data.map(row => <Tr key={row.id}>
            <Td><ActivityTime value={row.timestamp} /></Td>
            <Td>
              <Badge variant={activityVariant(row.action)}>{activityTitle(row)}</Badge>
              <p className="mt-1.5 text-xs text-stone-500">{entityLabels[row.entityType.toLowerCase()] || 'Thông tin cơ sở'}</p>
              {row.notes && <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-stone-600">{managerDisplayExplanation(row.notes)}</p>}
            </Td>
            <Td><p className="break-words text-sm font-medium text-stone-800">{actorLabel(row.actorName)}</p><p className="mt-1 break-all text-xs text-stone-400">{actorLabel(row.actorRole)}</p></Td>
            <Td className="text-right"><Button size="sm" variant="outline" onClick={() => setSelectedActivity(row)} aria-label={`Chi tiết: ${activityTitle(row)}`}>Xem</Button></Td>
          </Tr>)}{!activities.data.length && <tr><td colSpan={4} className="p-10 text-center text-sm text-stone-500">Không có hoạt động phù hợp.</td></tr>}</Tbody>
        </Table>
        <ManagerPagination page={page} pageCount={Math.max(activities.pagination.totalPages, 1)} total={activities.pagination.totalItems} pageSize={pageSize} onPageChange={setPage} />
      </> : null}
    </Card>
    {selectedActivity && <Modal open size="lg" title="Chi tiết hoạt động" onClose={() => setSelectedActivity(undefined)}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <Badge variant={activityVariant(selectedActivity.action)}>{activityTitle(selectedActivity)}</Badge>
          <ActivityTime value={selectedActivity.timestamp} />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-stone-500">Người thực hiện</dt><dd className="mt-1 break-words font-medium">{actorLabel(selectedActivity.actorName)}</dd><dd className="mt-1 text-xs text-stone-500">{actorLabel(selectedActivity.actorRole)}</dd></div>
          <div><dt className="text-xs text-stone-500">Đối tượng</dt><dd className="mt-1 font-medium">{entityLabels[selectedActivity.entityType.toLowerCase()] || 'Thông tin cơ sở'}</dd></div>
        </dl>
        {selectedActivity.notes && <section className="rounded-lg bg-stone-50 p-3"><h4 className="text-xs font-semibold text-stone-500">Ghi chú</h4><p className="mt-1 whitespace-pre-wrap break-words">{managerDisplayExplanation(selectedActivity.notes)}</p></section>}
      </div>
    </Modal>}
  </div>
}
