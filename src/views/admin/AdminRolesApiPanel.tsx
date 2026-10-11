import { useEffect, useState } from 'react'
import { Button, Card, SectionHeader } from '../../components/ui'
import type { PermissionKey, Role, User } from '../../types'
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DEFINITIONS } from '../../auth/rbac'
import { listAdminRoles, updateAdminRolePermissions, type AdminApiRole } from '../../services/adminApi'
import type { ApiRoleCode } from '../../services/authApi'
import { CheckIcon, LockIcon, MinusIcon, RefreshIcon, SearchIcon, roleColors, roleLabels, type AdminToast } from './adminPanelTypes'
import { activityPermissionLabel } from './adminActivityLocalization'

type InternalRoleCode = Exclude<ApiRoleCode, 'CUSTOMER'>
type DraftPermissions = Partial<Record<InternalRoleCode, string[]>>
type PermissionModule = 'Kho bãi & vận hành' | 'Hợp đồng & dịch vụ' | 'Tài chính & báo cáo' | 'Hỗ trợ & quản trị'

const INTERNAL_ROLE_CODES: InternalRoleCode[] = ['ADMIN', 'MANAGER', 'STAFF', 'BUSINESS']
const MODULES: PermissionModule[] = ['Kho bãi & vận hành', 'Hợp đồng & dịch vụ', 'Tài chính & báo cáo', 'Hỗ trợ & quản trị']
const MANAGER_REQUIRED = new Set(['reservations:approve', 'policies:update', 'staff_tasks:update', 'reports:read'])
const STAFF_RESTRICTED = new Set(['reservations:approve', 'payments:collect', 'policies:update', 'staff_tasks:update'])
const BUSINESS_RESTRICTED = new Set(['policies:update', 'settings:manage', 'payments:collect', 'reservations:approve'])

const roleKey = (code: InternalRoleCode) => code.toLowerCase() as Role
const roleDescription: Record<InternalRoleCode, string> = {
  ADMIN: 'Quản trị tài khoản, vai trò, cài đặt và kiểm toán.',
  MANAGER: 'Phê duyệt, điều phối vận hành, chính sách và báo cáo.',
  STAFF: 'Thực thi bàn giao, trả kho và hỗ trợ khách hàng.',
  BUSINESS: 'Theo dõi cơ hội, hợp đồng và thông tin thương mại.',
}

const permissionModule = (key: PermissionKey): PermissionModule => {
  if (['facilities:read', 'storage_units:read', 'reservations:read', 'storage_units:assign', 'checkins:process', 'returns:process', 'inventory:update'].includes(key)) return 'Kho bãi & vận hành'
  if (['contracts:read', 'checkins:read', 'rentals:read', 'rentals:update'].includes(key)) return 'Hợp đồng & dịch vụ'
  if (['payments:read', 'payments:collect', 'policies:read', 'policies:update', 'reports:read'].includes(key)) return 'Tài chính & báo cáo'
  return 'Hỗ trợ & quản trị'
}

const isInternalRole = (role: AdminApiRole): role is AdminApiRole & { code: InternalRoleCode } => INTERNAL_ROLE_CODES.includes(role.code as InternalRoleCode)
const validPermissionKeys = new Set(PERMISSION_DEFINITIONS.map(permission => permission.key))
const cleanPermissions = (permissions: string[]) => [...new Set(permissions.filter(permission => validPermissionKeys.has(permission as PermissionKey)))]
const samePermissions = (left: string[], right: string[]) => [...new Set(left)].sort().join('|') === [...new Set(right)].sort().join('|')

const defaultPermissions = (code: InternalRoleCode) => Object.entries(DEFAULT_ROLE_PERMISSIONS[roleKey(code)])
  .filter(([, enabled]) => enabled)
  .map(([permission]) => permission)

const directRoleDefaults: Partial<Record<InternalRoleCode, string[]>> = {
  MANAGER: ['reservations:approve', 'storage_units:assign', 'payments:read', 'policies:read', 'payments:collect', 'inventory:update', 'policies:update', 'staff_tasks:update', 'reports:read'],
}

const isProtectedPermission = (role: InternalRoleCode, permission: string) => {
  if (role === 'ADMIN') return true
  if (role === 'MANAGER') return MANAGER_REQUIRED.has(permission)
  if (role === 'STAFF') return STAFF_RESTRICTED.has(permission)
  return BUSINESS_RESTRICTED.has(permission)
}

