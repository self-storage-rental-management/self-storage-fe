import { useEffect, useState } from 'react'
import { Badge, Button, Card, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { listCredentialAlerts, revokeAccessCredential, type CredentialAlert } from '../../services/checkInApi'
import { staffErrorMessage } from './staffPresentation'

export default function StaffCredentialRevocationPanel({ showToast }: { showToast: (message: string) => void }) {
  const [alerts, setAlerts] = useState<CredentialAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    void listCredentialAlerts()
      .then(items => setAlerts(items.filter(item => item.action === 'REVOKE')))
      .catch(reason => setError(staffErrorMessage(reason, 'Không thể tải credential cần thu hồi.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const revoke = async (alert: CredentialAlert) => {
    setBusy(alert.id)
    try {
      await revokeAccessCredential(alert.id, 'Thu hồi trong nghiệm thu trả kho')
      showToast(`Đã thu hồi ${alert.credentialType || 'quyền truy cập'} của ${alert.storageUnitCode}.`)
      refresh()
    } catch (reason) {
      setError(staffErrorMessage(reason, 'Không thể thu hồi credential.'))
    } finally {
      setBusy(null)
    }
  }

  return <Card className="mb-5 p-4">
    <SectionHeader title="Credential cần thu hồi" subtitle="Thu hồi PIN, thẻ, chìa khóa hoặc khóa tại bước nghiệm thu trả kho; hệ thống ghi nhận revokedAt." />
    {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <Table>
      <Thead><Tr><Th>Khách hàng</Th><Th>Gian kho</Th><Th>Loại</Th><Th>Đang hoạt động từ</Th><Th>Thao tác</Th></Tr></Thead>
      <Tbody>
        {!loading && !alerts.length && <Tr><Td colSpan={5} className="py-6 text-center text-stone-500">Không có credential cần thu hồi.</Td></Tr>}
        {alerts.map(alert => <Tr key={alert.id}>
          <Td><b>{alert.customerName}</b><p className="text-xs font-mono text-stone-500">{alert.reservationCode}</p></Td>
          <Td className="font-mono">{alert.storageUnitCode}</Td>
          <Td><Badge variant="warning">{alert.credentialType || 'Credential'}</Badge><p className="text-xs font-mono text-stone-500">{alert.reference}</p></Td>
          <Td>{alert.dueAt ? new Date(alert.dueAt).toLocaleString('vi-VN') : 'Theo lịch trả kho'}</Td>
          <Td><Button size="sm" variant="danger" disabled={busy === alert.id} onClick={() => void revoke(alert)}>{busy === alert.id ? 'Đang thu hồi…' : 'Thu hồi / vô hiệu hóa'}</Button></Td>
        </Tr>)}
      </Tbody>
    </Table>
  </Card>
}
