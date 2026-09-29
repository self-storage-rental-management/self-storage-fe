import { Fragment, useEffect, useState } from 'react'
import { Button, Card, SectionHeader } from '../../components/ui'
import type { Role, User } from '../../types'
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DEFINITIONS } from '../../auth/rbac'
import { listAdminRoles, updateAdminRolePermissions, type AdminApiRole } from '../../services/adminApi'
import type { ApiRoleCode } from '../../services/authApi'
import { CheckIcon, LockIcon, MinusIcon, RefreshIcon, SearchIcon, roleColors, roleLabels, type AdminToast } from './adminPanelTypes'

const roleCodes: Record<Role, ApiRoleCode> = {
  customer: 'CUSTOMER', staff: 'STAFF', manager: 'MANAGER', business: 'BUSINESS', admin: 'ADMIN',
}

const toUiRole = (code: ApiRoleCode): Role => code.toLowerCase() as Role

export default function AdminRolesApiPanel({ user: _user, showToast }: { user: User; showToast: AdminToast }) {
  const [roles, setRoles] = useState<AdminApiRole[]>([])
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<'all' | 'Điều hướng' | 'Nghiệp vụ' | 'Quản trị'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const loadRoles = () => {
    setLoading(true)
    setError(null)
    listAdminRoles().then(setRoles).catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải phân quyền từ backend.')).finally(() => setLoading(false))
  }

  useEffect(() => { loadRoles() }, [])

  const togglePermission = async (role: AdminApiRole, permission: string) => {
    if (role.code === 'ADMIN' && (permission === 'manage_users' || permission === 'manage_roles')) return
    const enabled = role.permissions.includes(permission)
    const permissions = enabled ? role.permissions.filter(value => value !== permission) : [...role.permissions, permission]
    try {
      const updated = await updateAdminRolePermissions(role.code, permissions)
      setRoles(previous => previous.map(item => item.code === updated.code ? updated : item))
      showToast(`Đã ${enabled ? 'thu hồi' : 'cấp'} quyền ${permission} cho ${roleLabels[toUiRole(role.code)]}.`)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể cập nhật phân quyền.')
    }
  }

  const resetDefaults = async () => {
    setResetting(true)
    try {
      const updated = await Promise.all((Object.entries(DEFAULT_ROLE_PERMISSIONS) as [Role, Record<string, boolean>][]).map(([role, permissions]) =>
        updateAdminRolePermissions(roleCodes[role], Object.entries(permissions).filter(([, enabled]) => enabled).map(([key]) => key))
      ))
      setRoles(previous => previous.map(role => updated.find(item => item.code === role.code) ?? role))
      showToast('Đã khôi phục phân quyền backend về mặc định.')
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể khôi phục phân quyền.')
    } finally {
      setResetting(false)
    }
  }

  const visiblePermissions = PERMISSION_DEFINITIONS.filter(permission => {
    const query = search.trim().toLowerCase()
    return (group === 'all' || permission.group === group) && (!query || permission.label.toLowerCase().includes(query) || permission.key.includes(query))
  })

  return <div className="fade-in rbac-matrix space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeader title="Phân Quyền & Kiểm Soát Truy Cập Backend" subtitle="Thay đổi được kiểm tra bằng quyền manage_roles trong JWT và ghi ActivityLog" /><Button variant="outline" size="sm" disabled={resetting} onClick={() => void resetDefaults()} className="flex shrink-0 items-center gap-2 self-start sm:self-center"><RefreshIcon />{resetting ? 'Đang khôi phục…' : 'Khôi phục mặc định'}</Button></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Tổng Quyền Hạn', String(PERMISSION_DEFINITIONS.length), 'quyền'], ['Nhóm Vai Trò', String(roles.length), 'vai trò'], ['Khối Chức Năng', '3', 'khối'], ['Bảo Vệ Cốt Lõi', '2', 'quyền khóa']].map(([title, value, unit]) => <div key={title} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value} <span className="text-sm font-normal text-slate-500">{unit}</span></p></div>)}</div>
    <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center"><div className="relative max-w-md flex-1"><input type="search" aria-label="Tìm kiếm quyền hạn" placeholder="Tìm kiếm quyền hạn…" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-800" /><SearchIcon className="pointer-events-none absolute left-3 top-2.5 text-slate-400" /></div><div className="flex items-center gap-1.5 overflow-x-auto pb-1">{(['all', 'Điều hướng', 'Nghiệp vụ', 'Quản trị'] as const).map(value => <button key={value} type="button" onClick={() => setGroup(value)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${group === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{value === 'all' ? 'Tất cả' : value}</button>)}</div></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={loadRoles}>Thử lại</Button></div>}
    {loading ? <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải phân quyền từ backend…</div> : <Card className="overflow-hidden border border-slate-200/90 shadow-xs"><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-b border-slate-200 bg-slate-900 text-white"><th className="min-w-[280px] px-6 py-3.5 text-left text-xs uppercase tracking-wider">Quyền Hạn</th>{roles.map(role => <th key={role.code} className="min-w-[130px] px-4 py-3.5 text-center text-xs uppercase tracking-wider"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${roleColors[toUiRole(role.code)]}`}>{roleLabels[toUiRole(role.code)]}</span></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(['Điều hướng', 'Nghiệp vụ', 'Quản trị'] as const).map(groupKey => { const permissions = visiblePermissions.filter(permission => permission.group === groupKey); if (!permissions.length) return null; return <Fragment key={groupKey}><tr className="border-y border-slate-200/80 bg-slate-100/90"><td colSpan={roles.length + 1} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">{groupKey}</td></tr>{permissions.map(permission => <tr key={permission.key} className="hover:bg-slate-50/80"><td className="px-6 py-3.5"><div className="font-semibold text-slate-800">{permission.label}</div><div className="mt-0.5 font-mono text-[11px] text-slate-400">{permission.key}</div></td>{roles.map(role => { const enabled = role.permissions.includes(permission.key); const locked = role.code === 'ADMIN' && (permission.key === 'manage_users' || permission.key === 'manage_roles'); return <td key={role.code} className="px-4 py-3 text-center">{locked ? <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><LockIcon />Bảo vệ</span> : <button type="button" aria-label={`${enabled ? 'Thu hồi' : 'Cấp'} quyền ${permission.label} cho ${roleLabels[toUiRole(role.code)]}`} onClick={() => void togglePermission(role, permission.key)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>{enabled ? <><CheckIcon />Đã cấp</> : <><MinusIcon />Chưa cấp</>}</button>}</td>})}</tr>)}</Fragment>})}</tbody></table></div></Card>}
  </div>
}
