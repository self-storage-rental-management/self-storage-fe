export default function InventoryFieldDifference({ actual, declared, declaredLabel, unit = '', tolerance = 0, disabled = false }: {
  actual: string | number | null | undefined
  declared: string | number | null | undefined
  declaredLabel?: string
  unit?: string
  tolerance?: number
  disabled?: boolean
}) {
  if (disabled || actual == null || declared == null || String(actual).trim() === '' || String(declared).trim() === '') return null
  const numeric = typeof declared === 'number'
  if (numeric && (!Number.isFinite(Number(actual)) || !Number.isFinite(declared))) return null
  if (numeric ? Math.abs(Number(actual) - declared) <= tolerance : String(actual) === String(declared)) return null
  const value = declaredLabel ?? (numeric ? declared.toLocaleString('vi-VN', { maximumFractionDigits: 6 }) : String(declared))
  return <p className="mt-1 text-xs font-medium text-amber-800" role="status">Chênh lệch so với khai báo: {value}{unit ? ` ${unit}` : ''}.</p>
}
