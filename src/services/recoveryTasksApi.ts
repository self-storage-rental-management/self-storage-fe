import { apiRequest } from "./apiClient"
import { readRentalEnvelope, readRentalPage, rentalQuery } from "./rentalApi"
import { isInstant, isUuid } from "./renewalOperationsApi"

export type RecoveryAudience = "manager" | "staff"
export interface RecoveryTask {
  id: string
  caseRef: string
  rentalId: string
  facilityId: string
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"
  reason: string
  receivedAt: string
  customerName: string
  storageUnitCode: string
  assignedStaffId?: string | null
  assignedStaffName?: string | null
}
export function isRecoveryTask(value: unknown): value is RecoveryTask {
  const task = value as RecoveryTask | null
  return !!task && [task.id, task.rentalId, task.facilityId].every(isUuid)
    && task.caseRef === `RENTAL_TERM:${task.rentalId}`
    && ["OPEN", "IN_PROGRESS", "CLOSED"].includes(task.status)
    && typeof task.reason === "string" && task.reason.trim().length > 0
    && isInstant(task.receivedAt)
    && typeof task.customerName === "string" && typeof task.storageUnitCode === "string"
    && (task.assignedStaffId == null || isUuid(task.assignedStaffId))
    && (task.assignedStaffName == null || typeof task.assignedStaffName === "string")
}
function path(role: RecoveryAudience) {
  if (role !== "manager" && role !== "staff") throw new Error("Vai trò không hợp lệ.")
  return `/api/${role}/recovery-tasks`
}
export async function listRecoveryTasks(role: RecoveryAudience, facilityId: string, page = 0) {
  if (!isUuid(facilityId)) throw new Error("Mã cơ sở không hợp lệ.")
  return readRentalPage<RecoveryTask>(
    await apiRequest(`${path(role)}${rentalQuery({ facilityId, page, size: 20 }, ["facilityId", "page", "size"], [])}`),
    value => isRecoveryTask(value) && value.facilityId === facilityId,
    page,
  )
}
export async function getRecoveryTask(role: RecoveryAudience, id: string, facilityId?: string) {
  if (!isUuid(id) || (facilityId !== undefined && !isUuid(facilityId))) throw new Error("Mã nhiệm vụ không hợp lệ.")
  return readRentalEnvelope<RecoveryTask>(await apiRequest(`${path(role)}/${id}`),
    value => isRecoveryTask(value) && value.id === id && (facilityId === undefined || value.facilityId === facilityId))
}
export async function assignRecoveryTask(task: RecoveryTask, assignedStaffId: string) {
  if (!isUuid(task.id) || !isUuid(assignedStaffId)) throw new Error("Mã nhiệm vụ hoặc nhân viên không hợp lệ.")
  return readRentalEnvelope<RecoveryTask>(await apiRequest(`${path("manager")}/${task.id}/assignment`, {
    method: "PUT", body: JSON.stringify({ assignedStaffId }),
  }), value => isRecoveryTask(value) && value.id === task.id && value.facilityId === task.facilityId
    && value.assignedStaffId === assignedStaffId)
}
export async function listAllRecoveryTasks(role: RecoveryAudience, facilityId: string) {
  const tasks: RecoveryTask[] = []
  let page = 0
  let totalPages = 1
  do {
    const result = await listRecoveryTasks(role,facilityId,page++)
    tasks.push(...result.data)
    totalPages = result.pagination.totalPages
  } while (page < totalPages)
  return [...new Map(tasks.map(task => [task.id,task])).values()]
}
