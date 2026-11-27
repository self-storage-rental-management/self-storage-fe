import { useEffect, useState } from 'react'
import { formatVndAmount } from '../../i18n/currency'
import { formatCustomerDateTime } from '../../i18n/customerDate'
import { getReturnFeeScheduleForRental, getReturnFeeScheduleForReturn, returnFeeRows, type ReturnFeeSchedule } from '../../services/returnApi'

type Props = { rentalId: string; returnId?: never } | { returnId: string; rentalId?: never }
type State = { key: string; schedule?: ReturnFeeSchedule; error?: boolean }

export function isUsableApplicableSchedule(value: unknown): value is ReturnFeeSchedule {
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)
  if (!record(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !record(value.prices) || !record(value.details)) return false
  return Object.values(value.prices).every(price => typeof price === 'number' && Number.isFinite(price) && price >= 0) &&
    Object.values(value.details).every(detail => record(detail) && ['label', 'trigger', 'applies'].every(field => typeof detail[field] === 'string')) &&
    (value.publishedAt == null || typeof value.publishedAt === 'string')
}

export default function ApplicableReturnFees(props: Props) {
  const id = props.returnId ?? props.rentalId
  const kind = props.returnId ? 'return' : 'rental'
  const key = `${kind}:${id}`
  const [state, setState] = useState<State>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setState({ key })
    const request = kind === 'return' ? getReturnFeeScheduleForReturn(id) : getReturnFeeScheduleForRental(id)
    void request.then(schedule => {
      if (!isUsableApplicableSchedule(schedule)) throw new Error('Invalid schedule')
      if (active) setState({ key, schedule })
    }).catch(() => { if (active) setState({ key, error: true }) })
    return () => { active = false }
  }, [id, kind, key, attempt])

  const current = state?.key === key ? state : undefined
  const schedule = current?.schedule
  const codes = schedule ? Array.from(new Set([...Object.keys(schedule.prices), ...Object.keys(schedule.details)])) : []
  return <section aria-label="Biểu phí trả kho áp dụng" className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
    <h3 className="text-base font-bold text-stone-900">Biểu phí trả kho áp dụng</h3>
    <p className="mt-1 text-sm text-stone-600">Biểu phí áp dụng cho hồ sơ này; khoản thực tế phụ thuộc kết quả nghiệm thu.</p>
    {!current || (!current.schedule && !current.error) ? <p role="status" className="mt-3 text-sm text-stone-600">Đang tải biểu phí…</p> : current.error ? <div role="alert" className="mt-3 text-sm text-red-700">Không thể tải biểu phí áp dụng. <button type="button" className="font-semibold underline" onClick={() => { setState({ key }); setAttempt(value => value + 1) }}>Thử lại</button></div> : schedule && <>
      <p className="mt-3 text-xs text-stone-500">Phiên bản {schedule.revision}{schedule.publishedAt && Number.isFinite(Date.parse(schedule.publishedAt)) ? ` · Công bố ${formatCustomerDateTime(schedule.publishedAt)}` : ''}</p>
      {codes.length === 0 ? <p className="mt-3 text-sm text-stone-600">Biểu phí này chưa có khoản phí được công bố.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {codes.map(code => {
          const detail = schedule.details[code]
          const price = schedule.prices[code]
          const unit = returnFeeRows.find(row => row.code === code)?.unit
          return <div key={code} className="min-w-0 rounded-lg border border-stone-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><h4 className="break-words font-semibold text-stone-900">{detail?.label || code}</h4><span className="font-bold text-stone-900">{typeof price === 'number' && Number.isFinite(price) && price >= 0 ? `${formatVndAmount(price)}${unit ? ` / ${unit}` : ''}` : 'Chưa có đơn giá'}</span></div>
            <p className="mt-2 break-words text-stone-600">Điều kiện: {detail?.trigger || 'Chưa có thông tin'}</p>
            <p className="mt-1 break-words text-stone-600">Áp dụng: {detail?.applies || 'Chưa có thông tin'}</p>
          </div>
        })}
      </div>}
    </>}
  </section>
}
