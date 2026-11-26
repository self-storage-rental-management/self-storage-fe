const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const uuidInReference = new RegExp(uuid, 'gi')
const generatedPaymentReference = new RegExp('^(?:TM-(?:' + uuid + '|[0-9a-f]{32})|(?:MANUAL-RENTAL-|RETURN-)' + uuid + '|OFFSET:' + uuid + ')$', 'i')

export function internalPaymentReference(value?: string | null) {
  return !!value && generatedPaymentReference.test(value)
}

export function recordDisplayCode(value?: string | null, fallback = 'Chưa cấp mã') {
  if (!value) return fallback
  if (value.startsWith('CSV-')) return value
  return value.replace(uuidInReference, id => 'HS-' + id.slice(0, 8).toUpperCase())
}

export function receiptDisplayCode(code?: string | null, reference?: string | null, legacyId?: string | null) {
  if (code?.trim()) return code.trim()
  if (!reference) return recordDisplayCode(legacyId)
  if (internalPaymentReference(reference)) {
    const id = reference.slice(reference.lastIndexOf(':') + 1).replace(/^(TM-|MANUAL-RENTAL-|RETURN-)/i, '')
    return 'HS-' + id.slice(0, 8).toUpperCase()
  }
  return reference === legacyId ? recordDisplayCode(legacyId) : reference
}
