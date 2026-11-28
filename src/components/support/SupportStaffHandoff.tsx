import { useEffect, useId, useState } from 'react'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { useSupportCommand } from '../../hooks/useSupportCommand'
import { listCustomerFacilities, type CustomerFacility } from '../../services/customerReservationApi'
import { getAuthenticatedActor } from '../../services/authApi'
import { isUuid } from '../../services/renewalOperationsApi'
import { supportError } from '../../views/support-api/presentation'
import { userFacingError } from '../../presentation/userFacingError'
import { ApiClientError } from '../../services/apiClient'
import type { SupportCreate } from '../../types/supportApi'

export type SupportRecordTarget = { linkedRecord: NonNullable<SupportCreate['linkedRecord']>; label: string }

function FacilitySelectionQuestion() {
  const [showHelp, setShowHelp] = useState(false)
  const tooltipId = useId()

  return <div className="relative" onMouseLeave={() => setShowHelp(false)}
    onKeyDown={event => {
      if (event.key === 'Escape' && showHelp) {
        event.stopPropagation()
        setShowHelp(false)
      }
    }}>
    <div className="flex items-center gap-1.5">
      <p>Bạn muốn được hỗ trợ tại cơ sở nào?</p>
      <button type="button" aria-label="Hướng dẫn gửi yêu cầu hỗ trợ" aria-describedby={showHelp ? tooltipId : undefined}
        onMouseEnter={() => setShowHelp(true)} onFocus={() => setShowHelp(true)}
        onBlur={() => setShowHelp(false)} onClick={() => setShowHelp(true)}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#44745c] hover:bg-[#e4f1e8] focus-visible:outline-2 focus-visible:outline-[#659c7c]">
        <span aria-hidden="true" className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-current text-xs font-bold leading-none">?</span>
      </button>
    </div>
    {showHelp && <div id={tooltipId} role="tooltip" className="absolute left-0 top-full z-20 w-full max-w-xs pt-1">
      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-700 shadow-lg">
        <p>Chọn cơ sở để gửi yêu cầu. Cuộc trò chuyện được lưu và tự xóa sau 10 ngày không có tin nhắn mới.</p>
        <p>Trao đổi với trợ lý phía trên sẽ được lưu cùng yêu cầu để nhân viên nắm vấn đề.</p>
      </div>
    </div>}
  </div>
}

/** Facility selection is part of the conversation; choosing one submits the request. */
export default function SupportStaffHandoff({ actorId, question, history, target, onCreated, onLocked, onCancel }: {
  actorId: string; question: string; history: NonNullable<SupportCreate['handoffMessages']>; onCreated: (id: string) => void; onLocked: (locked: boolean) => void; onCancel: () => void
  target?: SupportRecordTarget
}) {
  const [page, setPage] = useState(0)
  const [chosen, setChosen] = useState<CustomerFacility>()
  const read = useRentalApiResource(`${actorId}:handoff-facilities:${target?.linkedRecord.id ?? page}`,
    () => target ? Promise.resolve(null) : listCustomerFacilities(page, 20))
  const command = useSupportCommand(`${actorId}:support:customer`, (submission, result) => {
    if (submission.kind === 'create' && result && typeof result === 'object' && 'id' in result && isUuid(result.id)) onCreated(result.id)
  })
  useEffect(() => { onLocked(command.locked); return () => onLocked(false) }, [command.locked, onLocked])
  const submit = (facility?: CustomerFacility) => {
    if (command.locked || command.conflict || getAuthenticatedActor()?.id !== actorId) return
    if (target ? !isUuid(target.linkedRecord.id) : !facility) return
    command.clearError()
    setChosen(facility)
    const subject = target ? `Hỗ trợ ${target.label}` : question
    const description = (target ? `Tôi cần hỗ trợ về ${target.label}.` : `Tôi muốn gặp nhân viên.\nCơ sở: ${facility?.name}.`) +
      (question ? `\nNội dung cần hỗ trợ: ${question}` : '')
    void command.run({ kind: 'create', body: {
      ...(target ? { linkedRecord: target.linkedRecord } : { facilityId: facility?.id }),
      subject: subject.trim().replace(/\s+/g, ' ').slice(0, 100) || 'Yêu cầu gặp nhân viên',
      description: description.slice(0, 4000),
      handoffMessages: history,
    } })
  }
  const facilities = read.data?.data.filter(facility => facility.status === 'active' && isUuid(facility.id)) ?? []
  const errorMessage = command.error instanceof ApiClientError && command.error.status === 409 && /[À-ỹ]/u.test(command.error.message)
    ? userFacingError(command.error) : supportError(command.error)
  return <div className="space-y-3.5">
    <div className="flex flex-col items-end"><span className="mb-1 px-1 text-[10px] text-stone-500">Bạn</span>
      <p className="support-bubble support-bubble--sent text-sm">Tôi muốn gặp nhân viên.</p>
    </div>
    {target ? <div className="support-bubble support-bubble--received text-sm">
      <p>Gửi yêu cầu hỗ trợ cho {target.label}?</p>
      <button type="button" disabled={command.locked || command.conflict} onClick={() => submit()}
        className="mt-2 min-h-9 rounded-lg bg-[#d2eadb] px-3 font-medium text-[#335b44] disabled:opacity-50">Gửi yêu cầu hỗ trợ</button>
    </div> : <div className="support-bubble support-bubble--received text-sm">
      <FacilitySelectionQuestion />
      {read.loading && <p role="status" className="mt-3 text-xs text-stone-500">Đang tải cơ sở…</p>}
      {!!read.error && <div role="alert" className="mt-3 text-xs"><p>{supportError(read.error)}</p><button type="button" onClick={read.refresh} className="mt-2 underline">Tải lại cơ sở</button></div>}
      {!read.loading && !read.error && <div className="mt-3 space-y-2" aria-label="Chọn cơ sở hỗ trợ">
        {facilities.map(facility => <button key={facility.id} type="button" disabled={command.locked || command.conflict} onClick={() => submit(facility)}
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
    </div>}
    <button type="button" disabled={command.locked} onClick={onCancel} className="min-h-9 text-xs text-stone-500 underline disabled:opacity-50">Tiếp tục với trợ lý</button>
    {chosen && <div className="flex flex-col items-end"><p className="support-bubble support-bubble--sent text-sm">{chosen.name}</p></div>}
    {command.busy && <p role="status" className="text-xs text-stone-500">Đang gửi yêu cầu đến cơ sở…</p>}
    {(!!command.error || command.uncertain) && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-stone-700">
      <p>{command.error ? errorMessage : 'Chưa xác nhận được kết quả gửi yêu cầu. Thử lại cùng yêu cầu để tránh tạo trùng.'}</p>
      {command.uncertain ? <button type="button" disabled={command.busy} onClick={command.retry} className="mt-2 min-h-9 font-medium underline">Thử lại yêu cầu đã gửi</button>
        : command.conflict && !target ? <button type="button" onClick={() => { command.clearError(); read.refresh() }} className="mt-2 min-h-9 font-medium underline">Tải lại cơ sở</button>
          : null}
    </div>}
  </div>
}
