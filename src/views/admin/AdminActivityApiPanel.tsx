import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, SectionHeader, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { User } from '../../types'
import { listAdminActivityLogs, listAdminUsers, type AdminApiActivityLog, type AdminApiUser } from '../../services/adminApi'
import type { AdminToast } from './adminPanelTypes'
import { activityActionLabel, activityEntityLabel } from './adminActivityLocalization'

const PAGE_SIZE = 20

const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

const parseState = (value: string | null) => {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return value }
}

function stateLabel(log: AdminApiActivityLog) {
  const state = parseState(log.afterState) ?? parseState(log.beforeState)
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const values = state as Record<string, unknown>
  for (const key of ['fullName', 'name', 'label', 'email', 'code']) {
    if (typeof values[key] === 'string' && values[key].trim()) return values[key]
  }
  return null
}

function actionGroup(log: AdminApiActivityLog) {
  if (log.action.startsWith('ADMIN_ROLE') || log.entityType === 'Role') return 'Quyền & vai trò'
  if (log.action.startsWith('SESSION') || log.action.startsWith('ADMIN_SESSION') || log.action === 'INVALID_CREDENTIALS') return 'Phiên & bảo mật'
  if (log.action.includes('SETTING') || log.action.startsWith('BUSINESS_CONFIG')) return 'Cấu hình hệ thống'
  if (log.entityType === 'User' || log.action.startsWith('USER_') || log.action.startsWith('PASSWORD_')) return 'Tài khoản'
  return 'Nghiệp vụ'
}

function actionGroupKey(log: AdminApiActivityLog) {
  if (log.action.startsWith('ADMIN_ROLE') || log.entityType === 'Role') return 'roles'
  if (log.action.startsWith('SESSION') || log.action.startsWith('ADMIN_SESSION') || log.action === 'INVALID_CREDENTIALS') return 'security'
  if (log.action.includes('SETTING') || log.action.startsWith('BUSINESS_CONFIG')) return 'settings'
  if (log.entityType === 'User' || log.action.startsWith('USER_') || log.action.startsWith('PASSWORD_')) return 'accounts'
  return 'operations'
}

function severity(log: AdminApiActivityLog): 'success' | 'info' | 'warning' | 'error' {
  if (log.action === 'INVALID_CREDENTIALS' || log.action.includes('FAILED') || log.action.includes('DENIED')) return 'error'
  if (log.action.includes('ROLE_PERMISSIONS') || log.action.includes('SETTING') || log.action.includes('STATUS_CHANGED') || log.action.includes('REVOKED')) return 'warning'
  if (log.action.includes('CREATED') || log.action.includes('REGISTERED') || log.action.includes('VERIFIED')) return 'success'
  return 'info'
}

function severityLabel(log: AdminApiActivityLog) {
  const level = severity(log)
  return level === 'error' ? 'Thất bại' : level === 'warning' ? 'Cần lưu ý' : level === 'success' ? 'Thành công' : 'Thông tin'
}

function activitySummary(log: AdminApiActivityLog) {
  const target = stateLabel(log) ?? activityEntityLabel(log.entityType).toLowerCase()
  const summaries: Record<string, string> = {
    ADMIN_ROLE_PERMISSIONS_UPDATED: `Cập nhật quyền cho ${target}`,
    ADMIN_USER_ROLES_UPDATED: `Cập nhật vai trò cho ${target}`,
    ADMIN_USER_CREATED: `Tạo tài khoản ${target}`,
    ADMIN_USER_UPDATED: `Cập nhật thông tin ${target}`,
    ADMIN_USER_STATUS_CHANGED: `Cập nhật trạng thái ${target}`,
    ADMIN_USER_PASSWORD_RESET: `Đặt lại mật khẩu cho ${target}`,
    ADMIN_SETTING_UPDATED: 'Cập nhật cấu hình hệ thống',
    ADMIN_SESSION_REVOKED: `Thu hồi phiên đăng nhập của ${target}`,
    SESSION_CREATED: 'Đăng nhập vào hệ thống',
    SESSION_REFRESHED: 'Gia hạn phiên đăng nhập',
    SESSION_REVOKED: 'Đăng xuất khỏi hệ thống',
    INVALID_CREDENTIALS: 'Đăng nhập không thành công',
  }
  return summaries[log.action] ?? `${activityActionLabel(log.action)} · ${target}`
}

