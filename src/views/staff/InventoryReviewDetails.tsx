import type { ReactNode } from 'react'

export interface InventoryReviewLine {
  id: string; name: string; category: string; material: string; description: string
  quantity: number; dimensions: number[]; weightPerPackage: number
  fragile: boolean; stackable: boolean; horizontal: boolean; condition: string; damage: string
}

export default function InventoryReviewDetails({ lines, packaging, packagingCondition, packagingNote, reason, evidence }: {
  lines: InventoryReviewLine[]; packaging: string; packagingCondition: string; packagingNote: string; reason: string; evidence: ReactNode
}) {
  const yesNo = (value: boolean) => value ? 'Có' : 'Không'
  const number = (value: number) => Number.isFinite(value) ? value.toLocaleString('vi-VN', { maximumFractionDigits: 6 }) : 'Chưa ghi nhận'
  const field = (label: string, value: string) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-words font-medium text-stone-900">{value || 'Không có'}</dd></div>
  return <section className="space-y-4 text-stone-900" aria-label="Thông tin hàng hóa đã kiểm kê">
    <h4 className="font-bold">Thông tin hàng hóa đã kiểm kê</h4>
    {lines.map((line, index) => <article key={line.id} className="rounded-xl border border-stone-200 bg-white p-4">
      <h5 className="font-semibold">{index + 1}. {line.name}</h5>
      <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {field('Loại hàng hóa', line.category)}{field('Chất liệu chính', line.material)}{field('Mô tả hàng hóa', line.description)}
        {field('Số lượng thực tế', `${number(line.quantity)} kiện`)}{field('Dài × rộng × cao', `${line.dimensions.map(number).join(' × ')} cm`)}
        {field('Nặng/kiện', `${number(line.weightPerPackage)} kg`)}{field('Dễ vỡ', yesNo(line.fragile))}
        {field('Cho phép xếp chồng', yesNo(line.stackable))}{field('Cho phép đặt nằm ngang', yesNo(line.horizontal))}
        {field('Tình trạng hàng hóa', line.condition)}{line.damage && field('Mô tả hư hỏng', line.damage)}
      </dl>
    </article>)}
    <dl className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2">
      {field('Phương thức đóng gói thực tế', packaging)}{field('Tình trạng đóng gói', packagingCondition)}
      {field('Ghi chú đóng gói', packagingNote)}{field('Lý do chênh lệch', reason)}
    </dl>
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm"><p className="mb-2 font-semibold">Ảnh/PDF bằng chứng kiểm kê</p>{evidence}</div>
  </section>
}
