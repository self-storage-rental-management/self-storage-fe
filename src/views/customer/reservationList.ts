export function matchesReservationSearch(query: string, fields: (string | null | undefined)[]) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi-VN')
  const text = normalize(fields.filter(Boolean).join(' '))
  return normalize(query).trim().split(/\s+/).every(word => text.includes(word))
}

export function reservationPage(count: number, requestedPage: number, pageSize: number) {
  const size = Math.max(1, pageSize)
  const pages = Math.max(1, Math.ceil(count / size))
  const page = Math.max(1, Math.min(requestedPage, pages))
  const start = (page - 1) * size
  return { page, pages, start, end: Math.min(count, start + size) }
}
