import { useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import type { User } from '../../types'
import type { TicketItem } from '../../data/demoDatabase'

interface Props {
  user: User
  tickets: TicketItem[]
  respondSupportTicket: (ticketId: string, replyText: string, status: TicketItem['status'], staffUser: User) => void
  showToast: (message: string) => void
}

export default function StaffSupportPanel({ user, tickets, respondSupportTicket, showToast }: Props) {
  const { lang } = useLanguage()
  const [selected, setSelected] = useState<TicketItem | null>(null)
  const [reply, setReply] = useState('')
  const send = () => {
    if (!selected || !reply.trim()) return
    try {
      respondSupportTicket(selected.id, reply, 'in-progress', user)
      setSelected(null)
      setReply('')
      showToast(lang === 'vi' ? 'Đã gửi phản hồi và cập nhật ticket.' : 'Reply sent and ticket updated.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể gửi phản hồi.')
    }
  }
  return <div className="fade-in space-y-5"><SectionHeader title={lang === 'vi' ? 'Hỗ Trợ Khách Hàng' : 'Customer Support'} subtitle={lang === 'vi' ? 'Ticket và phản hồi đồng bộ trực tiếp với cổng Customer.' : 'Tickets and replies sync directly with the customer portal.'} /><Card><Table><Thead><tr><Th>{lang === 'vi' ? 'Mã' : 'ID'}</Th><Th>Customer</Th><Th>{lang === 'vi' ? 'Nội dung' : 'Subject'}</Th><Th>{lang === 'vi' ? 'Ưu tiên' : 'Priority'}</Th><Th>Status</Th><Th /></tr></Thead><Tbody>{tickets.map(item => <Tr key={item.id}><Td className="font-mono">{item.id}</Td><Td>{item.customer}</Td><Td>{item.subject}</Td><Td><Badge variant={item.priority === 'high' ? 'error' : 'info'}>{item.priority}</Badge></Td><Td>{item.status}</Td><Td className="text-right">{item.status !== 'resolved' && <Button size="sm" onClick={() => setSelected(item)}>{lang === 'vi' ? 'Phản hồi' : 'Reply'}</Button>}</Td></Tr>)}</Tbody></Table>{!tickets.length && <div className="p-10 text-center text-sm text-stone-500">{lang === 'vi' ? 'Không có ticket.' : 'No tickets.'}</div>}</Card><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.subject || ''}><div className="space-y-4"><Input label={lang === 'vi' ? 'Nội dung phản hồi' : 'Reply'} value={reply} onChange={event => setReply(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelected(null)}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button><Button disabled={!reply.trim()} onClick={send}>{lang === 'vi' ? 'Gửi phản hồi' : 'Send reply'}</Button></div></div></Modal></div>
}
