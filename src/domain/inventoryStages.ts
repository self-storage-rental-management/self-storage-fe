export type InventoryStage = 1 | 2 | 3 | 4

export const INVENTORY_STAGE_LABELS: Record<InventoryStage, string> = {
  1: 'Kiểm tra khách',
  2: 'Kiểm kê hàng hóa',
  3: 'Xác nhận hàng hóa kiểm kê',
  4: 'Xử lý sai lệch',
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
 * Once the result is published the backend refuses further inspection edits,
 * so walking back to the inspection form shows the saved data read-only
 * instead of an editable form that cannot be saved.
 */
export function isInventoryStageReadOnly(input: { stage: InventoryStage; published: boolean }) {
  return input.published && input.stage === 2
}
