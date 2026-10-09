import { Button, Card, StatCard } from '../../components/ui'
import { getAuthenticatedActor, type ApiActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { loadManagerApiCount, managerApiIdentity, requireManagerRead, type ManagerApiMetric } from './managerD1D5Api'
import { managerDisplayError } from './managerPresentation'

const metrics: { metric: ManagerApiMetric; title: string; page: string }[] = [
  { metric: 'rentals', title: 'Tổng hồ sơ thuê', page: 'rentals' },
  { metric: 'active-rentals', title: 'Đang thuê', page: 'rentals' },
  { metric: 'pending-renewals', title: 'Chờ duyệt gia hạn', page: 'rentals' },
  { metric: 'open-support', title: 'Yêu cầu hỗ trợ mới', page: 'support-api' },
  { metric: 'payment-overdue', title: 'Thanh toán quá hạn', page: 'overdue-cases' },
  { metric: 'term-overdue', title: 'Quá thời hạn thuê', page: 'overdue-cases' },
]

export default function ManagerDashboardApiPanel({ setPage }: { setPage: (page: string) => void }) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('MANAGER')) return (
    <Card className="p-5" role="alert">Cần đăng nhập bằng tài khoản quản lý cơ sở đang hoạt động.</Card>
  )
  return <div className="space-y-5">
    <h2 className="text-2xl font-bold text-stone-900">Bảng điều khiển</h2>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(item => <ManagerMetric key={`${managerApiIdentity(actor)}:${item.metric}`} actor={actor} item={item} setPage={setPage} />)}
    </div>
  </div>
}

function ManagerMetric({ actor, item, setPage }: {
  actor: ApiActor; item: typeof metrics[number]; setPage: (page: string) => void
}) {
  try { requireManagerRead(actor, item.metric === 'open-support' ? 'support:read' : 'rentals:read') }
  catch (error) { return <MetricCard title={item.title} reason={managerDisplayError(error)} /> }
  return <MetricSession actor={actor} item={item} setPage={setPage} />
}

function MetricSession({ actor, item, setPage }: {
  actor: ApiActor; item: typeof metrics[number]; setPage: (page: string) => void
}) {
  const read = useRentalApiResource(`${managerApiIdentity(actor)}:${item.metric}`, () => loadManagerApiCount(item.metric, actor))
  const count = !read.loading && !read.error ? read.data : undefined
  return <MetricCard title={item.title} value={read.loading ? 'Đang tải' : count?.value ?? 'Chưa xác minh'}
    reason={read.error ? managerDisplayError(read.error) : count?.reason}
    onOpen={() => setPage(item.page)} />
}

function MetricCard({ title, value = 'Chưa xác minh', reason, onOpen }: {
  title: string; value?: number | string; reason?: string; onOpen?: () => void
}) {
  return <section className="min-w-0 space-y-2" aria-label={title}>
    <StatCard title={title} value={value} icon={null} />
    {reason && <p role="status" className="px-1 text-sm text-amber-800">{reason}</p>}
    {onOpen && <Button variant="outline" size="sm" onClick={onOpen}>Xem danh sách</Button>}
  </section>
}
