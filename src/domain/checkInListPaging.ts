/**
 * Paging decisions for the staff check-in work list.
 *
 * The list refreshes on its own because the customer confirms receipt and reports setup
 * completion on a different portal. Rows also move between the ongoing and processed groups,
 * so the row count of the page the operator is reading can shrink at any refresh. These helpers
 * keep the operator on the page they chose instead of silently moving them.
 */

/** A requested page that no longer exists falls back to the last real page instead of blank. */
export function pageAfterRefresh(page: number, totalPages: number) {
  if (totalPages <= 0) return Math.max(0, page)
  if (page < totalPages) return page
  return Math.max(0, totalPages - 1)
}

/**
 * True when a refresh may replace the visible rows. A page beyond the new last page must not be
 * replaced, otherwise the table empties out for a frame and the rows appear to jump.
 */
export function shouldReplaceVisiblePage(page: number, totalPages: number) {
  return totalPages === 0 || page < totalPages
}
