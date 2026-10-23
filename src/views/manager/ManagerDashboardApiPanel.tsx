import { Button, Card, StatCard } from '../../components/ui'
import { getAuthenticatedActor, type ApiActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { loadManagerApiCount, managerApiIdentity, requireManagerRead, type ManagerApiMetric } from './managerD1D5Api'
import { managerDisplayError } from './managerPresentation'
import { singleManagerFacility } from './managerFacilityUi'
import ManagerReportsApiPanel from './ManagerReportsApiPanel'

const metrics: { metric: ManagerApiMetric; title: string; page: string }[] = [
  { metric: 'rentals', title: 'Tổng hồ sơ thuê', page: 'rentals' },
  { metric: 'pending-renewals', title: 'Gia hạn cần theo dõi', page: 'rentals' },
  { metric: 'open-support', title: 'Yêu cầu hỗ trợ mới', page: 'support-api' },
  { metric: 'term-overdue', title: 'Quá thời hạn thuê', page: 'overdue-cases' },
]

export default function ManagerDashboardApiPanel({ setPage }: { setPage: (page: string) => void }) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('MANAGER')) return (
    <Card className="p-5" role="alert">Cần đăng nhập bằng tài khoản quản lý cơ sở đang hoạt động.</Card>
  )
  const facilityId = singleManagerFacility(actor)
  const facilityName = (facilityId && actor.facilityNames?.[facilityId]) || Object.values(actor.facilityNames || {})[0] || 'Cơ sở được phân công'

  return <div className="space-y-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Không gian quản lý cơ sở</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
            🏢 {facilityName}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 mt-1">
          Tổng quan vận hành: <span className="text-stone-900 font-extrabold">{facilityName}</span>
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">Số liệu báo cáo, chỉ số hiệu suất và công việc trực tiếp tại cơ sở.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage('inventory')}>
          Quản lý gian kho →
        </Button>
      </div>
    </div>

    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs sm:text-sm text-blue-900 flex items-start gap-3 shadow-xs">
      <span className="text-xl shrink-0">ℹ️</span>
      <div className="space-y-1">
        <p className="font-bold text-blue-950">Cơ sở đang trong giai đoạn Thiết lập ban đầu (Setup)</p>
        <p className="text-blue-800 leading-relaxed text-xs">
          Cơ sở <strong>{facilityName}</strong> đã được BO tạo và Admin phân công quyền quản lý cho tài khoản này. Để đưa cơ sở vào khai thác, Quản lý cần vào mục <strong>"Quản lý gian kho"</strong> để khởi tạo các <strong>Loại kho thực tế</strong> và số lượng gian kho tương ứng.
        </p>
        <div className="pt-1">
          <Button size="sm" variant="outline" onClick={() => setPage('inventory')} className="text-xs font-semibold">
            Đến Quản lý gian kho ngay →
          </Button>
        </div>
      </div>
    </div>

    <ManagerReportsApiPanel overview />
    <section className="space-y-4" aria-label="Công việc cần theo dõi">
    <h2 className="text-xl font-bold text-stone-900">Công việc cần theo dõi</h2>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(item => <ManagerMetric key={`${managerApiIdentity(actor)}:${item.metric}`} actor={actor} item={item} setPage={setPage} />)}
    </div>
    </section>
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
