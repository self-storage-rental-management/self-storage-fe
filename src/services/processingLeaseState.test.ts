import { describe, expect, it } from 'vitest'
import { processingTarget } from './processingLeaseState'

/**
 * The lease only protects a write if the browser sends X-Processing-* with it, and the browser
 * only sends them for routes this function recognises. While a write route was missing here it
 * mutated the record without bumping the revision, so the stamp drifted and the operator was
 * refused at the next step with "Hồ sơ đã thay đổi".
 */
const ID = '2f1ef3bb-cd8c-4967-bf9c-4cef4b31e7b2'

describe('processingTarget covers every staff check-in write', () => {
  const writeRoutes = [
    'identity-correction',
    'identity-comparison',
    'identity-verification',
    'contract-signing',
    'payment-confirmation',
    'remaining-payment',
    'setup/start',
    'setup/complete',
    'inventory-arrival',
    'inventory-identity',
    'inventory-draft',
    'prohibited-goods-recovery',
    'inventory-draft/resolve',
    'inventory-draft/publish',
    'inventory-resolution-at-site',
    'inventory-return-reminder',
    'signature-refusal',
    'reject',
  ]

  it.each(writeRoutes)('tracks %s so its write carries the lease', (route) => {
    expect(processingTarget(`/api/staff/check-ins/${ID}/${route}`, 'POST')).toEqual({
      target: 'CHECK_IN',
      id: ID,
    })
  })

  it('still ignores a plain read so reads never take ownership', () => {
    expect(processingTarget(`/api/staff/check-ins/${ID}`, 'GET')).toBeNull()
  })

  it('ignores a non-write method on a write route', () => {
    expect(processingTarget(`/api/staff/check-ins/${ID}/setup/start`, 'GET')).toBeNull()
  })
})
