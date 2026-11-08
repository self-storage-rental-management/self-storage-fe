import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, SectionHeader, StatCard, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { getAdminDashboard, type AdminApiDashboard } from '../../services/adminApi'
import type { ApiRoleCode } from '../../services/authApi'
import type { Role } from '../../types'
import { RefreshIcon, roleColors, roleLabels } from './adminPanelTypes'

const ROLE_ORDER: ApiRoleCode[] = ['ADMIN', 'BUSINESS', 'MANAGER', 'STAFF', 'CUSTOMER']

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

function toUiRole(role: ApiRoleCode): Role {
  return role.toLowerCase() as Role
}

function roleName(role: ApiRoleCode) {
  return roleLabels[toUiRole(role)]
}

export default function AdminDashboardApiPanel() {
  const [dashboard, setDashboard] = useState<AdminApiDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDashboard = (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    getAdminDashboard()
      .then(setDashboard)
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Không thể tải tổng quan toàn hệ thống.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    loadDashboard(true)
  }, [])

  const internalUsers = useMemo(() => {
    if (!dashboard) return 0
    return ROLE_ORDER.filter(role => role !== 'CUSTOMER')
      .reduce((total, role) => total + (dashboard.usersByRole[role] ?? 0), 0)
  }, [dashboard])

  if (loading && !dashboard) {
    return <div role="status" className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">Đang tải tổng quan toàn hệ thống…</div>
  }

  return <div className="fade-in space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <SectionHeader
        title="Tổng quan toàn hệ thống"
        subtitle="Theo dõi tài khoản, phân bổ vai trò và các sự kiện an ninh trên toàn bộ StorageHub."
      />
      <Button variant="outline" size="sm" onClick={() => loadDashboard()} disabled={refreshing}>
        <RefreshIcon />{refreshing ? 'Đang tải…' : 'Làm mới'}
      </Button>
    </div>

    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{error}</span>
      <Button variant="outline" size="sm" onClick={() => loadDashboard()} disabled={refreshing}>Thử lại</Button>
    </div>}

    {dashboard && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tổng tài khoản" value={dashboard.totalUsers.toLocaleString('vi-VN')} icon={null} />
        <StatCard title="Nhân sự nội bộ" value={internalUsers.toLocaleString('vi-VN')} icon={null} />
        <StatCard title="Tài khoản bị khóa" value={dashboard.lockedAccountsCount.toLocaleString('vi-VN')} icon={null} />
        <StatCard title="Tài khoản ngưng hoạt động" value={dashboard.disabledAccountsCount.toLocaleString('vi-VN')} icon={null} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-stone-200 bg-[#f8f7f1] px-5 py-4">
          <h2 className="font-semibold text-stone-900">Phân bổ tài khoản theo vai trò</h2>
          <p className="mt-1 text-sm text-stone-500">Số liệu được tổng hợp từ tài khoản thực tế trên toàn hệ thống.</p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {ROLE_ORDER.map(role => <div key={role} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${roleColors[toUiRole(role)]}`}>{roleName(role)}</span>
              <span className="text-xl font-bold text-stone-900">{(dashboard.usersByRole[role] ?? 0).toLocaleString('vi-VN')}</span>
            </div>
            <p className="mt-3 text-xs text-stone-500">{role === 'ADMIN' ? 'Quản trị toàn hệ thống' : role === 'CUSTOMER' ? 'Tài khoản khách hàng' : 'Tài khoản nội bộ'}</p>
          </div>)}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 bg-[#f8f7f1] px-5 py-4">
            <div><h2 className="font-semibold text-stone-900">Đăng nhập thất bại gần đây</h2><p className="mt-1 text-sm text-stone-500">Tối đa 5 sự kiện mới nhất.</p></div>
            <Badge variant="error">An ninh</Badge>
          </div>
          <Table>
            <Thead><Tr><Th>Tài khoản</Th><Th>Lý do</Th><Th>Thời điểm</Th></Tr></Thead>
            <Tbody>{dashboard.recentLoginFailures.length ? dashboard.recentLoginFailures.map(item => <Tr key={item.id}>
              <Td><span className="font-medium text-stone-800">{item.email}</span></Td>
              <Td>{item.failureReason || 'Đăng nhập thất bại'}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(item.occurredAt)}</Td>
            </Tr>) : <Tr><Td colSpan={3} className="py-8 text-center text-stone-500">Chưa có đăng nhập thất bại gần đây.</Td></Tr>}</Tbody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 bg-[#f8f7f1] px-5 py-4">
            <div><h2 className="font-semibold text-stone-900">Nhật ký an ninh gần đây</h2><p className="mt-1 text-sm text-stone-500">Các thay đổi tài khoản, phiên và phân quyền.</p></div>
            <Badge variant="info">Audit</Badge>
          </div>
          <Table>
            <Thead><Tr><Th>Sự kiện</Th><Th>Người thực hiện</Th><Th>Thời điểm</Th></Tr></Thead>
            <Tbody>{dashboard.recentSecurityEvents.length ? dashboard.recentSecurityEvents.map(item => <Tr key={item.id}>
              <Td><span className="font-medium text-stone-800">{item.action}</span><span className="mt-0.5 block text-xs text-stone-500">{item.entityType} · {item.entityId}</span></Td>
              <Td>{item.actorName}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(item.createdAt)}</Td>
            </Tr>) : <Tr><Td colSpan={3} className="py-8 text-center text-stone-500">Chưa có sự kiện an ninh gần đây.</Td></Tr>}</Tbody>
          </Table>
        </Card>
      </div>
    </>}
  </div>
}
