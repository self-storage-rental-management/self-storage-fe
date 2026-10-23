import {
  listCheckIns,
  type CheckInCase,
  type CredentialAlert,
} from "./checkInApi"
import {
  listStaffMaintenanceTasks,
  type MaintenanceTaskApi,
} from "./maintenanceApi"
import { listReturns, type ApiReturn } from "./returnApi"
import { listSupportTickets } from "./supportApi"
import type { SupportTicket } from "../types/supportApi"
import { getAuthenticatedActor } from "./authApi"
import { listAllRecoveryTasks, type RecoveryTask } from "./recoveryTasksApi"
import { ApiClientError } from "./apiClient"

export type StaffDailyOperationPriority = "high" | "medium" | "low"
export type StaffDailyOperationPage = "reservations" | "checkin" | "return" | "support" | "tasks"

export interface StaffDailyOperation {
  id: string
  title: string
  customer: string
  time: string
  dueAt: string
  sla: string
  priority: StaffDailyOperationPriority
  page: StaffDailyOperationPage
  recoveryTask?: Pick<RecoveryTask, "id" | "facilityId">
}

export interface StaffDailyOperationsResult {
  tasks: StaffDailyOperation[]
  failedSources: string[]
}

const isOpenCheckIn = (item: CheckInCase) =>
  !["completed", "no_show", "cancelled", "rejected"].includes(
    item.checkInStatus ?? "",
  )

const isOpenReturn = (item: ApiReturn) => item.status !== "completed"

const isOpenSupport = (item: SupportTicket) =>
  !["resolved", "closed"].includes(item.status)

const isOpenMaintenance = (item: MaintenanceTaskApi) =>
  item.status === "open" || item.status === "in_progress"

const dayOf = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : ""

