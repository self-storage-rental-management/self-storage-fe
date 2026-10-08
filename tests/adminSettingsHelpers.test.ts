import { describe, expect, it } from 'vitest'

function extractSettingStringValue(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return String(raw)
  if (typeof raw === 'boolean') return raw ? 'true' : 'false'
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('text' in obj && typeof obj.text === 'string') return obj.text
    if ('value' in obj && (typeof obj.value === 'string' || typeof obj.value === 'number')) return String(obj.value)
    if ('url' in obj && typeof obj.url === 'string') return obj.url
    if ('content' in obj && typeof obj.content === 'string') return obj.content
    if ('message' in obj && typeof obj.message === 'string') return obj.message
    if (Array.isArray(raw)) return raw.join(', ')
    try {
      const json = JSON.stringify(raw)
      return json === '{}' ? '' : json
    } catch {
      return ''
    }
  }
  return String(raw)
}

function extractSettingBooleanValue(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw === 1
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim()
    return lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes' || lower === 'enabled'
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if ('enabled' in obj && typeof obj.enabled === 'boolean') return obj.enabled
    if ('value' in obj) return extractSettingBooleanValue(obj.value)
  }
  return false
}

function extractSettingNumberValue(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(/[^\d.-]/g, ''))
    return Number.isNaN(parsed) ? fallback : parsed
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if ('value' in obj) return extractSettingNumberValue(obj.value, fallback)
    if ('amount' in obj) return extractSettingNumberValue(obj.amount, fallback)
  }
  return fallback
}

describe('adminSettingsHelpers (Fix [object Object] bug)', () => {
  it('extracts raw strings properly', () => {
    expect(extractSettingStringValue('StorageHub Vietnam')).toBe('StorageHub Vietnam')
    expect(extractSettingStringValue('support@storagehub.demo')).toBe('support@storagehub.demo')
  })

  it('prevents [object Object] by extracting nested text from JS objects', () => {
    const slackObj = { text: 'https://hooks.slack.com/services/T00/B00/XXXX' }
    expect(extractSettingStringValue(slackObj)).toBe('https://hooks.slack.com/services/T00/B00/XXXX')
    expect(extractSettingStringValue(slackObj)).not.toContain('[object Object]')
  })

  it('prevents [object Object] by extracting nested value from JS objects', () => {
    const companyObj = { value: 'StorageHub Corp', updatedBy: 'admin' }
    expect(extractSettingStringValue(companyObj)).toBe('StorageHub Corp')
    expect(extractSettingStringValue(companyObj)).not.toContain('[object Object]')
  })

  it('prevents [object Object] by extracting url field from webhook objects', () => {
    const webhookObj = { url: 'https://hooks.slack.com/test' }
    expect(extractSettingStringValue(webhookObj)).toBe('https://hooks.slack.com/test')
  })

  it('extracts boolean values from various formats safely', () => {
    expect(extractSettingBooleanValue(true)).toBe(true)
    expect(extractSettingBooleanValue(false)).toBe(false)
    expect(extractSettingBooleanValue('true')).toBe(true)
    expect(extractSettingBooleanValue('false')).toBe(false)
    expect(extractSettingBooleanValue({ enabled: true })).toBe(true)
  })

  it('extracts numeric values safely', () => {
    expect(extractSettingNumberValue(650000)).toBe(650000)
    expect(extractSettingNumberValue('650000')).toBe(650000)
    expect(extractSettingNumberValue({ value: 3 })).toBe(3)
  })
})
