import type { LockInspectionResult } from '../services/returnApi'

export const lockInspectionLabels: Record<LockInspectionResult, string> = {
  RETURNED_USABLE: 'Đủ ổ và chìa, dùng được',
  MISSING_OR_INCOMPLETE: 'Mất hoặc thiếu ổ / chìa',
  DAMAGED: 'Đã thu ổ nhưng bị hỏng',
  UNVERIFIED: 'Chưa xác minh được',
}

type Props = {
  className: string
  disabled?: boolean
  value?: LockInspectionResult | ''
  onChange?: (value: LockInspectionResult | '') => void
}

export default function LockInspectionSelect({ className, disabled, value, onChange }: Props) {
  return (
    <select name="lockInspectionResult" required className={className} disabled={disabled}
      value={value} defaultValue={value === undefined ? '' : undefined}
      onChange={event => onChange?.(event.target.value as LockInspectionResult | '')}
    >
      <option value="" disabled>Chọn kết quả kiểm tra</option>
      {Object.entries(lockInspectionLabels).map(([result, label]) => <option key={result} value={result}>{label}</option>)}
    </select>
  )
}
