import React, { useState, Fragment } from 'react'
import Layout, { getInitialPage, Icon, type NavItem } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Input, Select, Avatar, Tabs } from '../../components/ui'
import type { User, Role } from '../../types'
import type { PermissionKey } from '../../types'
import { PERMISSION_DEFINITIONS, DEFAULT_ROLE_PERMISSIONS } from '../../auth/rbac'
import { ACTIVITY_LOGS, SETTINGS_GROUPS, type AuditActivityLog } from "../../data/demoDatabase"
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'

function CheckIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function MinusIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
    </svg>
  )
}

function LockIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function RefreshIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} style={{ display: 'inline-block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

const roleColors: Record<Role, string> = {
  customer: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  manager: 'bg-purple-100 text-purple-700',
  business: 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
}

const roleLabels: Record<Role, string> = {
  customer: 'Khách hàng',
  staff: 'Nhân viên',
  manager: 'Quản lý',
  business: 'Kinh doanh',
  admin: 'Quản trị viên',
}

export default function AdminApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const {
    activities,
    users: USERS,
    facilities,
    createInternalAccount,
    createCustomerSupportAccount,
    updateUserAccount,
    setUserAccountStatus,
    deleteUserAccount,
    requestUserPasswordReset,
    rolePermissions,
    updateRolePermissions,
    can,
    loginHistory,
    sessions,
    securityAlerts,
    revokeAllUserSessions
  } = useStorageHub()

  const NAV: NavItem[] = [
    { id: 'users', label: 'Quản lý người dùng', icon: Icon.users, group: 'Quản trị', permission: 'manage_users' as PermissionKey },
    { id: 'roles', label: 'Vai trò & Phân quyền', icon: Icon.shield, group: 'Quản trị', permission: 'manage_roles' as PermissionKey },
    { id: 'login-history', label: 'Lịch sử đăng nhập', icon: Icon.login, group: 'Bảo mật & Giám sát', permission: 'view_audit_logs' as PermissionKey },
    { id: 'activity', label: 'Nhật ký hoạt động', icon: Icon.log, group: 'Bảo mật & Giám sát', permission: 'view_audit_logs' as PermissionKey },
    { id: 'settings', label: 'Cài đặt hệ thống', icon: Icon.cog, group: 'Hệ thống', permission: 'manage_settings' as PermissionKey },
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, 'users'))
  const [userModal, setUserModal] = useState(false)
  const [userTab, setUserTab] = useState('Tất cả')
  const [logTab, setLogTab] = useState('Tất cả')
  const [logSearch, setLogSearch] = useState('')
  const [historyTab, setHistoryTab] = useState('Tất cả')
  const [historyUserFilter, setHistoryUserFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<typeof USERS[0] | null>(null)
  const [accountMode, setAccountMode] = useState<'internal' | 'customer-support'>('internal')
  const [accountForm, setAccountForm] = useState({ name: '', email: '', phone: '', role: 'staff' as Exclude<Role, 'customer'>, facility: '', status: 'active' as 'active' | 'inactive' | 'suspended', reason: '' })
  const [accountSearch, setAccountSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // RBAC interactive state
  const [rbacSearch, setRbacSearch] = useState('')
  const [rbacGroupFilter, setRbacGroupFilter] = useState<'all' | 'Điều hướng' | 'Nghiệp vụ' | 'Quản trị'>('all')
  const [showResetModal, setShowResetModal] = useState(false)

  const handleResetDefaultPermissions = () => {
    try {
      for (const r of (Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[])) {
        updateRolePermissions(r, DEFAULT_ROLE_PERMISSIONS[r], user)
      }
      showToast('Đã khôi phục toàn bộ phân quyền về trạng thái mặc định.')
      setShowResetModal(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể khôi phục phân quyền.')
    }
  }

  // Audit Logs interactive state
  const [logsList, setLogsList] = useState<AuditActivityLog[]>(ACTIVITY_LOGS)
  const [selectedLog, setSelectedLog] = useState<AuditActivityLog | null>(null)
  const [logModalOpen, setLogModalOpen] = useState(false)

  // Settings interactive state
  const [activeSettingsTab, setActiveSettingsTab] = useState('Tất cả danh mục')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const openCreateAccount = (mode: 'internal' | 'customer-support') => {
    setSelectedUser(null)
    setAccountMode(mode)
    setAccountForm({ name: '', email: '', phone: '', role: 'staff', facility: mode === 'internal' ? '' : 'All facilities', status: 'active', reason: '' })
    setUserModal(true)
  }

  const openEditAccount = (account: typeof USERS[0]) => {
    setSelectedUser(account)
    setAccountMode('internal')
    setAccountForm({ name: account.name, email: account.email, phone: account.phone ?? '', role: account.role === 'customer' ? 'staff' : account.role as Exclude<Role, 'customer'>, facility: account.facility ?? '', status: account.status as 'active' | 'inactive' | 'suspended', reason: '' })
    setUserModal(true)
  }

  const handleAccountSubmit = () => {
    try {
      if (selectedUser) {
        updateUserAccount(selectedUser.id, selectedUser.role === 'customer' ? { ...accountForm, role: undefined } : accountForm, user)
        showToast('Đã cập nhật tài khoản và ghi audit log.')
      } else if (accountMode === 'customer-support') {
        createCustomerSupportAccount({ name: accountForm.name, email: accountForm.email, phone: accountForm.phone, facility: accountForm.facility, reason: accountForm.reason }, user)
        showToast('Đã tạo khách hàng theo yêu cầu hỗ trợ và ghi nhật ký kiểm toán.')
      } else {
        createInternalAccount(accountForm, user)
        showToast('Đã tạo tài khoản nội bộ và ghi audit log.')
      }
      setUserModal(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Không thể lưu tài khoản.')
    }
  }

  const filteredUsers = USERS.filter(u => {
    const tabMatch = userTab === 'Tất cả'
      || userTab === 'Khách hàng' && u.role === 'customer'
      || userTab === 'Nhân viên' && u.role === 'staff'
      || userTab === 'Quản lý' && u.role === 'manager'
      || userTab === 'Quản trị' && u.role === 'admin'
      || userTab === 'Tạm khóa' && u.status === 'suspended'
    const query = accountSearch.trim().toLowerCase()
    return tabMatch
      && (roleFilter === 'all' || u.role === roleFilter)
      && (facilityFilter === 'all' || (u.facility ?? '') === facilityFilter)
      && (statusFilter === 'all' || u.status === statusFilter)
      && (!query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
  })

  const sb = (v: string) => {
    const m: Record<string, string> = {
      active: 'success', inactive: 'muted', suspended: 'error',
      success: 'success', failed: 'error',
      info: 'info', warning: 'warning', error: 'error',
      admin: 'error', manager: 'purple', staff: 'success', business: 'warning', customer: 'info',
    }
    const viLabels: Record<string, string> = {
      active: 'Hoạt động', inactive: 'Ngưng', suspended: 'Tạm khóa',
      success: 'Thành công', failed: 'Thất bại',
      admin: 'Quản trị viên', manager: 'Quản lý kho', staff: 'Nhân viên', business: 'Thương mại', customer: 'Khách hàng',
    }
    return <Badge variant={m[v] ?? 'muted'}>{viLabels[v] ? viLabels[v] : v.charAt(0).toUpperCase() + v.slice(1)}</Badge>
  }

  return (
    <Layout
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel="Quản Trị Viên Hệ Thống" roleColor="bg-red-100 text-red-700"
      canAccess={permission => can(user, permission)}
    >
      {/* Ensure notification bell icon is displayed in Admin portal */}
      <style>{`
        header button[title*="Thông báo" i] svg,
        header button[title*="Notification" i] svg,
        header button[aria-label*="thông báo" i] svg,
        header button[aria-label*="notification" i] svg,
        header .relative > button > svg {
          display: block !important;
        }
      `}</style>
      {/* ── USER MANAGEMENT ───────────────────────────────────── */}
      {page === 'users' && (
        <div className="fade-in">
          <SectionHeader
            title="Quản Lý Tài Khoản Người Dùng"
            subtitle={`Tổng cộng ${USERS.length} tài khoản người dùng`}
            action={
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => openCreateAccount('customer-support')}>Tạo khách hàng hỗ trợ</Button>
                <Button variant="primary" size="sm" onClick={() => openCreateAccount('internal')}>Tạo tài khoản nội bộ</Button>
              </div>
            }
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard title="Tổng tài khoản" value={USERS.length} icon={Icon.users} iconBg="bg-blue-50" />
            <StatCard title="Đang hoạt động" value={USERS.filter(u => u.status === 'active').length} icon={Icon.check} iconBg="bg-green-50" />
            <StatCard title="Khách hàng" value={USERS.filter(u => u.role === 'customer').length} icon={Icon.box} iconBg="bg-purple-50" />
            <StatCard title="Bị tạm khóa" value={USERS.filter(u => u.status === 'suspended').length} icon={Icon.alert} iconBg="bg-red-50" />
          </div>
          <div className="mb-4">
            <Tabs
              tabs={['Tất cả', 'Khách hàng', 'Nhân viên', 'Quản lý', 'Quản trị', 'Tạm khóa']}
              active={userTab}
              onChange={val => setUserTab(val)}
            />
          </div>
          <div className="mb-4 grid items-end gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <Input
              label="Tìm kiếm"
              aria-label="Tìm tài khoản"
              value={accountSearch}
              onChange={event => setAccountSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc email…"
              className="h-10"
            />
            <Select label="Vai trò" value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="h-10">
              <option value="all">Tất cả vai trò</option>
              <option value="customer">Khách hàng</option><option value="staff">Nhân viên</option><option value="manager">Quản lý</option><option value="business">Kinh doanh</option><option value="admin">Quản trị viên</option>
            </Select>
            <Select label="Cơ sở" value={facilityFilter} onChange={event => setFacilityFilter(event.target.value)} className="h-10">
              <option value="all">Tất cả cơ sở</option>
              {facilities.map(facility => <option key={facility.id} value={facility.name}>{facility.name}</option>)}
              <option value="All facilities">Tất cả cơ sở</option>
            </Select>
            <Select label="Trạng thái" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-10">
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option><option value="inactive">Ngưng</option><option value="suspended">Tạm khóa</option>
            </Select>
          </div>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>Người Dùng</Th>
                  <Th>Vai Trò</Th>
                  <Th>Cơ Sở</Th>
                  <Th>Trạng Thái</Th>
                  <Th>Đăng Nhập Cuối</Th>
                  <Th>Ngày Tạo</Th>
                  <Th className="text-right">Thao Tác</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredUsers.map(u => (
                  <Tr key={u.id} onClick={() => openEditAccount(u)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role as Role]}`}>
                        {roleLabels[u.role as Role]}
                      </span>
                    </Td>
                    <Td className="text-slate-500 text-sm">{u.facility ?? '—'}</Td>
                    <Td>{sb(u.status)}</Td>
                    <Td className="text-sm text-slate-500">{u.lastLogin}</Td>
                    <Td className="text-sm text-slate-500">{u.joined}</Td>
                    <Td>
                      <div className="flex gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => openEditAccount(u)}>Sửa</Button>
                        {u.id !== user.id && <Button variant="ghost" size="sm" onClick={() => {
                          try {
                            setUserAccountStatus(u.id, u.status === 'active' ? 'suspended' : 'active', user)
                            showToast('Đã cập nhật trạng thái tài khoản.')
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.')
                          }
                        }}>{u.status === 'active' ? 'Khóa' : 'Mở khóa'}</Button>}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── ROLES & PERMISSIONS (RBAC) ────────────────────────── */}
      {page === 'roles' && can(user, 'manage_roles') && (
        <div className="fade-in rbac-matrix space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SectionHeader
              title="Phân Quyền & Kiểm Soát Truy Cập Doanh Nghiệp"
              subtitle="Thiết lập quyền hạn truy cập, phân công trách nhiệm và kiểm soát an toàn vận hành cho từng bộ phận trong tổ chức"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetModal(true)}
              className="shrink-0 flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 self-start sm:self-center cursor-pointer"
            >
              <RefreshIcon className="w-4 h-4 text-slate-500" />
              <span>Khôi phục mặc định</span>
            </Button>
          </div>

          {/* Executive KPI Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Tổng Quyền Hạn</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">27 <span className="text-sm font-normal text-slate-500">quyền</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">13 Giám sát · 11 Nghiệp vụ · 3 Quản trị</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                🛡️
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Nhóm Vai Trò</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">5 <span className="text-sm font-normal text-slate-500">vai trò</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">Admin, Quản lý, Nhân viên, KH, KD</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-base">
                👥
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Khối Chức Năng</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">3 <span className="text-sm font-normal text-slate-500">khối</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">Điều hướng · Vận hành · Hệ thống</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base">
                ⚙️
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Bảo Vệ Cốt Lõi</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">2 <span className="text-sm font-normal text-slate-500">quyền khóa</span></p>
                <p className="text-[11px] text-slate-500 mt-0.5">Ngăn ngừa tự khóa quyền Admin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
                🔒
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Tìm kiếm quyền hạn (theo tên, mã key)..."
                value={rbacSearch}
                onChange={e => setRbacSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#e9a12c] focus:border-transparent"
              />
              <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                <SearchIcon className="w-4 h-4" />
              </div>
              {rbacSearch && (
                <button
                  type="button"
                  onClick={() => setRbacSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Tất cả', count: 27 },
                { id: 'Điều hướng', label: 'Điều hướng & Giám sát', count: 13 },
                { id: 'Nghiệp vụ', label: 'Nghiệp vụ vận hành', count: 11 },
                { id: 'Quản trị', label: 'Quản trị hệ thống', count: 3 },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRbacGroupFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    rbacGroupFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    rbacGroupFilter === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Matrix Table */}
          <Card className="overflow-hidden border border-slate-200/90 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-900 text-white">
                    <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider min-w-[280px]">
                      Quyền Hạn Doanh Nghiệp
                    </th>
                    {(Object.keys(roleColors) as Role[]).map(r => (
                      <th key={r} className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider min-w-[130px]">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-2xs ${roleColors[r]}`}>
                          {roleLabels[r]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {['Điều hướng', 'Nghiệp vụ', 'Quản trị'].map(groupKey => {
                    const groupPermissions = PERMISSION_DEFINITIONS.filter(p => {
                      const matchesGroup = rbacGroupFilter === 'all' || rbacGroupFilter === groupKey
                      const matchesSearch = !rbacSearch.trim() ||
                        p.label.toLowerCase().includes(rbacSearch.trim().toLowerCase()) ||
                        p.key.toLowerCase().includes(rbacSearch.trim().toLowerCase())
                      return p.group === groupKey && matchesGroup && matchesSearch
                    })

                    if (groupPermissions.length === 0) return null

                    const groupMeta = {
                      'Điều hướng': { title: 'Khối Điều Hướng & Giám Sát Dữ Liệu', badge: 'Xem & Tra cứu', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                      'Nghiệp vụ': { title: 'Khối Nghiệp Vụ Vận Hành & Giao Dịch Kho', badge: 'Thao tác & Phê duyệt', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      'Quản trị': { title: 'Khối Quản Trị Hệ Thống & Bảo Mật', badge: 'Quản trị cấp cao', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                    }[groupKey] || { title: groupKey, badge: 'Phân hệ', color: 'bg-slate-50 text-slate-700 border-slate-200' }

                    return (
                      <Fragment key={groupKey}>
                        {/* Section Header Row */}
                        <tr className="bg-slate-100/90 border-t border-b border-slate-200/80">
                          <td colSpan={6} className="px-6 py-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                                {groupMeta.title}
                              </span>
                              <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border ${groupMeta.color}`}>
                                {groupMeta.badge} ({groupPermissions.length})
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Permission Rows */}
                        {groupPermissions.map(p => (
                          <tr key={p.key} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-3.5">
                              <div className="font-semibold text-slate-800 text-sm">{p.label}</div>
                              <div className="mt-0.5 text-[11px] font-mono text-slate-400">{p.key}</div>
                            </td>
                            {(Object.keys(roleColors) as Role[]).map(r => {
                              const has = rolePermissions[r][p.key]
                              const locked = r === 'admin' && (p.key === 'manage_roles' || p.key === 'manage_users')

                              return (
                                <td key={r} className="px-4 py-3 text-center align-middle">
                                  {locked ? (
                                    <div
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold cursor-not-allowed select-none shadow-2xs"
                                      title="Quyền lõi quản trị được bảo vệ hệ thống, không thể tắt"
                                    >
                                      <LockIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span className="text-[11px]">Bảo vệ</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      aria-label={`${has ? 'Thu hồi' : 'Cấp'} quyền ${p.label} cho ${roleLabels[r]}`}
                                      onClick={() => {
                                        try {
                                          updateRolePermissions(r, { [p.key]: !has }, user)
                                          showToast(`Đã ${has ? 'thu hồi' : 'cấp'} quyền "${p.label}" cho ${roleLabels[r]}.`)
                                        } catch (error) {
                                          showToast(error instanceof Error ? error.message : 'Không thể cập nhật quyền.')
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs ${
                                        has
                                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                                          : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200'
                                      }`}
                                      title={has ? 'Đã cấp quyền (Nhấn để thu hồi)' : 'Chưa cấp quyền (Nhấn để cấp)'}
                                    >
                                      {has ? (
                                        <>
                                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span className="text-[11.5px]">Đã cấp</span>
                                        </>
                                      ) : (
                                        <>
                                          <MinusIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="text-[11.5px]">Chưa cấp</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Footer Guide Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              i
            </div>
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-slate-800">Cơ chế áp dụng quyền hạn tức thời:</p>
              <p>Mọi thay đổi trên ma trận quyền hạn sẽ được cập nhật trực tiếp vào hệ thống và có hiệu lực ngay đối với các thanh điều hướng, quyền truy cập trang và thao tác nghiệp vụ của người dùng tương ứng mà không cần khởi động lại dịch vụ.</p>
              <p className="text-amber-700 font-medium">Lưu ý: Hai quyền cốt lõi của Quản trị viên (Quản lý tài khoản & Quản lý bảng quyền) được khóa an toàn vĩnh viễn để bảo vệ tính toàn vẹn của hệ thống.</p>
            </div>
          </div>

          {/* Modal Khôi phục mặc định */}
          {showResetModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                <div className="flex items-center gap-3 text-amber-600">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <RefreshIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Khôi Phục Phân Quyền Mặc Định</h3>
                    <p className="text-xs text-slate-500">Cài đặt lại cấu hình RBAC tiêu chuẩn</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn khôi phục toàn bộ bảng phân quyền của 5 nhóm vai trò (Khách hàng, Nhân viên, Quản lý, Kinh doanh, Quản trị viên) về cấu hình chuẩn ban đầu không? Mọi tùy biến trước đó sẽ được thiết lập lại.
                </p>
                <div className="flex justify-end gap-2.5 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetModal(false)}
                    className="cursor-pointer"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleResetDefaultPermissions}
                    className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                  >
                    Xác nhận khôi phục
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOGIN HISTORY ─────────────────────────────────────── */}
      {page === 'login-history' && (
        <div className="fade-in space-y-5">
          <SectionHeader
            title="Lịch Sử Đăng Nhập Hệ Thống"
            subtitle="Lịch sử xác thực, phiên đang mở và cảnh báo bất thường được lưu từ StorageHubContext"
          />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Tabs
              tabs={['Tất cả', 'Thành công', 'Thất bại']}
              active={historyTab}
              onChange={val => setHistoryTab(val)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 lg:ml-auto">
              <span className="font-medium">Tài khoản</span>
              <select value={historyUserFilter} onChange={event => setHistoryUserFilter(event.target.value)} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm focus:border-amber-500 focus:outline-none">
                <option value="all">Tất cả tài khoản</option>
                {USERS.map(account => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}
              </select>
            </label>
          </div>
          {securityAlerts.filter(alert => !alert.resolvedAt).length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <span aria-hidden="true">⚠</span>
              <span>Phát hiện {securityAlerts.filter(alert => !alert.resolvedAt).length} cảnh báo an ninh chưa xử lý. Hãy kiểm tra các lần đăng nhập thất bại hoặc thiết bị mới.</span>
            </div>
          )}
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>Người Dùng</Th>
                  <Th>Vai Trò</Th>
                  <Th>Địa Chỉ IP</Th>
                  <Th>Vị Trí</Th>
                  <Th>Thiết Bị</Th>
                  <Th>Thời Gian</Th>
                  <Th>Trạng Thái</Th>
                </tr>
              </Thead>
              <Tbody>
                {loginHistory
                  .filter(l => {
                    if (historyTab === 'Tất cả') return true
                    if (historyTab === 'Thành công') return l.status === 'success'
                    if (historyTab === 'Thất bại') return l.status === 'failed'
                    return false
                  })
                  .filter(l => historyUserFilter === 'all' || l.userId === historyUserFilter || (!l.userId && USERS.find(account => account.email === l.email)?.id === historyUserFilter))
                  .map(l => (
                    <Tr key={l.id} className={l.status === 'failed' || l.suspicious ? 'bg-red-50' : ''}>
                      <Td>
                        <div>
                          <p className="font-medium text-sm text-slate-800">{l.user}</p>
                          <p className="text-xs text-slate-400">{l.email}</p>
                        </div>
                      </Td>
                      <Td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[l.role as Role] ?? 'bg-slate-100 text-slate-600'}`}>{l.role ? roleLabels[l.role] : 'Chưa xác định'}</span>
                      </Td>
                      <Td><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{l.ip}</code></Td>
                      <Td className="text-sm text-slate-500">{l.location}</Td>
                      <Td className="text-xs text-slate-400">{l.device}</Td>
                      <Td className="text-xs text-slate-500">{l.timestamp}</Td>
                      <Td>
                        {l.status === 'failed'
                          ? <Badge variant="error">{l.suspicious ? 'Khả nghi' : 'Thất bại'}</Badge>
                          : l.status === 'logout' ? <Badge variant="muted">Đã đăng xuất</Badge> : <Badge variant="success">Thành công</Badge>}
                      </Td>
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </Card>
          <Card>
            <div className="flex flex-col gap-2 border-b border-stone-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-stone-900">Phiên đăng nhập</h3>
                <p className="text-xs text-stone-500">Chỉ phiên đang hoạt động mới có thể bị thu hồi.</p>
              </div>
              <span className="text-sm text-stone-500">{sessions.filter(session => session.status === 'active').length} phiên đang mở</span>
            </div>
            <Table>
              <Thead><tr><Th>Tài khoản</Th><Th>Thiết bị</Th><Th>Vị trí</Th><Th>Bắt đầu</Th><Th>Trạng thái</Th><Th /></tr></Thead>
              <Tbody>
                {sessions
                  .filter(session => historyUserFilter === 'all' || session.userId === historyUserFilter)
                  .map(session => (
                    <Tr key={session.id}>
                      <Td><p className="font-medium text-sm text-slate-800">{session.userName}</p><p className="text-xs text-slate-400">{session.email}</p></Td>
                      <Td className="text-xs text-slate-500">{session.device}</Td>
                      <Td className="text-xs text-slate-500">{session.location}</Td>
                      <Td className="text-xs text-slate-500">{session.createdAt}</Td>
                      <Td>{session.status === 'active' ? <Badge variant="success">Đang hoạt động</Badge> : session.status === 'revoked' ? <Badge variant="error">Đã thu hồi</Badge> : <Badge variant="muted">Đã đăng xuất</Badge>}</Td>
                      <Td className="text-right">{session.status === 'active' && can(user, 'manage_users') && <Button variant="outline" size="sm" onClick={() => {
                        try {
                          const count = revokeAllUserSessions(session.userId, user)
                          showToast(count > 0 ? `Đã đăng xuất ${count} phiên của ${session.email}.` : 'Tài khoản này không còn phiên đang hoạt động.')
                        } catch (error) {
                          showToast(error instanceof Error ? error.message : 'Không thể thu hồi phiên.')
                        }
                      }}>Đăng xuất mọi thiết bị</Button>}</Td>
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── ACTIVITY LOGS ─────────────────────────────────────── */}
      {page === 'activity' && (() => {
        const combinedLogs: AuditActivityLog[] = [
          ...activities.map(act => ({
            id: act.id,
            user: act.actorName,
            actor: act.actorName,
            role: act.actorRole,
            action: act.notes || act.action,
            target: `${act.entityType.toUpperCase()} · ${act.entityId}`,
            time: 'Gần đây',
            timestamp: act.timestamp,
            type: 'info' as const,
            severity: 'info' as const,
            category: (act.entityType === 'rental' || act.entityType === 'hold' ? 'rental' : act.entityType === 'payment' ? 'billing' : 'security') as any,
            ip: '192.168.1.25',
            device: 'StorageHub Client',
            details: {
              actionType: act.action,
              before: act.beforeState,
              after: act.afterState,
              evidence: act.evidence
            }
          })),
          ...logsList
        ]

        const securityAlerts = combinedLogs.filter(l => l.category === 'security').length
        const errorCount = combinedLogs.filter(l => l.severity === 'error').length
        const adminActions = combinedLogs.filter(l => l.role === 'admin' || l.category === 'admin').length

        const filteredLogs = combinedLogs.filter(l => {
          const matchTab = logTab === 'Tất cả' || (
            logTab === 'An ninh' ? l.category === 'security' :
            logTab === 'Thuê kho' ? l.category === 'rental' :
            logTab === 'Thanh toán' ? l.category === 'billing' :
            logTab === 'Bảng giá' ? l.category === 'pricing' :
            logTab === 'Ra vào' ? l.category === 'access' :
            l.category === logTab.toLowerCase()
          )
          const query = logSearch.toLowerCase().trim()
          const matchSearch =
            !query ||
            l.actor.toLowerCase().includes(query) ||
            l.action.toLowerCase().includes(query) ||
            l.target.toLowerCase().includes(query) ||
            l.ip.includes(query)
          const matchUser = historyUserFilter === 'all'
            || activities.some(activity => activity.id === l.id && activity.actorId === historyUserFilter)
            || USERS.some(account => account.id === historyUserFilter && (account.name === l.actor || account.email === l.actor))
          return matchTab && matchSearch && matchUser
        })

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title="Nhật Ký Hoạt Động & Giám Sát Hệ Thống"
              subtitle="Dòng thời gian ghi nhận các thao tác người dùng, cảnh báo an ninh và thay đổi dữ liệu quản trị"
              action={
                <Button variant="outline" size="sm" disabled>
                  Chưa kết nối xuất file
                </Button>
              }
            />

            {/* Audit Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Sự Kiện Hôm Nay"
                value={logsList.length}
                delta="+14 sự kiện so với hôm qua"
                deltaPositive
                icon={Icon.log}
                iconBg="bg-blue-50 text-blue-700"
              />
              <StatCard
                title="Ngoại Lệ An Ninh"
                value={errorCount}
                delta={errorCount > 0 ? 'Cần kiểm tra ngay' : 'Hệ thống an toàn'}
                deltaPositive={errorCount === 0}
                icon={Icon.shield}
                iconBg={errorCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}
              />
              <StatCard
                title="Thao Tác Quản Trị"
                value={adminActions}
                delta="Cập nhật tài khoản & chính sách"
                icon={Icon.cog}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title="Lượt Truy Cập Cửa/Cổng"
                value={logsList.filter(l => l.category === 'access' || l.category === 'security').length}
                delta="Bộ điều khiển phần cứng ổn định"
                deltaPositive
                icon={Icon.key}
                iconBg="bg-purple-50 text-purple-700"
              />
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Tabs
                tabs={['Tất cả', 'An ninh', 'Thuê kho', 'Thanh toán', 'Bảng giá', 'Ra vào']}
                active={logTab}
                onChange={val => setLogTab(val)}
              />
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Tìm người dùng, thao tác, đối tượng, IP..."
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <select value={historyUserFilter} onChange={event => setHistoryUserFilter(event.target.value)} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm focus:border-amber-500 focus:outline-none">
                <option value="all">Tất cả tài khoản</option>
                {USERS.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>

            {/* Audit Log Stream */}
            <Card className="divide-y divide-stone-100 overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="p-10 text-center text-stone-400">
                  <p className="font-semibold text-stone-700">Chưa ghi nhận sự kiện hoạt động nào</p>
                  <p className="text-xs mt-1">Không tìm thấy mục nhật ký nào phù hợp với bộ lọc này.</p>
                </div>
              ) : (
                filteredLogs.map(l => (
                  <div
                    key={l.id}
                    className="p-4 hover:bg-[#fbfaf6] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                          l.severity === 'error'
                            ? 'bg-red-500 ring-4 ring-red-100'
                            : l.severity === 'warning'
                            ? 'bg-amber-500 ring-4 ring-amber-100'
                            : 'bg-blue-500 ring-4 ring-blue-100'
                        }`}
                      />
                      <Avatar name={l.actor} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-stone-900">{l.actor}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-semibold ${roleColors[l.role as Role] ?? 'bg-stone-100 text-stone-700'}`}>
                            {l.role}
                          </span>
                          <span className="text-xs text-stone-400">•</span>
                          <span className="text-xs text-stone-600 font-medium">{l.action}</span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Đối tượng: <strong className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">{l.target}</strong>
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-1 font-mono">
                          <span>IP: {l.ip}</span>
                          <span>•</span>
                          <span>{l.device}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-stone-600 font-medium">{l.time}</p>
                        <span className="text-[10px] text-stone-400 font-mono">{l.timestamp}</span>
                      </div>
                      <Badge variant={l.severity === 'error' ? 'error' : l.severity === 'warning' ? 'warning' : 'info'}>
                        {l.category}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(l)
                          setLogModalOpen(true)
                        }}
                      >
                        Chi Tiết
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        )
      })()}

      {/* ── SYSTEM SETTINGS ───────────────────────────────────── */}
      {page === 'settings' && (() => {
        const filteredGroups = activeSettingsTab === 'Tất cả danh mục'
          ? SETTINGS_GROUPS
          : SETTINGS_GROUPS.filter(g => {
              return (
                (activeSettingsTab === 'Cơ sở kho' && g.group === 'Facility Defaults') ||
                (activeSettingsTab === 'Thanh toán' && g.group === 'Billing & Delinquency') ||
                (activeSettingsTab === 'Bảo mật' && g.group === 'Security & Access') ||
                (activeSettingsTab === 'Thông báo' && g.group === 'Automated Notifications') ||
                (activeSettingsTab === 'Bảo trì' && g.group === 'System & Maintenance') ||
                g.group.toLowerCase().includes(activeSettingsTab.toLowerCase().slice(0, 4))
              )
            })

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title="Cấu Hình Hệ Thống & Cơ Sở Kho"
              subtitle="Tinh chỉnh các ngưỡng vận hành, thời gian ân hạn công nợ, quy tắc an ninh và thông báo tự động"
              action={
                <Button variant="outline" size="sm" disabled>
                  Chỉ xem · Chưa kết nối backend
                </Button>
              }
            />

            {/* Category Tabs */}
            <Tabs
              tabs={['Tất cả danh mục', 'Cơ sở kho', 'Thanh toán', 'Bảo mật', 'Thông báo', 'Bảo trì']}
              active={activeSettingsTab}
              onChange={val => setActiveSettingsTab(val)}
            />

            {/* Settings Cards */}
            <div className="space-y-5">
              {filteredGroups.map(group => (
                <Card key={group.group} className="p-6">
                  <div className="pb-3 mb-5 border-b border-stone-100 flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-stone-900 text-base">{group.group}</h3>
                      {group.description && (
                        <p className="text-xs text-stone-500 mt-0.5">{group.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ĐANG ÁP DỤNG
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {group.items.map(item => (
                      <div key={item.id} className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700 block">
                          {item.label}
                        </label>
                        {item.type === 'toggle' ? (
                          <label className="flex items-center gap-3 p-2.5 rounded-lg border border-stone-200 bg-[#fbfaf6] cursor-pointer hover:bg-white transition">
                            <input
                              type="checkbox"
                              defaultChecked={Boolean(item.value)}
                              disabled
                              className="w-4 h-4 text-amber-600 rounded cursor-not-allowed"
                            />
                            <span className="text-xs text-stone-600 font-medium">
                              Bật / Tự động áp dụng thiết lập này
                            </span>
                          </label>
                        ) : item.type === 'select' ? (
                          <select
                            defaultValue={item.value as string}
                            disabled
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs bg-stone-100 text-stone-500 focus:outline-none"
                          >
                            {item.options ? item.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            )) : (
                              <option value={item.value as string}>{item.value as string}</option>
                            )}
                          </select>
                        ) : item.type === 'number' ? (
                          <input
                            type="number"
                            defaultValue={item.value as number}
                            disabled
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-500 bg-stone-100 focus:outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            defaultValue={item.value as string}
                            disabled
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-500 bg-stone-100 focus:outline-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end pt-2 text-xs text-stone-500">
              Cấu hình đang ở chế độ chỉ xem; cần kết nối backend trước khi cho phép lưu thay đổi.
            </div>
          </div>
        )
      })()}

      {/* ── PROFILE PAGE ─────────────────────────────────────── */}
      {page === 'profile' && (
        <div className="fade-in">
          <ProfileView user={user} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#292a27] text-white px-5 py-3 rounded-lg shadow-2xl border border-amber-500/50 flex items-center gap-3 fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e9a12c] animate-ping" />
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}

      {/* ── USER MODAL ────────────────────────────────────────── */}
      <Modal
        open={userModal}
        onClose={() => setUserModal(false)}
        title={
          selectedUser
            ? `Chỉnh Sửa Người Dùng – ${selectedUser.name}`
            : accountMode === 'customer-support'
              ? 'Tạo khách hàng theo yêu cầu hỗ trợ'
              : 'Tạo tài khoản nội bộ'
        }
      >
        <div className="space-y-4">
          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Avatar name={selectedUser.name} size="lg" />
              <div>
                <p className="font-semibold text-slate-800">{selectedUser.name}</p>
                <p className="text-xs text-slate-400">
                  {selectedUser.id} · Tham gia {selectedUser.joined ?? 'Gần đây'}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Họ và Tên" value={accountForm.name} onChange={event => setAccountForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Jane Smith" />
            <Input label="Email" type="email" value={accountForm.email} onChange={event => setAccountForm(prev => ({ ...prev, email: event.target.value }))} placeholder="jane@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Vai Trò" value={selectedUser?.role === 'customer' ? 'customer' : accountForm.role} disabled={selectedUser?.role === 'customer'} onChange={event => setAccountForm(prev => ({ ...prev, role: event.target.value as Exclude<Role, 'customer'> }))}>
              {selectedUser?.role === 'customer' && <option value="customer">Khách hàng</option>}
              <option value="staff">Nhân viên</option>
              <option value="manager">Quản lý cơ sở</option>
              <option value="business">Giám đốc kinh doanh</option>
              <option value="admin">Quản trị viên</option>
            </Select>
            <Select label="Trạng Thái" value={accountForm.status} onChange={event => setAccountForm(prev => ({ ...prev, status: event.target.value as 'active' | 'inactive' | 'suspended' }))}>
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
              <option value="suspended">Đình chỉ</option>
            </Select>
          </div>
          <Input label="Số điện thoại" value={accountForm.phone} onChange={event => setAccountForm(prev => ({ ...prev, phone: event.target.value }))} placeholder="0901 234 567" />
          <Select label="Cơ sở kho" value={accountForm.facility} onChange={event => setAccountForm(prev => ({ ...prev, facility: event.target.value }))}>
            <option value="">Chưa gán cơ sở</option>
            <option value="All facilities">Tất cả cơ sở</option>
            {facilities.map(facility => <option key={facility.id} value={facility.name}>{facility.name}</option>)}
          </Select>
          {!selectedUser && accountMode === 'customer-support' && <Input label="Lý do hỗ trợ (bắt buộc)" value={accountForm.reason} onChange={event => setAccountForm(prev => ({ ...prev, reason: event.target.value }))} placeholder="Ví dụ: hỗ trợ khách không thể tự đăng ký" />}
          {selectedUser && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span>Mật khẩu: {selectedUser.mustChangePassword ? 'Bắt buộc đổi sau reset/cấp mới' : 'Đang hoạt động'}</span>
            <Button variant="outline" size="sm" onClick={() => {
              try {
                requestUserPasswordReset(selectedUser.id, user)
                showToast('Đã tạo yêu cầu reset mật khẩu và ghi audit log.')
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Không thể reset mật khẩu.')
              }
            }}>Tạo yêu cầu reset</Button>
          </div>}
          <div className="flex gap-2 justify-end pt-2">
            {selectedUser && selectedUser.id !== user.id && <Button variant="outline" onClick={() => {
              if (!window.confirm('Xóa tài khoản này khỏi hệ thống?')) return
              try {
                deleteUserAccount(selectedUser.id, user)
                setUserModal(false)
                showToast('Đã xóa tài khoản và ghi audit log.')
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Không thể xóa tài khoản.')
              }
            }}>Xóa tài khoản</Button>}
            <Button variant="outline" onClick={() => setUserModal(false)}>Hủy Bỏ</Button>
            <Button variant="primary" onClick={handleAccountSubmit}>{selectedUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</Button>
          </div>
        </div>
      </Modal>

      {/* Audit Log JSON Inspector Modal */}
      <Modal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Chi Tiết & Siêu Dữ Liệu Sự Kiện Kiểm Toán"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[#292a27] text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>MÃ SỰ KIỆN: {selectedLog.id}</span>
                <span className="uppercase">{selectedLog.category}</span>
              </div>
              <p className="font-bold text-stone-100 text-sm mt-1">{selectedLog.action}</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {selectedLog.timestamp} · Người thực hiện: {selectedLog.actor} ({selectedLog.role})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">Địa Chỉ IP Nguồn</span>
                <code className="font-mono text-stone-800 font-bold">{selectedLog.ip}</code>
              </div>
              <div>
                <span className="text-stone-400 block">Thiết Bị / Trình Duyệt</span>
                <span className="text-stone-800 font-medium truncate block">{selectedLog.device}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700">
                Dữ Liệu Thay Đổi (Payload JSON)
              </label>
              <pre className="p-3 bg-[#1e1f1d] text-emerald-300 font-mono text-xs rounded-lg overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <Button variant="outline" onClick={() => setLogModalOpen(false)}>
                Đóng Cửa Sổ
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
