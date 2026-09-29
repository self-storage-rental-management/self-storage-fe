import { Fragment, useState } from 'react'
import { Button, Card, SectionHeader } from '../../components/ui'
import type { Role, User } from '../../types'
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DEFINITIONS } from '../../auth/rbac'
import { useStorageHub } from '../../store/StorageHubContext'
import { isApiAuthenticated } from '../../services/authApi'
import { CheckIcon, LockIcon, MinusIcon, RefreshIcon, SearchIcon, roleColors, roleLabels, type AdminToast } from './adminPanelTypes'
import AdminRolesApiPanel from './AdminRolesApiPanel'

export function LegacyAdminRolesPanel({ user, showToast }: { user: User; showToast: AdminToast }) {
  const { rolePermissions, updateRolePermissions } = useStorageHub()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<'all' | 'Điều hướng' | 'Nghiệp vụ' | 'Quản trị'>('all')
  const [resetOpen, setResetOpen] = useState(false)

  const resetDefaults = () => {
    try {
      for (const role of Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[]) {
        updateRolePermissions(role, DEFAULT_ROLE_PERMISSIONS[role], user)
      }
      showToast('Đã khôi phục toàn bộ phân quyền về mặc định.')
      setResetOpen(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể khôi phục phân quyền.')
    }
  }

  return (
    <div className="fade-in rbac-matrix space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Phân Quyền & Kiểm Soát Truy Cập Doanh Nghiệp"
          subtitle="Thiết lập quyền hạn truy cập và kiểm soát an toàn vận hành cho từng bộ phận trong tổ chức"
        />
        <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} className="flex shrink-0 items-center gap-2 self-start border-slate-300 text-slate-700 hover:bg-slate-100 sm:self-center">
          <RefreshIcon /> Khôi phục mặc định
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Tổng Quyền Hạn', '27', 'quyền', 'bg-blue-50 text-blue-600', '🛡️'],
          ['Nhóm Vai Trò', '5', 'vai trò', 'bg-purple-50 text-purple-600', '👥'],
          ['Khối Chức Năng', '3', 'khối', 'bg-amber-50 text-amber-600', '⚙️'],
          ['Bảo Vệ Cốt Lõi', '2', 'quyền khóa', 'bg-emerald-50 text-emerald-600', '🔒'],
        ].map(([title, value, unit, color, icon]) => (
          <div key={title} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{value} <span className="text-sm font-normal text-slate-500">{unit}</span></p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${color}`}>{icon}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <input
            type="search"
            aria-label="Tìm kiếm quyền hạn"
            placeholder="Tìm kiếm quyền hạn theo tên hoặc mã key..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]"
          />
          <SearchIcon className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['all', 'Điều hướng', 'Nghiệp vụ', 'Quản trị'] as const).map(value => (
            <button key={value} type="button" onClick={() => setGroup(value)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${group === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {value === 'all' ? 'Tất cả' : value}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden border border-slate-200/90 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-900 text-white"><th className="min-w-[280px] px-6 py-3.5 text-left text-xs uppercase tracking-wider">Quyền Hạn Doanh Nghiệp</th>{(Object.keys(roleColors) as Role[]).map(role => <th key={role} className="min-w-[130px] px-4 py-3.5 text-center text-xs uppercase tracking-wider"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${roleColors[role]}`}>{roleLabels[role]}</span></th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(['Điều hướng', 'Nghiệp vụ', 'Quản trị'] as const).map(groupKey => {
                const permissions = PERMISSION_DEFINITIONS.filter(permission => {
                  const query = search.trim().toLowerCase()
                  return permission.group === groupKey && (group === 'all' || group === groupKey) && (!query || permission.label.toLowerCase().includes(query) || permission.key.toLowerCase().includes(query))
                })
                if (!permissions.length) return null
                return <Fragment key={groupKey}>
                  <tr className="border-y border-slate-200/80 bg-slate-100/90"><td colSpan={6} className="px-6 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-800">{groupKey}</td></tr>
                  {permissions.map(permission => <tr key={permission.key} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3.5"><div className="font-semibold text-slate-800">{permission.label}</div><div className="mt-0.5 font-mono text-[11px] text-slate-400">{permission.key}</div></td>
                    {(Object.keys(roleColors) as Role[]).map(role => {
                      const enabled = rolePermissions[role][permission.key]
                      const locked = role === 'admin' && (permission.key === 'manage_users' || permission.key === 'manage_roles')
                      return <td key={role} className="px-4 py-3 text-center">
                        {locked ? <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><LockIcon />Bảo vệ</span> : <button type="button" aria-label={`${enabled ? 'Thu hồi' : 'Cấp'} quyền ${permission.label} cho ${roleLabels[role]}`} onClick={() => { try { updateRolePermissions(role, { [permission.key]: !enabled }, user); showToast(`Đã ${enabled ? 'thu hồi' : 'cấp'} quyền ${permission.label} cho ${roleLabels[role]}.`) } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể cập nhật quyền.') } }} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>{enabled ? <><CheckIcon />Đã cấp</> : <><MinusIcon />Chưa cấp</>}</button>}
                      </td>
                    })}
                  </tr>)}
                </Fragment>
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {resetOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div role="dialog" aria-modal="true" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="font-bold text-slate-900">Khôi Phục Phân Quyền Mặc Định</h3>
          <p className="text-sm leading-relaxed text-slate-600">Bạn có chắc muốn khôi phục bảng phân quyền của 5 nhóm vai trò về cấu hình chuẩn không?</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>Hủy bỏ</Button><Button size="sm" onClick={resetDefaults}>Xác nhận</Button></div>
        </div>
      </div>}
    </div>
  )
}

export default function AdminRolesPanel(props: { user: User; showToast: AdminToast }) {
  return isApiAuthenticated() ? <AdminRolesApiPanel {...props} /> : <LegacyAdminRolesPanel {...props} />
}
