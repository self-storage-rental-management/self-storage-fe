import { expect, it } from 'vitest'
import {
  canReturnToInventoryStage,
  isInventoryResultReopenable,
  isInventoryStageReadOnly,
  INVENTORY_STAGE_LABELS,
  type InventoryStage,
} from './inventoryStages'

const base = { current: 4 as InventoryStage, submitting: false, checkInStatus: 'setup_completed' }

it('allows walking back from any later inventory stage to an earlier one', () => {
  expect(canReturnToInventoryStage({ ...base, target: 3 })).toBe(true)
  expect(canReturnToInventoryStage({ ...base, target: 2 })).toBe(true)
  expect(canReturnToInventoryStage({ ...base, target: 1 })).toBe(true)
})

it('never offers the current or a later stage as a way back', () => {
  expect(canReturnToInventoryStage({ ...base, target: 4 })).toBe(false)
  expect(canReturnToInventoryStage({ ...base, current: 2, target: 3 })).toBe(false)
})

it('blocks navigation while saving and while the customer has not scheduled the inspection', () => {
  expect(canReturnToInventoryStage({ ...base, submitting: true, target: 3 })).toBe(false)
  expect(canReturnToInventoryStage({ ...base, checkInStatus: 'setup_in_progress', target: 1 })).toBe(false)
})

it('treats an at-site result as reopenable because it never reached the customer', () => {
  expect(isInventoryResultReopenable({ resolutionStatus: 'PENDING_STAFF_RESOLUTION', checkInStatus: 'setup_completed' })).toBe(true)
  for (const resolutionStatus of ['PENDING_CUSTOMER', 'PARTIAL_ACCEPTED', 'RETURN_REQUESTED', 'ACCEPTED', 'NOT_STARTED']) {
    expect(isInventoryResultReopenable({ resolutionStatus, checkInStatus: 'setup_completed' })).toBe(false)
  }
  expect(isInventoryResultReopenable({ resolutionStatus: 'PENDING_STAFF_RESOLUTION', checkInStatus: 'completed' })).toBe(false)
})

it('shows a frozen inspection form read-only but keeps a reopenable at-site result editable', () => {
  expect(isInventoryStageReadOnly({ stage: 2, published: true, reopenable: false })).toBe(true)
  expect(isInventoryStageReadOnly({ stage: 2, published: true, reopenable: true })).toBe(false)
  expect(isInventoryStageReadOnly({ stage: 2, published: false, reopenable: false })).toBe(false)
  expect(isInventoryStageReadOnly({ stage: 3, published: true, reopenable: false })).toBe(false)
  expect(isInventoryStageReadOnly({ stage: 4, published: true, reopenable: false })).toBe(false)
})

it('names all four inventory stages in order', () => {
  expect([1, 2, 3, 4].map(stage => INVENTORY_STAGE_LABELS[stage as InventoryStage]))
    .toEqual(['Kiểm tra khách', 'Kiểm kê hàng hóa', 'Xác nhận hàng hóa kiểm kê', 'Xử lý sai lệch'])
})
