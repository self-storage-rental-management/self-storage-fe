import { useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { User } from '../../types'
import type { DamageClassification, ReturnCase } from '../../types/storageHub'

interface Props {
  user: User
  returns: ReturnCase[]
  completeReturnInspection: (params: { returnId: string; staffUser: User; inventoryMatch: 'match' | 'missing' | 'excess'; damageClassification: DamageClassification; damageFee: number; cleaningFee: number; lostItemFee: number; overdueFee: number; outstandingFee: number; staffNotes: string; evidencePhotos: string[]; returnedItems: { key: boolean; card: boolean; lock: boolean } }) => void
  showToast: (message: string) => void
}

export default function StaffReturnsPanel({ user, returns, completeReturnInspection, showToast }: Props) {
    const [selected, setSelected] = useState<ReturnCase | null>(null)
  const [notes, setNotes] = useState('Đã đối chiếu hiện trạng và thu hồi đầy đủ vật dụng bàn giao')
  const [evidence, setEvidence] = useState('return-inspection.jpg')
  const inspect = () => {
    if (!selected) return
    try {
      completeReturnInspection({ returnId: selected.id, staffUser: user, inventoryMatch: 'match', damageClassification: 'no_damage', damageFee: 0, cleaningFee: 0, lostItemFee: 0, overdueFee: 0, outstandingFee: 0, staffNotes: notes.trim(), evidencePhotos: [evidence.trim()], returnedItems: { key: true, card: true, lock: true } })
      setSelected(null)
      showToast('Đã lưu biên bản nghiệm thu và chuyển khách hàng xác nhận quyết toán.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể hoàn tất nghiệm thu.')
    }
  }
  return <div className="fade-in space-y-5"><SectionHeader title={'Nghiệm Thu Trả Kho'} subtitle={'Biên bản, phí và bằng chứng được lưu vào dữ liệu dùng chung.'} /><Card><Table><Thead><tr><Th>{'Mã hồ sơ'}</Th><Th>{'Khách hàng'}</Th><Th>{'Gian kho'}</Th><Th>{'Ngày hẹn'}</Th><Th>{'Trạng thái'}</Th><Th /></tr></Thead><Tbody>{returns.map(item => <Tr key={item.id}><Td className="font-mono">{item.id}</Td><Td>{item.customerName}</Td><Td>{item.unitId}</Td><Td>{item.scheduledDate}</Td><Td><Badge variant={item.status === 'completed' ? 'success' : 'warning'}>{item.status.replace(/_/g, ' ')}</Badge></Td><Td className="text-right">{item.status === 'requested' && <Button size="sm" onClick={() => setSelected(item)}>{'Nghiệm thu'}</Button>}</Td></Tr>)}</Tbody></Table>{!returns.length && <div className="p-10 text-center text-sm text-stone-500">{'Chưa có yêu cầu trả kho.'}</div>}</Card><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={'Biên bản nghiệm thu'}><div className="space-y-4"><Input label={'Ghi chú hiện trạng'} value={notes} onChange={event => setNotes(event.target.value)} /><Input label={'Ảnh bằng chứng'} value={evidence} onChange={event => setEvidence(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>{'Hủy'}</Button><Button disabled={!notes.trim() || !evidence.trim()} onClick={inspect}>{'Lưu biên bản'}</Button></div></div></Modal></div>
}
