import { useMemo, useRef, useState } from "react"

import { Badge, Button, Card, Input, Modal, Select, Table, Tbody, Td, Th, Thead, Tr } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  completeMaintenanceTask,
  listStaffMaintenanceTasks,
  startMaintenanceTask,
  uploadMaintenanceEvidence,
  type MaintenanceTaskApi,
} from "../../services/maintenanceApi"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import type { RentalApiPage } from "../../types/rentalApi"
import type { FacilityTask } from "../../types/storageHub"
import type { StaffDailyOperation } from "../../services/staffDailyOperationsApi"
import StaffPagination, { paginateStaffItems } from "./StaffPagination"
import {
  compareStaffTaskSchedule,
  formatStaffDate,
  formatStaffDateTime,
  staffErrorMessage,
  type StaffTaskSort,
} from "./staffPresentation"

const taskTypeLabels: Record<FacilityTask["type"], string> = {
  general: "Chung",
  checkin: "Nhận kho",
  return: "Trả kho",
  maintenance: "Bảo trì",
  support: "Hỗ trợ",
}

const priorityLabels = { high: "Khẩn cấp", medium: "Trung bình", low: "Thông thường" } as const

type QueueStatus = "open" | "in_progress" | "completed" | "cancelled"
type QueueKind = "assigned" | "maintenance" | "operational"

interface QueueRow {
  id: string
  kind: QueueKind
  title: string
  customer: string
  sourceLabel: string
  notes: string
  dueAt: string
  priority: "high" | "medium" | "low"
  status: QueueStatus
  assignedTask?: FacilityTask
  maintenanceTask?: MaintenanceTaskApi
  operationalTask?: StaffDailyOperation
}

type MaintenancePage = RentalApiPage<MaintenanceTaskApi>

const emptyMaintenancePage = (): MaintenancePage => ({
  data: [],
  pagination: { page: 0, pageSize: 100, totalItems: 0, totalPages: 0, sort: "" },
  correlationId: null,
})

const toDateInputValue = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const priorityRank: Record<QueueRow["priority"], number> = { high: 0, medium: 1, low: 2 }

function queueStatusLabel(status: QueueStatus) {
  if (status === "completed") return "Đã hoàn thành"
  if (status === "cancelled") return "Đã hủy"
  if (status === "in_progress") return "Đang thực hiện"
  return "Chờ xử lý"
}

function queueStatusVariant(status: QueueStatus) {
  if (status === "completed") return "success" as const
  if (status === "cancelled") return "error" as const
  if (status === "in_progress") return "info" as const
  return "warning" as const
}

function priorityVariant(priority: QueueRow["priority"]) {
  if (priority === "high") return "error" as const
  if (priority === "medium") return "warning" as const
  return "muted" as const
}

function isFinished(status: QueueStatus) {
  return status === "completed" || status === "cancelled"
}

function compareQueueRows(left: QueueRow, right: QueueRow, sort: StaffTaskSort) {
  const leftFinished = isFinished(left.status)
  const rightFinished = isFinished(right.status)
  if (leftFinished !== rightFinished) return leftFinished ? 1 : -1

  const leftDue = new Date(left.dueAt).getTime()
  const rightDue = new Date(right.dueAt).getTime()
  const leftOverdue = !leftFinished && Number.isFinite(leftDue) && leftDue < Date.now()
  const rightOverdue = !rightFinished && Number.isFinite(rightDue) && rightDue < Date.now()
  if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1

  const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority]
  const dueDifference = (Number.isFinite(leftDue) ? leftDue : Number.POSITIVE_INFINITY) -
    (Number.isFinite(rightDue) ? rightDue : Number.POSITIVE_INFINITY)
  return sort === "priority"
    ? priorityDifference || dueDifference || left.title.localeCompare(right.title, "vi")
    : dueDifference || priorityDifference || left.title.localeCompare(right.title, "vi")
}

