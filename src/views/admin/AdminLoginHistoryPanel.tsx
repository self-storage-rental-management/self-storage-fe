import { useState } from 'react'
import { Badge, Button, Card, SectionHeader, Table, Tbody, Td, Th, Thead, Tr, Tabs } from '../../components/ui'
import type { Role, User } from '../../types'
import { useStorageHub } from '../../store/StorageHubContext'
import { roleColors, roleLabels, type AdminToast } from './adminPanelTypes'
import { isApiAuthenticated } from '../../services/authApi'
import AdminLoginHistoryApiPanel from './AdminLoginHistoryApiPanel'

export function LegacyAdminLoginHistoryPanel({ user, showToast }: { user: User; showToast: AdminToast }) {
  const { users, loginHistory, sessions, securityAlerts, revokeAllUserSessions, can } = useStorageHub()
  const [tab, setTab] = useState('Tất cả')
  const [userFilter, setUserFilter] = useState('all')
  const alerts = securityAlerts.filter(alert => !alert.resolvedAt)
  const history = loginHistory.filter(item => {
    const statusMatch = tab === 'Tất cả' || (tab === 'Thành công' && item.status === 'success') || (tab === 'Thất bại' && item.status === 'failed')
    const userMatch = userFilter === 'all' || item.userId === userFilter || (!item.userId && users.find(account => account.email === item.email)?.id === userFilter)
    return statusMatch && userMatch
  })

  return <div className="fade-in space-y-5">
    <SectionHeader title="Lịch Sử Đăng Nhập Hệ Thống" subtitle="Lịch sử xác thực, phiên đang mở và cảnh báo bất thường được lưu từ StorageHubContext" />
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><Tabs tabs={['Tất cả', 'Thành công', 'Thất bại']} active={tab} onChange={setTab} /><label className="flex items-center gap-2 text-sm text-slate-600 lg:ml-auto"><span className="font-medium">Tài khoản</span><select value={userFilter} onChange={event => setUserFilter(event.target.value)} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm"><option value="all">Tất cả tài khoản</option>{users.map(account => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}</select></label></div>
    {alerts.length > 0 && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><span aria-hidden="true">⚠</span><span>Phát hiện {alerts.length} cảnh báo an ninh chưa xử lý.</span></div>}
    <Card><Table><Thead><tr><Th>Người Dùng</Th><Th>Vai Trò</Th><Th>IP</Th><Th>Vị Trí</Th><Th>Thiết Bị</Th><Th>Thời Gian</Th><Th>Trạng Thái</Th></tr></Thead><Tbody>{history.map(item => <Tr key={item.id} className={item.status === 'failed' || item.suspicious ? 'bg-red-50' : ''}><Td><p className="text-sm font-medium text-slate-800">{item.user}</p><p className="text-xs text-slate-400">{item.email}</p></Td><Td><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[item.role as Role] ?? 'bg-slate-100 text-slate-600'}`}>{item.role ? roleLabels[item.role] : 'Chưa xác định'}</span></Td><Td><code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{item.ip}</code></Td><Td className="text-sm text-slate-500">{item.location}</Td><Td className="text-xs text-slate-400">{item.device}</Td><Td className="text-xs text-slate-500">{item.timestamp}</Td><Td>{item.status === 'failed' ? <Badge variant="error">{item.suspicious ? 'Khả nghi' : 'Thất bại'}</Badge> : item.status === 'logout' ? <Badge variant="muted">Đã đăng xuất</Badge> : <Badge variant="success">Thành công</Badge>}</Td></Tr>)}</Tbody></Table></Card>
    <Card><div className="flex flex-col justify-between gap-2 border-b border-stone-100 p-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-stone-900">Phiên đăng nhập</h3><p className="text-xs text-stone-500">Chỉ phiên đang hoạt động mới có thể bị thu hồi.</p></div><span className="text-sm text-stone-500">{sessions.filter(session => session.status === 'active').length} phiên đang mở</span></div><Table><Thead><tr><Th>Tài khoản</Th><Th>Thiết bị</Th><Th>Vị trí</Th><Th>Bắt đầu</Th><Th>Trạng thái</Th><Th /></tr></Thead><Tbody>{sessions.filter(session => userFilter === 'all' || session.userId === userFilter).map(session => <Tr key={session.id}><Td><p className="text-sm font-medium text-slate-800">{session.userName}</p><p className="text-xs text-slate-400">{session.email}</p></Td><Td className="text-xs text-slate-500">{session.device}</Td><Td className="text-xs text-slate-500">{session.location}</Td><Td className="text-xs text-slate-500">{session.createdAt}</Td><Td>{session.status === 'active' ? <Badge variant="success">Đang hoạt động</Badge> : session.status === 'revoked' ? <Badge variant="error">Đã thu hồi</Badge> : <Badge variant="muted">Đã đăng xuất</Badge>}</Td><Td className="text-right">{session.status === 'active' && can(user, 'manage_users') && <Button variant="outline" size="sm" onClick={() => { try { const count = revokeAllUserSessions(session.userId, user); showToast(count > 0 ? `Đã đăng xuất ${count} phiên của ${session.email}.` : 'Tài khoản này không còn phiên đang hoạt động.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể thu hồi phiên.') } }}>Đăng xuất mọi thiết bị</Button>}</Td></Tr>)}</Tbody></Table></Card>
  </div>
}

export default function AdminLoginHistoryPanel(props: { user: User; showToast: AdminToast }) {
  return isApiAuthenticated() ? <AdminLoginHistoryApiPanel {...props} /> : <LegacyAdminLoginHistoryPanel {...props} />
}
