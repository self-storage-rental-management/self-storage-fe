import { Button } from "../../components/ui"

export const STAFF_PAGE_SIZE = 8

export const paginateStaffItems = <T,>(
  items: T[],
  requestedPage: number,
  pageSize = STAFF_PAGE_SIZE,
) => {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return {
    page,
    pageCount,
    items: items.slice((page - 1) * pageSize, page * pageSize),
  }
}

export default function StaffPagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (total <= STAFF_PAGE_SIZE) return null
  const pages = Array.from(
    { length: pageCount },
    (_, index) => index + 1,
  ).filter(
    (value) =>
      value === 1 || value === pageCount || Math.abs(value - page) <= 1,
  )

  return (
    <nav
      aria-label="Phân trang danh sách"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3"
    >
      <p className="text-xs text-stone-500">
        Trang {page}/{pageCount} · {total} mục
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trước
        </Button>
        {pages.map((value, index) => (
          <span key={value} className="flex items-center gap-1">
            {index > 0 && value - pages[index - 1] > 1 && (
              <span className="px-1 text-stone-400">…</span>
            )}
            <Button
              variant={value === page ? "secondary" : "outline"}
              size="sm"
              aria-current={value === page ? "page" : undefined}
              onClick={() => onPageChange(value)}
            >
              {value}
            </Button>
          </span>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
        </Button>
      </div>
    </nav>
  )
}
