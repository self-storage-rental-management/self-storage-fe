import type { ReactNode } from 'react'
import { Badge } from '../../components/ui'
import type { RentalApiRecord } from '../../types/rentalApi'
import { RentalDeadlineBanner, rentalDaysUntilDeadline, rentalDeadlineState } from './RentalDeadlineNotice'
import { rentalDate, rentalMoney, rentalRecordLabel, rentalStatusLabel } from './presentation'
import './rentalRecordList.css'

const columns = ['Kho / Cơ sở', 'Mã hồ sơ', 'Trạng thái', 'Thời hạn thuê', 'Giá thuê / tháng', 'Thao tác']

export function RentalRecordGroup({ id, title, subtitle, count, active, empty, children, footer }: {
  id: string
  title: string
  subtitle: string
  count: number
  active: boolean
  empty: string
  children: ReactNode
  footer?: ReactNode
}) {
  return <section aria-labelledby={id} className="rental-record-group rounded-2xl border border-stone-200 bg-white">
    <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <div className={`rounded-l-sm border-l-4 pl-3 ${active ? 'border-amber-500' : 'border-stone-300'}`}>
        <h2 id={id} className="text-lg font-bold text-stone-900">{title}</h2>
        <p className="mt-0.5 text-sm text-stone-600">{subtitle}</p>
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-amber-50 text-amber-900' : 'bg-stone-100 text-stone-600'}`}>{count} hồ sơ</span>
    </header>
    {count > 0 ? <>
      <div className="rental-record-head rental-record-grid border-t border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600" aria-hidden="true">
        {columns.map(label => <span key={label}>{label}</span>)}
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
      {footer && <div className="border-t border-stone-100">{footer}</div>}
    </> : <p className="border-t border-stone-200 px-4 py-8 text-center text-sm text-stone-500">{empty}</p>}
  </section>
}

export function RentalRecordRow({ rental, role, focused, actions, unitTypeName }: {
  rental: RentalApiRecord
  role: 'customer' | 'manager'
  focused?: boolean
  actions: ReactNode
  unitTypeName: string
}) {
  const now = new Date()
  const days = rentalDaysUntilDeadline(rental, now)
  const nearDeadline = rentalDeadlineState(rental, now) !== null
  const isForcedOrReturning = ['return_requested', 'return_inspection', 'closing'].includes(rental.status)
  const tone = rental.status === 'active' ? 'success'
    : isForcedOrReturning ? 'danger' : 'muted'

  return <article id={`rental-api-record-${rental.id}`} tabIndex={-1}
    className={`rental-record-row rounded-xl border border-l-[3px] ${isForcedOrReturning ? 'border-red-300 border-l-4 border-l-red-600 bg-red-50/40' : 'border-stone-200 bg-white'} ${nearDeadline && !isForcedOrReturning ? 'border-l-amber-500' : ''} ${focused ? 'outline-2 outline-amber-500' : ''}`}>
    <div className="rental-record-grid items-center text-sm text-stone-800">
      <div className="rental-record-unit min-w-0 wrap-anywhere">
        <h3 className="font-bold text-stone-900">{rental.storageUnit.code}</h3>
        <p className="mt-0.5 text-stone-600">{rental.facility.name}</p>
        <p className="mt-0.5 text-stone-600">{unitTypeName}</p>
        {role === 'manager' && rental.customer?.fullName && <p className="mt-1 text-xs text-stone-600">Khách hàng: {rental.customer.fullName}</p>}
      </div>
      <div className="min-w-0 wrap-anywhere text-stone-600">
        <span className="rental-record-label">Mã hồ sơ</span>
        {rentalRecordLabel(rental)}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="rental-record-label">Trạng thái</span>
        <Badge variant={tone}>{rentalStatusLabel(rental)}</Badge>
        {rental.status === 'setup' && rental.inventoryVerifiedAt && rental.startDate &&
          <span className="text-xs text-stone-600">Theo lịch: {rentalDate(rental.startDate)}</span>}
        {nearDeadline && <span className={`rounded-md px-2 py-1 text-xs font-semibold ${days <= -8 ? 'bg-red-50 text-red-800' : days < 0 ? 'bg-orange-50 text-orange-800' : 'bg-amber-50 text-amber-900'}`}>
          {days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`}
        </span>}
      </div>
      <div className="min-w-0 wrap-anywhere tabular-nums">
        <span className="rental-record-label">Thời hạn thuê</span>
        <p>{rentalDate(rental.startDate)}</p>
        <p className="text-xs text-stone-500">đến</p>
        <p>{rentalDate(rental.dateSemantics?.lastPermittedDate || rental.contractEndDate)}</p>
      </div>
      <div className="rental-record-price min-w-0 font-bold tabular-nums text-stone-900">
        <span className="rental-record-label">Giá thuê / tháng</span>
        {rental.monthlyPrice == null ? 'Chưa xác định' : rentalMoney(rental.monthlyPrice, rental.currency)}
      </div>
      <div className="rental-record-actions grid grid-cols-2 gap-1.5">{actions}</div>
    </div>
    {nearDeadline && <div className="px-3 pb-3"><RentalDeadlineBanner rental={rental} role={role} now={now} compact /></div>}
  </article>
}
