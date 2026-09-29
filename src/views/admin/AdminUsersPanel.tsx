import { useState } from 'react'
import { Avatar, Badge, Button, Card, Input, Modal, SectionHeader, Select, StatCard, Table, Tabs, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import type { Role, User } from '../../types'
import { USERS } from '../../data/demoDatabase'
import { useStorageHub } from '../../store/StorageHubContext'
import { isApiAuthenticated } from '../../services/authApi'
import { roleColors, roleLabels, type AdminToast } from './adminPanelTypes'
import AdminUsersApiPanel from './AdminUsersApiPanel'

type AccountMode = 'internal' | 'customer-support'
type AccountStatus = 'active' | 'inactive' | 'suspended'
type DemoUser = (typeof USERS)[number] & { mustChangePassword?: boolean }

const emptyForm = { name: '', email: '', phone: '', role: 'staff' as Exclude<Role, 'customer'>, facility: '', status: 'active' as AccountStatus, reason: '' }

export function LegacyAdminUsersPanel({ user, showToast }: { user: User; showToast: AdminToast }) {
  const {
    users, facilities, createInternalAccount, createCustomerSupportAccount, updateUserAccount,
    setUserAccountStatus, requestUserPasswordReset,
  } = useStorageHub()
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<AccountMode>('internal')
  const [form, setForm] = useState(emptyForm)
  const [tab, setTab] = useState('Tất cả')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const openCreate = (nextMode: AccountMode) => {
    setSelectedUser(null)
    setMode(nextMode)
    setForm({ ...emptyForm, facility: nextMode === 'internal' ? '' : 'All facilities' })
    setModalOpen(true)
  }

  const openEdit = (account: DemoUser) => {
    setSelectedUser(account)
    setMode('internal')
    setForm({
      name: account.name,
      email: account.email,
      phone: account.phone ?? '',
      role: account.role === 'customer' ? 'staff' : account.role as Exclude<Role, 'customer'>,
      facility: account.facility ?? '',
      status: account.status as AccountStatus,
      reason: '',
    })
    setModalOpen(true)
  }

  const save = () => {
    try {
      if (selectedUser) {
        updateUserAccount(selectedUser.id, selectedUser.role === 'customer' ? { ...form, role: undefined } : form, user)
        showToast('Đã cập nhật tài khoản và ghi audit log.')
      } else if (mode === 'customer-support') {
        createCustomerSupportAccount({ name: form.name, email: form.email, phone: form.phone, facility: form.facility, reason: form.reason }, user)
        showToast('Đã tạo khách hàng hỗ trợ và ghi nhật ký kiểm toán.')
      } else {
        createInternalAccount(form, user)
        showToast('Đã tạo tài khoản nội bộ và ghi audit log.')
      }
      setModalOpen(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể lưu tài khoản.')
    }
  }

  const filteredUsers = users.filter(account => {
    const tabMatch = tab === 'Tất cả' || (tab === 'Khách hàng' && account.role === 'customer') || (tab === 'Nhân viên' && account.role === 'staff') || (tab === 'Quản lý' && account.role === 'manager') || (tab === 'Quản trị' && account.role === 'admin') || (tab === 'Tạm khóa' && account.status === 'suspended')
    const query = search.trim().toLowerCase()
    return tabMatch && (roleFilter === 'all' || account.role === roleFilter) && (facilityFilter === 'all' || (account.facility ?? '') === facilityFilter) && (statusFilter === 'all' || account.status === statusFilter) && (!query || account.name.toLowerCase().includes(query) || account.email.toLowerCase().includes(query))
  })

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'muted' | 'error'> = { active: 'success', inactive: 'muted', suspended: 'error' }
    const labels: Record<string, string> = { active: 'Hoạt động', inactive: 'Ngưng', suspended: 'Tạm khóa' }
    return <Badge variant={variants[status] ?? 'muted'}>{labels[status] ?? status}</Badge>
  }

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(previous => ({ ...previous, [key]: value }))

  return <div className="fade-in">
    <SectionHeader title="Quản Lý Tài Khoản Người Dùng" subtitle={`Tổng cộng ${users.length} tài khoản người dùng`} action={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => openCreate('customer-support')}>Tạo khách hàng hỗ trợ</Button><Button size="sm" onClick={() => openCreate('internal')}>Tạo tài khoản nội bộ</Button></div>} />
    <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard title="Tổng tài khoản" value={users.length} icon={undefined} /><StatCard title="Đang hoạt động" value={users.filter(account => account.status === 'active').length} icon={undefined} /><StatCard title="Khách hàng" value={users.filter(account => account.role === 'customer').length} icon={undefined} /><StatCard title="Bị tạm khóa" value={users.filter(account => account.status === 'suspended').length} icon={undefined} /></div>
    <div className="mb-4"><Tabs tabs={['Tất cả', 'Khách hàng', 'Nhân viên', 'Quản lý', 'Quản trị', 'Tạm khóa']} active={tab} onChange={setTab} /></div>
    <div className="mb-4 grid items-end gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><Input label="Tìm kiếm" aria-label="Tìm tài khoản" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc email…" className="h-10" /><Select label="Vai trò" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="h-10"><option value="all">Tất cả vai trò</option><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option><option value="manager">Quản lý</option><option value="business">Kinh doanh</option><option value="admin">Quản trị viên</option></Select><Select label="Cơ sở" value={facilityFilter} onChange={event => setFacilityFilter(event.target.value)} className="h-10"><option value="all">Tất cả cơ sở</option>{facilities.map(facility => <option key={facility.id} value={facility.name}>{facility.name}</option>)}<option value="All facilities">Tất cả cơ sở</option></Select><Select label="Trạng thái" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-10"><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Ngưng</option><option value="suspended">Tạm khóa</option></Select></div>
    <Card><Table><Thead><tr><Th>Người Dùng</Th><Th>Vai Trò</Th><Th>Cơ Sở</Th><Th>Trạng Thái</Th><Th>Đăng Nhập Cuối</Th><Th>Ngày Tạo</Th><Th className="text-right">Thao Tác</Th></tr></Thead><Tbody>{filteredUsers.map(account => <Tr key={account.id} onClick={() => openEdit(account as DemoUser)}><Td><div className="flex items-center gap-3"><Avatar name={account.name} size="sm" /><div><p className="text-sm font-medium text-slate-800">{account.name}</p><p className="text-xs text-slate-400">{account.email}</p></div></div></Td><Td><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[account.role as Role]}`}>{roleLabels[account.role as Role]}</span></Td><Td className="text-sm text-slate-500">{account.facility ?? '—'}</Td><Td>{statusBadge(account.status)}</Td><Td className="text-sm text-slate-500">{account.lastLogin}</Td><Td className="text-sm text-slate-500">{account.joined}</Td><Td><div className="flex justify-end gap-1.5" onClick={event => event.stopPropagation()}><Button variant="ghost" size="sm" onClick={() => openEdit(account as DemoUser)}>Sửa</Button>{account.id !== user.id && <Button variant="ghost" size="sm" onClick={() => { try { setUserAccountStatus(account.id, account.status === 'active' ? 'suspended' : 'active', user); showToast('Đã cập nhật trạng thái tài khoản.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.') } }}>{account.status === 'active' ? 'Khóa' : 'Mở khóa'}</Button>}</div></Td></Tr>)}</Tbody></Table></Card>

    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selectedUser ? `Chỉnh Sửa Người Dùng – ${selectedUser.name}` : mode === 'customer-support' ? 'Tạo khách hàng theo yêu cầu hỗ trợ' : 'Tạo tài khoản nội bộ'}>
      <div className="space-y-4">{selectedUser && <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><Avatar name={selectedUser.name} size="lg" /><div><p className="font-semibold text-slate-800">{selectedUser.name}</p><p className="text-xs text-slate-400">{selectedUser.id} · Tham gia {selectedUser.joined ?? 'Gần đây'}</p></div></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input label="Họ và Tên" value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Jane Smith" /><Input label="Email" type="email" value={form.email} onChange={event => setField('email', event.target.value)} placeholder="jane@example.com" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Select label="Vai Trò" value={selectedUser?.role === 'customer' ? 'customer' : form.role} disabled={selectedUser?.role === 'customer'} onChange={event => setField('role', event.target.value as Exclude<Role, 'customer'>)}>{selectedUser?.role === 'customer' && <option value="customer">Khách hàng</option>}<option value="staff">Nhân viên</option><option value="manager">Quản lý cơ sở</option><option value="business">Giám đốc kinh doanh</option><option value="admin">Quản trị viên</option></Select><Select label="Trạng Thái" value={form.status} onChange={event => setField('status', event.target.value as AccountStatus)}><option value="active">Hoạt động</option><option value="inactive">Ngưng hoạt động</option><option value="suspended">Đình chỉ</option></Select></div>
        <Input label="Số điện thoại" value={form.phone} onChange={event => setField('phone', event.target.value)} placeholder="0901 234 567" /><Select label="Cơ sở kho" value={form.facility} onChange={event => setField('facility', event.target.value)}><option value="">Chưa gán cơ sở</option><option value="All facilities">Tất cả cơ sở</option>{facilities.map(facility => <option key={facility.id} value={facility.name}>{facility.name}</option>)}</Select>
        {!selectedUser && mode === 'customer-support' && <Input label="Lý do hỗ trợ (bắt buộc)" value={form.reason} onChange={event => setField('reason', event.target.value)} placeholder="Ví dụ: hỗ trợ khách không thể tự đăng ký" />}
        {selectedUser && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><span>Mật khẩu: {selectedUser.mustChangePassword ? 'Bắt buộc đổi sau reset/cấp mới' : 'Đang hoạt động'}</span><Button variant="outline" size="sm" onClick={() => { try { requestUserPasswordReset(selectedUser.id, user); showToast('Đã tạo yêu cầu reset mật khẩu và ghi audit log.') } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể reset mật khẩu.') } }}>Tạo yêu cầu reset</Button></div>}
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setModalOpen(false)}>Hủy Bỏ</Button><Button onClick={save}>{selectedUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</Button></div>
      </div>
    </Modal>
  </div>
}

export default function AdminUsersPanel(props: { user: User; showToast: AdminToast }) {
  return isApiAuthenticated() ? <AdminUsersApiPanel {...props} /> : <LegacyAdminUsersPanel {...props} />
}
