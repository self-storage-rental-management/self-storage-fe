import { useState } from 'react'
import { Input } from '../../components/ui'
import { USD_TO_VND_RATE, formatVnd } from '../../i18n/currency'

export const formatStaffMoney = formatVnd

export default function StaffFeeField({ label, hint, value, onChange, onDetailChange, disabled }: {
  label: string; hint: string; value: string; onChange: (value: string) => void; onDetailChange: (value: string) => void; disabled: boolean
}) {
  const [quantity, setQuantity] = useState(value && Number(value) > 0 ? '1' : '')
  const [price, setPrice] = useState(value && Number(value) > 0 ? String(Math.round(Number(value) * USD_TO_VND_RATE)) : '')
  const update = (nextQuantity: string, nextPrice: string) => {
    setQuantity(nextQuantity); setPrice(nextPrice)
    const valid = /^\d+(?:\.\d{1,2})?$/.test(nextQuantity) && /^\d+$/.test(nextPrice)
    const totalVnd = Number(nextQuantity) * Number(nextPrice)
    const totalBase = totalVnd / USD_TO_VND_RATE
    onChange(valid && Number.isFinite(totalBase) ? String(totalBase) : 'invalid')
    onDetailChange(valid ? `${label}: ${nextQuantity} × ${Number(nextPrice).toLocaleString('vi-VN')} ₫ = ${totalVnd.toLocaleString('vi-VN')} ₫.` : '')
  }
  return <div className="flex h-full flex-col rounded-lg border border-stone-200 bg-stone-50 p-4">
    <h4 className="font-semibold">{label}</h4><p className="mt-1 min-h-10 text-xs leading-5 text-stone-600">{hint}</p>
    {!disabled && <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
      <Input aria-label={`${label} · Số lượng`} label="Số lượng" type="number" min="0" step="1" value={quantity} placeholder="0" onChange={event => update(event.target.value, price)} />
      <Input aria-label={`${label} · Đơn giá (đồng)`} label="Đơn giá (₫)" type="number" min="0" step="1000" value={price} placeholder="0" onChange={event => update(quantity, event.target.value)} />
    </div>}
    <p className="mt-auto pt-4 text-sm font-semibold">Thành tiền: {Number.isFinite(Number(value)) ? formatStaffMoney(Number(value)) : 'Vui lòng kiểm tra dữ liệu'}</p>
  </div>
}
