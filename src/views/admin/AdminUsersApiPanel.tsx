import { useEffect, useState } from 'react'
import { Avatar, Badge, Button, Card, Input, Modal, PasswordField, SectionHeader, Select, StatCard, Table, Tabs, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { Role, User } from '../../types'
import {
  createAdminUser,
  listAdminFacilities,
  listAdminUsers,
  patchAdminUser,
  resetAdminUserPassword,
  updateAdminUserFacilities,
  updateAdminUserRoles,
  updateAdminUserStatus,
  type AdminApiFacility,
  type AdminApiUser,
} from '../../services/adminApi'
import {
  primaryRole,
  type ApiFacilityScopeLevel,
  type ApiRoleCode,
  type ApiUserStatus,
} from '../../services/authApi'
import { roleColors, roleLabels, type AdminToast } from './adminPanelTypes'
import { getPasswordValidationError, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy'

type AccountStatus = 'active' | 'inactive' | 'suspended' | 'locked'
type FormRole = Exclude<Role, 'customer'>
type AccountMode = 'internal' | 'customer-support'

interface UserForm {
  name: string
  email: string
  phone: string
  role: FormRole
  facilityId: string
  scopeLevel: ApiFacilityScopeLevel
  status: AccountStatus
  password: string
  resetPassword: string
}

const emptyForm: UserForm = {
  name: '', email: '', phone: '', role: 'staff', facilityId: '', scopeLevel: 'OPERATE', status: 'active', password: '', resetPassword: '',
}

const toApiRole = (role: FormRole): ApiRoleCode => role.toUpperCase() as ApiRoleCode
const toApiStatus = (status: AccountStatus): ApiUserStatus => status === 'active' ? 'ACTIVE' : status === 'suspended' ? 'SUSPENDED' : status === 'locked' ? 'LOCKED' : 'INACTIVE'
const toUiStatus = (status: ApiUserStatus): AccountStatus => status === 'ACTIVE' ? 'active' : status === 'SUSPENDED' ? 'suspended' : status === 'LOCKED' ? 'locked' : 'inactive'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function sameScopes(left: Record<string, ApiFacilityScopeLevel>, right: Record<string, ApiFacilityScopeLevel>) {
  const normalize = (value: Record<string, ApiFacilityScopeLevel>) => Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

function statusBadge(status: AccountStatus) {
  const variants: Record<AccountStatus, 'success' | 'muted' | 'error'> = { active: 'success', inactive: 'muted', suspended: 'error', locked: 'error' }
  const labels: Record<AccountStatus, string> = { active: 'Hoạt động', inactive: 'Ngưng', suspended: 'Tạm khóa', locked: 'Đã khóa' }
  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

export default function AdminUsersApiPanel({ user, showToast }: { user: User; showToast: AdminToast }) {
  const [accounts, setAccounts] = useState<AdminApiUser[]>([])
  const [facilities, setFacilities] = useState<AdminApiFacility[]>([])
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<AdminApiUser | null>(null)
  const [mode, setMode] = useState<AccountMode>('internal')
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const activeRoleFilter = roleFilter !== 'all'
    ? toApiRole(roleFilter as FormRole)
    : ({ 'Khách hàng': 'CUSTOMER', 'Nhân viên': 'STAFF', 'Quản lý': 'MANAGER', 'Quản trị': 'ADMIN' } as Record<string, ApiRoleCode>)[tab]
  const activeStatusFilter = statusFilter !== 'all'
    ? toApiStatus(statusFilter as AccountStatus)
    : tab === 'Tạm khóa' ? 'SUSPENDED' : undefined

  useEffect(() => {
    setPage(0)
  }, [tab, search, roleFilter, facilityFilter, statusFilter])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      listAdminUsers({ page, size: 20, search, role: activeRoleFilter, status: activeStatusFilter, facilityId: facilityFilter }),
      page === 0 ? listAdminFacilities() : Promise.resolve(null),
    ]).then(([userPage, facilityPage]) => {
      if (cancelled) return
      setAccounts(userPage.data)
      setTotalItems(userPage.pagination.totalItems)
      setTotalPages(userPage.pagination.totalPages)
      if (facilityPage) setFacilities(facilityPage.data)
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách tài khoản.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [page, activeRoleFilter, activeStatusFilter, facilityFilter, search, refreshKey, tab])

  const facilityName = (id: string) => facilities.find(facility => facility.id === id)?.name ?? id
  const selectedRole = selected ? primaryRole(selected.roles) : null
  const hasFacilityRole = mode === 'internal' && selectedRole !== 'customer' && (form.role === 'staff' || form.role === 'manager')
  const scopesForForm = hasFacilityRole && form.facilityId ? { [form.facilityId]: form.scopeLevel } : {}
  const displayedAccounts = accounts

  const setField = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm(previous => ({ ...previous, [key]: value }))
    setFieldErrors(previous => ({ ...previous, [key]: '' }))
  }

  const openCreate = (nextMode: AccountMode) => {
    setSelected(null)
    setMode(nextMode)
    setForm(emptyForm)
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEdit = (account: AdminApiUser) => {
    const role = primaryRole(account.roles)
    const facilityId = Object.keys(account.facilityScopes)[0] || ''
    setSelected(account)
    setMode('internal')
    setForm({
      ...emptyForm,
      name: account.fullName,
      email: account.email,
      phone: account.phone || '',
      role: role === 'customer' ? 'staff' : role,
      facilityId,
      scopeLevel: facilityId ? account.facilityScopes[facilityId] : role === 'manager' ? 'MANAGE' : 'OPERATE',
      status: toUiStatus(account.status),
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  const replaceAccount = (next: AdminApiUser) => {
    setAccounts(previous => previous.map(account => account.id === next.id ? next : account))
    setSelected(next)
  }

  const validateNewForm = () => {
    const errors: Record<string, string> = {}
    const email = form.email.trim()
    if (!form.name.trim()) errors.name = 'Vui lòng nhập họ và tên.'
    if (!email) errors.email = 'Vui lòng nhập email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email chưa đúng định dạng. Ví dụ: ten@congty.com.'
    const passwordError = getPasswordValidationError(form.password)
    if (passwordError) errors.password = passwordError
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const saveNew = async () => {
    const role = mode === 'customer-support' ? ['CUSTOMER'] as ApiRoleCode[] : [toApiRole(form.role)]
    const created = await createAdminUser({
      email: form.email.trim(), password: form.password, fullName: form.name.trim(), phone: form.phone.trim() || undefined,
      roles: role, facilityScopes: mode === 'customer-support' ? {} : scopesForForm,
    })
    setAccounts(previous => [created, ...previous])
    setTotalItems(value => value + 1)
    showToast('Đã tạo tài khoản trên backend và ghi audit log.')
  }

  const saveExisting = async () => {
    if (!selected) return
    let updated = await patchAdminUser(selected.id, {
      email: form.email.trim(), fullName: form.name.trim(), phone: form.phone.trim(),
    })
    const currentRole = primaryRole(selected.roles)
    const nextRole: FormRole = form.role
    const nextRoles = currentRole === 'customer' ? selected.roles : [toApiRole(nextRole)]
    const rolesChanged = JSON.stringify([...selected.roles].sort()) !== JSON.stringify([...nextRoles].sort())
    const scopesChanged = !sameScopes(selected.facilityScopes, scopesForForm)
    if (rolesChanged && Object.keys(selected.facilityScopes).length > 0 && !['staff', 'manager'].includes(nextRole)) {
      updated = await updateAdminUserFacilities(selected.id, {})
    }
    if (rolesChanged) updated = await updateAdminUserRoles(selected.id, nextRoles)
    if (scopesChanged && (!rolesChanged || ['staff', 'manager'].includes(nextRole))) {
      updated = await updateAdminUserFacilities(selected.id, scopesForForm)
    }
    if (toUiStatus(selected.status) !== form.status) updated = await updateAdminUserStatus(selected.id, toApiStatus(form.status))
    replaceAccount(updated)
    showToast('Đã cập nhật tài khoản, role/facility scope và ghi audit log.')
  }

  const save = async () => {
    if (!selected && !validateNewForm()) return
    try {
      if (selected) await saveExisting()
      else await saveNew()
      setModalOpen(false)
      setRefreshKey(value => value + 1)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể lưu tài khoản.')
    }
  }

  const changeStatus = async (account: AdminApiUser) => {
    try {
      const next = await updateAdminUserStatus(account.id, account.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')
      replaceAccount(next)
      showToast('Đã cập nhật trạng thái tài khoản trên backend.')
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể cập nhật trạng thái.')
    }
  }

  const resetPassword = async () => {
    if (!selected) return
    const passwordError = getPasswordValidationError(form.resetPassword)
    if (passwordError) {
      setFieldErrors(previous => ({ ...previous, resetPassword: passwordError }))
      showToast(passwordError)
      return
    }
    setFieldErrors(previous => ({ ...previous, resetPassword: '' }))
    try {
      const next = await resetAdminUserPassword(selected.id, form.resetPassword)
      replaceAccount(next)
      setField('resetPassword', '')
      showToast('Đã reset mật khẩu; tài khoản bắt buộc đổi mật khẩu khi đăng nhập.')
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể reset mật khẩu.')
    }
  }

  return <div className="fade-in">
    <SectionHeader title="Quản Lý Tài Khoản Người Dùng" subtitle={`Backend · Tổng cộng ${totalItems} tài khoản người dùng`} action={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openCreate('customer-support')}>Tạo khách hàng hỗ trợ</Button><Button size="sm" onClick={() => openCreate('internal')}>Tạo tài khoản nội bộ</Button></div>} />
    <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard title="Tổng tài khoản" value={totalItems} icon={undefined} /><StatCard title="Đang hiển thị" value={accounts.length} icon={undefined} /><StatCard title="Trang hiện tại" value={page + 1} icon={undefined} /><StatCard title="Tổng số trang" value={totalPages} icon={undefined} /></div>
    <div className="mb-4"><Tabs tabs={['Tất cả', 'Khách hàng', 'Nhân viên', 'Quản lý', 'Quản trị', 'Tạm khóa']} active={tab} onChange={setTab} /></div>
    <div className="mb-4 grid items-end gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><Input label="Tìm kiếm" aria-label="Tìm tài khoản" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc email…" className="h-10" /><Select label="Vai trò" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="h-10"><option value="all">Tất cả vai trò</option><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option><option value="manager">Quản lý</option><option value="business">Kinh doanh</option><option value="admin">Quản trị viên</option></Select><Select label="Cơ sở" value={facilityFilter} onChange={event => setFacilityFilter(event.target.value)} className="h-10"><option value="all">Tất cả cơ sở</option>{facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</Select><Select label="Trạng thái" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-10"><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Ngưng</option><option value="suspended">Tạm khóa</option></Select></div>
    {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setRefreshKey(value => value + 1)}>Thử lại</Button></div>}
    {loading && <div role="status" className="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải dữ liệu từ backend…</div>}
    <Card><Table><Thead><tr><Th>Người Dùng</Th><Th>Vai Trò</Th><Th>Cơ Sở</Th><Th>Trạng Thái</Th><Th>Đăng Nhập Cuối</Th><Th>Ngày Tạo</Th><Th className="text-right">Thao Tác</Th></tr></Thead><Tbody>{displayedAccounts.map(account => {
      const role = primaryRole(account.roles)
      const status = toUiStatus(account.status)
      const scopeIds = Object.keys(account.facilityScopes)
      return <Tr key={account.id} onClick={() => openEdit(account)}><Td><div className="flex items-center gap-3"><Avatar name={account.fullName} size="sm" /><div><p className="text-sm font-medium text-slate-800">{account.fullName}</p><p className="text-xs text-slate-400">{account.email}</p></div></div></Td><Td><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[role]}`}>{roleLabels[role]}</span></Td><Td className="text-sm text-slate-500">{scopeIds.map(facilityName).join(', ') || '—'}</Td><Td>{statusBadge(status)}</Td><Td className="text-sm text-slate-500">—</Td><Td className="text-sm text-slate-500">{formatDate(account.createdAt)}</Td><Td><div className="flex justify-end gap-1.5" onClick={event => event.stopPropagation()}><Button variant="ghost" size="sm" onClick={() => openEdit(account)}>Sửa</Button>{account.id !== user.id && <Button variant="ghost" size="sm" onClick={() => void changeStatus(account)}>{status === 'active' ? 'Khóa' : 'Mở khóa'}</Button>}</div></Td></Tr>
    })}</Tbody></Table></Card>
    {totalPages > 1 && <div className="mt-4 flex items-center justify-end gap-2 text-sm text-stone-500"><span>Trang {page + 1}/{totalPages}</span><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Trước</Button><Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(value => value + 1)}>Sau</Button></div>}

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? `Chỉnh Sửa Người Dùng – ${selected.fullName}` : mode === 'customer-support' ? 'Tạo khách hàng theo yêu cầu hỗ trợ' : 'Tạo tài khoản nội bộ'}>
      <div className="space-y-4">{selected && <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><Avatar name={selected.fullName} size="lg" /><div><p className="font-semibold text-slate-800">{selected.fullName}</p><p className="text-xs text-slate-400">{selected.id} · Tham gia {formatDate(selected.createdAt)}</p></div></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Input label="Họ và Tên" value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Jane Smith" />{fieldErrors.name && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}</div><div><Input label="Email" type="email" value={form.email} onChange={event => setField('email', event.target.value)} placeholder="jane@example.com" />{fieldErrors.email && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}</div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mode === 'internal' ? <Select label="Vai Trò" value={selectedRole === 'customer' ? 'customer' : form.role} disabled={selectedRole === 'customer'} onChange={event => setField('role', event.target.value as FormRole)}>{selectedRole === 'customer' && <option value="customer">Khách hàng</option>}<option value="staff">Nhân viên</option><option value="manager">Quản lý cơ sở</option><option value="business">Giám đốc kinh doanh</option><option value="admin">Quản trị viên</option></Select> : <div className="space-y-1"><span className="text-sm font-medium text-stone-700">Vai Trò</span><div className="flex h-[38px] items-center rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-600">Khách hàng</div></div>}
          {selected ? <Select label="Trạng Thái" value={form.status} onChange={event => setField('status', event.target.value as AccountStatus)}><option value="active">Hoạt động</option><option value="inactive">Ngưng hoạt động</option><option value="suspended">Đình chỉ</option></Select> : <div className="space-y-1"><span className="text-sm font-medium text-stone-700">Trạng Thái</span><div className="flex h-[38px] items-center rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-600">Hoạt động</div></div>}
        </div>
        <Input label="Số điện thoại" value={form.phone} onChange={event => setField('phone', event.target.value)} placeholder="0901 234 567" />
        {hasFacilityRole && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Select label="Cơ sở kho" value={form.facilityId} onChange={event => setField('facilityId', event.target.value)}><option value="">Chưa gán cơ sở</option>{facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</Select><Select label="Mức scope" value={form.scopeLevel} onChange={event => setField('scopeLevel', event.target.value as ApiFacilityScopeLevel)}><option value="READ">Chỉ đọc</option><option value="OPERATE">Vận hành</option><option value="MANAGE">Quản lý</option></Select></div>}
        {!selected && <PasswordField id="admin-create-password" label="Mật khẩu khởi tạo" value={form.password} onChange={event => setField('password', event.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} error={fieldErrors.password} helperText={PASSWORD_POLICY_HINT} />}
        {selected && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p>Mật khẩu: {selected.mustChangePassword ? 'Bắt buộc đổi sau reset' : 'Đang hoạt động'}</p><PasswordField id="admin-reset-password" label="Mật khẩu reset" value={form.resetPassword} onChange={event => setField('resetPassword', event.target.value)} autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} error={fieldErrors.resetPassword} helperText={PASSWORD_POLICY_HINT} /><Button type="button" variant="outline" size="sm" onClick={() => void resetPassword()}>Reset mật khẩu</Button></div>}
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setModalOpen(false)}>Hủy Bỏ</Button><Button onClick={() => void save()}>{selected ? 'Lưu thay đổi' : 'Tạo tài khoản'}</Button></div>
      </div>
      {selected && <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto]"><Select label="Trạng thái khi lưu" value={form.status} onChange={event => setField('status', event.target.value as AccountStatus)}><option value="active">Hoạt động</option><option value="inactive">Ngưng hoạt động</option><option value="suspended">Tạm khóa</option><option value="locked">Đã khóa</option></Select><span className="self-end pb-2 text-xs text-slate-500">Thay đổi trạng thái sẽ gọi API riêng và ghi audit log.</span></div>}
    </Modal>
  </div>
}
