import { useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PasswordField,
  SectionHeader,
  Select,
  StatCard,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '../../components/ui'
import type { Role, User } from '../../types'
import {
  createAdminUser,
  listAdminFacilities,
  listAdminLoginHistory,
  listAdminSessions,
  listAdminUsers,
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
import { roleColors, roleLabels, LockIcon, type AdminToast } from './adminPanelTypes'
import { getPasswordValidationError, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_HINT } from '../../utils/passwordPolicy'

type AccountStatus = 'active' | 'inactive' | 'suspended' | 'locked'
type FormRole = Exclude<Role, 'customer'>
type AccountMode = 'internal' | 'customer-support'
type AudienceTab = 'Tất cả' | 'Nhân sự nội bộ' | 'Khách hàng'

interface UserForm {
  name: string
  email: string
  phone: string
  role: FormRole
  facilityId: string
  scopeLevel: ApiFacilityScopeLevel
  status: AccountStatus
  password: string
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  phone: '',
  role: 'staff',
  facilityId: '',
  scopeLevel: 'OPERATE',
  status: 'active',
  password: '',
}

const toApiRole = (role: FormRole): ApiRoleCode => role.toUpperCase() as ApiRoleCode
const toApiStatus = (status: AccountStatus): ApiUserStatus =>
  status === 'active' ? 'ACTIVE' : status === 'suspended' ? 'SUSPENDED' : status === 'locked' ? 'LOCKED' : 'INACTIVE'
const toUiStatus = (status: ApiUserStatus): AccountStatus =>
  status === 'ACTIVE' ? 'active' : status === 'SUSPENDED' ? 'suspended' : status === 'LOCKED' ? 'locked' : 'inactive'

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Chưa đăng nhập'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Chưa đăng nhập'
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 0 || diffSec < 60) return 'Vừa xong'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`
  if (diffSec < 86400 * 2) {
    const hours = date.getHours().toString().padStart(2, '0')
    const mins = date.getMinutes().toString().padStart(2, '0')
    return `Hôm qua lúc ${hours}:${mins}`
  }
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ngày trước`
  return date.toLocaleDateString('vi-VN')
}

