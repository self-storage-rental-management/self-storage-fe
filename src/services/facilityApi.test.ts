import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listAllFacilitiesApi } from './facilityApi'
import * as apiClient from './apiClient'
import * as authApi from './authApi'

describe('listAllFacilitiesApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses public facility catalog when unauthenticated', async () => {
    vi.spyOn(authApi, 'isApiAuthenticated').mockReturnValue(false)
    const apiRequestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({
      data: [
        {
          id: 'fac-1',
          code: 'HCM-Q1-F01',
          name: 'Kho Q1',
          address: '123 Đường',
          city: 'TP. Hồ Chí Minh',
          status: 'active',
          totalUnits: 20,
          availableUnits: 17,
          startingMonthlyPrice: 5000000,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      pagination: { page: 0, pageSize: 50, totalItems: 1, totalPages: 1 },
      correlationId: 'test-corr',
    })

    const result = await listAllFacilitiesApi()

    expect(apiRequestSpy).toHaveBeenCalledWith('/api/public/facilities?page=0&size=100', { skipAuth: true })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('fac-1')
    expect(result[0].occupiedUnits).toBe(3)
    expect(result[0].monthRevenue).toBe(0)
    expect(result[0].minimumMonthlyPrice).toBe(5000000)
  })

  it('falls back to public catalog if authenticated endpoint returns 401', async () => {
    vi.spyOn(authApi, 'isApiAuthenticated').mockReturnValue(true)
    const apiRequestSpy = vi.spyOn(apiClient, 'apiRequest')
      .mockRejectedValueOnce(new apiClient.ApiClientError('Authentication is required', { status: 401 }))
      .mockResolvedValueOnce({
        data: [
          {
            id: 'fac-2',
            code: 'BD-F01',
            name: 'Kho BD',
            address: '456 Bình Dương',
            city: 'Bình Dương',
            status: 'active',
            totalUnits: 10,
            availableUnits: 8,
            startingMonthlyPrice: 4000000,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
        pagination: { page: 0, pageSize: 50, totalItems: 1, totalPages: 1 },
        correlationId: 'test-corr',
      })

    const result = await listAllFacilitiesApi()

    expect(apiRequestSpy).toHaveBeenCalledTimes(2)
    expect(apiRequestSpy).toHaveBeenNthCalledWith(1, '/api/facilities?page=0&size=100')
    expect(apiRequestSpy).toHaveBeenNthCalledWith(2, '/api/public/facilities?page=0&size=100', { skipAuth: true })
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('BD-F01')
    expect(result[0].occupiedUnits).toBe(2)
  })

  it('returns authenticated data directly when token is valid and authenticated', async () => {
    vi.spyOn(authApi, 'isApiAuthenticated').mockReturnValue(true)
    const apiRequestSpy = vi.spyOn(apiClient, 'apiRequest').mockResolvedValueOnce({
      data: [
        {
          id: 'fac-3',
          code: 'HN-F01',
          name: 'Kho HN',
          address: '789 Hà Nội',
          city: 'Hà Nội',
          status: 'active',
          totalUnits: 5,
          availableUnits: 4,
          occupiedUnits: 1,
          minimumMonthlyPrice: 6000000,
          monthRevenue: 12000000,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      pagination: { page: 0, pageSize: 50, totalItems: 1, totalPages: 1 },
      correlationId: 'test-corr',
    })

    const result = await listAllFacilitiesApi()

    expect(apiRequestSpy).toHaveBeenCalledWith('/api/facilities?page=0&size=100')
    expect(result).toHaveLength(1)
    expect(result[0].monthRevenue).toBe(12000000)
    expect(result[0].occupiedUnits).toBe(1)
  })
})
