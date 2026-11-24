import { useState } from 'react'
import { Button } from '../../components/ui'
import type { RentalApiRecord } from '../../types/rentalApi'
import type { RenewalApiRecord } from '../../types/renewalApi'
import { useManagerPresentation } from '../manager/managerPresentation'
import { rentalDate, rentalRecordLabel, renewalLabels } from './presentation'
import { RentalRecordGroup, RentalRecordRow } from './RentalRecordList'
import { renewalWorkflowLabel } from './renewalStatusPresentation'
import ManagerContractPreview from './ManagerContractPreview'
import { RenewalDetailIcon, RenewalPreviewIcon, renewalBadgeClass, renewalDetailClass, renewalPreviewClass, renewalStatusTone, renewalTableHeadClass } from './renewalListStyles'

type RecordRow = RentalApiRecord | RenewalApiRecord
type Kind = 'rental' | 'renewal'

const closedRenewalStatuses = new Set<RenewalApiRecord['status']>(['completed', 'cancelled', 'rejected'])

export function managerRecordIsHistory(row: RecordRow, kind: Kind) {
  return kind === 'rental'
    ? row.status === 'completed'
    : closedRenewalStatuses.has(row.status as RenewalApiRecord['status'])
      || (row as RenewalApiRecord).statusSummary?.workflowStatus === 'NO_SHOW'
}

