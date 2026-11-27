import { useState } from 'react'
import { Button } from '../../components/ui'
import VietnameseDateTimeField from '../../components/VietnameseDateTimeField'
import { scheduleMismatchReturnAppointment, type ApiReturn } from '../../services/returnApi'
import { vietnamDateTimeInput } from '../../utils/vietnamTime'
import { formatCustomerDateTime } from '../../i18n/customerDate'

export default function ReturnAppointment({ record, busy, run }: {
  record: ApiReturn; busy: boolean; run: (work: () => Promise<unknown>) => void
}) {
  const [value, setValue] = useState(() => record.scheduledAppointmentAt ? vietnamDateTimeInput(record.scheduledAppointmentAt) : '')
  const deadline = record.inventoryRemovalDeadlineAt
  const min = vietnamDateTimeInput(Math.ceil(Date.now() / 60_000) * 60_000)
  const max = deadline ? vietnamDateTimeInput(Date.parse(deadline) - 60_000) : undefined
  const locked = !!(record.attendance?.arrivedAt || record.attendance?.lateArrivalClaimedAt
    || record.attendance?.reviewStatus === 'PENDING' || record.warehouseEmptyVerified
    || record.inspectedAt || record.noShowAt)
  if (record.returnType !== 'INVENTORY_MISMATCH' || !['requested', 'scheduled'].includes(record.status) || locked) return null
  const expired = !deadline || Date.parse(deadline) <= Date.now()
  const invalid = !value || value < min || !!max && value > max
  return <section className="mt-3 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4" aria-label="Lịch hẹn trả kho">
    <p className="text-sm font-semibold">{record.scheduledAppointmentAt ? 'Đổi lịch hẹn trả kho' : 'Đặt lịch hẹn trả kho'}</p>
    <p className="text-xs text-stone-600">Chọn ngày và giờ trả kho theo giờ Việt Nam. Đổi lịch hẹn không thay đổi hạn cuối dọn hàng và trả kho.</p>
    {deadline && <p className="text-sm">Hạn cuối dọn hàng và trả kho: <strong>{formatCustomerDateTime(deadline)}</strong></p>}
    <VietnameseDateTimeField label="Ngày hẹn trả kho (dd/mm/yyyy)" value={value}
      minDate={min.slice(0, 10)} maxDate={max?.slice(0, 10)} minDateTime={min} maxDateTime={max}
      disabled={busy || expired} onChange={setValue} />
    {value && invalid && <p role="alert" className="text-xs text-red-700">Thời điểm trả kho phải nằm trong tương lai và trước hạn cuối dọn hàng và trả kho.</p>}
    <Button size="sm" disabled={busy || expired || invalid} onClick={() => run(() => scheduleMismatchReturnAppointment(
      record.id, new Date(`${value}:00+07:00`).toISOString(), record.returnVersion, crypto.randomUUID(),
    ))}>{record.scheduledAppointmentAt ? 'Lưu lịch trả kho' : 'Đặt lịch trả kho'}</Button>
  </section>
}
