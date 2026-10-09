import { useState, type FormEvent } from 'react'
import { Button, Card } from '../../components/ui'
import { getAuthenticatedActor, type ApiActor } from '../../services/authApi'
import { useRentalApiResource } from '../../hooks/useRentalApiResource'
import ApiReadState from '../rental-api/ApiReadState'
import ApiPager from '../rental-api/ApiPager'
import RentalDetail from '../rental-api/RentalDetail'
import { rentalMoney } from '../rental-api/presentation'
import { loadManagerRentalFinancial, loadManagerRentalPage, managerApiIdentity, requireManagerRead } from './managerD1D5Api'
import { managerDisplayError } from './managerPresentation'

export default function ManagerFinancialApiPanel({ setPage }: { setPage: (page: string) => void }) {
  let actor: ApiActor
  try { actor = requireManagerRead(getAuthenticatedActor(), 'rentals:read') }
  catch (error) { return <Card className="p-5" role="alert">{managerDisplayError(error)}</Card> }
  return <ManagerFinancialSession key={managerApiIdentity(actor)} actor={actor} setPage={setPage} />
}

function ManagerFinancialSession({ actor, setPage }: { actor: ApiActor; setPage: (page: string) => void }) {
  const [page, setPageIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const identity = managerApiIdentity(actor)
  const read = useRentalApiResource(`${identity}:financial-list:${page}:${search}`, () =>
    loadManagerRentalPage(actor, { page, size: 20, search, sort: 'createdAt,desc' }))
  const result = !read.loading && !read.error ? read.data : undefined
  function submit(event: FormEvent) {
    event.preventDefault()
    setSelectedId(null)
    setPageIndex(0)
    setSearch(draft.trim())
  }
  return <div className="space-y-5">
    <h2 className="text-2xl font-bold text-stone-900">Thông tin tài chính hồ sơ thuê</h2>
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">Lịch sử thanh toán</h3>
      <p role="status" className="text-sm text-amber-800">Lịch sử các lần thu và hoàn tiền chưa được kết nối. Bạn có thể xem thông tin tài chính của từng hồ sơ bên dưới.</p>
      <Button variant="outline" onClick={() => setPage('overdue-cases')}>Xem hồ sơ quá hạn</Button>
    </Card>
    <Card className="p-5 space-y-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Tìm hồ sơ thuê">
        <label className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-medium">Tìm kiếm hồ sơ thuê</span>
          <input className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={draft} onChange={event => setDraft(event.target.value)} maxLength={200}
            placeholder="Mã hồ sơ, mã gian kho hoặc tên khách hàng" />
        </label>
        <Button type="submit">Tìm kiếm</Button>
      </form>
      <ApiReadState loading={read.loading} error={read.error} retry={read.refresh} />
      {result && <>
        {result.data.length === 0 && <p role="status" className="text-sm text-stone-500">Không có hồ sơ thuê khớp bộ lọc.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {result.data.map(record => <div key={record.id} className="min-w-0 rounded-lg border border-stone-200 p-4 space-y-2">
            <p className="font-semibold break-words">{record.customer.fullName}</p>
            <p className="text-sm text-stone-600 break-words">{record.facility.name} - Gian {record.storageUnit.code}</p>
            <p className="text-xs text-stone-500 break-all">Mã hồ sơ thuê: {record.id}</p>
            <p className="text-sm">Đơn giá đã áp dụng: {rentalMoney(record.monthlyPrice, record.currency)}/tháng</p>
            <Button variant="outline" size="sm" aria-pressed={selectedId === record.id} onClick={() => setSelectedId(record.id)}>Xem thông tin tài chính</Button>
          </div>)}
        </div>
        <ApiPager pagination={result.pagination} onPage={next => { setSelectedId(null); setPageIndex(next) }} />
        {selectedId && <ManagerRentalFinancialDetail key={`${identity}:${selectedId}`} actor={actor} rentalId={selectedId} />}
      </>}
    </Card>
  </div>
}

export function ManagerRentalFinancialDetail({ actor, rentalId }: { actor: ApiActor; rentalId: string }) {
  const read = useRentalApiResource(`${managerApiIdentity(actor)}:financial-detail:${rentalId}`, () => loadManagerRentalFinancial(actor, rentalId))
  const detail = !read.loading && !read.error ? read.data : undefined
  return <section aria-label="Chi tiết tài chính hồ sơ thuê" className="space-y-3">
    <ApiReadState loading={read.loading} error={read.error} retry={read.refresh} />
    {detail && <RentalDetail rental={detail} />}
  </section>
}
