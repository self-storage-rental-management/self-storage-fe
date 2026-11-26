import { describe, expect, it } from 'vitest'
import { handoverStepForStatus, INSPECTION_STEP, resolveResumeStep } from './staffHandoverPosition'

describe('staff handover position', () => {
  it('maps a completed setup to the inspection step, not a handover step', () => {
    // The bug: Math.min(5, 6) clamped the inspection step back to "finish handover".
    expect(handoverStepForStatus('setup_completed')).toBe(INSPECTION_STEP)
    expect(handoverStepForStatus('completed')).toBe(INSPECTION_STEP)
  })

  it('keeps a handover status on its own step', () => {
    expect(handoverStepForStatus('identity_verified')).toBe(2)
    expect(handoverStepForStatus('contract_signed')).toBe(3)
    expect(handoverStepForStatus('payment_collected')).toBe(4)
    expect(handoverStepForStatus('handover_pending_receipt')).toBe(5)
    expect(handoverStepForStatus('setup_in_progress')).toBe(5)
    expect(handoverStepForStatus(null)).toBe(1)
  })

  it('stays on the open inspection stage when the lease reloads it', () => {
    // Operator opened "xem tiến trình kiểm kê" and is on stage 3; a lease re-acquire asked for
    // inspection again, so the step must not move back to the handover workflow.
    for (const currentStep of [INSPECTION_STEP]) {
      expect(resolveResumeStep({
        requestedInspection: true,
        currentlyInInspection: true,
        currentStep,
        status: 'setup_completed',
      })).toBe(INSPECTION_STEP)
    }
  })

  it('does not drag an operator out of the inspection progress on reload', () => {
    // The reported bug: inspection open, then the reload re-opened without the inventory flag.
    expect(resolveResumeStep({
      requestedInspection: false,
      currentlyInInspection: true,
      currentStep: INSPECTION_STEP,
      status: 'setup_completed',
    })).toBe(Math.min(5, INSPECTION_STEP))
  })

  it('still lets the operator deliberately switch between the two workflows', () => {
    // Clicking "xem tiến trình bàn giao" while in inspection must move to the handover step.
    expect(resolveResumeStep({
      requestedInspection: false,
      currentlyInInspection: true,
      currentStep: INSPECTION_STEP,
      status: 'setup_in_progress',
    })).toBe(5)
    // Clicking the inspection button while on the handover steps must open inspection.
    expect(resolveResumeStep({
      requestedInspection: true,
      currentlyInInspection: false,
      currentStep: 2,
      status: 'setup_completed',
    })).toBe(INSPECTION_STEP)
  })
})
