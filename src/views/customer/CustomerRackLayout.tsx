import { useEffect, useState } from 'react'
import CustomerRackSummary from './CustomerRackSummary'
import { Button } from '../../components/ui'
import { isApiAuthenticated } from '../../services/authApi'
import { ApiClientError } from '../../services/apiClient'
import { getCustomerRackLayout, type RackResult } from '../../services/rackLayoutApi'

export default function CustomerRackLayout({ facilityId, unitTypeId }: { facilityId: string; unitTypeId: string }) {
  const authenticated = isApiAuthenticated()
  const [result, setResult] = useState<RackResult | null>()
  const [error, setError] = useState<'unavailable' | 'unknown' | false>(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!authenticated) return
    let active = true
    setResult(undefined)
    setError(false)
    void getCustomerRackLayout(facilityId, unitTypeId).then(data => {
      if (active) setResult(data ?? null)
    }).catch(reason => {
      if (!active) return
      setError(reason instanceof ApiClientError && reason.status === 404 ? 'unavailable' : 'unknown')
    })
    return () => { active = false }
  }, [authenticated, facilityId, unitTypeId, retry])

  return <section className="space-y-3 rounded-xl border border-stone-200 p-4">
    <h4 className="font-semibold">Kệ và sức chứa của một gian</h4>
    {!authenticated ? <p className="text-sm">Đăng nhập để xem cách bố trí kệ.</p> : error ? <>
      <p role="alert" className="text-sm text-red-800">{error === 'unavailable' ? 'Loại kho này chưa được công bố, đã được lưu trữ hoặc không còn mở cho thuê.' : 'Không tải được thông tin kệ.'}</p>
      <Button size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>Tải lại</Button>
    </> : result === undefined ? <p role="status" className="text-sm">Đang tải thông tin kệ…</p>
      : result === null ? <p className="text-sm">Loại kho này chưa có thông tin kệ để tính sức chứa. Bạn có thể chọn loại kho khác hoặc liên hệ cơ sở.</p>
      : <CustomerRackSummary result={result} />}
  </section>
}
