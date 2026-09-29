import { useEffect, useState } from 'react'
import { Badge, Button, Card, SectionHeader, Table, Tbody, Td, Th, Thead, Tr, Tabs } from '../../components/ui'
import type { User } from '../../types'
import { listAdminLoginHistory, listAdminSessions, listAdminUsers, revokeAdminSession, type AdminApiLoginHistory, type AdminApiSession, type AdminApiUser } from '../../services/adminApi'
import type { AdminToast } from './adminPanelTypes'

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : '—'

export default function AdminLoginHistoryApiPanel({ user: _user, showToast }: { user: User; showToast: AdminToast }) {
  const [history, setHistory] = useState<AdminApiLoginHistory[]>([])
  const [sessions, setSessions] = useState<AdminApiSession[]>([])
  const [users, setUsers] = useState<AdminApiUser[]>([])
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    const success = tab === 'Thành công' ? true : tab === 'Thất bại' ? false : undefined
    Promise.all([
      listAdminLoginHistory({ page: 0, size: 50, search, success, userId: userFilter }),
      listAdminSessions({ page: 0, size: 50, userId: userFilter }),
      users.length ? Promise.resolve({ data: users }) : listAdminUsers({ page: 0, size: 100 }),
    ]).then(([historyPage, sessionsPage, userPage]) => {
      setHistory(historyPage.data)
      setSessions(sessionsPage.data)
      if (!users.length) setUsers(userPage.data)
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử đăng nhập.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab, userFilter])

  return <div className="fade-in space-y-5">
    <SectionHeader title="Lịch Sử Đăng Nhập Hệ Thống" subtitle="Dữ liệu xác thực và phiên đăng nhập từ backend" />
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><Tabs tabs={['Tất cả', 'Thành công', 'Thất bại']} active={tab} onChange={setTab} /><input aria-label="Tìm lịch sử đăng nhập" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') load() }} placeholder="Tìm email hoặc họ tên…" className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm lg:ml-auto" /><label className="flex items-center gap-2 text-sm text-slate-600"><span className="font-medium">Tài khoản</span><select value={userFilter} onChange={event => setUserFilter(event.target.value)} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm"><option value="all">Tất cả tài khoản</option>{users.map(account => <option key={account.id} value={account.id}>{account.fullName} · {account.email}</option>)}</select></label></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={load}>Thử lại</Button></div>}
    {loading ? <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải dữ liệu…</div> : <>
      <Card><Table><Thead><tr><Th>Người Dùng</Th><Th>Vai Trò</Th><Th>IP</Th><Th>Thiết Bị</Th><Th>Thời Gian</Th><Th>Trạng Thái</Th></tr></Thead><Tbody>{history.map(item => <Tr key={item.id} className={!item.success ? 'bg-red-50' : ''}><Td><p className="text-sm font-medium text-slate-800">{item.fullName ?? 'Tài khoản chưa xác định'}</p><p className="text-xs text-slate-400">{item.email}</p></Td><Td className="text-xs text-slate-500">{item.roles.length ? item.roles.join(', ') : '—'}</Td><Td><code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{item.ipAddress ?? '—'}</code></Td><Td className="max-w-xs truncate text-xs text-slate-400">{item.userAgent ?? '—'}</Td><Td className="text-xs text-slate-500">{formatDate(item.occurredAt)}</Td><Td>{item.success ? <Badge variant="success">Thành công</Badge> : <Badge variant="error">{item.failureReason ?? 'Thất bại'}</Badge>}</Td></Tr>)}</Tbody></Table></Card>
      <Card><div className="flex flex-col justify-between gap-2 border-b border-stone-100 p-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-stone-900">Phiên đăng nhập</h3><p className="text-xs text-stone-500">Chỉ phiên đang hoạt động mới có thể bị thu hồi.</p></div><span className="text-sm text-stone-500">{sessions.filter(session => session.active).length} phiên đang mở</span></div><Table><Thead><tr><Th>Tài khoản</Th><Th>IP</Th><Th>Thiết bị</Th><Th>Bắt đầu</Th><Th>Trạng thái</Th><Th /></tr></Thead><Tbody>{sessions.map(session => <Tr key={session.id}><Td><p className="text-sm font-medium text-slate-800">{session.fullName}</p><p className="text-xs text-slate-400">{session.email}</p></Td><Td className="text-xs text-slate-500">{session.createdIp ?? '—'}</Td><Td className="max-w-xs truncate text-xs text-slate-500">{session.userAgent ?? '—'}</Td><Td className="text-xs text-slate-500">{formatDate(session.createdAt)}</Td><Td>{session.active ? <Badge variant="success">Đang hoạt động</Badge> : <Badge variant="muted">Đã đóng</Badge>}</Td><Td className="text-right">{session.active && <Button variant="outline" size="sm" onClick={() => void revokeAdminSession(session.id).then(() => { showToast(`Đã thu hồi phiên của ${session.email}.`); load() }).catch(reason => showToast(reason instanceof Error ? reason.message : 'Không thể thu hồi phiên.'))}>Thu hồi</Button>}</Td></Tr>)}</Tbody></Table></Card>
    </>}
  </div>
}
