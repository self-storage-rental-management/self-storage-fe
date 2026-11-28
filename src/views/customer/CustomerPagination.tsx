import React from 'react'

export interface CustomerPaginationProps {
  page: number
  pageCount: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  itemLabel?: string
  ariaLabel?: string
  className?: string
}

export default function CustomerPagination({
  page,
  pageCount,
  total,
  pageSize,
  pageSizeOptions = [5, 10, 20],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'đơn',
  ariaLabel = 'Phân trang đơn đặt giữ kho',
  className = '',
}: CustomerPaginationProps) {
  if (total <= 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Smart page numbers array with ellipsis
  const getPageNumbers = () => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1)
    }
    const numbers = new Set<number>([1, pageCount, page, page - 1, page + 1].filter(n => n >= 1 && n <= pageCount))
    return Array.from(numbers).sort((a, b) => a - b)
  }

  const pages = getPageNumbers()

  return (
    <nav
      aria-label={ariaLabel}
      className={`rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm transition-all duration-200 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Left side: Range summary & Page size selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-stone-600 font-medium">
            {total === 1 ? (
              <>Hiển thị <b className="text-stone-900">1</b> trong <b className="text-stone-900">1</b> {itemLabel} (Trang 1/1)</>
            ) : (
              <>Hiển thị <b className="text-stone-900">{from}–{to}</b> trong tổng số <b className="text-stone-900">{total}</b> {itemLabel}</>
            )}
          </span>

          {onPageSizeChange && pageSizeOptions.length > 0 && (
            <div className="flex items-center gap-1.5 text-stone-500">
              <span className="hidden xs:inline">Số lượng:</span>
              <select
                aria-label={`Số ${itemLabel} mỗi trang`}
                value={pageSize}
                onChange={event => {
                  const newSize = Number(event.target.value)
                  onPageSizeChange(newSize)
                }}
                className="border border-stone-300 rounded-lg px-2 py-1 bg-stone-50 font-semibold text-stone-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                {pageSizeOptions.map(option => (
                  <option key={option} value={option}>
                    {option} {itemLabel}/trang
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right side: Page navigation */}
        <div className="flex items-center gap-1.5 self-center sm:self-auto">
          {/* Previous Page Button */}
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-medium transition disabled:opacity-40 disabled:cursor-not-allowed select-none"
            aria-label="Trang trước"
          >
            ← Trước
          </button>

          {/* Page Number Buttons */}
          <div className="flex items-center gap-1">
            {pages.map((value, index) => (
              <React.Fragment key={value}>
                {index > 0 && value - pages[index - 1] > 1 && (
                  <span className="px-1 text-stone-400 select-none" aria-hidden="true">…</span>
                )}
                <button
                  type="button"
                  aria-current={value === page ? 'page' : undefined}
                  onClick={() => onPageChange(value)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs transition select-none ${
                    value === page
                      ? 'bg-amber-600 text-white font-bold shadow-sm ring-1 ring-amber-600'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 font-medium'
                  }`}
                >
                  {value}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Next Page Button */}
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-medium transition disabled:opacity-40 disabled:cursor-not-allowed select-none"
            aria-label="Trang sau"
          >
            Sau →
          </button>
        </div>
      </div>
    </nav>
  )
}