export default function StaffDailyTaskQueue({
  assignedTasks,
  operationalTasks,
  dateFilter,
  priorityFilter,
  sort,
  onDateFilterChange,
  onPriorityFilterChange,
  onSortChange,
  onAssignedStatus,
  onOpenAssignedCompletion,
  onOpenOperational,
  showToast,
}: {
  assignedTasks: FacilityTask[]
  operationalTasks: StaffDailyOperation[]
  dateFilter: string
  priorityFilter: string
  sort: StaffTaskSort
  onDateFilterChange: (value: string) => void
  onPriorityFilterChange: (value: string) => void
  onSortChange: (value: StaffTaskSort) => void
  onAssignedStatus: (task: FacilityTask, status: "in_progress" | "completed") => void
  onOpenAssignedCompletion: (task: FacilityTask) => void
  onOpenOperational: (task: StaffDailyOperation) => void
  showToast: (message: string) => void
}) {
  const actor = getAuthenticatedActor()
  const maintenanceIdentity = actor
    ? `${actor.id}:${JSON.stringify(actor.facilityScopes)}:${JSON.stringify(actor.permissions)}`
    : "demo-maintenance-disabled"
  const maintenanceRead = useRentalApiResource<MaintenancePage>(
    maintenanceIdentity,
    () => actor
      ? listStaffMaintenanceTasks({ assignedStaffId: actor.id, page: 0, pageSize: 100 })
      : Promise.resolve(emptyMaintenancePage()),
  )
  const [queuePage, setQueuePage] = useState(1)
  const [maintenanceCompletionTarget, setMaintenanceCompletionTarget] = useState<MaintenanceTaskApi | null>(null)
  const [maintenanceResult, setMaintenanceResult] = useState("")
  const [maintenanceEvidence, setMaintenanceEvidence] = useState<File[]>([])
  const [makeUnitAvailable, setMakeUnitAvailable] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const maintenanceTasks = maintenanceRead.data?.data ?? []
  const maintenanceIds = useMemo(() => new Set(maintenanceTasks.map((task) => `maintenance-${task.id}`)), [maintenanceTasks])

  const rows = useMemo<QueueRow[]>(() => {
    const maintenanceRows: QueueRow[] = maintenanceTasks.map((task) => ({
      id: `maintenance-${task.id}`,
      kind: "maintenance",
      title: `${task.title} · ${task.unitCode}`,
      customer: task.facilityName,
      sourceLabel: task.taskType === "inventory_check" ? "Kiểm kê đầu vào" : "Bảo trì",
      notes: task.reason,
      dueAt: task.dueAt || task.createdAt,
      priority: task.priority,
      status: task.status,
      maintenanceTask: task,
    }))
    const assignedRows: QueueRow[] = assignedTasks.map((task) => ({
      id: `assigned-${task.id}`,
      kind: "assigned",
      title: task.title,
      customer: task.assignedStaffName || "Nhiệm vụ được giao",
      sourceLabel: taskTypeLabels[task.type],
      notes: task.notes || task.cancellationReason || "",
      dueAt: task.dueAt,
      priority: task.priority,
      status: task.status,
      assignedTask: task,
    }))
    const operationalRows: QueueRow[] = operationalTasks
      .filter((task) => !(task.id.startsWith("maintenance-") && maintenanceIds.has(task.id)))
      .map((task) => ({
        id: `operational-${task.id}`,
        kind: "operational",
        title: task.title,
        customer: task.customer,
        sourceLabel: "Vận hành",
        notes: task.sla,
        dueAt: task.dueAt,
        priority: task.priority,
        status: "open",
        operationalTask: task,
      }))
    return [...maintenanceRows, ...assignedRows, ...operationalRows]
  }, [assignedTasks, maintenanceIds, maintenanceTasks, operationalTasks])

  const filteredRows = useMemo(() => rows
    .filter((row) => !dateFilter || !row.dueAt || toDateInputValue(row.dueAt) === dateFilter || row.operationalTask?.recoveryTask)
    .filter((row) => priorityFilter === "all" || row.priority === priorityFilter)
    .sort((left, right) => compareQueueRows(left, right, sort)),
  [dateFilter, priorityFilter, rows, sort])
  const pagination = paginateStaffItems(filteredRows, queuePage)

  const runMaintenance = async (work: () => Promise<MaintenanceTaskApi>, success: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await work()
      showToast(success)
      setMaintenanceCompletionTarget(null)
      setMaintenanceResult("")
      setMaintenanceEvidence([])
      maintenanceRead.refresh()
    } catch (error) {
      showToast(staffErrorMessage(error, "Không thể cập nhật nhiệm vụ bảo trì."))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const completeMaintenance = () => {
    if (!maintenanceCompletionTarget || !maintenanceResult.trim()) return
    void runMaintenance(async () => {
      const evidencePhotos: string[] = []
      for (const file of maintenanceEvidence) {
        const asset = await uploadMaintenanceEvidence(maintenanceCompletionTarget.id, file)
        evidencePhotos.push(asset.id)
      }
      return completeMaintenanceTask(maintenanceCompletionTarget.id, {
        resultReport: maintenanceResult.trim(),
        evidencePhotos,
        makeUnitAvailable,
      })
    }, makeUnitAvailable
      ? `Đã hoàn thành bảo trì gian ${maintenanceCompletionTarget.unitCode}.`
      : `Đã ghi nhận sửa chữa gian ${maintenanceCompletionTarget.unitCode}.`)
  }

  const resetPageAnd = <T,>(callback: (value: T) => void, value: T) => {
    setQueuePage(1)
    callback(value)
  }

  return (
    <Card>
      <div className="border-b border-stone-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-stone-900">Danh sách nhiệm vụ cần xử lý</h3>
            <p className="mt-1 text-xs text-stone-500">
              Bảo trì, nhiệm vụ quản lý giao và hồ sơ vận hành được gom chung, quá hạn và ưu tiên cao nằm trên cùng.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={maintenanceRead.loading} onClick={() => maintenanceRead.refresh()}>
            Tải lại
          </Button>
        </div>
      </div>
      <div className="grid gap-3 border-b border-stone-200 p-4 sm:grid-cols-3">
        <Input label="Ngày đến hạn" type="date" value={dateFilter} onChange={(event) => resetPageAnd(onDateFilterChange, event.target.value)} />
        <Select label="Mức ưu tiên" value={priorityFilter} onChange={(event) => resetPageAnd(onPriorityFilterChange, event.target.value)}>
          <option value="all">Tất cả mức ưu tiên</option>
          <option value="high">Khẩn cấp</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thông thường</option>
        </Select>
        <Select label="Sắp xếp" value={sort} onChange={(event) => resetPageAnd(onSortChange, event.target.value as StaffTaskSort)}>
          <option value="priority">Ưu tiên xử lý trước</option>
          <option value="due-asc">Đến hạn trước</option>
        </Select>
      </div>
      {Boolean(maintenanceRead.error) && <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800">{staffErrorMessage(maintenanceRead.error, "Không thể tải nhiệm vụ bảo trì.")}</div>}
      <Table>
        <Thead>
          <tr><Th>Nhiệm vụ</Th><Th>Nhóm</Th><Th>Ghi chú / khách hàng</Th><Th>Hạn xử lý</Th><Th>Ưu tiên</Th><Th>Trạng thái</Th><Th /></tr>
        </Thead>
        <Tbody>
          {pagination.items.map((row) => {
            const assigned = row.assignedTask
            const maintenance = row.maintenanceTask
            const operational = row.operationalTask
            return (
              <Tr key={row.id}>
                <Td><p className="font-semibold text-stone-900">{row.title}</p><p className="text-xs text-stone-400">{assigned?.id || maintenance?.id || operational?.id}</p></Td>
                <Td><Badge variant="muted">{row.sourceLabel}</Badge></Td>
                <Td className="max-w-xs text-xs"><p>{row.customer}</p><p className="mt-1 text-stone-500">{row.notes || "—"}</p></Td>
                <Td className={`text-xs ${!isFinished(row.status) && new Date(row.dueAt).getTime() < Date.now() ? "font-semibold text-red-700" : ""}`}>{row.dueAt ? formatStaffDate(row.dueAt) : "Không đặt hạn"}</Td>
                <Td><Badge variant={priorityVariant(row.priority)}>{priorityLabels[row.priority]}</Badge></Td>
                <Td><Badge variant={queueStatusVariant(row.status)}>{queueStatusLabel(row.status)}</Badge></Td>
                <Td className="text-right">
                  {assigned?.status === "open" && <Button size="sm" onClick={() => onAssignedStatus(assigned, "in_progress")}>Nhận việc</Button>}
                  {assigned?.status === "in_progress" && <Button size="sm" onClick={() => onOpenAssignedCompletion(assigned)}>Hoàn thành</Button>}
                  {maintenance?.taskType === "inventory_check" && !isFinished(maintenance.status) && <span className="text-xs font-semibold text-amber-700">Hoàn tất trong luồng check-in</span>}
                  {maintenance?.taskType !== "inventory_check" && maintenance?.status === "open" && <Button size="sm" disabled={busy} onClick={() => void runMaintenance(() => startMaintenanceTask(maintenance.id), `Đã bắt đầu bảo trì gian ${maintenance.unitCode}.`)}>Bắt đầu</Button>}
                  {maintenance?.taskType !== "inventory_check" && maintenance?.status === "in_progress" && <Button size="sm" disabled={busy} onClick={() => { setMaintenanceCompletionTarget(maintenance); setMaintenanceResult(maintenance.resultReport || ""); setMaintenanceEvidence([]); setMakeUnitAvailable(true) }}>Hoàn thành</Button>}
                  {maintenance?.status === "completed" && <span className="text-xs font-semibold text-emerald-700">Đã gửi kết quả</span>}
                  {maintenance?.status === "cancelled" && <span className="text-xs font-semibold text-red-700">Đã hủy</span>}
                  {operational && <Button size="sm" variant="outline" onClick={() => onOpenOperational(operational)}>Mở hồ sơ</Button>}
                </Td>
              </Tr>
            )
          })}
          {!pagination.items.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">{maintenanceRead.loading ? "Đang tải nhiệm vụ…" : "Không có nhiệm vụ phù hợp bộ lọc."}</td></tr>}
        </Tbody>
      </Table>
      <StaffPagination {...pagination} total={filteredRows.length} onPageChange={setQueuePage} />

      <Modal open={Boolean(maintenanceCompletionTarget)} onClose={() => { if (!busy) setMaintenanceCompletionTarget(null) }} title="Hoàn thành nhiệm vụ bảo trì">
        {maintenanceCompletionTarget && <div className="space-y-4 p-1">
          <div className="rounded-lg bg-stone-50 p-3 text-sm"><b>{maintenanceCompletionTarget.title} · {maintenanceCompletionTarget.unitCode}</b><p className="mt-1 text-xs text-stone-500">Mã nhiệm vụ: {maintenanceCompletionTarget.id}</p></div>
          <label className="block text-sm font-medium text-stone-700">Báo cáo kết quả<textarea className="mt-1 block min-h-24 w-full rounded border border-stone-300 p-2" maxLength={4000} disabled={busy} value={maintenanceResult} onChange={(event) => setMaintenanceResult(event.target.value)} placeholder="Mô tả hạng mục đã kiểm tra, sửa chữa và kết quả nghiệm thu…" /></label>
          <label className="block text-sm font-medium text-stone-700">Ảnh sửa chữa / nghiệm thu<input className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm" type="file" accept="image/*" multiple disabled={busy} onChange={(event) => setMaintenanceEvidence((current) => [...current, ...Array.from(event.target.files || [])].slice(0, 10))} /></label>
          {maintenanceEvidence.length > 0 && <ul className="list-disc pl-5 text-xs text-stone-600">{maintenanceEvidence.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`}>{file.name}</li>)}</ul>}
          <label className="block text-sm font-medium text-stone-700">Trạng thái gian sau bảo trì<select className="mt-1 block w-full rounded border border-stone-300 p-2" disabled={busy} value={makeUnitAvailable ? "available" : "maintenance"} onChange={(event) => setMakeUnitAvailable(event.target.value === "available")}><option value="available">Đã sẵn sàng khai thác</option><option value="maintenance">Vẫn cần bảo trì</option></select></label>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setMaintenanceCompletionTarget(null)}>Đóng</Button><Button disabled={busy || !maintenanceResult.trim()} onClick={completeMaintenance}>{busy ? "Đang lưu…" : "Gửi báo cáo và hoàn thành"}</Button></div>
        </div>}
      </Modal>
    </Card>
  )
}
