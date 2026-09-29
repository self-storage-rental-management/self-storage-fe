import { useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, SectionHeader, StatCard, Tabs, Avatar } from '../../components/ui'
import type { User } from '../../types'
import { ACTIVITY_LOGS, type AuditActivityLog } from '../../data/demoDatabase'
import { useStorageHub } from '../../store/StorageHubContext'
import { roleColors, type AdminToast } from './adminPanelTypes'
import { isApiAuthenticated } from '../../services/authApi'
import AdminActivityApiPanel from './AdminActivityApiPanel'

export function LegacyAdminActivityPanel({ showToast: _showToast }: { user: User; showToast: AdminToast }) {
  const { activities, users } = useStorageHub()
  const [logs] = useState<AuditActivityLog[]>(ACTIVITY_LOGS)
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [selected, setSelected] = useState<AuditActivityLog | null>(null)

  const combinedLogs = useMemo<AuditActivityLog[]>(() => [
    ...activities.map(activity => ({
      id: activity.id,
      user: activity.actorName,
      actor: activity.actorName,
      role: activity.actorRole,
      action: activity.notes || activity.action,
      target: `${activity.entityType.toUpperCase()} · ${activity.entityId}`,
      time: 'Gần đây',
      timestamp: activity.timestamp,
      type: 'info' as const,
      severity: 'info' as const,
      category: (activity.entityType === 'rental' || activity.entityType === 'hold' ? 'rental' : activity.entityType === 'payment' ? 'billing' : 'security') as AuditActivityLog['category'],
      ip: '192.168.1.25',
      device: 'StorageHub Client',
      details: { actionType: activity.action, before: activity.beforeState, after: activity.afterState, evidence: activity.evidence },
    })),
    ...logs,
  ], [activities, logs])

  const filtered = combinedLogs.filter(log => {
    const category = tab === 'An ninh' ? 'security' : tab === 'Thuê kho' ? 'rental' : tab === 'Thanh toán' ? 'billing' : tab === 'Bảng giá' ? 'pricing' : tab === 'Ra vào' ? 'access' : null
    const query = search.trim().toLowerCase()
    const matchesUser = userFilter === 'all' || users.some(account => account.id === userFilter && (account.name === log.actor || account.email === log.actor)) || activities.some(activity => activity.id === log.id && activity.actorId === userFilter)
    return (!category || log.category === category) && matchesUser && (!query || [log.actor, log.action, log.target, log.ip].some(value => value.toLowerCase().includes(query)))
  })
  const errorCount = combinedLogs.filter(log => log.severity === 'error').length
  const adminActions = combinedLogs.filter(log => log.role === 'admin' || log.category === 'admin').length

  return <div className="fade-in space-y-6">
    <SectionHeader title="Nhật Ký Hoạt Động & Giám Sát Hệ Thống" subtitle="Dòng thời gian ghi nhận các thao tác người dùng, cảnh báo an ninh và thay đổi dữ liệu quản trị" action={<Button variant="outline" size="sm" disabled>Chưa kết nối xuất file</Button>} />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard title="Sự Kiện Hôm Nay" value={logs.length} delta="Dữ liệu audit hiện tại" deltaPositive icon={undefined} iconBg="bg-blue-50 text-blue-700" /><StatCard title="Ngoại Lệ An Ninh" value={errorCount} delta={errorCount > 0 ? 'Cần kiểm tra ngay' : 'Hệ thống an toàn'} deltaPositive={errorCount === 0} icon={undefined} iconBg="bg-emerald-50 text-emerald-700" /><StatCard title="Thao Tác Quản Trị" value={adminActions} delta="Cập nhật tài khoản & chính sách" icon={undefined} iconBg="bg-amber-50 text-amber-800" /><StatCard title="Lượt Truy Cập Cửa/Cổng" value={combinedLogs.filter(log => log.category === 'access' || log.category === 'security').length} delta="Bộ điều khiển ổn định" deltaPositive icon={undefined} iconBg="bg-purple-50 text-purple-700" /></div>
    <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"><Tabs tabs={['Tất cả', 'An ninh', 'Thuê kho', 'Thanh toán', 'Bảng giá', 'Ra vào']} active={tab} onChange={setTab} /><input aria-label="Tìm nhật ký" type="search" placeholder="Tìm người dùng, thao tác, đối tượng, IP..." value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm sm:w-72" /><select aria-label="Lọc tài khoản" value={userFilter} onChange={event => setUserFilter(event.target.value)} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm"><option value="all">Tất cả tài khoản</option>{users.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
    <Card className="divide-y divide-stone-100 overflow-hidden">{filtered.length === 0 ? <div className="p-10 text-center text-stone-400"><p className="font-semibold text-stone-700">Chưa ghi nhận sự kiện hoạt động nào</p><p className="mt-1 text-xs">Không tìm thấy mục nhật ký nào phù hợp.</p></div> : filtered.map(log => <div key={log.id} className="flex flex-col justify-between gap-3 p-4 transition hover:bg-[#fbfaf6] sm:flex-row sm:items-center"><div className="flex min-w-0 items-start gap-3"><div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${log.severity === 'error' ? 'bg-red-500' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} /><Avatar name={log.actor} size="sm" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-stone-900">{log.actor}</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${roleColors[log.role as keyof typeof roleColors] ?? 'bg-stone-100 text-stone-700'}`}>{log.role}</span><span className="text-xs text-stone-600">{log.action}</span></div><p className="mt-0.5 text-xs text-stone-500">Đối tượng: <strong className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-700">{log.target}</strong></p><p className="mt-1 text-[11px] text-stone-400">{log.ip} · {log.device}</p></div></div><div className="flex shrink-0 items-center gap-3 self-end sm:self-center"><div className="text-right"><p className="text-xs font-medium text-stone-600">{log.time}</p><span className="font-mono text-[10px] text-stone-400">{log.timestamp}</span></div><Badge variant={log.severity === 'error' ? 'error' : log.severity === 'warning' ? 'warning' : 'info'}>{log.category}</Badge><Button variant="outline" size="sm" onClick={() => setSelected(log)}>Chi Tiết</Button></div></div>)}</Card>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Chi Tiết & Siêu Dữ Liệu Sự Kiện Kiểm Toán">{selected && <div className="space-y-4"><div className="rounded-lg bg-[#292a27] p-3 text-white"><p className="font-mono text-xs text-[#e9a12c]">MÃ SỰ KIỆN: {selected.id} · {selected.category}</p><p className="mt-1 text-sm font-bold">{selected.action}</p><p className="mt-0.5 text-xs text-stone-400">{selected.timestamp} · {selected.actor} ({selected.role})</p></div><pre className="max-h-64 overflow-x-auto rounded-lg bg-[#1e1f1d] p-3 font-mono text-xs text-emerald-300">{JSON.stringify(selected.details, null, 2)}</pre><div className="flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button></div></div>}</Modal>
  </div>
}

export default function AdminActivityPanel(props: { user: User; showToast: AdminToast }) {
  return isApiAuthenticated() ? <AdminActivityApiPanel {...props} /> : <LegacyAdminActivityPanel {...props} />
}
