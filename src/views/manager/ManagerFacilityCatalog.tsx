import { useState } from 'react'
import { Card, Select, Table, Tbody, Td, Th, Thead, Tr } from '../../components/ui'
import { getAuthenticatedActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import { formatVndAmount } from '../../i18n/currency'
import { ApiClientError } from '../../services/apiClient'
import { managerDisplayError } from './managerPresentation'
import { facilityCatalogTypeName, loadManagerFacilityCatalog, type FacilityCatalogRow } from './managerFacilityCatalogApi'

const number = (value: number | null) => value === null ? 'Chưa có thông tin' : value.toLocaleString('vi-VN')
const quantity = (value: number | null, suffix: string) => value === null ? 'Chưa có thông tin' : `${number(value)} ${suffix}`

export function FacilityCatalogTable({ rows }: { rows: FacilityCatalogRow[] }) {
  return <Table>
    <Thead><tr><Th>Loại gian kho</Th><Th>Dài × rộng × cao</Th><Th>Diện tích / thể tích</Th><Th>Tải trọng tối đa</Th><Th>Giá niêm yết</Th><Th>Số gian tại cơ sở</Th></tr></Thead>
    <Tbody>{rows.map(row => <Tr key={row.id}>
      <Td><b>{facilityCatalogTypeName(row.name, row.code)}</b><p className="mt-1 text-xs text-stone-500">{row.status === 'active' ? 'Đang áp dụng' : 'Ngừng áp dụng'}</p></Td>
      <Td>{[row.lengthM, row.widthM, row.heightM].some(value => value === null) ? 'Chưa có thông tin' : `${number(row.lengthM)} × ${number(row.widthM)} × ${number(row.heightM)} m`}</Td>
      <Td>{quantity(row.areaM2, 'm²')}<br />{quantity(row.volumeM3, 'm³')}</Td>
      <Td>{quantity(row.maxLoadKg, 'kg')}</Td>
      <Td>{row.monthlyPrice === null ? 'Chưa có thông tin' : <b>{formatVndAmount(row.monthlyPrice)}/tháng</b>}</Td>
      <Td><b>{row.total.toLocaleString('vi-VN')} gian</b><p className="mt-1 text-xs text-stone-500">{row.counts.available} trống, {row.counts.occupied} đang sử dụng, {row.counts.maintenance} bảo trì</p><p className="mt-1 text-xs text-stone-500">{row.counts.reserved} đã giữ cho khách, {row.counts.held} giữ tạm, {row.counts.assigned} đã phân gian</p></Td>
    </Tr>)}{!rows.length && <tr><td colSpan={6} className="p-6 text-center text-sm text-stone-500">Cơ sở này chưa có loại gian kho.</td></tr>}</Tbody>
  </Table>
}

function CatalogRead({ facilityId, identity }: { facilityId: string; identity: string }) {
  const read = useRentalApiResource(identity, () => loadManagerFacilityCatalog(facilityId))
  if (read.loading) return <p role="status" className="p-4 text-sm text-stone-500">Đang tải loại gian kho và số lượng tại cơ sở...</p>
  if (read.error) return <p role="alert" className="p-4 text-sm text-red-700">{read.error instanceof ApiClientError && read.error.code === 'INVALID_RESPONSE' ? read.error.message : managerDisplayError(read.error)}</p>
  return read.data ? <FacilityCatalogTable rows={read.data} /> : <p className="p-4">Chưa xác minh được thông tin loại gian kho.</p>
}

export default function ManagerFacilityCatalog() {
  const actor = getAuthenticatedActor()
  const scopes = Object.keys(actor?.facilityScopes ?? {}).sort()
  const [selected, setSelected] = useState('')
  const facilityId = scopes.includes(selected) ? selected : scopes[0]
  const permitted = actor?.status === 'ACTIVE' && actor.roles.includes('MANAGER')
  const identity = `${actor?.id}:${JSON.stringify(actor?.facilityScopes)}:${JSON.stringify(actor?.permissions)}:${facilityId}`
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
      <h2 className="font-bold text-stone-900">Loại gian kho tại cơ sở</h2>
      {permitted && scopes.length > 0 && <Select aria-label="Cơ sở xem loại gian kho" value={facilityId} onChange={event => setSelected(event.target.value)}>
        {scopes.map((id, index) => <option key={id} value={id}>{actor?.facilityNames?.[id] || `Cơ sở được phân công ${index + 1}`}</option>)}
      </Select>}
    </div>
    {!permitted ? <p role="alert" className="p-4">Bạn chưa có quyền xem loại gian kho của cơ sở.</p> : !facilityId ? <p role="status" className="p-4">Tài khoản chưa được phân công cơ sở.</p> : <CatalogRead key={identity} identity={identity} facilityId={facilityId} />}
  </Card>
}
