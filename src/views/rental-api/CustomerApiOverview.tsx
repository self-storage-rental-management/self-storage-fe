import { Button, Card, StatCard } from "../../components/ui"
import { Icon } from "../../components/Layout"
import { ApiClientError } from "../../services/apiClient"
import { getAuthenticatedActor } from "../../services/authApi"
import { listRentals } from "../../services/rentalApi"
import { listSupportTickets } from "../../services/supportApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { rentalDate, rentalLabels, rentalMoney } from './presentation'
import { rentalDaysUntilDeadline } from './RentalDeadlineNotice'
import type { RentalApiRecord } from '../../types/rentalApi'
import { useState } from 'react'
import { listCustomerReservations } from '../../services/customerReservationApi'

type Metric = "active-rentals" | "open-support" | "reservations" | "returning-rentals"

/** Server totals, not the length of a page or the demo Context. */
export async function loadCustomerApiCount(metric: Metric, customerId: string) {
  if (metric === 'reservations') {
    const first = await listCustomerReservations(undefined, 0, 100)
    const rows = [...first.data]
    for (let index = 1; index < first.pagination.totalPages; index++) rows.push(...(await listCustomerReservations(undefined, index, 100)).data)
    return rows.filter(record => !['COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(record.status)).length
  }
  if (metric === 'returning-rentals') {
    const rentals = await loadCustomerCurrentRentals(customerId)
    return rentals.data.filter(record => ['return_requested', 'return_inspection', 'closing'].includes(record.status)).length
  }
  const page = metric === "active-rentals"
    ? await listRentals("customer", { status: "active", page: 0, size: 1 })
    : await listSupportTickets("customer", { status: "open", page: 0, size: 1 })
  if (!page.data.every(record => "customerId" in record
    ? record.customerId === customerId
    : record.customer.id === customerId)) {
    throw new ApiClientError("Dữ liệu không thuộc tài khoản đang đăng nhập.", { code: "INVALID_RESPONSE" })
  }
  return page.pagination.totalItems
}

export function CustomerApiMetric({ metric }: { metric: Metric }) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== "ACTIVE" || !actor.roles.includes("CUSTOMER")) {
    return <MetricValue metric={metric} />
  }
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}:${metric}`
  return <CustomerMetricSession key={identity} metric={metric} identity={identity} customerId={actor.id} />
}

function CustomerMetricSession({ metric, identity, customerId }: { metric: Metric; identity: string; customerId: string }) {
  const read = useRentalApiResource(identity, () => loadCustomerApiCount(metric, customerId), { retainDataOnRefresh: true })
  return <div>
    <MetricValue metric={metric} value={read.loading && read.data == null ? "…" : read.error ? undefined : read.data} />
    {!!read.error && <p role="status" className="mt-1 text-xs text-amber-800">Chưa tải được số liệu. <button className="underline" onClick={read.refresh}>Thử lại</button></p>}
  </div>
}

function MetricValue({ metric, value }: { metric: Metric; value?: number | string }) {
  const titles: Record<Metric, string> = { 'active-rentals': 'Hồ sơ thuê đang hoạt động', 'open-support': 'Yêu cầu hỗ trợ đang mở', reservations: 'Đơn đặt giữ kho', 'returning-rentals': 'Kho đang yêu cầu trả' }
  return <StatCard title={titles[metric]} value={value ?? "Chưa xác minh"}
    icon={metric === 'reservations' ? Icon.calendar : metric === 'returning-rentals' ? Icon.clock : metric === 'active-rentals' ? Icon.key : Icon.support} />
}

/** Mở không gian chung cho hồ sơ thuê, gia hạn, trả kho và biên nhận. */
export function CustomerRentalApiLink({ onOpen }: { onOpen: (storageUnitId?: string) => void }) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('CUSTOMER')) return null
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}`
  return <CustomerRentalOverviewSession key={identity} identity={identity} customerId={actor.id} onOpen={onOpen} />
}

