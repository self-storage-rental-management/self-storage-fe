import { useState } from 'react'
import type { RentalApiRecord } from '../../types/rentalApi'
import type { RenewalApiRecord } from '../../types/renewalApi'
import { rentalDate, rentalLabels, renewalLabels } from './presentation'
import ManagerContractPreview from './ManagerContractPreview'

type RecordRow = RentalApiRecord | RenewalApiRecord
type Kind = 'rental' | 'renewal'

const closedRenewalStatuses = new Set<RenewalApiRecord['status']>(['completed', 'cancelled', 'rejected'])

export function managerRecordIsHistory(row: RecordRow, kind: Kind) {
  return kind === 'rental'
    ? row.status === 'completed'
    : closedRenewalStatuses.has(row.status as RenewalApiRecord['status'])
}

export default function ManagerRentalGroups({ kind, rows, onDetail }: {
  kind: Kind
  rows: RecordRow[]
  onDetail: (id: string) => void
}) {
  const [contractId, setContractId] = useState<string | null>(null)
  const groups = [
    {
      id: 'ongoing', title: kind === 'renewal' ? 'Đang xử lý' : 'Đang thuê và xử lý',
      subtitle: kind === 'renewal' ? 'Yêu cầu đang trong quá trình gia hạn.' : 'Hồ sơ đang thuê, trong setup hoặc đang trả kho.',
      rows: rows.filter(row => !managerRecordIsHistory(row, kind)),
    },
    {
      id: 'history', title: kind === 'renewal' ? 'Lịch sử yêu cầu' : 'Hồ sơ đã kết thúc',
      subtitle: kind === 'renewal' ? 'Yêu cầu đã hoàn tất, đã hủy hoặc đã đóng.' : 'Hồ sơ thuê đã hoàn tất xử lý.',
      rows: rows.filter(row => managerRecordIsHistory(row, kind)),
    },
  ]

  return <div className="space-y-6 p-4 sm:p-5">
    {groups.map(group => <section key={group.id} aria-labelledby={`manager-${kind}-${group.id}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id={`manager-${kind}-${group.id}`} className="text-lg font-semibold text-stone-900">{group.title}</h2>
          <p className="mt-0.5 text-sm text-stone-500">{group.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{group.rows.length} hồ sơ</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="w-full min-w-[960px] table-fixed text-left text-sm">
          <caption className="sr-only">{group.title} - {kind === 'renewal' ? 'yêu cầu gia hạn' : 'hồ sơ thuê'}</caption>
          <colgroup><col className="w-[21%]"/><col className="w-[23%]"/><col className="w-[19%]"/><col className="w-[14%]"/><col className="w-[16%]"/><col className="w-[7%]"/></colgroup>
          <thead className="bg-stone-50 text-xs text-stone-500"><tr>
            {['Mã hồ sơ', 'Gian kho / Cơ sở', 'Trạng thái', 'Kết thúc kỳ', 'Xem trước hợp đồng'].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
            <th scope="col" className="px-2 py-3 text-center font-medium">Chi tiết</th>
          </tr></thead>
          <tbody className="divide-y divide-stone-100">
            {group.rows.map(row => {
              const renewal = kind === 'renewal' ? row as RenewalApiRecord : null
              const rental = kind === 'rental' ? row as RentalApiRecord : null
              const endDate = renewal?.effectivePeriod?.finalized ? renewal.effectivePeriod.newEndDate : renewal?.newEndDate
              const displayedEnd = rental?.dateSemantics?.lastPermittedDate || rental?.contractEndDate || endDate
              const statusLabel = kind === 'rental' ? rentalLabels[row.status as RentalApiRecord['status']] : renewalLabels[row.status as RenewalApiRecord['status']]
              const tone = row.status === 'completed' ? 'bg-emerald-50 text-emerald-800'
                : managerRecordIsHistory(row, kind) ? 'bg-stone-100 text-stone-700'
                : row.status === 'payment_failed' || row.status === 'payment_expired' ? 'bg-rose-50 text-rose-800'
                : 'bg-amber-50 text-amber-800'
              return <tr key={row.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3"><span className="block truncate font-medium text-stone-900" title={renewal?.displayCode || row.id}>{renewal?.displayCode || row.id}</span></td>
                <td className="px-4 py-3"><span className="block truncate font-medium text-stone-900" title={row.storageUnit.code}>{row.storageUnit.code}</span><span className="block truncate text-xs text-stone-500" title={row.facility.name}>{row.facility.name}</span></td>
                <td className="px-4 py-3"><span className={`mx-auto flex min-h-8 w-[95%] items-center justify-center rounded-full px-2 text-center text-xs font-medium ${tone}`}><span className="truncate">{statusLabel || row.status}</span></span></td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-stone-700">{displayedEnd ? rentalDate(displayedEnd) : 'Chưa xác định'}</td>
                <td className="px-4 py-3"><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-amber-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500" aria-label={`Xem trước hợp đồng ${renewal?.displayCode || row.id}`} onClick={() => setContractId(row.id)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="show-icon h-4 w-4 shrink-0"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round"/></svg>Xem trước</button></td>
                <td className="px-2 py-3"><button type="button" title="Xem chi tiết hồ sơ" className="mx-auto flex min-h-10 min-w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-amber-50 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500" aria-label={`Xem chi tiết ${renewal?.displayCode || row.id}`} onClick={() => onDetail(row.id)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="show-icon h-5 w-5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3"/></svg></button></td>
              </tr>
            })}
            {group.rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-stone-500">{rows.length === 0 ? 'Không có dữ liệu' : group.id === 'ongoing' ? 'Không có hồ sơ đang xử lý trên trang này.' : 'Không có hồ sơ lịch sử trên trang này.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>)}
    {contractId && <ManagerContractPreview key={`${kind}:${contractId}`} kind={kind} id={contractId} onClose={() => setContractId(null)} />}
  </div>
}