const dayRange = (date: string) => {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

const priorityFromSupport = (
  priority: "HIGH" | "MEDIUM" | "LOW" | undefined,
): StaffDailyOperationPriority => {
  if (priority === "HIGH") return "high"
  if (priority === "LOW") return "low"
  return "medium"
}

const credentialTask = (alert: CredentialAlert): StaffDailyOperation => ({
  id: `credential-${alert.action.toLowerCase()}-${alert.id}`,
  title:
    alert.action === "ISSUE"
      ? `Cấp quyền truy cập ${alert.storageUnitCode}`
      : `Thu hồi quyền truy cập ${alert.storageUnitCode}`,
  customer: alert.customerName,
  time: alert.dueAt || "",
  dueAt: alert.dueAt || new Date().toISOString(),
  sla: alert.reason,
  priority: "high",
  page: alert.action === "ISSUE" ? "checkin" : "return",
})

const checkInTask = (item: CheckInCase): StaffDailyOperation => {
  const dueAt = item.appointmentAt || item.scheduledAt || item.startDate
  return {
    id: `checkin-${item.checkInId || item.reservationId}`,
    title: `Nhận kho & bàn giao ${item.storageUnitCode}`,
    customer: item.customerName,
    time: dueAt || "",
    dueAt: dueAt || new Date().toISOString(),
    sla:
      item.checkInStatus === "scheduled"
        ? "Khách cần nhận kho hôm nay"
        : "Cần tiếp nhận",
    priority: item.checkInStatus === "scheduled" ? "medium" : "high",
    page: "checkin",
  }
}

const returnTask = (item: ApiReturn): StaffDailyOperation => ({
  id: `return-${item.id}`,
  title: `Kiểm tra trả kho ${item.unitNumber}`,
  customer: item.customerName,
  time: item.scheduledDate,
  dueAt: `${item.scheduledDate}T23:59:59`,
  sla:
    item.status === "refund_pending"
      ? "Cần chuyển hoàn cọc cho khách hàng"
      : item.status === "payment_due"
        ? "Chờ khách hàng thanh toán thêm"
        : item.status === "disputed"
          ? "Quản lý đang xem xét yêu cầu tính lại"
          : "Khách cần trả kho hôm nay",
  priority:
    item.status === "refund_pending" || item.status === "payment_due"
      ? "high"
      : "medium",
  page: "return",
})

const supportTask = (item: SupportTicket): StaffDailyOperation => {
  const dueAt =
    item.sla?.nextUpdateDueAt || item.sla?.firstReplyDueAt || item.createdAt
  return {
    id: `support-${item.id}`,
    title: `Xử lý hỗ trợ ${item.subject}`,
    customer: item.customerName?.trim() || "Chưa có tên khách hàng",
    time: item.assignedAt || item.createdAt,
    dueAt,
    sla: "Yêu cầu hỗ trợ được phân công",
    priority: priorityFromSupport(item.sla?.priority),
    page: "support",
  }
}

const maintenanceTask = (item: MaintenanceTaskApi): StaffDailyOperation => ({
  id: `maintenance-${item.id}`,
  title: `${item.title} · ${item.unitCode}`,
  customer: item.facilityName,
  time: item.dueAt || item.createdAt,
  dueAt: item.dueAt || item.createdAt,
  sla: "Nhiệm vụ bảo trì được phân công",
  priority: item.priority,
  page: "tasks",
})

/** Load Staff operations from the real API surface and normalize them for one daily list. */
export async function loadStaffDailyOperations(
  date: string,
  actorId: string,
  credentialAlerts: CredentialAlert[] = [],
): Promise<StaffDailyOperationsResult> {
  const { from, to } = dayRange(date)
  const actor = getAuthenticatedActor()
  const recoveryScopes = actor?.id === actorId && actor.status === 'ACTIVE' && actor.roles.includes('STAFF') && actor.permissions.includes('rentals:read')
    ? Object.entries(actor.facilityScopes).filter(([,scope]) => ['READ','OPERATE','MANAGE'].includes(scope)).map(([id]) => id) : []
  const results = await Promise.allSettled([
    listCheckIns({
      page: 0,
      pageSize: 100,
      scheduledFrom: from,
      scheduledTo: to,
    }),
    listReturns("staff", 0, 100),
    listSupportTickets("staff", { page: 0, size: 100, sort: "updatedAt,desc" }),
    listStaffMaintenanceTasks({
      assignedStaffId: actorId,
      page: 0,
      pageSize: 100,
    }),
    Promise.allSettled(recoveryScopes.map(id => listAllRecoveryTasks('staff',id))),
  ])

  const failedSources: string[] = []
  const read = <T>(index: number, source: string): T | null => {
    const result = results[index]
    if (result.status === "fulfilled") return result.value as T
    const error = result.reason
    const detail = error instanceof ApiClientError
      ? error.code === "INVALID_RESPONSE" ? "phản hồi không hợp lệ"
        : error.status === 403 ? "không có quyền truy cập"
          : error.status === 404 ? "API chưa sẵn sàng"
            : error.status && error.status >= 500 ? "lỗi máy chủ" : null
      : null
    failedSources.push(detail ? `${source} (${detail})` : source)
    return null
  }

  const checkIns = read<Awaited<ReturnType<typeof listCheckIns>>>(0, "nhận kho")
  const returns = read<Awaited<ReturnType<typeof listReturns>>>(1, "trả kho")
  const support = read<Awaited<ReturnType<typeof listSupportTickets>>>(
    2,
    "hỗ trợ",
  )
  const maintenance =
    read<Awaited<ReturnType<typeof listStaffMaintenanceTasks>>>(3, "bảo trì")

  const recoveryResults = read<PromiseSettledResult<RecoveryTask[]>[]>(4, "thu hồi kho") || []
  if (recoveryResults.some(result => result.status === 'rejected')) failedSources.push('thu hồi kho')
  const recoveryTasks = recoveryResults.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  const tasks = [
    ...recoveryTasks.filter(task => task.status !== 'CLOSED').map((task): StaffDailyOperation => ({
      id: `recovery-${task.id}`,title: `Thu hồi kho - ${task.storageUnitCode}`,customer: task.customerName,
      time: task.receivedAt,dueAt: '',sla: task.status === 'IN_PROGRESS' ? 'Đang xử lý thu hồi' : 'Chờ xử lý thu hồi',
      priority: 'high',page: 'tasks',recoveryTask: { id: task.id,facilityId: task.facilityId },
    })),
    ...credentialAlerts
      .filter((item) => !item.dueAt || dayOf(item.dueAt) === date)
      .map(credentialTask),
    ...(checkIns?.data || [])
      .filter(isOpenCheckIn)
      .filter(
        (item) =>
          dayOf(item.appointmentAt || item.scheduledAt || item.startDate) ===
          date,
      )
      .map(checkInTask),
    ...(returns?.data || [])
      .filter(isOpenReturn)
      .filter((item) => item.scheduledDate === date)
      .map(returnTask),
    ...(support?.data || [])
      .filter(isOpenSupport)
      .filter((item) => item.assignedStaffId === actorId)
      .map(supportTask),
    ...(maintenance?.data || [])
      .filter(isOpenMaintenance)
      .filter((item) => !item.dueAt || dayOf(item.dueAt) === date)
      .map(maintenanceTask),
  ]

  return { tasks, failedSources }
}
