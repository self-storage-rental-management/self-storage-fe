import { Button } from '../../components/ui'
import { ApiClientError } from '../../services/apiClient'
import { userFacingError } from '../../presentation/userFacingError'

export interface CatalogLoadError { message: string; requiresLogin: boolean }
export function catalogLoadError(error: unknown): CatalogLoadError {
  return { message: userFacingError(error, 'Chưa tải được dữ liệu. Vui lòng thử lại.'), requiresLogin: error instanceof ApiClientError && error.status === 401 }
}
export default function CustomerCatalogStatus({ loading, warehouseError, goodsError, onRetry, onLogin }: {
  loading: boolean
  warehouseError: CatalogLoadError | null
  goodsError: CatalogLoadError | null
  onRetry: () => void
  onLogin: () => void
}) {
  if (!loading && !warehouseError && !goodsError) return null
  const loginRequired = warehouseError?.requiresLogin || goodsError?.requiresLogin
  return <div className="mb-5 space-y-3">
    {loading && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Đang tải cơ sở và loại kho...</p>}
    {(warehouseError || goodsError) && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      {loginRequired ? <p>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tải danh mục kho và hàng hóa.</p> : <div className="space-y-2">
        {warehouseError && <p><b>Chưa tải được cơ sở và loại kho.</b> {warehouseError.message}</p>}
        {goodsError && <p><b>Chưa tải được danh mục hàng hóa.</b> {goodsError.message}</p>}
      </div>}
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={loading} onClick={onRetry}>Tải lại danh mục</Button>{loginRequired && <Button type="button" size="sm" onClick={onLogin}>Đăng nhập lại</Button>}</div>
    </div>}
  </div>
}