export async function loadCustomerCurrentRentals(customerId: string) {
  const first = await listRentals('customer', { page: 0, size: 100, sort: 'contractEndDate,asc' })
  const rows = [...first.data]
  for (let index = 1; index < first.pagination.totalPages; index++) {
    rows.push(...(await listRentals('customer', { page: index, size: 100, sort: 'contractEndDate,asc' })).data)
  }
  if (!rows.every(record => record.customer.id === customerId)) throw new ApiClientError('Dữ liệu không thuộc tài khoản đang đăng nhập.', { code: 'INVALID_RESPONSE' })
  const data = rows.filter(record => record.status !== 'completed')
  return { ...first, data, pagination: { ...first.pagination, totalItems: data.length, totalPages: Math.ceil(data.length / 5), pageSize: 5 } }
}

function CustomerRentalOverviewSession({ identity, customerId, onOpen }: { identity: string; customerId: string; onOpen: (storageUnitId?: string) => void }) {
  const [page, setPage] = useState(0)
  const read = useRentalApiResource(`overview-rentals:${identity}`, () => loadCustomerCurrentRentals(customerId), { retainDataOnRefresh: true })
  const total = read.data?.data.length ?? 0
  const pages = Math.ceil(total / 5)
  const currentPage = Math.min(page, Math.max(0, pages - 1))
  const visible = read.data?.data.slice(currentPage * 5, currentPage * 5 + 5) ?? []
  return <Card className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/70 px-5 py-4">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Kho hiện tại</p><h2 className="mt-1 font-bold text-stone-900">Các kho bạn đang thuê {read.data && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{total}</span>}</h2></div>
      <Button size="sm" variant="outline" onClick={() => onOpen()}>Tất cả hồ sơ</Button>
    </div>
    {read.loading && !read.data && <p role="status" className="p-5 text-sm text-stone-500">Đang tải hồ sơ thuê…</p>}
    {!!read.error && <div role="alert" className="p-5 text-sm text-amber-800"><p>Chưa tải được hồ sơ thuê.</p><Button size="sm" variant="outline" className="mt-2" onClick={read.refresh}>Thử lại</Button></div>}
    {!read.loading && !read.error && read.data && read.data.data.length === 0 && <p className="p-6 text-center text-sm text-stone-500">Bạn chưa có hồ sơ thuê đang hoạt động.</p>}
    <div className="space-y-3 p-4">{visible.map(record => <CustomerRentalOverviewRow key={record.id} record={record} onOpen={onOpen} />)}</div>
    {total > 5 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-4 py-3">
      <p className="text-xs text-stone-500">{currentPage * 5 + 1} đến {Math.min((currentPage + 1) * 5, total)} / {total} hồ sơ</p>
      <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Trước</Button><span className="text-xs text-stone-600">Trang {currentPage + 1}/{pages}</span><Button size="sm" variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Sau</Button></div>
    </div>}
  </Card>
}

export function CustomerRentalOverviewRow({ record, onOpen }: { record: RentalApiRecord; onOpen: (storageUnitId?: string) => void }) {
  const days = rentalDaysUntilDeadline(record)
  return <div className="rounded-xl border border-stone-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-base font-bold text-stone-900">{record.storageUnit.code}</p><h3 className="mt-1 text-sm font-medium text-stone-700">{record.facility.name}</h3><p className="mt-1 text-xs text-stone-500">{record.unitType.name}</p></div>
      <div className="flex flex-wrap justify-end gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{rentalLabels[record.status]}</span>
        {Number.isFinite(days) && days <= 7 && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${days < 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}</span>}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-stone-100 pt-3">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <div><dt className="text-stone-500">Thời hạn thuê</dt><dd className="mt-1 font-medium text-stone-800">{rentalDate(record.startDate)} → {rentalDate(record.dateSemantics?.lastPermittedDate || record.contractEndDate)}</dd></div>
        <div><dt className="text-stone-500">Giá thuê / tháng</dt><dd className="mt-1 font-semibold text-stone-900">{record.monthlyPrice == null ? 'Chưa xác định' : rentalMoney(record.monthlyPrice, record.currency)}</dd></div>
      </dl>
      <Button size="sm" variant="outline" onClick={() => onOpen(record.storageUnit.id)}>Mở hồ sơ</Button>
    </div>
  </div>
}
