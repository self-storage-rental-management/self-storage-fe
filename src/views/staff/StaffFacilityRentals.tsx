import { useState, type FormEvent } from 'react'
import ManagerSuspicionReport from '../manager/ManagerSuspicionReport'
import { apiRequest } from '../../services/apiClient'
import RentalSuspicionForm from '../rental-api/RentalSuspicionForm'
import { Button, Modal, SectionHeader } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { getAuthenticatedActor, staffWorkingFacilityId } from '../../services/authApi'
import { getStaffRental, listRentals } from '../../services/rentalApi'
import type { RentalApiQuery, RentalApiRecord } from '../../types/rentalApi'
import RentalHandoverFiles from '../rental-api/RentalHandoverFiles'
import { RentalRecordGroup, RentalRecordRow } from '../rental-api/RentalRecordList'
import { rentalDate, rentalError, rentalRecordLabel, rentalStatusLabel } from '../rental-api/presentation'

const statuses = [
  ['setup', 'Đang chuẩn bị'],
  ['active', 'Đang thuê'],
  ['return_requested', 'Đã yêu cầu trả kho'],
  ['return_inspection', 'Đang nghiệm thu'],
  ['closing', 'Đang kết thúc'],
  ['completed', 'Đã hoàn tất'],
] as const

export default function StaffFacilityRentals() {
  const actor = getAuthenticatedActor()
  const facilityId = actor ? staffWorkingFacilityId(actor) : undefined
  const scope = JSON.stringify([actor?.id, actor?.facilityScopes, actor?.permissions, facilityId])
  const [input, setInput] = useState('')
  const [query, setQuery] = useState<RentalApiQuery>({ page: 0, size: 15, sort: 'createdAt,desc' })
  const [selected, setSelected] = useState<RentalApiRecord | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string>()
  const list = useRentalApiResource(scope + JSON.stringify(query), () => listRentals('staff', { ...query, facilityId }))
  const pagination = list.data?.pagination

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(current => ({ ...current, search: input.trim(), page: 0 }))
  }

  return <div className="fade-in space-y-5">
    <SectionHeader title="Hồ sơ thuê của cơ sở" subtitle="Tra cứu khách thuê, gian kho, thời hạn và tài liệu bàn giao." />

    <form onSubmit={search} className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
      <label className="min-w-48 flex-1 text-sm font-medium text-stone-700">
        Tìm hồ sơ
        <input className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2"
          value={input} maxLength={200} onChange={event => setInput(event.target.value)}
          placeholder="Mã hồ sơ, mã đặt kho, gian kho hoặc tên khách" />
      </label>
      <Button type="submit">Tìm kiếm</Button>
      <label className="text-sm font-medium text-stone-700">
        Trạng thái
        <select className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2"
          value={query.status ?? ''} onChange={event => {
            const status = statuses.find(([value]) => value === event.target.value)?.[0]
            setQuery(current => ({ ...current, status, page: 0 }))
          }}>
          <option value="">Tất cả trạng thái</option>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </form>

    {list.loading && <p role="status" className="text-sm text-stone-600">Đang tải hồ sơ thuê…</p>}
    {list.error != null && <div role="alert" className="flex items-center gap-3 text-sm text-red-700">
      {rentalError(list.error)}
      <Button variant="outline" size="sm" onClick={list.refresh}>Thử lại</Button>
    </div>}
    {list.data && pagination && <RentalRecordGroup id="staff-facility-rental-list" title="Danh sách hồ sơ thuê"
      subtitle="Chọn hồ sơ để xem chi tiết." count={pagination.totalItems} active empty="Không tìm thấy hồ sơ phù hợp."
      footer={pagination.totalPages > 1 && <nav aria-label="Phân trang hồ sơ thuê" className="flex flex-wrap items-center justify-end gap-3 p-3 text-sm">
        <Button variant="outline" size="sm" disabled={pagination.page === 0}
          onClick={() => setQuery(current => ({ ...current, page: pagination.page - 1 }))}>Trang trước</Button>
        <span>Trang {pagination.page + 1} / {pagination.totalPages}</span>
        <Button variant="outline" size="sm" disabled={pagination.page + 1 >= pagination.totalPages}
          onClick={() => setQuery(current => ({ ...current, page: pagination.page + 1 }))}>Trang sau</Button>
      </nav>}>
      {list.data.data.map(rental => <RentalRecordRow key={rental.id} rental={rental} role="manager" unitTypeName={rental.unitType.name}
        actions={<div className="col-span-2 flex justify-center">
          <Button variant="outline" size="md" className="min-h-11 w-40 max-w-full font-semibold" onClick={() => setSelected(rental)} aria-label={`Xem hồ sơ gian ${rental.storageUnit.code}`}>Xem hồ sơ</Button>
        </div>} />)}
    </RentalRecordGroup>}
    {selected && (selectedReportId
      ? <ManagerSuspicionReport key={scope + selectedReportId} id={selectedReportId} staffRentalId={selected.id}
          onClose={() => setSelectedReportId(undefined)} onOpenRental={() => setSelectedReportId(undefined)} />
      : <StaffRentalDetails key={scope + selected.id} identity={scope} rental={selected} onClose={() => setSelected(null)}
          onOpenReport={setSelectedReportId}
          canReadFiles={actor?.permissions.includes('checkins:read') === true}
          canReport={facilityId != null && actor?.facilityScopes[facilityId] !== 'READ'} />)}
  </div>
}

