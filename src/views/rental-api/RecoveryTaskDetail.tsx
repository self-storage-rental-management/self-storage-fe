import { useState } from "react"
import { Button } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { getRecoveryTask, type RecoveryAudience } from "../../services/recoveryTasksApi"
import ApiReadState from "./ApiReadState"
import { rentalDate } from "./presentation"
import { getRecoveryOperations } from "../../services/recoveryTaskOperationsApi"
import RecoveryTaskOperationsPanel, { type RecoveryCloseGuard } from "./RecoveryTaskOperationsPanel"

export const recoveryStatusLabels = { OPEN: "Chờ xử lý", IN_PROGRESS: "Đang xử lý", CLOSED: "Đã đóng" }
export default function RecoveryTaskDetail({ role, id, facilityId, onChanged, closeGuard }: { role: RecoveryAudience; id: string; facilityId: string; onChanged?: () => void; closeGuard?: RecoveryCloseGuard }) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${facilityId}:recovery-task:${id}`
  const [success, setSuccess] = useState('')
  const read = useRentalApiResource(identity, async () => {
    const [task, operations] = await Promise.all([getRecoveryTask(role,id,facilityId), getRecoveryOperations(role,id)])
    return { task, operations }
  })
  const task = read.data?.task
  return <div className="space-y-4">
    <ApiReadState {...read} retry={read.refresh} />
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    {!!read.error && <Button type="button" variant="outline" onClick={read.refresh}>Tải lại nhiệm vụ</Button>}
    {task && <>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[["Khách hàng", task.customerName], ["Gian kho", task.storageUnitCode], ["Trạng thái", recoveryStatusLabels[read.data!.operations.status]], ["Tiếp nhận lúc", rentalDate(task.receivedAt)], ["Mã nhiệm vụ", task.id], ["Mã hồ sơ thuê", task.rentalId]].map(([label,value]) =>
          <div key={label} className="min-w-0"><dt className="text-stone-500">{label}</dt><dd className="mt-1 break-words font-medium text-stone-900">{value}</dd></div>)}
      </dl>
      <div className="rounded-lg bg-stone-50 p-4 text-sm"><p className="font-semibold">Lý do chuyển thu hồi</p><p className="mt-1 whitespace-pre-wrap break-words">{task.reason === "AUTO_OVERDUE_DAY_8" ? "Hợp đồng quá hạn từ ngày thứ 8, chưa hoàn tất gia hạn." : task.reason}</p></div>
      <RecoveryTaskOperationsPanel key={identity} identity={identity} role={role} task={task} view={read.data!.operations} refresh={read.refresh} closeGuard={closeGuard}
        onSuccess={message => { setSuccess(message); read.refresh(); onChanged?.() }} />
    </>}
  </div>
}
