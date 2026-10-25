import { Button, Card } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { singleManagerFacility } from './managerFacilityUi'
import ManagerReportsApiPanel from './ManagerReportsApiPanel'


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
            {facilityName}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 mt-1">
          Tổng quan vận hành: <span className="text-stone-900 font-extrabold">{facilityName}</span>
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">Số liệu báo cáo, chỉ số hiệu suất và công việc trực tiếp tại cơ sở.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage('inventory')}>
          Thông tin kho
        </Button>
      </div>
    </div>

    <ManagerReportsApiPanel overview />

  </div>
}