function StaffRentalDetails({ identity, rental, onClose, onOpenReport, canReadFiles, canReport }: {
  identity: string
  rental: RentalApiRecord
  onClose: () => void
  onOpenReport: (id: string) => void
  canReadFiles: boolean
  canReport: boolean
}) {
  const [reportOpen, setReportOpen] = useState(false)
  const detail = useRentalApiResource(identity + rental.id, () => getStaffRental(rental.id))
  const reports = useRentalApiResource(identity + rental.id + ':reports', () =>
    apiRequest<{ data: Array<{ id: string; code: string; status: string }> }>(`/api/staff/rentals/${rental.id}/suspicion-reports`))
  const hasUnresolvedReport = reports.data?.data.some(report =>
    report.status === 'PENDING_MANAGER' || report.status === 'INVESTIGATING') ?? false
  const current = detail.data?.rental ?? rental
  const fields = [
    ['Khách thuê', current.customer.fullName],
    ['Cơ sở', current.facility.name],
    ['Gian kho', current.storageUnit.code],
    ['Loại kho', current.unitType.name],
    ['Trạng thái', rentalStatusLabel(current)],
    ['Ngày bắt đầu', rentalDate(current.startDate)],
    ['Ngày cuối kỳ', rentalDate(current.dateSemantics?.lastPermittedDate ?? current.contractEndDate)],
    ...(detail.data ? [['Mã đặt kho', detail.data.reservationCode], ['Số hợp đồng', detail.data.contractNumber ?? 'Chưa có hợp đồng đã ký']] : []),
  ]

  return <Modal open onClose={onClose} closeLabel="Đóng hồ sơ thuê" title={`Hồ sơ thuê ${rentalRecordLabel(current)}`} size="xl">
    <dl className="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
      {fields.map(([label, value]) => <div key={label}>
        <dt className="text-xs font-medium text-stone-600">{label}</dt>
        <dd className="mt-1 break-words text-sm font-semibold text-stone-900">{value}</dd>
      </div>)}
    </dl>
    {detail.loading && <p role="status" className="mb-4 text-sm text-stone-600">Đang tải chi tiết…</p>}
    {detail.error != null && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-red-700">
      {rentalError(detail.error)}
      <Button variant="outline" size="sm" onClick={detail.refresh}>Thử lại</Button>
    </div>}
    {canReport && current.status === 'active' && <div className="mb-5">
      {hasUnresolvedReport
        ? <p className="text-sm text-amber-800">Hồ sơ đang có báo cáo nghi vấn chưa xử lý xong.</p>
        : <>
          <Button variant="outline" disabled={!reports.data} aria-expanded={reportOpen}
            aria-controls={reportOpen ? 'rental-suspicion-form' : undefined}
            onClick={() => setReportOpen(open => !open)}>Báo cáo nghi vấn hàng cấm</Button>
          {reportOpen && reports.data && <RentalSuspicionForm rentalId={rental.id} onSubmitted={onOpenReport} />}
        </>}
    </div>}
    <section className="mb-5 space-y-2 border-t border-stone-200 pt-4" aria-label="Báo cáo nghi vấn hàng cấm">
      <h3 className="font-semibold">Báo cáo nghi vấn hàng cấm</h3>
      {reports.loading && <p role="status" className="text-sm text-stone-600">Đang tải báo cáo…</p>}
      {reports.error != null && <div className="flex items-center gap-2 text-sm text-red-700" role="alert">
        {rentalError(reports.error)}
        <Button variant="outline" size="sm" onClick={reports.refresh}>Thử lại</Button>
      </div>}
      {reports.data?.data.length === 0 && <p className="text-sm text-stone-600">Chưa có báo cáo.</p>}
      {reports.data?.data.map(report => <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 p-3">
        <div><p className="text-sm font-semibold">{report.code}</p>
          <p className="text-xs text-stone-600">{report.status === 'INVESTIGATING' ? 'Đang xác minh' : report.status === 'TRANSFERRED_TO_RECOVERY' ? 'Đã chuyển thu hồi' : 'Chờ quản lý tiếp nhận'}</p></div>
        <Button variant="outline" size="sm" onClick={() => onOpenReport(report.id)}>Xem báo cáo</Button>
      </div>)}
    </section>
    {canReadFiles && <RentalHandoverFiles role="staff" id={rental.id} />}
  </Modal>
}
