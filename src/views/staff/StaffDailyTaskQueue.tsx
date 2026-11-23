import { useEffect, useMemo, useRef, useState } from "react"
import "./staffDailyTaskQueue.css"

import { Badge, Button, Card, Input, Modal, Select, Table, Tbody, Td, Th, Thead, Tr } from "../../components/ui"
import { getAuthenticatedActor } from "../../services/authApi"
import {
  completeMaintenanceTask,
  formatMaintenanceTaskTitle,
  listMaintenanceStaff,
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
  deadlineAt: string | null
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

  const leftDue = new Date(left.deadlineAt || left.dueAt).getTime()
  const rightDue = new Date(right.deadlineAt || right.dueAt).getTime()
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

function deadlineLabel(value: string | null, now: number) {
  if (!value) return null
  const remaining = new Date(value).getTime() - now
  if (!Number.isFinite(remaining)) return null
  if (remaining <= 0) return "Đã quá hạn"
  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const rest = minutes % 60
  return `Còn ${days > 0 ? `${days} ngày ` : ''}${hours > 0 ? `${hours} giờ ` : ''}${rest} phút`
}

function TaskGroup({ title, rows, loading, renderRow }: {
  title: string
  rows: QueueRow[]
  loading: boolean
  renderRow: (row: QueueRow) => React.ReactNode
}) {
  const [page, setPage] = useState(1)
  const pagination = paginateStaffItems(rows, page)
  return (
    <section aria-label={title}>
      <Card className="staff-task-group overflow-hidden !rounded-2xl !shadow-none">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-5 py-5">
          <h3 className="text-lg font-semibold text-stone-900">{title} <span className="ml-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-sm font-normal text-stone-600">{rows.length}</span></h3>
          <span className="text-sm text-stone-500">{rows.length} nhiệm vụ</span>
        </div>
        {rows.length > 0 ? (
          <>
            <Table tableClassName="min-w-[1040px] table-fixed">
              <Thead>
                <tr>
                  <Th className="w-[30%]">Nhiệm vụ</Th>
                  <Th className="w-[12%]">Nhóm</Th>
                  <Th className="w-[17%]">Ghi chú / khách hàng</Th>
                  <Th className="w-[10%]">Hạn xử lý</Th>
                  <Th className="w-[9%]">Ưu tiên</Th>
                  <Th className="w-[11%]">Trạng thái</Th>
                  <Th className="w-[11%] text-right">Thao tác</Th>
                </tr>
              </Thead>
              <Tbody>{pagination.items.map(renderRow)}</Tbody>
            </Table>
            <StaffPagination {...pagination} total={rows.length} onPageChange={setPage} />
          </>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-stone-500">
            {loading ? "Đang tải nhiệm vụ…" : "Không có nhiệm vụ phù hợp bộ lọc."}
          </p>
        )}
      </Card>
    </section>
  )
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
  const [maintenanceCompletionTarget, setMaintenanceCompletionTarget] = useState<MaintenanceTaskApi | null>(null)
  const [maintenanceResult, setMaintenanceResult] = useState("")
  const [maintenanceEvidence, setMaintenanceEvidence] = useState<File[]>([])
  const [makeUnitAvailable, setMakeUnitAvailable] = useState(true)
  const [recoveryHandoverLocation, setRecoveryHandoverLocation] = useState("")
  const [recoveryWitnessStaffId, setRecoveryWitnessStaffId] = useState("")
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const busyRef = useRef(false)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const maintenanceTasks = maintenanceRead.data?.data ?? []
  const witnessRead = useRentalApiResource(
    `${maintenanceIdentity}:recovery-witnesses:${maintenanceCompletionTarget?.facilityId ?? ''}`,
    () => maintenanceCompletionTarget && ['INVENTORY_OVERDUE', 'SETUP_OVERDUE', 'MISMATCH_REMOVAL'].includes(maintenanceCompletionTarget.recoveryType || '')
      ? listMaintenanceStaff(maintenanceCompletionTarget.facilityId)
      : Promise.resolve([]),
    { retainDataOnRefresh: true },
  )
  const witnessOptions = witnessRead.data ?? []
  const maintenanceIds = useMemo(() => new Set(maintenanceTasks.map((task) => `maintenance-${task.id}`)), [maintenanceTasks])

  const rows = useMemo<QueueRow[]>(() => {
    const maintenanceRows: QueueRow[] = maintenanceTasks.map((task) => ({
      id: `maintenance-${task.id}`,
      kind: "maintenance",
      title: formatMaintenanceTaskTitle(task),
      customer: task.customerName?.trim() || "",
      sourceLabel: task.recoveryRequired ? "Thu hồi hàng" : task.taskType === "inventory_check" ? "Kiểm kê đầu vào" : "Bảo trì",
      notes: task.taskType === "inventory_check" ? "" : task.reason,
      dueAt: task.dueAt || task.createdAt,
      deadlineAt: task.deadlineAt ?? null,
      priority: task.priority,
      status: task.status,
      maintenanceTask: task,
    }))
    const assignedRows: QueueRow[] = assignedTasks.map((task) => ({
      id: `assigned-${task.id}`,
      kind: "assigned",
      title: task.title,
      customer: "",
      sourceLabel: taskTypeLabels[task.type],
      notes: task.notes || task.cancellationReason || "",
      dueAt: task.dueAt,
      deadlineAt: null,
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
        deadlineAt: null,
        priority: task.priority,
        status: "open",
        operationalTask: task,
      }))
    return [...maintenanceRows, ...assignedRows, ...operationalRows]
  }, [assignedTasks, maintenanceIds, maintenanceTasks, operationalTasks])

  const filteredRows = useMemo(() => rows
    .filter((row) => !dateFilter || !row.dueAt || toDateInputValue(row.deadlineAt || row.dueAt) === dateFilter || row.operationalTask?.recoveryTask)
    .filter((row) => priorityFilter === "all" || row.priority === priorityFilter)
    .sort((left, right) => compareQueueRows(left, right, sort)),
  [dateFilter, priorityFilter, rows, sort])

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
      setRecoveryHandoverLocation("")
      setRecoveryWitnessStaffId("")
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
        unitVacated: maintenanceCompletionTarget.recoveryRequired ? true : undefined,
        recoveryHandoverLocation: maintenanceCompletionTarget.recoveryRequired ? recoveryHandoverLocation.trim() : undefined,
        recoveryWitnessStaffId: ['INVENTORY_OVERDUE', 'SETUP_OVERDUE', 'MISMATCH_REMOVAL'].includes(maintenanceCompletionTarget.recoveryType || '') ? recoveryWitnessStaffId : undefined,
      })
    }, makeUnitAvailable
      ? `Đã hoàn thành bảo trì gian ${maintenanceCompletionTarget.unitCode}.`
      : `Đã ghi nhận sửa chữa gian ${maintenanceCompletionTarget.unitCode}.`)
  }

  const renderRow = (row: QueueRow) => {
    const assigned = row.assignedTask
    const maintenance = row.maintenanceTask
    const operational = row.operationalTask
    return (
      <Tr key={row.id}>
        <Td className="[overflow-wrap:anywhere]"><p className="font-semibold text-stone-900">{row.title}</p><p className="text-xs text-stone-400">{assigned?.id || maintenance?.id || operational?.id}</p></Td>
        <Td><Badge variant="muted">{row.sourceLabel}</Badge></Td>
        <Td className="text-xs [overflow-wrap:anywhere]">
          {row.customer && <p>{row.customer}</p>}
          {row.notes && <p className="text-stone-500">{row.notes}</p>}
          {!row.customer && !row.notes && "—"}
        </Td>
        <Td className={`text-xs ${!isFinished(row.status) && new Date(row.deadlineAt || row.dueAt).getTime() < now ? "font-semibold text-red-700" : ""}`}>
          <p>{row.deadlineAt ? formatStaffDate(row.deadlineAt) : row.dueAt ? formatStaffDate(row.dueAt) : "Không đặt hạn"}</p>
          {!isFinished(row.status) && deadlineLabel(row.deadlineAt || row.dueAt, now) && <p className="mt-1 font-semibold">{deadlineLabel(row.deadlineAt || row.dueAt, now)}</p>}
        </Td>
        <Td><Badge variant={priorityVariant(row.priority)}>{priorityLabels[row.priority]}</Badge></Td>
        <Td><Badge variant={queueStatusVariant(row.status)}>{queueStatusLabel(row.status)}</Badge></Td>
        <Td className="text-right">
          {assigned?.status === "open" && <Button size="sm" onClick={() => onAssignedStatus(assigned, "in_progress")}>Nhận việc</Button>}
          {assigned?.status === "in_progress" && <Button size="sm" onClick={() => onOpenAssignedCompletion(assigned)}>Hoàn thành</Button>}
          {maintenance?.taskType === "inventory_check" && !isFinished(maintenance.status) && <span className="text-xs font-semibold text-amber-700">Hoàn tất trong quy trình nhận kho</span>}
          {maintenance?.recoveryType === "RETURN_NO_SHOW" && !isFinished(maintenance.status) && <span className="text-xs font-semibold text-red-700">Hoàn tất trong biên bản trả kho</span>}
          {maintenance?.taskType !== "inventory_check" && maintenance?.recoveryType !== "RETURN_NO_SHOW" && maintenance?.status === "open" && <Button size="sm" disabled={busy} onClick={() => void runMaintenance(() => startMaintenanceTask(maintenance.id), `Đã bắt đầu xử lý gian ${maintenance.unitCode}.`)}>Bắt đầu</Button>}
          {maintenance?.taskType !== "inventory_check" && maintenance?.recoveryType !== "RETURN_NO_SHOW" && maintenance?.status === "in_progress" && <Button size="sm" disabled={busy} onClick={() => { setMaintenanceCompletionTarget(maintenance); setMaintenanceResult(maintenance.resultReport || ""); setMaintenanceEvidence([]); setRecoveryHandoverLocation(maintenance.recoveryHandoverLocation || ""); setRecoveryWitnessStaffId(maintenance.recoveryWitnessStaffId || ""); setMakeUnitAvailable(!maintenance.recoveryRequired) }}>Hoàn thành</Button>}
          {maintenance?.status === "completed" && <span className="text-xs font-semibold text-emerald-700">Đã gửi kết quả</span>}
          {maintenance?.status === "cancelled" && <span className="text-xs font-semibold text-red-700">Đã hủy</span>}
          {operational && <Button size="sm" variant="outline" onClick={() => onOpenOperational(operational)}>Mở hồ sơ</Button>}
        </Td>
      </Tr>
    )
  }

  return (
    <div className="staff-task-queue space-y-5">
      <Card className="!rounded-2xl !shadow-none">
        <div className="border-b border-stone-200 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-stone-900">Danh sách nhiệm vụ ca làm</h3>
            </div>
            <Button variant="outline" size="sm" disabled={maintenanceRead.loading} onClick={() => maintenanceRead.refresh()}>
              Tải lại
            </Button>
          </div>
        </div>
        <div className="staff-task-filters grid gap-4 p-5 sm:grid-cols-3">
          <Input label="Ngày đến hạn" type="date" value={dateFilter} onChange={(event) => onDateFilterChange(event.target.value)} />
          <Select label="Mức ưu tiên" value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value)}>
            <option value="all">Tất cả mức ưu tiên</option>
            <option value="high">Khẩn cấp</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thông thường</option>
          </Select>
          <Select label="Sắp xếp" value={sort} onChange={(event) => onSortChange(event.target.value as StaffTaskSort)}>
            <option value="priority">Ưu tiên xử lý trước</option>
            <option value="due-asc">Đến hạn trước</option>
          </Select>
        </div>
      </Card>
      {Boolean(maintenanceRead.error) && <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800">{staffErrorMessage(maintenanceRead.error, "Không thể tải nhiệm vụ bảo trì.")}</div>}
      {[
        { title: "Đang diễn ra", rows: filteredRows.filter(row => !isFinished(row.status)) },
        { title: "Đã xử lý", rows: filteredRows.filter(row => isFinished(row.status)) },
      ].map(group => (
        <TaskGroup key={JSON.stringify([group.title, dateFilter, priorityFilter, sort])}
          title={group.title} rows={group.rows} loading={maintenanceRead.loading} renderRow={renderRow} />
      ))}

      <Modal open={Boolean(maintenanceCompletionTarget)} onClose={() => { if (!busy) setMaintenanceCompletionTarget(null) }} title="Hoàn thành nhiệm vụ bảo trì">
        {maintenanceCompletionTarget && <div className="space-y-4 p-1">
          <div className="rounded-lg bg-stone-50 p-3 text-sm"><b>{formatMaintenanceTaskTitle(maintenanceCompletionTarget)}</b><p className="mt-1 text-xs text-stone-500">Mã nhiệm vụ: {maintenanceCompletionTarget.id}</p></div>
          {maintenanceCompletionTarget.recoveryRequired && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-900">Cần có bằng chứng kiểm kê và bàn giao hàng. Gian kho chưa được mở lại ở bước này.</p>}
          {maintenanceCompletionTarget.recoveryRequired && <label className="block text-sm font-medium text-stone-700">Khu vực lưu tạm và người nhận bàn giao<input className="mt-1 block w-full rounded border border-stone-300 p-2" maxLength={500} disabled={busy} value={recoveryHandoverLocation} onChange={(event) => setRecoveryHandoverLocation(event.target.value)} placeholder="Ví dụ: Khu lưu tạm A, kệ 02, nhân viên nhận bàn giao" /></label>}
          {['INVENTORY_OVERDUE', 'SETUP_OVERDUE', 'MISMATCH_REMOVAL'].includes(maintenanceCompletionTarget.recoveryType || '') && <label className="block text-sm font-medium text-stone-700">Nhân viên thứ hai xác nhận thu hồi<select className="mt-1 block w-full rounded border border-stone-300 bg-white p-2" disabled={busy || witnessRead.loading} value={recoveryWitnessStaffId} onChange={(event) => setRecoveryWitnessStaffId(event.target.value)}><option value="">Chọn nhân viên cùng cơ sở</option>{witnessOptions.map((witness) => <option key={witness.id} value={witness.id}>{witness.fullName}</option>)}</select></label>}
          <label className="block text-sm font-medium text-stone-700">Báo cáo kết quả<textarea className="mt-1 block min-h-24 w-full rounded border border-stone-300 p-2" maxLength={4000} disabled={busy} value={maintenanceResult} onChange={(event) => setMaintenanceResult(event.target.value)} placeholder="Mô tả hạng mục đã kiểm tra, sửa chữa và kết quả nghiệm thu…" /></label>
          <label className="block text-sm font-medium text-stone-700">Ảnh sửa chữa / nghiệm thu<input className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm" type="file" accept="image/*" multiple disabled={busy} onChange={(event) => setMaintenanceEvidence((current) => [...current, ...Array.from(event.target.files || [])].slice(0, 10))} /></label>
          {maintenanceEvidence.length > 0 && <ul className="list-disc pl-5 text-xs text-stone-600">{maintenanceEvidence.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`}>{file.name}</li>)}</ul>}
          <label className="block text-sm font-medium text-stone-700">Trạng thái gian sau bảo trì<select className="mt-1 block w-full rounded border border-stone-300 p-2" disabled={busy || maintenanceCompletionTarget.recoveryRequired} value={makeUnitAvailable ? "available" : "maintenance"} onChange={(event) => setMakeUnitAvailable(event.target.value === "available")}><option value="available">Đã sẵn sàng khai thác</option><option value="maintenance">Vẫn cần bảo trì</option></select></label>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setMaintenanceCompletionTarget(null)}>Đóng</Button><Button disabled={busy || !maintenanceResult.trim() || maintenanceCompletionTarget.recoveryRequired && (!recoveryHandoverLocation.trim() || ['INVENTORY_OVERDUE', 'SETUP_OVERDUE', 'MISMATCH_REMOVAL'].includes(maintenanceCompletionTarget.recoveryType || '') && !recoveryWitnessStaffId)} onClick={completeMaintenance}>{busy ? "Đang lưu…" : "Gửi báo cáo và hoàn thành"}</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