const permissionStateLabel = (role: InternalRoleCode, permission: string, enabled: boolean, inherited: boolean) => {
  if (inherited) return 'Kế thừa'
  if (role === 'ADMIN') return 'Bắt buộc'
  if (role === 'STAFF' && STAFF_RESTRICTED.has(permission)) return 'Không áp dụng'
  if (role === 'BUSINESS' && BUSINESS_RESTRICTED.has(permission)) return 'Không áp dụng'
  if (role === 'MANAGER' && MANAGER_REQUIRED.has(permission)) return 'Bắt buộc'
  return enabled ? 'Đã cấp' : 'Chưa cấp'
}

export default function AdminRolesApiPanel({ user: _user, showToast }: { user: User; showToast: AdminToast }) {
  const [roles, setRoles] = useState<(AdminApiRole & { code: InternalRoleCode })[]>([])
  const [drafts, setDrafts] = useState<DraftPermissions>({})
  const [selectedCode, setSelectedCode] = useState<InternalRoleCode | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [activeModule, setActiveModule] = useState<PermissionModule>('Kho bãi & vận hành')
  const [error, setError] = useState<string | null>(null)

  const loadRoles = () => {
    setLoading(true)
    setError(null)
    listAdminRoles().then(response => {
      const internalRoles = response.filter(isInternalRole).map(role => ({
        ...role,
        permissions: cleanPermissions(role.permissions),
        directPermissions: cleanPermissions(role.directPermissions ?? role.permissions),
        inheritedPermissions: cleanPermissions(role.inheritedPermissions ?? []),
      }))
      setRoles(internalRoles)
      setDrafts(Object.fromEntries(internalRoles.map(role => [role.code, role.directPermissions])) as DraftPermissions)
      setSelectedCode(current => current && internalRoles.some(role => role.code === current) ? current : internalRoles[0]?.code ?? null)
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải thông tin phân quyền.')).finally(() => setLoading(false))
  }

  useEffect(() => { loadRoles() }, [])

  const selectedRole = roles.find(role => role.code === selectedCode)
  const selectedDraft = selectedRole ? drafts[selectedRole.code] ?? selectedRole.directPermissions : []
  const changedRoles = roles.filter(role => !samePermissions(drafts[role.code] ?? role.directPermissions, role.directPermissions))
  const changedPermissionCount = changedRoles.reduce((total, role) => {
    const current = new Set(role.directPermissions)
    const next = new Set(drafts[role.code] ?? role.directPermissions)
    return total + new Set([...current].filter(value => !next.has(value))).size + new Set([...next].filter(value => !current.has(value))).size
  }, 0)

  const updateDraft = (next: string[]) => {
    if (!selectedRole) return
    setDrafts(current => ({ ...current, [selectedRole.code]: cleanPermissions(next) }))
  }

  const togglePermission = (permission: string) => {
    if (!selectedRole || selectedRole.inheritedPermissions.includes(permission) || isProtectedPermission(selectedRole.code, permission)) return
    const current = new Set(selectedDraft)
    if (current.has(permission)) current.delete(permission)
    else current.add(permission)
    updateDraft([...current])
  }

  const applyModulePreset = (module: PermissionModule, mode: 'readonly' | 'full') => {
    if (!selectedRole) return
    const moduleKeys = PERMISSION_DEFINITIONS.filter(permission => permissionModule(permission.key) === module).map(permission => permission.key)
    const next = new Set(selectedDraft)
    moduleKeys.forEach(permission => {
      if (selectedRole.inheritedPermissions.includes(permission) || isProtectedPermission(selectedRole.code, permission)) return
      if (mode === 'full' || (mode === 'readonly' && permission.endsWith(':read'))) next.add(permission)
      else next.delete(permission)
    })
    updateDraft([...next])
  }

  const saveChanges = async () => {
    if (!changedRoles.length) return
    setSaving(true)
    try {
      const updated = await Promise.all(changedRoles.map(role => updateAdminRolePermissions(role.code, drafts[role.code] ?? role.directPermissions)))
      const updatedByCode = new Map(updated.map(role => [role.code, role]))
      setRoles(current => current.map(role => {
        const next = updatedByCode.get(role.code)
        return next ? {
          ...role,
          name: next.name,
          parentRole: next.parentRole,
          permissions: cleanPermissions(next.permissions),
          directPermissions: cleanPermissions(next.directPermissions ?? next.permissions),
          inheritedPermissions: cleanPermissions(next.inheritedPermissions ?? []),
          userCount: next.userCount,
        } : role
      }))
      setDrafts(current => ({ ...current, ...Object.fromEntries(updated.map(role => [role.code, cleanPermissions(role.directPermissions ?? role.permissions)])) }))
      setReviewOpen(false)
      showToast(`Đã áp dụng thay đổi cho ${updated.length} vai trò và ghi nhận vào nhật ký.`)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể áp dụng thay đổi phân quyền.')
      loadRoles()
    } finally {
      setSaving(false)
    }
  }

  const discardChanges = () => setDrafts(Object.fromEntries(roles.map(role => [role.code, role.directPermissions])) as DraftPermissions)
  const resetDrafts = () => setDrafts(Object.fromEntries(roles.map(role => [role.code, directRoleDefaults[role.code] ?? defaultPermissions(role.code)])) as DraftPermissions)

  const visibleModules = MODULES.map(module => ({
    module,
    permissions: PERMISSION_DEFINITIONS.filter(permission => permissionModule(permission.key) === module && (!search.trim() || permission.label.toLowerCase().includes(search.trim().toLowerCase()) || permission.key.includes(search.trim().toLowerCase()))),
  }))
  const activePermissions = visibleModules.find(item => item.module === activeModule)?.permissions ?? []

  return <div className="fade-in space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <SectionHeader title="Vai trò và quyền truy cập" subtitle="Quản lý quyền của nhân sự nội bộ theo từng vai trò; các thay đổi chỉ được áp dụng sau khi xác nhận." />
      <Button variant="outline" size="sm" onClick={resetDrafts} disabled={loading || saving}><RefreshIcon />Khôi phục đề xuất</Button>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={loadRoles}>Thử lại</Button></div>}
    {loading ? <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải các vai trò nội bộ…</div> : <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-fit p-3">
        <div className="mb-3 px-2"><h2 className="font-semibold text-slate-900">Vai trò nội bộ</h2><p className="mt-1 text-xs text-slate-500">Chọn một vai trò để xem chi tiết.</p></div>
        <div className="space-y-2">{roles.map(role => <button key={role.code} type="button" onClick={() => setSelectedCode(role.code)} aria-pressed={role.code === selectedCode} className={`w-full rounded-xl border p-3 text-left transition ${role.code === selectedCode ? 'border-[#e9a12c] bg-amber-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className="flex items-center justify-between gap-2"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${roleColors[roleKey(role.code)]}`}>{roleLabels[roleKey(role.code)]}</span><span className="text-xs text-slate-500">{role.userCount ?? 0} tài khoản</span></div><p className="mt-2 text-xs leading-5 text-slate-600">{roleDescription[role.code]}</p><p className="mt-2 text-[11px] text-slate-400">{role.permissions.length} quyền hiệu lực · {role.directPermissions.length} quyền trực tiếp</p></button>)}</div>
      </Card>
      <div className="min-w-0 space-y-4">
        {selectedRole && <>
          <Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${roleColors[roleKey(selectedRole.code)]}`}>{roleLabels[roleKey(selectedRole.code)]}</span><span className="text-sm text-slate-500">{selectedRole.userCount ?? 0} tài khoản đang sử dụng</span></div><h2 className="mt-3 text-xl font-semibold text-slate-900">Quyền của {roleLabels[roleKey(selectedRole.code)]}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">{roleDescription[selectedRole.code]}</p><p className="mt-2 text-xs font-medium text-slate-500">{selectedRole.parentRole ? `Kế thừa từ ${roleLabels[roleKey(selectedRole.parentRole as InternalRoleCode)]}` : 'Không kế thừa từ vai trò khác'}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong className="block text-slate-800">Phạm vi dữ liệu</strong><span>Theo cơ sở được gắn cho từng tài khoản</span></div></div></Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-md flex-1"><input type="search" aria-label="Tìm quyền" placeholder="Tìm quyền theo nghiệp vụ…" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e9a12c]" style={{ paddingLeft: '2.5rem' }} /><SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /></div><p className="text-xs text-slate-500">Quyền hiển thị: {selectedDraft.length}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{visibleModules.map(({ module, permissions }) => <button key={module} type="button" onClick={() => setActiveModule(module)} aria-pressed={activeModule === module} className={`rounded-xl border px-3 py-3 text-left transition ${activeModule === module ? 'border-[#e9a12c] bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}><span className="block text-xs font-semibold text-slate-800">{module}</span><span className="mt-1 block text-[11px] text-slate-500">{permissions.length} quyền · {permissions.filter(permission => selectedDraft.includes(permission.key) || selectedRole.inheritedPermissions.includes(permission.key)).length} đang hiệu lực</span></button>)}</div>
          <Card className="overflow-hidden"><div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-800">{activeModule}</h3><p className="text-xs text-slate-500">Quyền kế thừa chỉ đọc; quyền trực tiếp có thể chỉnh sửa.</p></div><div className="flex gap-2"><button type="button" onClick={() => applyModulePreset(activeModule, 'readonly')} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">Chỉ đọc</button><button type="button" onClick={() => applyModulePreset(activeModule, 'full')} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">Toàn quyền module</button></div></div><div className="divide-y divide-slate-100">{activePermissions.length ? activePermissions.map(permission => { const inherited = selectedRole.inheritedPermissions.includes(permission.key); const enabled = inherited || selectedDraft.includes(permission.key); const protectedPermission = inherited || isProtectedPermission(selectedRole.code, permission.key); const stateLabel = permissionStateLabel(selectedRole.code, permission.key, enabled, inherited); return <div key={permission.key} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><p className="font-medium text-slate-800">{permission.label}</p><p className="mt-0.5 font-mono text-[11px] text-slate-400">{permission.key}</p></div>{protectedPermission ? <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${inherited ? 'border border-blue-200 bg-blue-50 text-blue-700' : stateLabel === 'Không áp dụng' ? 'border border-slate-200 bg-slate-50 text-slate-400' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>{stateLabel === 'Bắt buộc' ? <LockIcon /> : <MinusIcon />}{stateLabel}</span> : <button type="button" aria-pressed={enabled} aria-label={`${enabled ? 'Thu hồi' : 'Cấp'} quyền ${permission.label}`} onClick={() => togglePermission(permission.key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{enabled ? <><CheckIcon />Đã cấp</> : <><MinusIcon />Chưa cấp</>}</button>}</div> }) : <div className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy quyền phù hợp trong nhóm này.</div>}</div></Card>
        </>}
      </div>
    </div>}
    {!!changedRoles.length && <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-amber-950">Bạn có {changedPermissionCount} thay đổi chưa lưu</p><p className="text-xs text-amber-800">Kiểm tra lại trước khi áp dụng cho {changedRoles.length} vai trò.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={discardChanges} disabled={saving}>Hủy thay đổi</Button><Button size="sm" onClick={() => setReviewOpen(true)} disabled={saving}>Xem lại thay đổi</Button></div></div>}
    {reviewOpen && <div role="dialog" aria-modal="true" aria-labelledby="role-review-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="role-review-title" className="text-xl font-semibold text-slate-900">Xem lại thay đổi phân quyền</h2><p className="mt-1 text-sm text-slate-500">Chỉ quyền cấp trực tiếp được thay đổi; quyền kế thừa luôn được giữ theo vai trò cha.</p></div><button type="button" aria-label="Đóng xem lại" onClick={() => setReviewOpen(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div><div className="mt-5 space-y-3">{changedRoles.map(role => { const before = new Set(role.directPermissions); const after = new Set(drafts[role.code] ?? role.directPermissions); const added = [...after].filter(permission => !before.has(permission)); const removed = [...before].filter(permission => !after.has(permission)); return <div key={role.code} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${roleColors[roleKey(role.code)]}`}>{roleLabels[roleKey(role.code)]}</span><span className="text-xs text-slate-500">{added.length} cấp thêm · {removed.length} thu hồi</span></div><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><p className="font-medium text-emerald-700">Cấp thêm</p><p className="mt-1 text-slate-600">{added.length ? added.map(permission => activityPermissionLabel(permission, PERMISSION_DEFINITIONS.find(item => item.key === permission)?.label ?? permission)).join(', ') : 'Không có'}</p></div><div><p className="font-medium text-red-700">Thu hồi</p><p className="mt-1 text-slate-600">{removed.length ? removed.map(permission => activityPermissionLabel(permission, PERMISSION_DEFINITIONS.find(item => item.key === permission)?.label ?? permission)).join(', ') : 'Không có'}</p></div></div></div> })}</div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setReviewOpen(false)} disabled={saving}>Quay lại chỉnh sửa</Button><Button size="sm" onClick={() => void saveChanges()} disabled={saving}>{saving ? 'Đang áp dụng…' : 'Áp dụng thay đổi'}</Button></div></div></div>}
  </div>
}
