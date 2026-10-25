import { apiRequest } from './apiClient'
import type { GoodsCatalog, GoodsCatalogCategory, GoodsCatalogMaterial, GoodsCatalogStatus } from './customerReservationApi'

interface ApiEnvelope<T> { data: T; correlationId: string }

export interface GoodsCategoryUpdate {
  label: string
  status: GoodsCatalogStatus
}

export interface GoodsMaterialUpdate extends GoodsCategoryUpdate {
  fragile: boolean
}

export async function getManagerGoodsCatalog() {
  return (await apiRequest<ApiEnvelope<GoodsCatalog>>('/api/manager/goods-catalog')).data
}

export async function updateGoodsCategory(id: string, input: GoodsCategoryUpdate) {
  return (await apiRequest<ApiEnvelope<GoodsCatalogCategory>>(`/api/manager/goods-catalog/categories/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })).data
}

export async function addGoodsCategory(input: GoodsCategoryUpdate) {
  return (await apiRequest<ApiEnvelope<GoodsCatalogCategory>>('/api/manager/goods-catalog/categories', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })).data
}

export async function addGoodsMaterial(categoryId: string, input: GoodsMaterialUpdate) {
  return (await apiRequest<ApiEnvelope<GoodsCatalogMaterial>>(`/api/manager/goods-catalog/categories/${categoryId}/materials`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })).data
}

export async function updateGoodsMaterial(id: string, input: GoodsMaterialUpdate) {
  return (await apiRequest<ApiEnvelope<GoodsCatalogMaterial>>(`/api/manager/goods-catalog/materials/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })).data
}

export async function reorderGoodsCategories(orderedIds: string[]) {
  return (await apiRequest<ApiEnvelope<GoodsCatalog>>('/api/manager/goods-catalog/ordering/categories', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds }),
  })).data
}

export async function reorderGoodsMaterials(categoryId: string, orderedIds: string[]) {
  return (await apiRequest<ApiEnvelope<GoodsCatalogCategory>>(`/api/manager/goods-catalog/ordering/categories/${categoryId}/materials`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds }),
  })).data
}
