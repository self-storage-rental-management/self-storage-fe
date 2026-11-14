import { useState } from 'react'
import type { RenewalApiRecord } from '../../types/renewalApi'
import { Button } from '../../components/ui'
import { rentalDate, renewalLabels } from './presentation'
import { renewalWorkflowLabel } from './renewalStatusPresentation'
import ManagerContractPreview from './ManagerContractPreview'

const shortLabels: Record<RenewalApiRecord['status'], string> = {
  pending: 'Đang kiểm tra', accepted: 'Chờ thanh toán', deposit_paid: 'Đã thanh toán',
  full_rent_paid: 'Đã thanh toán', approved: 'Mở thanh toán', appointment_scheduled: 'Đang xử lý',
  payment_processing: 'Chờ kết quả thanh toán', payment_failed: 'Chờ thanh toán lại',
  payment_expired: 'Hết hạn', rejected: 'Đã đóng', cancelled: 'Đã hủy', completed: 'Hoàn tất',
}
// Failed/expired payments can still require action: they are not completed records.
const terminal = new Set<RenewalApiRecord['status']>(['completed', 'cancelled', 'rejected'])

export default function CustomerRenewalGroups({ rows, onDetail }: {
  rows: RenewalApiRecord[]; onDetail: (id: string) => void
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pages, setPages] = useState<Record<string, number>>({})
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
  const matched = rows.filter(row => normalize([row.displayCode, row.id, row.storageUnit.code, row.facility.name].join(' ')).includes(normalize(search.trim())))
  const groups = [
    { id: 'ongoing', title: 'Đang diễn ra', subtitle: 'Các yêu cầu gia hạn đang được xử lý.', rows: matched.filter(row => !terminal.has(row.status)), active: true },
    { id: 'finished', title: 'Hồ sơ hoàn tất', subtitle: 'Bao gồm hồ sơ hoàn tất, đã hủy hoặc đã đóng.', rows: matched.filter(row => terminal.has(row.status)), active: false },
  ]
  return <div className="space-y-5">
    <label className="block rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-700">Tìm kiếm hồ sơ gia hạn
      <input className="mt-2 block w-full rounded-lg border border-stone-300 px-3 py-2 font-normal" placeholder="Mã hồ sơ, gian kho hoặc cơ sở" value={search} maxLength={200} onChange={event => { setSearch(event.target.value); setPages({}) }} />
    </label>
    {groups.map(group => {
      const totalPages = Math.max(1, Math.ceil(group.rows.length / 5))
      const page = Math.min(pages[group.id] ?? 0, totalPages - 1)
      return <section key={group.id} aria-labelledby={`renewal-group-${group.id}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={`h-8 w-1 rounded-full ${group.active ? 'bg-amber-400' : 'bg-stone-300'}`} />
          <div><h2 id={`renewal-group-${group.id}`} className="text-base font-semibold text-stone-900">{group.title}</h2>
            <p className="mt-0.5 text-xs text-stone-500">{group.subtitle}</p></div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${group.active ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{group.rows.length} hồ sơ</span>
      </header>
      {group.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm">
        <caption className="sr-only">Yêu cầu gia hạn - {group.title}</caption>
        <thead className="bg-stone-50 text-xs text-stone-500"><tr>
          {['Mã hồ sơ', 'Trạng thái', 'Gian kho / Cơ sở', 'Thời hạn', 'Hợp đồng', 'Thao tác'].map(label => <th key={label} className={`px-4 py-3 font-medium ${label === 'Trạng thái' || label === 'Hợp đồng' ? 'text-center' : ''} ${label === 'Thao tác' ? 'text-right' : ''}`}>{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-stone-100">{group.rows.slice(page * 5, (page + 1) * 5).map(row => <tr key={row.id} id={`rental-api-record-${row.id}`} tabIndex={-1} className="transition-colors hover:bg-stone-50/70">
          <td className="px-4 py-4"><span title={row.id} className="font-mono text-xs text-stone-600">{row.displayCode || row.id}</span></td>
          <td className="px-4 py-4"><span title={renewalLabels[row.status]} className={`mx-auto flex min-h-8 w-[95%] items-center justify-center rounded-full px-2 text-center text-xs font-medium ${row.status === 'completed' ? 'bg-emerald-50 text-emerald-800' : terminal.has(row.status) ? 'bg-stone-100 text-stone-600' : row.status === 'payment_failed' || row.status === 'payment_expired' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>{row.statusSummary ? renewalWorkflowLabel(row) : shortLabels[row.status]}</span></td>
          <td className="max-w-[300px] px-4 py-4"><p className="break-words font-medium text-stone-800">{row.storageUnit.code}</p><p className="mt-1 text-xs text-stone-500">{row.facility.name}</p></td>
          <td className="whitespace-nowrap px-4 py-4 text-stone-700">{rentalDate(row.newEndDate)}</td>
          <td className="px-4 py-4 text-center"><button type="button" className="mx-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-amber-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500" aria-label={`Xem trước hợp đồng gia hạn ${row.displayCode || row.id}`} onClick={() => setPreviewId(row.id)}>Xem trước</button></td>
          <td className="px-4 py-4 text-right">
            <Button size="sm" variant="outline" onClick={() => onDetail(row.id)}>Chi tiết</Button>
          </td>
        </tr>)}</tbody>
      </table></div> : <p className="px-4 py-8 text-center text-sm text-stone-500">{group.active ? 'Không có yêu cầu gia hạn đang diễn ra.' : 'Chưa có hồ sơ gia hạn đã kết thúc.'}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 p-4 text-sm text-stone-600">
        <span>{group.rows.length} hồ sơ · Trang {page + 1}/{totalPages}</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPages(current => ({ ...current, [group.id]: page - 1 }))}>Trước</Button><Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPages(current => ({ ...current, [group.id]: page + 1 }))}>Sau</Button></div>
      </footer>
    </section>})}
    {previewId && <ManagerContractPreview key={`customer:renewal:${previewId}`} kind="renewal" id={previewId} role="customer" onClose={() => setPreviewId(null)} />}
  </div>
}
