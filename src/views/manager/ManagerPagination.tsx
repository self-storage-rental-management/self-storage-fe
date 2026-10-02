import { Button, Select } from '../../components/ui'
import { MANAGER_PAGE_SIZE_OPTIONS } from './managerList'

interface Props {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export default function ManagerPagination({ page, pageCount, total, pageSize, onPageChange, onPageSizeChange }: Props) {
  if (!total) return null
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(value => value === 1 || value === pageCount || Math.abs(value - page) <= 1)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return <nav aria-label="Phân trang danh sách Manager" className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
    <p className="text-xs text-stone-500">Hiển thị {from}–{to} trong {total} mục · Trang {page}/{pageCount}</p>
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Số dòng mỗi trang" value={String(pageSize)} onChange={event => onPageSizeChange(Number(event.target.value))}>
        {MANAGER_PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size} dòng</option>)}
      </Select>
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Trước</Button>
      {pages.map((value, index) => <span key={value} className="flex items-center gap-1">
        {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-stone-400">…</span>}
        <Button variant={value === page ? 'secondary' : 'outline'} size="sm" aria-current={value === page ? 'page' : undefined} onClick={() => onPageChange(value)}>{value}</Button>
      </span>)}
      <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Sau</Button>
    </div>
  </nav>
}
