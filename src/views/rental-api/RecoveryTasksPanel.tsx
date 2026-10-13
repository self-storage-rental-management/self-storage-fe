import { useState } from "react"
import { Button, Card, Modal } from "../../components/ui"
import { useRentalApiResource } from "../../hooks/useRentalApiResource"
import { getAuthenticatedActor } from "../../services/authApi"
import { getRecoveryTask, listRecoveryTasks, type RecoveryAudience } from "../../services/recoveryTasksApi"
import ApiPager from "./ApiPager"
import ApiReadState from "./ApiReadState"
import { rentalDate } from "./presentation"

const statusLabels = { OPEN: "Chờ xử lý", IN_PROGRESS: "Đang xử lý", CLOSED: "Đã đóng" }
const reasonText = (reason: string) => reason === "AUTO_OVERDUE_DAY_8"
  ? "Hợp đồng quá hạn từ ngày thứ 8, chưa hoàn tất gia hạn."
  : reason

export default function RecoveryTasksPanel({ role, facilityId }: { role: RecoveryAudience; facilityId: string }) {
  const actor = getAuthenticatedActor()
  const identity = `${actor?.id}:${JSON.stringify(actor?.permissions)}:${JSON.stringify(actor?.facilityScopes)}:${role}:${facilityId}`
  return <RecoverySession key={identity} identity={identity} role={role} facilityId={facilityId} />
}
function RecoverySession({ identity, role, facilityId }: { identity: string; role: RecoveryAudience; facilityId: string }) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string>()
  const read = useRentalApiResource(`${identity}:${page}`, () => listRecoveryTasks(role, facilityId, page))
  return <section className="space-y-4" aria-label="Nhiệm vụ thu hồi kho">
    <div>
      <h2 className="text-xl font-bold">Hồ sơ đã chuyển thu hồi</h2>
      <p className="mt-1 text-sm text-stone-500">Các nhiệm vụ đã được cơ sở tiếp nhận để xử lý.</p>
    </div>
    <ApiReadState {...read} retry={read.refresh} />
    {read.data && <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>{["Khách hàng", "Gian kho", "Tiếp nhận lúc", "Trạng thái", "Thao tác"].map(label =>
              <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {read.data.data.map(task => <tr key={task.id} className="hover:bg-stone-50/70">
              <td className="px-5 py-4 font-semibold text-stone-900">{task.customerName}</td>
              <td className="px-5 py-4 font-mono text-stone-700">{task.storageUnitCode}</td>
              <td className="px-5 py-4 whitespace-nowrap text-stone-600">{rentalDate(task.receivedAt)}</td>
              <td className="px-5 py-4"><span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${task.status === "CLOSED" ? "bg-stone-100 text-stone-600" : "bg-amber-50 text-amber-800"}`}>{statusLabels[task.status]}</span></td>
              <td className="px-5 py-4 text-right"><Button variant="outline" onClick={() => setSelected(task.id)}>Chi tiết</Button></td>
            </tr>)}
            {read.data.data.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-stone-500">Chưa có hồ sơ chuyển thu hồi tại cơ sở này.</td></tr>}
          </tbody>
        </table>
      </div>
      {read.data.pagination.totalPages > 1 && <div className="px-5"><ApiPager pagination={read.data.pagination} onPage={setPage} /></div>}
    </Card>}
    {selected && <Modal open title="Chi tiết nhiệm vụ thu hồi" onClose={() => setSelected(undefined)}>
      <RecoveryDetail key={`${identity}:${selected}`} identity={identity} role={role} id={selected} facilityId={facilityId} />
    </Modal>}
  </section>
}
function RecoveryDetail({ identity, role, id, facilityId }: { identity: string; role: RecoveryAudience; id: string; facilityId: string }) {
  const read = useRentalApiResource(`${identity}:${id}`, () => getRecoveryTask(role, id, facilityId))
  const task = read.data
  return <div className="space-y-4">
    <ApiReadState {...read} retry={read.refresh} />
    {task && <>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[["Khách hàng", task.customerName], ["Gian kho", task.storageUnitCode], ["Trạng thái", statusLabels[task.status]], ["Tiếp nhận lúc", rentalDate(task.receivedAt)], ["Mã nhiệm vụ", task.id], ["Mã hồ sơ thuê", task.rentalId]].map(([label, value]) =>
          <div key={label} className="min-w-0"><dt className="text-stone-500">{label}</dt><dd className="mt-1 break-words font-medium text-stone-900">{value}</dd></div>)}
      </dl>
      <div className="rounded-lg bg-stone-50 p-4 text-sm"><p className="font-semibold">Lý do chuyển thu hồi</p><p className="mt-1 whitespace-pre-wrap break-words">{reasonText(task.reason)}</p></div>
      <p className="text-sm text-stone-500">Việc thu hồi tài sản, kiểm kê và bàn giao kho cần được ghi nhận trong quy trình xử lý tại cơ sở.</p>
    </>}
  </div>
}
