import { useEffect, useState } from 'react'
import { Badge, Button, Card, Modal, SectionHeader, StatCard, Tabs } from '../../components/ui'
import type { User } from '../../types'
import { listAdminActivityLogs, type AdminApiActivityLog } from '../../services/adminApi'
import type { AdminToast } from './adminPanelTypes'

const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN')
const parseState = (value: string | null) => {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return value }
}

export default function AdminActivityApiPanel({ user: _user, showToast: _showToast }: { user: User; showToast: AdminToast }) {
  const [logs, setLogs] = useState<AdminApiActivityLog[]>([])
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminApiActivityLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const entityType = tab === 'Tài khoản' ? 'User' : tab === 'Phiên' ? 'Session' : tab === 'Vai trò' ? 'Role' : tab === 'Cấu hình' ? 'SystemSetting' : undefined

  const load = () => {
    setLoading(true)
    setError(null)
    listAdminActivityLogs({ page: 0, size: 100, search, entityType }).then(page => setLogs(page.data)).catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải nhật ký hoạt động.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  return <div className="fade-in space-y-6">
    <SectionHeader title="Nhật Ký Hoạt Động & Giám Sát Hệ Thống" subtitle="ActivityLog từ backend, chỉ đọc với quyền view_audit_logs" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3"><StatCard title="Sự Kiện Tải Về" value={logs.length} delta="Trang hiện tại" deltaPositive icon={undefined} iconBg="bg-blue-50 text-blue-700" /><StatCard title="Thao Tác Quản Trị" value={logs.filter(log => log.action.startsWith('ADMIN_')).length} delta="User, role, settings" icon={undefined} iconBg="bg-amber-50 text-amber-800" /><StatCard title="Phiên / Bảo Mật" value={logs.filter(log => log.entityType === 'Session').length} delta="Login và revoke" icon={undefined} iconBg="bg-purple-50 text-purple-700" /></div>
    <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"><Tabs tabs={['Tất cả', 'Tài khoản', 'Phiên', 'Vai trò', 'Cấu hình']} active={tab} onChange={setTab} /><div className="flex gap-2"><input aria-label="Tìm nhật ký" type="search" placeholder="Tìm thao tác, đối tượng…" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') load() }} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm sm:w-72" /><Button variant="outline" size="sm" onClick={load}>Lọc</Button></div></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={load}>Thử lại</Button></div>}
    {loading ? <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải nhật ký…</div> : <Card className="divide-y divide-stone-100 overflow-hidden">{logs.length === 0 ? <div className="p-10 text-center text-stone-400">Chưa ghi nhận sự kiện phù hợp.</div> : logs.map(log => <div key={log.id} className="flex flex-col justify-between gap-3 p-4 transition hover:bg-[#fbfaf6] sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-stone-900">{log.actorName}</span><Badge variant="info">{log.action}</Badge></div><p className="mt-1 text-xs text-stone-500">{log.entityType} · <code>{log.entityId}</code>{log.actorEmail ? ` · ${log.actorEmail}` : ''}</p><p className="mt-1 text-[11px] text-stone-400">{formatDate(log.createdAt)} · correlation {log.correlationId}</p></div><Button variant="outline" size="sm" onClick={() => setSelected(log)}>Chi tiết</Button></div>)}</Card>}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Chi Tiết Nhật Ký Hoạt Động">{selected && <div className="space-y-4"><div className="rounded-lg bg-[#292a27] p-3 text-white"><p className="font-mono text-xs text-[#e9a12c]">{selected.id} · {selected.action}</p><p className="mt-1 text-sm">{selected.actorName} · {selected.entityType} · {selected.entityId}</p></div><div><p className="mb-1 text-xs font-semibold uppercase text-stone-500">Trạng thái trước / sau</p><pre className="max-h-72 overflow-auto rounded-lg bg-[#1e1f1d] p-3 font-mono text-xs text-emerald-300">{JSON.stringify({ before: parseState(selected.beforeState), after: parseState(selected.afterState) }, null, 2)}</pre></div><div className="flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button></div></div>}</Modal>
  </div>
}
