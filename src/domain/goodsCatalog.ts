import type { GoodsCatalog, GoodsCatalogCategory } from '../services/customerReservationApi'

export interface CatalogGoodsDraft {
  category: string
  catalogMaterialId?: string
  materialName: string
}

export function resolveDraftMaterial(item: CatalogGoodsDraft, category?: GoodsCatalogCategory) {
  return category?.materials.find(material => material.status === 'ACTIVE' && (
    item.catalogMaterialId ? material.id === item.catalogMaterialId : material.label === item.materialName
  ))
}

export function goodsCatalogIssue(item: CatalogGoodsDraft, catalog: GoodsCatalog | null, categoryIds?: string[], materialIds?: string[]) {
  if (!item.category || !catalog) return ''
  const category = catalog.categories.find(value => value.code === item.category && value.status === 'ACTIVE')
  if (!category) return 'Loại hàng đã tạm ẩn hoặc ngừng sử dụng. Vui lòng chọn loại hàng khác.'
  if (categoryIds?.length && !categoryIds.includes(category.id)) return 'Loại kho đang chọn chưa được cấu hình nhận loại hàng này. Vui lòng chọn loại kho hoặc loại hàng khác.'
  if (!category.custom && (item.catalogMaterialId || item.materialName)) {
    const material = resolveDraftMaterial(item, category)
    if (!material) return 'Vật liệu đã tạm ẩn hoặc ngừng sử dụng. Vui lòng chọn vật liệu khác.'
    if (materialIds?.length && !materialIds.includes(material.id)) return 'Loại kho đang chọn chưa được cấu hình nhận vật liệu này. Vui lòng chọn vật liệu hoặc loại kho khác.'
  }
  return ''
}
