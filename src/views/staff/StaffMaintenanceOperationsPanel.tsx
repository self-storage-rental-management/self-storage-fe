import { useRef, useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import {
  completeMaintenanceTask,
  listStaffMaintenanceTasks,
  startMaintenanceTask,
  uploadMaintenanceEvidence,
  type MaintenanceTaskApi,
} from '../../services/maintenanceApi'
import { formatStaffDateTime, staffErrorMessage } from './staffPresentation'

const statusLabels: Record<MaintenanceTaskApi['status'], string> = {
  open: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
}

const priorityLabels: Record<MaintenanceTaskApi['priority'], string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
}

function MaintenanceWorkspace({ actorId, identity, taskId, showToast }: {
  actorId: string
  identity: string
  taskId?: string
  showToast: (message: string) => void
}) {
  const read = useRentalApiResource(
    `${identity}:maintenance-tasks`,
    () => listStaffMaintenanceTasks({ assignedStaffId: actorId, page: 0, pageSize: 100 }),
  )
  const [selected, setSelected] = useState<MaintenanceTaskApi | null>(null)
  const [resultReport, setResultReport] = useState('')
  const [makeUnitAvailable, setMakeUnitAvailable] = useState(true)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const run = async (work: () => Promise<MaintenanceTaskApi>, success: string) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await work()
      showToast(success)
      setSelected(null)
      setResultReport('')
      setEvidenceFiles([])
      read.refresh()
    } catch (error) {
      showToast(staffErrorMessage(error, 'Không thể cập nhật nhiệm vụ bảo trì.'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const start = (task: MaintenanceTaskApi) =>
    void run(
      () => startMaintenanceTask(task.id),
      `Đã bắt đầu bảo trì gian ${task.unitCode}.`,
    )

  const openCompletion = (task: MaintenanceTaskApi) => {
    setSelected(task)
    setResultReport(task.resultReport || '')
    setMakeUnitAvailable(true)
    setEvidenceFiles([])
  }

  const complete = () => {
    if (!selected || !resultReport.trim() || lock.current) return
    void run(async () => {
      const evidencePhotos: string[] = []
      for (const file of evidenceFiles) {
        const asset = await uploadMaintenanceEvidence(selected.id, file)
        evidencePhotos.push(asset.id)
      }
      return completeMaintenanceTask(selected.id, {
        resultReport: resultReport.trim(),
        evidencePhotos,
        makeUnitAvailable,
      })
    }, makeUnitAvailable
      ? `Đã hoàn thành bảo trì gian ${selected.unitCode} và chuyển gian sang sẵn sàng.`
      : `Đã hoàn thành phần sửa chữa gian ${selected.unitCode}. Gian vẫn được giữ ở trạng thái cần bảo trì.`)
  }

  const actor = getAuthenticatedActor()
  if (!actor || actor.id !== actorId) return null

  const tasks = (read.data?.data ?? []).filter((task) => !taskId || task.id === taskId)

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-stone-900">Xử lý nhiệm vụ bảo trì</h3>
          <p className="mt-1 text-xs text-stone-500">
            Bắt đầu công việc, ghi báo cáo, tải ảnh sửa chữa và xác nhận trạng thái gian kho.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={busy || read.loading} onClick={() => read.refresh()}>
          Tải lại
        </Button>
      </div>

      {read.loading && <p role="status" className="text-sm text-stone-500">Đang tải nhiệm vụ bảo trì…</p>}
      {Boolean(read.error) && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm"><p>{staffErrorMessage(read.error, 'Không thể tải danh sách nhiệm vụ bảo trì.')}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => read.refresh()}>Thử lại</Button></div>}
      {!read.loading && !read.error && tasks.length === 0 && <p className="rounded border border-dashed p-5 text-center text-sm text-stone-500">{taskId ? 'Không tìm thấy nhiệm vụ bảo trì này.' : 'Chưa có nhiệm vụ bảo trì được giao cho bạn.'}</p>}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="rounded border border-stone-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-stone-900">{task.title} · {task.unitCode}</p>
                <p className="mt-1 text-sm text-stone-600">{task.reason}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {task.facilityName} · Hạn: {task.dueAt || 'Không đặt hạn'} · Cập nhật: {formatStaffDateTime(task.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'muted'}>{priorityLabels[task.priority]}</Badge>
                <Badge variant={task.status === 'completed' ? 'success' : task.status === 'in_progress' ? 'info' : task.status === 'cancelled' ? 'error' : 'warning'}>{statusLabels[task.status]}</Badge>
              </div>
            </div>
            {task.resultReport && <p className="mt-2 rounded bg-stone-50 p-2 text-sm text-stone-700">Kết quả: {task.resultReport}</p>}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {task.status === 'open' && <Button size="sm" disabled={busy} onClick={() => start(task)}>Bắt đầu xử lý</Button>}
              {task.status === 'in_progress' && <Button size="sm" disabled={busy} onClick={() => openCompletion(task)}>Hoàn thành nhiệm vụ</Button>}
              {task.status === 'completed' && <span className="text-xs font-semibold text-emerald-700">Đã gửi kết quả</span>}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="space-y-3 rounded border border-stone-300 bg-stone-50 p-4" aria-label="Hoàn thành nhiệm vụ bảo trì">
          <div><p className="font-semibold">Hoàn thành: {selected.title} · {selected.unitCode}</p><p className="text-xs text-stone-500">Mã nhiệm vụ: {selected.id}</p></div>
          <label className="block text-sm font-medium text-stone-700">
            Báo cáo kết quả
            <textarea className="mt-1 block min-h-24 w-full rounded border border-stone-300 bg-white p-2" maxLength={4000} disabled={busy} required value={resultReport} onChange={(event) => setResultReport(event.target.value)} placeholder="Mô tả hạng mục đã kiểm tra, sửa chữa và kết quả nghiệm thu…" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Ảnh sửa chữa / nghiệm thu
            <input className="mt-1 block w-full rounded border border-stone-300 bg-white p-2 text-sm" type="file" accept="image/*" multiple disabled={busy} onChange={(event) => setEvidenceFiles((current) => [...current, ...Array.from(event.target.files || [])].slice(0, 10))} />
          </label>
          {evidenceFiles.length > 0 && <ul className="list-disc pl-5 text-xs text-stone-600">{evidenceFiles.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`} className="flex items-center justify-between gap-2"><span className="truncate">{file.name}</span><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Xóa</Button></li>)}</ul>}
          <label className="block text-sm font-medium text-stone-700">
            Trạng thái gian sau bảo trì
            <select className="mt-1 block w-full rounded border border-stone-300 bg-white p-2" disabled={busy} value={makeUnitAvailable ? 'available' : 'maintenance'} onChange={(event) => setMakeUnitAvailable(event.target.value === 'available')}>
              <option value="available">Đã sẵn sàng khai thác</option>
              <option value="maintenance">Vẫn cần bảo trì</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Đóng</Button>
            <Button disabled={busy || !resultReport.trim()} onClick={complete}>{busy ? 'Đang lưu…' : 'Gửi báo cáo và hoàn thành'}</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function StaffMaintenanceOperationsPanel({ taskId, showToast }: { taskId?: string; showToast: (message: string) => void }) {
  const actor = getAuthenticatedActor()
  if (!actor || actor.status !== 'ACTIVE' || !actor.roles.includes('STAFF')) return null
  const identity = `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}`
  return <MaintenanceWorkspace key={`${identity}:${taskId}`} actorId={actor.id} identity={identity} taskId={taskId} showToast={showToast} />
}