function toIsoStart(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function toIsoEnd(value: string) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

function exportCsv(logs: AdminApiActivityLog[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const rows = [
    ['Thời gian', 'Người thực hiện', 'Nhóm hành động', 'Thao tác', 'Nội dung'],
    ...logs.map(log => [formatDate(log.createdAt), log.actorEmail ? `${log.actorName} (${log.actorEmail})` : log.actorName, actionGroup(log), activityActionLabel(log.action), activitySummary(log)]),
  ]
  const csv = `\uFEFF${rows.map(row => row.map(escape).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `storagehub-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminActivityApiPanel({ user: _user, showToast: _showToast }: { user: User; showToast: AdminToast }) {
  const [logs, setLogs] = useState<AdminApiActivityLog[]>([])
  const [users, setUsers] = useState<AdminApiUser[]>([])
  const [entityType, setEntityType] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [actorId, setActorId] = useState('all')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState<AdminApiActivityLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    setCurrentPage(1)
    Promise.all([
      listAdminActivityLogs({ page: 0, size: 100, search, entityType, actorId, from: toIsoStart(dateFrom), to: toIsoEnd(dateTo) }),
      users.length ? Promise.resolve({ data: users }) : listAdminUsers({ page: 0, size: 100 }),
    ]).then(([page, userPage]) => {
      setLogs(page.data)
      if (!users.length) setUsers(userPage.data)
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải nhật ký hoạt động.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [entityType, actorId])

  const filteredLogs = useMemo(() => actionFilter === 'all' ? logs : logs.filter(log => actionGroupKey(log) === actionFilter), [actionFilter, logs])
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const visibleLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const warningCount = filteredLogs.filter(log => severity(log) === 'warning' || severity(log) === 'error').length
  const adminCount = filteredLogs.filter(log => log.action.startsWith('ADMIN_')).length
  const sessionCount = filteredLogs.filter(log => log.entityType === 'Session' || log.action.includes('SESSION')).length

  const applyDatePreset = (value: string) => {
    setDatePreset(value)
    if (value === 'all') { setDateFrom(''); setDateTo(''); return }
    const end = new Date()
    const start = new Date()
    if (value === 'today') start.setHours(0, 0, 0, 0)
    if (value === '7d') start.setDate(start.getDate() - 6)
    if (value === '30d') start.setDate(start.getDate() - 29)
    setDateFrom(start.toISOString().slice(0, 10))
    setDateTo(end.toISOString().slice(0, 10))
  }

  return <div className="fade-in w-full max-w-none space-y-5">
    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
      <SectionHeader title="Nhật ký hoạt động và giám sát hệ thống" subtitle="Tra cứu các thay đổi quan trọng, phiên đăng nhập và sự kiện bảo mật của StorageHub." />
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => exportCsv(filteredLogs)} disabled={!filteredLogs.length}>Xuất CSV</Button>
        <Button variant="outline" size="sm" onClick={load}>Làm mới</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard title="Số sự kiện" value={filteredLogs.length} delta="Trong kết quả lọc" deltaPositive icon={undefined} iconBg="bg-blue-50 text-blue-700" />
      <StatCard title="Thao tác quản trị" value={adminCount} delta="Tài khoản, vai trò, cấu hình" icon={undefined} iconBg="bg-amber-50 text-amber-800" />
      <StatCard title="Phiên & bảo mật" value={sessionCount} delta="Đăng nhập, gia hạn, thu hồi" icon={undefined} iconBg="bg-purple-50 text-purple-700" />
      <StatCard title="Cảnh báo & thất bại" value={warningCount} delta="Cần kiểm tra thêm" icon={undefined} iconBg="bg-red-50 text-red-700" />
    </div>

    <Card className="border border-stone-200 p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs font-semibold text-stone-500">Khoảng thời gian<select value={datePreset} onChange={event => applyDatePreset(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-700"><option value="all">Toàn bộ thời gian</option><option value="today">Hôm nay</option><option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option><option value="custom">Tùy chọn</option></select></label>
        <label className="text-xs font-semibold text-stone-500">Từ ngày<input aria-label="Từ ngày" type="date" value={dateFrom} onChange={event => { setDatePreset('custom'); setDateFrom(event.target.value) }} className="mt-1 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-700" /></label>
        <label className="text-xs font-semibold text-stone-500">Đến ngày<input aria-label="Đến ngày" type="date" value={dateTo} onChange={event => { setDatePreset('custom'); setDateTo(event.target.value) }} className="mt-1 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-700" /></label>
        <label className="text-xs font-semibold text-stone-500">Người thực hiện<select value={actorId} onChange={event => setActorId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-700"><option value="all">Tất cả người dùng</option>{users.map(account => <option key={account.id} value={account.id}>{account.fullName} · {account.email}</option>)}</select></label>
        <label className="text-xs font-semibold text-stone-500">Module / đối tượng<select value={entityType} onChange={event => setEntityType(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-700"><option value="all">Tất cả module</option><option value="User">Tài khoản</option><option value="Role">Vai trò & quyền</option><option value="Session">Phiên đăng nhập</option><option value="SystemSetting">Cấu hình hệ thống</option></select></label>
        <label className="text-xs font-semibold text-stone-500">Nhóm hành động<select value={actionFilter} onChange={event => { setCurrentPage(1); setActionFilter(event.target.value) }} className="mt-1 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-700"><option value="all">Tất cả hành động</option><option value="accounts">Tài khoản</option><option value="roles">Quyền & vai trò</option><option value="security">Phiên & bảo mật</option><option value="settings">Cấu hình hệ thống</option><option value="operations">Nghiệp vụ</option></select></label>
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-stone-100 pt-3 sm:flex-row"><input aria-label="Tìm trong nhật ký" type="search" placeholder="Tìm thao tác, người thực hiện hoặc đối tượng…" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') load() }} className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm" /><Button size="sm" onClick={load}>Áp dụng bộ lọc</Button></div>
    </Card>

    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={load}>Thử lại</Button></div>}

    {loading ? <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải nhật ký…</div> : <Card className="overflow-hidden">
      <div className="flex flex-col justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-stone-900">Nhật ký hoạt động hệ thống</h2><p className="text-xs text-stone-500">Hiển thị {filteredLogs.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredLogs.length)} trong {filteredLogs.length} sự kiện</p></div><span className="text-xs text-stone-400">Dữ liệu từ cơ sở dữ liệu</span></div>
      {visibleLogs.length === 0 ? <div className="p-12 text-center text-stone-400">Chưa ghi nhận sự kiện phù hợp với bộ lọc hiện tại.</div> : <Table className="min-w-[980px]"><Thead><tr><Th>Thời gian</Th><Th>Người thực hiện</Th><Th>Loại hành động</Th><Th>Chi tiết thay đổi</Th><Th className="text-right"> </Th></tr></Thead><Tbody>{visibleLogs.map(log => <Tr key={log.id}><Td className="whitespace-nowrap text-xs text-stone-500">{formatDate(log.createdAt)}</Td><Td><p className="whitespace-nowrap text-sm font-semibold text-stone-900">{log.actorName}</p><p className="max-w-[190px] truncate text-xs text-stone-400">{log.actorEmail ?? 'Hệ thống'}</p></Td><Td><Badge variant={severity(log)}>{actionGroup(log)}</Badge><p className="mt-1 max-w-[190px] text-xs text-stone-500">{activityActionLabel(log.action)}</p></Td><Td><p className="max-w-[440px] text-sm text-stone-700">{activitySummary(log)}</p><p className="mt-1 text-xs text-stone-400">{activityEntityLabel(log.entityType)}</p></Td><Td className="text-right"><Button variant="outline" size="sm" onClick={() => setSelected(log)}>Xem</Button></Td></Tr>)}</Tbody></Table>}
      {filteredLogs.length > PAGE_SIZE && <div className="flex flex-col justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm text-stone-500 sm:flex-row sm:items-center"><span>Trang {page} / {totalPages}</span><div className="flex items-center gap-1"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setCurrentPage(value => Math.max(1, value - 1))}>‹</Button>{Array.from({ length: Math.min(totalPages, 5) }, (_, index) => <Button key={index + 1} variant={page === index + 1 ? 'primary' : 'outline'} size="sm" onClick={() => setCurrentPage(index + 1)}>{index + 1}</Button>)}<Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setCurrentPage(value => Math.min(totalPages, value + 1))}>›</Button></div></div>}
    </Card>}

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Chi tiết nhật ký hoạt động">{selected && <div className="space-y-4"><div className="rounded-lg bg-[#292a27] p-4 text-white"><div className="flex flex-wrap items-center gap-2"><Badge variant={severity(selected)}>{severityLabel(selected)}</Badge><span className="text-xs text-stone-400">{actionGroup(selected)}</span></div><p className="mt-3 text-base font-semibold text-[#f1b34a]">{activitySummary(selected)}</p><p className="mt-1 text-sm text-stone-300">{selected.actorName}{selected.actorEmail ? ` · ${selected.actorEmail}` : ''} · {formatDate(selected.createdAt)}</p></div><div className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-lg border border-stone-200 p-3"><p className="text-xs font-semibold uppercase text-stone-500">Mã sự kiện</p><code className="mt-1 block break-all text-xs text-stone-700">{selected.action}</code></div><div className="rounded-lg border border-stone-200 p-3"><p className="text-xs font-semibold uppercase text-stone-500">Đối tượng kỹ thuật</p><code className="mt-1 block break-all text-xs text-stone-700">{selected.entityType} · {selected.entityId}</code></div></div><div><p className="mb-1 text-xs font-semibold uppercase text-stone-500">Trạng thái trước và sau</p><pre className="max-h-72 overflow-auto rounded-lg bg-[#1e1f1d] p-3 font-mono text-xs text-emerald-300">{JSON.stringify({ before: parseState(selected.beforeState), after: parseState(selected.afterState) }, null, 2)}</pre></div><div className="flex justify-end"><Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button></div></div>}</Modal>
  </div>
}
