import { useState } from 'react'
import type { RentalApiRecord } from '../../types/rentalApi'
import type { RenewalApiRecord } from '../../types/renewalApi'
import { rentalDate, rentalLabels, rentalRecordLabel, renewalLabels } from './presentation'
import { renewalWorkflowLabel } from './renewalStatusPresentation'
import ManagerContractPreview from './ManagerContractPreview'

type RecordRow = RentalApiRecord | RenewalApiRecord
type Kind = 'rental' | 'renewal'

const closedRenewalStatuses = new Set<RenewalApiRecord['status']>(['completed', 'cancelled', 'rejected'])

export function managerRecordIsHistory(row: RecordRow, kind: Kind) {
  return kind === 'rental'
    ? row.status === 'completed'
    : closedRenewalStatuses.has(row.status as RenewalApiRecord['status'])
      || (row as RenewalApiRecord).statusSummary?.workflowStatus === 'NO_SHOW'
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
      subtitle: kind === 'renewal' ? 'Yêu cầu đang trong quá trình gia hạn.' : 'Hồ sơ đang thuê, trong thời gian chuẩn bị hoặc đang trả kho.',
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
        <table className={`w-full table-fixed text-left text-sm ${kind === 'renewal' ? 'min-w-[1040px]' : 'min-w-[960px]'}`}>
          <caption className="sr-only">{group.title} - {kind === 'renewal' ? 'yêu cầu gia hạn' : 'hồ sơ thuê'}</caption>
          {kind === 'renewal'
            ? <colgroup><col className="w-[15%]"/><col className="w-[9%]"/><col className="w-[20%]"/><col className="w-[18%]"/><col className="w-[13%]"/><col className="w-[16%]"/><col className="w-[9%]"/></colgroup>
            : <colgroup><col className="w-[19%]"/><col className="w-[23%]"/><col className="w-[19%]"/><col className="w-[14%]"/><col className="w-[16%]"/><col className="w-[9%]"/></colgroup>}
          <thead className="bg-stone-50 text-xs text-stone-500"><tr>
            {(kind === 'renewal'
              ? ['Hồ sơ thuê', 'Lần gia hạn', 'Gian kho / Cơ sở', 'Trạng thái', 'Kết thúc kỳ']
              : ['Mã hồ sơ', 'Gian kho / Cơ sở', 'Trạng thái', 'Kết thúc kỳ'])
              .map(label => <th key={label} scope="col" className={`px-4 py-3 font-medium ${label === 'Lần gia hạn' ? 'text-center' : ''}`}>{label}</th>)}
            <th scope="col" className="px-4 py-3 text-center font-medium">Xem trước hợp đồng</th>
            <th scope="col" className="px-2 py-3 text-center font-medium">Chi tiết</th>
          </tr></thead>
          <tbody className="divide-y divide-stone-100">
            {group.rows.map(row => {
              const renewal = kind === 'renewal' ? row as RenewalApiRecord : null
              const rental = kind === 'rental' ? row as RentalApiRecord : null
              const recordLabel = rentalRecordLabel(row)
              const dossierLabel = renewal ? renewal.rentalDisplayCode || 'Hồ sơ thuê' : recordLabel
              const endDate = renewal?.effectivePeriod?.finalized ? renewal.effectivePeriod.newEndDate : renewal?.newEndDate
              const displayedEnd = rental?.dateSemantics?.lastPermittedDate || rental?.contractEndDate || endDate
              const statusLabel = kind === 'rental' ? rentalLabels[row.status as RentalApiRecord['status']] : renewal?.statusSummary ? renewalWorkflowLabel(renewal) : renewalLabels[row.status as RenewalApiRecord['status']]
              const tone = row.status === 'completed' ? 'bg-emerald-50 text-emerald-800'
                : managerRecordIsHistory(row, kind) ? 'bg-stone-100 text-stone-700'
                : row.status === 'payment_failed' || row.status === 'payment_expired' ? 'bg-rose-50 text-rose-800'
                : 'bg-amber-50 text-amber-800'
              return <tr key={row.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3"><span className="block truncate font-medium text-stone-900" title={dossierLabel}>{dossierLabel}</span></td>
                {renewal && <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-stone-700">{renewal.renewalSequence ? `Lần ${renewal.renewalSequence}` : '—'}</td>}
                <td className="px-4 py-3"><span className="block truncate font-medium text-stone-900" title={row.storageUnit.code}>{row.storageUnit.code}</span><span className="block truncate text-xs text-stone-500" title={row.facility.name}>{row.facility.name}</span></td>
                <td className="px-4 py-3"><span className={`mx-auto flex min-h-8 w-[95%] items-center justify-center rounded-full px-2 text-center text-xs font-medium ${tone}`}><span className="truncate">{statusLabel || row.status}</span></span></td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-stone-700">{displayedEnd ? rentalDate(displayedEnd) : 'Chưa xác định'}</td>
                <td className="px-4 py-3 text-center"><button type="button" className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md border-0 bg-amber-200 px-3 text-sm !font-extrabold text-amber-900 hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" aria-label={`Xem trước hợp đồng ${recordLabel}`} onClick={() => setContractId(row.id)}>Xem trước</button></td>
                <td className="px-1 py-3 text-center"><button type="button" title="Xem chi tiết hồ sơ" className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md border-0 bg-stone-200 px-2 text-sm !font-extrabold text-stone-700 hover:bg-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600" aria-label={`Xem chi tiết ${recordLabel}`} onClick={() => onDetail(row.id)}>Chi tiết</button></td>
              </tr>
            })}
            {group.rows.length === 0 && <tr><td colSpan={kind === 'renewal' ? 7 : 6} className="px-4 py-8 text-center text-sm text-stone-500">{rows.length === 0 ? 'Không có dữ liệu' : group.id === 'ongoing' ? 'Không có hồ sơ đang xử lý trên trang này.' : 'Không có hồ sơ lịch sử trên trang này.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>)}
    {contractId && <ManagerContractPreview key={`${kind}:${contractId}`} kind={kind} id={contractId} onClose={() => setContractId(null)} />}
  </div>
}