function statusBadge(status: AccountStatus) {
  const variants: Record<AccountStatus, 'success' | 'muted' | 'error'> = {
    active: 'success',
    inactive: 'muted',
    suspended: 'error',
    locked: 'error',
  }
  const labels: Record<AccountStatus, string> = {
    active: 'Đang hoạt động',
    inactive: 'Ngưng hoạt động',
    suspended: 'Tạm khóa',
    locked: 'Đã khóa',
  }
  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

export default function AdminUsersApiPanel({ user, showToast }: { user: User; showToast: AdminToast }) {
  const [accounts, setAccounts] = useState<AdminApiUser[]>([])
  const [allUsersList, setAllUsersList] = useState<AdminApiUser[]>([])
  const [facilities, setFacilities] = useState<AdminApiFacility[]>([])
  const [lastLoginMap, setLastLoginMap] = useState<Record<string, string>>({})

  // Pagination states
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Segment Tab: 'Tất cả' | 'Nhân sự nội bộ' | 'Khách hàng'
  const [audienceTab, setAudienceTab] = useState<AudienceTab>('Tất cả')

  // Dropdown Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [facilityFilter, setFacilityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals & Selections
  const [selected, setSelected] = useState<AdminApiUser | null>(null)
  const [mode, setMode] = useState<AccountMode>('internal')
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmStatusModal, setConfirmStatusModal] = useState<AdminApiUser | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Load last seen and summary stats
  useEffect(() => {
    // 1. Fetch sessions & login history to build last login timestamps
    Promise.allSettled([
      listAdminSessions({ page: 0, size: 100 }),
      listAdminLoginHistory({ page: 0, size: 100 }),
      listAdminUsers({ page: 0, size: 100 }),
    ]).then(([sessRes, histRes, allUsersRes]) => {
      const map: Record<string, string> = {}

      // From API sessions
      if (sessRes.status === 'fulfilled' && sessRes.value?.data) {
        sessRes.value.data.forEach(s => {
          const t = s.lastSeenAt || s.createdAt
          if (s.email) map[s.email.toLowerCase()] = t
          if (s.userId) map[s.userId] = t
        })
      }

      // From API login history
      if (histRes.status === 'fulfilled' && histRes.value?.data) {
        histRes.value.data.forEach(h => {
          if (h.email && (!map[h.email.toLowerCase()] || new Date(h.occurredAt) > new Date(map[h.email.toLowerCase()]))) {
            map[h.email.toLowerCase()] = h.occurredAt
          }
          if (h.userId && (!map[h.userId] || new Date(h.occurredAt) > new Date(map[h.userId]))) {
            map[h.userId] = h.occurredAt
          }
        })
      }

      setLastLoginMap(map)

      if (allUsersRes.status === 'fulfilled' && allUsersRes.value?.data) {
        setAllUsersList(allUsersRes.value.data)
      }
    })
  }, [refreshKey])

  // Derive active role query param based on tab and role dropdown
  const computedRoleParam = useMemo((): ApiRoleCode | undefined => {
    if (audienceTab === 'Khách hàng') return 'CUSTOMER'
    if (roleFilter !== 'all') return toApiRole(roleFilter as FormRole)
    return undefined
  }, [audienceTab, roleFilter])

  // Reset page when any filter changes
  useEffect(() => {
    setPage(0)
  }, [audienceTab, search, roleFilter, facilityFilter, statusFilter, pageSize])

  // Fetch paginated user accounts
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const statusParam = statusFilter !== 'all' ? toApiStatus(statusFilter as AccountStatus) : undefined

    Promise.all([
      listAdminUsers({
        page,
        size: pageSize,
        search: search.trim() || undefined,
        role: computedRoleParam,
        status: statusParam,
        facilityId: facilityFilter !== 'all' ? facilityFilter : undefined,
      }),
      facilities.length ? Promise.resolve(null) : listAdminFacilities(),
    ])
      .then(([userPage, facilityPage]) => {
        if (cancelled) return

        let data = userPage.data
        // If audienceTab is 'Nhân sự nội bộ' and no specific role is chosen, exclude CUSTOMER accounts
        if (audienceTab === 'Nhân sự nội bộ') {
          data = data.filter(acc => acc.roles.some(r => r !== 'CUSTOMER'))
        }

        setAccounts(data)
        setTotalItems(userPage.pagination.totalItems)
        setTotalPages(userPage.pagination.totalPages)
        if (facilityPage) setFacilities(facilityPage.data)
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách tài khoản.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page, pageSize, computedRoleParam, statusFilter, facilityFilter, search, refreshKey, audienceTab])

  // 4 Actionable KPI Metrics
  const stats = useMemo(() => {
    const list = allUsersList.length ? allUsersList : accounts
    const total = allUsersList.length ? allUsersList.length : totalItems
    const internal = list.filter(u => u.roles.some(r => r !== 'CUSTOMER')).length
    const customers = list.filter(u => u.roles.includes('CUSTOMER') && !u.roles.some(r => r !== 'CUSTOMER')).length
    const suspended = list.filter(u => u.status === 'SUSPENDED' || u.status === 'LOCKED' || u.status === 'INACTIVE').length

    return {
      total: total || list.length,
      internal,
      customers,
      suspended,
    }
  }, [allUsersList, accounts, totalItems, audienceTab])

  const facilityName = (id: string) => facilities.find(facility => facility.id === id)?.name ?? id
  const selectedRole = selected ? primaryRole(selected.roles) : null
  const hasFacilityRole = mode === 'internal' && selectedRole !== 'customer' && (form.role === 'staff' || form.role === 'manager')
  const scopesForForm = hasFacilityRole && form.facilityId ? { [form.facilityId]: form.scopeLevel } : {}

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
    if (account.roles.includes('ADMIN')) {
      showToast('Tài khoản quản trị viên được bảo vệ và không thể chỉnh sửa.')
      return
    }
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
    setAccounts(previous => previous.map(account => (account.id === next.id ? next : account)))
    setAllUsersList(previous => previous.map(account => (account.id === next.id ? next : account)))
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
    const role = mode === 'customer-support' ? (['CUSTOMER'] as ApiRoleCode[]) : [toApiRole(form.role)]
    const created = await createAdminUser({
      email: form.email.trim(),
      password: form.password,
      fullName: form.name.trim(),
      phone: form.phone.trim() || undefined,
      roles: role,
      facilityScopes: mode === 'customer-support' ? {} : scopesForForm,
    })
    setAccounts(previous => [created, ...previous])
    setAllUsersList(previous => [created, ...previous])
    setTotalItems(value => value + 1)
    showToast(
      mode === 'customer-support'
        ? `Đã tạo hộ tài khoản khách cho ${created.fullName}.`
        : `Đã tạo tài khoản nội bộ cho ${created.fullName}.`
    )
  }

  const saveExisting = async () => {
    if (!selected || selected.roles.includes('ADMIN')) {
      showToast('Tài khoản quản trị viên được bảo vệ và không thể chỉnh sửa.')
      return
    }
    const updated = toUiStatus(selected.status) === form.status
      ? selected
      : await updateAdminUserStatus(selected.id, toApiStatus(form.status))
    replaceAccount(updated)
    showToast(toUiStatus(selected.status) === form.status ? 'Chưa có thay đổi trạng thái.' : 'Đã cập nhật trạng thái tài khoản.')
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

  const handleConfirmStatusToggle = async () => {
    if (!confirmStatusModal) return
    if (confirmStatusModal.roles.includes('ADMIN')) {
      showToast('Tài khoản quản trị viên được bảo vệ và không thể đổi trạng thái.')
      setConfirmStatusModal(null)
      return
    }
    try {
      setStatusUpdating(true)
      const nextStatus = confirmStatusModal.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
      const updated = await updateAdminUserStatus(confirmStatusModal.id, nextStatus)
      replaceAccount(updated)
      showToast(
        nextStatus === 'ACTIVE'
          ? `Đã mở khóa tài khoản ${confirmStatusModal.fullName}.`
          : `Đã tạm khóa tài khoản ${confirmStatusModal.fullName}.`
      )
      setConfirmStatusModal(null)
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Không thể cập nhật trạng thái.')
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div className="fade-in w-full space-y-6">
      {/* ── Section Header & Primary Actions ─────────────────────────────── */}
      <SectionHeader
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Quản lý tài khoản người dùng"
        subtitle={`Theo dõi, phân quyền và quản lý tài khoản người dùng · Hiện có ${totalItems} tài khoản`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {/* Primary Action Button: Tạo hộ tài khoản khách (thường dùng nhất) */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCreate('customer-support')}
              className="h-9 gap-2 shadow-sm font-semibold"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Tạo hộ tài khoản khách</span>
            </Button>

            {/* Secondary Action Button: Tạo tài khoản nội bộ */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreate('internal')}
              className="h-9 gap-2 shadow-sm"
            >
              <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Tạo tài khoản nội bộ</span>
            </Button>
          </div>
        }
      />

      {/* ── 4 Meaningful Management KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng tài khoản */}
        <StatCard
          title="Tổng tài khoản"
          value={stats.total}
          delta="Toàn bộ hệ thống"
          deltaPositive
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          }
        />

        {/* Card 2: Nhân sự nội bộ */}
        <StatCard
          title="Nhân sự nội bộ"
          value={stats.internal}
          delta="Admin, Quản lý, Staff"
          deltaPositive
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          }
        />

        {/* Card 3: Khách hàng */}
        <StatCard
          title="Khách hàng"
          value={stats.customers}
          delta="Người thuê kho"
          deltaPositive
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          }
        />

        {/* Card 4: Đang bị khóa / Tạm ngưng */}
        <StatCard
          title="Tạm khóa / Ngưng"
          value={stats.suspended}
          delta={stats.suspended > 0 ? 'Cần xem xét an ninh' : 'Tất cả bình thường'}
          deltaPositive={stats.suspended === 0}
          icon={
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
                stats.suspended > 0
                  ? 'bg-red-50 text-red-600 ring-red-200'
                  : 'bg-stone-100 text-stone-500 ring-stone-200'
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          }
        />
      </div>

      {/* ── Segment Tabs: [Tất cả] [Nhân sự nội bộ] [Khách hàng] ───────────── */}
      <div className="flex border-b border-stone-200">
        <Tabs
          tabs={['Tất cả', 'Nhân sự nội bộ', 'Khách hàng']}
          active={audienceTab}
          onChange={t => {
            setAudienceTab(t as AudienceTab)
            setRoleFilter('all') // Reset role sub-filter to prevent conflict
          }}
        />
      </div>

      {/* ── Clean Filter Toolbar (No Conflict) ────────────────────────────── */}
      <Card className="border border-stone-200 p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Search */}
          <Input
            label="Tìm kiếm tài khoản"
            aria-label="Tìm tài khoản"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email hoặc SĐT…"
            className="h-10"
          />

          {/* Role Filter (Contextual based on selected tab) */}
          {audienceTab === 'Khách hàng' ? (
            <div className="space-y-1">
              <span className="text-sm font-medium text-stone-700">Vai trò</span>
              <div className="flex h-10 items-center rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-600">
                Khách hàng thuê kho
              </div>
            </div>
          ) : audienceTab === 'Nhân sự nội bộ' ? (
            <Select
              label="Vai trò nội bộ"
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value)}
              className="h-10"
            >
              <option value="all">Tất cả nhân sự</option>
              <option value="staff">Chuyên viên vận hành (Staff)</option>
              <option value="manager">Giám đốc cơ sở (Manager)</option>
              <option value="business">Đối tác kinh doanh (Business)</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </Select>
          ) : (
            <Select
              label="Tất cả vai trò"
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value)}
              className="h-10"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="customer">Khách hàng</option>
              <option value="staff">Nhân viên</option>
              <option value="manager">Quản lý</option>
              <option value="business">Kinh doanh</option>
              <option value="admin">Quản trị viên</option>
            </Select>
          )}

          {/* Facility Filter */}
          <Select
            label="Cơ sở trực thuộc"
            value={facilityFilter}
            onChange={event => setFacilityFilter(event.target.value)}
            className="h-10"
          >
            <option value="all">Tất cả cơ sở</option>
            {facilities.map(facility => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </Select>

          {/* Status Filter */}
          <Select
            label="Trạng thái"
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="h-10"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="suspended">Tạm khóa / Đình chỉ</option>
            <option value="inactive">Ngưng hoạt động</option>
          </Select>
        </div>

        {/* Reset filter pill if any filter active */}
        {(search || roleFilter !== 'all' || facilityFilter !== 'all' || statusFilter !== 'all') && (
          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
            <span className="text-stone-500">
              Đang áp dụng bộ lọc tùy chỉnh cho phân khúc: <strong>{audienceTab}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setRoleFilter('all')
                setFacilityFilter('all')
                setStatusFilter('all')
              }}
              className="text-[#855306] font-semibold hover:underline"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </Card>

      {/* Error alert */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(v => v + 1)}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
          Đang tải danh sách tài khoản người dùng…
        </div>
      )}

      {/* ── Main Data Table ──────────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-stone-200 shadow-sm">
        <Table className="min-w-[1080px]">
          <Thead>
            <tr>
              <Th className="min-w-[210px]">Người Dùng</Th>
              <Th>Vai Trò</Th>
              <Th className="min-w-[180px]">Cơ Sở Trực Thuộc</Th>
              <Th>Trạng Thái</Th>
              <Th className="min-w-[160px]">Đăng Nhập Cuối</Th>
              <Th>Ngày Tạo</Th>
              <Th className="text-right min-w-[140px]">Thao Tác</Th>
            </tr>
          </Thead>
          <Tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-stone-400">
                  Không tìm thấy tài khoản người dùng nào phù hợp.
                </td>
              </tr>
            ) : (
              accounts.map(account => {
                const role = primaryRole(account.roles)
                const status = toUiStatus(account.status)
                const scopeIds = Object.keys(account.facilityScopes)
                const protectedAdmin = account.roles.includes('ADMIN')

                // Friendly Last Login calculation
                const lastLoginIso =
                  lastLoginMap[account.email?.toLowerCase()] ||
                  lastLoginMap[account.id] ||
                  null
                const relativeLastLogin = formatRelativeTime(lastLoginIso)

                return (
                  <Tr
                    key={account.id}
                    onClick={() => openEdit(account)}
                    className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                  >
                    {/* User */}
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={account.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-900">{account.fullName}</p>
                          <p className="truncate text-xs text-stone-400">{account.email}</p>
                        </div>
                      </div>
                    </Td>

                    {/* Role */}
                    <Td>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleColors[role]}`}>
                        {roleLabels[role]}
                      </span>
                    </Td>

                    {/* Facility (Accurate Business Logic) */}
                    <Td>
                      {role === 'customer' ? (
                        <span className="text-xs text-stone-400">Toàn hệ thống</span>
                      ) : protectedAdmin || role === 'business' ? (
                        <span className="text-xs font-semibold text-stone-700">Toàn quốc (Tất cả cơ sở)</span>
                      ) : scopeIds.length > 0 ? (
                        <span className="text-xs font-medium text-stone-800">
                          {scopeIds.map(facilityName).join(', ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Chưa gán cơ sở
                        </span>
                      )}
                    </Td>

                    {/* Status */}
                    <Td>{statusBadge(status)}</Td>

                    {/* Friendly Last Login */}
                    <Td>
                      {lastLoginIso ? (
                        <span
                          className="text-xs font-medium text-stone-700 cursor-help"
                          title={`Thời điểm chính xác: ${new Date(lastLoginIso).toLocaleString('vi-VN')}`}
                        >
                          {relativeLastLogin}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Chưa đăng nhập</span>
                      )}
                    </Td>

                    {/* Created Date */}
                    <Td className="text-xs text-stone-500">{formatDate(account.createdAt)}</Td>

                    {/* Actions */}
                    <Td className="text-right">
                      <div className="flex justify-end items-center gap-1.5" onClick={event => event.stopPropagation()}>
                        {protectedAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-600">
                            <LockIcon className="w-3.5 h-3.5 text-stone-500" />
                            Được bảo vệ
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(account)}
                              className="h-8 px-2.5 text-xs text-stone-700 hover:bg-stone-100"
                            >
                              Sửa
                            </Button>

                            {account.id !== user.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmStatusModal(account)}
                                className={`h-8 px-2.5 text-xs ${
                                  status === 'active'
                                    ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                                }`}
                              >
                                {status === 'active' ? 'Khóa' : 'Mở khóa'}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })
            )}
          </Tbody>
        </Table>

        {/* ── Pagination Bar ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-3.5 text-xs text-stone-500">
          <p>
            Hiển thị{' '}
            <span className="font-semibold text-stone-800">
              {accounts.length === 0 ? 0 : page * pageSize + 1}
            </span>{' '}
            –{' '}
            <span className="font-semibold text-stone-800">
              {Math.min((page + 1) * pageSize, totalItems)}
            </span>{' '}
            trong tổng số <span className="font-semibold text-stone-800">{totalItems}</span> tài khoản
          </p>

          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            <span className="whitespace-nowrap">Dòng/trang:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="h-9 min-w-[6.5rem] shrink-0 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>

            <span className="ml-0 whitespace-nowrap sm:ml-2">
              Trang {page + 1} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(v => Math.max(0, v - 1))}
              className="h-8 px-2.5 text-xs"
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(v => v + 1)}
              className="h-8 px-2.5 text-xs"
            >
              Sau
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Modal: Thêm / Sửa Tài khoản ──────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          selected
            ? `Chỉnh Sửa Người Dùng – ${selected.fullName}`
            : mode === 'customer-support'
              ? 'Tạo hộ tài khoản khách thuê kho'
              : 'Tạo tài khoản nội bộ'
        }
        size="lg"
      >
        <div className="space-y-4">
          {selected && (
            <>
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3.5">
                <Avatar name={selected.fullName} size="lg" />
                <div>
                  <p className="font-semibold text-stone-800">{selected.fullName}</p>
                  <p className="text-xs text-stone-400">
                    ID: {selected.id} · Tham gia {formatDate(selected.createdAt)}
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Input
                label="Họ và Tên"
                value={form.name}
                onChange={event => setField('name', event.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={Boolean(selected)}
                className={selected ? 'cursor-not-allowed bg-stone-50 text-stone-500' : ''}
              />
              {fieldErrors.name && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
            <div>
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={event => setField('email', event.target.value)}
                placeholder="user@example.com"
                disabled={Boolean(selected)}
                className={selected ? 'cursor-not-allowed bg-stone-50 text-stone-500' : ''}
              />
              {fieldErrors.email && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mode === 'internal' ? (
              <Select
                label="Vai Trò Nội Bộ"
                value={selectedRole === 'customer' ? 'customer' : form.role}
                disabled={Boolean(selected) || selectedRole === 'customer'}
                className={selected ? 'cursor-not-allowed bg-stone-50 text-stone-500' : ''}
                onChange={event => setField('role', event.target.value as FormRole)}
              >
                {selectedRole === 'customer' && <option value="customer">Khách hàng</option>}
                <option value="staff">Chuyên viên vận hành (Staff)</option>
                <option value="manager">Quản lý cơ sở (Manager)</option>
                <option value="business">Giám đốc kinh doanh (Business)</option>
                <option value="admin">Quản trị viên (Admin)</option>
              </Select>
            ) : (
              <div className="space-y-1">
                <span className="text-sm font-medium text-stone-700">Vai Trò</span>
                <div className="flex h-[38px] items-center rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-600">
                  Khách hàng thuê kho (Customer)
                </div>
              </div>
            )}

            {selected ? (
              <Select
                label="Trạng Thái"
                value={form.status}
                onChange={event => setField('status', event.target.value as AccountStatus)}
              >
                <option value="active">Đang hoạt động</option>
                <option value="suspended">Tạm khóa / Đình chỉ</option>
                <option value="inactive">Ngưng hoạt động</option>
                <option value="locked">Đã khóa</option>
              </Select>
            ) : (
              <div className="space-y-1">
                <span className="text-sm font-medium text-stone-700">Trạng Thái Khởi Tạo</span>
                <div className="flex h-[38px] items-center rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-600">
                  Đang hoạt động
                </div>
              </div>
            )}
          </div>

          <Input
            label="Số điện thoại"
            value={form.phone}
            onChange={event => setField('phone', event.target.value)}
            placeholder="0901 234 567"
            disabled={Boolean(selected)}
            className={selected ? 'cursor-not-allowed bg-stone-50 text-stone-500' : ''}
          />

          {hasFacilityRole && !selected && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Cơ sở kho phụ trách"
                value={form.facilityId}
                onChange={event => setField('facilityId', event.target.value)}
              >
                <option value="">Chưa gán cơ sở</option>
                {facilities.map(facility => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Mức phân quyền tại cơ sở"
                value={form.scopeLevel}
                onChange={event => setField('scopeLevel', event.target.value as ApiFacilityScopeLevel)}
              >
                <option value="READ">Chỉ xem (Read-only)</option>
                <option value="OPERATE">Vận hành (Operate)</option>
                <option value="MANAGE">Quản lý toàn diện (Manage)</option>
              </Select>
            </div>
          )}

          {!selected && (
            <PasswordField
              id="admin-create-password"
              label="Mật khẩu khởi tạo"
              value={form.password}
              onChange={event => setField('password', event.target.value)}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              error={fieldErrors.password}
              helperText={PASSWORD_POLICY_HINT}
            />
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Hủy Bỏ
            </Button>
            <Button onClick={() => void save()}>
              {selected ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Xác nhận Khóa / Mở Khóa Tài Khoản (Bảo vệ an ninh) ───── */}
      <Modal
        open={Boolean(confirmStatusModal)}
        onClose={() => setConfirmStatusModal(null)}
        title={
          confirmStatusModal?.status === 'ACTIVE'
            ? 'Xác nhận tạm khóa tài khoản người dùng'
            : 'Xác nhận mở khóa tài khoản người dùng'
        }
      >
        {confirmStatusModal && (
          <div className="space-y-4">
            <div
              className={`rounded-xl border p-4 text-sm ${
                confirmStatusModal.status === 'ACTIVE'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              <p className="font-bold">
                {confirmStatusModal.status === 'ACTIVE'
                  ? '⚠️ Cảnh báo hành động tạm khóa tài khoản:'
                  : '✓ Thông báo mở khóa tài khoản:'}
              </p>
              <p className="mt-1">
                Bạn đang chuẩn bị {confirmStatusModal.status === 'ACTIVE' ? 'tạm khóa' : 'mở khóa'} tài khoản{' '}
                <strong>{confirmStatusModal.fullName}</strong> ({confirmStatusModal.email}).
              </p>
              {confirmStatusModal.status === 'ACTIVE' && (
                <p className="mt-2 text-xs text-red-700">
                  Khi bị tạm khóa, người dùng sẽ bị từ chối đăng nhập và toàn bộ các phiên làm việc đang mở sẽ bị đình chỉ hiệu lực ngay lập tức.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmStatusModal(null)}>
                Hủy bỏ
              </Button>
              <Button
                variant={confirmStatusModal.status === 'ACTIVE' ? 'danger' : 'primary'}
                disabled={statusUpdating}
                onClick={handleConfirmStatusToggle}
              >
                {statusUpdating
                  ? 'Đang thực hiện…'
                  : confirmStatusModal.status === 'ACTIVE'
                    ? 'Khóa tài khoản ngay'
                    : 'Mở khóa ngay'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
