import { describe, expect, it } from 'vitest'
import { customerFacilityName, customerFacilityAddress, isCustomerVisiblePolicy, vietnamesePolicy } from './customerLabels'

describe('Nhãn giao diện khách hàng', () => {
  it('nhận diện tên BE cũ và khôi phục đúng địa chỉ', () => {
    expect(customerFacilityName('', 'StorageHub Quan 1')).toBe('Kho Việt – Cơ sở Quận 1')
    expect(customerFacilityAddress('', 'StorageHub Binh Duong', 'Thu Dau Mot')).toContain('468 Đại lộ Bình Dương')
    expect(customerFacilityAddress('NEW', 'Kho mới', 'Địa chỉ mới')).toBe('Địa chỉ mới')
    expect(isCustomerVisiblePolicy({ name: 'Thời gian ân hạn' })).toBe(false)
    expect(isCustomerVisiblePolicy({ name: 'Notice to Vacate' })).toBe(false)
    expect(isCustomerVisiblePolicy({ name: 'Tiền cọc đảm bảo' })).toBe(true)
  })
  it('giữ tên cơ sở cũ theo mã, không thay đổi cơ sở mới', () => {
    expect(customerFacilityName('HCM-Q1-F01', 'StorageHub Quan 1')).toBe('Kho Việt – Cơ sở Quận 1')
    expect(customerFacilityName('BD-F01', 'StorageHub Binh Duong')).toBe('Kho Việt – Cơ sở Bình Dương')
    expect(customerFacilityName('NEW', 'Kho mới')).toBe('Kho mới')
  })
  it('Việt hóa dữ liệu chính sách cũ mà không đổi số hoặc sửa nguồn', () => {
    const old = { name: 'Grace Period', value: '3 days', scope: 'All Facilities' }
    expect(vietnamesePolicy(old)).toEqual({ name: 'Thời gian ân hạn', value: '3 ngày', scope: 'Toàn bộ cơ sở' })
    expect(old.name).toBe('Grace Period')
    expect(vietnamesePolicy({ ...old, name: 'Security Deposit', value: '1 month' }).value).toBe('1 tháng')
  })
})
