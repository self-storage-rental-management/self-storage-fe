import type { RenewalApiRecord } from '../../types/renewalApi'
import { Button } from '../../components/ui'
import { rentalDate, renewalLabels } from './presentation'

const shortLabels: Record<RenewalApiRecord['status'], string> = {
  pending: 'Đang kiểm tra', accepted: 'Đã xác nhận', deposit_paid: 'Đã cọc',
  full_rent_paid: 'Đã thanh toán', approved: 'Mở thanh toán', appointment_scheduled: 'Đã hẹn',
  payment_processing: 'Đang thanh toán', payment_failed: 'Lỗi thanh toán',
  payment_expired: 'Hết hạn', rejected: 'Đã đóng', cancelled: 'Đã hủy', completed: 'Hoàn tất',
}
// Failed/expired payments can still require action: they are not completed records.
const terminal = new Set<RenewalApiRecord['status']>(['completed', 'cancelled', 'rejected'])

export default function CustomerRenewalGroups({ rows, onDetail }: {
  rows: RenewalApiRecord[]; onDetail: (id: string) => void
}) {
  const groups = [
    { id: 'ongoing', title: 'Đang diễn ra', subtitle: 'Các yêu cầu gia hạn đang được xử lý.', rows: rows.filter(row => !terminal.has(row.status)), active: true },
    { id: 'finished', title: 'Hồ sơ hoàn tất', subtitle: 'Bao gồm hồ sơ hoàn tất, đã hủy hoặc đã đóng.', rows: rows.filter(row => terminal.has(row.status)), active: false },
  ]
  return <div className="space-y-5">
    {groups.map(group => <section key={group.id} aria-labelledby={`renewal-group-${group.id}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={`h-8 w-1 rounded-full ${group.active ? 'bg-amber-400' : 'bg-stone-300'}`} />
          <div><h2 id={`renewal-group-${group.id}`} className="text-base font-semibold text-stone-900">{group.title}</h2>
            <p className="mt-0.5 text-xs text-stone-500">{group.subtitle}</p></div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${group.active ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{group.rows.length} hồ sơ</span>
      </header>
      {group.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">Yêu cầu gia hạn — {group.title}</caption>
        <thead className="bg-stone-50 text-xs text-stone-500"><tr>
          {['Mã hồ sơ', 'Trạng thái', 'Gian kho / Cơ sở', 'Thời hạn', 'Thao tác'].map(label => <th key={label} className="px-4 py-3 font-medium last:text-right">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-stone-100">{group.rows.map(row => <tr key={row.id} id={`rental-api-record-${row.id}`} tabIndex={-1} className="transition-colors hover:bg-stone-50/70">
          <td className="px-4 py-4"><span title={row.id} className="font-mono text-xs text-stone-600">{row.displayCode || row.id}</span></td>
          <td className="px-4 py-4"><span title={renewalLabels[row.status]} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${row.status === 'completed' ? 'bg-emerald-50 text-emerald-800' : terminal.has(row.status) ? 'bg-stone-100 text-stone-600' : row.status === 'payment_failed' || row.status === 'payment_expired' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>{shortLabels[row.status]}</span></td>
          <td className="max-w-[300px] px-4 py-4"><p className="break-words font-medium text-stone-800">{row.storageUnit.code}</p><p className="mt-1 text-xs text-stone-500">{row.facility.name}</p></td>
          <td className="whitespace-nowrap px-4 py-4 text-stone-700">{rentalDate(row.newEndDate)}</td>
          <td className="px-4 py-4 text-right"><Button size="sm" variant="outline" onClick={() => onDetail(row.id)}>Chi tiết</Button></td>
        </tr>)}</tbody>
      </table></div> : <p className="px-4 py-8 text-center text-sm text-stone-500">{group.active ? 'Không có yêu cầu gia hạn đang diễn ra.' : 'Chưa có hồ sơ gia hạn đã kết thúc.'}</p>}
    </section>)}
  </div>
}
