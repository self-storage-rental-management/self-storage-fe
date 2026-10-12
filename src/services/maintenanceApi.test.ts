import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearAuthTokens } from './apiClient'
import {
  completeMaintenanceTask,
  listStaffMaintenanceTasks,
  startMaintenanceTask,
  uploadMaintenanceEvidence,
} from './maintenanceApi'

const task = {
  id: 'task-1', facilityId: 'facility-1', facilityName: 'Cơ sở A', storageUnitId: 'unit-1', unitCode: 'A-01',
  returnCaseId: null, title: 'Sửa khóa cửa', reason: 'Khóa kẹt', priority: 'high', damageClassification: null,
  reportedById: 'manager-1', reportedByName: 'Quản lý', assignedStaffId: 'staff-1', assignedStaffName: 'Nhân viên',
  status: 'in_progress', dueAt: '2026-10-12', startedAt: '2026-10-12T08:00:00Z', completedAt: null,
  resultReport: null, evidencePhotos: [], createdAt: '2026-10-12T07:00:00Z', updatedAt: '2026-10-12T08:00:00Z',
} as const

function envelope(data: unknown) {
  return new Response(JSON.stringify({ data, correlationId: 'c-1' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('maintenanceApi', () => {
  afterEach(() => {
    clearAuthTokens()
    vi.unstubAllGlobals()
  })

  it('lists the current staff maintenance tasks with assignment filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [task],
      pagination: { page: 0, pageSize: 100, totalItems: 1, totalPages: 1, sort: 'createdAt: DESC' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listStaffMaintenanceTasks({ assignedStaffId: 'staff-1', pageSize: 100 })
    expect(result.data[0].unitCode).toBe('A-01')
    expect(fetchMock.mock.calls[0][0]).toContain('/api/staff/maintenance-tasks?page=0&pageSize=100&assignedStaffId=staff-1')
  })

  it('starts and completes a task with the selected unit disposition', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(envelope(task)).mockResolvedValueOnce(envelope({ ...task, status: 'completed', completedAt: '2026-10-12T09:00:00Z' }))
    vi.stubGlobal('fetch', fetchMock)

    await startMaintenanceTask('task-1')
    await completeMaintenanceTask('task-1', { resultReport: 'Đã thay khóa.', evidencePhotos: ['asset-1'], makeUnitAvailable: false })
    expect(fetchMock.mock.calls[0][0]).toContain('/maintenance-tasks/task-1/start')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ resultReport: 'Đã thay khóa.', evidencePhotos: ['asset-1'], makeUnitAvailable: false })
  })

  it('uploads repair evidence as a multipart image linked to the task', async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope({ id: 'asset-1', originalName: 'repair.png', contentType: 'image/png', sizeBytes: 4 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadMaintenanceEvidence('task-1', new File(['test'], 'repair.png', { type: 'image/png' }))
    expect(result.id).toBe('asset-1')
    const options = fetchMock.mock.calls[0][1] as RequestInit
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('entityType')).toBe('MAINTENANCE_TASK')
    expect((options.body as FormData).get('entityId')).toBe('task-1')
  })
})
