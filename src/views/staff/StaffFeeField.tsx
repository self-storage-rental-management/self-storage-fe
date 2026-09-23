import { useState } from 'react'
import { Input } from '../../components/ui'

export const formatStaffMoney = (value: number) => `${value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} đô la Mỹ`

export default function StaffFeeField({ label, hint, value, onChange, onDetailChange, disabled }: {
  label: string; hint: string; value: string; onChange: (value: string) => void; onDetailChange: (value: string) => void; disabled: boolean
}) {
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState(value)
  const update = (nextQuantity: string, nextPrice: string) => {
    setQuantity(nextQuantity); setPrice(nextPrice)
    const valid = /^\d+(?:\.\d{1,2})?$/.test(nextQuantity) && (nextPrice === '' || /^\d+(?:\.\d{1,2})?$/.test(nextPrice))
    const total = Number(nextQuantity) * Number(nextPrice)
    onChange(valid && Number.isFinite(total) ? (Math.round(total * 100) / 100).toFixed(2) : 'invalid')
    onDetailChange(valid ? `${label}: ${nextQuantity} × ${formatStaffMoney(Number(nextPrice))} = ${formatStaffMoney(total)}.` : '')
  }
  return <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
    <h4 className="font-semibold">{label}</h4><p className="mt-1 text-xs text-stone-600">{hint}</p>
    {!disabled && <div className="mt-3 grid grid-cols-2 gap-2">
      <Input aria-label={`${label} · Số lượng`} label={`${label} · Số lượng`} type="number" min="0" step="0.01" value={quantity} onChange={event => update(event.target.value, price)} />
      <Input aria-label={`${label} · Đơn giá (đô la Mỹ)`} label={`${label} · Đơn giá (đô la Mỹ)`} type="number" min="0" step="0.01" value={price} placeholder="0,00" onChange={event => update(quantity, event.target.value)} />
    </div>}
    <p className="mt-3 text-sm font-semibold">Thành tiền: {Number.isFinite(Number(value)) ? formatStaffMoney(Number(value)) : 'Vui lòng kiểm tra dữ liệu'}</p>
  </div>
}
