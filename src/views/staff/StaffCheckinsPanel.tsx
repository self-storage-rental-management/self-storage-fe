import { useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { User } from '../../types'
import type { CheckInRecord, RentalRecord, StorageReservation } from '../../types/storageHub'

interface Props {
  user: User
  checkins: CheckInRecord[]
  holds: StorageReservation[]
  signPaperContract: (params: { holdId: string; staffUser: User; identityVerified: boolean; contractNumber: string; signedAt: string; startDate: string; endDate: string; scannedFileUrl: string; scannedFileName: string }) => void
  payRemainingBalance: (holdId: string, staffUser: User, paymentMethod: string) => void
  completeCheckIn: (params: { holdId: string; staffUser: User; checklist: CheckInRecord['checklist']; actualMeasurements: CheckInRecord['actualMeasurements']; initialCondition: string; evidencePhotos: string[]; goodsHandover: NonNullable<CheckInRecord['goodsHandover']>; handedOverItems: string[] }) => RentalRecord
  showToast: (message: string) => void
}

export default function StaffCheckinsPanel({ user, checkins, holds, signPaperContract, payRemainingBalance, completeCheckIn, showToast }: Props) {
    const [selected, setSelected] = useState<CheckInRecord | null>(null)
  const [condition, setCondition] = useState('Gian kho sạch, khóa và cửa hoạt động bình thường')
  const [evidence, setEvidence] = useState('checkin-evidence.jpg')
  const prepare = () => {
    if (!selected) return
    const hold = holds.find(item => item.id === selected.holdId)
    if (!hold) return showToast('Không tìm thấy hồ sơ đặt giữ kho liên quan.')
    try {
      signPaperContract({ holdId: hold.id, staffUser: user, identityVerified: true, contractNumber: `CTR-${hold.id}`, signedAt: new Date().toISOString(), startDate: hold.startDate, endDate: hold.endDate, scannedFileUrl: evidence.trim(), scannedFileName: evidence.trim() })
      payRemainingBalance(hold.id, user, 'BANK_TRANSFER')
      setSelected(null)
      showToast('Đã lưu hợp đồng và thanh toán còn lại. Hồ sơ sẵn sàng Check-in.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể chuẩn bị hồ sơ Check-in.')
    }
  }
  const finish = () => {
    if (!selected) return
    const hold = holds.find(item => item.id === selected.holdId)
    if (!hold) return showToast('Không tìm thấy hồ sơ đặt giữ kho liên quan.')
    try {
      completeCheckIn({ holdId: hold.id, staffUser: user, checklist: { identityVerified: true, termsAccepted: true, paymentConfirmed: true, unitWalkthrough: true, accessCodeIssued: true }, actualMeasurements: { lengthCm: hold.goods.lengthCm, widthCm: hold.goods.widthCm, heightCm: hold.goods.heightCm, weightKg: hold.goods.weightKg, actualVolumeM3: (hold.goods.lengthCm * hold.goods.widthCm * hold.goods.heightCm * hold.goods.packageCount) / 1_000_000, varianceAccepted: true }, initialCondition: condition.trim(), evidencePhotos: [evidence.trim()], goodsHandover: { packageCount: hold.goods.packageCount, category: hold.goods.category, estimatedWeightKg: hold.goods.weightKg, notes: hold.goods.condition }, handedOverItems: ['PIN/mã truy cập', 'Biên nhận bàn giao'] })
      setSelected(null)
      showToast('Check-in hoàn tất; Rental đã được kích hoạt trong dữ liệu dùng chung.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể hoàn tất check-in.')
    }
  }
  const selectedHold = selected ? holds.find(item => item.id === selected.holdId) : null
  const ready = selectedHold?.status === 'READY_FOR_CHECKIN'
  return <div className="fade-in space-y-5"><SectionHeader title={'Check-in & Bàn Giao'} subtitle={'Chỉ hồ sơ đã cọc, phân kho và đủ điều kiện mới được bàn giao.'} /><Card><Table><Thead><tr><Th>{'Lịch'}</Th><Th>{'Khách hàng'}</Th><Th>{'Gian kho'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>{checkins.map(item => <Tr key={item.id}><Td>{item.scheduledDate}<br /><span className="text-xs text-stone-500">{item.scheduledTime}</span></Td><Td>{item.customerName}</Td><Td>{item.unitId}</Td><Td><Badge variant={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'error' : 'info'}>{item.status}</Badge></Td><Td className="text-right">{item.status === 'scheduled' && <Button size="sm" onClick={() => setSelected(item)}>{'Thực hiện'}</Button>}</Td></Tr>)}</Tbody></Table>{!checkins.length && <div className="p-10 text-center text-sm text-stone-500">{'Chưa có lịch Check-in.'}</div>}</Card><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={'Hoàn tất Check-in'}><div className="space-y-4"><Input label={'Tình trạng ban đầu'} value={condition} onChange={event => setCondition(event.target.value)} /><Input label={'Ảnh/biên bản bằng chứng'} value={evidence} onChange={event => setEvidence(event.target.value)} /><div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">{ready ? ('Hồ sơ đã đủ hợp đồng, thanh toán và phân kho.') : ('Bước đầu: ghi nhận hợp đồng giấy và khoản còn lại tại quầy.')}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>{'Hủy'}</Button>{ready ? <Button disabled={!condition.trim() || !evidence.trim()} onClick={finish}>{'Xác nhận bàn giao'}</Button> : <Button disabled={!evidence.trim()} onClick={prepare}>{'Hoàn tất hồ sơ tại quầy'}</Button>}</div></div></Modal></div>
}
