import { useState } from 'react'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Badge, Card, ProgressBar, SectionHeader, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { formatVnd } from '../../i18n/currency'
import { useStorageHub } from '../../store/StorageHubContext'
import type { User } from '../../types'
import ProfileView from '../ProfileView'

export default function BusinessApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const hub = useStorageHub()
  const nav = [
    { id: 'facilities', label: 'Tổng quan cơ sở', icon: Icon.building, group: 'Danh mục' },
    { id: 'performance', label: 'Hiệu suất vận hành', icon: Icon.chart, group: 'Danh mục' },
    { id: 'policies', label: 'Chính sách thuê', icon: Icon.policy, group: 'Thương mại' },
    { id: 'revenue', label: 'Báo cáo doanh thu', icon: Icon.dollar, group: 'Báo cáo' },
  ]
  const [page, setPage] = useState(() => getInitialPage(nav, 'facilities'))
  const paidRevenue = hub.payments.filter(item => item.status === 'PAID' && item.type !== 'REFUND').reduce((sum, item) => sum + item.amount, 0)
  const refunds = hub.payments.filter(item => item.status === 'PAID' && item.type === 'REFUND').reduce((sum, item) => sum + item.amount, 0)

  return <Layout user={user} navItems={nav} currentPage={page} onNavigate={setPage} onLogout={onLogout} roleLabel={'Giám Đốc Kinh Doanh'} roleColor="bg-amber-100 text-amber-700">
    {page === 'facilities' && <div className="fade-in space-y-5"><SectionHeader title={'Tổng Quan Cơ Sở'} subtitle={'Số liệu được tính trực tiếp từ dữ liệu vận hành dùng chung.'} /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Cơ sở'} value={hub.facilities.length} icon={Icon.building} /><StatCard title={'Gian kho'} value={hub.units.length} icon={Icon.box} /><StatCard title={'Đang thuê'} value={hub.rentals.filter(item => item.status === 'active').length} icon={Icon.policy} /><StatCard title={'Doanh thu đã thu'} value={formatVnd(paidRevenue)} icon={Icon.dollar} /></div><div className="grid gap-4 lg:grid-cols-2">{hub.facilities.map(facility => { const units = hub.units.filter(item => item.facilityId === facility.id); const occupied = units.filter(item => item.status === 'occupied').length; return <Card key={facility.id} className="p-5"><div className="flex items-start justify-between"><div><h2 className="font-bold text-stone-900">{facility.name}</h2><p className="mt-1 text-sm text-stone-500">{facility.address}</p></div><Badge variant="success">Hoạt động</Badge></div><div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>{'Tỷ lệ lấp đầy'}</span><b>{occupied}/{units.length}</b></div><ProgressBar value={occupied} max={Math.max(1, units.length)} /></div></Card> })}</div></div>}
    {page === 'performance' && <div className="fade-in space-y-5"><SectionHeader title={'Hiệu Suất Vận Hành'} subtitle={'Không sử dụng số liệu biểu đồ giả.'} /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title={'Đơn chờ duyệt'} value={hub.holds.filter(item => item.status === 'awaiting_review').length} icon={Icon.calendar} /><StatCard title={'Đơn đã cọc'} value={hub.holds.filter(item => ['DEPOSIT_PAID', 'UNIT_RESERVED', 'READY_FOR_CHECKIN'].includes(item.status)).length} icon={Icon.check} /><StatCard title={'Check-in hoàn tất'} value={hub.checkins.filter(item => item.status === 'completed').length} icon={Icon.truck} /><StatCard title={'Trả kho đang xử lý'} value={hub.returns.filter(item => item.status !== 'completed').length} icon={Icon.clipboard} /></div></div>}
    {page === 'policies' && <div className="fade-in space-y-5"><SectionHeader title={'Chính Sách Thuê Đang Áp Dụng'} subtitle={'Cấu hình hiện hành từ StorageHubContext; trang này chỉ đọc.'} /><Card className="p-5"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-stone-500">{'Tỷ lệ cọc giữ chỗ'}</dt><dd className="mt-1 text-xl font-bold">{hub.config.defaultDepositRatio * 100}%</dd></div><div><dt className="text-xs text-stone-500">{'Thời hạn thanh toán'}</dt><dd className="mt-1 text-xl font-bold">{hub.config.holdExpiryHours}h</dd></div><div><dt className="text-xs text-stone-500">{'Phí trễ'}</dt><dd className="mt-1 text-xl font-bold">{formatVnd(hub.config.lateFeeAmount)}</dd></div><div><dt className="text-xs text-stone-500">DIM divisor</dt><dd className="mt-1 text-xl font-bold">{hub.config.dimDivisor}</dd></div></dl></Card></div>}
    {page === 'revenue' && <div className="fade-in space-y-5"><SectionHeader title={'Báo Cáo Doanh Thu'} subtitle={'Giao dịch thật trong state dùng chung.'} /><div className="grid grid-cols-2 gap-3"><StatCard title={'Đã thu'} value={formatVnd(paidRevenue)} icon={Icon.dollar} /><StatCard title={'Đã hoàn'} value={formatVnd(refunds)} icon={Icon.refresh} /></div><Card><Table><Thead><tr><Th>{'Giao dịch'}</Th><Th>{'Loại'}</Th><Th>{'Trạng thái'}</Th><Th className="text-right">{'Số tiền'}</Th></tr></Thead><Tbody>{hub.payments.map(item => <Tr key={item.id}><Td className="font-mono">{item.id}</Td><Td>{item.type.replace(/_/g, ' ')}</Td><Td><Badge variant={item.status === 'PAID' ? 'success' : 'warning'}>{item.status}</Badge></Td><Td className="text-right font-bold">{formatVnd(item.amount)}</Td></Tr>)}</Tbody></Table>{!hub.payments.length && <div className="p-10 text-center text-sm text-stone-500">{'Chưa có giao dịch.'}</div>}</Card></div>}
    {page === 'profile' && <ProfileView user={user} />}
  </Layout>
}
