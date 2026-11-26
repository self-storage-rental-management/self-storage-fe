import { describe, expect, it } from 'vitest'
import { paginateStaffItems, STAFF_PAGE_SIZE } from './StaffPagination'

/**
 * The check-in list has more rows than one page, but the panel only drew its own paginator when
 * the server reported more than one page at pageSize 20. With 13 open cases that never happened,
 * so the list had no pagination at all.
 */
describe('staff check-in list paging at the shared page size', () => {
  it('splits the current workload across more than one page', () => {
    const rows = Array.from({ length: 13 }, (_, index) => index)
    const first = paginateStaffItems(rows, 1)
    const second = paginateStaffItems(rows, 2)

    expect(STAFF_PAGE_SIZE).toBeLessThan(13)
    expect(first.pageCount).toBeGreaterThan(1)
    expect(first.items).toHaveLength(STAFF_PAGE_SIZE)
    expect(second.items).toHaveLength(13 - STAFF_PAGE_SIZE)
    expect([...first.items, ...second.items]).toEqual(rows)
  })

  it('keeps a single page when the group is small', () => {
    const rows = Array.from({ length: 3 }, (_, index) => index)
    const page = paginateStaffItems(rows, 1)
    expect(page.pageCount).toBe(1)
    expect(page.items).toHaveLength(3)
  })

  it('clamps a page that no longer exists after rows move groups', () => {
    const rows = Array.from({ length: 4 }, (_, index) => index)
    const page = paginateStaffItems(rows, 5)
    expect(page.page).toBe(1)
    expect(page.items).toHaveLength(4)
  })
})
