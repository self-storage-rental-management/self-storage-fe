/**
 * Where the staff handover/inspection modal should sit.
 *
 * The modal hosts two workflows in one dialog: the handover steps (1-5) and the inspection
 * progress (step 6). Re-acquiring the processing lease reloads the same case, and resetting the
 * step there used to drop an operator out of the inspection progress back into the handover
 * steps. These helpers keep the operator where they are unless they ask to switch.
 */

/** Step the handover workflow would land on for a status. `setup_completed` maps to inspection. */
export function handoverStepForStatus(status: string | null | undefined) {
  switch (status) {
    case 'identity_verified': return 2
    case 'contract_signed': return 3
    case 'payment_collected': return 4
    case 'handover_pending_receipt': return 5
    case 'setup_in_progress': return 5
    case 'setup_completed': return 6
    case 'completed': return 6
    default: return 1
  }
}

export const INSPECTION_STEP = 6

/**
 * Resume step when the same case is loaded again (lease re-acquire, list refresh).
 *
 * `requestedInspection` is what the caller asked to open; `currentlyInInspection` is the mode the
 * operator is already looking at. A refresh that asks for the same mode keeps the current step so
 * the form does not jump, while a deliberate switch between the two workflows still moves them.
 */
export function resolveResumeStep(input: {
  requestedInspection: boolean
  currentlyInInspection: boolean
  currentStep: number
  status: string | null | undefined
}) {
  const { requestedInspection, currentlyInInspection, currentStep, status } = input
  if (requestedInspection === currentlyInInspection) return currentStep
  return requestedInspection ? INSPECTION_STEP : Math.min(5, handoverStepForStatus(status))
}
