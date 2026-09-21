import { Badge, Button, Card, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { StorageReservation } from '../../types/storageHub'

interface Props {
  user: User
  reservations: StorageReservation[]
  approveReservation: (reservationId: string, reviewer: User) => void
  showToast: (message: string) => void
}

export default function StaffReservationsPanel({ user, reservations, approveReservation, showToast }: Props) {
  const { lang } = useLanguage()
  const pending = reservations.filter(item => item.status === 'awaiting_review')
  const approve = (id: string) => {
    try {
      approveReservation(id, user)
      showToast(lang === 'vi' ? 'Đã phê duyệt hồ sơ. Customer có thể thanh toán cọc.' : 'Approved. Deposit payment is now available to the customer.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể phê duyệt hồ sơ.')
    }
  }
  return <div className="fade-in space-y-5">
    <SectionHeader title={lang === 'vi' ? 'Phê Duyệt Yêu Cầu Đặt Giữ Kho' : 'Reservation Approval'} subtitle={lang === 'vi' ? 'Chỉ hồ sơ đã xác minh email mới xuất hiện tại đây.' : 'Only email-verified requests appear here.'} />
    <Card>
      <Table><Thead><tr><Th>{lang === 'vi' ? 'Mã' : 'ID'}</Th><Th>Customer</Th><Th>{lang === 'vi' ? 'Cỡ kho' : 'Unit type'}</Th><Th>{lang === 'vi' ? 'Ngày vào' : 'Move-in'}</Th><Th>{lang === 'vi' ? 'Trạng thái' : 'Status'}</Th><Th /></tr></Thead>
        <Tbody>{pending.map(item => <Tr key={item.id}><Td className="font-mono">{item.id}</Td><Td><b>{item.customerName}</b><br /><span className="text-xs text-stone-500">{item.customerEmail}</span></Td><Td>{item.unitTypeName}</Td><Td>{item.moveInDate}</Td><Td><Badge variant="warning">{lang === 'vi' ? 'Chờ duyệt' : 'Awaiting review'}</Badge></Td><Td className="text-right"><Button size="sm" onClick={() => approve(item.id)}>{lang === 'vi' ? 'Phê duyệt' : 'Approve'}</Button></Td></Tr>)}</Tbody>
      </Table>
      {!pending.length && <div className="p-10 text-center text-sm text-stone-500">{lang === 'vi' ? 'Không có hồ sơ chờ phê duyệt.' : 'No requests awaiting approval.'}</div>}
    </Card>
  </div>
}
