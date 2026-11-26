const retired = new Set(['NOTICE', 'ACCEPT', 'DECLINE', 'CONFIRM_VIOLATION', 'APPROVE', 'RESCHEDULE'])
const replies = new Set(['WILL_ATTEND', 'CANNOT_ATTEND', 'DISPUTE'])
const managerStages = new Set(['REVIEW_REQUIRED', 'AWAITING_ASSIGNMENT', 'AWAITING_APPROVAL', 'BLOCKED'])

export function isManagerOverdueRecovery(entry: { stage: string; escalated?: boolean }): boolean {
  return entry.escalated === true && managerStages.has(entry.stage)
}

export function visibleRecoveryActions<T extends string>(actions: readonly T[], stage: string, responseDueAt: string | null, now = Date.now()): T[] {
  const closed = stage === 'COMPLETED' || stage === 'CANCELLED'
  return actions.filter(action => !retired.has(action)
    && (closed || !replies.has(action) || !!responseDueAt && now < Date.parse(responseDueAt)))
}
