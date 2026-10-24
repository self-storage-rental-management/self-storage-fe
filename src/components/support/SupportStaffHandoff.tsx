import { useEffect, useState } from 'react'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { useSupportCommand } from '../../hooks/useSupportCommand'
import { listCustomerFacilities, type CustomerFacility } from '../../services/customerReservationApi'
import { getAuthenticatedActor } from '../../services/authApi'
import { isUuid } from '../../services/renewalOperationsApi'
import { supportError } from '../../views/support-api/presentation'
import type { SupportCreate } from '../../types/supportApi'

/** Facility selection is part of the conversation; choosing one submits the request. */
export default function SupportStaffHandoff({ actorId, question, history, onCreated, onLocked, onCancel }: {
  actorId: string; question: string; history: NonNullable<SupportCreate['handoffMessages']>; onCreated: (id: string) => void; onLocked: (locked: boolean) => void; onCancel: () => void
}) {
  const [page, setPage] = useState(0)
  const [chosen, setChosen] = useState<CustomerFacility>()
  const read = useRentalApiResource(`${actorId}:handoff-facilities:${page}`, () => listCustomerFacilities(page, 20))
  const command = useSupportCommand(`${actorId}:support:customer`, (submission, result) => {
    if (submission.kind === 'create' && result && typeof result === 'object' && 'id' in result && isUuid(result.id)) onCreated(result.id)
  })
  useEffect(() => { onLocked(command.locked); return () => onLocked(false) }, [command.locked, onLocked])
  const choose = (facility: CustomerFacility) => {
    if (command.locked || command.conflict || getAuthenticatedActor()?.id !== actorId) return
    command.clearError()
    setChosen(facility)
    const description = `Tôi muốn gặp nhân viên.\nCơ sở: ${facility.name}.` +
      (question ? `\nNội dung cần hỗ trợ: ${question}` : '')
    void command.run({ kind: 'create', body: {
      facilityId: facility.id,
      subject: question.trim().replace(/\s+/g, ' ').slice(0, 100) || 'Yêu cầu gặp nhân viên',
      description: description.slice(0, 4000),
      handoffMessages: history,
    } })
  }
  const facilities = read.data?.data.filter(facility => facility.status === 'active' && isUuid(facility.id)) ?? []
  return <div className="space-y-3.5">
    <div className="flex flex-col items-end"><span className="mb-1 px-1 text-[10px] text-stone-500">Bạn</span>
      <p className="support-bubble support-bubble--sent text-sm">Tôi muốn gặp nhân viên.</p>
    </div>
    <div className="support-bubble support-bubble--received text-sm">
      <p>Bạn muốn được hỗ trợ tại cơ sở nào?</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">Chọn cơ sở để gửi yêu cầu. Cuộc trò chuyện được lưu và tự xóa sau 10 ngày không có tin nhắn mới.</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">Trao đổi với trợ lý phía trên sẽ được lưu cùng yêu cầu để nhân viên nắm vấn đề.</p>
      {read.loading && <p role="status" className="mt-3 text-xs text-stone-500">Đang tải cơ sở…</p>}
      {!!read.error && <div role="alert" className="mt-3 text-xs"><p>{supportError(read.error)}</p><button type="button" onClick={read.refresh} className="mt-2 underline">Tải lại cơ sở</button></div>}
      {!read.loading && !read.error && <div className="mt-3 space-y-2" aria-label="Chọn cơ sở hỗ trợ">
        {facilities.map(facility => <button key={facility.id} type="button" disabled={command.locked || command.conflict} onClick={() => choose(facility)}
          className="block min-h-11 w-full rounded-xl border border-[#d0e4d5] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#9dc6aa] hover:bg-[#f0f8f2] focus-visible:outline-2 focus-visible:outline-[#659c7c] disabled:opacity-50">
          <span className="block text-xs font-semibold text-stone-800">{facility.name}</span>
          <span className="mt-0.5 block text-[10px] font-medium text-[#44745c]">{facility.code}</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-stone-500">{facility.address || facility.city || facility.code}</span>
        </button>)}
        {!facilities.length && <p className="text-xs text-stone-500">Chưa có cơ sở đang hoạt động trên trang này.</p>}
        {read.data && read.data.pagination.totalPages > 1 && <nav aria-label="Trang cơ sở hỗ trợ" className="flex items-center justify-between gap-2 text-xs">
          <button type="button" disabled={command.locked || page === 0} onClick={() => setPage(value => value - 1)} className="min-h-9 px-2 disabled:opacity-40">Trước</button>
          <span>{page + 1} / {read.data.pagination.totalPages}</span>
          <button type="button" disabled={command.locked || page + 1 >= read.data.pagination.totalPages} onClick={() => setPage(value => value + 1)} className="min-h-9 px-2 disabled:opacity-40">Sau</button>
        </nav>}
      </div>}
    </div>
    <button type="button" disabled={command.locked} onClick={onCancel} className="min-h-9 text-xs text-stone-500 underline disabled:opacity-50">Tiếp tục với trợ lý</button>
    {chosen && <div className="flex flex-col items-end"><p className="support-bubble support-bubble--sent text-sm">{chosen.name}</p></div>}
    {command.busy && <p role="status" className="text-xs text-stone-500">Đang gửi yêu cầu đến cơ sở…</p>}
    {(!!command.error || command.uncertain) && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-stone-700">
      <p>{command.error ? supportError(command.error) : 'Chưa xác nhận được kết quả gửi yêu cầu. Thử lại cùng yêu cầu để tránh tạo trùng.'}</p>
      {command.uncertain ? <button type="button" disabled={command.busy} onClick={command.retry} className="mt-2 min-h-9 font-medium underline">Thử lại yêu cầu đã gửi</button>
        : command.conflict ? <button type="button" onClick={() => { command.clearError(); read.refresh() }} className="mt-2 min-h-9 font-medium underline">Tải lại cơ sở</button>
          : <p className="mt-1">Bạn có thể chọn lại cơ sở để gửi yêu cầu.</p>}
    </div>}
  </div>
}
