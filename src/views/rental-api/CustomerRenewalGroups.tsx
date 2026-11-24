import { useState } from 'react'
import type { RenewalApiRecord } from '../../types/renewalApi'
import { Button } from '../../components/ui'
import { rentalDate, renewalDisplayLabel, renewalLabels } from './presentation'
import { renewalWorkflowLabel } from './renewalStatusPresentation'
import ManagerContractPreview from './ManagerContractPreview'
import { RenewalDetailIcon, RenewalPreviewIcon, RenewalSearch, renewalBadgeClass, renewalDetailClass, renewalPreviewClass, renewalStatusTone, renewalTableHeadClass } from './renewalListStyles'

const shortLabels: Record<RenewalApiRecord['status'], string> = {
  pending: 'Đang kiểm tra', accepted: 'Chờ thanh toán', deposit_paid: 'Đã thanh toán trả trước',
  full_rent_paid: 'Đã thanh toán đủ', approved: 'Mở thanh toán', appointment_scheduled: 'Đang xử lý',
  payment_processing: 'Chờ kết quả thanh toán', payment_failed: 'Chờ thanh toán lại',
  payment_expired: 'Hết hạn', rejected: 'Đã đóng', cancelled: 'Đã hủy', completed: 'Hoàn tất',
}
const terminal = new Set<RenewalApiRecord['status']>(['completed', 'cancelled', 'rejected', 'payment_expired'])
const isFinished = (row: RenewalApiRecord) => terminal.has(row.status) || row.statusSummary?.workflowStatus === 'NO_SHOW'

export default function CustomerRenewalGroups({ rows, onDetail }: {
  rows: RenewalApiRecord[]; onDetail: (id: string) => void
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [pages, setPages] = useState<Record<string, number>>({})
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
  const matched = rows.filter(row => normalize([renewalDisplayLabel(row), row.rentalDisplayCode, row.displayCode, row.id, row.storageUnit.code, row.facility.name].join(' ')).includes(filter))
  const groups = [
    { id: 'ongoing', title: 'Đang diễn ra', subtitle: 'Các yêu cầu gia hạn đang được xử lý.', rows: matched.filter(row => !isFinished(row)), active: true },
    { id: 'finished', title: 'Hồ sơ hoàn tất', subtitle: 'Bao gồm hồ sơ hoàn tất, khách không đến, đã hủy hoặc đã đóng.', rows: matched.filter(isFinished), active: false },
  ]
  return <div className="space-y-5">
    <RenewalSearch value={search} onChange={setSearch} onSearch={() => { setFilter(normalize(search.trim())); setPages({}) }} />
    {groups.map(group => {
      const totalPages = Math.max(1, Math.ceil(group.rows.length / 5))
      const page = Math.min(pages[group.id] ?? 0, totalPages - 1)
      return <section key={group.id} aria-labelledby={`renewal-group-${group.id}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <div><h2 id={`renewal-group-${group.id}`} className="text-base font-semibold text-stone-900">{group.title}</h2>
            <p className="mt-0.5 text-xs text-stone-500">{group.subtitle}</p></div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${group.active ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{group.rows.length} hồ sơ</span>
      </header>
      {group.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1080px] table-fixed text-left text-sm">
        <caption className="sr-only">Yêu cầu gia hạn - {group.title}</caption>
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[20%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead className={`text-xs ${renewalTableHeadClass}`}><tr>
          {['Hồ sơ thuê', 'Lần gia hạn', 'Trạng thái', 'Gian kho / Cơ sở', 'Thời hạn', 'Hợp đồng', 'Thao tác'].map(label => <th key={label} className={`px-4 py-3 font-medium ${['Lần gia hạn', 'Trạng thái', 'Hợp đồng', 'Thao tác'].includes(label) ? 'text-center' : ''}`}>{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-stone-200">{group.rows.slice(page * 5, (page + 1) * 5).map(row => <tr key={row.id} id={`rental-api-record-${row.id}`} tabIndex={-1} className="transition-colors hover:bg-stone-50/70">
          <td className="px-4 py-4"><span title={row.rentalDisplayCode || 'Hồ sơ thuê'} className="text-sm font-semibold text-stone-800">{row.rentalDisplayCode || 'Hồ sơ thuê'}</span></td>
          <td className="px-4 py-4 text-center"><span className="font-semibold text-stone-700">{row.renewalSequence ? `Lần ${row.renewalSequence}` : 'Gia hạn'}</span></td>
          <td className="px-4 py-4 text-center"><span title={row.statusSummary ? renewalWorkflowLabel(row) : renewalLabels[row.status]} className={`${renewalBadgeClass} ${renewalStatusTone(row)}`}>{row.statusSummary ? renewalWorkflowLabel(row) : shortLabels[row.status]}</span></td>
          <td className="max-w-[300px] px-4 py-4"><p className="break-words font-medium text-stone-800">{row.storageUnit.code}</p><p className="mt-1 text-xs text-stone-500">{row.facility.name}</p></td>
          <td className="whitespace-nowrap px-4 py-4 text-stone-700">{rentalDate(row.newEndDate)}</td>
          <td className="px-4 py-4 text-center"><button type="button" className={renewalPreviewClass} aria-label={`Xem trước hợp đồng ${renewalDisplayLabel(row)}`} onClick={() => setPreviewId(row.id)}><RenewalPreviewIcon />Xem trước</button></td>
          <td className="px-4 py-4 text-center">
            <button type="button" className={renewalDetailClass} aria-label={`Xem chi tiết ${renewalDisplayLabel(row)}`} onClick={() => onDetail(row.id)}>Chi tiết<RenewalDetailIcon /></button>
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
