import { describe, expect, it } from 'vitest'
import { pageAfterRefresh, shouldReplaceVisiblePage } from './checkInListPaging'

describe('staff check-in list paging', () => {
  it('keeps the operator on the current page when it still exists', () => {
    // Rows moved out of the group, but page 2 of 5 is still real: stay put.
    expect(shouldReplaceVisiblePage(2, 5)).toBe(true)
    expect(pageAfterRefresh(2, 5)).toBe(2)
  })

  it('does not blank the visible rows when the page fell off the end', () => {
    // Replacing the page here rendered an empty table for a frame, which read as rows jumping.
    expect(shouldReplaceVisiblePage(4, 2)).toBe(false)
    expect(pageAfterRefresh(4, 2)).toBe(1)
  })

  it('falls back to the only page when a refresh leaves a single page', () => {
    expect(shouldReplaceVisiblePage(3, 1)).toBe(false)
    expect(pageAfterRefresh(3, 1)).toBe(0)
  })

  it('still shows an empty result when the filter matches nothing', () => {
    expect(shouldReplaceVisiblePage(0, 0)).toBe(true)
    expect(pageAfterRefresh(0, 0)).toBe(0)
  })

  it('never asks for a negative page', () => {
    expect(pageAfterRefresh(0, 0)).toBeGreaterThanOrEqual(0)
    expect(pageAfterRefresh(0, 1)).toBe(0)
  })
})
