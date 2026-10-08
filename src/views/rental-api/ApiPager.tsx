import { Button } from "../../components/ui"
import type { RentalApiPage } from "../../types/rentalApi"
export default function ApiPager({
  pagination: p,
  onPage,
  disabled = false,
}: {
  pagination: RentalApiPage<unknown>["pagination"]
  onPage: (page: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap justify-between items-center gap-2 py-3 text-sm">
      <span>
        {p.totalItems} bản ghi · Trang {p.totalPages ? p.page + 1 : 0}/
        {p.totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={disabled || p.page === 0}
          onClick={() => onPage(p.page - 1)}
        >
          Trước
        </Button>
        <Button
          variant="outline"
          disabled={disabled || p.page + 1 >= p.totalPages}
          onClick={() => onPage(p.page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  )
}
