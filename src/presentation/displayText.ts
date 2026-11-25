import { displayStatusLabel } from './statusLabels'
import { createElement } from 'react'

const bracketedStatusLabels = {
  preserved: 'Đã bảo lưu',
  reserved: 'Đã giữ chỗ',
  published: 'Đã công bố',
} as const

const bracketedStatusColors: Record<string, string> = {
  'Đã bảo lưu': 'bg-blue-100 text-blue-900',
  'Đã giữ chỗ': 'bg-amber-100 text-amber-900',
  'Đã công bố': 'bg-emerald-100 text-emerald-900',
}

const statusLabelPattern = /(\[(?:Đã bảo lưu|Đã giữ chỗ|Đã công bố)\])/
const statusLabelContainers = new Set(['div', 'span', 'p', 'li', 'td', 'th', 'dd', 'dt', 'strong', 'small'])

/** Normalize display text without changing stored values or request payloads. */
export function displayText(value: string): string {
  return value
    .replace(/\b(PAYMENT_PAID|EMAIL_VERIFIED|UNIT_RESERVED|EXPIRED|APPROVED|REJECTED|CANCELLED|CONTRACT_SIGNED|READY_FOR_CHECKIN)\s*·/g, (_, code: string) => {
      const special: Record<string, string> = { PAYMENT_PAID: 'Đã thanh toán', EMAIL_VERIFIED: 'Đã xác minh thư điện tử' }
      return `${special[code] ?? displayStatusLabel(code)} ·`
    })
    .replace(/\s*\u003b\s*/g, ', ')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\[(preserved|reserved|published)\]/gi, (_, status: string) =>
      `[${bracketedStatusLabels[status.toLowerCase() as keyof typeof bracketedStatusLabels]}]`)
}

function childrenText(value: unknown, highlightStatus: boolean): unknown {
  if (typeof value === 'string') {
    const text = displayText(value)
    if (!highlightStatus || !statusLabelPattern.test(text)) return text

    return text.split(statusLabelPattern).map((part, index) => {
      if (index % 2 === 0) return part
      const label = part.slice(1, -1)
      return createElement('span', {
        key: index,
        className: `inline-flex rounded-full px-2.5 py-0.5 align-middle text-xs font-semibold ${bracketedStatusColors[label]}`,
      }, label)
    })
  }
  if (Array.isArray(value)) return value.map(child => childrenText(child, highlightStatus))
  return value
}

export function displayProps(type: unknown, props: unknown): unknown {
  if ((typeof type !== 'string' && type !== Symbol.for('react.fragment')) || !props || typeof props !== 'object') return props
  const source = props as Record<string, unknown>
  const result = { ...source }
  result.children = childrenText(source.children, typeof type === 'string' && statusLabelContainers.has(type))
  for (const key of ['title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription']) {
    if (typeof source[key] === 'string') result[key] = displayText(source[key])
  }
  // Profile and detail screens also show backend text inside non-editable fields.
  // Keep editable values, option identities and request data intact.
  if ((type === 'input' || type === 'textarea') && (source.readOnly || source.disabled)) {
    for (const key of ['value', 'defaultValue']) {
      if (typeof source[key] === 'string') result[key] = displayText(source[key])
    }
  }
  return result
}
