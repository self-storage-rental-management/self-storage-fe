import { useEffect, useState } from 'react'
import { getReturnFeeDetails, getReturnFeeSchedule, scheduleRows, type ReturnFeeSchedule } from '../../services/returnApi'

type ScheduleState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; schedule: ReturnFeeSchedule }

export function ReturnFeeScheduleTable({ schedule }: { schedule: ReturnFeeSchedule }) {
  return <div className="overflow-x-auto rounded-xl border border-stone-200" tabIndex={0} aria-label="Bảng phí trả kho, cuộn ngang để xem đầy đủ">
    <table className="w-full min-w-[720px] text-left text-sm">
      <thead className="bg-stone-100 text-stone-800">
        <tr><th scope="col" className="p-3">Loại phí</th><th scope="col" className="p-3">Mức phí</th><th scope="col" className="p-3">Điều kiện áp dụng</th><th scope="col" className="p-3">Đối tượng</th></tr>
      </thead>
      <tbody className="divide-y divide-stone-200">
        {scheduleRows(schedule).map(row => {
          const details = getReturnFeeDetails(schedule, row.code)
          const price = schedule.prices?.[row.code]
          const validPrice = typeof price === 'number' && Number.isFinite(price) && price >= 0
          return <tr key={row.code}>
            <th scope="row" className="p-3 font-semibold text-stone-900">{details.label}</th>
            <td className="p-3 font-semibold text-emerald-700">{validPrice ? `${new Intl.NumberFormat('vi-VN').format(price)} ₫${row.unit ? ` / ${row.unit}` : ''}` : 'Chưa có dữ liệu'}</td>
            <td className="p-3">{details.trigger}</td>
            <td className="p-3">{details.applies}</td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}

export default function CustomerReturnFeeSchedule() {
  const [state, setState] = useState<ScheduleState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    getReturnFeeSchedule().then(schedule => {
      if (!schedule || typeof schedule.prices !== 'object' || schedule.prices === null) throw new Error('Invalid schedule')
      if (active) setState({ status: 'ready', schedule })
    }).catch(() => { if (active) setState({ status: 'error' }) })
    return () => { active = false }
  }, [attempt])

  return <section aria-labelledby="return-fee-schedule" className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
    <h3 id="return-fee-schedule" className="text-lg font-bold text-stone-900">Biểu phí trả kho mới nhất</h3>
    <p>Biểu phí công bố mới nhất áp dụng cho các đặt kho mới. Phí áp dụng cho hợp đồng hiện có có thể khác theo thỏa thuận trong hợp đồng.</p>
    {state.status === 'loading' && <p role="status">Đang tải biểu phí trả kho...</p>}
    {state.status === 'error' && <div role="alert" className="space-y-2 text-red-700">
      <p>Không thể tải biểu phí trả kho. Vui lòng thử lại.</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-lg border border-red-700 px-3 py-1 font-semibold hover:bg-red-50">Thử lại</button>
    </div>}
    {state.status === 'ready' && <ReturnFeeScheduleTable schedule={state.schedule} />}
  </section>
}
