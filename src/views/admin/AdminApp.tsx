import { useState } from 'react'
import Layout, { getInitialPage, Icon } from '../../components/Layout'
import { Badge, Button, Card, StatCard, Table, Thead, Tbody, Th, Td, Tr, SectionHeader, Modal, Input, Select, Avatar, Tabs } from '../../components/ui'
import type { User, Role } from '../../types'
import { USERS, LOGIN_HISTORY, ACTIVITY_LOGS, SETTINGS_GROUPS, type AuditActivityLog, type SettingGroup } from "../../data/demoDatabase"
import { useLanguage } from '../../i18n/LanguageContext'
import { useStorageHub } from '../../store/StorageHubContext'
import ProfileView from '../ProfileView'
import { useMemo } from 'react'

const PERMISSIONS: Partial<Record<Role, Record<string, boolean>>> = {}
const permissionLabels: Array<{ key: string; label: string }> = []

const roleColors: Record<Role, string> = {
  customer: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  manager: 'bg-purple-100 text-purple-700',
  business: 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
}

export default function AdminApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { lang } = useLanguage()

  const NAV = [
    { id: 'users', label: lang === 'vi' ? 'Quản lý người dùng' : 'User Management', icon: Icon.users, group: lang === 'vi' ? 'Quản trị' : 'Administration' },
    { id: 'roles', label: lang === 'vi' ? 'Vai trò & Phân quyền' : 'Roles & Permissions', icon: Icon.shield, group: lang === 'vi' ? 'Quản trị' : 'Administration' },
    { id: 'login-history', label: lang === 'vi' ? 'Lịch sử đăng nhập' : 'Login History', icon: Icon.login, group: lang === 'vi' ? 'Bảo mật & Giám sát' : 'Security & Audit' },
    { id: 'activity', label: lang === 'vi' ? 'Nhật ký hoạt động' : 'Activity Logs', icon: Icon.log, group: lang === 'vi' ? 'Bảo mật & Giám sát' : 'Security & Audit' },
    { id: 'settings', label: lang === 'vi' ? 'Cài đặt hệ thống' : 'System Settings', icon: Icon.cog, group: lang === 'vi' ? 'Hệ thống' : 'System' },
  ]

  const [page, setPage] = useState(() => getInitialPage(NAV, 'users'))
  const [userModal, setUserModal] = useState(false)
  const [userTab, setUserTab] = useState('All')
  const [logTab, setLogTab] = useState('All')
  const [logSearch, setLogSearch] = useState('')
  const [historyTab, setHistoryTab] = useState('All')
  const [selectedUser, setSelectedUser] = useState<typeof USERS[0] | null>(null)

  // Audit Logs interactive state
  const [logsList, setLogsList] = useState<AuditActivityLog[]>(ACTIVITY_LOGS)
  const [selectedLog, setSelectedLog] = useState<AuditActivityLog | null>(null)
  const [logModalOpen, setLogModalOpen] = useState(false)

  // Settings interactive state
  const [settingsGroups, setSettingsGroups] = useState<SettingGroup[]>(SETTINGS_GROUPS)
  const [activeSettingsTab, setActiveSettingsTab] = useState('All Categories')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const filteredUsers = USERS.filter(u => {
    if (userTab === 'All' || userTab === 'Tất cả') return true
    if (userTab === 'Customer' || userTab === 'Khách hàng') return u.role === 'customer'
    if (userTab === 'Staff' || userTab === 'Nhân viên') return u.role === 'staff'
    if (userTab === 'Manager' || userTab === 'Quản lý') return u.role === 'manager'
    if (userTab === 'Admin' || userTab === 'Quản trị') return u.role === 'admin'
    if (userTab === 'Suspended' || userTab === 'Tạm khóa') return u.status === 'suspended'
    return u.role === userTab.toLowerCase() || u.status === userTab.toLowerCase()
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
    return <Badge variant={m[v] ?? 'muted'}>{lang === 'vi' && viLabels[v] ? viLabels[v] : v.charAt(0).toUpperCase() + v.slice(1)}</Badge>
  }

  return (
    <Layout
      user={user} navItems={NAV} currentPage={page} onNavigate={setPage} onLogout={onLogout}
      roleLabel={lang === 'vi' ? 'Quản Trị Viên Hệ Thống' : 'System Administrator'} roleColor="bg-red-100 text-red-700"
    >
      {/* ── USER MANAGEMENT ───────────────────────────────────── */}
      {page === 'users' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Quản Lý Tài Khoản Người Dùng' : 'User Management'}
            subtitle={lang === 'vi' ? `Tổng cộng ${USERS.length} tài khoản người dùng` : `${USERS.length} total users`}
            action={<Button variant="primary" size="sm" onClick={() => { setSelectedUser(null); setUserModal(true) }}>{Icon.plus} {lang === 'vi' ? 'Thêm Người Dùng' : 'Add User'}</Button>}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard title={lang === 'vi' ? 'Tổng tài khoản' : 'Total Users'} value={USERS.length} icon={Icon.users} iconBg="bg-blue-50" />
            <StatCard title={lang === 'vi' ? 'Đang hoạt động' : 'Active'} value={USERS.filter(u => u.status === 'active').length} icon={Icon.check} iconBg="bg-green-50" />
            <StatCard title={lang === 'vi' ? 'Khách hàng' : 'Customers'} value={USERS.filter(u => u.role === 'customer').length} icon={Icon.box} iconBg="bg-purple-50" />
            <StatCard title={lang === 'vi' ? 'Bị tạm khóa' : 'Suspended'} value={USERS.filter(u => u.status === 'suspended').length} icon={Icon.alert} iconBg="bg-red-50" />
          </div>
          <div className="mb-4">
            <Tabs
              tabs={lang === 'vi' ? ['Tất cả', 'Khách hàng', 'Nhân viên', 'Quản lý', 'Quản trị', 'Tạm khóa'] : ['All', 'Customer', 'Staff', 'Manager', 'Admin', 'Suspended']}
              active={
                userTab === 'All' && lang === 'vi' ? 'Tất cả' :
                userTab === 'Customer' && lang === 'vi' ? 'Khách hàng' :
                userTab === 'Staff' && lang === 'vi' ? 'Nhân viên' :
                userTab === 'Manager' && lang === 'vi' ? 'Quản lý' :
                userTab === 'Admin' && lang === 'vi' ? 'Quản trị' :
                userTab === 'Suspended' && lang === 'vi' ? 'Tạm khóa' : userTab
              }
              onChange={val => {
                if (val === 'Tất cả') setUserTab('All')
                else if (val === 'Khách hàng') setUserTab('Customer')
                else if (val === 'Nhân viên') setUserTab('Staff')
                else if (val === 'Quản lý') setUserTab('Manager')
                else if (val === 'Quản trị') setUserTab('Admin')
                else if (val === 'Tạm khóa') setUserTab('Suspended')
                else setUserTab(val)
              }}
            />
          </div>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Người Dùng' : 'User'}</Th>
                  <Th>{lang === 'vi' ? 'Vai Trò' : 'Role'}</Th>
                  <Th>{lang === 'vi' ? 'Cơ Sở' : 'Facility'}</Th>
                  <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
                  <Th>{lang === 'vi' ? 'Đăng Nhập Cuối' : 'Last Login'}</Th>
                  <Th>{lang === 'vi' ? 'Ngày Tạo' : 'Joined'}</Th>
                  <Th className="text-right">{lang === 'vi' ? 'Thao Tác' : 'Actions'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredUsers.map(u => (
                  <Tr key={u.id} onClick={() => { setSelectedUser(u); setUserModal(true) }}>
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
                        {u.role}
                      </span>
                    </Td>
                    <Td className="text-slate-500 text-sm">{u.facility ?? '—'}</Td>
                    <Td>{sb(u.status)}</Td>
                    <Td className="text-sm text-slate-500">{u.lastLogin}</Td>
                    <Td className="text-sm text-slate-500">{u.joined}</Td>
                    <Td>
                      <div className="flex gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setUserModal(true) }}>{lang === 'vi' ? 'Sửa' : 'Edit'}</Button>
                        {u.status === 'active' && <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? `Tài khoản ${u.name} đã bị khóa.` : `Account ${u.name} suspended.`)}>{lang === 'vi' ? 'Khóa' : 'Suspend'}</Button>}
                        {u.status === 'suspended' && <Button variant="primary" size="sm" onClick={() => showToast(lang === 'vi' ? `Đã khôi phục tài khoản ${u.name}.` : `Restored ${u.name}.`)}>{lang === 'vi' ? 'Mở' : 'Restore'}</Button>}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── ROLES & PERMISSIONS ───────────────────────────────── */}
      {page === 'roles' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Vai Trò & Ma Trận Phân Quyền' : 'Roles & Permissions'}
            subtitle={lang === 'vi' ? 'Ma trận kiểm soát quyền truy cập dựa trên vai trò (RBAC)' : 'Role-based access control matrix'}
          />
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-48">
                    {lang === 'vi' ? 'Quyền Hạn' : 'Permission'}
                  </th>
                  {(Object.keys(roleColors) as Role[]).map(r => (
                    <th key={r} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[r]}`}>{r}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { key: 'view_facilities', label: lang === 'vi' ? 'Xem danh mục cơ sở' : 'View facilities' },
                  { key: 'book_unit', label: lang === 'vi' ? 'Đặt thuê gian kho' : 'Book storage units' },
                  { key: 'checkin_out', label: lang === 'vi' ? 'Thực hiện thủ tục nhận/trả kho' : 'Process check-in / check-out' },
                  { key: 'manage_leases', label: lang === 'vi' ? 'Quản lý hợp đồng & cước phí' : 'Manage lease agreements' },
                  { key: 'overlock_units', label: lang === 'vi' ? 'Khóa cổng điện tử (Overlock)' : 'Execute digital overlock' },
                  { key: 'manage_pricing', label: lang === 'vi' ? 'Điều chỉnh biểu giá & khuyến mãi' : 'Manage pricing & promotions' },
                  { key: 'system_admin', label: lang === 'vi' ? 'Toàn quyền cấu hình hệ thống' : 'Full system administration' },
                ].map(p => (
                  <tr key={p.key} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">{p.label}</td>
                    {(Object.keys(roleColors) as Role[]).map(r => {
                      const has = r === 'admin' || (r === 'business' && ['view_facilities', 'manage_pricing'].includes(p.key)) || (r === 'manager' && ['view_facilities', 'manage_leases', 'overlock_units', 'checkin_out'].includes(p.key)) || (r === 'staff' && ['checkin_out', 'view_facilities'].includes(p.key)) || (r === 'customer' && ['view_facilities', 'book_unit'].includes(p.key))
                      return (
                        <td key={r} className="px-4 py-3 text-center">
                          {has
                            ? <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full"><svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></span>
                            : <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full"><svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></span>
                          }
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã lưu cấu hình ma trận phân quyền!' : 'Permissions saved successfully!')}>
              {lang === 'vi' ? 'Lưu Thay Đổi Phân Quyền' : 'Save Permission Changes'}
            </Button>
          </div>
        </div>
      )}

      {/* ── LOGIN HISTORY ─────────────────────────────────────── */}
      {page === 'login-history' && (
        <div className="fade-in">
          <SectionHeader
            title={lang === 'vi' ? 'Lịch Sử Đăng Nhập Hệ Thống' : 'Login History'}
            subtitle={lang === 'vi' ? 'Nhật ký kiểm toán an ninh các sự kiện xác thực tài khoản' : 'Security audit log of authentication events'}
          />
          <div className="mb-4 flex gap-3 items-center">
            <Tabs
              tabs={lang === 'vi' ? ['Tất cả', 'Thành công', 'Thất bại'] : ['All', 'Success', 'Failed']}
              active={
                historyTab === 'All' && lang === 'vi' ? 'Tất cả' :
                historyTab === 'Success' && lang === 'vi' ? 'Thành công' :
                historyTab === 'Failed' && lang === 'vi' ? 'Thất bại' : historyTab
              }
              onChange={val => {
                if (val === 'Tất cả') setHistoryTab('All')
                else if (val === 'Thành công') setHistoryTab('Success')
                else if (val === 'Thất bại') setHistoryTab('Failed')
                else setHistoryTab(val)
              }}
            />
            {LOGIN_HISTORY.some(l => l.status === 'failed') && (
              <div className="flex items-center gap-2 ml-auto bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-sm text-red-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>
                {lang === 'vi' ? 'Phát hiện 1 lần đăng nhập thất bại khả nghi' : '1 suspicious login attempt detected'}
              </div>
            )}
          </div>
          <Card>
            <Table>
              <Thead>
                <tr>
                  <Th>{lang === 'vi' ? 'Người Dùng' : 'User'}</Th>
                  <Th>{lang === 'vi' ? 'Vai Trò' : 'Role'}</Th>
                  <Th>{lang === 'vi' ? 'Địa Chỉ IP' : 'IP Address'}</Th>
                  <Th>{lang === 'vi' ? 'Vị Trí' : 'Location'}</Th>
                  <Th>{lang === 'vi' ? 'Thiết Bị' : 'Device'}</Th>
                  <Th>{lang === 'vi' ? 'Thời Gian' : 'Time'}</Th>
                  <Th>{lang === 'vi' ? 'Trạng Thái' : 'Status'}</Th>
                </tr>
              </Thead>
              <Tbody>
                {LOGIN_HISTORY
                  .filter(l => {
                    if (historyTab === 'All' || historyTab === 'Tất cả') return true
                    if (historyTab === 'Success' || historyTab === 'Thành công') return l.status === 'success'
                    if (historyTab === 'Failed' || historyTab === 'Thất bại') return l.status === 'failed'
                    return l.status === historyTab.toLowerCase()
                  })
                  .map(l => (
                    <Tr key={l.id} className={l.status === 'failed' ? 'bg-red-50' : ''}>
                      <Td>
                        <div>
                          <p className="font-medium text-sm text-slate-800">{l.user}</p>
                          <p className="text-xs text-slate-400">{l.email}</p>
                        </div>
                      </Td>
                      <Td>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[l.role as Role]}`}>{l.role}</span>
                      </Td>
                      <Td><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{l.ip}</code></Td>
                      <Td className="text-sm text-slate-500">{l.location}</Td>
                      <Td className="text-xs text-slate-400">{l.device}</Td>
                      <Td className="text-xs text-slate-500">{l.time}</Td>
                      <Td>
                        {l.status === 'failed'
                          ? <Badge variant="error">{lang === 'vi' ? 'Thất bại' : 'Failed'}</Badge>
                          : <Badge variant="success">{lang === 'vi' ? 'Thành công' : 'Success'}</Badge>}
                      </Td>
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* ── ACTIVITY LOGS ─────────────────────────────────────── */}
      {page === 'activity' && (() => {
        const { activities } = useStorageHub()
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
          const matchTab = logTab === 'All' || l.category === logTab.toLowerCase()
          const query = logSearch.toLowerCase().trim()
          const matchSearch =
            !query ||
            l.actor.toLowerCase().includes(query) ||
            l.action.toLowerCase().includes(query) ||
            l.target.toLowerCase().includes(query) ||
            l.ip.includes(query)
          return matchTab && matchSearch
        })

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={lang === 'vi' ? 'Nhật Ký Hoạt Động & Giám Sát Hệ Thống' : 'System Activity & Audit Trail'}
              subtitle={lang === 'vi' ? 'Dòng thời gian ghi nhận các thao tác người dùng, cảnh báo an ninh và thay đổi dữ liệu quản trị' : 'Real-time chronological journal of user operations, security alerts, and administrative data modifications'}
              action={
                <Button variant="outline" size="sm" onClick={() => showToast(lang === 'vi' ? 'Đã xuất nhật ký kiểm toán sang tệp JSON & CSV!' : 'Audit logs exported to JSON & CSV archive!')}>
                  {lang === 'vi' ? 'Xuất Nhật Ký' : 'Export Audit Trail'}
                </Button>
              }
            />

            {/* Audit Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={lang === 'vi' ? 'Sự Kiện Hôm Nay' : 'Logged Events Today'}
                value={logsList.length}
                delta={lang === 'vi' ? '+14 sự kiện so với hôm qua' : '+14 events vs yesterday'}
                deltaPositive
                icon={Icon.log}
                iconBg="bg-blue-50 text-blue-700"
              />
              <StatCard
                title={lang === 'vi' ? 'Ngoại Lệ An Ninh' : 'Security Exceptions'}
                value={errorCount}
                delta={errorCount > 0 ? (lang === 'vi' ? 'Cần kiểm tra ngay' : 'Requires inspection') : (lang === 'vi' ? 'Hệ thống an toàn' : 'System nominal')}
                deltaPositive={errorCount === 0}
                icon={Icon.shield}
                iconBg={errorCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}
              />
              <StatCard
                title={lang === 'vi' ? 'Thao Tác Quản Trị' : 'Admin Modifications'}
                value={adminActions}
                delta={lang === 'vi' ? 'Cập nhật tài khoản & chính sách' : 'Policy & user updates'}
                icon={Icon.cog}
                iconBg="bg-amber-50 text-amber-800"
              />
              <StatCard
                title={lang === 'vi' ? 'Lượt Truy Cập Cửa/Cổng' : 'Gate Access Events'}
                value={logsList.filter(l => l.category === 'access' || l.category === 'security').length}
                delta={lang === 'vi' ? 'Bộ điều khiển phần cứng ổn định' : 'Hardware controller link active'}
                deltaPositive
                icon={Icon.key}
                iconBg="bg-purple-50 text-purple-700"
              />
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <Tabs
                tabs={lang === 'vi' ? ['Tất cả', 'An ninh', 'Thuê kho', 'Thanh toán', 'Bảng giá', 'Ra vào'] : ['All', 'security', 'rental', 'billing', 'pricing', 'access']}
                active={
                  logTab === 'All' && lang === 'vi' ? 'Tất cả' :
                  logTab === 'security' && lang === 'vi' ? 'An ninh' :
                  logTab === 'rental' && lang === 'vi' ? 'Thuê kho' :
                  logTab === 'billing' && lang === 'vi' ? 'Thanh toán' :
                  logTab === 'pricing' && lang === 'vi' ? 'Bảng giá' :
                  logTab === 'access' && lang === 'vi' ? 'Ra vào' : logTab
                }
                onChange={val => {
                  if (val === 'Tất cả') setLogTab('All')
                  else if (val === 'An ninh') setLogTab('security')
                  else if (val === 'Thuê kho') setLogTab('rental')
                  else if (val === 'Thanh toán') setLogTab('billing')
                  else if (val === 'Bảng giá') setLogTab('pricing')
                  else if (val === 'Ra vào') setLogTab('access')
                  else setLogTab(val)
                }}
              />
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  placeholder={lang === 'vi' ? 'Tìm người dùng, thao tác, đối tượng, IP...' : 'Search actor, action, target, IP...'}
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Audit Log Stream */}
            <Card className="divide-y divide-stone-100 overflow-hidden">
              {filteredLogs.length === 0 ? (
                <div className="p-10 text-center text-stone-400">
                  <p className="font-semibold text-stone-700">{lang === 'vi' ? 'Chưa ghi nhận sự kiện hoạt động nào' : 'No activity events recorded'}</p>
                  <p className="text-xs mt-1">{lang === 'vi' ? 'Không tìm thấy mục nhật ký nào phù hợp với bộ lọc này.' : 'No matching log entries found for this category or filter.'}</p>
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
                          {lang === 'vi' ? 'Đối tượng:' : 'Target:'} <strong className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">{l.target}</strong>
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
                        {lang === 'vi' ? 'Chi Tiết' : 'Payload'}
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
        const handleSaveSettings = () => {
          showToast(lang === 'vi' ? 'Đã lưu cấu hình nền tảng và chính sách vận hành thành công!' : 'Platform configurations and operational policies saved successfully!')
        }

        const handleResetDefaults = () => {
          setSettingsGroups(SETTINGS_GROUPS)
          showToast(lang === 'vi' ? 'Đã khôi phục toàn bộ cấu hình về mặc định ban đầu.' : 'Configuration restored to factory presets.')
        }

        const filteredGroups = activeSettingsTab === 'All Categories' || activeSettingsTab === 'Tất cả danh mục'
          ? settingsGroups
          : settingsGroups.filter(g => {
              const query = activeSettingsTab.toLowerCase().slice(0, 4)
              return g.group.toLowerCase().includes(query) || (
                (activeSettingsTab === 'Cơ sở kho' && g.group === 'Facility Defaults') ||
                (activeSettingsTab === 'Thanh toán' && g.group === 'Billing & Delinquency') ||
                (activeSettingsTab === 'Bảo mật' && g.group === 'Security & Access') ||
                (activeSettingsTab === 'Thông báo' && g.group === 'Automated Notifications') ||
                (activeSettingsTab === 'Bảo trì' && g.group === 'System & Maintenance')
              )
            })

        return (
          <div className="fade-in space-y-6">
            <SectionHeader
              title={lang === 'vi' ? 'Cấu Hình Hệ Thống & Cơ Sở Kho' : 'System & Facility Configurations'}
              subtitle={lang === 'vi' ? 'Tinh chỉnh các ngưỡng vận hành, thời gian ân hạn công nợ, quy tắc an ninh và thông báo tự động' : 'Fine-tune operational thresholds, billing grace periods, security rules, and alert dispatchers'}
              action={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleResetDefaults}>
                    {lang === 'vi' ? 'Khôi Phục Mặc Định' : 'Reset Defaults'}
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveSettings}>
                    {lang === 'vi' ? 'Lưu Toàn Bộ Cài Đặt' : 'Save All Settings'}
                  </Button>
                </div>
              }
            />

            {/* Category Tabs */}
            <Tabs
              tabs={lang === 'vi' ? ['Tất cả danh mục', 'Cơ sở kho', 'Thanh toán', 'Bảo mật', 'Thông báo', 'Bảo trì'] : ['All Categories', 'Facility', 'Billing', 'Security', 'Notifications', 'Maintenance']}
              active={
                activeSettingsTab === 'All Categories' && lang === 'vi' ? 'Tất cả danh mục' :
                activeSettingsTab === 'Facility' && lang === 'vi' ? 'Cơ sở kho' :
                activeSettingsTab === 'Billing' && lang === 'vi' ? 'Thanh toán' :
                activeSettingsTab === 'Security' && lang === 'vi' ? 'Bảo mật' :
                activeSettingsTab === 'Notifications' && lang === 'vi' ? 'Thông báo' :
                activeSettingsTab === 'Maintenance' && lang === 'vi' ? 'Bảo trì' : activeSettingsTab
              }
              onChange={val => {
                if (val === 'Tất cả danh mục') setActiveSettingsTab('All Categories')
                else if (val === 'Cơ sở kho') setActiveSettingsTab('Facility')
                else if (val === 'Thanh toán') setActiveSettingsTab('Billing')
                else if (val === 'Bảo mật') setActiveSettingsTab('Security')
                else if (val === 'Thông báo') setActiveSettingsTab('Notifications')
                else if (val === 'Bảo trì') setActiveSettingsTab('Maintenance')
                else setActiveSettingsTab(val)
              }}
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
                      {lang === 'vi' ? 'ĐANG ÁP DỤNG' : 'Active'}
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
                              className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                            />
                            <span className="text-xs text-stone-600 font-medium">
                              {lang === 'vi' ? 'Bật / Tự động áp dụng thiết lập này' : 'Enable / Enforce this setting automatically'}
                            </span>
                          </label>
                        ) : item.type === 'select' ? (
                          <select
                            defaultValue={item.value as string}
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        ) : (
                          <input
                            type="text"
                            defaultValue={item.value as string}
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleResetDefaults}>{lang === 'vi' ? 'Hủy Thay Đổi' : 'Discard Changes'}</Button>
              <Button variant="primary" onClick={handleSaveSettings}>{lang === 'vi' ? 'Lưu Toàn Bộ Cài Đặt' : 'Save All Settings'}</Button>
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
            ? (lang === 'vi' ? `Chỉnh Sửa Người Dùng – ${selectedUser.name}` : `Edit User – ${selectedUser.name}`)
            : (lang === 'vi' ? 'Thêm Người Dùng Mới' : 'Add New User')
        }
      >
        <div className="space-y-4">
          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Avatar name={selectedUser.name} size="lg" />
              <div>
                <p className="font-semibold text-slate-800">{selectedUser.name}</p>
                <p className="text-xs text-slate-400">
                  {selectedUser.id} · {lang === 'vi' ? `Tham gia ${selectedUser.joined ?? 'Gần đây'}` : `Joined ${selectedUser.joined ?? 'Recently'}`}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label={lang === 'vi' ? 'Họ và Tên' : 'Full Name'} defaultValue={selectedUser?.name} placeholder="Jane Smith" />
            <Input label="Email" type="email" defaultValue={selectedUser?.email} placeholder="jane@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={lang === 'vi' ? 'Vai Trò' : 'Role'} value={selectedUser?.role}>
              <option value="customer">{lang === 'vi' ? 'Khách hàng' : 'Customer'}</option>
              <option value="staff">{lang === 'vi' ? 'Nhân viên' : 'Staff'}</option>
              <option value="manager">{lang === 'vi' ? 'Quản lý cơ sở' : 'Manager'}</option>
              <option value="business">{lang === 'vi' ? 'Giám đốc kinh doanh' : 'Business Manager'}</option>
              <option value="admin">{lang === 'vi' ? 'Quản trị viên' : 'Admin'}</option>
            </Select>
            <Select label={lang === 'vi' ? 'Trạng Thái' : 'Status'} value={selectedUser?.status}>
              <option value="active">{lang === 'vi' ? 'Hoạt động' : 'Active'}</option>
              <option value="inactive">{lang === 'vi' ? 'Ngưng hoạt động' : 'Inactive'}</option>
              <option value="suspended">{lang === 'vi' ? 'Đình chỉ' : 'Suspended'}</option>
            </Select>
          </div>
          <Input label={lang === 'vi' ? 'Cơ sở kho (nếu có)' : 'Facility (if applicable)'} defaultValue={selectedUser?.facility} placeholder={lang === 'vi' ? 'Tên cơ sở kho' : 'Facility name'} />
          {!selectedUser && <Input label={lang === 'vi' ? 'Mật Khẩu Tạm Thời' : 'Temporary Password'} type="password" placeholder={lang === 'vi' ? 'Sẽ được gửi tự động qua email' : 'Will be sent via email'} />}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setUserModal(false)}>{lang === 'vi' ? 'Hủy Bỏ' : 'Cancel'}</Button>
            {selectedUser && (
              <Button variant="danger" onClick={() => { setUserModal(false); showToast(lang === 'vi' ? 'Đã xóa tài khoản khỏi hệ thống!' : 'User removed!') }}>
                {lang === 'vi' ? 'Xóa Tài Khoản' : 'Delete User'}
              </Button>
            )}
            <Button variant="primary" onClick={() => { setUserModal(false); showToast(lang === 'vi' ? 'Đã cập nhật thông tin người dùng!' : 'User updated successfully!') }}>
              {selectedUser ? (lang === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes') : (lang === 'vi' ? 'Tạo Tài Khoản' : 'Create User')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Audit Log JSON Inspector Modal */}
      <Modal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title={lang === 'vi' ? 'Chi Tiết & Siêu Dữ Liệu Sự Kiện Kiểm Toán' : 'Audit Event Data & Metadata Inspector'}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[#292a27] text-white">
              <div className="flex justify-between items-center text-xs font-mono text-[#e9a12c]">
                <span>{lang === 'vi' ? 'MÃ SỰ KIỆN' : 'EVENT ID'}: {selectedLog.id}</span>
                <span className="uppercase">{selectedLog.category}</span>
              </div>
              <p className="font-bold text-stone-100 text-sm mt-1">{selectedLog.action}</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {selectedLog.timestamp} · {lang === 'vi' ? 'Người thực hiện' : 'Actor'}: {selectedLog.actor} ({selectedLog.role})
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Địa Chỉ IP Nguồn' : 'Origin IP Address'}</span>
                <code className="font-mono text-stone-800 font-bold">{selectedLog.ip}</code>
              </div>
              <div>
                <span className="text-stone-400 block">{lang === 'vi' ? 'Thiết Bị / Trình Duyệt' : 'User-Agent / Device'}</span>
                <span className="text-stone-800 font-medium truncate block">{selectedLog.device}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700">
                {lang === 'vi' ? 'Dữ Liệu Thay Đổi (Payload JSON)' : 'Raw Mutation Payload (JSON)'}
              </label>
              <pre className="p-3 bg-[#1e1f1d] text-emerald-300 font-mono text-xs rounded-lg overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <Button variant="outline" onClick={() => setLogModalOpen(false)}>
                {lang === 'vi' ? 'Đóng Cửa Sổ' : 'Close Inspector'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
