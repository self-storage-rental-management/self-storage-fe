import { Badge, Button, Card, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { User } from '../../types'
import type { StorageReservation } from '../../types/storageHub'

interface Props {
  user: User
  reservations: StorageReservation[]
  approveReservation: (reservationId: string, reviewer: User) => void
  showToast: (message: string) => void
}

export default function StaffReservationsPanel({ user, reservations, approveReservation, showToast }: Props) {
    const pending = reservations.filter(item => item.status === 'awaiting_review')
  const approve = (id: string) => {
    try {
      approveReservation(id, user)
      showToast('Đã phê duyệt hồ sơ. Khách hàng có thể thanh toán cọc.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể phê duyệt hồ sơ.')
    }
  }
  return <div className="fade-in space-y-5">
    <SectionHeader title={'Phê Duyệt Yêu Cầu Đặt Giữ Kho'} subtitle={'Chỉ hồ sơ đã xác minh email mới xuất hiện tại đây.'} />
    <Card>
      <Table><Thead><tr><Th>{'Mã'}</Th><Th>{'Khách hàng'}</Th><Th>{'Cỡ kho'}</Th><Th>{'Ngày vào'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead>
        <Tbody>{pending.map(item => <Tr key={item.id}><Td className="font-mono">{item.id}</Td><Td><b>{item.customerName}</b><br /><span className="text-xs text-stone-500">{item.customerEmail}</span></Td><Td>{item.unitTypeName}</Td><Td>{item.moveInDate}</Td><Td><Badge variant="warning">{'Chờ duyệt'}</Badge></Td><Td className="text-right"><Button size="sm" onClick={() => approve(item.id)}>{'Phê duyệt'}</Button></Td></Tr>)}</Tbody>
      </Table>
      {!pending.length && <div className="p-10 text-center text-sm text-stone-500">{'Không có hồ sơ chờ phê duyệt.'}</div>}
    </Card>
  </div>
}
