export type InventoryStage = 1 | 2 | 3 | 4

export const INVENTORY_STAGE_LABELS: Record<InventoryStage, string> = {
  1: 'Kiểm tra khách',
  2: 'Kiểm kê hàng hóa',
  3: 'Xác nhận hàng hóa kiểm kê',
  4: 'Kết quả tiếp nhận',
}

/**
 * The operator can walk back to an earlier inventory stage so a mistaken entry does not trap
 * them in the newest step. Only stages that are not reached yet stay locked.
 */
export function canReturnToInventoryStage(input: {
  target: InventoryStage
  current: InventoryStage
  submitting: boolean
  checkInStatus: string | null
}) {
  if (input.submitting) return false
  if (input.checkInStatus === 'setup_in_progress') return false
  return input.target < input.current
}

/**
 * An at-site result (`PENDING_STAFF_RESOLUTION`) was only recorded for the operator at the
 * facility — it never reached the customer — so the inspection may still be corrected. Results
 * that were sent to the customer, partly accepted, returned or closed stay frozen.
 */
export function isInventoryResultReopenable(input: {
  resolutionStatus: string | null | undefined
  checkInStatus: string | null | undefined
}) {
  return input.resolutionStatus === 'PENDING_STAFF_RESOLUTION' && input.checkInStatus === 'setup_completed'
}

/**
 * A frozen inspection form is shown read-only instead of an editable form the backend rejects.
 * A still-reopenable at-site result keeps its editable form.
 */
export function isInventoryStageReadOnly(input: {
  stage: InventoryStage
  published: boolean
  reopenable: boolean
}) {
  return input.published && !input.reopenable && input.stage === 2
}