export default function ManagerRentalGroups(props: ({ kind: 'rental'; rows: RentalApiRecord[] } | { kind: 'renewal'; rows: RenewalApiRecord[] }) & {
  onDetail: (id: string) => void
}) {
  const { kind, rows, onDetail } = props
  const { copy } = useManagerPresentation()
  const [contractId, setContractId] = useState<string | null>(null)

  if (kind === 'rental') {
    const returningStatuses = ['return_requested', 'return_inspection', 'closing']
    const returningRows = rows.filter(row => returningStatuses.includes(row.status))
    const groups = [
      { id: 'ongoing', title: 'Đang diễn ra', subtitle: 'Hồ sơ đang thuê hoặc trong thời gian chuẩn bị.', active: true, rows: rows.filter(row => !managerRecordIsHistory(row, kind) && !returningStatuses.includes(row.status)) },
      ...(returningRows.length > 0 ? [{ id: 'returning', title: 'Đang trả kho', subtitle: 'Hồ sơ đã chuyển sang quy trình trả kho, nghiệm thu và quyết toán.', active: true, rows: returningRows }] : []),
      { id: 'history', title: 'Hồ sơ đã kết thúc', subtitle: 'Hồ sơ thuê đã hoàn tất xử lý.', active: false, rows: rows.filter(row => managerRecordIsHistory(row, kind)) },
    ]
    return <div className="space-y-5">
      {groups.map(group => <RentalRecordGroup key={group.id} id={`manager-rental-${group.id}`} title={group.title} subtitle={group.subtitle}
        count={group.rows.length} active={group.active}
        empty={!rows.length ? 'Không có dữ liệu' : group.active ? 'Không có hồ sơ đang xử lý trên trang này.' : 'Không có hồ sơ lịch sử trên trang này.'}>
        {group.rows.map(row => <RentalRecordRow key={row.id} rental={row} role="manager" unitTypeName={copy(row.unitType.name)}
          actions={<>
            <Button type="button" size="sm" variant="outline" aria-label={`Xem chi tiết ${rentalRecordLabel(row)}`} onClick={() => onDetail(row.id)}>Chi tiết hồ sơ</Button>
            <Button type="button" size="sm" variant="outline" className="!border-amber-400 !bg-amber-100 !text-amber-950 hover:!bg-amber-200"
              aria-label={`Xem trước hợp đồng ${rentalRecordLabel(row)}`} onClick={() => setContractId(row.id)}>Xem trước</Button>
          </>}
        />)}
      </RentalRecordGroup>)}
      {contractId && <ManagerContractPreview key={`${kind}:${contractId}`} kind={kind} id={contractId} onClose={() => setContractId(null)} />}
    </div>
  }

  const groups = [
    {
      id: 'ongoing', title: 'Đang xử lý',
      subtitle: 'Yêu cầu đang trong quá trình gia hạn.',
      rows: rows.filter(row => !managerRecordIsHistory(row, kind)),
    },
    {
      id: 'history', title: 'Lịch sử yêu cầu',
      subtitle: 'Yêu cầu đã hoàn tất, đã hủy hoặc đã đóng.',
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
        <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
          <caption className="sr-only">{group.title} - yêu cầu gia hạn</caption>
          <colgroup><col className="w-[15%]"/><col className="w-[9%]"/><col className="w-[20%]"/><col className="w-[18%]"/><col className="w-[13%]"/><col className="w-[16%]"/><col className="w-[9%]"/></colgroup>
          <thead className={`text-xs ${renewalTableHeadClass}`}><tr>
            {['Hồ sơ thuê', 'Lần gia hạn', 'Gian kho / Cơ sở', 'Trạng thái', 'Kết thúc kỳ']
              .map(label => <th key={label} scope="col" className={`px-4 py-3 font-medium ${label === 'Lần gia hạn' ? 'text-center' : ''}`}>{label}</th>)}
            <th scope="col" className="px-4 py-3 text-center font-medium">Xem trước hợp đồng</th>
            <th scope="col" className="px-2 py-3 text-center font-medium">Chi tiết</th>
          </tr></thead>
          <tbody className="divide-y divide-stone-200">
            {group.rows.map(renewal => {
              const recordLabel = rentalRecordLabel(renewal)
              const dossierLabel = renewal.rentalDisplayCode || 'Hồ sơ thuê'
              const endDate = renewal.effectivePeriod?.finalized ? renewal.effectivePeriod.newEndDate : renewal.newEndDate
              const statusLabel = renewal.statusSummary ? renewalWorkflowLabel(renewal) : renewalLabels[renewal.status]
              return <tr key={renewal.id} className="hover:bg-stone-50/70">
                <td className="px-4 py-3"><span className="block truncate font-medium text-stone-900" title={dossierLabel}>{dossierLabel}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-stone-700">{renewal.renewalSequence ? `Lần ${renewal.renewalSequence}` : '-'}</td>
                <td className="px-4 py-3"><span className="block truncate font-medium text-stone-900" title={renewal.storageUnit.code}>{renewal.storageUnit.code}</span><span className="block truncate text-xs text-stone-500" title={renewal.facility.name}>{renewal.facility.name}</span></td>
                <td className="px-4 py-3"><span className={`${renewalBadgeClass} ${renewalStatusTone(renewal)}`}>{statusLabel || renewal.status}</span></td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-stone-700">{endDate ? rentalDate(endDate) : 'Chưa xác định'}</td>
                <td className="px-4 py-3 text-center"><button type="button" className={renewalPreviewClass} aria-label={`Xem trước hợp đồng ${recordLabel}`} onClick={() => setContractId(renewal.id)}><RenewalPreviewIcon />Xem trước</button></td>
                <td className="px-1 py-3 text-center"><button type="button" title="Xem chi tiết hồ sơ" className={renewalDetailClass} aria-label={`Xem chi tiết ${recordLabel}`} onClick={() => onDetail(renewal.id)}>Chi tiết<RenewalDetailIcon /></button></td>
              </tr>
            })}
            {group.rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-500">{rows.length === 0 ? 'Không có dữ liệu' : group.id === 'ongoing' ? 'Không có hồ sơ đang xử lý trên trang này.' : 'Không có hồ sơ lịch sử trên trang này.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>)}
    {contractId && <ManagerContractPreview key={`${kind}:${contractId}`} kind={kind} id={contractId} onClose={() => setContractId(null)} />}
  </div>
}
