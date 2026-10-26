import { Modal } from '../../components/ui'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { isUuid, listRenewalOperationEvents } from '../../services/renewalOperationsApi'
import { EvidenceDownload } from '../rental-support-integration/EvidenceControls'
import ApiReadState from './ApiReadState'
import RentalHandoverFiles from './RentalHandoverFiles'
import { rentalDate } from './presentation'

export async function loadManagerRenewalContracts(id: string, role: 'manager' | 'customer' = 'manager') {
  const first = await listRenewalOperationEvents(role, id, 'documents', 0, 100)
  const events = [...first.data]
  for (let page = 1; page < first.pagination.totalPages; page++) {
    const next = await listRenewalOperationEvents(role, id, 'documents', page, 100)
    events.push(...next.data)
  }
  const files = new Map<string, { id: string; signedAt: string }>()
  for (const event of events) {
    if (event.kind !== 'COMPLETION' || !event.data || typeof event.data !== 'object') continue
    const fileId = (event.data as Record<string, unknown>).signedDocumentFileId
    if (isUuid(fileId) && !files.has(fileId)) files.set(fileId, { id: fileId, signedAt: event.occurredAt })
  }
  return [...files.values()]
}

function RenewalContracts({ id, role }: { id: string; role: 'manager' | 'customer' }) {
  const read = useRentalApiResource(`${role}:${id}:contract-preview`, () => loadManagerRenewalContracts(id, role))
  return <div className="space-y-3">
    <ApiReadState {...read} retry={read.refresh} />
    {read.data?.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Chưa có hợp đồng gia hạn đã ký.</p>}
    {read.data && <ul className="divide-y divide-stone-100">{read.data.map(file => <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div><p className="font-medium text-stone-900">Hợp đồng gia hạn đã ký</p><p className="mt-1 text-xs text-stone-500">{rentalDate(file.signedAt)}</p></div>
      <EvidenceDownload id={file.id} label="Tải hợp đồng" previewLabel="Xem trước" />
    </li>)}</ul>}
  </div>
}

export default function ManagerContractPreview({ kind, id, role = 'manager', onClose }: {
  kind: 'rental' | 'renewal'; id: string; role?: 'manager' | 'customer'; onClose: () => void
}) {
  return <Modal open title={kind === 'rental' ? 'Hợp đồng hồ sơ thuê' : 'Hợp đồng gia hạn'} onClose={onClose} size="xl">
    {kind === 'rental' ? <RentalHandoverFiles role={role} id={id} contractsOnly /> : <RenewalContracts id={id} role={role} />}
  </Modal>
}
