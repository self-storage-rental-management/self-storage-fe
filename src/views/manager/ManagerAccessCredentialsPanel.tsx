import { useEffect, useState } from 'react'
import { Badge, Card, Input, SectionHeader, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { listAccessCredentials, type AccessCredential, type AccessCredentialStatus } from '../../services/checkInApi'
import { staffErrorMessage } from '../staff/staffPresentation'

export default function ManagerAccessCredentialsPanel({ facilityId }: { facilityId?: string }) {
  const [items, setItems] = useState<AccessCredential[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<AccessCredentialStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void listAccessCredentials({ facilityId, q: query, status: status || undefined, pageSize: 100 })
      .then(page => { if (active) setItems(page.data) })
      .catch(reason => { if (active) setError(staffErrorMessage(reason, 'Không thể tải lịch sử quyền truy cập.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [facilityId, query, status])

  const typeLabel: Record<AccessCredential['type'], string> = { PIN: 'PIN / access code', CARD: 'Thẻ', KEY: 'Chìa khóa', LOCK: 'Khóa' }

  return <div className="space-y-5">
    <SectionHeader title="Lịch sử quyền truy cập" subtitle="Manager chỉ theo dõi lịch sử cấp/thu hồi, Staff là actor duy nhất được thao tác credential." />
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px]">
        <Input label="Tìm kiếm" placeholder="Đơn đặt kho, khách hàng, gian kho, số seri" value={query} onChange={event => setQuery(event.target.value)} />
        <Select label="Trạng thái" value={status} onChange={event => setStatus(event.target.value as AccessCredentialStatus | '')}>
          <option value="">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="REVOKED">Đã thu hồi</option>
        </Select>
      </div>
    </Card>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <Card>
      <Table>
        <Thead><Tr><Th>Đơn / khách hàng</Th><Th>Credential</Th><Th>Gian kho</Th><Th>Cấp lúc</Th><Th>Thu hồi lúc</Th><Th>Trạng thái</Th><Th>Người cấp</Th></Tr></Thead>
        <Tbody>
          {!loading && !items.length && <Tr><Td colSpan={7} className="py-8 text-center text-stone-500">Chưa có lịch sử credential.</Td></Tr>}
          {items.map(item => <Tr key={item.id}>
            <Td><b className="font-mono">{item.reservationCode}</b><p className="text-xs text-stone-500">{item.customerName}</p></Td>
            <Td><b>{typeLabel[item.type]}</b><p className="text-xs font-mono text-stone-500">{item.reference}</p></Td>
            <Td className="font-mono">{item.storageUnitCode}</Td>
            <Td>{new Date(item.issuedAt).toLocaleString('vi-VN')}</Td>
            <Td>{item.revokedAt ? new Date(item.revokedAt).toLocaleString('vi-VN') : '—'}</Td>
            <Td><Badge variant={item.status === 'ACTIVE' ? 'success' : 'muted'}>{item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã thu hồi'}</Badge></Td>
            <Td>{item.issuedByName}</Td>
          </Tr>)}
        </Tbody>
      </Table>
    </Card>
  </div>
}
