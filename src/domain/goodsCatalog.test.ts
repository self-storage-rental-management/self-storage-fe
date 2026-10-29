import { describe, expect, it } from 'vitest'
import { goodsCatalogIssue, resolveDraftMaterial } from './goodsCatalog'
import type { GoodsCatalog } from '../services/customerReservationApi'

const catalog: GoodsCatalog = { categories: [{
  id: 'category-id', code: 'FURNITURE', label: 'Nội thất', reservationCategory: 'FURNITURE',
  status: 'ACTIVE', custom: false, sortOrder: 10,
  materials: [{ id: 'material-id', code: 'WOOD', label: 'Gỗ mới', status: 'ACTIVE', fragile: true, sortOrder: 10 }],
}] }

describe('đối chiếu khai báo với danh mục mới', () => {
  it('theo mã vật liệu khi manager đổi tên và giữ nguyên dữ liệu cũ', () => {
    const draft = { category: 'FURNITURE', catalogMaterialId: 'material-id', materialName: 'Gỗ cũ', fragile: 'no' }
    expect(resolveDraftMaterial(draft, catalog.categories[0])?.label).toBe('Gỗ mới')
    expect(goodsCatalogIssue(draft, catalog)).toBe('')
    expect(draft.materialName).toBe('Gỗ cũ')
    expect(draft.fragile).toBe('no')
  })

  it('cảnh báo loại hàng bị ẩn và vật liệu ngừng sử dụng', () => {
    expect(goodsCatalogIssue({ category: 'REMOVED', materialName: '' }, catalog)).toContain('ngừng sử dụng')
    expect(goodsCatalogIssue({ category: 'FURNITURE', catalogMaterialId: 'old-id', materialName: 'Gỗ cũ' }, catalog)).toContain('Vật liệu')
  })

  it('giữ giới hạn hàng được nhận của loại kho', () => {
    const draft = { category: 'FURNITURE', catalogMaterialId: 'material-id', materialName: 'Gỗ mới' }
    expect(goodsCatalogIssue(draft, catalog, ['another-category'])).toContain('chưa được cấu hình')
    expect(goodsCatalogIssue(draft, catalog, ['category-id'], ['another-material'])).toContain('vật liệu này')
  })
})
